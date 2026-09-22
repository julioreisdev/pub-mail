-- Módulo Telegram — Broadcasts (disparo em massa: DMs/grupos/canais, rotação de copies, fila).
CREATE TABLE `telegram_broadcasts` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `bot_ids` JSON NULL,
  `targets` JSON NULL,
  `times` JSON NULL,
  `mode` VARCHAR(16) NOT NULL DEFAULT 'sequential',
  `delete_used` TINYINT(1) NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 0,
  `last_copy_index` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(0) NOT NULL DEFAULT (now()),
  `updated_at` DATETIME(0) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tgbc_org` (`organization_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `telegram_broadcast_copies` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `broadcast_id` CHAR(36) NOT NULL,
  `position` INT NOT NULL DEFAULT 0,
  `messages` JSON NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT (now()),
  `updated_at` DATETIME(0) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tgbccopy_bc` (`broadcast_id`, `position`),
  CONSTRAINT `fk_tgbccopy_bc` FOREIGN KEY (`broadcast_id`) REFERENCES `telegram_broadcasts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `telegram_broadcast_runs` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `broadcast_id` CHAR(36) NOT NULL,
  `copy_id` CHAR(36) NULL,
  `messages` JSON NULL,
  `run_at` DATETIME(0) NOT NULL,
  `status` ENUM('QUEUED','SENDING','DONE','CANCELED') NOT NULL DEFAULT 'QUEUED',
  `total` INT NOT NULL DEFAULT 0,
  `sent` INT NOT NULL DEFAULT 0,
  `failed` INT NOT NULL DEFAULT 0,
  `blocked` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(0) NOT NULL DEFAULT (now()),
  `updated_at` DATETIME(0) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tgbcrun` (`broadcast_id`, `run_at`),
  KEY `idx_tgbcrun_org` (`organization_id`),
  CONSTRAINT `fk_tgbcrun_bc` FOREIGN KEY (`broadcast_id`) REFERENCES `telegram_broadcasts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `telegram_broadcast_sends` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `broadcast_id` CHAR(36) NOT NULL,
  `run_id` CHAR(36) NOT NULL,
  `bot_id` CHAR(36) NOT NULL,
  `target_kind` ENUM('CONTACT','GROUP','CHANNEL') NOT NULL,
  `tg_chat_id` BIGINT NOT NULL,
  `contact_id` CHAR(36) NULL,
  `group_id` CHAR(36) NULL,
  `status` ENUM('PENDING','DONE','FAILED','BLOCKED') NOT NULL DEFAULT 'PENDING',
  `attempts` INT NOT NULL DEFAULT 0,
  `last_error` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT (now(3)),
  `sent_at` DATETIME(0) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tgbcsend_queue` (`status`, `bot_id`, `id`),
  KEY `idx_tgbcsend_run` (`run_id`),
  CONSTRAINT `fk_tgbcsend_run` FOREIGN KEY (`run_id`) REFERENCES `telegram_broadcast_runs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
