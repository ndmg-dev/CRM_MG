import { useState } from 'react'
import type { Employee } from '../hooks/useEmployees'
import Avatar from './Avatar'

interface Props {
  employees: Employee[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
  accentColor?: string
}

/** Lista de funcionários com busca + checkbox — mesmo padrão já usado no
 * modal de setores (SectorsTab.tsx), extraído aqui como componente
 * reutilizável para o modal de criação de Grupo. */
export default function MultiEmployeePicker({ employees, selected, onChange, accentColor = 'var(--mg-gold)' }: Props) {
  const [search, setSearch] = useState('')

  const activeEmployees = employees.filter(e => e.is_active)
  const filtered = search
    ? activeEmployees.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : activeEmployees

  function toggle(id: string) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    onChange(next)
  }

  return (
    <div>
      <input
        className="form-input"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar funcionário..."
        style={{ marginBottom: 8 }}
      />
      <div style={{ maxHeight: 240, overflowY: 'auto', border: 'var(--mg-border)', borderRadius: 'var(--radius-md)' }}>
        {filtered.length === 0 && (
          <div style={{ padding: '14px 12px', fontSize: 12, color: 'var(--mg-muted)', textAlign: 'center' }}>
            Nenhum funcionário encontrado
          </div>
        )}
        {filtered.map(emp => (
          <label key={emp.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', cursor: 'pointer', borderBottom: 'var(--mg-border)',
            background: selected.has(emp.id) ? 'rgba(16,185,129,0.08)' : 'transparent',
          }}>
            <input type="checkbox" checked={selected.has(emp.id)}
              onChange={() => toggle(emp.id)} style={{ accentColor }} />
            <Avatar name={emp.name} size={28} />
            <div>
              <div style={{ fontSize: 13, color: '#fff' }}>{emp.name}</div>
              <div style={{ fontSize: 11, color: 'var(--mg-muted)' }}>{emp.position || emp.role}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}
