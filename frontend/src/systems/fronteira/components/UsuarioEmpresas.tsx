import { useEffect, useMemo, useState } from "react";
import { Button } from "@fronteira-ui";
import { useSaveUsuarioEmpresas, useUsuarioEmpresas } from "../hooks/queries";
import { apiError } from "../lib/api";
import { SelecaoEmpresas } from "./SelecaoEmpresas";

/** Administração dos vínculos usuário↔empresa na EDIÇÃO.
 *
 * O acesso é fail-closed: usuário sem vínculo não enxerga empresa nenhuma.
 * Sem esta tela, dar acesso a uma empresa já cadastrada exigiria `INSERT`
 * manual em `fronteira_user_company`.
 *
 * Na criação o fluxo é outro — as empresas vão no próprio `POST /users`, ver
 * `UsuarioForm`. Aqui há salvamento próprio porque é outra rota. */
export function UsuarioEmpresas({ userId }: { userId: number }) {
  const { data: vinculos, isLoading } = useUsuarioEmpresas(userId);
  const salvar = useSaveUsuarioEmpresas(userId);

  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    if (vinculos) setSelecionadas(new Set(vinculos.company_ids));
  }, [vinculos]);

  const original = useMemo(() => new Set(vinculos?.company_ids ?? []), [vinculos]);
  const mudou =
    selecionadas.size !== original.size || [...selecionadas].some((id) => !original.has(id));

  async function handleSalvar() {
    setErro("");
    try {
      await salvar.mutateAsync([...selecionadas]);
      setSalvo(true);
    } catch (e) {
      setErro(apiError(e, "Não foi possível salvar os vínculos."));
    }
  }

  if (isLoading) return <div className="empty">Carregando vínculos…</div>;

  // Administrador global enxerga tudo por papel, não por vínculo. Editar a
  // lista aqui não mudaria o acesso dele — dizer isso é mais honesto do que
  // exibir uma seleção sem efeito.
  if (vinculos?.admin_global) {
    return (
      <div className="alert alert-info">
        Administradores enxergam <strong>todas as empresas</strong> por definição do papel. Para
        restringir o acesso deste usuário a empresas específicas, mude o papel para Coordenador ou
        Operador.
      </div>
    );
  }

  return (
    <div className="stack gap-12">
      {erro && <div className="alert alert-danger">{erro}</div>}
      {salvo && !mudou && <div className="alert alert-ok">Vínculos atualizados.</div>}

      {selecionadas.size === 0 && (
        <div className="alert alert-warn">
          Sem nenhuma empresa vinculada, este usuário <strong>não enxerga nada</strong> no sistema.
        </div>
      )}

      <SelecaoEmpresas
        selecionadas={selecionadas}
        onChange={(next) => {
          setSalvo(false);
          setSelecionadas(next);
        }}
      />

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <Button type="button" variant="primary" disabled={!mudou || salvar.isPending} onClick={handleSalvar}>
          {salvar.isPending ? "Salvando…" : "Salvar vínculos"}
        </Button>
      </div>
    </div>
  );
}
