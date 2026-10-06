# Integração Processar Ponto -> Domínio Folha via API

> Especificação para execução pelo Claude Code.
> Baseada na documentação oficial pública da Thomson Reuters / Domínio consultada em outubro de 2026.

## 1. Objetivo

Preparar o módulo `frontend/src/systems/processar-ponto`, que continua nativo do CRM, para enviar os resultados calculados do ponto para a Folha do Domínio usando a API oficial de **Lançamento de Rubricas**.

Fluxo desejado:

```text
PDF / folha de ponto
  -> parser existente
  -> regras e cálculos atuais
  -> eventos consolidados
  -> mapeamento de rubricas
  -> API Domínio
  -> Solicitações de Serviços
  -> Lançamentos de Rubricas via API
  -> conferência/gravação no Domínio
  -> folha de pagamento
```

O sistema **não deve enviar batidas brutas**. Deve enviar rubricas consolidadas, por exemplo: HE 50%, HE 100%, falta parcial, falta integral, adicional noturno etc.

## 2. Regras obrigatórias para o Claude Code

1. Antes de alterar arquivos, inspecionar a arquitetura atual.
2. Não criar outro backend para o Processar Ponto.
3. Não transformar o módulo em submodule Git.
4. Manter o Processar Ponto nativo do CRM.
5. Não reescrever o parser atual nem as regras de cálculo, salvo adaptação mínima para expor resultados normalizados.
6. Toda comunicação com a Thomson Reuters deve acontecer no backend.
7. Nunca expor `client_secret`, access token, chave do contador ou `integrationKey` no frontend.
8. Implementar a integração desacoplada do motor de ponto.
9. Criar feature flag `DOMINIO_API_ENABLED=false` por padrão.
10. Criar modo mock para desenvolvimento.
11. Não inventar endpoint, payload ou código de rubrica.
12. Se a coleção Postman mais recente fornecida pela Thomson Reuters divergir deste documento, a coleção oficial prevalece.

## 3. Endpoints oficiais

### Token

```http
POST https://auth.thomsonreuters.com/oauth/token
```

### Conferir a chave enviada pelo contador

```http
GET https://api.onvio.com.br/dominio/integration/v1/activation/info
```

Headers:

```http
Authorization: Bearer <ACCESS_TOKEN>
x-integration-key: <CHAVE_FORNECIDA_PELO_CONTADOR>
```

### Gerar a Integration Key

```http
POST https://api.onvio.com.br/dominio/integration/v1/activation/enable
```

Headers:

```http
Authorization: Bearer <ACCESS_TOKEN>
x-integration-key: <CHAVE_FORNECIDA_PELO_CONTADOR>
```

Resposta esperada:

```json
{
  "integrationKey": "..."
}
```

### Enviar lançamento de rubrica

```http
POST https://api.onvio.com.br/dominio/partner-data/v1/partner-data/payslip-item-inclusion
```

Headers:

```http
Authorization: Bearer <ACCESS_TOKEN>
Integration-Key: <INTEGRATION_KEY>
Client-id: <CLIENT_ID>
Content-Type: application/json
```

No envio final da rubrica **não usar a chave original fornecida pelo contador**. Usar a `integrationKey` gerada pelo endpoint de ativação.

Sucesso documentado:

```http
200 OK
```

A resposta de sucesso pode não possuir body.

## 4. Autenticação do ERP

A Thomson Reuters fornece `Client ID` e `Client Secret` ao integrador.

Contato atualmente publicado:

```text
api.dominio@tr.com
```

Solicitar especificamente:

```text
Integração API - Lançamento de Rubricas da Folha
```

A documentação atual de integração para ERP informa:

```text
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/x-www-form-urlencoded
```

Body:

```text
grant_type=client_credentials
client_id=<CLIENT_ID>
client_secret=<CLIENT_SECRET>
audience=409f91f6-dc17-44c8-a5d8-e0a1bafd8b67
```

Exemplo:

```bash
curl -X POST "https://auth.thomsonreuters.com/oauth/token" \
  -u "${DOMINIO_CLIENT_ID}:${DOMINIO_CLIENT_SECRET}" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=client_credentials" \
  --data-urlencode "client_id=${DOMINIO_CLIENT_ID}" \
  --data-urlencode "client_secret=${DOMINIO_CLIENT_SECRET}" \
  --data-urlencode "audience=409f91f6-dc17-44c8-a5d8-e0a1bafd8b67"
```

A documentação geral ERP informa que o access token é reutilizado pelo ERP, inclusive entre clientes, e não deve ser gerado um token por empresa ou colaborador. Implementar cache e lock para renovação.

Uma página geral da Central mostra um cookie estático em exemplo de Postman. **Não hardcodar cookie de navegador em produção**. Confirmar a coleção Postman atual recebida da Thomson Reuters.

## 5. Leiaute JSON oficial

Campos obrigatórios:

| Campo | Tipo | Regra |
|---|---|---|
| `cpf` | string | CPF do funcionário, 11 dígitos, com ou sem formatação |
| `esocialCategoryCode` | integer | Categoria eSocial, 1 a 999 |
| `admissionDate` | date | `yyyy-MM-dd` |
| `competence` | date | `yyyy-MM-dd` |
| `payslipItemCode` | integer | Código da rubrica já cadastrada no Domínio |
| `reference` | decimal | `0.0001` a `9999.9999` |
| `operationType` | enum | `INSERT` ou `DELETE` |

Campos opcionais:

| Campo | Tipo | Regra |
|---|---|---|
| `missedDays` | array de date | Datas em `yyyy-MM-dd`; se enviado deve ter ao menos 1 item |
| `esocialCode` | string | máximo 30 caracteres |

### Modelo padrão de envio

Exemplo de HE 50% com rubrica 150:

```json
{
  "cpf": "CPF_REAL_DO_COLABORADOR",
  "esocialCategoryCode": 101,
  "admissionDate": "2024-02-01",
  "competence": "2026-09-01",
  "payslipItemCode": 150,
  "reference": 8.35,
  "operationType": "INSERT"
}
```

Exemplo com `missedDays`:

```json
{
  "cpf": "CPF_REAL_DO_COLABORADOR",
  "esocialCategoryCode": 101,
  "admissionDate": "2024-02-01",
  "competence": "2026-09-01",
  "payslipItemCode": 8069,
  "reference": 1.20,
  "operationType": "INSERT",
  "missedDays": ["2026-09-08"]
}
```

Exemplo de exclusão:

```json
{
  "cpf": "CPF_REAL_DO_COLABORADOR",
  "esocialCategoryCode": 101,
  "admissionDate": "2024-02-01",
  "competence": "2026-09-01",
  "payslipItemCode": 150,
  "reference": 8.35,
  "operationType": "DELETE"
}
```

Para exclusão, preferir reaproveitar o payload original persistido, trocando a operação conforme o contrato confirmado no Postman oficial.

## 6. Conversão de horas

O Processar Ponto deve manter durações internamente em minutos inteiros.

```text
8h35 = 515 minutos
```

Nunca usar `8.35` como representação interna principal.

### Domínio configurado como Horas Minutos

```text
horas = total_minutes // 60
minutos = total_minutes % 60
reference = horas + minutos / 100
```

Exemplos:

```text
35 min  -> 0.35
95 min  -> 1.35
515 min -> 8.35
599 min -> 9.59
600 min -> 10.00
```

A parte decimal nunca pode representar mais de 59 minutos.

### Domínio configurado como Horas Decimais

```text
reference = total_minutes / 60
```

Arredondar em no máximo 4 casas:

```text
35 min  -> 0.5833
95 min  -> 1.5833
515 min -> 8.5833
600 min -> 10.0000
```

Cada empresa precisa de:

```text
hours_format = HOURS_MINUTES | DECIMAL_HOURS
```

Bloquear envio de rubrica em horas enquanto isso não estiver configurado.

## 7. Configuração necessária no Domínio

### Onvio Gestão

```text
API
-> Habilitação de Clientes
-> Nova habilitação
-> Funcionalidades
-> Lançamentos de Rubricas - Envio
```

Selecionar as empresas e concluir. O Onvio gera a chave que o escritório fornece ao Processar Ponto.

### Domínio Folha

```text
Controle
-> Parâmetros
-> Geral
-> Personaliza
-> Opções
-> Outros
```

Ativar:

```text
[x] Gerar lançamento de rubricas na folha via API
```

### Rubricas permitidas

```text
Utilitários
-> Importação
-> Configurar Rubricas para Lançamentos via API
```

Regra oficial: somente rubricas cujo cálculo seja do tipo **Lançado** podem ser incluídas.

O Agente de Comunicação também deve estar verde e iniciado no usuário GERENTE.

## 8. Rubricas

Não hardcodar o conjunto completo de rubricas.

Códigos documentados como exemplos/padrões do Domínio:

```text
150  Horas Extras
200  Horas Extras 100%
8069 Horas Faltas Parcial
```

A empresa pode usar códigos customizados. Criar mapeamento por empresa.

Modelo:

```text
dominio_rubric_mappings
-----------------------
id
company_id
internal_event_type
payslip_item_code
description
unit
enabled
created_at
updated_at
```

Enums internos sugeridos:

```text
OVERTIME_50
OVERTIME_100
PARTIAL_ABSENCE
FULL_ABSENCE
NIGHT_ADDITIONAL
DSR
COMMISSION
OTHER
```

Unidade:

```text
HOURS
DAYS
VALUE
PERCENTAGE
```

Nunca criar rubrica automaticamente no Domínio.

## 9. Dados obrigatórios do colaborador

A API exige:

```text
CPF
Categoria eSocial
Data de admissão
```

O PDF pode não conter tudo isso. Reaproveitar cadastro existente do CRM/RH quando possível.

Somente criar tabela complementar se necessário:

```text
dominio_employee_profiles
-------------------------
id
company_id
employee_id
cpf
esocial_category_code
admission_date
esocial_code
enabled
created_at
updated_at
```

Bloquear envio se qualquer dado obrigatório estiver ausente.

## 10. Modelo interno neutro

Criar um modelo independente da Thomson Reuters:

```python
class PayrollEvent:
    employee_id: str
    employee_cpf: str
    competence: date
    event_type: str
    amount_minutes: int | None
    amount_days: Decimal | None
    amount_value: Decimal | None
    missed_days: list[date]
```

Fluxo:

```text
PayrollEvent
-> DominioPayrollMapper
-> DominioPayslipItemRequest
```

Schema externo sugerido:

```python
class DominioPayslipItemRequest:
    cpf: str
    esocialCategoryCode: int
    admissionDate: date
    competence: date
    payslipItemCode: int
    reference: Decimal
    operationType: Literal["INSERT", "DELETE"]
    missedDays: list[date] | None = None
    esocialCode: str | None = None
```

Usar aliases Pydantic se o projeto padroniza snake_case em Python.

## 11. Estrutura sugerida

Adaptar ao padrão real após inspeção.

```text
backend-fastapi/app/
├── integrations/dominio/
│   ├── client.py
│   ├── auth.py
│   ├── mapper.py
│   ├── schemas.py
│   ├── exceptions.py
│   └── service.py
├── models/
│   ├── dominio_integration.py
│   ├── dominio_rubric_mapping.py
│   ├── dominio_export.py
│   └── dominio_export_item.py
├── schemas/dominio.py
└── api/v1/endpoints/dominio.py
```

Frontend:

```text
frontend/src/systems/processar-ponto/
├── api/dominio.ts
├── components/dominio/
│   ├── DominioIntegrationCard.tsx
│   ├── DominioRubricMapping.tsx
│   ├── DominioEmployeeIssues.tsx
│   ├── DominioExportPreview.tsx
│   └── DominioExportHistory.tsx
```

Não duplicar componentes que já existam no CRM.

## 12. Banco

### Integração por empresa

```text
dominio_integrations
--------------------
id
company_id
activation_key_encrypted
integration_key_encrypted
accounting_office_name
client_name
client_document
hours_format
enabled
validated_at
activated_at
last_connection_test_at
created_at
updated_at
```

Se não houver necessidade posterior da activation key, apagá-la depois da geração da Integration Key.

### Exportações

```text
dominio_exports
---------------
id
company_id
competence
status
created_by
created_at
started_at
finished_at
total_items
success_items
failed_items
```

Status:

```text
DRAFT
VALIDATING
READY
SENDING
PARTIAL
SUCCESS
FAILED
CANCELLED
```

Itens:

```text
dominio_export_items
--------------------
id
export_id
employee_id
cpf_masked
internal_event_type
payslip_item_code
reference
operation_type
request_fingerprint
status
http_status
attempt_count
error_code
error_message
sent_at
created_at
updated_at
```

## 13. Idempotência

Gerar fingerprint:

```text
SHA256(
  company_id +
  cpf +
  admission_date +
  esocial_category +
  competence +
  payslip_item_code +
  reference +
  operation_type
)
```

Se o mesmo fingerprint já estiver `SUCCESS`, não reenviar automaticamente.

A UI deve exibir:

```text
Já enviado ao Domínio
```

Como a API documenta `INSERT` e `DELETE`, não existe `UPDATE` documentado.

Correção:

```text
1. recuperar payload original
2. enviar DELETE
3. confirmar sucesso
4. montar payload corrigido
5. enviar INSERT
```

Manter histórico.

## 14. Serviços

```python
class DominioTokenProvider:
    async def get_access_token(self) -> str:
        ...

class DominioApiClient:
    async def get_activation_info(self, activation_key: str):
        ...
    async def enable_activation(self, activation_key: str):
        ...
    async def send_payslip_item(self, payload):
        ...

class DominioPayrollMapper:
    def map_event(self, event, employee, integration, rubric_mapping):
        ...

class DominioPayrollService:
    async def validate_activation_key(self, company_id: str, activation_key: str):
        ...
    async def enable_integration(self, company_id: str, activation_key: str):
        ...
    async def validate_export(self, export_id: str):
        ...
    async def send_export(self, export_id: str, actor_id: str):
        ...
    async def delete_item(self, export_item_id: str, actor_id: str):
        ...
```

## 15. Rotas internas sugeridas

Todas protegidas por autenticação e permissão.

```http
GET    /api/v1/dominio/integration
POST   /api/v1/dominio/integration/validate-key
POST   /api/v1/dominio/integration/enable
DELETE /api/v1/dominio/integration

GET    /api/v1/dominio/rubrics
POST   /api/v1/dominio/rubrics
PUT    /api/v1/dominio/rubrics/{id}
DELETE /api/v1/dominio/rubrics/{id}

GET    /api/v1/dominio/employees/issues

POST   /api/v1/dominio/exports/preview
POST   /api/v1/dominio/exports
GET    /api/v1/dominio/exports
GET    /api/v1/dominio/exports/{id}
POST   /api/v1/dominio/exports/{id}/send

POST   /api/v1/dominio/export-items/{id}/delete
POST   /api/v1/dominio/export-items/{id}/retry
```

## 16. UI de configuração

Criar:

```text
Processar Ponto
-> Configurações
-> Integração Domínio
```

### Conexão

```text
Status: Não configurado / Ativo / Erro

Chave fornecida pelo escritório
[ ******************************** ]

[ Validar chave ]
```

Após validação:

```text
Escritório: ...
Cliente: ...
CNPJ: ...

[ Ativar integração ]
```

### Formato de horas

```text
( ) Horas Minutos
( ) Horas Decimais
```

### Rubricas

```text
Evento interno        Rubrica Domínio   Unidade
Hora extra 50%        [150]             Horas
Hora extra 100%       [200]             Horas
Falta parcial         [8069]            Horas
Falta integral        [    ]            Horas/Dias
Adicional noturno     [    ]            Horas
DSR                    [    ]            Horas/Valor
```

## 17. Preview antes do envio

Exemplo:

```text
FECHAMENTO - SETEMBRO/2026

Colaboradores: 34
Prontos: 32
Com pendências: 2
Eventos: 71

Colaborador | Evento | Resultado | Rubrica | Status
João Silva  | HE 50% | 08:35     | 150     | Pronto
Maria Lima  | Falta  | 01:20     | 8069    | Pronto
Ana Souza   | HE100% | 04:00     | -       | Sem rubrica
```

Botão:

```text
[ Enviar para o Domínio ]
```

Exigir confirmação antes do envio.

## 18. Validações bloqueantes

Bloquear se houver:

```text
CPF ausente ou inválido
categoria eSocial ausente ou fora de 1..999
data de admissão ausente
competência inválida
rubrica não mapeada
rubrica inválida
reference igual a zero
reference > 9999.9999
integração desativada
Integration Key ausente
formato de horas indefinido para evento em horas
inconsistência de ponto pendente
```

`missedDays`:

```text
omitido -> OK
enviado -> pelo menos uma data
```

## 19. Férias, folgas e atestados

Por padrão:

```text
FOLGA
-> afeta o cálculo
-> não envia rubrica automaticamente

FERIAS
-> impede falta/HE indevida
-> não envia rubrica automaticamente

ATESTADO
-> justifica/classifica ausência
-> só envia se houver regra e rubrica configuradas
```

Não presumir que todo evento do ponto vira rubrica.

## 20. Tratamento de erros

Oficialmente documentado:

```http
200 OK
```

Estratégia defensiva:

```text
400 -> não repetir automaticamente
401 -> renovar token uma vez e repetir uma vez
403 -> não repetir automaticamente
404 -> não repetir automaticamente
409 -> não repetir automaticamente
422 -> não repetir automaticamente
429 -> backoff e Retry-After, se houver
5xx -> retry limitado com backoff
```

Máximo sugerido para falhas transitórias: 3 tentativas.

Quando a Thomson Reuters entregar tabela oficial de erros, substituir/enriquecer esta classificação.

## 21. Segurança

`.env.example`:

```env
DOMINIO_API_ENABLED=false
DOMINIO_API_MOCK=true
DOMINIO_CLIENT_ID=
DOMINIO_CLIENT_SECRET=
DOMINIO_API_BASE_URL=https://api.onvio.com.br
DOMINIO_AUTH_URL=https://auth.thomsonreuters.com/oauth/token
DOMINIO_AUDIENCE=409f91f6-dc17-44c8-a5d8-e0a1bafd8b67
```

Nunca versionar `.env`.

Criptografar chaves por empresa.

Nunca logar:

```text
Authorization
access_token
client_secret
activation_key
integration_key
```

Mascarar CPF em logs.

## 22. Auditoria

Registrar:

```text
usuário que iniciou
empresa
competência
data/hora
quantidade de itens
rubricas
resultado por item
tentativas
DELETEs
reenvios
```

Não permitir exclusão física de auditoria por usuário comum.

## 23. Modo mock

Enquanto não houver credenciais:

```env
DOMINIO_API_ENABLED=false
DOMINIO_API_MOCK=true
```

Mock:

```text
activation/info
activation/enable
payslip-item-inclusion
```

Mock de ativação:

```json
{
  "accountingOfficeName": "ESCRITORIO TESTE",
  "clientName": "EMPRESA TESTE LTDA",
  "clientDocument": "00.000.000/0001-00"
}
```

Mock enable:

```json
{
  "integrationKey": "mock-integration-key"
}
```

Envio mock:

```http
200 OK
```

Mostrar badge `MODO TESTE`.

## 24. Testes obrigatórios

### Conversão

```text
35 min  -> 0.35 em Horas Minutos
35 min  -> 0.5833 em Decimal
95 min  -> 1.35 em Horas Minutos
95 min  -> 1.5833 em Decimal
515 min -> 8.35 em Horas Minutos
515 min -> 8.5833 em Decimal
```

### Mapper

```text
OVERTIME_50 -> rubrica configurada
OVERTIME_100 -> rubrica configurada
PARTIAL_ABSENCE -> rubrica configurada
evento sem mapping -> erro bloqueante
```

### Idempotência

```text
primeiro envio -> permitido
segundo envio idêntico -> bloqueado
DELETE -> permitido
novo INSERT depois do DELETE -> permitido
```

### Token

```text
token válido -> reutiliza
token expirado -> renova
duas chamadas simultâneas -> uma renovação
```

## 25. Ordem de execução

1. Mapear arquitetura real.
2. Mapear cadastro de empresa e colaborador.
3. Mapear saída atual do processamento.
4. Criar migrations.
5. Criar schemas.
6. Criar `DominioPayrollMapper`.
7. Criar `DominioTokenProvider`.
8. Criar `DominioApiClient`.
9. Criar activation flow.
10. Criar payslip flow em mock.
11. Criar export/preview.
12. Criar idempotência/auditoria.
13. Criar UI.
14. Criar testes.
15. Receber credenciais/Postman.
16. Homologar com uma empresa e um colaborador.
17. Só depois ativar produção.

## 26. Critérios de aceite

- Processamento atual continua funcionando.
- Configuração é por empresa.
- Chave do contador pode ser validada.
- Integration Key pode ser gerada e armazenada.
- Rubricas são configuráveis.
- CPF, categoria eSocial e admissão são validados.
- Horas Minutos e Horas Decimais funcionam.
- Existe preview.
- `INSERT` e `DELETE` existem.
- Reenvio duplicado é impedido.
- Existe histórico.
- Secrets não chegam ao frontend.
- Token não é gerado por empresa/colaborador.
- Mock funciona.
- Feature flag funciona.
- Testes passam.

## 27. Fontes oficiais

### Documentação Integração API - Lançamento de Rubricas

```text
https://suporte.dominioatendimento.com/central/faces/solucao.html?codigo=12208
```

### Leiaute JSON para envio de lançamentos API

```text
https://suporte.dominioatendimento.com/central/faces/solucao.html?codigo=12209
```

### Como lançar Rubricas via API

```text
https://suporte.dominioatendimento.com/central/faces/solucao.html?codigo=11900
```

### Documentação Integração API para ERPs

```text
https://suporte.dominioatendimento.com/central/faces/solucao.html?codigo=8476
```

### Developer Portal Thomson Reuters

```text
https://developerportal.thomsonreuters.com/onvio-br-accounting-api
```

## 28. Decisão arquitetural final

Não usar scraping, automação de tela, banco direto ou MCP para a integração principal.

Usar:

```text
Processar Ponto
-> backend FastAPI do CRM
-> DominioPayrollService
-> HTTPS
-> API Onvio / Domínio
-> Lançamentos de Rubricas
-> Folha
```

MCP pode existir futuramente apenas como uma camada opcional para agentes operarem funções do próprio Processar Ponto.

---

## Status desta implementação (2026-10-05)

Executado até a etapa 14 do §25 (ordem de execução): migrations, schemas,
mapper, token provider, API client com modo mock, activation flow, preview/
envio de export com idempotência e auditoria, testes automatizados
(`tests/test_dominio_mapper.py`: 17 testes puros, cobrindo exatamente os
casos de conversão/idempotência do §6/§13/§24; `tests/test_dominio_integration.py`:
7 testes de fluxo completo via API, em modo mock, com Postgres descartável
— pulam automaticamente se nenhum banco responder, mesmo padrão de
`tests/test_users_sectors.py`), e a UI em
`frontend/src/systems/processar-ponto/` (tela de configuração por
empresa-cliente — conexão + de-para de rubricas — e o fluxo de
export/preview/envio a partir de um upload já processado, com
cadastro complementar do colaborador inline quando falta CPF/eSocial/
admissão). **Não implementado**: qualquer coisa que dependa de
credenciais reais (etapas 15-17 — homologação e ativação em produção).

Diferença adicional da UI em relação ao §16: ao invés de telas separadas
(`DominioEmployeeIssues.tsx`, `DominioExportHistory.tsx`), o cadastro
complementar do colaborador fica embutido na própria tabela de preview
do export (edição inline na linha com pendência `DADOS_COLABORADOR_INCOMPLETOS`),
e não existe ainda uma tela de histórico de exports — só o export atual
em andamento. Mapeamento dos eventos consolidados a partir do resultado
já processado do Processar Ponto implementado em
`frontend/src/systems/processar-ponto/lib/payrollEvents.ts`: horas
extras 50%/100%, adicional noturno e DSR descontado saem direto do
resumo do colaborador; falta integral/parcial são agregadas a partir
dos registros diários (`PointRecord.status`), com `missedDays`
preenchido só para falta integral.

Diferenças conscientes em relação ao texto acima, decididas durante a
implementação:

- **Nomenclatura em português**: os nomes de tabela usam `cliente_id`
  (não `company_id`), porque o tenant já existente no backend-fastapi é o
  model `Cliente` (`clientes.id`) — não um conceito novo de "company".
- **CPF sempre cifrado em repouso**: `dominio_employee_profiles.cpf` virou
  `cpf_encrypted` (Fernet) + `cpf_masked`, nunca texto plano — não havia
  precedente de cifragem no projeto (ver `ClientToken.token`, que fica em
  texto plano), então esta é a primeira coluna cifrada do backend
  (`app/core/crypto.py`). `DOMINIO_ENCRYPTION_KEY` é nova e obrigatória
  para usar a integração.
- **Alembic de verdade**: o projeto não tinha nenhuma migration versionada
  (schema só por `Base.metadata.create_all`). Esta é a primeira migration
  real (`alembic/versions/2136b6331d55_...py`), e o Dockerfile passou a
  rodar `alembic upgrade head` antes do `uvicorn`.
- **Sem worker/outbox separado**: o envio do export roda inline no próprio
  endpoint (`POST /exports/{id}/enviar`), não num processo/fila separada.
  Simplificação consciente para esta primeira versão — rever se o volume
  de envios justificar depois.
