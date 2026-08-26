import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { aiApi } from '../../lib/api'
import { Sparkles, FileText } from 'lucide-react'

export default function WeeklyAIReport() {
  const [report, setReport] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateReport = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await aiApi.getWeeklyReport()
      setReport(data.report)
      setMetadata(data.metadata)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao gerar relatório')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ padding: 24, position: 'relative', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: 'linear-gradient(90deg, rgba(212,168,83,0.6), rgba(184,148,47,0.3), transparent)',
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: report ? 20 : 0,
        }}
      >
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} style={{ color: 'var(--color-accent-gold)' }} />
            Relatório Semanal com IA
          </h3>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Análise automatizada da produtividade via Groq AI
          </p>
        </div>

        <button
          className="btn-primary"
          onClick={generateReport}
          disabled={loading}
          id="btn-generate-ai-report"
        >
          {loading ? (
            <>
              <div
                className="spinner-inline"
                style={{
                  width: 16,
                  height: 16,
                  border: '2px solid rgba(10,10,15,0.3)',
                  borderTopColor: '#0a0a0f',
                  borderRadius: '50%',
                }}
              />
              Gerando...
            </>
          ) : (
            <>
              <FileText size={16} />
              Gerar Relatório
            </>
          )}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--color-danger-soft)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-danger)',
            fontSize: 13,
            marginTop: 16,
          }}
        >
          {error}
        </div>
      )}

      {report && (
        <div
          className="animate-fade-in glass"
          style={{
            borderRadius: 'var(--radius-md)',
            padding: 24,
          }}
        >
          {metadata && (
            <div
              style={{
                display: 'flex',
                gap: 16,
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: '1px solid var(--color-border)',
                fontSize: 12,
                color: 'var(--color-text-muted)',
              }}
            >
              <span>📊 {metadata.tickets_completed} tickets concluídos</span>
              <span>📝 {metadata.total_events} eventos registrados</span>
            </div>
          )}

          <div
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: 'var(--color-text-primary)',
            }}
            className="prose"
          >
            <ReactMarkdown>{report}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}
