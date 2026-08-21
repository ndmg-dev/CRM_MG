import { CronosLoader } from './CronosLoader'

/**
 * Tela de splash em tela cheia com o loader animado. `role="status"` +
 * `aria-live="polite"` para leitores de tela anunciarem o carregamento.
 */
export function CronosSplash({ message }: { message?: string }) {
  return (
    <div className="cronos-splash" role="status" aria-live="polite">
      <CronosLoader size={140} />
      <span className="cronos-sr-only">{message ?? 'Carregando'}</span>
    </div>
  )
}

export default CronosSplash
