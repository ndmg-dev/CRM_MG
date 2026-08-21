-- Necessário pra Realtime mandar o valor ANTIGO das colunas em eventos
-- UPDATE de `tickets` (payload.old). Por padrão o Postgres só manda a
-- chave primária em `old` — sem isso, não dá pra saber se um chamado
-- acabou de ser fechado (status mudou) ou só teve outro campo editado.
--
-- Usado pelo som de "chamado encerrado" na TV do viewer (Layout.tsx),
-- que não pode depender da tabela `notifications` (o viewer não é alvo
-- de nenhuma linha lá).
--
-- Executar no SQL Editor do Supabase da Central de Suporte
-- (projeto uayuqlgceggqteyrmuij).

ALTER TABLE public.tickets REPLICA IDENTITY FULL;
