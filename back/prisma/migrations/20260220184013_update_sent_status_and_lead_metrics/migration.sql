-- AlterTable
ALTER TABLE `email_project_leads` ADD COLUMN `metrics` JSON NULL;

-- AlterTable
ALTER TABLE `email_projects_schedules_sent` ADD COLUMN `status` ENUM('PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED') NOT NULL DEFAULT 'PROCESSING';
