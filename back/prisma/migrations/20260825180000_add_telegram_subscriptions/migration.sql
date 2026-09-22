-- Assinatura por tempo + renovação PIX: plano ganha duração; pagamento vira assinatura
-- com validade; o bot renova antes de expirar e remove o lead do VIP ao expirar.
ALTER TABLE `telegram_plans` ADD COLUMN `duration_days` INT NOT NULL DEFAULT 0;

CREATE TABLE `telegram_subscriptions` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `bot_id` CHAR(36) NOT NULL,
  `plan_id` CHAR(36) NULL,
  `tg_user_id` BIGINT NOT NULL,
  `contact_id` CHAR(36) NULL,
  `group_id` CHAR(36) NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  `access_until` DATETIME(3) NULL,
  `last_payment_id` CHAR(36) NULL,
  `reminded_at` DATETIME(3) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tgsub_org` (`organization_id`),
  KEY `idx_tgsub_status_until` (`status`, `access_until`),
  KEY `idx_tgsub_bot_user` (`bot_id`, `tg_user_id`),
  CONSTRAINT `fk_tgsub_bot` FOREIGN KEY (`bot_id`) REFERENCES `telegram_bots` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tgsub_plan` FOREIGN KEY (`plan_id`) REFERENCES `telegram_plans` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tgsub_contact` FOREIGN KEY (`contact_id`) REFERENCES `telegram_contacts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tgsub_group` FOREIGN KEY (`group_id`) REFERENCES `telegram_groups` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
