/*
  Warnings:

  - You are about to drop the column `error_message` on the `email_projects_schedules_sent` table. All the data in the column will be lost.
  - You are about to drop the column `template_id` on the `email_projects_schedules_sent` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `idx_schedules_sent_template_id` ON `email_projects_schedules_sent`;

-- DropIndex
DROP INDEX `idx_sent_project_runat` ON `email_projects_schedules_sent`;

-- AlterTable
ALTER TABLE `email_projects_schedules_sent` DROP COLUMN `error_message`,
    DROP COLUMN `template_id`;
