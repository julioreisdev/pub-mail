-- Cliques únicos por lead (destrava taxa/qtd de clique por lead)
ALTER TABLE `email_projects_schedules_sent` ADD COLUMN `click_unique_count` INT NOT NULL DEFAULT 0;
-- backfill: usa os cliques totais como proxy p/ os disparos antigos (sem histórico por-lead)
UPDATE `email_projects_schedules_sent` SET `click_unique_count` = `click_cta_count`;

CREATE TABLE `email_schedules_sent_clicks` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `schedule_sent_id` CHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_schedule_sent_email_click` (`schedule_sent_id`, `email`),
  INDEX `idx_clicks_schedule_sent` (`schedule_sent_id`),
  CONSTRAINT `fk_clicks_sent` FOREIGN KEY (`schedule_sent_id`) REFERENCES `email_projects_schedules_sent` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
);
