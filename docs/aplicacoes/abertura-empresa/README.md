# Abertura de Empresa

## 1. Identificação
- **Slug:** `abertura-empresa` | **Status:** producao | **Criticidade:** media
- **Setor responsável:** DESCONHECIDO

## 2. Função do sistema
Gerenciamento de abertura de novas empresas.

## 3. Setores que utilizam
Societário

## 4. Stack utilizada
| Camada | Tecnologia | Versão | Observação |
|---|---|---|---|
| Frontend | React (embutido) | 19.2.6 | |
| Backend | Proxy via `backend-fastapi` (`abertura_empresa_proxy`) | — | |

## 5. Arquitetura
```mermaid
flowchart LR
  UI["React (frontend/src/systems/abertura-empresa)"] --> BE["backend-fastapi\n/abertura-empresa-proxy"]
  BE -.-> EXT["Backend externo\n(nao inspecionado)"]
```

## 6. Banco de dados
DESCONHECIDO — mediado pelo proxy do backend.

## 7. Autenticação e permissões
DESCONHECIDO

## 8. PWA
Perfil DESCONHECIDO | Manifest: DESCONHECIDO | Service worker: DESCONHECIDO | Offline: DESCONHECIDO

## 9. Integrações externas
Nenhuma identificada além do backend próprio.

## 10. Dependências de outros sistemas internos
- `crm-mg`, `backend-fastapi`

## 11. Variáveis de ambiente
Nenhuma `VITE_*` própria — mediado pelo proxy.

## 12. Observações de segurança e LGPD
Trata dado societário/pessoal (nome, CPF de sócios). Ver `docs/PENDENCIAS.md`.
