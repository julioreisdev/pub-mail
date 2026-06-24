-- Leads de quiz (espelho de webchat_leads, com quiz_id).
CREATE TABLE `quiz_leads` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `organization_id` CHAR(36) NOT NULL,
  `quiz_id` CHAR(36) NOT NULL,
  `email` VARCHAR(255) NULL,
  `name` VARCHAR(255) NULL,
  `phone` VARCHAR(30) NULL,
  `source` VARCHAR(100) NULL,
  `context` JSON NULL,
  `custom_fields` JSON NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  KEY `idx_quiz_leads_org_quiz` (`organization_id`, `quiz_id`),
  KEY `idx_quiz_leads_org_email` (`organization_id`, `email`),
  CONSTRAINT `fk_quiz_leads_organization_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`),
  CONSTRAINT `fk_quiz_leads_quiz_id` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;
