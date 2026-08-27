-- Central de Suporte: distingue "quem abriu o chamado" de "quem precisa da
-- TI" (requester_id). Executar no SQL Editor do Supabase da Central de
-- Suporte.
--
-- Motivação: o chat de abertura de chamado TI ganhou uma etapa perguntando
-- "para você ou para outra pessoa" — quando é para outra pessoa,
-- `requester_id` passa a ser essa pessoa, e sem uma coluna separada não tem
-- como saber quem de fato submeteu o chamado (útil pra saber com quem falar
-- sobre o próprio registro do chamado, distinto de com quem falar sobre o
-- problema em si).
--
-- Null = chamado aberto pelo próprio solicitante (portal do cliente,
-- chamados antigos antes desta coluna existir, etc.) — nesses casos a UI
-- mostra só "Solicitante: X", sem duplicar com "Aberto por: X / Para: X".

alter table public.tickets
  add column if not exists opened_by_id uuid references public.profiles(id);

comment on column public.tickets.opened_by_id is
  'Quem efetivamente submeteu o chamado (login no momento da criação). Null = mesmo que requester_id (chamado aberto pelo próprio solicitante). Diferente de requester_id só quando alguém abre um chamado em nome de outra pessoa.';
