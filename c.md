# Justificativas — Ponto Admin

## Onde vive

- **Criar rápido, ligada a um registro**: `Reports.tsx` → `JustifyModal`, botão "+ justificar" na tabela de Registros. Só pede Data + Motivo.
- **Gestão completa**: página "Gestão → Justificativas" (`Justifications.tsx`). Lista tudo, filtra por status, aprova/reprova, e tem um modal "Nova justificativa" mais completo (tipo de ocorrência, horário real, anexo, atestado de vários dias).

## Estados

`PENDENTE` (amarelo) → `APROVADO` (verde) ou `REPROVADO` (vermelho). Aprovar/reprovar só é possível enquanto `PENDENTE` (os botões somem depois).

Ao **aprovar** uma justificativa ligada a um `time_log_id`, o backend também marca esse registro de ponto como `status: JUSTIFICADO`.

## Tipos de ocorrência (só no modal completo)

`FALTA_INTEGRAL`, `FALTA_PARCIAL`, `ATRASO`, `SAIDA_ANTECIPADA`, `ABONO`, `LOCAL_EXTERNO` (ponto de fora — coordenador cadastra manualmente pra home office/cliente).

⚠️ **Achado**: o campo "Tipo" e o campo "Horas justificadas" são independentes no formulário — nada impede escolher "Falta integral (dia todo)" e ainda assim preencher horas parciais. Foi visto um caso assim: tipo "Falta integral" com 2.5h preenchidas e motivo mencionando "Atraso". Ainda não decidimos se isso vira validação no formulário ou fica como está.

## Atestado de vários dias

Campo "Até" no modal completo. Se preenchido, **cria um registro por dia** no intervalo (um `POST` por dia, em sequência) — não é um único registro com data de início/fim. Só funciona pra justificativa de dia inteiro (sem horário real preenchido).

## Duplicidade — regra real

**Frontend não valida nada.** Só o backend (`cronosmg`, `POST /justifications`) bloqueia, com uma regra mais estreita do que parece à primeira vista:

```python
dup_query = select(Justification).where(
    Justification.company_id == company.id,
    Justification.employee_id == body.employee_id,
    Justification.date >= day_start,
    Justification.date < day_end,
)
# + mesmo time_log_id (ou ambos sem time_log_id, pra justificativa de dia inteiro)
```

- Bloqueia (`409`) se já existir **qualquer** justificativa (não importa o status — `PENDENTE`, `APROVADO` e `REPROVADO` contam igual) pra **mesma colaboradora + mesma data + mesmo registro** (ou "dia inteiro" contra "dia inteiro").
- **Não bloqueia** entre datas diferentes, nem entre registros diferentes no mesmo dia. Uma colaboradora pode ter várias justificativas pendentes simultâneas, em dias diferentes, sem problema.

## Caso em aberto: 409 aparentemente no dia errado

Reportado: tentativa de lançar justificativa pro **dia 20** de uma colaboradora deu `409`, mas a única justificativa visível na tela era do **dia 19** dela.

Duas hipóteses, nenhuma confirmada ainda (sem acesso ao banco de produção):

1. Já existe um registro do dia 20 escondido pelo filtro de status da tela (ex: um atestado de vários dias 19→20 criado antes, cada dia virou um registro separado).
2. Bug de comparação de data/timezone no backend pegando o dia errado — código revisado (`to_naive_utc`, cálculo de `day_start`/`day_end`) não mostrou nada óbvio, mas não é garantia.

**Ação tomada**: [cronosmg#59](https://github.com/tnunes8/cronosmg/pull/59) — a mensagem do erro 409 agora inclui `id`, `data` e `status` da justificativa que está conflitando, pra dar pra diagnosticar sem consulta manual ao banco na próxima vez que acontecer. Ainda não mergeado/testado.

## Pendente de decisão (não mexido ainda)

A coluna "Justificativa" na tabela de Registros (`MonthlyReportTab.tsx`) hoje só mostra **"✓ Justificado"** genérico quando existe qualquer justificativa pro registro — não diferencia `PENDENTE`/`APROVADO`/`REPROVADO`. A ideia discutida é trocar por um badge colorido com o motivo + status (ex: "Falha no GPS · aprovada" verde, "Sem bateria · pendente" dourado, "Trânsito · recusada" vermelho riscado), usando o `reason` + `status` que a `Justification` já tem — não depende de mudança no backend.
