-- Central de Suporte: novo status "parado" (coluna entre Em Andamento e Em Teste).
-- Chamados nesse status ficam fora de: atraso/prazo (SLA), TM Resposta e TM
-- Resolução — tudo isso é calculado no frontend (Reports.tsx, useSlaStatus.ts),
-- então aqui só precisamos do valor do enum. Executar no SQL Editor do Supabase
-- da Central de Suporte.

alter type public.ticket_status add value if not exists 'parado';
