import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@suporte/components/ui/alert-dialog";
import { Textarea } from "@suporte/components/ui/textarea";
import { Label } from "@suporte/components/ui/label";

interface ReopenReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isPending?: boolean;
}

export function ReopenReasonDialog({ open, onOpenChange, onConfirm, isPending }: ReopenReasonDialogProps) {
  const [reason, setReason] = useState("");

  return (
    <AlertDialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setReason(""); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reabrir chamado</AlertDialogTitle>
          <AlertDialogDescription>
            Este chamado já estava concluído/cancelado. Registre o motivo da reabertura pra manter o histórico rastreável.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-3">
          <Label htmlFor="reopen-reason" className="text-xs text-muted-foreground mb-1 block">Motivo obrigatório</Label>
          <Textarea
            id="reopen-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: solicitante reportou que o problema voltou"
            rows={3}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setReason("")}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!reason.trim() || isPending}
            onClick={() => onConfirm(reason.trim())}
          >
            {isPending ? "Reabrindo..." : "Reabrir chamado"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
