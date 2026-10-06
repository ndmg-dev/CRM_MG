import { useQuery } from "@tanstack/react-query";
import { clientesApi } from "@ponto/lib/dominioApi";

type ClienteSelectProps = {
  value: string;
  onChange: (clienteId: string) => void;
};

export function ClienteSelect({ value, onChange }: ClienteSelectProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["dominio", "clientes"],
    queryFn: () => clientesApi.list(),
  });

  return (
    <div>
      <label className="block text-xs font-bold text-textSecondary uppercase mb-1.5">Empresa-cliente</label>
      <select
        className="w-full h-10 rounded-lg border border-border bg-surface px-3 text-sm text-textPrimary focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold disabled:opacity-50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading}
      >
        <option value="">{isLoading ? "Carregando..." : "Selecione a empresa..."}</option>
        {data?.content.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nomeFantasia || c.razaoSocial} — {c.cnpj}
          </option>
        ))}
      </select>
    </div>
  );
}
