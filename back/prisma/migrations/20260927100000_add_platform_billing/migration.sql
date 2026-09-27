-- Assinaturas da plataforma (acesso ao Pub Mail vendido pelo superadmin) + módulos por usuário.
-- Collation explícita: o banco é utf8mb4_unicode_ci (FK p/ organizations.id não casa com o default do MySQL 8).

-- Módulos liberados por USUÁRIO (JSON array: email|webchat|quiz|telegram|settings). NULL/[] = nenhum.
ALTER TABLE `users`
  ADD COLUMN `modules` JSON NULL,
  ADD COLUMN `welcomed_at` DATETIME(3) NULL;
-- Quem já existe segue vendo tudo.
UPDATE `users` SET `modules` = JSON_ARRAY('email','webchat','quiz','telegram','settings') WHERE `modules` IS NULL;

-- Gateway PIX do SUPERADMIN (recebe as assinaturas; separado do gateway de cada organização).
ALTER TABLE `system_settings`
  ADD COLUMN `billing_provider` VARCHAR(32) NOT NULL DEFAULT 'mercadopago',
  ADD COLUMN `billing_access_token` TEXT NULL,
  ADD COLUMN `billing_active` BOOLEAN NOT NULL DEFAULT false;

-- Plano de acesso da ORGANIZAÇÃO (1 por org).
CREATE TABLE IF NOT EXISTS `organization_access` (
  `organization_id` CHAR(36) NOT NULL,
  `price_cents` INT NOT NULL DEFAULT 0,
  `period_days` INT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'FREE',
  `access_until` DATETIME(3) NULL,
  `first_paid_at` DATETIME(3) NULL,
  `last_paid_at` DATETIME(3) NULL,
  `notes` VARCHAR(255) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`organization_id`),
  INDEX `idx_orgaccess_status` (`status`),
  INDEX `idx_orgaccess_until` (`access_until`),
  CONSTRAINT `fk_orgaccess_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Orgs existentes: acesso gratuito (nada muda pra quem já está no ar).
INSERT INTO `organization_access` (`organization_id`, `price_cents`, `period_days`, `status`)
SELECT `id`, 0, NULL, 'FREE' FROM `organizations`
WHERE `id` NOT IN (SELECT `organization_id` FROM `organization_access`);

-- Cobranças PIX das assinaturas (espelho de webchat_payments).
CREATE TABLE IF NOT EXISTS `platform_payments` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NULL,
  `provider` VARCHAR(32) NOT NULL,
  `provider_charge_id` VARCHAR(255) NULL,
  `amount_cents` INT NOT NULL DEFAULT 0,
  `period_days` INT NULL,
  `description` VARCHAR(255) NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  `pix_code` TEXT NULL,
  `qr_base64` LONGTEXT NULL,
  `expires_at` DATETIME(3) NULL,
  `paid_at` DATETIME(3) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  INDEX `idx_ppay_org_created` (`organization_id`, `created_at`),
  INDEX `idx_ppay_status` (`status`),
  INDEX `idx_ppay_charge` (`provider_charge_id`),
  CONSTRAINT `fk_ppay_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
