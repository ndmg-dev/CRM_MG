import { Fragment } from "react";
import { Check } from "lucide-react";

/** Indicador de passos estilo v7: círculos numerados, ✓ nos concluídos,
 * destaque no atual, conectores entre eles. `current` é 1-based.
 * Se `onStepClick` for passado, os passos JÁ CONCLUÍDOS (n < current) viram
 * clicáveis pra voltar — nunca pra frente (evita pular etapas não feitas e
 * disparar efeitos como finalizar/calcular fora de ordem). */
export function WizardStepsIndicator({
  steps,
  current,
  onStepClick,
}: {
  steps: string[];
  current: number;
  onStepClick?: (n: number) => void;
}) {
  return (
    <div className="wsteps" role="list" aria-label="Passos">
      {steps.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "active" : "pending";
        const clickable = !!onStepClick && n < current;
        return (
          <Fragment key={label}>
            {i > 0 && <span className={`wsteps-conn ${n <= current ? "on" : ""}`} aria-hidden />}
            {clickable ? (
              <button
                type="button"
                className={`wsteps-item ${state} clickable`}
                onClick={() => onStepClick!(n)}
                title={`Voltar para ${label}`}
              >
                <span className="wsteps-circle"><Check size={15} strokeWidth={3} /></span>
                <span className="wsteps-label">{label}</span>
              </button>
            ) : (
              <div className={`wsteps-item ${state}`} role="listitem" aria-current={state === "active" || undefined}>
                <span className="wsteps-circle">{state === "done" ? <Check size={15} strokeWidth={3} /> : n}</span>
                <span className="wsteps-label">{label}</span>
              </div>
            )}
          </Fragment>
        );
      })}
      <style>{css}</style>
    </div>
  );
}

const css = `
.wsteps { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.wsteps-item { display: inline-flex; align-items: center; gap: 8px; background: none; border: none; padding: 0; font: inherit; }
.wsteps-item.clickable { cursor: pointer; }
.wsteps-item.clickable:hover .wsteps-circle { box-shadow: 0 0 0 3px var(--primary-tint); }
.wsteps-item.clickable:hover .wsteps-label { color: var(--ink); }
.wsteps-circle {
  width: 26px; height: 26px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; font-family: var(--font-ui);
  border: 1.5px solid var(--line-strong); color: var(--muted); background: var(--surface);
  flex-shrink: 0; transition: all 120ms ease;
}
.wsteps-label { font-size: 13px; font-weight: 500; color: var(--muted); white-space: nowrap; }
.wsteps-item.active .wsteps-circle { border-color: var(--primary); color: var(--primary); box-shadow: 0 0 0 3px var(--primary-tint); }
.wsteps-item.active .wsteps-label { color: var(--ink); font-weight: 600; }
.wsteps-item.done .wsteps-circle { border-color: var(--primary); background: var(--primary); color: #1a1400; }
.wsteps-item.done .wsteps-label { color: var(--ink-soft); }
.wsteps-conn { height: 2px; width: 28px; background: var(--line-strong); border-radius: 2px; }
.wsteps-conn.on { background: var(--primary); }
@media (max-width: 720px) { .wsteps-label { display: none; } .wsteps-conn { width: 16px; } }
`;
