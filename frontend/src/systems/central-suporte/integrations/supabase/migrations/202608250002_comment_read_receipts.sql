-- Central de Suporte: recibo de leitura por comentário ("lido às HH:MM" +
-- ticks estilo WhatsApp no chat rápido). Executar no SQL Editor do Supabase
-- da Central de Suporte.
--
-- Semântica simples (não por destinatário, como WhatsApp 1:1): read_at grava
-- o momento em que ALGUÉM diferente do autor visualizou o comentário pela
-- primeira vez — condiz com o modelo de chamado (vários agentes podem ver o
-- mesmo chat), sem precisar de uma tabela de leituras por pessoa.

alter table public.comments
  add column if not exists read_at timestamptz;

comment on column public.comments.read_at is
  'Momento em que alguém além do autor visualizou o comentário pela primeira vez (chat rápido / detalhe do chamado). Null = ainda não lido.';
