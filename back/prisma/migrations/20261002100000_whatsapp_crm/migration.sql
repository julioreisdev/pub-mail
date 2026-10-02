-- WhatsApp CRM (fase 1): produtos/serviços, clientes (contato promovido) e assinaturas.

CREATE TABLE `whatsapp_crm_settings` (
  `organization_id` CHAR(36) NOT NULL,
  `custom_fields` JSON NULL,
  `charge` JSON NULL,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`organization_id`),
  CONSTRAINT `fk_wacrm_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `whatsapp_products` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `description` VARCHAR(500) NULL,
  `price_cents` INT NOT NULL DEFAULT 0,
  `billing` VARCHAR(16) NOT NULL DEFAULT 'once',
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `position` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_waprod_org` (`organization_id`, `active`, `position`),
  CONSTRAINT `fk_waprod_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `whatsapp_customers` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `contact_id` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `doc` VARCHAR(20) NULL,
  `email` VARCHAR(255) NULL,
  `address` JSON NULL,
  `notes` TEXT NULL,
  `custom` JSON NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'active',
  `since` DATE NULL,
  `created_by` CHAR(36) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_wacust_contact` (`organization_id`, `contact_id`),
  INDEX `idx_wacust_org_status` (`organization_id`, `status`),
  INDEX `idx_wacust_org_name` (`organization_id`, `name`),
  CONSTRAINT `fk_wacust_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wacust_contact` FOREIGN KEY (`contact_id`) REFERENCES `whatsapp_contacts` (`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `whatsapp_subscriptions` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NULL,
  `product_name` VARCHAR(120) NOT NULL,
  `price_cents` INT NOT NULL DEFAULT 0,
  `billing` VARCHAR(16) NOT NULL DEFAULT 'monthly',
  `due_day` TINYINT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'active',
  `started_at` DATE NULL,
  `next_due_at` DATE NULL,
  `last_paid_at` DATETIME(3) NULL,
  `canceled_at` DATETIME(3) NULL,
  `notes` VARCHAR(500) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_wasub_customer` (`customer_id`, `status`),
  INDEX `idx_wasub_org_due` (`organization_id`, `status`, `next_due_at`),
  INDEX `idx_wasub_product` (`product_id`),
  CONSTRAINT `fk_wasub_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wasub_customer` FOREIGN KEY (`customer_id`) REFERENCES `whatsapp_customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wasub_product` FOREIGN KEY (`product_id`) REFERENCES `whatsapp_products` (`id`) ON DELETE SET NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
