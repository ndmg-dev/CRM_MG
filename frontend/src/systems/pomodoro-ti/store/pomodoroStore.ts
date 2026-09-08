import { create } from 'zustand'
import { pomodoroApi } from '../lib/api'
import { playPhaseChangeBeep } from '../lib/sound'
import { showBrowserNotification, requestBrowserNotificationPermission } from '@suporte/hooks/useBrowserNotifications'
import type { Fase, PomodoroSetorState } from '../lib/types'

const SECTOR = 'TI'
const SECTOR_POLL_MS = 5000

interface IndividualState {
  phase: Fase
  cycle: number
  cyclesTotal: number
  timeLeft: number
  running: boolean
  focusMin: number
  restMin: number
}

interface PomodoroStore {
  started: boolean
  individual: IndividualState
  alertSound: boolean
  alertBrowser: boolean
  savedFlash: boolean
  sector: PomodoroSetorState | null
  sectorLoading: boolean
  sectorError: string | null

  init: () => void
  loadPreferences: () => Promise<void>
  savePreferences: (input: { focusMin: number; restMin: number; cyclesTotal: number; alertSound: boolean; alertBrowser: boolean }) => Promise<void>
  startIndividual: () => void
  pauseIndividual: () => void
  resetIndividual: () => void
  refreshSector: () => Promise<void>
  startSector: (input: { focusMin: number; restMin: number; cyclesTotal: number }) => Promise<void>
  stopSector: () => Promise<void>
}

/** Mesma máquina de estado usada no backend (_resolve) e no protótipo:
 * foco termina -> descanso; descanso termina -> próximo ciclo ou reset. */
function advance(phase: Fase, cycle: number, cyclesTotal: number, focusMin: number, restMin: number) {
  if (phase === 'focus') {
    return { phase: 'rest' as Fase, cycle, timeLeft: restMin * 60, finished: false }
  }
  if (cycle >= cyclesTotal) {
    return { phase: 'focus' as Fase, cycle: 1, timeLeft: focusMin * 60, finished: true }
  }
  return { phase: 'focus' as Fase, cycle: cycle + 1, timeLeft: focusMin * 60, finished: false }
}

function fireAlerts(nextPhase: Fase, alertSound: boolean, alertBrowser: boolean, label: string) {
  if (alertSound) playPhaseChangeBeep(nextPhase)
  if (alertBrowser) {
    const msg = nextPhase === 'focus' ? 'Hora de focar de novo.' : 'Hora de descansar.'
    showBrowserNotification(`Pomodoro — ${label}`, msg)
  }
}

let tickerStarted = false
let sectorPollTimer: ReturnType<typeof setInterval> | null = null

export const usePomodoroStore = create<PomodoroStore>((set, get) => ({
  started: false,
  individual: {
    phase: 'focus', cycle: 1, cyclesTotal: 4, timeLeft: 25 * 60, running: false, focusMin: 25, restMin: 5,
  },
  alertSound: true,
  alertBrowser: true,
  savedFlash: false,
  sector: null,
  sectorLoading: false,
  sectorError: null,

  init: () => {
    if (tickerStarted) return
    tickerStarted = true
    get().loadPreferences()
    get().refreshSector()
    sectorPollTimer = setInterval(() => get().refreshSector(), SECTOR_POLL_MS)
    setInterval(() => {
      const s = get()
      // --- timer individual ---
      if (s.individual.running) {
        set((st) => {
          const ind = st.individual
          if (ind.timeLeft > 1) return { individual: { ...ind, timeLeft: ind.timeLeft - 1 } }
          const next = advance(ind.phase, ind.cycle, ind.cyclesTotal, ind.focusMin, ind.restMin)
          fireAlerts(next.phase, st.alertSound, st.alertBrowser, 'individual')
          return {
            individual: {
              ...ind,
              phase: next.phase,
              cycle: next.cycle,
              timeLeft: next.timeLeft,
              running: !next.finished,
            },
          }
        })
      }
      // --- ticking local do setor entre polls (suavidade visual; a
      // correção de verdade vem do refreshSector a cada 5s) ---
      set((st) => {
        if (!st.sector || !st.sector.active || st.sector.timeLeft <= 0) return {}
        return { sector: { ...st.sector, timeLeft: st.sector.timeLeft - 1 } }
      })
    }, 1000)
  },

  loadPreferences: async () => {
    try {
      const prefs = await pomodoroApi.getPreferencias()
      set((st) => ({
        alertSound: prefs.alertSound,
        alertBrowser: prefs.alertBrowser,
        individual: {
          ...st.individual,
          focusMin: prefs.focusMin,
          restMin: prefs.restMin,
          cyclesTotal: prefs.cyclesTotal,
          timeLeft: st.individual.running ? st.individual.timeLeft : prefs.focusMin * 60,
        },
      }))
    } catch {
      // Sem preferências salvas ainda (ou offline) — fica no padrão 25/5/4.
    }
  },

  savePreferences: async (input) => {
    const saved = await pomodoroApi.putPreferencias(input)
    set(() => ({
      alertSound: saved.alertSound,
      alertBrowser: saved.alertBrowser,
      individual: {
        phase: 'focus', cycle: 1, running: false,
        focusMin: saved.focusMin, restMin: saved.restMin, cyclesTotal: saved.cyclesTotal,
        timeLeft: saved.focusMin * 60,
      },
      savedFlash: true,
    }))
    if (get().alertBrowser) requestBrowserNotificationPermission()
    setTimeout(() => set({ savedFlash: false }), 2500)
  },

  startIndividual: () => set((st) => ({ individual: { ...st.individual, running: true } })),
  pauseIndividual: () => set((st) => ({ individual: { ...st.individual, running: false } })),
  resetIndividual: () => set((st) => ({
    individual: { ...st.individual, running: false, phase: 'focus', cycle: 1, timeLeft: st.individual.focusMin * 60 },
  })),

  refreshSector: async () => {
    const prevPhase = get().sector?.phase
    const prevActive = get().sector?.active
    try {
      const data = await pomodoroApi.getSetor(SECTOR)
      // Detecta virada de fase (ou início) enquanto a aba ficou aberta —
      // dispara alerta mesmo pra quem não é líder, já que o relógio é
      // compartilhado.
      if (prevActive && data.active && prevPhase && prevPhase !== data.phase) {
        fireAlerts(data.phase, get().alertSound, get().alertBrowser, 'setor de TI')
      }
      set({ sector: data, sectorError: null })
    } catch (e: any) {
      set({ sectorError: e?.message || 'Falha ao carregar o pomodoro do setor' })
    }
  },

  startSector: async (input) => {
    set({ sectorLoading: true })
    try {
      const data = await pomodoroApi.iniciarSetor(input, SECTOR)
      set({ sector: data })
    } finally {
      set({ sectorLoading: false })
    }
  },

  stopSector: async () => {
    set({ sectorLoading: true })
    try {
      const data = await pomodoroApi.encerrarSetor(SECTOR)
      set({ sector: data })
    } finally {
      set({ sectorLoading: false })
    }
  },
}))

export function stopPomodoroPolling() {
  if (sectorPollTimer) clearInterval(sectorPollTimer)
}
