// Formatação pt-BR: R$, datas e competência (AAAA-MM ⇄ MM/AAAA).

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = new Intl.NumberFormat("pt-BR");
const dataHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Recife",
});
const data = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

export function formatarReais(valor: number | null | undefined): string {
  return typeof valor === "number" && Number.isFinite(valor) ? reais.format(valor) : "—";
}

const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Valor em reais sem símbolo (células: o cabeçalho diz "OD (R$)"). Ausente = "—". */
export function formatarValor(valor: number | null | undefined): string {
  return typeof valor === "number" && Number.isFinite(valor) ? decimal.format(valor) : "—";
}

/** Fração → "6,3%". */
export function formatarPercentual(fracao: number | null | undefined, casas = 1): string {
  return typeof fracao === "number" && Number.isFinite(fracao)
    ? `${(fracao * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`
    : "—";
}

/** Hora local "HH:MM" (Recife). */
export function formatarHora(momento: Date): string {
  return momento.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Recife" });
}

export function formatarInteiro(valor: number | null | undefined): string {
  return typeof valor === "number" && Number.isFinite(valor) ? inteiro.format(valor) : "—";
}

/** "2026-08" → "08/2026". */
export function formatarCompetencia(competencia: string | null | undefined): string {
  const partes = competencia?.match(/^(\d{4})-(\d{2})/);
  return partes ? `${partes[2]}/${partes[1]}` : "—";
}

/**
 * Texto digitado → competência AAAA-MM. Aceita "092026", "9/2026", "09/2026" (e "-" ou "." no lugar da barra).
 * Devolve null se não for um mês válido.
 */
export function lerCompetencia(texto: string): string | null {
  const limpo = texto.trim();
  const partes = limpo.match(/^(\d{1,2})[/.-](\d{4})$/) ?? limpo.match(/^(\d{2})(\d{4})$/);
  if (!partes) return null;
  const mes = Number(partes[1]);
  if (mes < 1 || mes > 12) return null;
  return `${partes[2]}-${String(mes).padStart(2, "0")}`;
}

/** Soma `meses` a uma competência AAAA-MM. */
export function somarMeses(competencia: string, meses: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const total = ano * 12 + (mes - 1) + meses;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

const NOMES_MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-09" → "setembro de 2026". */
export function competenciaPorExtenso(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return `${NOMES_MESES[mes - 1]} de ${ano}`;
}

/** Abreviações dos meses (jan…dez). */
export const MESES_CURTOS = NOMES_MESES.map((m) => m.slice(0, 3));

/** Bytes → "18 KB", "1,2 MB". */
export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

/** Data/hora ISO → "dd/mm/aaaa hh:mm" (horário de Recife). Datas puras (AAAA-MM-DD) → "dd/mm/aaaa". */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return data.format(new Date(`${iso}T00:00:00Z`));
  const momento = new Date(iso);
  return Number.isNaN(momento.getTime()) ? "—" : dataHora.format(momento).replace(",", "");
}

/** Competência do mês anterior a `hoje`, no formato AAAA-MM. */
export function mesAnterior(hoje: Date = new Date()): string {
  const ano = hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear();
  const mes = hoje.getMonth() === 0 ? 12 : hoje.getMonth();
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

export function mesAtual(hoje: Date = new Date()): string {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

/** Razão social como vai ao motor: MAIÚSCULAS (com acentos), espaços repetidos reduzidos a um. O BFF repete a regra. */
export function normalizarRazaoSocial(texto: string): string {
  return texto.split(/\s+/).filter(Boolean).join(" ").toLocaleUpperCase("pt-BR");
}

/** CNPJ aceito pelo motor: 14 dígitos ou "00.000.000/0000-00". */
export const PADRAO_CNPJ = String.raw`\d{14}|\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}`;

/** Máscara do CNPJ enquanto se digita ou cola: só dígitos (até 14) em "00.000.000/0000-00". */
export function mascararCnpj(texto: string): string {
  const d = texto.replace(/\D/g, "").slice(0, 14);
  const partes = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8), d.slice(8, 12), d.slice(12, 14)];
  let saida = partes[0];
  if (partes[1]) saida += `.${partes[1]}`;
  if (partes[2]) saida += `.${partes[2]}`;
  if (partes[3]) saida += `/${partes[3]}`;
  if (partes[4]) saida += `-${partes[4]}`;
  return saida;
}

/** Texto do campo CNPJ → valor para o motor: vazio ⇒ null; formato aceito ⇒ o próprio texto; senão undefined (inválido). */
export function lerCnpj(texto: string): string | null | undefined {
  const valor = texto.trim();
  if (!valor) return null;
  return new RegExp(`^(${PADRAO_CNPJ})$`).test(valor) ? valor : undefined;
}

/** "CONCLUIDA_COM_PENDENCIAS" → "Concluída com pendências". */
const ROTULOS: Record<string, string> = {
  PROCESSANDO: "Processando",
  CONCLUIDA: "Concluída",
  CONCLUIDA_COM_PENDENCIAS: "Concluída com pendências",
  ERRO: "Erro",
  ABERTA: "Aberta",
  RESOLVIDA: "Resolvida",
  DESCARTADA: "Descartada",
  PENDENTE_APROVACAO: "Aguardando aprovação",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
  BLOQUEADO: "Bloqueado",
  COMPLETA: "Completa",
  PARCIAL: "Parcial",
  SEM_APURACAO: "Sem apuração",
  SEM_ALTERACOES: "Sem alterações",
  // Tipos de diferença do lote: o motor usa acento e espaço.
  "INCLUÍDO": "Incluído",
  REMOVIDO: "Removido",
  "TRIBUTAÇÃO ALTERADA": "Tributação alterada",
};

export function rotulo(codigo: string | null | undefined): string {
  if (!codigo) return "—";
  if (ROTULOS[codigo]) return ROTULOS[codigo];
  const texto = codigo.replace(/_/g, " ").toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
