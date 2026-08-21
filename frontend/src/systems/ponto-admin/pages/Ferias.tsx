import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Modal } from '../components/Modal'
import { useEmployees } from '../hooks/useEmployees'
import { useAuth } from '../hooks/useAuth'

/**
 * Página de Férias — visual seguindo o Design System MG (ESPECIFICACOES_MG):
 * tokens de cor/raio/tipografia, Badge (raio xl + borda 0.5px + tints de status),
 * filtro no padrão Tabs (sublinhado dourado) e tipografia dos tokens.
 * Implementado nativamente (sem a toolchain Vanilla Extract) para não puxar a
 * migração completa do DS — ver PASSO_A_PASSO_IMPLEMENTACAO.md.
 */

// ─── Tokens (espelham tokens.json do @mg/tokens) ──────────────────────────────
const T = {
  gold: '#d4a843',
  status: { success: '#22c55e', warning: '#f59e0b', error: '#ef4444' },
  radius: { md: 8, xl: 16 },
}

interface FeriasRow {
  id: string
  colaborador_id: string
  employee_name: string
  data_inicio: string
  data_fim: string
  dias_corridos: number
  horas_creditadas: number
  status: 'agendada' | 'em_andamento' | 'concluida' | 'cancelada'
  vigente: boolean
  origem: string
}

interface FeriasCreate {
  colaborador_id: string
  data_inicio: string
  data_fim: string
}

type BadgeVariant = 'ok' | 'warn' | 'err' | 'neutral'

const STATUS_META: Record<FeriasRow['status'], { variant: BadgeVariant; label: string }> = {
  agendada:     { variant: 'warn',    label: 'Agendada' },
  em_andamento: { variant: 'ok',      label: 'Em andamento' },
  concluida:    { variant: 'neutral', label: 'Concluída' },
  cancelada:    { variant: 'err',     label: 'Cancelada' },
}

// Badge conforme Badge.css.ts do DS: h22, pad 0 8, fs 11, weight 600, radius xl,
// borda 0.5px e os tints exatos por variante.
const BADGE_TINT: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  ok:      { bg: 'rgba(34, 197, 94, 0.10)',  color: T.status.success, border: 'rgba(34, 197, 94, 0.28)' },
  warn:    { bg: 'rgba(245, 158, 11, 0.10)', color: T.status.warning, border: 'rgba(245, 158, 11, 0.28)' },
  err:     { bg: 'rgba(239, 68, 68, 0.10)',  color: T.status.error,   border: 'rgba(239, 68, 68, 0.28)' },
  neutral: { bg: 'var(--mg-bg2)',            color: 'var(--mg-muted)', border: 'var(--mg-border-color, #262626)' },
}

function DsBadge({ variant, children }: { variant: BadgeVariant; children: React.ReactNode }) {
  const t = BADGE_TINT[variant]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, height: 22,
      padding: '0 8px', fontSize: 11, fontWeight: 600, borderRadius: T.radius.xl,
      border: `0.5px solid ${t.border}`, background: t.bg, color: t.color, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

const FILTERS: { key: string; label: string }[] = [
  { key: '',             label: 'Todas' },
  { key: 'em_andamento', label: 'Em andamento' },
  { key: 'agendada',     label: 'Agendadas' },
  { key: 'concluida',    label: 'Concluídas' },
  { key: 'cancelada',    label: 'Canceladas' },
]

function fmtDate(iso: string) {
  return `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

export default function Ferias() {
  const [status, setStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<FeriasCreate>({ colaborador_id: '', data_inicio: '', data_fim: '' })
  const [formError, setFormError] = useState('')
  const qc = useQueryClient()
  const { data: employees = [] } = useEmployees()
  const { can } = useAuth()
  const canCreate = can('ferias_create')

  const { data, isLoading } = useQuery<FeriasRow[]>({
    queryKey: ['ferias', status],
    queryFn: () => api.get(`/api/v1/ferias${status ? `?status=${status}` : ''}`),
  })
  const createMutation = useMutation({
    mutationFn: (payload: FeriasCreate) => api.post<FeriasRow>('/api/v1/ferias', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ferias'] })
      setShowCreate(false)
      setForm({ colaborador_id: '', data_inicio: '', data_fim: '' })
    },
    onError: (error: Error) => setFormError(error.message),
  })
  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/ferias/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ferias'] }),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/ferias/${id}/permanente`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ferias'] }),
  })

  const rows = data ?? []
  const vigentes = rows.filter(r => r.vigente).length

  function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (form.data_fim < form.data_inicio) {
      setFormError('A data final deve ser igual ou posterior à inicial.')
      return
    }
    createMutation.mutate(form)
  }

  function cancel(row: FeriasRow) {
    if (window.confirm(`Cancelar as férias de ${row.employee_name}?`)) {
      cancelMutation.mutate(row.id)
    }
  }

  function remove(row: FeriasRow) {
    if (window.confirm(`Apagar definitivamente este registro de férias de ${row.employee_name}? Esta ação não pode ser desfeita.`)) {
      deleteMutation.mutate(row.id)
    }
  }

  return (
    <div className="dashboard-page animate-in">
      {/* Cabeçalho — tipografia dos tokens (3xl / secondary) */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--mg-white)', letterSpacing: '-0.01em' }}>Férias</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {vigentes > 0 && <DsBadge variant="ok">{vigentes} em férias hoje</DsBadge>}
          {canCreate && (
            <button className="btn-primary" onClick={() => { setFormError(''); setShowCreate(true) }}>
              Adicionar férias
            </button>
          )}
        </div>
      </div>
      <p style={{ color: 'var(--mg-muted)', fontSize: 13, marginTop: 4, marginBottom: 20 }}>
        Períodos cadastrados no Cronos e recebidos pela integração com o sistema de Férias.
      </p>

      {/* Filtro de status no padrão Tabs (Tabs.css.ts): lista com borda inferior,
          trigger com sublinhado dourado no ativo. */}
      <div style={{ display: 'flex', gap: 16, borderBottom: '0.5px solid var(--mg-border-color, #262626)', marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTERS.map(f => {
          const active = status === f.key
          return (
            <button
              key={f.key}
              onClick={() => setStatus(f.key)}
              style={{
                padding: '8px 0', fontSize: 13, fontWeight: 500, background: 'transparent',
                border: 'none', borderBottom: `2px solid ${active ? T.gold : 'transparent'}`,
                color: active ? 'var(--mg-white)' : 'var(--mg-muted)', cursor: 'pointer',
                marginBottom: -1, transition: 'color 120ms ease, border-color 120ms ease',
              }}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--mg-muted)', textAlign: 'center', padding: 32, fontSize: 13 }}>Carregando…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: 'var(--mg-muted)', textAlign: 'center', padding: 32, fontSize: 13 }}>
          Nenhum período de férias {status ? 'com esse status' : 'registrado'}.
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Início</th>
              <th>Fim</th>
              <th style={{ textAlign: 'center' }}>Dias</th>
              <th style={{ textAlign: 'center' }}>Horas creditadas</th>
              <th>Origem</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={r.vigente ? { background: 'rgba(212, 168, 67, 0.06)' } : undefined}>
                <td style={{ color: 'var(--mg-white)', fontWeight: 500 }}>
                  {r.employee_name}
                  {r.vigente && <span style={{ marginLeft: 8 }}><DsBadge variant="ok">Hoje</DsBadge></span>}
                </td>
                <td>{fmtDate(r.data_inicio)}</td>
                <td>{fmtDate(r.data_fim)}</td>
                <td style={{ textAlign: 'center' }}>{r.dias_corridos}</td>
                <td style={{ textAlign: 'center', color: T.status.success, fontWeight: 600 }}>{r.horas_creditadas.toFixed(1)}h</td>
                <td>{r.origem === 'admin' ? 'Cronos' : 'Integração'}</td>
                <td><DsBadge variant={STATUS_META[r.status].variant}>{STATUS_META[r.status].label}</DsBadge></td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {canCreate && r.origem === 'admin' && r.status !== 'cancelada' && (
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 12 }}
                      onClick={() => cancel(r)}
                      disabled={cancelMutation.isPending}
                    >
                      Cancelar
                    </button>
                  )}
                  {canCreate && (
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 12, color: 'var(--mg-red)', marginLeft: 4 }}
                      onClick={() => remove(r)}
                      disabled={deleteMutation.isPending}
                      title="Apagar definitivamente o registro"
                    >
                      Apagar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Adicionar férias" maxWidth={460}>
        <form onSubmit={submitCreate}>
          <div className="form-group">
            <label className="form-label">Colaborador</label>
            <select
              className="form-input"
              value={form.colaborador_id}
              onChange={e => setForm(f => ({ ...f, colaborador_id: e.target.value }))}
              required
              autoFocus
            >
              <option value="">Selecione…</option>
              {employees.filter(e => e.is_active).map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Data inicial</label>
              <input
                className="form-input"
                type="date"
                value={form.data_inicio}
                onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Data final</label>
              <input
                className="form-input"
                type="date"
                min={form.data_inicio || undefined}
                value={form.data_fim}
                onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))}
                required
              />
            </div>
          </div>
          {formError && <div style={{ color: 'var(--mg-red)', fontSize: 12, marginBottom: 10 }}>{formError}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Salvando…' : 'Salvar férias'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
