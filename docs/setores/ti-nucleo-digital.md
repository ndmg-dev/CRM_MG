# Setor: TI — Núcleo Digital

Aplicações mantidas e/ou usadas primariamente pelo Núcleo Digital.

| Aplicação | Função | Status | Ficha |
|---|---|---|---|
| CRM Mendonça Galvão | Shell/hub central: auth, navegação, gestão de usuários/setores/tarefas | producao | [ficha](../aplicacoes/crm-mg/README.md) |
| CRM MG Backend (API) | API que sustenta o shell + proxy pra 5 sistemas embutidos | producao | [ficha](../aplicacoes/backend-fastapi/README.md) |
| Central de Suporte | Chamados e suporte técnico interno | producao | [ficha](../aplicacoes/central-suporte/README.md) |
| Ponto Admin | Administração do app de ponto eletrônico (integração Cronos) | producao | [ficha](../aplicacoes/ponto-admin/README.md) |
| Processamento Ponto | Processamento de registros de ponto eletrônico | producao | [ficha](../aplicacoes/processar-ponto/README.md) |
| TaskFlow | Gestão de tarefas do time de TI | producao | [ficha](../aplicacoes/taskflow/README.md) |
| MG Prospect | Prospecção automática de clientes | producao | [ficha](../aplicacoes/mg-prospect/README.md) |

## Sobreposições e lacunas

- **TaskFlow vs. Kanban da Central de Suporte**: dois sistemas de
  gerenciamento de tarefas/kanban distintos, mantidos pelo mesmo setor.
  Vale confirmar com o time se são complementares (um pra chamado, outro
  pra tarefa interna geral) ou se há sobreposição real de uso.
- **Ponto Admin vs. Processamento Ponto**: dois sistemas de ponto
  eletrônico separados (um "admin", outro "processamento") — a fronteira
  exata de responsabilidade entre os dois não ficou clara só pelo código
  (ver `docs/PENDENCIAS.md`).
- **Nenhum sistema de TI tem PWA/offline confirmado** — se algum precisa
  funcionar em campo (ex.: ponto), é uma lacuna real (ver auditoria em
  `docs/PENDENCIAS.md`).
