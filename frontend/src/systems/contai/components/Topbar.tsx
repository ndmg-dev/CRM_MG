import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import { Home, RefreshCw, FileText, List, Sliders, Link2, Settings } from 'react-feather'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'

// Portalizado pro Header do CRM, mesmo padrão do FiscalMatch/Ponto Admin/
// Guia DP (ver conciliacao-fiscal/components/Topbar.tsx) — evita empilhar a
// sidebar fixa de 260px do template original do ContAI_PRO como uma segunda
// coluna de navegação ao lado da do CRM.
const navItems = [
  { to: '.', label: 'Dashboard', icon: Home, end: true },
  { to: 'conciliacao', label: 'Conciliação', icon: RefreshCw, end: false },
  { to: 'documentos', label: 'Documentos', icon: FileText, end: false },
  { to: 'plano-contas', label: 'Plano de Contas', icon: List, end: false },
  { to: 'regras', label: 'Regras', icon: Sliders, end: false },
  { to: 'integracoes', label: 'Integrações', icon: Link2, end: false },
  { to: 'configuracoes', label: 'Configurações', icon: Settings, end: false },
]

export function Topbar() {
  const toAbs = useNativeSystemPath()
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalTarget(document.getElementById('system-menu-slot'))
  }, [])

  if (!portalTarget) return null

  return createPortal(
    <nav aria-label="Navegação do ContAI" className="flex w-full items-center gap-1 overflow-x-auto">
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
