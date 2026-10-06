import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { dominioRubricsApi, type RubricMapping } from "@ponto/lib/dominioApi";

const EVENTOS = [
  { value: "OVERTIME_50", label: "Hora extra 50%" },
  { value: "OVERTIME_100", label: "Hora extra 100%" },
  { value: "FULL_ABSENCE", label: "Falta integral" },
  { value: "PARTIAL_ABSENCE", label: "Falta parcial" },
  { value: "NIGHT_ADDITIONAL", label: "Adicional noturno" },
  { value: "DSR", label: "DSR" },
  { value: "COMMISSION", label: "Comissão" },
  { value: "OTHER", label: "Outro" },
];

const UNIDADES = [
  { value: "HOURS", label: "Horas" },
  { value: "DAYS", label: "Dias" },
  { value: "VALUE", label: "Valor" },
  { value: "PERCENTAGE", label: "Percentual" },
];

type Props = { clienteId: string };

export function DominioRubricMapping({ clienteId }: Props) {
  const queryClient = useQueryClient();
  const { data: rubricas, isLoading } = useQuery({
    queryKey: ["dominio", "rubricas", clienteId],
    queryFn: () => dominioRubricsApi.list(clienteId),
  });

  const [eventType, setEventType] = useState(EVENTOS[0].value);
  const [payslipCode, setPayslipCode] = useState("");
  const [unit, setUnit] = useState(UNIDADES[0].value);

  const salvar = useMutation({
    mutationFn: () =>
      dominioRubricsApi.upsert(clienteId, {
        internalEventType: eventType,
        payslipItemCode: Number(payslipCode),
        unit: unit as RubricMapping["unit"],
        enabled: true,
      }),
    onSuccess: () => {
      setPayslipCode("");
      queryClient.invalidateQueries({ queryKey: ["dominio", "rubricas", clienteId] });
    },
  });

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <h3 className="text-lg font-bold text-textPrimary">Rubricas (de-para)</h3>
      <p className="text-sm text-textSecondary">
        Os códigos de rubrica variam por empresa no Domínio — configure aqui qual código corresponde a cada evento.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-textSecondary uppercase bg-surface border-b border-border">
            <tr>
              <th className="px-3 py-2">Evento interno</th>
              <th className="px-3 py-2">Rubrica Domínio</th>
              <th className="px-3 py-2">Unidade</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={3} className="px-3 py-4 text-textSecondary">Carregando...</td></tr>
            )}
            {rubricas?.map((r) => (
              <tr key={r.id} className="border-b border-border">
                <td className="px-3 py-2 text-textPrimary">{EVENTOS.find((e) => e.value === r.internalEventType)?.label ?? r.internalEventType}</td>
                <td className="px-3 py-2 font-mono text-textPrimary">{r.payslipItemCode}</td>
                <td className="px-3 py-2 text-textSecondary">{UNIDADES.find((u) => u.value === r.unit)?.label ?? r.unit}</td>
              </tr>
            ))}
            {rubricas?.length === 0 && !isLoading && (
              <tr><td colSpan={3} className="px-3 py-4 text-textSecondary">Nenhuma rubrica configurada ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-border">
        <div>
          <label className="block text-xs font-bold text-textSecondary uppercase mb-1.5">Evento</label>
          <select
            className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-textPrimary"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
          >
            {EVENTOS.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-textSecondary uppercase mb-1.5">Código da rubrica</label>
          <input
            type="number"
            className="h-10 w-32 rounded-lg border border-border bg-surface px-3 text-sm text-textPrimary"
            value={payslipCode}
            onChange={(e) => setPayslipCode(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-textSecondary uppercase mb-1.5">Unidade</label>
          <select
            className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-textPrimary"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            {UNIDADES.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => salvar.mutate()}
          disabled={!payslipCode || salvar.isPending}
          className="flex items-center gap-2 h-10 px-4 rounded-lg bg-secondary text-black font-bold text-sm hover:bg-secondaryHover disabled:opacity-50"
        >
          {salvar.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Salvar
        </button>
      </div>
    </div>
  );
}
