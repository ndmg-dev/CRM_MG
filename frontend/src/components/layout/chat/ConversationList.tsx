import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useChatWidgetStore } from '@/stores/chatWidgetStore'
import { supabase } from '@/systems/central-suporte/integrations/supabase/client'
import { useUnreadComments } from '@/systems/central-suporte/hooks/useUnreadComments'
import { useUserSector } from '@/systems/central-suporte/hooks/useUserSector'
import { ticketCategory, type TicketCategory } from '@/systems/central-suporte/utils/ticketStatus'

interface ConversationRow {
  ticketId: string
  ticketCode: number | string | null
  title: string
  requesterName: string
  openedByName: string | null
  lastMessage: string
  lastMessageAt: string | null
  category: TicketCategory
}

/** As três primeiras categorias têm aba própria; as demais só existem
 * dentro do dropdown "Outros". */
const MAIN_TABS: { key: TicketCategory; label: string }[] = [
  { key: 'todo', label: 'A fazer' },
  { key: 'in_progress', label: 'Em Andamento' },
]
const OTHER_OPTIONS: { key: TicketCategory; label: string }[] = [
  { key: 'closed', label: 'Encerrados' },
  { key: 'testing', label: 'Em teste' },
  { key: 'parado', label: 'Parados' },
]

/** Lista de conversas do chat flutuante: um chamado por linha, ordenado pela
 * mensagem mais recente. Não depende de "sou responsável/abri esse chamado"
 * — o RLS de `comments`/`tickets` já restringe o que a pessoa pode ver, então
 * a lista só reflete isso. */
function useConversations() {
  return useQuery({
    queryKey: ['chat-widget-conversations'],
    queryFn: async (): Promise<ConversationRow[]> => {
      // 1) Comentários recentes (visíveis, não internos) — o mais recente por
      // chamado é o que aparece como prévia e define a ordenação.
      const { data: recentComments, error } = await supabase
        .from('comments')
        .select('ticket_id, content, created_at')
        .eq('internal_only', false)
        .order('created_at', { ascending: false })
        .limit(300)
      if (error) throw error

      const lastByTicket = new Map<string, { content: string; created_at: string }>()
      for (const c of recentComments || []) {
        if (!c.ticket_id || lastByTicket.has(c.ticket_id)) continue
        lastByTicket.set(c.ticket_id, { content: c.content || '', created_at: c.created_at! })
      }
      const ticketIds = Array.from(lastByTicket.keys()).slice(0, 30)
      if (ticketIds.length === 0) return []

      // 2) Dados do chamado (título, código, quem abriu) pros ids acima.
      const { data: tickets, error: tErr } = await supabase
        .from('tickets')
        .select('id, ticket_code, title, status, requester_id, opened_by_id, requester:profiles!requester_id(full_name), opened_by:profiles!opened_by_id(full_name)')
        .in('id', ticketIds)
        .is('archived_at', null)
      if (tErr) throw tErr

      const ticketMap = new Map((tickets || []).map((t: any) => [t.id, t]))
      return ticketIds
        .filter((id) => ticketMap.has(id))
        .map((id) => {
          const t = ticketMap.get(id) as any
          const last = lastByTicket.get(id)!
          // Só diferencia quando alguém abriu em nome de outra pessoa —
          // mesma regra usada no Kanban/TicketDetailDialog.
          const openedByOther = t.opened_by_id && t.opened_by_id !== t.requester_id
          return {
            ticketId: id,
            ticketCode: t.ticket_code,
            title: t.title,
            requesterName: t.requester?.full_name || 'Desconhecido',
            openedByName: openedByOther ? (t.opened_by?.full_name || null) : null,
            lastMessage: last.content,
            lastMessageAt: last.created_at,
            category: ticketCategory(t.status),
          }
        })
    },
  })
}

function formatPreviewTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000)
  if (diffDays === 0) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Ontem'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function Avatar({ name }: { name: string }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase()
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-muted border border-gold-border text-sm font-bold text-gold">
      {letter}
    </div>
  )
}

export function ConversationList() {
  const close = useChatWidgetStore((s) => s.close)
  const openConversation = useChatWidgetStore((s) => s.openConversation)
  const queryClient = useQueryClient()
  const { data: conversations = [], isLoading } = useConversations()
  const unreadCounts = useUnreadComments()
  // Só a TI lida com o funil A fazer/Em Andamento/Outros — quem só abre
  // chamado (requester comum) não precisa entender essa divisão interna,
  // só se o chamado dele está aberto ou já foi resolvido.
  const { isStaff } = useUserSector()
  const [tab, setTab] = useState<TicketCategory>('todo')
  const [simpleTab, setSimpleTab] = useState<'open' | 'closed'>('open')
  const [otherMenuOpen, setOtherMenuOpen] = useState(false)
  const otherMenuRef = useRef<HTMLDivElement>(null)

  const isOtherTab = OTHER_OPTIONS.some((o) => o.key === tab)

  useEffect(() => {
    if (!otherMenuOpen) return
    function handler(e: MouseEvent) {
      if (otherMenuRef.current && !otherMenuRef.current.contains(e.target as Node)) setOtherMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [otherMenuOpen])

  const categoryCounts = useMemo(() => {
    const counts: Record<TicketCategory, number> = { todo: 0, in_progress: 0, closed: 0, testing: 0, parado: 0 }
    for (const c of conversations) counts[c.category]++
    return counts
  }, [conversations])

  // Soma das 3 sub-categorias do dropdown — o botão "Outros" (fechado)
  // precisa mostrar o total agrupado ali, não só a contagem da sub-aba
  // selecionada por último (senão o número não bate com o que a pessoa
  // vai encontrar ao abrir o dropdown).
  const otherTotal = OTHER_OPTIONS.reduce((sum, o) => sum + categoryCounts[o.key], 0)

  const visibleConversations = useMemo(() => {
    if (!isStaff) return conversations.filter((c) => (c.category === 'closed') === (simpleTab === 'closed'))
    return conversations.filter((c) => c.category === tab)
  }, [conversations, tab, simpleTab, isStaff])

  // Realtime: qualquer comentário novo em qualquer chamado pode mudar a
  // ordem/prévia da lista — invalida em vez de tentar reconciliar campo a
  // campo (lista é pequena, refetch é barato).
  useEffect(() => {
    const channel = supabase
      .channel('chat-widget-conversations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments' },
        () => queryClient.invalidateQueries({ queryKey: ['chat-widget-conversations'] })
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tickets' },
        () => queryClient.invalidateQueries({ queryKey: ['chat-widget-conversations'] })
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [queryClient])

  return (
    <div className="fixed bottom-4 right-4 z-[110] flex h-[480px] w-[360px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-raised px-3 py-2.5">
        <h3 className="text-sm font-semibold text-text-primary">Conversas</h3>
        <button
          onClick={close}
          aria-label="Fechar"
          className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!isStaff ? (
        <div className="flex items-center gap-1 border-b border-border px-2 pt-2">
          {(
            [
              { key: 'open' as const, label: 'Abertos', count: conversations.length - categoryCounts.closed },
              { key: 'closed' as const, label: 'Encerrados', count: categoryCounts.closed },
            ]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setSimpleTab(t.key)}
              className={`flex items-center gap-1.5 rounded-t-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                simpleTab === t.key
                  ? 'border-b-2 border-gold text-text-primary'
                  : 'border-b-2 border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              {t.label}
              {t.count > 0 && <span className="text-[10px] text-text-muted">{t.count}</span>}
            </button>
          ))}
        </div>
      ) : (
      <div className="flex items-center gap-1 border-b border-border px-2 pt-2">
        {MAIN_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-t-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              tab === t.key
                ? 'border-b-2 border-gold text-text-primary'
                : 'border-b-2 border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            {t.label}
            {categoryCounts[t.key] > 0 && (
              <span className="text-[10px] text-text-muted">{categoryCounts[t.key]}</span>
            )}
          </button>
        ))}

        {/* "Outros" agrupa as categorias de menor volume (encerrados, em
            teste, parados) num único dropdown — evita poluir a barra de
            abas com mais 3 itens. */}
        <div ref={otherMenuRef} className="relative">
          <button
            onClick={() => setOtherMenuOpen((o) => !o)}
            className={`flex items-center gap-1 rounded-t-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              isOtherTab
                ? 'border-b-2 border-gold text-text-primary'
                : 'border-b-2 border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            {isOtherTab ? OTHER_OPTIONS.find((o) => o.key === tab)?.label : 'Outros'}
            {(isOtherTab ? categoryCounts[tab] : otherTotal) > 0 && (
              <span className="text-[10px] text-text-muted">{isOtherTab ? categoryCounts[tab] : otherTotal}</span>
            )}
            <ChevronDown className="h-3 w-3" />
          </button>

          {otherMenuOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border border-border bg-card py-1 shadow-2xl">
              {OTHER_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  onClick={() => {
                    setTab(o.key)
                    setOtherMenuOpen(false)
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs transition-colors ${
                    tab === o.key ? 'text-gold' : 'text-text-secondary hover:bg-surface'
                  }`}
                >
                  {o.label}
                  {categoryCounts[o.key] > 0 && <span className="text-[10px] text-text-muted">{categoryCounts[o.key]}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="pt-8 text-center text-xs text-text-muted">Carregando...</p>
        ) : visibleConversations.length === 0 ? (
          <p className="pt-8 text-center text-xs text-text-muted">Nenhuma conversa aqui.</p>
        ) : (
          visibleConversations.map((c) => {
            const unread = unreadCounts[c.ticketId] || 0
            return (
              <button
                key={c.ticketId}
                onClick={() => openConversation(c.ticketId)}
                className="flex w-full items-start gap-3 border-b border-border/60 px-3.5 py-3.5 text-left transition-colors hover:bg-surface"
              >
                <Avatar name={c.requesterName} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="shrink-0 rounded border border-gold-border-soft px-1 py-0.5 text-[10px] font-bold text-gold">
                        #{String(c.ticketCode ?? '').padStart(3, '0')}
                      </span>
                      <span className="truncate text-sm font-semibold text-text-primary">{c.title}</span>
                    </div>
                    <span className="shrink-0 text-[11px] text-text-muted">{formatPreviewTime(c.lastMessageAt)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-text-muted">
                    {c.openedByName ? `${c.openedByName} → ${c.requesterName}` : c.requesterName}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] text-text-secondary">{c.lastMessage || 'Sem mensagens de texto'}</p>
                    {unread > 0 && (
                      <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-background">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
