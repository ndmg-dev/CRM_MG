import { useEffect, useRef, useState } from 'react'
import { X, Send, Minus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useChatWidgetStore } from '@/stores/chatWidgetStore'
import { supabase } from '@/systems/central-suporte/integrations/supabase/client'

function Avatar({ name }: { name: string }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase()
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-muted border border-gold-border text-[11px] font-bold text-gold">
      {letter}
    </div>
  )
}

function dayKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000)
  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Ontem'
  const sameYear = date.getFullYear() === now.getFullYear()
  return date.toLocaleDateString('pt-BR', sameYear ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// Comentários automáticos de evento (transferência, mudança de status etc.)
// não têm uma coluna própria pra marcar isso — só dá pra reconhecer pelo
// texto. Viram um separador central, não uma bolha de conversa.
const SYSTEM_NOTE_PATTERN = /^(transferido de .+ para .+|categoria alterada|status alterado|prioridade alterada)/i
function isSystemNote(content: string): boolean {
  // Esses comentários costumam vir com um emoji/ícone na frente (🔄 etc.) —
  // tira qualquer coisa que não seja letra antes de testar o padrão.
  const stripped = (content || '').trim().replace(/^[^\p{L}]+/u, '')
  return SYSTEM_NOTE_PATTERN.test(stripped)
}

/** Chat rápido de um chamado, flutuante no canto inferior direito — pra
 * responder uma mensagem sem sair da tela em que a pessoa está. Aberto a
 * partir do dropdown "Mensagens" do Header (useChatWidgetStore). */
export function FloatingTicketChat() {
  const ticketId = useChatWidgetStore((s) => s.openChatTicketId)
  const closeChat = useChatWidgetStore((s) => s.closeChat)
  const isMinimized = useChatWidgetStore((s) => s.isMinimized)
  const minimizeChat = useChatWidgetStore((s) => s.minimizeChat)
  const restoreChat = useChatWidgetStore((s) => s.restoreChat)
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [newDividerIndex, setNewDividerIndex] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const seenCounts = useRef<Map<string, number>>(new Map())
  const dividerComputedFor = useRef<string | null>(null)
  const commentsLenRef = useRef(0)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, [])

  const { data: ticket } = useQuery({
    queryKey: ['chat-widget-ticket', ticketId],
    queryFn: async () => {
      if (!ticketId) return null
      const { data, error } = await supabase
        .from('tickets')
        .select('id, ticket_code, title, assignee:profiles!assignee_id(full_name)')
        .eq('id', ticketId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!ticketId,
  })

  const { data: comments = [] } = useQuery({
    queryKey: ['chat-widget-comments', ticketId],
    queryFn: async () => {
      if (!ticketId) return []
      const { data, error } = await supabase
        .from('comments')
        .select('*, author:profiles!author_id(full_name)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!ticketId,
  })

  useEffect(() => {
    if (!ticketId) return
    const channel = supabase
      .channel(`chat-widget-${ticketId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `ticket_id=eq.${ticketId}` },
        () => queryClient.invalidateQueries({ queryKey: ['chat-widget-comments', ticketId] })
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [ticketId, queryClient])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [comments.length])

  useEffect(() => {
    commentsLenRef.current = comments.length
  }, [comments])

  // Reseta a barra de "novas mensagens" ao trocar de ticket, e marca o
  // ticket anterior como visto (próxima vez que abrir, nada aparece como novo).
  useEffect(() => {
    dividerComputedFor.current = null
    setNewDividerIndex(null)
    return () => {
      if (ticketId) seenCounts.current.set(ticketId, commentsLenRef.current)
    }
  }, [ticketId])

  // Calcula, uma vez por abertura, a partir de qual mensagem é "nova" desde
  // a última vez que esse ticket foi visto no widget.
  useEffect(() => {
    if (!ticketId || comments.length === 0) return
    if (dividerComputedFor.current === ticketId) return
    dividerComputedFor.current = ticketId
    const prevSeen = seenCounts.current.get(ticketId)
    setNewDividerIndex(prevSeen !== undefined && prevSeen < comments.length ? prevSeen : null)
  }, [ticketId, comments])

  const sendComment = useMutation({
    mutationFn: async () => {
      if (!ticketId || !text.trim()) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')
      const { error } = await supabase.from('comments').insert({
        ticket_id: ticketId,
        content: text.trim(),
        author_id: user.id,
        internal_only: false,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setText('')
      queryClient.invalidateQueries({ queryKey: ['chat-widget-comments', ticketId] })
    },
  })

  if (!ticketId) return null

  if (isMinimized) {
    return (
      <button
        onClick={restoreChat}
        className="fixed bottom-4 right-4 z-[110] flex w-[260px] items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left shadow-2xl transition-colors hover:border-gold-border"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded border border-gold-border-soft px-1.5 py-0.5 text-[10px] font-bold text-gold">
              #{String(ticket?.ticket_code ?? '').padStart(3, '0')}
            </span>
            <span className="truncate text-sm font-semibold text-text-primary">{ticket?.title || 'Carregando...'}</span>
          </div>
        </div>
        <span
          role="button"
          aria-label="Fechar chat"
          onClick={(e) => { e.stopPropagation(); closeChat() }}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary"
        >
          <X className="h-3.5 w-3.5" />
        </span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-[110] flex h-[480px] w-[360px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-raised px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded border border-gold-border-soft px-1.5 py-0.5 text-[10px] font-bold text-gold">
              #{String(ticket?.ticket_code ?? '').padStart(3, '0')}
            </span>
            <span className="truncate text-sm font-semibold text-text-primary">{ticket?.title || 'Carregando...'}</span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-text-muted">
            Responsável: {(ticket?.assignee as any)?.full_name || 'Sem responsável'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={minimizeChat}
            aria-label="Minimizar chat"
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={closeChat}
            aria-label="Fechar chat"
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {comments.length === 0 ? (
          <p className="pt-8 text-center text-xs text-text-muted">Nenhuma mensagem ainda.</p>
        ) : (
          comments.map((c: any, idx: number) => {
            const isMine = c.author_id === currentUserId
            const authorName = c.author?.full_name || 'Usuário'
            const prev = comments[idx - 1] as any
            const showDayHeader = !prev || dayKey(prev.created_at) !== dayKey(c.created_at)
            const showNewDivider = newDividerIndex !== null && idx === newDividerIndex
            return (
              <div key={c.id}>
                {showDayHeader && (
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
                      {formatDayLabel(c.created_at)}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
                {showNewDivider && (
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-px flex-1 bg-gold/40" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gold">
                      Novas mensagens
                    </span>
                    <div className="h-px flex-1 bg-gold/40" />
                  </div>
                )}
                {isSystemNote(c.content) ? (
                  <div className="my-3 flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="shrink-0 text-center text-[10px] font-medium uppercase tracking-wide text-text-muted">
                      {c.content} · {formatTime(c.created_at)}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                ) : (
                  <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                    <Avatar name={authorName} />
                    <div className={`flex max-w-[75%] flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      <span className="mb-0.5 px-1 text-[10px] text-text-muted">{authorName}</span>
                      <div
                        className={`rounded-2xl px-3 py-2 text-sm ${
                          isMine
                            ? 'rounded-br-sm bg-gold text-background'
                            : 'rounded-bl-sm bg-surface text-text-primary'
                        }`}
                      >
                        {c.content}
                      </div>
                      <span className="mt-0.5 px-1 text-[9px] text-text-muted">{formatTime(c.created_at)}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-border p-2.5">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && text.trim() && !sendComment.isPending) {
              e.preventDefault()
              sendComment.mutate()
            }
          }}
          placeholder="Escreva uma resposta..."
          className="h-9 flex-1 rounded-lg border border-border bg-search-field px-3 text-[13px] text-text-primary placeholder-text-muted outline-none focus:border-gold-border"
        />
        <button
          onClick={() => sendComment.mutate()}
          disabled={!text.trim() || sendComment.isPending}
          aria-label="Enviar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold text-background transition-opacity disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
