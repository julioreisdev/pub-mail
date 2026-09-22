-- Módulo Telegram — Fluxo Inicial (1 fluxo por bot; grafo salvo em JSON).
CREATE TABLE `telegram_flows` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `bot_id` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 0,
  `definition` JSON NULL,
  `start_node_id` VARCHAR(64) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT (now()),
  `updated_at` DATETIME(0) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tgflow_bot` (`bot_id`),
  KEY `idx_tgflow_org` (`organization_id`),
  CONSTRAINT `fk_tgflow_bot` FOREIGN KEY (`bot_id`) REFERENCES `telegram_bots` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
