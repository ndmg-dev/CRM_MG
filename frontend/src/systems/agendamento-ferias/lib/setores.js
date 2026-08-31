// Lista única de setores de colaborador, compartilhada entre Dashboard,
// Colaboradores, Relatórios e GestaoUsuarios (achado #7 da varredura:
// cada página tinha sua própria cópia, e a de GestaoUsuarios.jsx — que é
// de onde vem o setor gravado na ficha do colaborador — incluía Diretoria/
// Comercial/Operacional que as outras 3 telas não reconheciam, deixando
// esses colaboradores invisíveis no widget de Ocupação por Setor do
// Dashboard e sem opção de filtro em Relatórios).
export const SETORES_COLABORADOR = [
  "Contábil",
  "Departamento Pessoal",
  "Financeiro",
  "Fiscal",
  "Recursos Humanos",
  "Tecnologia da Informação",
  "Diretoria",
  "Comercial",
  "Operacional",
];

export const SIGLAS_SETOR = {
  "Contábil": "CONT",
  "Departamento Pessoal": "DP",
  Financeiro: "FIN",
  Fiscal: "FISC",
  "Recursos Humanos": "RH",
  "Tecnologia da Informação": "TI",
  Diretoria: "DIR",
  Comercial: "COM",
  Operacional: "OPER",
};
