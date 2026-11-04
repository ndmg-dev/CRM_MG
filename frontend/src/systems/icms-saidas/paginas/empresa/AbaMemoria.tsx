import { useId, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import { api, baixar, consulta, salvarArquivo } from "../../api";
import { Paginacao, useCarregar } from "../../componentes/comuns";
import { formatarData, mesAnterior, mesAtual, rotulo } from "../../formato";
import type { ItemMemoria, Lote, Regras } from "../../tipos";
import { AjudaPopover } from "../../ui/components/AjudaPopover";
import { Alerta, lerErro } from "../../ui/components/Alerta";
import { Botao } from "../../ui/components/Botao";
import { EnvioArquivo } from "../../ui/components/EnvioArquivo";
import { GrupoFiltro } from "../../ui/components/Filtros";
import { SeletorCompetencia } from "../../ui/components/SeletorCompetencia";
import { SeloLote } from "../../ui/components/Selo";
import { Tabela, type Coluna } from "../../ui/components/Tabela";
import { AJUDA } from "../../ui/textosAjuda";
import { CompletarMemoria } from "./CompletarMemoria";
import { DetalheLote } from "./DetalheLote";
import { NOME_MODELO_MEMORIA, planilhaModeloMemoria } from "./modeloMemoria";
import { vigenciaDoLote } from "./vigencia";
import "./empresa.css";

export { INCLUIDO, loteECorrecao, vigenciaDaDiferenca, vigenciaDoLote } from "./vigencia";

const LIMITE_MEMORIA = 100;

type FiltroLotes = "" | "PENDENTE_APROVACAO" | "BLOQUEADO";
const NOME_FILTRO_LOTES: Record<FiltroLotes, string> = { "": "Todos", PENDENTE_APROVACAO: "Aguardando aprovação", BLOQUEADO: "Bloqueados" };

export function AbaMemoria({ codigo }: { codigo: string }) {
  const base = `/api/empresas/${encodeURIComponent(codigo)}/memoria`;
  const [busca, setBusca] = useSearchParams();
  const loteAberto = busca.get("lote");
  const [filtroStatus, setFiltroStatus] = useState<FiltroLotes>("");
  const lotes = useCarregar<Lote[]>(`${base}/lotes${consulta({ status: filtroStatus })}`);

  // O lote aberto vai para a URL: o botão Voltar do navegador fecha o detalhe.
  function abrirLote(id: string | null) {
    const nova = new URLSearchParams(busca);
    if (id) nova.set("lote", id);
    else nova.delete("lote");
    setBusca(nova);
  }

  if (loteAberto) {
    return <DetalheLote base={base} id={loteAberto} voltar={() => abrirLote(null)} aoDecidir={lotes.recarregar} />;
  }

  const colunas: Coluna<Lote>[] = [
    { chave: "enviado", titulo: "Enviado em", celula: (l) => formatarData(l.criado_em) },
    { chave: "tipo", titulo: "Tipo", celula: (l) => rotulo(l.tipo) },
    { chave: "situacao", titulo: "Situação", celula: (l) => <SeloLote status={l.status} /> },
    { chave: "vigencia", titulo: "Vigência", celula: (l) => vigenciaDoLote(l) },
    { chave: "arquivo", titulo: "Arquivo", classe: "memoria__arquivo", celula: (l) => l.arquivo_nome ?? "—" },
    { chave: "por", titulo: "Enviado por", celula: (l) => l.enviado_por },
    { chave: "decidido", titulo: "Decidido por", celula: (l) => l.decidido_por ?? "—" },
    {
      chave: "acao",
      titulo: <span className="visualmente-oculto">Ação</span>,
      alinhar: "fim",
      celula: (l) => (
        <Botao variante="fantasma" onClick={() => abrirLote(l.id)} aria-label={`Ver lote de ${formatarData(l.criado_em)}`}>
          Ver
        </Botao>
      ),
    },
  ];

  const estadoLotes = lotes.carregando
    ? { tipo: "carregando" as const, titulo: "Carregando lotes…" }
    : lotes.erro
      ? {
          tipo: "erro" as const,
          titulo: "Não foi possível carregar os lotes",
          texto: `${lerErro(lotes.erro).mensagem} A memória da empresa não foi alterada.`,
          acao: (
            <Botao variante="primario" tamanho="compacto" onClick={lotes.recarregar}>
              Tentar de novo
            </Botao>
          ),
        }
      : lotes.dados?.length === 0
        ? filtroStatus
          ? {
              tipo: "filtro-sem-resultado" as const,
              titulo: `Nenhum lote em ${NOME_FILTRO_LOTES[filtroStatus]}`,
              acao: (
                <Botao tamanho="compacto" onClick={() => setFiltroStatus("")}>
                  Mostrar todos
                </Botao>
              ),
            }
          : { tipo: "vazio" as const, titulo: "Nenhum lote enviado", texto: "Envie uma planilha da memória para comparar com a atual." }
        : null;

  return (
    <div className="memoria">
      <div className="memoria__formularios">
        <ExportarMemoria base={base} codigo={codigo} />
        <EnviarPlanilha
          base={base}
          aoEnviar={(lote) => {
            lotes.recarregar();
            abrirLote(lote.id);
          }}
        />
        <CompletarMemoria base={base} aoAbrirLote={(id) => { lotes.recarregar(); abrirLote(id); }} />
      </div>

      <section className="memoria__lotes" aria-labelledby="titulo-lotes">
        <div className="memoria__titulo">
          <h2 id="titulo-lotes">Lotes enviados</h2>
          <GrupoFiltro<FiltroLotes>
            rotulo="Situação dos lotes"
            valor={filtroStatus}
            onChange={setFiltroStatus}
            opcoes={[
              { valor: "", rotulo: "Todos" },
              { valor: "PENDENTE_APROVACAO", rotulo: "Aguardando aprovação" },
              { valor: "BLOQUEADO", rotulo: "Bloqueados" },
            ]}
          />
        </div>
        <Tabela rotulo="Lotes enviados" colunas={colunas} linhas={lotes.dados ?? []} chaveLinha={(l) => l.id} estado={estadoLotes} larguraMinima={980} />
      </section>

      <ConsultarMemoria base={base} />
    </div>
  );
}

function ExportarMemoria({ base, codigo }: { base: string; codigo: string }) {
  const [competencia, setCompetencia] = useState(mesAnterior());
  const [valida, setValida] = useState(true);
  const [erro, setErro] = useState<unknown>(null);
  const [baixando, setBaixando] = useState(false);
  const id = useId();

  async function exportar(evento: FormEvent) {
    evento.preventDefault();
    if (!competencia || !valida || baixando) return;
    setErro(null);
    setBaixando(true);
    try {
      await baixar(`${base}/exportar${consulta({ competencia })}`, `memoria_${codigo}_${competencia}.xlsx`);
    } catch (e) {
      setErro(e);
    } finally {
      setBaixando(false);
    }
  }

  return (
    <form className="cartao" onSubmit={exportar} aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`}>Exportar memória</h2>
      <p className="apurar__dica">
        Planilha da memória vigente (ID, DESCRIÇÃO, NCM, ICMS, PIS COFINS) para editar e reenviar. O ID é só informativo: no reenvio o
        item é identificado pela descrição e pelo NCM.
      </p>
      <div className="apurar__campo">
        <label htmlFor={id}>Competência</label>
        <SeletorCompetencia modo="campo" id={id} valor={competencia} onChange={setCompetencia} onValidade={setValida} />
      </div>
      {erro !== null && (
        <Alerta tipo="erro" titulo="Não foi possível exportar" meta={lerErro(erro).codigo}>
          {lerErro(erro).mensagem}
        </Alerta>
      )}
      <Botao
        type="submit"
        carregando={baixando}
        desabilitadoMotivo={!competencia || !valida ? "Informe a competência (MM/AAAA)." : null}
      >
        {baixando ? "Gerando…" : "Exportar memória"}
      </Botao>
    </form>
  );
}

export function EnviarPlanilha({ base, aoEnviar }: { base: string; aoEnviar: (lote: Lote) => void }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [tipo, setTipo] = useState("PARCIAL");
  const [modo, setModo] = useState<"correcao" | "mudanca">("correcao");
  const [vigencia, setVigencia] = useState(mesAtual());
  const [vigenciaValida, setVigenciaValida] = useState(true);
  const nomeGrupo = useId();
  const [erro, setErro] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando || !arquivo || (modo === "mudanca" && (!vigencia || !vigenciaValida))) return;
    setErro(null);
    setEnviando(true);
    const form = new FormData();
    form.set("arquivo", arquivo);
    form.set("tipo", tipo);
    // Correção de cadastro: sem vigência (vale para todos os meses). Só a mudança leva data.
    if (modo === "mudanca") form.set("vigencia_inicio", `${vigencia}-01`);
    try {
      const lote = await api.enviar<Lote>(`${base}/lotes`, form);
      setArquivo(null);
      aoEnviar(lote);
    } catch (e) {
      setErro(e);
    } finally {
      setEnviando(false);
    }
  }

  const motivo = !arquivo
    ? "Escolha a planilha da memória."
    : modo === "mudanca" && (!vigencia || !vigenciaValida)
      ? "Informe o mês da mudança (MM/AAAA)."
      : null;

  return (
    <form className="cartao" onSubmit={enviar} aria-labelledby={`${nomeGrupo}-titulo`}>
      <h2 id={`${nomeGrupo}-titulo`}>Enviar planilha</h2>
      <p className="apurar__dica">
        O motor compara com a memória e aplica as travas. Nada é gravado sem aprovação. Itens novos valem para todos os
        meses; só alterações e remoções podem ter data.
      </p>
      <BaixarModelo />
      <EnvioArquivo aceita=".xlsx,.csv" arquivo={arquivo} onEscolher={setArquivo} travado={enviando} rotulo="Planilha da memória" />
      <fieldset className="opcoes">
        <legend>Tipo</legend>
        <div className="opcao">
          <label>
            <input type="radio" name={`${nomeGrupo}-tipo`} value="PARCIAL" checked={tipo === "PARCIAL"} onChange={() => setTipo("PARCIAL")} />
            Parcial
          </label>
          <AjudaPopover rotulo="Parcial" texto={AJUDA.parcial} />
        </div>
        <div className="opcao">
          <label>
            <input type="radio" name={`${nomeGrupo}-tipo`} value="COMPLETA" checked={tipo === "COMPLETA"} onChange={() => setTipo("COMPLETA")} />
            Completa
          </label>
          <AjudaPopover rotulo="Completa" texto={AJUDA.completa} />
        </div>
      </fieldset>
      <fieldset className="opcoes">
        <legend>Vigência das alterações e remoções</legend>
        <div className="opcao">
          <label>
            <input
              type="radio"
              name={`${nomeGrupo}-vigencia`}
              value="correcao"
              checked={modo === "correcao"}
              onChange={() => setModo("correcao")}
            />
            Correção de cadastro – vale para todos os meses
          </label>
          <AjudaPopover rotulo="Correção de cadastro" texto={AJUDA.correcao} />
        </div>
        <div className="opcao">
          <label>
            <input
              type="radio"
              name={`${nomeGrupo}-vigencia`}
              value="mudanca"
              checked={modo === "mudanca"}
              onChange={() => setModo("mudanca")}
            />
            Mudança a partir de:
          </label>
          <SeletorCompetencia
            modo="campo"
            id={`${nomeGrupo}-mes`}
            max=""
            valor={vigencia}
            onChange={setVigencia}
            onValidade={setVigenciaValida}
            desabilitado={modo !== "mudanca"}
          />
          <label htmlFor={`${nomeGrupo}-mes`} className="visualmente-oculto">
            Mês/ano de início da mudança
          </label>
          <AjudaPopover rotulo="Mudança a partir de" texto={AJUDA.mudanca} />
        </div>
      </fieldset>
      {erro !== null && (
        <Alerta tipo="erro" titulo="A planilha não foi comparada" meta={lerErro(erro).codigo} detalhes={lerErro(erro).detalhes}>
          {lerErro(erro).mensagem}
        </Alerta>
      )}
      <Botao type="submit" variante="primario" carregando={enviando} desabilitadoMotivo={enviando ? null : motivo}>
        {enviando ? "Comparando…" : "Enviar planilha"}
      </Botao>
    </form>
  );
}

/** Planilha-modelo com um exemplo por campo e as categorias de ICMS das regras fiscais atuais (globais, não por empresa). */
function BaixarModelo() {
  const [erro, setErro] = useState<unknown>(null);
  const [gerando, setGerando] = useState(false);

  async function gerar() {
    setErro(null);
    setGerando(true);
    try {
      const regras = await api.get<Regras>("/api/regras");
      salvarArquivo(planilhaModeloMemoria(regras), NOME_MODELO_MEMORIA);
    } catch (e) {
      setErro(e);
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="memoria__modelo">
      <Botao variante="fantasma" tamanho="compacto" carregando={gerando} onClick={gerar}>
        Baixar planilha modelo
      </Botao>
      <span className="apurar__dica">DESCRIÇÃO, NCM, ICMS e PIS COFINS, com exemplos e as categorias de ICMS aceitas hoje.</span>
      {erro !== null && (
        <Alerta tipo="erro" titulo="Não foi possível gerar o modelo" meta={lerErro(erro).codigo}>
          {lerErro(erro).mensagem}
        </Alerta>
      )}
    </div>
  );
}

function ConsultarMemoria({ base }: { base: string }) {
  const [competencia, setCompetencia] = useState(mesAnterior());
  const [texto, setTexto] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [aberta, setAberta] = useState(false);
  const idComp = useId();
  const memoria = useCarregar<ItemMemoria[]>(
    aberta && competencia ? `${base}${consulta({ competencia, q, limit: LIMITE_MEMORIA, offset })}` : null,
  );

  const colunas: Coluna<ItemMemoria>[] = [
    { chave: "id", titulo: "ID", alinhar: "fim", celula: (m) => m.item_id },
    { chave: "descricao", titulo: "Descrição", celula: (m) => m.descricao },
    { chave: "ncm", titulo: "NCM", celula: (m) => m.ncm },
    { chave: "icms", titulo: "ICMS", celula: (m) => m.icms },
    { chave: "pis", titulo: "PIS/COFINS", celula: (m) => m.pis_cofins },
    { chave: "desde", titulo: "Desde", celula: (m) => formatarData(m.vigencia_inicio) },
  ];

  return (
    <section className="cartao" aria-labelledby={`${idComp}-titulo`}>
      <div className="memoria__titulo">
        <h2 id={`${idComp}-titulo`}>Consultar memória vigente</h2>
        {!aberta && <Botao onClick={() => setAberta(true)}>Mostrar</Botao>}
      </div>
      {aberta && (
        <>
          <form
            className="memoria__consulta"
            onSubmit={(e) => {
              e.preventDefault();
              setQ(texto.trim());
              setOffset(0);
            }}
          >
            <div className="apurar__campo">
              <label htmlFor={idComp}>Competência</label>
              <SeletorCompetencia
                modo="campo"
                id={idComp}
                valor={competencia}
                onChange={(v) => {
                  setCompetencia(v);
                  setOffset(0);
                }}
              />
            </div>
            <div className="campo-busca">
              <label htmlFor={`${idComp}-q`}>Buscar</label>
              <input
                id={`${idComp}-q`}
                type="search"
                maxLength={60}
                placeholder="Descrição ou NCM"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
            </div>
            <Botao type="submit">Buscar</Botao>
          </form>
          <Tabela
            rotulo="Memória vigente"
            colunas={colunas}
            linhas={memoria.dados ?? []}
            chaveLinha={(m) => `${m.item_id}-${m.vigencia_inicio}`}
            estado={
              memoria.carregando
                ? { tipo: "carregando", titulo: "Carregando memória…" }
                : memoria.erro
                  ? {
                      tipo: "erro",
                      titulo: "Não foi possível carregar a memória",
                      texto: lerErro(memoria.erro).mensagem,
                      acao: (
                        <Botao tamanho="compacto" variante="primario" onClick={memoria.recarregar}>
                          Tentar de novo
                        </Botao>
                      ),
                    }
                  : memoria.dados?.length === 0
                    ? q
                      ? { tipo: "filtro-sem-resultado", titulo: `Nenhum item corresponde a ‘${q}’` }
                      : { tipo: "vazio", titulo: "Memória vazia nesta competência" }
                    : null
            }
          />
          <Paginacao offset={offset} limite={LIMITE_MEMORIA} quantidade={memoria.dados?.length ?? 0} mudar={setOffset} />
        </>
      )}
    </section>
  );
}
