import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  Users,
  UserPlus,
  Trash2,
  Edit2,
  X,
  AlertCircle,
  Timer,
  CheckCircle2,
  Calendar as CalendarIcon,
  Search,
  Filter,
  Mail,
  Briefcase,
} from "lucide-react";
import { differenceInMonths, parseISO, format } from "date-fns";
import { useAuth } from "../contexts/AuthContext";
import { canViewCollaborator, getFeriasPermissions } from "../lib/permissions";

export default function Colaboradores() {
  const { usuarioLogado } = useAuth();
  const permissions = getFeriasPermissions(usuarioLogado);
  const [colaboradores, setColaboradores] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // --- ESTADOS DE FILTRO ---
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  // --- ESTADOS DE CADASTRO ---
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [setor, setSetor] = useState("Contábil");
  const [dataAdmissao, setDataAdmissao] = useState("");
  const [dataUltimasFerias, setDataUltimasFerias] = useState("");
  const [feriasVencidas, setFeriasVencidas] = useState(false);
  const [diasDireito, setDiasDireito] = useState(30);
  const [diasGozados, setDiasGozados] = useState(0);

  // --- ESTADOS DE EDIÇÃO ---
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [colabEmEdicao, setColabEmEdicao] = useState(null);
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSetor, setEditSetor] = useState("");
  const [editDataAdmissao, setEditDataAdmissao] = useState("");
  const [editDataUltimasFerias, setEditDataUltimasFerias] = useState("");
  const [editFeriasVencidas, setEditFeriasVencidas] = useState(false);
  const [editDiasDireito, setEditDiasDireito] = useState(30);
  const [editDiasGozados, setEditDiasGozados] = useState(0);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const listaSetores = [
    "Contábil",
    "Departamento Pessoal",
    "Financeiro",
    "Fiscal",
    "Recursos Humanos",
    "Tecnologia da Informação",
  ];

  // ==========================================
  // LÓGICA DE AUTO-CHECKBOX (FÉRIAS VENCIDAS)
  // ==========================================
  useEffect(() => {
    // Para o cadastro:
    const dataRef = dataUltimasFerias || dataAdmissao;
    if (dataRef) {
      const meses = differenceInMonths(new Date(), parseISO(dataRef));
      setFeriasVencidas(meses >= 23); // Marca automático se >= 23 meses
    } else {
      setFeriasVencidas(false);
    }
  }, [dataAdmissao, dataUltimasFerias]);

  useEffect(() => {
    // Para a edição:
    const dataRef = editDataUltimasFerias || editDataAdmissao;
    if (dataRef) {
      const meses = differenceInMonths(new Date(), parseISO(dataRef));
      setEditFeriasVencidas(meses >= 23);
    }
  }, [editDataAdmissao, editDataUltimasFerias]);

  async function buscarColaboradores() {
    try {
      setCarregando(true);
      const { data: colabs, error } = await supabase
        .from("colaboradores")
        .select("*")
        .order("colaborador_nome", { ascending: true });

      if (error) throw error;

      // Consulta de tela é somente leitura. Nenhum saldo ou ciclo é alterado
      // automaticamente ao abrir a listagem.
      setColaboradores(colabs || []);
    } catch (error) {
      console.error(error.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    buscarColaboradores();
  }, []);

  const obterStatusFerias = (colab) => {
    const direito = colab.dias_direito ?? 30;
    const gozados = colab.dias_gozados ?? 0;
    const saldo = direito - gozados;

    if (saldo <= 0) return { label: "EM DIA", cor: "text-green-500" };

    // Se a caixinha foi marcada no banco, crava como vencida
    if (colab.ferias_vencidas)
      return { label: "VENCIDA (DOBRA)", cor: "text-red-500" };

    const dataBase = colab.data_ultimas_ferias || colab.data_admissao;
    if (!dataBase) return { label: "S/ DATA", cor: "text-gray-500" };

    const meses = differenceInMonths(new Date(), parseISO(dataBase));
    if (meses >= 23) return { label: "VENCIDA (DOBRA)", cor: "text-red-500" };
    if (meses >= 18) return { label: "EM ALERTA", cor: "text-yellow-500" };

    return { label: "EM DIA", cor: "text-green-500" };
  };

  const obterSigla = (setor) => {
    if (!setor) return "---";
    const s = setor.toLowerCase();
    if (s.includes("administrador") || s.includes("admin")) return "ADMIN";
    if (s.includes("coordenador") || s.includes("coord")) return "COORD";
    if (s.includes("diretor") || s.includes("diretoria")) return "DIR";

    const siglas = {
      "tecnologia da informação": "TI",
      "departamento pessoal": "DP",
      financeiro: "FIN",
      fiscal: "FISC",
      contábil: "CONT",
      "recursos humanos": "RH",
    };
    return siglas[s] || setor.substring(0, 4).toUpperCase();
  };

  const cadastrarColaborador = async (e) => {
    e.preventDefault();
    if (!permissions.canManageAll)
      return alert("Você não tem permissão para cadastrar colaboradores.");
    if (!nome || !email || !dataAdmissao)
      return alert("Preencha os campos obrigatórios!");

    const { error } = await supabase.from("colaboradores").insert([
      {
        colaborador_nome: nome,
        email,
        setor,
        data_admissao: dataAdmissao,
        data_ultimas_ferias: dataUltimasFerias || null,
        ferias_vencidas: feriasVencidas,
        status: "ativo",
        dias_direito: parseInt(diasDireito),
        dias_gozados: parseInt(diasGozados),
      },
    ]);
    if (error) alert(error.message);
    else {
      setNome("");
      setEmail("");
      setDataAdmissao("");
      setDataUltimasFerias("");
      setFeriasVencidas(false);
      setDiasDireito(30);
      setDiasGozados(0);
      buscarColaboradores();
    }
  };

  const deletarColaborador = async (id) => {
    if (!permissions.isAdmin)
      return alert("Somente administradores podem excluir colaboradores.");
    if (!confirm("Excluir este colaborador?")) return;
    const { error } = await supabase
      .from("colaboradores")
      .delete()
      .eq("id", id);
    if (error) alert(error.message);
    else buscarColaboradores();
  };

  const abrirModalEdicao = (colab) => {
    if (!permissions.canManageAll) {
      alert("Você não tem permissão para editar colaboradores.");
      return;
    }
    setColabEmEdicao(colab);
    setEditNome(colab.colaborador_nome);
    setEditEmail(colab.email || "");
    setEditSetor(colab.setor);
    setEditDataAdmissao(colab.data_admissao || "");
    setEditDataUltimasFerias(colab.data_ultimas_ferias || "");
    setEditFeriasVencidas(colab.ferias_vencidas || false);
    setEditDiasDireito(colab.dias_direito ?? 30);
    setEditDiasGozados(colab.dias_gozados ?? 0);
    setModalEdicaoAberto(true);
  };

  const salvarEdicao = async (e) => {
    e.preventDefault();
    if (!permissions.canManageAll)
      return alert("Você não tem permissão para editar colaboradores.");
    setSalvandoEdicao(true);
    const { error } = await supabase
      .from("colaboradores")
      .update({
        colaborador_nome: editNome,
        email: editEmail,
        setor: editSetor,
        data_admissao: editDataAdmissao,
        data_ultimas_ferias: editDataUltimasFerias || null,
        ferias_vencidas: editFeriasVencidas,
        dias_direito: parseInt(editDiasDireito),
        dias_gozados: parseInt(editDiasGozados),
      })
      .eq("id", colabEmEdicao.id);
    setSalvandoEdicao(false);

    if (error) alert(error.message);
    else {
      setModalEdicaoAberto(false);
      buscarColaboradores();
    }
  };

  const colaboradoresVisiveis = colaboradores.filter((colab) =>
    canViewCollaborator(usuarioLogado, colab),
  );
  const colaboradoresFiltrados = colaboradoresVisiveis.filter((colab) => {
    const statusInfo = obterStatusFerias(colab);
    const nomeBate = colab.colaborador_nome
      ?.toLowerCase()
      .includes(busca.toLowerCase());
    const statusBate =
      filtroStatus === "todos" || statusInfo.label === filtroStatus;
    return nomeBate && statusBate;
  });

  const estatisticas = {
    vencidas: colaboradoresVisiveis.filter(
      (c) => obterStatusFerias(c).label === "VENCIDA (DOBRA)",
    ).length,
    alerta: colaboradoresVisiveis.filter(
      (c) => obterStatusFerias(c).label === "EM ALERTA",
    ).length,
    total: colaboradoresVisiveis.length,
  };

  return (
    <div className="p-8 max-w-7xl mx-auto relative text-white">
      <header className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="text-gold" /> Gestão de Equipe
        </h1>
      </header>

      {/* Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-5 rounded-xl flex items-center gap-5 shadow-sm">
          <div className="bg-red-500/10 p-3.5 rounded-lg text-red-500">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">
              Vencidas
            </p>
            <p className="text-2xl font-bold leading-none">
              {estatisticas.vencidas}
            </p>
          </div>
        </div>
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-5 rounded-xl flex items-center gap-5 shadow-sm">
          <div className="bg-yellow-500/10 p-3.5 rounded-lg text-yellow-500">
            <Timer size={24} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">
              Alertas
            </p>
            <p className="text-2xl font-bold leading-none">
              {estatisticas.alerta}
            </p>
          </div>
        </div>
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-5 rounded-xl flex items-center gap-5 shadow-sm">
          <div className="bg-green-500/10 p-3.5 rounded-lg text-green-500">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">
              Total Ativos
            </p>
            <p className="text-2xl font-bold leading-none">
              {estatisticas.total}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Cadastro */}
        {permissions.canManageAll && (
        <div className="lg:col-span-4 bg-[#0a0a0a] border border-[#262626] p-6 rounded-xl h-fit shadow-xl">
          <h2 className="text-white font-semibold mb-6 flex items-center gap-2">
            <UserPlus size={18} className="text-gold" /> Novo Cadastro
          </h2>
          <form onSubmit={cadastrarColaborador} className="space-y-4">
            <input
              type="text"
              placeholder="Nome Completo"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-white text-sm outline-none focus:border-gold transition-all"
            />
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-white text-sm outline-none focus:border-gold transition-all"
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-gray-500 font-bold uppercase ml-1 block mb-1">
                  Admissão*
                </label>
                <input
                  type="date"
                  value={dataAdmissao}
                  onChange={(e) => setDataAdmissao(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-white text-sm outline-none [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-bold uppercase ml-1 block mb-1">
                  Início Período Aquisitivo
                </label>
                <input
                  type="date"
                  value={dataUltimasFerias}
                  onChange={(e) => setDataUltimasFerias(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-white text-sm outline-none [color-scheme:dark]"
                />
              </div>
            </div>

            <select
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-white text-sm outline-none cursor-pointer"
            >
              {listaSetores.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-4">
              <input
                type="number"
                placeholder="Direito"
                value={diasDireito}
                onChange={(e) => setDiasDireito(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-white text-sm outline-none"
              />
              <input
                type="number"
                placeholder="Gozados"
                value={diasGozados}
                onChange={(e) => setDiasGozados(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-white text-sm outline-none"
              />
            </div>

            {/* CAIXINHA DE FÉRIAS VENCIDAS */}
            <div className="flex items-center gap-2 mt-2 p-3 bg-red-900/10 border border-red-900/30 rounded-lg">
              <input
                type="checkbox"
                id="feriasVencidas"
                checked={feriasVencidas}
                onChange={(e) => setFeriasVencidas(e.target.checked)}
                className="accent-red-500 w-4 h-4 cursor-pointer shrink-0"
              />
              <label
                htmlFor="feriasVencidas"
                className="text-xs text-red-400 font-semibold cursor-pointer select-none"
              >
                Marcar como "Férias Vencidas"
              </label>
            </div>

            <button
              type="submit"
              className="w-full bg-gold hover:bg-gold-hover text-[#0a0a0a] font-bold py-3.5 rounded-lg transition-all shadow-lg shadow-gold-hover/20 uppercase text-xs"
            >
              Cadastrar
            </button>
          </form>
        </div>
        )}

        {/* Listagem */}
        <div className={`${permissions.canManageAll ? "lg:col-span-8" : "lg:col-span-12"} flex flex-col gap-3`}>
          {/* Barra de Filtros */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 top-3.5 text-gray-500"
              />
              <input
                type="text"
                placeholder="Pesquisar por nome..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl p-3.5 pl-10 text-sm outline-none focus:border-gold transition-all"
              />
            </div>
            <div className="flex items-center gap-2 bg-[#0a0a0a] border border-[#262626] rounded-xl px-4">
              <Filter size={16} className="text-gray-500" />
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="bg-transparent text-xs font-black uppercase p-3.5 outline-none cursor-pointer text-gray-300 focus:text-white"
              >
                <option
                  value="todos"
                  className="bg-[#0a0a0a] text-white font-medium py-2"
                >
                  Todos Status
                </option>
                <option
                  value="EM DIA"
                  className="bg-[#0a0a0a] text-green-500 font-bold py-2"
                >
                  Em Dia
                </option>
                <option
                  value="EM ALERTA"
                  className="bg-[#0a0a0a] text-yellow-500 font-bold py-2"
                >
                  Em Alerta
                </option>
                <option
                  value="VENCIDA (DOBRA)"
                  className="bg-[#0a0a0a] text-red-500 font-bold py-2"
                >
                  Vencidas
                </option>
              </select>
            </div>
          </div>

          <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-[#141414] border-b border-[#262626]">
              <div className="grid grid-cols-12 gap-4 text-[10px] text-gray-500 font-black uppercase tracking-widest">
                <div className="col-span-5">Colaborador / Detalhes</div>
                <div className="col-span-2 text-center">Status CLT</div>
                <div className="col-span-1 text-center">Dir.</div>
                <div className="col-span-1 text-center">Goz.</div>
                <div className="col-span-2 text-center text-gold">
                  Saldo
                </div>
                <div className="col-span-1 text-right">Ação</div>
              </div>
            </div>

            <div className="divide-y divide-[#262626]">
              {carregando ? (
                <p className="p-10 text-center text-gray-500 uppercase text-xs animate-pulse">
                  Carregando...
                </p>
              ) : colaboradoresFiltrados.length === 0 ? (
                <p className="p-10 text-center text-gray-500 text-sm">
                  Nenhum registro encontrado.
                </p>
              ) : (
                colaboradoresFiltrados.map((colab) => {
                  const status = obterStatusFerias(colab);
                  const aGozar =
                    (colab.dias_direito || 30) - (colab.dias_gozados || 0);
                  return (
                    <div
                      key={colab.id}
                      className="p-5 hover:bg-[#141414] transition-colors group"
                    >
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-5 flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center text-gold font-bold border border-[#333] shrink-0 text-sm">
                            {colab.colaborador_nome.charAt(0)}
                          </div>
                          <div className="truncate">
                            <p className="text-white font-bold text-sm truncate uppercase leading-tight">
                              {colab.colaborador_nome}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                              <p className="text-[10px] text-gray-400 flex items-center gap-1.5">
                                <Mail size={12} className="text-gray-600" />{" "}
                                {colab.email || "---"}
                              </p>
                              <p className="text-[10px] text-gold/90 font-black flex items-center gap-1.5 uppercase tracking-tighter">
                                <Briefcase size={12} />{" "}
                                {obterSigla(colab.setor)}
                              </p>
                              <p
                                className="text-[10px] text-gray-500 flex items-center gap-1.5 font-bold"
                                title="Data Admissão"
                              >
                                <CalendarIcon size={12} />{" "}
                                {colab.data_admissao
                                  ? format(
                                      parseISO(colab.data_admissao),
                                      "dd/MM/yy",
                                    )
                                  : "---"}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="col-span-2 text-center font-black uppercase text-[11px] tracking-tight">
                          <span className={status.cor}>{status.label}</span>
                          {colab.data_ultimas_ferias && (
                            <p
                              className="text-[9px] text-gray-600 mt-1 capitalize tracking-widest"
                              title="Data das últimas férias tiradas"
                            >
                              Últ:{" "}
                              {format(
                                parseISO(colab.data_ultimas_ferias),
                                "dd/MM/yy",
                              )}
                            </p>
                          )}
                        </div>
                        <div className="col-span-1 text-center text-sm font-mono text-gray-400">
                          {colab.dias_direito}d
                        </div>

                        <div className="col-span-1 text-center text-sm font-bold font-mono text-red-500">
                          {colab.dias_gozados || 0}d
                        </div>

                        <div className="col-span-2 text-center text-base font-black font-mono">
                          <span
                            className={
                              aGozar < 0 ? "text-red-600" : "text-green-500"
                            }
                          >
                            {aGozar}d
                          </span>
                        </div>

                        {permissions.canManageAll && (
                        <div className="col-span-1 flex items-center justify-end gap-1">
                          <button
                            onClick={() => abrirModalEdicao(colab)}
                            className="p-2 text-gray-500 hover:text-white hover:bg-[#262626] rounded-lg transition-all"
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                          {permissions.isAdmin && (
                          <button
                            onClick={() => deletarColaborador(colab.id)}
                            className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                          )}
                        </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Edição */}
      {permissions.canManageAll && modalEdicaoAberto && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#0a0a0a] border border-[#262626] rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
            <button
              onClick={() => setModalEdicaoAberto(false)}
              className="absolute right-4 top-4 text-gray-500 hover:text-white"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
              <Edit2 className="text-gold" /> Editar Ficha
            </h2>
            <form onSubmit={salvarEdicao} className="space-y-4">
              <input
                type="text"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-white text-sm outline-none focus:border-gold"
              />
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-white text-sm outline-none"
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase ml-1 block mb-1">
                    Admissão
                  </label>
                  <input
                    type="date"
                    value={editDataAdmissao}
                    onChange={(e) => setEditDataAdmissao(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-white text-sm outline-none [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase ml-1 block mb-1">
                    Início do Período Aquisitivo
                  </label>
                  <input
                    type="date"
                    value={editDataUltimasFerias}
                    onChange={(e) => setEditDataUltimasFerias(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-white text-sm outline-none [color-scheme:dark]"
                  />
                </div>
              </div>

              <select
                value={editSetor}
                onChange={(e) => setEditSetor(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-white text-sm outline-none"
              >
                {listaSetores.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  value={editDiasDireito}
                  onChange={(e) => setEditDiasDireito(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-white text-sm outline-none"
                />
                <input
                  type="number"
                  value={editDiasGozados}
                  onChange={(e) => setEditDiasGozados(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-white text-sm outline-none"
                />
              </div>

              <div className="flex items-center gap-2 mt-2 p-3 bg-red-900/10 border border-red-900/30 rounded-lg">
                <input
                  type="checkbox"
                  id="editFeriasVencidas"
                  checked={editFeriasVencidas}
                  onChange={(e) => setEditFeriasVencidas(e.target.checked)}
                  className="accent-red-500 w-4 h-4 cursor-pointer shrink-0"
                />
                <label
                  htmlFor="editFeriasVencidas"
                  className="text-xs text-red-400 font-semibold cursor-pointer select-none"
                >
                  Marcar como "Férias Vencidas"
                </label>
              </div>

              <button
                type="submit"
                disabled={salvandoEdicao}
                className="w-full bg-gold py-3.5 rounded-lg text-[#0a0a0a] font-bold mt-4 shadow-lg shadow-gold-hover/20 active:scale-95 transition-all uppercase text-xs tracking-widest"
              >
                Salvar Alterações
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
