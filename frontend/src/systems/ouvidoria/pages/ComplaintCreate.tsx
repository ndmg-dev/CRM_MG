import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send } from 'lucide-react'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'
import { supabase } from '../lib/supabase'
import { useOuvidoriaProfile } from '../lib/useOuvidoriaProfile'
import { maskPersonalNames } from '../lib/masking'
import { triageComplaint } from '../lib/api'
import { ALL_CATEGORIES, ALL_PRIORITIES, ALL_TYPES, categoryLabel, priorityLabel, typeLabel } from '../lib/format'
import type { ComplaintCategory, ComplaintPriority, ComplaintType } from '../lib/types'

const MAX_ATTACHMENTS = 5

// Port de ouvidoria/create.html + ouvidoria.create() do repo original.
// Fluxo (não dá pra fazer tudo numa chamada, igual ao Flask original):
//   1. insere a manifestação
//   2. sobe os anexos no Storage com o complaint_id já conhecido
//   3. insere a metadata de cada anexo em complaint_attachments
//   4. dispara a triagem de IA (fire-and-forget, não bloqueia a navegação)
export default function ComplaintCreate() {
  const navigate = useNavigate()
  const toAbs = useNativeSystemPath()
  const { data: profile } = useOuvidoriaProfile()

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<ComplaintCategory | ''>('')
  const [type, setType] = useState<ComplaintType>('outro')
  const [department, setDepartment] = useState('')
  const [priority, setPriority] = useState<ComplaintPriority>('media')
  const [description, setDescription] = useState('')
  const [isConfidential, setIsConfidential] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []).slice(0, MAX_ATTACHMENTS)
    setFiles(selected)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!title.trim() || !description.trim() || !category) {
      setError('Título, categoria e descrição são obrigatórios.')
      return
    }
    if (!profile) return

    setSubmitting(true)
    try {
      const finalDescription = isConfidential ? maskPersonalNames(description.trim()) : description.trim()

      const { data: complaint, error: insertError } = await supabase
        .from('complaints')
        .insert({
          user_id: profile.id,
          title: title.trim(),
          description: finalDescription,
          category,
          type,
          department: department.trim(),
          priority,
          is_confidential: isConfidential,
          status: 'aberta',
        })
        .select()
        .single()

      if (insertError || !complaint) {
        throw insertError || new Error('Erro ao criar manifestação.')
      }

      // Anexos: sobe pro Storage e grava a metadata — melhor esforço, uma
      // falha de anexo não deve impedir a manifestação já criada de seguir.
      for (const file of files) {
        try {
          const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'bin'
          const storagePath = `${complaint.id}/${crypto.randomUUID()}.${ext}`
          const { error: uploadError } = await supabase.storage
            .from('complaint-attachments')
            .upload(storagePath, file, { contentType: file.type || 'application/octet-stream' })
          if (uploadError) throw uploadError

          const { data: publicUrlData } = supabase.storage.from('complaint-attachments').getPublicUrl(storagePath)

          await supabase.from('complaint_attachments').insert({
            complaint_id: complaint.id,
            uploaded_by: profile.id,
            file_name: file.name,
            file_path: publicUrlData.publicUrl,
            file_size: file.size,
            mime_type: file.type || 'application/octet-stream',
          })
        } catch (attachErr) {
          console.warn('[ouvidoria] falha ao anexar arquivo', file.name, attachErr)
        }
      }

      triageComplaint({ complaint_id: complaint.id, title: complaint.title, description: complaint.description })

      navigate(toAbs(`manifestacoes/${complaint.id}`))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar manifestação. Tente novamente.')
      setSubmitting(false)
    }
  }

  return (
    <div className="form-card animate-fade">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="title">Título *</label>
          <input
            type="text"
            className="form-control"
            id="title"
            placeholder="Descreva brevemente o assunto"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={300}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="category">Categoria *</label>
            <select
              className="form-control"
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
              required
            >
              <option value="">Selecione...</option>
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{categoryLabel(c)}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="type">Tipo</label>
            <select className="form-control" id="type" value={type} onChange={(e) => setType(e.target.value as ComplaintType)}>
              {ALL_TYPES.map((t) => (
                <option key={t} value={t}>{typeLabel(t)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="department">Setor Relacionado</label>
            <input
              type="text"
              className="form-control"
              id="department"
              placeholder="Ex: Financeiro, Operações..."
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="priority">Prioridade</label>
            <select className="form-control" id="priority" value={priority} onChange={(e) => setPriority(e.target.value as ComplaintPriority)}>
              {ALL_PRIORITIES.map((p) => (
                <option key={p} value={p}>{priorityLabel(p)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="description">Descrição Detalhada *</label>
          <textarea
            className="form-control"
            id="description"
            rows={6}
            placeholder="Descreva em detalhes a sua manifestação. Quanto mais informações, melhor poderemos atendê-lo(a)."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-check">
            <input type="checkbox" checked={isConfidential} onChange={(e) => setIsConfidential(e.target.checked)} />
            <span style={{ fontSize: '0.875rem' }}>Marcar como <strong>sigiloso</strong></span>
          </label>
          <div className="form-hint">Manifestações sigilosas limitam a visibilidade dos dados do remetente.</div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="attachments">Anexos (opcional)</label>
          <input
            type="file"
            className="form-control"
            id="attachments"
            multiple
            accept="image/*,.pdf,.doc,.docx"
            style={{ padding: '0.5rem' }}
            onChange={handleFiles}
          />
          <div className="form-hint">
            Até 5 arquivos. Formatos aceitos: imagens, PDF, Word. Use para anexar evidências.
            {files.length > 0 && ` ${files.length} arquivo(s) selecionado(s).`}
          </div>
        </div>

        {error && <div style={{ fontSize: '0.85rem', color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            <Send /> {submitting ? 'Enviando...' : 'Enviar Manifestação'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(toAbs('manifestacoes'))}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}
