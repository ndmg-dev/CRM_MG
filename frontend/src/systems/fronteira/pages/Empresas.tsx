import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";
import { Badge, Button, Input } from "@fronteira-ui";
import { fetchEmpresaUso, useDeleteEmpresa, useEmpresasPage } from "../hooks/queries";
import { useAuth } from "../auth/AuthContext";
import { useConfirm } from "../components/ConfirmDialog";
import { Pagination } from "../components/Pagination";
import { formatCNPJ } from "../lib/format";
import { apiError } from "../lib/api";

const TRIB_LABEL: Record<string, string> = {
  simples_irregular: "Simples Irregular",
  simples_regular: "Simples Regular",
  normal: "Normal",
};

export default function Empresas() {
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const { data, isLoading, error } = useEmpresasPage({ q, offset });
  const del = useDeleteEmpresa();
  const { isCoordenador } = useAuth();
  const navigate = useNavigate();
  const toAbs = useNativeSystemPath();
  const confirm = useConfirm();
  const [erro, setErro] = useState("");

  async function handleDelete(id: number, nome: string) {
    setErro("");
    let uso;
    try {
      uso = await fetchEmpresaUso(id);
    } catch (e) {
      setErro(apiError(e, "Não foi possível verificar o uso da empresa."));
      return;
    }

    // Empresa com histórico fiscal não pode ser excluída — informa e para.
    if (!uso.pode_excluir) {
      await confirm({
        title: "Não é possível excluir",
        message:
          `A empresa "${nome}" tem histórico fiscal (${uso.invoices} nota(s), ` +
          `${uso.antecipacao_batches} lote(s) de antecipação, ${uso.comparacoes} comparação(ões) SEFAZ) ` +
          `e não pode ser excluída. Desative-a (editar → desmarcar "Empresa ativa") para preservar o histórico.`,
        confirmLabel: "Entendi",
        cancelLabel: "Fechar",
      });
      return;
    }

    // Sem histórico fiscal: avisa explicitamente quantas regras NCM somem junto.
    const avisoRegras =
      uso.ncm_rules > 0
        ? ` Isto vai apagar também ${uso.ncm_rules} regra(s) NCM cadastrada(s) para esta empresa.`
        : "";
    const ok = await confirm({
      title: "Excluir empresa",
      message: `Excluir a empresa "${nome}"?${avisoRegras} Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(id);
    } catch (e) {
      setErro(apiError(e, "Não foi possível excluir."));
    }
  }

  return (
    <div className="stack gap-16">
      <div className="row">
        <div>
          <h1 className="page-title">Empresas</h1>
          <p className="page-sub">Cadastro de empresas e regime de tributação</p>
        </div>
        <div className="spacer" />
        {isCoordenador && (
          <Button variant="primary" onClick={() => navigate(toAbs("empresas/nova"))}>
            Nova empresa
          </Button>
        )}
      </div>

      {erro && <div className="alert alert-danger">{erro}</div>}

      <div className="card">
        <div className="card-head">
          <Input
            placeholder="Buscar por nome ou CNPJ…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOffset(0);
            }}
            style={{ maxWidth: 320 }}
          />
          <span className="muted" style={{ fontSize: 13 }}>
            {data ? `${data.total} empresa(s)` : ""}
          </span>
        </div>

        {isLoading ? (
          <div className="empty">Carregando…</div>
        ) : error ? (
          <div className="empty">
            <strong>Não foi possível carregar</strong>
            {apiError(error)}
          </div>
        ) : !data?.items.length ? (
          <div className="empty">
            <strong>Nenhuma empresa encontrada</strong>
            {q ? "Tente outro termo de busca." : "Cadastre a primeira empresa para começar."}
          </div>
        ) : (
          <>
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>CNPJ</th>
                <th>Tributação</th>
                <th>Perfil</th>
                <th>Situação</th>
                {isCoordenador && <th className="right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {data.items.map((e) => (
                <tr key={e.id}>
                  <td>{e.nome}</td>
                  <td className="num">{formatCNPJ(e.cnpj)}</td>
                  <td>{TRIB_LABEL[e.tributacao] ?? e.tributacao}</td>
                  <td style={{ textTransform: "capitalize" }}>{e.perfil}</td>
                  <td>
                    <Badge variant={e.ativo ? "ok" : "neutral"}>{e.ativo ? "Ativa" : "Inativa"}</Badge>
                  </td>
                  {isCoordenador && (
                    <td className="right">
                      <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
                        <Button variant="ghost" size="sm" onClick={() => navigate(toAbs(`empresas/${e.id}/editar`))}>
                          Editar
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleDelete(e.id, e.nome)}>
                          Excluir
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination total={data.total} offset={data.offset} count={data.items.length} onChange={setOffset} />
          </>
        )}
      </div>
    </div>
  );
}
