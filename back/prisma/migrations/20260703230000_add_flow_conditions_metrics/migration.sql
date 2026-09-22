-- Fluxo inicial: condições por passo + métricas por passo
ALTER TABLE `email_flow_steps` ADD COLUMN `condition` JSON NULL;
ALTER TABLE `email_flow_enrollments` ADD COLUMN `last_sent_id` CHAR(36) NULL;
ALTER TABLE `email_projects_schedules_sent` ADD COLUMN `flow_step_id` CHAR(36) NULL;
CREATE INDEX `idx_sent_flow_step` ON `email_projects_schedules_sent` (`flow_step_id`);
