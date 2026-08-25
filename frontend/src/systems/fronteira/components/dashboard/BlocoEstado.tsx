import type { ReactNode } from "react";

/** Cada bloco do dashboard carrega e falha sozinho — uma falha nunca derruba a
 * tela inteira. Este componente padroniza os três estados não-felizes.
 *
 * O erro é deliberadamente vazio de números: em dado fiscal, número parcial
 * induz decisão errada, então preferimos não mostrar nada a mostrar metade. */
export function BlocoEstado({
  carregando,
  erro,
  vazio,
  mensagemVazio,
  onTentarNovamente,
  titulo = "Não foi possível carregar este bloco",
  linhasSkeleton = 5,
  children,
}: {
  carregando: boolean;
  erro: boolean;
  vazio?: boolean;
  mensagemVazio?: string;
  onTentarNovamente?: () => void;
  titulo?: string;
  linhasSkeleton?: number;
  children: ReactNode;
}) {
  if (carregando) {
    return (
      <div className="dash-skeleton-wrap">
        {Array.from({ length: linhasSkeleton }).map((_, i) => (
          <div key={i} className="dash-skeleton-row">
            <div className="dash-skeleton-dot" />
            <div className="dash-skeleton-main">
              <div className="dash-skeleton-bar dash-skeleton-bar-lg" />
              <div className="dash-skeleton-bar dash-skeleton-bar-sm" />
            </div>
            <div className="dash-skeleton-block" />
            <div className="dash-skeleton-pill" />
          </div>
        ))}
      </div>
    );
  }

  if (erro) {
    return (
      <div className="dash-erro">
        <div className="dash-erro-icone">!</div>
        <div className="dash-erro-titulo">{titulo}</div>
        <div className="dash-erro-texto">
          Os demais blocos continuam válidos. Nenhum número parcial é exibido aqui para não induzir a decisão errada.
        </div>
        {onTentarNovamente && (
          <button type="button" className="dash-btn-retry" onClick={onTentarNovamente}>
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  if (vazio) {
    return <div className="dash-vazio">{mensagemVazio ?? "Nada por aqui nesta competência."}</div>;
  }

  return <>{children}</>;
}
