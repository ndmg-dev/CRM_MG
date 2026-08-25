# Obrigações Acessórias

Controle de entrega de obrigações acessórias, com portal do cliente. Sistema
satélite do CRM, no mesmo padrão de `central-suporte` e `agendamento-ferias`:
**Supabase próprio**, SSO pelo Google ID token do CRM.

## Dois perímetros

| | Rota | Sessão | Quem |
|---|---|---|---|
| Escritório | `/sistemas/<id>` (nativo, via registry) | Google, pelo SSO do CRM | colaborador |
| Portal | `/obrigacoes/portal` (fora do AuthGuard) | magic link, direto no Supabase do módulo | cliente |

Não é um filtro de tela: são sessões e rotas separadas. A empresa do
usuário-cliente vem do JWT, nunca de parâmetro de rota ou query string.

## Estrutura

```
integrations/supabase/   migrations, seed, testes, client.ts
integrations/crm/        cadastro na tabela `sistemas` do CRM
hooks/ lib/ components/ pages/   perímetro do escritório
portal/                  perímetro do cliente
```

O worker de baixa por recibo fica fora daqui, em `services/obrigacoes-recibo/`
— precisa de `service_role` e de acesso ao sistema de arquivos.

## Colocar no ar

1. **Criar o projeto Supabase** do módulo.
2. **Aplicar as migrations** de `integrations/supabase/migrations/` na ordem.
3. **Registrar o auth hook**: Authentication → Hooks → Customize Access Token →
   `public.custom_access_token`. **Sem isso todo login sai sem claims e o RLS
   nega tudo** — a tela abre vazia sem erro aparente.
4. **Habilitar Google** como provedor (para o SSO) e **e-mail/magic link** (para
   o portal), ambos com signup desabilitado.
5. **Envs do frontend**: `VITE_OBRIGACOES_SUPABASE_URL` e
   `VITE_OBRIGACOES_SUPABASE_PUBLISHABLE_KEY`. Sem elas o módulo se declara
   indisponível em vez de quebrar o CRM (fail-soft, como os outros satélites).
6. **Cadastrar o sistema no CRM**: `integrations/crm/cadastro_sistema.sql`.
7. **Provisionar**: inserir os colaboradores em `usuario` (com departamentos em
   `usuario_departamento`) e publicar uma `politica_privacidade` vigente.
8. **Worker de recibo** (opcional no início): ver `services/obrigacoes-recibo/`.

## Testes

```powershell
# schema, RLS, auth hook, motor de prazo, painel, validação, portal, recibo
powershell -NoProfile -File integrations/supabase/testar_schema.ps1

# validação de arquivo do portal
node --test src/systems/obrigacoes/lib/arquivo.test.mjs
```

O primeiro sobe um Postgres descartável no Docker, aplica tudo e roda os testes
com dado de **dois tenants** na mesma tabela — que é a única forma de provar
isolamento.

## Decisões que não devem ser revertidas sem conversa

- **`tenant_id` em toda tabela + RLS**, além do filtro na query. Nunca só um.
- **Claims em `app_metadata`**, nunca `user_metadata` — este é gravável pelo
  próprio usuário e um cliente poderia se declarar colaborador.
- **Parametrização e regra de prazo se encerram, não se deletam.** As tabelas
  não têm policy de DELETE, e há gatilho barrando caminho privilegiado.
- **Regra de prazo é versionada por vigência.** É o que faz o reprocessamento
  de uma competência antiga devolver o prazo histórico, não o de hoje.
- **Baixa automática só por recibo**, nunca por robô de UI. Recibo que não casa
  com exatamente uma entrega vai para revisão manual.
- **Nada de logar conteúdo de recibo nem `nome + CNPJ` juntos.**

## Pendências conhecidas

- Os 7 prazos do seed foram **inferidos dos vencimentos do protótipo**, não da
  legislação. Conferir antes de gerar entrega real.
- O parser de recibo nunca viu arquivo real do Domínio. O de-para
  (`recibo_termo`) tem só a DCTFWeb, de propósito.
- Edição de obrigação existente não cria nova versão de prazo pela tela — o
  hook (`useNovaVersaoPrazo`) existe, falta o formulário.
