import styles from './FaqSearch.module.css';

interface FaqSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  resultCount: number;
}

export function FaqSearch({
  value,
  onChange,
  onSubmit,
  resultCount,
}: FaqSearchProps) {
  return (
    <div className={styles.wrapper}>
      <form
        className={styles.searchBox}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <svg
          className={styles.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          className={styles.input}
          type="text"
          placeholder="Digite sua dúvida sobre DP..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Buscar no FAQ"
        />
        <button className={styles.button} type="submit">
          Perguntar à IA
        </button>
      </form>
      {value.trim() && (
        <p className={styles.hint}>
          {resultCount > 0
            ? `${resultCount} pergunta(s) do FAQ correspondem à sua busca.`
            : 'Nenhuma pergunta no FAQ. Envie sua dúvida ao assistente de IA.'}
        </p>
      )}
    </div>
  );
}
