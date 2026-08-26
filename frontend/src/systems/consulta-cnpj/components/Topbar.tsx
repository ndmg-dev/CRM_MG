import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'

// Portalizado pro Header do CRM, mesmo padrão do Documentação
// Contábil/ContAI (ver documentacao-contabil/components/Topbar.tsx) — o
// header próprio do App.jsx original (logo + nav "Início"/"Sobre") vira só
// nav, sem branding próprio, pra não duplicar a identidade do CRM.
export function Topbar() {
  const toAbs = useNativeSystemPath()
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalTarget(document.getElementById('system-menu-slot'))
  }, [])

  if (!portalTarget) return null

  return createPortal(
    <nav aria-label="Navegação da Consulta Societária" className="flex w-full items-center gap-1 overflow-x-auto">
      <NavLink
        to={toAbs('.')}
        end
        className={({ isActive }) =>
          `rounded-md px-3 h-9 flex items-center text-sm whitespace-nowrap shrink-0 transition-colors ${
            isActive ? 'text-ouro bg-[#1a1a1a] font-medium' : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
          }`
        }
      >
        Consulta Societária
      </NavLink>
    </nav>,
    portalTarget,
  )
}
