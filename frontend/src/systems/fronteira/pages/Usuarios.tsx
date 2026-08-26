import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";
import { Badge, Button, Input } from "@fronteira-ui";
import { ROLE_LABEL, useUsuarios } from "../hooks/queries";
import { Pagination } from "../components/Pagination";
import { apiError } from "../lib/api";

const ROLE_VARIANT: Record<string, "ok" | "neutral" | "accent"> = {
  administrador: "accent",
  coordenador: "ok",
  operador: "neutral",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

export default function Usuarios() {
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const { data, isLoading, error } = useUsuarios({ q, offset });
  const navigate = useNavigate();
  const toAbs = useNativeSystemPath();

  return (
    <div className="stack gap-16">
      <div className="row">
        <div>
          <h1 className="page-title">Usuários</h1>
          <p className="page-sub">Gestão de acessos e papéis do sistema</p>
        </div>
        <div className="spacer" />
        <Button variant="primary" onClick={() => navigate(toAbs("usuarios/novo"))}>
          Novo usuário
        </Button>
      </div>

      <div className="card">
        <div className="card-head">
          <Input
            placeholder="Buscar por usuário, nome ou e-mail…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOffset(0);
            }}
            style={{ maxWidth: 320 }}
          />
          <span className="muted" style={{ fontSize: 13 }}>
            {data ? `${data.total} usuário(s)` : ""}
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
            <strong>Nenhum usuário encontrado</strong>
            {q ? "Tente outro termo de busca." : "Cadastre o primeiro usuário."}
          </div>
        ) : (
          <>
          <table className="table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Papel</th>
                <th>Situação</th>
                <th>Último acesso</th>
                <th className="right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id}>
                  <td className="num">{u.username}</td>
                  <td>{u.full_name}</td>
                  <td>{u.email || "—"}</td>
                  <td>
                    <Badge variant={ROLE_VARIANT[u.role] ?? "neutral"}>{ROLE_LABEL[u.role] ?? u.role}</Badge>
                  </td>
                  <td>
                    <Badge variant={u.is_active ? "ok" : "neutral"}>{u.is_active ? "Ativo" : "Inativo"}</Badge>
                  </td>
                  <td className="num">{formatDate(u.last_login)}</td>
                  <td className="right">
                    <Button variant="ghost" size="sm" onClick={() => navigate(toAbs(`usuarios/${u.id}/editar`))}>
                      Editar
                    </Button>
                  </td>
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
