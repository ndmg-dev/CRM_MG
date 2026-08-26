function TextSkeleton({ lines = 3 }: { lines?: number }) {
  const widths = ['95%', '80%', '60%', '90%', '70%', '85%', '50%', '75%']

  return (
    <div className="loading-skeleton-group">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="loading-skeleton loading-skeleton--text" style={{ width: widths[i % widths.length] }} />
      ))}
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="glass-card" style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <div className="loading-skeleton loading-skeleton--text" style={{ width: '40%', height: '1.5rem' }} />
      <div className="loading-skeleton loading-skeleton--text" style={{ width: '25%', height: '0.875rem' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
        <div>
          <div className="loading-skeleton loading-skeleton--text" style={{ width: '50%', height: '0.625rem', marginBottom: '0.375rem' }} />
          <div className="loading-skeleton loading-skeleton--text" style={{ width: '80%' }} />
        </div>
        <div>
          <div className="loading-skeleton loading-skeleton--text" style={{ width: '50%', height: '0.625rem', marginBottom: '0.375rem' }} />
          <div className="loading-skeleton loading-skeleton--text" style={{ width: '70%' }} />
        </div>
        <div>
          <div className="loading-skeleton loading-skeleton--text" style={{ width: '45%', height: '0.625rem', marginBottom: '0.375rem' }} />
          <div className="loading-skeleton loading-skeleton--text" style={{ width: '65%' }} />
        </div>
        <div>
          <div className="loading-skeleton loading-skeleton--text" style={{ width: '55%', height: '0.625rem', marginBottom: '0.375rem' }} />
          <div className="loading-skeleton loading-skeleton--text" style={{ width: '75%' }} />
        </div>
      </div>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="glass-card" style={{ padding: 'var(--space-lg)' }}>
      <div className="loading-skeleton loading-skeleton--text" style={{ width: '30%', height: '1.25rem', marginBottom: 'var(--space-md)' }} />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="loading-skeleton loading-skeleton--row" />
      ))}
    </div>
  )
}

interface LoadingSkeletonProps {
  variant?: 'card' | 'table' | 'text'
  lines?: number
  className?: string
}

export default function LoadingSkeleton({ variant = 'card', lines = 3, className = '' }: LoadingSkeletonProps) {
  const content = (() => {
    switch (variant) {
      case 'table':
        return <TableSkeleton />
      case 'text':
        return <TextSkeleton lines={lines} />
      case 'card':
      default:
        return <CardSkeleton />
    }
  })()

  return <div className={className}>{content}</div>
}
