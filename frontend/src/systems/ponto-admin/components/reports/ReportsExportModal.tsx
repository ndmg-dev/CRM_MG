import { useState } from 'react'
import { Modal } from '../Modal'
import { downloadBlob } from '../../lib/api'
import { buildExportUrl, buildCompleteExportUrl, buildExportUrlRange,
  buildCompleteExportUrlRange, buildSubExportUrl } from '../../hooks/useReports'
import { isoWeekBounds, toInputDateLocal } from '../../utils/date'

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
type ExportPeriod = 'month' | 'week' | 'range'
type ReportType = 'simple' | 'complete' | 'mirror' | 'time-bank' | 'anomalies'
type ExportFormat = 'pdf' | 'xlsx'

interface Props {
  onClose: () => void
  scope: string
  scopeLabel: string
  employeeId: string
  ids?: string
  sectorId?: string
  initialPeriod: 'month' | 'week'
  initialYear: number
  initialMonth: number
  initialWeekDate: string
}

export default function ReportsExportModal({ onClose, scope, scopeLabel, employeeId, ids, sectorId,
  initialPeriod, initialYear, initialMonth, initialWeekDate }: Props) {
  const [period, setPeriod] = useState<ExportPeriod>(initialPeriod)
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [weekDate, setWeekDate] = useState(initialWeekDate)
  const initialWeek = isoWeekBounds(new Date(`${initialWeekDate}T12:00:00`))
  const [dateFrom, setDateFrom] = useState(initialPeriod === 'month'
    ? `${initialYear}-${String(initialMonth).padStart(2, '0')}-01`
    : toInputDateLocal(initialWeek.start))
  const [dateTo, setDateTo] = useState(initialPeriod === 'month'
    ? toInputDateLocal(new Date(initialYear, initialMonth, 0))
    : toInputDateLocal(initialWeek.end))
  const [reportType, setReportType] = useState<ReportType>('simple')
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const chosenWeek = isoWeekBounds(new Date(`${weekDate}T12:00:00`))
  const from = period === 'week' ? toInputDateLocal(chosenWeek.start) : dateFrom
  const to = period === 'week' ? toInputDateLocal(chosenWeek.end) : dateTo
  const isEmployee = scope === 'employees' && !!employeeId
  const rangeValid = period === 'month' ? year >= 2000 && year <= 2100 : !!from && !!to && from <= to
  const scopeValid = (scope !== 'employees' || !!employeeId) && (scope !== 'sector' || !!sectorId)
  const periodLabel = period === 'week' ? `Semana ${from} a ${to}` : `Período ${from} a ${to}`

  function choosePeriod(value: ExportPeriod) {
    setPeriod(value)
    setError('')
    if (value !== 'month' && !['simple', 'complete'].includes(reportType)) setReportType('simple')
  }

  function chooseReport(value: ReportType) {
    setReportType(value)
    setError('')
    if (value === 'anomalies') setFormat('xlsx')
  }

  async function exportReport() {
    if (!rangeValid) { setError('Confira as datas do período.'); return }
    if (!scopeValid) { setError('Selecione o colaborador ou setor antes de gerar o relatório.'); return }
    setBusy(true)
    setError('')
    try {
      const ext = format
      let url: string
      let filename: string
      if (period === 'month') {
        const suffix = `${year}_${String(month).padStart(2, '0')}`
        if (reportType === 'simple') url = buildExportUrl(format, year, month, scope, scopeLabel, ids, sectorId)
        else if (reportType === 'complete') url = buildCompleteExportUrl(format, year, month, scope, scopeLabel, ids, sectorId)
        else url = buildSubExportUrl(reportType, format, employeeId, year, month)
        filename = `relatorio_${reportType}_${suffix}.${ext}`
      } else {
        url = reportType === 'complete'
          ? buildCompleteExportUrlRange(format, from, to, scope, scopeLabel, periodLabel, ids, sectorId)
          : buildExportUrlRange(format, from, to, scope, scopeLabel, periodLabel, ids, sectorId)
        filename = `relatorio_${reportType}_${from}_${to}.${ext}`
      }
      await downloadBlob(url, filename)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível gerar o relatório.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Gerar relatório" maxWidth={520}>
      <div className="report-export-form">
        <div className="form-group">
          <label className="form-label" htmlFor="report-period">Período</label>
          <select id="report-period" className="form-input" value={period}
            onChange={e => choosePeriod(e.target.value as ExportPeriod)}>
            <option value="month">Mês</option>
            <option value="week">Semana</option>
            <option value="range">Datas personalizadas</option>
          </select>
        </div>
        {period === 'month' ? (
          <div className="report-export-dates">
            <div className="form-group"><label className="form-label" htmlFor="report-month">Mês</label>
              <select id="report-month" className="form-input" value={month} onChange={e => setMonth(Number(e.target.value))}>
                {MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
              </select></div>
            <div className="form-group"><label className="form-label" htmlFor="report-year">Ano</label>
              <input id="report-year" className="form-input" type="number" min="2000" max="2100" value={year}
                onChange={e => setYear(Number(e.target.value))} /></div>
          </div>
        ) : period === 'week' ? (
          <div className="form-group"><label className="form-label" htmlFor="report-week">Escolha um dia da semana</label>
            <input id="report-week" className="form-input" type="date" value={weekDate} onChange={e => { if (e.target.value) setWeekDate(e.target.value) }} />
            <span className="report-export-hint">Semana de {from} a {to}</span></div>
        ) : (
          <div className="report-export-dates">
            <div className="form-group"><label className="form-label" htmlFor="report-from">De</label>
              <input id="report-from" className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
            <div className="form-group"><label className="form-label" htmlFor="report-to">Até</label>
              <input id="report-to" className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
          </div>
        )}
        <div className="form-group"><label className="form-label" htmlFor="report-type">Tipo de relatório</label>
          <select id="report-type" className="form-input" value={reportType} onChange={e => chooseReport(e.target.value as ReportType)}>
            <option value="simple">Simplificado</option>
            <option value="complete">Detalhado</option>
            {period === 'month' && isEmployee && <>
              <option value="mirror">Espelho de ponto</option>
              <option value="time-bank">Banco de horas</option>
              <option value="anomalies">Anomalias</option>
            </>}
          </select>
        </div>
        <div className="form-group"><label className="form-label" htmlFor="report-format">Formato</label>
          <select id="report-format" className="form-input" value={format} disabled={reportType === 'anomalies'}
            onChange={e => setFormat(e.target.value as ExportFormat)}>
            <option value="pdf">PDF</option>
            <option value="xlsx">XLSX</option>
          </select>
          {reportType === 'anomalies' && <span className="report-export-hint">Anomalias disponíveis em XLSX.</span>}
        </div>
        {error && <p className="report-export-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn-primary" disabled={busy || !rangeValid || !scopeValid} onClick={exportReport}>
            {busy ? 'Gerando...' : 'Gerar relatório'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
