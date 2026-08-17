import { create } from 'zustand'

interface UIState {
  currentPage: string
  /** Sistema nativo aberto em página cheia (esconde Header/padding do CRM) */
  fullBleedSystem: boolean
  /** Modo quiosque: esconde também a sidebar do CRM (usado pela TV do viewer) */
  kioskMode: boolean
  setCurrentPage: (page: string) => void
  setFullBleedSystem: (v: boolean) => void
  setKioskMode: (v: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  currentPage: 'Dashboard',
  fullBleedSystem: false,
  kioskMode: false,
  setCurrentPage: (page) => set({ currentPage: page }),
  setFullBleedSystem: (v) => set({ fullBleedSystem: v }),
  setKioskMode: (v) => set({ kioskMode: v }),
}))
