-- Diagnóstico rápido do estado da feature de releases no Postgres do CRM.
-- Não altera nada, só consulta.

-- 1) Tamanho atual da coluna description (esperado: 4000, depois da migration)
SELECT column_name, character_maximum_length, data_type
FROM information_schema.columns
WHERE table_name = 'release_notes' AND column_name = 'description';

-- 2) Releases já cadastradas e quantas notas cada uma tem
SELECT r.version, r.released_at, count(n.id) AS total_notas
FROM releases r
LEFT JOIN release_notes n ON n.release_id = r.id
GROUP BY r.id, r.version, r.released_at
ORDER BY r.released_at DESC;

-- 3) Quem já marcou alguma release como lida
SELECT r.version, count(rr.id) AS total_lidas
FROM releases r
LEFT JOIN release_reads rr ON rr.release_id = r.id
GROUP BY r.id, r.version
ORDER BY r.version;
