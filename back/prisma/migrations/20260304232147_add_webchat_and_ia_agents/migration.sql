-- CreateTable
CREATE TABLE `agentes_ia` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `organization_id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` VARCHAR(500) NULL,
    `ia_config` JSON NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_agentes_ia_org`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webchats` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `organization_id` CHAR(36) NOT NULL,
    `agent_id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(160) NOT NULL,
    `domain` VARCHAR(255) NOT NULL,
    `email_project_id` CHAR(36) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `settings` JSON NULL,
    `header_scripts` TEXT NULL,
    `ads_config` JSON NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_webchats_org`(`organization_id`),
    INDEX `idx_webchats_agent`(`agent_id`),
    INDEX `idx_webchats_email_project`(`email_project_id`),
    UNIQUE INDEX `uk_webchats_domain_slug`(`domain`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webchat_leads` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `organization_id` CHAR(36) NOT NULL,
    `webchat_id` CHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NULL,
    `phone` VARCHAR(30) NULL,
    `source` VARCHAR(100) NULL,
    `session_id` VARCHAR(100) NULL,
    `context` JSON NULL,
    `custom_fields` JSON NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_webchat_leads_org_webchat`(`organization_id`, `webchat_id`),
    INDEX `idx_webchat_leads_org_email`(`organization_id`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `agentes_ia` ADD CONSTRAINT `fk_agentes_ia_organization_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `webchats` ADD CONSTRAINT `fk_webchats_organization_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `webchats` ADD CONSTRAINT `fk_webchats_agent_id` FOREIGN KEY (`agent_id`) REFERENCES `agentes_ia`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `webchats` ADD CONSTRAINT `fk_webchats_email_project_id` FOREIGN KEY (`email_project_id`) REFERENCES `email_projects`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `webchat_leads` ADD CONSTRAINT `fk_webchat_leads_organization_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `webchat_leads` ADD CONSTRAINT `fk_webchat_leads_webchat_id` FOREIGN KEY (`webchat_id`) REFERENCES `webchats`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
