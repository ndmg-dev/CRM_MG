"use client";

import { useMemo, useState } from "react";
import { useIndice } from "./DatasetProvider";
import { CONTAS, moedaCompacta, nomeMes, valor } from "../lib/metrics";
import { useFiltros } from "../lib/store";
import type { Escopo } from "../lib/types";

function mesmoEscopo(a: Escopo, b: Escopo): boolean {
  if (a.tipo !== b.tipo) return false;
  return a.tipo === "empresa" && b.tipo === "empresa"
    ? a.codigo === b.codigo
    : true;
}

function Chip({
  ativo,
  onClick,
  children,
  title,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={ativo}
      className={`rounded-md px-3 py-1.5 text-[13px] transition-colors ${
        ativo
          ? "bg-gold-tint text-gold"
          : "text-text-muted hover:bg-panel-2 hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Chip de escopo: rótulo, receita bruta e origem, sempre nessas três linhas.
 *
 * A receita na própria opção é o que faz o filtro se explicar sozinho — o
 * contador lê "Grupo total R$ 122,6 mi = Varejo R$ 109,3 mi + Atacado
 * R$ 13,3 mi" sem clicar em nada.
 *
 * Largura e estrutura fixas de propósito: chips de tamanhos diferentes viram
 * uma escada, e a comparação visual entre os valores — que é metade da
 * utilidade de mostrá-los — depende de eles se alinharem.
 */
function ChipEscopo({
  ativo,
  onClick,
  rotulo,
  origem,
  receita,
  title,
}: {
  ativo: boolean;
  onClick: () => void;
  rotulo: string;
  /**
   * De onde o número sai na planilha.
   *
   * 🔴 Não é enfeite: o rótulo humano ("Varejo") não existe no arquivo. Sem
   * essa pista, quem for conferir não sabe onde procurar — e já houve quem
   * concluísse que uma aba tinha ficado de fora da análise.
   *
   * Cabe numa linha só, truncando: a composição completa fica no `title` e no
   * painel de explicação, onde há espaço para ela.
   */
  origem: string;
  receita: number;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={ativo}
      className={`w-[148px] rounded-md border px-3 py-2 text-left transition-colors ${
        ativo
          ? "border-gold-dim bg-gold-tint text-gold"
          : "border-line text-text-muted hover:border-line-strong hover:bg-panel-2 hover:text-text"
      }`}
    >
      <span className="block truncate text-[13px] leading-tight font-medium">
        {rotulo}
      </span>
      <span
        className={`mt-1 block text-[15px] leading-none tabular-nums ${
          ativo ? "text-gold" : "text-text"
        }`}
      >
        {moedaCompacta(receita)}
      </span>
      <span
        className={`mt-1 block truncate text-[10px] ${
          ativo ? "text-gold-soft" : "text-text-faint"
        }`}
      >
        {origem}
      </span>
    </button>
  );
}

/**
 * Rótulo de um bloco de escopos, com a pergunta que ele responde.
 *
 * `shrink-0` porque os chips têm largura fixa: deixar o bloco encolher
 * espremeria os chips e quebraria o alinhamento dos valores entre blocos. Em
 * tela estreita a linha inteira quebra, o que preserva a comparação.
 */
function Bloco({
  titulo,
  ajuda,
  children,
}: {
  titulo: string;
  ajuda: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-1.5">
      <span className="text-[11px] text-text-faint">
        <span className="text-text-muted">{titulo}</span> · {ajuda}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/**
 * Conector entre os blocos — deixa a aritmética visível: o grupo total É o
 * varejo mais o atacado, que É a soma das unidades.
 *
 * Alinhado pela altura do chip (não pelo centro do bloco) para não flutuar
 * acima dos valores quando o rótulo do bloco ocupa duas linhas.
 */
function Conector({ simbolo }: { simbolo: string }) {
  return (
    <div
      aria-hidden
      className="hidden pt-[42px] text-[13px] text-text-faint lg:block"
    >
      {simbolo}
    </div>
  );
}

export function Filtros() {
  const indice = useIndice();
  const {
    escopo,
    meses,
    comparacao,
    setEscopo,
    setMeses,
    alternarMes,
    setComparacao,
  } = useFiltros();
  const [explicando, setExplicando] = useState(false);

  // Receita bruta de cada escopo no período selecionado — é o que cada chip
  // mostra. Recalcula ao trocar o período para não exibir número de outra tela.
  const rb = useMemo(() => {
    const de = (e: Escopo) => valor(indice, e, CONTAS.receitaBruta, meses);
    return {
      total: de({ tipo: "grupo_total" }),
      lojas: de({ tipo: "soma_lojas" }),
      por: Object.fromEntries(
        indice.unidades.map((codigo) => [codigo, de({ tipo: "empresa", codigo })]),
      ) as Record<string, number>,
    };
  }, [indice, meses]);

  const fatia = (v: number) =>
    rb.total ? `${((v / rb.total) * 100).toFixed(0)}% do grupo` : "";

  const todosMeses = indice.meses;
  const semestreInteiro = meses.length === todosMeses.length;

  return (
    <section className="flex flex-col gap-5 border-b border-line pb-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-[11px] tracking-[.08em] text-text-muted uppercase">
            De qual parte do grupo são os números
          </span>
          <button
            type="button"
            onClick={() => setExplicando((v) => !v)}
            aria-expanded={explicando}
            className="text-[11px] text-text-faint underline decoration-dotted underline-offset-4 hover:text-gold"
          >
            {explicando ? "ocultar explicação" : "como o grupo é organizado?"}
          </button>
        </div>

        {explicando && (
          <p className="max-w-[70ch] rounded-md border border-line bg-panel-2 p-3 text-[11px] leading-relaxed text-text-faint">
            O grupo é um conjunto de{" "}
            <strong className="text-text-muted">
              {indice.unidades.length} unidades irmãs
            </strong>
            : nenhuma está dentro de outra, então somá-las é somar dinheiro
            diferente. {indice.varejo.join(", ")} são de{" "}
            <strong className="text-text-muted">varejo</strong>;{" "}
            {indice.atacado.join(", ")}{" "}
            {indice.atacado.length > 1 ? "são de" : "é de"}{" "}
            <strong className="text-text-muted">atacado</strong> — negócio
            diferente, que vende só por convênio, sem dinheiro, cartão nem PIX.
            Por isso o ranking de desempenho compara só as de varejo: pôr o
            atacado ao lado delas compara coisas que não se parecem.
          </p>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-start lg:gap-x-3">
          <Bloco titulo="Tudo" ajuda={`as ${indice.unidades.length} unidades`}>
            <ChipEscopo
              ativo={mesmoEscopo(escopo, { tipo: "grupo_total" })}
              onClick={() => setEscopo({ tipo: "grupo_total" })}
              rotulo="Grupo total"
              // A lista inteira de abas não cabe num chip; vira contagem aqui,
              // e a composição completa fica no title e na explicação.
              origem={`${indice.unidades.length} unidades`}
              receita={rb.total}
              title={`${indice.unidades.join(" + ")} — todas as unidades somadas`}
            />
          </Bloco>

          <Conector simbolo="=" />

          <Bloco titulo="Por segmento" ajuda="dois negócios diferentes">
            <ChipEscopo
              ativo={mesmoEscopo(escopo, { tipo: "soma_lojas" })}
              onClick={() => setEscopo({ tipo: "soma_lojas" })}
              rotulo="Varejo"
              origem={`${indice.varejo.length} unidades · ${fatia(rb.lojas)}`}
              receita={rb.lojas}
              title={`${indice.varejo.join(" + ")} — as unidades de varejo somadas`}
            />
            {indice.atacado.map((codigo) => (
              <ChipEscopo
                key={codigo}
                ativo={mesmoEscopo(escopo, { tipo: "empresa", codigo })}
                onClick={() => setEscopo({ tipo: "empresa", codigo })}
                rotulo="Atacado"
                origem={`${codigo} · ${fatia(rb.por[codigo])}`}
                receita={rb.por[codigo]}
                title={`${codigo} — atacado, vende só por convênio`}
              />
            ))}
          </Bloco>

          <Conector simbolo="=" />

          <Bloco titulo="Unidade a unidade" ajuda="as de varejo, separadas">
            {indice.varejo.map((codigo) => (
              <ChipEscopo
                key={codigo}
                ativo={mesmoEscopo(escopo, { tipo: "empresa", codigo })}
                onClick={() => setEscopo({ tipo: "empresa", codigo })}
                rotulo={codigo}
                origem={fatia(rb.por[codigo])}
                receita={rb.por[codigo]}
                title={`${codigo} — uma das unidades de varejo`}
              />
            ))}
          </Bloco>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] tracking-[.08em] text-text-muted uppercase">
            Meses somados nos números
          </span>
          <div className="flex flex-wrap gap-1">
            {todosMeses.map((mes) => (
              <Chip
                key={mes}
                ativo={meses.includes(mes)}
                onClick={() => alternarMes(mes)}
                title={`Incluir ou tirar ${nomeMes(mes)} da soma`}
              >
                {nomeMes(mes)}
              </Chip>
            ))}
            <Chip
              ativo={semestreInteiro}
              onClick={() => setMeses(todosMeses)}
              title="Voltar a somar os seis meses"
            >
              semestre inteiro
            </Chip>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px] tracking-[.08em] text-text-muted uppercase">
            A variação dos KPIs é contra o quê
          </span>
          <div className="flex flex-wrap gap-1">
            <Chip
              ativo={comparacao === "mes_a_mes"}
              onClick={() => setComparacao("mes_a_mes")}
              title="Compara o último mês do período com o mês imediatamente anterior (análise horizontal)"
            >
              o mês anterior
            </Chip>
            <Chip
              ativo={comparacao === "vs_media"}
              onClick={() => setComparacao("vs_media")}
              title="Compara o último mês do período com a média dos meses selecionados"
            >
              a média do período
            </Chip>
          </div>
        </div>
      </div>
    </section>
  );
}
