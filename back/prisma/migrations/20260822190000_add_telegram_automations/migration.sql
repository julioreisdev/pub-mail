-- Automações do bot (drip/nudge temporizado após /start) + enrollments.
CREATE TABLE `telegram_automations` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `bot_id` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 0,
  `trigger_type` VARCHAR(32) NOT NULL DEFAULT 'ON_START',
  `steps` JSON NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT (now()),
  `updated_at` DATETIME(0) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tgautom_org` (`organization_id`),
  KEY `idx_tgautom_bot` (`bot_id`),
  CONSTRAINT `fk_tgautom_bot` FOREIGN KEY (`bot_id`) REFERENCES `telegram_bots` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `telegram_automation_enrollments` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `bot_id` CHAR(36) NOT NULL,
  `automation_id` CHAR(36) NOT NULL,
  `contact_id` CHAR(36) NULL,
  `tg_user_id` BIGINT NOT NULL,
  `next_step` INT NOT NULL DEFAULT 0,
  `next_send_at` DATETIME(0) NULL,
  `status` ENUM('ACTIVE','COMPLETED','STOPPED') NOT NULL DEFAULT 'ACTIVE',
  `enrolled_at` DATETIME(0) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT (now()),
  `updated_at` DATETIME(0) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tgautomenr` (`automation_id`, `tg_user_id`),
  KEY `idx_tgautomenr_due` (`status`, `next_send_at`),
  KEY `idx_tgautomenr_org` (`organization_id`),
  CONSTRAINT `fk_tgautomenr_autom` FOREIGN KEY (`automation_id`) REFERENCES `telegram_automations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tgautomenr_bot` FOREIGN KEY (`bot_id`) REFERENCES `telegram_bots` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tgautomenr_contact` FOREIGN KEY (`contact_id`) REFERENCES `telegram_contacts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
