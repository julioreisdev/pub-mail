-- WhatsApp: filtros personalizados do chat + agendamentos pontuais de mensagem.
CREATE TABLE IF NOT EXISTS `whatsapp_chat_filters` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `name` VARCHAR(60) NOT NULL,
  `chat_ids` JSON NULL,
  `position` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  INDEX `idx_wafilter_org` (`organization_id`, `position`),
  CONSTRAINT `fk_wafilter_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `whatsapp_schedules` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `targets` JSON NULL,
  `messages` JSON NULL,
  `schedule_at` DATETIME(3) NOT NULL,
  `status` VARCHAR(12) NOT NULL DEFAULT 'pending',
  `results` JSON NULL,
  `error` VARCHAR(255) NULL,
  `sent_at` DATETIME(3) NULL,
  `created_by` CHAR(36) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  INDEX `idx_wasched_org` (`organization_id`, `schedule_at`),
  INDEX `idx_wasched_due` (`status`, `schedule_at`),
  CONSTRAINT `fk_wasched_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
