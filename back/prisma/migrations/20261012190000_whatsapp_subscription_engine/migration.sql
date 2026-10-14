-- Fase 3 do plano de assinaturas: motor de assinatura (trial, carência, pró-rata, cupom, pausa,
-- cancelamento com política, reajuste, juros/multa, régua por produto, auditoria, fila de envio).

-- produtos: regras do plano
ALTER TABLE `whatsapp_products`
  ADD COLUMN `trial_days` SMALLINT NOT NULL DEFAULT 0 AFTER `billing`,
  ADD COLUMN `grace_days` SMALLINT NOT NULL DEFAULT 0 AFTER `trial_days`,
  ADD COLUMN `prorate` TINYINT(1) NOT NULL DEFAULT 1 AFTER `grace_days`,
  ADD COLUMN `cancel_policy` VARCHAR(16) NOT NULL DEFAULT 'end_of_cycle' AFTER `prorate`,
  ADD COLUMN `billing_interval_months` TINYINT NULL AFTER `cancel_policy`,
  ADD COLUMN `charge_days_before` TINYINT NULL AFTER `billing_interval_months`,
  ADD COLUMN `reminder_rules` JSON NULL AFTER `charge_days_before`,
  ADD COLUMN `entitlement` JSON NULL AFTER `reminder_rules`,
  ADD COLUMN `custom` JSON NULL AFTER `entitlement`,
  ADD COLUMN `category` VARCHAR(64) NULL AFTER `custom`;

-- assinaturas: trial, pausa programada, cancelamento agendado, cupom/desconto, ids externos, origem
ALTER TABLE `whatsapp_subscriptions`
  ADD COLUMN `trial_ends_at` DATE NULL AFTER `next_due_at`,
  ADD COLUMN `paused_until` DATE NULL AFTER `trial_ends_at`,
  ADD COLUMN `cancel_at` DATE NULL AFTER `paused_until`,
  ADD COLUMN `cancel_reason` VARCHAR(255) NULL AFTER `cancel_at`,
  ADD COLUMN `coupon_id` CHAR(36) NULL AFTER `cancel_reason`,
  ADD COLUMN `discount_cents` INT NOT NULL DEFAULT 0 AFTER `coupon_id`,
  ADD COLUMN `discount_until` DATE NULL AFTER `discount_cents`,
  ADD COLUMN `custom` JSON NULL AFTER `discount_until`,
  ADD COLUMN `external_id` VARCHAR(64) NULL AFTER `custom`,
  ADD COLUMN `contract_number` VARCHAR(64) NULL AFTER `external_id`,
  ADD COLUMN `source` VARCHAR(16) NOT NULL DEFAULT 'panel' AFTER `contract_number`,
  ADD INDEX `idx_wasub_org_external` (`organization_id`, `external_id`),
  ADD INDEX `idx_wasub_cancel_at` (`status`, `cancel_at`),
  ADD INDEX `idx_wasub_paused` (`status`, `paused_until`);

-- cobranças: bloco do bot que gerou (entrega tardia) e valor antes de juros/multa (2ª via)
ALTER TABLE `whatsapp_charges`
  ADD COLUMN `bot_flow_id` CHAR(36) NULL AFTER `created_by`,
  ADD COLUMN `bot_node_id` VARCHAR(64) NULL AFTER `bot_flow_id`,
  ADD COLUMN `base_amount_cents` INT NULL AFTER `amount_cents`;

-- cupons (código único por org)
CREATE TABLE `whatsapp_coupons` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `code` VARCHAR(32) NOT NULL,
  `kind` VARCHAR(8) NOT NULL DEFAULT 'percent',
  `value` INT NOT NULL DEFAULT 0,
  `duration` VARCHAR(8) NOT NULL DEFAULT 'once',
  `months` TINYINT NULL,
  `max_uses` INT NULL,
  `used` INT NOT NULL DEFAULT 0,
  `product_ids` JSON NULL,
  `expires_at` DATE NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_wacoupon_org_code` (`organization_id`, `code`),
  INDEX `idx_wacoupon_org_active` (`organization_id`, `active`),
  CONSTRAINT `fk_wacoupon_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- auditoria da assinatura (toda transição)
CREATE TABLE `whatsapp_subscription_events` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `subscription_id` CHAR(36) NOT NULL,
  `kind` VARCHAR(32) NOT NULL,
  `data` JSON NULL,
  `user_id` CHAR(36) NULL,
  `source` VARCHAR(16) NOT NULL DEFAULT 'system',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_wasubev_sub` (`subscription_id`, `created_at`),
  INDEX `idx_wasubev_org` (`organization_id`, `created_at`),
  CONSTRAINT `fk_wasubev_sub` FOREIGN KEY (`subscription_id`) REFERENCES `whatsapp_subscriptions` (`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- fila genérica de envio com ritmo (cobranças recorrentes, lembretes, avisos de assinatura)
CREATE TABLE `whatsapp_outbox` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `session_id` CHAR(36) NOT NULL,
  `chat_id` VARCHAR(64) NOT NULL,
  `kind` VARCHAR(32) NOT NULL,
  `payload` JSON NOT NULL,
  `run_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
  `attempts` TINYINT NOT NULL DEFAULT 0,
  `last_error` VARCHAR(255) NULL,
  `dedupe_key` VARCHAR(120) NULL,
  `sent_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_waoutbox_due` (`status`, `run_at`),
  INDEX `idx_waoutbox_session` (`session_id`, `status`),
  INDEX `idx_waoutbox_org` (`organization_id`, `status`),
  UNIQUE INDEX `uk_waoutbox_dedupe` (`organization_id`, `dedupe_key`),
  CONSTRAINT `fk_waoutbox_session` FOREIGN KEY (`session_id`) REFERENCES `whatsapp_sessions` (`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
