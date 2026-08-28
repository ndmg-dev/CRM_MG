# Sistema de Cálculo de Comissão

## 1. Identificação
- **Slug:** `calculo-comissao` | **Status:** producao | **Criticidade:** baixa
- **Setor responsável:** DESCONHECIDO

## 2. Função do sistema
Cálculo de comissões de vendas.

## 3. Setores que utilizam
Pessoal/DP

## 4. Stack utilizada
| Camada | Tecnologia | Versão | Observação |
|---|---|---|---|
| Frontend | React (embutido) | 19.2.6 | |
| Backend | Nenhum identificado — aparenta ser calculadora 100% client-side | nao_aplicavel | ver `docs/PENDENCIAS.md` |

## 5. Arquitetura
```mermaid
flowchart LR
  UI["React (frontend/src/systems/calculo-comissao)\ncalculo 100% no navegador"]
```

## 6. Banco de dados
Nenhum — sem cliente Supabase nem env var de API encontrado.

## 7. Autenticação e permissões
DESCONHECIDO

## 8. PWA
Perfil DESCONHECIDO | Manifest: DESCONHECIDO | Service worker: DESCONHECIDO | Offline: DESCONHECIDO

## 9. Integrações externas
Nenhuma identificada.

## 10. Dependências de outros sistemas internos
- `crm-mg`

## 11. Variáveis de ambiente
Nenhuma identificada.

## 12. Observações de segurança e LGPD
Se de fato é 100% client-side (a confirmar), não armazena dado pessoal. Ver
`docs/PENDENCIAS.md`.
