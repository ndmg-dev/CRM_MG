import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";
import { Badge, Button, Input, Select } from "@fronteira-ui";
import {
  EXCECAO_ACAO_LABEL,
  EXCECAO_TIPO_LABEL,
  useDeleteExcecao,
  useExcecoes,
} from "../hooks/queries";
import { useAuth } from "../auth/AuthContext";
import { useConfirm } from "../components/ConfirmDialog";
import { apiError } from "../lib/api";

const TODOS_TIPOS = "__todos__";
const TIPO_OPTIONS = [
  { value: TODOS_TIPOS, label: "Todos os tipos" },
  { value: "ncm", label: "NCM" },
  { value: "cfop", label: "CFOP" },
  { value: "cst", label: "CST" },
];

export default function Excecoes() {
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [erro, setErro] = useState("");
  const { data, isLoading, error } = useExcecoes(q, tipo);
  const del = useDeleteExcecao();
  const { isCoordenador } = useAuth();
  const navigate = useNavigate();
  const toAbs = useNativeSystemPath();
  const confirm = useConfirm();

  async function handleDelete(id: number, valor: string) {
    const ok = await confirm({
      title: "Excluir exceção",
      message: `Excluir a exceção "${valor}"? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    setErro("");
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
          <h1 className="page-title">Exceções fiscais</h1>
          <p className="page-sub">Itens que devem ser ignorados ou forçados no cálculo, por NCM/CFOP/CST</p>
        </div>
        <div className="spacer" />
        {isCoordenador && (
          <Button variant="primary" onClick={() => navigate(toAbs("excecoes/nova"))}>
            Nova exceção
          </Button>
        )}
      </div>

      <div className="alert alert-ok">
        Exceções com ação <strong>Ignorar</strong> são aplicadas na conferência do wizard de Fronteira: o item cujo
        NCM/CFOP/CST bate é sinalizado e excluído do cálculo. (A ação <em>Forçar</em> e o campo <em>Escopo</em>
        permanecem sem efeito — herança do sistema original.)
      </div>

      {erro && <div className="alert alert-danger">{erro}</div>}

      <div className="card">
        <div className="card-head">
          <div className="row gap-8">
            <Input
              placeholder="Buscar por valor, descrição ou motivo…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ maxWidth: 320 }}
            />
            <Select
              aria-label="Tipo"
              value={tipo || TODOS_TIPOS}
              onValueChange={(v) => setTipo(v === TODOS_TIPOS ? "" : v)}
              options={TIPO_OPTIONS}
            />
          </div>
          <span className="muted" style={{ fontSize: 13 }}>
            {data ? `${data.length} exceção(ões)` : ""}
          </span>
        </div>

        {isLoading ? (
          <div className="empty">Carregando…</div>
        ) : error ? (
          <div className="empty">
            <strong>Não foi possível carregar</strong>
            {apiError(error)}
          </div>
        ) : !data?.length ? (
          <div className="empty">
            <strong>Nenhuma exceção encontrada</strong>
            {q || tipo ? "Tente outro filtro." : "Cadastre a primeira exceção."}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Descrição</th>
                <th>Ação</th>
                <th>Situação</th>
                {isCoordenador && <th className="right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id}>
                  <td>{EXCECAO_TIPO_LABEL[e.tipo] ?? e.tipo.toUpperCase()}</td>
                  <td className="num">{e.valor}</td>
                  <td>{e.descricao_produto || "—"}</td>
                  <td>
                    <Badge variant={e.acao === "ignorar" ? "neutral" : "ok"}>
                      {EXCECAO_ACAO_LABEL[e.acao] ?? e.acao}
                    </Badge>
                  </td>
                  <td>
                    <Badge variant={e.ativo ? "ok" : "neutral"}>{e.ativo ? "Ativa" : "Inativa"}</Badge>
                  </td>
                  {isCoordenador && (
                    <td className="right">
                      <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
                        <Button variant="ghost" size="sm" onClick={() => navigate(toAbs(`excecoes/${e.id}/editar`))}>
                          Editar
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleDelete(e.id, e.valor)}>
                          Excluir
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
