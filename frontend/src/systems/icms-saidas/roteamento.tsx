// As telas foram escritas com caminhos absolutos do módulo ("/", "/empresas/MM", "/regras"). No CRM o módulo vive em
// `/sistemas/:id/*`; estes componentes trocam só o prefixo, para as telas não saberem onde estão montadas.

import { forwardRef, type ComponentProps } from "react";
import { Link as LinkRR, NavLink as NavLinkRR, Navigate as NavigateRR, useNavigate as useNavigateRR, type NavigateOptions } from "react-router-dom";

import { useNativeSystemBase } from "@/hooks/useNativeSystemBase";

/** "/regras" -> "/sistemas/<id>/regras"; "/" -> "/sistemas/<id>". Outros destinos (relativos, query) passam como vieram. */
export function comBase(base: string, para: string): string {
  if (para === "/") return base;
  return para.startsWith("/") ? `${base}${para}` : para;
}

export function useCaminho(): (para: string) => string {
  const base = useNativeSystemBase();
  return (para) => comBase(base, para);
}

export const Link = forwardRef<HTMLAnchorElement, ComponentProps<typeof LinkRR> & { to: string }>(function Link({ to, ...resto }, ref) {
  return <LinkRR ref={ref} to={useCaminho()(to)} {...resto} />;
});

export function NavLink({ to, ...resto }: ComponentProps<typeof NavLinkRR> & { to: string }) {
  return <NavLinkRR to={useCaminho()(to)} {...resto} />;
}

export function Navigate({ to, ...resto }: ComponentProps<typeof NavigateRR> & { to: string }) {
  return <NavigateRR to={useCaminho()(to)} {...resto} />;
}

export function useNavigate(): (para: string, opcoes?: NavigateOptions) => void {
  const navegar = useNavigateRR();
  const caminho = useCaminho();
  return (para, opcoes) => navegar(caminho(para), opcoes);
}
