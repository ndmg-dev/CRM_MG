import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import * as Icons from 'react-feather'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'
// @ts-expect-error — hook em JS sem tipos (migrado do HR-DASH-MG)
import { TABS } from '../hooks/useDashboard'

// Portalizado pro Header do CRM (#system-menu-slot), mesmo padrão do
// Consulta CNPJ / Analytics DP. A <Sidebar> vertical do satélite virou esta
// nav horizontal. Cores em Tailwind/hex direto: este componente é
// portalizado pra fora de .dash-rh-root, então os tokens var(--) escopados
// nela não chegam aqui.
interface Tab {
  id: string
  label: string
  icon: string
  path: string
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 h-9 flex items-center gap-1.5 text-sm whitespace-nowrap shrink-0 transition-colors ${
    isActive ? 'text-ouro bg-[#1a1a1a] font-medium' : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
  }`

export function Topbar() {
  const toAbs = useNativeSystemPath()
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalTarget(document.getElementById('system-menu-slot'))
  }, [])

  if (!portalTarget) return null

  return createPortal(
    <nav aria-label="Navegação do Dash RH" className="flex w-full items-center gap-1 overflow-x-auto">
      {(TABS as Tab[]).map((tab) => {
        const Icon = (Icons as Record<string, React.ComponentType<{ size?: number }>>)[tab.icon]
        return (
          <NavLink key={tab.id} to={toAbs(tab.path)} end={tab.path === '.'} className={linkClass}>
            {Icon ? <Icon size={15} /> : null}
            {tab.label}
          </NavLink>
        )
      })}
      <NavLink
        to={toAbs('confidential')}
        className={({ isActive }) =>
          `${linkClass({ isActive })} ml-2 pl-3 border-l border-[#333]`
        }
      >
        <Icons.Lock size={15} />
        Área Restrita
      </NavLink>
    </nav>,
    portalTarget,
  )
}
