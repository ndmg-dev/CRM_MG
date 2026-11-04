import { useEffect, useMemo, useState } from "react";

import { api, baixar } from "../../api";
import { Paginacao, useCarregar } from "../../componentes/comuns";
import { formatarInteiro } from "../../formato";
import type { Lote, ProblemaCategoria, ProblemaConflito, ProblemaLinha, ProblemasLote } from "../../tipos";
import { AjudaPopover } from "../../ui/components/AjudaPopover";
import { Alerta, lerErro } from "../../ui/components/Alerta";
import { Botao } from "../../ui/components/Botao";
import { Tabela, type Coluna } from "../../ui/components/Tabela";
import { AJUDA } from "../../ui/textosAjuda";
import {
  chaveConflito,
  escolhasIniciais,
  IGNORAR,
  MAX_DECISOES,
  montarDecisoes,
  valorCategoria,
  type Escolhas,
} from "./correcao";
import "./correcao.css";

const POR_PAGINA = 50; // as listas chegam inteiras do motor (até 500); a tela mostra uma página por vez

const plural = (n: number, um: string, varios: string) => `${formatarInteiro(n)} ${n === 1 ? um : varios}`;

/**
 * Correção da importação da memória (ADR-009 do motor). Lote com linha inválida, categoria de ICMS desconhecida ou conflito
 * não precisa ser reenviado: o operador escolhe o que fazer com cada problema e o motor reavalia o arquivo salvo. Nada é gravado
 * na memória aqui; a aprovação continua sendo o passo seguinte, com a mesma tela de diferenças.
 */
export function CorrecaoImportacao({ url, lote, aoAtualizar }: { url: string; lote: Lote; aoAtualizar: (mensagem: string) => void }) {
  const problemas = useCarregar<ProblemasLote>(`${url}/problemas`);
  const dados = problemas.dados;
  const [escolhas, setEscolhas] = useState<Escolhas | null>(null);
  const [inicial, setInicial] = useState("[]");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);

  // Escolhas iniciais = decisões já gravadas (para rever). Recomeça a cada leitura do motor (depois de aplicar ou reavaliar).
  useEffect(() => {
    if (!dados) return;
    const e = escolhasIniciais(dados);
    setEscolhas(e);
    setInicial(JSON.stringify(montarDecisoes(dados, e)));
  }, [dados]);

  const decisoes = useMemo(() => (dados && escolhas ? montarDecisoes(dados, escolhas) : []), [dados, escolhas]);
  const alterado = JSON.stringify(decisoes) !== inicial;

  async function aplicar() {
    if (!dados || enviando) return;
    if (decisoes.length > MAX_DECISOES) {
      setErro(new Error(`São ${decisoes.length} decisões e o limite por envio é ${MAX_DECISOES}. Baixe a planilha dos problemas, corrija no Excel e envie como lote parcial.`));
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const novo = await api.put<Lote>(`${url}/correcoes`, { correcoes: decisoes });
      // O pai recarrega o lote (e remonta esta tela): a mensagem fica no alerta de sucesso dele.
      aoAtualizar(
        novo.status === "BLOQUEADO"
          ? `Correções gravadas. Ainda há ${plural(novo.resumo.problemas?.total ?? 0, "problema", "problemas")} a resolver.`
          : "Correções gravadas. Sem problemas pendentes: confira as diferenças e aplique o lote.",
      );
    } catch (e) {
      setErro(e);
    } finally {
      setEnviando(false);
    }
  }

  async function reavaliar() {
    if (enviando) return;
    setErro(null);
    setEnviando(true);
    try {
      await api.post(`${url}/reavaliar`);
      aoAtualizar("Lote reavaliado com as regras fiscais atuais.");
    } catch (e) {
      setErro(e);
    } finally {
      setEnviando(false);
    }
  }

  async function baixarPlanilha() {
    setErro(null);
    try {
      await baixar(`${url}/problemas.xlsx`, `problemas_lote_${lote.id}.xlsx`);
    } catch (e) {
      setErro(e);
    }
  }

  if (problemas.erro && !dados) {
    return (
      <Alerta
        tipo="erro"
        titulo="Não foi possível carregar os problemas do lote"
        meta={lerErro(problemas.erro).codigo}
        acoes={
          <Botao variante="primario" onClick={problemas.recarregar}>
            Tentar de novo
          </Botao>
        }
      >
        {lerErro(problemas.erro).mensagem} A memória da empresa não foi alterada.
      </Alerta>
    );
  }
  if (!dados || !escolhas) {
    return (
      <p role="status" className="lote__carregando" aria-busy="true">
        Lendo o arquivo do lote… pode levar alguns segundos em planilhas grandes.
      </p>
    );
  }

  const pend = dados.pendentes;
  const mudar = (parcial: Partial<Escolhas>) => setEscolhas({ ...escolhas, ...parcial });

  return (
    <section className="correcao" aria-labelledby="correcao-titulo">
      <header className="correcao__cabecalho">
        <h3 id="correcao-titulo" className="correcao__titulo rotulo-com-ajuda">
          Corrigir a importação
          <AjudaPopover rotulo="Corrigir a importação" texto={AJUDA.correcaoImportacao} />
        </h3>
        <p className="correcao__resumo" role="status">
          {pend.total === 0
            ? "Nenhum problema pendente."
            : `${plural(pend.total, "problema pendente", "problemas pendentes")}: ${plural(pend.linhas_invalidas, "linha inválida", "linhas inválidas")}, ${plural(pend.categorias, "categoria desconhecida", "categorias desconhecidas")} (${plural(pend.categorias_linhas, "linha", "linhas")}), ${plural(pend.conflitos, "conflito", "conflitos")}.`}
        </p>
      </header>

      {erro != null && (
        <Alerta tipo="erro" titulo="Não foi possível gravar as correções" meta={lerErro(erro).codigo} detalhes={lerErro(erro).detalhes}>
          {lerErro(erro).mensagem} A memória da empresa não foi alterada.
        </Alerta>
      )}

      {dados.categorias.length > 0 && (
        <SecaoCategorias
          categorias={dados.categorias}
          validas={dados.categorias_validas}
          escolhas={escolhas.categorias}
          aoEscolher={(texto, valor) => mudar({ categorias: { ...escolhas.categorias, [texto]: valor } })}
        />
      )}

      {dados.linhas_invalidas.length > 0 && (
        <SecaoLinhas
          linhas={dados.linhas_invalidas}
          total={dados.total_linhas_invalidas}
          escolhas={escolhas.linhas}
          aoEscolher={(linha, esc) => mudar({ linhas: { ...escolhas.linhas, [linha]: esc } })}
          aoIgnorarTodas={(ignorar) =>
            mudar({ linhas: Object.fromEntries(dados.linhas_invalidas.map((l) => [l.linha, { ...escolhas.linhas[l.linha], ignorar }])) })
          }
        />
      )}

      {dados.conflitos.length > 0 && (
        <SecaoConflitos
          conflitos={dados.conflitos}
          total={dados.total_conflitos}
          escolhas={escolhas.conflitos}
          aoEscolher={(chave, valor) => mudar({ conflitos: { ...escolhas.conflitos, [chave]: valor } })}
        />
      )}

      <div className="correcao__rodape">
        <Botao variante="primario" carregando={enviando} desabilitado={!alterado} desabilitadoMotivo={!alterado ? "Nenhuma escolha nova para gravar." : null} onClick={() => void aplicar()}>
          Aplicar correções
        </Botao>
        <Botao onClick={() => void baixarPlanilha()}>Baixar planilha dos problemas</Botao>
        <span className="rotulo-com-ajuda">
          <Botao variante="fantasma" desabilitado={enviando} onClick={() => void reavaliar()}>
            Reavaliar lote
          </Botao>
          <AjudaPopover rotulo="Categoria nova" texto={AJUDA.categoriaNova} alinhar="fim" />
        </span>
        <span className="correcao__contagem" aria-live="polite">
          {plural(decisoes.length, "escolha feita", "escolhas feitas")}
        </span>
      </div>
    </section>
  );
}

function SecaoCategorias({
  categorias,
  validas,
  escolhas,
  aoEscolher,
}: {
  categorias: ProblemaCategoria[];
  validas: string[];
  escolhas: Escolhas["categorias"];
  aoEscolher: (texto: string, valor: string) => void;
}) {
  const [offset, setOffset] = useState(0);
  const pagina = categorias.slice(offset, offset + POR_PAGINA);
  const colunas: Coluna<ProblemaCategoria>[] = [
    { chave: "texto", titulo: "Texto no arquivo", celula: (c) => <strong>{c.texto_exemplo}</strong> },
    { chave: "linhas", titulo: "Linhas", alinhar: "fim", celula: (c) => formatarInteiro(c.ocorrencias) },
    {
      chave: "exemplos",
      titulo: "Exemplos",
      celula: (c) => c.exemplos.slice(0, 2).map((e) => e.descricao).join(" · "),
    },
    {
      chave: "decisao",
      titulo: "O que fazer",
      celula: (c) => (
        <select
          className="campo__controle"
          aria-label={`O que fazer com o texto ${c.texto_exemplo}`}
          value={escolhas[c.texto] ?? ""}
          onChange={(e) => aoEscolher(c.texto, e.target.value)}
        >
          <option value="">Escolha…</option>
          <optgroup label="É só outro nome de uma categoria existente">
            {validas.map((v) => (
              <option key={v} value={valorCategoria(v)}>
                = {v}
              </option>
            ))}
          </optgroup>
          <option value={IGNORAR}>Ignorar essas linhas</option>
        </select>
      ),
    },
  ];
  return (
    <div className="correcao__secao">
      <h4 className="correcao__subtitulo rotulo-com-ajuda">
        Tributação desconhecida
        <AjudaPopover rotulo="Tributação desconhecida" texto={AJUDA.categoriaDesconhecida} />
      </h4>
      <Tabela rotulo="Categorias de ICMS desconhecidas" colunas={colunas} linhas={pagina} chaveLinha={(c) => c.texto} />
      <Paginacao offset={offset} limite={POR_PAGINA} quantidade={pagina.length} mudar={setOffset} total={categorias.length} />
    </div>
  );
}

const NOME_CAMPO = { descricao: "descrição", ncm: "NCM", icms: "ICMS" } as const;

function SecaoLinhas({
  linhas,
  total,
  escolhas,
  aoEscolher,
  aoIgnorarTodas,
}: {
  linhas: ProblemaLinha[];
  total: number;
  escolhas: Escolhas["linhas"];
  aoEscolher: (linha: number, esc: { ignorar: boolean; valor: string }) => void;
  aoIgnorarTodas: (ignorar: boolean) => void;
}) {
  const [offset, setOffset] = useState(0);
  const pagina = linhas.slice(offset, offset + POR_PAGINA);
  const todasIgnoradas = linhas.every((l) => escolhas[l.linha]?.ignorar);
  const colunas: Coluna<ProblemaLinha>[] = [
    { chave: "linha", titulo: "Linha", alinhar: "fim", celula: (l) => l.linha },
    { chave: "ref", titulo: "Código no arquivo", celula: (l) => l.referencia ?? <span className="tabela__ausente">—</span> },
    { chave: "descricao", titulo: "Descrição", celula: (l) => l.descricao || <span className="tabela__ausente">(vazia)</span> },
    { chave: "ncm", titulo: "NCM", celula: (l) => l.ncm || <span className="tabela__ausente">(vazio)</span> },
    { chave: "icms", titulo: "ICMS", celula: (l) => l.icms || <span className="tabela__ausente">(vazio)</span> },
    { chave: "motivo", titulo: "Problema", celula: (l) => l.motivo },
    {
      chave: "corrigir",
      titulo: "Correção",
      celula: (l) => {
        const esc = escolhas[l.linha] ?? { ignorar: false, valor: "" };
        return (
          <span className="correcao__linha-acao">
            <input
              className="campo__controle"
              aria-label={`Informar ${NOME_CAMPO[l.campo]} da linha ${l.linha}`}
              placeholder={`Informe ${NOME_CAMPO[l.campo]}`}
              maxLength={l.campo === "descricao" ? 300 : l.campo === "ncm" ? 20 : 60}
              disabled={esc.ignorar}
              value={esc.valor}
              onChange={(e) => aoEscolher(l.linha, { ignorar: false, valor: e.target.value })}
            />
            <label className="correcao__ignorar">
              <input
                type="checkbox"
                checked={esc.ignorar}
                onChange={(e) => aoEscolher(l.linha, { ignorar: e.target.checked, valor: "" })}
              />
              Ignorar linha {l.linha}
            </label>
          </span>
        );
      },
    },
  ];
  return (
    <div className="correcao__secao">
      <h4 className="correcao__subtitulo rotulo-com-ajuda">
        Linhas com dados inválidos
        <AjudaPopover rotulo="Linhas com dados inválidos" texto={AJUDA.linhaInvalida} />
        <Botao variante="fantasma" tamanho="compacto" onClick={() => aoIgnorarTodas(!todasIgnoradas)}>
          {todasIgnoradas ? `Desfazer ignorar todas (${linhas.length})` : `Ignorar todas (${linhas.length})`}
        </Botao>
        <AjudaPopover rotulo="Ignorar linhas" texto={AJUDA.ignorarLinhas} />
      </h4>
      {total > linhas.length && (
        <Alerta tipo="aviso" titulo={`Mostrando ${formatarInteiro(linhas.length)} de ${formatarInteiro(total)} linhas inválidas`}>
          Baixe a planilha dos problemas para ver todas, corrija no Excel e envie como lote parcial.
        </Alerta>
      )}
      <Tabela rotulo="Linhas com dados inválidos" colunas={colunas} linhas={pagina} chaveLinha={(l) => String(l.linha)} larguraMinima={980} />
      <Paginacao offset={offset} limite={POR_PAGINA} quantidade={pagina.length} mudar={setOffset} total={linhas.length} />
    </div>
  );
}

function SecaoConflitos({
  conflitos,
  total,
  escolhas,
  aoEscolher,
}: {
  conflitos: ProblemaConflito[];
  total: number;
  escolhas: Escolhas["conflitos"];
  aoEscolher: (chave: string, valor: string) => void;
}) {
  const [offset, setOffset] = useState(0);
  const pagina = conflitos.slice(offset, offset + POR_PAGINA);
  const colunas: Coluna<ProblemaConflito>[] = [
    { chave: "produto", titulo: "Produto", celula: (c) => c.descricao },
    { chave: "ncm", titulo: "NCM", celula: (c) => c.ncm },
    {
      chave: "escolha",
      titulo: "Qual vale",
      celula: (c) => (
        <select
          className="campo__controle"
          aria-label={`Qual tributação vale para ${c.descricao}`}
          value={escolhas[chaveConflito(c.descricao, c.ncm)] ?? ""}
          onChange={(e) => aoEscolher(chaveConflito(c.descricao, c.ncm), e.target.value)}
        >
          <option value="">Escolha…</option>
          {c.opcoes.map((o) => (
            <option key={o.categoria} value={o.categoria}>
              {o.categoria} (linha{o.linhas.length === 1 ? "" : "s"} {o.linhas.join(", ")})
            </option>
          ))}
        </select>
      ),
    },
  ];
  return (
    <div className="correcao__secao">
      <h4 className="correcao__subtitulo rotulo-com-ajuda">
        Conflitos de tributação
        <AjudaPopover rotulo="Conflitos de tributação" texto={AJUDA.conflito} />
      </h4>
      {total > conflitos.length && (
        <Alerta tipo="aviso" titulo={`Mostrando ${formatarInteiro(conflitos.length)} de ${formatarInteiro(total)} conflitos`}>
          Baixe a planilha dos problemas para ver todos.
        </Alerta>
      )}
      <Tabela rotulo="Conflitos de tributação" colunas={colunas} linhas={pagina} chaveLinha={(c) => chaveConflito(c.descricao, c.ncm)} />
      <Paginacao offset={offset} limite={POR_PAGINA} quantidade={pagina.length} mudar={setOffset} total={conflitos.length} />
    </div>
  );
}
