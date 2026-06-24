-- AlterTable
ALTER TABLE `email_projects_schedules_sent` ADD COLUMN `open_count` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `email_schedules_sent_opens` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `schedule_sent_id` CHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_opens_schedule_sent`(`schedule_sent_id`),
    UNIQUE INDEX `uk_schedule_sent_email_open`(`schedule_sent_id`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `email_schedules_sent_opens` ADD CONSTRAINT `email_schedules_sent_opens_schedule_sent_id_fkey` FOREIGN KEY (`schedule_sent_id`) REFERENCES `email_projects_schedules_sent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
