import { create } from 'zustand'

interface ChatWidgetState {
  openChatTicketId: string | null
  isMinimized: boolean
  openChat: (ticketId: string) => void
  closeChat: () => void
  minimizeChat: () => void
  restoreChat: () => void
}

export const useChatWidgetStore = create<ChatWidgetState>((set) => ({
  openChatTicketId: null,
  isMinimized: false,
  openChat: (ticketId) => set({ openChatTicketId: ticketId, isMinimized: false }),
  closeChat: () => set({ openChatTicketId: null, isMinimized: false }),
  minimizeChat: () => set({ isMinimized: true }),
  restoreChat: () => set({ isMinimized: false }),
}))
