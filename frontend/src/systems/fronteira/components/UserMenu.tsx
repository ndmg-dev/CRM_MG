import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Lock, LogOut, Settings, Users } from "lucide-react";
import { Avatar } from "@fronteira-ui";
import { useAuth } from "../auth/AuthContext";
import { TrocarSenhaModal } from "./TrocarSenhaModal";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";

/** Menu do usuário no canto superior direito (dropdown): identidade + ações da
 * conta (Usuários — só admin, Trocar senha, Sair). Substitui a antiga barra
 * com nome + botão "Sair". */
export function UserMenu() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const toAbs = useNativeSystemPath();
  const [senhaOpen, setSenhaOpen] = useState(false);

  const nome = user?.full_name?.trim() || user?.username || "Usuário";
  const email = user?.email || "";

  return (
    <>
      <Dropdown.Root>
        <Dropdown.Trigger asChild>
          <button className="usermenu-trigger" aria-label="Menu do usuário">
            <Avatar name={nome} size="sm" />
            <span className="usermenu-trigger-name">{nome}</span>
            <ChevronDown size={16} className="usermenu-chevron" />
          </button>
        </Dropdown.Trigger>

        <Dropdown.Portal>
          <Dropdown.Content className="usermenu-content" align="end" sideOffset={8}>
            <div className="usermenu-head">
              <Avatar name={nome} size="md" />
              <div className="usermenu-head-text">
                <strong>{nome}</strong>
                {email && <span>{email}</span>}
              </div>
            </div>

            <Dropdown.Separator className="usermenu-sep" />

            {isAdmin && (
              <Dropdown.Item className="usermenu-item" onSelect={() => navigate(toAbs("usuarios"))}>
                <Users size={16} />
                Usuários
              </Dropdown.Item>
            )}
            {isAdmin && (
              <Dropdown.Item className="usermenu-item" onSelect={() => navigate(toAbs("configuracoes"))}>
                <Settings size={16} />
                Configurações
              </Dropdown.Item>
            )}
            <Dropdown.Item className="usermenu-item" onSelect={() => setSenhaOpen(true)}>
              <Lock size={16} />
              Trocar senha
            </Dropdown.Item>

            <Dropdown.Separator className="usermenu-sep" />

            <Dropdown.Item className="usermenu-item usermenu-item-danger" onSelect={logout}>
              <LogOut size={16} />
              Sair
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>

      <TrocarSenhaModal open={senhaOpen} onOpenChange={setSenhaOpen} />

      <style>{css}</style>
    </>
  );
}

const css = `
.usermenu-trigger {
  display: flex; align-items: center; gap: 9px; cursor: pointer;
  background: none; border: 1px solid transparent; border-radius: 999px;
  padding: 4px 10px 4px 4px; color: var(--ink); font: inherit;
  max-width: 260px;
}
.usermenu-trigger:hover { background: var(--mg-color-bg-hover); border-color: var(--line); }
.usermenu-trigger[data-state="open"] { background: var(--mg-color-bg-hover); border-color: var(--line); }
.usermenu-trigger-name {
  font-size: 13.5px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.usermenu-chevron { color: var(--muted); flex-shrink: 0; transition: transform 120ms ease; }
.usermenu-trigger[data-state="open"] .usermenu-chevron { transform: rotate(180deg); }

.usermenu-content {
  min-width: 248px;
  background: var(--card); border: 1px solid var(--line); border-radius: var(--radius);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  padding: 6px; z-index: 60;
}
.usermenu-head { display: flex; align-items: center; gap: 11px; padding: 10px 10px 12px; }
.usermenu-head-text { display: flex; flex-direction: column; min-width: 0; }
.usermenu-head-text strong { font-size: 13.5px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.usermenu-head-text span { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.usermenu-sep { height: 1px; background: var(--line); margin: 4px 0; }
.usermenu-item {
  display: flex; align-items: center; gap: 10px; cursor: pointer; outline: none;
  padding: 9px 10px; border-radius: var(--radius-sm);
  font-size: 13.5px; color: var(--ink-soft); user-select: none;
}
.usermenu-item svg { color: var(--muted); }
.usermenu-item[data-highlighted] { background: var(--mg-color-bg-hover); color: var(--ink); }
.usermenu-item[data-highlighted] svg { color: var(--ink-soft); }
.usermenu-item-danger { color: var(--danger); }
.usermenu-item-danger svg { color: var(--danger); }
.usermenu-item-danger[data-highlighted] { background: var(--danger-tint); color: var(--danger); }
.usermenu-item-danger[data-highlighted] svg { color: var(--danger); }
`;
