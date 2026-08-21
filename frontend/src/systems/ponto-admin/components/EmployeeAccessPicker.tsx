import { useState } from 'react'
import { useCreateUserFromEmployee } from '../hooks/useCompanyUsers'
import { ALL_PERMISSIONS, PERMISSION_LABELS, type Permission } from '../hooks/useAuth'
import type { Employee } from '../hooks/useEmployees'

interface CreateAccessPanelProps {
  employee: Employee
  onCreated: (companyUserId: string) => void
}

function CreateAccessPanel({ employee, onCreated }: CreateAccessPanelProps) {
  const [passwordMode, setPasswordMode] = useState<'auto' | 'manual'>('auto')
  const [password, setPassword] = useState('')
  const [permissions, setPermissions] = useState<Permission[]>(['corrections'])
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState('')
  const createMutation = useCreateUserFromEmployee()

  function togglePerm(p: Permission) {
    setPermissions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  async function handleCreate() {
    setErr('')
    if (passwordMode === 'manual' && password.length < 6) {
      setErr('Senha precisa ter ao menos 6 caracteres')
      return
    }
    try {
      const result = await createMutation.mutateAsync({
        employee_id: employee.id,
        password: passwordMode === 'manual' ? password : undefined,
        permissions,
      })
      setCreatedId(result.user.id)
      if (result.generated_password) {
        setGeneratedPassword(result.generated_password)
      } else {
        onCreated(result.user.id)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao criar acesso')
    }
  }

  function copyPassword() {
    if (!generatedPassword) return
    navigator.clipboard.writeText(generatedPassword).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (generatedPassword && createdId) {
    return (
      <div style={{
        marginTop: 8, padding: 12, borderRadius: 8,
        border: '0.5px solid rgba(42,157,92,0.3)', background: 'rgba(42,157,92,0.06)',
      }}>
        <div style={{ fontSize: 12, color: 'var(--mg-green)', marginBottom: 8 }}>
          ✓ Acesso criado para {employee.name}.
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '8px 10px', marginBottom: 8,
        }}>
          <code style={{ flex: 1, fontSize: 13, color: 'var(--mg-white)', fontFamily: 'monospace' }}>
            {generatedPassword}
          </code>
          <button type="button" className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={copyPassword}>
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginBottom: 10 }}>
          Anote e envie ao colaborador agora — esta senha não será mostrada novamente.
        </div>
        <button type="button" className="btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}
          onClick={() => onCreated(createdId)}>
          Continuar
        </button>
      </div>
    )
  }

  return (
    <div style={{
      marginTop: 8, padding: 12, borderRadius: 8,
      border: '0.5px solid rgba(201,150,12,0.3)', background: 'rgba(201,150,12,0.06)',
    }}>
      <div style={{ fontSize: 12, color: 'var(--mg-gold)', marginBottom: 10, lineHeight: 1.5 }}>
        ⚠ {employee.name} ainda não tem acesso à plataforma. Crie um acesso para que possa aprovar correções.
      </div>

      <div style={{ marginBottom: 10 }}>
        <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>Senha</label>
        <div style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--mg-muted)', cursor: 'pointer' }}>
            <input type="radio" checked={passwordMode === 'auto'} onChange={() => setPasswordMode('auto')} />
            Gerar automaticamente
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--mg-muted)', cursor: 'pointer' }}>
            <input type="radio" checked={passwordMode === 'manual'} onChange={() => setPasswordMode('manual')} />
            Definir agora
          </label>
        </div>
        {passwordMode === 'manual' && (
          <input
            className="form-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
          />
        )}
      </div>

      <div style={{ marginBottom: 10 }}>
        <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>Permissões</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {ALL_PERMISSIONS.map(p => (
            <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--mg-muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={permissions.includes(p)} onChange={() => togglePerm(p)} />
              {PERMISSION_LABELS[p]}
            </label>
          ))}
        </div>
      </div>

      {err && <div style={{ fontSize: 12, color: 'var(--mg-red)', marginBottom: 10 }}>{err}</div>}

      <button type="button" className="btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}
        onClick={handleCreate} disabled={createMutation.isPending}>
        {createMutation.isPending ? 'Criando...' : 'Criar acesso'}
      </button>
    </div>
  )
}

interface EmployeeAccessPickerProps {
  label: string
  employees: Employee[]
  links: Record<string, string>  // employee_id -> company_user_id
  value: string | null           // employee_id selecionado
  excludeEmployeeId?: string | null
  onChange: (employeeId: string | null) => void
  onLinkCreated?: (employeeId: string, companyUserId: string) => void
}

export default function EmployeeAccessPicker({
  label, employees, links, value, excludeEmployeeId, onChange, onLinkCreated,
}: EmployeeAccessPickerProps) {
  const selectedEmp = employees.find(e => e.id === value) ?? null
  const hasAccess   = value ? !!links[value] : true

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <select className="form-input" value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}>
        <option value="">— Nenhum —</option>
        {employees.filter(e => e.id !== excludeEmployeeId).map(e => (
          <option key={e.id} value={e.id}>
            {e.name}{!links[e.id] ? ' (sem acesso à plataforma)' : ''}
          </option>
        ))}
      </select>

      {selectedEmp && !hasAccess && (
        <CreateAccessPanel
          employee={selectedEmp}
          onCreated={companyUserId => onLinkCreated?.(selectedEmp.id, companyUserId)}
        />
      )}
    </div>
  )
}
