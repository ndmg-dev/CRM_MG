import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  currentPage: string
  /** Sistema nativo aberto em página cheia (esconde Header/padding do CRM) */
  fullBleedSystem: boolean
  /** Modo quiosque: esconde também a sidebar do CRM (usado pela TV do viewer) */
  kioskMode: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setCurrentPage: (page: string) => void
  setFullBleedSystem: (v: boolean) => void
  setKioskMode: (v: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  currentPage: 'Dashboard',
  fullBleedSystem: false,
  kioskMode: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setFullBleedSystem: (v) => set({ fullBleedSystem: v }),
  setKioskMode: (v) => set({ kioskMode: v }),
}))
