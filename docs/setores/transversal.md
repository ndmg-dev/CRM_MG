# Setor: Transversal (usado por múltiplos/todos os setores)

| Aplicação | Função | Status | Ficha |
|---|---|---|---|
| CRM Mendonça Galvão | Shell/hub central de todo o ecossistema | producao | [ficha](../aplicacoes/crm-mg/README.md) |
| CRM MG Backend (API) | API que sustenta o shell | producao | [ficha](../aplicacoes/backend-fastapi/README.md) |
| Central de Suporte | Chamados e suporte técnico — usado por todos os setores como solicitante | producao | [ficha](../aplicacoes/central-suporte/README.md) |
| Obrigações Acessórias | Controle de entregas/prazos/documentos de cliente | desenvolvimento | [ficha](../aplicacoes/obrigacoes/README.md) |
| Obrigações — Worker de Recibos | Serviço auxiliar do Obrigações Acessórias | DESCONHECIDO | [ficha](../aplicacoes/obrigacoes-recibo/README.md) |
| Ouvidoria Interna (RH) | Canal de ouvidoria interna | producao | [ficha](../aplicacoes/ouvidoria/README.md) |
| Agendamento de Férias | Também usado de forma transversal (todo colaborador agenda férias), além de ser ferramenta do DP | producao | [ficha](../aplicacoes/agendamento-ferias/README.md) |

## Sobreposições e lacunas

- `Obrigações Acessórias` ainda está em `status: desenvolvimento` e sem URL
  de produção própria (`url` = `#` no banco de sistemas) — não tratar como
  disponível pro escritório inteiro ainda.
- `Central de Suporte` é o único sistema deste grupo com documentação
  completa (README + INSTALACAO + BANCO) nesta rodada, por já ter sido
  trabalhado a fundo nesta sessão — os demais têm só a ficha resumida.
