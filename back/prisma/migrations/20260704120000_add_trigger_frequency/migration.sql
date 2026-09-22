-- Frequência configurável dos gatilhos (once/unlimited/cooldown)
ALTER TABLE `email_behavior_triggers` ADD COLUMN `frequency` JSON NULL;

ALTER TABLE `email_behavior_trigger_fires`
  ADD COLUMN `fired_count` INT NOT NULL DEFAULT 1,
  ADD COLUMN `last_fired_at` DATETIME(0) NULL;

UPDATE `email_behavior_trigger_fires` SET `last_fired_at` = `created_at` WHERE `last_fired_at` IS NULL;
