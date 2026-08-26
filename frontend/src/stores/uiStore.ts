import { create } from 'zustand'

const SIDEBAR_EXPANDED_STORAGE_KEY = 'mg.sidebar.expanded'

function readSidebarExpanded(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(SIDEBAR_EXPANDED_STORAGE_KEY) === 'true'
}

interface UIState {
  /** Sistema nativo aberto em página cheia (esconde Header/padding do CRM) */
  fullBleedSystem: boolean
  /** Modo quiosque: esconde também a sidebar do CRM (usado pela TV do viewer) */
  kioskMode: boolean
  /** Rail de navegação (desktop) expandido com rótulos, em vez do rail de ícones. Persiste entre sessões. */
  sidebarExpanded: boolean
  setFullBleedSystem: (v: boolean) => void
  setKioskMode: (v: boolean) => void
  toggleSidebarExpanded: () => void
}

export const useUIStore = create<UIState>((set) => ({
  fullBleedSystem: false,
  kioskMode: false,
  sidebarExpanded: readSidebarExpanded(),
  setFullBleedSystem: (v) => set({ fullBleedSystem: v }),
  setKioskMode: (v) => set({ kioskMode: v }),
  toggleSidebarExpanded: () =>
    set((state) => {
      const next = !state.sidebarExpanded
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SIDEBAR_EXPANDED_STORAGE_KEY, String(next))
      }
      return { sidebarExpanded: next }
    }),
}))
