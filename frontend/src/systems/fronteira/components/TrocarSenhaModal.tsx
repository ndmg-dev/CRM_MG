import { useEffect, useState } from "react";
import { Button, Input, Label, Modal } from "@fronteira-ui";
import { useTrocarSenha } from "../hooks/queries";
import { apiError } from "../lib/api";
import { SENHA_REQUISITOS, validarForcaSenha } from "../lib/senha";

/** Troca a senha do próprio usuário logado (exige a senha atual). */
export function TrocarSenhaModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trocar = useTrocarSenha();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (open) {
      setAtual("");
      setNova("");
      setConfirma("");
      setError("");
      setOk(false);
    }
  }, [open]);

  async function submit() {
    setError("");
    const problema = validarForcaSenha(nova);
    if (problema) {
      setError(problema);
      return;
    }
    if (nova !== confirma) {
      setError("A confirmação não confere com a nova senha.");
      return;
    }
    try {
      await trocar.mutateAsync({ senha_atual: atual, senha_nova: nova });
      setOk(true);
    } catch (err) {
      setError(apiError(err, "Não foi possível trocar a senha."));
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Trocar senha"
      description="Informe a senha atual e a nova senha."
      actions={
        ok ? (
          <Button variant="primary" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={trocar.isPending} onClick={submit}>
              {trocar.isPending ? "Salvando…" : "Trocar senha"}
            </Button>
          </>
        )
      }
    >
      {ok ? (
        <div className="alert alert-ok">Senha alterada com sucesso.</div>
      ) : (
        <div className="stack gap-16">
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="field">
            <Label htmlFor="ts-atual">Senha atual</Label>
            <Input id="ts-atual" type="password" value={atual} onChange={(e) => setAtual(e.target.value)} autoComplete="current-password" autoFocus />
          </div>
          <div className="field">
            <Label htmlFor="ts-nova">Nova senha</Label>
            <Input id="ts-nova" type="password" value={nova} onChange={(e) => setNova(e.target.value)} autoComplete="new-password" />
            <span className="field-hint">{SENHA_REQUISITOS}</span>
          </div>
          <div className="field">
            <Label htmlFor="ts-conf">Confirmar nova senha</Label>
            <Input id="ts-conf" type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)} autoComplete="new-password" />
          </div>
        </div>
      )}
    </Modal>
  );
}
