import {
  Clock,
  CheckCircle2,
  XCircle,
  UserMinus,
  TrendingUp,
  History,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { supabase } from "../lib/supabase";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "../contexts/AuthContext";
import { canViewCollaborator, isStatusEmAberto } from "../lib/permissions";
import { SETORES_COLABORADOR, SIGLAS_SETOR } from "../lib/setores";

export default function Dashboard() {
  const { usuarioLogado } = useAuth();
  const [stats, setStats] = useState({
    pendentes: 0,
    aprovadas: 0,
    rejeitadas: 0,
  });
  const [recentes, setRecentes] = useState([]);
  const [setoresData, setSetoresData] = useState([]);

  // 🛡️ ESCUDO TITÂNIO (SEM ERROS DE VARIÁVEL NÃO USADA)
  const formatarDataSegura = (data) => {
    if (!data) return "---";
    try {
      const dateObj =
        typeof data === "string" ? parseISO(data) : new Date(data);
      return format(dateObj, "dd/MM/yyyy", { locale: ptBR });
    } catch (erroData) {
      console.warn("Erro ao formatar data:", erroData); // <-- Variável usada aqui!
      return "Data Inválida";
    }
  };

  useEffect(() => {
    const carregarDashboard = async () => {
      // 1. BUSCAR SOLICITAÇÕES
      const { data: solicitacoes, error: errSoli } = await supabase
        .from("solicitacoes")
        .select("*, colaboradores(colaborador_nome, setor, email)")
        .order("created_at", { ascending: true });

      if (errSoli) {
        console.error("Erro ao carregar solicitações:", errSoli.message); // <-- Usado
        toast.error("Não foi possível carregar as solicitações do dashboard.");
      } else if (solicitacoes) {
        const solicitacoesVisiveis = solicitacoes.filter((solicitacao) =>
          canViewCollaborator(
            usuarioLogado,
            solicitacao.colaboradores || {
              setor: solicitacao.setor,
              email: solicitacao.email,
            },
          ),
        );
        setStats({
          // "Sugerida" ainda não é uma decisão final (ver isStatusEmAberto) —
          // conta como pendente aqui também, senão o card mostra menos
          // pendências do que a tela de Solicitações de fato tem.
          pendentes: solicitacoesVisiveis.filter(
            (s) => isStatusEmAberto(s.status),
          ).length,
          aprovadas: solicitacoesVisiveis.filter(
            (s) => s.status?.toLowerCase() === "aprovada",
          ).length,
          rejeitadas: solicitacoesVisiveis.filter(
            (s) =>
              s.status?.toLowerCase() === "reprovada" ||
              s.status?.toLowerCase() === "rejeitada",
          ).length,
        });

        const formatados = solicitacoesVisiveis.map((s) => ({
          nome:
            s.colaboradores?.colaborador_nome ||
            s.colaborador_nome ||
            "Desconhecido",
          setor: s.colaboradores?.setor || s.setor || "Não informado",
          data_inicio: s.data_inicio,
          data_fim: s.data_fim,
          status: s.status || "Pendente",
        }));

        setRecentes(formatados.slice(-3).reverse());
      }

      // 2. BUSCAR COLABORADORES
      const { data: colaboradores, error: errColab } = await supabase
        .from("colaboradores")
        .select("setor, status, email, dias_gozados");

      if (errColab) {
        console.warn("Aviso colaboradores:", errColab.message); // <-- Usado
        toast.error("Não foi possível carregar a ocupação por setor.");
      } else if (colaboradores) {
        setSetoresData(
          colaboradores.filter((colaborador) =>
            canViewCollaborator(usuarioLogado, colaborador),
          ),
        );
      }
    };

    carregarDashboard();

    // Atualização em tempo real
    const canal = supabase
      .channel("dashboard-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "solicitacoes" },
        () => carregarDashboard(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [usuarioLogado]);

  const kpis = [
    {
      titulo: "Pendentes",
      valor: stats.pendentes.toString(),
      icone: <Clock size={20} className="text-yellow-500" />,
    },
    {
      titulo: "Aprovadas",
      valor: stats.aprovadas.toString(),
      icone: <CheckCircle2 size={20} className="text-green-500" />,
    },
    {
      titulo: "Rejeitadas",
      valor: stats.rejeitadas.toString(),
      icone: <XCircle size={20} className="text-red-500" />,
    },
    {
      // Antes era um card fixo em "0", nunca calculado de verdade — agora
      // conta quem ainda não tirou nenhum dia de férias no ciclo atual
      // (dias_gozados zerado ou nulo), dentre quem o usuário logado pode ver.
      titulo: "Sem férias",
      valor: setoresData.filter((c) => !c.dias_gozados).length.toString(),
      icone: <UserMinus size={20} className="text-gray-400" />,
    },
  ];

  // "Conflitos" existia como card fixo em "0" — removido: a detecção de
  // conflito de verdade (cruza feriado/coletiva + limite de cobertura do
  // setor) só existe hoje dentro do fluxo de análise de uma solicitação
  // específica (Solicitacoes.jsx/checarConflitos), não é algo que dá pra
  // resumir num card sem duplicar aquela lógica inteira aqui.

  const ocupacaoSetor = SETORES_COLABORADOR.map((nome) => {
    const totalNoSetor = setoresData.filter((c) => c.setor === nome).length;
    const ocupados = setoresData.filter(
      (c) => c.setor === nome && c.status === "ferias",
    ).length;
    return { sigla: SIGLAS_SETOR[nome] || nome, nome, ocupados, total: totalNoSetor };
  });

  const dataHoje = format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", {
    locale: ptBR,
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl text-white font-bold mb-1">
            Central de Operações
          </h1>
          <p className="text-sm text-gray-500 capitalize">
            {usuarioLogado?.nome || usuarioLogado?.perfil || "Usuário"} • {dataHoje}
          </p>
        </div>
        <div className="bg-[#1a1a1a] border border-gray-800 text-gray-400 px-3 py-1 rounded-full text-xs font-mono tracking-wider">
          SYS:ONLINE • v1.0
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi, index) => (
          <div
            key={index}
            className="bg-[#0a0a0a] border border-[#262626] p-5 rounded-xl flex flex-col justify-between h-28"
          >
            <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center mb-2 border border-gray-800">
              {kpi.icone}
            </div>
            <div>
              <p className="text-2xl font-bold text-white leading-none">
                {kpi.valor}
              </p>
              <p className="text-xs text-gray-500 mt-1">{kpi.titulo}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-white font-semibold flex items-center gap-2 text-sm">
              <TrendingUp size={18} className="text-gold" />
              Ocupação por Setor
            </h2>
            <span className="text-xs text-gray-500 font-mono">POR SETOR</span>
          </div>

          <div className="space-y-4">
            {ocupacaoSetor.map((setor) => {
              const porcentagem =
                setor.total === 0
                  ? 0
                  : Math.round((setor.ocupados / setor.total) * 100);
              const txtPorcentagem =
                setor.total === 0 ? "0%" : `${porcentagem}%`;

              return (
                <div key={setor.sigla} className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <span className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        {setor.sigla}
                      </span>
                      <span className="text-gray-300">{setor.nome}</span>
                    </div>
                    <span className="text-gray-500 font-mono">
                      {setor.ocupados}/{setor.total} ({txtPorcentagem})
                    </span>
                  </div>
                  <div className="w-full bg-[#1a1a1a] rounded-full h-1.5 mt-1">
                    <div
                      className="bg-gold h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${porcentagem}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-6">
          <h2 className="text-white font-semibold flex items-center gap-2 text-sm mb-6">
            <History size={18} className="text-gold" />
            Solicitações Recentes
          </h2>

          {recentes.length === 0 ? (
            <p className="text-center text-gray-500 text-xs py-4 uppercase font-bold tracking-widest">
              Nenhuma solicitação sincronizada.
            </p>
          ) : (
            recentes.map((solicitacao, index) => {
              const statusFormatado =
                solicitacao.status.charAt(0).toUpperCase() +
                solicitacao.status.slice(1).toLowerCase();

              let corPill = "border-gray-900 text-gray-500 bg-gray-900/20";
              if (statusFormatado === "Pendente")
                corPill = "border-yellow-900 text-yellow-500 bg-yellow-900/20";
              if (statusFormatado === "Aprovada")
                corPill = "border-green-900 text-green-500 bg-green-900/20";
              if (
                statusFormatado === "Reprovada" ||
                statusFormatado === "Rejeitada"
              )
                corPill = "border-red-900 text-red-500 bg-red-900/20";

              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 hover:bg-[#1a1a1a] rounded-lg transition-colors border border-transparent hover:border-[#333] cursor-pointer mb-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#1a1a1a] border border-[#333] text-gold flex items-center justify-center font-black text-sm shrink-0">
                      {solicitacao.nome?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white text-sm font-bold uppercase">
                        {solicitacao.nome}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5 font-bold tracking-wider uppercase">
                        {solicitacao.setor} •{" "}
                        {formatarDataSegura(solicitacao.data_inicio)} —{" "}
                        {formatarDataSegura(solicitacao.data_fim)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-[9px] font-black uppercase border tracking-widest ${corPill}`}
                  >
                    {statusFormatado}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
