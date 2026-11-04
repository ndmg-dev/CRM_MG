import { useId, useState, type ChangeEvent, type FormEvent } from "react";

import { api } from "../../api";
import { Paginacao } from "../../componentes/comuns";
import { formatarInteiro, formatarTamanho } from "../../formato";
import type { Divergencia, Lote, ResultadoCompletar } from "../../tipos";
import { AjudaPopover } from "../../ui/components/AjudaPopover";
import { Alerta, lerErro } from "../../ui/components/Alerta";
import { Botao } from "../../ui/components/Botao";
import { EnvioArquivo } from "../../ui/components/EnvioArquivo";
import { Tabela, type Coluna } from "../../ui/components/Tabela";
import { AJUDA } from "../../ui/textosAjuda";

const MAX_SAIDAS = 6;
const POR_PAGINA = 20;
type Modo = "ACRESCIMOS" | "COMPLETA";

const plural = (n: number, um: string, varios: string) => `${formatarInteiro(n)} ${n === 1 ? um : varios}`;

/**
 * Completa a memória com as descrições do ERP usando o CÓDIGO do produto como ponte (T14, ADR-010 do motor). O código não vira chave.
 * O resultado é um LOTE: o operador abre, revisa as diferenças e aprova item a item (problemas caem na correção da importação).
 */
export function CompletarMemoria({ base, aoAbrirLote }: { base: string; aoAbrirLote: (id: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [memoria, setMemoria] = useState<File | null>(null);
  const [saidas, setSaidas] = useState<File[]>([]);
  const [modo, setModo] = useState<Modo>("ACRESCIMOS");
  const [erroArquivos, setErroArquivos] = useState<string | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoCompletar | null>(null);
  const nomeGrupo = useId();

  function escolherSaidas(evento: ChangeEvent<HTMLInputElement>) {
    const escolhidos = [...(evento.target.files ?? [])];
    if (escolhidos.some((f) => !f.name.toLowerCase().endsWith(".xlsx"))) {
      setErroArquivos("Os relatórios de saídas devem ser arquivos .xlsx.");
      setSaidas([]);
    } else if (escolhidos.length > MAX_SAIDAS) {
      setErroArquivos(`Escolha no máximo ${MAX_SAIDAS} relatórios.`);
      setSaidas([]);
    } else {
      setErroArquivos(null);
      setSaidas(escolhidos);
    }
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando || !memoria || saidas.length === 0) return;
    setErro(null);
    setResultado(null);
    setEnviando(true);
    const form = new FormData();
    form.set("memoria", memoria);
    for (const arquivo of saidas) form.append("saidas", arquivo);
    form.set("modo", modo);
    try {
      setResultado(await api.enviar<ResultadoCompletar>(`${base}/completar`, form));
    } catch (e) {
      setErro(e);
    } finally {
      setEnviando(false);
    }
  }

  const motivo = !memoria ? "Escolha a memória com a coluna do código." : saidas.length === 0 ? "Escolha ao menos um relatório de saídas." : null;

  if (!aberto) {
    return (
      <div className="cartao completar">
        <h2 className="rotulo-com-ajuda">
          Completar a memória com as vendas
          <AjudaPopover rotulo="Completar a memória" texto={AJUDA.completarMemoria} />
        </h2>
        <p className="apurar__dica">Para a memória montada por código de produto: cadastra a descrição que o ERP usa, com a tributação que o produto já tinha.</p>
        <Botao aria-expanded={false} onClick={() => setAberto(true)}>
          Completar memória…
        </Botao>
      </div>
    );
  }

  return (
    <form className="cartao completar" onSubmit={enviar} aria-labelledby={`${nomeGrupo}-titulo`}>
      <h2 id={`${nomeGrupo}-titulo`} className="rotulo-com-ajuda">
        Completar a memória com as vendas
        <AjudaPopover rotulo="Completar a memória" texto={AJUDA.completarMemoria} />
      </h2>
      <p className="apurar__dica">
        Envie a memória com o código do produto (coluna ITEM) e os relatórios de saídas dos meses a cobrir. O resultado vira um lote para você revisar e aprovar: nada é
        gravado antes.
      </p>
      <EnvioArquivo aceita=".xlsx,.csv" arquivo={memoria} onEscolher={setMemoria} travado={enviando} rotulo="Memória com código (ITEM) e descrição" />
      <div className="campo">
        <label className="campo__rotulo" htmlFor={`${nomeGrupo}-saidas`}>
          Relatórios de saídas (.xlsx, de 1 a {MAX_SAIDAS})
        </label>
        <input id={`${nomeGrupo}-saidas`} type="file" multiple accept=".xlsx" className="campo__controle" disabled={enviando} onChange={escolherSaidas} />
        {saidas.length > 0 && (
          <ul className="completar__arquivos" aria-label="Relatórios escolhidos">
            {saidas.map((f) => (
              <li key={f.name}>
                {f.name} <span className="completar__tamanho">({formatarTamanho(f.size)})</span>
              </li>
            ))}
          </ul>
        )}
        {erroArquivos && <span className="campo__erro">{erroArquivos}</span>}
      </div>
      <fieldset className="opcoes">
        <legend>Como carregar</legend>
        <div className="opcao">
          <label>
            <input type="radio" name={`${nomeGrupo}-modo`} value="ACRESCIMOS" checked={modo === "ACRESCIMOS"} onChange={() => setModo("ACRESCIMOS")} />
            Só acrescentar as linhas novas
          </label>
          <AjudaPopover rotulo="Só acrescentar" texto={AJUDA.completarAcrescimos} />
        </div>
        <div className="opcao">
          <label>
            <input type="radio" name={`${nomeGrupo}-modo`} value="COMPLETA" checked={modo === "COMPLETA"} onChange={() => setModo("COMPLETA")} />
            Memória completa (primeira carga)
          </label>
          <AjudaPopover rotulo="Memória completa" texto={AJUDA.completarCompleta} />
        </div>
      </fieldset>
      {erro !== null && (
        <Alerta tipo="erro" titulo="A memória não foi completada" meta={lerErro(erro).codigo} detalhes={lerErro(erro).detalhes}>
          {lerErro(erro).mensagem} Nada foi gravado na memória.
        </Alerta>
      )}
      <div className="completar__botoes">
        <Botao type="submit" variante="primario" carregando={enviando} desabilitadoMotivo={enviando ? null : motivo}>
          {enviando ? "Lendo os arquivos…" : "Gerar lote para revisar"}
        </Botao>
        <Botao variante="fantasma" desabilitado={enviando} onClick={() => setAberto(false)}>
          Fechar
        </Botao>
      </div>
      {enviando && (
        <p role="status" className="lote__carregando" aria-busy="true">
          Lendo a memória e os relatórios de saídas… pode levar alguns segundos por arquivo.
        </p>
      )}
      {resultado && <ResultadoCompletarVista resultado={resultado} aoAbrirLote={aoAbrirLote} />}
    </form>
  );
}

function ResultadoCompletarVista({ resultado, aoAbrirLote }: { resultado: ResultadoCompletar; aoAbrirLote: (id: string) => void }) {
  const r = resultado.relatorio;
  const lote: Lote | null = resultado.lote;
  const [offset, setOffset] = useState(0);
  const pagina = resultado.divergencias.slice(offset, offset + POR_PAGINA);
  const colunas: Coluna<Divergencia>[] = [
    { chave: "codigo", titulo: "Código", celula: (d) => d.codigo ?? "—" },
    { chave: "ncm", titulo: "NCM", celula: (d) => d.ncm },
    { chave: "descricao", titulo: "Descrição da venda", celula: (d) => d.descricao },
    { chave: "pela_descricao", titulo: "Vale hoje (pela descrição)", celula: (d) => d.icms_pela_descricao },
    { chave: "pelo_codigo", titulo: "Pelo código seria", celula: (d) => d.icms_pelo_codigo },
  ];
  return (
    <section className="completar__resultado" aria-label="Resultado" role="status">
      <h3>Resultado</h3>
      <ul className="completar__contagens">
        <li>{plural(r.adicionadas ?? 0, "linha acrescentada", "linhas acrescentadas")} (descrição do ERP + tributação do código)</li>
        <li>{plural(r.ja_batem_pela_descricao ?? 0, "produto já batia", "produtos já batiam")} pela descrição</li>
        <li>
          {plural(r.sem_correspondencia ?? 0, "produto sem correspondência", "produtos sem correspondência")}: continuam como pendência na apuração
        </li>
        {(r.origem_ambigua ?? 0) > 0 && <li>{plural(r.origem_ambigua, "produto", "produtos")} com duas tributações para o mesmo código: não acrescentados</li>}
      </ul>
      {lote ? (
        <Alerta
          tipo={lote.status === "BLOQUEADO" ? "aviso" : "sucesso"}
          titulo={lote.status === "BLOQUEADO" ? "Lote gerado com problemas a resolver" : "Lote gerado: falta você revisar e aprovar"}
          acoes={
            <Botao variante="primario" onClick={() => aoAbrirLote(lote.id)}>
              Abrir o lote para revisar
            </Botao>
          }
        >
          {lote.status === "BLOQUEADO" ? "Abra o lote: a tela de correção resolve linhas inválidas, categorias desconhecidas e conflitos." : "Nada foi gravado na memória ainda."}
        </Alerta>
      ) : (
        <Alerta tipo="aviso" titulo="Nada a acrescentar">
          Todas as vendas já batem com a memória pela descrição, ou não há correspondência pelo código.
        </Alerta>
      )}
      {resultado.total_divergencias > 0 && (
        <div className="completar__divergencias">
          <h4 className="rotulo-com-ajuda">
            {plural(resultado.total_divergencias, "divergência", "divergências")} entre código e descrição
            <AjudaPopover rotulo="Divergências" texto={AJUDA.divergenciasCompletar} />
          </h4>
          {resultado.total_divergencias > resultado.divergencias.length && (
            <Alerta tipo="aviso" titulo={`Mostrando ${formatarInteiro(resultado.divergencias.length)} de ${formatarInteiro(resultado.total_divergencias)}`}>
              O motor devolve as primeiras; confira estas e reenvie para ver as demais.
            </Alerta>
          )}
          <Tabela rotulo="Divergências entre código e descrição" colunas={colunas} linhas={pagina} chaveLinha={(d) => `${d.codigo}|${d.ncm}|${d.descricao}`} larguraMinima={980} />
          <Paginacao offset={offset} limite={POR_PAGINA} quantidade={pagina.length} mudar={setOffset} total={resultado.divergencias.length} />
        </div>
      )}
    </section>
  );
}
