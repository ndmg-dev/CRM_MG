import { useEffect, useState } from "react";
import { WizardStepClassificacao } from "../components/wizard/WizardStepClassificacao";
import { WizardStepConferencia } from "../components/wizard/WizardStepConferencia";
import { WizardStepContexto } from "../components/wizard/WizardStepContexto";
import { WizardStepDuplicatas } from "../components/wizard/WizardStepDuplicatas";
import { WizardStepResultado, type NotaResultado } from "../components/wizard/WizardStepResultado";
import { WizardStepUpload } from "../components/wizard/WizardStepUpload";
import { WizardStepsIndicator } from "../components/WizardStepsIndicator";
import { groupKeyForInvoice, type ClassificationRow, type InvoiceGroup, type NFeParsed, type TaggedItem } from "../components/wizard/types";
import type { WizardUploadResultado } from "../hooks/queries";

const STEPS = ["Upload", "Contexto", "Conferência", "Classificação", "Resultado"];

interface WizardState {
  step: number;
  pendingUpload: WizardUploadResultado | null;
  invoices: NFeParsed[];
  groups: InvoiceGroup[];
  eligibleItems: TaggedItem[];
  classification: Record<string, ClassificationRow>;
  // Resultado já finalizado (só em memória — nunca vai pro sessionStorage, ver
  // STORAGE_KEY): permite voltar do Resultado e retornar sem refinalizar.
  resultados: NotaResultado[] | null;
}

const EMPTY_STATE: WizardState = {
  step: 0,
  pendingUpload: null,
  invoices: [],
  groups: [],
  eligibleItems: [],
  classification: {},
  resultados: null,
};

// Progresso do wizard sobrevive a um refresh acidental — persistido em
// sessionStorage (por aba, some ao fechar; não se mistura entre abas nem
// vira "rascunho" esquecido que reaparece dias depois, como aconteceria com
// localStorage). Só os passos 0–3 são persistidos: nada neles já foi gravado
// no servidor, então restaurá-los é sempre seguro/idempotente.
//
// O passo 4 (Resultado) NUNCA é persistido de propósito: é onde
// `/wizard/finalizar` roda, e essa rota NÃO é idempotente (cada chamada
// cria uma nova Invoice, sem checar duplicata) — se o estado fosse
// restaurado ali, o efeito que auto-calcula ao montar disparia de novo e
// duplicaria notas já finalizadas com sucesso. Assim que o usuário chega no
// Resultado, o progresso salvo é apagado: um refresh depois disso reinicia
// o wizard do zero (passo 0), em vez de arriscar re-finalizar.
const STORAGE_KEY = "fronteira:wizard-state:v1";

function loadPersistedState(): WizardState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.step !== "number" || parsed.step < 0 || parsed.step > 3) return EMPTY_STATE;
    return {
      step: parsed.step,
      pendingUpload: parsed.pendingUpload ?? null,
      invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
      eligibleItems: Array.isArray(parsed.eligibleItems) ? parsed.eligibleItems : [],
      classification: parsed.classification && typeof parsed.classification === "object" ? parsed.classification : {},
      resultados: null, // nunca persistido — ver STORAGE_KEY (só passos 0–3)
    };
  } catch {
    return EMPTY_STATE; // storage corrompido/formato antigo — começa do zero, não quebra a tela
  }
}

/** Agrupa as notas parseadas por (CNPJ destinatário + competência) — a
 * mesma chave usada pelo sistema Django original (`group_key_for_invoice`).
 * Cada nota carrega sua própria competência (vinda do XML); não há um campo
 * de competência único e editável para o envio inteiro, porque um mesmo
 * envio pode legitimamente misturar notas de meses/empresas diferentes —
 * e é assim que a separação é feita na prática (por empresa e competência,
 * ver README). */
function buildGroups(invoices: NFeParsed[]): InvoiceGroup[] {
  const grouped = new Map<string, InvoiceGroup>();
  for (const nfe of invoices) {
    const key = groupKeyForInvoice(nfe.destinatario_cnpj, nfe.competencia);
    const existing = grouped.get(key);
    if (existing) {
      existing.invoices.push(nfe);
    } else {
      grouped.set(key, {
        key,
        cnpj: nfe.destinatario_cnpj,
        competencia: nfe.competencia,
        invoices: [nfe],
        companyId: null,
        existingCompany: false,
      });
    }
  }
  return [...grouped.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export default function WizardFronteira() {
  const [state, setState] = useState<WizardState>(loadPersistedState);

  useEffect(() => {
    if (state.step >= 4) {
      // ponto sem volta: cálculo já pode ter sido disparado — não é seguro
      // deixar isso pra restaurar depois (ver comentário acima).
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // sessionStorage indisponível/cheio (modo privado, cota) — segue sem
      // persistir; não é motivo pra quebrar o wizard.
    }
  }, [state]);

  function goTo(step: number) {
    setState((s) => ({ ...s, step }));
  }

  function handleUploaded(resultado: WizardUploadResultado) {
    if (resultado.duplicates.length > 0) {
      setState((s) => ({ ...s, pendingUpload: resultado }));
      return;
    }
    const invoices = resultado.invoices;
    setState((s) => ({ ...s, invoices, groups: buildGroups(invoices), step: 1 }));
  }

  function handleResolveDuplicates(acao: "recalcular" | "ignorar") {
    const pending = state.pendingUpload;
    if (!pending) return;
    const chavesDuplicadas = new Set(pending.duplicates.map((d) => d.chave_nfe));
    const invoices =
      acao === "recalcular" ? pending.invoices : pending.invoices.filter((inv) => !chavesDuplicadas.has(inv.chave_nfe));
    setState((s) => ({ ...s, pendingUpload: null, invoices, groups: buildGroups(invoices), step: 1 }));
  }

  function handleCancelDuplicates() {
    setState((s) => ({ ...s, pendingUpload: null, invoices: [], groups: [] }));
  }

  return (
    <div className="stack gap-16">
      <div>
        <h1 className="page-title">Wizard de Fronteira</h1>
        <p className="page-sub">Upload das NF-e → contexto → conferência → classificação → resultado</p>
      </div>

      <div className="card">
        <div className="card-body">
          <WizardStepsIndicator steps={STEPS} current={state.step + 1} onStepClick={(n) => goTo(n - 1)} />
        </div>
      </div>

      {state.step === 0 && !state.pendingUpload && <WizardStepUpload onUploaded={handleUploaded} />}

      {state.step === 0 && state.pendingUpload && (
        <WizardStepDuplicatas
          duplicates={state.pendingUpload.duplicates}
          totalNotas={state.pendingUpload.total_notas}
          onResolve={handleResolveDuplicates}
          onCancel={handleCancelDuplicates}
        />
      )}

      {state.step === 1 && (
        <WizardStepContexto
          groups={state.groups}
          onChange={(groups) => setState((s) => ({ ...s, groups }))}
          onNext={() => goTo(2)}
          onBack={() => goTo(0)}
        />
      )}

      {state.step === 2 && (
        <WizardStepConferencia
          invoices={state.invoices}
          groups={state.groups}
          onNext={(eligibleItems) => setState((s) => ({ ...s, eligibleItems, step: 3 }))}
          onBack={() => goTo(1)}
        />
      )}

      {state.step === 3 && (
        <WizardStepClassificacao
          eligibleItems={state.eligibleItems}
          allInvoices={state.invoices}
          classification={state.classification}
          onChange={(classification) => setState((s) => ({ ...s, classification }))}
          onNext={() => goTo(4)}
          onBack={() => goTo(2)}
        />
      )}

      {state.step === 4 && (
        <WizardStepResultado
          groups={state.groups}
          eligibleItems={state.eligibleItems}
          classification={state.classification}
          resultadosSalvos={state.resultados}
          onResultados={(resultados) => setState((s) => ({ ...s, resultados }))}
          onBack={() => goTo(3)}
          onRestart={() => setState(EMPTY_STATE)}
        />
      )}
    </div>
  );
}
