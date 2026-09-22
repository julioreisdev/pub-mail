-- Fase 4: gatilhos por comportamento (open/click)

CREATE TABLE `email_behavior_triggers` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `project_id` CHAR(36) NOT NULL,
  `event` VARCHAR(16) NOT NULL,
  `action` VARCHAR(24) NOT NULL,
  `tags` JSON NULL,
  `template_id` CHAR(36) NULL,
  `active` BOOLEAN NOT NULL DEFAULT 1,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_email_behavior_triggers_lookup` (`project_id`, `event`, `active`),
  INDEX `idx_email_behavior_triggers_org` (`organization_id`),
  CONSTRAINT `fk_email_behavior_triggers_project`
    FOREIGN KEY (`project_id`) REFERENCES `email_projects` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE `email_behavior_trigger_fires` (
  `trigger_id` CHAR(36) NOT NULL,
  `lead_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`trigger_id`, `lead_id`),
  CONSTRAINT `fk_email_behavior_trigger_fires_trigger`
    FOREIGN KEY (`trigger_id`) REFERENCES `email_behavior_triggers` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
);
