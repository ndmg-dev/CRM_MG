import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Clock, Check, X, AlertCircle } from "lucide-react";

export default function Pendencias() {
  const [pendentes, setPendentes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // 1. Função de busca (usando a sintaxe que resolveu seu erro anterior)
  async function buscarPendencias() {
    try {
      setCarregando(true);
      const { data, error } = await supabase
        .from("solicitacoes")
        .select("*")
        .eq("status", "Pendente")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPendentes(data || []);
    } catch (error) {
      console.error("Erro ao carregar pendências:", error.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    buscarPendencias();
  }, []);

  // 2. Função para Atualizar Status (Aprovar/Recusar)
  async function atualizarStatus(id, novoStatus) {
    try {
      // 1. Tenta atualizar no Banco de Dados
      const { error } = await supabase
        .from("solicitacoes")
        .update({ status: novoStatus }) // Aqui ele muda de 'pendente' para 'aprovado' ou 'recusado'
        .eq("id", id);

      if (error) throw error;

      // 2. Se deu certo no banco, remove da tela (estado local)
      setPendentes((prev) => prev.filter((p) => p.id !== id));

      console.log(`Sucesso: Status alterado para ${novoStatus}`);
    } catch (error) {
      console.error("Erro crítico ao salvar no Supabase:", error.message);
      alert(
        "O banco de dados recusou a alteração. Verifique o RLS no Supabase.",
      );
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-yellow-500/10 p-2 rounded-lg">
          <Clock className="text-yellow-500" size={24} />
        </div>
        <div>
          <h1 className="text-2xl text-white font-bold">
            Solicitações Pendentes
          </h1>
          <p className="text-gray-500 text-sm">
            Análise e aprovação de pedidos de férias
          </p>
        </div>
      </div>

      {carregando ? (
        <div className="text-gray-500 font-mono text-sm">
          CARREGANDO SISTEMA...
        </div>
      ) : pendentes.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-[#262626] p-10 rounded-xl text-center">
          <AlertCircle className="mx-auto text-gray-600 mb-4" size={40} />
          <p className="text-gray-400">
            Não há solicitações aguardando revisão.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {pendentes.map((item) => (
            <div
              key={item.id}
              className="bg-[#0a0a0a] border border-[#262626] p-5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#333] transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gold/10 text-gold flex items-center justify-center font-bold text-lg border border-gold/20">
                  {item.colaborador_nome?.charAt(0)}
                </div>
                <div>
                  <h3 className="text-white font-semibold">
                    {item.colaborador_nome}
                  </h3>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">
                    {item.setor || "Setor não definido"} •{" "}
                    {new Date(item.data_inicio).toLocaleDateString()} a{" "}
                    {new Date(item.data_fim).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => atualizarStatus(item.id, "Aprovada")}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-green-600/10 hover:bg-green-600 text-green-500 hover:text-white px-4 py-2 rounded-lg border border-green-600/20 transition-all text-sm font-bold"
                >
                  <Check size={18} /> APROVAR
                </button>
                <button
                  onClick={() => atualizarStatus(item.id, "Reprovada")}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white px-4 py-2 rounded-lg border border-red-600/20 transition-all text-sm font-bold"
                >
                  <X size={18} /> RECUSAR
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
