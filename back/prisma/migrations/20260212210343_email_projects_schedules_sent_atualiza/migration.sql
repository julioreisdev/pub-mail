-- DropIndex
DROP INDEX `idx_schedules_sent_schedule` ON `email_projects_schedules_sent`;

-- AddForeignKey
ALTER TABLE `email_projects_schedules_sent` ADD CONSTRAINT `email_projects_schedules_sent_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `email_projects_schedules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
