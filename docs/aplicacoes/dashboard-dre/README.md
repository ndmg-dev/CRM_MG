# Dashboard DRE

## 1. Identificação
- **Slug:** `dashboard-dre` | **Status:** producao | **Criticidade:** media
- **Setor responsável:** DESCONHECIDO

## 2. Função do sistema
Dashboard de métricas do DRE (Demonstração do Resultado do Exercício).

## 3. Setores que utilizam
Contábil

## 4. Stack utilizada
| Camada | Tecnologia | Versão | Observação |
|---|---|---|---|
| Frontend | React (embutido) | 19.2.6 | |
| Backend | Proxy via `backend-fastapi` (`dre_proxy`) | — | senha própria (`DASHBOARD_DRE_SENHA`, nunca chega ao browser) |

## 5. Arquitetura
```mermaid
flowchart LR
  UI["React (frontend/src/systems/dashboard-dre)"] --> BE["backend-fastapi\n/dre-proxy"]
  BE -.-> EXT["ndmg-dev/DASH_RAZAO\n(hospedado tambem em dash-razao.vercel.app)"]
```

## 6. Banco de dados
DESCONHECIDO — mediado pelo proxy do backend.

## 7. Autenticação e permissões
Acesso protegido por senha própria do dashboard (`DASHBOARD_DRE_SENHA`,
mantida só server-side no `backend-fastapi`).

## 8. PWA
Perfil DESCONHECIDO | Manifest: DESCONHECIDO | Service worker: DESCONHECIDO | Offline: DESCONHECIDO

## 9. Integrações externas
Nenhuma além do próprio serviço DASH_RAZAO.

## 10. Dependências de outros sistemas internos
- `crm-mg`, `backend-fastapi`

## 11. Variáveis de ambiente
Nenhuma `VITE_*` própria — protegido via proxy do backend
(`DASHBOARD_DRE_SENHA`, ver ficha do `backend-fastapi`).

## 12. Observações de segurança e LGPD
Não trata dado pessoal identificado (dado financeiro agregado). Ver
`docs/PENDENCIAS.md`.
