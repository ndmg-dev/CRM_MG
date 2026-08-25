# Integração Férias → Cronos (lado emissor)

Emite evento sempre que o status de férias de um colaborador muda, para o Cronos
bloquear ponto e creditar horas. Integração **só via rede** (webhook), nunca
import de código ou acesso direto a banco entre os repos.

## Decisões (pré-requisitos confirmados)

| Item | Decisão |
|---|---|
| Identificador comum | **e-mail** (Férias não tem CPF/matrícula) |
| Transições início/fim | **job diário no Férias** (pg_cron) — fonte da verdade |
| Multi-tenant | **tenant_id fixo** (Férias é single-tenant) |
| Mecanismo de sync | **Database Webhook (pg_net)** |

## Pendências de acordo com o lado Cronos (bloqueiam a APLICAÇÃO da Fase 2)

Contrato completo proposto: **[CONTRATO_FERIAS_CRONOS.md](./CONTRATO_FERIAS_CRONOS.md)**
(repassar ao lado Cronos — é a interface única dos dois lados).

- [x] Cronos aceita o contrato (status enum idêntico: agendada/em_andamento/concluida/cancelada)
- [x] Segredo HMAC gerado e combinado (guardado fora do repo; vai no Vault / env do Cronos)
- [x] URL do endpoint (Cronos, oficial): `https://backendponto.nucleodigital.cloud/api/v1/ferias/webhook`
- [x] `tenant_id` (string mapeada pelo Cronos): `mendonca-galvao`
- [x] Assinatura HMAC alinhada à ordem do Cronos (ferias_ref_id, tenant_id, email, data_inicio, data_fim, status; sem evento_em)
- [x] Match de colaborador por e-mail

**Bloqueio restante para aplicar:** o Cronos precisa **publicar o endpoint**
(hoje 404). Só então gravamos os 3 secrets no Vault e aplicamos o SQL.

## Fase 2 — Emissão (DESENHADA, NÃO APLICADA)

SQL proposto: **[proposta_emissao.sql](./integracao-cronos/proposta_emissao.sql)**
— webhook pg_net + HMAC (string canônica) + trigger de aprovação/cancelamento +
job diário pg_cron de início/fim. Idempotente por (ferias_ref_id, status); não
bloqueia a transação principal (pg_net é assíncrono → cobre parte da Fase 3).
Nada roda em produção até o contrato fechar, os secrets entrarem no Vault e você
aprovar. Emissão só para `tipo_afastamento` = férias (case-insensitive).

## Fase 3 — Confiabilidade (DESENHADA, NÃO APLICADA)

No mesmo [proposta_emissao.sql](./integracao-cronos/proposta_emissao.sql):
- **3.1 Não travar o principal**: trigger com `exception when others` — falha na
  integração nunca quebra aprovação/edição de férias. ✅
- **3.2 Log auditável**: `eventos_log` (1 linha por transição) com payload,
  request_id, http_status, entregue, tentativas — rastreável por `ferias_ref_id`. ✅
- **Retry (2.1)**: `conciliar_entregas()` (pg_cron a cada 5 min) captura a resposta
  de `net._http_response` e reenvia falhas com backoff exponencial (teto 10
  tentativas), reusando o mesmo payload assinado. ✅
- **3.3 Painel de sync no CRM**: pendente — fazer DEPOIS de aplicar a emissão
  (tela lendo `integracao_cronos.eventos_log`). Decidido: entra no escopo.

## Fase 4 — Testes ponta a ponta (PENDENTE)
Depende do endpoint do Cronos no ar. Validar: aprovação→agendada, job→em_andamento,
cancelamento→cancelada, job→concluida, reenvio duplicado (idempotência), e falha de
rede (Cronos fora → retry entrega depois).

## Decisão de arquitetura — direção da integração (28/07)

**FériasMG é a fonte única de verdade para férias.** A integração permanece
**unidirecional** (Férias → Cronos), por decisão de processo de RH, não
limitação técnica.

- O RH sempre cadastra/aprova férias no FériasMG (fluxo de aprovação por setor
  já existe aqui). O Cronos recebe e bloqueia o ponto — é somente leitor.
- O botão "Adicionar férias" do Cronos (`origem="admin"`) é para exceção/urgência
  pontual e **não sincroniza de volta** para o FériasMG — quem usar esse botão
  precisa também formalizar a solicitação aqui, se for o caso.
- **Não haverá** endpoint de ingestão no FériasMG nem emissão do lado Cronos.
  Isso evita risco de loop, duplicidade e uma segunda fonte de verdade para
  dado de RH.
- Se essa decisão mudar no futuro, reavaliar com endpoint de ingestão +
  campo `origem` no Cronos para evitar reemissão do que veio via webhook.

---

## Fase 1 — Mapear pontos de mudança de status (CONCLUÍDA)

### Resultado da checagem de dados (SQL de agregados, sem PII)
- total_colaboradores: **50** · email nulo: **0** · email duplicado: **0**
- total_solicitacoes: **1** (status `Aprovada`, tipo `FERIAS`) · colaborador_id nulo: **0**
- **Conclusão**: identificador e-mail é sólido (100% preenchido, único). Sem
  legado a tratar. Cadastro de colaboradores é real; histórico de solicitações
  ainda mínimo.
- **Normalização obrigatória**: `status` e `tipo_afastamento` têm casing
  inconsistente (`Aprovada`, `FERIAS`, `Pendente`, `Rejeitada`/`Reprovada`) →
  filtrar/comparar sempre com `lower(btrim(...))`. Emitir só quando
  `lower(tipo_afastamento)` indicar férias.

---

## Fase 1 — Mapear pontos de mudança de status (registro original)

### Feito
- Mapeadas as tabelas do Supabase de Férias: `solicitacoes`, `colaboradores`,
  `usuarios_sistema`, `regras_setor`, `feriados_coletivas`.
- Schema de `solicitacoes` (via código): `id, colaborador_id, colaborador_nome,
  setor, tipo_afastamento, data_inicio, data_fim, total_dias, status, user_id,
  created_at`.
- `ferias_ref_id` do contrato = `solicitacoes.id`.
- E-mail do colaborador vem de `colaboradores.email` (join por `colaborador_id`).
- **Gap de status confirmado**: hoje `status` só assume Pendente / Aprovada /
  Rejeitada (casing inconsistente). Não há início/fim/cancelamento → serão
  derivados pelo job diário (datas × hoje).
- **`tipo_afastamento`**: emitir somente para férias reais (filtrar os demais
  tipos) — valores exatos a confirmar na checagem de dados.

### Pendente para fechar a fase
- [ ] Checagem de qualidade de dados (contagens, sem PII) — SQL abaixo, rodar no
      SQL editor do Supabase de Férias e colar o resultado.
- [ ] Confirmar valores distintos reais de `status` e `tipo_afastamento`.
- [ ] Tratar dados legados (e-mails nulos/duplicados, `colaborador_id` nulo) se a
      checagem apontar.

### SQL de checagem (somente agregados — sem dados pessoais, LGPD)
```sql
select 'total_colaboradores' m, count(*) v from colaboradores
union all select 'colab_email_nulo', count(*) from colaboradores where email is null or btrim(email)=''
union all select 'colab_email_dup',
  (select count(*) from (select lower(btrim(email)) e from colaboradores
     where email is not null group by 1 having count(*)>1) x)
union all select 'total_solicitacoes', count(*) from solicitacoes
union all select 'solic_colab_id_nulo', count(*) from solicitacoes where colaborador_id is null;

select status as valor, count(*) v from solicitacoes group by status order by v desc;
select tipo_afastamento as valor, count(*) v from solicitacoes group by tipo_afastamento order by v desc;
```
