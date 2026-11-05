import { useId, useState } from "react";

import { api, baixar, consulta } from "../../api";
import { useCarregar } from "../../componentes/comuns";
import { formatarInteiro } from "../../formato";
import type { PreviaSugestoes, ResultadoAceite, ResultadoAceiteSugestoes, ResumoSugestoes } from "../../tipos";
import { AjudaPopover } from "../../ui/components/AjudaPopover";
import { Alerta, lerErro } from "../../ui/components/Alerta";
import { Botao } from "../../ui/components/Botao";
import { Dialogo } from "../../ui/components/Dialogo";
import { AJUDA } from "../../ui/textosAjuda";
import { resumirResolucao } from "./pendenciasLote";

/** Semelhança mínima que o operador escolhe para as sugestões PARECIDAS. Padrão: qualquer sugestão do motor (a partir de 75%). */
const MINIMOS = [
  { valor: "0", rotulo: "Qualquer sugestão (a partir de 75%)" },
  { valor: "0.8", rotulo: "80% ou mais" },
  { valor: "0.85", rotulo: "85% ou mais" },
  { valor: "0.9", rotulo: "90% ou mais" },
  { valor: "0.95", rotulo: "95% ou mais" },
  { valor: "1", rotulo: "Só as idênticas (100%)" },
] as const;

const plural = (n: number, um: string, varios: string) => `${formatarInteiro(n)} ${n === 1 ? um : varios}`;

/**
 * Panorama de TODAS as pendências abertas (não só da página) e as saídas para resolver em volume (ADR-010 do motor):
 * aceitar agora só as 100% idênticas, baixar a planilha de todas para preencher e reenviar, ou ir resolvendo página a página.
 * O pai remonta este componente (`key`) quando a lista muda, para o panorama acompanhar.
 */
export function ResumoPendencias({ base, aoResolver }: { base: string; aoResolver: (mensagem: string) => void }) {
  const resumo = useCarregar<ResumoSugestoes>(`${base}/pendencias/resumo-sugestoes`);
  const [confirmando, setConfirmando] = useState(false);
  const [aceitandoTodas, setAceitandoTodas] = useState(false); // diálogo "aceitar a sugestão em todas"
  const [minimo, setMinimo] = useState("0");
  const previa = useCarregar<PreviaSugestoes>(aceitandoTodas ? `${base}/pendencias/previa-sugestoes${consulta({ similaridade_minima: minimo })}` : null);
  const [sobrescrever, setSobrescrever] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const idSobrescrever = useId();
  const dados = resumo.dados;

  async function aceitar() {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await api.post<ResultadoAceite>(`${base}/pendencias/aceitar-identicas`, { sobrescrever });
      setConfirmando(false);
      const resto = r.restantes > 0 ? ` Ainda há ${plural(r.restantes, "idêntica", "idênticas")} para aceitar: repita a ação.` : "";
      aoResolver(`${resumirResolucao(r)}${resto}`);
    } catch (e) {
      setErro(e);
      setConfirmando(false);
    } finally {
      setEnviando(false);
    }
  }

  async function aceitarTodas() {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await api.post<ResultadoAceiteSugestoes>(`${base}/pendencias/aceitar-sugestoes`, { similaridade_minima: Number(minimo), sobrescrever });
      setAceitandoTodas(false);
      const resto = r.restantes > 0 ? ` Ainda há ${plural(r.restantes, "pendência", "pendências")} para aceitar: repita a ação.` : "";
      aoResolver(`${resumirResolucao(r).replace(/\.$/, "")} (${plural(r.identicas, "idêntica", "idênticas")} e ${plural(r.parecidas, "parecida", "parecidas")}).${resto}`);
    } catch (e) {
      setErro(e);
      setAceitandoTodas(false);
    } finally {
      setEnviando(false);
    }
  }

  async function baixarPlanilha() {
    setErro(null);
    try {
      await baixar(`${base}/pendencias/exportar`, "pendencias.xlsx");
    } catch (e) {
      setErro(e);
    }
  }

  if (resumo.erro && !dados) {
    return (
      <Alerta tipo="aviso" titulo="Não foi possível ler o resumo das pendências" meta={lerErro(resumo.erro).codigo}>
        {lerErro(resumo.erro).mensagem} As pendências abaixo continuam disponíveis.
      </Alerta>
    );
  }
  if (!dados) {
    return (
      <p role="status" className="lote__carregando" aria-busy="true">
        Calculando o resumo das pendências…
      </p>
    );
  }
  if (dados.abertas === 0) return null;

  return (
    <section className="pendencias__resumo" aria-labelledby="resumo-pendencias">
      <h3 id="resumo-pendencias" className="rotulo-com-ajuda">
        Resumo das pendências abertas
        <AjudaPopover rotulo="Resumo das pendências" texto={AJUDA.resumoPendencias} />
      </h3>
      <p className="pendencias__resumo-texto" role="status">
        {plural(dados.abertas, "aberta", "abertas")} · <strong>{plural(dados.identicas_aceitaveis, "idêntica", "idênticas")}</strong> (podem ser aceitas agora) ·{" "}
        {plural(dados.identicas_ambiguas, "ambígua", "ambíguas")} · {plural(dados.parecidas, "parecida", "parecidas")} · {formatarInteiro(dados.sem_sugestao)} sem sugestão
      </p>
      {erro != null && <Alerta tipo="erro" titulo={lerErro(erro).mensagem} meta={lerErro(erro).codigo} detalhes={lerErro(erro).detalhes} />}
      <div className="pendencias__resumo-acoes">
        <span className="rotulo-com-ajuda">
          <Botao variante="primario" desabilitado={dados.identicas_aceitaveis === 0} onClick={() => setConfirmando(true)}>
            Aceitar as {formatarInteiro(dados.identicas_aceitaveis)} idênticas
          </Botao>
          <AjudaPopover rotulo="Aceitar as idênticas" texto={AJUDA.aceitarTodasIdenticas} />
        </span>
        <span className="rotulo-com-ajuda">
          <Botao desabilitado={dados.identicas_aceitaveis + dados.parecidas === 0} onClick={() => setAceitandoTodas(true)}>
            Aceitar a sugestão em todas
          </Botao>
          <AjudaPopover rotulo="Aceitar a sugestão em todas" texto={AJUDA.aceitarSugestoes} />
        </span>
        <span className="rotulo-com-ajuda">
          <Botao onClick={() => void baixarPlanilha()}>Baixar planilha de todas as pendências</Botao>
          <AjudaPopover rotulo="Planilha das pendências" texto={AJUDA.planilhaPendencias} />
        </span>
      </div>

      <Dialogo
        titulo="Aceitar a sugestão do sistema em todas as pendências"
        aberto={aceitandoTodas}
        onFechar={() => setAceitandoTodas(false)}
        acoes={
          <>
            <Botao onClick={() => setAceitandoTodas(false)}>Cancelar</Botao>
            <Botao
              variante="primario"
              carregando={enviando}
              desabilitado={!previa.dados || previa.carregando || previa.dados.aceitaveis === 0}
              onClick={() => void aceitarTodas()}
            >
              {previa.dados ? `Cadastrar ${formatarInteiro(previa.dados.aceitaveis)} na memória` : "Cadastrar na memória"}
            </Botao>
          </>
        }
      >
        <label className="campo" htmlFor={`${idSobrescrever}-minimo`}>
          <span className="campo__rotulo">Semelhança mínima das sugestões parecidas</span>
          <select id={`${idSobrescrever}-minimo`} className="campo__controle" value={minimo} onChange={(e) => setMinimo(e.target.value)}>
            {MINIMOS.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.rotulo}
              </option>
            ))}
          </select>
        </label>
        {previa.erro != null ? (
          <Alerta tipo="erro" titulo={lerErro(previa.erro).mensagem} meta={lerErro(previa.erro).codigo} />
        ) : !previa.dados ? (
          <p role="status" aria-busy="true">Calculando…</p>
        ) : (
          <p role="status" className="pendencias__previa">
            Vai cadastrar <strong>{plural(previa.dados.aceitaveis, "pendência", "pendências")}</strong> ({plural(previa.dados.identicas, "idêntica", "idênticas")} e{" "}
            {plural(previa.dados.parecidas, "parecida", "parecidas")}), cada uma com a tributação da sugestão do sistema. {plural(previa.dados.ficam_para_conferir, "fica", "ficam")} para conferir
            (sem sugestão, abaixo do mínimo ou ambíguas).
          </p>
        )}
        <p className="pendencias__nota">
          Atenção: parecido não é igual. Para as parecidas, o sistema grava a tributação do produto mais parecido, para todos os meses, e isso só se corrige depois
          editando a memória. Use um mínimo mais alto se quiser aceitar só o que é muito próximo.
        </p>
        <label className="pendencias__sobrescrever" htmlFor={`${idSobrescrever}-sob`}>
          <input id={`${idSobrescrever}-sob`} type="checkbox" checked={sobrescrever} onChange={(e) => setSobrescrever(e.target.checked)} />
          Sobrescrever os que já estão na memória
        </label>
      </Dialogo>

      <Dialogo
        titulo="Aceitar as pendências idênticas"
        aberto={confirmando}
        onFechar={() => setConfirmando(false)}
        acoes={
          <>
            <Botao onClick={() => setConfirmando(false)}>Cancelar</Botao>
            <Botao variante="primario" carregando={enviando} onClick={() => void aceitar()}>
              Cadastrar {formatarInteiro(dados.identicas_aceitaveis)} na memória
            </Botao>
          </>
        }
      >
        <p>
          Vai cadastrar <strong>{plural(dados.identicas_aceitaveis, "pendência", "pendências")}</strong> com sugestão idêntica, cada uma com a tributação do item que já está na memória.
          As parecidas, ambíguas e sem sugestão não serão tocadas.
        </p>
        <label className="pendencias__sobrescrever" htmlFor={idSobrescrever}>
          <input id={idSobrescrever} type="checkbox" checked={sobrescrever} onChange={(e) => setSobrescrever(e.target.checked)} />
          Sobrescrever os que já estão na memória
        </label>
        <p className="pendencias__nota">{AJUDA.sobrescrever}</p>
      </Dialogo>
    </section>
  );
}
