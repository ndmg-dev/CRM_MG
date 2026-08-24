import type { AskResponse, AskSource, FaqItem } from './types';

// Backend próprio do Guia DP (Node/Express) continua hospedado à parte —
// só o frontend foi trazido pro CRM. Sem dado sensível de cliente aqui (é um
// FAQ + assistente de IA públicos sobre legislação de DP), então uma chamada
// cross-origin direta do navegador é segura; não precisa de proxy no backend
// do CRM como o Dashboard DRE precisaria (dado financeiro de cliente).
const API_BASE =
  import.meta.env.VITE_GUIADP_API_BASE_URL ?? 'https://guiadp.mendoncagalvao.com.br';

/** GET /api/faq — busca o FAQ do backend. */
export async function fetchFaq(): Promise<FaqItem[]> {
  const res = await fetch(`${API_BASE}/api/faq`);
  if (!res.ok) throw new Error(`Falha ao buscar FAQ (${res.status})`);
  return res.json();
}

/** POST /api/ask — envia a pergunta ao agente de IA (resposta única). */
export async function askAi(question: string): Promise<AskResponse> {
  const res = await fetch(`${API_BASE}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Falha na consulta (${res.status})`);
  }
  return res.json();
}

export interface StreamHandlers {
  onMeta?: (source: AskSource) => void;
  onToken?: (text: string) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
}

/**
 * POST /api/ask/stream — consome a resposta em streaming (NDJSON).
 * Lê o corpo da resposta linha a linha e despacha os eventos via handlers.
 */
export async function askAiStream(
  question: string,
  handlers: StreamHandlers,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/ask/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    handlers.onError?.(data.error ?? `Falha na consulta (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let evt: { type: string; source?: AskSource; text?: string; message?: string };
    try {
      evt = JSON.parse(trimmed);
    } catch {
      return; // ignora linhas malformadas
    }
    switch (evt.type) {
      case 'meta':
        if (evt.source) handlers.onMeta?.(evt.source);
        break;
      case 'token':
        if (evt.text) handlers.onToken?.(evt.text);
        break;
      case 'error':
        handlers.onError?.(evt.message ?? 'Erro ao gerar a resposta.');
        break;
      case 'done':
        handlers.onDone?.();
        break;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      dispatch(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 1);
    }
  }
  // processa qualquer resto sem quebra de linha final
  if (buffer.trim()) dispatch(buffer);
}
