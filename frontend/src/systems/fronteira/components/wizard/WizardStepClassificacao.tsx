import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Checkbox, Input, Select } from "@fronteira-ui";
import { useChoices, useResolveNcmRules } from "../../hooks/queries";
import { apiError } from "../../lib/api";
import {
  classificationKey,
  DEFAULT_CLASSIFICATION,
  type ClassificationRow,
  type NFeParsed,
  type TaggedItem,
} from "./types";

// Radix Select não aceita value="" — sentinela para os placeholders
// "Tributação…"/"Utilização…" da aplicação em massa.
const BULK_PLACEHOLDER = "__bulk_placeholder__";
const PAGE_SIZES = [10, 25, 50];

type Filtro = "todos" | "com" | "sem";

/** Resumo de notas por UF de origem: quantas são interestaduais (DIFAL) vs
 * intraestaduais (mesma UF, ignoradas no cálculo). Calculado sobre TODAS as
 * notas do envio. */
function resumoPorUf(invoices: NFeParsed[]) {
  const porUf = new Map<string, { total: number; interestaduais: number; intraestaduais: number }>();
  let interestaduais = 0;
  let intraestaduais = 0;
  for (const nfe of invoices) {
    const uf = nfe.emitente_uf || "—";
    const mesmaUf = nfe.emitente_uf !== "" && nfe.emitente_uf === nfe.destinatario_uf;
    if (mesmaUf) intraestaduais += 1;
    else interestaduais += 1;
    const atual = porUf.get(uf) ?? { total: 0, interestaduais: 0, intraestaduais: 0 };
    atual.total += 1;
    if (mesmaUf) atual.intraestaduais += 1;
    else atual.interestaduais += 1;
    porUf.set(uf, atual);
  }
  const linhas = [...porUf.entries()]
    .map(([uf, dados]) => ({ uf, ...dados }))
    .sort((a, b) => a.uf.localeCompare(b.uf));
  return { linhas, total: invoices.length, interestaduais, intraestaduais };
}

function UfSummary({ invoices }: { invoices: NFeParsed[] }) {
  const resumo = useMemo(() => resumoPorUf(invoices), [invoices]);
  return (
    <div className="card">
      <div className="card-head">
        <h2 style={{ fontSize: 14 }}>Notas por UF de origem</h2>
        <div className="row gap-8">
          <Badge variant="neutral">Total {resumo.total} nota(s)</Badge>
          <Badge variant="ok">Interestaduais (DIFAL) {resumo.interestaduais}</Badge>
          <Badge variant="neutral">Mesma UF (intraestaduais) {resumo.intraestaduais}</Badge>
        </div>
      </div>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>UF de origem</th>
              <th className="right">Total de notas</th>
              <th className="right">Interestaduais</th>
              <th className="right">Mesma UF</th>
            </tr>
          </thead>
          <tbody>
            {resumo.linhas.map((l) => (
              <tr key={l.uf}>
                <td className="num">{l.uf}</td>
                <td className="right num">{l.total}</td>
                <td className="right num">{l.interestaduais}</td>
                <td className="right num">{l.intraestaduais}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function WizardStepClassificacao({
  eligibleItems,
  allInvoices,
  classification,
  onChange,
  onNext,
  onBack,
}: {
  eligibleItems: TaggedItem[];
  allInvoices: NFeParsed[];
  classification: Record<string, ClassificationRow>;
  onChange: (classification: Record<string, ClassificationRow>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const { data: choices } = useChoices();
  const resolve = useResolveNcmRules();
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTrib, setBulkTrib] = useState("");
  const [bulkUtil, setBulkUtil] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);

  // Contagem de itens e notas por grupo (empresa+NCM+descrição) — exibida nas
  // pílulas de cada linha, igual ao v7 ("N item(ns) · N nota(s)").
  const countsByKey = useMemo(() => {
    const m = new Map<string, { itens: number; notas: Set<string> }>();
    for (const it of eligibleItems) {
      const k = classificationKey(it.companyId, it.ncm, it.descricao);
      const e = m.get(k) ?? { itens: 0, notas: new Set<string>() };
      e.itens += 1;
      e.notas.add(it.chave_nfe);
      m.set(k, e);
    }
    return m;
  }, [eligibleItems]);

  // Grupos de classificação: um por (empresa + NCM + descrição).
  const groups = useMemo(() => {
    const seen = new Map<string, { companyId: number; ncm: string; descricao: string }>();
    for (const item of eligibleItems) {
      const key = classificationKey(item.companyId, item.ncm, item.descricao);
      if (!seen.has(key)) seen.set(key, { companyId: item.companyId, ncm: item.ncm, descricao: item.descricao });
    }
    return [...seen.values()].sort((a, b) => a.ncm.localeCompare(b.ncm) || a.companyId - b.companyId);
  }, [eligibleItems]);

  useEffect(() => {
    const faltando = groups.filter((g) => !classification[classificationKey(g.companyId, g.ncm, g.descricao)]);
    if (faltando.length === 0) {
      setLoaded(true);
      return;
    }
    setError("");
    const porEmpresa = new Map<number, typeof faltando>();
    for (const g of faltando) {
      const lista = porEmpresa.get(g.companyId) ?? [];
      lista.push(g);
      porEmpresa.set(g.companyId, lista);
    }
    Promise.all(
      [...porEmpresa.entries()].map(([companyId, itens]) =>
        resolve
          .mutateAsync({ company_id: companyId, items: itens.map((i) => ({ ncm: i.ncm, descricao: i.descricao })) })
          .then((resolvidos) => ({ companyId, resolvidos })),
      ),
    )
      .then((resultadosPorEmpresa) => {
        const next = { ...classification };
        for (const { companyId, resolvidos } of resultadosPorEmpresa) {
          for (const r of resolvidos) {
            const key = classificationKey(companyId, r.ncm, r.descricao);
            const rule = r.rule;
            next[key] = {
              ncm: r.ncm,
              descricao: r.descricao,
              ...DEFAULT_CLASSIFICATION,
              ...(rule
                ? {
                    tributacao: rule.tributacao,
                    aliquota_interna: rule.aliquota_interna,
                    mva_original: rule.mva_original,
                    mva_4: rule.mva_4,
                    mva_7: rule.mva_7,
                    mva_12: rule.mva_12,
                    rbc: rule.rbc,
                    hasRule: true,
                  }
                : {}),
            };
          }
        }
        onChange(next);
        setLoaded(true);
      })
      .catch((err) => setError(apiError(err, "Não foi possível buscar regras NCM.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  function setRow(key: string, patch: Partial<ClassificationRow>) {
    onChange({ ...classification, [key]: { ...classification[key], ...patch } });
  }

  function toggleSelected(key: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }

  const keyOf = (g: { companyId: number; ncm: string; descricao: string }) =>
    classificationKey(g.companyId, g.ncm, g.descricao);
  const hasRuleOf = (g: { companyId: number; ncm: string; descricao: string }) =>
    classification[keyOf(g)]?.hasRule ?? false;

  const comRegra = groups.filter(hasRuleOf).length;
  const semRegra = groups.length - comRegra;

  const filtered = useMemo(() => {
    if (filtro === "com") return groups.filter(hasRuleOf);
    if (filtro === "sem") return groups.filter((g) => !hasRuleOf(g));
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, filtro, classification]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageClamped = Math.min(page, totalPages - 1);
  const start = pageClamped * pageSize;
  const pageGroups = filtered.slice(start, start + pageSize);

  // Aplica um campo em massa: nos selecionados, ou (se nada selecionado) em
  // todos os grupos do filtro atual.
  function aplicarEmMassa(campo: "tributacao" | "utilizacao", valor: string) {
    if (!valor) return;
    const alvos = selected.size > 0 ? [...selected] : filtered.map(keyOf);
    const next = { ...classification };
    for (const key of alvos) {
      if (next[key]) next[key] = { ...next[key], [campo]: valor };
    }
    onChange(next);
  }

  const pageKeys = pageGroups.map(keyOf);
  const allPageSelected = pageKeys.length > 0 && pageKeys.every((k) => selected.has(k));
  function togglePageSelection(check: boolean) {
    setSelected((s) => {
      const n = new Set(s);
      for (const k of pageKeys) check ? n.add(k) : n.delete(k);
      return n;
    });
  }

  const podeAvancar = loaded && groups.every((g) => classification[keyOf(g)]);
  const alvosMassa = selected.size > 0 ? selected.size : filtered.length;

  return (
    <div className="stack gap-16">
      <UfSummary invoices={allInvoices} />

      <div className="card">
        <div className="card-head" style={{ flexWrap: "wrap", gap: 10 }}>
          <div className="stack" style={{ gap: 2 }}>
            <h2 className="page-title">Classificação de itens</h2>
            <span className="page-sub">{groups.length} NCM(s) calculável(is) encontrado(s).</span>
          </div>
          <div className="row gap-12" style={{ flexWrap: "wrap" }}>
            <div className="chip-group">
              <button className={`chip ${filtro === "todos" ? "active" : ""}`} onClick={() => { setFiltro("todos"); setPage(0); }}>
                Todos <span className="count">{groups.length}</span>
              </button>
              <button className={`chip ${filtro === "com" ? "active" : ""}`} onClick={() => { setFiltro("com"); setPage(0); }}>
                Com regra <span className="count">{comRegra}</span>
              </button>
              <button className={`chip ${filtro === "sem" ? "active" : ""}`} onClick={() => { setFiltro("sem"); setPage(0); }}>
                Sem regra <span className="count">{semRegra}</span>
              </button>
            </div>
            <div className="row gap-8">
              <span className="muted" style={{ fontSize: 12.5 }}>Por página</span>
              <Select
                aria-label="Itens por página"
                value={String(pageSize)}
                onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}
                options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
              />
            </div>
          </div>
        </div>

        {loaded && groups.length > 0 && (
          <div className="bulk-bar">
            <span className="lbl">Aplicar a {selected.size > 0 ? `${selected.size} selecionado(s)` : "todos"}</span>
            <div style={{ minWidth: 180 }}>
              <Select
                aria-label="Tributação em massa"
                value={bulkTrib || BULK_PLACEHOLDER}
                onValueChange={(v) => setBulkTrib(v === BULK_PLACEHOLDER ? "" : v)}
                options={[{ value: BULK_PLACEHOLDER, label: "— Tributação —" }, ...(choices?.item_tributacao ?? [])]}
              />
            </div>
            <Button variant="ghost" size="sm" disabled={!bulkTrib || alvosMassa === 0} onClick={() => aplicarEmMassa("tributacao", bulkTrib)}>
              ✓ Aplicar tributação
            </Button>
            <div style={{ minWidth: 180 }}>
              <Select
                aria-label="Utilização em massa"
                value={bulkUtil || BULK_PLACEHOLDER}
                onValueChange={(v) => setBulkUtil(v === BULK_PLACEHOLDER ? "" : v)}
                options={[{ value: BULK_PLACEHOLDER, label: "— Utilização —" }, ...(choices?.item_utilizacao ?? [])]}
              />
            </div>
            <Button variant="ghost" size="sm" disabled={!bulkUtil || alvosMassa === 0} onClick={() => aplicarEmMassa("utilizacao", bulkUtil)}>
              ✓ Aplicar utilização
            </Button>
          </div>
        )}

        {error && <div className="card-body"><div className="alert alert-danger">{error}</div></div>}
        {!loaded && <div className="empty">Buscando regras NCM aplicáveis…</div>}

        {loaded && groups.length > 0 && (
          <div className="table-scroll">
            <table className="table grid-table">
              <thead>
                <tr>
                  <th style={{ width: 34 }}>
                    <Checkbox checked={allPageSelected} onCheckedChange={(v) => togglePageSelection(!!v)} aria-label="Selecionar página" />
                  </th>
                  <th>Item / NCM</th>
                  <th>Tributação</th>
                  <th>Utilização</th>
                  <th>Alíq.</th>
                  <th>RBC %</th>
                  <th>MVA 0%</th>
                  <th>MVA 4%</th>
                  <th>MVA 7%</th>
                  <th>MVA 12%</th>
                </tr>
              </thead>
              <tbody>
                {pageGroups.map((g) => {
                  const key = keyOf(g);
                  const row = classification[key];
                  if (!row) return null;
                  const counts = countsByKey.get(key);
                  const isST = row.tributacao === "st";
                  return (
                    <tr key={key}>
                      <td>
                        <Checkbox checked={selected.has(key)} onCheckedChange={() => toggleSelected(key)} aria-label={`Selecionar ${g.ncm}`} />
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        <div className="stack" style={{ gap: 3 }}>
                          <strong className="num">{g.ncm}</strong>
                          <span style={{ fontSize: 13 }}>{g.descricao || "—"}</span>
                          <div className="row gap-8" style={{ flexWrap: "wrap" }}>
                            {row.hasRule && <Badge variant="ok">Regra encontrada</Badge>}
                            {counts && <Badge variant="neutral">{counts.itens} item(ns)</Badge>}
                            {counts && <Badge variant="neutral">{counts.notas.size} nota(s)</Badge>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <Select
                          aria-label="Tributação"
                          value={row.tributacao}
                          onValueChange={(v) => setRow(key, { tributacao: v })}
                          options={choices?.item_tributacao ?? []}
                        />
                      </td>
                      <td>
                        <Select
                          aria-label="Utilização"
                          value={row.utilizacao}
                          onValueChange={(v) => setRow(key, { utilizacao: v })}
                          options={choices?.item_utilizacao ?? []}
                        />
                      </td>
                      <td>
                        <div className="cell-num-input">
                          <Input className="num" inputMode="decimal" value={row.aliquota_interna} onChange={(e) => setRow(key, { aliquota_interna: e.target.value })} />
                        </div>
                      </td>
                      <td>
                        <div className="cell-num-input">
                          <Input className="num" inputMode="decimal" value={row.rbc} onChange={(e) => setRow(key, { rbc: e.target.value })} />
                        </div>
                      </td>
                      <td>
                        <div className="cell-num-input">
                          <Input className="num" inputMode="decimal" disabled={!isST} value={row.mva_original} onChange={(e) => setRow(key, { mva_original: e.target.value })} />
                        </div>
                      </td>
                      <td>
                        <div className="cell-num-input">
                          <Input className="num" inputMode="decimal" disabled={!isST} value={row.mva_4} onChange={(e) => setRow(key, { mva_4: e.target.value })} />
                        </div>
                      </td>
                      <td>
                        <div className="cell-num-input">
                          <Input className="num" inputMode="decimal" disabled={!isST} value={row.mva_7} onChange={(e) => setRow(key, { mva_7: e.target.value })} />
                        </div>
                      </td>
                      <td>
                        <div className="cell-num-input">
                          <Input className="num" inputMode="decimal" disabled={!isST} value={row.mva_12} onChange={(e) => setRow(key, { mva_12: e.target.value })} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {loaded && filtered.length > 0 && (
          <div className="row gap-8" style={{ justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
            <span className="muted" style={{ fontSize: 12.5 }}>
              Mostrando {start + 1}–{Math.min(start + pageSize, filtered.length)} de {filtered.length}
            </span>
            <div className="row gap-8">
              <Button variant="ghost" size="sm" disabled={pageClamped === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                ‹ Anterior
              </Button>
              <span className="muted" style={{ fontSize: 12.5 }}>Página {pageClamped + 1} de {totalPages}</span>
              <Button variant="ghost" size="sm" disabled={pageClamped >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                Próximo ›
              </Button>
            </div>
          </div>
        )}

        <div className="card-head" style={{ borderTop: "1px solid var(--line)", borderBottom: "none", justifyContent: "space-between" }}>
          <Button variant="ghost" onClick={onBack}>
            ← Voltar
          </Button>
          <Button variant="primary" disabled={!podeAvancar} onClick={onNext}>
            Processar Cálculos →
          </Button>
        </div>
      </div>
    </div>
  );
}
