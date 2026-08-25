"use client";

/**
 * Ícones em SVG inline — sem dependência externa, sem requisição de rede.
 * Traço fino e monocromático: herdam a cor do texto (`currentColor`) para
 * seguir o estado do elemento (mutado, dourado no ativo) em vez de introduzir
 * matiz próprio, como manda o design-system.md §2.
 */

type Props = {
  className?: string;
  /** tamanho em px (largura = altura) */
  tamanho?: number;
};

function Svg({
  children,
  className = "",
  tamanho = 16,
}: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

// --- navegação -------------------------------------------------------------

/** Visão geral — painel dividido em blocos */
export function IconePainel(props: Props) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Svg>
  );
}

/** Comparativo — barras de alturas diferentes lado a lado */
export function IconeBarras(props: Props) {
  return (
    <Svg {...props}>
      <line x1="6" y1="20" x2="6" y2="12" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="18" y1="20" x2="18" y2="9" />
    </Svg>
  );
}

/** Composição — fatia destacada de um todo */
export function IconeDonut(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 8.49 6.03L12 12z" />
    </Svg>
  );
}

/** Drilldown — árvore de contas, do tronco às folhas */
export function IconeArvore(props: Props) {
  return (
    <Svg {...props}>
      <line x1="5" y1="4" x2="5" y2="17" />
      <path d="M5 9h6M5 17h6" />
      <rect x="13" y="6.5" width="8" height="5" rx="1.5" />
      <rect x="13" y="14.5" width="8" height="5" rx="1.5" />
    </Svg>
  );
}

/** Insights — alerta/atenção */
export function IconeAlerta(props: Props) {
  return (
    <Svg {...props}>
      <path d="M10.3 3.9 2.4 17.5a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <line x1="12" y1="9" x2="12" y2="13.5" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </Svg>
  );
}

// --- assistente ------------------------------------------------------------

/**
 * Assistente — balão de conversa com uma interrogação.
 *
 * O balão sozinho lê como "suporte/atendimento"; a interrogação diz que o que se
 * faz aqui é perguntar. Sem faísca nem estrelinha: o design-system não tem esse
 * vocabulário, e o assistente lê números, não os inventa.
 */
export function IconeConversa(props: Props) {
  return (
    <Svg {...props}>
      <path d="M21 11.5a8 8 0 0 1-8 8H8l-4.2 2.3a.5.5 0 0 1-.74-.54L4 17.4a8 8 0 0 1 9-13" />
      <path d="M10.2 8.4a2 2 0 0 1 3.8.9c0 1.4-2 1.7-2 3" />
      <line x1="12" y1="15.2" x2="12.01" y2="15.2" />
    </Svg>
  );
}

/** Fechar — X simples */
export function IconeFechar(props: Props) {
  return (
    <Svg {...props}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </Svg>
  );
}

/** Enviar — seta para cima, convenção de campo de chat */
export function IconeEnviar(props: Props) {
  return (
    <Svg {...props}>
      <line x1="12" y1="19" x2="12" y2="5" />
      <path d="m6 11 6-6 6 6" />
    </Svg>
  );
}

// --- KPIs ------------------------------------------------------------------

/** Receita líquida — entrada de dinheiro */
export function IconeEntrada(props: Props) {
  return (
    <Svg {...props}>
      <path d="M12 3v12" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M4 19h16" />
    </Svg>
  );
}

/** Lucro bruto — saldo em caixa/carteira */
export function IconeCarteira(props: Props) {
  return (
    <Svg {...props}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v1.5" />
      <rect x="3" y="7.5" width="18" height="12" rx="2" />
      <circle cx="16.5" cy="13.5" r="1.2" />
    </Svg>
  );
}

/** Margem — proporção, fatia percentual */
export function IconePercentual(props: Props) {
  return (
    <Svg {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <circle cx="7.5" cy="7.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
    </Svg>
  );
}

/** Resultado — bottom line, o saldo final */
export function IconeBalanca(props: Props) {
  return (
    <Svg {...props}>
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="7" y1="20" x2="17" y2="20" />
      <path d="M4 8h16" />
      <path d="M4 8 1.5 13.5a3 3 0 0 0 5 0Z" />
      <path d="M20 8l-2.5 5.5a3 3 0 0 0 5 0Z" />
    </Svg>
  );
}
