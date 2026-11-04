import type { ReactNode } from "react";

import { IconeCadeado } from "./Botao";
import "./selo.css";

// Ícones de traço próprios por situação (decorativos: o texto do selo diz tudo).
function Icone({ children }: { children: ReactNode }) {
  return (
    <svg
      className="selo__icone"
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
const ICONES = {
  vazio: (
    <Icone>
      <circle cx="8" cy="8" r="6" strokeDasharray="2.5 2.5" />
    </Icone>
  ),
  relogio: (
    <Icone>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 1.5" />
    </Icone>
  ),
  ok: (
    <Icone>
      <circle cx="8" cy="8" r="6" />
      <path d="M5.5 8.2 7.2 10l3.3-3.8" />
    </Icone>
  ),
  atencao: (
    <Icone>
      <path d="M8 2.2 14.2 13H1.8Z" />
      <path d="M8 6.5v3M8 11.3v.01" />
    </Icone>
  ),
  erro: (
    <Icone>
      <circle cx="8" cy="8" r="6" />
      <path d="m5.8 5.8 4.4 4.4m0-4.4-4.4 4.4" />
    </Icone>
  ),
  cadeado: <IconeCadeado />,
};

type Variante = "quieto" | "neutro" | "processando" | "sucesso" | "pendencia" | "erro";

function Selo({ variante, icone, texto }: { variante: Variante; icone: ReactNode; texto: string }) {
  return (
    <span className="selo" data-variante={variante}>
      {icone}
      {texto}
    </span>
  );
}

const SITUACOES: Record<string, { variante: Variante; icone: ReactNode; texto: string }> = {
  SEM_APURACAO: { variante: "neutro", icone: ICONES.vazio, texto: "Sem apuração" },
  PROCESSANDO: { variante: "processando", icone: ICONES.relogio, texto: "Processando" },
  // Concluída é o estado normal: selo quieto, para que pendência, erro e falta de apuração se destaquem.
  CONCLUIDA: { variante: "quieto", icone: ICONES.ok, texto: "Concluída" },
  CONCLUIDA_COM_PENDENCIAS: { variante: "pendencia", icone: ICONES.atencao, texto: "Concluída com pendências" },
  ERRO: { variante: "erro", icone: ICONES.erro, texto: "Erro" },
};

/** Situação da apuração (código do motor: SEM_APURACAO, PROCESSANDO, CONCLUIDA, CONCLUIDA_COM_PENDENCIAS, ERRO). */
export function SeloSituacao({ situacao }: { situacao: string }) {
  const s = SITUACOES[situacao] ?? { variante: "neutro", icone: ICONES.vazio, texto: situacao };
  return <Selo {...s} />;
}

const ESTADOS_LOTE: Record<string, { variante: Variante; icone: ReactNode; texto: string }> = {
  PENDENTE_APROVACAO: { variante: "pendencia", icone: ICONES.relogio, texto: "Aguardando aprovação" },
  BLOQUEADO: { variante: "erro", icone: ICONES.cadeado, texto: "Bloqueado" },
  APROVADO: { variante: "sucesso", icone: ICONES.ok, texto: "Aplicado" },
  REJEITADO: { variante: "neutro", icone: ICONES.erro, texto: "Rejeitado" },
  SEM_ALTERACOES: { variante: "neutro", icone: ICONES.vazio, texto: "Sem alterações" },
};

/** Estado do lote de memória (código do motor). */
export function SeloLote({ status }: { status: string }) {
  const s = ESTADOS_LOTE[status] ?? { variante: "neutro", icone: ICONES.vazio, texto: status };
  return <Selo {...s} />;
}

const ORIGENS = {
  produtos: "Produtos",
  cfop: "CFOP",
  manual: "Conferência manual",
} as const;

/**
 * Origem de pendência com contagem ("Produtos: 3", "CFOP: 2"). Zero não renderiza.
 * `quantidade` nula = o motor não informou o número (fallback): mostra só a origem por extenso.
 */
export function ChipOrigem({ tipo, quantidade }: { tipo: keyof typeof ORIGENS; quantidade: number | null }) {
  if (quantidade === 0) return null;
  const texto =
    quantidade === null
      ? tipo === "cfop"
        ? "CFOP não parametrizado"
        : ORIGENS[tipo]
      : `${ORIGENS[tipo]}: ${quantidade.toLocaleString("pt-BR")}`;
  return (
    <span className="chip chip--origem" data-origem={tipo}>
      {texto}
    </span>
  );
}

export type GrupoDiferenca = "novo" | "alterado" | "removido";

/** Tipo de diferença do motor (INCLUÍDO, TRIBUTAÇÃO ALTERADA, REMOVIDO) → grupo da tela. */
export function grupoDaDiferenca(tipo: string): GrupoDiferenca {
  if (tipo === "INCLUÍDO") return "novo";
  if (tipo === "REMOVIDO") return "removido";
  return "alterado";
}

const DIFERENCAS: Record<GrupoDiferenca, { simbolo: string; texto: string }> = {
  novo: { simbolo: "+", texto: "Novo" },
  alterado: { simbolo: "~", texto: "Alterado" },
  removido: { simbolo: "−", texto: "Removido" },
};

/** Tipo de diferença do lote: símbolo + palavra (a cor nunca é o único sinal). */
export function ChipDiferenca({ tipo }: { tipo: GrupoDiferenca }) {
  const d = DIFERENCAS[tipo];
  return (
    <span className="chip chip--diferenca" data-tipo={tipo}>
      <span className="chip__simbolo" aria-hidden="true">
        {d.simbolo}
      </span>
      {d.texto}
    </span>
  );
}
