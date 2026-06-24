-- AlterTable
ALTER TABLE `email_projects_schedules_sent` ADD COLUMN `tokens_cost` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `tokens_unit_cost` INTEGER NOT NULL DEFAULT 0;
