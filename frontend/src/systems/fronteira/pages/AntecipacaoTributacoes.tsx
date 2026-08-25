import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";
import { Badge, Button } from "@fronteira-ui";
import {
  useAntecipacaoTributacoes,
  useDefinirPadraoAntecipacaoTributacao,
  useExcluirAntecipacaoTributacao,
} from "../hooks/queries";
import { useAuth } from "../auth/AuthContext";
import { useConfirm } from "../components/ConfirmDialog";
import { apiError } from "../lib/api";

/** Antecipação — catálogo de tributações: os códigos usados para classificar
 * itens (memória e lote). `zera_imposto`/`eh_nst` alimentam diretamente o
 * cálculo (`calcular_lote`); antes eram fixos em `constants.py`, agora vêm
 * desta tabela editável. */
export default function AntecipacaoTributacoes() {
  const { data, isLoading, error } = useAntecipacaoTributacoes();
  const definirPadrao = useDefinirPadraoAntecipacaoTributacao();
  const excluir = useExcluirAntecipacaoTributacao();
  const { isCoordenador } = useAuth();
  const navigate = useNavigate();
  const toAbs = useNativeSystemPath();
  const confirm = useConfirm();
  const [erro, setErro] = useState("");

  async function handlePadrao(id: number) {
    setErro("");
    try {
      await definirPadrao.mutateAsync(id);
    } catch (e) {
      setErro(apiError(e, "Não foi possível definir como padrão."));
    }
  }

  async function handleExcluir(id: number, nome: string) {
    const ok = await confirm({
      title: "Excluir tributação",
      message: `Excluir a tributação "${nome}"? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    setErro("");
    try {
      await excluir.mutateAsync(id);
    } catch (e) {
      setErro(apiError(e, "Não foi possível excluir."));
    }
  }

  return (
    <div className="stack gap-16">
      <div className="row">
        <div>
          <h1 className="page-title">Tributações</h1>
          <p className="page-sub">Catálogo de códigos de tributação usados na classificação da Antecipação Interna</p>
        </div>
        <div className="spacer" />
        {isCoordenador && (
          <Button variant="primary" onClick={() => navigate(toAbs("antecipacao/tributacoes/nova"))}>
            Nova tributação
          </Button>
        )}
      </div>

      {erro && <div className="alert alert-danger">{erro}</div>}

      <div className="card">
        {isLoading ? (
          <div className="empty">Carregando…</div>
        ) : error ? (
          <div className="empty">
            <strong>Não foi possível carregar</strong>
            {apiError(error)}
          </div>
        ) : !data?.length ? (
          <div className="empty">
            <strong>Nenhuma tributação cadastrada</strong>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nome</th>
                <th>Zera imposto</th>
                <th>NST</th>
                <th>Padrão</th>
                <th>Situação</th>
                {isCoordenador && <th className="right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id}>
                  <td className="num">{t.codigo}</td>
                  <td>{t.nome}</td>
                  <td>{t.zera_imposto ? <Badge variant="ok">Sim</Badge> : <Badge variant="neutral">Não</Badge>}</td>
                  <td>{t.eh_nst ? <Badge variant="ok">Sim</Badge> : <Badge variant="neutral">Não</Badge>}</td>
                  <td>
                    {t.padrao ? (
                      <Badge variant="ok">Padrão</Badge>
                    ) : (
                      isCoordenador && (
                        <Button variant="ghost" size="sm" disabled={!t.ativo} onClick={() => handlePadrao(t.id)}>
                          Tornar padrão
                        </Button>
                      )
                    )}
                  </td>
                  <td>
                    <Badge variant={t.ativo ? "ok" : "neutral"}>{t.ativo ? "Ativa" : "Inativa"}</Badge>
                  </td>
                  {isCoordenador && (
                    <td className="right">
                      <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
                        <Button variant="ghost" size="sm" onClick={() => navigate(toAbs(`antecipacao/tributacoes/${t.id}/editar`))}>
                          Editar
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={t.padrao}
                          onClick={() => handleExcluir(t.id, t.nome)}
                        >
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
