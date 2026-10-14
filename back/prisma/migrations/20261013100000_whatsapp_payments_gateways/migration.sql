-- Fase 4 do plano de assinaturas: gateways por finalidade (Asaas), cartão recorrente por token, link de
-- pagamento, parcelamento e conciliação.

-- gateway por finalidade (só as Cobranças do WhatsApp usam): {pix, boleto, card, tokens:{asaas,…}, asaas_webhook_*}
ALTER TABLE `telegram_payment_settings`
  ADD COLUMN `providers` JSON NULL AFTER `checkout_config`;

-- id do cliente em cada gateway ({asaas: 'cus_…'})
ALTER TABLE `whatsapp_customers`
  ADD COLUMN `provider_refs` JSON NULL AFTER `custom`;

-- produto avulso pode ser parcelado no cartão (até N vezes)
ALTER TABLE `whatsapp_products`
  ADD COLUMN `installments_max` TINYINT NULL AFTER `category`;

-- assinatura: meio de pagamento escolhido e o cartão salvo
ALTER TABLE `whatsapp_subscriptions`
  ADD COLUMN `payment_method` VARCHAR(8) NULL AFTER `source`,
  ADD COLUMN `payment_method_id` CHAR(36) NULL AFTER `payment_method`;

-- cobrança: provedor de cada meio, cartão (página/token, tentativas), parcelas e link público
ALTER TABLE `whatsapp_charges`
  ADD COLUMN `pix_provider` VARCHAR(32) NULL AFTER `provider`,
  ADD COLUMN `boleto_provider` VARCHAR(32) NULL AFTER `pix_provider`,
  ADD COLUMN `card_provider` VARCHAR(32) NULL AFTER `boleto_provider`,
  ADD COLUMN `card_charge_id` VARCHAR(128) NULL AFTER `boleto_expires_at`,
  ADD COLUMN `card_url` VARCHAR(500) NULL AFTER `card_charge_id`,
  ADD COLUMN `card_attempts` TINYINT NOT NULL DEFAULT 0 AFTER `card_url`,
  ADD COLUMN `card_next_attempt_at` DATETIME(3) NULL AFTER `card_attempts`,
  ADD COLUMN `card_error` VARCHAR(255) NULL AFTER `card_next_attempt_at`,
  ADD COLUMN `payment_method_id` CHAR(36) NULL AFTER `card_error`,
  ADD COLUMN `installments` TINYINT NULL AFTER `payment_method_id`,
  ADD COLUMN `pay_link_token` VARCHAR(40) NULL AFTER `installments`,
  ADD UNIQUE INDEX `uk_wachg_paylink` (`pay_link_token`),
  ADD INDEX `idx_wachg_card` (`card_charge_id`),
  ADD INDEX `idx_wachg_card_retry` (`status`, `card_next_attempt_at`);
-- cobranças antigas: o provedor do PIX/boleto é o que já estava em `provider`
UPDATE `whatsapp_charges` SET `pix_provider` = `provider` WHERE `pix_charge_id` IS NOT NULL AND `pix_provider` IS NULL;
UPDATE `whatsapp_charges` SET `boleto_provider` = `provider` WHERE `boleto_charge_id` IS NOT NULL AND `boleto_provider` IS NULL;

-- cartões salvos (token do gateway CIFRADO pela extensão do Prisma; o número do cartão nunca passa por nós)
CREATE TABLE `whatsapp_payment_methods` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `provider` VARCHAR(32) NOT NULL,
  `provider_customer_id` VARCHAR(64) NULL,
  `provider_token` TEXT NOT NULL,
  `brand` VARCHAR(32) NULL,
  `last4` VARCHAR(4) NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'active',
  `failures` TINYINT NOT NULL DEFAULT 0,
  `last_used_at` DATETIME(3) NULL,
  `created_from_charge_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_wapaymeth_customer` (`customer_id`, `status`),
  INDEX `idx_wapaymeth_org` (`organization_id`, `status`),
  CONSTRAINT `fk_wapaymeth_customer` FOREIGN KEY (`customer_id`) REFERENCES `whatsapp_customers` (`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
