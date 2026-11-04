import { useEffect, useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";

import { api, consulta } from "../api";
import { PERMISSOES, usePermissoes } from "../auth/permissoes";
import { MensagemErro, Pagina, Trilha, useCarregar } from "../componentes/comuns";
import { lerCnpj, mascararCnpj, normalizarRazaoSocial, PADRAO_CNPJ } from "../formato";
import type { Empresa as TipoEmpresa } from "../tipos";
import { Alerta } from "../ui/components/Alerta";
import { Botao } from "../ui/components/Botao";
import { Campo, Formulario } from "../ui/components/Campo";
import { AbaApurar } from "./empresa/AbaApurar";
import { AbaHistorico } from "./empresa/AbaHistorico";
import { AbaMemoria } from "./empresa/AbaMemoria";
import { AbaPendencias } from "./empresa/AbaPendencias";

const ABAS = [
  { id: "apurar", nome: "Apurar" },
  { id: "historico", nome: "Histórico" },
  { id: "pendencias", nome: "Pendências" },
  { id: "memoria", nome: "Memória" },
] as const;
export type IdAba = (typeof ABAS)[number]["id"];
const LIMITE_CONTADOR = 500;

export function Empresa() {
  const { codigo = "" } = useParams();
  const permissoes = usePermissoes();
  const podeGerir = permissoes.pode(PERMISSOES.gerirEmpresas);
  const somenteConsulta = !permissoes.carregando && !permissoes.pode(PERMISSOES.operar);
  const [busca, setBusca] = useSearchParams();
  const aba = (ABAS.find((a) => a.id === busca.get("aba"))?.id ?? "apurar") as IdAba;
  const competencia = busca.get("competencia") ?? "";
  const { dados: empresa, erro, recarregar } = useCarregar<TipoEmpresa>(`/api/empresas/${encodeURIComponent(codigo)}`);
  const [erroAcao, setErroAcao] = useState<unknown>(null);
  // Aviso deixado pela tela "Nova empresa" (ex.: "Empresa cadastrada com o código 0001").
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso;
  const [editando, setEditando] = useState(false);
  const idAbas = useId();
  // Contador da aba Pendências (abertas hoje); recarrega ao trocar de aba, porque resolver/descartar muda o número.
  const pendentes = useCarregar<unknown[]>(
    `/api/empresas/${encodeURIComponent(codigo)}/pendencias${consulta({ status: "ABERTA", limit: LIMITE_CONTADOR })}`,
  );
  const abertas = pendentes.dados?.length ?? 0;
  const recarregarPendentes = pendentes.recarregar;
  useEffect(() => {
    recarregarPendentes();
  }, [aba, recarregarPendentes]);

  function irPara(id: IdAba) {
    const nova = new URLSearchParams(busca);
    nova.set("aba", id);
    setBusca(nova);
  }

  async function alternarAtivo() {
    if (!empresa) return;
    const acao = empresa.ativo ? "desativar" : "ativar";
    if (!window.confirm(`Confirma ${acao} a empresa ${empresa.codigo}?`)) return;
    setErroAcao(null);
    try {
      await api.patch(`/api/empresas/${encodeURIComponent(codigo)}`, { ativo: !empresa.ativo });
      recarregar();
    } catch (e) {
      setErroAcao(e);
    }
  }

  async function salvarEdicao(dados: { razao_social: string; cnpj: string | null }) {
    await api.patch(`/api/empresas/${encodeURIComponent(codigo)}`, dados);
    setEditando(false);
    recarregar();
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

  return (
    <Pagina>
      <Trilha
        itens={[
          { rotulo: "Painel do mês", para: competencia ? `/?competencia=${competencia}` : "/" },
          { rotulo: empresa ? `${codigo} · ${empresa.razao_social}` : codigo },
        ]}
      />
      <div className="pagina__cabecalho">
        <div>
          <h1>{empresa?.razao_social ?? codigo}</h1>
          <p className="pagina__subtitulo">
            Código {codigo}
            {empresa?.cnpj && ` · CNPJ ${mascararCnpj(empresa.cnpj)}`}
            {empresa && !empresa.ativo && " · Inativa"}
          </p>
        </div>
        {empresa && podeGerir && (
          <div className="pagina__acoes">
            {!editando && <Botao onClick={() => setEditando(true)}>Editar</Botao>}
            <Botao variante={empresa.ativo ? "perigo" : "secundario"} onClick={() => void alternarAtivo()}>
              {empresa.ativo ? "Desativar" : "Ativar"}
            </Botao>
          </div>
        )}
      </div>
      {aviso && <Alerta tipo="sucesso" titulo={aviso} />}
      {somenteConsulta && (
        <Alerta tipo="aviso" titulo="Seu acesso é só de consulta: para apurar, enviar memória ou resolver pendências, peça a permissão de operação a quem administra o módulo." />
      )}
      <MensagemErro erro={erro || erroAcao} />
      {empresa && editando && (
        <EditarEmpresa empresa={empresa} salvar={salvarEdicao} cancelar={() => setEditando(false)} />
      )}

      <div className="abas" role="tablist" aria-label="Seções da empresa" onKeyDown={teclaNasAbas}>
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
            {a.id === "pendencias" && abertas > 0 && (
              <span className="aba__contador" aria-label={`${abertas} abertas`}>
                {abertas >= LIMITE_CONTADOR ? `${LIMITE_CONTADOR}+` : abertas}
              </span>
            )}
          </button>
        ))}
      </div>

      <section id={`${idAbas}-painel`} role="tabpanel" aria-labelledby={`${idAbas}-${aba}`}>
        {/* A Apurar fica montada (oculta) nas outras abas: uma apuração em andamento não se perde ao trocar de aba. */}
        <div hidden={aba !== "apurar"}>
          <AbaApurar codigo={codigo} competenciaInicial={competencia} irPara={irPara} />
        </div>
        {aba === "historico" && <AbaHistorico codigo={codigo} />}
        {aba === "pendencias" && <AbaPendencias codigo={codigo} />}
        {aba === "memoria" && <AbaMemoria codigo={codigo} />}
      </section>
    </Pagina>
  );
}

/** Admin: edita razão social e CNPJ (o código não é editável). */
function EditarEmpresa({
  empresa,
  salvar,
  cancelar,
}: {
  empresa: TipoEmpresa;
  salvar: (dados: { razao_social: string; cnpj: string | null }) => Promise<void>;
  cancelar: () => void;
}) {
  const [razao, setRazao] = useState(empresa.razao_social);
  const [cnpj, setCnpj] = useState(mascararCnpj(empresa.cnpj ?? ""));
  const [erro, setErro] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    const valorCnpj = lerCnpj(cnpj);
    if (valorCnpj === undefined) {
      setErro(new Error("CNPJ inválido: use 14 dígitos ou o formato 00.000.000/0000-00."));
      return;
    }
    setEnviando(true);
    try {
      await salvar({ razao_social: normalizarRazaoSocial(razao), cnpj: valorCnpj });
    } catch (e) {
      setErro(e);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Formulario estreito className="empresa__edicao" onSubmit={enviar} aria-label="Editar empresa">
      <MensagemErro erro={erro} />
      <Campo rotulo="Razão social">
        <input className="campo__controle campo__controle--maiusculas" required minLength={2} maxLength={200} value={razao} onChange={(e) => setRazao(e.target.value)} />
      </Campo>
      <Campo rotulo="CNPJ" opcional>
        <input
          className="campo__controle"
          maxLength={18}
          inputMode="numeric"
          pattern={PADRAO_CNPJ}
          title="14 dígitos ou 00.000.000/0000-00"
          placeholder="00.000.000/0000-00"
          value={cnpj}
          onChange={(e) => setCnpj(mascararCnpj(e.target.value))}
        />
      </Campo>
      <div className="formulario__acoes">
        <Botao type="submit" variante="primario" carregando={enviando}>
          {enviando ? "Salvando…" : "Salvar"}
        </Botao>
        <Botao variante="fantasma" onClick={cancelar} desabilitado={enviando}>
          Cancelar
        </Botao>
      </div>
    </Formulario>
  );
}
