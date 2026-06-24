-- CreateTable
CREATE TABLE `billing_cards` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `organization_id` CHAR(36) NOT NULL,
    `provider_token` VARCHAR(255) NOT NULL,
    `last_four_digits` VARCHAR(4) NULL,
    `brand` VARCHAR(50) NULL,
    `holder_name` VARCHAR(255) NOT NULL,
    `is_default` BOOLEAN NOT NULL,

    INDEX `idx_cards_org`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organizations` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `document_id` VARCHAR(20) NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `stripe_customer_id` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `document_id`(`document_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transactions` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `wallet_id` CHAR(36) NOT NULL,
    `amount` DECIMAL(15, 4) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `provider_transaction_id` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT (now()),

    INDEX `idx_tx_wallet_created`(`wallet_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `organization_id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER') NOT NULL DEFAULT 'OWNER',
    `refresh_token` VARCHAR(512) NULL,
    `active` BOOLEAN NOT NULL DEFAULT (true),

    UNIQUE INDEX `email`(`email`),
    INDEX `idx_users_org`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallets` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `organization_id` CHAR(36) NOT NULL,
    `balance` DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
    `status` ENUM('ACTIVE', 'FROZEN') NOT NULL DEFAULT 'ACTIVE',

    INDEX `idx_wallets_org`(`organization_id`),
    UNIQUE INDEX `uk_wallet_org`(`id`, `organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_projects` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `organization_id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `settings` JSON NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `active` BOOLEAN NOT NULL DEFAULT true,

    INDEX `idx_email_projects_org`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_templates` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `project_id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `subject` VARCHAR(255) NOT NULL,
    `body_html` LONGTEXT NULL,
    `body_text` LONGTEXT NULL,

    INDEX `idx_email_templates_project`(`project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_leads` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `organization_id` CHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NULL,
    `attributes` JSON NULL,
    `global_status` ENUM('ACTIVE', 'BOUNCED', 'COMPLAINED') NOT NULL DEFAULT 'ACTIVE',

    INDEX `idx_email_leads_org`(`organization_id`),
    UNIQUE INDEX `uk_email_leads_org_email`(`organization_id`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_project_leads` (
    `project_id` CHAR(36) NOT NULL,
    `lead_id` CHAR(36) NOT NULL,
    `status` ENUM('SUBSCRIBED', 'UNSUBSCRIBED') NOT NULL DEFAULT 'SUBSCRIBED',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_email_project_leads_lead`(`lead_id`),
    INDEX `idx_email_project_leads_project_status`(`project_id`, `status`),
    PRIMARY KEY (`project_id`, `lead_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_projects_schedules` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `project_id` CHAR(36) NOT NULL,
    `daily` BOOLEAN NOT NULL DEFAULT false,
    `date` DATETIME(0) NULL,
    `time` SMALLINT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_email_projects_schedules_project`(`project_id`),
    INDEX `idx_email_projects_schedules_daily_date`(`daily`, `date`),
    INDEX `idx_email_projects_schedules_daily_time`(`daily`, `time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_projects_schedules_sent` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `schedule_id` CHAR(36) NULL,
    `schedule_daily` BOOLEAN NOT NULL,
    `schedule_date` DATETIME(3) NULL,
    `schedule_time` INTEGER NULL,
    `sent` BOOLEAN NOT NULL DEFAULT false,
    `error_message` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `run_at` DATETIME(0) NOT NULL,
    `body_html` LONGTEXT NULL,
    `body_text` LONGTEXT NULL,
    `subject` VARCHAR(255) NULL,
    `template_id` CHAR(36) NULL,
    `organization_id` CHAR(36) NOT NULL,
    `project_id` CHAR(36) NOT NULL,
    `sent_for_leads` INTEGER NOT NULL DEFAULT 0,
    `total_leads` INTEGER NOT NULL DEFAULT 0,

    INDEX `idx_sent_org_project_runat`(`organization_id`, `project_id`, `run_at`),
    INDEX `idx_sent_org_sent`(`organization_id`, `sent`),
    INDEX `idx_sent_project_runat`(`project_id`, `run_at`),
    INDEX `idx_schedules_sent_template_id`(`template_id`),
    INDEX `idx_schedules_sent_schedule`(`schedule_id`),
    UNIQUE INDEX `uk_project_schedule_run_at`(`project_id`, `schedule_id`, `run_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `billing_cards` ADD CONSTRAINT `fk_billing_cards_organization_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `fk_transactions_wallet_id` FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `fk_users_organization_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `wallets` ADD CONSTRAINT `fk_wallets_organization_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `email_projects` ADD CONSTRAINT `fk_email_projects_organization_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `email_templates` ADD CONSTRAINT `fk_email_templates_project_id` FOREIGN KEY (`project_id`) REFERENCES `email_projects`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `email_leads` ADD CONSTRAINT `fk_email_leads_organization_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `email_project_leads` ADD CONSTRAINT `fk_email_project_leads_lead_id` FOREIGN KEY (`lead_id`) REFERENCES `email_leads`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `email_project_leads` ADD CONSTRAINT `fk_email_project_leads_project_id` FOREIGN KEY (`project_id`) REFERENCES `email_projects`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `email_projects_schedules` ADD CONSTRAINT `fk_email_projects_schedules_project_id` FOREIGN KEY (`project_id`) REFERENCES `email_projects`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
