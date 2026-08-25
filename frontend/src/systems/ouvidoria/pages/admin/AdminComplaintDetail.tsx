import { useState } from 'react'
import type { FormEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import { ArrowLeft, ExternalLink, Lock, Paperclip, Send, ShieldOff, Sparkles, UserCheck, Wand2 } from 'lucide-react'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'
import { supabase } from '../../lib/supabase'
import { useOuvidoriaProfile } from '../../lib/useOuvidoriaProfile'
import { aiSummary } from '../../lib/api'
import {
  ALL_STATUSES,
  categoryLabel,
  formatDateTime,
  priorityBadge,
  priorityLabel,
  statusBadge,
  statusLabel,
  typeLabel,
} from '../../lib/format'
import type { Complaint, ComplaintAttachment, ComplaintInternalNote, ComplaintMessage } from '../../lib/types'

// Port de admin/complaint_detail.html + as rotas admin.change_status /
// admin.assign / admin.add_note / admin.admin_reply / admin.ai_summary do
// repo original. Uma diferença: `log_audit` de 'view_complaint' (chamado
// pelo Flask a cada GET) não é replicado aqui automaticamente — logar
// auditoria a cada simples visualização a partir do client exigiria
// confiar no navegador pra reportar sua própria ação de leitura (fácil de
// falsificar/pular), diferente da mudança de status abaixo, que já grava
// no registro que está sendo alterado. Ver ressalva no resumo final.
export default function AdminComplaintDetail() {
  const { id } = useParams<{ id: string }>()
  const toAbs = useNativeSystemPath()
  const { data: profile } = useOuvidoriaProfile()
  const queryClient = useQueryClient()

  const [replyText, setReplyText] = useState('')
  const [noteText, setNoteText] = useState('')
  const [summaryError, setSummaryError] = useState('')
  const [summaryText, setSummaryText] = useState<string | null>(null)

  const { data: complaint, isLoading } = useQuery({
    queryKey: ['ouvidoria-admin-complaint', id],
    queryFn: async (): Promise<Complaint | null> => {
      const { data, error } = await supabase
        .from('complaints')
        .select('*, users!complaints_user_id_fkey(full_name, email, avatar_url)')
        .eq('id', id)
        .eq('is_deleted', false)
        .maybeSingle()
      if (error) throw error
      return data as Complaint | null
    },
    enabled: !!id,
  })

  const { data: messages } = useQuery({
    queryKey: ['ouvidoria-admin-complaint-messages', id],
    queryFn: async (): Promise<ComplaintMessage[]> => {
      const { data, error } = await supabase
        .from('complaint_messages')
        .select('*, users!complaint_messages_sender_id_fkey(full_name, avatar_url)')
        .eq('complaint_id', id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as ComplaintMessage[]
    },
    enabled: !!complaint,
    refetchInterval: 5000,
  })

  const { data: notes } = useQuery({
    queryKey: ['ouvidoria-admin-complaint-notes', id],
    queryFn: async (): Promise<ComplaintInternalNote[]> => {
      const { data, error } = await supabase
        .from('complaint_internal_notes')
        .select('*, users!complaint_internal_notes_author_id_fkey(full_name, avatar_url)')
        .eq('complaint_id', id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as ComplaintInternalNote[]
    },
    enabled: !!complaint,
  })

  const { data: attachments } = useQuery({
    queryKey: ['ouvidoria-admin-complaint-attachments', id],
    queryFn: async (): Promise<ComplaintAttachment[]> => {
      const { data, error } = await supabase.from('complaint_attachments').select('*').eq('complaint_id', id).order('created_at', { ascending: true })
      if (error) throw error
      return data as ComplaintAttachment[]
    },
    enabled: !!complaint,
  })

  const changeStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const payload: Record<string, unknown> = { status: newStatus }
      if (newStatus === 'concluida') payload.resolved_at = new Date().toISOString()
      const { error } = await supabase.from('complaints').update(payload).eq('id', id)
      if (error) throw error
      await supabase.from('audit_logs').insert({
        user_id: profile!.id,
        action: 'status_change',
        entity_type: 'complaint',
        entity_id: id,
        old_values: { status: complaint?.status },
        new_values: { status: newStatus },
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ouvidoria-admin-complaint', id] }),
  })

  const assignToMe = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('complaints').update({ assigned_to: profile!.id }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ouvidoria-admin-complaint', id] }),
  })

  const addNote = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from('complaint_internal_notes').insert({ complaint_id: id, author_id: profile!.id, content })
      if (error) throw error
    },
    onSuccess: () => {
      setNoteText('')
      queryClient.invalidateQueries({ queryKey: ['ouvidoria-admin-complaint-notes', id] })
    },
  })

  const sendReply = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from('complaint_messages').insert({ complaint_id: id, sender_id: profile!.id, sender_type: 'admin', content })
      if (error) throw error
    },
    onSuccess: () => {
      setReplyText('')
      queryClient.invalidateQueries({ queryKey: ['ouvidoria-admin-complaint-messages', id] })
    },
  })

  const generateSummary = useMutation({
    mutationFn: async () => {
      const history = (messages ?? []).map((m) => ({ sender_type: m.sender_type, content: m.content }))
      return aiSummary({ complaint_id: id!, messages: history })
    },
    onSuccess: (data) => {
      setSummaryText(data.summary)
      setSummaryError('')
    },
    onError: (err: Error) => setSummaryError(err.message),
  })

  function handleNote(e: FormEvent) {
    e.preventDefault()
    const trimmed = noteText.trim()
    if (trimmed) addNote.mutate(trimmed)
  }

  function handleReply(e: FormEvent) {
    e.preventDefault()
    const trimmed = replyText.trim()
    if (trimmed) sendReply.mutate(trimmed)
  }

  if (isLoading) return null

  if (!complaint) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3>Manifestação não encontrada</h3>
          <Link to={toAbs('admin/manifestacoes')} className="btn btn-primary btn-sm">Voltar</Link>
        </div>
      </div>
    )
  }

  const displaySummary = summaryText ?? complaint.ai_summary

  return (
    <>
      <div className="page-header">
        <Link to={toAbs('admin/manifestacoes')} className="btn btn-secondary btn-sm">
          <ArrowLeft /> Voltar
        </Link>
        <div className="page-header-actions">
          <button type="button" className="btn btn-sm btn-outline" onClick={() => assignToMe.mutate()} disabled={assignToMe.isPending}>
            <UserCheck /> Atribuir a mim
          </button>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <div className="card animate-fade">
            <div className="card-header">
              <h3>{complaint.title}</h3>
              <span className={`badge badge-${statusBadge(complaint.status)}`}>{statusLabel(complaint.status)}</span>
            </div>
            <div className="detail-description">{complaint.description}</div>

            {(complaint.ai_suggested_priority || complaint.ai_suggested_category) && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sugerido por IA:</span>
                {complaint.ai_suggested_priority && <span className="badge badge-gold" style={{ fontSize: '0.72rem' }}>Prioridade: {complaint.ai_suggested_priority}</span>}
                {complaint.ai_suggested_category && <span className="badge badge-gold" style={{ fontSize: '0.72rem' }}>Categoria: {complaint.ai_suggested_category}</span>}
              </div>
            )}
          </div>

          <div className="card animate-fade">
            <div className="card-header">
              <h3><Sparkles style={{ width: 16, height: 16, marginRight: 6, display: 'inline', verticalAlign: 'middle' }} />Resumo com IA</h3>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => generateSummary.mutate()} disabled={generateSummary.isPending}>
                <Wand2 style={{ width: 14, height: 14 }} /> {generateSummary.isPending ? 'Gerando...' : 'Gerar Resumo'}
              </button>
            </div>
            {summaryError ? (
              <div style={{ fontSize: '0.875rem', color: 'var(--danger)' }}>{summaryError}</div>
            ) : displaySummary ? (
              <div style={{ fontSize: '0.875rem', paddingTop: '0.5rem' }}><ReactMarkdown>{displaySummary}</ReactMarkdown></div>
            ) : (
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Clique em "Gerar Resumo" para criar um resumo automático deste caso utilizando IA.</div>
            )}
          </div>

          {attachments && attachments.length > 0 && (
            <div className="card animate-fade">
              <div className="card-header"><h3>Anexos ({attachments.length})</h3></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {attachments.map((att) => (
                  <a key={att.id} href={att.file_path} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.75rem', background: 'var(--bg-tertiary)', borderRadius: 6, color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
                    <Paperclip style={{ width: 16, height: 16, flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.file_name}</span>
                    <ExternalLink style={{ width: 14, height: 14, flexShrink: 0 }} />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="card animate-fade">
            <div className="card-header"><h3>Alterar Status</h3></div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {ALL_STATUSES.map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`btn btn-sm ${complaint.status === st ? 'btn-primary' : 'btn-secondary'}`}
                  disabled={complaint.status === st || changeStatus.isPending}
                  onClick={() => changeStatus.mutate(st)}
                >
                  {statusLabel(st)}
                </button>
              ))}
            </div>
          </div>

          <div className="card animate-fade" id="card-interactions">
            <div className="card-header">
              <h3>Interações com o Colaborador</h3>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success, #22c55e)', display: 'inline-block' }} />
                Ao vivo
              </span>
            </div>

            <div style={{ minHeight: '2rem' }}>
              {messages && messages.length > 0 ? (
                <div className="timeline">
                  {messages.map((msg) => (
                    <div key={msg.id} className="timeline-item">
                      <div className={`timeline-dot ${msg.sender_type}`} />
                      <div className="timeline-content">
                        <div className="timeline-meta">
                          <strong>{msg.users?.full_name ?? 'Usuário'}</strong>
                          <span>•</span>
                          <span className={`badge ${msg.sender_type === 'admin' ? 'badge-gold' : 'badge-info'}`} style={{ fontSize: '0.68rem' }}>
                            {msg.sender_type === 'admin' ? 'Admin' : 'Colaborador'}
                          </span>
                        </div>
                        <div className="timeline-text">{msg.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Nenhuma interação registrada.</p>
              )}
            </div>

            <hr className="divider" />
            <form onSubmit={handleReply}>
              <div className="form-group">
                <label className="form-label">Responder ao Colaborador</label>
                <textarea className="form-control" rows={3} placeholder="Escreva uma resposta visível ao colaborador..." value={replyText} onChange={(e) => setReplyText(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={sendReply.isPending}>
                <Send /> {sendReply.isPending ? 'Enviando...' : 'Enviar Resposta'}
              </button>
            </form>
          </div>

          <div className="card animate-fade">
            <div className="card-header">
              <h3>Notas Internas</h3>
              <span className="badge badge-warning" style={{ fontSize: '0.68rem' }}>Apenas Admin</span>
            </div>

            {notes && notes.length > 0 ? (
              notes.map((note) => (
                <div key={note.id} className="internal-note">
                  <div className="internal-note-header">
                    <strong>{note.users?.full_name ?? 'Admin'}</strong>
                    <span>•</span>
                    <span>{note.created_at?.slice(0, 10)}</span>
                  </div>
                  <div className="internal-note-content">{note.content}</div>
                </div>
              ))
            ) : (
              <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>Nenhuma nota interna.</p>
            )}

            <hr className="divider" />
            <form onSubmit={handleNote}>
              <div className="form-group">
                <label className="form-label">Adicionar Nota Interna</label>
                <textarea className="form-control" rows={3} placeholder="Nota visível apenas para administradores..." value={noteText} onChange={(e) => setNoteText(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-sm btn-secondary" disabled={addNote.isPending}>
                {addNote.isPending ? 'Salvando...' : 'Salvar Nota'}
              </button>
            </form>
          </div>
        </div>

        <div className="detail-sidebar">
          <div className="card animate-fade">
            <div className="card-header"><h3>Detalhes</h3></div>
            <div className="detail-info-grid">
              <div className="detail-info-item">
                <div className="detail-info-label">Protocolo</div>
                <div className="detail-info-value text-gold">{complaint.protocol}</div>
              </div>
              <div className="detail-info-item">
                <div className="detail-info-label">Status</div>
                <div className="detail-info-value"><span className={`badge badge-${statusBadge(complaint.status)}`}>{statusLabel(complaint.status)}</span></div>
              </div>
              <div className="detail-info-item">
                <div className="detail-info-label">Categoria</div>
                <div className="detail-info-value">{categoryLabel(complaint.category)}</div>
              </div>
              <div className="detail-info-item">
                <div className="detail-info-label">Tipo</div>
                <div className="detail-info-value">{typeLabel(complaint.type)}</div>
              </div>
              <div className="detail-info-item">
                <div className="detail-info-label">Prioridade</div>
                <div className="detail-info-value"><span className={`badge badge-${priorityBadge(complaint.priority)}`}>{priorityLabel(complaint.priority)}</span></div>
              </div>
              <div className="detail-info-item">
                <div className="detail-info-label">Setor</div>
                <div className="detail-info-value">{complaint.department || '—'}</div>
              </div>
            </div>

            {complaint.is_confidential && (
              <div style={{ marginTop: '0.75rem' }}>
                <span className="badge badge-gold"><Lock style={{ width: 12, height: 12, marginRight: 4 }} /> Manifestação Sigilosa</span>
              </div>
            )}
          </div>

          <div className="card animate-fade">
            <div className="card-header"><h3>Solicitante</h3></div>
            {complaint.is_confidential ? (
              <div className="empty-state" style={{ padding: '1rem 0', textAlign: 'left' }}>
                <div className="d-flex align-center gap-2">
                  <div className="avatar avatar-lg avatar-placeholder"><ShieldOff /></div>
                  <div>
                    <div className="font-medium">Identidade Protegida</div>
                    <div className="text-secondary" style={{ fontSize: '0.75rem' }}>Manifestação sigilosa</div>
                  </div>
                </div>
                <p style={{ fontSize: '0.75rem', marginTop: '1rem', marginBottom: 0 }}>Os dados do colaborador foram omitidos para garantir o <strong>sigilo da fonte</strong>.</p>
              </div>
            ) : complaint.users ? (
              <div className="d-flex align-center gap-2">
                {complaint.users.avatar_url ? (
                  <img src={complaint.users.avatar_url} className="avatar avatar-lg" referrerPolicy="no-referrer" />
                ) : (
                  <div className="avatar avatar-lg avatar-placeholder">{complaint.users.full_name.slice(0, 2).toUpperCase()}</div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="font-medium truncate">{complaint.users.full_name}</div>
                  <div className="text-secondary truncate" style={{ fontSize: '0.82rem' }} title={complaint.users.email}>{complaint.users.email}</div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="card animate-fade">
            <div className="card-header"><h3>Datas</h3></div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div><span style={{ color: 'var(--text-tertiary)' }}>Criada em:</span><br />{formatDateTime(complaint.created_at)}</div>
              <div><span style={{ color: 'var(--text-tertiary)' }}>Atualizada em:</span><br />{formatDateTime(complaint.updated_at)}</div>
              {complaint.resolved_at && <div><span style={{ color: 'var(--text-tertiary)' }}>Concluída em:</span><br />{formatDateTime(complaint.resolved_at)}</div>}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
