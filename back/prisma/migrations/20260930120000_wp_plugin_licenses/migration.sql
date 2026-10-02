-- Plugin WordPress "Tradutor Invisível" vinculado à conta do Pub Mail.
-- Uma chave ativa por organização (as antigas ficam com revoked_at); sites ilimitados por chave.
CREATE TABLE `wp_plugin_licenses` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `key_hash` CHAR(64) NOT NULL,
  `key_prefix` VARCHAR(20) NOT NULL,
  `key_enc` TEXT NOT NULL,
  `created_by` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `revoked_at` DATETIME(3) NULL,
  `last_check_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_wplic_hash` (`key_hash`),
  INDEX `idx_wplic_org` (`organization_id`, `revoked_at`),
  CONSTRAINT `fk_wplic_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sites que usam a chave (atualizado a cada verificação do plugin).
CREATE TABLE `wp_plugin_sites` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `license_id` CHAR(36) NOT NULL,
  `organization_id` CHAR(36) NOT NULL,
  `site_host` VARCHAR(190) NOT NULL,
  `site_url` VARCHAR(255) NOT NULL,
  `plugin_version` VARCHAR(20) NULL,
  `wp_version` VARCHAR(20) NULL,
  `php_version` VARCHAR(20) NULL,
  `last_active` BOOLEAN NOT NULL DEFAULT true,
  `checks` INT NOT NULL DEFAULT 0,
  `first_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_wpsite_lic_host` (`license_id`, `site_host`),
  INDEX `idx_wpsite_org` (`organization_id`, `last_seen_at`),
  CONSTRAINT `fk_wpsite_lic` FOREIGN KEY (`license_id`) REFERENCES `wp_plugin_licenses` (`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
