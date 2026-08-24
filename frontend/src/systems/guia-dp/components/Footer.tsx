import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.office}>
          Mendonça Galvão Contadores Associados
        </span>
        <span className={styles.badge}>
          <svg
            className={styles.lock}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          AMBIENTE SEGURO
        </span>
      </div>
      <p className={styles.disclaimer}>
        Conteúdo informativo de Departamento Pessoal. Para casos específicos,
        confirme com o contador responsável.
      </p>
    </footer>
  );
}
