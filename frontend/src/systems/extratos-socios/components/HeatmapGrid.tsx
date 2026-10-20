// Grade 12 meses × sócios (heatmap). Reutilizável: recebe as linhas (sócios) e
// os meses com extrato (com link do Drive). Verde = mês processado; vazio =
// faltando; meses futuros do ano corrente aparecem apagados. Clicar num mês
// processado abre o PDF no Drive (ou dispara onCellClick).
//
// Cores do protótipo de design (oklch).
import { MESES_CURTOS, fmtBRL0, iniciais } from '../lib/format'
import type { Money } from '../lib/types'

export interface HeatmapRow {
  nome: string
  totalRetiradas?: Money
  totalAportes?: Money
  meses: number[] // meses (1..12) em que o sócio tem movimentação
}

interface HeatmapGridProps {
  ano: number
  rows: HeatmapRow[]
  /** mes (1..12) -> URL do PDF no Drive (ou null). Define quais meses são clicáveis. */
  monthLinks?: Record<number, string | null>
  onCellClick?: (nome: string, mes: number) => void
}

const COR = {
  done: 'oklch(0.72 0.15 150)',
  missingBg: 'oklch(0.22 0.009 70 / 0.45)',
  missingBorder: 'oklch(0.275 0.009 70)',
  futureBg: 'oklch(0.19 0.01 70 / 0.4)',
  futureBorder: 'oklch(0.23 0.009 70)',
}

export function HeatmapGrid({ ano, rows, monthLinks, onCellClick }: HeatmapGridProps) {
  const agora = new Date()
  const anoCorrente = agora.getFullYear()
  const mesCorrente = agora.getMonth() + 1

  function abrir(nome: string, mes: number) {
    if (onCellClick) return onCellClick(nome, mes)
    const url = monthLinks?.[mes]
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="ex-heatmap">
      <div className="ex-heatmap-head">
        <div />
        {MESES_CURTOS.map((m) => (
          <div key={m} className="ex-heatmap-month">
            {m}
          </div>
        ))}
      </div>

      {rows.map((row) => (
        <div key={row.nome} className="ex-heatmap-row">
          <div className="ex-heatmap-socio">
            <div className="ex-avatar">{iniciais(row.nome)}</div>
            <div className="ex-heatmap-socio-info">
              <div className="ex-heatmap-socio-nome" title={row.nome}>
                {row.nome}
              </div>
              {row.totalRetiradas != null && (
                <div className="ex-heatmap-socio-total">Retiradas {fmtBRL0(row.totalRetiradas)}</div>
              )}
            </div>
          </div>

          {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => {
            const presente = row.meses.includes(mes)
            const futuro = ano === anoCorrente && mes > mesCorrente && !presente
            const temLink = Boolean(monthLinks?.[mes])
            const clicavel = presente && (temLink || Boolean(onCellClick))

            const style = presente
              ? { background: COR.done, border: `1px solid ${COR.done}` }
              : futuro
                ? { background: COR.futureBg, border: `1px solid ${COR.futureBorder}` }
                : { background: COR.missingBg, border: `1px solid ${COR.missingBorder}` }

            return (
              <button
                key={mes}
                type="button"
                className="ex-heatmap-cell"
                disabled={!clicavel}
                title={`${row.nome} · ${MESES_CURTOS[mes - 1]} · ${presente ? 'Processado' : futuro ? 'Futuro' : 'Faltando'}`}
                onClick={() => clicavel && abrir(row.nome, mes)}
                style={{ ...style, cursor: clicavel ? 'pointer' : 'default' }}
              />
            )
          })}
        </div>
      ))}

      <div className="ex-heatmap-legend">
        <span className="ex-legend-item">
          <span className="ex-legend-swatch" style={{ background: COR.done }} /> Processado
        </span>
        <span className="ex-legend-item">
          <span className="ex-legend-swatch" style={{ background: COR.missingBg, borderColor: COR.missingBorder }} /> Faltando
        </span>
        <span className="ex-legend-item">
          <span className="ex-legend-swatch" style={{ background: COR.futureBg, borderColor: COR.futureBorder }} /> Futuro
        </span>
      </div>
    </div>
  )
}
