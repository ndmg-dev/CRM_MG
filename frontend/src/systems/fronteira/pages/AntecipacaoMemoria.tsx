import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";
import { Button, Checkbox, Input, Label, Select } from "@fronteira-ui";
import {
  TRIBUTACAO_ANTECIPACAO_LABEL,
  exportarMemoriaAntecipacao,
  useAntecipacaoMemoriasAgrupadas,
  useAntecipacaoTributacoes,
  useEmpresas,
  useExcluirGrupoAntecipacaoMemoria,
  type AntecipacaoMemoriaGrupo,
  type AntecipacaoMemoriaGrupoFiltros,
} from "../hooks/queries";
import { useAuth } from "../auth/AuthContext";
import { useConfirm } from "../components/ConfirmDialog";
import { Pagination } from "../components/Pagination";
import { AntecipacaoImportarModal } from "../components/antecipacao/AntecipacaoImportarModal";
import { CopiarEmpresaModal } from "../components/antecipacao/CopiarEmpresaModal";
import { CopiarMemoriaModal } from "../components/antecipacao/CopiarMemoriaModal";
import { EditarGrupoMemoriaModal } from "../components/antecipacao/EditarGrupoMemoriaModal";
import { EscolherEmpresaModal } from "../components/antecipacao/EscolherEmpresaModal";
import { ZerarMemoriaModal } from "../components/antecipacao/ZerarMemoriaModal";
import { apiError } from "../lib/api";

const TODAS = "__todas__";
const EMPTY: AntecipacaoMemoriaGrupoFiltros = { ncm: "", descricao: "", tributacao: "", aplicaSeA: "qualquer" };

const APLICA_SE_A_OPTIONS = [
  { value: "qualquer", label: "Qualquer" },
  { value: "grupos", label: "Grupos (mais de uma empresa)" },
  { value: "empresa_especifica", label: "Empresa específica (só uma)" },
];

/** Chave estável por linha (grupo) — não existe um "id" único de linha no
 * backend, ela é definida pelo conjunto de item_ids que compõem o grupo. */
function rowKey(grupo: AntecipacaoMemoriaGrupo): string {
  return grupo.item_ids.join(",");
}

function EscopoChip({ grupo, nomeEmpresa }: { grupo: AntecipacaoMemoriaGrupo; nomeEmpresa: (id: number) => string }) {
  const n = grupo.company_ids.length;
  const label = n === 1 ? `🏢 ${nomeEmpresa(grupo.company_ids[0])}` : `🏢 ${n} empresas`;
  return (
    <span
      style={{
        display: "inline-block",
        background: "#1c1c1e",
        border: "1px solid #333",
        color: "#ddd",
        padding: "6px 10px",
        borderRadius: 14,
        fontSize: 12.5,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "100%",
      }}
      title={label}
    >
      {label}
    </span>
  );
}

export default function AntecipacaoMemoria() {
  const [draft, setDraft] = useState<AntecipacaoMemoriaGrupoFiltros>(EMPTY);
  const [filtros, setFiltros] = useState<AntecipacaoMemoriaGrupoFiltros>(EMPTY);
  const [offset, setOffset] = useState(0);
  const [erro, setErro] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const [copyItemIds, setCopyItemIds] = useState<number[] | null>(null);
  const [copyEmpresaOpen, setCopyEmpresaOpen] = useState(false);
  const [editGrupo, setEditGrupo] = useState<AntecipacaoMemoriaGrupo | null>(null);
  const [acaoEmpresa, setAcaoEmpresa] = useState<null | "zerar" | "exportar" | "importar">(null);
  const [zerarCompanyId, setZerarCompanyId] = useState<number | null>(null);
  const [importCompanyId, setImportCompanyId] = useState<number | null>(null);

  const { data, isLoading, error } = useAntecipacaoMemoriasAgrupadas(filtros, offset);
  const { data: tributacoes } = useAntecipacaoTributacoes(true);
  const { data: empresasVisiveis } = useEmpresas("", { limit: 500 });
  const excluirGrupo = useExcluirGrupoAntecipacaoMemoria();
  const { isCoordenador } = useAuth();
  const navigate = useNavigate();
  const toAbs = useNativeSystemPath();
  const confirm = useConfirm();

  function nomeEmpresa(id: number): string {
    return empresasVisiveis?.find((e) => e.id === id)?.nome ?? `#${id}`;
  }

  const tributacaoOptions = [
    { value: TODAS, label: "Todas" },
    ...(tributacoes ?? []).map((t) => ({ value: t.codigo, label: t.nome })),
  ];

  function set<K extends keyof AntecipacaoMemoriaGrupoFiltros>(key: K, value: AntecipacaoMemoriaGrupoFiltros[K]) {
    setDraft((f) => ({ ...f, [key]: value }));
  }
  function aplicar() {
    setFiltros(draft);
    setOffset(0);
    setSelecionados(new Set());
  }
  function limpar() {
    setDraft(EMPTY);
    setFiltros(EMPTY);
    setOffset(0);
    setSelecionados(new Set());
  }

  const linhas = data?.items ?? [];
  const chaves = useMemo(() => linhas.map(rowKey), [linhas]);
  const todosSelecionados = chaves.length > 0 && chaves.every((k) => selecionados.has(k));

  function toggleTodos(check: boolean) {
    setSelecionados(check ? new Set(chaves) : new Set());
  }
  function toggleLinha(key: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function abrirCopiaLinha(grupo: AntecipacaoMemoriaGrupo) {
    setCopyItemIds(grupo.item_ids);
  }
  function abrirCopiaSelecionados() {
    const ids = linhas.filter((g) => selecionados.has(rowKey(g))).flatMap((g) => g.item_ids);
    setCopyItemIds(ids);
  }

  async function handleExcluir(grupo: AntecipacaoMemoriaGrupo) {
    const n = grupo.company_ids.length;
    const alvo = n === 1 ? "1 empresa" : `${n} empresas`;
    const ok = await confirm({
      title: "Excluir item",
      message: `Excluir "${grupo.descricao || grupo.ncm}"? Vale hoje para ${alvo}. Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    setErro("");
    try {
      await excluirGrupo.mutateAsync(grupo.item_ids);
      setSelecionados((prev) => {
        const next = new Set(prev);
        next.delete(rowKey(grupo));
        return next;
      });
    } catch (e) {
      setErro(apiError(e, "Não foi possível excluir."));
    }
  }

  function confirmarEmpresaAcao(companyId: number) {
    const acao = acaoEmpresa;
    setAcaoEmpresa(null);
    if (acao === "zerar") setZerarCompanyId(companyId);
    else if (acao === "exportar") exportarMemoriaAntecipacao(companyId);
    else if (acao === "importar") setImportCompanyId(companyId);
  }

  return (
    <div className="stack gap-16">
      <div className="row">
        <div>
          <h1 className="page-title">Memória de Tributação</h1>
          <p className="page-sub">
            Classificações usadas na antecipação automática, sempre por empresa — copie de uma empresa pra outra quando o item se repetir.
          </p>
        </div>
        <div className="spacer" />
        {isCoordenador && (
          <div className="row gap-8">
            <Button variant="danger" onClick={() => setAcaoEmpresa("zerar")}>
              🗑 Zerar memória
            </Button>
            <Button variant="ghost" onClick={() => setAcaoEmpresa("exportar")}>
              ↓ Exportar
            </Button>
            <Button variant="ghost" onClick={() => setAcaoEmpresa("importar")}>
              ↑ Importar planilha
            </Button>
            <Button variant="ghost" onClick={() => setCopyEmpresaOpen(true)}>
              ⎘ Copiar de outra empresa
            </Button>
            <Button variant="primary" onClick={() => navigate(toAbs("antecipacao/nova"))}>
              + Adicionar item
            </Button>
          </div>
        )}
      </div>

      {erro && <div className="alert alert-danger">{erro}</div>}

      <div className="card">
        <div className="card-body stack gap-16">
          <div className="row gap-12" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="field" style={{ minWidth: 160 }}>
              <Label htmlFor="f-ncm">NCM</Label>
              <Input id="f-ncm" className="num" placeholder="Ex.: 22021000" value={draft.ncm}
                onChange={(e) => set("ncm", e.target.value)} onKeyDown={(e) => e.key === "Enter" && aplicar()} />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 220 }}>
              <Label htmlFor="f-desc">Descrição</Label>
              <Input id="f-desc" placeholder="Buscar por descrição…" value={draft.descricao}
                onChange={(e) => set("descricao", e.target.value)} onKeyDown={(e) => e.key === "Enter" && aplicar()} />
            </div>
            <div className="field" style={{ minWidth: 220 }}>
              <Label>Aplica-se a</Label>
              <Select aria-label="Aplica-se a" value={draft.aplicaSeA ?? "qualquer"}
                onValueChange={(v) => set("aplicaSeA", v)} options={APLICA_SE_A_OPTIONS} />
            </div>
            <div className="field" style={{ minWidth: 180 }}>
              <Label>Tributação</Label>
              <Select aria-label="Tributação" value={draft.tributacao || TODAS}
                onValueChange={(v) => set("tributacao", v === TODAS ? "" : v)} options={tributacaoOptions} />
            </div>
            <div className="row gap-8">
              <Button variant="primary" onClick={aplicar}>🔍 Filtrar</Button>
              <Button variant="ghost" onClick={limpar}>✕ Limpar</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          {selecionados.size > 0 ? (
            <span className="row gap-8" style={{ alignItems: "center" }}>
              <span style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
                {selecionados.size} selecionado(s)
              </span>
              <Button variant="ghost" size="sm" onClick={abrirCopiaSelecionados}>⎘ Copiar selecionados para...</Button>
              <Button variant="ghost" size="sm" onClick={() => setSelecionados(new Set())}>Cancelar seleção</Button>
            </span>
          ) : (
            <>
              <h2 style={{ fontSize: 14 }}>Itens na memória</h2>
              <span className="muted" style={{ fontSize: 13 }}>{data ? `${data.total} entrada(s)` : ""}</span>
            </>
          )}
        </div>

        {isLoading ? (
          <div className="empty">Carregando…</div>
        ) : error ? (
          <div className="empty"><strong>Não foi possível carregar</strong>{apiError(error)}</div>
        ) : !linhas.length ? (
          <div className="empty">
            <strong>Nenhuma entrada encontrada</strong>
            Ajuste os filtros, cadastre manualmente, importe uma planilha ou copie de outra empresa.
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="table" style={{ minWidth: 1040 }}>
                <thead>
                  <tr>
                    <th style={{ width: 30 }}>
                      <Checkbox checked={todosSelecionados} onCheckedChange={(v) => toggleTodos(!!v)} />
                    </th>
                    <th>NCM</th>
                    <th>Descrição</th>
                    <th>Tributação</th>
                    <th>Aplica-se a</th>
                    <th>Competência</th>
                    {isCoordenador && <th className="right">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((grupo) => {
                    const key = rowKey(grupo);
                    return (
                      <tr key={key}>
                        <td>
                          <Checkbox checked={selecionados.has(key)} onCheckedChange={() => toggleLinha(key)} />
                        </td>
                        <td className="num">{grupo.ncm}</td>
                        <td>{grupo.descricao || "—"}</td>
                        <td>{TRIBUTACAO_ANTECIPACAO_LABEL[grupo.tributacao] ?? grupo.tributacao}</td>
                        <td><EscopoChip grupo={grupo} nomeEmpresa={nomeEmpresa} /></td>
                        <td className="num">{grupo.competencia ?? "—"}</td>
                        {isCoordenador && (
                          <td className="right">
                            <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
                              <Button variant="ghost" size="sm" onClick={() => abrirCopiaLinha(grupo)}>⎘ Copiar</Button>
                              <Button variant="ghost" size="sm" onClick={() => setEditGrupo(grupo)}>Editar</Button>
                              <Button variant="danger" size="sm" onClick={() => handleExcluir(grupo)}>Excluir</Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination total={data!.total} offset={data!.offset} count={linhas.length} onChange={setOffset} />
          </>
        )}
      </div>

      {copyItemIds && (
        <CopiarMemoriaModal
          open
          onOpenChange={(open) => !open && setCopyItemIds(null)}
          itemIds={copyItemIds}
          onCopiado={() => {
            setCopyItemIds(null);
            setSelecionados(new Set());
          }}
        />
      )}

      <CopiarEmpresaModal
        open={copyEmpresaOpen}
        onOpenChange={setCopyEmpresaOpen}
        onCopiado={() => setCopyEmpresaOpen(false)}
      />

      <EditarGrupoMemoriaModal
        open={editGrupo != null}
        onOpenChange={(open) => !open && setEditGrupo(null)}
        grupo={editGrupo}
        onSalvo={() => setEditGrupo(null)}
      />

      <EscolherEmpresaModal
        open={acaoEmpresa != null}
        onOpenChange={(open) => !open && setAcaoEmpresa(null)}
        title={
          acaoEmpresa === "zerar" ? "Zerar memória de qual empresa?"
            : acaoEmpresa === "exportar" ? "Exportar memória de qual empresa?"
            : "Importar planilha para qual empresa?"
        }
        confirmLabel={acaoEmpresa === "exportar" ? "Exportar" : "Continuar"}
        onConfirm={confirmarEmpresaAcao}
      />

      {zerarCompanyId != null && (
        <ZerarMemoriaModal
          open
          onOpenChange={(open) => !open && setZerarCompanyId(null)}
          companyId={zerarCompanyId}
          nomeEmpresa={nomeEmpresa(zerarCompanyId)}
          onZerado={() => setZerarCompanyId(null)}
        />
      )}

      {importCompanyId != null && (
        <AntecipacaoImportarModal
          open
          onOpenChange={(open) => !open && setImportCompanyId(null)}
          companyId={importCompanyId}
        />
      )}
    </div>
  );
}
