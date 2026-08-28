# Copilot Contábil

## 1. Identificação
- **Slug:** `copilot-contabil` | **Status:** producao | **Criticidade:** media
- **Setor responsável:** DESCONHECIDO

## 2. Função do sistema
Copiloto inteligente para tarefas contábeis (descrição do banco de sistemas).

## 3. Setores que utilizam
Contábil

## 4. Stack utilizada
| Camada | Tecnologia | Versão | Observação |
|---|---|---|---|
| Frontend | React (embutido, `App` em `.jsx`) | 19.2.6 | JavaScript/JSX, não TypeScript |
| Backend | Supabase | DESCONHECIDO | |

## 5. Arquitetura
```mermaid
flowchart LR
  UI["React/JSX (frontend/src/systems/copilot-contabil)"] --> SB[("Supabase\nprojeto proprio")]
  UI -.-> IA["IA generativa (fornecedor DESCONHECIDO)"]
```

## 6. Banco de dados
PostgreSQL via Supabase (projeto dedicado). Não detalhado nesta rodada.

## 7. Autenticação e permissões
Supabase Auth. RBAC/papéis: DESCONHECIDO.

## 8. PWA
Perfil DESCONHECIDO | Manifest: DESCONHECIDO | Service worker: DESCONHECIDO | Offline: DESCONHECIDO

## 9. Integrações externas
- IA generativa (fornecedor não confirmado)

## 10. Dependências de outros sistemas internos
- `crm-mg`

## 11. Variáveis de ambiente
| Nome | Obrigatória | Sensível | Descrição |
|---|---|---|---|
| `VITE_COPILOT_SUPABASE_URL` | sim | não | URL do projeto Supabase |
| `VITE_COPILOT_SUPABASE_ANON_KEY` | sim | não | chave anon do Supabase |
| `VITE_COPILOT_API_URL` | não | não | API própria complementar |

## 12. Observações de segurança e LGPD
Pode processar dado contábil de clientes via IA. Retenção não confirmada.
Ver `docs/PENDENCIAS.md`.
