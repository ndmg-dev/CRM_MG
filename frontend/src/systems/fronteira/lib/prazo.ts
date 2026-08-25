/** Prazo de recolhimento do ICMS Fronteira.
 *
 * Regra: vence no dia 15 do mês seguinte à competência (competência 2026-07 →
 * 15/08/2026). Ver docs/design_handoff_dashboard_fiscal/README.md.
 *
 * PENDENTE DE CONFIRMAÇÃO FISCAL (ponto em aberto nº 1 do handoff): não trata
 * deslocamento para o próximo dia útil quando o dia 15 cai em fim de semana ou
 * feriado, nem prazo distinto para a Antecipação Interna. Enquanto isso não for
 * confirmado, a data é fixa no dia 15 — que é o comportamento do protótipo. */

export type NivelPrazo = "vencido" | "alerta" | "informativo";

export interface Prazo {
  dias: number;
  /** Sempre positivo — o sinal vira o rótulo, não o número exibido. */
  numero: number;
  dataCurta: string;
  cor: string;
  label: string;
  nivel: NivelPrazo;
  /** Para ordenar a lista de pendências: vencidas primeiro. */
  peso: number;
}

const COR_VENCIDO = "#ef4444";
const COR_ALERTA = "#f59e0b";
const COR_INFO = "#3b82f6";

export function vencimentoDaCompetencia(competencia: string): Date {
  const [ano, mes] = competencia.split("-").map(Number);
  return mes === 12 ? new Date(ano + 1, 0, 15) : new Date(ano, mes, 15);
}

export function calcularPrazo(competencia: string, hoje = new Date()): Prazo {
  const vencimento = vencimentoDaCompetencia(competencia);
  // Zera a hora dos dois lados: senão "vence hoje" vira "vence em 0 ou -1 dias"
  // dependendo da hora em que o usuário abre a tela.
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dias = Math.round((vencimento.getTime() - inicioHoje.getTime()) / 86_400_000);
  const dataCurta = `${String(vencimento.getDate()).padStart(2, "0")}/${String(vencimento.getMonth() + 1).padStart(2, "0")}`;

  if (dias < 0) {
    return {
      dias, numero: Math.abs(dias), dataCurta, cor: COR_VENCIDO,
      label: `Vencido há ${Math.abs(dias)} dias`, nivel: "vencido", peso: 3,
    };
  }
  if (dias === 0) {
    return { dias, numero: 0, dataCurta, cor: COR_VENCIDO, label: "Vence hoje", nivel: "vencido", peso: 3 };
  }
  if (dias <= 5) {
    return {
      dias, numero: dias, dataCurta, cor: COR_ALERTA,
      label: `Vence em ${dias} dias`, nivel: "alerta", peso: 2,
    };
  }
  return {
    dias, numero: dias, dataCurta, cor: COR_INFO,
    label: `Vence em ${dias} dias`, nivel: "informativo", peso: 1,
  };
}

/** Rótulo grande do card de contagem regressiva (ao lado do número). */
export function labelContagem(prazo: Prazo): string {
  if (prazo.dias < 0) return "Prazo vencido";
  if (prazo.dias === 0) return "Vence hoje";
  return "dias até o vencimento";
}

/** "2026-06-01" (como o backend devolve) → "2026-06" (como a tela usa). */
export function competenciaCurta(iso: string): string {
  return iso.slice(0, 7);
}
