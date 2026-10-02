-- Status (stories) postados pelos CONTATOS nas últimas 24 h (os status da própria conta ficam em whatsapp_statuses).
CREATE TABLE `whatsapp_contact_statuses` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `wa_status_id` VARCHAR(191) NOT NULL,
  `contact_jid` VARCHAR(64) NOT NULL,
  `chat_id` VARCHAR(64) NOT NULL,
  `contact_name` VARCHAR(255) NULL,
  `type` VARCHAR(16) NOT NULL DEFAULT 'text',
  `caption` TEXT NULL,
  `background_color` VARCHAR(16) NULL,
  `font` INT NULL,
  `media_id` CHAR(36) NULL,
  `media_omitted` BOOLEAN NOT NULL DEFAULT false,
  `posted_at` DATETIME(3) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `viewed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_wacs_org_status` (`organization_id`, `wa_status_id`),
  INDEX `idx_wacs_org_expires` (`organization_id`, `expires_at`),
  CONSTRAINT `fk_wacs_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
