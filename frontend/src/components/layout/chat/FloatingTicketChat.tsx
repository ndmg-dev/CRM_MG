import { MessageCircle } from 'lucide-react'
import { useChatWidgetStore } from '@/stores/chatWidgetStore'
import { useUnreadComments } from '@/systems/central-suporte/hooks/useUnreadComments'
import { ConversationList } from './ConversationList'
import { ConversationView } from './ConversationView'

function LauncherButton() {
  const openList = useChatWidgetStore((s) => s.openList)
  const unreadCounts = useUnreadComments()
  const totalUnread = Object.values(unreadCounts).reduce((sum, n) => sum + n, 0)

  return (
    <button
      onClick={openList}
      aria-label={totalUnread > 0 ? `Conversas (${totalUnread} não lidas)` : 'Conversas'}
      className="fixed bottom-4 right-4 z-[110] flex h-14 w-14 items-center justify-center rounded-full bg-gold text-background shadow-2xl transition-transform hover:scale-105"
    >
      <MessageCircle className="h-6 w-6" />
      {totalUnread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-background bg-red-500 px-1 text-[10px] font-bold text-white">
          {totalUnread > 99 ? '99+' : totalUnread}
        </span>
      )}
    </button>
  )
}

/** Elemento flutuante único do chat rápido de chamados: alterna entre o
 * ícone de lançamento (canto inferior direito), a lista de conversas e uma
 * conversa aberta — nunca mais de um ao mesmo tempo (ver chatWidgetStore).
 * Minimizar sempre volta pro ícone; clicar no ícone sempre abre a lista.
 * Uma mensagem nova só soma na badge do ícone — quem decide abrir a
 * conversa é o usuário, clicando nela na lista. */
export function FloatingTicketChat() {
  const panelState = useChatWidgetStore((s) => s.panelState)
  const activeTicketId = useChatWidgetStore((s) => s.activeTicketId)

  if (panelState === 'list') return <ConversationList />
  if (panelState === 'conversation' && activeTicketId) {
    return <ConversationView ticketId={activeTicketId} />
  }
  return <LauncherButton />
}
