export function formatMoney(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function formatRate(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  return `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

export function formatCNPJ(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "").padStart(14, "0");
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}
