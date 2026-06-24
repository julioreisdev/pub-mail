-- Reconcile schema drift for webchat constraints/indexes in an idempotent way.
-- This migration is safe to run multiple times.

-- 1) Ensure index exists: webchats(organization_id, created_at)
SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'webchats'
    AND INDEX_NAME = 'idx_webchats_org_created_at'
);

SET @idx_sql := IF(
  @idx_exists = 0,
  'CREATE INDEX `idx_webchats_org_created_at` ON `webchats`(`organization_id`, `created_at`)',
  'SELECT 1'
);
PREPARE stmt FROM @idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Ensure FK name fk_webchats_organization_id belongs to webchats table.
SET @webchats_fk_owner := (
  SELECT TABLE_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = 'fk_webchats_organization_id'
  LIMIT 1
);

SET @drop_wrong_webchats_fk := IF(
  @webchats_fk_owner IS NULL OR @webchats_fk_owner = 'webchats',
  'SELECT 1',
  CONCAT('ALTER TABLE `', @webchats_fk_owner, '` DROP FOREIGN KEY `fk_webchats_organization_id`')
);
PREPARE stmt FROM @drop_wrong_webchats_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @webchats_fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'webchats'
    AND CONSTRAINT_NAME = 'fk_webchats_organization_id'
    AND COLUMN_NAME = 'organization_id'
    AND REFERENCED_TABLE_NAME = 'organizations'
    AND REFERENCED_COLUMN_NAME = 'id'
);

SET @add_webchats_fk := IF(
  @webchats_fk_exists = 0,
  'ALTER TABLE `webchats` ADD CONSTRAINT `fk_webchats_organization_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION',
  'SELECT 1'
);
PREPARE stmt FROM @add_webchats_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3) Ensure FK name fk_webchat_domains_organization_id belongs to webchat_domains table.
SET @domains_fk_owner := (
  SELECT TABLE_NAME
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = 'fk_webchat_domains_organization_id'
  LIMIT 1
);

SET @drop_wrong_domains_fk := IF(
  @domains_fk_owner IS NULL OR @domains_fk_owner = 'webchat_domains',
  'SELECT 1',
  CONCAT('ALTER TABLE `', @domains_fk_owner, '` DROP FOREIGN KEY `fk_webchat_domains_organization_id`')
);
PREPARE stmt FROM @drop_wrong_domains_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @domains_fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'webchat_domains'
    AND CONSTRAINT_NAME = 'fk_webchat_domains_organization_id'
    AND COLUMN_NAME = 'organization_id'
    AND REFERENCED_TABLE_NAME = 'organizations'
    AND REFERENCED_COLUMN_NAME = 'id'
);

SET @add_domains_fk := IF(
  @domains_fk_exists = 0,
  'ALTER TABLE `webchat_domains` ADD CONSTRAINT `fk_webchat_domains_organization_id` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
  'SELECT 1'
);
PREPARE stmt FROM @add_domains_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
