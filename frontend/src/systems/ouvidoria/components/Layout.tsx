import { useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  MessageSquareText,
  PlusCircle,
  Bot,
  BarChart3,
  FolderOpen,
  BookOpen,
  ShieldCheck,
  User,
  LogOut,
  Menu,
} from 'lucide-react'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'
import { endUnifiedSession } from '@/lib/unifiedAuth'
import { useOuvidoriaProfile } from '../lib/useOuvidoriaProfile'
import logo from '../assets/logo.png'

// Sidebar + topbar do app original (app/templates/base.html), reconstruído
// em JSX (não é uma "tradução" do Jinja2). Navegação sempre por caminho
// absoluto via useNativeSystemPath() — ver hooks/useNativeSystemBase.ts.
const mainNav = [
  { to: '.', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: 'manifestacoes', label: 'Minhas Manifestações', icon: MessageSquareText },
  { to: 'manifestacoes/nova', label: 'Nova Manifestação', icon: PlusCircle },
  { to: 'chat', label: 'Assistente IA', icon: Bot },
]

const adminNav = [
  { to: 'admin', label: 'Painel Admin', icon: BarChart3, end: true },
  { to: 'admin/manifestacoes', label: 'Todas as Manifestações', icon: FolderOpen },
  { to: 'admin/conhecimento', label: 'Base de Conhecimento', icon: BookOpen },
  { to: 'admin/auditoria', label: 'Auditoria', icon: ShieldCheck },
]

export function Layout({ children }: { children: ReactNode }) {
  const toAbs = useNativeSystemPath()
  const location = useLocation()
  const { data: profile } = useOuvidoriaProfile()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isAdmin = profile?.role === 'admin'
  const initials = (profile?.full_name || 'U').slice(0, 2).toUpperCase()

  async function handleLogout() {
    await endUnifiedSession()
    window.location.href = '/login'
  }

  const currentTitle = [...mainNav, ...adminNav].find((item) => {
    const target = toAbs(item.to)
    return item.end ? location.pathname === target : location.pathname.startsWith(target)
  })?.label

  return (
    <div className="app-layout">
      {mobileOpen && (
        <div className="sidebar-overlay open" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`sidebar${mobileOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <img src={logo} alt="Mendonça Galvão" className="sidebar-logo" />
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-name">Ouvidoria Corporativa</div>
            <div className="sidebar-brand-sub">Canal de Escuta RH</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <div className="sidebar-section-title">Principal</div>
            {mainNav.map((item) => (
              <NavLink
                key={item.to}
                to={toAbs(item.to)}
                end={item.end}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              >
                <item.icon />
                {item.label}
              </NavLink>
            ))}
          </div>

          {isAdmin && (
            <div className="sidebar-section">
              <div className="sidebar-section-title">Administração</div>
              {adminNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={toAbs(item.to)}
                  end={item.end}
                  className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                >
                  <item.icon />
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}

          <div className="sidebar-section">
            <div className="sidebar-section-title">Conta</div>
            <NavLink to={toAbs('profile')} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <User />
              Meu Perfil
            </NavLink>
            <button type="button" className="sidebar-link" onClick={handleLogout} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
              <LogOut />
              Sair
            </button>
          </div>
        </nav>

        {profile && (
          <div className="sidebar-footer">
            <div className="sidebar-user">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="avatar" referrerPolicy="no-referrer" />
              ) : (
                <div className="avatar avatar-placeholder">{initials}</div>
              )}
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{profile.full_name}</div>
                <div className="sidebar-user-role">{profile.role === 'admin' ? 'Administrador' : 'Colaborador'}</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="topbar-menu-btn" aria-label="Menu" onClick={() => setMobileOpen((v) => !v)}>
              <Menu />
            </button>
            <div>
              <div className="topbar-title">{currentTitle || 'Ouvidoria Corporativa'}</div>
            </div>
          </div>
          <div className="topbar-right">
            {profile && (
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{profile.email}</span>
            )}
          </div>
        </header>

        <div className="page-content">{children}</div>
      </main>
    </div>
  )
}
