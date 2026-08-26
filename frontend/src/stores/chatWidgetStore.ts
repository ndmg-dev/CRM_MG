import { create } from 'zustand'

// Um único elemento flutuante que alterna entre três estados — nunca duas
// coisas na tela ao mesmo tempo (ícone OU lista OU conversa):
//   'closed'       — só o ícone de lançamento, canto inferior direito.
//   'list'         — lista de conversas (clicou no ícone).
//   'conversation' — uma conversa aberta (clicou numa da lista, ou chegou
//                    mensagem nova e abriu direto nela).
// Minimizar sempre volta pro ícone ('closed'); clicar no ícone de novo
// sempre abre a LISTA (nunca retoma a conversa anterior direto). Uma
// mensagem nova NÃO abre nada sozinha — só soma na badge do ícone.
export type ChatPanelState = 'closed' | 'list' | 'conversation'

interface ChatWidgetState {
  panelState: ChatPanelState
  activeTicketId: string | null
  openList: () => void
  openConversation: (ticketId: string) => void
  backToList: () => void
  minimize: () => void
  close: () => void
}

export const useChatWidgetStore = create<ChatWidgetState>((set) => ({
  panelState: 'closed',
  activeTicketId: null,
  openList: () => set({ panelState: 'list', activeTicketId: null }),
  openConversation: (ticketId) => set({ panelState: 'conversation', activeTicketId: ticketId }),
  backToList: () => set({ panelState: 'list', activeTicketId: null }),
  minimize: () => set({ panelState: 'closed' }),
  close: () => set({ panelState: 'closed', activeTicketId: null }),
}))
