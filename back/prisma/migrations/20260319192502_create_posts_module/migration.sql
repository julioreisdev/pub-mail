-- CreateTable
CREATE TABLE `posts` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `organization_id` CHAR(36) NOT NULL,
    `internal_name` VARCHAR(255) NOT NULL,
    `post_type` ENUM('SINGLE_IMAGE', 'SINGLE_VIDEO', 'CAROUSEL') NOT NULL DEFAULT 'SINGLE_VIDEO',
    `default_title` VARCHAR(255) NULL,
    `default_caption` TEXT NULL,
    `tags` JSON NULL,
    `status` ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_posts_org_status`(`organization_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `post_media` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `post_id` CHAR(36) NOT NULL,
    `sort_order` SMALLINT NOT NULL DEFAULT 0,
    `media_type` ENUM('IMAGE', 'VIDEO') NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `file_size_bytes` INTEGER NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `storage_key` VARCHAR(500) NOT NULL,
    `storage_provider` VARCHAR(50) NOT NULL DEFAULT 'LOCAL',
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `duration_sec` INTEGER NULL,
    `thumbnail_key` VARCHAR(500) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_post_media_post_order`(`post_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `posts` ADD CONSTRAINT `fk_posts_org_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `post_media` ADD CONSTRAINT `fk_post_media_post_id` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
