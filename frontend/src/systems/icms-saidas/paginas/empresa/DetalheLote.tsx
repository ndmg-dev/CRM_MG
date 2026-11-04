import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { api, baixar, consulta, ErroApi } from "../../api";
import { PERMISSOES, usePermissoes } from "../../auth/permissoes";
import { useCarregar } from "../../componentes/comuns";
import { formatarData, formatarInteiro, formatarPercentual } from "../../formato";
import type { Diferenca, Lote } from "../../tipos";
import { AjudaPopover } from "../../ui/components/AjudaPopover";
import { Alerta, lerErro } from "../../ui/components/Alerta";
import { BarraAcoes } from "../../ui/components/BarraAcoes";
import { Botao, IconeCadeado } from "../../ui/components/Botao";
import { Dialogo } from "../../ui/components/Dialogo";
import { BarraFiltros, CampoBusca, GrupoFiltro } from "../../ui/components/Filtros";
import { ChipDiferenca, grupoDaDiferenca, SeloLote, type GrupoDiferenca } from "../../ui/components/Selo";
import { EstadoTabela, Tabela } from "../../ui/components/Tabela";
import { AJUDA } from "../../ui/textosAjuda";
import { CorrecaoImportacao } from "./CorrecaoImportacao";
import { quandoDeixaDeValer, vigenciaDaDiferenca, vigenciaPorExtenso } from "./vigencia";
import "./empresa.css";
import "./lote.css";

/** Máximo por página do motor; o lote inteiro é carregado para filtrar e buscar no cliente. */
const PAGINA_MOTOR = 500;
const PAGINA_TELA = 50;
const ESPERA_BUSCA_MS = 200;

type Filtro = "todos" | GrupoDiferenca;
const ORDEM: Record<GrupoDiferenca, number> = { novo: 0, alterado: 1, removido: 2 };
const NOME_GRUPO: Record<GrupoDiferenca, string> = { novo: "Novos", alterado: "Alterados", removido: "Removidos" };
const AJUDA_GRUPO: Record<GrupoDiferenca, string> = {
  novo: AJUDA.grupoNovos,
  alterado: AJUDA.grupoAlterados,
  removido: AJUDA.grupoRemovidos,
};
const DECIDIVEIS = new Set(["PENDENTE_APROVACAO", "BLOQUEADO"]);

const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

type Item = Diferenca & { grupo: GrupoDiferenca; busca: string };

/** Carrega todas as diferenças do lote, de 500 em 500. */
function useDiferencas(url: string) {
  const [dados, setDados] = useState<Item[] | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    setDados(null);
    setErro(null);
    (async () => {
      const todas: Diferenca[] = [];
      for (let offset = 0; ; offset += PAGINA_MOTOR) {
        const pagina = await api.get<Diferenca[]>(`${url}${consulta({ limit: PAGINA_MOTOR, offset })}`);
        todas.push(...pagina);
        if (pagina.length < PAGINA_MOTOR) break;
      }
      return todas
        .map((d) => ({
          ...d,
          grupo: grupoDaDiferenca(d.tipo),
          busca: normalizar(`${d.descricao} ${d.ncm} ${d.item_id ?? ""}`),
        }))
        // A chave do item é descrição + NCM (não há código de produto).
        .sort((a, b) => ORDEM[a.grupo] - ORDEM[b.grupo] || a.descricao.localeCompare(b.descricao, "pt-BR") || a.ncm.localeCompare(b.ncm));
    })()
      .then((itens) => ativo && setDados(itens))
      .catch((e: unknown) => ativo && setErro(e));
    return () => {
      ativo = false;
    };
  }, [url, versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { dados, erro, carregando: !dados && !erro, recarregar };
}

/** Texto atrasado (debounce) para a busca. */
function useAtrasado(valor: string, ms: number) {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const id = window.setTimeout(() => setAtrasado(valor), ms);
    return () => window.clearTimeout(id);
  }, [valor, ms]);
  return atrasado;
}

function contarPorGrupo(itens: Item[]): Record<GrupoDiferenca, number> {
  const c = { novo: 0, alterado: 0, removido: 0 };
  for (const d of itens) c[d.grupo]++;
  return c;
}

export function DetalheLote({ base, id, voltar, aoDecidir }: { base: string; id: string; voltar: () => void; aoDecidir: () => void }) {
  const admin = usePermissoes().pode(PERMISSOES.aprovarLotes);
  const url = `${base}/lotes/${id}`;
  const lote = useCarregar<Lote>(url);
  const difs = useDiferencas(`${url}/diferencas`);

  const [selecao, setSelecao] = useState<Set<number>>(new Set());
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [texto, setTexto] = useState("");
  const termo = normalizar(useAtrasado(texto, ESPERA_BUSCA_MS).trim());
  const [soSelecionados, setSoSelecionados] = useState(false);
  const [limite, setLimite] = useState(PAGINA_TELA);
  const [confirmarRemocoes, setConfirmarRemocoes] = useState(false);
  const [rejeitar, setRejeitar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroAcao, setErroAcao] = useState<unknown>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [revendo, setRevendo] = useState(false);

  const dados = lote.dados;
  const itens = difs.dados;
  const decidivel = !!dados && DECIDIVEIS.has(dados.status);
  const bloqueado = !!dados && (dados.status === "BLOQUEADO" || dados.bloqueios.length > 0);
  // ADR-009 do motor: problemas da importação que o operador resolve aqui, sem reenviar o arquivo.
  const corrigivel = !!dados && dados.status === "BLOQUEADO" && !!dados.resumo.corrigivel;
  const decisoesGravadas = dados?.status === "PENDENTE_APROVACAO" ? (dados.resumo.correcoes?.decisoes ?? 0) : 0;
  const selecionavel = admin && dados?.status === "PENDENTE_APROVACAO" && !!itens && itens.length > 0;

  // Seleção inicial = comportamento atual do sistema: o lote inteiro (todos marcados).
  useEffect(() => {
    if (selecionavel && itens) setSelecao(new Set(itens.map((d) => d.id)));
  }, [selecionavel, itens]);

  useEffect(() => setLimite(PAGINA_TELA), [filtro, termo, soSelecionados]);

  const filtrados = useMemo(
    () =>
      (itens ?? []).filter(
        (d) =>
          (filtro === "todos" || d.grupo === filtro) &&
          (!termo || d.busca.includes(termo)) &&
          (!soSelecionados || selecao.has(d.id)),
      ),
    [itens, filtro, termo, soSelecionados, selecao],
  );
  const visiveis = filtrados.slice(0, limite);
  const contagens = contarPorGrupo(itens ?? []);
  const selecionados = (itens ?? []).filter((d) => selecao.has(d.id));
  const contagemSel = contarPorGrupo(selecionados);
  const total = itens?.length ?? 0;
  const nSel = selecionavel ? selecao.size : total;
  const removidosSel = selecionavel ? contagemSel.removido : contagens.removido;

  function alternar(ids: number[], marcar: boolean) {
    setSelecao((atual) => {
      const nova = new Set(atual);
      for (const i of ids) {
        if (marcar) nova.add(i);
        else nova.delete(i);
      }
      return nova;
    });
  }

  /** Corpo da aprovação: nada (= todas), `diferencas` ou `excluir` – a lista menor, para caber no teto do BFF. */
  function corpoSelecao(): { diferencas?: number[]; excluir?: number[] } {
    if (!selecionavel || !itens || selecao.size === itens.length) return {};
    const escolhidas = [...selecao];
    const fora = itens.filter((d) => !selecao.has(d.id)).map((d) => d.id);
    return escolhidas.length <= fora.length ? { diferencas: escolhidas } : { excluir: fora };
  }

  async function aplicar(confirmar: boolean) {
    // Nenhum caminho (botão, Enter, diálogo) aplica lote bloqueado ou sem itens.
    if (!dados || bloqueado || enviando || nSel === 0 || dados.status !== "PENDENTE_APROVACAO") return;
    setErroAcao(null);
    setEnviando(true);
    try {
      await api.post(`${url}/aprovar`, { confirmar_remocoes: confirmar, ...corpoSelecao() });
      setConfirmarRemocoes(false);
      setSucesso(`Lote aplicado: ${formatarInteiro(nSel)} ${nSel === 1 ? "item gravado" : "itens gravados"} na memória.`);
      lote.recarregar();
      difs.recarregar();
      aoDecidir();
    } catch (e) {
      // Quem decide se a remoção precisa de confirmação é o motor (limite e base de cálculo dele).
      if (e instanceof ErroApi && e.codigo === "CONFIRMACAO_NECESSARIA" && !confirmar) setConfirmarRemocoes(true);
      else {
        setConfirmarRemocoes(false);
        setErroAcao(e);
      }
    } finally {
      setEnviando(false);
    }
  }

  async function rejeitarLote(motivo: string) {
    if (!dados || !decidivel || enviando) return;
    setErroAcao(null);
    setEnviando(true);
    try {
      await api.post(`${url}/rejeitar`, { motivo });
      setRejeitar(false);
      setSucesso("Lote rejeitado. A memória da empresa não foi alterada.");
      lote.recarregar();
      difs.recarregar();
      aoDecidir();
    } catch (e) {
      setRejeitar(false);
      setErroAcao(e);
    } finally {
      setEnviando(false);
    }
  }

  async function baixarRelatorio() {
    setErroAcao(null);
    try {
      await baixar(`${url}/relatorio.xlsx`, `lote_${id}.xlsx`);
    } catch (e) {
      setErroAcao(e);
    }
  }

  const voltarBotao = (
    <Botao variante="fantasma" onClick={voltar}>
      ‹ Voltar para Memória
    </Botao>
  );

  if (lote.erro && !dados) {
    const { codigo } = lerErro(lote.erro);
    return (
      <div className="lote">
        {voltarBotao}
        <Alerta
          tipo="erro"
          titulo="Não foi possível carregar o lote"
          meta={codigo}
          acoes={
            <>
              <Botao variante="primario" onClick={lote.recarregar}>
                Tentar de novo
              </Botao>
              <Botao onClick={voltar}>Voltar para Memória</Botao>
            </>
          }
        >
          {lerErro(lote.erro).mensagem} A memória da empresa não foi alterada.
        </Alerta>
      </div>
    );
  }

  if (!dados || (!itens && !difs.erro)) {
    return (
      <div className="lote" aria-busy="true">
        {voltarBotao}
        <p role="status" className="lote__carregando">
          Carregando o lote e comparando com a memória atual…
        </p>
        <div className="cartao lote__cabecalho" aria-hidden="true">
          <span className="esqueleto lote__esqueleto-titulo" />
          <span className="esqueleto" />
          <span className="esqueleto" />
        </div>
        <div className="lote__esqueleto-filtros" aria-hidden="true">
          <span className="esqueleto" />
        </div>
        <Tabela
          rotulo="Diferenças do lote"
          colunas={COLUNAS}
          estado={{ tipo: "carregando", titulo: "Carregando diferenças…" }}
          linhasEsqueleto={8}
          densidade="lote"
        />
      </div>
    );
  }

  const semDiferencas = itens?.length === 0;
  const grupoTexto = filtro === "todos" ? "Todos" : NOME_GRUPO[filtro];

  const motivoAplicar = bloqueado
    ? corrigivel
      ? "Lote bloqueado: resolva os problemas da importação."
      : "Lote bloqueado: corrija o arquivo e envie de novo."
    : nSel === 0
      ? "Selecione ao menos um item."
      : null;

  return (
    <div className="lote">
      {voltarBotao}
      {sucesso && <Alerta tipo="sucesso" titulo={sucesso} />}

      <CabecalhoLote lote={dados} baixarRelatorio={() => void baixarRelatorio()} />

      {dados.bloqueios.length > 0 && (
        <Alerta
          tipo="bloqueio"
          titulo={`Este lote não pode ser aplicado — ${dados.bloqueios.length} ${dados.bloqueios.length === 1 ? "bloqueio" : "bloqueios"}`}
          detalhes={dados.bloqueios}
        >
          {corrigivel
            ? "Resolva os problemas abaixo (sem enviar o arquivo de novo) ou corrija o arquivo e envie de novo. Rejeitar o lote continua disponível."
            : "Corrija o arquivo e envie de novo. Rejeitar o lote continua disponível."}
        </Alerta>
      )}
      {(corrigivel || revendo) && (
        <CorrecaoImportacao
          url={url}
          lote={dados}
          aoAtualizar={(mensagem) => {
            setSucesso(mensagem);
            setRevendo(false);
            lote.recarregar();
            difs.recarregar();
          }}
        />
      )}
      {decisoesGravadas > 0 && !revendo && (
        <Botao variante="fantasma" onClick={() => setRevendo(true)}>
          Rever correções ({decisoesGravadas})
        </Botao>
      )}
      {dados.avisos.length > 0 && (
        <Alerta
          tipo="aviso"
          titulo={`${dados.avisos.length} ${dados.avisos.length === 1 ? "aviso" : "avisos"} — não impedem a aplicação`}
          detalhes={dados.avisos}
        />
      )}

      {difs.erro ? (
        <Alerta
          tipo="erro"
          titulo="Não foi possível carregar as diferenças do lote"
          meta={lerErro(difs.erro).codigo}
          acoes={
            <Botao variante="primario" onClick={difs.recarregar}>
              Tentar de novo
            </Botao>
          }
        >
          {lerErro(difs.erro).mensagem} A memória da empresa não foi alterada.
        </Alerta>
      ) : semDiferencas ? (
        <EstadoTabela
          tipo="vazio"
          titulo="Nenhuma diferença neste lote"
          texto={
            bloqueado
              ? corrigivel
                ? "O motor compara os itens depois que os problemas da importação forem resolvidos."
                : "Com bloqueio, o motor não compara os itens: corrija o arquivo e envie de novo."
              : "O arquivo é igual à memória atual da empresa: não há nada para aplicar."
          }
        />
      ) : (
        <>
          <BarraFiltros>
            <GrupoFiltro<Filtro>
              rotulo="Tipo de diferença"
              valor={filtro}
              onChange={setFiltro}
              opcoes={[
                { valor: "todos", rotulo: "Todos", contagem: total },
                { valor: "novo", rotulo: "Novos", contagem: contagens.novo },
                { valor: "alterado", rotulo: "Alterados", contagem: contagens.alterado },
                { valor: "removido", rotulo: "Removidos", contagem: contagens.removido },
              ]}
              ajuda={
                <AjudaPopover
                  rotulo="Grupos do lote"
                  texto={`Novos: ${AJUDA.grupoNovos} Alterados: ${AJUDA.grupoAlterados} Removidos: ${AJUDA.grupoRemovidos}`}
                />
              }
            />
            <CampoBusca rotulo="Buscar no lote" placeholder="Descrição, NCM ou ID" valor={texto} onChange={setTexto} />
            {selecionavel && (
              <label className="lote__so-selecionados">
                <input type="checkbox" checked={soSelecionados} onChange={(e) => setSoSelecionados(e.target.checked)} />
                Só selecionados
              </label>
            )}
            <p className="lote__mostrando" aria-live="polite">
              {filtrados.length === 0
                ? "Nenhum item"
                : `Mostrando 1–${formatarInteiro(visiveis.length)} de ${formatarInteiro(filtrados.length)}`}
            </p>
          </BarraFiltros>

          <Tabela
            rotulo="Diferenças do lote"
            colunas={selecionavel ? COLUNAS_ADMIN : COLUNAS}
            densidade="lote"
            larguraMinima={980}
            estado={
              filtrados.length === 0
                ? {
                    tipo: "filtro-sem-resultado",
                    titulo: termo ? `Nenhum item corresponde a ‘${texto.trim()}’ em ${grupoTexto}` : `Nenhum item em ${grupoTexto}`,
                    acao: (
                      <Botao
                        tamanho="compacto"
                        onClick={() => {
                          setTexto("");
                          setSoSelecionados(false);
                          setFiltro("todos");
                        }}
                      >
                        Limpar busca
                      </Botao>
                    ),
                  }
                : null
            }
            corpo={
              <CorpoDiferencas
                visiveis={visiveis}
                filtrados={filtrados}
                agrupar={filtro === "todos"}
                lote={dados}
                selecionavel={selecionavel}
                selecao={selecao}
                alternar={alternar}
              />
            }
          />
          {visiveis.length < filtrados.length && (
            <div className="lote__mais">
              <Botao onClick={() => setLimite((l) => l + PAGINA_TELA)}>
                Carregar mais {Math.min(PAGINA_TELA, filtrados.length - visiveis.length)}
              </Botao>
            </div>
          )}
        </>
      )}

      {erroAcao !== null && (
        <Alerta tipo="erro" titulo="A decisão não foi registrada" meta={lerErro(erroAcao).codigo} detalhes={lerErro(erroAcao).detalhes}>
          {lerErro(erroAcao).mensagem}
        </Alerta>
      )}

      {decidivel && !admin && (
        <BarraAcoes resumo={<strong>Somente leitura: aplicar ou rejeitar o lote exige a permissão de aprovação de lotes.</strong>} />
      )}
      {decidivel && admin && (
        <BarraAcoes
          rotulo="Decisão do lote"
          resumo={
            <>
              <strong>
                {selecionavel
                  ? `${formatarInteiro(nSel)} de ${formatarInteiro(total)} itens selecionados`
                  : `${formatarInteiro(total)} ${total === 1 ? "item" : "itens"} no lote`}
              </strong>
              <span className="lote__detalhe-selecao">
                Novos {formatarInteiro(selecionavel ? contagemSel.novo : contagens.novo)} · Alterados{" "}
                {formatarInteiro(selecionavel ? contagemSel.alterado : contagens.alterado)} · Removidos {formatarInteiro(removidosSel)}
              </span>
            </>
          }
          acoes={
            <>
              <Botao variante="perigo" onClick={() => setRejeitar(true)} desabilitado={enviando}>
                Rejeitar lote
              </Botao>
              <span className="rotulo-com-ajuda">
                  <Botao
                    variante="primario"
                    carregando={enviando && !confirmarRemocoes}
                    desabilitadoMotivo={motivoAplicar}
                    icone={bloqueado ? <IconeCadeado /> : undefined}
                    onClick={() => void aplicar(false)}
                  >
                    Aplicar selecionados ({formatarInteiro(nSel)})
                  </Botao>
                  <AjudaPopover rotulo="Aplicar selecionados" texto={AJUDA.aplicarSelecionados} alinhar="fim" />
                </span>
            </>
          }
        />
      )}

      {decidivel && admin && (
        <>
          <DialogoRemocoes
            aberto={confirmarRemocoes}
            lote={dados}
            removidos={removidosSel}
            contagem={selecionavel ? contagemSel : contagens}
            enviando={enviando}
            cancelar={() => setConfirmarRemocoes(false)}
            revisar={() => {
              setConfirmarRemocoes(false);
              setFiltro("removido");
            }}
            aplicar={() => void aplicar(true)}
          />
          <DialogoRejeitar aberto={rejeitar} enviando={enviando} cancelar={() => setRejeitar(false)} rejeitar={(m) => void rejeitarLote(m)} />
        </>
      )}
    </div>
  );
}

const COLUNAS_BASE = [
  { chave: "tipo", titulo: "Tipo", celula: () => null },
  { chave: "descricao", titulo: "Descrição", celula: () => null },
  { chave: "ncm", titulo: "NCM", celula: () => null },
  { chave: "id", titulo: "ID", alinhar: "fim" as const, celula: () => null },
  { chave: "muda", titulo: "O que muda", celula: () => null },
  { chave: "vigencia", titulo: "Vigência", celula: () => null },
];
const COLUNAS = COLUNAS_BASE;
const COLUNAS_ADMIN = [{ chave: "sel", titulo: <span className="visualmente-oculto">Selecionar</span>, celula: () => null }, ...COLUNAS_BASE];

function CabecalhoLote({ lote, baixarRelatorio }: { lote: Lote; baixarRelatorio: () => void }) {
  const resumo = lote.resumo ?? {};
  const idTitulo = useId();
  return (
    <section className="cartao lote__cabecalho" aria-labelledby={idTitulo}>
      <div className="lote__titulo">
        <h2 id={idTitulo}>Lote de {formatarData(lote.criado_em)}</h2>
        <SeloLote status={lote.status} />
        <Botao tamanho="compacto" onClick={baixarRelatorio} className="lote__relatorio">
          Baixar relatório
        </Botao>
      </div>
      {lote.arquivo_nome && <p className="lote__arquivo">{lote.arquivo_nome}</p>}
      <dl className="lote__dados">
        <div>
          <dt>
            <span className="rotulo-com-ajuda">
              Tipo de envio
              <AjudaPopover rotulo={lote.tipo === "COMPLETA" ? "Completa" : "Parcial"} texto={lote.tipo === "COMPLETA" ? AJUDA.completa : AJUDA.parcial} />
            </span>
          </dt>
          <dd>{lote.tipo === "COMPLETA" ? "Completa" : lote.tipo === "PARCIAL" ? "Parcial" : lote.tipo}</dd>
        </div>
        <div>
          <dt>
            <span className="rotulo-com-ajuda">
              Vigência
              <AjudaPopover
                rotulo={vigenciaPorExtenso(lote).startsWith("Correção") ? "Correção de cadastro" : "Mudança a partir de"}
                texto={vigenciaPorExtenso(lote).startsWith("Correção") ? AJUDA.correcao : AJUDA.mudanca}
              />
            </span>
          </dt>
          <dd>{vigenciaPorExtenso(lote)}</dd>
        </div>
        <div>
          <dt>Enviado por</dt>
          <dd>
            {lote.enviado_por} em {formatarData(lote.criado_em)}
          </dd>
        </div>
        <div>
          <dt>Memória atual</dt>
          <dd>{resumo.itens_memoria_atual !== undefined ? `${formatarInteiro(resumo.itens_memoria_atual)} itens` : "—"}</dd>
        </div>
        {lote.decidido_por && (
          <div>
            <dt>Decidido por</dt>
            <dd>
              {lote.decidido_por} em {formatarData(lote.decidido_em)}
              {resumo.aplicadas !== undefined &&
                ` · ${formatarInteiro(resumo.aplicadas)} aplicados, ${formatarInteiro(resumo.nao_aplicadas ?? 0)} fora`}
            </dd>
          </div>
        )}
        {lote.motivo && (
          <div>
            <dt>Motivo</dt>
            <dd>{lote.motivo}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

/** Caixa de grupo: marcada, desmarcada ou mista (`indeterminate`). */
function CaixaGrupo({ estado, rotulo, onChange }: { estado: "todos" | "nenhum" | "alguns"; rotulo: string; onChange: (marcar: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = estado === "alguns";
  }, [estado]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="lote__caixa"
      aria-label={rotulo}
      checked={estado === "todos"}
      onChange={() => onChange(estado !== "todos")}
    />
  );
}

function CorpoDiferencas({
  visiveis,
  filtrados,
  agrupar,
  lote,
  selecionavel,
  selecao,
  alternar,
}: {
  visiveis: Item[];
  filtrados: Item[];
  agrupar: boolean;
  lote: Lote;
  selecionavel: boolean;
  selecao: Set<number>;
  alternar: (ids: number[], marcar: boolean) => void;
}) {
  const colunas = selecionavel ? 7 : 6;
  const linhas: ReactNode[] = [];
  let grupoAtual: GrupoDiferenca | null = null;

  for (const d of visiveis) {
    if (agrupar && d.grupo !== grupoAtual) {
      grupoAtual = d.grupo;
      const doGrupo = filtrados.filter((x) => x.grupo === d.grupo);
      const marcados = doGrupo.filter((x) => selecao.has(x.id)).length;
      const estado = marcados === 0 ? "nenhum" : marcados === doGrupo.length ? "todos" : "alguns";
      linhas.push(
        <tr key={`grupo-${d.grupo}`} className="lote__grupo">
          <th scope="colgroup" colSpan={colunas}>
            <span className="lote__grupo-conteudo">
              {selecionavel && (
                <CaixaGrupo
                  estado={estado}
                  rotulo={`Selecionar todos os ${doGrupo.length} ${NOME_GRUPO[d.grupo].toLowerCase()}`}
                  onChange={(marcar) => alternar(doGrupo.map((x) => x.id), marcar)}
                />
              )}
              {NOME_GRUPO[d.grupo]} ({formatarInteiro(doGrupo.length)})
              <AjudaPopover rotulo={NOME_GRUPO[d.grupo]} texto={AJUDA_GRUPO[d.grupo]} />
            </span>
          </th>
        </tr>,
      );
    }
    const marcado = selecionavel && selecao.has(d.id);
    linhas.push(
      <tr
        key={d.id}
        data-desmarcada={(selecionavel && !marcado) || d.aplicada === false || undefined}
      >
        {selecionavel && (
          <td>
            <input
              type="checkbox"
              className="lote__caixa"
              aria-label={`Incluir ${d.descricao} (NCM ${d.ncm})`}
              checked={marcado}
              onChange={(e) => alternar([d.id], e.target.checked)}
            />
          </td>
        )}
        <td>
          <ChipDiferenca tipo={d.grupo} />
          {d.aplicada === false && <span className="lote__nao-aplicada">Não aplicado</span>}
        </td>
        <td className="lote__descricao">{d.grupo === "removido" ? <del>{d.descricao}</del> : d.descricao}</td>
        <td>{d.ncm}</td>
        {/* ID da memória: item novo só ganha número quando o lote é aplicado. */}
        <td data-alinhar="fim">{d.item_id ?? <span className="tabela__ausente">—</span>}</td>
        <td>
          <OQueMuda d={d} />
        </td>
        <td className="lote__vigencia">{vigenciaDaDiferenca(d.tipo, lote)}</td>
      </tr>,
    );
  }
  return <tbody>{linhas}</tbody>;
}

/** Um campo por linha: rótulo, antes riscado → depois em destaque. Novos: só o novo. Removidos: só o antigo. */
function OQueMuda({ d }: { d: Item }) {
  const campos: { rotulo: string; antes: string | null; depois: string | null }[] = [];
  if (d.grupo === "novo") {
    campos.push({ rotulo: "ICMS", antes: null, depois: d.icms_novo });
    if (d.pis_novo) campos.push({ rotulo: "PIS/COFINS", antes: null, depois: d.pis_novo });
  } else if (d.grupo === "removido") {
    campos.push({ rotulo: "ICMS", antes: d.icms_anterior, depois: null });
    if (d.pis_anterior) campos.push({ rotulo: "PIS/COFINS", antes: d.pis_anterior, depois: null });
  } else {
    if (d.icms_anterior !== d.icms_novo) campos.push({ rotulo: "ICMS", antes: d.icms_anterior, depois: d.icms_novo });
    if (d.pis_anterior !== d.pis_novo) campos.push({ rotulo: "PIS/COFINS", antes: d.pis_anterior, depois: d.pis_novo });
  }
  return (
    <ul className="lote__mudancas">
      {campos.map((c) => (
        <li key={c.rotulo}>
          <span className="lote__campo">{c.rotulo}:</span>{" "}
          {c.antes !== null && (
            <>
              <span className="visualmente-oculto">antes </span>
              <del className="lote__antes">{c.antes || "(vazio)"}</del>
            </>
          )}
          {c.antes !== null && c.depois !== null && (
            <>
              {" "}
              <span aria-hidden="true">→</span>
              <span className="visualmente-oculto"> passa a ser </span>{" "}
            </>
          )}
          {c.depois !== null && <strong className="lote__depois">{c.depois || "(vazio)"}</strong>}
        </li>
      ))}
    </ul>
  );
}

function DialogoRemocoes({
  aberto,
  lote,
  removidos,
  contagem,
  enviando,
  cancelar,
  revisar,
  aplicar,
}: {
  aberto: boolean;
  lote: Lote;
  removidos: number;
  contagem: Record<GrupoDiferenca, number>;
  enviando: boolean;
  cancelar: () => void;
  revisar: () => void;
  aplicar: () => void;
}) {
  const [revisei, setRevisei] = useState(false);
  useEffect(() => {
    if (!aberto) setRevisei(false);
  }, [aberto]);
  const resumo = lote.resumo ?? {};
  const base = resumo.itens_memoria_atual;
  const total = contagem.novo + contagem.alterado + contagem.removido;
  const n = formatarInteiro(removidos);

  return (
    <Dialogo
      titulo={`Confirmar remoção de ${n} itens`}
      aberto={aberto}
      onFechar={cancelar}
      acoes={
        <>
          <Botao onClick={revisar}>Voltar e revisar</Botao>
          <Botao
            variante="primario"
            carregando={enviando}
            desabilitadoMotivo={revisei ? null : "Marque a confirmação acima."}
            onClick={aplicar}
          >
            Aplicar {formatarInteiro(total)} itens
          </Botao>
        </>
      }
    >
      <p>
        As remoções passam do limite que o motor aceita sem confirmação
        {resumo.limite_remocao !== undefined && ` (${formatarPercentual(resumo.limite_remocao, 0)} da memória atual)`}.
      </p>
      {base ? (
        <p className="lote__percentual">
          {formatarPercentual(removidos / base)} dos {formatarInteiro(base)} itens da memória atual
        </p>
      ) : null}
      <p>
        Novos {formatarInteiro(contagem.novo)} · Alterados {formatarInteiro(contagem.alterado)} · Removidos {n}
      </p>
      <p>Vigência: {vigenciaPorExtenso(lote)}</p>
      <label className="lote__confirmacao">
        <input type="checkbox" checked={revisei} onChange={(e) => setRevisei(e.target.checked)} />
        Revisei os {n} itens removidos e confirmo que deixam de valer {quandoDeixaDeValer(lote)}
      </label>
    </Dialogo>
  );
}

function DialogoRejeitar({
  aberto,
  enviando,
  cancelar,
  rejeitar,
}: {
  aberto: boolean;
  enviando: boolean;
  cancelar: () => void;
  rejeitar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const id = useId();
  useEffect(() => {
    if (!aberto) setMotivo("");
  }, [aberto]);
  return (
    <Dialogo
      titulo="Rejeitar lote"
      aberto={aberto}
      onFechar={cancelar}
      acoes={
        <>
          <Botao onClick={cancelar}>Cancelar</Botao>
          <Botao
            variante="perigo"
            carregando={enviando}
            desabilitadoMotivo={motivo.trim() ? null : "Informe o motivo."}
            onClick={() => rejeitar(motivo.trim())}
          >
            Rejeitar lote
          </Botao>
        </>
      }
    >
      <p>Nada deste lote será gravado na memória.</p>
      <label htmlFor={id} className="lote__rotulo">
        Motivo da rejeição
      </label>
      <textarea id={id} className="lote__motivo" required maxLength={500} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
    </Dialogo>
  );
}
