import { create } from 'zustand'

interface UIState {
  /** Sistema nativo aberto em página cheia (esconde Header/padding do CRM) */
  fullBleedSystem: boolean
  /** Modo quiosque: esconde também a sidebar do CRM (usado pela TV do viewer) */
  kioskMode: boolean
  setFullBleedSystem: (v: boolean) => void
  setKioskMode: (v: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  fullBleedSystem: false,
  kioskMode: false,
  setFullBleedSystem: (v) => set({ fullBleedSystem: v }),
  setKioskMode: (v) => set({ kioskMode: v }),
}))
