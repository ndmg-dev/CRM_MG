import { useId, type ReactNode } from "react";

import "./filtros.css";

/** `icone`: marca decorativa antes do rótulo (ex.: amostra de cor da situação). */
export type OpcaoFiltro<T extends string> = { valor: T; rotulo: string; contagem?: number; icone?: ReactNode };

/** Grupo segmentado de filtros: botões com `aria-pressed` (um ativo por vez). */
export function GrupoFiltro<T extends string>({
  rotulo,
  opcoes,
  valor,
  onChange,
  ajuda,
}: {
  rotulo: string;
  opcoes: OpcaoFiltro<T>[];
  valor: T;
  onChange: (valor: T) => void;
  ajuda?: ReactNode;
}) {
  return (
    <div className="grupo-filtro">
      <div className="grupo-filtro__opcoes" role="group" aria-label={rotulo}>
        {opcoes.map((o) => (
          <button
            key={o.valor}
            type="button"
            className="grupo-filtro__opcao"
            aria-pressed={o.valor === valor}
            onClick={() => onChange(o.valor)}
          >
            {o.icone}
            {o.rotulo}
            {o.contagem !== undefined && <span className="grupo-filtro__contagem">{o.contagem.toLocaleString("pt-BR")}</span>}
          </button>
        ))}
      </div>
      {ajuda}
    </div>
  );
}

/** Campo de busca com rótulo visível. */
export function CampoBusca({
  rotulo,
  valor,
  onChange,
  placeholder,
}: {
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="campo-busca">
      <label htmlFor={id}>{rotulo}</label>
      <input id={id} type="search" maxLength={60} autoComplete="off" placeholder={placeholder} value={valor} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** Linha de filtros (quebra no celular). */
export function BarraFiltros({ children }: { children: ReactNode }) {
  return <div className="barra-filtros">{children}</div>;
}
