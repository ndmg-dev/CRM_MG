"use client";

import { useMemo } from "react";
import { useIndice } from "./DatasetProvider";
import {
  IconeBalanca,
  IconeCarteira,
  IconeEntrada,
  IconePercentual,
} from "./icons";
import { Card } from "./ui";
import {
  analiseHorizontal,
  calcular,
  calcularPorMes,
  moeda,
  nomeMes,
  percentual,
  percentualComSinal,
  type Metricas,
} from "../lib/metrics";
import { useFiltros } from "../lib/store";

function Sparkline({ valores }: { valores: number[] }) {
  if (valores.length < 2) return <div className="h-8" />;

  const min = Math.min(...valores, 0);
  const max = Math.max(...valores, 0);
  const amplitude = max - min || 1;
  const largura = 100;
  const altura = 28;

  const pontos = valores.map((v, i) => {
    const x = (i / (valores.length - 1)) * largura;
    const y = altura - ((v - min) / amplitude) * altura;
    return [x, y] as const;
  });
  const d = pontos.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const yZero = altura - ((0 - min) / amplitude) * altura;

  return (
    <svg
      viewBox={`0 0 ${largura} ${altura}`}
      preserveAspectRatio="none"
      className="h-8 w-full"
      aria-hidden="true"
    >
      {min < 0 && max > 0 && (
        <line
          x1={0}
          x2={largura}
          y1={yZero}
          y2={yZero}
          stroke="var(--border-strong)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path
        d={d}
        fill="none"
        stroke="var(--gold-soft)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={pontos[pontos.length - 1][0]}
        cy={pontos[pontos.length - 1][1]}
        r={2}
        fill="var(--gold)"
      />
    </svg>
  );
}

interface Kpi {
  rotulo: string;
  descricao: string;
  Icone: (props: { tamanho?: number }) => React.ReactElement;
  valorFormatado: string;
  /** sinal do valor, para cor semântica */
  sinal: number;
  colorir: boolean;
  delta: string;
  deltaPositivo: boolean | null;
  legendaDelta: string;
  serie: number[];
}

export function KpiRow() {
  const indice = useIndice();
  const { escopo, meses, comparacao } = useFiltros();

  const kpis = useMemo<Kpi[]>(() => {
    const periodo = calcular(indice, escopo, meses);
    const porMes = calcularPorMes(indice, escopo, meses);

    const ultimo = porMes[porMes.length - 1];
    const penultimo = porMes.length > 1 ? porMes[porMes.length - 2] : null;

    const legendaDelta =
      comparacao === "mes_a_mes"
        ? penultimo
          ? `${nomeMes(ultimo.mes)} vs. ${nomeMes(penultimo.mes)}`
          : "sem mês anterior"
        : `${nomeMes(ultimo.mes)} vs. média do período`;

    /** Delta de um valor em R$: AH mês a mês ou vs. média do período. */
    const deltaValor = (pega: (m: Metricas) => number): number | null => {
      const serie = porMes.map((p) => pega(p.metricas));
      const atual = pega(ultimo.metricas);
      if (comparacao === "mes_a_mes") {
        return penultimo ? analiseHorizontal(atual, pega(penultimo.metricas)) : null;
      }
      const media = serie.reduce((s, x) => s + x, 0) / serie.length;
      return analiseHorizontal(atual, media);
    };

    /** Delta de margem: diferença em pontos percentuais. */
    const deltaMargem = (
      pega: (m: Metricas) => number | null,
    ): { texto: string; positivo: boolean | null } => {
      const atual = pega(ultimo.metricas);
      let base: number | null;
      if (comparacao === "mes_a_mes") {
        base = penultimo ? pega(penultimo.metricas) : null;
      } else {
        const validos = porMes
          .map((p) => pega(p.metricas))
          .filter((x): x is number => x !== null);
        base = validos.length
          ? validos.reduce((s, x) => s + x, 0) / validos.length
          : null;
      }
      if (atual === null || base === null) return { texto: "—", positivo: null };
      const pp = (atual - base) * 100;
      return {
        texto: `${pp > 0 ? "+" : ""}${pp.toFixed(1).replace(".", ",")} p.p.`,
        positivo: pp >= 0,
      };
    };

    const emReais = (
      rotulo: string,
      descricao: string,
      Icone: Kpi["Icone"],
      pega: (m: Metricas) => number,
      colorir: boolean,
    ): Kpi => {
      const d = deltaValor(pega);
      return {
        rotulo,
        descricao,
        Icone,
        valorFormatado: moeda(pega(periodo)),
        sinal: Math.sign(pega(periodo)),
        colorir,
        delta: percentualComSinal(d),
        deltaPositivo: d === null ? null : d >= 0,
        legendaDelta,
        serie: porMes.map((p) => pega(p.metricas)),
      };
    };

    const emMargem = (
      rotulo: string,
      descricao: string,
      pega: (m: Metricas) => number | null,
    ): Kpi => {
      const d = deltaMargem(pega);
      const atual = pega(periodo);
      return {
        rotulo,
        descricao,
        Icone: IconePercentual,
        valorFormatado: percentual(atual),
        sinal: atual === null ? 0 : Math.sign(atual),
        colorir: true,
        delta: d.texto,
        deltaPositivo: d.positivo,
        legendaDelta,
        serie: porMes.map((p) => (pega(p.metricas) ?? 0) * 100),
      };
    };

    return [
      emReais(
        "Receita líquida",
        "líquida de deduções",
        IconeEntrada,
        (m) => m.receitaLiquida,
        false,
      ),
      emReais(
        "Lucro bruto",
        "receita líquida − custos",
        IconeCarteira,
        (m) => m.lucroBruto,
        false,
      ),
      emMargem("Margem bruta", "lucro bruto / RL", (m) => m.margemBruta),
      emReais(
        "Resultado",
        "bottom line do período",
        IconeBalanca,
        (m) => m.resultado,
        true,
      ),
      emMargem("Margem líquida", "resultado / RL", (m) => m.margemLiquida),
    ];
  }, [indice, escopo, meses, comparacao]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {kpis.map((kpi) => (
        <Card key={kpi.rotulo} className="flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <span className="mt-px text-gold">
              <kpi.Icone tamanho={15} />
            </span>
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
              <span className="text-[11px] tracking-[.08em] text-text-muted uppercase">
                {kpi.rotulo}
              </span>
              <span className="text-[11px] text-text-faint">· {kpi.descricao}</span>
            </div>
          </div>

          <p
            className={`kpi-value text-[28px] leading-none font-semibold ${
              kpi.colorir && kpi.sinal < 0 ? "text-neg" : "text-text"
            }`}
          >
            {kpi.valorFormatado}
          </p>

          <Sparkline valores={kpi.serie} />

          <div className="flex items-baseline gap-1.5">
            <span
              className={`num text-[13px] font-medium ${
                kpi.deltaPositivo === null
                  ? "text-text-faint"
                  : kpi.deltaPositivo
                    ? "text-pos"
                    : "text-neg"
              }`}
            >
              {kpi.delta}
            </span>
            <span className="text-[11px] text-text-faint">{kpi.legendaDelta}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
