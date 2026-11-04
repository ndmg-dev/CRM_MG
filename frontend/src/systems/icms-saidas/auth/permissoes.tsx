// Permissões do módulo (conferidas de novo no backend; aqui só decidem o que mostrar). A pessoa e a sessão são do CRM:
// o nome vem do `authStore` do CRM e as permissões de `GET /icms-saidas/eu`.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { useAuthStore } from "@/stores/authStore";

import { api } from "../api";

export const PERMISSOES = {
  consultar: "icms_saidas.consultar",
  operar: "icms_saidas.operar",
  aprovarLotes: "icms_saidas.aprovar_lotes",
  gerirEmpresas: "icms_saidas.gerir_empresas",
  editarRegras: "icms_saidas.editar_regras",
} as const;

export type Permissao = (typeof PERMISSOES)[keyof typeof PERMISSOES];

export interface ContextoPermissoes {
  nome: string;
  /** ADMIN do CRM: tem tudo e vê a tela de permissões. */
  admin: boolean;
  carregando: boolean;
  pode: (permissao: Permissao) => boolean;
}

/** Exportado para os testes de página montarem permissões fixas. */
export const Contexto = createContext<ContextoPermissoes | null>(null);

interface RespostaEu {
  admin: boolean;
  permissoes: string[];
}

export function ProvedorPermissoes({ children }: { children: ReactNode }) {
  const nome = useAuthStore((s) => s.user?.nome) ?? "";
  const [eu, setEu] = useState<RespostaEu | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    api
      .get<RespostaEu>("/api/eu")
      .then((r) => ativo && setEu(r))
      .catch(() => ativo && setEu({ admin: false, permissoes: [] }))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, []);

  const valor = useMemo<ContextoPermissoes>(() => {
    const concedidas = new Set(eu?.permissoes ?? []);
    return { nome, admin: eu?.admin ?? false, carregando, pode: (p) => concedidas.has(p) };
  }, [nome, eu, carregando]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function usePermissoes(): ContextoPermissoes {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("usePermissoes fora de ProvedorPermissoes");
  return contexto;
}

/** Só renderiza os filhos se a pessoa tem a permissão; senão mostra o aviso (a rota continua existindo, o backend também barra). */
export function RequerPermissao({ permissao, children }: { permissao: Permissao; children: ReactNode }) {
  const { pode, carregando } = usePermissoes();
  if (carregando) return <p className="carregando-tela">Carregando…</p>;
  if (!pode(permissao)) {
    return (
      <p className="carregando-tela" role="alert">
        Você não tem permissão para esta tela. Peça a um administrador do CRM para liberar o acesso.
      </p>
    );
  }
  return <>{children}</>;
}

/** Telas só do ADMIN do CRM (o backend também exige). */
export function RequerAdmin({ children }: { children: ReactNode }) {
  const { admin, carregando } = usePermissoes();
  if (carregando) return <p className="carregando-tela">Carregando…</p>;
  if (!admin) {
    return (
      <p className="carregando-tela" role="alert">
        Só administradores do CRM gerenciam as permissões deste módulo.
      </p>
    );
  }
  return <>{children}</>;
}
