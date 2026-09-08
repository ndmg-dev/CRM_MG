import { useState } from 'react'
import type { Employee } from '../hooks/useEmployees'
import Avatar from './Avatar'

interface Props {
  employees: Employee[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}

/** Seletor de colaboradores em dois quadros — todos à esquerda, selecionados
 * à direita, com botões de transferência no meio ("Selecionar todos" e
 * "Selecionar marcados"). Usado no modal de correção de ponto em lote.
 * Portado do Cronos (commits e4b6128 + 05ecaf7 + 2025a4e). */
export default function EmployeeTransferPicker({ employees, selected, onChange }: Props) {
  const [search, setSearch] = useState('')
  // Marcados no quadro da esquerda, aguardando transferência — distinto de
  // `selected` (que já foi transferido pro quadro da direita).
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const active = employees.filter((e) => e.is_active)
  const available = active
    .filter((e) => !selected.has(e.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const filtered = search
    ? available.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    : available
  const selectedEmployees = active
    .filter((e) => selected.has(e.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  function toggleChecked(id: string) {
    const next = new Set(checked)
    next.has(id) ? next.delete(id) : next.add(id)
    setChecked(next)
  }

  function selectAll() {
    onChange(new Set(active.map((e) => e.id)))
    setChecked(new Set())
  }

  function selectChecked() {
    if (checked.size === 0) return
    onChange(new Set([...selected, ...checked]))
    setChecked(new Set())
  }

  function remove(id: string) {
    const next = new Set(selected)
    next.delete(id)
    onChange(next)
  }

  function returnAll() {
    onChange(new Set())
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'stretch' }}>
      {/* Quadro esquerdo — todos os colaboradores */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginBottom: 6 }}>
          Colaboradores ({available.length})
        </div>
        <input
          className="form-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          style={{ marginBottom: 8, fontSize: 12 }}
        />
        <div style={{ height: 260, overflowY: 'auto', border: 'var(--mg-border)', borderRadius: 'var(--radius-md)' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '14px 12px', fontSize: 12, color: 'var(--mg-muted)', textAlign: 'center' }}>
              {available.length === 0 ? 'Todos já foram selecionados' : 'Nenhum colaborador encontrado'}
            </div>
          )}
          {filtered.map((emp) => (
            <label key={emp.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', cursor: 'pointer', borderBottom: 'var(--mg-border)',
              background: checked.has(emp.id) ? 'rgba(212,168,67,0.08)' : 'transparent',
            }}>
              <input type="checkbox" checked={checked.has(emp.id)} onChange={() => toggleChecked(emp.id)} />
              <Avatar name={emp.name} size={24} />
              <div style={{ fontSize: 12, color: '#fff' }}>{emp.name}</div>
            </label>
          ))}
        </div>
      </div>

      {/* Botões de transferência */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, minWidth: 140 }}>
        <button type="button" className="btn-ghost" style={{ fontSize: 11, whiteSpace: 'nowrap' }}
          onClick={selectAll} disabled={available.length === 0}>
          Selecionar todos →
        </button>
        <button type="button" className="btn-ghost" style={{ fontSize: 11, whiteSpace: 'nowrap' }}
          onClick={selectChecked} disabled={checked.size === 0}>
          Selecionar marcados{checked.size > 0 ? ` (${checked.size})` : ''} →
        </button>
        <div style={{ height: 1, background: 'var(--mg-border)', margin: '4px 0' }} />
        <button type="button" className="btn-ghost" style={{ fontSize: 11, whiteSpace: 'nowrap' }}
          onClick={returnAll} disabled={selectedEmployees.length === 0}>
          ← Devolver todos
        </button>
      </div>

      {/* Quadro direito — selecionados */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginBottom: 6 }}>
          Selecionados ({selectedEmployees.length})
        </div>
        <div style={{ height: 260, overflowY: 'auto', border: 'var(--mg-border)', borderRadius: 'var(--radius-md)', marginTop: 30 }}>
          {selectedEmployees.length === 0 && (
            <div style={{ padding: '14px 12px', fontSize: 12, color: 'var(--mg-muted)', textAlign: 'center' }}>
              Nenhum colaborador selecionado
            </div>
          )}
          {selectedEmployees.map((emp) => (
            <div key={emp.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderBottom: 'var(--mg-border)',
            }}>
              <Avatar name={emp.name} size={24} />
              <div style={{ fontSize: 12, color: '#fff', flex: 1 }}>{emp.name}</div>
              <button type="button" onClick={() => remove(emp.id)}
                title="Remover"
                style={{ fontSize: 13, color: 'var(--mg-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
