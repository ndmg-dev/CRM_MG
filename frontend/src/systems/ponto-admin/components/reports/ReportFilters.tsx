import { useEffect, useMemo, useRef, useState } from 'react'
import Avatar from '../Avatar'
import { C } from './colors'
import type { Employee } from '../../hooks/useEmployees'
import type { Sector } from '../../hooks/useSectors'

export type ReportScope = 'employee' | 'sector' | 'team'

interface ReportFiltersProps {
  scope: ReportScope
  onChangeScope: (s: ReportScope) => void
  employees: Employee[]
  sectorMap: Record<string, Sector>
  sectors: Sector[]
  selectedEmployee: string
  onPickEmployee: (id: string) => void
  selectedSector: string
  onSelectSector: (id: string) => void
}

export default function ReportFilters({
  scope, onChangeScope, employees, sectorMap, sectors,
  selectedEmployee, onPickEmployee, selectedSector, onSelectSector,
}: ReportFiltersProps) {
  const [dropOpen,  setDropOpen]  = useState(false)
  const [empSearch, setEmpSearch] = useState('')
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropOpen) return
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false)
        setEmpSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropOpen])

  const filteredEmployees = useMemo(() => {
    if (!empSearch) return employees
    const q = empSearch.toLowerCase()
    return employees.filter(e => e.name.toLowerCase().includes(q))
  }, [employees, empSearch])

  const selectedEmpObj = employees.find(e => e.id === selectedEmployee)

  function pickEmployee(id: string) {
    onPickEmployee(id)
    setDropOpen(false)
    setEmpSearch('')
  }

  return (
    <div className="card" style={{ marginBottom: 20, padding: '14px 16px', position: 'relative', zIndex: 30 }}>
      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: 'var(--mg-border)', width: 'fit-content', marginBottom: 14 }}>
        {(['employee', 'sector', 'team'] as const).map(s => (
          <button key={s} onClick={() => onChangeScope(s)}
            style={{
              padding: '6px 18px', fontSize: 12, border: 'none', cursor: 'pointer',
              background: scope === s ? 'var(--mg-gold)' : 'transparent',
              color: scope === s ? '#111' : 'var(--mg-muted)',
              fontWeight: scope === s ? 700 : 400,
              transition: 'all 0.15s',
            }}>
            {s === 'employee' ? 'Colaborador' : s === 'sector' ? 'Setor' : 'Equipe toda'}
          </button>
        ))}
      </div>

      {/* Dropdown colaborador */}
      {scope === 'employee' && (
        <div ref={dropRef} style={{ position: 'relative', maxWidth: 360 }}>
          <button
            onClick={() => setDropOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
              background: 'var(--mg-bg2)', border: 'var(--mg-border)',
              color: '#fff', fontSize: 13,
            }}>
            {selectedEmpObj && <Avatar name={selectedEmpObj.name} size={22} />}
            <span style={{ flex: 1, textAlign: 'left' }}>
              {selectedEmpObj?.name ?? 'Selecionar colaborador'}
            </span>
            <span style={{ color: 'var(--mg-muted)', fontSize: 10 }}>{dropOpen ? '▲' : '▼'}</span>
          </button>

          {dropOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
              background: 'var(--mg-bg3)', border: 'var(--mg-border)', borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              <div style={{ padding: '8px 8px 4px' }}>
                <input
                  autoFocus
                  placeholder="Buscar colaborador..."
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6,
                    background: 'var(--mg-bg2)', border: 'var(--mg-border)',
                    color: '#fff', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {filteredEmployees.length === 0 && (
                  <div style={{ padding: '14px 12px', fontSize: 12, color: 'var(--mg-muted)', textAlign: 'center' }}>
                    Nenhum resultado
                  </div>
                )}
                {filteredEmployees.map(emp => {
                  const sec   = emp.sector_id ? sectorMap[emp.sector_id] : null
                  const isSel = emp.id === selectedEmployee
                  return (
                    <div key={emp.id} onClick={() => pickEmployee(emp.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', cursor: 'pointer',
                        background: isSel ? `${C.worked}18` : 'transparent',
                        borderLeft: `3px solid ${isSel ? C.worked : 'transparent'}`,
                      }}>
                      <Avatar name={emp.name} size={26} />
                      <span style={{ flex: 1, fontSize: 13, color: isSel ? C.worked : '#fff', fontWeight: isSel ? 600 : 400 }}>
                        {emp.name}
                      </span>
                      {sec && (
                        <span style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 4, flexShrink: 0,
                          background: sec.color + '22', color: sec.color, fontWeight: 600,
                        }}>{sec.name}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Select de setor */}
      {scope === 'sector' && (
        <select className="form-input" style={{ fontSize: 12, padding: '6px 10px', maxWidth: 300 }}
          value={selectedSector} onChange={e => onSelectSector(e.target.value)}>
          <option value="">— Selecione o setor —</option>
          {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
    </div>
  )
}
