import { useId, useState } from "react";

import { api, baixar, consulta } from "../../api";
import { AjudaPopover } from "../../ui/components/AjudaPopover";
import { lerErro } from "../../ui/components/Alerta";
import { Botao } from "../../ui/components/Botao";
import { BarraFiltros } from "../../ui/components/Filtros";
import { SeletorCompetencia } from "../../ui/components/SeletorCompetencia";
import { SeloSituacao } from "../../ui/components/Selo";
import { Tabela, TituloValor, type Coluna } from "../../ui/components/Tabela";
import { AJUDA } from "../../ui/textosAjuda";
import { MensagemErro, Paginacao, useCarregar, Valor } from "../../componentes/comuns";
import { formatarCompetencia, formatarData } from "../../formato";
import type { Apuracao } from "../../tipos";
import { ResultadoApuracao } from "./AbaApurar";
import "./empresa.css";

const LIMITE = 50;

export function AbaHistorico({ codigo }: { codigo: string }) {
  const [competencia, setCompetencia] = useState("");
  const idCompetencia = useId();
  const [apenasVigentes, setApenasVigentes] = useState(false);
  const [offset, setOffset] = useState(0);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [reprocessada, setReprocessada] = useState<Apuracao | null>(null);
  const base = `/api/empresas/${encodeURIComponent(codigo)}/apuracoes`;
  const { dados, erro: erroLista, carregando, recarregar } = useCarregar<Apuracao[]>(
    base + consulta({ competencia, apenas_vigentes: apenasVigentes || undefined, limit: LIMITE, offset }),
  );

  async function baixarPlanilha(a: Apuracao) {
    setErro(null);
    try {
      await baixar(`${base}/${a.id}/planilha`, `apuracao_${codigo}_${a.competencia}.xlsx`);
    } catch (e) {
      setErro(e);
    }
  }

  async function reprocessar(a: Apuracao) {
    const texto =
      `Reprocessar a apuração de ${formatarCompetencia(a.competencia)} com a memória e a configuração de hoje?\n` +
      "A nova apuração passa a ser a vigente; a atual fica no histórico.";
    if (!window.confirm(texto)) return;
    setErro(null);
    setReprocessada(null);
    setOcupado(a.id);
    try {
      setReprocessada(await api.post<Apuracao>(`${base}/${a.id}/reprocessar`));
      recarregar();
    } catch (e) {
      setErro(e);
    } finally {
      setOcupado(null);
    }
  }

  const colunas: Coluna<Apuracao>[] = [
    { chave: "competencia", titulo: "Competência", classe: "historico__competencia", celula: (a) => formatarCompetencia(a.competencia) },
    { chave: "situacao", titulo: "Situação", celula: (a) => <SeloSituacao situacao={a.status} /> },
    {
      chave: "vigente",
      titulo: "Vigente",
      celula: (a) => (a.vigente ? "Sim" : <span className="tabela__ausente">Substituída</span>),
    },
    {
      chave: "od",
      titulo: (
        <TituloValor tipo="od">
          OD (R$) <AjudaPopover rotulo="OD" texto={AJUDA.od} alinhar="fim" />
        </TituloValor>
      ),
      alinhar: "fim",
      celula: (a) => <Valor valor={a.totais?.od} />,
    },
    {
      chave: "ed",
      titulo: (
        <TituloValor tipo="ed">
          ED (R$) <AjudaPopover rotulo="ED" texto={AJUDA.ed} alinhar="fim" />
        </TituloValor>
      ),
      alinhar: "fim",
      celula: (a) => <Valor valor={a.totais?.ed} />,
    },
    {
      chave: "quando",
      titulo: "Processada",
      celula: (a) => (
        <span className="historico__quando">
          {formatarData(a.concluido_em ?? a.iniciado_em)}
          <span className="historico__quem">{a.solicitado_por}</span>
        </span>
      ),
    },
    { chave: "arquivo", titulo: "Arquivo", classe: "historico__arquivo", celula: (a) => a.arquivo_entrada_nome ?? "—" },
    {
      chave: "regras",
      titulo: "Regras",
      // Versão das regras fiscais usada no cálculo (apurações anteriores à ADR-007 não têm).
      celula: (a) => (a.regras_versao ? `v${a.regras_versao}` : <span className="tabela__ausente">—</span>),
    },
    {
      chave: "acoes",
      titulo: <span className="visualmente-oculto">Ações</span>,
      alinhar: "fim",
      celula: (a) => (
        <span className="historico__acoes">
          {a.planilha_url && (
            <Botao variante="fantasma" onClick={() => void baixarPlanilha(a)}>
              Baixar planilha
            </Botao>
          )}
          <Botao
            variante="fantasma"
            desabilitado={ocupado !== null || a.status === "PROCESSANDO"}
            carregando={ocupado === a.id}
            onClick={() => void reprocessar(a)}
          >
            Reprocessar
          </Botao>
        </span>
      ),
    },
  ];

  return (
    <div className="historico">
      <BarraFiltros>
        <div className="apurar__campo">
          <label htmlFor={idCompetencia}>Competência</label>
          <SeletorCompetencia
            modo="campo"
            id={idCompetencia}
            valor={competencia}
            placeholder="MM/AAAA — todas"
            onChange={(v) => {
              setCompetencia(v);
              setOffset(0);
            }}
          />
        </div>
        <label className="caixa-marcacao">
          <input
            type="checkbox"
            checked={apenasVigentes}
            onChange={(e) => {
              setApenasVigentes(e.target.checked);
              setOffset(0);
            }}
          />
          Só vigentes
        </label>
      </BarraFiltros>

      <MensagemErro erro={erro} />
      {ocupado && (
        <div className="cartao historico__reprocessando" role="status">
          <p>Reprocessando a apuração com a memória e a configuração de hoje…</p>
          <div className="barra-indeterminada" aria-hidden="true">
            <span />
          </div>
        </div>
      )}
      {reprocessada && <ResultadoApuracao codigo={codigo} apuracao={reprocessada} />}

      <Tabela
        rotulo="Histórico de apurações"
        colunas={colunas}
        linhas={dados ?? []}
        chaveLinha={(a) => a.id}
        atributosLinha={(a) => ({ "data-substituida": a.vigente ? undefined : "" })}
        larguraMinima={1100}
        estado={
          carregando
            ? { tipo: "carregando", titulo: "Carregando apurações…" }
            : erroLista
              ? {
                  tipo: "erro",
                  titulo: "Não foi possível carregar o histórico",
                  texto: lerErro(erroLista).mensagem,
                  acao: (
                    <Botao tamanho="compacto" variante="primario" onClick={recarregar}>
                      Tentar de novo
                    </Botao>
                  ),
                }
              : dados?.length === 0
                ? competencia || apenasVigentes
                  ? { tipo: "filtro-sem-resultado", titulo: "Nenhuma apuração com estes filtros" }
                  : { tipo: "vazio", titulo: "Nenhuma apuração ainda", texto: "Processe o relatório de vendas na aba Apurar." }
                : null
        }
      />
      <Paginacao offset={offset} limite={LIMITE} quantidade={dados?.length ?? 0} mudar={setOffset} />
    </div>
  );
}
