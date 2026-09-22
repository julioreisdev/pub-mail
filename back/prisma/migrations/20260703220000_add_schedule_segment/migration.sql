-- Segmentação de agendamentos por regras/condições
ALTER TABLE `email_projects_schedules` ADD COLUMN `segment` JSON NULL;
