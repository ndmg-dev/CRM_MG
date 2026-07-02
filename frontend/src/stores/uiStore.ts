import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  currentPage: string
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setCurrentPage: (page: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  currentPage: 'Dashboard',
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setCurrentPage: (page) => set({ currentPage: page }),
}))
