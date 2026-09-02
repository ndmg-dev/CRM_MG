import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usePomodoroStore } from '../store/pomodoroStore'
import { RingTimer } from './RingTimer'
import { fmtClock } from '../lib/format'
import { api } from '@/lib/api'

/** Ícone flutuante fixo na lateral esquerda, visível em QUALQUER tela do CRM
 * enquanto houver um pomodoro em andamento (individual ou de setor) — por
 * isso vive fora da tela do Pomodoro, montado direto no MainLayout, lendo
 * do store global em vez de estado local de página. Setor tem prioridade
 * sobre individual: é o que afeta o time todo. */
export function PomodoroWidget() {
  const navigate = useNavigate()
  const individual = usePomodoroStore((s) => s.individual)
  const sector = usePomodoroStore((s) => s.sector)
  const init = usePomodoroStore((s) => s.init)

  useEffect(() => { init() }, [init])

  const { data: sistemas = [] } = useQuery({ queryKey: ['sistemas'], queryFn: () => api.sistemas.getAll() })

  const sectorActive = !!sector?.active
  const individualSessionStarted = individual.running || individual.cycle > 1 || individual.timeLeft < individual.focusMin * 60

  const showSector = sectorActive
  const showIndividual = !sectorActive && individualSessionStarted
  if (!showSector && !showIndividual) return null

  const phase = showSector ? sector!.phase : individual.phase
  const cycle = showSector ? sector!.cycle : individual.cycle
  const cyclesTotal = showSector ? sector!.cyclesTotal : individual.cyclesTotal
  const timeLeft = showSector ? sector!.timeLeft : individual.timeLeft
  const totalSec = (phase === 'focus' ? (showSector ? sector!.focusMin : individual.focusMin) : (showSector ? sector!.restMin : individual.restMin)) * 60 || 1
  const frac = 1 - timeLeft / totalSec
  const ringColor = showSector ? '#ef4444' : phase === 'focus' ? 'var(--color-gold)' : 'var(--color-success)'
  const paused = showIndividual && !individual.running

  const goToPomodoro = () => {
    const sistema = sistemas.find((s) => s.slug === 'pomodoro-ti')
    if (sistema) navigate(`/sistemas/${sistema.id}`)
  }

  return (
    <div
      onClick={goToPomodoro}
      title="Ir para o Pomodoro"
      className="fixed left-5 top-1/2 z-[100] flex -translate-y-1/2 cursor-pointer flex-col items-center gap-1.5 rounded-2xl border p-2.5 shadow-2xl"
      style={{
        background: showSector ? 'rgba(212,168,67,0.14)' : 'var(--color-surface)',
        borderColor: showSector ? 'rgba(212,168,67,0.4)' : 'var(--color-border)',
        borderWidth: '0.5px',
      }}
    >
      {showSector && (
        <div className="text-[9px] font-bold uppercase tracking-wide text-gold">Setor</div>
      )}
      <RingTimer size={52} strokeWidth={5} fracElapsed={frac} color={ringColor}>
        <span className="text-[9px] font-semibold" style={{ color: ringColor }}>
          {phase === 'focus' ? 'Foco' : 'Pausa'}
        </span>
      </RingTimer>
      <div className="text-[11px] font-semibold tabular-nums text-text-primary">{fmtClock(timeLeft)}</div>
      <div className="text-[9px] text-text-muted">Ciclo {cycle}/{cyclesTotal}</div>
      {paused && <div className="text-[9px] font-semibold text-text-secondary">Pausado</div>}
    </div>
  )
}
