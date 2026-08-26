import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Search } from "lucide-react";
import { Button, Label } from "@fronteira-ui";
import { useEmpresa, useEmpresas, type Empresa } from "../hooks/queries";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { NovaEmpresaModal } from "./NovaEmpresaModal";

type Opcao = { kind: "empty"; label: string } | { kind: "empresa"; empresa: Empresa };

/** Seletor de empresa reutilizável com busca embutida no dropdown (filtra a
 * lista conforme digita — o `Select` do @fronteira-ui, sobre o Radix Select, não
 * suporta um campo de texto livre dentro do popup, só typeahead de tecla
 * única; por isso este combobox usa Radix Popover + uma lista filtrável).
 * Também permite criar uma empresa na hora (modal), sem sair da tela. Base
 * do fluxo "selecione a empresa antes de importar" (memória agora é sempre
 * por empresa). */
export function EmpresaPicker({
  value,
  onChange,
  label = "Empresa",
  hint,
  allowCreate = true,
  emptyOptionLabel,
}: {
  value: number | null;
  onChange: (id: number | null, empresa?: Empresa) => void;
  label?: string;
  hint?: string;
  /** Esconde o botão "+ Nova empresa" — usado onde só faz sentido escolher
   * uma empresa já cadastrada (ex.: filtro do Histórico). */
  allowCreate?: boolean;
  /** Se definido, adiciona uma opção no topo que seleciona `null` (ex.:
   * "Todas as empresas" na comparação SEFAZ, onde empresa é opcional). */
  emptyOptionLabel?: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  // Empresas recém-criadas ficam aqui até a busca do servidor incluí-las.
  const [criadas, setCriadas] = useState<Empresa[]>([]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Busca server-side (debounced) — empresas além do limite continuam
  // encontráveis digitando, sem carregar a base inteira no cliente.
  const debouncedQuery = useDebouncedValue(query, 250);
  const { data: empresas } = useEmpresas(debouncedQuery, { ativo: true });
  // Resolve o nome da empresa selecionada mesmo quando ela não está no
  // resultado atual da busca (garante rótulo correto no gatilho).
  const { data: selectedEmpresa } = useEmpresa(value);

  const opcoesEmpresa = useMemo(() => {
    const map = new Map<number, Empresa>();
    for (const e of empresas ?? []) map.set(e.id, e);
    // Recém-criadas ainda não voltam na busca do servidor: filtra localmente.
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    for (const e of criadas) {
      if (!e.ativo) continue;
      const casa = !q || e.nome.toLowerCase().includes(q) || (!!qDigits && e.cnpj.includes(qDigits));
      if (casa) map.set(e.id, e);
    }
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  }, [empresas, criadas, query]);

  const itens = useMemo<Opcao[]>(
    () => [
      ...(emptyOptionLabel ? [{ kind: "empty", label: emptyOptionLabel } as const] : []),
      ...opcoesEmpresa.map((empresa) => ({ kind: "empresa", empresa }) as const),
    ],
    [emptyOptionLabel, opcoesEmpresa],
  );

  const selecionada =
    opcoesEmpresa.find((e) => e.id === value) ??
    criadas.find((e) => e.id === value) ??
    (selectedEmpresa && selectedEmpresa.id === value ? selectedEmpresa : undefined);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlighted(0);
    const raf = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-highlighted="true"]')?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  function selecionar(op: Opcao) {
    if (op.kind === "empty") onChange(null);
    else onChange(op.empresa.id, op.empresa);
    setOpen(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, itens.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const alvo = itens[highlighted];
      if (alvo) selecionar(alvo);
    }
  }

  return (
    <div className="field">
      <Label>{label}</Label>
      <div className="row gap-8" style={{ alignItems: "stretch" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild>
              <button type="button" className="empresa-combo-trigger" aria-label={label}>
                <span className={`empresa-combo-trigger-text${selecionada ? "" : " muted"}`}>
                  {selecionada ? selecionada.nome : (emptyOptionLabel ?? "Selecione a empresa…")}
                </span>
                <ChevronDown size={16} className="empresa-combo-chevron" />
              </button>
            </Popover.Trigger>

            <Popover.Portal>
              <Popover.Content
                className="empresa-combo-content"
                align="start"
                sideOffset={6}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <div className="empresa-combo-search">
                  <Search size={14} className="muted" />
                  <input
                    ref={searchRef}
                    className="empresa-combo-search-input"
                    placeholder="Buscar por nome ou CNPJ…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                </div>
                <div className="empresa-combo-list" ref={listRef}>
                  {itens.length === 0 ? (
                    <div className="empresa-combo-empty">Nenhuma empresa encontrada.</div>
                  ) : (
                    itens.map((op, i) => {
                      const key = op.kind === "empty" ? "__empty__" : op.empresa.id;
                      const texto = op.kind === "empty" ? op.label : op.empresa.nome;
                      const selecionado = op.kind === "empty" ? value === null : op.empresa.id === value;
                      return (
                        <button
                          key={key}
                          type="button"
                          className="empresa-combo-item"
                          data-highlighted={i === highlighted ? "true" : undefined}
                          data-selected={selecionado ? "true" : undefined}
                          onMouseEnter={() => setHighlighted(i)}
                          onClick={() => selecionar(op)}
                        >
                          {texto}
                        </button>
                      );
                    })
                  )}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
        {allowCreate && (
          <Button variant="ghost" onClick={() => setModalOpen(true)}>
            + Nova empresa
          </Button>
        )}
      </div>
      {hint && <span className="field-hint">{hint}</span>}

      {allowCreate && (
        <NovaEmpresaModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          onCreated={(empresa) => {
            setCriadas((prev) => [...prev, empresa]);
            onChange(empresa.id, empresa);
          }}
        />
      )}

      <style>{css}</style>
    </div>
  );
}

const css = `
.empresa-combo-trigger {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  width: 100%; height: 36px; padding: 0 12px;
  font-family: var(--font-ui); font-size: 14px; color: var(--ink);
  background: var(--surface); border: 0.5px solid var(--line); border-radius: var(--radius);
  cursor: pointer; transition: border-color 120ms ease;
}
.empresa-combo-trigger:hover { border-color: var(--line-strong); }
.empresa-combo-trigger:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.empresa-combo-trigger-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empresa-combo-trigger-text.muted { color: var(--muted); }
.empresa-combo-chevron { color: var(--ink-soft); flex-shrink: 0; }

.empresa-combo-content {
  width: var(--radix-popover-trigger-width);
  max-height: 320px;
  background: var(--card); border: 0.5px solid var(--line); border-radius: var(--radius);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
  display: flex; flex-direction: column; overflow: hidden; z-index: 50;
}
.empresa-combo-search {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px;
  border-bottom: 1px solid var(--line); flex-shrink: 0;
}
.empresa-combo-search-input {
  flex: 1; min-width: 0; border: none; background: none; outline: none;
  font-family: var(--font-ui); font-size: 13.5px; color: var(--ink);
}
.empresa-combo-search-input::placeholder { color: var(--muted); }
.empresa-combo-list { overflow-y: auto; padding: 4px; }
.empresa-combo-empty { padding: 14px 10px; text-align: center; font-size: 13px; color: var(--muted); }
.empresa-combo-item {
  display: block; width: 100%; text-align: left; border: none; background: none; cursor: pointer;
  padding: 8px 10px; border-radius: var(--radius-sm);
  font-family: var(--font-ui); font-size: 13.5px; color: var(--ink);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.empresa-combo-item[data-highlighted="true"] { background: var(--mg-color-bg-hover); }
.empresa-combo-item[data-selected="true"] { color: var(--primary); font-weight: 600; }
`;
