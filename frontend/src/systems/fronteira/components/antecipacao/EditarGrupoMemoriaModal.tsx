import { useEffect, useState } from "react";
import { Button, Input, Label, Modal, Select } from "@fronteira-ui";
import {
  useAntecipacaoTributacoes,
  useEditarGrupoAntecipacaoMemoria,
  type AntecipacaoMemoriaGrupo,
} from "../../hooks/queries";
import { apiError } from "../../lib/api";

/** Edita descrição/tributação de um grupo inteiro — todas as empresas que
 * compartilham o item recebem o mesmo valor de uma vez. NCM não é editável
 * aqui: mudar o NCM quebraria a identidade do grupo — para isso, use
 * "Copiar" e depois exclua o item antigo. */
export function EditarGrupoMemoriaModal({
  open,
  onOpenChange,
  grupo,
  onSalvo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grupo: AntecipacaoMemoriaGrupo | null;
  onSalvo: () => void;
}) {
  const { data: tributacoes } = useAntecipacaoTributacoes(true);
  const editarGrupo = useEditarGrupoAntecipacaoMemoria();
  const [descricao, setDescricao] = useState("");
  const [tributacao, setTributacao] = useState("");
  const [error, setError] = useState("");

  const tributacaoOptions = (tributacoes ?? []).map((t) => ({ value: t.codigo, label: t.nome }));

  useEffect(() => {
    if (open && grupo) {
      setDescricao(grupo.descricao);
      setTributacao(grupo.tributacao);
      setError("");
    }
  }, [open, grupo]);

  async function salvar() {
    if (!grupo) return;
    setError("");
    try {
      await editarGrupo.mutateAsync({ itemIds: grupo.item_ids, descricao, tributacao });
      onOpenChange(false);
      onSalvo();
    } catch (err) {
      setError(apiError(err, "Não foi possível salvar."));
    }
  }

  if (!grupo) return null;
  const n = grupo.company_ids.length;
  const alvo = n === 1 ? "1 empresa" : `${n} empresas`;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Editar item"
      description={`Aplica-se a: 🏢 ${alvo}. NCM ${grupo.ncm} não muda.`}
      actions={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={editarGrupo.isPending} onClick={salvar}>
            {editarGrupo.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </>
      }
    >
      <div className="stack gap-16">
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="field">
          <Label htmlFor="eg-descricao">Descrição</Label>
          <Input id="eg-descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <Label>Tributação</Label>
          <Select aria-label="Tributação" value={tributacao} onValueChange={setTributacao} options={tributacaoOptions} />
        </div>
      </div>
    </Modal>
  );
}
