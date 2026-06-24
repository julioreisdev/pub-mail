-- Anúncios de quiz (espelho de webchat_ads, com quiz_id). Por posição.
CREATE TABLE `quiz_ads` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `organization_id` CHAR(36) NOT NULL,
  `quiz_id` CHAR(36) NOT NULL,
  `position` VARCHAR(40) NOT NULL,
  `codigo_tag` TEXT NOT NULL,
  `gpt_sizes` VARCHAR(255) NULL,
  `gpt_slot` VARCHAR(255) NULL,
  `gpt_div_id` VARCHAR(255) NULL,
  `anuncio_fixed` TEXT NULL,
  `rotulo` VARCHAR(100) NULL,
  `rotulo_ativo` TINYINT(1) NOT NULL DEFAULT 1,
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_quiz_ads_quiz_position` (`quiz_id`, `position`),
  KEY `idx_quiz_ads_org_quiz` (`organization_id`, `quiz_id`),
  KEY `idx_quiz_ads_position` (`position`),
  CONSTRAINT `fk_quiz_ads_organization_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`),
  CONSTRAINT `fk_quiz_ads_quiz_id` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;
