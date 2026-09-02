import { useEffect, useRef, useState } from 'react'
import { Avatar, Badge, Button, Input, Switch } from '@mg/ui'
import { usePomodoroStore } from './store/pomodoroStore'
import { RingTimer } from './components/RingTimer'
import { fmtClock } from './lib/format'
import type { Fase } from './lib/types'

type Mode = 'individual' | 'sector'

const PHASE_COLOR: Record<Fase, string> = { focus: 'var(--color-gold)', rest: 'var(--color-success)' }
const PHASE_LABEL: Record<Fase, string> = { focus: 'Foco', rest: 'Descanso' }

function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <div className="flex flex-1 min-w-[110px] flex-col gap-1.5">
      <label className="text-xs font-medium text-text-secondary">{label}</label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || min)}
      />
    </div>
  )
}

export default function PomodoroApp() {
  const topRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<Mode>('individual')

  const store = usePomodoroStore()
  const { individual, sector, alertSound, alertBrowser, savedFlash, sectorLoading } = store

  useEffect(() => { store.init() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Inputs de "Personalização" (individual) — locais até clicar Salvar.
  const [focusInput, setFocusInput] = useState(individual.focusMin)
  const [restInput, setRestInput] = useState(individual.restMin)
  const [cyclesInput, setCyclesInput] = useState(individual.cyclesTotal)
  useEffect(() => {
    setFocusInput(individual.focusMin)
    setRestInput(individual.restMin)
    setCyclesInput(individual.cyclesTotal)
  }, [individual.focusMin, individual.restMin, individual.cyclesTotal])

  // Inputs do card "Iniciar pomodoro para todo o setor" — só o líder vê.
  const [sectorFocusInput, setSectorFocusInput] = useState(25)
  const [sectorRestInput, setSectorRestInput] = useState(5)
  const [sectorCyclesInput, setSectorCyclesInput] = useState(4)
  useEffect(() => {
    if (sector) {
      setSectorFocusInput(sector.focusMin)
      setSectorRestInput(sector.restMin)
      setSectorCyclesInput(sector.cyclesTotal)
    }
  }, [sector?.focusMin, sector?.restMin, sector?.cyclesTotal]) // eslint-disable-line react-hooks/exhaustive-deps

  const useSector = mode === 'sector'
  const active = useSector
    ? {
        phase: sector?.phase ?? 'focus',
        cycle: sector?.cycle ?? 1,
        cyclesTotal: sector?.cyclesTotal ?? 4,
        timeLeft: sector?.timeLeft ?? 0,
        focusMin: sector?.focusMin ?? 25,
        restMin: sector?.restMin ?? 5,
        running: !!sector?.active,
      }
    : {
        phase: individual.phase,
        cycle: individual.cycle,
        cyclesTotal: individual.cyclesTotal,
        timeLeft: individual.timeLeft,
        focusMin: individual.focusMin,
        restMin: individual.restMin,
        running: individual.running,
      }

  const totalSec = (active.phase === 'focus' ? active.focusMin : active.restMin) * 60 || 1
  const frac = 1 - active.timeLeft / totalSec
  const ringColor = PHASE_COLOR[active.phase]
  const canControl = useSector ? !!sector?.podeControlar : true
  const sessionStarted = active.timeLeft < totalSec || active.cycle > 1
  const startLabel = sessionStarted && !active.running ? 'Continuar' : 'Iniciar'

  const start = () => (useSector ? undefined : store.startIndividual())
  const pause = () => (useSector ? undefined : store.pauseIndividual())
  const reset = () => (useSector ? undefined : store.resetIndividual())

  return (
    <div className="flex min-h-full justify-center bg-background px-6 py-8 font-sans text-text-primary lg:px-10">
      <div ref={topRef} className="flex w-full max-w-[680px] flex-col gap-7">

        <div>
          <div className="text-lg font-semibold">Pomodoro</div>
          <div className="mt-0.5 text-[13px] text-text-secondary">
            {useSector ? 'Acompanhando o pomodoro sincronizado do setor de TI.' : 'Seu pomodoro pessoal, com seus tempos configurados.'}
          </div>
        </div>

        {sector?.active && (
          <div className="flex flex-nowrap items-center justify-between gap-4 rounded-xl border px-[18px] py-3.5" style={{ background: 'rgba(212,168,67,0.10)', borderColor: 'rgba(212,168,67,0.28)', borderWidth: '0.5px' }}>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-gold" />
              <div className="whitespace-nowrap text-[13px] text-text-primary">
                <strong>Pomodoro de setor ativo</strong> — todo o time de TI está sincronizado: {PHASE_LABEL[sector.phase]} · {fmtClock(sector.timeLeft)}
              </div>
            </div>
            {sector.podeControlar && (
              <Button variant="ghost" size="sm" onClick={() => store.stopSector()} disabled={sectorLoading} className="shrink-0 whitespace-nowrap">
                Encerrar para o setor
              </Button>
            )}
          </div>
        )}

        <div className="inline-flex w-fit gap-0.5 rounded-[10px] border p-0.5" style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)', borderWidth: '0.5px' }}>
          {(['individual', 'sector'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="h-[34px] rounded-lg px-4 font-sans text-xs font-medium transition-colors"
              style={{ background: mode === m ? 'var(--color-gold)' : 'transparent', color: mode === m ? 'var(--color-background)' : 'var(--color-text-secondary)' }}
            >
              {m === 'individual' ? 'Individual' : 'Setor completo'}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-10">
          <RingTimer size={240} strokeWidth={13} fracElapsed={frac} color={ringColor}>
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: ringColor }}>{PHASE_LABEL[active.phase]}</div>
            <div className="text-[46px] font-bold tabular-nums leading-tight">{fmtClock(active.timeLeft)}</div>
            <div className="text-xs text-text-muted">Ciclo {active.cycle}/{active.cyclesTotal}</div>
          </RingTimer>

          <div className="flex min-w-[200px] flex-col gap-4">
            {canControl ? (
              <div className="flex gap-2.5">
                {active.running ? (
                  <Button variant="ghost" size="lg" onClick={pause}>Pausar</Button>
                ) : (
                  <Button variant="primary" size="lg" onClick={start}>{startLabel}</Button>
                )}
                <Button variant="ghost" size="lg" onClick={reset}>Reiniciar</Button>
              </div>
            ) : (
              <div className="max-w-[200px] text-xs text-text-muted">
                Somente um líder de TI pode iniciar ou encerrar o pomodoro do setor. Você acompanha em tempo real.
              </div>
            )}
            <div className="flex flex-col gap-1 text-xs text-text-secondary">
              <div>Foco: {active.focusMin} min · Descanso: {active.restMin} min</div>
              <div>{active.cyclesTotal} ciclos configurados</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t pt-2" style={{ borderColor: 'var(--color-border)', borderTopWidth: '0.5px' }}>
          <div className="pt-4 text-[13px] font-semibold">Personalização</div>
          <div className="flex flex-wrap gap-3">
            <NumberField label="Foco (min)" value={focusInput} onChange={setFocusInput} min={1} max={120} />
            <NumberField label="Descanso (min)" value={restInput} onChange={setRestInput} min={1} max={60} />
            <NumberField label="Ciclos" value={cyclesInput} onChange={setCyclesInput} min={1} max={12} />
          </div>

          <div className="flex flex-col gap-2.5">
            <label className="inline-flex cursor-pointer items-center gap-2.5">
              <Switch checked={alertSound} onCheckedChange={(v) => usePomodoroStore.setState({ alertSound: v })} aria-label="Som/alerta sonoro" />
              <span className="text-[13px] text-text-primary">Som/alerta sonoro</span>
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2.5">
              <Switch checked={alertBrowser} onCheckedChange={(v) => usePomodoroStore.setState({ alertBrowser: v })} aria-label="Notificação do navegador" />
              <span className="text-[13px] text-text-primary">Notificação do navegador</span>
            </label>
            <div className="text-xs text-text-muted">Mudança visual (cor do anel e mensagem) sempre ativa.</div>
          </div>

          <div className="flex items-center justify-end gap-2">
            {savedFlash && <div className="text-xs text-success">Configurações salvas.</div>}
            <Button
              variant="primary"
              size="md"
              onClick={() => store.savePreferences({ focusMin: focusInput, restMin: restInput, cyclesTotal: cyclesInput, alertSound, alertBrowser })}
            >
              Salvar
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t pt-4" style={{ borderColor: 'var(--color-border)', borderTopWidth: '0.5px' }}>
          <div>
            <div className="text-[13px] font-semibold">Setor — Tecnologia da Informação</div>
            <div className="mt-0.5 text-xs text-text-secondary">
              {sector?.active
                ? `Pomodoro do setor em andamento — ${sector.phase === 'focus' ? 'foco' : 'descanso'}, ciclo ${sector.cycle}/${sector.cyclesTotal}.`
                : 'Nenhum pomodoro de setor em andamento.'}
            </div>
          </div>

          {sector?.podeControlar && (
            <div className="flex flex-col gap-3.5 rounded-xl border p-[18px]" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', borderWidth: '0.5px' }}>
              <div className="text-[13px] font-medium">Iniciar pomodoro para todo o setor</div>
              <div className="flex gap-3">
                <NumberField label="Foco (min)" value={sectorFocusInput} onChange={setSectorFocusInput} min={1} max={120} />
                <NumberField label="Descanso (min)" value={sectorRestInput} onChange={setSectorRestInput} min={1} max={60} />
                <NumberField label="Ciclos" value={sectorCyclesInput} onChange={setSectorCyclesInput} min={1} max={12} />
              </div>
              {sector.active ? (
                <Button variant="ghost" size="md" onClick={() => store.stopSector()} disabled={sectorLoading}>Encerrar para o setor</Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  disabled={sectorLoading}
                  onClick={() => store.startSector({ focusMin: sectorFocusInput, restMin: sectorRestInput, cyclesTotal: sectorCyclesInput })}
                >
                  Iniciar para todo o setor
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-col gap-px overflow-hidden rounded-xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', borderWidth: '0.5px' }}>
            {(sector?.membros ?? []).map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--color-border)', borderBottomWidth: '0.5px' }}>
                <div className="flex items-center gap-2.5">
                  <Avatar name={m.nome} size="sm" />
                  <div>
                    <div className="text-[13px] text-text-primary">{m.nome}</div>
                    <div className="text-[11px] text-text-muted">{m.perfil}</div>
                  </div>
                </div>
                <Badge variant={m.status === 'Em foco' ? 'warn' : m.status === 'Em pausa' ? 'ok' : 'neutral'}>{m.status}</Badge>
              </div>
            ))}
            {!sector?.membros?.length && (
              <div className="px-4 py-6 text-center text-xs text-text-muted">Nenhum membro cadastrado no setor de TI ainda.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
