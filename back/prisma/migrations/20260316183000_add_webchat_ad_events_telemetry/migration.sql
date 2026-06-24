CREATE TABLE `webchat_ad_events` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `webchat_id` CHAR(36) NOT NULL,
  `session_id` VARCHAR(100) NULL,
  `domain` VARCHAR(255) NULL,
  `ad_position` VARCHAR(40) NOT NULL,
  `event_name` VARCHAR(40) NOT NULL,
  `ad_key` VARCHAR(255) NULL,
  `payload` JSON NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

  PRIMARY KEY (`id`),
  INDEX `idx_webchat_ad_events_org_webchat_created`(`organization_id`, `webchat_id`, `created_at`),
  INDEX `idx_webchat_ad_events_webchat_session`(`webchat_id`, `session_id`),
  INDEX `idx_webchat_ad_events_position_event`(`ad_position`, `event_name`),
  CONSTRAINT `fk_webchat_ad_events_organization_id`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`)
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_webchat_ad_events_webchat_id`
    FOREIGN KEY (`webchat_id`) REFERENCES `webchats`(`id`)
    ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
