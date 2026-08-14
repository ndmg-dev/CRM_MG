import { Search, Filter } from 'lucide-react';
import type { FilterMode } from '@adiantamento/lib/types';

interface EmployeeFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
  filter: FilterMode;
  onFilterChange: (val: FilterMode) => void;
  counts: Record<FilterMode, number>;
}

const filters: { key: FilterMode; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'edited', label: 'Editados' },
];

export function EmployeeFilters({ search, onSearchChange, filter, onFilterChange, counts }: EmployeeFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por nome ou CPF…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full input-glass rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground/50"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground/60" />
        {filters.map(({ key, label }) => {
          const active = filter === key;
          const count = counts[key];
          return (
            <button
              key={key}
              onClick={() => onFilterChange(key)}
              className={`
                flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-300 border
                ${active
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground/70 hover:bg-glass/40'
                }
              `}
            >
              {label}
              <span className={`text-[10px] font-mono ${active ? 'text-primary/70' : 'text-muted-foreground/50'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
