-- Templates específicos de reciclagem (criados pelo construtor)
ALTER TABLE `email_templates`
  ADD COLUMN `recycle` BOOLEAN NOT NULL DEFAULT 0;

CREATE INDEX `idx_email_templates_project_recycle` ON `email_templates` (`project_id`, `recycle`);
