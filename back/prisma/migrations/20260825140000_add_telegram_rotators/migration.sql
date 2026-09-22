-- Mensagem rotativa (prova social): o bot posta UMA mensagem num grupo/canal e a
-- edita em loop, alternando textos fixos ("Alan aderiu ao VIP" -> "José aderiu ao VIP").
CREATE TABLE `telegram_rotators` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `bot_id` CHAR(36) NOT NULL,
  `group_id` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 0,
  `interval_seconds` INT NOT NULL DEFAULT 15,
  `mode` VARCHAR(16) NOT NULL DEFAULT 'sequential',
  `messages` JSON NULL,
  `name_pool` JSON NULL,
  `current_index` INT NOT NULL DEFAULT 0,
  `current_message_id` BIGINT NULL,
  `last_rotated_at` DATETIME(3) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tgrotator_group` (`group_id`),
  KEY `idx_tgrotator_org` (`organization_id`),
  KEY `idx_tgrotator_active` (`active`),
  CONSTRAINT `fk_tgrotator_bot` FOREIGN KEY (`bot_id`) REFERENCES `telegram_bots` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tgrotator_group` FOREIGN KEY (`group_id`) REFERENCES `telegram_groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
