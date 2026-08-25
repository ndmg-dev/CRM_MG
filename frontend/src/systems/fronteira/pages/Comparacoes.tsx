import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";
import { Badge, Button } from "@fronteira-ui";
import { useComparacoes } from "../hooks/queries";
import { useAuth } from "../auth/AuthContext";
import { Pagination } from "../components/Pagination";
import { apiError } from "../lib/api";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

export default function Comparacoes() {
  const [offset, setOffset] = useState(0);
  const { data, isLoading, error } = useComparacoes(null, offset);
  const { isCoordenador } = useAuth();
  const navigate = useNavigate();
  const toAbs = useNativeSystemPath();

  return (
    <div className="stack gap-16">
      <div className="row">
        <div>
          <h1 className="page-title">Comparação SEFAZ</h1>
          <p className="page-sub">Cruzamento do extrato SEFAZ com as notas do sistema</p>
        </div>
        <div className="spacer" />
        {isCoordenador && (
          <Button variant="primary" onClick={() => navigate(toAbs("comparacao/nova"))}>
            Nova comparação
          </Button>
        )}
      </div>

      <div className="card">
        {isLoading ? (
          <div className="empty">Carregando…</div>
        ) : error ? (
          <div className="empty">
            <strong>Não foi possível carregar</strong>
            {apiError(error)}
          </div>
        ) : !data?.items.length ? (
          <div className="empty">
            <strong>Nenhuma comparação ainda</strong>
            Envie um extrato SEFAZ para conferir contra as notas já lançadas.
          </div>
        ) : (
          <>
          <table className="table">
            <thead>
              <tr>
                <th>Competência</th>
                <th>Extrato</th>
                <th>Arquivo</th>
                <th className="right">Notas</th>
                <th className="right">OK</th>
                <th className="right">Divergente</th>
                <th>Criado em</th>
                <th className="right"></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id}>
                  <td className="num">{c.competencia}</td>
                  <td className="num">{c.num_extrato || "—"}</td>
                  <td>{c.arquivo_sefaz || "—"}</td>
                  <td className="right num">{c.total_notas}</td>
                  <td className="right num">
                    <Badge variant="ok">{c.total_ok}</Badge>
                  </td>
                  <td className="right num">
                    {c.total_divergente > 0 ? (
                      <Badge variant="err">{c.total_divergente}</Badge>
                    ) : (
                      <span className="muted">0</span>
                    )}
                  </td>
                  <td className="num muted">{formatDate(c.criado_em)}</td>
                  <td className="right">
                    <Button variant="ghost" size="sm" onClick={() => navigate(toAbs(`comparacao/${c.id}`))}>
                      Ver
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
