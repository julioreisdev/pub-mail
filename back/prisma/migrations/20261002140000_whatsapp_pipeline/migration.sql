-- WhatsApp CRM fase 3 (02/10/2026): funil (Kanban), tarefas e notas internas por conversa.
CREATE TABLE `whatsapp_pipeline_stages` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `name` VARCHAR(60) NOT NULL,
  `color` VARCHAR(16) NOT NULL DEFAULT '#3B82F6',
  `position` INT NOT NULL DEFAULT 0,
  `kind` VARCHAR(8) NOT NULL DEFAULT 'open',
  `actions` JSON NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wastage_org` (`organization_id`, `position`),
  CONSTRAINT `fk_wastage_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `whatsapp_chats`
  ADD COLUMN `stage_id` CHAR(36) NULL AFTER `last_outbound_at`,
  ADD COLUMN `deal_cents` INT NULL AFTER `stage_id`,
  ADD COLUMN `stage_moved_at` DATETIME(3) NULL AFTER `deal_cents`,
  ADD INDEX `idx_wachat_org_stage` (`organization_id`, `stage_id`);

CREATE TABLE `whatsapp_tasks` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `description` TEXT NULL,
  `due_at` DATETIME(3) NULL,
  `assigned_user_id` CHAR(36) NULL,
  `chat_id` VARCHAR(64) NULL,
  `customer_id` CHAR(36) NULL,
  `done_at` DATETIME(3) NULL,
  `done_by` CHAR(36) NULL,
  `reminded_at` DATETIME(3) NULL,
  `created_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_watask_org_due` (`organization_id`, `done_at`, `due_at`),
  KEY `idx_watask_org_user` (`organization_id`, `assigned_user_id`),
  KEY `idx_watask_org_chat` (`organization_id`, `chat_id`),
  CONSTRAINT `fk_watask_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `whatsapp_chat_notes` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `chat_id` VARCHAR(64) NOT NULL,
  `user_id` CHAR(36) NULL,
  `text` TEXT NOT NULL,
  `pinned` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_wanote_org_chat` (`organization_id`, `chat_id`, `created_at`),
  CONSTRAINT `fk_wanote_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
