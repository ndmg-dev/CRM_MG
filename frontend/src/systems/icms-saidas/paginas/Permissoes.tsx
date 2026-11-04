import { useEffect, useMemo, useState } from "react";

import { api } from "../api";
import { MensagemErro, Pagina, Trilha, useCarregar } from "../componentes/comuns";
import { Botao } from "../ui/components/Botao";
import { BarraFiltros, CampoBusca } from "../ui/components/Filtros";
import { EstadoTabela } from "../ui/components/Tabela";
import "./permissoes.css";

interface ItemCatalogo {
  codigo: string;
  nome: string;
  descricao: string;
}

interface UsuarioPermissoes {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  setor: string | null;
  admin: boolean;
  permissoes: string[];
}

const CONSULTAR = "icms_saidas.consultar";

/** Tela do ADMIN do CRM: quem pode o quê no módulo. Salva por pessoa (substitui o conjunto concedido). */
export function Permissoes() {
  const catalogo = useCarregar<ItemCatalogo[]>("/api/permissoes/catalogo");
  const usuarios = useCarregar<UsuarioPermissoes[]>("/api/permissoes/usuarios");
  const [busca, setBusca] = useState("");

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const todos = usuarios.dados ?? [];
    return termo ? todos.filter((u) => `${u.nome} ${u.email}`.toLowerCase().includes(termo)) : todos;
  }, [usuarios.dados, busca]);

  return (
    <Pagina>
      <Trilha itens={[{ rotulo: "Painel do mês", para: "/" }, { rotulo: "Permissões" }]} />
      <div className="pagina__cabecalho">
        <div>
          <h1>Permissões do módulo</h1>
          <p className="pagina__subtitulo">
            Administradores do CRM têm todas as permissões. Para os demais, marque o que cada pessoa pode fazer. Qualquer permissão de ação inclui
            consultar.
          </p>
        </div>
      </div>
      <MensagemErro erro={catalogo.erro || usuarios.erro} />
      <BarraFiltros>
        <CampoBusca rotulo="Buscar pessoa" valor={busca} onChange={setBusca} placeholder="Nome ou e-mail" />
      </BarraFiltros>
      {usuarios.carregando && !usuarios.dados ? (
        <EstadoTabela tipo="carregando" titulo="Carregando usuários…" />
      ) : lista.length === 0 ? (
        <EstadoTabela tipo="vazio" titulo="Nenhuma pessoa encontrada." />
      ) : (
        <ul className="permissoes__lista" aria-label="Pessoas e permissões">
          {lista.map((u) => (
            <LinhaUsuario key={u.id} usuario={u} catalogo={catalogo.dados ?? []} />
          ))}
        </ul>
      )}
    </Pagina>
  );
}

function LinhaUsuario({ usuario, catalogo }: { usuario: UsuarioPermissoes; catalogo: ItemCatalogo[] }) {
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set(usuario.permissoes));
  const [salvas, setSalvas] = useState<string[]>(usuario.permissoes);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    setMarcadas(new Set(usuario.permissoes));
    setSalvas(usuario.permissoes);
  }, [usuario.permissoes]);

  const atual = [...marcadas].sort();
  const mudou = atual.join("|") !== [...salvas].sort().join("|");

  function alternar(codigo: string, ligar: boolean) {
    setOk(false);
    setMarcadas((anterior) => {
      const novo = new Set(anterior);
      if (ligar) {
        novo.add(codigo);
        if (codigo !== CONSULTAR) novo.add(CONSULTAR);
      } else {
        novo.delete(codigo);
        // tirar "consultar" tira também o que depende dele
        if (codigo === CONSULTAR) novo.clear();
      }
      return novo;
    });
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await api.put<{ permissoes: string[] }>(`/api/permissoes/usuarios/${encodeURIComponent(usuario.id)}`, { permissoes: atual });
      setSalvas(r.permissoes);
      setOk(true);
    } catch (e) {
      setErro(e);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <li className="permissoes__pessoa">
      <div className="permissoes__quem">
        <strong>{usuario.nome}</strong>
        <span className="pagina__subtitulo">
          {usuario.email}
          {usuario.setor && ` · ${usuario.setor}`} · {usuario.perfil}
        </span>
      </div>
      {usuario.admin ? (
        <p className="permissoes__admin">Administrador: todas as permissões.</p>
      ) : (
        <>
          <fieldset className="permissoes__grupo">
            <legend className="sr-somente">Permissões de {usuario.nome}</legend>
            {catalogo.map((p) => (
              <label key={p.codigo} className="permissoes__opcao" title={p.descricao}>
                <input type="checkbox" checked={marcadas.has(p.codigo)} onChange={(e) => alternar(p.codigo, e.target.checked)} />
                <span>{p.nome}</span>
              </label>
            ))}
          </fieldset>
          <div className="permissoes__acao">
            <Botao variante="primario" tamanho="compacto" desabilitado={!mudou} carregando={salvando} onClick={() => void salvar()}>
              Salvar
            </Botao>
            {ok && !mudou && <span role="status">Salvo.</span>}
          </div>
          <MensagemErro erro={erro} />
        </>
      )}
    </li>
  );
}
