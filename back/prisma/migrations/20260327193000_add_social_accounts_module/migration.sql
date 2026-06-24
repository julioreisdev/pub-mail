-- CreateTable
CREATE TABLE `social_accounts` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `organization_id` CHAR(36) NOT NULL,
    `social_network` ENUM('TIKTOK', 'YOUTUBE', 'INSTAGRAM') NOT NULL,
    `provider_user_id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(255) NULL,
    `display_name` VARCHAR(255) NULL,
    `profile_image_url` VARCHAR(1000) NULL,
    `status` ENUM('ACTIVE', 'DISCONNECTED') NOT NULL DEFAULT 'ACTIVE',
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `access_token_encrypted` TEXT NULL,
    `refresh_token_encrypted` TEXT NULL,
    `token_expires_at` DATETIME(0) NULL,
    `scope` JSON NULL,
    `extra` JSON NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `uk_social_accounts_org_network_provider`(`organization_id`, `social_network`, `provider_user_id`),
    INDEX `idx_social_accounts_org_network_status`(`organization_id`, `social_network`, `status`),
    INDEX `idx_social_accounts_org_created`(`organization_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `social_accounts` ADD CONSTRAINT `fk_social_accounts_org_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
