import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'

// Portalizado pro Header do CRM, mesmo padrão do FiscalMatch/ContAI (ver
// contai/components/Topbar.tsx) — o header próprio do App.tsx original
// (logo "Notas Explicativas — Mendonça Galvão" + nav) foi substituído por
// só a nav, sem branding próprio, para não duplicar a identidade do CRM.
const LINKS = [
  { to: '.', rotulo: 'Visão geral', end: true },
  { to: 'gerar', rotulo: 'Gerar Notas', end: false },
  { to: 'historico', rotulo: 'Histórico', end: false },
  { to: 'empresas', rotulo: 'Empresas', end: false },
]

export function Topbar() {
  const toAbs = useNativeSystemPath()
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalTarget(document.getElementById('system-menu-slot'))
  }, [])

  if (!portalTarget) return null

  return createPortal(
    <nav aria-label="Navegação da Documentação Contábil" className="flex w-full items-center gap-1 overflow-x-auto">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={toAbs(link.to)}
          end={link.end}
          className={({ isActive }) =>
            `rounded-md px-3 h-9 flex items-center text-sm whitespace-nowrap shrink-0 transition-colors ${
              isActive
                ? 'text-ouro bg-[#1a1a1a] font-medium'
                : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
            }`
          }
        >
          {link.rotulo}
        </NavLink>
      ))}
    </nav>,
    portalTarget,
  )
}
