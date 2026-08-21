import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { api } from '../lib/api'
import {
  useEmployees, useCreateEmployee, useUpdateEmployee,
  useDeleteEmployee, useRegisterFace,
  useBulkCreateEmployees, type Employee,
} from '../hooks/useEmployees'
import { useSectors } from '../hooks/useSectors'
import {
  usePendingRegistrations, useRejectRegistration, type PendingRegistration,
} from '../hooks/useRegistration'
import EmployeeFormModal from '../components/employees/EmployeeFormModal'
import EmployeeList from '../components/employees/EmployeeList'
import GenerateLinkModal from '../components/employees/GenerateLinkModal'
import ApprovePendingModal from '../components/employees/ApprovePendingModal'
import PendingRegistrations from '../components/employees/PendingRegistrations'
import { EMPTY_FORM, type FormData } from '../components/employees/constants'

type ModalMode = 'create' | 'edit' | null

export default function Employees() {
  const { data: employees = [], isLoading } = useEmployees()
  const createMutation      = useCreateEmployee()
  const updateMutation      = useUpdateEmployee()
  const deleteMutation      = useDeleteEmployee()
  const faceMutation        = useRegisterFace()
  const bulkMutation        = useBulkCreateEmployees()
  const { data: sectors = [] } = useSectors()

  const [modalMode,   setModalMode]   = useState<ModalMode>(null)
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [form,        setForm]        = useState<FormData>(EMPTY_FORM)
  const [showCapture, setShowCapture] = useState(false)
  const [faceStatus,  setFaceStatus]  = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [faceError,   setFaceError]   = useState('')
  const [saveError,   setSaveError]   = useState('')
  const [showLinkModal,   setShowLinkModal]   = useState(false)
  const [approvePending,  setApprovePending]  = useState<PendingRegistration | null>(null)

  const { data: pendingList = [] } = usePendingRegistrations()
  const rejectMutation = useRejectRegistration()
  const fileRef = useRef<HTMLInputElement>(null)

  // admission_date vazio ('') não é uma data válida para o backend — precisa virar undefined
  function employeePayload() {
    return { ...form, admission_date: form.admission_date || undefined }
  }

  // mapa setor por id para mostrar badge na listagem
  const sectorMap = Object.fromEntries(sectors.map(s => [s.id, s]))

  function openCreate() {
    setForm(EMPTY_FORM); setEditingId(null)
    setShowCapture(false); setFaceStatus('idle'); setSaveError('')
    setModalMode('create')
  }

  function openEdit(emp: Employee) {
    setForm({ name: emp.name, email: emp.email, phone: emp.phone ?? '',
              position: emp.position ?? '', role: emp.role ?? 'colaborador',
              is_external: emp.is_external,
              admission_date: emp.admission_date ?? '' })
    setEditingId(emp.id)
    setShowCapture(false); setFaceStatus('idle'); setSaveError('')
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null); setEditingId(null)
    setShowCapture(false); setFaceStatus('idle')
    setFaceError(''); setSaveError('')
  }

  async function handleSaveOnly() {
    setSaveError('')
    try {
      const emp = await createMutation.mutateAsync({ ...employeePayload(), weekly_hours: 0 })
      setEditingId(emp.id)
      closeModal()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveError('')
    try {
      if (modalMode === 'create') {
        const emp = await createMutation.mutateAsync({ ...employeePayload(), weekly_hours: 0 })
        setEditingId(emp.id)
        setModalMode('edit')
        setFaceStatus('idle')
      } else if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, ...employeePayload(), weekly_hours: 0 })
        closeModal()
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.')
    }
  }

  async function handleFaceComplete(photos: string[]) {
    if (!editingId) return
    setShowCapture(false); setFaceStatus('saving'); setFaceError('')
    try {
      await faceMutation.mutateAsync({ id: editingId, images_base64: photos })
      setFaceStatus('ok')
    } catch (e) {
      setFaceStatus('error')
      setFaceError(e instanceof Error ? e.message : 'Erro ao salvar biometria')
    }
  }

  function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws)
        const parsed = rows.map((r, i) => ({
          row: i + 2,
          name:     String(r['Nome'] || r['name'] || '').trim(),
          email:    String(r['Email'] || r['email'] || r['E-mail'] || '').trim(),
          phone:    String(r['Telefone'] || r['phone'] || r['WhatsApp'] || '').trim() || undefined,
          position: String(r['Cargo'] || r['position'] || '').trim() || undefined,
          role:     String(r['Nível'] || r['role'] || 'colaborador').trim().toLowerCase(),
        }))
        const invalid = parsed.filter(e => !e.name || !e.email)
        const emps    = parsed.filter(e => e.name && e.email)
        if (!emps.length) { alert('Nenhum funcionário válido. Verifique colunas: Nome, Email, Telefone, Cargo'); return }
        try {
          await bulkMutation.mutateAsync(emps)
          const msg = [`${emps.length} funcionário(s) importado(s) com sucesso!`]
          if (invalid.length) msg.push(`${invalid.length} linha(s) ignorada(s) por falta de Nome ou E-mail: linhas ${invalid.map(e => e.row).join(', ')}.`)
          alert(msg.join('\n'))
        } catch (err) {
          alert(`Erro ao importar: ${err instanceof Error ? err.message : 'Tente novamente.'}`)
        }
      } catch {
        alert('Erro ao ler o arquivo. Verifique se é um Excel ou CSV válido.')
      }
      if (fileRef.current) fileRef.current.value = ''
    }
    reader.readAsBinaryString(file)
  }

  const saving = createMutation.isPending || updateMutation.isPending
  const activeEmployees = employees.filter(e => e.is_active)

  async function generateBiometricLink(employeeId: string) {
    try {
      const data = await api.post<{ token: string; employee_name: string }>('/api/v1/registration/biometric-link', { employee_id: employeeId })
      const url = `${window.location.origin}/biometria/${data.token}`
      await navigator.clipboard.writeText(url)
      alert(`Link copiado!\nVálido por 10 minutos — uso único.\n\n${url}`)
    } catch (e) {
      alert(`Erro ao gerar link: ${e instanceof Error ? e.message : 'Tente novamente'}`)
    }
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Funcionários</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
            onChange={handleExcelImport} />
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}
            disabled={bulkMutation.isPending} style={{ fontSize: 13 }}>
            {bulkMutation.isPending ? 'Importando...' : '⬆ Importar Excel'}
          </button>
          <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => setShowLinkModal(true)}>
            🔗 Gerar link de cadastro
          </button>
          <button className="btn-primary" onClick={openCreate}>+ Novo funcionário</button>
        </div>
      </div>

      {/* ── Cadastros pendentes ───────────────────────────────────────────── */}
      <PendingRegistrations
        pendingList={pendingList}
        onApprove={setApprovePending}
        onReject={id => rejectMutation.mutate(id)}
      />

      <EmployeeList
        employees={activeEmployees}
        sectors={sectors}
        sectorMap={sectorMap}
        isLoading={isLoading}
        onEdit={openEdit}
        onDelete={id => deleteMutation.mutate(id)}
        onGenerateBiometricLink={generateBiometricLink}
      />

      {/* ── Modal Funcionário ────────────────────────────────────────────── */}
      <EmployeeFormModal
        modalMode={modalMode}
        editingId={editingId}
        form={form}
        onChangeForm={patch => setForm(f => ({ ...f, ...patch }))}
        showCapture={showCapture}
        onShowCapture={() => { setShowCapture(true); setFaceStatus('idle') }}
        faceStatus={faceStatus}
        faceError={faceError}
        saveError={saveError}
        saving={saving}
        onSubmit={handleSubmit}
        onSaveOnly={handleSaveOnly}
        onClose={closeModal}
        onFaceComplete={handleFaceComplete}
        onCancelCapture={() => setShowCapture(false)}
      />

      {showLinkModal && <GenerateLinkModal onClose={() => setShowLinkModal(false)} />}
      {approvePending && (
        <ApprovePendingModal
          pending={approvePending}
          sectors={sectors}
          onClose={() => setApprovePending(null)}
        />
      )}
    </div>
  )
}
