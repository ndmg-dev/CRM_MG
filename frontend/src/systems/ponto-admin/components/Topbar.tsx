import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth, type Permission } from '../hooks/useAuth'
import { usePontoPath } from '../hooks/usePontoBase'
import { Modal } from './Modal'
import {
  Home,
  Users,
  BarChart3,
  FileText,
  Sun,
  Menu,
  X,
  ChevronDown,
  Shield,
  Calendar,
  Hourglass,
  Pencil,
  UserCog,
  Settings,
  Key,
  LogOut,
} from 'lucide-react'

// O Topbar fica montado o tempo todo (portalizado no Header do CRM),
// independente de qual página do sistema está ativa. Os `to` abaixo são
// sufixos relativos à base ("/sistemas/:id") — resolvidos manualmente com
// usePontoBase() em vez de navegação relativa do React Router, que não se
// comporta como um <a href> nessa versão (ver hooks/usePontoBase.ts).
const directItems: { to: string; label: string; icon: typeof Home; end?: boolean; permission: Permission }[] = [
  { to: '.', label: 'Dashboard', icon: Home, end: true, permission: 'dashboard' },
  { to: 'employees', label: 'Funcionários', icon: Users, permission: 'employees' },
  { to: 'reports', label: 'Relatórios', icon: BarChart3, permission: 'reports' },
]

const managementItems: { to: string; label: string; icon: typeof Home; permission: Permission }[] = [
  { to: 'espelho', label: 'Espelho de ponto', icon: Hourglass, permission: 'reports' },
  { to: 'justifications', label: 'Justificativas', icon: FileText, permission: 'justifications' },
  { to: 'corrections', label: 'Correções de ponto', icon: Pencil, permission: 'corrections' },
  { to: 'calendar', label: 'Calendário', icon: Calendar, permission: 'calendar' },
  { to: 'audit', label: 'Audit Log', icon: Shield, permission: 'audit' },
  { to: 'ferias', label: 'Férias', icon: Sun, permission: 'reports' },
]

export function Topbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const { isAdmin, can } = useAuth()
  const toAbs = usePontoPath()

  const [openDropdown, setOpenDropdown] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showPassModal, setShowPassModal] = useState(false)
  const [passForm, setPassForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [passError, setPassError] = useState('')
  const [passOk, setPassOk] = useState(false)
  const navRef = useRef<HTMLElement>(null)

  // Portaliza pra dentro do Header do CRM (uma barra só, não duas empilhadas).
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setPortalTarget(document.getElementById('system-menu-slot'))
  }, [])

  useEffect(() => {
    setOpenDropdown(false)
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpenDropdown(false); setMobileOpen(false) }
    }
    function onPointerDown(e: PointerEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenDropdown(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  const changePwMutation = useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      api.post('/api/v1/auth/change-password', data),
    onSuccess: () => {
      setPassOk(true)
      setTimeout(() => { setShowPassModal(false); setPassOk(false); setPassForm({ current_password: '', new_password: '', confirm: '' }) }, 1500)
    },
    onError: (e: Error) => setPassError(e.message),
  })

  function handleLogout() {
    localStorage.removeItem('mg_token')
    qc.clear()
    navigate(toAbs('login'))
  }

  async function handleChangePass(e: React.FormEvent) {
    e.preventDefault()
    setPassError('')
    if (passForm.new_password !== passForm.confirm) {
      setPassError('As senhas não coincidem')
      return
    }
    if (passForm.new_password.length < 6) {
      setPassError('Senha precisa ter ao menos 6 caracteres')
      return
    }
    changePwMutation.mutate({ current_password: passForm.current_password, new_password: passForm.new_password })
  }

  const visibleDirect = directItems.filter((i) => can(i.permission))
  const visibleManagement = managementItems.filter((i) => can(i.permission))
  const managementActive = visibleManagement.some((i) => location.pathname.includes(`/${i.to}`))

  const itemClasses = (active: boolean) =>
    `flex items-center gap-2 rounded-md px-3 h-9 text-sm whitespace-nowrap shrink-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${
      active ? 'text-gold bg-[#1a1a1a] font-medium' : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
    }`

  if (!portalTarget) return null

  return createPortal(
    <nav ref={navRef} aria-label="Navegação do Ponto Admin" className="relative flex w-full items-center gap-1">
      <button
        type="button"
        className="lg:hidden flex items-center justify-center h-9 w-9 shrink-0 rounded-md text-gray-400 hover:bg-[#1a1a1a]"
        aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((v) => !v)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <div className="flex w-full items-center justify-between gap-1">
        <div className="hidden lg:flex items-center justify-center gap-1 min-w-0 flex-1">
          {visibleDirect.map((item) => (
            <NavLink
              key={item.to}
              to={toAbs(item.to)}
              end={item.end}
              className={({ isActive }) => itemClasses(isActive)}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}

          {visibleManagement.length > 0 && (
            <div className="relative">
              <button
                type="button"
                className={itemClasses(managementActive)}
                aria-haspopup="true"
                aria-expanded={openDropdown}
                onClick={() => setOpenDropdown((v) => !v)}
              >
                <Shield className="h-4 w-4" />
                Gestão
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {/* A Header do CRM (sticky, z-20) cria seu próprio contexto de
                  empilhamento — este dropdown, portalizado dentro dela, só
                  compete de verdade com o z-index da Header quando algo FORA
                  dela (uma página do Ponto Admin) também declara z-index
                  próprio. Por isso todo z-index usado dentro das páginas do
                  Ponto Admin tem que ficar bem abaixo de 20 (ver comentário
                  em ReportFilters.tsx) — não adianta só subir o valor aqui:
                  a comparação real acontece um nível acima, entre a Header
                  inteira e esse elemento da página. */}
              {openDropdown && (
                <div className="absolute left-0 top-full mt-1 min-w-[220px] rounded-md border border-[#262626] bg-[#0a0a0a] shadow-xl py-1 z-[100]">
                  {visibleManagement.map((item) => (
                    <NavLink
                      key={item.to}
                      to={toAbs(item.to)}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-3 h-9 text-sm whitespace-nowrap ${
                          isActive ? 'text-gold bg-[#1a1a1a]' : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
                        }`
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-1 shrink-0">
          {isAdmin && (
            <NavLink
              to={toAbs('users')}
              className={({ isActive }) => itemClasses(isActive)}
              title="Usuários"
            >
              <UserCog className="h-4 w-4" />
              <span className="hidden xl:inline">Usuários</span>
            </NavLink>
          )}
          <button
            type="button"
            className="hidden lg:flex items-center justify-center h-9 w-9 rounded-md text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
            onClick={() => navigate(toAbs('settings'))}
            aria-label="Configurações"
            title="Configurações"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="hidden lg:flex items-center justify-center h-9 w-9 rounded-md text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
            onClick={() => setShowPassModal(true)}
            aria-label="Alterar senha"
            title="Alterar senha"
          >
            <Key className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="hidden lg:flex items-center justify-center h-9 w-9 rounded-md text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
            onClick={handleLogout}
            aria-label="Sair do Ponto Admin"
            title="Sair do Ponto Admin"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden absolute left-0 right-0 top-full mt-1 rounded-lg border border-[#262626] bg-[#0a0a0a] shadow-xl px-2 py-2 space-y-1 z-[100]">
          {visibleDirect.map((item) => (
            <NavLink
              key={item.to}
              to={toAbs(item.to)}
              end={item.end}
              className={({ isActive }) => `${itemClasses(isActive)} w-full justify-start`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
          {visibleManagement.length > 0 && (
            <>
              <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Gestão</p>
              {visibleManagement.map((item) => (
                <NavLink
                  key={item.to}
                  to={toAbs(item.to)}
                  className={({ isActive }) => `${itemClasses(isActive)} w-full justify-start`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
          {isAdmin && (
            <NavLink to={toAbs('users')} className={({ isActive }) => `${itemClasses(isActive)} w-full justify-start`}>
              <UserCog className="h-4 w-4" />
              Usuários
            </NavLink>
          )}
          <button
            type="button"
            className={`${itemClasses(location.pathname.includes('/settings'))} w-full justify-start`}
            onClick={() => navigate(toAbs('settings'))}
          >
            <Settings className="h-4 w-4" />
            Configurações
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-3 h-9 text-sm text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
            onClick={() => setShowPassModal(true)}
          >
            <Key className="h-4 w-4" />
            Alterar senha
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-3 h-9 text-sm text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Sair do Ponto Admin
          </button>
        </div>
      )}

      <Modal open={showPassModal} onClose={() => setShowPassModal(false)} title="Alterar senha" maxWidth={380}>
        <form onSubmit={handleChangePass}>
          <div className="form-group">
            <label className="form-label">Senha atual</label>
            <input
              className="form-input"
              type="password"
              value={passForm.current_password}
              onChange={(e) => setPassForm((f) => ({ ...f, current_password: e.target.value }))}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Nova senha</label>
            <input
              className="form-input"
              type="password"
              value={passForm.new_password}
              onChange={(e) => setPassForm((f) => ({ ...f, new_password: e.target.value }))}
              required
              minLength={6}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirmar nova senha</label>
            <input
              className="form-input"
              type="password"
              value={passForm.confirm}
              onChange={(e) => setPassForm((f) => ({ ...f, confirm: e.target.value }))}
              required
            />
          </div>
          {passError && <div style={{ fontSize: 12, color: 'var(--mg-red)', marginBottom: 8 }}>{passError}</div>}
          {passOk && <div style={{ fontSize: 12, color: 'var(--mg-green)', marginBottom: 8 }}>Senha alterada com sucesso!</div>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => setShowPassModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={changePwMutation.isPending}>
              {changePwMutation.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>
    </nav>,
    portalTarget
  )
}
