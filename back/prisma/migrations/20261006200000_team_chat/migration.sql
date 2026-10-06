-- Chat interno da equipe: conversas diretas entre usuários da organização e grupos.
CREATE TABLE IF NOT EXISTS `team_chats` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `kind` VARCHAR(8) NOT NULL,
  `name` VARCHAR(80) NULL,
  `dm_key` VARCHAR(80) NULL,
  `created_by` CHAR(36) NULL,
  `last_message_at` DATETIME(3) NULL,
  `last_preview` VARCHAR(255) NULL,
  `last_user_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_teamchat_dm` (`organization_id`, `dm_key`),
  INDEX `idx_teamchat_org` (`organization_id`, `last_message_at`),
  CONSTRAINT `fk_teamchat_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `team_chat_members` (
  `chat_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `role` VARCHAR(8) NOT NULL DEFAULT 'member',
  `last_read_at` DATETIME(3) NULL,
  `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`chat_id`, `user_id`),
  INDEX `idx_teammember_user` (`user_id`),
  CONSTRAINT `fk_teammember_chat` FOREIGN KEY (`chat_id`) REFERENCES `team_chats` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_teammember_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `team_messages` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `chat_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NULL,
  `type` VARCHAR(16) NOT NULL DEFAULT 'text',
  `body` TEXT NULL,
  `media_id` CHAR(36) NULL,
  `quoted_id` CHAR(36) NULL,
  `edited_at` DATETIME(3) NULL,
  `deleted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_teammsg_chat` (`chat_id`, `created_at`),
  INDEX `idx_teammsg_media` (`organization_id`, `media_id`),
  CONSTRAINT `fk_teammsg_chat` FOREIGN KEY (`chat_id`) REFERENCES `team_chats` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_teammsg_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
