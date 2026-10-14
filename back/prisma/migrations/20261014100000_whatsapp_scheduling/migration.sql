-- Fase 6 do plano de assinaturas: agendamento com pagamento (salão, lava-rápido, clínica, aula…).

-- Produto vira "serviço" quando tem duração. kind: product|plan|service (legado = product).
ALTER TABLE `whatsapp_products`
  ADD COLUMN `kind` VARCHAR(16) NOT NULL DEFAULT 'product' AFTER `billing`,
  ADD COLUMN `duration_minutes` SMALLINT NULL AFTER `kind`,
  ADD COLUMN `buffer_after_minutes` SMALLINT NOT NULL DEFAULT 0 AFTER `duration_minutes`,
  ADD COLUMN `capacity` SMALLINT NOT NULL DEFAULT 1 AFTER `buffer_after_minutes`,
  ADD COLUMN `booking` JSON NULL AFTER `capacity`,
  ADD COLUMN `included_in_plans` JSON NULL AFTER `booking`;
-- produtos recorrentes existentes = plano
UPDATE `whatsapp_products` SET `kind` = 'plan' WHERE `billing` <> 'once';

-- Configurações de agendamento da org (textos, lembretes, falta, lista de espera).
ALTER TABLE `whatsapp_crm_settings` ADD COLUMN `scheduling` JSON NULL AFTER `identity`;

-- Quem/o que atende: profissional, box, sala, cadeira, equipamento.
CREATE TABLE `whatsapp_resources` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `kind` VARCHAR(16) NOT NULL DEFAULT 'person',
  `session_id` CHAR(36) NULL,
  `user_id` CHAR(36) NULL,
  `color` VARCHAR(7) NULL,
  `photo_media_id` CHAR(36) NULL,
  `services` JSON NULL,
  `availability` JSON NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `position` INT NOT NULL DEFAULT 0,
  `ics_token` VARCHAR(40) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_wares_ics` (`ics_token`),
  INDEX `idx_wares_org` (`organization_id`, `active`, `position`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bloqueios (férias, folga, manutenção). resource_id NULL = todos (feriado).
CREATE TABLE `whatsapp_resource_blocks` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `resource_id` CHAR(36) NULL,
  `starts_at` DATETIME(3) NOT NULL,
  `ends_at` DATETIME(3) NOT NULL,
  `reason` VARCHAR(120) NULL,
  `created_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_wablk_org_start` (`organization_id`, `starts_at`),
  INDEX `idx_wablk_res_start` (`resource_id`, `starts_at`),
  CONSTRAINT `fk_wares_block_resource` FOREIGN KEY (`resource_id`) REFERENCES `whatsapp_resources` (`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Agendamentos. Sem unique de horário: capacidade > 1 e intervalo de limpeza → reserva por claim em transação.
CREATE TABLE `whatsapp_appointments` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `session_id` CHAR(36) NULL,
  `chat_id` VARCHAR(64) NULL,
  `customer_id` CHAR(36) NULL,
  `contact_id` CHAR(36) NULL,
  `resource_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NULL,
  `service_name` VARCHAR(120) NOT NULL,
  `price_cents` INT NOT NULL DEFAULT 0,
  `starts_at` DATETIME(3) NOT NULL,
  `ends_at` DATETIME(3) NOT NULL,
  `service_ends_at` DATETIME(3) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'booked',
  `payment` VARCHAR(16) NOT NULL DEFAULT 'none',
  `charge_id` CHAR(36) NULL,
  `paid_cents` INT NOT NULL DEFAULT 0,
  `credit_cents` INT NOT NULL DEFAULT 0,
  `subscription_id` CHAR(36) NULL,
  `pay_until` DATETIME(3) NULL,
  `source` VARCHAR(8) NOT NULL DEFAULT 'panel',
  `confirmed_at` DATETIME(3) NULL,
  `reminders` JSON NULL,
  `started_at` DATETIME(3) NULL,
  `done_at` DATETIME(3) NULL,
  `canceled_at` DATETIME(3) NULL,
  `cancel_by` VARCHAR(8) NULL,
  `cancel_reason` VARCHAR(255) NULL,
  `rescheduled_from` CHAR(36) NULL,
  `reschedules` TINYINT NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  `custom` JSON NULL,
  `created_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_waappt_org_start` (`organization_id`, `starts_at`),
  INDEX `idx_waappt_res_start` (`resource_id`, `starts_at`),
  INDEX `idx_waappt_cust_start` (`customer_id`, `starts_at`),
  INDEX `idx_waappt_contact_start` (`contact_id`, `starts_at`),
  INDEX `idx_waappt_status_start` (`status`, `starts_at`),
  INDEX `idx_waappt_charge` (`charge_id`),
  CONSTRAINT `fk_waappt_resource` FOREIGN KEY (`resource_id`) REFERENCES `whatsapp_resources` (`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lista de espera.
CREATE TABLE `whatsapp_waitlist` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `session_id` CHAR(36) NULL,
  `chat_id` VARCHAR(64) NULL,
  `contact_id` CHAR(36) NULL,
  `customer_id` CHAR(36) NULL,
  `product_id` CHAR(36) NOT NULL,
  `resource_id` CHAR(36) NULL,
  `date_from` DATE NOT NULL,
  `date_to` DATE NOT NULL,
  `period` VARCHAR(12) NOT NULL DEFAULT 'any',
  `status` VARCHAR(12) NOT NULL DEFAULT 'waiting',
  `offered_starts_at` DATETIME(3) NULL,
  `offered_resource_id` CHAR(36) NULL,
  `offered_at` DATETIME(3) NULL,
  `expires_at` DATETIME(3) NULL,
  `appointment_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_wawait_org_status` (`organization_id`, `status`, `date_from`),
  INDEX `idx_wawait_product` (`product_id`, `status`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Usos de serviço incluídos num plano, por ciclo da assinatura.
CREATE TABLE `whatsapp_subscription_usage` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `subscription_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `cycle_start` DATE NOT NULL,
  `used` INT NOT NULL DEFAULT 0,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_wausage_sub_prod_cycle` (`subscription_id`, `product_id`, `cycle_start`),
  CONSTRAINT `fk_wausage_subscription` FOREIGN KEY (`subscription_id`) REFERENCES `whatsapp_subscriptions` (`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Créditos do cliente (cancelamento com política "crédito", sobra de pagamento): usados na próxima reserva.
CREATE TABLE `whatsapp_customer_credits` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `amount_cents` INT NOT NULL,
  `reason` VARCHAR(255) NULL,
  `appointment_id` CHAR(36) NULL,
  `used_cents` INT NOT NULL DEFAULT 0,
  `expires_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_wacredit_customer` (`customer_id`, `created_at`),
  CONSTRAINT `fk_wacredit_customer` FOREIGN KEY (`customer_id`) REFERENCES `whatsapp_customers` (`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
