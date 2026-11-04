// Diferenças das regras (rascunho × atuais, ou versão × anterior) no formato do detalhe do lote:
// Novos / Alterados (antes → depois) / Removidos, tabela por tabela.
import type { DiferencasRegras, TabelaRegras } from "../../tipos";
import { ChipDiferenca } from "../../ui/components/Selo";
import { fracaoParaPercentual, numeroParaTexto } from "./numeros";

export const TABELAS: { id: TabelaRegras; nome: string; chave: string }[] = [
  { id: "grupos", nome: "Grupos e cargas", chave: "nome" },
  { id: "categorias", nome: "Categorias", chave: "nome" },
  { id: "aliases", nome: "Apelidos", chave: "texto" },
  { id: "cfops", nome: "CFOPs", chave: "cfop" },
];

const ROTULOS: Record<string, string> = {
  nome: "Nome",
  modo: "Modo",
  rbc_interna: "RBC interna",
  aliq_interna: "Alíquota interna",
  rbc_interestadual: "RBC interestadual",
  aliq_interestadual: "Alíquota interestadual",
  cst_esperados: "CST esperados",
  grupo: "Grupo",
  texto: "Texto",
  categoria: "Categoria",
  cfop: "CFOP",
  tratamento: "Tratamento",
  descricao: "Descrição",
  tolerancia: "Tolerância",
  aliquotas_validas: "Alíquotas compatíveis",
  base_legal_st_interestadual: "Base legal do estorno de ST interestadual",
};

export const NOME_MODO: Record<string, string> = { PERCENTUAL: "Percentual", ST: "ST", SO_ENTRADA: "Só entrada" };

export function rotuloCampo(campo: string): string {
  return ROTULOS[campo] ?? campo;
}

/** Valor de um campo das regras para leitura humana (frações em %, tolerância em R$, listas). */
export function formatarCampo(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "(vazio)";
  if (/^(rbc|aliq)_/.test(campo) && typeof valor === "number") return `${fracaoParaPercentual(valor)}%`;
  if (campo === "tolerancia" && typeof valor === "number") return `R$ ${numeroParaTexto(valor)}`;
  if (campo === "aliquotas_validas" && Array.isArray(valor)) {
    return valor.length ? valor.map((v) => `${numeroParaTexto(Number(v))}%`).join("; ") : "(nenhuma: sem checagem)";
  }
  if (campo === "modo") return NOME_MODO[String(valor)] ?? String(valor);
  if (Array.isArray(valor)) return valor.length ? valor.join(", ") : "(nenhum)";
  return String(valor);
}

/** Uma linha de tabela em uma frase ("RBC 42,93% / 73,33% → ANEXO I"). */
export function descreverLinha(tabela: TabelaRegras, linha: Record<string, unknown>): string {
  switch (tabela) {
    case "grupos": {
      const modo = formatarCampo("modo", linha.modo);
      if (linha.modo !== "PERCENTUAL") return `${String(linha.nome)} (${modo})`;
      return `${String(linha.nome)} (${modo}: ${formatarCampo("rbc_interna", linha.rbc_interna)} × ${formatarCampo("aliq_interna", linha.aliq_interna)} interna · ${formatarCampo("rbc_interestadual", linha.rbc_interestadual)} × ${formatarCampo("aliq_interestadual", linha.aliq_interestadual)} interestadual)`;
    }
    case "categorias":
      return `${String(linha.nome)} → ${String(linha.grupo)}`;
    case "aliases":
      return `${String(linha.texto)} → ${String(linha.categoria)}`;
    case "cfops":
      return `${String(linha.cfop)} – ${String(linha.tratamento)}${linha.descricao ? ` (${String(linha.descricao)})` : ""}`;
  }
}

/** Antes riscado → depois em destaque (o mesmo desenho do detalhe do lote de memória). */
function AntesDepois({ rotulo, antes, depois }: { rotulo: string; antes: string; depois: string }) {
  return (
    <li>
      <span className="lote__campo">{rotulo}:</span> <span className="visualmente-oculto">antes </span>
      <del className="lote__antes">{antes}</del> <span aria-hidden="true">→</span>
      <span className="visualmente-oculto"> passa a ser </span> <strong className="lote__depois">{depois}</strong>
    </li>
  );
}

/** Conta as alterações (mesma regra do motor: cada linha nova, alterada ou removida + cada parâmetro). */
export function contarDiferencas(dif: DiferencasRegras | null | undefined): number {
  if (!dif) return 0;
  let n = dif.parametros?.alterados.length ?? 0;
  for (const t of TABELAS) {
    const d = dif[t.id];
    if (d) n += d.novos.length + d.alterados.length + d.removidos.length;
  }
  return n;
}

/** Resumo completo das diferenças; vazio ⇒ mensagem. */
export function ResumoDiferencas({ diferencas }: { diferencas: DiferencasRegras | null | undefined }) {
  if (contarDiferencas(diferencas) === 0) return <p className="regras__nada">Nenhuma alteração em relação às regras atuais.</p>;
  return (
    <div className="regras__resumo">
      {TABELAS.map((t) => {
        const d = diferencas?.[t.id];
        if (!d || d.novos.length + d.alterados.length + d.removidos.length === 0) return null;
        return (
          <section key={t.id} className="regras__resumo-tabela" aria-label={t.nome}>
            <h3>{t.nome}</h3>
            <ul className="regras__resumo-lista">
              {d.novos.map((linha, i) => (
                <li key={`n${i}`}>
                  <ChipDiferenca tipo="novo" /> {descreverLinha(t.id, linha)}
                </li>
              ))}
              {d.alterados.map((alt) => (
                <li key={`a${alt.chave}`}>
                  <ChipDiferenca tipo="alterado" /> <strong>{alt.chave}</strong>
                  <ul className="lote__mudancas">
                    {alt.campos.map((c) => (
                      <AntesDepois
                        key={c}
                        rotulo={rotuloCampo(c)}
                        antes={formatarCampo(c, alt.antes[c])}
                        depois={formatarCampo(c, alt.depois[c])}
                      />
                    ))}
                  </ul>
                </li>
              ))}
              {d.removidos.map((linha, i) => (
                <li key={`r${i}`}>
                  <ChipDiferenca tipo="removido" /> {descreverLinha(t.id, linha)}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {diferencas?.parametros && diferencas.parametros.alterados.length > 0 && (
        <section className="regras__resumo-tabela" aria-label="Parâmetros">
          <h3>Parâmetros</h3>
          <ul className="lote__mudancas">
            {diferencas.parametros.alterados.map((p) => (
              <AntesDepois
                key={p.chave}
                rotulo={rotuloCampo(p.chave)}
                antes={formatarCampo(p.chave, p.antes)}
                depois={formatarCampo(p.chave, p.depois)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
