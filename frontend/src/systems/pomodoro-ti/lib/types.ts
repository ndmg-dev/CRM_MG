export type Fase = 'focus' | 'rest'

export interface PomodoroPreferencias {
  focusMin: number
  restMin: number
  cyclesTotal: number
  alertSound: boolean
  alertBrowser: boolean
}

export interface PomodoroMembro {
  id: string
  nome: string
  perfil: string
  status: string
}

export interface PomodoroSetorState {
  setor: string
  active: boolean
  phase: Fase
  cycle: number
  cyclesTotal: number
  focusMin: number
  restMin: number
  timeLeft: number
  podeControlar: boolean
  startedByNome: string | null
  membros: PomodoroMembro[]
}

export interface PomodoroSetorStartInput {
  focusMin: number
  restMin: number
  cyclesTotal: number
}
