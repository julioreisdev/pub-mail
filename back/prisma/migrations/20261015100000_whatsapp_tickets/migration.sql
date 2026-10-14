-- Fase 6B (assinaturas WhatsApp): chamados / protocolos — contrato docs/whatsapp-assinaturas-contrato.md §10

ALTER TABLE `whatsapp_crm_settings` ADD COLUMN `tickets` JSON NULL AFTER `scheduling`;

-- contador sem furo por org (protocolo): INSERT … ON DUPLICATE KEY UPDATE value = LAST_INSERT_ID(value+1) na transação da criação
CREATE TABLE `whatsapp_counters` (
  `organization_id` CHAR(36) NOT NULL,
  `name` VARCHAR(32) NOT NULL,
  `value` INT NOT NULL DEFAULT 0,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`organization_id`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `whatsapp_tickets` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `number` INT NOT NULL,
  `protocol` VARCHAR(24) NOT NULL,
  `session_id` CHAR(36) NULL,
  `chat_id` VARCHAR(64) NULL,
  `contact_id` CHAR(36) NULL,
  `customer_id` CHAR(36) NULL,
  `category` VARCHAR(40) NOT NULL,
  `subject` VARCHAR(160) NOT NULL,
  `description` TEXT NULL,
  `priority` VARCHAR(10) NOT NULL DEFAULT 'normal',
  `status` VARCHAR(10) NOT NULL DEFAULT 'open',
  `assigned_user_id` CHAR(36) NULL,
  `first_response_due_at` DATETIME(3) NULL,
  `first_response_at` DATETIME(3) NULL,
  `sla_due_at` DATETIME(3) NULL,
  `sla_warned_at` DATETIME(3) NULL,
  `sla_breached_at` DATETIME(3) NULL,
  `resolved_at` DATETIME(3) NULL,
  `closed_at` DATETIME(3) NULL,
  `reopen_count` INT NOT NULL DEFAULT 0,
  `media_ids` JSON NULL,
  `source` VARCHAR(10) NOT NULL DEFAULT 'panel',
  `custom` JSON NULL,
  `created_by` CHAR(36) NULL,
  `last_event_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_watk_org_protocol` (`organization_id`, `protocol`),
  KEY `idx_watk_org_status_sla` (`organization_id`, `status`, `sla_due_at`),
  KEY `idx_watk_org_contact` (`organization_id`, `contact_id`),
  KEY `idx_watk_org_customer` (`organization_id`, `customer_id`),
  KEY `idx_watk_org_chat` (`organization_id`, `session_id`, `chat_id`),
  KEY `idx_watk_org_created` (`organization_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `whatsapp_ticket_events` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `ticket_id` CHAR(36) NOT NULL,
  `kind` VARCHAR(20) NOT NULL,
  `by` VARCHAR(10) NOT NULL DEFAULT 'system',
  `user_id` CHAR(36) NULL,
  `from_value` VARCHAR(64) NULL,
  `to_value` VARCHAR(64) NULL,
  `body` TEXT NULL,
  `visibility` VARCHAR(10) NOT NULL DEFAULT 'internal',
  `media_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_watkev_ticket` (`ticket_id`, `created_at`),
  KEY `idx_watkev_org` (`organization_id`, `created_at`),
  CONSTRAINT `fk_watkev_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `whatsapp_tickets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
