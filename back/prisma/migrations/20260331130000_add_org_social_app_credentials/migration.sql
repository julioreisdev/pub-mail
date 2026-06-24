-- CreateTable
CREATE TABLE `organization_social_app_credentials` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `organization_id` CHAR(36) NOT NULL,
    `social_network` ENUM('TIKTOK', 'YOUTUBE', 'INSTAGRAM') NOT NULL,
    `client_key` VARCHAR(255) NOT NULL,
    `client_secret_encrypted` TEXT NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `uk_social_app_credentials_org_network`(`organization_id`, `social_network`),
    INDEX `idx_social_app_credentials_org_created`(`organization_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `organization_social_app_credentials` ADD CONSTRAINT `fk_social_app_credentials_org_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
