-- AlterTable
ALTER TABLE `email_projects_schedules` ADD COLUMN `for_x_days` SMALLINT NULL,
    ADD COLUMN `last_run` DATETIME(0) NULL;

-- CreateIndex
CREATE INDEX `idx_email_projects_schedules_interval` ON `email_projects_schedules`(`for_x_days`, `last_run`);
