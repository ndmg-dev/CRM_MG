import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { supabase } from "../lib/supabase";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  X,
  PlaneTakeoff,
  Flag,
} from "lucide-react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "../contexts/AuthContext";
import { canViewCollaborator } from "../lib/permissions";

export default function Calendario() {
  const { usuarioLogado } = useAuth();
  const [mesAtual, setMesAtual] = useState(new Date());
  const [eventos, setEventos] = useState([]);
  const [feriados, setFeriados] = useState([]);

  // ESTADO DO MODAL
  const [diaSelecionado, setDiaSelecionado] = useState(null);

  // 🛡️ ESCUDO CONTRA DATAS QUEBRADAS
  const parseDataSegura = (data) => {
    if (!data) return null;
    try {
      return typeof data === "string" ? parseISO(data) : new Date(data);
    } catch (err) {
      console.warn("Data inválida ignorada.", err);
      return null;
    }
  };

  const formatarDataSegura = (data, formato = "dd/MM/yyyy") => {
    const dataParseada = parseDataSegura(data);
    if (!dataParseada) return "---";
    return format(dataParseada, formato, { locale: ptBR });
  };

  useEffect(() => {
    async function carregarDados() {
      try {
        // 1. Buscar Solicitações Aprovadas
        const { data: sols, error: errSols } = await supabase
          .from("solicitacoes")
          .select("*, colaboradores(colaborador_nome, setor, email)")
          .eq("status", "Aprovada");

        if (errSols) {
          console.error("Erro Sols:", errSols.message);
          toast.error("Não foi possível carregar as férias aprovadas.");
        } else {
          setEventos(
            (sols || []).filter((solicitacao) =>
              canViewCollaborator(usuarioLogado, solicitacao.colaboradores),
            ),
          );
        }

        // 2. Buscar Feriados e Coletivas
        const { data: feri, error: errFeri } = await supabase
          .from("feriados_coletivas")
          .select("*");

        if (errFeri) {
          console.error("Erro Feri:", errFeri.message);
          toast.error("Não foi possível carregar feriados e coletivas.");
        } else {
          setFeriados(feri || []);
        }
      } catch (error) {
        console.error("Erro geral no calendário:", error);
        toast.error("Erro ao carregar o calendário.");
      }
    }

    carregarDados();
  }, [usuarioLogado]);

  // Lógica para gerar os dias do grid
  const primeiroDiaMes = startOfMonth(mesAtual);
  const ultimoDiaMes = endOfMonth(primeiroDiaMes);
  const dataInicio = startOfWeek(primeiroDiaMes, { weekStartsOn: 0 });
  const dataFim = endOfWeek(ultimoDiaMes, { weekStartsOn: 0 });

  const dias = eachDayOfInterval({ start: dataInicio, end: dataFim });

  // Lógica para o Modal (Filtra quem está de férias no dia clicado)
  const eventosNoDiaSelecionado = diaSelecionado
    ? eventos.filter((ev) => {
        const inicio = parseDataSegura(ev.data_inicio);
        const fim = parseDataSegura(ev.data_fim);
        return (
          inicio && fim && diaSelecionado >= inicio && diaSelecionado <= fim
        );
      })
    : [];

  const feriadoNoDiaSelecionado = diaSelecionado
    ? feriados.filter((f) => {
        const fInicio = parseDataSegura(f.data_inicio);
        const fFim = parseDataSegura(f.data_fim);
        return (
          fInicio && fFim && diaSelecionado >= fInicio && diaSelecionado <= fFim
        );
      })
    : [];

  return (
    <div className="p-8 max-w-7xl mx-auto text-white relative">
      {/* Cabeçalho */}
      <header className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-gold/20 p-2 rounded-xl">
            <CalendarIcon className="text-gold" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Calendário de Ausências</h1>
            <p className="text-xs text-gray-500 uppercase font-black tracking-widest">
              Visualização Geral de Férias
            </p>
          </div>
        </div>

        <div className="flex items-center bg-[#0a0a0a] border border-[#262626] rounded-2xl p-1">
          <button
            onClick={() => setMesAtual(subMonths(mesAtual, 1))}
            className="p-2 hover:bg-[#1a1a1a] rounded-xl transition-colors text-gray-400"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="px-6 font-bold text-sm uppercase min-w-[150px] text-center">
            {format(mesAtual, "MMMM yyyy", { locale: ptBR })}
          </span>
          <button
            onClick={() => setMesAtual(addMonths(mesAtual, 1))}
            className="p-2 hover:bg-[#1a1a1a] rounded-xl transition-colors text-gray-400"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      {/* Grid do Calendário */}
      <div className="bg-[#0a0a0a] border border-[#262626] rounded-3xl overflow-hidden shadow-2xl">
        {/* Dias da Semana */}
        <div className="grid grid-cols-7 border-b border-[#262626] bg-[#141414]">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((dia) => (
            <div
              key={dia}
              className="p-4 text-center text-[10px] font-black uppercase text-gray-500 tracking-tighter"
            >
              {dia}
            </div>
          ))}
        </div>

        {/* Dias do Mês */}
        <div className="grid grid-cols-7">
          {dias.map((dia, i) => {
            const eventosNoDia = eventos.filter((ev) => {
              const inicio = parseDataSegura(ev.data_inicio);
              const fim = parseDataSegura(ev.data_fim);
              return inicio && fim && dia >= inicio && dia <= fim;
            });

            const feriadoNoDia = feriados.find((f) => {
              const fInicio = parseDataSegura(f.data_inicio);
              const fFim = parseDataSegura(f.data_fim);
              return fInicio && fFim && dia >= fInicio && dia <= fFim;
            });

            // Se tem evento ou feriado, deixa o cursor como pointer
            const temAlgoNoDia = eventosNoDia.length > 0 || feriadoNoDia;

            return (
              <div
                key={i}
                onClick={() => setDiaSelecionado(dia)}
                className={`min-h-[120px] p-2 border-b border-r border-[#262626] transition-colors ${
                  temAlgoNoDia ? "cursor-pointer" : ""
                } ${
                  !isSameMonth(dia, mesAtual)
                    ? "bg-[#0a0a0a]/50 opacity-30"
                    : "hover:bg-[#141414]"
                }`}
              >
                <span
                  className={`text-xs font-bold ${isSameDay(dia, new Date()) ? "bg-gold text-black w-6 h-6 flex items-center justify-center rounded-full" : "text-gray-500"}`}
                >
                  {format(dia, "d")}
                </span>

                <div className="mt-2 space-y-1">
                  {/* Feriados */}
                  {feriadoNoDia && (
                    <div className="bg-red-500/10 border border-red-500/20 p-1 rounded text-[9px] text-red-500 font-bold truncate">
                      🚩 {feriadoNoDia.titulo}
                    </div>
                  )}

                  {/* Férias */}
                  {eventosNoDia.map((ev, idx) => (
                    <div
                      key={idx}
                      className="bg-gold/10 border border-gold/20 p-1 rounded text-[9px] text-gold font-medium truncate"
                    >
                      ✈️ {ev.colaboradores?.colaborador_nome?.split(" ")[0]}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legenda */}
      <footer className="mt-6 flex gap-6 text-[10px] font-bold uppercase text-gray-500 tracking-widest justify-center">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-gold/20 border border-gold/40"></div>
          Férias Aprovadas
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/40"></div>
          Feriados / Coletivas
        </div>
      </footer>

      {/* ========================================== */}
      {/* MODAL DE DETALHES DO DIA */}
      {/* ========================================== */}
      {/* ========================================== */}
      {/* NOVO MODAL DE DETALHES DO DIA (DESIGN PREMIUM) */}
      {/* ========================================== */}
      {diaSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="bg-[#141414] rounded-3xl w-full max-w-md p-8 relative shadow-2xl border border-[#262626]">
            {/* Botão X no canto superior */}
            <button
              onClick={() => setDiaSelecionado(null)}
              className="absolute right-5 top-5 text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>

            {/* Cabeçalho Centralizado */}
            <div className="flex flex-col items-center mt-2 mb-6">
              <CalendarIcon
                className="text-gold mb-4"
                size={44}
                strokeWidth={1.5}
              />
              <h2 className="text-2xl font-bold text-white mb-2 tracking-wide">
                Detalhes do Dia
              </h2>
              <p className="text-[11px] text-gray-400 uppercase font-black tracking-widest text-center">
                {format(diaSelecionado, "EEEE, dd 'de' MMMM 'de' yyyy", {
                  locale: ptBR,
                })}
              </p>
            </div>

            <hr className="border-[#262626] mb-6" />

            {/* Conteúdo rolável */}
            <div className="space-y-6 max-h-[50vh] overflow-y-auto custom-scrollbar">
              {eventosNoDiaSelecionado.length === 0 &&
                feriadoNoDiaSelecionado.length === 0 && (
                  <p className="text-center text-gray-500 font-bold uppercase text-xs py-4">
                    Nenhum registro para este dia.
                  </p>
                )}

              {/* Feriados */}
              {feriadoNoDiaSelecionado.map((f, idx) => (
                <div key={`f-${idx}`} className="flex items-start gap-4">
                  {/* Fundo arredondado do ícone */}
                  <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/10">
                    <Flag
                      className="text-red-500"
                      size={26}
                      strokeWidth={1.5}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[17px] font-bold text-white mb-1">
                      {f.titulo}
                    </h3>
                    <div className="flex justify-between items-start">
                      <p className="text-[13px] text-gray-400 uppercase tracking-wide">
                        Feriado / Recesso
                      </p>
                      <p className="text-[13px] text-gray-400 whitespace-nowrap">
                        {formatarDataSegura(f.data_inicio)} —{" "}
                        {formatarDataSegura(f.data_fim)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Férias */}
              {eventosNoDiaSelecionado.map((ev, idx) => (
                <div key={`ev-${idx}`} className="flex items-start gap-4">
                  {/* Fundo arredondado do ícone (Marrom/Laranja) */}
                  <div className="w-14 h-14 rounded-2xl bg-[#362015] flex items-center justify-center shrink-0 border border-gold-hover/30">
                    <PlaneTakeoff
                      className="text-gold"
                      size={26}
                      strokeWidth={1.5}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[17px] font-bold text-white mb-1 capitalize">
                      {ev.colaboradores?.colaborador_nome?.toLowerCase() ||
                        "Desconhecido"}
                    </h3>
                    <div className="flex justify-between items-start">
                      <p className="text-[13px] text-gray-400 capitalize w-28 leading-relaxed">
                        {ev.colaboradores?.setor?.toLowerCase() || "Sem setor"}
                      </p>
                      <p className="text-[13px] text-gray-400 whitespace-nowrap mt-0.5">
                        {formatarDataSegura(ev.data_inicio)} —{" "}
                        {formatarDataSegura(ev.data_fim)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <hr className="border-[#262626] mt-6 mb-6" />

            {/* Botão Fechar (Laranja Sólido) */}
            <button
              onClick={() => setDiaSelecionado(null)}
              className="w-full bg-[#d4a843] hover:bg-[#c9952b] text-white py-4 rounded-xl font-bold uppercase tracking-widest transition-colors text-[13px]"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
