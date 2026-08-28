# Aeronord - Convocações & Recibos

## 1. Identificação
- **Slug:** `aeronord` | **Status:** producao | **Criticidade:** baixa
- **Setor responsável:** DESCONHECIDO

## 2. Função do sistema
Convocações e geração de recibos para o cliente Aeronord (sistema nomeado
por cliente específico, não genérico).

## 3. Setores que utilizam
Pessoal/DP

## 4. Stack utilizada
| Camada | Tecnologia | Versão | Observação |
|---|---|---|---|
| Frontend | React (embutido) | 19.2.6 | |
| Backend | DESCONHECIDO | DESCONHECIDO | nenhuma env var/cliente identificado; `url_producao` aponta pra `lovable.app` |

## 5. Arquitetura
```mermaid
flowchart LR
  UI["React (frontend/src/systems/aeronord)"] --> API["Backend DESCONHECIDO\n(possivelmente Lovable)"]
```

## 6. Banco de dados
DESCONHECIDO.

## 7. Autenticação e permissões
DESCONHECIDO

## 8. PWA
Perfil DESCONHECIDO | Manifest: DESCONHECIDO | Service worker: DESCONHECIDO | Offline: DESCONHECIDO

## 9. Integrações externas
DESCONHECIDO

## 10. Dependências de outros sistemas internos
- `crm-mg`

## 11. Variáveis de ambiente
Nenhuma identificada nesta rodada.

## 12. Observações de segurança e LGPD
Trata dado trabalhista do cliente Aeronord (convocações, recibos). Ver
`docs/PENDENCIAS.md`.
