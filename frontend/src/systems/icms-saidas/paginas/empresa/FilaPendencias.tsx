import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";

import { formatarInteiro } from "../../formato";
import type { Pendencia, SugestaoPendencia } from "../../tipos";
import { AjudaPopover } from "../../ui/components/AjudaPopover";
import { Botao } from "../../ui/components/Botao";
import { Campo } from "../../ui/components/Campo";
import { GrupoFiltro } from "../../ui/components/Filtros";
import { AJUDA } from "../../ui/textosAjuda";
import { Valor } from "../../componentes/comuns";
import type { Categoria } from "../../componentes/regras";
import { buscar, contarGrupos, destacarDiferencas, GRUPOS, grupoDe, grupoInicial, type Grupo } from "./pendenciasFila";
import "./pendencias.css";

type Props = {
  itens: Pendencia[];
  categorias: Categoria[];
  enviando: boolean;
  aceitar: (p: Pendencia, sugestao: SugestaoPendencia) => void;
  gravar: (p: Pendencia, tributacao: string) => void;
  descartar: (p: Pendencia, motivo: string) => void;
};

/**
 * Fila de trabalho: a lista à esquerda (agrupada pelo que fazer) e, à direita, o item aberto com as sugestões da memória
 * ao lado do produto, destacando o que muda. A decisão é sempre uma ação clara; nada é gravado sem clique da pessoa,
 * e o Enter só usa a sugestão no grupo "Pode aceitar" (idêntica e consistente).
 */
export function FilaPendencias({ itens, categorias, enviando, aceitar, gravar, descartar }: Props) {
  const contagem = useMemo(() => contarGrupos(itens), [itens]);
  const [grupo, setGrupo] = useState<Grupo>(() => grupoInicial(contagem));
  const [termo, setTermo] = useState("");
  const [escolhida, setEscolhida] = useState<number | null>(null);

  const doGrupo = useMemo(() => buscar(itens.filter((p) => grupoDe(p) === grupo), termo), [itens, grupo, termo]);
  // O grupo esvaziou (ex.: aceitou a última): vai para o próximo que ainda tem trabalho.
  useEffect(() => {
    if (contagem[grupo] === 0 && itens.length > 0) setGrupo(grupoInicial(contagem));
  }, [contagem, grupo, itens.length]);
  // O item aberto saiu da lista (foi resolvido): abre o primeiro do grupo.
  const aberta = doGrupo.find((p) => p.id === escolhida) ?? doGrupo[0] ?? null;

  function teclado(e: KeyboardEvent<HTMLUListElement>) {
    if (!doGrupo.length) return;
    const i = Math.max(0, doGrupo.findIndex((p) => p.id === aberta?.id));
    if (e.key === "ArrowDown") {
      setEscolhida(doGrupo[Math.min(doGrupo.length - 1, i + 1)].id);
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setEscolhida(doGrupo[Math.max(0, i - 1)].id);
      e.preventDefault();
    } else if (e.key === "Enter" && aberta?.sugestao_aceitavel && !enviando) {
      // só a sugestão idêntica e consistente (grupo "Pode aceitar"); parecida exige o clique em "Usar …"
      aceitar(aberta, aberta.sugestao_aceitavel);
      e.preventDefault();
    }
  }

  return (
    <div className="fila">
      <div className="fila__controles">
        <GrupoFiltro
          rotulo="O que fazer"
          valor={grupo}
          onChange={(g) => {
            setGrupo(g);
            setEscolhida(null);
          }}
          opcoes={GRUPOS.map((g) => ({ valor: g.valor, rotulo: g.rotulo, contagem: contagem[g.valor] }))}
          ajuda={<AjudaPopover rotulo="Grupos da fila" texto={AJUDA.grupoFila} />}
        />
        <div className="campo-busca">
          <label htmlFor="busca-fila">Buscar nesta página</label>
          <input id="busca-fila" type="search" maxLength={60} autoComplete="off" placeholder="Descrição ou NCM" value={termo} onChange={(e) => setTermo(e.target.value)} />
        </div>
      </div>
      <div className="fila__colunas">
        {doGrupo.length === 0 ? (
          <div className="fila__vazio" role="status">
            {termo ? "Nenhuma pendência desta página combina com a busca." : "Nada neste grupo."}
          </div>
        ) : (
          <>
            <ul className="fila__lista" role="listbox" aria-label="Pendências do grupo" tabIndex={0} onKeyDown={teclado}>
              {doGrupo.map((p) => (
                <li
                  key={p.id}
                  role="option"
                  aria-selected={p.id === aberta?.id}
                  className="fila__item"
                  onClick={() => setEscolhida(p.id)}
                >
                  <span className="fila__descricao">{p.descricao}</span>
                  <span className="fila__meta">
                    NCM {p.ncm} · {formatarInteiro(p.ocorrencias)} {p.ocorrencias === 1 ? "venda" : "vendas"} · R$ <Valor valor={p.valor_total} />
                  </span>
                </li>
              ))}
            </ul>
            {aberta && <Detalhe key={aberta.id} p={aberta} categorias={categorias} enviando={enviando} aceitar={aceitar} gravar={gravar} descartar={descartar} />}
          </>
        )}
      </div>
      <p className="fila__dica">Setas navegam pela lista. Enter usa a sugestão só no grupo “Pode aceitar”.</p>
    </div>
  );
}

function Detalhe({ p, categorias, enviando, aceitar, gravar, descartar }: Omit<Props, "itens"> & { p: Pendencia }) {
  const [tributacao, setTributacao] = useState("");
  const [descartando, setDescartando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const sugestoes = p.sugestoes ?? [];
  const pode = grupoDe(p) === "pode";

  function enviarDescarte(e: FormEvent) {
    e.preventDefault();
    if (motivo.trim()) descartar(p, motivo.trim());
  }

  return (
    <section className="fila__detalhe" aria-label={`Pendência ${p.descricao}`}>
      <h3 className="fila__titulo">{p.descricao}</h3>
      <dl className="fila__fatos">
        <div><dt>NCM</dt><dd>{p.ncm}</dd></div>
        <div><dt>CFOP</dt><dd>{p.cfop_exemplo ?? "—"}</dd></div>
        <div><dt>Vendas</dt><dd>{formatarInteiro(p.ocorrencias)}</dd></div>
        <div><dt>Valor (R$)</dt><dd><Valor valor={p.valor_total} /></dd></div>
      </dl>

      {sugestoes.length === 0 ? (
        <p className="fila__nota">Nada parecido na memória desta NCM. Escolha a tributação abaixo.</p>
      ) : (
        <>
          <p className="fila__nota rotulo-com-ajuda">
            {pode ? "Este produto já está na memória." : "Produtos parecidos na memória. O destaque mostra o que muda."}
            <AjudaPopover rotulo="Sugestão da memória" texto={AJUDA.sugestaoMemoria} />
          </p>
          <ul className="fila__candidatos">
            {sugestoes.slice(0, 3).map((s, i) => (
              <li key={s.item_id} className="fila__candidato" data-melhor={i === 0 || undefined}>
                <span className="fila__nome">
                  {s.nivel === "IDENTICO"
                    ? s.descricao
                    : destacarDiferencas(s.descricao, p.descricao).map((t, k) => (t.difere ? <mark key={k}>{t.texto} </mark> : `${t.texto} `))}
                </span>
                <span className="fila__linha">
                  <span className="fila__icms">{s.icms}</span>
                  <span className="sugestoes__nivel" data-nivel={s.nivel}>
                    {s.nivel === "IDENTICO" ? "Idêntico" : `Parecido ${Math.round(s.similaridade * 100)}%`}
                  </span>
                  <Botao
                    variante={i === 0 ? "primario" : "secundario"}
                    tamanho="compacto"
                    desabilitado={enviando}
                    onClick={() => aceitar(p, s)}
                  >
                    {`Usar ${s.icms}`}
                  </Botao>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="fila__outra">
        <Campo rotulo="Outra tributação" className="fila__campo">
          <select className="campo__controle" value={tributacao} onChange={(e) => setTributacao(e.target.value)}>
            <option value="">Escolha…</option>
            {categorias.map((c) => (
              <option key={c.nome} value={c.nome}>
                {c.grupo && c.grupo !== c.nome ? `${c.nome} (${c.grupo})` : c.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Botao desabilitado={!tributacao || enviando} onClick={() => gravar(p, tributacao)}>
          Gravar na memória
        </Botao>
        <Botao variante="fantasma" onClick={() => setDescartando((d) => !d)}>
          Descartar
        </Botao>
      </div>
      {descartando && (
        <form className="fila__descarte" onSubmit={enviarDescarte}>
          <Campo rotulo="Motivo do descarte" className="fila__campo">
            <input className="campo__controle" required maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </Campo>
          <Botao type="submit" variante="perigo" desabilitado={!motivo.trim() || enviando}>
            Descartar pendência
          </Botao>
        </form>
      )}
    </section>
  );
}
