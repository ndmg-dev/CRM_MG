import { Fragment, useEffect, useState, type FormEvent } from "react";

import { api, consulta } from "../../api";
import { AjudaPopover } from "../../ui/components/AjudaPopover";
import { Alerta, lerErro } from "../../ui/components/Alerta";
import { Botao } from "../../ui/components/Botao";
import { Campo } from "../../ui/components/Campo";
import { GrupoFiltro } from "../../ui/components/Filtros";
import { Tabela, type Coluna } from "../../ui/components/Tabela";
import { AJUDA } from "../../ui/textosAjuda";
import { MensagemErro, Paginacao, useCarregarComTotal, Valor } from "../../componentes/comuns";
import { categoriasDasRegras, useRegras } from "../../componentes/regras";
import { formatarData, formatarInteiro, rotulo } from "../../formato";
import type { Pendencia, ResultadoResolucao, SugestaoPendencia } from "../../tipos";
import { aceitaveis, partir, RESULTADO_VAZIO, resolucoesComTributacao, resolucoesPorSugestao, resumirResolucao, somarResultados, type Resolucao } from "./pendenciasLote";
import { ResumoPendencias } from "./ResumoPendencias";
import "./empresa.css";

const LIMITE = 100;

type Acao = { tipo: "resolver" | "descartar"; pendencia: Pendencia } | null;

export function AbaPendencias({ codigo }: { codigo: string }) {
  const [status, setStatus] = useState("ABERTA");
  const [offset, setOffset] = useState(0);
  const [acao, setAcao] = useState<Acao>(null);
  const [tributacao, setTributacao] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const base = `/api/empresas/${encodeURIComponent(codigo)}`;
  // Só as abertas levam sugestão da memória (o motor calcula na hora, por NCM).
  const lista = useCarregarComTotal<Pendencia[]>(
    `${base}/pendencias${consulta({ status, limit: LIMITE, offset, sugestoes: status === "ABERTA" ? true : undefined })}`,
  );
  const [versaoResumo, setVersaoResumo] = useState(0); // remonta o resumo (panorama de TODAS as páginas) quando a lista muda
  const [sobrescrever, setSobrescrever] = useState(false); // padrão: o que já está na memória permanece
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [tributacaoLote, setTributacaoLote] = useState("");
  useEffect(() => setSelecionadas(new Set()), [lista.dados]); // lista nova (ação, página, filtro): seleção nova
  // Resolver sem mês = correção: vale contra as regras atuais (o motor valida grafia e apelidos e grava o nome canônico).
  const regras = useRegras();
  const categorias = categoriasDasRegras(regras.dados);

  function abrir(tipo: "resolver" | "descartar", pendencia: Pendencia) {
    setAcao({ tipo, pendencia });
    setTributacao("");
    setMotivo("");
    setErro(null);
    setMensagem(null);
  }

  async function confirmar(evento: FormEvent) {
    evento.preventDefault();
    if (!acao) return;
    setEnviando(true);
    setErro(null);
    const url = `${base}/pendencias/${acao.pendencia.id}/${acao.tipo}`;
    try {
      if (acao.tipo === "resolver") {
        // Item novo vale para todos os meses: não há mês a informar.
        await api.post(url, { tributacao });
        setMensagem(`${acao.pendencia.descricao} (NCM ${acao.pendencia.ncm}) cadastrado na memória como ${tributacao}.`);
      } else {
        await api.post(url, { motivo: motivo.trim() });
        setMensagem(`Pendência de ${acao.pendencia.descricao} (NCM ${acao.pendencia.ncm}) descartada.`);
      }
      setAcao(null);
      setVersaoResumo((v) => v + 1);
      lista.recarregar();
    } catch (e) {
      setErro(e);
    } finally {
      setEnviando(false);
    }
  }

  const abertas = status === "ABERTA";
  const itens = lista.dados ?? [];
  const nAceitaveis = aceitaveis(itens).length;
  const porSugestao = resolucoesPorSugestao(itens, selecionadas);

  function alternar(id: number, marcar: boolean) {
    setSelecionadas((atual) => {
      const nova = new Set(atual);
      if (marcar) nova.add(id);
      else nova.delete(id);
      return nova;
    });
  }

  /** Envia em blocos (limite do corpo do BFF); cada bloco é um lote do motor, tudo ou nada para pedido errado. Para no primeiro erro e diz
   *  quantas já foram. Item que já está na memória é MANTIDO (a menos que `sobrescrever`): o motor diz quantos em cada caso. */
  async function enviarLote(resolucoes: Resolucao[]) {
    if (!resolucoes.length || enviando) return;
    setEnviando(true);
    setErro(null);
    setMensagem(null);
    let total: ResultadoResolucao = RESULTADO_VAZIO;
    try {
      for (const parte of partir(resolucoes)) {
        const r = await api.post<ResultadoResolucao>(`${base}/pendencias/resolver-lote`, { resolucoes: parte, sobrescrever });
        total = somarResultados(total, r);
      }
      setMensagem(resumirResolucao(total));
    } catch (e) {
      setErro(e);
      if (total.resolvidas > 0) setMensagem(`${resumirResolucao(total).replace(/\.$/, "")} — antes do erro.`);
    } finally {
      setEnviando(false);
      setVersaoResumo((v) => v + 1);
      lista.recarregar();
    }
  }

  async function aceitarUma(p: Pendencia, sugestao: SugestaoPendencia) {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    setMensagem(null);
    try {
      await api.post(`${base}/pendencias/${p.id}/resolver`, { tributacao: sugestao.icms });
      setMensagem(`${p.descricao} (NCM ${p.ncm}) cadastrado na memória como ${sugestao.icms}, a mesma tributação de ${sugestao.descricao}.`);
      setVersaoResumo((v) => v + 1);
      lista.recarregar();
    } catch (e) {
      setErro(e);
    } finally {
      setEnviando(false);
    }
  }

  const colunas: Coluna<Pendencia>[] = [
    ...(abertas
      ? [
          {
            chave: "selecao",
            titulo: (
              <input
                type="checkbox"
                aria-label="Selecionar todas desta página"
                checked={itens.length > 0 && selecionadas.size === itens.length}
                onChange={(e) => setSelecionadas(e.target.checked ? new Set(itens.map((p) => p.id)) : new Set())}
              />
            ),
            celula: (p: Pendencia) => (
              <input
                type="checkbox"
                aria-label={`Selecionar ${p.descricao}`}
                checked={selecionadas.has(p.id)}
                onChange={(e) => alternar(p.id, e.target.checked)}
              />
            ),
          } satisfies Coluna<Pendencia>,
        ]
      : []),
    { chave: "descricao", titulo: "Descrição", celula: (p) => p.descricao },
    { chave: "ncm", titulo: "NCM", celula: (p) => p.ncm },
    ...(abertas
      ? [
          {
            chave: "sugestao",
            titulo: (
              <span className="rotulo-com-ajuda">
                Sugestão da memória
                <AjudaPopover rotulo="Sugestão da memória" texto={AJUDA.sugestaoMemoria} />
              </span>
            ),
            celula: (p: Pendencia) => <CelulaSugestao pendencia={p} />,
          } satisfies Coluna<Pendencia>,
        ]
      : []),
    { chave: "cfop", titulo: "CFOP ex.", alinhar: "fim", celula: (p) => p.cfop_exemplo ?? <span className="tabela__ausente">—</span> },
    { chave: "ocorrencias", titulo: "Ocorrências", alinhar: "fim", celula: (p) => formatarInteiro(p.ocorrencias) },
    { chave: "valor", titulo: "Valor (R$)", alinhar: "fim", celula: (p) => <Valor valor={p.valor_total} /> },
    {
      chave: "acao",
      titulo: status === "ABERTA" ? <span className="visualmente-oculto">Ações</span> : "Decisão",
      alinhar: status === "ABERTA" ? "fim" : undefined,
      celula: (p) =>
        p.status === "ABERTA" ? (
          <span className="pendencias__acoes">
            {p.sugestoes?.[0] && (
              <Botao variante="fantasma" desabilitado={enviando} onClick={() => void aceitarUma(p, p.sugestoes![0])}>
                Aceitar sugestão
              </Botao>
            )}
            <Botao variante="fantasma" desabilitado={acao?.pendencia.id === p.id && acao.tipo === "resolver"} onClick={() => abrir("resolver", p)}>
              Resolver
            </Botao>
            <Botao variante="fantasma" desabilitado={acao?.pendencia.id === p.id && acao.tipo === "descartar"} onClick={() => abrir("descartar", p)}>
              Descartar
            </Botao>
          </span>
        ) : (
          <span className="pendencias__decisao">
            {p.tributacao_definida ?? rotulo(p.status)}
            <span className="pendencias__quem">
              {p.resolvido_por ?? "—"} · {formatarData(p.resolvido_em)}
            </span>
          </span>
        ),
    },
  ];

  const corpo = (
    <tbody>
      {(lista.dados ?? []).map((p) => (
        <Fragment key={p.id}>
          <tr>
            {colunas.map((c) => (
              <td key={c.chave} data-alinhar={c.alinhar} className={c.classe}>
                {c.celula(p)}
              </td>
            ))}
          </tr>
          {acao?.pendencia.id === p.id && (
            <tr className="pendencias__formulario">
              <td colSpan={colunas.length}>
                <form className="pendencias__campos" onSubmit={confirmar}>
                  {acao.tipo === "resolver" ? (
                    <>
                      <Campo rotulo="Tributação">
                        {categorias.length > 0 ? (
                          <select className="campo__controle" required value={tributacao} onChange={(e) => setTributacao(e.target.value)}>
                            <option value="">Escolha…</option>
                            {categorias.map((c) => (
                              <option key={c.nome} value={c.nome}>
                                {c.grupo && c.grupo !== c.nome ? `${c.nome} (${c.grupo})` : c.nome}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input className="campo__controle" required maxLength={60} value={tributacao} onChange={(e) => setTributacao(e.target.value)} />
                        )}
                      </Campo>
                      <span className="rotulo-com-ajuda pendencias__nota">
                        Item novo: vale para todos os meses.
                        <AjudaPopover rotulo="Itens novos" texto={AJUDA.itensNovos} />
                      </span>
                    </>
                  ) : (
                    <Campo rotulo="Motivo do descarte" className="pendencias__motivo">
                      <input className="campo__controle" required maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                    </Campo>
                  )}
                  <span className="pendencias__botoes">
                    <Botao
                      type="submit"
                      variante={acao.tipo === "resolver" ? "primario" : "perigo"}
                      carregando={enviando}
                      desabilitado={acao.tipo === "descartar" && !motivo.trim()}
                    >
                      {acao.tipo === "resolver" ? "Gravar na memória" : "Descartar"}
                    </Botao>
                    <Botao variante="fantasma" onClick={() => setAcao(null)}>
                      Cancelar
                    </Botao>
                  </span>
                </form>
                <MensagemErro erro={erro} />
              </td>
            </tr>
          )}
        </Fragment>
      ))}
    </tbody>
  );

  return (
    <div className="pendencias">
      <div className="pendencias__cabecalho">
        <h2 className="rotulo-com-ajuda">
          Pendências
          <AjudaPopover rotulo="Pendências" texto={AJUDA.pendencias} />
        </h2>
        <GrupoFiltro
          rotulo="Situação das pendências"
          valor={status === "ABERTA" ? "ABERTA" : "TODAS"}
          onChange={(v) => {
            setStatus(v === "ABERTA" ? "ABERTA" : "");
            setOffset(0);
          }}
          opcoes={[
            { valor: "ABERTA", rotulo: "Abertas" },
            { valor: "TODAS", rotulo: "Todas" },
          ]}
        />
      </div>
      {mensagem && <Alerta tipo="sucesso" titulo={mensagem} />}
      {regras.erro !== null && status === "ABERTA" && (
        <Alerta tipo="aviso" titulo="Não foi possível ler as categorias das regras fiscais" abertoInicialmente>
          Digite a tributação manualmente; o motor confere a grafia.
        </Alerta>
      )}

      {abertas && (
        <ResumoPendencias
          key={versaoResumo}
          base={base}
          aoResolver={(texto) => {
            setMensagem(texto);
            setErro(null);
            setOffset(0);
            setVersaoResumo((v) => v + 1);
            lista.recarregar();
          }}
        />
      )}
      {abertas && itens.length > 0 && (
        <div className="pendencias__lote" role="group" aria-label="Resolver várias pendências de uma vez">
          <span className="pendencias__lote-resumo" role="status">
            {formatarInteiro(selecionadas.size)} {selecionadas.size === 1 ? "selecionada" : "selecionadas"}
          </span>
          <Botao
            tamanho="compacto"
            desabilitado={nAceitaveis === 0 || enviando}
            onClick={() => setSelecionadas(new Set(aceitaveis(itens).map((p) => p.id)))}
          >
            Selecionar idênticas ({nAceitaveis})
          </Botao>
          <span className="rotulo-com-ajuda">
            <Botao
              variante="primario"
              tamanho="compacto"
              carregando={enviando}
              desabilitado={porSugestao.length === 0}
              onClick={() => void enviarLote(porSugestao)}
            >
              Aceitar sugestão das selecionadas ({porSugestao.length})
            </Botao>
            <AjudaPopover rotulo="Aceitar sugestão" texto={AJUDA.aceitarIdenticas} />
          </span>
          <span className="rotulo-com-ajuda">
            <label className="pendencias__sobrescrever">
              <input type="checkbox" checked={sobrescrever} onChange={(e) => setSobrescrever(e.target.checked)} />
              Sobrescrever os que já estão na memória
            </label>
            <AjudaPopover rotulo="Sobrescrever" texto={AJUDA.sobrescrever} />
          </span>
          <span className="rotulo-com-ajuda pendencias__lote-tributacao">
            <select
              className="campo__controle"
              aria-label="Tributação para as selecionadas"
              value={tributacaoLote}
              onChange={(e) => setTributacaoLote(e.target.value)}
            >
              <option value="">Tributação…</option>
              {categorias.map((c) => (
                <option key={c.nome} value={c.nome}>
                  {c.grupo && c.grupo !== c.nome ? `${c.nome} (${c.grupo})` : c.nome}
                </option>
              ))}
            </select>
            <Botao
              tamanho="compacto"
              carregando={enviando}
              desabilitado={!tributacaoLote || selecionadas.size === 0}
              onClick={() => void enviarLote(resolucoesComTributacao(itens, selecionadas, tributacaoLote))}
            >
              Gravar tributação nas selecionadas
            </Botao>
            <AjudaPopover rotulo="Tributação em lote" texto={AJUDA.tributacaoEmLote} alinhar="fim" />
          </span>
        </div>
      )}
      {erro != null && !acao && <MensagemErro erro={erro} />}

      <Tabela
        rotulo="Pendências"
        colunas={colunas}
        corpo={corpo}
        larguraMinima={980}
        estado={
          lista.carregando
            ? { tipo: "carregando", titulo: "Carregando pendências…" }
            : lista.erro
              ? {
                  tipo: "erro",
                  titulo: "Não foi possível carregar as pendências",
                  texto: lerErro(lista.erro).mensagem,
                  acao: (
                    <Botao tamanho="compacto" variante="primario" onClick={lista.recarregar}>
                      Tentar de novo
                    </Botao>
                  ),
                }
              : lista.dados?.length === 0
                ? status === "ABERTA"
                  ? { tipo: "vazio", titulo: "Nenhuma pendência aberta", texto: "Todos os produtos vendidos estão na memória da empresa." }
                  : { tipo: "vazio", titulo: "Nenhuma pendência registrada" }
                : null
        }
      />
      <Paginacao offset={offset} limite={LIMITE} quantidade={lista.dados?.length ?? 0} mudar={setOffset} total={lista.total} />
    </div>
  );
}

/** Até 2 sugestões da memória (mesma NCM): nível, descrição do item e a tributação que ele tem. */
function CelulaSugestao({ pendencia }: { pendencia: Pendencia }) {
  const sugestoes = pendencia.sugestoes ?? [];
  if (sugestoes.length === 0) return <span className="tabela__ausente">sem sugestão</span>;
  return (
    <ul className="sugestoes">
      {sugestoes.slice(0, 2).map((s) => (
        <li key={s.item_id} className="sugestoes__item">
          <span className="sugestoes__nivel" data-nivel={s.nivel}>
            {s.nivel === "IDENTICO" ? "Idêntico" : `Parecido ${Math.round(s.similaridade * 100)}%`}
          </span>
          <span className="sugestoes__texto">{s.descricao}</span>
          <span className="sugestoes__icms">{s.icms}</span>
        </li>
      ))}
    </ul>
  );
}
