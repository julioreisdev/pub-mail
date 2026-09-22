-- Fase 3: entrega/bounce (webhooks Resend) + supressão

ALTER TABLE `system_settings`
  ADD COLUMN `resend_webhook_secret` VARCHAR(255) NULL;

ALTER TABLE `email_projects_schedules_sent`
  ADD COLUMN `delivered_count` INT NOT NULL DEFAULT 0,
  ADD COLUMN `bounced_count` INT NOT NULL DEFAULT 0,
  ADD COLUMN `complained_count` INT NOT NULL DEFAULT 0;

CREATE TABLE `email_webhook_events` (
  `id` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);
