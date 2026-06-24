-- Módulo Quizzes: splits (pastas) + quizzes (espelho de webchats, sem agente).
CREATE TABLE `quiz_splits` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `organization_id` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_quiz_splits_slug` (`slug`),
  KEY `idx_quiz_splits_org` (`organization_id`),
  CONSTRAINT `fk_quiz_splits_organization_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `quizzes` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `organization_id` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(160) NOT NULL,
  `domain` VARCHAR(255) NOT NULL,
  `email_project_id` CHAR(36) NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `settings` JSON NULL,
  `header_scripts` TEXT NULL,
  `footer_scripts` TEXT NULL,
  `split_id` CHAR(36) NULL,
  `split_weight` INT NOT NULL DEFAULT 100,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_quizzes_domain_slug` (`domain`, `slug`),
  KEY `idx_quizzes_org` (`organization_id`),
  KEY `idx_quizzes_email_project` (`email_project_id`),
  KEY `idx_quizzes_split` (`split_id`),
  CONSTRAINT `fk_quizzes_organization_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_quizzes_email_project_id` FOREIGN KEY (`email_project_id`) REFERENCES `email_projects` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_quizzes_split_id` FOREIGN KEY (`split_id`) REFERENCES `quiz_splits` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Split "Padrão" de quiz para orgs existentes (slug único global no quiz_splits).
INSERT INTO `quiz_splits` (`id`, `organization_id`, `name`, `slug`, `is_default`, `created_at`, `updated_at`)
SELECT UUID(), id, 'Padrão', 'padrao', 1, NOW(), NOW()
FROM `organizations`
ORDER BY `created_at` ASC
LIMIT 1;

INSERT INTO `quiz_splits` (`id`, `organization_id`, `name`, `slug`, `is_default`, `created_at`, `updated_at`)
SELECT UUID(), o.id, 'Padrão', CONCAT('padrao-', LOWER(SUBSTRING(REPLACE(o.id, '-', ''), 1, 8))), 1, NOW(), NOW()
FROM `organizations` o
WHERE o.id NOT IN (SELECT `organization_id` FROM `quiz_splits` WHERE `is_default` = 1);
