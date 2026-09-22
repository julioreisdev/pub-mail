-- Módulo Telegram — chat (DMs + grupos): contatos, grupos e mensagens.

CREATE TABLE `telegram_contacts` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `bot_id` CHAR(36) NOT NULL,
  `tg_user_id` BIGINT NOT NULL,
  `first_name` VARCHAR(255) NULL,
  `last_name` VARCHAR(255) NULL,
  `username` VARCHAR(255) NULL,
  `last_message_text` TEXT NULL,
  `last_message_at` DATETIME(0) NULL,
  `last_message_dir` ENUM('IN','OUT') NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT (now()),
  `updated_at` DATETIME(0) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tgcontact_bot_user` (`bot_id`, `tg_user_id`),
  KEY `idx_tgcontact_org` (`organization_id`),
  KEY `idx_tgcontact_bot_last` (`bot_id`, `last_message_at`),
  CONSTRAINT `fk_tgcontact_bot` FOREIGN KEY (`bot_id`) REFERENCES `telegram_bots` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `telegram_groups` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `bot_id` CHAR(36) NOT NULL,
  `tg_chat_id` BIGINT NOT NULL,
  `title` VARCHAR(255) NULL,
  `username` VARCHAR(255) NULL,
  `type` VARCHAR(32) NULL,
  `last_message_text` TEXT NULL,
  `last_message_at` DATETIME(0) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT (now()),
  `updated_at` DATETIME(0) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tggroup_bot_chat` (`bot_id`, `tg_chat_id`),
  KEY `idx_tggroup_org` (`organization_id`),
  CONSTRAINT `fk_tggroup_bot` FOREIGN KEY (`bot_id`) REFERENCES `telegram_bots` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `telegram_messages` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `bot_id` CHAR(36) NOT NULL,
  `chat_kind` ENUM('CONTACT','GROUP') NOT NULL,
  `contact_id` CHAR(36) NULL,
  `group_id` CHAR(36) NULL,
  `tg_chat_id` BIGINT NOT NULL,
  `direction` ENUM('IN','OUT') NOT NULL,
  `tg_message_id` BIGINT NULL,
  `text` TEXT NULL,
  `media_type` VARCHAR(32) NULL,
  `media_file_id` VARCHAR(255) NULL,
  `from_name` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT (now(3)),
  PRIMARY KEY (`id`),
  KEY `idx_tgmsg_contact` (`contact_id`, `created_at`),
  KEY `idx_tgmsg_group` (`group_id`, `created_at`),
  KEY `idx_tgmsg_org` (`organization_id`),
  CONSTRAINT `fk_tgmsg_contact` FOREIGN KEY (`contact_id`) REFERENCES `telegram_contacts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tgmsg_group` FOREIGN KEY (`group_id`) REFERENCES `telegram_groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
