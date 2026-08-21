-- Cadastro da release v1.0.0 no CRM — rodar no Postgres do CRM
-- (crm_mendonca_galvao).
--
-- Existe porque não há como rodar o backend FastAPI localmente neste
-- ambiente (sem venv Python), então o endpoint POST /releases não pôde ser
-- chamado a partir daqui. Depois desta v1.0.0, use a aba "Atualizações" do
-- Admin (Admin > Atualizações > Nova Versão) — é a via normal.
--
-- Sem bloco DO/PLpgSQL de propósito: clientes de SQL gráficos (DataGrip,
-- Beekeeper etc.) costumam cortar o script no ';' dentro do dollar-quoting
-- ($$...$$) e mandar só o fragmento final ao servidor. Isto aqui é só
-- INSERT/SELECT puro, roda em qualquer editor.
--
-- Idempotente: rodar duas vezes não duplica.

INSERT INTO releases (id, version, released_at, created_at)
SELECT gen_random_uuid(), '1.0.0', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM releases WHERE version = '1.0.0');

INSERT INTO release_notes (id, release_id, system_name, description, sort_order)
SELECT gen_random_uuid(), r.id, v.system_name, v.description, v.sort_order
FROM releases r
CROSS JOIN (VALUES
  ('CRM', 'Notificações e mensagens de qualquer sistema agora aparecem em um único menu fixo no topo, visível em qualquer tela.', 0),
  ('CRM', 'Novo chat flutuante: responda um chamado sem sair da tarefa que você está fazendo.', 1),
  ('CRM', 'Dashboard reformulado: agora mostra seus chamados, tarefas e prazos pessoais, com uma aba separada de visão geral para gestores.', 2),
  ('CRM', 'Modal de atualizações: sempre que o CRM ganhar uma novidade, um aviso como este vai aparecer no seu próximo login.', 3),
  ('Central de Suporte', 'Nova coluna "Parados" no quadro de chamados, para tickets travados que não devem contar no prazo de atendimento.', 4),
  ('Central de Suporte', 'Modo TV: exiba os chamados em tela cheia num monitor, com som de aviso para chamados e mensagens novas.', 5),
  ('Central de Suporte', 'Notificação de mensagem separada da notificação de chamado, com contador de mensagens não lidas no card.', 6),
  ('Processamento de Ponto', 'Sistema migrado para dentro do CRM — não abre mais em janela externa.', 7),
  ('Cálculo de Adiantamento', 'Sistema migrado para dentro do CRM — não abre mais em janela externa.', 8),
  ('Aeronord', 'Convocações e recibos migrados para dentro do CRM — não abre mais em janela externa.', 9),
  ('Cálculo de Comissão', 'Novo sistema nativo do CRM para cálculo de horas extras 150%, com relatórios que agora salvam de verdade.', 10)
) AS v(system_name, description, sort_order)
WHERE r.version = '1.0.0'
  AND NOT EXISTS (SELECT 1 FROM release_notes rn WHERE rn.release_id = r.id);
