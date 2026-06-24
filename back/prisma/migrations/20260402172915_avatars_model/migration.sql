-- CreateTable
CREATE TABLE `avatars` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `organization_id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `is_realistic` BOOLEAN NOT NULL DEFAULT true,
    `default_colors` JSON NULL,
    `inspiration_image_url` VARCHAR(500) NULL,
    `avatar_image_url` VARCHAR(500) NOT NULL,
    `user_prompt` TEXT NULL,
    `system_prompt` TEXT NULL,
    `personality` TEXT NULL,
    `technical_metadata` JSON NULL,
    `status` ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_avatars_org_status`(`organization_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `avatar_generations` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `organization_id` CHAR(36) NOT NULL,
    `user_prompt` TEXT NULL,
    `system_prompt` TEXT NULL,
    `is_realistic` BOOLEAN NOT NULL,
    `inspiration_image_url` VARCHAR(500) NULL,
    `result_image_url` VARCHAR(500) NOT NULL,
    `technical_metadata` JSON NULL,
    `tokens_cost` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_avatar_generations_org_created`(`organization_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `avatars` ADD CONSTRAINT `fk_avatars_organization_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `avatar_generations` ADD CONSTRAINT `fk_avatar_generations_org_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
