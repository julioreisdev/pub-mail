-- Reciclagem (win-back) reusa a infra de agendamentos
ALTER TABLE `email_projects_schedules`
  ADD COLUMN `recycle` BOOLEAN NOT NULL DEFAULT 0,
  ADD COLUMN `recycle_criteria` VARCHAR(16) NULL,
  ADD COLUMN `recycle_days` SMALLINT NULL;

ALTER TABLE `email_projects_schedules_sent`
  ADD COLUMN `recycle` BOOLEAN NOT NULL DEFAULT 0;

CREATE INDEX `idx_email_projects_schedules_recycle` ON `email_projects_schedules` (`project_id`, `recycle`);
CREATE INDEX `idx_email_projects_schedules_sent_recycle` ON `email_projects_schedules_sent` (`project_id`, `recycle`);
