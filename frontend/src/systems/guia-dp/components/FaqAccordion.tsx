import { useMemo, useState } from 'react';
import styles from './FaqAccordion.module.css';
import { FaqCard } from './FaqCard';
import type { FaqItem } from '../types';

interface FaqAccordionProps {
  items: FaqItem[];
  loading: boolean;
  /** Quando true (busca ativa), abre todas as categorias com resultado. */
  autoExpand?: boolean;
}

const UNCATEGORIZED = 'Outros';

interface CategoryGroup {
  category: string;
  /** Menor orderIndex do grupo — usado para ordenar as categorias. */
  order: number;
  items: FaqItem[];
}

/** Agrupa os itens por categoria, preservando a ordem da spec (orderIndex). */
function groupByCategory(items: FaqItem[]): CategoryGroup[] {
  const map = new Map<string, CategoryGroup>();
  for (const item of items) {
    const key = item.category ?? UNCATEGORIZED;
    const group = map.get(key);
    if (group) {
      group.items.push(item);
      group.order = Math.min(group.order, item.orderIndex);
    } else {
      map.set(key, { category: key, order: item.orderIndex, items: [item] });
    }
  }
  return [...map.values()].sort((a, b) => a.order - b.order);
}

export function FaqAccordion({ items, loading, autoExpand }: FaqAccordionProps) {
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [openQuestionId, setOpenQuestionId] = useState<number | null>(null);

  const groups = useMemo(() => groupByCategory(items), [items]);

  if (loading) {
    return <p className={styles.status}>Carregando perguntas frequentes...</p>;
  }

  if (items.length === 0) {
    return (
      <p className={styles.status}>
        Nenhuma pergunta no FAQ corresponde à sua busca. Use o assistente de IA
        acima.
      </p>
    );
  }

  const toggleCategory = (category: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  return (
    <div className={styles.list}>
      {groups.map((group) => {
        const isOpen = autoExpand || openCategories.has(group.category);
        return (
          <div
            key={group.category}
            className={`${styles.category} ${isOpen ? styles.categoryOpen : ''}`}
          >
            <button
              className={styles.catHeader}
              onClick={() => toggleCategory(group.category)}
              aria-expanded={isOpen}
            >
              <span className={styles.catTitle}>{group.category}</span>
              <span className={styles.catMeta}>
                <span className={styles.catCount}>
                  {group.items.length}{' '}
                  {group.items.length === 1 ? 'pergunta' : 'perguntas'}
                </span>
                <span className={styles.catChevron} aria-hidden="true">
                  {isOpen ? '−' : '+'}
                </span>
              </span>
            </button>

            {isOpen && (
              <div className={styles.catBody}>
                {group.items.map((item) => (
                  <FaqCard
                    key={item.id}
                    item={item}
                    isOpen={openQuestionId === item.id}
                    onToggle={() =>
                      setOpenQuestionId(
                        openQuestionId === item.id ? null : item.id,
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
