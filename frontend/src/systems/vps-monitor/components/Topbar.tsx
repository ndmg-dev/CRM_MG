import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, LineChart, Network, Camera, ScrollText } from 'lucide-react'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'

// Portalizado pro Header do CRM (#system-menu-slot), mesmo padrão do
// ContAI/Analytics DP. Cores em hex direto — este nó vive fora da árvore
// de .vps-monitor-root, então var(--vm-*) não chegaria aqui.
const LINKS = [
  { to: '.', label: 'Visão Geral', icon: LayoutDashboard, end: true },
  { to: 'historico', label: 'Histórico', icon: LineChart, end: false },
  { to: 'rede', label: 'Rede & Firewall', icon: Network, end: false },
  { to: 'backups', label: 'Snapshots & Backups', icon: Camera, end: false },
  { to: 'acoes', label: 'Ações & Auditoria', icon: ScrollText, end: false },
]

export function Topbar() {
  const toAbs = useNativeSystemPath()
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalTarget(document.getElementById('system-menu-slot'))
  }, [])

  if (!portalTarget) return null

  return createPortal(
    <nav aria-label="Navegação do Monitoramento da VPS" className="flex w-full items-center gap-1 overflow-x-auto">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={toAbs(link.to)}
          end={link.end}
          className={({ isActive }) =>
            `flex items-center gap-2 rounded-md px-3 h-9 text-sm whitespace-nowrap shrink-0 transition-colors ${
              isActive
                ? 'text-[#d4a843] bg-[#1c1c25] font-medium'
                : 'text-gray-400 hover:text-white hover:bg-[#1c1c25]'
            }`
          }
        >
          <link.icon size={16} />
          {link.label}
        </NavLink>
      ))}
    </nav>,
    portalTarget,
  )
}
