-- Pagamentos PIX no funil do webchat + arquivos protegidos de produto.
-- Collation explícita: o banco é utf8mb4_unicode_ci e as FKs para webchats(id) não casam com o default do MySQL 8.
CREATE TABLE IF NOT EXISTS `webchat_assets` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `webchat_id` CHAR(36) NULL,
  `kind` VARCHAR(16) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `mime` VARCHAR(128) NOT NULL,
  `size_bytes` BIGINT NOT NULL,
  `storage_path` VARCHAR(512) NOT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  INDEX `idx_wcasset_org` (`organization_id`),
  INDEX `idx_wcasset_webchat` (`webchat_id`),
  CONSTRAINT `fk_wcasset_webchat` FOREIGN KEY (`webchat_id`) REFERENCES `webchats` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `webchat_payments` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `webchat_id` CHAR(36) NOT NULL,
  `session_id` VARCHAR(100) NOT NULL,
  `sequence_id` VARCHAR(80) NOT NULL,
  `provider` VARCHAR(32) NOT NULL,
  `provider_charge_id` VARCHAR(255) NULL,
  `amount_cents` INT NOT NULL DEFAULT 0,
  `description` VARCHAR(255) NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  `pix_code` TEXT NULL,
  `qr_base64` LONGTEXT NULL,
  `context` JSON NULL,
  `expires_at` DATETIME(3) NULL,
  `paid_at` DATETIME(3) NULL,
  `delivered_at` DATETIME(3) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  INDEX `idx_wcpay_org_created` (`organization_id`, `created_at`),
  INDEX `idx_wcpay_webchat` (`webchat_id`),
  INDEX `idx_wcpay_status` (`status`),
  INDEX `idx_wcpay_charge` (`provider_charge_id`),
  INDEX `idx_wcpay_session_seq` (`session_id`, `sequence_id`),
  CONSTRAINT `fk_wcpay_webchat` FOREIGN KEY (`webchat_id`) REFERENCES `webchats` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
