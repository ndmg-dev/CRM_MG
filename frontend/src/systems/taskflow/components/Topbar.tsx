import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import { Columns3, BarChart3, ShieldCheck, Building2, ChevronDown } from 'lucide-react'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'
import { useAuth } from '../contexts/AuthContext'
import { useDepartments } from '../contexts/DepartmentContext'

// Portalizado pro Header do CRM, mesmo padrão do ContAI (ver
// contai/components/Topbar.tsx) — a Sidebar fixa de 250px do TASK_MANANGER
// original (logo "Núcleo Digital" + nav + avatar/sair) vira só nav + o
// seletor de "Setor" como pill dourada; avatar/nome/e-mail/sair já existem
// no header global do CRM, não são reimplementados aqui.
const navItems = [
  { to: '.', label: 'Kanban', icon: Columns3, end: true },
  { to: 'dashboard', label: 'Dashboard', icon: BarChart3, end: false },
]

export function Topbar() {
  const toAbs = useNativeSystemPath()
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const { session } = useAuth()
  const { departments, currentId, selectDepartment, loading: loadingDepts } = useDepartments()

  useEffect(() => {
    setPortalTarget(document.getElementById('system-menu-slot'))
  }, [])

  if (!portalTarget) return null

  return createPortal(
    <nav aria-label="Navegação do TaskFlow" className="flex w-full items-center gap-1 overflow-x-auto">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={toAbs(item.to)}
          end={item.end}
          className={({ isActive }) =>
            `flex items-center gap-2 rounded-md px-3 h-9 text-sm whitespace-nowrap shrink-0 transition-colors ${
              isActive ? 'text-gold bg-[#1a1a1a] font-medium' : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
            }`
          }
        >
          <item.icon size={16} />
          {item.label}
        </NavLink>
      ))}

      {session?.dbUser?.role === 'admin' && (
        <NavLink
          to={toAbs('admin')}
          className={({ isActive }) =>
            `flex items-center gap-2 rounded-md px-3 h-9 text-sm whitespace-nowrap shrink-0 transition-colors ${
              isActive ? 'text-red-400 bg-[#1a1a1a] font-medium' : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
            }`
          }
        >
          <ShieldCheck size={16} />
          Admin
        </NavLink>
      )}

      {!loadingDepts && departments.length > 0 && (
        <div className="relative ml-auto shrink-0">
          <Building2
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gold"
          />
          <select
            aria-label="Setor ativo"
            className="h-9 max-w-[220px] appearance-none truncate rounded-full border border-[#2a2a2a] bg-[#1a1a1a] py-0 pl-8 pr-7 text-sm font-medium text-gray-200 transition-colors hover:border-gold/40 hover:text-white focus:border-gold/60 focus:outline-none"
            value={currentId ?? ''}
            onChange={(e) => selectDepartment(e.target.value || null)}
          >
            <option value="" disabled style={{ background: '#1a1a1a', color: '#e5e7eb' }}>
              Selecione o setor…
            </option>
            {departments.map((d: any) => (
              <option key={d.id} value={d.id} style={{ background: '#1a1a1a', color: '#e5e7eb' }}>
                {d.nome}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500"
          />
        </div>
      )}
    </nav>,
    portalTarget,
  )
}
