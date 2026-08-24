import type { FaqItem } from '../types';

/**
 * Fallback local do FAQ, usado antes de a API estar disponível (seção 6).
 * Reflete o seed da seção 7 da spec. ⚠️ Textos placeholder — validar com o
 * time contábil antes de produção.
 */
export const faqMock: FaqItem[] = [
  {
    id: 1,
    orderIndex: 1,
    category: 'Rescisão',
    question: 'Quando termina uma rescisão de contrato de trabalho?',
    answer:
      'O acerto rescisório deve ocorrer em até 10 dias corridos contados a partir do término do contrato, tanto no aviso prévio trabalhado quanto no indenizado (art. 477, §6º da CLT). Pode variar conforme a convenção coletiva — confirme com o contador responsável.',
  },
  {
    id: 2,
    orderIndex: 2,
    category: 'Adiantamento',
    question: 'Como funciona o cálculo do adiantamento salarial?',
    answer:
      'O adiantamento (vale) é um percentual do salário pago no meio do mês, tipicamente entre 30% e 40% do salário base, conforme política da empresa ou convenção coletiva. É descontado na folha do fechamento do mês.',
  },
  {
    id: 3,
    orderIndex: 3,
    category: 'Admissão',
    question: 'Quais documentos são necessários para a admissão de um funcionário?',
    answer:
      'Em geral: RG/CNH e CPF, Carteira de Trabalho (CTPS digital), comprovante de residência, foto, dados bancários, comprovante de escolaridade, certidões de nascimento/casamento e de filhos, e o atestado de saúde ocupacional (ASO admissional). Pode variar conforme a função.',
  },
  {
    id: 4,
    orderIndex: 4,
    category: '13º Salário',
    question: 'Quais os prazos para pagamento do 13º salário?',
    answer:
      'A primeira parcela deve ser paga entre 1º de fevereiro e 30 de novembro; a segunda até 20 de dezembro. Sobre a segunda parcela incidem INSS e IRRF.',
  },
  {
    id: 5,
    orderIndex: 5,
    category: 'Rescisão',
    question: 'Como funciona o aviso prévio (trabalhado x indenizado)?',
    answer:
      'No trabalhado, o empregado cumpre o período (mínimo 30 dias + 3 por ano trabalhado, até 90) e pode reduzir 2h/dia ou faltar 7 dias corridos. No indenizado, a empresa dispensa o cumprimento e paga o valor correspondente, integrando o tempo para férias e 13º.',
  },
  {
    id: 6,
    orderIndex: 6,
    category: 'Encargos',
    question: 'O que é e como calcular o FGTS?',
    answer:
      'O FGTS é um depósito mensal do empregador em conta vinculada ao trabalhador, de 8% da remuneração bruta (2% para aprendiz). Não é descontado do salário. Em demissão sem justa causa há multa de 40% sobre o saldo.',
  },
  {
    id: 7,
    orderIndex: 7,
    category: 'Férias',
    question: 'O que são as férias proporcionais e como são calculadas?',
    answer:
      'Correspondem a 1/12 do período de férias por mês trabalhado (frações de 15+ dias contam como mês completo), acrescidas do terço constitucional (1/3). São devidas na rescisão.',
  },
  {
    id: 8,
    orderIndex: 8,
    category: 'Rescisão',
    question: 'Como solicitar o exame demissional?',
    answer:
      'O ASO demissional deve ser feito antes do desligamento, salvo se o último exame ocupacional tiver menos de 135 dias (risco 1 e 2) ou 90 dias (risco 3 e 4). A empresa agenda com a clínica conveniada.',
  },
  {
    id: 9,
    orderIndex: 9,
    category: 'Afastamento',
    question: 'O que fazer em caso de afastamento por atestado médico?',
    answer:
      'Nos primeiros 15 dias o pagamento é da empresa. A partir do 16º dia, o colaborador é encaminhado ao INSS para o auxílio por incapacidade temporária. O atestado deve ser entregue ao DP no prazo da política interna.',
  },
  {
    id: 10,
    orderIndex: 10,
    category: 'Encargos',
    question: 'Quais encargos incidem sobre a folha de pagamento (INSS, IRRF)?',
    answer:
      'Sobre o salário incidem INSS (7,5% a 14%, progressivo) e IRRF (tabela progressiva). Do lado do empregador há a contribuição patronal, FGTS (8%), RAT e contribuições a terceiros. As faixas são atualizadas anualmente — confirme a tabela vigente.',
  },
];
