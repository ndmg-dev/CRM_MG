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

/** "Abertos" agrupa novo + em andamento (o que ainda precisa de alguma ação
 * da TI); "Encerrados" é só o que já foi fechado; "Outros" (dropdown) junta
 * o que está pausado/em teste — não é nem "aberto" no sentido normal, nem
 * "encerrado" de fato. */
type ViewTab = 'abertos' | 'testing' | 'parado' | 'closed'
const ABERTOS_CATEGORIES: TicketCategory[] = ['todo', 'in_progress']
const OTHER_OPTIONS: { key: Extract<ViewTab, 'testing' | 'parado'>; label: string }[] = [
  { key: 'parado', label: 'Parados' },
  { key: 'testing', label: 'Em teste' },
]

/** Lista de conversas do chat flutuante: um chamado por linha, ordenado pela
 * mensagem mais recente. Não depende de "sou responsável/abri esse chamado"
 * — o RLS de `comments`/`tickets` já restringe o que a pessoa pode ver, então
 * a lista só reflete isso. */
function useConversations() {
  return useQuery({
    queryKey: ['chat-widget-conversations'],
    queryFn: async (): Promise<ConversationRow[]> => {
      // 1) Último comentário visível (não interno) de cada chamado não
      // arquivado, já limitado aos 30 mais recentes — calculado no banco
      // (DISTINCT ON) em vez de baixar centenas de linhas pra filtrar aqui.
      // Ver migration 202608271200_recent_ticket_previews_rpc.sql.
      const { data: previews, error } = await supabase.rpc('get_recent_ticket_previews', { p_limit: 30 })
      if (error) throw error
      if (!previews || previews.length === 0) return []

      // 2) Dados do chamado (título, código, quem abriu) pros ids acima.
      const ticketIds = previews.map((p) => p.ticket_id)
      const { data: tickets, error: tErr } = await supabase
        .from('tickets')
        .select('id, ticket_code, title, status, requester_id, opened_by_id, requester:profiles!requester_id(full_name), opened_by:profiles!opened_by_id(full_name)')
        .in('id', ticketIds)
      if (tErr) throw tErr

      const ticketMap = new Map((tickets || []).map((t: any) => [t.id, t]))
      return previews
        .filter((p) => ticketMap.has(p.ticket_id))
        .map((p) => {
          const t = ticketMap.get(p.ticket_id) as any
          // Só diferencia quando alguém abriu em nome de outra pessoa —
          // mesma regra usada no Kanban/TicketDetailDialog.
          const openedByOther = t.opened_by_id && t.opened_by_id !== t.requester_id
          return {
            ticketId: p.ticket_id,
            ticketCode: t.ticket_code,
            title: t.title,
            requesterName: t.requester?.full_name || 'Desconhecido',
            openedByName: openedByOther ? (t.opened_by?.full_name || null) : null,
            lastMessage: p.last_content,
            lastMessageAt: p.last_created_at,
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
  const [tab, setTab] = useState<ViewTab>('abertos')
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

  // Soma das 2 sub-categorias do dropdown — o botão "Outros" (fechado)
  // precisa mostrar o total agrupado ali, não só a contagem da sub-aba
  // selecionada por último (senão o número não bate com o que a pessoa
  // vai encontrar ao abrir o dropdown).
  const otherTotal = OTHER_OPTIONS.reduce((sum, o) => sum + categoryCounts[o.key], 0)
  const abertosTotal = ABERTOS_CATEGORIES.reduce((sum, c) => sum + categoryCounts[c], 0)

  const visibleConversations = useMemo(() => {
    if (!isStaff) return conversations.filter((c) => (c.category === 'closed') === (simpleTab === 'closed'))
    if (tab === 'abertos') return conversations.filter((c) => ABERTOS_CATEGORIES.includes(c.category))
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
        <div className="flex items-center border-b border-border px-2 pt-2">
          {(
            [
              { key: 'open' as const, label: 'Abertos', count: conversations.length - categoryCounts.closed },
              { key: 'closed' as const, label: 'Encerrados', count: categoryCounts.closed },
            ]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setSimpleTab(t.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-t-md px-2 py-1.5 text-xs font-medium transition-colors ${
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
      <div className="flex items-center border-b border-border px-2 pt-2">
        <button
          onClick={() => setTab('abertos')}
          // Larguras pesadas por importância, não estritamente iguais:
          // "Abertos" e "Outros" são as abas de trabalho de verdade;
          // "Encerrados" só serve pra consulta ocasional e não devia
          // competir pelo mesmo espaço/atenção visual que elas, mesmo
          // quando o contador dele (histórico acumulado) é o maior número
          // da barra.
          style={{ flex: "1.3 1 0%" }}
          className={`flex items-center justify-center gap-1.5 rounded-t-md px-2 py-1.5 text-xs font-medium transition-colors ${
            tab === 'abertos'
              ? 'border-b-2 border-gold text-text-primary'
              : 'border-b-2 border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          Abertos
          {abertosTotal > 0 && <span className="text-[10px] text-text-muted">{abertosTotal}</span>}
        </button>

        {/* "Outros" agrupa parado + em teste — nem "aberto" no sentido
            normal (precisa de ação), nem "encerrado" de fato. */}
        <div ref={otherMenuRef} className="relative" style={{ flex: "1.1 1 0%" }}>
          <button
            onClick={() => setOtherMenuOpen((o) => !o)}
            className={`flex w-full items-center justify-center gap-1 rounded-t-md px-2 py-1.5 text-xs font-medium transition-colors ${
              isOtherTab
                ? 'border-b-2 border-gold text-text-primary'
                : 'border-b-2 border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            {isOtherTab ? OTHER_OPTIONS.find((o) => o.key === tab)?.label : 'Outros'}
            {(isOtherTab ? categoryCounts[tab as TicketCategory] : otherTotal) > 0 && (
              <span className="text-[10px] text-text-muted">{isOtherTab ? categoryCounts[tab as TicketCategory] : otherTotal}</span>
            )}
            <ChevronDown className="h-3 w-3" />
          </button>

          {otherMenuOpen && (
            <div className="absolute left-1/2 top-full z-10 mt-1 min-w-[140px] -translate-x-1/2 rounded-lg border border-border bg-card py-1 shadow-2xl">
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

        <button
          onClick={() => setTab('closed')}
          style={{ flex: "0.8 1 0%" }}
          className={`flex items-center justify-center gap-1.5 rounded-t-md px-2 py-1.5 text-xs font-medium transition-colors ${
            tab === 'closed'
              ? 'border-b-2 border-gold text-text-primary'
              : 'border-b-2 border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          Encerrados
          {categoryCounts.closed > 0 && <span className="text-[10px] text-text-muted">{categoryCounts.closed}</span>}
        </button>
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
                    {unread > 0 && <span className="h-2 w-2 shrink-0 rounded-full bg-gold" aria-label={`${unread} não lidas`} />}
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
