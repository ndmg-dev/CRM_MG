import "./barra-situacao.css";

/** Ordem de atenção: o que precisa de ação primeiro. A barra e a tabela do painel seguem esta ordem. */
export const ORDEM_SITUACAO = ["ERRO", "CONCLUIDA_COM_PENDENCIAS", "SEM_APURACAO", "PROCESSANDO", "CONCLUIDA"] as const;

/** Amostra de cor de uma situação (decorativa: quem usa sempre mostra o nome ao lado). */
export function AmostraSituacao({ situacao }: { situacao: string }) {
  return <span className="amostra-situacao" data-situacao={situacao} aria-hidden="true" />;
}

/**
 * Barra proporcional das situações do mês. SVG com atributos de geometria (a CSP bloqueia `style`), cores por classe.
 * Concluídas à esquerda e o que falta à direita, terminando em "Sem apuração" (o trilho vazio).
 * Decorativa: a contagem por situação aparece em texto nos filtros logo abaixo.
 */
export function BarraSituacao({ contagens }: { contagens: Record<string, number> }) {
  const ordem = [...ORDEM_SITUACAO].reverse().filter((s) => s !== "SEM_APURACAO");
  const total = Object.values(contagens).reduce((s, n) => s + n, 0);
  // início de cada faixa = soma das anteriores (sem reatribuir variável durante a renderização)
  const faixas = ordem.map((situacao, i) => ({
    situacao,
    largura: contagens[situacao] ?? 0,
    inicio: ordem.slice(0, i).reduce((s, anterior) => s + (contagens[anterior] ?? 0), 0),
  }));
  return (
    <svg className="barra-situacao" viewBox={`0 0 ${Math.max(total, 1)} 1`} preserveAspectRatio="none" aria-hidden="true">
      {faixas.map(({ situacao, largura, inicio }) =>
        largura > 0 ? <rect key={situacao} x={inicio} y={0} width={largura} height={1} data-situacao={situacao} /> : null,
      )}
    </svg>
  );
}
