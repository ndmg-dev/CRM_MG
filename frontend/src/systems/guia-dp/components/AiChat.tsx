import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './AiChat.module.css';
import type { ChatMessage } from '../types';

interface AiChatProps {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
}

export function AiChat({ messages, loading, error }: AiChatProps) {
  const threadRef = useRef<HTMLDivElement>(null);

  // Rola apenas o container interno de mensagens (não a janela), mantendo a
  // posição da página estável enquanto o assistente digita.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  if (messages.length === 0 && !loading) return null;

  return (
    <section className={styles.chat} aria-live="polite">
      <div className={styles.header}>
        <span className={styles.badge}>Assistente de DP · IA</span>
      </div>

      <div className={styles.thread} ref={threadRef}>
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`${styles.bubbleRow} ${
              msg.role === 'user' ? styles.rowUser : styles.rowAi
            }`}
          >
            <div
              className={`${styles.bubble} ${
                msg.role === 'user' ? styles.bubbleUser : styles.bubbleAi
              }`}
            >
              {msg.role === 'ai' ? (
                msg.text ? (
                  <div className={styles.markdown}>
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                ) : (
                  <span className={styles.typing}>
                    <span />
                    <span />
                    <span />
                  </span>
                )
              ) : (
                <p className={styles.text}>{msg.text}</p>
              )}
              {msg.role === 'ai' && msg.source && msg.text && (
                <span className={styles.source}>
                  {msg.source === 'cache'
                    ? '↺ resposta reaproveitada do cache'
                    : '✨ gerada pela IA'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}
