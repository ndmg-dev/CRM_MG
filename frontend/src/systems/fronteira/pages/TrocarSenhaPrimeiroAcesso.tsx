import { useState, type FormEvent } from "react";
import { Button, Input, Label } from "@fronteira-ui";
import { useAuth } from "../auth/AuthContext";
import { useTrocarSenha } from "../hooks/queries";
import { apiError } from "../lib/api";
import { SENHA_REQUISITOS, validarForcaSenha } from "../lib/senha";

/** Tela de bloqueio no primeiro acesso (ou depois de um admin redefinir a
 * senha) — sem opção de cancelar/pular, porque a senha inicial definida pelo
 * admin não deve continuar sendo a senha real de ninguém. Renderizada pelo
 * `Protected`/`AdminProtected` do App.tsx no lugar da rota pedida enquanto
 * `user.deve_trocar_senha` for true — não é uma rota própria. */
export default function TrocarSenhaPrimeiroAcesso() {
  const { user, logout, refreshUser } = useAuth();
  const trocar = useTrocarSenha();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const problema = validarForcaSenha(novaSenha);
    if (problema) {
      setError(problema);
      return;
    }
    if (novaSenha !== confirmacao) {
      setError("A confirmação não confere com a nova senha.");
      return;
    }
    try {
      await trocar.mutateAsync({ senha_atual: senhaAtual, senha_nova: novaSenha });
      await refreshUser();
    } catch (err) {
      setError(apiError(err, "Não foi possível trocar a senha."));
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card card">
        <div className="login-brand">
          <img className="brand-mark" src="/brand/logo.png" alt="Fronteira" />
          <div className="stack">
            <strong>Fronteira</strong>
            <span className="muted">Gestão fiscal ICMS</span>
          </div>
        </div>
        <div className="frontier-rule" />
        <div className="stack" style={{ marginTop: 20, gap: 4 }}>
          <strong>Troque sua senha para continuar</strong>
          <span className="muted" style={{ fontSize: 13 }}>
            {user?.full_name ? `Olá, ${user.full_name}. ` : ""}
            Sua senha atual foi definida por um administrador — escolha uma nova antes de acessar o sistema.
          </span>
        </div>
        <form onSubmit={submit} className="stack gap-16" style={{ marginTop: 18 }}>
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="field">
            <Label htmlFor="ts-atual">Senha atual</Label>
            <Input
              id="ts-atual"
              type="password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </div>
          <div className="field">
            <Label htmlFor="ts-nova">Nova senha</Label>
            <Input
              id="ts-nova"
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              autoComplete="new-password"
            />
            <span className="field-hint">{SENHA_REQUISITOS}</span>
          </div>
          <div className="field">
            <Label htmlFor="ts-conf">Confirmar nova senha</Label>
            <Input
              id="ts-conf"
              type="password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button variant="primary" disabled={trocar.isPending} style={{ justifyContent: "center" }}>
            {trocar.isPending ? "Salvando…" : "Trocar senha e continuar"}
          </Button>
          <button type="button" className="login-sair" onClick={logout}>
            Sair
          </button>
        </form>
      </div>

      <style>{css}</style>
    </div>
  );
}

const css = `
.login-wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px;
  background: radial-gradient(1200px 500px at 50% -10%, var(--mg-color-bg-surface), var(--surface)); }
.login-card { width: 100%; max-width: 400px; padding: 28px; }
.login-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.login-brand strong { font-size: 18px; color: var(--ink); }
.login-brand .brand-mark { height: 40px; width: auto; display: block; }
.login-sair {
  background: none; border: none; color: var(--muted); font-size: 12.5px; cursor: pointer;
  text-align: center; padding: 4px 0;
}
.login-sair:hover { color: var(--ink-soft); text-decoration: underline; }
`;
