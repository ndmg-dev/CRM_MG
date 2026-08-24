import type { TimeBankData } from '../hooks/useReports'

interface Props {
  data:         TimeBankData | undefined
  onExportPdf:  () => void
  onExportXlsx: () => void
}

function fmtH(h: number) {
  const sign = h < 0 ? '−' : '+'
  const abs  = Math.abs(h)
  const hh   = Math.floor(abs)
  const mm   = Math.round((abs - hh) * 60)
  return `${sign}${hh}h${mm > 0 ? mm.toString().padStart(2, '0') : ''}`
}

function BalanceVal({ value, size = 22 }: { value: number; size?: number }) {
  const color = value >= 0 ? 'var(--mg-green)' : 'var(--mg-red)'
  return (
    <div style={{ fontSize: size, fontWeight: 600, color, lineHeight: 1 }}>
      {fmtH(value)}
    </div>
  )
}

export default function TimeBankTab({ data, onExportPdf, onExportXlsx }: Props) {
  if (!data) {
    return (
      <div style={{ color: 'var(--mg-muted)', textAlign: 'center', padding: 32, fontSize: 13 }}>
        Carregando banco de horas...
      </div>
    )
  }

  const { summary, history } = data

  return (
    <>
      {/* Export buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 14 }}>
        <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} onClick={onExportPdf}>
          ↓ PDF
        </button>
        <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} onClick={onExportXlsx}>
          ↓ XLSX
        </button>
      </div>

      {/* KPI mini-cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Saldo anterior',   value: summary.previous_balance,     color: true },
          { label: 'Horas previstas',  value: summary.expected_hours,        color: false },
          { label: 'Horas realizadas', value: summary.worked_hours,           color: false },
          { label: 'Saldo acumulado',  value: summary.accumulated_balance,   color: true },
        ].map(({ label, value, color }) => (
          <div key={label} className="metric-card">
            <small>{label}</small>
            {color ? (
              <BalanceVal value={value} size={20} />
            ) : (
              <div className="value" style={{ fontSize: 20 }}>{value.toFixed(1)}h</div>
            )}
          </div>
        ))}
      </div>

      {/* Monthly history table */}
      <div style={{ fontSize: 11, color: 'var(--mg-muted)', paddingBottom: 8, borderBottom: 'var(--mg-border)', marginBottom: 2 }}>
        Histórico mensal
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Mês</th>
            <th style={{ textAlign: 'right' }}>Previstas</th>
            <th style={{ textAlign: 'right' }}>Realizadas</th>
            <th style={{ textAlign: 'right' }}>Justificado</th>
            <th style={{ textAlign: 'right' }}>Saldo mês</th>
            <th style={{ textAlign: 'right' }}>Acumulado</th>
          </tr>
        </thead>
        <tbody>
          {history.map(r => (
            <tr key={`${r.year}-${r.month}`} style={r.is_current ? { background: 'rgba(201,150,12,0.05)' } : undefined}>
              <td style={{ color: r.is_current ? 'var(--mg-gold)' : 'var(--mg-white)', fontWeight: r.is_current ? 600 : 400 }}>
                {r.label}
                {r.is_current && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--mg-gold)', opacity: 0.7 }}>atual</span>}
              </td>
              <td style={{ textAlign: 'right', color: 'var(--mg-muted)' }}>{r.expected_hours.toFixed(1)}h</td>
              <td style={{ textAlign: 'right', color: 'var(--mg-white)' }}>{r.worked_hours.toFixed(1)}h</td>
              <td style={{ textAlign: 'right', color: 'var(--mg-muted)' }}>{r.justified_hours.toFixed(1)}h</td>
              <td style={{ textAlign: 'right', fontWeight: 600, color: r.month_balance >= 0 ? 'var(--mg-green)' : 'var(--mg-red)' }}>
                {fmtH(r.month_balance)}
              </td>
              <td style={{ textAlign: 'right', fontWeight: 600, color: r.accumulated_balance >= 0 ? 'var(--mg-green)' : 'var(--mg-red)' }}>
                {fmtH(r.accumulated_balance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
