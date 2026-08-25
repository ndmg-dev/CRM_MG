import { useState } from "react";
import { Checkbox } from "@fronteira-ui";
import { useConfiguracoes, useSaveConfiguracoes } from "../hooks/queries";
import { apiError } from "../lib/api";

/** Configurações do sistema (restrito a administrador). Hoje só o interruptor
 * da verificação em duas etapas. */
export default function Configuracoes() {
  const { data, isLoading, error } = useConfiguracoes();
  const salvar = useSaveConfiguracoes();
  const [erroSalvar, setErroSalvar] = useState("");
  const [ok, setOk] = useState("");

  // Ligar exige SMTP configurado e nenhum usuário ativo sem e-mail — senão
  // essas pessoas não teriam como receber o código e ficariam sem acesso.
  const semEmail = data?.usuarios_sem_email ?? [];
  const podeLigar = Boolean(data?.smtp_configurado) && semEmail.length === 0;

  async function alternar(ativo: boolean) {
    setErroSalvar("");
    setOk("");
    try {
      await salvar.mutateAsync({ mfa_email_ativo: ativo });
      setOk(
        ativo
          ? "Verificação em duas etapas ativada. Novos logins passarão a pedir o código enviado por e-mail."
          : "Verificação em duas etapas desativada.",
      );
    } catch (err) {
      setErroSalvar(apiError(err, "Não foi possível salvar a configuração."));
    }
  }

  if (isLoading) return <div className="muted">Carregando…</div>;
  if (error) return <div className="alert alert-danger">{apiError(error)}</div>;

  return (
    <div className="stack gap-16">
      <div>
        <h1 className="page-title">Configurações</h1>
        <p className="page-sub">Opções gerais do sistema</p>
      </div>

      <div className="card">
        <div className="card-head">
          <strong>Verificação em duas etapas</strong>
        </div>
        <div className="stack gap-16" style={{ padding: 16 }}>
          {erroSalvar && <div className="alert alert-danger">{erroSalvar}</div>}
          {ok && <div className="alert alert-ok">{ok}</div>}

          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
            Quando ativa, todo login passa a exigir um código de 6 dígitos enviado
            para o e-mail cadastrado do usuário, além da senha.
          </p>

          <Checkbox
            checked={Boolean(data?.mfa_email_ativo)}
            disabled={salvar.isPending || (!data?.mfa_email_ativo && !podeLigar)}
            onCheckedChange={(v) => alternar(Boolean(v))}
            label="Exigir código por e-mail no login"
          />

          {!data?.smtp_configurado && (
            <div className="alert alert-danger">
              O servidor de e-mail (SMTP) não está configurado. Sem ele ninguém
              receberia o código, então a verificação em duas etapas não pode ser
              ativada. Defina <code>SMTP_HOST</code> na configuração do backend.
            </div>
          )}

          {semEmail.length > 0 && (
            <div className="alert alert-danger">
              <strong>
                {semEmail.length} usuário(s) ativo(s) sem e-mail cadastrado.
              </strong>{" "}
              Eles não teriam como receber o código e ficariam sem acesso. Cadastre
              o e-mail antes de ativar: {semEmail.slice(0, 10).join(", ")}
              {semEmail.length > 10 ? ` e mais ${semEmail.length - 10}` : ""}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
