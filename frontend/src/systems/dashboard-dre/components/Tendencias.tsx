"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Label,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useIndice } from "./DatasetProvider";
import { Card, Eyebrow, Nota } from "./ui";
import {
  calcularPorMes,
  mesesAnomalos,
  moeda,
  moedaCompacta,
  nomeMes,
  percentual,
} from "../lib/metrics";
import { useFiltros } from "../lib/store";

type Modo = "reais" | "margem";

/**
 * Em R$ a receita líquida é uma ordem de grandeza maior que lucro e resultado —
 * num eixo único ela achata justamente as duas linhas que importam. Por isso a
 * receita vai no eixo ESQUERDO e lucro/resultado num eixo DIREITO com escala
 * própria. Os eixos são rotulados para deixar claro que as alturas não são
 * diretamente comparáveis entre si.
 */
const SERIES_REAIS = [
  { chave: "receitaLiquida", rotulo: "Receita líquida", cor: "var(--gold-soft)", tracejada: false, eixo: "esquerdo" },
  { chave: "lucroBruto", rotulo: "Lucro bruto", cor: "var(--gold-deep)", tracejada: false, eixo: "direito" },
  { chave: "resultado", rotulo: "Resultado", cor: "var(--text-muted)", tracejada: true, eixo: "direito" },
] as const;

const SERIES_MARGEM = [
  { chave: "margemBruta", rotulo: "Margem bruta", cor: "var(--gold-soft)", tracejada: false, eixo: "esquerdo" },
  { chave: "margemOperacional", rotulo: "Margem operacional", cor: "var(--gold-deep)", tracejada: false, eixo: "esquerdo" },
  { chave: "margemLiquida", rotulo: "Margem líquida", cor: "var(--text-muted)", tracejada: true, eixo: "esquerdo" },
] as const;

const ESTILO_ROTULO_EIXO = {
  fill: "var(--text-faint)",
  fontSize: 10,
  letterSpacing: "0.06em",
} as const;

/** Folga no topo/base para o rótulo extremo não colar na borda. */
function dominio(valores: number[]): [number, number] {
  const max = Math.max(...valores, 0);
  const min = Math.min(...valores, 0);
  const folga = (max - min || Math.abs(max) || 1) * 0.12;
  return [min < 0 ? min - folga : 0, max + folga];
}

export function Tendencias() {
  const indice = useIndice();
  const { escopo } = useFiltros();
  const [modo, setModo] = useState<Modo>("reais");

  // A tendência sempre mostra o semestre inteiro — recortar o eixo pelo filtro
  // de período esconderia justamente o mês anômalo.
  const { dados, anomalos } = useMemo(() => {
    const porMes = calcularPorMes(indice, escopo, indice.meses);
    const dados = porMes.map(({ mes, metricas }) => ({
      mes,
      rotulo: nomeMes(mes),
      receitaLiquida: metricas.receitaLiquida,
      lucroBruto: metricas.lucroBruto,
      resultado: metricas.resultado,
      margemBruta: metricas.margemBruta === null ? null : metricas.margemBruta * 100,
      margemOperacional:
        metricas.margemOperacional === null ? null : metricas.margemOperacional * 100,
      margemLiquida:
        metricas.margemLiquida === null ? null : metricas.margemLiquida * 100,
    }));
    return { dados, anomalos: mesesAnomalos(porMes) };
  }, [indice, escopo]);

  const emReais = modo === "reais";
  const series = emReais ? SERIES_REAIS : SERIES_MARGEM;

  const dominioEsquerdo = emReais
    ? dominio(dados.map((d) => d.receitaLiquida))
    : ([0, 100] as [number, number]);
  const dominioDireito = dominio(
    dados.flatMap((d) => [d.lucroBruto, d.resultado]),
  );

  const formatarValor = (v: number) => (emReais ? moeda(v) : percentual(v / 100));

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Eyebrow descricao="evolução mensal do semestre">Tendências</Eyebrow>
        <div className="flex gap-1">
          {(["reais", "margem"] as Modo[]).map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => setModo(opcao)}
              aria-pressed={modo === opcao}
              className={`rounded-md px-2.5 py-1 text-[12px] transition-colors ${
                modo === opcao
                  ? "bg-gold-tint text-gold"
                  : "text-text-muted hover:bg-panel-2"
              }`}
            >
              {opcao === "reais" ? "R$" : "%"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dados} margin={{ top: 14, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            {anomalos.map((mes) => (
              <ReferenceArea
                key={mes}
                yAxisId="esquerdo"
                x1={nomeMes(mes)}
                x2={nomeMes(mes)}
                fill="var(--neg)"
                fillOpacity={0.08}
                ifOverflow="extendDomain"
              />
            ))}
            <XAxis
              dataKey="rotulo"
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />

            <YAxis
              yAxisId="esquerdo"
              domain={dominioEsquerdo}
              tickFormatter={(v: number) =>
                emReais ? moedaCompacta(v) : `${v.toFixed(0)}%`
              }
              tick={{ fill: "var(--text-faint)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={78}
            >
              <Label
                value={emReais ? "R$ · receita" : "% · margem"}
                angle={-90}
                position="insideLeft"
                style={{ ...ESTILO_ROTULO_EIXO, textAnchor: "middle" }}
              />
            </YAxis>

            {emReais && (
              <YAxis
                yAxisId="direito"
                orientation="right"
                domain={dominioDireito}
                tickFormatter={(v: number) => moedaCompacta(v)}
                tick={{ fill: "var(--text-faint)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={78}
              >
                <Label
                  value="R$ · lucro/resultado"
                  angle={90}
                  position="insideRight"
                  style={{ ...ESTILO_ROTULO_EIXO, textAnchor: "middle" }}
                />
              </YAxis>
            )}

            <Tooltip
              contentStyle={{
                background: "var(--panel)",
                border: "1px solid var(--border-strong)",
                borderRadius: 10,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--text-muted)" }}
              itemStyle={{ color: "var(--text)" }}
              formatter={(v, nome) => [
                typeof v === "number" ? formatarValor(v) : "—",
                String(nome),
              ]}
            />

            {series.map((s) => (
              <Line
                key={s.chave}
                yAxisId={s.eixo === "direito" && emReais ? "direito" : "esquerdo"}
                type="monotone"
                dataKey={s.chave}
                name={s.rotulo}
                stroke={s.cor}
                strokeWidth={s.tracejada ? 1.5 : 2}
                strokeDasharray={s.tracejada ? "4 3" : undefined}
                dot={{ r: 2.5, fill: s.cor, strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.chave} className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span
              className="inline-block h-0.5 w-4"
              style={{ background: s.cor }}
              aria-hidden="true"
            />
            {s.rotulo}
            {emReais && (
              <span className="text-text-faint">
                · eixo {s.eixo === "direito" ? "dir." : "esq."}
              </span>
            )}
          </span>
        ))}
      </div>

      <div className="mt-3 space-y-2 border-t border-line pt-3">
        {emReais && (
          <Nota>
            Escalas diferentes nos dois eixos: a receita líquida é uma ordem de
            grandeza maior. Compare a forma de cada curva, não a altura entre elas.
          </Nota>
        )}
        {anomalos.length > 0 && (
          <Nota>
            Banda destacada:{" "}
            <span className="text-text-muted">{anomalos.map(nomeMes).join(", ")}</span>{" "}
            · lucro bruto mais de 40% abaixo da média do semestre — assinatura
            típica de ajuste de estoque/inventário lançado no mês. Verificar com o
            contador.
          </Nota>
        )}
      </div>
    </Card>
  );
}
