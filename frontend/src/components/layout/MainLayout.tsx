import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useUIStore } from '@/stores/uiStore'
import { useHeartbeat } from '@/hooks/useHeartbeat'

export default function MainLayout() {
  const fullBleedSystem = useUIStore((s) => s.fullBleedSystem)
  const kioskMode = useUIStore((s) => s.kioskMode)
  useHeartbeat()

  // Drawer da navegação em telas < lg. Estado puramente visual, local ao shell.
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const location = useLocation()

  // Navegar fecha o drawer; caso contrário ele cobriria a página recém-aberta.
  useEffect(() => setMobileNavOpen(false), [location.pathname])

  // Esc fecha o drawer (acessibilidade por teclado).
  useEffect(() => {
    if (!mobileNavOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileNavOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileNavOpen])

  return (
    <div className="min-h-screen bg-background">
      {!kioskMode && (
        <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      )}

      {/* Overlay do drawer — só existe abaixo de lg */}
      {!kioskMode && mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          aria-hidden="true"
        />
      )}

      <main
        className={`min-h-screen transition-[margin] duration-200 ease-in-out ${
          kioskMode ? '' : 'lg:ml-16'
        }`}
      >
        {!fullBleedSystem && !kioskMode && <Header onMenuClick={() => setMobileNavOpen(true)} />}
        <div className={fullBleedSystem || kioskMode ? '' : 'p-4 lg:p-5'}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
