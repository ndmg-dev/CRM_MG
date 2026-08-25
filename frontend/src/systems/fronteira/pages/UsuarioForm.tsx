import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";
import { Button, Checkbox, Input, Label, Select } from "@fronteira-ui";
import { useChoices, useUsuario, useSaveUsuario, type UsuarioInput } from "../hooks/queries";
import { SelecaoEmpresas } from "../components/SelecaoEmpresas";
import { UsuarioEmpresas } from "../components/UsuarioEmpresas";
import { apiError } from "../lib/api";
import { SENHA_REQUISITOS, validarForcaSenha } from "../lib/senha";

const EMPTY: UsuarioInput = {
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  role: "operador",
  is_active: true,
  password: "",
};

export default function UsuarioForm() {
  const { id } = useParams();
  const editId = id ? Number(id) : null;
  const navigate = useNavigate();
  const toAbs = useNativeSystemPath();

  const { data: choices } = useChoices();
  const { data: existing } = useUsuario(editId);
  const save = useSaveUsuario(editId);

  const [form, setForm] = useState<UsuarioInput>(EMPTY);
  // Só na criação: vão junto no POST, para o usuário não nascer sem enxergar
  // nada. Na edição os vínculos têm rota e card próprios (UsuarioEmpresas).
  const [empresasNovas, setEmpresasNovas] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");

  // Administrador enxerga todas as empresas pelo papel — selecionar empresas
  // aqui não teria efeito nenhum.
  const ehAdmin = form.role === "administrador";

  useEffect(() => {
    if (existing) {
      setForm({
        username: existing.username,
        email: existing.email,
        first_name: existing.first_name,
        last_name: existing.last_name,
        role: existing.role,
        is_active: existing.is_active,
        password: "",
      });
    }
  }, [existing]);

  function set<K extends keyof UsuarioInput>(key: K, value: UsuarioInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.username.trim()) {
      setError("Usuário é obrigatório.");
      return;
    }
    // Na criação a senha é obrigatória; na edição, só validamos se foi
    // preenchida (em branco = mantém a atual).
    const senha = form.password ?? "";
    if (!editId || senha) {
      const problema = validarForcaSenha(senha);
      if (problema) {
        setError(problema);
        return;
      }
    }
    // Na edição, senha em branco = mantém a atual (não envia o campo).
    const payload: UsuarioInput = { ...form };
    if (editId && !payload.password) delete payload.password;
    // `company_ids` é exclusivo da criação e não se aplica a administrador.
    if (!editId && !ehAdmin) payload.company_ids = [...empresasNovas];

    try {
      await save.mutateAsync(payload);
      navigate(toAbs("usuarios"));
    } catch (err) {
      setError(apiError(err, "Não foi possível salvar."));
    }
  }

  return (
    <div className="stack gap-16" style={{ maxWidth: 640 }}>
      <div>
        <h1 className="page-title">{editId ? "Editar usuário" : "Novo usuário"}</h1>
        <p className="page-sub">Acesso ao sistema e papel</p>
      </div>

      <form onSubmit={submit} className="card">
        <div className="card-body stack gap-16">
          {error && <div className="alert alert-danger">{error}</div>}

          <div className="field">
            <Label htmlFor="username">Usuário</Label>
            <Input
              id="username"
              className="num"
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
              autoComplete="off"
              required
            />
          </div>

          <div className="grid-2">
            <div className="field">
              <Label htmlFor="first_name">Nome</Label>
              <Input id="first_name" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
            </div>
            <div className="field">
              <Label htmlFor="last_name">Sobrenome</Label>
              <Input id="last_name" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
            </div>
          </div>

          <div className="field">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="usuario@empresa.com"
            />
          </div>

          <div className="grid-2">
            <div className="field">
              <Label>Papel</Label>
              <Select
                aria-label="Papel"
                value={form.role}
                onValueChange={(v) => set("role", v)}
                options={choices?.user_role ?? []}
              />
            </div>
            <div className="field">
              <Label>Situação</Label>
              <div style={{ paddingTop: 8 }}>
                <Checkbox
                  id="is_active"
                  checked={form.is_active}
                  onCheckedChange={(checked) => set("is_active", checked)}
                  label="Usuário ativo"
                />
              </div>
            </div>
          </div>

          <div className="field">
            <Label htmlFor="password">{editId ? "Nova senha (deixe em branco para manter)" : "Senha"}</Label>
            <Input
              id="password"
              type="password"
              value={form.password ?? ""}
              onChange={(e) => set("password", e.target.value)}
              autoComplete="new-password"
              placeholder={editId ? "••••••••" : SENHA_REQUISITOS}
            />
            <span className="field-hint">
              {SENHA_REQUISITOS}{" "}
              {editId
                ? "Se você definir uma nova senha aqui, o usuário será obrigado a trocá-la no próximo login."
                : "É só a senha inicial — o usuário será obrigado a trocá-la no primeiro login."}
            </span>
          </div>
        </div>

        <div
          className="card-head"
          style={{ borderTop: "1px solid var(--line)", borderBottom: "none", justifyContent: "flex-end" }}
        >
          <Button type="button" variant="ghost" onClick={() => navigate(toAbs("usuarios"))}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>

      {/* Vínculos só na edição: o usuário precisa existir para ter vínculo.
          Fica num card à parte com salvamento próprio, porque é outra rota
          (`PUT /users/{id}/empresas`) e não faz parte do payload do usuário. */}
      <div className="card">
        <div className="card-head">
          <h2 style={{ fontSize: 14 }}>Empresas que este usuário enxerga</h2>
        </div>
        <div className="card-body">
          {editId ? (
            <UsuarioEmpresas userId={editId} />
          ) : ehAdmin ? (
            <div className="alert alert-info">
              Administradores enxergam <strong>todas as empresas</strong> por definição do papel —
              não é preciso vincular nenhuma.
            </div>
          ) : (
            <div className="stack gap-12">
              {empresasNovas.size === 0 && (
                <div className="alert alert-warn">
                  Sem nenhuma empresa selecionada, este usuário <strong>não enxergará nada</strong>{" "}
                  ao entrar no sistema. Dá para vincular depois, na edição.
                </div>
              )}
              {/* Seleção enviada junto no POST — o usuário já nasce utilizável,
                  em vez de exigir um segundo passo obrigatório. */}
              <SelecaoEmpresas selecionadas={empresasNovas} onChange={setEmpresasNovas} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
