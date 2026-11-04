// Origem das pendências de uma apuração: o motor já conta cada uma em `totais.pendencias`; aqui só se exibe.
import { ChipOrigem } from "../ui/components/Selo";
import type { Pendencias } from "../tipos";

export type Origem = { tipo: "produtos" | "cfop" | "manual"; quantidade: number };

/** Contagens > 0 por origem, na ordem Produtos, CFOP, Conferência manual. */
export function origensDe(pendencias: Pendencias | null | undefined): Origem[] {
  if (!pendencias) return [];
  const todas: Origem[] = [
    { tipo: "produtos", quantidade: pendencias.produtos_sem_cadastro ?? 0 },
    { tipo: "cfop", quantidade: pendencias.itens_cfop_nao_parametrizado ?? 0 },
    { tipo: "manual", quantidade: pendencias.itens_conferencia_manual ?? 0 },
  ];
  return todas.filter((o) => o.quantidade !== 0);
}

export function ChipsOrigem({ origens }: { origens: Origem[] }) {
  return (
    <span className="chips">
      {origens.map((o) => (
        <ChipOrigem key={o.tipo} tipo={o.tipo} quantidade={o.quantidade} />
      ))}
    </span>
  );
}

/** Uma frase por origem (legenda do painel e "Por que ‘com pendências’?" da apuração). */
export const EXPLICACAO_ORIGEM: Record<Origem["tipo"], string> = {
  produtos: "Produtos: produtos vendidos que não estão na memória da empresa. Defina a tributação na aba Pendências.",
  cfop: "CFOP: itens vendidos com CFOP que a configuração fiscal da empresa não parametriza.",
  manual: "Conferência manual: itens que o motor separou para conferir na planilha.",
};
