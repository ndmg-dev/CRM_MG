import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import { Home, Briefcase, Upload } from 'react-feather'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'

// Portalizado pro Header do CRM — mesmo padrão do Ponto Admin e do Guia DP,
// pra não empilhar uma segunda barra de navegação (a sidebar fixa de 260px
// do design original virava uma segunda coluna ao lado da do CRM).
const navItems = [
  { to: '.', label: 'Dashboard', icon: Home, end: true },
  { to: 'companies', label: 'Empresas', icon: Briefcase, end: false },
  { to: 'companies/new', label: 'Nova Empresa', icon: Upload, end: true },
]

export function Topbar() {
  const toAbs = useNativeSystemPath()
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalTarget(document.getElementById('system-menu-slot'))
  }, [])

  if (!portalTarget) return null

  return createPortal(
    <nav aria-label="Navegação do FiscalMatch" className="flex w-full items-center gap-1">
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
    </nav>,
    portalTarget,
  )
}
