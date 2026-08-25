import { useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Button, Dropzone, Spinner } from "@fronteira-ui";
import { WizardStepContexto } from "../components/wizard/WizardStepContexto";
import { groupKeyForInvoice, type InvoiceGroup, type NFeParsed } from "../components/wizard/types";
import { WizardStepsIndicator } from "../components/WizardStepsIndicator";
import { useLoader } from "../components/LoaderOverlay";
import { ClassificacaoGrupo } from "../components/antecipacao/ClassificacaoGrupo";
import { ResultadoGrupo } from "../components/antecipacao/ResultadoGrupo";
import { GrupoAntecipacao } from "../components/GrupoAntecipacao";
import {
  useAntecipacaoParse,
  useExportAntecipacaoZip,
  useExportPendentesAntecipacao,
  useImportarAntecipacaoNotas,
  useProcessarAntecipacaoLote,
  useRemoverNotasAntecipacao,
  type AntecipacaoImportarNota,
} from "../hooks/queries";
import { apiError } from "../lib/api";

const STEPS = ["Upload", "Contexto", "Classificação", "Resultado"];

/** Agrupa por (CNPJ destinatário + competência) — mesma chave do Fronteira. */
function buildGroups(invoices: NFeParsed[]): InvoiceGroup[] {
  const grouped = new Map<string, InvoiceGroup>();
  for (const nfe of invoices) {
    const key = groupKeyForInvoice(nfe.destinatario_cnpj, nfe.competencia);
    const existing = grouped.get(key);
    if (existing) existing.invoices.push(nfe);
    else grouped.set(key, { key, cnpj: nfe.destinatario_cnpj, competencia: nfe.competencia, invoices: [nfe], companyId: null, existingCompany: false });
  }
  return [...grouped.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function notasDoGrupo(group: InvoiceGroup): AntecipacaoImportarNota[] {
  return group.invoices.map((nfe) => ({
    company_id: group.companyId as number,
    competencia: nfe.competencia,
    numero: nfe.numero,
    serie: nfe.serie,
    chave_nfe: nfe.chave_nfe,
    emissao: nfe.emissao,
    emitente_cnpj: nfe.emitente_cnpj,
    emitente_nome: nfe.emitente_nome,
    emitente_uf: nfe.emitente_uf,
    destinatario_uf: nfe.destinatario_uf,
    valor_total: nfe.valor_total,
    items: nfe.items.map((it) => ({
      codigo_produto: it.codigo_produto,
      ncm: it.ncm,
      cfop: it.cfop,
      cst: it.cst,
      origem: it.origem,
      descricao: it.descricao,
      valor_total: it.valor_total,
      valor_ipi: it.valor_ipi,
      valor_frete: it.valor_frete,
      outras_despesas: it.outras_despesas,
      seguro: it.seguro,
      valor_desconto: it.valor_desconto,
      aliq_icms: it.aliq_icms,
      valor_icms_st: it.valor_icms_st,
    })),
  }));
}

interface GrupoResolvido {
  companyId: number;
  competencia: string;
  nome: string;
}

class AntecipacaoProcessamentoParcialError extends Error {}

/** Antecipação Interna — wizard de 4 passos como no v7/Fronteira:
 * Upload → Contexto → Classificação → Resultado. O upload identifica empresa
 * (CNPJ destinatário) e competência de cada nota; grupos são processados
 * separadamente. Também atende a navegação direta do Histórico (rota com
 * params), abrindo um único grupo. */
export default function AntecipacaoProcessar() {
  const { companyId: companyIdParam, competencia: competenciaParam } = useParams();
  if (companyIdParam && competenciaParam) {
    return (
      <div className="stack gap-16">
        <div>
          <h1 className="page-title">Antecipação</h1>
          <p className="page-sub">Classifique os itens e calcule o imposto.</p>
        </div>
        <GrupoAntecipacao companyId={Number(companyIdParam)} competencia={competenciaParam} />
      </div>
    );
  }
  return <Wizard />;
}

function Wizard() {
  const parse = useAntecipacaoParse();
  const importar = useImportarAntecipacaoNotas();
  const processarLote = useProcessarAntecipacaoLote();
  const remover = useRemoverNotasAntecipacao();
  const exportarZip = useExportAntecipacaoZip();
  const exportarPendentes = useExportPendentesAntecipacao();
  const loader = useLoader();

  const [step, setStep] = useState<"upload" | "contexto" | "classificacao" | "resultado">("upload");
  const [groups, setGroups] = useState<InvoiceGroup[]>([]);
  const groupsRef = useRef<InvoiceGroup[]>([]);
  // (empresa, competência, chaves) do último import bem-sucedido deste upload —
  // pra limpar exatamente essas notas, no escopo em que foram gravadas, se o
  // usuário voltar ao Contexto e remapear a empresa (opção 1), evitando notas
  // órfãs. Vazio antes do primeiro import (remoção vira no-op).
  const importadoRef = useRef<{ companyId: number; competencia: string; chaves: string[] }[]>([]);
  const [resolvidos, setResolvidos] = useState<GrupoResolvido[]>([]);
  const [pendentesMap, setPendentesMap] = useState<Record<string, number | null>>({});
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [autoProcessadosAposImport, setAutoProcessadosAposImport] = useState<Set<string>>(new Set());

  const STEP_ORDER = ["upload", "contexto", "classificacao", "resultado"] as const;
  const stepNum = STEP_ORDER.indexOf(step) + 1;

  function irParaPasso(n: number) {
    const alvo = STEP_ORDER[n - 1];
    if (alvo === "upload") reiniciar();
    else setStep(alvo);
  }

  async function handleUpload(files: FileList | null) {
    const lista = Array.from(files ?? []);
    if (lista.length === 0) return;
    setError("");
    setParseErrors([]);
    try {
      const { invoices, errors } = await loader.run(
        `Analisando ${lista.length} arquivo(s)…`,
        () => parse.mutateAsync(lista),
      );
      setParseErrors(errors);
      if (invoices.length === 0) {
        setError("Nenhuma NF-e válida encontrada. Só são aceitas NF-e de mercadoria (não NFS-e de serviço).");
        return;
      }
      const gs = buildGroups(invoices);
      setGroups(gs);
      groupsRef.current = gs;
      importadoRef.current = [];
      setStep("contexto");
    } catch (err) {
      setError(apiError(err, "Não foi possível ler os arquivos."));
    }
  }

  async function handleContextoDone(atualizados: InvoiceGroup[]) {
    setError("");
    try {
      await loader.run("Importando notas e aplicando a memória…", async () => {
        // Opção 1: limpa as notas já importadas deste upload antes de reimportar,
        // pra que remapear a empresa no Contexto não deixe notas órfãs. Escopado
        // por (empresa, competência) em que cada leva foi de fato gravada — na
        // primeira passada `importadoRef` está vazio, então é no-op.
        for (const grupo of importadoRef.current) {
          if (grupo.chaves.length === 0) continue;
          await remover.mutateAsync({
            company_id: grupo.companyId,
            competencia: grupo.competencia,
            chaves: grupo.chaves,
          });
        }
        await importar.mutateAsync(atualizados.flatMap(notasDoGrupo));
        importadoRef.current = atualizados.map((g) => ({
          companyId: g.companyId as number,
          competencia: g.competencia,
          chaves: g.invoices.map((nfe) => nfe.chave_nfe).filter(Boolean),
        }));
        const resultado = await processarLote.mutateAsync(
          atualizados.map((g) => ({ companyId: g.companyId as number, competencia: g.competencia })),
        );
        if (resultado.falhas.length > 0) {
          const grupos = resultado.falhas.map((g) => `empresa #${g.companyId} (${g.competencia})`).join(", ");
          throw new AntecipacaoProcessamentoParcialError(
            `As notas foram importadas, mas a memória falhou em ${resultado.falhas.length} de ${resultado.total} apuração(ões): ${grupos}. Corrija o erro e tente continuar novamente.`,
          );
        }
      });
      setAutoProcessadosAposImport(
        new Set(atualizados.map((g) => `${g.companyId as number}-${g.competencia}`)),
      );
      setResolvidos(
        atualizados.map((g) => ({
          companyId: g.companyId as number,
          competencia: g.competencia,
          nome: g.invoices[0]?.destinatario_nome || `Empresa #${g.companyId}`,
        })),
      );
      setPendentesMap({});
      setStep("classificacao");
    } catch (err) {
      setError(
        err instanceof AntecipacaoProcessamentoParcialError
          ? err.message
          : apiError(err, "Não foi possível importar as notas."),
      );
    }
  }

  const gruposParaExport = useMemo(
    () => resolvidos.map((g) => ({ company_id: g.companyId, competencia: g.competencia })),
    [resolvidos],
  );

  const todosClassificados =
    resolvidos.length > 0 && resolvidos.every((g) => pendentesMap[`${g.companyId}-${g.competencia}`] === 0);

  async function handleBaixarPendentes() {
    setError("");
    try {
      await exportarPendentes.mutateAsync(gruposParaExport);
    } catch (err) {
      setError(apiError(err, "Não foi possível baixar os pendentes."));
    }
  }

  async function handleExportTudo() {
    setError("");
    try {
      await exportarZip.mutateAsync(gruposParaExport);
    } catch (err) {
      setError(apiError(err, "Não foi possível exportar o ZIP."));
    }
  }

  function reiniciar() {
    setStep("upload");
    setGroups([]);
    groupsRef.current = [];
    importadoRef.current = [];
    setResolvidos([]);
    setPendentesMap({});
    setParseErrors([]);
    setError("");
    setAutoProcessadosAposImport(new Set());
  }

  return (
    <div className="stack gap-16">
      <div>
        <h1 className="page-title">Processar Antecipação</h1>
        <p className="page-sub">
          Suba os XMLs — o sistema identifica a empresa e a competência de cada nota, separando por apuração.
        </p>
      </div>

      <div className="card">
        <div className="card-body">
          <WizardStepsIndicator steps={STEPS} current={stepNum} onStepClick={irParaPasso} />
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {parseErrors.length > 0 && (
        <div className="alert alert-warn">
          <strong>{parseErrors.length} arquivo(s) ignorado(s):</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {parseErrors.map((e, i) => (
              <li key={i} style={{ fontSize: 12.5 }}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {step === "upload" && (
        <div className="card">
          <div className="card-body">
            <Dropzone
              id="antecipacao-files"
              accept=".xml,.zip"
              multiple
              label="Arraste XMLs ou ZIPs aqui"
              hint="Aceita múltiplos .xml e .zip — pode misturar empresas e competências"
              onFilesSelected={handleUpload}
            />
            {parse.isPending && (
              <div className="field-hint row gap-8" style={{ alignItems: "center" }}>
                <Spinner size="sm" />
                Lendo os arquivos…
              </div>
            )}
          </div>
        </div>
      )}

      {step === "contexto" && (
        <WizardStepContexto
          groups={groups}
          onChange={(g) => {
            setGroups(g);
            groupsRef.current = g;
          }}
          onNext={() => handleContextoDone(groupsRef.current)}
          onBack={reiniciar}
        />
      )}

      {step === "classificacao" && (
        <>
          <div className="card">
            <div className="card-head" style={{ flexWrap: "wrap", gap: 10 }}>
              <span className="page-sub">
                {resolvidos.length} apuração(ões) — classifique os itens não encontrados na memória
              </span>
              <div className="row gap-8">
                <Button variant="ghost" size="sm" onClick={() => setStep("contexto")}>
                  ← Voltar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={exportarPendentes.isPending}
                  loading={exportarPendentes.isPending}
                  onClick={handleBaixarPendentes}
                >
                  {exportarPendentes.isPending ? "Gerando…" : "↓ Baixar pendentes (.xlsx)"}
                </Button>
                <Button variant="primary" size="sm" disabled={!todosClassificados} onClick={() => setStep("resultado")}>
                  Avançar para Resultado →
                </Button>
              </div>
            </div>
          </div>

          {resolvidos.map((g) => (
            <ClassificacaoGrupo
              key={`${g.companyId}-${g.competencia}`}
              companyId={g.companyId}
              competencia={g.competencia}
              nomeEmpresa={g.nome}
              skipAutomaticoInicial={autoProcessadosAposImport.has(`${g.companyId}-${g.competencia}`)}
              onSkipAutomaticoConsumido={(cid, comp) =>
                setAutoProcessadosAposImport((atuais) => {
                  const proximos = new Set(atuais);
                  proximos.delete(`${cid}-${comp}`);
                  return proximos;
                })
              }
              onPendentes={(cid, comp, n) => setPendentesMap((m) => ({ ...m, [`${cid}-${comp}`]: n }))}
            />
          ))}
        </>
      )}

      {step === "resultado" && (
        <>
          <div className="card">
            <div className="card-head" style={{ flexWrap: "wrap", gap: 10 }}>
              <span className="page-sub">{resolvidos.length} apuração(ões) calculada(s)</span>
              <div className="row gap-8">
                <Button variant="ghost" size="sm" onClick={() => setStep("classificacao")}>
                  ← Voltar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={exportarZip.isPending}
                  loading={exportarZip.isPending}
                  onClick={handleExportTudo}
                >
                  {exportarZip.isPending ? "Gerando ZIP…" : "↓ Exportar tudo (ZIP)"}
                </Button>
                <Button variant="ghost" size="sm" onClick={reiniciar}>
                  Nova importação
                </Button>
              </div>
            </div>
          </div>

          {resolvidos.map((g) => (
            <ResultadoGrupo key={`${g.companyId}-${g.competencia}`} companyId={g.companyId} competencia={g.competencia} nomeEmpresa={g.nome} />
          ))}
        </>
      )}
    </div>
  );
}
