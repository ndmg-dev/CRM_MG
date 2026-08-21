import { create } from 'zustand'

interface ChatWidgetState {
  openChatTicketId: string | null
  openChat: (ticketId: string) => void
  closeChat: () => void
}

export const useChatWidgetStore = create<ChatWidgetState>((set) => ({
  openChatTicketId: null,
  openChat: (ticketId) => set({ openChatTicketId: ticketId }),
  closeChat: () => set({ openChatTicketId: null }),
}))
