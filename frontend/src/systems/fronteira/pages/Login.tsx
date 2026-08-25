import { useState, type FormEvent } from "react";
import { Button, Input, Label } from "@fronteira-ui";
import { useAuth } from "../auth/AuthContext";
import { apiError } from "../lib/api";
import { useNativeSystemBase } from "@/hooks/useNativeSystemBase";
import logo from "../assets/logo.png";

// PORT ADAPTADO de tnunes8/sistema-fronteira-v8 (frontend/src/pages/Login.tsx).
// Únicas mudanças: `navigate("/")` (raiz do site original) vira o caminho
// absoluto deste sistema dentro do CRM (useNativeSystemBase — ver
// comentário em @/hooks/useNativeSystemBase.ts), e o logo passa a ser um
// asset importado (../assets/logo.png) em vez de /brand/logo.png servido
// da pasta public/ do v8 original (que não existe aqui). Todo o fluxo de
// login/2FA é idêntico ao original.
export default function Login() {
  const { login, verificarCodigo, reenviarCodigo } = useAuth();
  const base = useNativeSystemBase();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailMascarado, setEmailMascarado] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [aviso, setAviso] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await login(username, password);
      if (res.mfaRequired) {
        setEmailMascarado(res.emailMascarado ?? "");
        return;
      }
      window.location.href = base;
    } catch (err) {
      setError(apiError(err, "Não foi possível entrar."));
    } finally {
      setBusy(false);
    }
  }

  async function submitCodigo(e: FormEvent) {
    e.preventDefault();
    setError("");
    setAviso("");
    setBusy(true);
    try {
      await verificarCodigo(codigo);
      window.location.href = base;
    } catch (err) {
      setError(apiError(err, "Não foi possível validar o código."));
    } finally {
      setBusy(false);
    }
  }

  async function reenviar() {
    setError("");
    setAviso("");
    setBusy(true);
    try {
      const destino = await reenviarCodigo();
      if (destino) setEmailMascarado(destino);
      setCodigo("");
      setAviso("Enviamos um novo código. O anterior deixou de valer.");
    } catch (err) {
      setError(apiError(err, "Não foi possível reenviar o código."));
    } finally {
      setBusy(false);
    }
  }

  function voltar() {
    setEmailMascarado(null);
    setCodigo("");
    setPassword("");
    setError("");
    setAviso("");
  }

  return (
    <div className="login-wrap">
      <div className="login-card card">
        <div className="login-brand">
          <img className="brand-mark" src={logo} alt="Fronteira" />
          <div className="stack">
            <strong>Fronteira</strong>
            <span className="muted">Gestão fiscal ICMS</span>
          </div>
        </div>
        <div className="frontier-rule" />

        {emailMascarado === null ? (
          <form onSubmit={submit} className="stack gap-16" style={{ marginTop: 20 }}>
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="field">
              <Label htmlFor="u">Usuário ou e-mail</Label>
              <Input
                id="u"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>
            <div className="field">
              <Label htmlFor="p">Senha</Label>
              <Input
                id="p"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button variant="primary" disabled={busy} style={{ justifyContent: "center" }}>
              {busy ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        ) : (
          <form onSubmit={submitCodigo} className="stack gap-16" style={{ marginTop: 20 }}>
            {error && <div className="alert alert-danger">{error}</div>}
            {aviso && <div className="alert alert-ok">{aviso}</div>}
            <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>
              Enviamos um código de 6 dígitos para{" "}
              <strong>{emailMascarado || "seu e-mail"}</strong>. Ele vale por alguns
              minutos e só pode ser usado uma vez.
            </p>
            <div className="field">
              <Label htmlFor="codigo">Código de verificação</Label>
              <Input
                id="codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                autoFocus
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
              />
            </div>
            <Button variant="primary" disabled={busy} style={{ justifyContent: "center" }}>
              {busy ? "Verificando…" : "Confirmar"}
            </Button>
            <div className="login-acoes">
              <button type="button" className="link-btn" onClick={reenviar} disabled={busy}>
                Reenviar código
              </button>
              <button type="button" className="link-btn" onClick={voltar} disabled={busy}>
                Usar outra conta
              </button>
            </div>
          </form>
        )}
      </div>
      <p className="login-foot muted">Use as mesmas credenciais do sistema atual.</p>

      <style>{css}</style>
    </div>
  );
}

const css = `
.login-wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px;
  background: radial-gradient(1200px 500px at 50% -10%, var(--mg-color-bg-surface), var(--surface)); }
.login-card { width: 100%; max-width: 380px; padding: 28px; }
.login-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.login-brand strong { font-size: 18px; color: var(--ink); }
.login-brand .brand-mark { height: 40px; width: auto; display: block; }
.login-foot { margin-top: 16px; font-size: 12.5px; }
.login-acoes { display: flex; justify-content: space-between; gap: 12px; }
.link-btn { background: none; border: 0; padding: 0; font: inherit; font-size: 12.5px;
  color: var(--mg-color-text-muted, #6b7280); cursor: pointer; text-decoration: underline; }
.link-btn:hover:not(:disabled) { color: var(--ink); }
.link-btn:disabled { opacity: .5; cursor: default; }
`;
