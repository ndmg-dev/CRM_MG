import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { FloatingTicketChat } from './chat/FloatingTicketChat'
import { UpdateModal } from './UpdateModal'
import { useUIStore } from '@/stores/uiStore'
import { useHeartbeat } from '@/hooks/useHeartbeat'

export default function MainLayout() {
  const fullBleedSystem = useUIStore((s) => s.fullBleedSystem)
  const kioskMode = useUIStore((s) => s.kioskMode)
  const sidebarExpanded = useUIStore((s) => s.sidebarExpanded)
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
          kioskMode ? '' : sidebarExpanded ? 'lg:ml-56' : 'lg:ml-16'
        }`}
      >
        {/* Header fica sempre visível (pesquisa, mensagens, notificações,
            avatar) mesmo com um sistema nativo aberto em tela cheia — só o
            menu específico do sistema (ex: Portal/Meus Chamados) muda por
            baixo dele. Some inteiro só no modo TV (kiosk). */}
        {!kioskMode && <Header onMenuClick={() => setMobileNavOpen(true)} />}
        <div className={fullBleedSystem || kioskMode ? '' : 'p-4 lg:p-5'}>
          <Outlet />
        </div>
      </main>

      {/* Chat rápido de chamado — abre por cima de qualquer tela, sem
          navegar pra fora do que a pessoa está fazendo. Some no modo TV. */}
      {!kioskMode && <FloatingTicketChat />}

      {/* Modal "seu CRM foi atualizado" — uma vez por versão, por usuário. */}
      {!kioskMode && <UpdateModal />}
    </div>
  )
}
