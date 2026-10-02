-- WhatsApp v2: etiquetas, atendimento (bot/humano), respostas rápidas, fluxo do bot e PIX do bot.

-- Conversa: etiquetas + estado do atendimento
ALTER TABLE `whatsapp_chats`
  ADD COLUMN `tags` JSON NULL,
  ADD COLUMN `service_status` VARCHAR(16) NOT NULL DEFAULT 'none',
  ADD COLUMN `assigned_user_id` CHAR(36) NULL,
  ADD COLUMN `service_started_at` DATETIME(3) NULL,
  ADD COLUMN `service_last_human_at` DATETIME(3) NULL,
  ADD COLUMN `service_closed_at` DATETIME(3) NULL,
  ADD COLUMN `last_inbound_at` DATETIME(3) NULL,
  ADD COLUMN `last_outbound_at` DATETIME(3) NULL,
  ADD INDEX `idx_wachat_org_service` (`organization_id`, `service_status`),
  ADD INDEX `idx_wachat_org_assigned` (`organization_id`, `assigned_user_id`);

-- Catálogo de etiquetas da organização
CREATE TABLE `whatsapp_tags` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `name` VARCHAR(40) NOT NULL,
  `color` VARCHAR(16) NOT NULL DEFAULT '#25D366',
  `position` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_watag_org_name` (`organization_id`, `name`),
  CONSTRAINT `fk_watag_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Respostas rápidas (/atalho no campo de mensagem)
CREATE TABLE `whatsapp_quick_replies` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `shortcut` VARCHAR(40) NOT NULL,
  `title` VARCHAR(80) NULL,
  `text` TEXT NULL,
  `media_id` CHAR(36) NULL,
  `position` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_waqr_org_shortcut` (`organization_id`, `shortcut`),
  CONSTRAINT `fk_waqr_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Linha do tempo do atendimento (bot iniciou, transferiu, assumiu, encerrou, reiniciou…)
CREATE TABLE `whatsapp_service_events` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `chat_id` VARCHAR(64) NOT NULL,
  `event` VARCHAR(32) NOT NULL,
  `user_id` CHAR(36) NULL,
  `meta` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_wasvc_org_chat` (`organization_id`, `chat_id`, `created_at`),
  CONSTRAINT `fk_wasvc_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fluxo do bot (1 por organização): definição do construtor + configurações
CREATE TABLE `whatsapp_bot_flows` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `name` VARCHAR(120) NOT NULL DEFAULT 'Fluxo do bot',
  `active` BOOLEAN NOT NULL DEFAULT false,
  `definition` JSON NULL,
  `settings` JSON NULL,
  `published_at` DATETIME(3) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_wabot_org` (`organization_id`),
  CONSTRAINT `fk_wabot_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Estado do bot por conversa
CREATE TABLE `whatsapp_bot_sessions` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `chat_id` VARCHAR(64) NOT NULL,
  `flow_id` CHAR(36) NULL,
  `node_id` VARCHAR(64) NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'active',
  `vars` JSON NULL,
  `retries` INT NOT NULL DEFAULT 0,
  `wait_until` DATETIME(3) NULL,
  `payment_id` CHAR(36) NULL,
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_wabs_org_chat` (`organization_id`, `chat_id`),
  INDEX `idx_wabs_status_wait` (`status`, `wait_until`),
  CONSTRAINT `fk_wabs_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cobranças PIX feitas pelo bot (gateway de pagamento da própria organização)
CREATE TABLE `whatsapp_payments` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `chat_id` VARCHAR(64) NOT NULL,
  `bot_session_id` CHAR(36) NULL,
  `node_id` VARCHAR(64) NULL,
  `provider` VARCHAR(32) NOT NULL,
  `provider_charge_id` VARCHAR(128) NULL,
  `amount_cents` INT NOT NULL,
  `description` VARCHAR(255) NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  `pix_code` TEXT NULL,
  `qr_base64` MEDIUMTEXT NULL,
  `expires_at` DATETIME(3) NULL,
  `paid_at` DATETIME(3) NULL,
  `context` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_wapay_org_chat` (`organization_id`, `chat_id`),
  INDEX `idx_wapay_status` (`status`, `expires_at`),
  INDEX `idx_wapay_charge` (`provider_charge_id`),
  CONSTRAINT `fk_wapay_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
