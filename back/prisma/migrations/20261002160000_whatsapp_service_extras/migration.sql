-- WhatsApp CRM fase 4 (02/10/2026): satisfação (avaliações) e descadastro LGPD do contato.
CREATE TABLE `whatsapp_ratings` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `chat_id` VARCHAR(64) NOT NULL,
  `user_id` CHAR(36) NULL,
  `score` TINYINT NULL,
  `comment` TEXT NULL,
  `asked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `answered_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_warating_org_asked` (`organization_id`, `asked_at`),
  KEY `idx_warating_org_user` (`organization_id`, `user_id`),
  KEY `idx_warating_org_chat` (`organization_id`, `chat_id`),
  CONSTRAINT `fk_warating_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `whatsapp_contacts`
  ADD COLUMN `opted_out_at` DATETIME(3) NULL AFTER `is_blocked`,
  ADD INDEX `idx_wacontact_org_optout` (`organization_id`, `opted_out_at`);
