-- Automação "Fluxo Inicial": sequência de e-mails (templates) enviados ao lead
-- após ser captado num projeto, com espaçamento de tempo entre cada.

CREATE TABLE `email_flows` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `organization_id` CHAR(36) NOT NULL,
  `project_id` CHAR(36) NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 0,
  `activated_at` DATETIME(0) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_email_flows_project` (`project_id`),
  KEY `idx_email_flows_org` (`organization_id`),
  CONSTRAINT `fk_email_flows_project` FOREIGN KEY (`project_id`) REFERENCES `email_projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_email_flows_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `email_flow_steps` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `flow_id` CHAR(36) NOT NULL,
  `position` INT NOT NULL DEFAULT 0,
  `delay_value` INT NOT NULL DEFAULT 0,
  `delay_unit` VARCHAR(10) NOT NULL DEFAULT 'minutes',
  `subject` VARCHAR(255) NOT NULL DEFAULT '',
  `body_html` LONGTEXT NULL,
  `builder_model` JSON NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  KEY `idx_email_flow_steps_flow` (`flow_id`, `position`),
  CONSTRAINT `fk_email_flow_steps_flow` FOREIGN KEY (`flow_id`) REFERENCES `email_flows` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `email_flow_enrollments` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `organization_id` CHAR(36) NOT NULL,
  `flow_id` CHAR(36) NOT NULL,
  `project_id` CHAR(36) NOT NULL,
  `lead_id` CHAR(36) NOT NULL,
  `email` VARCHAR(255) NULL,
  `next_step` INT NOT NULL DEFAULT 0,
  `next_send_at` DATETIME(0) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_flow_enroll_flow_lead` (`flow_id`, `lead_id`),
  KEY `idx_flow_enroll_due` (`status`, `next_send_at`),
  KEY `idx_flow_enroll_org` (`organization_id`),
  CONSTRAINT `fk_flow_enroll_flow` FOREIGN KEY (`flow_id`) REFERENCES `email_flows` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_flow_enroll_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`)
) ENGINE=InnoDB;
