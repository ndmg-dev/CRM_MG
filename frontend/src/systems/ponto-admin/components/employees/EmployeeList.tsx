import { useState } from 'react'
import type { Employee } from '../../hooks/useEmployees'
import type { Sector } from '../../hooks/useSectors'
import Avatar from '../Avatar'
import Badge from '../Badge'
import ColorDot from '../ColorDot'
import { ROLES } from './constants'

type SortBy = 'name' | 'sector' | 'role' | 'bio'
const PAGE_SIZE = 20

// Fora do componente (não redefinida a cada render): definir um componente
// dentro do corpo de outro faz a identidade da função mudar a cada render,
// e o React desmonta/remonta a subárvore inteira em vez de só atualizá-la.
function SortArrow({ col, sortBy, sortDir }: { col: SortBy; sortBy: SortBy; sortDir: 'asc' | 'desc' }) {
  if (sortBy !== col) return <span style={{ color: 'rgba(255,255,255,0.2)', marginLeft: 4 }}>⇅</span>
  return <span style={{ color: 'var(--mg-gold)', marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
}

interface EmployeeListProps {
  employees: Employee[]
  sectors: Sector[]
  sectorMap: Record<string, Sector>
  isLoading: boolean
  onEdit: (emp: Employee) => void
  onDelete: (id: string) => void
  onGenerateBiometricLink: (id: string) => void
}

export default function EmployeeList({
  employees, sectors, sectorMap, isLoading, onEdit, onDelete, onGenerateBiometricLink,
}: EmployeeListProps) {
  const [search,       setSearch]       = useState('')
  const [filterSector, setFilterSector] = useState('')
  const [filterBio,    setFilterBio]    = useState<'all' | 'ok' | 'pending'>('all')
  const [sortBy,        setSortBy]      = useState<SortBy>('name')
  const [sortDir,       setSortDir]     = useState<'asc' | 'desc'>('asc')
  const [page,          setPage]        = useState(1)

  const filteredEmployees = employees
    .filter(e => {
      if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false
      if (filterSector && e.sector_id !== filterSector) return false
      if (filterBio === 'ok'      && e.face_photos_count === 0) return false
      if (filterBio === 'pending' && e.face_photos_count > 0)  return false
      return true
    })
    .sort((a, b) => {
      let va = '', vb = ''
      if (sortBy === 'name')   { va = a.name;                              vb = b.name }
      if (sortBy === 'sector') { va = sectorMap[a.sector_id ?? '']?.name ?? ''; vb = sectorMap[b.sector_id ?? '']?.name ?? '' }
      if (sortBy === 'role')   { va = a.role;                              vb = b.role }
      if (sortBy === 'bio')    { va = String(a.face_photos_count);         vb = String(b.face_photos_count) }
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })

  const totalPages     = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE))
  const pagedEmployees = filteredEmployees.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function toggleSort(col: SortBy) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
    setPage(1)
  }

  return (
    <>
      {/* ── Barra de busca e filtros ─────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="form-input"
          placeholder="🔍 Buscar por nome..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: '1 1 200px', minWidth: 180 }}
        />
        <select className="form-input" style={{ flex: '0 0 auto', fontSize: 12 }}
          value={filterSector} onChange={e => { setFilterSector(e.target.value); setPage(1) }}>
          <option value="">Todos os setores</option>
          {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="form-input" style={{ flex: '0 0 auto', fontSize: 12 }}
          value={filterBio} onChange={e => { setFilterBio(e.target.value as typeof filterBio); setPage(1) }}>
          <option value="all">Biometria: todas</option>
          <option value="ok">Biometria: OK</option>
          <option value="pending">Biometria: Pendente</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--mg-muted)', whiteSpace: 'nowrap' }}>
          {filteredEmployees.length} funcionário{filteredEmployees.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>
                Nome <SortArrow col="name" sortBy={sortBy} sortDir={sortDir} />
              </th>
              <th>Cargo</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('sector')}>
                Setor <SortArrow col="sector" sortBy={sortBy} sortDir={sortDir} />
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('role')}>
                Nível <SortArrow col="role" sortBy={sortBy} sortDir={sortDir} />
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('bio')}>
                Biometria <SortArrow col="bio" sortBy={sortBy} sortDir={sortDir} />
              </th>
              <th>Externo</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} style={{ color: 'var(--mg-muted)', textAlign: 'center', padding: 24 }}>Carregando...</td></tr>
            )}
            {pagedEmployees.map(emp => {
              const sec = emp.sector_id ? sectorMap[emp.sector_id] : null
              return (
                <tr key={emp.id}>
                  <td>
                    <div className="employee-cell">
                      <Avatar name={emp.name} />
                      <div>
                        <div>{emp.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--mg-muted)' }}>{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--mg-muted)' }}>{emp.position || '—'}</td>
                  <td>
                    {sec ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontSize: 11, padding: '3px 8px', borderRadius: 4,
                        background: sec.color + '22', color: sec.color, fontWeight: 600,
                      }}>
                        <ColorDot color={sec.color} size={8} />{sec.name}
                      </span>
                    ) : <span style={{ color: 'var(--mg-muted)', fontSize: 12 }}>—</span>}
                  </td>
                  <td><Badge variant="neutral">{ROLES.find(r => r.value === emp.role)?.label ?? emp.role}</Badge></td>
                  <td>
                    <Badge variant={emp.face_photos_count > 0 ? 'ok' : 'warn'}>
                      {emp.face_photos_count > 0 ? `OK (${emp.face_photos_count} fotos)` : 'Pendente'}
                    </Badge>
                  </td>
                  <td>
                    {emp.is_external
                      ? <Badge variant="warn">Externo</Badge>
                      : <span style={{ color: 'var(--mg-muted)', fontSize: 12 }}>—</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => onEdit(emp)}>Editar</button>
                      {emp.face_photos_count === 0 && (
                        <button className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }}
                          onClick={() => onGenerateBiometricLink(emp.id)}>
                          📷 Biometria
                        </button>
                      )}
                      <button className="btn-danger" style={{ padding: '4px 12px', fontSize: 12 }}
                        onClick={() => { if (confirm(`Excluir ${emp.name}?`)) onDelete(emp.id) }}>
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!isLoading && filteredEmployees.length === 0 && (
              <tr><td colSpan={7} style={{ color: 'var(--mg-muted)', textAlign: 'center', padding: 24 }}>
                {search || filterSector || filterBio !== 'all' ? 'Nenhum funcionário encontrado com esses filtros' : 'Nenhum funcionário cadastrado'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14 }}>
          <button className="btn-ghost" style={{ padding: '5px 14px', fontSize: 13 }}
            disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              style={{
                padding: '5px 12px', fontSize: 13, border: 'none', borderRadius: 6, cursor: 'pointer',
                background: p === page ? 'var(--mg-gold)' : 'rgba(255,255,255,0.07)',
                color: p === page ? '#000' : 'var(--mg-muted)',
                fontWeight: p === page ? 700 : 400,
              }}>
              {p}
            </button>
          ))}
          <button className="btn-ghost" style={{ padding: '5px 14px', fontSize: 13 }}
            disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
        </div>
      )}
    </>
  )
}
