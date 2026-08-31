import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { supabase } from "../lib/supabase";
import {
  Settings,
  Edit2,
  Trash2,
  PlusCircle,
  X,
  ChevronDown,
  ChevronUp,
  Shield,
  Calendar,
  CalendarX,
  Save,
} from "lucide-react";

export default function Configuracoes() {
  const [carregando, setCarregando] = useState(true);
  const [salvandoEvento, setSalvandoEvento] = useState(false);

  // --- Estados de Regras ---
  const [regras, setRegras] = useState([]);
  const [setorExpandido, setSetorExpandido] = useState(null);
  const [modalRegraAberto, setModalRegraAberto] = useState(false);
  const [regraEmEdicao, setRegraEmEdicao] = useState(null);

  // --- Estados de Feriados/Coletivas ---
  const [eventos, setEventos] = useState([]);
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("Férias Coletivas");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [descontaSaldo, setDescontaSaldo] = useState(false);

  // --- BUSCA INICIAL ---
  async function buscarDados() {
    setCarregando(true);
    try {
      // Antes nem checava o `error` das duas queries — uma falha (RLS,
      // rede) virava uma tela "sem regras/sem eventos cadastrados" muda,
      // indistinguível de estar tudo vazio de verdade.
      const { data: dRegras, error: errRegras } = await supabase
        .from("regras_setor")
        .select("*")
        .order("setor");
      if (errRegras) throw errRegras;
      setRegras(dRegras || []);

      const { data: dEventos, error: errEventos } = await supabase
        .from("feriados_coletivas")
        .select("*")
        .order("data_inicio", { ascending: false });
      if (errEventos) throw errEventos;
      setEventos(dEventos || []);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast.error("Não foi possível carregar as configurações.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    buscarDados();
  }, []);

  const calcularDias = (inicio, fim) => {
    if (!inicio || !fim) return 0;
    const d1 = new Date(inicio + "T00:00:00");
    const d2 = new Date(fim + "T00:00:00");
    const diff = d2.getTime() - d1.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24)) + 1;
  };

  const cadastrarEvento = async (e) => {
    e.preventDefault();
    if (!titulo || !dataInicio || !dataFim)
      return alert("Preencha todos os campos!");

    setSalvandoEvento(true);
    try {
      const { error: errEv } = await supabase.rpc("registrar_evento_ferias", {
        _titulo: titulo,
        _tipo: tipo,
        _data_inicio: dataInicio,
        _data_fim: dataFim,
        _desconta_saldo: descontaSaldo,
      });
      if (errEv) throw errEv;

      alert("Período registrado com sucesso!");
      setTitulo("");
      setDataInicio("");
      setDataFim("");
      setDescontaSaldo(false);
      setTipo("Férias Coletivas");
      buscarDados();
    } catch (err) {
      alert(err.message);
    } finally {
      setSalvandoEvento(false);
    }
  };

  const deletarEvento = async (ev) => {
    if (!confirm(`Excluir "${ev.titulo}"?`)) return;
    try {
      const { error } = await supabase.rpc("excluir_evento_ferias", {
        _evento_id: String(ev.id),
      });
      if (error) throw error;
      buscarDados();
    } catch (err) {
      alert("Erro ao excluir: " + err.message);
    }
  };

  const salvarRegra = async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from("regras_setor")
      .update({
        limite_ausencia_percentual: regraEmEdicao.limite_ausencia_percentual,
        cobertura_minima: regraEmEdicao.cobertura_minima,
      })
      .eq("id", regraEmEdicao.id);

    if (error) alert("Erro ao salvar: " + error.message);
    else {
      setModalRegraAberto(false);
      buscarDados();
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto text-white">
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-10">
        <div className="bg-gold/10 p-2 rounded-lg">
          <Settings className="text-gold" size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-gray-500 text-sm">
            Regras de negócio e períodos coletivos
          </p>
        </div>
      </div>

      {carregando ? (
        <p className="p-10 text-center text-gray-500 animate-pulse font-mono">
          SINCRONIZANDO...
        </p>
      ) : (
        <>
          {/* SEÇÃO: REGRAS POR SETOR */}
          <div className="mb-12">
            <h2 className="flex items-center gap-2 font-bold mb-4">
              <Shield size={18} className="text-gold" /> Regras por Setor
            </h2>
            <div className="space-y-2">
              {regras.map((r) => (
                <div
                  key={r.id}
                  className="border border-[#262626] rounded-xl bg-[#0a0a0a] overflow-hidden"
                >
                  <div
                    className="p-4 flex justify-between items-center cursor-pointer hover:bg-[#141414]"
                    onClick={() =>
                      setSetorExpandido(setorExpandido === r.id ? null : r.id)
                    }
                  >
                    <span className="font-medium text-sm">{r.setor}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-gray-500">
                        Limite: {r.limite_ausencia_percentual}%
                      </span>
                      {setorExpandido === r.id ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </div>
                  </div>
                  {setorExpandido === r.id && (
                    <div className="p-5 border-t border-[#262626] bg-[#141414] flex justify-between items-center">
                      <p className="text-xs text-gray-400">
                        Cobertura:{" "}
                        <span className="text-gold font-bold">
                          {r.cobertura_minima} pessoas
                        </span>
                      </p>
                      <button
                        onClick={() => {
                          setRegraEmEdicao(r);
                          setModalRegraAberto(true);
                        }}
                        className="text-gold text-xs font-bold hover:underline flex items-center gap-1"
                      >
                        <Edit2 size={12} /> EDITAR
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* SEÇÃO: FÉRIAS COLETIVAS E FERIADOS (DESIGN RESTAURADO) */}
          <div className="mb-12">
            <h2 className="flex items-center gap-2 font-bold mb-4">
              <Calendar size={18} className="text-gold" /> Férias
              Coletivas e Feriados
            </h2>

            <div className="bg-[#0a0a0a] border border-[#262626] p-6 rounded-2xl mb-6 shadow-xl relative group">
              <form onSubmit={cadastrarEvento}>
                {/* Linha Superior: Inputs principais */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mb-6">
                  <div className="md:col-span-5">
                    <label className="text-[10px] text-gray-500 font-black uppercase mb-1.5 block tracking-widest">
                      Título / Motivo
                    </label>
                    <input
                      type="text"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder="Ex: Natal e Ano Novo"
                      className="w-full bg-[#141414] border border-[#333] rounded-xl p-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-[10px] text-gray-500 font-black uppercase mb-1.5 block tracking-widest">
                      Tipo
                    </label>
                    <select
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value)}
                      className="w-full bg-[#141414] border border-[#333] rounded-xl p-3 text-sm outline-none cursor-pointer [color-scheme:dark]"
                    >
                      <option value="Férias Coletivas">Férias Coletivas</option>
                      <option value="Feriado">Feriado</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] text-gray-500 font-black uppercase mb-1.5 block tracking-widest">
                      Início
                    </label>
                    <input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="w-full bg-[#141414] border border-[#333] rounded-xl p-3 text-sm [color-scheme:dark] outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] text-gray-500 font-black uppercase mb-1.5 block tracking-widest">
                      Fim
                    </label>
                    <input
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="w-full bg-[#141414] border border-[#333] rounded-xl p-3 text-sm [color-scheme:dark] outline-none"
                    />
                  </div>
                </div>

                {/* Linha Inferior: Checkbox e Botão */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-5 border-t border-[#262626]">
                  <label className="flex items-center gap-3.5 cursor-pointer group px-4 py-3 bg-[#141414] rounded-xl border border-[#333] hover:border-gold/30 transition-all max-w-sm">
                    <input
                      type="checkbox"
                      checked={descontaSaldo}
                      onChange={(e) => setDescontaSaldo(e.target.checked)}
                      className="w-5 h-5 accent-gold cursor-pointer"
                    />
                    <div>
                      <p className="text-xs text-white font-bold">
                        Descontar do saldo de todos?
                      </p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-tighter">
                        Abate automático no Direito a Férias
                      </p>
                    </div>
                  </label>

                  <button
                    type="submit"
                    disabled={salvandoEvento}
                    className="w-full md:w-auto bg-gold hover:bg-gold-hover p-4 px-10 rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-30 shadow-lg shadow-gold-hover/20 flex items-center justify-center gap-2"
                  >
                    <Save size={18} />{" "}
                    {salvandoEvento ? "PROCESSANDO..." : "ADICIONAR PERÍODO"}
                  </button>
                </div>
              </form>
            </div>

            {/* LISTA DE PERÍODOS CADASTRADOS */}
            <div className="bg-[#0a0a0a] border border-[#262626] rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-4 bg-[#141414] border-b border-[#262626] text-[10px] text-gray-500 font-black uppercase tracking-widest">
                Eventos Ativos no Calendário
              </div>
              <div className="divide-y divide-[#262626]">
                {eventos.length === 0 ? (
                  <p className="p-10 text-center text-gray-600 text-sm">
                    Nenhum período cadastrado.
                  </p>
                ) : (
                  eventos.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-5 flex justify-between items-center hover:bg-[#141414] group transition-all"
                    >
                      <div>
                        <p className="font-bold text-white uppercase text-sm tracking-tight">
                          {ev.titulo}
                        </p>
                        <p className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                          <Calendar size={12} />{" "}
                          {ev.data_inicio.split("-").reverse().join("/")} —{" "}
                          {ev.data_fim.split("-").reverse().join("/")}
                          <span className="text-gold font-bold ml-1">
                            • {calcularDias(ev.data_inicio, ev.data_fim)} DIAS
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        {ev.desconta_saldo && (
                          <span className="text-[9px] bg-red-500/10 text-red-500 border border-red-500/30 px-2 py-1 rounded font-black uppercase tracking-tighter">
                            Abate Saldo
                          </span>
                        )}
                        <span
                          className={`px-2 py-1 rounded text-[9px] uppercase font-bold border ${ev.tipo === "Feriado" ? "border-blue-900 text-blue-500 bg-blue-900/10" : "border-purple-900 text-purple-400 bg-purple-900/10"}`}
                        >
                          {ev.tipo}
                        </span>
                        <button
                          onClick={() => deletarEvento(ev)}
                          className="text-gray-600 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 p-1"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* MODAL REGRAS */}
      {modalRegraAberto && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
          <div className="bg-[#0a0a0a] border border-[#262626] p-8 rounded-3xl w-full max-w-sm relative">
            <button
              onClick={() => setModalRegraAberto(false)}
              className="absolute right-6 top-6 text-gray-500"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold mb-8 uppercase tracking-widest text-center">
              Regras: {regraEmEdicao.setor}
            </h2>
            <form onSubmit={salvarRegra} className="space-y-6">
              <div>
                <label className="text-[10px] text-gray-500 font-black uppercase mb-2 block tracking-widest">
                  Limite Ausência (%)
                </label>
                <input
                  type="number"
                  value={regraEmEdicao.limite_ausencia_percentual}
                  onChange={(e) =>
                    setRegraEmEdicao({
                      ...regraEmEdicao,
                      limite_ausencia_percentual: e.target.value,
                    })
                  }
                  className="w-full bg-[#1a1a1a] border border-[#333] p-4 rounded-xl text-gold text-2xl font-black outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-gold hover:bg-gold-hover py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg"
              >
                SALVAR
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
