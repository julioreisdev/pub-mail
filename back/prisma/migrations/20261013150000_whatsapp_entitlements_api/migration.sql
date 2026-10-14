-- Fase 5 do plano de assinaturas: direito de acesso (entitlements), API pública da org e webhooks de saída.

-- O que um pagamento libera para o cliente (por assinatura e regra do produto): entrar num grupo do WhatsApp,
-- etiqueta, arquivo digital ou só um aviso para o sistema do cliente (externo).
-- `desired` = estado que o motor quer; `status` = estado aplicado (o worker aplica a diferença com novas tentativas).
CREATE TABLE `whatsapp_entitlements` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `subscription_id` CHAR(36) NULL,
  `product_id` CHAR(36) NULL,
  `rule_id` VARCHAR(16) NOT NULL,
  `kind` VARCHAR(32) NOT NULL,
  `ref` VARCHAR(255) NOT NULL,
  `label` VARCHAR(120) NULL,
  `session_id` CHAR(36) NULL,
  `target` VARCHAR(64) NOT NULL DEFAULT '',
  `desired` VARCHAR(16) NOT NULL DEFAULT 'active',
  `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
  `attempts` TINYINT NOT NULL DEFAULT 0,
  `next_try_at` DATETIME(3) NULL,
  `error` VARCHAR(255) NULL,
  `last_sync_at` DATETIME(3) NULL,
  `activated_at` DATETIME(3) NULL,
  `suspended_at` DATETIME(3) NULL,
  `revoked_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_waent_sub_rule_target` (`subscription_id`, `rule_id`, `target`),
  INDEX `idx_waent_org_customer` (`organization_id`, `customer_id`),
  INDEX `idx_waent_work` (`status`, `desired`, `next_try_at`),
  CONSTRAINT `fk_waent_customer` FOREIGN KEY (`customer_id`) REFERENCES `whatsapp_customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_waent_subscription` FOREIGN KEY (`subscription_id`) REFERENCES `whatsapp_subscriptions` (`id`) ON DELETE SET NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chaves de API da organização (`Authorization: Bearer pm_<prefixo>_<segredo>`); só o hash sha256 fica no banco.
CREATE TABLE `org_api_keys` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `key_prefix` VARCHAR(16) NOT NULL,
  `key_hash` CHAR(64) NOT NULL,
  `scopes` JSON NULL,
  `created_by` CHAR(36) NULL,
  `last_used_at` DATETIME(3) NULL,
  `last_ip` VARCHAR(64) NULL,
  `revoked_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_orgapikey_hash` (`key_hash`),
  INDEX `idx_orgapikey_org` (`organization_id`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Webhooks de saída (o Pub Mail avisa o sistema do cliente). `secret` assina o corpo (HMAC-SHA256) e é CIFRADO.
CREATE TABLE `org_webhooks` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `url` VARCHAR(500) NOT NULL,
  `secret` TEXT NOT NULL,
  `events` JSON NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `failures` INT NOT NULL DEFAULT 0,
  `last_status` INT NULL,
  `last_error` VARCHAR(255) NULL,
  `last_delivery_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_orgwh_org` (`organization_id`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Entregas (fila + histórico, 30 dias). `payload` (dados do cliente) é CIFRADO.
CREATE TABLE `org_webhook_deliveries` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `webhook_id` CHAR(36) NOT NULL,
  `event` VARCHAR(64) NOT NULL,
  `payload` LONGTEXT NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
  `attempts` TINYINT NOT NULL DEFAULT 0,
  `next_try_at` DATETIME(3) NULL,
  `last_status` INT NULL,
  `last_error` VARCHAR(255) NULL,
  `duration_ms` INT NULL,
  `delivered_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_orgwhd_work` (`status`, `next_try_at`),
  INDEX `idx_orgwhd_hook_created` (`webhook_id`, `created_at`),
  INDEX `idx_orgwhd_org_created` (`organization_id`, `created_at`),
  CONSTRAINT `fk_orgwhd_webhook` FOREIGN KEY (`webhook_id`) REFERENCES `org_webhooks` (`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
