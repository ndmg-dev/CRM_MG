import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  ShieldCheck,
  UserCog,
  Trash2,
  Edit2,
  Mail,
  Briefcase,
  X,
  Save,
  Lock,
} from "lucide-react";

export default function GestaoUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // --- Estados do Form de CADASTRO ---
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [dataAdmissao, setDataAdmissao] = useState(""); // <-- O bom filho a casa torna!
  const [perfil, setPerfil] = useState("Gestor");
  const [setor, setSetor] = useState("Contábil");

  // --- Estados do Modal de EDIÇÃO ---
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [usuarioEmEdicao, setUsuarioEmEdicao] = useState(null);
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPerfil, setEditPerfil] = useState("");
  const [editSetor, setEditSetor] = useState("");
  const [editStatus, setEditStatus] = useState("ativo");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // Listas Limpas e Separadas
  const listaPerfis = ["Administrador", "Coordenador", "Gestor", "Analista"];

  const listaSetores = [
    "Global",
    "Contábil",
    "Departamento Pessoal",
    "Financeiro",
    "Fiscal",
    "Recursos Humanos",
    "Tecnologia da Informação",
    "Diretoria",
    "Comercial",
    "Operacional",
  ];

  const obterNomeSetorCurto = (setorLongo) => {
    const traducoes = {
      "Departamento Pessoal": "DP",
      "Recursos Humanos": "RH",
      "Tecnologia da Informação": "TI",
      Global: "",
    };
    return traducoes[setorLongo] !== undefined
      ? traducoes[setorLongo]
      : setorLongo;
  };

  // --- 1. BUSCAR USUÁRIOS ---
  async function buscarUsuarios() {
    try {
      setCarregando(true);
      const { data, error } = await supabase
        .from("usuarios_sistema")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsuarios(data || []);
    } catch (error) {
      console.error("Erro na busca:", error.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    buscarUsuarios();
  }, []);

  // --- 2. CADASTRAR USUÁRIO (COM GATILHO DUPLO) ---
  const cadastrarUsuario = async (e) => {
    e.preventDefault();
    if (!nome || !email || !dataAdmissao)
      return alert("Preencha Nome, E-mail e Data de Admissão!");

    try {
      // 1º Gatilho: Salvar o acesso
      const { error: errUser } = await supabase
        .from("usuarios_sistema")
        .insert([
          {
            nome,
            email,
            perfil,
            setor,
            status: "ativo",
          },
        ]);

      if (errUser) {
        if (errUser.code === "23505") {
          return alert("Este e-mail já está cadastrado no sistema!");
        }
        throw errUser;
      }

      // 2º Gatilho: Criar a ficha do colaborador com a data certa
      const nomeSetorColaborador = setor === "Global" ? "" : setor;

      const { error: errColab } = await supabase.from("colaboradores").insert([
        {
          colaborador_nome: nome,
          email: email,
          setor: nomeSetorColaborador,
          data_admissao: dataAdmissao, // <-- Usando a data preenchida
          status: "ativo",
          dias_direito: 30,
          dias_gozados: 0,
        },
      ]);

      if (errColab) {
        console.error(
          "Aviso: Acesso gerado, mas falha ao criar ficha de colaborador.",
          errColab.message,
        );
        alert(
          "Acesso gerado com sucesso! Mas não foi possível criar a ficha de férias automaticamente.",
        );
      } else {
        alert(
          "Sucesso! Usuário criado E ficha de colaborador gerada com a admissão correta e 30 dias de direito.",
        );
      }

      setNome("");
      setEmail("");
      setDataAdmissao("");
      buscarUsuarios();
    } catch (error) {
      alert("Erro geral ao cadastrar: " + error.message);
    }
  };

  // --- 3. DELETAR USUÁRIO ---
  const deletarUsuario = async (id) => {
    if (
      !confirm(
        "Tem certeza que deseja remover o acesso deste usuário permanentemente?",
      )
    )
      return;
    const { error } = await supabase
      .from("usuarios_sistema")
      .delete()
      .eq("id", id);
    if (error) alert(error.message);
    else buscarUsuarios();
  };

  // --- 4. PREPARAR EDIÇÃO ---
  const abrirModalEdicao = (user) => {
    setUsuarioEmEdicao(user);
    setEditNome(user.nome);
    setEditEmail(user.email);
    setEditPerfil(user.perfil);
    setEditSetor(user.setor);
    setEditStatus(user.status);
    setModalEdicaoAberto(true);
  };

  // --- 5. SALVAR EDIÇÃO ---
  const salvarEdicao = async (e) => {
    e.preventDefault();
    setSalvandoEdicao(true);

    const { error } = await supabase
      .from("usuarios_sistema")
      .update({
        nome: editNome,
        email: editEmail,
        perfil: editPerfil,
        setor: editSetor,
        status: editStatus,
      })
      .eq("id", usuarioEmEdicao.id);

    setSalvandoEdicao(false);

    if (error) {
      alert("Erro ao atualizar: " + error.message);
    } else {
      setModalEdicaoAberto(false);
      buscarUsuarios();
    }
  };

  const corDoPerfil = (perfilName) => {
    if (perfilName.includes("Administrador"))
      return "border-purple-900 text-purple-400 bg-purple-900/10";
    if (perfilName.includes("Coordenador"))
      return "border-blue-900 text-blue-400 bg-blue-900/10";
    if (perfilName.includes("Analista"))
      return "border-pink-900 text-pink-400 bg-pink-900/10";
    return "border-emerald-900 text-emerald-400 bg-emerald-900/10";
  };

  return (
    <div className="p-8 max-w-7xl mx-auto relative">
      <h1 className="text-2xl text-white font-bold mb-8 flex items-center gap-3">
        <ShieldCheck className="text-gold" size={28} /> Gestão de Acessos
        (Usuários)
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 bg-[#0a0a0a] border border-[#262626] p-6 rounded-xl h-fit">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <UserCog size={18} className="text-gold" /> Novo Acesso
          </h2>
          <form onSubmit={cadastrarUsuario} className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                NOME DO USUÁRIO
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-2.5 text-white text-sm focus:border-gold outline-none"
                placeholder="Ex: Carlos Eduardo"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">
                E-MAIL (Login Google)
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-3 text-gray-500"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-2.5 pl-9 text-white text-sm focus:border-gold outline-none"
                  placeholder="carlos@mendoncagalvao.com.br"
                />
              </div>
            </div>

            {/* CAMPO DE ADMISSÃO RETORNOU AQUI */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                DATA DE ADMISSÃO
              </label>
              <input
                type="date"
                value={dataAdmissao}
                onChange={(e) => setDataAdmissao(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-2.5 text-white text-sm focus:border-gold outline-none [color-scheme:dark]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  PERFIL
                </label>
                <select
                  value={perfil}
                  onChange={(e) => setPerfil(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-2.5 text-white text-sm focus:border-gold outline-none appearance-none"
                >
                  {listaPerfis.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  SETOR
                </label>
                <select
                  value={setor}
                  onChange={(e) => setSetor(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-2.5 text-white text-sm focus:border-gold outline-none appearance-none"
                >
                  {listaSetores.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-gold/10 border border-gold/20 p-3 rounded-lg mt-4 flex gap-3 items-start">
              <Lock size={16} className="text-gold shrink-0 mt-0.5" />
              <p className="text-xs text-gold/80 leading-relaxed">
                Atenção: A ficha de colaborador será gerada no setor: <br />
                <strong className="text-gold">
                  "{perfil} {obterNomeSetorCurto(setor)}"
                </strong>
              </p>
            </div>

            <button
              type="submit"
              className="w-full bg-gold hover:bg-gold-hover text-[#0a0a0a] font-bold py-3 rounded-lg transition-colors text-sm shadow-lg shadow-gold-hover/20 mt-2"
            >
              CONCEDER ACESSO
            </button>
          </form>
        </div>

        <div className="lg:col-span-8 bg-[#0a0a0a] border border-[#262626] rounded-xl overflow-hidden shadow-xl h-fit">
          <div className="p-4 border-b border-[#262626] bg-[#141414] flex justify-between items-center">
            <h2 className="text-white font-semibold text-sm">
              Usuários Autorizados
            </h2>
            <span className="text-xs font-mono bg-[#262626] text-gray-400 px-2 py-1 rounded">
              {usuarios.length} cadastrados
            </span>
          </div>
          <div className="divide-y divide-[#262626] max-h-[700px] overflow-y-auto">
            {carregando ? (
              <p className="p-10 text-center text-gray-500 font-mono text-sm">
                Carregando permissões...
              </p>
            ) : usuarios.length === 0 ? (
              <p className="p-10 text-gray-500 text-center text-sm">
                Nenhum usuário configurado.
              </p>
            ) : (
              usuarios.map((user) => (
                <div
                  key={user.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#141414] transition-colors group"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-[#262626] flex items-center justify-center text-gray-400 border border-[#333]">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm flex items-center gap-2">
                        {user.nome}
                        {user.status === "bloqueado" && (
                          <span className="bg-red-500/20 text-red-500 text-[10px] px-1.5 py-0.5 rounded border border-red-500/30">
                            BLOQUEADO
                          </span>
                        )}
                      </p>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1.5">
                          <Mail size={12} /> {user.email}
                        </span>
                        <span className="hidden sm:inline text-gray-700">
                          •
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Briefcase size={12} /> Setor: {user.setor}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span
                      className={`px-2.5 py-1 rounded text-[10px] uppercase font-bold border ${corDoPerfil(user.perfil)}`}
                    >
                      {user.perfil}
                    </span>

                    <div className="flex items-center gap-1 border-l border-[#333] pl-3">
                      <button
                        onClick={() => abrirModalEdicao(user)}
                        className="text-gray-500 hover:text-white hover:bg-[#262626] rounded p-1.5 transition-all"
                        title="Editar Permissões"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => deletarUsuario(user.id)}
                        className="text-gray-500 hover:text-red-500 hover:bg-red-950/30 rounded p-1.5 transition-all"
                        title="Revogar Acesso"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {modalEdicaoAberto && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-[#0a0a0a] border border-[#262626] rounded-2xl w-full max-w-md shadow-2xl relative p-6">
            <button
              onClick={() => setModalEdicaoAberto(false)}
              className="absolute right-4 top-4 text-gray-500 hover:text-white"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
              <UserCog className="text-gold" size={20} /> Editar Acesso
            </h2>

            <form onSubmit={salvarEdicao} className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  NOME DO USUÁRIO
                </label>
                <input
                  type="text"
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-2.5 text-white text-sm outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  E-MAIL (Login Google)
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-2.5 text-white text-sm outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    PERFIL
                  </label>
                  <select
                    value={editPerfil}
                    onChange={(e) => setEditPerfil(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-2.5 text-white text-sm outline-none appearance-none"
                  >
                    {listaPerfis.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    SETOR
                  </label>
                  <select
                    value={editSetor}
                    onChange={(e) => setEditSetor(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-2.5 text-white text-sm outline-none appearance-none"
                  >
                    {listaSetores.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-[#333] mt-4">
                <label className="text-xs text-gray-500 block mb-2">
                  STATUS DE ACESSO
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="ativo"
                      checked={editStatus === "ativo"}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="accent-gold"
                    />
                    Permitido (Ativo)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-red-400 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="bloqueado"
                      checked={editStatus === "bloqueado"}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="accent-red-500"
                    />
                    Bloqueado
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={salvandoEdicao}
                className="w-full flex justify-center items-center gap-2 bg-gold hover:bg-gold-hover text-[#0a0a0a] font-bold py-3 rounded-lg text-sm mt-6"
              >
                <Save size={18} />{" "}
                {salvandoEdicao ? "SALVANDO..." : "SALVAR ALTERAÇÕES"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
