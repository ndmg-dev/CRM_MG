# Baixa automática por recibo — Obrigações Acessórias

Worker que monitora pastas de rede, lê os recibos que o **Domínio** gera ao
concluir uma tarefa, casa cada um com a entrega parametrizada e dá baixa. O que
não casa com exatamente uma entrega vai para a fila de revisão manual.

## Por que é um serviço separado

O `backend-fastapi` do CRM aponta para o Postgres do CRM. O módulo de Obrigações
é um satélite com **Supabase próprio** (mesmo padrão de `central-suporte` e
`agendamento-ferias`). Este worker precisa falar com esse outro banco, com
`service_role`, e precisa de acesso ao sistema de arquivos onde o Domínio grava
os recibos — duas coisas que não pertencem ao backend do CRM.

## O que ele não faz

- **Não consulta o Onvio nem armazena credencial.** Essa via foi avaliada e
  descartada: RPA com credencial + MFA guardados é risco de LGPD e derrota o
  segundo fator. O gatilho aqui é o artefato que o Domínio já produz.
- **Não baixa no palpite.** Recibo que casa com zero ou mais de uma entrega vai
  para revisão. Um humano decide.

## Segurança

`service_role` **bypassa RLS**. Por isso toda query deste worker filtra
`tenant_id` explicitamente — o RLS é a segunda camada, para o acesso vindo da
aplicação; aqui ela não existe. Ver `repositorio.py`, onde nenhuma consulta é
global.

O `tenant_id` vem da configuração da **pasta monitorada**, nunca do conteúdo do
arquivo: um recibo não escolhe a que escritório pertence.

Recibo carrega CPF e dado fiscal. Não se loga conteúdo do arquivo nem
`nome + CNPJ` juntos — só hash truncado e id da entrega.

## Configuração

```bash
cp .env.example .env     # preencha SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
uv sync                  # ou: pip install -e .
python -m app.main
```

As pastas vêm da tabela `pasta_monitorada` (uma ou mais por tenant), não de
variável de ambiente.

## Ajustar o de-para

O reconhecimento de qual obrigação um recibo representa está na tabela
`recibo_termo`, não no código. Comece por **um** tipo de recibo — o de maior
volume —, valide contra arquivos reais e só então acrescente termos. Enquanto
um termo não existir, aquele recibo cai em revisão manual, que é o
comportamento correto na ausência de certeza.

## Testes

```bash
pytest
```

Os testes do parser usam recibos sintéticos. **Antes de ligar em produção,
rode contra recibos reais do Domínio** — o layout deles é a única fonte de
verdade sobre o que o regex precisa encontrar.
