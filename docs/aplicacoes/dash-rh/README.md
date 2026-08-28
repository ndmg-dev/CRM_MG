# Dash RH

## 1. Identificação
- **Slug:** `dash-rh` | **Status:** producao | **Criticidade:** media
- **Setor responsável:** DESCONHECIDO

## 2. Função do sistema
DESCONHECIDO — registrado no banco de sistemas com `setor = RESTRITO` (não
um dos setores "normais"), sem descrição no seed disponível. **Pergunta
prioritária para o time:** ver `docs/PENDENCIAS.md`.

## 3. Setores que utilizam
Pessoal/DP (setor `RESTRITO` no cadastro original — ver observação acima)

## 4. Stack utilizada
| Camada | Tecnologia | Versão | Observação |
|---|---|---|---|
| Frontend | React (embutido) | 19.2.6 | |
| Backend | DESCONHECIDO | DESCONHECIDO | nenhuma env var de API nem cliente Supabase encontrado |

## 5. Arquitetura
```mermaid
flowchart LR
  UI["React (frontend/src/systems/dash-rh)"] --> API["Backend DESCONHECIDO"]
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
Setor `RESTRITO` sugere dado sensível de RH (possivelmente salarial ou
disciplinar) — prioridade alta pra esclarecer com o time antes de qualquer
mudança de acesso. Ver `docs/PENDENCIAS.md`.
