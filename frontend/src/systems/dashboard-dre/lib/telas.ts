/**
 * Texto explicativo de cada tela — o que ela responde e o que está sendo medido
 * nela, em português corrente.
 *
 * Fica fora dos componentes de propósito: é conteúdo editorial, muda com o
 * vocabulário do cliente, e concentrá-lo aqui evita que a mesma métrica seja
 * descrita de dois jeitos em telas diferentes.
 *
 * 🔴 As definições precisam bater com `metrics.ts`. Se uma fórmula mudar lá,
 * este arquivo muda junto — texto errado sobre número certo é pior que texto
 * nenhum.
 */

import type { Tela } from "./store";

export interface Termo {
  termo: string;
  definicao: string;
}

export interface ExplicacaoTela {
  /** A pergunta que a tela responde, do ponto de vista de quem analisa. */
  pergunta: string;
  /** Uma frase sobre o que está na tela. */
  resumo: string;
  /** O que cada número significa — aberto sob demanda. */
  termos: Termo[];
  /** Armadilhas de leitura: o que a tela NÃO diz. */
  cuidados?: string[];
}

export const EXPLICACOES: Record<Tela, ExplicacaoTela> = {
  "visao-geral": {
    pergunta: "Como este escopo está indo?",
    resumo:
      "Os cinco números de cabeceira do período, a cascata que vai da receita bruta até o resultado, e a evolução mês a mês.",
    termos: [
      {
        termo: "Receita líquida",
        definicao:
          "Receita bruta de vendas menos as deduções sobre ela — impostos, devoluções, descontos (contas 3.1.01 + 3.1.02). É o denominador de todas as margens da tela.",
      },
      {
        termo: "Lucro bruto",
        definicao:
          "Receita líquida menos o custo da mercadoria vendida (3.2). É o que sobra da venda antes de qualquer despesa de operar a empresa.",
      },
      {
        termo: "Resultado",
        definicao:
          "A última linha (conta 3): tudo somado, incluindo despesas operacionais e financeiras. É o lucro ou o prejuízo do período.",
      },
      {
        termo: "Margem bruta e margem líquida",
        definicao:
          "Lucro bruto ÷ receita líquida e resultado ÷ receita líquida. Quando não há receita no período, a margem aparece como travessão (—) em vez de zero.",
      },
      {
        termo: "A variação ao lado de cada número",
        definicao:
          "Compara o último mês do período com o que estiver escolhido no filtro de comparação (o mês anterior ou a média do período). Em margens, a variação é em pontos percentuais — de 2% para 3% são +1 p.p., não +50%.",
      },
      {
        termo: "A cascata (waterfall)",
        definicao:
          "Cada degrau é o que entra ou sai entre a receita bruta e o resultado. As despesas financeiras aparecem em degrau separado das demais operacionais porque estão contidas nelas — juntar os dois contaria a mesma despesa duas vezes.",
      },
    ],
    cuidados: [
      "O gráfico de tendências mostra sempre os seis meses, mesmo com o período filtrado. Recortar o eixo esconderia justamente o mês fora da curva.",
      "No gráfico em reais, a receita usa o eixo da esquerda e lucro/resultado o da direita. Compare o formato das curvas, não a altura entre elas.",
    ],
  },

  comparativo: {
    pergunta: "Qual loja vai melhor, e onde está a diferença?",
    resumo:
      "As unidades de varejo lado a lado nas mesmas cinco métricas, ordenáveis por qualquer coluna, mais o resultado de cada uma em barras.",
    termos: [
      {
        termo: "Quem entra no ranking",
        definicao:
          "Só as unidades de varejo. Elas são comparáveis entre si porque fazem a mesma coisa, no mesmo negócio. Nenhuma está dentro de outra — somar todas dá o varejo inteiro.",
      },
      {
        termo: "A linha do rodapé",
        definicao:
          "O atacado, fora do ranking e sem posição. Ele vende só por convênio, então margem e estrutura de custo dele não se comparam com as das lojas. Está ali como referência de tamanho, não como concorrente.",
      },
      {
        termo: "Barras de resultado",
        definicao:
          "Partem da linha do zero: para a direita, em dourado, quem deu lucro; para a esquerda, em vermelho, quem deu prejuízo. O comprimento é proporcional ao maior valor absoluto da tela.",
      },
      {
        termo: 'Selo "estrutura atípica"',
        definicao:
          "O peso da despesa operacional sobre a receita líquida daquela unidade caiu fora do padrão das outras. Costuma indicar diferença de alocação de custo entre as unidades, não necessariamente ineficiência.",
      },
    ],
    cuidados: [
      "Unidade maior não é unidade melhor: ordene por margem, não por receita, para comparar eficiência.",
      "Todas as colunas respeitam o filtro de meses — trocar o período muda a ordem do ranking.",
    ],
  },

  composicao: {
    pergunta: "Por onde o dinheiro entra e para onde ele vai?",
    resumo:
      "A venda repartida por meio de recebimento, e a despesa operacional repartida por subgrupo, com abertura até as contas analíticas.",
    termos: [
      {
        termo: "Mix de recebimento",
        definicao:
          "Como a venda de mercadorias (conta 3.1.01.01) se divide entre dinheiro, cartões, PIX, cheque e convênio. As fatias sempre somam o total da conta — nada fica de fora.",
      },
      {
        termo: "Por que o mix importa",
        definicao:
          "Cada meio tem um custo e um prazo diferentes: cartão cobra adquirência e demora a cair; convênio é venda a prazo com risco de inadimplência. Duas lojas com a mesma receita podem ter caixas muito diferentes.",
      },
      {
        termo: "Quebra de despesas",
        definicao:
          "Os subgrupos da despesa operacional (conta 3.3) ordenados por tamanho. O percentual é a participação de cada um no total de despesa operacional — não sobre a receita.",
      },
      {
        termo: "Valores negativos",
        definicao:
          "Despesa vem negativa do balancete e o dashboard não inverte sinal. O sinal é a origem do dado, não um erro de leitura.",
      },
    ],
    cuidados: [
      "O atacado vende só por convênio: no escopo dele o mix é uma fatia só, e isso é a realidade do negócio, não falha de dado.",
    ],
  },

  drilldown: {
    pergunta: "De onde exatamente vem esse número?",
    resumo:
      "A árvore completa de contas da DRE, mês a mês, do total até o lançamento analítico — é aqui que se audita qualquer valor visto nas outras telas.",
    termos: [
      {
        termo: "AV (análise vertical)",
        definicao:
          "O peso da conta sobre a receita bruta operacional daquele mês, com 3.1.01 valendo 100%. Responde “quanto isso representa da venda?”.",
      },
      {
        termo: "AH (análise horizontal)",
        definicao:
          "A variação da conta contra o mês selecionado anterior. Responde “isso cresceu ou caiu?”.",
      },
      {
        termo: "Contas TT e NN",
        definicao:
          "TT são totalizadoras (sintéticas) — o valor é a soma das filhas, exibido em tom mais claro. NN são analíticas, onde os lançamentos de fato acontecem.",
      },
      {
        termo: "As colunas AV e AH do fim da tabela",
        definicao:
          "Referem-se ao período acumulado, não a um mês específico.",
      },
    ],
    cuidados: [
      "O total do semestre é a soma dos seis meses. A coluna “saldo final” da planilha original é o saldo de junho, e não bate com o acumulado — o dashboard usa a soma.",
    ],
  },

  insights: {
    pergunta: "O que eu deveria estar olhando primeiro?",
    resumo:
      "Achados gerados por regras fixas sobre o escopo e o período selecionados, classificados por severidade e anotáveis pela equipe.",
    termos: [
      {
        termo: "Como um card aparece",
        definicao:
          "Seis regras rodam automaticamente sobre os números da camada de cálculo — mês fora da curva, empresa deficitária crônica, estrutura de custo atípica, erosão de margem, concentração de recebimento e peso das deduções. Cada uma tem um limiar fixo e auditável.",
      },
      {
        termo: "Severidade",
        definicao:
          "Crítico é padrão estrutural que já custa dinheiro; alerta é desvio que precisa de explicação; info é característica do negócio que vale ter em mente.",
      },
      {
        termo: "Nenhum card não é sinal verde",
        definicao:
          "Significa apenas que os padrões cobertos por estas seis regras não apareceram neste escopo e período. Há silêncios esperados — regra sem pares suficientes para comparar, ou indicador abaixo do limiar.",
      },
      {
        termo: "Anotar e reescrever",
        definicao:
          "Dá para marcar um achado como verificado ou descartado e reescrever o texto do card na linguagem do cliente. A anotação nunca altera cálculo: números, regra e limiar continuam vindo da camada de cálculo, e o texto original pode ser restaurado a qualquer momento.",
      },
    ],
    cuidados: [
      "As regras apontam onde olhar, não a causa. “Fevereiro fora da curva” é a pergunta, não a resposta.",
    ],
  },
};
