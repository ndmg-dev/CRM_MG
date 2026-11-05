/** Textos de ajuda do painel (fonte única). Conteúdo fiscal reaproveitado do painel e dos documentos; não reescrever. */
export const AJUDA = {
  completa:
    "A planilha traz a memória inteira da empresa. Itens que estão no sistema e não vieram no arquivo aparecem como removidos.",
  parcial: "A planilha traz só itens novos ou alterados. Nada é removido.",
  correcao:
    "Use quando a tributação estava errada. A correção vale para todos os meses, inclusive os já apurados se forem processados de novo.",
  mudanca:
    "Use quando a tributação mudou de verdade a partir de um mês (lei, benefício). Os meses anteriores continuam com a regra antiga.",
  itensNovos: "Produto que ainda não existia na memória. Vale para todos os meses.",
  od: "Outros Débitos: ICMS destacado a menor que o devido. Valor a acrescentar na apuração.",
  ed: "Estorno de Débitos: ICMS destacado a maior que o devido (ou indevido, como em produto ST). Valor a estornar.",
  saldo: "Saldo = OD − ED. Não é o ICMS a recolher.",
  pendencias:
    "Produtos vendidos que não estão na memória. Defina a tributação para que entrem nas próximas apurações.",
  competenciaApurar: "Opcional. Se informada, precisa ser o mesmo mês das notas do arquivo.",
  criarPastas:
    "Garante no Drive, para cada empresa ativa, FISCAL - AUTO / empresa / APURAÇÃO ICMS com Saídas, Apurações, Processados e Erros. Se a pasta da empresa já existe, ela é aproveitada (sem renomear). Nada é apagado. Ao cadastrar uma empresa isso já acontece sozinho.",
  grupoNovos: "Produto que ainda não existia na memória. Vale para todos os meses.",
  grupoAlterados:
    "Item que já está na memória (mesma descrição e NCM) e muda de tributação. Vale conforme a vigência do lote: correção (todos os meses) ou a partir do mês informado. Mudar a descrição ou o NCM aparece como um removido e um novo.",
  grupoRemovidos:
    "Item que está na memória e não veio no arquivo completo. Deixa de valer conforme a vigência do lote.",
  aplicarSelecionados:
    "Grava na memória só os itens marcados. Os desmarcados ficam de fora; para aplicá-los depois, envie o arquivo de novo.",
  // Pendências com sugestão (ADR-010 do motor).
  sugestaoMemoria:
    "Item da memória, na mesma NCM, com descrição igual ou parecida. Idêntico: igual ignorando maiúsculas, acentos e espaços. Parecido: confira antes de aceitar. Aceitar cadastra a descrição da venda na memória com a mesma tributação.",
  grupoFila:
    "Pode aceitar: a memória já tem este produto com a mesma descrição. Conferir: há produtos parecidos, mas a diferença pode mudar a tributação; veja o destaque. Sem sugestão: nada parecido na memória desta NCM.",
  tributacaoEmLote:
    "Escolha uma tributação, marque os produtos que são dela e aplique de uma vez. Item novo vale para todos os meses. O motor confere a categoria; se algo estiver errado, nada é gravado.",
  resumoPendencias:
    "Conta TODAS as pendências abertas, não só as desta página. Idênticas: já têm um item igual na memória (ignorando maiúsculas, acentos e espaços) e podem ser aceitas agora. Ambíguas: há item idêntico, mas com tributações diferentes. Parecidas: confira uma a uma.",
  aceitarTodasIdenticas:
    "Cadastra de uma vez, em todas as páginas, só as pendências 100% idênticas, cada uma com a tributação do item que já está na memória. As outras ficam como estão para você resolver depois.",
  sobrescrever:
    "Desligado (padrão): item que já está na memória permanece como está e só ele é recusado; os demais entram. Ligado: a tributação escolhida substitui a que está na memória.",
  planilhaPendencias:
    "Baixa TODAS as pendências abertas, em planilha da memória. O ICMS já vem preenchido nas idênticas; preencha as demais e envie em Memória como lote parcial.",
  apuracaoParcial:
    "Apura só o que tem tributação na memória e baixa uma planilha com duas abas: GERAL (todos os itens; o que não tem memória fica com o cálculo em branco) e SEM MEMÓRIA (só os itens que faltam cadastrar). Não registra a apuração: não substitui a do mês, não cria pendências e não aparece no Histórico. OD e ED dessa planilha são parciais.",
  completarMemoria:
    "Para a memória montada por código de produto: usa o código como ponte para cadastrar a descrição que o ERP usa nas vendas, com a tributação que o produto já tinha. O código não vira chave. O resultado vira um lote para você revisar e aprovar.",
  completarAcrescimos:
    "Só as linhas novas, em lote parcial (nada é removido). Use quando a memória da empresa já está no sistema.",
  completarCompleta:
    "A memória inteira mais as linhas novas, em lote completo. Use na primeira carga. Remover mais de 5% da memória atual exige confirmação, como sempre.",
  divergenciasCompletar:
    "A descrição da venda já existe na memória, mas com tributação diferente da que o código do produto tinha. Na apuração vale a da descrição: confira cada uma.",
  // Correção da importação da memória (ADR-009 do motor).
  correcaoImportacao:
    "O arquivo tem linhas que o motor não aceita. Resolva abaixo, sem enviar o arquivo de novo: nada é gravado na memória até o lote ser aprovado.",
  categoriaDesconhecida:
    "O texto da coluna ICMS não é uma categoria das regras. Se é só outro nome de uma categoria que já existe (ex.: ST - MONO = ST), aponte qual. Vale só para este lote.",
  categoriaNova:
    "Categoria nova, com cálculo próprio (ex.: uma redução de base diferente), é criada pelo administrador em Regras fiscais. Depois, use Reavaliar lote.",
  ignorarLinhas:
    "Linhas ignoradas não entram no lote: o item delas na memória não é alterado nem removido. Se for vendido, aparece como pendência.",
  linhaInvalida: "Falta descrição, NCM ou ICMS, ou o NCM é inválido. Preencha o que falta ou ignore a linha.",
  conflito: "O mesmo produto (descrição e NCM) aparece com tributações diferentes no arquivo. Escolha a que vale.",
  // Regras fiscais (CONTRATO_API_REGRAS do motor, §2 e §3).
  modoGrupo:
    "PERCENTUAL: ICMS devido = Base × RBC × Alíquota. ST: ICMS próprio devido = 0; devolução com destaque ⇒ estorno integral. SÓ ENTRADA: se aparecer em saída ⇒ conferência manual.",
  rbc: "RBC: percentual da base que é tributado (100% = sem redução). Interna = CFOP 5xxx; interestadual = CFOP 6xxx. Usado como cadastrado, sem arredondar.",
  aliquota: "Alíquota aplicada sobre a base reduzida. Interna = CFOP 5xxx; interestadual = CFOP 6xxx.",
  cstEsperados: "CST aceitos para o grupo; outro CST com valor correto gera ALERTA CST. Vazio = sem alerta.",
  categoria: "Texto aceito na coluna ICMS da memória. Cada categoria aponta para um grupo de cálculo.",
  alias: "Grafia alternativa aceita na memória; o motor grava o nome da categoria correspondente.",
  tratamentoCfop:
    "VENDA: cálculo completo. DEVOLUÇÃO: grupo ST com destaque ⇒ estorno integral; demais mantêm o destacado. CONFORME DESTAQUE: mantém o destacado, sem OD/ED. CFOP fora da tabela ⇒ CFOP NÃO PARAMETRIZADO.",
  tolerancia: "Diferença de até este valor (inclusive) é CORRETO.",
  aliquotasValidas: "Alíquota destacada fora da lista ⇒ ALÍQUOTA INCOMPATÍVEL. Vazia = sem checagem.",
  baseLegal: "Texto que vai em OBSERVAÇÕES no estorno de ST interestadual.",
  correcaoRegras:
    "Use quando a regra estava errada. Corrige todos os meses em que o valor antigo valia, inclusive os já apurados se forem processados de novo.",
  mudancaRegras:
    "Use quando a regra mudou de verdade a partir de um mês. Os meses anteriores continuam com a versão deles.",
} as const;
