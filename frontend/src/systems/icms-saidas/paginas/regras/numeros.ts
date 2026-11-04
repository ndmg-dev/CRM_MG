// Percentuais das regras: o motor guarda FRAÇÕES (0,4293 = 42,93%) e usa o valor como cadastrado.
// A conversão desloca a vírgula no texto (×100 / ÷100 exatos): nunca aparece 42,930000000000001 nem se perde casa.

/** Número decimal → dígitos e posição da vírgula ("0.4293" → { sinal: "", digitos: "04293", inteiros: 1 }). */
function decompor(texto: string): { sinal: string; digitos: string; inteiros: number } | null {
  const m = texto.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!m) return null;
  return { sinal: m[1], digitos: m[2] + (m[3] ?? ""), inteiros: m[2].length };
}

/** Desloca a vírgula `casas` posições (positivo = ×10^casas) e devolve texto decimal canônico ("42.93"). */
function deslocar(texto: string, casas: number): string | null {
  const d = decompor(texto);
  if (!d) return null;
  let { digitos } = d;
  let inteiros = d.inteiros + casas;
  if (inteiros <= 0) {
    digitos = "0".repeat(1 - inteiros) + digitos;
    inteiros = 1;
  }
  if (inteiros > digitos.length) digitos += "0".repeat(inteiros - digitos.length);
  const parteInteira = digitos.slice(0, inteiros).replace(/^0+(?=\d)/, "");
  const fracao = digitos.slice(inteiros).replace(/0+$/, "");
  return `${d.sinal}${parteInteira}${fracao ? `.${fracao}` : ""}`;
}

/** Número JS → texto decimal sem notação científica (0.0001 → "0.0001"). */
function semExpoente(valor: number): string {
  const texto = String(valor);
  if (!/e/i.test(texto)) return texto;
  const [base, exp] = texto.toLowerCase().split("e");
  return deslocar(base, Number(exp)) ?? texto;
}

/** Fração do motor → percentual para exibir/editar: 0.4293 → "42,93"; null → "". */
export function fracaoParaPercentual(fracao: number | null | undefined): string {
  if (typeof fracao !== "number" || !Number.isFinite(fracao)) return "";
  return (deslocar(semExpoente(fracao), 2) ?? "").replace(".", ",");
}

/** Texto digitado em % ("42,93", "42.93", "100") → fração exata (0.4293); vazio ou inválido → null. */
export function percentualParaFracao(texto: string): number | null {
  const limpo = texto.trim().replace(/\s|%/g, "").replace(",", ".");
  if (!limpo) return null;
  const deslocado = deslocar(limpo, -2);
  return deslocado === null ? null : Number(deslocado);
}

/** Número em texto pt-BR sem arredondar (tolerância em R$, alíquota em %): 20.5 → "20,5". */
export function numeroParaTexto(valor: number | null | undefined): string {
  return typeof valor === "number" && Number.isFinite(valor) ? semExpoente(valor).replace(".", ",") : "";
}

/** "20,5" / "20.5" → 20.5; vazio ou inválido → null. */
export function textoParaNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/\s|%/g, "").replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(limpo) ? Number(limpo) : null;
}

/** Lista "0; 4; 7; 12; 20,5" (ou separada por espaço) → números; algum inválido → null. */
export function lerListaNumeros(texto: string): number[] | null {
  const partes = texto.split(/[;\s]+/).filter(Boolean);
  const numeros = partes.map(textoParaNumero);
  return numeros.every((n): n is number => n !== null) ? numeros : null;
}

/** Lista de CST: "60, 10" → ["60", "10"]; algum fora de 2–3 dígitos → null. */
export function lerListaCst(texto: string): string[] | null {
  const partes = texto.split(/[,;\s]+/).filter(Boolean);
  return partes.every((p) => /^\d{2,3}$/.test(p)) ? partes : null;
}
