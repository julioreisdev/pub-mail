-- CreateTable
CREATE TABLE `social_post_schedules` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `organization_id` CHAR(36) NOT NULL,
    `post_id` CHAR(36) NOT NULL,
    `social_network` ENUM('TIKTOK', 'YOUTUBE', 'INSTAGRAM') NOT NULL,
    `status` ENUM('SCHEDULED', 'PROCESSING', 'SENT', 'FAILED', 'CANCELED') NOT NULL DEFAULT 'SCHEDULED',
    `ai_content` BOOLEAN NOT NULL DEFAULT false,
    `scheduled_at` DATETIME(0) NOT NULL,
    `platform_payload` JSON NULL,
    `post_snapshot` JSON NOT NULL,
    `tokens_unit_cost` INTEGER NOT NULL DEFAULT 0,
    `tokens_cost` INTEGER NOT NULL DEFAULT 0,
    `error_message` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_social_post_schedules_org_status_scheduled`(`organization_id`, `status`, `scheduled_at`),
    INDEX `idx_social_post_schedules_org_network_status`(`organization_id`, `social_network`, `status`),
    INDEX `idx_social_post_schedules_post_id`(`post_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_post_schedule_runs` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `organization_id` CHAR(36) NOT NULL,
    `schedule_id` CHAR(36) NULL,
    `post_id` CHAR(36) NOT NULL,
    `social_network` ENUM('TIKTOK', 'YOUTUBE', 'INSTAGRAM') NOT NULL,
    `status` ENUM('PROCESSING', 'COMPLETED', 'FAILED', 'CANCELED') NOT NULL DEFAULT 'PROCESSING',
    `ai_content` BOOLEAN NOT NULL DEFAULT false,
    `run_at` DATETIME(0) NOT NULL,
    `sent_at` DATETIME(0) NULL,
    `external_post_id` VARCHAR(255) NULL,
    `platform_payload` JSON NULL,
    `post_snapshot` JSON NOT NULL,
    `tokens_unit_cost` INTEGER NOT NULL DEFAULT 0,
    `tokens_cost` INTEGER NOT NULL DEFAULT 0,
    `error_message` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_social_post_schedule_runs_org_run_at`(`organization_id`, `run_at`),
    INDEX `idx_social_post_schedule_runs_org_network_status`(`organization_id`, `social_network`, `status`),
    INDEX `idx_social_post_schedule_runs_schedule_run_at`(`schedule_id`, `run_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `social_post_schedules` ADD CONSTRAINT `fk_social_post_schedules_org_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `social_post_schedules` ADD CONSTRAINT `fk_social_post_schedules_post_id` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `social_post_schedule_runs` ADD CONSTRAINT `fk_social_post_schedule_runs_org_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `social_post_schedule_runs` ADD CONSTRAINT `fk_social_post_schedule_runs_schedule_id` FOREIGN KEY (`schedule_id`) REFERENCES `social_post_schedules`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
