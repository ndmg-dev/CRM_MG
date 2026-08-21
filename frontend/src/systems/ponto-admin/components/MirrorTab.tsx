import Badge from './Badge'
import type { MirrorResponse } from '../hooks/useReports'
import { openAttachment } from '../lib/api'

interface Props {
  data:         MirrorResponse | undefined
  onExportPdf:  () => void
  onExportXlsx: () => void
}

const STATUS_BADGE: Record<string, { variant: 'ok' | 'warn' | 'err' | 'neutral'; label: string }> = {
  ok:         { variant: 'ok',      label: 'OK' },
  incomplete: { variant: 'warn',    label: 'Incompleto' },
  absent:     { variant: 'err',     label: 'Falta' },
  justified:  { variant: 'neutral', label: 'Justificado' },
  holiday:    { variant: 'neutral', label: 'Feriado' },
  special:    { variant: 'neutral', label: 'Jornada esp.' },
  weekend:    { variant: 'neutral', label: 'Fim de sem.' },
  ferias:     { variant: 'neutral', label: 'Férias' },
  future:     { variant: 'neutral', label: '—' },
}

const OCCURRENCE_STATUS_VARIANT: Record<string, 'ok' | 'warn' | 'err' | 'neutral'> = {
  APROVADO:  'ok',
  PENDENTE:  'warn',
  REPROVADO: 'err',
}

function fmtH(h: number) {
  const total = Math.round(h * 60)
  const hh    = Math.floor(total / 60)
  const mm    = total % 60
  return mm > 0 ? `${hh}h${mm.toString().padStart(2, '0')}` : `${hh}h`
}

export default function MirrorTab({ data, onExportPdf, onExportXlsx }: Props) {
  if (!data) {
    return (
      <div style={{ color: 'var(--mg-muted)', textAlign: 'center', padding: 32, fontSize: 13 }}>
        Carregando espelho...
      </div>
    )
  }

  const { rows, summary } = data
  const visibleRows = rows.filter(r => r.status !== 'future')

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

      <table className="table" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ width: 70 }}>Data</th>
            <th style={{ width: 34 }}>Dia</th>
            <th style={{ width: 70 }}>Entrada</th>
            <th style={{ width: 76 }}>S. Almoço</th>
            <th style={{ width: 76 }}>R. Almoço</th>
            <th style={{ width: 68 }}>Saída</th>
            <th style={{ width: 76 }}>Trabalhado</th>
            <th style={{ width: 72 }}>Intervalo</th>
            <th>Obs.</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.length === 0 && (
            <tr>
              <td colSpan={9} style={{ color: 'var(--mg-muted)', textAlign: 'center', padding: 24 }}>
                Nenhum registro no período
              </td>
            </tr>
          )}
          {visibleRows.flatMap(r => {
            const isAbsent  = r.status === 'absent'
            const isWeekend = r.status === 'weekend'
            const isHoliday = r.status === 'holiday'
            const isFerias  = r.status === 'ferias'
            const badge     = STATUS_BADGE[r.status] ?? { variant: 'neutral', label: r.status }

            const dayRow = (
              <tr key={r.date} style={isAbsent ? { background: 'rgba(226,75,74,0.04)' } : isFerias ? { background: 'rgba(150,110,200,0.06)' } : undefined}>
                <td style={{ color: isAbsent ? 'var(--mg-red)' : 'var(--mg-white)', fontWeight: isAbsent ? 600 : 400 }}>
                  {r.date.slice(8)}/{r.date.slice(5, 7)}
                </td>
                <td style={{ color: 'var(--mg-muted)', fontSize: 11 }}>{r.weekday}</td>

                {(isAbsent || isWeekend || isHoliday || isFerias) ? (
                  <td colSpan={6} style={{ color: isFerias ? 'var(--mg-gold)' : 'var(--mg-muted)', fontStyle: 'italic', fontSize: 12 }}>
                    {isHoliday ? r.holiday_name ?? 'Feriado' : isWeekend ? 'Fim de semana' : isFerias ? 'Férias' : 'Sem registros'}
                  </td>
                ) : (
                  <>
                    <td style={{ color: r.entrada ? 'var(--mg-gold)' : 'var(--mg-muted)' }}>
                      {r.entrada ?? '—'}
                    </td>
                    <td style={{ color: r.saida_almoco ? 'var(--mg-gold)' : 'var(--mg-muted)' }}>
                      {r.saida_almoco ?? '—'}
                    </td>
                    <td style={{ color: r.retorno_almoco ? 'var(--mg-gold)' : 'var(--mg-muted)' }}>
                      {r.retorno_almoco ?? '—'}
                    </td>
                    <td style={{ color: r.saida ? 'var(--mg-gold)' : 'var(--mg-muted)' }}>
                      {r.saida ?? '—'}
                    </td>
                    <td style={{ color: r.worked_h > 0 ? 'var(--mg-green)' : 'var(--mg-muted)', fontWeight: r.worked_h > 0 ? 600 : 400 }}>
                      {r.worked_h > 0 ? fmtH(r.worked_h) : '—'}
                    </td>
                    <td style={{ color: 'var(--mg-muted)' }}>
                      {r.lunch_minutes != null ? `${r.lunch_minutes}min` : '—'}
                    </td>
                  </>
                )}

                <td>
                  {!isWeekend && <Badge variant={badge.variant}>{badge.label}</Badge>}
                  {r.has_justification && !isWeekend && (
                    <span className="badge badge-neutral" style={{ marginLeft: 4 }}>Just.</span>
                  )}
                </td>
              </tr>
            )

            // Timeline da(s) ocorrência(s) do dia (ex.: "09:00–11:00 · Falta
            // parcial · Consulta médica · Aprovado"), logo abaixo da linha do
            // dia correspondente — não só um número abatido.
            const occurrenceRow = r.occurrences.length > 0 && (
              <tr key={`${r.date}-occurrences`}>
                <td colSpan={9} style={{ padding: '2px 8px 8px', borderTop: 'none' }}>
                  {r.occurrences.map(occ => (
                    <div key={occ.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8, fontSize: 11,
                      color: 'var(--mg-muted)', padding: '3px 0', flexWrap: 'wrap',
                    }}>
                      <span style={{ color: 'var(--mg-gold)' }}>
                        {occ.start_time && occ.end_time
                          ? `${occ.start_time.slice(0, 5)}–${occ.end_time.slice(0, 5)}`
                          : occ.justified_hours != null ? `${occ.justified_hours}h` : 'Dia inteiro'}
                      </span>
                      <span>· {occ.occurrence_type_label}</span>
                      <span>· {occ.reason}</span>
                      <Badge variant={OCCURRENCE_STATUS_VARIANT[occ.status] ?? 'neutral'}>{occ.status_label}</Badge>
                      {occ.attachment_url && (
                        <button
                          onClick={() => openAttachment(occ.attachment_url!)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', color: 'inherit' }}
                          title="Ver anexo"
                        >📎</button>
                      )}
                    </div>
                  ))}
                </td>
              </tr>
            )

            return occurrenceRow ? [dayRow, occurrenceRow] : [dayRow]
          })}

          {/* Totals row */}
          {visibleRows.length > 0 && (
            <tr style={{ borderTop: '0.5px solid rgba(255,255,255,0.12)' }}>
              <td colSpan={6} style={{ color: 'var(--mg-muted)', fontSize: 11, paddingTop: 12 }}>
                Total do período
              </td>
              <td style={{ color: 'var(--mg-green)', fontWeight: 600, paddingTop: 12 }}>
                {fmtH(summary.total_worked_h)}
              </td>
              <td colSpan={2} style={{ color: 'var(--mg-muted)', fontSize: 11, paddingTop: 12 }}>
                {summary.absent_count > 0 && `${summary.absent_count} falta(s)`}
                {summary.absent_count > 0 && summary.incomplete_count > 0 && ' · '}
                {summary.incomplete_count > 0 && `${summary.incomplete_count} incompat.`}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  )
}
