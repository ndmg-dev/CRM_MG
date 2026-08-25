import { AlertCircle, FileText, BarChart2, Upload } from 'react-feather'
import { Link } from 'react-router-dom'
import { contaiApi } from '../api/client'
import { useContaiQuery } from '../hooks/useContaiQuery'
import { useEmpresa } from '../context/EmpresaContext'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'
import { ContaiLoading, ContaiError } from '../components/StatusView'

const PIPELINE_STAGES = [
  ['import', 'Importação'],
  ['match', 'Cruzamento'],
  ['resolve', 'Resolução'],
  ['exception', 'Exceção'],
  ['done', 'Finalização'],
] as const

export default function Dashboard() {
  const { empresaId, loading: empresaLoading } = useEmpresa()
  const toAbs = useNativeSystemPath()
  const { data, loading, error, isAuthError, reload } = useContaiQuery(
    () => contaiApi.getDashboard(empresaId ?? undefined),
    [empresaId],
  )

  if (empresaLoading || loading) return <ContaiLoading label="Carregando dashboard..." />
  if (error) return <ContaiError message={error} isAuthError={isAuthError} onRetry={reload} />
  if (!data) return null

  return (
    <div>
      <div className="contai-header">
        <div>
          <h1>Dashboard</h1>
          <p>Visão geral operacional da Mendonça Galvão Contadores</p>
        </div>
        <Link to={toAbs('documentos')} className="contai-btn-gold">
          <Upload size={16} /> Importar Documento
        </Link>
      </div>

      <div className="contai-grid">
        <div className="contai-card contai-kpi">
          <p className="contai-kpi-label">
            <AlertCircle size={14} /> Pendentes de Conciliação
          </p>
          <h3>{data.pendentes}</h3>
        </div>
        <div className="contai-card contai-kpi">
          <p className="contai-kpi-label">
            <FileText size={14} /> Documentos Importados
          </p>
          <h3>{data.documentos_mes}</h3>
        </div>
        <div className="contai-card contai-kpi">
          <p className="contai-kpi-label">
            <BarChart2 size={14} /> Lançamentos Totais
          </p>
          <h3 style={{ color: 'var(--contai-gold)' }}>{data.lancamentos_total}</h3>
        </div>
      </div>

      <div className="contai-card">
        <h3 style={{ fontSize: '1rem', marginBottom: 20, color: 'var(--contai-text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Pipeline Operacional
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
          {PIPELINE_STAGES.map(([stage, label], i) => (
            <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
              <div style={{ background: 'var(--contai-border)', padding: '10px 20px', borderRadius: 6, fontSize: '0.82rem', color: 'var(--contai-text-muted)' }}>
                {label}
              </div>
              {i < PIPELINE_STAGES.length - 1 && <div style={{ width: 32, height: 2, background: 'var(--contai-border)' }} />}
            </div>
          ))}
        </div>
        <p style={{ marginTop: 16, fontSize: '0.8rem', color: 'var(--contai-text-muted)' }}>
          Importe um documento para iniciar o pipeline.
        </p>
      </div>
    </div>
  )
}
