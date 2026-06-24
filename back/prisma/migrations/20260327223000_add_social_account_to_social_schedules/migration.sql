-- AlterTable
ALTER TABLE `social_post_schedules`
    ADD COLUMN `social_account_id` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `social_post_schedule_runs`
    ADD COLUMN `social_account_id` CHAR(36) NULL;

-- CreateIndex
CREATE INDEX `idx_social_post_schedules_org_account`
    ON `social_post_schedules`(`organization_id`, `social_account_id`);

-- CreateIndex
CREATE INDEX `idx_social_post_schedule_runs_org_account`
    ON `social_post_schedule_runs`(`organization_id`, `social_account_id`);

-- AddForeignKey
ALTER TABLE `social_post_schedules`
    ADD CONSTRAINT `fk_social_post_schedules_social_account_id`
    FOREIGN KEY (`social_account_id`) REFERENCES `social_accounts`(`id`)
    ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `social_post_schedule_runs`
    ADD CONSTRAINT `fk_social_post_schedule_runs_social_account_id`
    FOREIGN KEY (`social_account_id`) REFERENCES `social_accounts`(`id`)
    ON DELETE SET NULL ON UPDATE NO ACTION;
