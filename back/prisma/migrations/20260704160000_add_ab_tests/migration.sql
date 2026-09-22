-- Teste A/B de assunto e template
CREATE TABLE `email_ab_tests` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `project_id` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'testing',
  `test_percent` INT NOT NULL DEFAULT 30,
  `winner_metric` VARCHAR(10) NOT NULL DEFAULT 'open',
  `decision_at` DATETIME(0) NOT NULL,
  `test_emails` JSON NULL,
  `winner_variant_id` CHAR(36) NULL,
  `winner_sent_id` CHAR(36) NULL,
  `error_message` VARCHAR(255) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_ab_tests_due` (`status`, `decision_at`),
  INDEX `idx_ab_tests_project` (`project_id`),
  INDEX `idx_ab_tests_org` (`organization_id`),
  CONSTRAINT `fk_ab_tests_project` FOREIGN KEY (`project_id`) REFERENCES `email_projects` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE `email_ab_variants` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `ab_test_id` CHAR(36) NOT NULL,
  `label` VARCHAR(8) NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `body_html` LONGTEXT NULL,
  `builder_model` JSON NULL,
  `test_sent_id` CHAR(36) NULL,
  `recipients_count` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_ab_variants_test` (`ab_test_id`),
  CONSTRAINT `fk_ab_variants_test` FOREIGN KEY (`ab_test_id`) REFERENCES `email_ab_tests` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
);
