import { Fragment, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Pencil } from "lucide-react";
import type { DominioExport } from "@ponto/lib/dominioApi";
import { dominioEmployeeApi } from "@ponto/lib/dominioApi";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pronto",
  SENDING: "Enviando...",
  SUCCESS: "Enviado",
  FAILED: "Com pendência",
};

function badgeClasse(status: string) {
  switch (status) {
    case "SUCCESS":
      return "bg-success/10 text-success";
    case "FAILED":
      return "bg-error/10 text-error";
    case "SENDING":
      return "bg-info/10 text-info";
    default:
      return "bg-warning/10 text-warning";
  }
}

type Props = {
  clienteId: string;
  exportData: DominioExport;
  onRefreshPreview: () => void;
};

export function DominioExportPreview({ clienteId, exportData, onRefreshPreview }: Props) {
  const [editando, setEditando] = useState<string | null>(null);

  const prontos = exportData.items.filter((i) => i.status === "PENDING" || i.status === "SUCCESS").length;
  const comPendencia = exportData.items.filter((i) => i.status === "FAILED").length;

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="text-textSecondary">Colaboradores/eventos: <b className="text-textPrimary">{exportData.totalItems}</b></span>
        <span className="text-success">Prontos: <b>{prontos}</b></span>
        <span className="text-warning">Com pendências: <b>{comPendencia}</b></span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-textSecondary uppercase bg-surface border-b border-border">
            <tr>
              <th className="px-3 py-2">Colaborador</th>
              <th className="px-3 py-2">Evento</th>
              <th className="px-3 py-2">Valor</th>
              <th className="px-3 py-2">Rubrica</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {exportData.items.map((item) => (
              <Fragment key={item.id}>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 text-textPrimary">{item.employeeId}</td>
                  <td className="px-3 py-2 text-textSecondary">{item.internalEventType}</td>
                  <td className="px-3 py-2 font-mono text-textPrimary">{item.reference}</td>
                  <td className="px-3 py-2 font-mono text-textSecondary">{item.payslipItemCode || "-"}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-md ${badgeClasse(item.status)}`}>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                    {item.errorMessage && <p className="text-xs text-textMuted mt-1">{item.errorMessage}</p>}
                  </td>
                  <td className="px-3 py-2">
                    {item.errorCode === "DADOS_COLABORADOR_INCOMPLETOS" && (
                      <button
                        onClick={() => setEditando(editando === item.id ? null : item.id)}
                        className="flex items-center gap-1 text-xs text-secondary hover:underline"
                      >
                        <Pencil size={12} /> Completar cadastro
                      </button>
                    )}
                  </td>
                </tr>
                {editando === item.id && (
                  <tr className="border-b border-border bg-surface">
                    <td colSpan={6} className="px-3 py-3">
                      <EmployeeProfileQuickForm
                        clienteId={clienteId}
                        employeeId={item.employeeId}
                        onSaved={() => {
                          setEditando(null);
                          onRefreshPreview();
                        }}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmployeeProfileQuickForm({
  clienteId,
  employeeId,
  onSaved,
}: {
  clienteId: string;
  employeeId: string;
  onSaved: () => void;
}) {
  const [cpf, setCpf] = useState("");
  const [esocial, setEsocial] = useState("");
  const [admissao, setAdmissao] = useState("");
  const queryClient = useQueryClient();

  const salvar = useMutation({
    mutationFn: () =>
      dominioEmployeeApi.upsert(clienteId, {
        employeeId,
        cpf: cpf || undefined,
        esocialCategoryCode: esocial ? Number(esocial) : undefined,
        admissionDate: admissao || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dominio"] });
      onSaved();
    },
  });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs font-bold text-textSecondary uppercase mb-1">CPF</label>
        <input
          className="h-9 w-40 rounded-lg border border-border bg-background px-2 text-sm text-textPrimary"
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          placeholder="Somente números"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-textSecondary uppercase mb-1">Categoria eSocial</label>
        <input
          type="number"
          className="h-9 w-28 rounded-lg border border-border bg-background px-2 text-sm text-textPrimary"
          value={esocial}
          onChange={(e) => setEsocial(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-textSecondary uppercase mb-1">Admissão</label>
        <input
          type="date"
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-textPrimary"
          value={admissao}
          onChange={(e) => setAdmissao(e.target.value)}
        />
      </div>
      <button
        onClick={() => salvar.mutate()}
        disabled={salvar.isPending}
        className="flex items-center gap-2 h-9 px-3 rounded-lg bg-secondary text-black font-bold text-xs disabled:opacity-50"
      >
        {salvar.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
        Salvar e revalidar
      </button>
    </div>
  );
}
