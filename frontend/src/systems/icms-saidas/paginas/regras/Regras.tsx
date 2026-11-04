// Tela "Regras" (spec das regras configuráveis §5; CONTRATO_API_REGRAS do motor §6).
// Todos leem; só o admin edita. Cada edição grava o rascunho inteiro; publicar cria uma versão imutável
// (correção para todos os meses ou mudança a partir de MM/AAAA).
import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";

import { api, consulta, ErroApi } from "../../api";
import { PERMISSOES, usePermissoes } from "../../auth/permissoes";
import { MensagemErro, Pagina, Trilha, useCarregar } from "../../componentes/comuns";
import { formatarCompetencia, formatarData, mesAtual } from "../../formato";
import type { ConteudoRegras, RascunhoRegras, VersaoRegras } from "../../tipos";
import { AjudaPopover } from "../../ui/components/AjudaPopover";
import { Alerta } from "../../ui/components/Alerta";
import { BarraAcoes } from "../../ui/components/BarraAcoes";
import { Botao } from "../../ui/components/Botao";
import { Campo } from "../../ui/components/Campo";
import { Dialogo } from "../../ui/components/Dialogo";
import { SeletorCompetencia } from "../../ui/components/SeletorCompetencia";
import { EstadoTabela } from "../../ui/components/Tabela";
import { AJUDA } from "../../ui/textosAjuda";
import { ResumoDiferencas } from "./diferencas";
import { AbaHistorico } from "./Historico";
import { AbaCategorias, AbaCfops, AbaGrupos, AbaParametros, type PropsAba } from "./tabelas";
import "../empresa/lote.css";
import "./regras.css";

const ABAS = [
  { id: "categorias", nome: "Categorias" },
  { id: "grupos", nome: "Grupos e cargas" },
  { id: "cfops", nome: "CFOPs" },
  { id: "parametros", nome: "Parâmetros" },
  { id: "historico", nome: "Histórico" },
] as const;
type IdAba = (typeof ABAS)[number]["id"];

export function Regras() {
  const admin = usePermissoes().pode(PERMISSOES.editarRegras);
  const [busca, setBusca] = useSearchParams();
  const aba = (ABAS.find((a) => a.id === busca.get("aba"))?.id ?? "categorias") as IdAba;
  const idAbas = useId();
  const carga = useCarregar<RascunhoRegras>("/api/regras/rascunho");
  // Resposta do último PUT/recarga: a tela sempre redesenha com o que o motor devolveu.
  const [rascunho, setRascunho] = useState<RascunhoRegras | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [descartando, setDescartando] = useState(false);
  useEffect(() => {
    if (carga.dados) setRascunho(carga.dados);
  }, [carga.dados]);

  function irPara(id: IdAba) {
    const nova = new URLSearchParams(busca);
    nova.set("aba", id);
    setBusca(nova);
  }
  const ativa = ABAS.findIndex((a) => a.id === aba);
  function teclaNasAbas(evento: KeyboardEvent<HTMLDivElement>) {
    const destino =
      evento.key === "ArrowRight" ? (ativa + 1) % ABAS.length
      : evento.key === "ArrowLeft" ? (ativa - 1 + ABAS.length) % ABAS.length
      : evento.key === "Home" ? 0
      : evento.key === "End" ? ABAS.length - 1
      : null;
    if (destino === null) return;
    evento.preventDefault();
    irPara(ABAS[destino].id);
    document.getElementById(`${idAbas}-${ABAS[destino].id}`)?.focus();
  }

  /** Grava o rascunho inteiro; erro volta para quem chamou (diálogo ou formulário). Rascunho desatualizado ⇒ recarrega. */
  async function salvar(conteudo: ConteudoRegras) {
    if (!rascunho) return;
    setSucesso(null);
    try {
      setRascunho(await api.put<RascunhoRegras>("/api/regras/rascunho", { conteudo, base_versao: rascunho.base_versao }));
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === "RASCUNHO_DESATUALIZADO") carga.recarregar();
      throw e;
    }
  }

  function aoPublicar(versao: VersaoRegras) {
    setPublicando(false);
    setSucesso(`Regras v${versao.numero} publicadas (${versao.tipo === "MUDANCA" ? `a partir de ${formatarCompetencia(versao.vigencia_inicio)}` : "correção: todos os meses"}).`);
    carga.recarregar();
  }
  function aoDescartar() {
    setDescartando(false);
    setSucesso("Rascunho descartado. As regras atuais continuam valendo.");
    carga.recarregar();
  }

  const props: PropsAba | null = rascunho && {
    conteudo: rascunho.conteudo,
    diferencas: rascunho.diferencas,
    editavel: admin && !rascunho.desatualizado,
    comRascunho: rascunho.existe,
    salvar,
  };

  return (
    <Pagina>
      <Trilha itens={[{ rotulo: "Painel do mês", para: "/" }, { rotulo: "Regras fiscais" }]} />
      <div className="pagina__cabecalho">
        <div>
          <h1>Regras fiscais</h1>
          <p className="pagina__subtitulo">
            Valem para todas as empresas.
            {rascunho && ` Versão atual: v${rascunho.versao_atual}.`}
            {!admin && " Você não tem permissão para alterar as regras."}
          </p>
        </div>
      </div>

      {sucesso && <Alerta tipo="sucesso" titulo={sucesso} />}
      <MensagemErro erro={erro} />
      {rascunho?.existe && rascunho.desatualizado && (
        <Alerta tipo="bloqueio" titulo="Rascunho desatualizado">
          Outra versão foi publicada depois que este rascunho começou. Descarte o rascunho e refaça as alterações sobre as regras atuais.
        </Alerta>
      )}
      {rascunho?.existe && rascunho.bloqueios.length > 0 && (
        <Alerta tipo="bloqueio" titulo="O rascunho não pode ser publicado" detalhes={rascunho.bloqueios}>
          Corrija os itens abaixo no rascunho (ou reclassifique a memória das empresas) antes de publicar.
        </Alerta>
      )}

      <div className="abas" role="tablist" aria-label="Seções das regras" onKeyDown={teclaNasAbas}>
        {ABAS.map((a) => (
          <button
            key={a.id}
            id={`${idAbas}-${a.id}`}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            aria-controls={`${idAbas}-painel`}
            tabIndex={aba === a.id ? 0 : -1}
            className="aba"
            onClick={() => irPara(a.id)}
          >
            {a.nome}
          </button>
        ))}
      </div>

      <section id={`${idAbas}-painel`} role="tabpanel" aria-labelledby={`${idAbas}-${aba}`}>
        {aba === "historico" ? (
          <AbaHistorico />
        ) : carga.erro && !rascunho ? (
          <EstadoTabela
            tipo="erro"
            titulo="Não foi possível carregar as regras."
            texto={carga.erro instanceof Error ? carga.erro.message : undefined}
            acao={<Botao onClick={carga.recarregar}>Tentar de novo</Botao>}
          />
        ) : !props ? (
          <EstadoTabela tipo="carregando" titulo="Carregando regras…" />
        ) : aba === "categorias" ? (
          <AbaCategorias {...props} />
        ) : aba === "grupos" ? (
          <AbaGrupos {...props} />
        ) : aba === "cfops" ? (
          <AbaCfops {...props} />
        ) : (
          <AbaParametros {...props} />
        )}
      </section>

      {rascunho?.existe && (
        <BarraAcoes
          rotulo="Rascunho das regras"
          resumo={
            <>
              <strong>
                Rascunho com {rascunho.n_alteracoes} alteraç{rascunho.n_alteracoes === 1 ? "ão" : "ões"}
              </strong>
              {rascunho.alterado_por && ` · salvo por ${rascunho.alterado_por} em ${formatarData(rascunho.atualizado_em)}`}
            </>
          }
          acoes={
            admin && (
              <>
                <Botao variante="perigo" onClick={() => setDescartando(true)}>
                  Descartar
                </Botao>
                <Botao
                  variante="primario"
                  onClick={() => {
                    setErro(null);
                    setPublicando(true);
                  }}
                  desabilitadoMotivo={
                    rascunho.desatualizado ? "Rascunho desatualizado: descarte e refaça."
                    : rascunho.n_alteracoes === 0 ? "Nenhuma alteração para publicar."
                    : null
                  }
                >
                  Publicar…
                </Botao>
              </>
            )
          }
        />
      )}

      {admin && rascunho && (
        <>
          <DialogoPublicar aberto={publicando} rascunho={rascunho} fechar={() => setPublicando(false)} publicado={aoPublicar} />
          <DialogoDescartar aberto={descartando} rascunho={rascunho} fechar={() => setDescartando(false)} descartado={aoDescartar} />
        </>
      )}
    </Pagina>
  );
}

// ---------------------------------------------------------------- publicar

function DialogoPublicar({
  aberto,
  rascunho,
  fechar,
  publicado,
}: {
  aberto: boolean;
  rascunho: RascunhoRegras;
  fechar: () => void;
  publicado: (versao: VersaoRegras) => void;
}) {
  const idForm = useId();
  const idMes = useId();
  const [tipo, setTipo] = useState<"CORRECAO" | "MUDANCA">("CORRECAO");
  const [mes, setMes] = useState("");
  const [mesValido, setMesValido] = useState(true);
  const [resumo, setResumo] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    setTipo("CORRECAO");
    setMes("");
    setResumo("");
    setConfirmado(false);
    setErro(null);
  }, [aberto]);

  // Mudança datada: os bloqueios dependem da data (uso na memória a partir dela, mudança posterior já existente).
  const previa = useCarregar<RascunhoRegras>(
    aberto && tipo === "MUDANCA" && mes && mesValido ? `/api/regras/rascunho${consulta({ vigencia_inicio: mes })}` : null,
  );
  const base = tipo === "MUDANCA" && previa.dados ? previa.dados : rascunho;
  const quando = tipo === "MUDANCA" ? (mes ? `a partir de ${formatarCompetencia(mes)}` : "a partir do mês escolhido") : "de todos os meses";
  const precisaConfirmar = base.requer_confirmacao.length > 0;

  const motivo =
    base.bloqueios.length > 0 ? "Há bloqueios: corrija o rascunho antes de publicar."
    : tipo === "MUDANCA" && (!mes || !mesValido) ? "Informe o mês de início (MM/AAAA)."
    : tipo === "MUDANCA" && previa.carregando ? "Conferindo a data…"
    : precisaConfirmar && !confirmado ? "Confirme o impacto nas apurações."
    : null;

  async function publicar() {
    setErro(null);
    setEnviando(true);
    try {
      const versao = await api.post<VersaoRegras>("/api/regras/rascunho/publicar", {
        tipo,
        ...(tipo === "MUDANCA" ? { vigencia_inicio: mes } : {}),
        resumo: resumo.trim(),
        confirmar_impacto: precisaConfirmar && confirmado,
      });
      publicado(versao);
    } catch (e) {
      setErro(e);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo
      titulo="Publicar regras"
      aberto={aberto}
      onFechar={fechar}
      acoes={
        <>
          <Botao variante="fantasma" onClick={fechar} desabilitado={enviando}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form={idForm} carregando={enviando} desabilitadoMotivo={motivo}>
            {enviando ? "Publicando…" : `Publicar v${rascunho.versao_atual + 1}`}
          </Botao>
        </>
      }
    >
      <form
        id={idForm}
        className="regras__publicar"
        aria-label="Publicar regras"
        onSubmit={(e) => {
          e.preventDefault();
          if (!motivo) void publicar();
        }}
      >
        <MensagemErro erro={erro} />
        {base.bloqueios.length > 0 && (
          <Alerta tipo="bloqueio" titulo="Publicação bloqueada" detalhes={base.bloqueios} />
        )}
        <h3>O que muda</h3>
        <ResumoDiferencas diferencas={rascunho.diferencas} />

        <fieldset className="regras__vigencia">
          <legend>Vigência</legend>
          <label className="regras__opcao">
            <input type="radio" name="tipo" checked={tipo === "CORRECAO"} onChange={() => setTipo("CORRECAO")} />
            Correção (vale para todos os meses)
            <AjudaPopover rotulo="Correção" texto={AJUDA.correcaoRegras} />
          </label>
          <label className="regras__opcao">
            <input type="radio" name="tipo" checked={tipo === "MUDANCA"} onChange={() => setTipo("MUDANCA")} />
            Mudança a partir de um mês
            <AjudaPopover rotulo="Mudança a partir de um mês" texto={AJUDA.mudancaRegras} />
          </label>
          {tipo === "MUDANCA" && (
            <div className="apurar__campo">
              <label htmlFor={idMes}>A partir de</label>
              <SeletorCompetencia
                modo="campo"
                id={idMes}
                valor={mes}
                onChange={setMes}
                onValidade={setMesValido}
                max={`${Number(mesAtual().slice(0, 4)) + 5}-12`}
              />
            </div>
          )}
        </fieldset>

        <Campo rotulo="Resumo da publicação" opcional dica="Aparece no histórico das versões.">
          <textarea className="campo__controle" rows={2} maxLength={500} value={resumo} onChange={(e) => setResumo(e.target.value)} />
        </Campo>

        {precisaConfirmar && (
          <div className="regras__confirmacao">
            <p>Estas alterações mudam o cálculo das apurações {quando}:</p>
            <ul>
              {base.requer_confirmacao.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <label className="regras__opcao">
              <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />
              Confirmo: afeta as apurações {quando}.
            </label>
          </div>
        )}
      </form>
    </Dialogo>
  );
}

// ---------------------------------------------------------------- descartar

function DialogoDescartar({
  aberto,
  rascunho,
  fechar,
  descartado,
}: {
  aberto: boolean;
  rascunho: RascunhoRegras;
  fechar: () => void;
  descartado: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (aberto) {
      setMotivo("");
      setErro(null);
    }
  }, [aberto]);

  async function descartar() {
    setErro(null);
    setEnviando(true);
    try {
      await api.post("/api/regras/rascunho/descartar", motivo.trim() ? { motivo: motivo.trim() } : {});
      descartado();
    } catch (e) {
      setErro(e);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo
      titulo="Descartar rascunho"
      aberto={aberto}
      onFechar={fechar}
      acoes={
        <>
          <Botao variante="fantasma" onClick={fechar} desabilitado={enviando}>
            Cancelar
          </Botao>
          <Botao variante="perigo" onClick={() => void descartar()} carregando={enviando}>
            {enviando ? "Descartando…" : "Descartar rascunho"}
          </Botao>
        </>
      }
    >
      <MensagemErro erro={erro} />
      <p>
        As {rascunho.n_alteracoes} alteraç{rascunho.n_alteracoes === 1 ? "ão" : "ões"} do rascunho serão perdidas. As regras atuais (v
        {rascunho.versao_atual}) continuam valendo. O descarte fica registrado na auditoria.
      </p>
      <Campo rotulo="Motivo" opcional>
        <textarea className="campo__controle" rows={2} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Campo>
    </Dialogo>
  );
}
