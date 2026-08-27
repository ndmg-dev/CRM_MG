import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, X, Send, Minus, Check, CheckCheck, Paperclip, Trash2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useChatWidgetStore } from '@/stores/chatWidgetStore'
import { supabase } from '@/systems/central-suporte/integrations/supabase/client'
import { isTicketClosed, ticketCategory } from '@/systems/central-suporte/utils/ticketStatus'
import { useUserSector } from '@/systems/central-suporte/hooks/useUserSector'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB — mesmo limite do TicketDetailDialog

type ManualTicketStatus = 'pending' | 'testing' | 'parado' | 'closed'

// "Em andamento" grava `pending` — confirmado contra o Kanban (fonte real)
// e o TicketDetailDialog, que concordam: `open` = "A Fazer", `pending` =
// "Em Andamento". Ver comentário em ticketStatus.ts.
const STATUS_BUTTONS: { status: ManualTicketStatus; label: string }[] = [
  { status: 'pending', label: 'Em andamento' },
  { status: 'testing', label: 'Em teste' },
  { status: 'parado', label: 'Parado' },
]

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

// Textos usados tanto pra montar o comentário quanto pro regex abaixo que o
// reconhece como nota de sistema — numa constante só pra não desalinhar
// silenciosamente se um dos dois lados mudar sozinho.
const CLOSE_NOTE_PREFIX = 'Este chat foi encerrado'
const REOPEN_NOTE = 'Este chat foi reaberto.'

// Comentários automáticos de evento (transferência, mudança de status etc.)
// não têm uma coluna própria pra marcar isso — só dá pra reconhecer pelo
// texto. Viram um separador central, não uma bolha de conversa.
const SYSTEM_NOTE_PATTERN = new RegExp(
  `^(transferido de .+ para .+|categoria alterada|status alterado|prioridade alterada|${CLOSE_NOTE_PREFIX}|${REOPEN_NOTE.replace(/\.$/, '')})`,
  'i',
)
function isSystemNote(content: string): boolean {
  const stripped = (content || '').trim().replace(/^[^\p{L}]+/u, '')
  return SYSTEM_NOTE_PATTERN.test(stripped)
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

interface ConversationViewProps {
  ticketId: string
}

export function ConversationView({ ticketId }: ConversationViewProps) {
  const closeChat = useChatWidgetStore((s) => s.close)
  const minimizeChat = useChatWidgetStore((s) => s.minimize)
  const backToList = useChatWidgetStore((s) => s.backToList)
  const queryClient = useQueryClient()
  // Só quem é da TI (support_agent/dev/admin_ti/coordenador) move status ou
  // encerra o chat — quem só abre chamado (requester comum) nunca vê esses
  // controles, só a conversa em si.
  const { isStaff } = useUserSector()
  const [text, setText] = useState('')
  const [pendingImage, setPendingImage] = useState<File | null>(null)
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [newDividerIndex, setNewDividerIndex] = useState<number | null>(null)
  const [closeModalOpen, setCloseModalOpen] = useState(false)
  // Preview de imagem em modal em vez de abrir em nova aba — nova aba tira a
  // pessoa do chat pra ver um print; um modal por cima resolve sem sair daqui.
  const [previewImage, setPreviewImage] = useState<{ url: string; alt: string } | null>(null)
  // Grava status=closed na hora (ver closeChatMutation), mas mantém ESTA
  // instância da tela funcionando normalmente — sem o aviso "vai sumir da
  // aba" nem bloquear o input — até a TI sair da conversa. Na próxima vez
  // que abrir (remount), `isClosed` já reflete o banco e mostra bloqueado.
  const [justClosed, setJustClosed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const seenCounts = useRef<Map<string, number>>(new Map())
  const dividerComputedFor = useRef<string | null>(null)
  const commentsLenRef = useRef(0)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, [])

  const { data: ticket } = useQuery({
    queryKey: ['chat-widget-ticket', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('id, ticket_code, title, status, assignee:profiles!assignee_id(full_name)')
        .eq('id', ticketId)
        .single()
      if (error) throw error
      return data
    },
  })

  const isClosed = isTicketClosed(ticket?.status)
  const isBlocked = isClosed && !justClosed

  // Detecta reabertura mesmo quando ela acontece fora do chat (dropdown de
  // status do TicketDetailDialog, Kanban etc.) — sem isso, o histórico fica
  // com "Este chat foi encerrado" e nada avisando que voltou a aceitar
  // mensagem, mesmo com o input já liberado de novo.
  const prevStatusRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (!ticket) return
    // Espera currentUserId carregar (busca assíncrona separada) antes de
    // decidir — sem isso, se a reabertura acontecer bem no primeiro render,
    // o comentário sai com author_id nulo. Não atualiza prevStatusRef aqui:
    // assim que currentUserId chegar, o efeito roda de novo com o mesmo
    // prevStatus guardado e ainda pega a transição corretamente.
    if (currentUserId === null) return
    const prevStatus = prevStatusRef.current
    const wasClosed = prevStatus !== undefined && isTicketClosed(prevStatus)
    if (wasClosed && !isTicketClosed(ticket.status)) {
      setJustClosed(false)
      supabase.from('comments').insert({
        ticket_id: ticketId,
        content: REOPEN_NOTE,
        author_id: currentUserId,
        internal_only: false,
      }).then(({ error }) => {
        if (!error) queryClient.invalidateQueries({ queryKey: ['chat-widget-comments', ticketId] })
      })
    }
    prevStatusRef.current = ticket.status
  }, [ticket, ticketId, currentUserId, queryClient])

  const { data: comments = [] } = useQuery({
    queryKey: ['chat-widget-comments', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('*, author:profiles!author_id(full_name)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })

  // Anexos do chamado, com URL assinada — mesmo padrão do TicketDetailDialog.
  const { data: attachments = [] } = useQuery({
    queryKey: ['chat-widget-attachments', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })
      if (error) throw error
      const withUrls = await Promise.all(
        (data || []).map(async (att: any) => {
          const { data: urlData } = await supabase.storage
            .from('ticket-attachments')
            .createSignedUrl(att.file_path, 3600)
          return { ...att, signedUrl: urlData?.signedUrl || null }
        })
      )
      return withUrls
    },
  })


  useEffect(() => {
    const channel = supabase
      .channel(`chat-widget-${ticketId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `ticket_id=eq.${ticketId}` },
        () => queryClient.invalidateQueries({ queryKey: ['chat-widget-comments', ticketId] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attachments', filter: `ticket_id=eq.${ticketId}` },
        () => queryClient.invalidateQueries({ queryKey: ['chat-widget-attachments', ticketId] })
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

  // Marca como lido — comentário (tick/horário de leitura) e a notificação
  // correspondente (pra sumir do dropdown "Mensagens" do Header e do badge
  // da lista) — sempre que a conversa está aberta.
  useEffect(() => {
    if (!ticketId || !currentUserId) return

    const unreadFromOthers = comments.filter((c: any) => c.author_id !== currentUserId && !c.read_at)
    if (unreadFromOthers.length > 0) {
      // RPC em vez de UPDATE direto: a RLS de `comments` só deixa o autor
      // atualizar a própria linha, e quem marca como lido é sempre o
      // destinatário — um UPDATE direto falhava silenciosamente (0 linhas,
      // sem erro) e o tick nunca virava duplo. `mark_comments_read` roda
      // como SECURITY DEFINER só pra gravar read_at (ver migration
      // 202608261500_mark_comment_read_rpc.sql).
      supabase.rpc('mark_comments_read', { p_comment_ids: unreadFromOthers.map((c: any) => c.id) })
        .then(({ error }) => {
          if (error) console.error('[chat] Falha ao marcar comentários como lidos:', error)
          queryClient.invalidateQueries({ queryKey: ['chat-widget-comments', ticketId] })
        })
    }

    supabase.from('notifications')
      .update({ is_read: true })
      .eq('ticket_id', ticketId)
      .eq('user_id', currentUserId)
      .eq('title', 'Novo comentário')
      .eq('is_read', false)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['suporte-mensagens'] })
        queryClient.invalidateQueries({ queryKey: ['suporte-notificacoes'] })
        queryClient.invalidateQueries({ queryKey: ['unread-comment-counts'] })
      })
  }, [ticketId, currentUserId, comments, queryClient])

  // Reseta a barra de "novas mensagens" ao trocar de ticket, e marca o
  // ticket anterior como visto (próxima vez que abrir, nada aparece como novo).
  useEffect(() => {
    dividerComputedFor.current = null
    setNewDividerIndex(null)
    return () => {
      if (ticketId) seenCounts.current.set(ticketId, commentsLenRef.current)
    }
  }, [ticketId])

  useEffect(() => {
    if (!ticketId || comments.length === 0) return
    if (dividerComputedFor.current === ticketId) return
    dividerComputedFor.current = ticketId
    const prevSeen = seenCounts.current.get(ticketId)
    setNewDividerIndex(prevSeen !== undefined && prevSeen < comments.length ? prevSeen : null)
  }, [ticketId, comments])

  function pickImage(file: File) {
    if (!isImageFile(file)) {
      toast.error('Só é possível anexar imagens por aqui.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('A imagem deve ter no máximo 10MB.')
      return
    }
    setPendingImage(file)
    setPendingImagePreview(URL.createObjectURL(file))
  }

  function clearPendingImage() {
    if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview)
    setPendingImage(null)
    setPendingImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Cola uma imagem do clipboard (print/copiar imagem) direto no composer —
  // mesmo fluxo de anexar por arquivo, só que sem passar pelo seletor.
  function handlePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
    if (!item) return
    const file = item.getAsFile()
    if (!file) return
    e.preventDefault()
    pickImage(file)
  }

  const sendComment = useMutation({
    mutationFn: async () => {
      if (isClosed) throw new Error('Chamado encerrado')
      if (!text.trim() && !pendingImage) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      const content = text.trim()
      const { data: commentData, error } = await supabase.from('comments').insert({
        ticket_id: ticketId,
        content,
        author_id: user.id,
        internal_only: false,
      }).select('id').single()
      if (error) throw error

      if (pendingImage && commentData) {
        const filePath = `${ticketId}/${crypto.randomUUID()}_${pendingImage.name}`
        const { error: uploadError } = await supabase.storage
          .from('ticket-attachments')
          .upload(filePath, pendingImage)
        if (uploadError) throw uploadError

        const { error: attError } = await supabase.from('attachments').insert({
          ticket_id: ticketId,
          comment_id: commentData.id,
          file_name: pendingImage.name,
          file_path: filePath,
          file_type: pendingImage.type,
          file_size: pendingImage.size,
          uploaded_by: user.id,
        })
        if (attError) throw attError
      }

      // Resposta da TI move o chamado pra "Em Andamento" (status `pending`)
      // sozinha — sem isso, um chamado "A fazer"/"Em teste"/"Parado" fica
      // preso lá mesmo depois de alguém já estar cuidando dele. Só a TI move
      // o card: uma mensagem do próprio solicitante (usuário comum) não deve
      // fingir que alguém já está tratando o chamado.
      if (isStaff && ticket && ticketCategory(ticket.status) !== 'in_progress') {
        await supabase.from('tickets').update({ status: 'pending' }).eq('id', ticketId)
      }
    },
    onSuccess: () => {
      setText('')
      clearPendingImage()
      queryClient.invalidateQueries({ queryKey: ['chat-widget-comments', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['chat-widget-attachments', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['chat-widget-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['chat-widget-ticket', ticketId] })
    },
    onError: () => toast.error('Erro ao enviar mensagem'),
  })

  // Botões de status acima do input: a TI move o chamado sem sair do chat.
  const changeStatus = useMutation({
    mutationFn: async (status: ManualTicketStatus) => {
      const { error } = await supabase.from('tickets').update({ status }).eq('id', ticketId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-widget-ticket', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['chat-widget-conversations'] })
    },
    onError: () => toast.error('Erro ao alterar o status do chamado'),
  })

  // "Encerrar Chat": grava o status `closed` na hora (o chamado já muda de
  // aba pra quem estiver na lista) e deixa um aviso visível no histórico
  // (com quem encerrou) — mas esta tela em particular continua se
  // comportando como aberta (via `justClosed`) até a TI sair da conversa,
  // pra não travar o input nem soltar aviso de "vai sumir" no meio do uso.
  const closeChatMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      const authorName = profile?.full_name || 'alguém da TI'
      const { error: commentError } = await supabase.from('comments').insert({
        ticket_id: ticketId,
        content: `${CLOSE_NOTE_PREFIX} por ${authorName}.`,
        author_id: user.id,
        internal_only: false,
      })
      if (commentError) throw commentError
      const { error: statusError } = await supabase.from('tickets').update({ status: 'closed' }).eq('id', ticketId)
      if (statusError) throw statusError
    },
    onSuccess: () => {
      setJustClosed(true)
      queryClient.invalidateQueries({ queryKey: ['chat-widget-comments', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['chat-widget-ticket', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['chat-widget-conversations'] })
    },
    onError: () => toast.error('Erro ao encerrar o chat'),
  })

  return (
    <div className="fixed bottom-4 right-4 z-[110] flex h-[480px] w-[360px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-raised px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            onClick={backToList}
            aria-label="Voltar pra lista"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="shrink-0 rounded border border-gold-border-soft px-1.5 py-0.5 text-[10px] font-bold text-gold">
                #{String(ticket?.ticket_code ?? '').padStart(3, '0')}
              </span>
              <span className="truncate text-sm font-semibold text-text-primary">{ticket?.title || 'Carregando...'}</span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-text-muted">
              Responsável: {(ticket?.assignee as any)?.full_name || 'Sem responsável'}
            </p>
          </div>
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {comments.length === 0 ? (
          <p className="pt-8 text-center text-xs text-text-muted">Nenhuma mensagem ainda.</p>
        ) : (
          comments.map((c: any, idx: number) => {
            const isMine = c.author_id === currentUserId
            const authorName = c.author?.full_name || 'Usuário'
            const prev = comments[idx - 1] as any
            const next = comments[idx + 1] as any
            const showDayHeader = !prev || dayKey(prev.created_at) !== dayKey(c.created_at)
            const showNewDivider = newDividerIndex !== null && idx === newDividerIndex
            const imageAtts = (attachments as any[]).filter((a) => a.comment_id === c.id && a.file_type?.startsWith('image/'))

            const GROUP_GAP_MS = 5 * 60 * 1000
            const sameAuthor = (a: any, b: any) => a && b && a.author_id === b.author_id && !isSystemNote(a.content) && !isSystemNote(b.content)
            const gapTooBig = (a: any, b: any) => !a || !b || Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) > GROUP_GAP_MS
            const isFirstInGroup =
              !prev || showDayHeader || showNewDivider || !sameAuthor(prev, c) || gapTooBig(prev, c)
            const isLastInGroup =
              !next || (newDividerIndex !== null && idx + 1 === newDividerIndex) ||
              dayKey(c.created_at) !== dayKey(next.created_at) ||
              !sameAuthor(c, next) || gapTooBig(c, next)
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
                  <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''} ${isFirstInGroup ? 'mt-3' : 'mt-0.5'}`}>
                    {isLastInGroup ? <Avatar name={authorName} /> : <div className="h-7 w-7 shrink-0" />}
                    <div className={`flex max-w-[75%] flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      {isFirstInGroup && (
                        <span className="mb-0.5 px-1 text-[10px] text-text-muted">{authorName}</span>
                      )}
                      {imageAtts.map((att) => (
                        <button
                          key={att.id}
                          type="button"
                          onClick={() => att.signedUrl && setPreviewImage({ url: att.signedUrl, alt: att.file_name })}
                          className="mb-1 block cursor-zoom-in"
                        >
                          <img
                            src={att.signedUrl}
                            alt={att.file_name}
                            className="max-h-48 max-w-full rounded-xl border border-border object-contain"
                          />
                        </button>
                      ))}
                      {c.content && (
                        <div
                          className={`rounded-2xl px-3 py-2 text-sm ${
                            isMine
                              ? `bg-gold text-background ${isLastInGroup ? 'rounded-br-sm' : ''}`
                              : `bg-surface text-text-primary ${isLastInGroup ? 'rounded-bl-sm' : ''}`
                          }`}
                        >
                          {c.content}
                        </div>
                      )}
                      {isLastInGroup && (
                        <span className="mt-0.5 flex items-center gap-1 px-1 text-[9px] text-text-muted">
                          {isMine && (
                            c.read_at
                              ? <CheckCheck className="h-3 w-3 shrink-0 text-gold" />
                              : <Check className="h-3 w-3 shrink-0" />
                          )}
                          {isMine && c.read_at ? `Lido às ${formatTime(c.read_at)}` : formatTime(c.created_at)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Barra de status: só a TI move o chamado ou encerra o chat */}
      {isStaff && !isBlocked && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-2.5 pt-2">
          {STATUS_BUTTONS.map((b) => {
            const isCurrent = ticket?.status === b.status
            return (
              <button
                key={b.status}
                onClick={() => changeStatus.mutate(b.status)}
                disabled={isCurrent || changeStatus.isPending}
                className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                  isCurrent
                    ? 'border-gold-border bg-gold-muted text-gold'
                    : 'border-border text-text-secondary hover:bg-surface hover:text-text-primary'
                }`}
              >
                {b.label}
              </button>
            )
          })}
          <button
            onClick={() => setCloseModalOpen(true)}
            disabled={closeChatMutation.isPending}
            className="ml-auto rounded-md border border-red-500/40 px-2 py-1 text-[11px] font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
          >
            Encerrar Chat
          </button>
        </div>
      )}

      {/* Pending image preview */}
      {pendingImagePreview && (
        <div className="flex items-center gap-2 border-t border-border px-2.5 pt-2">
          <img src={pendingImagePreview} alt="Prévia" className="h-12 w-12 rounded-lg border border-border object-cover" />
          <span className="flex-1 truncate text-xs text-text-muted">{pendingImage?.name}</span>
          <button
            onClick={clearPendingImage}
            aria-label="Remover imagem"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Input */}
      {isBlocked ? (
        <div className="border-t border-border p-3 text-center text-xs text-text-muted">
          Este chamado está encerrado. Mova-o para outra seção e reabra pra continuar a conversa.
        </div>
      ) : (
      <div className="flex items-center gap-2 border-t border-border p-2.5">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) pickImage(file)
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          aria-label="Anexar imagem"
          title="Anexar imagem"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-surface hover:text-text-primary"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && (text.trim() || pendingImage) && !sendComment.isPending) {
              e.preventDefault()
              sendComment.mutate()
            }
          }}
          placeholder="Escreva uma resposta..."
          className="h-9 flex-1 rounded-lg border border-border bg-search-field px-3 text-[13px] text-text-primary placeholder-text-muted outline-none focus:border-gold-border"
        />
        <button
          onClick={() => sendComment.mutate()}
          disabled={(!text.trim() && !pendingImage) || sendComment.isPending}
          aria-label="Enviar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold text-background transition-opacity disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      )}

      {/* Modal de confirmação — CRM próprio, sem confirm() nativo do navegador */}
      {closeModalOpen && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setCloseModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs rounded-xl border border-border bg-card p-4 shadow-2xl"
          >
            <h4 className="text-sm font-semibold text-text-primary">Encerrar chat?</h4>
            <p className="mt-1.5 text-xs text-text-muted">
              O solicitante verá um aviso de que o chat foi encerrado. A conversa continua na sua
              tela até você sair dela.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setCloseModalOpen(false)}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setCloseModalOpen(false)
                  closeChatMutation.mutate()
                }}
                disabled={closeChatMutation.isPending}
                className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:bg-red-600 disabled:opacity-50"
              >
                Encerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview de imagem — mesmo padrão de overlay do modal de confirmação acima */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            aria-label="Fechar"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={previewImage.url}
            alt={previewImage.alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  )
}
