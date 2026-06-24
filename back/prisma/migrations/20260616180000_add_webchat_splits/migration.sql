-- Splits (pastas) de webchats com redirecionamento ponderado.
CREATE TABLE `webchat_splits` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `organization_id` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_webchat_splits_slug` (`slug`),
  KEY `idx_webchat_splits_org` (`organization_id`),
  CONSTRAINT `fk_webchat_splits_organization_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`)
) ENGINE=InnoDB;

ALTER TABLE `webchats`
  ADD COLUMN `split_id` CHAR(36) NULL,
  ADD COLUMN `split_weight` INT NOT NULL DEFAULT 100;

ALTER TABLE `webchats`
  ADD KEY `idx_webchats_split` (`split_id`),
  ADD CONSTRAINT `fk_webchats_split_id` FOREIGN KEY (`split_id`) REFERENCES `webchat_splits` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- Split "Padrão" para orgs existentes: a primeira org (mais antiga) recebe slug
-- "padrao"; demais recebem slug sufixado (slug é único global).
INSERT INTO `webchat_splits` (`id`, `organization_id`, `name`, `slug`, `is_default`, `created_at`, `updated_at`)
SELECT UUID(), id, 'Padrão', 'padrao', 1, NOW(), NOW()
FROM `organizations`
ORDER BY `created_at` ASC
LIMIT 1;

INSERT INTO `webchat_splits` (`id`, `organization_id`, `name`, `slug`, `is_default`, `created_at`, `updated_at`)
SELECT UUID(), o.id, 'Padrão', CONCAT('padrao-', LOWER(SUBSTRING(REPLACE(o.id, '-', ''), 1, 8))), 1, NOW(), NOW()
FROM `organizations` o
WHERE o.id NOT IN (SELECT `organization_id` FROM `webchat_splits` WHERE `is_default` = 1);

-- Vincula webchats existentes ao split padrão da sua organização.
UPDATE `webchats` w
JOIN `webchat_splits` s ON s.`organization_id` = w.`organization_id` AND s.`is_default` = 1
SET w.`split_id` = s.`id`
WHERE w.`split_id` IS NULL;
