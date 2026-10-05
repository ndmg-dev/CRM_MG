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
  onStepEmployee?: (direction: number) => void
  selectedSector: string
  onSelectSector: (id: string) => void
}

export default function ReportFilters({
  scope, onChangeScope, employees, sectorMap, sectors, onStepEmployee,
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
  const employeeDetail = selectedEmpObj
    ? `${selectedEmpObj.position || (selectedEmpObj.sector_id ? sectorMap[selectedEmpObj.sector_id]?.name : null) || 'Colaborador'} · Jornada ${Number((selectedEmpObj.weekly_hours / 5).toFixed(1)).toLocaleString('pt-BR')}h`
    : ''

  function pickEmployee(id: string) {
    onPickEmployee(id)
    setDropOpen(false)
    setEmpSearch('')
  }

  return (
    // z-index baixo de propósito: a Header do CRM (sticky, z-20) cria seu
    // próprio contexto de empilhamento, então qualquer z-index >= 20 usado
    // aqui dentro passa a competir com a Header INTEIRA (dropdowns dela
    // incluídos) na raiz do documento — e vence, cobrindo a Header mesmo com
    // menus dela abertos por cima. Ver comentário em Topbar.tsx.
    // zIndex 6 (não 2): irmão direto de `.dashboard-page`, assim como o
    // `.grid-kpi` logo abaixo — que dashboard-dark.css força para z-index 5
    // (ver comentário lá). Sem isto o dropdown de colaborador fica atrás
    // dos cards de métricas.
    <div className="report-v2-scope" style={{ position: 'relative', zIndex: 6 }}>

      {/* Dropdown colaborador */}
      {scope === 'employee' && (
        <div ref={dropRef} className="report-v2-employee">
          <button type="button" className="report-v2-step" aria-label="Colaborador anterior" onClick={() => onStepEmployee?.(-1)}>‹</button>
          <button type="button" className="report-v2-employee-current" aria-expanded={dropOpen} onClick={() => setDropOpen(o => !o)}>
            {selectedEmpObj && <Avatar name={selectedEmpObj.name} size={32} />}
            <span className="report-v2-employee-name">
              <strong>{selectedEmpObj?.name ?? 'Selecionar colaborador'}</strong>
              <small>{employeeDetail}</small>
            </span>
            <span className="report-v2-employee-chevron">{dropOpen ? '▲' : '▼'}</span>
          </button>
          <button type="button" className="report-v2-step" aria-label="Próximo colaborador" onClick={() => onStepEmployee?.(1)}>›</button>

          {dropOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 3,
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
              <div className="report-v2-scope-footer">
                <button type="button" onClick={() => { onChangeScope('sector'); setDropOpen(false) }}>Ver setor inteiro</button>
                <button type="button" onClick={() => { onChangeScope('team'); setDropOpen(false) }}>Ver equipe toda</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Select de setor */}
      {scope === 'sector' && (
        <div className="report-v2-other-scope"><button type="button" onClick={() => onChangeScope('employee')}>‹ Colaborador</button>
        <select className="form-input" style={{ fontSize: 12, padding: '6px 10px', maxWidth: 300 }}
          value={selectedSector} onChange={e => onSelectSector(e.target.value)}>
          <option value="">— Selecione o setor —</option>
          {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select></div>
      )}
      {scope === 'team' && <div className="report-v2-other-scope"><button type="button" onClick={() => onChangeScope('employee')}>‹ Colaborador</button><strong>Equipe toda</strong></div>}
    </div>
  )
}
