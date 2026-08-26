import StatusBadge from './StatusBadge'

function formatDateTime(dateStr?: string) {
  if (!dateStr) return '—'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

interface QueryMetadataProps {
  metadata: {
    source?: string
    cached?: boolean
    consulted_at?: string
    query_duration_ms?: number
  } | null
}

export default function QueryMetadata({ metadata }: QueryMetadataProps) {
  if (!metadata) return null

  const { source, cached, consulted_at, query_duration_ms } = metadata

  return (
    <div className="query-metadata">
      {source && (
        <div className="query-metadata__item">
          <span className="query-metadata__label">Fonte:</span>
          <span className="query-metadata__value">{source}</span>
        </div>
      )}

      <div className="query-metadata__item">
        <span className="query-metadata__label">Cache:</span>
        {cached ? <StatusBadge variant="info">Cache</StatusBadge> : <StatusBadge variant="gold">Tempo real</StatusBadge>}
      </div>

      {consulted_at && (
        <div className="query-metadata__item">
          <span className="query-metadata__label">Consultado em:</span>
          <span className="query-metadata__value">{formatDateTime(consulted_at)}</span>
        </div>
      )}

      {query_duration_ms != null && (
        <div className="query-metadata__item">
          <span className="query-metadata__label">Duração:</span>
          <span className="query-metadata__value">{query_duration_ms}ms</span>
        </div>
      )}
    </div>
  )
}
