-- Cadastro da release v1.0.0 no CRM — rodar no Postgres do CRM
-- (crm_mendonca_galvao).
--
-- Existe porque não há como rodar o backend FastAPI localmente neste
-- ambiente (sem venv Python), então o endpoint POST /releases não pôde ser
-- chamado a partir daqui. Depois desta v1.0.0, use a aba "Atualizações" do
-- Admin (Admin > Atualizações > Nova Versão) — é a via normal.
--
--   psql "$DATABASE_URL_CRM" -f cadastro_release_v1.0.0.sql
--
-- Idempotente: rodar duas vezes não duplica (version é UNIQUE em releases).

DO $$
DECLARE
  v_release_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM releases WHERE version = '1.0.0') THEN
    RAISE NOTICE 'Release 1.0.0 já cadastrada, nada a fazer.';
    RETURN;
  END IF;

  INSERT INTO releases (id, version, released_at, created_at)
  VALUES (gen_random_uuid(), '1.0.0', now(), now())
  RETURNING id INTO v_release_id;

  INSERT INTO release_notes (id, release_id, system_name, description, sort_order) VALUES
    (gen_random_uuid(), v_release_id, 'CRM',
     'Notificações e mensagens de qualquer sistema agora aparecem em um único menu fixo no topo, visível em qualquer tela.', 0),
    (gen_random_uuid(), v_release_id, 'CRM',
     'Novo chat flutuante: responda um chamado sem sair da tarefa que você está fazendo.', 1),
    (gen_random_uuid(), v_release_id, 'CRM',
     'Dashboard reformulado: agora mostra seus chamados, tarefas e prazos pessoais, com uma aba separada de visão geral para gestores.', 2),
    (gen_random_uuid(), v_release_id, 'CRM',
     'Modal de atualizações: sempre que o CRM ganhar uma novidade, um aviso como este vai aparecer no seu próximo login.', 3),
    (gen_random_uuid(), v_release_id, 'Central de Suporte',
     'Nova coluna "Parados" no quadro de chamados, para tickets travados que não devem contar no prazo de atendimento.', 4),
    (gen_random_uuid(), v_release_id, 'Central de Suporte',
     'Modo TV: exiba os chamados em tela cheia num monitor, com som de aviso para chamados e mensagens novas.', 5),
    (gen_random_uuid(), v_release_id, 'Central de Suporte',
     'Notificação de mensagem separada da notificação de chamado, com contador de mensagens não lidas no card.', 6),
    (gen_random_uuid(), v_release_id, 'Processamento de Ponto',
     'Sistema migrado para dentro do CRM — não abre mais em janela externa.', 7),
    (gen_random_uuid(), v_release_id, 'Cálculo de Adiantamento',
     'Sistema migrado para dentro do CRM — não abre mais em janela externa.', 8),
    (gen_random_uuid(), v_release_id, 'Aeronord',
     'Convocações e recibos migrados para dentro do CRM — não abre mais em janela externa.', 9),
    (gen_random_uuid(), v_release_id, 'Cálculo de Comissão',
     'Novo sistema nativo do CRM para cálculo de horas extras 150%, com relatórios que agora salvam de verdade.', 10);
END $$;
