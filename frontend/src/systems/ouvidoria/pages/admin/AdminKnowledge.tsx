import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Cpu, FileUp, FilePlus, MessageCircle, PlusCircle, Info } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { knowledgeCreate, knowledgeUpload } from '../../lib/api'
import type { KnowledgeDocument } from '../../lib/types'

// Port de admin/knowledge.html + admin.knowledge()/knowledge_create()/
// knowledge_toggle()/knowledge_delete()/knowledge_upload(). Diferença do
// original: criar documento manual (com conteúdo texto) e indexar (chunking
// + embeddings OpenAI) precisa da OPENAI_API_KEY, que nunca pode chegar ao
// navegador — por isso passa pelo proxy FastAPI (knowledgeCreate). O
// upload de arquivo (PDF/Doc) é um relay puro pro n8n (knowledgeUpload).
// Toggle/soft-delete são updates diretos no Supabase (RLS libera pra admin).
export default function AdminKnowledge() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'danger' } | null>(null)
  const [form, setForm] = useState({ title: '', category: '', description: '', content: '' })

  const { data: documents } = useQuery({
    queryKey: ['ouvidoria-knowledge-documents'],
    queryFn: async (): Promise<KnowledgeDocument[]> => {
      const { data, error } = await supabase
        .from('knowledge_documents')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as KnowledgeDocument[]
    },
  })

  const createDoc = useMutation({
    mutationFn: () => knowledgeCreate(form),
    onSuccess: () => {
      setModalOpen(false)
      setForm({ title: '', category: '', description: '', content: '' })
      queryClient.invalidateQueries({ queryKey: ['ouvidoria-knowledge-documents'] })
    },
  })

  const toggleStatus = useMutation({
    mutationFn: async (doc: KnowledgeDocument) => {
      const newStatus = doc.status === 'active' ? 'inactive' : 'active'
      const { error } = await supabase.from('knowledge_documents').update({ status: newStatus }).eq('id', doc.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ouvidoria-knowledge-documents'] }),
  })

  const deleteDoc = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase.from('knowledge_documents').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', docId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ouvidoria-knowledge-documents'] }),
  })

  function handleCreateSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    createDoc.mutate()
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const title = file.name.includes('.') ? file.name.split('.').slice(0, -1).join('.') : file.name
      const result = await knowledgeUpload(file, title)
      setToast({ text: `✅ ${result.message}`, type: 'success' })
      queryClient.invalidateQueries({ queryKey: ['ouvidoria-knowledge-documents'] })
    } catch (err) {
      setToast({ text: `❌ Erro: ${err instanceof Error ? err.message : 'Falha no envio.'}`, type: 'danger' })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setTimeout(() => setToast(null), 5000)
    }
  }

  return (
    <>
      <div className="page-header">
        <p className="text-secondary" style={{ fontSize: '0.85rem' }}>{documents?.length ?? 0} documento(s)</p>
        <div className="page-header-actions">
          <button type="button" className="btn btn-secondary" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            <FileUp /> {uploading ? 'Enviando...' : 'Importar PDF/Doc'}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
            <PlusCircle /> Novo Documento
          </button>
          <input ref={fileInputRef} type="file" hidden accept=".pdf,.doc,.docx,.txt" onChange={handleFileUpload} />
        </div>
      </div>

      {documents && documents.length > 0 ? (
        <div className="knowledge-grid">
          {documents.map((doc) => (
            <div key={doc.id} className="knowledge-card animate-fade">
              <div className="knowledge-card-header">
                <span className="knowledge-card-title">{doc.title}</span>
                <span className={`badge ${doc.status === 'active' ? 'badge-success' : 'badge-secondary'}`}>
                  {doc.status === 'active' ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div className="knowledge-card-desc">{doc.description || 'Sem descrição'}</div>
              {doc.category && <span className="badge badge-gold" style={{ marginBottom: '0.75rem' }}>{doc.category}</span>}
              <div className="knowledge-card-actions">
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => toggleStatus.mutate(doc)} disabled={toggleStatus.isPending}>
                  {doc.status === 'active' ? 'Desativar' : 'Ativar'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  disabled={deleteDoc.isPending}
                  onClick={() => {
                    if (confirm('Deseja realmente remover este documento?')) deleteDoc.mutate(doc.id)
                  }}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon" style={{ color: 'var(--accent-gold)' }}><BookOpen style={{ width: 48, height: 48, strokeWidth: 1.5 }} /></div>
            <h3>Nenhum documento cadastrado</h3>
            <p>Adicione políticas, normas e orientações para alimentar o assistente de IA.</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}>Adicionar Documento</button>
          </div>
        </div>
      )}

      <div className="card mt-3 animate-fade">
        <div className="card-header"><h3>Como funciona a Base de Conhecimento?</h3></div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <p>Aqui você adiciona os documentos e políticas da empresa — como o Código de Conduta, Manual do Colaborador ou qualquer orientação importante. A IRIS, nossa assistente de IA, usa esses documentos para responder às perguntas dos colaboradores com precisão.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '1rem', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--accent-gold)', marginBottom: '0.5rem' }}><FilePlus style={{ width: 20, height: 20 }} /></div>
              <strong style={{ color: 'var(--text-main)', fontSize: '0.8rem' }}>1. Você adiciona um documento</strong>
              <p style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Clique em "Novo Documento" e cole o texto, ou importe um PDF diretamente.</p>
            </div>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '1rem', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--accent-gold)', marginBottom: '0.5rem' }}><Cpu style={{ width: 20, height: 20 }} /></div>
              <strong style={{ color: 'var(--text-main)', fontSize: '0.8rem' }}>2. O sistema processa automaticamente</strong>
              <p style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>O conteúdo é analisado e organizado nos bastidores para que a IA consiga encontrá-lo rapidamente.</p>
            </div>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '1rem', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--accent-gold)', marginBottom: '0.5rem' }}><MessageCircle style={{ width: 20, height: 20 }} /></div>
              <strong style={{ color: 'var(--text-main)', fontSize: '0.8rem' }}>3. A IRIS responde com base nisso</strong>
              <p style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Quando um colaborador faz uma pergunta no chat, a IRIS busca a resposta nos documentos que você cadastrou.</p>
            </div>
          </div>

          <p style={{ marginTop: '1rem', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
            <Info style={{ width: 13, height: 13, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            Documentos marcados como <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Ativo</span> são usados pela IRIS. Documentos <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>Inativos</span> ficam salvos, mas não são consultados.
          </p>
        </div>
      </div>

      <div className={`modal-overlay${modalOpen ? ' active' : ''}`}>
        <div className="modal-content">
          <div className="modal-header">
            <h3>Novo Documento</h3>
            <button type="button" className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
          </div>
          <form onSubmit={handleCreateSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="doc-title">Título *</label>
              <input type="text" className="form-control" id="doc-title" placeholder="Nome do documento ou política" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="doc-category">Categoria</label>
              <input type="text" className="form-control" id="doc-category" placeholder="Ex: Política de RH, Benefícios, Código de Conduta" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="doc-description">Descrição</label>
              <textarea className="form-control" id="doc-description" rows={2} placeholder="Breve descrição do documento" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="doc-content">Conteúdo</label>
              <textarea className="form-control" id="doc-content" rows={8} placeholder="Cole aqui o conteúdo textual do documento/política..." value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} />
              <div className="form-hint">Este conteúdo será utilizado para gerar os chunks de busca no RAG.</div>
            </div>
            {createDoc.isError && <div style={{ fontSize: '0.85rem', color: 'var(--danger)', marginBottom: '0.75rem' }}>{(createDoc.error as Error).message}</div>}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={createDoc.isPending}>
                {createDoc.isPending ? 'Salvando...' : 'Salvar Documento'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', background: 'var(--bg-elevated)', border: `1px solid ${toast.type === 'success' ? 'var(--success)' : 'var(--danger)'}`, color: 'var(--text-main)', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', maxWidth: 380 }}>
          {toast.text}
        </div>
      )}
    </>
  )
}
