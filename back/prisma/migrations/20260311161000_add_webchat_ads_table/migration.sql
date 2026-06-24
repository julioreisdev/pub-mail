-- CreateTable
CREATE TABLE `webchat_ads` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `organization_id` CHAR(36) NOT NULL,
    `webchat_id` CHAR(36) NOT NULL,
    `position` VARCHAR(40) NOT NULL,
    `codigo_tag` TEXT NOT NULL,
    `gpt_sizes` VARCHAR(255) NULL,
    `intervalo_mensagens` INTEGER NULL,
    `sequence_ads` JSON NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `uk_webchat_ads_webchat_position`(`webchat_id`, `position`),
    INDEX `idx_webchat_ads_org_webchat`(`organization_id`, `webchat_id`),
    INDEX `idx_webchat_ads_position`(`position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `webchat_ads` ADD CONSTRAINT `fk_webchat_ads_organization_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `webchat_ads` ADD CONSTRAINT `fk_webchat_ads_webchat_id` FOREIGN KEY (`webchat_id`) REFERENCES `webchats`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
