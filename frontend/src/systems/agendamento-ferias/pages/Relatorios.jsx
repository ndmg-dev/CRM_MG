import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  FileText,
  Download,
  Filter,
  Users,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { differenceInMonths, parseISO, format } from "date-fns";

export default function Relatorios() {
  // --- ESTADOS ---
  const [colaboradores, setColaboradores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroSetor, setFiltroSetor] = useState("Todos");

  const listaSetores = [
    "Todos",
    "Contábil",
    "Departamento Pessoal",
    "Financeiro",
    "Fiscal",
    "Recursos Humanos",
    "Tecnologia da Informação",
  ];

  // --- 1. BUSCA DE DADOS (Aqui é onde estava o erro) ---
  async function buscarDados() {
    try {
      setCarregando(true);
      const { data, error } = await supabase
        .from("colaboradores")
        .select("*")
        .order("colaborador_nome");

      if (error) throw error;
      setColaboradores(data || []);
    } catch (error) {
      console.error("Erro ao buscar dados:", error.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    buscarDados();
  }, []);

  // --- 2. LÓGICA DE STATUS ---
  const obterStatus = (adm, gozados, direito = 30) => {
    if (!adm) return { label: "S/ DATA", cor: "text-gray-500" };
    const meses = differenceInMonths(new Date(), parseISO(adm));
    const saldo = direito - (gozados || 0);
    if (meses >= 23 && saldo > 0)
      return { label: "VENCIDA (DOBRA)", cor: "text-red-500" };
    if (meses >= 18 && saldo > 0)
      return { label: "EM ALERTA", cor: "text-yellow-500" };
    return { label: "EM DIA", cor: "text-green-500" };
  };

  const dadosFiltrados = colaboradores.filter(
    (c) => filtroSetor === "Todos" || c.setor === filtroSetor,
  );

  // --- 3. EXPORTAR EXCEL (CSV com Ponto e Vírgula) ---
  const exportarExcel = () => {
    const cabecalho = [
      "Nome",
      "Email",
      "Setor",
      "Admissao",
      "Direito",
      "Gozados",
      "Saldo",
      "Status",
    ];
    const linhas = dadosFiltrados.map((c) => {
      const status = obterStatus(
        c.data_admissao,
        c.dias_gozados,
        c.dias_direito,
      );
      const saldo = (c.dias_direito || 30) - (c.dias_gozados || 0);
      return [
        c.colaborador_nome,
        c.email || "---",
        c.setor,
        c.data_admissao || "---",
        c.dias_direito,
        c.dias_gozados || 0,
        saldo,
        status.label,
      ];
    });

    let csvContent = "\uFEFF" + cabecalho.join(";") + "\n";
    linhas.forEach((linha) => {
      csvContent += linha.join(";") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `relatorio_férias_${format(new Date(), "dd_MM_yyyy")}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = {
    total: dadosFiltrados.length,
    vencidas: dadosFiltrados.filter(
      (c) =>
        obterStatus(c.data_admissao, c.dias_gozados).label ===
        "VENCIDA (DOBRA)",
    ).length,
    saudavel: dadosFiltrados.filter(
      (c) => obterStatus(c.data_admissao, c.dias_gozados).label === "EM DIA",
    ).length,
  };

  return (
    <div className="p-8 max-w-7xl mx-auto text-white">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="text-gold" /> Relatórios de Férias
          </h1>
          <p className="text-gray-500 text-sm">
            Visão analítica e exportação para RH/DP
          </p>
        </div>
        <button
          onClick={exportarExcel}
          className="bg-gold hover:bg-gold-hover text-[#0a0a0a] font-black text-xs uppercase px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-gold-hover/20"
        >
          <Download size={18} /> Exportar para Excel
        </button>
      </header>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-[#0a0a0a] border border-[#262626] p-6 rounded-2xl">
          <div className="flex justify-between items-start mb-4">
            <Users className="text-gray-500" size={20} />
            <span className="text-[10px] bg-gray-800 px-2 py-1 rounded font-bold uppercase">
              Base Setor
            </span>
          </div>
          <p className="text-3xl font-black">{stats.total}</p>
        </div>
        <div className="bg-[#0a0a0a] border border-[#262626] p-6 rounded-2xl">
          <div className="flex justify-between items-start mb-4">
            <AlertTriangle className="text-red-500" size={20} />
            <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-1 rounded font-bold uppercase">
              Crítico
            </span>
          </div>
          <p className="text-3xl font-black text-red-500">{stats.vencidas}</p>
        </div>
        <div className="bg-[#0a0a0a] border border-[#262626] p-6 rounded-2xl">
          <div className="flex justify-between items-start mb-4">
            <CheckCircle className="text-green-500" size={20} />
            <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-1 rounded font-bold uppercase">
              Saudável
            </span>
          </div>
          <p className="text-3xl font-black text-green-500">{stats.saudavel}</p>
        </div>
      </div>

      {/* Filtro de Setor */}
      <div className="bg-[#0a0a0a] border border-[#262626] p-4 rounded-2xl mb-6 flex items-center gap-4">
        <Filter size={18} className="text-gold" />
        <select
          value={filtroSetor}
          onChange={(e) => setFiltroSetor(e.target.value)}
          className="bg-transparent text-sm font-bold uppercase outline-none cursor-pointer [color-scheme:dark]"
        >
          {listaSetores.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Tabela de Relatório */}
      <div className="bg-[#0a0a0a] border border-[#262626] rounded-2xl overflow-hidden shadow-2xl">
        <table className="w-full text-left">
          <thead className="bg-[#141414] border-b border-[#262626]">
            <tr>
              <th className="p-4 text-[10px] font-black uppercase text-gray-500">
                Colaborador
              </th>
              <th className="p-4 text-[10px] font-black uppercase text-gray-500">
                Setor
              </th>
              <th className="p-4 text-[10px] font-black uppercase text-gray-500 text-center">
                Saldo
              </th>
              <th className="p-4 text-[10px] font-black uppercase text-gray-500 text-center">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#262626]">
            {carregando ? (
              <tr>
                <td
                  colSpan="4"
                  className="p-10 text-center font-mono text-xs opacity-50"
                >
                  GERANDO DADOS...
                </td>
              </tr>
            ) : (
              dadosFiltrados.map((c) => {
                const status = obterStatus(c.data_admissao, c.dias_gozados);
                const saldo = (c.dias_direito || 30) - (c.dias_gozados || 0);
                return (
                  <tr
                    key={c.id}
                    className="hover:bg-[#141414] transition-colors"
                  >
                    <td className="p-4">
                      <p className="text-sm font-bold">{c.colaborador_nome}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-tighter">
                        {c.email}
                      </p>
                    </td>
                    <td className="p-4 text-xs font-medium text-gray-400 uppercase tracking-tighter">
                      {c.setor}
                    </td>
                    <td className="p-4 text-center font-mono font-bold text-sm">
                      {saldo}d
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`text-[10px] font-black px-2 py-1 rounded border ${status.cor.replace("text", "border")}/30 ${status.cor}`}
                      >
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
