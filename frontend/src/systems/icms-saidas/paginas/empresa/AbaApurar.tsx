import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { api, baixar, consulta } from "../../api";
import { usePermissoes } from "../../auth/permissoes";
import { useCarregar } from "../../componentes/comuns";
import { ChipsOrigem, EXPLICACAO_ORIGEM, origensDe } from "../../componentes/pendencias";
import { formatarCompetencia, formatarData, formatarHora, formatarInteiro } from "../../formato";
import type { Apuracao } from "../../tipos";
import { AjudaPopover } from "../../ui/components/AjudaPopover";
import { Alerta, lerErro } from "../../ui/components/Alerta";
import { Botao } from "../../ui/components/Botao";
import { CartaoTotal } from "../../ui/components/CartaoTotal";
import { EnvioArquivo } from "../../ui/components/EnvioArquivo";
import { SeletorCompetencia } from "../../ui/components/SeletorCompetencia";
import { SeloSituacao } from "../../ui/components/Selo";
import { AJUDA } from "../../ui/textosAjuda";
import type { IdAba } from "../Empresa";
import "./empresa.css";

/** Tempo típico do motor; passando do dobro, o texto avisa que está demorando. */
const TEMPO_TIPICO_S = 20;
const TEMPO_DEMORADO_S = 40;

/**
 * Resultado de uma apuração: cabeçalho (competência, situação, quando e quem), OD / ED / Saldo,
 * "Por que ‘com pendências’?" e "Baixar planilha" (a planilha fica guardada no motor).
 */
export function ResultadoApuracao({
  codigo,
  apuracao,
  processadaPor,
  irPara,
}: {
  codigo: string;
  apuracao: Apuracao;
  /** Nome de quem processou (padrão: o registrado pelo motor). */
  processadaPor?: string;
  irPara?: (aba: IdAba) => void;
}) {
  const [erro, setErro] = useState<unknown>(null);
  const [baixando, setBaixando] = useState(false);
  const totais = apuracao.totais ?? {};
  const origens = origensDe(totais.pendencias);
  const quando = apuracao.concluido_em ?? apuracao.iniciado_em;

  async function baixarPlanilha() {
    setErro(null);
    setBaixando(true);
    try {
      await baixar(
        `/api/empresas/${encodeURIComponent(codigo)}/apuracoes/${apuracao.id}/planilha`,
        `apuracao_${codigo}_${apuracao.competencia}.xlsx`,
      );
    } catch (e) {
      setErro(e);
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="resultado-apuracao">
      <section className="cartao resultado-apuracao__cartao" aria-labelledby={`titulo-${apuracao.id}`}>
        <header className="resultado-apuracao__cabecalho">
          <div className="resultado-apuracao__titulo">
            <h3 id={`titulo-${apuracao.id}`}>Apuração de {formatarCompetencia(apuracao.competencia)}</h3>
            <SeloSituacao situacao={apuracao.status} />
          </div>
          <p className="resultado-apuracao__meta">
            Processada às {formatarHora(new Date(quando))} de {formatarData(quando).slice(0, 10)} por{" "}
            {processadaPor ?? apuracao.solicitado_por}
            {apuracao.n_itens !== null && ` · ${formatarInteiro(apuracao.n_itens)} itens`}
            {apuracao.arquivo_entrada_nome && ` · ${apuracao.arquivo_entrada_nome}`}
          </p>
          {apuracao.planilha_url && (
            <Botao variante="primario" carregando={baixando} onClick={() => void baixarPlanilha()}>
              Baixar planilha
            </Botao>
          )}
        </header>
        {erro !== null && (
          <Alerta tipo="erro" titulo="Não foi possível baixar a planilha" meta={lerErro(erro).codigo}>
            {lerErro(erro).mensagem}
          </Alerta>
        )}
        {apuracao.erro && (
          <Alerta tipo="erro" titulo="O motor registrou um erro nesta apuração">
            {apuracao.erro}
          </Alerta>
        )}
        <div className="resultado-apuracao__totais">
          <CartaoTotal rotulo="Outros Débitos (OD)" tipo="od" tamanho="destaque" valor={totais.od} legenda="Valor a acrescentar" ajuda={AJUDA.od} />
          <CartaoTotal rotulo="Estornos de Débito (ED)" tipo="ed" tamanho="destaque" valor={totais.ed} legenda="Valor a estornar" ajuda={AJUDA.ed} />
          <CartaoTotal rotulo="Saldo (OD − ED)" tipo="saldo" tamanho="destaque" valor={totais.saldo} ajuda={AJUDA.saldo} />
        </div>
      </section>

      {origens.length > 0 && (
        <section className="cartao resultado-apuracao__pendencias" aria-labelledby={`pend-${apuracao.id}`}>
          <h3 id={`pend-${apuracao.id}`}>Por que ‘com pendências’?</h3>
          <ul>
            {origens.map((o) => (
              <li key={o.tipo}>
                <ChipsOrigem origens={[o]} />
                <span>{EXPLICACAO_ORIGEM[o.tipo]}</span>
                {o.tipo === "produtos" && irPara && (
                  <Botao variante="fantasma" onClick={() => irPara("pendencias")}>
                    Resolver em Pendências
                  </Botao>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type Fase = "vazio" | "processando" | "erro" | "sucesso";

export function AbaApurar({
  codigo,
  competenciaInicial,
  irPara,
}: {
  codigo: string;
  competenciaInicial: string;
  irPara?: (aba: IdAba) => void;
}) {
  const { nome } = usePermissoes();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [competencia, setCompetencia] = useState(competenciaInicial);
  const [competenciaValida, setCompetenciaValida] = useState(true);
  const [fase, setFase] = useState<Fase>("vazio");
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<unknown>(null);
  const [resultado, setResultado] = useState<Apuracao | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const [copiado, setCopiado] = useState(false);
  // Marcado ANTES da chamada: segundo clique, Enter ou arquivo solto durante o envio são ignorados.
  const enviando = useRef(false);
  const idCompetencia = useId();
  const idDica = useId();
  const processando = fase === "processando";

  const ultima = useCarregar<Apuracao[]>(
    `/api/empresas/${encodeURIComponent(codigo)}/apuracoes${consulta({ apenas_vigentes: true, limit: 1 })}`,
  );
  const ultimaVigente = ultima.dados?.[0] ?? null;

  // Contador de segundos (não anunciado: o aria-live fala só no início e no fim).
  useEffect(() => {
    if (!processando) return;
    setSegundos(0);
    const id = window.setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [processando]);

  // Sair da página durante o processamento pede confirmação.
  useEffect(() => {
    if (!processando) return;
    const avisar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
      evento.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [processando]);

  function escolherArquivo(novo: File | null) {
    if (enviando.current) return;
    setArquivo(novo);
  }

  async function processar(evento?: FormEvent) {
    evento?.preventDefault();
    if (enviando.current || !arquivo || !competenciaValida) return;
    enviando.current = true;
    setFase("processando");
    setErro(null);
    setResultado(null);
    setCopiado(false);
    setAnuncio("Processando a apuração…");
    const form = new FormData();
    form.set("arquivo", arquivo);
    if (competencia) form.set("competencia", competencia);
    try {
      const apuracao = await api.enviar<Apuracao>(`/api/empresas/${encodeURIComponent(codigo)}/apuracoes`, form);
      setResultado(apuracao);
      setFase("sucesso");
      setAnuncio("Apuração concluída.");
      ultima.recarregar();
    } catch (e) {
      setErro(e);
      setFase("erro");
      setAnuncio("Apuração não processada.");
    } finally {
      enviando.current = false;
    }
  }

  function processarOutro() {
    setArquivo(null);
    setResultado(null);
    setErro(null);
    setFase("vazio");
    setAnuncio("");
  }

  async function copiarDetalhes() {
    const { mensagem, codigo: cod, detalhes } = lerErro(erro);
    try {
      await navigator.clipboard.writeText([`${mensagem}${cod ? ` (${cod})` : ""}`, ...detalhes].join("\n"));
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  const motivoBotao = !arquivo
    ? "Escolha o relatório de vendas (.xlsx)."
    : !competenciaValida
      ? "Corrija a competência ou deixe-a vazia."
      : null;
  const textoBotao = processando ? `Processando… ${segundos} s` : fase === "erro" ? "Tentar de novo com este arquivo" : "Processar apuração";
  const infoErro = erro ? lerErro(erro) : null;

  return (
    <div className="apurar">
      <p className="visualmente-oculto" aria-live="polite">
        {anuncio}
      </p>

      <form className="cartao apurar__formulario" onSubmit={(e) => void processar(e)} aria-labelledby={`${idDica}-titulo`}>
        <h2 id={`${idDica}-titulo`}>Enviar relatório de vendas</h2>
        <EnvioArquivo aceita=".xlsx" arquivo={arquivo} onEscolher={escolherArquivo} travado={processando} rotulo="Relatório de vendas" />
        <div className="apurar__campo">
          <span className="rotulo-com-ajuda">
            <label htmlFor={idCompetencia}>
              Competência <span className="apurar__opcional">(opcional)</span>
            </label>
            <AjudaPopover rotulo="Competência" texto={AJUDA.competenciaApurar} />
          </span>
          <SeletorCompetencia
            modo="campo"
            id={idCompetencia}
            idDica={idDica}
            valor={competencia}
            onChange={setCompetencia}
            onValidade={setCompetenciaValida}
            placeholder="MM/AAAA — usar a do relatório"
            desabilitado={processando}
          />
          <p id={idDica} className="apurar__dica">
            Deixe vazio para usar a competência do relatório.
          </p>
        </div>
        <Botao type="submit" variante="primario" tamanho="principal" carregando={processando} desabilitadoMotivo={processando ? null : motivoBotao}>
          {textoBotao}
        </Botao>
        <p className="apurar__nota">
          Leva cerca de {TEMPO_TIPICO_S} s. Ao terminar, a planilha de conferência fica disponível em “Baixar planilha” e no
          Histórico.
        </p>
      </form>

      <div className="apurar__resultado">
        {fase === "vazio" && (
          <div className="apurar__vazio">
            <p className="apurar__vazio-titulo">O resultado aparece aqui</p>
            <ol>
              <li>Escolha o relatório de vendas (.xlsx).</li>
              <li>Confira a competência, se quiser informá-la.</li>
              <li>Clique em “Processar apuração”.</li>
            </ol>
            {ultimaVigente && irPara && (
              <Botao variante="fantasma" onClick={() => irPara("historico")}>
                Ver a última apuração vigente ({formatarCompetencia(ultimaVigente.competencia)})
              </Botao>
            )}
          </div>
        )}

        {processando && arquivo && (
          <div className="cartao apurar__processando">
            <p className="apurar__arquivo">{arquivo.name}</p>
            <div className="barra-indeterminada" aria-hidden="true">
              <span />
            </div>
            <p>
              {segundos > TEMPO_DEMORADO_S
                ? "Está demorando mais que o normal; continue aguardando."
                : `Tempo decorrido: ${segundos} s de cerca de ${TEMPO_TIPICO_S} s`}
            </p>
            <p className="apurar__dica">Não feche esta aba até terminar.</p>
            <div className="apurar__esqueletos" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className="esqueleto apurar__esqueleto" />
              ))}
            </div>
          </div>
        )}

        {fase === "erro" && infoErro && (
          <Alerta
            tipo="erro"
            titulo="A apuração não foi processada"
            detalhes={infoErro.detalhes}
            meta={infoErro.codigo}
            acoes={
              <>
                <Botao onClick={processarOutro}>Escolher outro arquivo</Botao>
                {infoErro.detalhes.length > 0 && (
                  <Botao variante="fantasma" onClick={() => void copiarDetalhes()}>
                    {copiado ? "Detalhes copiados" : "Copiar detalhes"}
                  </Botao>
                )}
              </>
            }
          >
            {infoErro.mensagem} Nenhuma planilha foi gerada.
          </Alerta>
        )}

        {fase === "sucesso" && resultado && (
          <>
            <ResultadoApuracao codigo={codigo} apuracao={resultado} processadaPor={nome} irPara={irPara} />
            <div className="apurar__depois">
              <Botao onClick={processarOutro}>Processar outro arquivo</Botao>
              {irPara && (
                <Botao variante="fantasma" onClick={() => irPara("historico")}>
                  Ver no Histórico
                </Botao>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
