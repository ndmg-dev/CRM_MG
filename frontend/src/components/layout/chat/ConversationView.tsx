import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, X, Send, Minus, Check, CheckCheck, Paperclip, Trash2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useChatWidgetStore } from '@/stores/chatWidgetStore'
import { supabase } from '@/systems/central-suporte/integrations/supabase/client'
import { isTicketClosed, ticketCategory } from '@/systems/central-suporte/utils/ticketStatus'
import { useUserSector } from '@/systems/central-suporte/hooks/useUserSector'
import { CLOSE_NOTE_PREFIX, isSystemNote } from '@/systems/central-suporte/utils/systemNote'

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

function Avatar({ name, src }: { name: string; src?: string | null }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase()
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-7 w-7 shrink-0 rounded-full border border-gold-border object-cover"
      />
    )
  }
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

// CLOSE_NOTE_PREFIX e isSystemNote agora vêm de utils/systemNote.ts,
// compartilhado com o TicketDetailDialog (mesma detecção de nota de
// sistema nos dois lugares que mostram a conversa do chamado).

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
  const { isStaff, isAdmin } = useUserSector()
  const [text, setText] = useState('')
  const [pendingImages, setPendingImages] = useState<{ file: File; previewUrl: string }[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [newDividerIndex, setNewDividerIndex] = useState<number | null>(null)
  const [closeModalOpen, setCloseModalOpen] = useState(false)
  // Preview de imagem em modal em vez de abrir em nova aba — nova aba tira a
  // pessoa do chat pra ver um print; um modal por cima resolve sem sair daqui.
  const [previewImage, setPreviewImage] = useState<{ url: string; alt: string } | null>(null)

  useEffect(() => {
    if (!previewImage) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewImage(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewImage])
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

  // Destrava o input desta tela quando o chamado é reaberto fora do chat
  // (dropdown do TicketDetailDialog, Kanban etc.) — a nota de reabertura em
  // si (com o motivo obrigatório) já é gravada na origem, ver
  // utils/reopenTicket.ts; não duplica aqui.
  const prevStatusRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (!ticket) return
    const prevStatus = prevStatusRef.current
    const wasClosed = prevStatus !== undefined && isTicketClosed(prevStatus)
    if (wasClosed && !isTicketClosed(ticket.status)) {
      setJustClosed(false)
    }
    prevStatusRef.current = ticket.status
  }, [ticket])

  // Mesmo limite/estratégia do TicketDetailDialog: busca as mais recentes
  // (desc) e inverte, em vez de carregar o histórico inteiro de chamados
  // antigos com muita conversa a cada evento realtime.
  const RECENT_ROWS_LIMIT = 200

  const { data: rawComments = [] } = useQuery({
    queryKey: ['chat-widget-comments', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('*, author:profiles!author_id(full_name, foto_url)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false })
        .limit(RECENT_ROWS_LIMIT)
      if (error) throw error
      return (data || []).slice().reverse()
    },
  })

  // Nota interna (criada no modal de detalhes do chamado) só é visível pra
  // Admin TI e pra quem escreveu — nem outro membro da TI (support_agent,
  // dev, coordenador) vê a nota interna de um colega, e o solicitante nunca
  // vê nenhuma. Filtro em cima do resultado da query (não na query em si)
  // porque currentUserId resolve num efeito separado, depois do primeiro
  // fetch — filtrar na query arriscava rodar antes dele estar pronto.
  const comments = useMemo(
    () => rawComments.filter((c: any) => !c.internal_only || isAdmin || c.author_id === currentUserId),
    [rawComments, isAdmin, currentUserId]
  )

  // Anexos do chamado, com URL assinada — mesmo padrão do TicketDetailDialog.
  const { data: attachments = [] } = useQuery({
    queryKey: ['chat-widget-attachments', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false })
        .limit(RECENT_ROWS_LIMIT)
      if (error) throw error
      const withUrls = await Promise.all(
        (data || []).map(async (att: any) => {
          const { data: urlData } = await supabase.storage
            .from('ticket-attachments')
            .createSignedUrl(att.file_path, 3600)
          return { ...att, signedUrl: urlData?.signedUrl || null }
        })
      )
      return withUrls.reverse()
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

  // Aceita mais de uma imagem de uma vez (seleção múltipla ou vários prints
  // colados juntos), acumulando em cima do que já tinha sido escolhido.
  function pickImages(files: File[]) {
    const added: { file: File; previewUrl: string }[] = []
    for (const file of files) {
      if (!isImageFile(file)) {
        toast.error('Só é possível anexar imagens por aqui.')
        continue
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`"${file.name}" tem mais de 10MB e não foi anexada.`)
        continue
      }
      added.push({ file, previewUrl: URL.createObjectURL(file) })
    }
    if (added.length > 0) setPendingImages((prev) => [...prev, ...added])
  }

  // Remove só essa imagem, as outras anexadas continuam — não existe mais
  // um "limpar tudo" de uma vez.
  function removePendingImage(index: number) {
    setPendingImages((prev) => {
      const target = prev[index]
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  function clearPendingImages() {
    setPendingImages((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.previewUrl))
      return []
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Cola imagens do clipboard (print/copiar imagem) direto no composer —
  // mesmo fluxo de anexar por arquivo, só que sem passar pelo seletor. Pega
  // todas as imagens coladas de uma vez, não só a primeira.
  function handlePaste(e: React.ClipboardEvent) {
    const items = Array.from(e.clipboardData.items).filter((i) => i.type.startsWith('image/'))
    if (items.length === 0) return
    const files = items.map((i) => i.getAsFile()).filter((f): f is File => !!f)
    if (files.length === 0) return
    e.preventDefault()
    pickImages(files)
  }

  const sendComment = useMutation({
    mutationFn: async () => {
      if (isClosed) throw new Error('Chamado encerrado')
      if (!text.trim() && pendingImages.length === 0) return
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

      // Upload de cada imagem, todas ligadas ao mesmo comentário — um por
      // um em vez de Promise.all pra não estourar a conexão com várias
      // imagens grandes de uma vez.
      if (pendingImages.length > 0 && commentData) {
        for (const { file } of pendingImages) {
          const filePath = `${ticketId}/${crypto.randomUUID()}_${file.name}`
          const { error: uploadError } = await supabase.storage
            .from('ticket-attachments')
            .upload(filePath, file)
          if (uploadError) throw uploadError

          const { error: attError } = await supabase.from('attachments').insert({
            ticket_id: ticketId,
            comment_id: commentData.id,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user.id,
          })
          if (attError) throw attError
        }
      }

      // Resposta da TI move o chamado pra "Em Andamento" (status `pending`)
      // sozinha — sem isso, um chamado "A fazer"/"Em teste"/"Parado" fica
      // preso lá mesmo depois de alguém já estar cuidando dele. Só a TI move
      // o card: uma mensagem do próprio solicitante (usuário comum) não deve
      // fingir que alguém já está tratando o chamado.
      // Busca o status na hora em vez de confiar no `ticket` do closure do
      // render, que pode estar um render atrás de uma troca de status feita
      // bem antes do envio.
      if (isStaff) {
        const { data: freshTicket } = await supabase
          .from('tickets')
          .select('status')
          .eq('id', ticketId)
          .single()
        if (freshTicket && ticketCategory(freshTicket.status) !== 'in_progress') {
          await supabase.from('tickets').update({ status: 'pending' }).eq('id', ticketId).is('archived_at', null)
        }
      }
    },
    onSuccess: () => {
      setText('')
      clearPendingImages()
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
      const { error } = await supabase.from('tickets').update({ status }).eq('id', ticketId).is('archived_at', null)
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
      const { error: statusError } = await supabase.from('tickets').update({ status: 'closed' }).eq('id', ticketId).is('archived_at', null)
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
            const authorPhoto = c.author?.foto_url as string | null | undefined
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
                {/* Nota interna (criada pelo modal de detalhes do chamado) —
                    `comments` (derivado de rawComments) já filtra pra só
                    sobrar aqui o que Admin TI ou o próprio autor podem ver;
                    ninguém mais (nem outro membro da TI, nem o solicitante)
                    chega a ter essa linha na lista. Barra igual à do modal
                    (mesmo critério de grupo, só na primeira de uma
                    sequência interna seguida). */}
                {c.internal_only && (!prev || !prev.internal_only || isSystemNote(prev.content)) && (
                  <div className="mb-2 mt-3 flex items-center gap-2">
                    <div className="h-px flex-1" style={{ background: 'rgba(245,158,11,0.35)' }} />
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--mg-color-status-warning)' }}>
                      🔒 Nota interna · só a TI vê
                    </span>
                    <div className="h-px flex-1" style={{ background: 'rgba(245,158,11,0.35)' }} />
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
                    {isLastInGroup ? <Avatar name={authorName} src={authorPhoto} /> : <div className="h-7 w-7 shrink-0" />}
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

      {/* Pending image previews — grade de miniaturas lado a lado (não mais
          uma lista de uma coluna só, cabe muito mais imagem por área de
          tela), cada uma com seu X sobreposto que só aparece no hover
          (não existe "limpar tudo"). Altura travada + scroll próprio:
          sem isso, anexar muitas imagens de uma vez ainda empurrava o
          composer pra fora da janelinha pequena do chat. */}
      {pendingImages.length > 0 && (
        <div className="border-t border-border px-2.5 pt-2">
          <p className="mb-1 text-[11px] text-text-muted">
            {pendingImages.length} {pendingImages.length === 1 ? 'imagem anexada' : 'imagens anexadas'}
          </p>
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
            {pendingImages.map((p, i) => (
              <div key={p.previewUrl} className="group relative shrink-0">
                <img src={p.previewUrl} alt="Prévia" className="h-14 w-14 rounded-lg border border-border object-cover" title={p.file.name} />
                <button
                  onClick={() => removePendingImage(i)}
                  aria-label={`Remover ${p.file.name}`}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
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
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || [])
            if (files.length > 0) pickImages(files)
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
            if (e.key === 'Enter' && !e.shiftKey && (text.trim() || pendingImages.length > 0) && !sendComment.isPending) {
              e.preventDefault()
              sendComment.mutate()
            }
          }}
          placeholder="Escreva uma resposta..."
          className="h-9 flex-1 rounded-lg border border-border bg-search-field px-3 text-[13px] text-text-primary placeholder-text-muted outline-none focus:border-gold-border"
        />
        <button
          onClick={() => sendComment.mutate()}
          disabled={(!text.trim() && pendingImages.length === 0) || sendComment.isPending}
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
          role="dialog"
          aria-modal="true"
          aria-label={previewImage.alt}
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
