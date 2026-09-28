-- Módulo WhatsApp (via OpenWA) — Fase 1: sessão por organização + log de eventos da sessão.
CREATE TABLE IF NOT EXISTS `whatsapp_sessions` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `openwa_session_id` VARCHAR(64) NULL,
  `openwa_name` VARCHAR(64) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'none',
  `phone` VARCHAR(32) NULL,
  `push_name` VARCHAR(255) NULL,
  `webhook_id` VARCHAR(64) NULL,
  `webhook_secret` VARCHAR(128) NULL,
  `paired_at` DATETIME(3) NULL,
  `last_status_at` DATETIME(3) NULL,
  `last_event_at` DATETIME(3) NULL,
  `last_qr_at` DATETIME(3) NULL,
  `restricted_at` DATETIME(3) NULL,
  `disconnected_at` DATETIME(3) NULL,
  `last_restart_at` DATETIME(3) NULL,
  `last_error` VARCHAR(500) NULL,
  `pacing_enabled` BOOLEAN NOT NULL DEFAULT true,
  `warmup_ack_at` DATETIME(3) NULL,
  `settings` JSON NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wasess_org` (`organization_id`),
  INDEX `idx_wasess_openwa` (`openwa_session_id`),
  CONSTRAINT `fk_wasess_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `whatsapp_session_events` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `session_id` CHAR(36) NOT NULL,
  `organization_id` CHAR(36) NOT NULL,
  `event` VARCHAR(48) NOT NULL,
  `idempotency_key` VARCHAR(191) NULL,
  `payload` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_waevt_idem` (`idempotency_key`),
  INDEX `idx_waevt_session_created` (`session_id`, `created_at`),
  CONSTRAINT `fk_waevt_session` FOREIGN KEY (`session_id`) REFERENCES `whatsapp_sessions` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
