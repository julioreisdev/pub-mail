-- CreateTable
CREATE TABLE `webchat_domains` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `organization_id` CHAR(36) NOT NULL,
    `domain` VARCHAR(255) NOT NULL,
    `status` ENUM('PENDING', 'VERIFIED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `expected_type` VARCHAR(20) NOT NULL DEFAULT 'CNAME',
    `expected_value` VARCHAR(255) NOT NULL,
    `last_check_error` VARCHAR(500) NULL,
    `last_checked_at` DATETIME(0) NULL,
    `traefik_file` VARCHAR(500) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_webchat_domains_org_domain`(`organization_id`, `domain`),
    UNIQUE INDEX `uk_webchat_domains_domain`(`domain`),
    INDEX `idx_webchat_domains_org_status`(`organization_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `webchat_domains` ADD CONSTRAINT `fk_webchat_domains_organization_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
