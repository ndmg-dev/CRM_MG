import { useMemo, useState } from "react";

import { formatarInteiro } from "../../formato";
import type { Pendencia } from "../../tipos";
import { AjudaPopover } from "../../ui/components/AjudaPopover";
import { Botao } from "../../ui/components/Botao";
import { AJUDA } from "../../ui/textosAjuda";
import { Valor } from "../../componentes/comuns";
import { formatarValor } from "../../formato";
import type { Categoria } from "../../componentes/regras";
import { buscar } from "./pendenciasFila";
import "./pendencias.css";

type Props = {
  itens: Pendencia[];
  categorias: Categoria[];
  enviando: boolean;
  sobrescrever: boolean;
  setSobrescrever: (v: boolean) => void;
  /** Envia (em blocos) as pendências marcadas com a tributação escolhida. */
  aplicar: (tributacao: string, ids: number[]) => void;
};

/**
 * Em lote, em três passos: 1) escolher a tributação (só as cadastradas nas regras), 2) marcar os produtos que são dessa tributação,
 * 3) aplicar. O motor valida a categoria e recusa, sem sobrescrever, o item que já está na memória.
 */
export function LotePendencias({ itens, categorias, enviando, sobrescrever, setSobrescrever, aplicar }: Props) {
  const [tributacao, setTributacao] = useState("");
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const [termo, setTermo] = useState("");
  const visiveis = useMemo(() => buscar(itens, termo), [itens, termo]);
  const escolhidas = itens.filter((p) => marcadas.has(p.id));
  const total = escolhidas.reduce((s, p) => s + p.valor_total, 0);
  const divergentes = tributacao ? escolhidas.filter((p) => p.sugestoes?.[0] && p.sugestoes[0].icms !== tributacao).length : 0;
  const indicam = tributacao ? visiveis.filter((p) => p.sugestoes?.[0]?.icms === tributacao) : [];

  function alternar(id: number, marcar: boolean) {
    setMarcadas((atual) => {
      const nova = new Set(atual);
      if (marcar) nova.add(id);
      else nova.delete(id);
      return nova;
    });
  }

  return (
    <div className="lote">
      <section className="lote__passo" aria-labelledby="lote-1">
        <h3 id="lote-1" className="lote__titulo rotulo-com-ajuda">
          <span className="lote__num" data-ativo>1</span>
          Escolha a tributação
          <AjudaPopover rotulo="Tributação em lote" texto={AJUDA.tributacaoEmLote} />
        </h3>
        <div className="lote__opcoes" role="group" aria-label="Tributações cadastradas">
          {categorias.map((c) => (
            <button key={c.nome} type="button" className="grupo-filtro__opcao" aria-pressed={tributacao === c.nome} onClick={() => setTributacao(c.nome)}>
              {c.nome}
            </button>
          ))}
          {categorias.length === 0 && <span className="fila__nota">Não foi possível ler as categorias das regras fiscais.</span>}
        </div>
      </section>

      <section className="lote__passo" aria-labelledby="lote-2">
        <h3 id="lote-2" className="lote__titulo">
          <span className="lote__num" data-ativo={tributacao ? true : undefined}>2</span>
          Marque os produtos dessa tributação
        </h3>
        <div className="lote__ferramentas">
          <div className="campo-busca">
            <label htmlFor="busca-lote">Buscar nesta página</label>
            <input id="busca-lote" type="search" maxLength={60} autoComplete="off" placeholder="Descrição ou NCM" value={termo} onChange={(e) => setTermo(e.target.value)} />
          </div>
          <Botao tamanho="compacto" desabilitado={indicam.length === 0} onClick={() => setMarcadas((a) => new Set([...a, ...indicam.map((p) => p.id)]))}>
            {`Marcar os que a sugestão indica (${indicam.length})`}
          </Botao>
          <Botao tamanho="compacto" variante="fantasma" desabilitado={marcadas.size === 0} onClick={() => setMarcadas(new Set())}>
            Limpar marcas
          </Botao>
        </div>
        <ul className="lote__lista" aria-label="Pendências para marcar">
          {visiveis.length === 0 && <li className="fila__vazio">Nenhuma pendência desta página combina com a busca.</li>}
          {visiveis.map((p) => {
            const sug = p.sugestoes?.[0];
            return (
              <li key={p.id} className="lote__item" data-marcada={marcadas.has(p.id) || undefined}>
                <label>
                  <input type="checkbox" aria-label={`Selecionar ${p.descricao}`} checked={marcadas.has(p.id)} onChange={(e) => alternar(p.id, e.target.checked)} />
                  <span>
                    <span className="fila__descricao">{p.descricao}</span>
                    <span className="fila__meta">
                      NCM {p.ncm} · {formatarInteiro(p.ocorrencias)} {p.ocorrencias === 1 ? "venda" : "vendas"} · R$ <Valor valor={p.valor_total} />
                    </span>
                  </span>
                  {sug ? (
                    <span className="lote__sugestao" data-igual={sug.icms === tributacao || undefined}>
                      sugestão: {sug.icms}
                    </span>
                  ) : (
                    <span className="lote__sugestao">sem sugestão</span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
        <label className="pendencias__sobrescrever lote__sobrescrever">
          <input type="checkbox" checked={sobrescrever} onChange={(e) => setSobrescrever(e.target.checked)} />
          Trocar a tributação dos que já estão na memória
          <AjudaPopover rotulo="Sobrescrever" texto={AJUDA.sobrescrever} />
        </label>
      </section>

      <div className="lote__acao" role="group" aria-label="Aplicar em lote">
        <div>
          <p className="lote__resumo" role="status">
            {escolhidas.length === 0 ? "Nenhum produto marcado" : `${formatarInteiro(escolhidas.length)} ${escolhidas.length === 1 ? "marcado" : "marcados"} · R$ ${formatarValor(total)}`}
          </p>
          {divergentes > 0 && (
            <p className="lote__aviso">
              {divergentes} {divergentes === 1 ? "tem" : "têm"} sugestão diferente de {tributacao}. Confira antes de aplicar.
            </p>
          )}
        </div>
        <Botao
          variante="primario"
          tamanho="principal"
          carregando={enviando}
          desabilitado={!tributacao || escolhidas.length === 0}
          onClick={() => aplicar(tributacao, escolhidas.map((p) => p.id))}
        >
          {tributacao && escolhidas.length > 0 ? `Aplicar ${tributacao} a ${formatarInteiro(escolhidas.length)}` : "Aplicar"}
        </Botao>
      </div>
    </div>
  );
}
