import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import { Calculator, LayoutDashboard, ScrollText, ShieldCheck } from 'lucide-react'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'
import { usePermissoes } from '../auth/permissoes'

// Portalizado pro Header do CRM (#system-menu-slot), mesmo padrão do extratos-socios.
// Cores em hex direto — este nó vive fora de .icms-root, então var(--cor-*) não chegaria aqui.
export function Topbar() {
  const toAbs = useNativeSystemPath()
  const { admin } = usePermissoes()
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalTarget(document.getElementById('system-menu-slot'))
  }, [])

  if (!portalTarget) return null

  const links = [
    { to: '.', label: 'Painel do mês', icon: LayoutDashboard, end: true },
    { to: 'regras', label: 'Regras fiscais', icon: ScrollText, end: false },
    ...(admin ? [{ to: 'permissoes', label: 'Permissões', icon: ShieldCheck, end: false }] : []),
  ]

  return createPortal(
    <nav aria-label="Navegação do ICMS Saídas" className="flex w-full items-center gap-1 overflow-x-auto">
      <span className="flex items-center gap-2 px-3 h-9 text-sm text-gray-300 shrink-0">
        <Calculator size={16} />
        ICMS Saídas
      </span>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={toAbs(link.to)}
          end={link.end}
          className={({ isActive }) =>
            `flex items-center gap-2 rounded-md px-3 h-9 text-sm whitespace-nowrap shrink-0 transition-colors ${
              isActive ? 'text-[#d4a843] bg-[#1c1c25] font-medium' : 'text-gray-400 hover:text-white hover:bg-[#1c1c25]'
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
