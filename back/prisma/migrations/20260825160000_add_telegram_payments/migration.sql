-- Pagamentos / VIP: config do gateway (por org), planos por bot e cobranças (PIX).

-- Config do gateway de pagamento por organização (provedor + credencial).
CREATE TABLE `telegram_payment_settings` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `provider` VARCHAR(32) NOT NULL DEFAULT 'mercadopago',
  `access_token` TEXT NULL,
  `pix_key` VARCHAR(255) NULL,
  `webhook_secret` VARCHAR(64) NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tgpaysettings_org` (`organization_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Planos (VIP) que o bot vende.
CREATE TABLE `telegram_plans` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `bot_id` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `price_cents` INT NOT NULL DEFAULT 0,
  `deliver_group_id` CHAR(36) NULL,
  `deliver_message` TEXT NULL,
  `deliver_media` JSON NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `position` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tgplan_bot` (`bot_id`),
  KEY `idx_tgplan_org` (`organization_id`),
  CONSTRAINT `fk_tgplan_bot` FOREIGN KEY (`bot_id`) REFERENCES `telegram_bots` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tgplan_group` FOREIGN KEY (`deliver_group_id`) REFERENCES `telegram_groups` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cobranças (uma por tentativa de compra de um lead).
CREATE TABLE `telegram_payments` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `bot_id` CHAR(36) NOT NULL,
  `plan_id` CHAR(36) NULL,
  `tg_user_id` BIGINT NOT NULL,
  `contact_id` CHAR(36) NULL,
  `provider` VARCHAR(32) NOT NULL,
  `provider_charge_id` VARCHAR(255) NULL,
  `amount_cents` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  `pix_code` TEXT NULL,
  `tg_message_id` BIGINT NULL,
  `tg_message_is_photo` TINYINT(1) NOT NULL DEFAULT 0,
  `invite_link` VARCHAR(512) NULL,
  `delivered` TINYINT(1) NOT NULL DEFAULT 0,
  `paid_at` DATETIME(3) NULL,
  `delivered_at` DATETIME(3) NULL,
  `expires_at` DATETIME(3) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tgpay_org` (`organization_id`),
  KEY `idx_tgpay_status` (`status`),
  KEY `idx_tgpay_charge` (`provider_charge_id`),
  KEY `idx_tgpay_bot` (`bot_id`),
  CONSTRAINT `fk_tgpay_bot` FOREIGN KEY (`bot_id`) REFERENCES `telegram_bots` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tgpay_plan` FOREIGN KEY (`plan_id`) REFERENCES `telegram_plans` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tgpay_contact` FOREIGN KEY (`contact_id`) REFERENCES `telegram_contacts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
