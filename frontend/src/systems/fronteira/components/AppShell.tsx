import type { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { UserMenu } from "./UserMenu";
import { useNativeSystemBase, useNativeSystemPath } from "@/hooks/useNativeSystemBase";
import logo from "../assets/logo.png";

interface NavItem {
  to: string;
  label: string;
  admin?: boolean;
}
interface NavGroup {
  key: string;
  label: string;
  to?: string; // grupo sem sub-itens (ex.: Dashboard) navega direto
  end?: boolean;
  items: NavItem[];
}

// Menu em dois níveis: barra principal (grupos) + sub-barra contextual do grupo
// ativo. Cada grupo abre no seu primeiro sub-item.
const GROUPS: NavGroup[] = [
  { key: "dashboard", label: "Dashboard", to: "/", end: true, items: [] },
  {
    key: "fronteira",
    label: "Fronteira",
    items: [
      { to: "/fronteira", label: "Processar" },
      { to: "/fronteira/importar", label: "Importação" },
      { to: "/fronteira/historico", label: "Histórico" },
      { to: "/calculo", label: "Cálculo avulso" },
      { to: "/comparacao", label: "Comparação SEFAZ" },
      { to: "/excecoes", label: "Exceções fiscais" },
    ],
  },
  {
    key: "antecipacao",
    label: "Antecipação",
    items: [
      { to: "/antecipacao/processar", label: "Processar" },
      { to: "/antecipacao", label: "Memória" },
      { to: "/antecipacao/historico", label: "Histórico" },
      { to: "/antecipacao/excecoes", label: "Exceções" },
      { to: "/antecipacao/tributacoes", label: "Tributações" },
    ],
  },
  {
    key: "empresas",
    label: "Empresas",
    items: [
      { to: "/empresas", label: "Empresas" },
      { to: "/ncm-rules", label: "Regras NCM/MVA" },
    ],
  },
  {
    key: "utilitarios",
    label: "Utilitários",
    items: [{ to: "/utilitarios/ibs-cbs", label: "IBS/CBS" }],
  },
];

/** Casa o pathname com o grupo + sub-item mais específico (maior prefixo). */
function matchNav(path: string): { group: NavGroup; item: NavItem | null } {
  if (path === "/") return { group: GROUPS[0], item: null };
  let best: { group: NavGroup; item: NavItem | null; len: number } = {
    group: GROUPS[0],
    item: null,
    len: -1,
  };
  for (const group of GROUPS) {
    for (const item of group.items) {
      if ((path === item.to || path.startsWith(item.to + "/")) && item.to.length > best.len) {
        best = { group, item, len: item.to.length };
      }
    }
  }
  return { group: best.group, item: best.item };
}

function TopNav() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const base = useNativeSystemBase();
  const toAbs = useNativeSystemPath();
  // Este sistema é montado em "/sistemas/:id" dentro do CRM (ver
  // @/hooks/useNativeSystemBase.ts), então location.pathname vem sempre
  // prefixado com essa base — matchNav() (idêntica ao original) espera
  // paths "de raiz do site" como "/fronteira", então tiramos o prefixo
  // antes de comparar. Nenhuma lógica de matchNav foi alterada.
  const relPath = location.pathname.slice(base.length) || "/";
  const { group: activeGroup, item: activeItem } = matchNav(relPath);
  // Idem: GROUPS guarda paths "de raiz do site" (ex.: "/fronteira") pra
  // preservar matchNav intocada; na hora de navegar/renderizar o link,
  // resolvemos pro caminho absoluto real dentro do CRM.
  const toRoute = (to: string) => (to === "/" ? base : toAbs(to.slice(1)));

  const subItems = activeGroup.items.filter((i) => !i.admin || isAdmin);

  return (
    <>
      <header className="topnav">
        <div className="brand" onClick={() => navigate(base)} role="button" tabIndex={0}>
          <img className="brand-mark" src={logo} alt="Fronteira" />
          <strong>Fronteira</strong>
        </div>

        <nav className="topnav-primary">
          {GROUPS.map((g) => {
            const isActive = g.key === activeGroup.key;
            const target = g.to ?? g.items.find((i) => !i.admin || isAdmin)?.to ?? "/";
            return (
              <button
                key={g.key}
                className={`topnav-link ${isActive ? "active" : ""}`}
                onClick={() => navigate(toRoute(target))}
              >
                {g.label}
              </button>
            );
          })}
        </nav>

        <div className="spacer" />
        <UserMenu />
      </header>

      {subItems.length > 0 && (
        <div className="subnav">
          {subItems.map((item) => (
            <NavLink
              key={item.to}
              to={toRoute(item.to)}
              // className como função: evita o "active" automático do NavLink
              // (que marca por PREFIXO quando className é string — sem isso,
              // "/fronteira" ficava ativo junto com "/fronteira/importar").
              // A ativação usa só o match mais específico calculado acima.
              className={() => `subnav-link ${activeItem?.to === item.to ? "active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}

      <style>{navCss}</style>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <TopNav />
      <div className="content">{children}</div>
      <style>{shellCss}</style>
    </div>
  );
}

const shellCss = `
.shell { display: flex; flex-direction: column; min-height: 100vh; background: var(--mg-color-bg-base); }
.content { padding: 26px 30px; width: 100%; }
`;

const navCss = `
.topnav {
  display: flex; align-items: center; gap: 22px;
  height: var(--topbar-h); padding: 0 26px;
  background: var(--mg-color-bg-surface);
  border-bottom: 1px solid var(--mg-color-border-default);
  position: sticky; top: 0; z-index: 6;
}
.brand { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.brand-mark { height: 32px; width: auto; display: block; }
.brand strong { color: var(--mg-color-text-primary); font-size: 15px; letter-spacing: -0.01em; }

.topnav-primary { display: flex; align-items: center; gap: 2px; height: 100%; }
.topnav-link {
  appearance: none; background: none; border: none; cursor: pointer;
  font-family: var(--font-ui); font-size: 14px; font-weight: 600;
  color: var(--mg-color-text-secondary);
  padding: 7px 14px;
  display: inline-flex; align-items: center;
}
.topnav-link:hover { color: var(--mg-color-text-primary); }
.topnav-link.active {
  color: #f0c020; font-weight: 600; background: none; border: none;
  text-shadow: 0 0 3px rgba(240, 192, 32, 0.35);
}


.subnav {
  display: flex; align-items: center; gap: 4px;
  padding: 0 26px; height: 42px;
  background: var(--mg-color-bg-card);
  border-bottom: 1px solid var(--mg-color-border-default);
  position: sticky; top: var(--topbar-h); z-index: 5;
}
.subnav-link {
  color: var(--mg-color-text-secondary); font-size: 13px; font-weight: 500;
  padding: 7px 14px;
  text-decoration: none;
  display: inline-flex; align-items: center;
}
.subnav-link:hover { color: var(--mg-color-text-primary); text-decoration: none; }
.subnav-link.active {
  color: #f0c020; font-weight: 600; background: none; border: none;
  text-shadow: 0 0 3px rgba(240, 192, 32, 0.35);
}

@media (max-width: 820px) {
  .topnav { flex-wrap: wrap; height: auto; padding: 10px 16px; gap: 12px; }
  .topnav-primary { order: 3; width: 100%; overflow-x: auto; }
  .subnav { overflow-x: auto; }
  .content { padding: 18px 16px; }
}
`;
