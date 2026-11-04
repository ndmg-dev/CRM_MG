// Estado global do "carregando": cada requisição em andamento registra uma entrada e a remove ao terminar. A tela de carregamento
// (`ui/components/TelaCarregando.tsx`) mostra o texto da mais recente e some quando não resta nenhuma. Sem React aqui: testável em separado.

type Entrada = { id: number; texto: string };

let pilha: Entrada[] = [];
let proximoId = 0;
let instantaneo: readonly Entrada[] = pilha;
const ouvintes = new Set<() => void>();

function emitir(): void {
  instantaneo = [...pilha]; // nova referência a cada mudança (exigência do useSyncExternalStore)
  ouvintes.forEach((o) => o());
}

export function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export const lerEntradas = (): readonly Entrada[] => instantaneo;

/** Registra uma operação em andamento. Devolve a função que a encerra (pode ser chamada mais de uma vez). */
export function iniciarCarregamento(texto: string): () => void {
  const id = ++proximoId;
  pilha.push({ id, texto });
  emitir();
  let encerrada = false;
  return () => {
    if (encerrada) return;
    encerrada = true;
    pilha = pilha.filter((e) => e.id !== id);
    emitir();
  };
}

/** Executa `operacao` com a tela de carregamento ligada; desliga ao terminar, com sucesso ou erro. */
export async function comCarregamento<T>(texto: string, operacao: () => Promise<T>): Promise<T> {
  const encerrar = iniciarCarregamento(texto);
  try {
    return await operacao();
  } finally {
    encerrar();
  }
}

/** Texto da tela de carregamento para cada tipo de operação (o operador entende o que está esperando). */
export function textoDaRequisicao(metodo: string, caminho: string): string {
  const c = caminho.split("?")[0];
  const m = metodo.toUpperCase();
  if (/\/memoria\/lotes\/[^/]+\/problemas$/.test(c)) return "Lendo o arquivo do lote… pode levar alguns segundos.";
  if (/\/memoria\/lotes\/[^/]+\/problemas\.xlsx$/.test(c)) return "Gerando a planilha dos problemas…";
  if (/\/memoria\/lotes\/[^/]+\/correcoes$/.test(c)) return "Gravando as correções e reavaliando o lote…";
  if (/\/memoria\/lotes\/[^/]+\/reavaliar$/.test(c)) return "Reavaliando o lote…";
  if (/\/memoria\/lotes\/[^/]+\/aprovar$/.test(c)) return "Gravando na memória…";
  if (/\/memoria\/lotes\/[^/]+\/rejeitar$/.test(c)) return "Rejeitando o lote…";
  if (/\/memoria\/lotes\/[^/]+\/diferencas$/.test(c)) return "Carregando as diferenças do lote…";
  if (/\/memoria\/lotes\/[^/]+\/relatorio\.xlsx$/.test(c)) return "Gerando o relatório do lote…";
  if (/\/memoria\/lotes\/[^/]+$/.test(c)) return "Carregando o lote…";
  if (/\/memoria\/completar$/.test(c)) return "Lendo a memória e os relatórios de saídas… pode levar alguns segundos por arquivo.";
  if (/\/memoria\/lotes$/.test(c) && m === "POST") return "Comparando a planilha com a memória atual…";
  if (/\/memoria\/exportar$/.test(c)) return "Gerando a planilha da memória…";
  if (/\/apuracoes$/.test(c) && m === "POST") return "Processando a apuração… pode levar alguns segundos.";
  if (/\/apuracoes\/[^/]+\/reprocessar$/.test(c)) return "Reprocessando a apuração…";
  if (/\/pendencias\/(resolver-lote|aceitar-identicas)$/.test(c) || /\/pendencias\/[^/]+\/(resolver|descartar)$/.test(c)) return "Gravando as pendências na memória…";
  if (/\/pendencias\/resumo-sugestoes$/.test(c)) return "Calculando o resumo das pendências…";
  if (/\/pendencias\/exportar$/.test(c)) return "Gerando a planilha das pendências…";
  if (/\/pendencias$/.test(c) && /sugestoes=true/.test(caminho)) return "Buscando sugestões na memória…";
  if (m !== "GET") return "Salvando…";
  return "Carregando…";
}
