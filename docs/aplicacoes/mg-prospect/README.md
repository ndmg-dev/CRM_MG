# MG Prospect

## 1. Identificação
- **Slug:** `mg-prospect` | **Status:** producao | **Criticidade:** media
- **Setor responsável:** TI — Núcleo Digital

## 2. Função do sistema
Prospecção automática de clientes. As páginas internas (staff) foram
migradas pro CRM nativo; as páginas públicas (formulário de interesse,
unsubscribe) continuam no site original.

## 3. Setores que utilizam
TI

## 4. Stack utilizada
| Camada | Tecnologia | Versão | Observação |
|---|---|---|---|
| Frontend | React (embutido) | 19.2.6 | páginas staff apenas |
| Backend | Proxy via `backend-fastapi` (`mgprospect_proxy`) | — | |

## 5. Arquitetura
```mermaid
flowchart LR
  UI["React (frontend/src/systems/mg-prospect)"] --> BE["backend-fastapi\n/mgprospect-proxy"]
  BE -.-> EXT["Backend externo do MG Prospect\n(nao inspecionado)"]
```

## 6. Banco de dados
DESCONHECIDO — mediado pelo proxy do backend-fastapi.

## 7. Autenticação e permissões
DESCONHECIDO

## 8. PWA
Perfil DESCONHECIDO | Manifest: DESCONHECIDO | Service worker: DESCONHECIDO | Offline: DESCONHECIDO

## 9. Integrações externas
Nenhuma identificada além do próprio backend do MG Prospect.

## 10. Dependências de outros sistemas internos
- `crm-mg`, `backend-fastapi`

## 11. Variáveis de ambiente
Nenhuma `VITE_*` própria identificada — comunicação via proxy do backend.

## 12. Observações de segurança e LGPD
Trata dado de leads (nome, e-mail, telefone). Retenção não confirmada. Ver
`docs/PENDENCIAS.md`.
