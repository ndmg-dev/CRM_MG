import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  Sparkles,
  X,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Search,
  Info,
} from "lucide-react";
import {
  addDays,
  format,
  isWithinInterval,
  parseISO,
  isWeekend,
  eachDayOfInterval,
  startOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ModalSugestao({
  aberto,
  fechar,
  aoSugerir,
  colaborador,
  dataBase,
  diasBase,
}) {
  const [dataInicio, setDataInicio] = useState("");
  const [dias, setDias] = useState(15);
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (aberto) {
      setDataInicio(dataBase || "");
      setDias(diasBase || 15);
      setResultado(null);
    }
  }, [aberto, dataBase, diasBase]);

  const analisarIA = async () => {
    if (!dataInicio || !colaborador)
      return alert("Selecione uma data para análise!");

    setCarregando(true);
    try {
      const hojeStr = format(new Date(), "yyyy-MM-dd");

      const [
        { data: regras },
        { data: feriados },
        { data: ocupacao },
        { data: equipe },
      ] = await Promise.all([
        supabase
          .from("regras_setor")
          .select("*")
          .eq("setor", colaborador.setor)
          .single(),
        supabase.from("feriados_coletivas").select("*"),
        // Buscamos as solicitações do setor
        supabase
          .from("solicitacoes")
          .select("id, data_inicio, data_fim, status")
          .eq("setor", colaborador.setor)
          .in("status", ["Aprovada", "Pendente"])
          .gte("data_fim", hojeStr),
        // Buscamos o total REAL de pessoas no setor
        supabase
          .from("colaboradores")
          .select("id")
          .eq("setor", colaborador.setor),
      ]);

      // CORREÇÃO 1: Garante que o total da equipe nunca seja zero para não dividir por zero
      const totalEquipe = equipe?.length || 1;
      const limitePercentual =
        Number(regras?.limite_ausencia_percentual) || 100;
      const coberturaMinima = Number(regras?.cobertura_minima) || 0;

      const validar = (inicio) => {
        const fim = addDays(inicio, parseInt(dias) - 1);
        const intervaloTeste = {
          start: startOfDay(inicio),
          end: startOfDay(fim),
        };

        if (isWeekend(inicio))
          return "O início não pode ser em fins de semana.";

        const diaInicioMes = inicio.getDate();
        if (
          regras?.dias_criticos_inicio &&
          diaInicioMes >= regras.dias_criticos_inicio &&
          diaInicioMes <= regras.dias_criticos_fim
        ) {
          return `Período crítico (Dia ${regras.dias_criticos_inicio} ao ${regras.dias_criticos_fim}).`;
        }

        const temFeriado = feriados?.some((f) => {
          const fStart = startOfDay(parseISO(f.data_inicio));
          const fEnd = startOfDay(parseISO(f.data_fim));
          return (
            isWithinInterval(startOfDay(inicio), {
              start: fStart,
              end: fEnd,
            }) ||
            isWithinInterval(startOfDay(fim), { start: fStart, end: fEnd })
          );
        });
        if (temFeriado) return "Bloqueio por Feriado ou Coletivas.";

        const diasDoIntervalo = eachDayOfInterval(intervaloTeste);
        let maxAusentesSimultaneos = 0;

        diasDoIntervalo.forEach((dia) => {
          // CORREÇÃO 2: Filtramos a solicitação atual (pelo ID) para não contar o Eduardo duas vezes
          const ausentesNoDia =
            ocupacao?.filter((s) => {
              if (s.id === colaborador.id) return false; // IGNORA O PRÓPRIO EDUARDO DA CONTA

              const sStart = startOfDay(parseISO(s.data_inicio));
              const sEnd = startOfDay(parseISO(s.data_fim));
              return isWithinInterval(dia, { start: sStart, end: sEnd });
            }).length || 0;

          if (ausentesNoDia > maxAusentesSimultaneos)
            maxAusentesSimultaneos = ausentesNoDia;
        });

        // Agora somamos o Eduardo (o +1) à contagem dos OUTROS que já estão fora
        const totalSimulado = maxAusentesSimultaneos + 1;
        const percAtual = (totalSimulado / totalEquipe) * 100;
        const disponiveisRestantes = totalEquipe - totalSimulado;

        if (percAtual > limitePercentual) {
          return `Limite excedido: ${percAtual.toFixed(0)}% do setor estaria ausente (Máx: ${limitePercentual}%).`;
        }
        if (disponiveisRestantes < coberturaMinima) {
          return `Cobertura insuficiente: Restariam ${disponiveisRestantes} pessoas (Mín: ${coberturaMinima}).`;
        }

        return null;
      };

      // Inicia a análise
      const erroEncontrado = validar(parseISO(dataInicio));

      if (!erroEncontrado) {
        setResultado({
          status: "ok",
          mensagem:
            "Tudo certo! Este período respeita as regras de cobertura do setor.",
        });
      } else {
        // Busca automática por uma data próxima
        let sugestaoData = parseISO(dataInicio);
        let encontrouValida = false;
        for (let i = 1; i < 120; i++) {
          sugestaoData = addDays(sugestaoData, 1);
          if (!validar(sugestaoData)) {
            encontrouValida = true;
            break;
          }
        }
        setResultado({
          status: "erro",
          mensagem: erroEncontrado,
          sugestao: encontrouValida ? sugestaoData : null,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0a0a0a] border border-[#262626] rounded-3xl w-full max-w-sm shadow-2xl p-6 relative animate-in zoom-in duration-200">
        <button
          onClick={fechar}
          className="absolute right-5 top-5 text-gray-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-6 text-gold">
          <Sparkles size={24} />
          <h2 className="text-xl font-bold text-white">
            Análise de Viabilidade
          </h2>
        </div>

        <div className="space-y-4">
          <div className="bg-[#141414] p-4 rounded-2xl border border-[#262626]">
            <label className="text-[10px] text-gray-500 font-bold uppercase block mb-2 text-center">
              Data Pretendida
            </label>
            <div className="flex items-center gap-4">
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  setResultado(null);
                }}
                className="bg-transparent text-white font-bold outline-none [color-scheme:dark] flex-1"
              />
              <div className="w-px h-6 bg-[#333]"></div>
              <span className="text-gold font-bold">{dias} dias</span>
            </div>
          </div>

          <button
            onClick={analisarIA}
            disabled={carregando || !dataInicio}
            className="w-full py-4 bg-gold hover:bg-gold-hover text-[#0a0a0a] font-black rounded-2xl transition-all disabled:opacity-30"
          >
            {carregando ? "IA CALCULANDO..." : "ANALISAR AGORA"}
          </button>

          {resultado && (
            <div
              className={`p-5 rounded-2xl border animate-in slide-in-from-bottom-2 duration-300 ${resultado.status === "ok" ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}
            >
              <div className="flex gap-3">
                {resultado.status === "ok" ? (
                  <CheckCircle2 className="text-green-500 shrink-0" size={20} />
                ) : (
                  <AlertTriangle className="text-red-500 shrink-0" size={20} />
                )}
                <div>
                  <p
                    className={`text-sm font-bold ${resultado.status === "ok" ? "text-green-400" : "text-red-400"}`}
                  >
                    {resultado.status === "ok"
                      ? "Período Aprovado!"
                      : "Atenção necessária"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    {resultado.mensagem}
                  </p>
                </div>
              </div>

              {/* BOTÃO 1: CONFIRMAR DATA ATUAL (Se estiver OK) */}
              {resultado.status === "ok" && (
                <button
                  onClick={() => {
                    const fimCalculado = format(
                      addDays(parseISO(dataInicio), parseInt(dias) - 1),
                      "yyyy-MM-dd",
                    );
                    aoSugerir(dataInicio, fimCalculado, dias);
                  }}
                  className="w-full mt-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-green-900/20"
                >
                  CONFIRMAR ESTA DATA
                </button>
              )}

              {/* BOTÃO 2: USAR SUGESTÃO DA IA (Se a original der erro) */}
              {resultado.sugestao && (
                <div className="mt-5 pt-4 border-t border-[#333]">
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-3">
                    Sugestão da IA:
                  </p>
                  <button
                    onClick={() => {
                      const dataSugeridaStr = format(
                        resultado.sugestao,
                        "yyyy-MM-dd",
                      );
                      const fimSugeridoStr = format(
                        addDays(resultado.sugestao, parseInt(dias) - 1),
                        "yyyy-MM-dd",
                      );
                      aoSugerir(dataSugeridaStr, fimSugeridoStr, dias);
                    }}
                    className="w-full py-3 bg-[#1a1a1a] border border-gold/40 text-gold rounded-xl text-xs font-bold hover:bg-gold hover:text-[#0a0a0a] transition-all flex items-center justify-center gap-2"
                  >
                    <Calendar size={14} /> Usar a partir de{" "}
                    {format(resultado.sugestao, "dd 'de' MMMM", {
                      locale: ptBR,
                    })}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
