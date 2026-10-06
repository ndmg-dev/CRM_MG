import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ClienteSelect } from "@ponto/components/dominio/ClienteSelect";
import { DominioIntegrationCard } from "@ponto/components/dominio/DominioIntegrationCard";
import { DominioRubricMapping } from "@ponto/components/dominio/DominioRubricMapping";

export function DominioSettingsPage() {
  const [clienteId, setClienteId] = useState("");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link to=".." className="flex items-center gap-2 text-secondary hover:underline mb-2">
          <ArrowLeft size={20} /> Voltar
        </Link>
        <h2 className="text-3xl font-bold text-textPrimary">Integração Domínio</h2>
        <p className="text-textSecondary">
          Configure, por empresa-cliente, a chave de integração do Onvio e o de-para de rubricas.
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border p-4">
        <ClienteSelect value={clienteId} onChange={setClienteId} />
      </div>

      {clienteId ? (
        <>
          <DominioIntegrationCard clienteId={clienteId} />
          <DominioRubricMapping clienteId={clienteId} />
        </>
      ) : (
        <div className="bg-card rounded-xl border border-border p-6 text-center text-textSecondary">
          Selecione uma empresa-cliente para configurar a integração.
        </div>
      )}
    </div>
  );
}
