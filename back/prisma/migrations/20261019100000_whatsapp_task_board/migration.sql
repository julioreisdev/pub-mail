-- Tarefas do WhatsApp viram quadro estilo Trello: colunas da conta, posição do cartão, etiquetas, checklist e capa.
CREATE TABLE `whatsapp_task_lists` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `name` VARCHAR(60) NOT NULL,
  `color` VARCHAR(16) NULL,
  `position` INT NOT NULL DEFAULT 0,
  `is_done` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_watasklist_org_pos` (`organization_id`, `position`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `whatsapp_task_labels` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `name` VARCHAR(40) NOT NULL DEFAULT '',
  `color` VARCHAR(16) NOT NULL,
  `position` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_wataskl_org_pos` (`organization_id`, `position`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `whatsapp_tasks`
  ADD COLUMN `list_id` CHAR(36) NULL AFTER `customer_id`,
  ADD COLUMN `position` DOUBLE NOT NULL DEFAULT 0 AFTER `list_id`,
  ADD COLUMN `label_ids` JSON NULL AFTER `position`,
  ADD COLUMN `checklist` JSON NULL AFTER `label_ids`,
  ADD COLUMN `cover` VARCHAR(16) NULL AFTER `checklist`,
  ADD KEY `idx_watask_org_list` (`organization_id`, `list_id`, `position`);
