import styles from './FaqCard.module.css';
import type { FaqItem } from '../types';

interface FaqCardProps {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
}

export function FaqCard({ item, isOpen, onToggle }: FaqCardProps) {
  return (
    <div className={`${styles.card} ${isOpen ? styles.open : ''}`}>
      <button
        className={styles.trigger}
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className={styles.questionArea}>
          <span className={styles.question}>{item.question}</span>
        </span>
        <span className={styles.chevron} aria-hidden="true">
          {isOpen ? '−' : '+'}
        </span>
      </button>
      {isOpen && <div className={styles.answer}>{item.answer}</div>}
    </div>
  );
}
