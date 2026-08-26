import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'

// Portalizado pro Header do CRM, mesmo padrão do Documentação
// Contábil/Consulta CNPJ (ver documentacao-contabil/components/Topbar.tsx) —
// a sidebar fixa de 256px + topbar próprios do MainLayout.tsx original
// (logo "MENDONÇA GALVÃO" + avatar "MG") viram só a nav, sem branding nem
// avatar próprios, pra não duplicar a identidade que o CRM já mostra no seu
// próprio header. Cores em hex direto (não var(--x)): este componente é
// portalizado pra fora da árvore de .analytics-dp-root, então variáveis CSS
// escopadas nela não chegariam aqui.
const LINKS = [
  { to: '.', rotulo: 'Dashboard', end: true },
  { to: 'imports', rotulo: 'Importações', end: false },
  { to: 'quality', rotulo: 'Qualidade dos Dados', end: false },
  { to: 'employees', rotulo: 'Colaboradores', end: false },
  { to: 'personnel-cost', rotulo: 'Custo de Pessoal', end: false },
]

export function Topbar() {
  const toAbs = useNativeSystemPath()
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalTarget(document.getElementById('system-menu-slot'))
  }, [])

  if (!portalTarget) return null

  return createPortal(
    <nav aria-label="Navegação do Analytics DP" className="flex w-full items-center gap-1 overflow-x-auto">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={toAbs(link.to)}
          end={link.end}
          className={({ isActive }) =>
            `rounded-md px-3 h-9 flex items-center text-sm whitespace-nowrap shrink-0 transition-colors ${
              isActive
                ? 'text-[#D4A843] bg-[#1a1a1a] font-medium'
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
