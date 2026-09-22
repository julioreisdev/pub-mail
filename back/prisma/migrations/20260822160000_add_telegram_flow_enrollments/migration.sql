-- Runtime do Fluxo Inicial: posição de cada usuário no fluxo do bot.
CREATE TABLE `telegram_flow_enrollments` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `bot_id` CHAR(36) NOT NULL,
  `contact_id` CHAR(36) NULL,
  `tg_user_id` BIGINT NOT NULL,
  `current_node_id` VARCHAR(64) NULL,
  `status` ENUM('ACTIVE','COMPLETED','STOPPED') NOT NULL DEFAULT 'ACTIVE',
  `context` JSON NULL,
  `last_interaction_at` DATETIME(0) NULL,
  `started_at` DATETIME(0) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT (now()),
  `updated_at` DATETIME(0) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tgflowenr_bot_user` (`bot_id`, `tg_user_id`),
  KEY `idx_tgflowenr_org` (`organization_id`),
  CONSTRAINT `fk_tgflowenr_bot` FOREIGN KEY (`bot_id`) REFERENCES `telegram_bots` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tgflowenr_contact` FOREIGN KEY (`contact_id`) REFERENCES `telegram_contacts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
