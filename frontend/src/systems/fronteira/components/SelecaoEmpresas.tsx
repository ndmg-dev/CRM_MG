import { useMemo, useState } from "react";
import { Button, Checkbox, Input, Label, Select } from "@fronteira-ui";
import { MAX_PAGE_SIZE, useChoices, useEmpresasPage } from "../hooks/queries";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { apiError } from "../lib/api";
import { formatCNPJ } from "../lib/format";

const TODOS = "__todos__";
// No teto da API, e não acima: a seleção em bloco ("Marcar todas") quer o maior
// conjunto possível do filtro, mas pedir mais que `MAX_PAGE_SIZE` devolve 422,
// não mais itens. Passando disso, o aviso de truncamento assume.
export const LIMITE_SELECAO_EMPRESAS = MAX_PAGE_SIZE;

/** Seleção de empresas com busca, filtros de cadastro e marcação em bloco.
 *
 * Controlado: quem usa é dono do estado (`selecionadas`/`onChange`), porque o
 * mesmo componente serve tanto para a criação do usuário (envia junto no POST)
 * quanto para a edição (PUT próprio). */
export function SelecaoEmpresas({
  selecionadas,
  onChange,
}: {
  selecionadas: Set<number>;
  onChange: (next: Set<number>) => void;
}) {
  const { data: choices } = useChoices();
  const [query, setQuery] = useState("");
  const [tributacao, setTributacao] = useState("");
  const [porte, setPorte] = useState("");
  const [perfil, setPerfil] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);

  const { data, isLoading, error } = useEmpresasPage({
    q: debouncedQuery,
    ativo: true,
    tributacao,
    porte,
    perfil,
    limit: LIMITE_SELECAO_EMPRESAS,
  });

  const empresas = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  const truncado = total > empresas.length;

  const idsVisiveis = useMemo(() => empresas.map((e) => e.id), [empresas]);
  const todasMarcadas = idsVisiveis.length > 0 && idsVisiveis.every((id) => selecionadas.has(id));

  function alternar(id: number) {
    const next = new Set(selecionadas);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  /** Marca/desmarca as empresas do filtro atual — sem tocar nas selecionadas
   * que estão fora dele (senão trocar de filtro apagaria escolhas anteriores
   * sem o usuário perceber). */
  function alternarTodas() {
    const next = new Set(selecionadas);
    if (todasMarcadas) for (const id of idsVisiveis) next.delete(id);
    else for (const id of idsVisiveis) next.add(id);
    onChange(next);
  }

  function limparFiltros() {
    setQuery("");
    setTributacao("");
    setPorte("");
    setPerfil("");
  }

  const temFiltro = Boolean(debouncedQuery || tributacao || porte || perfil);
  const foraDoFiltro = [...selecionadas].filter((id) => !idsVisiveis.includes(id)).length;

  return (
    <div className="stack gap-12">
      <div className="row gap-12" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field" style={{ flex: 1, minWidth: 200 }}>
          <Label htmlFor="busca-empresa-vinculo">Buscar empresa</Label>
          <Input
            id="busca-empresa-vinculo"
            placeholder="Nome ou CNPJ…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <FiltroSelect
          label="Tributação"
          value={tributacao}
          onChange={setTributacao}
          options={choices?.company_tributacao}
        />
        <FiltroSelect label="Porte" value={porte} onChange={setPorte} options={choices?.company_porte} />
        <FiltroSelect label="Perfil" value={perfil} onChange={setPerfil} options={choices?.company_perfil} />
        {temFiltro && (
          <Button type="button" variant="ghost" onClick={limparFiltros}>
            ✕ Limpar
          </Button>
        )}
      </div>

      <div className="row gap-8" style={{ alignItems: "center" }}>
        <Button type="button" variant="ghost" size="sm" disabled={idsVisiveis.length === 0} onClick={alternarTodas}>
          {todasMarcadas ? "Desmarcar" : "Marcar"} {temFiltro ? `as ${idsVisiveis.length} do filtro` : "todas"}
        </Button>
        <div className="spacer" />
        <span className="muted" style={{ fontSize: 13 }}>
          {selecionadas.size} selecionada(s)
          {foraDoFiltro > 0 && ` · ${foraDoFiltro} fora do filtro atual`}
        </span>
      </div>

      {truncado && (
        <div className="alert alert-warn">
          Mostrando {empresas.length} de {total} empresas. Refine a busca — "marcar todas" só alcança
          as exibidas.
        </div>
      )}

      {/* Falha de carregamento tem de aparecer como falha. Tratá-la como lista
          vazia faria uma requisição quebrada parecer "não há empresas" — foi
          exatamente o que mascarou um 422 de `limit` acima do teto da API. */}
      {error && (
        <div className="alert alert-danger">
          {apiError(error, "Não foi possível carregar as empresas.")}
        </div>
      )}

      <div className="vinculo-lista">
        {isLoading ? (
          <div className="empty">Carregando…</div>
        ) : error ? (
          <div className="empty">Lista indisponível — veja o erro acima.</div>
        ) : empresas.length === 0 ? (
          <div className="empty">Nenhuma empresa encontrada com estes filtros.</div>
        ) : (
          empresas.map((empresa) => (
            <div key={empresa.id} className="vinculo-item">
              <Checkbox
                id={`empresa-${empresa.id}`}
                checked={selecionadas.has(empresa.id)}
                onCheckedChange={() => alternar(empresa.id)}
                label={empresa.nome}
              />
              <span className="muted num" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                {formatCNPJ(empresa.cnpj)}
              </span>
            </div>
          ))
        )}
      </div>

      <style>{css}</style>
    </div>
  );
}

function FiltroSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options?: { value: string; label: string }[];
}) {
  return (
    <div className="field" style={{ minWidth: 160 }}>
      <Label>{label}</Label>
      <Select
        aria-label={label}
        value={value || TODOS}
        onValueChange={(v) => onChange(v === TODOS ? "" : v)}
        options={[{ value: TODOS, label: "Todos" }, ...(options ?? [])]}
      />
    </div>
  );
}

const css = `
.vinculo-lista {
  max-height: 280px; overflow-y: auto;
  border: 0.5px solid var(--line); border-radius: var(--radius);
}
.vinculo-item {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 8px 12px; border-bottom: 0.5px solid var(--line);
}
.vinculo-item:last-child { border-bottom: none; }
.vinculo-item:hover { background: var(--mg-color-bg-hover); }
`;
