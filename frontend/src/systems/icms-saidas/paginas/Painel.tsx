import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { consulta } from "../api";
import { PERMISSOES, usePermissoes } from "../auth/permissoes";
import { Pagina, useCarregar, Valor } from "../componentes/comuns";
import { useCriarPastas } from "../componentes/CriarPastas";
import { ChipsOrigem, EXPLICACAO_ORIGEM, origensDe, type Origem } from "../componentes/pendencias";
import { formatarCompetencia, formatarHora, formatarValor, mesAnterior, mesAtual } from "../formato";
import type { PainelItem } from "../tipos";
import { AjudaPopover } from "../ui/components/AjudaPopover";
import { Alerta, lerErro } from "../ui/components/Alerta";
import { Botao, BotaoLink } from "../ui/components/Botao";
import { AmostraSituacao, BarraSituacao, ORDEM_SITUACAO } from "../ui/components/BarraSituacao";
import { CartaoTotal } from "../ui/components/CartaoTotal";
import { BarraFiltros, CampoBusca, GrupoFiltro } from "../ui/components/Filtros";
import { SeletorCompetencia } from "../ui/components/SeletorCompetencia";
import { SeloSituacao } from "../ui/components/Selo";
import { EstadoTabela, Tabela, TituloValor, type Coluna } from "../ui/components/Tabela";
import { Link } from "../roteamento";
import { AJUDA } from "../ui/textosAjuda";
import "./painel.css";

/** Filtro = "todas" ou um código de situação do motor. */
type Filtro = "todas" | (typeof ORDEM_SITUACAO)[number];

const NOME_FILTRO: Record<Filtro, string> = {
  todas: "Todas",
  ERRO: "Erro",
  CONCLUIDA_COM_PENDENCIAS: "Com pendências",
  SEM_APURACAO: "Sem apuração",
  PROCESSANDO: "Processando",
  CONCLUIDA: "Concluída",
};

const CONCLUIDAS = new Set(["CONCLUIDA", "CONCLUIDA_COM_PENDENCIAS"]);

/** Posição na ordem de atenção (situação desconhecida vai para o fim). */
const prioridade = (situacao: string) => {
  const i = (ORDEM_SITUACAO as readonly string[]).indexOf(situacao);
  return i < 0 ? ORDEM_SITUACAO.length : i;
};

/** Texto do explicador da coluna Pendências: as três origens (mesmas frases da apuração). */
const AJUDA_ORIGENS = [EXPLICACAO_ORIGEM.produtos, EXPLICACAO_ORIGEM.cfop, EXPLICACAO_ORIGEM.manual].join(" ");

/** Comparação sem acento e sem caixa (busca no cliente). */
const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function Painel() {
  const admin = usePermissoes().pode(PERMISSOES.gerirEmpresas);
  const pastas = useCriarPastas();
  const [busca, setBusca] = useSearchParams();
  const competencia = busca.get("competencia") || mesAnterior();
  const { dados, erro, carregando, recarregar } = useCarregar<PainelItem[]>(`/api/painel${consulta({ competencia })}`);
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [erroEm, setErroEm] = useState<Date | null>(null);

  useEffect(() => {
    if (dados) setAtualizadoEm(new Date());
  }, [dados]);
  useEffect(() => {
    if (erro) setErroEm(new Date());
  }, [erro]);

  const itens = useMemo(() => (carregando || erro ? null : dados), [carregando, erro, dados]);
  const concluidas = itens?.filter((i) => CONCLUIDAS.has(i.situacao)) ?? [];
  const somaOd = concluidas.reduce((s, i) => s + (i.od ?? 0), 0);
  const somaEd = concluidas.reduce((s, i) => s + (i.ed ?? 0), 0);
  const legendaSoma = `Soma das ${concluidas.length} apurações concluídas`;

  const contagem = (situacao: string) => itens?.filter((i) => i.situacao === situacao).length ?? 0;
  const contagens = Object.fromEntries(ORDEM_SITUACAO.map((s) => [s, contagem(s)]));
  const termo = normalizar(texto.trim());
  // Ordem de atenção: erro, pendências, sem apuração, processando e, por último, as concluídas.
  const visiveis = (itens ?? [])
    .filter(
      (i) =>
        (filtro === "todas" || i.situacao === filtro) &&
        (!termo || normalizar(i.empresa).includes(termo) || normalizar(i.razao_social).includes(termo)),
    )
    .sort((a, b) => prioridade(a.situacao) - prioridade(b.situacao) || a.empresa.localeCompare(b.empresa));
  const totaisOrigem = somarOrigens(visiveis.map((i) => origensDe(i.pendencias)));

  function mudarCompetencia(nova: string) {
    const params = new URLSearchParams(busca);
    params.set("competencia", nova);
    setBusca(params);
  }

  function limparFiltros() {
    setTexto("");
    setFiltro("todas");
  }

  const comp = formatarCompetencia(competencia);
  const linkEmpresa = (codigo: string, aba?: string) =>
    `/empresas/${encodeURIComponent(codigo)}${consulta({ competencia, aba })}`;

  const colunas: Coluna<PainelItem>[] = [
    {
      chave: "empresa",
      titulo: "Empresa",
      celula: (i) => (
        <span className="painel__empresa">
          <Link to={linkEmpresa(i.empresa)} className="painel__razao">
            {i.razao_social}
          </Link>
          <span className="painel__codigo">{i.empresa}</span>
        </span>
      ),
    },
    { chave: "situacao", titulo: "Situação", celula: (i) => <SeloSituacao situacao={i.situacao} /> },
    {
      chave: "od",
      titulo: (
        <TituloValor tipo="od">
          OD (R$) <AjudaPopover rotulo="OD" texto={AJUDA.od} alinhar="fim" />
        </TituloValor>
      ),
      alinhar: "fim",
      classe: "tabela__valor--od",
      celula: (i) => <Valor valor={i.od} />,
    },
    {
      chave: "ed",
      titulo: (
        <TituloValor tipo="ed">
          ED (R$) <AjudaPopover rotulo="ED" texto={AJUDA.ed} alinhar="fim" />
        </TituloValor>
      ),
      alinhar: "fim",
      classe: "tabela__valor--ed",
      celula: (i) => <Valor valor={i.ed} />,
    },
    {
      chave: "pendencias",
      titulo: (
        <span className="rotulo-com-ajuda">
          Pendências <AjudaPopover rotulo="Pendências" texto={AJUDA_ORIGENS} />
        </span>
      ),
      celula: (i) => <CelulaPendencias item={i} link={linkEmpresa(i.empresa, "historico")} />,
    },
    {
      chave: "acao",
      titulo: <span className="visualmente-oculto">Ação</span>,
      alinhar: "fim",
      // Abrir é o nome da empresa; aqui só a ação que falta fazer.
      celula: (i) =>
        i.situacao === "SEM_APURACAO" ? (
          <BotaoLink
            to={linkEmpresa(i.empresa, "apurar")}
            tamanho="compacto"
            aria-label={`Apurar ${i.empresa} – ${i.razao_social}`}
          >
            Apurar
          </BotaoLink>
        ) : null,
    },
  ];

  const vazio = itens?.length === 0;
  const estadoTabela = !itens
    ? { tipo: "carregando" as const, titulo: `Carregando apurações de ${comp}…` }
    : visiveis.length === 0
      ? {
          tipo: "filtro-sem-resultado" as const,
          titulo: termo
            ? `Nenhuma empresa corresponde a ‘${texto.trim()}’${filtro === "todas" ? "" : ` em ${NOME_FILTRO[filtro]}`}`
            : `Nenhuma empresa em ${NOME_FILTRO[filtro]}`,
          acao: (
            <Botao tamanho="compacto" onClick={limparFiltros}>
              Limpar filtros
            </Botao>
          ),
        }
      : null;

  return (
    <Pagina>
      <div className="pagina__cabecalho">
        {/* A competência é o assunto da página: o seletor fica junto do título. */}
        <div className="painel__titulo">
          <h1>
            Painel de<span className="visualmente-oculto"> {comp}</span>
          </h1>
          <SeletorCompetencia valor={competencia} max={mesAtual()} onChange={mudarCompetencia} />
        </div>
        {admin && (
          <div className="pagina__acoes">
            {pastas.acao}
            <BotaoLink to="/admin/empresas/nova" variante="primario">
              Nova empresa
            </BotaoLink>
          </div>
        )}
      </div>
      {admin && pastas.retorno}

      {erro ? (
        <Alerta
          tipo="erro"
          titulo={`Não foi possível carregar o painel de ${comp}`}
          meta={`${lerErro(erro).codigo ?? "ERRO"} · ${erroEm ? formatarHora(erroEm) : ""}`}
          acoes={
            <Botao variante="primario" onClick={recarregar}>
              Tentar de novo
            </Botao>
          }
        >
          {lerErro(erro).mensagem} Nenhum dado foi alterado.
        </Alerta>
      ) : vazio ? (
        <EstadoTabela
          tipo="vazio"
          titulo="Nenhuma empresa cadastrada"
          texto={
            admin
              ? "O painel mostra as empresas ativas. Cadastre a primeira para começar a apurar."
              : "O painel mostra as empresas ativas. Peça a quem administra o módulo para cadastrar as empresas."
          }
          acao={
            admin && (
              <BotaoLink to="/admin/empresas/nova" variante="primario">
                Cadastrar primeira empresa
              </BotaoLink>
            )
          }
        />
      ) : (
        <>
          {/* Resumo do mês: quanto falta fechar (a barra) e os totais, num único bloco. */}
          <section className="resumo-mes" aria-labelledby="resumo-mes-titulo">
            <div className="resumo-mes__fechamento">
              <h2 id="resumo-mes-titulo" className="resumo-mes__titulo">
                {itens ? (
                  `${contagem("CONCLUIDA")} de ${itens.length} empresas concluídas sem pendências`
                ) : (
                  <>
                    <span className="visualmente-oculto">Resumo de {comp}</span>
                    <span className="esqueleto resumo-mes__esqueleto" aria-hidden="true" />
                  </>
                )}
              </h2>
              <BarraSituacao contagens={contagens} />
            </div>
            <div className="resumo-mes__totais">
              <CartaoTotal aparencia="plano" rotulo="OD do mês" tipo="od" valor={somaOd} legenda={legendaSoma} ajuda={AJUDA.od} carregando={!itens} />
              <CartaoTotal aparencia="plano" rotulo="ED do mês" tipo="ed" valor={somaEd} legenda={legendaSoma} ajuda={AJUDA.ed} carregando={!itens} />
              <CartaoTotal
                aparencia="plano"
                rotulo="Saldo (OD − ED)"
                tipo="saldo"
                valor={somaOd - somaEd}
                ajuda={AJUDA.saldo}
                carregando={!itens}
              />
            </div>
          </section>

          <BarraFiltros>
            <CampoBusca rotulo="Buscar empresa" placeholder="Código ou razão social" valor={texto} onChange={setTexto} />
            {/* Os filtros também são a legenda da barra de situação (mesma ordem e mesmas cores). */}
            <GrupoFiltro<Filtro>
              rotulo="Filtrar por situação"
              valor={filtro}
              onChange={setFiltro}
              opcoes={[
                { valor: "todas", rotulo: "Todas", contagem: itens?.length ?? 0 },
                ...ORDEM_SITUACAO.map((s) => ({
                  valor: s,
                  rotulo: NOME_FILTRO[s],
                  contagem: contagem(s),
                  icone: <AmostraSituacao situacao={s} />,
                })),
              ]}
            />
            {atualizadoEm && !carregando && <p className="painel__atualizado">Atualizado às {formatarHora(atualizadoEm)}</p>}
          </BarraFiltros>

          <Tabela
            rotulo={`Empresas em ${comp}`}
            colunas={colunas}
            linhas={visiveis}
            chaveLinha={(i) => i.empresa}
            estado={estadoTabela}
            larguraMinima={980}
            rodape={
              <tr>
                <td colSpan={2}>Total · {concluidasVisiveis(visiveis)} apurações concluídas</td>
                <td data-alinhar="fim" className="tabela__valor--od">
                  {formatarValor(somaVisivel(visiveis, "od"))}
                </td>
                <td data-alinhar="fim" className="tabela__valor--ed">
                  {formatarValor(somaVisivel(visiveis, "ed"))}
                </td>
                <td colSpan={2}>{totaisOrigem.length > 0 ? <ChipsOrigem origens={totaisOrigem} /> : "—"}</td>
              </tr>
            }
          />
        </>
      )}
    </Pagina>
  );
}

/** Nunca "—" ao lado de "Concluída com pendências": mostra a origem, "Aguardando" ou o link do erro. */
function CelulaPendencias({ item, link }: { item: PainelItem; link: string }) {
  if (item.situacao === "PROCESSANDO") return <span className="tabela__ausente">Aguardando</span>;
  if (item.situacao === "ERRO") return <Link to={link}>Ver detalhes do erro</Link>;
  const origens = origensDe(item.pendencias);
  if (origens.length > 0) return <ChipsOrigem origens={origens} />;
  // Defensivo: "com pendências" sem contagem nenhuma nunca vira "—".
  if (item.situacao === "CONCLUIDA_COM_PENDENCIAS") return <Link to={link}>Ver na apuração</Link>;
  return <span className="tabela__ausente">—</span>;
}

function concluidasVisiveis(itens: PainelItem[]) {
  return itens.filter((i) => CONCLUIDAS.has(i.situacao)).length;
}

function somaVisivel(itens: PainelItem[], campo: "od" | "ed") {
  return itens.filter((i) => CONCLUIDAS.has(i.situacao)).reduce((s, i) => s + (i[campo] ?? 0), 0);
}

/** Soma por origem (rodapé da tabela). */
function somarOrigens(listas: Origem[][]): Origem[] {
  const total = new Map<Origem["tipo"], number>();
  for (const lista of listas) for (const o of lista) total.set(o.tipo, (total.get(o.tipo) ?? 0) + o.quantidade);
  return (["produtos", "cfop", "manual"] as const).filter((t) => total.has(t)).map((t) => ({ tipo: t, quantidade: total.get(t)! }));
}
