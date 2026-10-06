import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, KeyRound, Loader2, XCircle } from "lucide-react";
import { DominioApiError, dominioIntegrationApi } from "@ponto/lib/dominioApi";

type Props = { clienteId: string };

export function DominioIntegrationCard({ clienteId }: Props) {
  const queryClient = useQueryClient();
  const [activationKey, setActivationKey] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const { data: integration, isLoading } = useQuery({
    queryKey: ["dominio", "integracao", clienteId],
    queryFn: () => dominioIntegrationApi.get(clienteId),
    retry: false,
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["dominio", "integracao", clienteId] });

  const validar = useMutation({
    mutationFn: () => dominioIntegrationApi.validateActivationKey(clienteId, activationKey),
    onSuccess: () => {
      setErro(null);
      invalidar();
    },
    onError: (e) => setErro(e instanceof DominioApiError ? e.message : "Erro ao validar a chave."),
  });

  const ativar = useMutation({
    mutationFn: () => dominioIntegrationApi.enable(clienteId),
    onSuccess: () => {
      setErro(null);
      invalidar();
    },
    onError: (e) => setErro(e instanceof DominioApiError ? e.message : "Erro ao ativar a integração."),
  });

  const formatoHoras = useMutation({
    mutationFn: (hoursFormat: string) => dominioIntegrationApi.setHoursFormat(clienteId, hoursFormat),
    onSuccess: invalidar,
  });

  if (isLoading) {
    return <div className="bg-card rounded-xl border border-border p-6 text-textSecondary">Carregando integração...</div>;
  }

  const ativa = integration?.enabled;

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-textPrimary">Integração com o Domínio</h3>
        {ativa ? (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 text-success text-xs font-bold">
            <CheckCircle2 size={14} /> Ativo
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-hover text-textSecondary text-xs font-bold">
            <XCircle size={14} /> Não configurado
          </span>
        )}
      </div>

      {integration?.accountingOfficeName && (
        <div className="text-sm text-textSecondary space-y-1">
          <p><span className="font-semibold text-textPrimary">Escritório:</span> {integration.accountingOfficeName}</p>
          <p><span className="font-semibold text-textPrimary">Cliente:</span> {integration.clientName}</p>
          <p><span className="font-semibold text-textPrimary">CNPJ:</span> {integration.clientDocument}</p>
        </div>
      )}

      {erro && <div className="text-sm text-error bg-error/10 border border-error/30 rounded-lg px-3 py-2">{erro}</div>}

      {!ativa && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-textSecondary uppercase mb-1.5">
              Chave fornecida pelo escritório
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                className="flex-1 h-10 rounded-lg border border-border bg-surface px-3 text-sm text-textPrimary focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                value={activationKey}
                onChange={(e) => setActivationKey(e.target.value)}
                placeholder="••••••••••••••••••••••••••••••••"
              />
              <button
                onClick={() => validar.mutate()}
                disabled={!activationKey || validar.isPending}
                className="flex items-center gap-2 px-4 rounded-lg bg-secondary text-black font-bold text-sm hover:bg-secondaryHover disabled:opacity-50"
              >
                {validar.isPending ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                Validar chave
              </button>
            </div>
          </div>

          {integration?.accountingOfficeName && (
            <button
              onClick={() => ativar.mutate()}
              disabled={ativar.isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-background font-bold text-sm disabled:opacity-50"
            >
              {ativar.isPending && <Loader2 size={16} className="animate-spin" />}
              Ativar integração
            </button>
          )}
        </div>
      )}

      {ativa && (
        <div>
          <label className="block text-xs font-bold text-textSecondary uppercase mb-1.5">Formato de horas</label>
          <div className="flex gap-4 text-sm text-textPrimary">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="hours_format"
                checked={integration?.hoursFormat === "HOURS_MINUTES"}
                onChange={() => formatoHoras.mutate("HOURS_MINUTES")}
              />
              Horas Minutos
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="hours_format"
                checked={integration?.hoursFormat === "DECIMAL_HOURS"}
                onChange={() => formatoHoras.mutate("DECIMAL_HOURS")}
              />
              Horas Decimais
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
