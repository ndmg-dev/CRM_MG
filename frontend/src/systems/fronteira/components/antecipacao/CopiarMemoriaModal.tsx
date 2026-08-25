import { useEffect, useState } from "react";
import { Button, Checkbox, Modal } from "@fronteira-ui";
import { useCopiarAntecipacaoMemoria, useEmpresas } from "../../hooks/queries";
import { apiError } from "../../lib/api";

/** Cria item(ns) novo(s) e INDEPENDENTE(S) a partir de um ou mais itens de
 * origem, em uma ou mais empresas de destino — nunca apaga/altera a origem.
 * Usado tanto pra "⎘ Copiar" de uma linha quanto pra "⎘ Copiar selecionados".
 * Pra replicar a memória inteira de uma empresa pra outra, ver
 * `CopiarEmpresaModal` (ação separada, "Copiar de outra empresa"). */
export function CopiarMemoriaModal({
  open,
  onOpenChange,
  itemIds,
  onCopiado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Itens de origem selecionados — cada um gera 1 cópia por empresa de destino escolhida. */
  itemIds: number[];
  onCopiado: () => void;
}) {
  const copiar = useCopiarAntecipacaoMemoria();
  const { data: empresas } = useEmpresas("", { ativo: true, limit: 500 });
  const [destinoEmpresas, setDestinoEmpresas] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setDestinoEmpresas(new Set());
      setError("");
    }
  }, [open]);

  function toggleEmpresa(id: number) {
    setDestinoEmpresas((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function confirmar() {
    setError("");
    if (destinoEmpresas.size === 0) return;
    try {
      await copiar.mutateAsync({ itemIds, companyIds: [...destinoEmpresas] });
      onOpenChange(false);
      onCopiado();
    } catch (err) {
      setError(apiError(err, "Não foi possível copiar."));
    }
  }

  const multi = itemIds.length > 1;
  const title = multi ? `Copiar ${itemIds.length} itens para` : "Copiar este item para";
  const subtitle = multi
    ? `Cria ${itemIds.length} itens novos e independentes, um por item selecionado — os originais continuam como estão. Depois é só ajustar a tributação onde precisar ser diferente.`
    : "Cria um item novo e independente — o original continua como está. Depois é só ajustar a tributação onde precisar ser diferente.";

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={subtitle}
      actions={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={copiar.isPending || destinoEmpresas.size === 0} onClick={confirmar}>
            {copiar.isPending ? "Copiando…" : "Criar cópia"}
          </Button>
        </>
      }
    >
      <div className="stack gap-12">
        {error && <div className="alert alert-danger">{error}</div>}

        <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>
          Empresas de destino
        </div>
        <div className="stack gap-4" style={{ maxHeight: 280, overflowY: "auto" }}>
          {(empresas ?? []).map((empresa) => (
            <label key={empresa.id} className="row gap-8" style={{ alignItems: "center", cursor: "pointer", fontSize: 13.5 }}>
              <Checkbox checked={destinoEmpresas.has(empresa.id)} onCheckedChange={() => toggleEmpresa(empresa.id)} />
              {empresa.nome}
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}
