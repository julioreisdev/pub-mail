-- Notificações (08/10/2026): push (Web Push/VAPID) + avisos no painel, preferências por usuário,
-- histórico e notificações personalizadas. Tudo por organização; sem FK de propósito
-- (admin.removeOrganization desliga as FKs e apaga as tabelas explicitamente).

-- Aparelhos inscritos no push. O endpoint pode ter > 1 KB → unicidade pelo hash.
CREATE TABLE `push_subscriptions` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `endpoint_hash` CHAR(64) NOT NULL,
  `endpoint` TEXT NOT NULL,
  `p256dh` VARCHAR(255) NOT NULL,
  `auth` VARCHAR(64) NOT NULL,
  `user_agent` VARCHAR(255) NULL,
  `device_label` VARCHAR(80) NULL,
  `failures` INT NOT NULL DEFAULT 0,
  `last_sent_at` DATETIME(3) NULL,
  `last_seen_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pushsub_endpoint` (`endpoint_hash`),
  KEY `idx_pushsub_user` (`organization_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Preferências (JSON livre, normalizado pelo back — ver notification-kinds.ts).
CREATE TABLE `notification_prefs` (
  `user_id` CHAR(36) NOT NULL,
  `organization_id` CHAR(36) NOT NULL,
  `prefs` JSON NOT NULL,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`user_id`),
  KEY `idx_notifprefs_org` (`organization_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Histórico do que foi (ou não) enviado a cada usuário — 30 dias.
CREATE TABLE `notification_log` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `kind` VARCHAR(32) NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `body` VARCHAR(500) NULL,
  `url` VARCHAR(500) NULL,
  `data` JSON NULL,
  `channels` VARCHAR(32) NOT NULL DEFAULT '',
  `status` VARCHAR(16) NOT NULL DEFAULT 'sent',
  `read_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_notiflog_user` (`organization_id`, `user_id`, `created_at`),
  KEY `idx_notiflog_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notificações personalizadas (aviso/teste que o usuário monta e dispara, agora ou agendado).
CREATE TABLE `notification_custom` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `created_by` CHAR(36) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `body` VARCHAR(500) NULL,
  `url` VARCHAR(500) NULL,
  `emoji` VARCHAR(16) NULL,
  `sound` VARCHAR(16) NOT NULL DEFAULT 'default',
  `vibrate` VARCHAR(16) NOT NULL DEFAULT 'short',
  `important` TINYINT(1) NOT NULL DEFAULT 0,
  `recipients` JSON NOT NULL,
  `schedule_at` DATETIME(3) NULL,
  `sent_at` DATETIME(3) NULL,
  `fire_count` INT NOT NULL DEFAULT 0,
  `last_fired_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_notifcustom_org` (`organization_id`, `created_at`),
  KEY `idx_notifcustom_sched` (`schedule_at`, `sent_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
