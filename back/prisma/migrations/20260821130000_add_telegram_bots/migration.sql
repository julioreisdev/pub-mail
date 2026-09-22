-- Módulo Telegram: bots cadastrados por organização.
CREATE TABLE `telegram_bots` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `tg_bot_id` BIGINT NULL,
  `username` VARCHAR(255) NULL,
  `first_name` VARCHAR(255) NULL,
  `status` ENUM('ACTIVE','BANNED','ERROR') NOT NULL DEFAULT 'ACTIVE',
  `webhook_set` TINYINT(1) NOT NULL DEFAULT 0,
  `webhook_secret` VARCHAR(64) NULL,
  `last_error` TEXT NULL,
  `last_checked_at` DATETIME(0) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT (now()),
  `updated_at` DATETIME(0) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tgbot_org_botid` (`organization_id`, `tg_bot_id`),
  KEY `idx_telegram_bots_org` (`organization_id`),
  CONSTRAINT `fk_telegram_bots_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
