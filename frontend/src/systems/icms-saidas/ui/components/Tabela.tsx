import type { ReactNode } from "react";

import "./tabela.css";

export type Coluna<T> = {
  chave: string;
  titulo: ReactNode;
  /** Números à direita. */
  alinhar?: "inicio" | "fim";
  /** Classe extra da célula (ex.: "tabela__valor--od"). */
  classe?: string;
  celula: (linha: T) => ReactNode;
};

export type TipoEstado = "vazio" | "filtro-sem-resultado" | "carregando" | "erro";

type PropsEstado = {
  tipo: TipoEstado;
  titulo: ReactNode;
  texto?: ReactNode;
  acao?: ReactNode;
};

/**
 * Estado de uma tabela (ou de uma área sem tabela, como "Nenhuma empresa cadastrada").
 * Carregando: texto em `role="status"`; erro: `role="alert"` com a ação "Tentar de novo" vinda de quem usa.
 */
export function EstadoTabela({ tipo, titulo, texto, acao }: PropsEstado) {
  const papel = tipo === "erro" ? "alert" : tipo === "carregando" ? "status" : undefined;
  return (
    <div className="estado-tabela" data-tipo={tipo} role={papel}>
      <p className="estado-tabela__titulo">{titulo}</p>
      {texto && <p className="estado-tabela__texto">{texto}</p>}
      {acao && <div className="estado-tabela__acao">{acao}</div>}
    </div>
  );
}

type Props<T> = {
  /** Nome da região rolável (lido por leitores de tela). */
  rotulo: string;
  colunas: Coluna<T>[];
  linhas?: T[];
  chaveLinha?: (linha: T) => string;
  /** Atributos da linha (classe ou data-*), para estados como "pendente" ou "desmarcada". */
  atributosLinha?: (linha: T) => { className?: string; [dado: `data-${string}`]: string | undefined };
  /** Corpo próprio (ex.: linhas agrupadas do lote); substitui `linhas`. */
  corpo?: ReactNode;
  /** Estado no lugar das linhas; "carregando" mostra 6 linhas de esqueleto. */
  estado?: PropsEstado | null;
  linhasEsqueleto?: number;
  rodape?: ReactNode;
  /** Largura mínima da tabela antes de rolar na horizontal. */
  larguraMinima?: 640 | 800 | 980 | 1100;
  densidade?: "painel" | "lote";
};

/** Tabela real (`<th scope>`) num contêiner rolável e focável, com estados vazio, filtro sem resultado, carregando e erro. */
export function Tabela<T>({
  rotulo,
  colunas,
  linhas = [],
  chaveLinha,
  atributosLinha,
  corpo,
  estado,
  linhasEsqueleto = 6,
  rodape,
  larguraMinima,
  densidade = "painel",
}: Props<T>) {
  const carregando = estado?.tipo === "carregando";
  return (
    <div
      className="tabela"
      role="region"
      aria-label={rotulo}
      tabIndex={0}
      aria-busy={carregando || undefined}
      data-largura-minima={larguraMinima}
      data-densidade={densidade}
    >
      <table>
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c.chave} scope="col" data-alinhar={c.alinhar}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        {estado ? (
          <tbody>
            <tr className="tabela__linha-estado">
              <td colSpan={colunas.length}>
                <EstadoTabela {...estado} />
              </td>
            </tr>
            {carregando &&
              Array.from({ length: linhasEsqueleto }, (_, i) => (
                <tr key={i} className="tabela__esqueleto" aria-hidden="true">
                  {colunas.map((c) => (
                    <td key={c.chave} data-alinhar={c.alinhar}>
                      <span className="esqueleto" />
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        ) : (
          (corpo ?? (
            <tbody>
              {linhas.map((linha, i) => (
                <tr key={chaveLinha ? chaveLinha(linha) : i} {...atributosLinha?.(linha)}>
                  {colunas.map((c) => (
                    <td key={c.chave} data-alinhar={c.alinhar} className={c.classe}>
                      {c.celula(linha)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))
        )}
        {rodape && !estado && <tfoot>{rodape}</tfoot>}
      </table>
    </div>
  );
}

/** Título de coluna de valor (OD/ED) com o marcador de cor da planilha; o resto da linha segue em texto normal. */
export function TituloValor({ tipo, children }: { tipo: "od" | "ed"; children: ReactNode }) {
  return (
    <span className="rotulo-com-ajuda">
      <span className="tabela__marcador" data-tipo={tipo} aria-hidden="true" />
      {children}
    </span>
  );
}
