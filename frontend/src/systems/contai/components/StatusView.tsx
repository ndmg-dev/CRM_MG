import { AlertTriangle, Lock } from 'react-feather'

/** Estado de carregamento padrão das páginas do ContAI. */
export function ContaiLoading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="contai-state">
      <div className="contai-spinner" />
      <p>{label}</p>
    </div>
  )
}

/**
 * Estado de erro padrão. Quando `isAuthError` (401 — token ausente/inválido/
 * domínio errado), mostra o aviso de "sessão inválida" em vez de qualquer
 * mensagem genérica — este sistema embarcado não tem tela de login própria
 * para redirecionar.
 */
export function ContaiError({
  message,
  isAuthError,
  onRetry,
}: {
  message: string
  isAuthError?: boolean
  onRetry?: () => void
}) {
  if (isAuthError) {
    return (
      <div className="contai-state contai-state-error">
        <Lock size={28} />
        <p className="contai-state-title">Sessão inválida</p>
        <p className="contai-state-desc">
          O ContAI não reconheceu sua sessão do CRM (token ausente, expirado ou de domínio não autorizado).
          Atualize a página ou faça login novamente no CRM.
        </p>
      </div>
    )
  }

  return (
    <div className="contai-state contai-state-error">
      <AlertTriangle size={28} />
      <p className="contai-state-title">Não foi possível carregar</p>
      <p className="contai-state-desc">{message}</p>
      {onRetry && (
        <button type="button" className="contai-btn-outline" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  )
}
