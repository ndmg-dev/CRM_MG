import Button from './Button'

interface ErrorAlertProps {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}

export default function ErrorAlert({
  title = 'Erro na consulta',
  message = 'Ocorreu um erro ao processar sua solicitação.',
  onRetry,
  className = '',
}: ErrorAlertProps) {
  return (
    <div className={`error-alert ${className}`} role="alert">
      <div className="error-alert__icon" aria-hidden="true">
        ⚠
      </div>
      <div className="error-alert__content">
        <h3 className="error-alert__title">{title}</h3>
        <p className="error-alert__message">{message}</p>
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            Tentar novamente
          </Button>
        )}
      </div>
    </div>
  )
}
