import { useEffect, useState } from "react";
import { Button, Modal } from "@fronteira-ui";
import { EmpresaPicker } from "../EmpresaPicker";

/** "Zerar memória", "Exportar" e "Importar planilha" continuam sendo ações
 * por empresa (o resto da tela não é mais escopada por empresa desde o
 * redesign) — este passo intermediário pede qual empresa antes de seguir
 * para a ação escolhida. */
export function EscolherEmpresaModal({
  open,
  onOpenChange,
  title,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  confirmLabel: string;
  onConfirm: (companyId: number) => void;
}) {
  const [companyId, setCompanyId] = useState<number | null>(null);

  useEffect(() => {
    if (open) setCompanyId(null);
  }, [open]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Essa ação é específica de uma empresa."
      actions={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={!companyId} onClick={() => companyId && onConfirm(companyId)}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <EmpresaPicker value={companyId} onChange={setCompanyId} allowCreate={false} />
    </Modal>
  );
}
