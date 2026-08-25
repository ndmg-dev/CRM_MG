import { useEffect, useState } from "react";
import { Button, Input, Label, Modal } from "@fronteira-ui";
import { useZerarMemoriaAntecipacao } from "../../hooks/queries";
import { apiError } from "../../lib/api";

/** Confirma o "zerar memória" (destrutivo e irreversível) exigindo a senha
 * atual do usuário logado — não basta clicar "confirmar": uma sessão
 * deixada aberta não deveria bastar pra apagar a memória fiscal de uma
 * empresa inteira. */
export function ZerarMemoriaModal({
  open,
  onOpenChange,
  companyId,
  nomeEmpresa,
  onZerado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  nomeEmpresa?: string;
  onZerado: () => void;
}) {
  const zerar = useZerarMemoriaAntecipacao();
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSenha("");
      setError("");
    }
  }, [open]);

  async function submit() {
    setError("");
    if (!senha) {
      setError("Informe sua senha.");
      return;
    }
    try {
      await zerar.mutateAsync({ companyId, senha });
      onOpenChange(false);
      onZerado();
    } catch (err) {
      setError(apiError(err, "Não foi possível zerar a memória."));
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Zerar memória da empresa"
      description={
        `Apagar toda a memória de tributação${nomeEmpresa ? ` de "${nomeEmpresa}"` : " desta empresa"}? ` +
        "As classificações dela serão perdidas — os itens voltam a precisar de classificação manual. " +
        "A memória das demais empresas não é afetada. Esta ação não pode ser desfeita."
      }
      actions={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="danger" disabled={zerar.isPending} onClick={submit}>
            {zerar.isPending ? "Zerando…" : "Zerar memória"}
          </Button>
        </>
      }
    >
      <div className="stack gap-16">
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="field">
          <Label htmlFor="zm-senha">Confirme sua senha</Label>
          <Input
            id="zm-senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
      </div>
    </Modal>
  );
}
