-- CreateTable
CREATE TABLE `webchat_sessions` (
    `id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `organization_id` CHAR(36) NOT NULL,
    `webchat_id` CHAR(36) NOT NULL,
    `session_id` VARCHAR(100) NOT NULL,
    `lead_state` JSON NULL,
    `conversation_history` JSON NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `uk_webchat_sessions_webchat_session`(`webchat_id`, `session_id`),
    INDEX `idx_webchat_sessions_org_webchat`(`organization_id`, `webchat_id`),
    INDEX `idx_webchat_sessions_org_session`(`organization_id`, `session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `webchat_sessions` ADD CONSTRAINT `fk_webchat_sessions_organization_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `webchat_sessions` ADD CONSTRAINT `fk_webchat_sessions_webchat_id` FOREIGN KEY (`webchat_id`) REFERENCES `webchats`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
