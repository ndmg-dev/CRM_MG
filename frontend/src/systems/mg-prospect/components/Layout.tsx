import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Target, Mail, Kanban, LogOut, ChevronRight } from 'lucide-react';
import { useNativeSystemBase, useNativeSystemPath } from '@/hooks/useNativeSystemBase';

const TOKEN_KEY = 'mgprospect_token';

// `path` aqui é sempre um sufixo relativo à base do sistema ("" para a rota
// índice) — resolvido pra absoluto com useNativeSystemPath() antes de virar
// o `to` de um <Link>. react-router-dom não resolve navegação relativa como
// um <a href> faria (ver hooks/useNativeSystemBase.ts), por isso nunca se usa
// o path original ("/", "/campaigns", ...) direto.
const menuItems = [
    { path: '', icon: LayoutDashboard, label: 'Dashboard' },
    { path: 'campaigns', icon: Target, label: 'Campanhas' },
    { path: 'leads', icon: Users, label: 'Lista de Leads' },
    { path: 'crm', icon: Kanban, label: 'CRM Kanban' },
    { path: 'templates', icon: Mail, label: 'Modelos de E-mail' },
];

const pageTitles: Record<string, { title: string; subtitle: string }> = {
    '': { title: 'Dashboard', subtitle: 'Acompanhe o desempenho da prospecção' },
    'campaigns': { title: 'Campanhas', subtitle: 'Gerencie campanhas de captação de leads' },
    'leads': { title: 'Lista de Leads', subtitle: 'Todos os leads captados pelo sistema' },
    'crm': { title: 'Pipeline de Vendas', subtitle: 'Gerencie o funil comercial' },
    'templates': { title: 'Modelos de E-mail', subtitle: 'Templates de prospecção' },
};

export function Layout({ children }: { children: ReactNode }) {
    const location = useLocation();
    const navigate = useNavigate();
    const base = useNativeSystemBase();
    const toAbs = useNativeSystemPath();

    // Sufixo da rota atual em relação à base do sistema (ex: "/sistemas/xyz/campaigns" -> "campaigns").
    const currentSuffix = location.pathname === base
        ? ''
        : location.pathname.startsWith(`${base}/`)
            ? location.pathname.slice(base.length + 1)
            : '';
    const currentPage = pageTitles[currentSuffix] || pageTitles[''];

    function handleLogout() {
        localStorage.removeItem(TOKEN_KEY);
        navigate(toAbs('login'));
    }

    return (
        <div className="min-h-screen flex bg-mg-bg">
            {/* Sidebar */}
            <aside className="w-[260px] border-r border-mg-border bg-mg-surface flex flex-col flex-shrink-0">
                {/* Logo Area */}
                <div className="h-[72px] flex items-center px-6 border-b border-mg-border">
                    <div className="w-9 h-9 rounded-lg bg-gold-gradient flex items-center justify-center font-bold text-mg-bg text-sm tracking-tight shadow-glow flex-shrink-0">
                        MG
                    </div>
                    <div className="ml-3">
                        <span className="font-semibold text-[15px] tracking-tight text-mg-text block leading-tight">
                            Prospect AI
                        </span>
                        <span className="text-2xs text-mg-muted leading-none">
                            Mendonça Galvão
                        </span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-5 px-3 space-y-1">
                    {menuItems.map((item) => {
                        const isActive = item.path === currentSuffix;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.path}
                                to={toAbs(item.path || '.')}
                                className={`group flex items-center px-3 py-2.5 rounded-premium text-sm font-medium transition-all duration-200 ${
                                    isActive
                                        ? 'bg-mg-goldmuted text-mg-gold shadow-sm'
                                        : 'text-mg-muted hover:bg-mg-elevated hover:text-mg-text'
                                }`}
                            >
                                <Icon className={`w-[18px] h-[18px] mr-3 flex-shrink-0 transition-colors ${
                                    isActive ? 'text-mg-gold' : 'text-mg-muted group-hover:text-mg-sub'
                                }`} />
                                <span className="flex-1">{item.label}</span>
                                {isActive && (
                                    <ChevronRight className="w-3.5 h-3.5 text-mg-gold/50" />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Sidebar Footer */}
                <div className="p-3 border-t border-mg-border">
                    <button
                        onClick={handleLogout}
                        className="flex items-center text-mg-muted hover:text-mg-error w-full px-3 py-2.5 rounded-premium transition-all duration-200 hover:bg-mg-error/5 text-sm group"
                    >
                        <LogOut className="w-[18px] h-[18px] mr-3 group-hover:text-mg-error transition-colors" />
                        <span className="font-medium">Sair do sistema</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Header */}
                <header className="h-[72px] border-b border-mg-border flex items-center justify-between px-8 bg-mg-bg/80 backdrop-blur-md flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-semibold text-mg-text tracking-tight">
                            {currentPage.title}
                        </h2>
                        <p className="text-xs text-mg-muted mt-0.5">
                            {currentPage.subtitle}
                        </p>
                    </div>
                    {/* User area placeholder */}
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-mg-elevated border border-mg-border flex items-center justify-center">
                            <span className="text-xs font-semibold text-mg-gold">A</span>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <div className="p-8 flex-1 overflow-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
