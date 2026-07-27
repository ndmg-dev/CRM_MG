# Contrato de Integração — Férias (emissor) → Cronos (receptor)

Interface única que **os dois lados implementam igual**. Fonte da verdade do
formato do evento, da assinatura e do identificador. Qualquer mudança aqui deve
ser acordada pelos dois lados.

- **Emissor**: sistema de Férias (Supabase self-hosted, Coolify) via Database
  Webhook (pg_net).
- **Receptor**: Cronos, endpoint `POST /integrations/ferias/webhook`.
- **Integração só por rede.** Sem import de código nem acesso a banco entre repos.

---

## 1. Identificador de colaborador

**E-mail corporativo**, minúsculo e sem espaços (`lower(btrim(email))`).
O Cronos deve casar o colaborador pelo mesmo e-mail. (Férias não possui
CPF/matrícula.)

## 2. Endpoint e transporte

- Método: `POST`
- Header `Content-Type: application/json`
- Header `X-Cronos-Signature: sha256=<hex>` (ver seção 4)
- Timeout do emissor: 8s. Reenvio em caso de falha (idempotência garantida pela
  seção 5 → reenviar é seguro).

## 3. Payload (JSON)

```json
{
  "tenant_id":     "<fixo, combinado>",
  "email":         "colaborador@mendoncagalvao.com.br",
  "ferias_ref_id": "<uuid da solicitação no Férias>",
  "data_inicio":   "2026-08-01",
  "data_fim":      "2026-08-15",
  "status":        "agendada",
  "evento_em":     "2026-07-24T12:34:56Z"
}
```

| Campo | Tipo | Observação |
|---|---|---|
| `tenant_id` | string | Constante combinada (Férias é single-tenant) |
| `email` | string | Chave de correlação do colaborador (lower/trim) |
| `ferias_ref_id` | uuid | `solicitacoes.id`; **chave de deduplicação** |
| `data_inicio` | date `YYYY-MM-DD` | Início do período |
| `data_fim` | date `YYYY-MM-DD` | Fim do período |
| `status` | enum | Ver seção 6 |
| `evento_em` | datetime ISO-8601 UTC `...Z` | Momento da emissão |

**Minimização (LGPD):** nenhum outro dado pessoal é enviado. Nome, setor, motivo
etc. **não** trafegam. O Cronos recalcula horas internamente (não confiar em
valor externo).

## 4. Assinatura HMAC (ponto crítico — implementar idêntico)

Assinatura sobre uma **string canônica**, não sobre o JSON serializado (evita
divergência de serialização entre os lados).

```
base = ferias_ref_id + "\n" + tenant_id + "\n" + email + "\n" +
       data_inicio + "\n" + data_fim + "\n" + status
assinatura = "sha256=" + hex( HMAC_SHA256( base, SEGREDO_COMPARTILHADO ) )
```

- Ordem dos campos é **fixa** e exatamente a acima (definida pelo lado Cronos).
- `evento_em` **NÃO** entra na assinatura (vai no corpo apenas, para auditoria).
- Separador é `\n` (0x0A).
- `data_inicio`/`data_fim` no formato `YYYY-MM-DD`.
- O Cronos: reconstrói `base` a partir dos campos recebidos, recalcula o HMAC com
  o mesmo segredo e compara (comparação em tempo constante). **Rejeitar (401) se
  não bater.** Nunca processar payload sem assinatura válida.

## 5. Idempotência

- `ferias_ref_id` + `status` identifica unicamente uma transição lógica.
- O Cronos deve fazer **upsert idempotente** por `ferias_ref_id` e ignorar
  reprocessamento do mesmo par (`ferias_ref_id`, `status`).
- O emissor também deduplica localmente (não reemite o mesmo par), mas pode
  **reenviar** por retry de rede — o Cronos precisa tolerar duplicatas.

## 6. Máquina de status (valores de `status`)

| status | Quando o Férias emite | Ação esperada no Cronos |
|---|---|---|
| `agendada` | Solicitação de férias **aprovada** | Registrar período; ainda não bloquear |
| `em_andamento` | Job diário, quando `data_inicio = hoje` | **Bloquear ponto** e creditar horas do período |
| `concluida` | Job diário, quando `data_fim < hoje` | Encerrar bloqueio; período cumprido |
| `cancelada` | Aprovada → rejeitada/cancelada | Desfazer agendamento/bloqueio do período |

Observações:
- Início e fim **não existem como status** no Férias hoje — são derivados por job
  diário (por isso chegam como eventos próprios, não como mudança de linha).
- Só há emissão para `tipo_afastamento` = férias (case-insensitive). Outros
  afastamentos não entram nesta integração.

## 7. Segredo compartilhado

- 32 bytes aleatórios, transportados em **base64** (rótulo `base64:...`).
- **Chave do HMAC = os bytes DECODIFICADOS do base64** (não a string base64).
  Os dois lados devem decodificar antes de assinar/validar. ⚠️ confirmar que o
  Cronos faz assim.
- Guardada como **secret de deploy** em cada lado (Férias: Vault; Cronos:
  env/secret), sem o prefixo `base64:`. **Nunca** commitada nem exposta no client.
- Combinar o valor por canal seguro.

## 8. Itens a confirmar pelo lado Cronos

- [ ] Aceita e valida este contrato de payload + assinatura canônica (seção 4)?
- [ ] URL pública/alcançável do endpoint (o Coolify do Férias precisa chegar nela)?
- [ ] Casa colaborador por e-mail (seção 1)?
- [ ] Valor do `tenant_id` fixo a usar?
- [ ] Segredo HMAC combinado por canal seguro?
