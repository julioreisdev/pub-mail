-- Índice para as consultas por projeto de disparos efetivados ordenados por data
-- (segmentação por janela, analytics, listagem de envios). Auditoria A-92.
CREATE INDEX `idx_sent_project_sent_run` ON `email_projects_schedules_sent`(`project_id`, `sent`, `run_at`);
