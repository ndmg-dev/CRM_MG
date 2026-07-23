import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  X,
  Calendar,
  User,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from "lucide-react";

export default function NovaSolicitacaoModal({ isOpen, onClose }) {
  const [colaboradores, setColaboradores] = useState([]);
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [salvando, setSalvando] = useState(false);

  // --- BUSCA INICIAL (Agora traz os saldos junto) ---
  useEffect(() => {
    async function buscarColaboradores() {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("colaborador_nome, setor, dias_gozados, dias_direito") // Trazemos as colunas de saldo aqui
        .eq("status", "ativo")
        .order("colaborador_nome");

      if (!error && data) setColaboradores(data);
    }

    if (isOpen) {
      buscarColaboradores();
    }
  }, [isOpen]);

  // --- CÁLCULO DINÂMICO DE DIAS ---
  let totalDiasCalculado = 0;
  if (dataInicio && dataFim) {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    const diferenca = fim.getTime() - inicio.getTime();
    totalDiasCalculado = Math.ceil(diferenca / (1000 * 3600 * 24)) + 1;
  }

  // --- LÓGICA DE SALDO (Calculada em tempo real) ---
  const colabInfo = colaboradores.find(
    (c) => c.colaborador_nome === colaboradorSelecionado,
  );
  const diasDireito = colabInfo?.dias_direito ?? 30;
  const diasGozados = colabInfo?.dias_gozados ?? 0;
  const saldoAtual = diasDireito - diasGozados;
  const saldoAposSolicitacao = saldoAtual - totalDiasCalculado;
  const ultrapassouSaldo = totalDiasCalculado > saldoAtual;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!colaboradorSelecionado || !dataInicio || !dataFim)
      return alert("Preencha todos os campos!");
    if (totalDiasCalculado <= 0)
      return alert("A data de retorno deve ser maior que o início!");
    if (ultrapassouSaldo)
      return alert("Erro: O colaborador não possui saldo suficiente!");

    setSalvando(true);
    const { error } = await supabase.from("solicitacoes").insert([
      {
        colaborador_nome: colaboradorSelecionado,
        setor: colabInfo?.setor || "Não informado",
        data_inicio: dataInicio,
        data_fim: dataFim,
        status: "Pendente",
        total_dias: totalDiasCalculado,
      },
    ]);

    setSalvando(false);

    if (error) {
      alert("Erro ao criar: " + error.message);
    } else {
      resetarCampos();
      onClose();
    }
  };

  const resetarCampos = () => {
    setColaboradorSelecionado("");
    setDataInicio("");
    setDataFim("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0a0a0a] border border-[#262626] rounded-2xl w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="p-6 border-b border-[#262626]">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="text-gold" /> Nova Solicitação
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            O sistema validará o saldo automaticamente.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Colaborador */}
          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1">
              COLABORADOR
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-3 text-gray-500" />
              <select
                value={colaboradorSelecionado}
                onChange={(e) => setColaboradorSelecionado(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-2.5 pl-10 text-white text-sm focus:border-gold outline-none appearance-none cursor-pointer"
              >
                <option value="">Selecione um colaborador...</option>
                {colaboradores.map((c, i) => (
                  <option key={i} value={c.colaborador_nome}>
                    {c.colaborador_nome} ({c.setor})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1 uppercase">
                Início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-2.5 text-white text-sm focus:border-gold outline-none [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1 uppercase">
                Retorno
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-2.5 text-white text-sm focus:border-gold outline-none [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Feedback de Saldo e Trava */}
          {colaboradorSelecionado && (
            <div className="pt-2 space-y-3">
              {/* Painel de Números */}
              <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase tracking-wider">
                <div className="bg-[#141414] p-3 rounded-lg border border-[#262626]">
                  <p className="text-gray-500 mb-1">Saldo Atual</p>
                  <p className="text-white text-base">{saldoAtual} dias</p>
                </div>
                <div
                  className={`p-3 rounded-lg border ${saldoAposSolicitacao < 0 ? "bg-red-500/10 border-red-500/20" : "bg-[#141414] border-[#262626]"}`}
                >
                  <p className="text-gray-500 mb-1">Restante</p>
                  <p
                    className={`text-base ${saldoAposSolicitacao < 0 ? "text-red-500" : "text-white"}`}
                  >
                    {saldoAposSolicitacao} dias
                  </p>
                </div>
              </div>

              {/* Alertas Dinâmicos */}
              {totalDiasCalculado > 0 &&
                (ultrapassouSaldo ? (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-red-500 animate-in slide-in-from-top-1">
                    <AlertTriangle size={18} />
                    <span className="text-xs font-bold leading-tight">
                      Atenção: O colaborador não tem saldo suficiente para{" "}
                      {totalDiasCalculado} dias.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 p-3 rounded-xl text-green-500 animate-in slide-in-from-top-1">
                    <CheckCircle2 size={18} />
                    <span className="text-xs font-bold">
                      Solicitação de {totalDiasCalculado} dias permitida.
                    </span>
                  </div>
                ))}

              {/* Botão de Ação com Trava */}
              <button
                type="submit"
                disabled={
                  salvando ||
                  !dataInicio ||
                  !dataFim ||
                  totalDiasCalculado <= 0 ||
                  ultrapassouSaldo
                }
                className={`w-full font-black py-4 rounded-xl transition-all text-sm shadow-lg mt-2 flex justify-center items-center gap-2 ${
                  ultrapassouSaldo
                    ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                    : "bg-gold hover:bg-gold-hover text-white active:scale-95"
                }`}
              >
                {salvando
                  ? "PROCESSANDO..."
                  : ultrapassouSaldo
                    ? "SALDO INSUFICIENTE"
                    : "ENVIAR PARA APROVAÇÃO"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
