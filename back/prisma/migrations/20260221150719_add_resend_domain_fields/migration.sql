-- AlterTable
ALTER TABLE `organization_domains` ADD COLUMN `dns_records` JSON NULL,
    ADD COLUMN `provider_id` VARCHAR(255) NULL;
