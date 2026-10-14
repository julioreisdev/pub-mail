-- Fase 8 (assinaturas WhatsApp): escala, operação e fechamento — contrato docs/whatsapp-assinaturas-contrato.md §12

-- fila de envios: pausa e ritmo por número (o ritmo da org fica em whatsapp_crm_settings.charge.outbox_per_minute)
ALTER TABLE `whatsapp_sessions`
  ADD COLUMN `outbox_paused_at` DATETIME(3) NULL,
  ADD COLUMN `outbox_pause_reason` VARCHAR(255) NULL,
  ADD COLUMN `outbox_per_minute` INT NULL;

-- índices da rotina diária
ALTER TABLE `whatsapp_subscriptions`
  ADD KEY `idx_wasub_org_next_due` (`organization_id`, `next_due_at`),
  ADD KEY `idx_wasub_org_cancel_at` (`organization_id`, `cancel_at`),
  ADD KEY `idx_wasub_org_paused` (`organization_id`, `paused_until`);
ALTER TABLE `whatsapp_outbox`
  ADD KEY `idx_waoutbox_org_created` (`organization_id`, `created_at`);

-- importação em segundo plano
CREATE TABLE `whatsapp_import_jobs` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NULL,
  `kind` VARCHAR(24) NOT NULL DEFAULT 'customers',
  `status` VARCHAR(16) NOT NULL DEFAULT 'queued',
  `file_name` VARCHAR(255) NULL,
  `storage_path` VARCHAR(255) NULL,
  `options` JSON NULL,
  `total_rows` INT NOT NULL DEFAULT 0,
  `processed` INT NOT NULL DEFAULT 0,
  `created_count` INT NOT NULL DEFAULT 0,
  `updated_count` INT NOT NULL DEFAULT 0,
  `skipped_count` INT NOT NULL DEFAULT 0,
  `error_count` INT NOT NULL DEFAULT 0,
  `errors` JSON NULL,
  `summary` JSON NULL,
  `last_error` VARCHAR(500) NULL,
  `started_at` DATETIME(3) NULL,
  `finished_at` DATETIME(3) NULL,
  `heartbeat_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_waimp_org_created` (`organization_id`, `created_at`),
  KEY `idx_waimp_status` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- auditoria geral da organização
CREATE TABLE `org_audit_log` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NULL,
  `user_name` VARCHAR(160) NULL,
  `actor` VARCHAR(16) NOT NULL DEFAULT 'user',
  `action` VARCHAR(64) NOT NULL,
  `entity` VARCHAR(40) NULL,
  `entity_id` VARCHAR(64) NULL,
  `summary` VARCHAR(255) NULL,
  `changes` JSON NULL,
  `method` VARCHAR(8) NULL,
  `path` VARCHAR(255) NULL,
  `status_code` SMALLINT NULL,
  `ip` VARCHAR(45) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_orgaudit_org_created` (`organization_id`, `created_at`),
  KEY `idx_orgaudit_org_entity` (`organization_id`, `entity`, `entity_id`),
  KEY `idx_orgaudit_org_user` (`organization_id`, `user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- LGPD: cliente anonimizado
ALTER TABLE `whatsapp_customers` ADD COLUMN `erased_at` DATETIME(3) NULL;
