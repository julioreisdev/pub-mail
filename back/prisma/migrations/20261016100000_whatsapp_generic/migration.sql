-- Fase 7 (assinaturas WhatsApp): genérico para qualquer ramo — contrato docs/whatsapp-assinaturas-contrato.md §11

-- configuração de pedidos (catálogo/entrega/pagamento/textos)
ALTER TABLE `whatsapp_crm_settings` ADD COLUMN `orders` JSON NULL AFTER `tickets`;

-- valores de campos personalizados nas cobranças
ALTER TABLE `whatsapp_charges` ADD COLUMN `custom` JSON NULL;

-- unidades (filiais)
CREATE TABLE `whatsapp_units` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `code` VARCHAR(32) NULL,
  `address` JSON NULL,
  `phone` VARCHAR(32) NULL,
  `session_id` CHAR(36) NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `position` INT NOT NULL DEFAULT 0,
  `custom` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_waunit_org` (`organization_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- cliente: unidade, id no sistema externo, endereços de atendimento/entrega
ALTER TABLE `whatsapp_customers`
  ADD COLUMN `unit_id` CHAR(36) NULL,
  ADD COLUMN `external_id` VARCHAR(64) NULL,
  ADD COLUMN `addresses` JSON NULL,
  ADD UNIQUE KEY `uk_wacust_org_external` (`organization_id`, `external_id`),
  ADD KEY `idx_wacust_org_unit` (`organization_id`, `unit_id`);

-- pedidos
CREATE TABLE `whatsapp_orders` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `number` INT NOT NULL,
  `session_id` CHAR(36) NULL,
  `chat_id` VARCHAR(64) NULL,
  `contact_id` CHAR(36) NULL,
  `customer_id` CHAR(36) NULL,
  `unit_id` CHAR(36) NULL,
  `items` JSON NOT NULL,
  `subtotal_cents` INT NOT NULL DEFAULT 0,
  `delivery_fee_cents` INT NOT NULL DEFAULT 0,
  `discount_cents` INT NOT NULL DEFAULT 0,
  `total_cents` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'new',
  `payment_method` VARCHAR(16) NOT NULL DEFAULT 'none',
  `payment_status` VARCHAR(16) NOT NULL DEFAULT 'pending',
  `charge_id` CHAR(36) NULL,
  `delivery` JSON NULL,
  `notes` TEXT NULL,
  `source` VARCHAR(10) NOT NULL DEFAULT 'panel',
  `custom` JSON NULL,
  `history` JSON NULL,
  `confirmed_at` DATETIME(3) NULL,
  `paid_at` DATETIME(3) NULL,
  `delivered_at` DATETIME(3) NULL,
  `canceled_at` DATETIME(3) NULL,
  `cancel_reason` VARCHAR(255) NULL,
  `created_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_waorder_org_number` (`organization_id`, `number`),
  KEY `idx_waorder_org_status` (`organization_id`, `status`, `created_at`),
  KEY `idx_waorder_org_contact` (`organization_id`, `contact_id`),
  KEY `idx_waorder_org_customer` (`organization_id`, `customer_id`),
  KEY `idx_waorder_charge` (`charge_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- sub-permissões do WhatsApp: quem já tinha o módulo continua vendo tudo (nada muda para quem já usa)
UPDATE `users`
SET `modules` = JSON_ARRAY_APPEND(JSON_ARRAY_APPEND(JSON_ARRAY_APPEND(`modules`, '$', 'whatsapp:finance'), '$', 'whatsapp:crm'), '$', 'whatsapp:settings')
WHERE `modules` IS NOT NULL AND JSON_TYPE(`modules`) = 'ARRAY' AND JSON_CONTAINS(`modules`, '"whatsapp"')
  AND NOT JSON_CONTAINS(`modules`, '"whatsapp:finance"');
