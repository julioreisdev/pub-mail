-- Fase 1 do plano de assinaturas: identidade do cliente.
-- Um cliente pode ter vários números (vínculos) e um número pode servir a vários clientes.
CREATE TABLE `whatsapp_customer_contacts` (
  `customer_id` CHAR(36) NOT NULL,
  `contact_id`  CHAR(36) NOT NULL,
  `role`        VARCHAR(16) NOT NULL DEFAULT 'owner',
  `linked_by`   VARCHAR(8)  NOT NULL DEFAULT 'panel',
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`customer_id`, `contact_id`),
  KEY `idx_wacustcont_contact` (`contact_id`),
  CONSTRAINT `fk_wacustcont_customer` FOREIGN KEY (`customer_id`) REFERENCES `whatsapp_customers`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wacustcont_contact`  FOREIGN KEY (`contact_id`)  REFERENCES `whatsapp_contacts`(`id`)  ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- backfill: o contato de cada cliente existente vira o vínculo "owner"
INSERT IGNORE INTO `whatsapp_customer_contacts` (`customer_id`, `contact_id`, `role`, `linked_by`, `created_at`)
SELECT `id`, `contact_id`, 'owner', 'panel', `created_at` FROM `whatsapp_customers`;

ALTER TABLE `whatsapp_customers`
  MODIFY COLUMN `doc` TEXT NULL,
  ADD COLUMN `code` VARCHAR(32) NULL AFTER `name`,
  ADD COLUMN `doc_hash` CHAR(64) NULL AFTER `doc`,
  ADD COLUMN `kind` VARCHAR(8) NOT NULL DEFAULT 'person' AFTER `code`,
  ADD COLUMN `parent_customer_id` CHAR(36) NULL AFTER `kind`,
  ADD COLUMN `source` VARCHAR(16) NOT NULL DEFAULT 'panel' AFTER `status`;

-- o mesmo contato pode ser de 2 clientes: o unique cai (a FK precisa de um índice simples antes)
ALTER TABLE `whatsapp_customers` ADD INDEX `idx_wacust_contact` (`contact_id`);
ALTER TABLE `whatsapp_customers` DROP INDEX `uk_wacust_contact`;
ALTER TABLE `whatsapp_customers`
  ADD UNIQUE INDEX `uk_wacust_org_code` (`organization_id`, `code`),
  ADD INDEX `idx_wacust_org_dochash` (`organization_id`, `doc_hash`),
  ADD INDEX `idx_wacust_parent` (`parent_customer_id`);

-- hash do documento (busca sem decifrar): sha256("<org>:<dígitos>") — igual ao docHash() do back
UPDATE `whatsapp_customers` SET `doc_hash` = SHA2(CONCAT(`organization_id`, ':', `doc`), 256) WHERE `doc` IS NOT NULL AND `doc` <> '' AND `doc` NOT LIKE 'wenc1:%';

ALTER TABLE `whatsapp_crm_settings` ADD COLUMN `identity` JSON NULL AFTER `service`;
