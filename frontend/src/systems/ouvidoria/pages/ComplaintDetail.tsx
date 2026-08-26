import { useState } from 'react'
import type { FormEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Lock, Paperclip, ExternalLink, Send } from 'lucide-react'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'
import { supabase } from '../lib/supabase'
import { useOuvidoriaProfile } from '../lib/useOuvidoriaProfile'
import {
  categoryLabel,
  formatDate,
  priorityBadge,
  priorityLabel,
  statusBadge,
  statusLabel,
  typeLabel,
} from '../lib/format'
import type { Complaint, ComplaintAttachment, ComplaintMessage } from '../lib/types'

// Port de ouvidoria/detail.html + ouvidoria.detail()/add_message()/
// get_messages(). O polling "ao vivo" do original (fetch a cada 5s) vira
// `refetchInterval` do react-query — mesmo efeito, menos código próprio.
// Segurança: se a policy RLS bloquear (não é dono nem admin), a query
// simplesmente não retorna linha nenhuma — tratamos isso como "não
// encontrada" em vez de tentar distinguir "não existe" de "sem permissão"
// (o Supabase/PostgREST não diferencia os dois casos por design de RLS).
export default function ComplaintDetail() {
  const { id } = useParams<{ id: string }>()
  const toAbs = useNativeSystemPath()
  const { data: profile } = useOuvidoriaProfile()
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')

  const { data: complaint, isLoading } = useQuery({
    queryKey: ['ouvidoria-complaint', id],
    queryFn: async (): Promise<Complaint | null> => {
      const { data, error } = await supabase.from('complaints').select('*').eq('id', id).eq('is_deleted', false).maybeSingle()
      if (error) throw error
      return data as Complaint | null
    },
    enabled: !!id,
  })

  const { data: messages } = useQuery({
    queryKey: ['ouvidoria-complaint-messages', id],
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

  const { data: attachments } = useQuery({
    queryKey: ['ouvidoria-complaint-attachments', id],
    queryFn: async (): Promise<ComplaintAttachment[]> => {
      const { data, error } = await supabase
        .from('complaint_attachments')
        .select('*')
        .eq('complaint_id', id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as ComplaintAttachment[]
    },
    enabled: !!complaint,
  })

  const sendMessage = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.from('complaint_messages').insert({
        complaint_id: id,
        sender_id: profile!.id,
        sender_type: profile?.role === 'admin' ? 'admin' : 'user',
        content: text,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setContent('')
      queryClient.invalidateQueries({ queryKey: ['ouvidoria-complaint-messages', id] })
    },
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) return
    sendMessage.mutate(trimmed)
  }

  if (isLoading) return null

  if (!complaint) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3>Manifestação não encontrada</h3>
          <p>Ela não existe ou você não tem permissão para visualizá-la.</p>
          <Link to={toAbs('manifestacoes')} className="btn btn-primary btn-sm">Voltar para a lista</Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <Link to={toAbs('manifestacoes')} className="btn btn-secondary btn-sm">
          <ArrowLeft /> Voltar
        </Link>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <div className="card animate-fade">
            <div className="card-header">
              <h3>{complaint.title}</h3>
              <span className={`badge badge-${statusBadge(complaint.status)}`}>{statusLabel(complaint.status)}</span>
            </div>
            <div className="detail-description">{complaint.description}</div>
          </div>

          <div className="card animate-fade" id="card-interactions">
            <div className="card-header">
              <h3>Interações</h3>
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
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Adicionar mensagem</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Escreva uma mensagem..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={sendMessage.isPending}>
                <Send /> {sendMessage.isPending ? 'Enviando...' : 'Enviar'}
              </button>
            </form>
          </div>

          {attachments && attachments.length > 0 && (
            <div className="card animate-fade">
              <div className="card-header"><h3>Anexos ({attachments.length})</h3></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {attachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.file_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.75rem', background: 'var(--bg-tertiary)', borderRadius: 6, color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}
                  >
                    <Paperclip style={{ width: 16, height: 16, flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.file_name}</span>
                    <ExternalLink style={{ width: 14, height: 14, flexShrink: 0 }} />
                  </a>
                ))}
              </div>
            </div>
          )}
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
                <div className="detail-info-value">
                  <span className={`badge badge-${statusBadge(complaint.status)}`}>{statusLabel(complaint.status)}</span>
                </div>
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
                <div className="detail-info-value">
                  <span className={`badge badge-${priorityBadge(complaint.priority)}`}>{priorityLabel(complaint.priority)}</span>
                </div>
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
            <div className="card-header"><h3>Histórico</h3></div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>Criada em:</span><br />
                {formatDate(complaint.created_at)}
              </div>
              {complaint.resolved_at && (
                <div>
                  <span style={{ color: 'var(--text-tertiary)' }}>Concluída em:</span><br />
                  {formatDate(complaint.resolved_at)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
