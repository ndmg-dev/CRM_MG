import { useCallback, useState } from 'react';
import { askAiStream } from '../api';
import type { ChatMessage } from '../types';

/**
 * Hook que gerencia a conversa com o agente de IA em streaming
 * (POST /api/ask/stream). Mantém o histórico, o estado de carregamento e erros.
 *
 * Padrão: ao enviar, adiciona a mensagem do usuário + um balão vazio da IA que
 * é preenchido token a token conforme o stream chega.
 */
export function useAskAi() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Atualiza a última mensagem (que é sempre o balão da IA em construção). */
  const updateLastAi = useCallback(
    (updater: (msg: ChatMessage) => ChatMessage) => {
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const next = [...prev];
        const last = next[next.length - 1];
        if (last.role === 'ai') next[next.length - 1] = updater(last);
        return next;
      });
    },
    [],
  );

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed) return;

      setError(null);
      setLoading(true);
      setMessages((prev) => [
        ...prev,
        { role: 'user', text: trimmed },
        { role: 'ai', text: '' }, // balão que será preenchido pelo stream
      ]);

      try {
        await askAiStream(trimmed, {
          onMeta: (source) => updateLastAi((m) => ({ ...m, source })),
          onToken: (text) => updateLastAi((m) => ({ ...m, text: m.text + text })),
          onError: (message) => {
            setError(message);
            updateLastAi((m) => ({
              ...m,
              text:
                m.text ||
                'Desculpe, não consegui responder agora. Tente novamente em instantes.',
            }));
          },
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erro desconhecido ao consultar a IA.';
        setError(message);
        updateLastAi((m) => ({
          ...m,
          text:
            m.text ||
            'Desculpe, não consegui responder agora. Tente novamente em instantes.',
        }));
      } finally {
        setLoading(false);
      }
    },
    [updateLastAi],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, loading, error, ask, reset };
}
