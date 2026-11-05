import { useEffect, useState } from "react";

import { api, consulta } from "../../api";
import { AjudaPopover } from "../../ui/components/AjudaPopover";
import { Alerta, lerErro } from "../../ui/components/Alerta";
import { Botao } from "../../ui/components/Botao";
import { GrupoFiltro } from "../../ui/components/Filtros";
import { Tabela, type Coluna } from "../../ui/components/Tabela";
import { AJUDA } from "../../ui/textosAjuda";
import { MensagemErro, Paginacao, useCarregarComTotal, Valor } from "../../componentes/comuns";
import { categoriasDasRegras, useRegras } from "../../componentes/regras";
import { formatarData, formatarInteiro, rotulo } from "../../formato";
import type { Pendencia, ResultadoResolucao, SugestaoPendencia } from "../../tipos";
import { FilaPendencias } from "./FilaPendencias";
import { LotePendencias } from "./LotePendencias";
import { partir, RESULTADO_VAZIO, resolucoesComTributacao, resumirResolucao, somarResultados, type Resolucao } from "./pendenciasLote";
import { ResumoPendencias } from "./ResumoPendencias";
import "./empresa.css";

const LIMITE = 100;

type Modo = "fila" | "lote";

export function AbaPendencias({ codigo }: { codigo: string }) {
  const [status, setStatus] = useState("ABERTA");
  const [modo, setModo] = useState<Modo>("fila");
  const [offset, setOffset] = useState(0);
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
  // Resolver sem mês = correção: vale contra as regras atuais (o motor valida grafia e apelidos e grava o nome canônico).
  const regras = useRegras();
  const categorias = categoriasDasRegras(regras.dados);
  const recarregarLista = lista.recarregar;
  useEffect(() => setErro(null), [status, modo]);

  const abertas = status === "ABERTA";
  const itens = lista.dados ?? [];

  function atualizar() {
    setVersaoResumo((v) => v + 1);
    recarregarLista();
  }

  /** Uma ação sobre uma pendência: grava, avisa o que aconteceu e recarrega. Erro do motor fica na tela, sem perder o contexto. */
  async function executar(url: string, corpo: object, sucesso: string) {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    setMensagem(null);
    try {
      await api.post(url, corpo);
      setMensagem(sucesso);
      atualizar();
    } catch (e) {
      setErro(e);
    } finally {
      setEnviando(false);
    }
  }

  const aceitar = (p: Pendencia, s: SugestaoPendencia) =>
    executar(
      `${base}/pendencias/${p.id}/resolver`,
      { tributacao: s.icms },
      `${p.descricao} (NCM ${p.ncm}) cadastrado na memória como ${s.icms}, a mesma tributação de ${s.descricao}.`,
    );
  // Item novo vale para todos os meses: não há mês a informar.
  const gravar = (p: Pendencia, tributacao: string) =>
    executar(`${base}/pendencias/${p.id}/resolver`, { tributacao }, `${p.descricao} (NCM ${p.ncm}) cadastrado na memória como ${tributacao}.`);
  const descartar = (p: Pendencia, motivo: string) =>
    executar(`${base}/pendencias/${p.id}/descartar`, { motivo }, `Pendência de ${p.descricao} (NCM ${p.ncm}) descartada.`);

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
      atualizar();
    }
  }

  const colunasHistorico: Coluna<Pendencia>[] = [
    { chave: "descricao", titulo: "Descrição", celula: (p) => p.descricao },
    { chave: "ncm", titulo: "NCM", celula: (p) => p.ncm },
    { chave: "cfop", titulo: "CFOP ex.", alinhar: "fim", celula: (p) => p.cfop_exemplo ?? <span className="tabela__ausente">—</span> },
    { chave: "ocorrencias", titulo: "Ocorrências", alinhar: "fim", celula: (p) => formatarInteiro(p.ocorrencias) },
    { chave: "valor", titulo: "Valor (R$)", alinhar: "fim", celula: (p) => <Valor valor={p.valor_total} /> },
    {
      chave: "decisao",
      titulo: "Decisão",
      celula: (p) => (
        <span className="pendencias__decisao">
          {p.tributacao_definida ?? rotulo(p.status)}
          {p.status !== "ABERTA" && (
            <span className="pendencias__quem">
              {p.resolvido_por ?? "—"} · {formatarData(p.resolvido_em)}
            </span>
          )}
        </span>
      ),
    },
  ];

  const estadoVazio = lista.carregando
    ? ({ tipo: "carregando", titulo: "Carregando pendências…" } as const)
    : lista.erro
      ? ({
          tipo: "erro",
          titulo: "Não foi possível carregar as pendências",
          texto: lerErro(lista.erro).mensagem,
          acao: (
            <Botao tamanho="compacto" variante="primario" onClick={recarregarLista}>
              Tentar de novo
            </Botao>
          ),
        } as const)
      : lista.dados?.length === 0
        ? abertas
          ? ({ tipo: "vazio", titulo: "Nenhuma pendência aberta", texto: "Todos os produtos vendidos estão na memória da empresa." } as const)
          : ({ tipo: "vazio", titulo: "Nenhuma pendência registrada" } as const)
        : null;

  return (
    <div className="pendencias">
      <div className="pendencias__cabecalho">
        <h2 className="rotulo-com-ajuda">
          Pendências
          <AjudaPopover rotulo="Pendências" texto={AJUDA.pendencias} />
        </h2>
        <GrupoFiltro
          rotulo="Situação das pendências"
          valor={abertas ? "ABERTA" : "TODAS"}
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
      <MensagemErro erro={erro} />
      {regras.erro !== null && abertas && (
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
            atualizar();
          }}
        />
      )}

      {abertas && itens.length > 0 && (
        <GrupoFiltro<Modo>
          rotulo="Como resolver"
          valor={modo}
          onChange={setModo}
          opcoes={[
            { valor: "fila", rotulo: "Um a um" },
            { valor: "lote", rotulo: "Em lote" },
          ]}
        />
      )}

      {abertas && itens.length > 0 ? (
        modo === "fila" ? (
          <FilaPendencias itens={itens} categorias={categorias} enviando={enviando} aceitar={aceitar} gravar={gravar} descartar={descartar} />
        ) : (
          <LotePendencias
            key={lista.dados === null ? "vazio" : itens.map((p) => p.id).join(",")} // lista nova (ação, página): marcas novas
            itens={itens}
            categorias={categorias}
            enviando={enviando}
            sobrescrever={sobrescrever}
            setSobrescrever={setSobrescrever}
            aplicar={(tributacao, ids) => void enviarLote(resolucoesComTributacao(itens, new Set(ids), tributacao))}
          />
        )
      ) : (
        <Tabela rotulo="Pendências" colunas={colunasHistorico} linhas={itens} chaveLinha={(p) => String(p.id)} larguraMinima={800} estado={estadoVazio} />
      )}
      <Paginacao offset={offset} limite={LIMITE} quantidade={lista.dados?.length ?? 0} mudar={setOffset} total={lista.total} />
    </div>
  );
}
