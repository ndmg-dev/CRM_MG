-- Cadastro da release v1.0.1 no CRM — rodar no Postgres do CRM
-- (crm_mendonca_galvao), depois do merge/deploy da PR #30.
--
-- Sem bloco DO/PLpgSQL de propósito: clientes de SQL gráficos costumam
-- cortar o script no ';' dentro do dollar-quoting ($$...$$). Isto aqui é só
-- INSERT/SELECT puro.
--
-- Idempotente: rodar duas vezes não duplica.

INSERT INTO releases (id, version, released_at, created_at)
SELECT gen_random_uuid(), '1.0.1', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM releases WHERE version = '1.0.1');

INSERT INTO release_notes (id, release_id, system_name, description, sort_order)
SELECT gen_random_uuid(), r.id, v.system_name, v.description, v.sort_order
FROM releases r
CROSS JOIN (VALUES
  ('CRM', 'Corrigido som duplicado ao chegar mensagem de chamado (tocava o aviso do CRM e o "ding" do navegador juntos).', 0),
  ('CRM', 'Corrigida notificação de comentário duplicada, que às vezes vazava pro sino de Notificações em vez de ficar só em Mensagens.', 1),
  ('CRM', 'Novo botão "Marcar tudo como lido" no sino de Notificações.', 2),
  ('CRM', 'Chat flutuante agora abre sozinho ao chegar uma mensagem de chamado, e pode ser minimizado em vez de fechado.', 3)
) AS v(system_name, description, sort_order)
WHERE r.version = '1.0.1'
  AND NOT EXISTS (SELECT 1 FROM release_notes rn WHERE rn.release_id = r.id);
