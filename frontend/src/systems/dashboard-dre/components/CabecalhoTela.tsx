"use client";

import { useState } from "react";
import { EXPLICACOES } from "../lib/telas";
import { useFiltros } from "../lib/store";

/**
 * Cabeçalho da tela ativa: a pergunta que ela responde, uma frase sobre o que
 * está sendo mostrado, e um painel sob demanda com a definição de cada número.
 *
 * A definição fica recolhida de propósito — quem já sabe não é obrigado a
 * atravessar um parágrafo antes de chegar aos dados, e quem não sabe encontra a
 * resposta na própria tela, sem precisar perguntar a alguém.
 */
export function CabecalhoTela() {
  const { tela } = useFiltros();
  // Guarda QUAL tela está expandida, não um booleano: ao trocar de aba o painel
  // recolhe sozinho, em vez de abrir já expandido na tela seguinte.
  const [expandida, setExpandida] = useState<string | null>(null);
  const explicacao = EXPLICACOES[tela];
  const aberto = expandida === tela;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h2 className="text-[15px] font-medium text-text">
            {explicacao.pergunta}
          </h2>
          <p className="max-w-[74ch] text-[12px] leading-relaxed text-text-faint">
            {explicacao.resumo}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpandida(aberto ? null : tela)}
          aria-expanded={aberto}
          className="shrink-0 text-[11px] whitespace-nowrap text-text-faint underline decoration-dotted underline-offset-4 hover:text-gold"
        >
          {aberto ? "ocultar" : "o que está sendo medido aqui?"}
        </button>
      </div>

      {aberto && (
        <div className="flex flex-col gap-3 rounded-md border border-line bg-panel-2 p-4">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 lg:grid-cols-2">
            {explicacao.termos.map((item) => (
              <div key={item.termo}>
                <dt className="text-[12px] font-medium text-text-muted">
                  {item.termo}
                </dt>
                <dd className="mt-0.5 text-[11px] leading-relaxed text-text-faint">
                  {item.definicao}
                </dd>
              </div>
            ))}
          </dl>

          {explicacao.cuidados && explicacao.cuidados.length > 0 && (
            <div className="border-t border-line pt-3">
              <p className="text-[11px] tracking-[.08em] text-text-muted uppercase">
                Como não ler errado
              </p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {explicacao.cuidados.map((cuidado) => (
                  <li
                    key={cuidado}
                    className="text-[11px] leading-relaxed text-text-faint before:mr-1.5 before:text-text-muted before:content-['·']"
                  >
                    {cuidado}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
