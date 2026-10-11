-- Push In Play: métricas dos sites no painel do Pub Mail.
-- O plugin (edição do Pub Mail) manda um resumo a cada 15 min / fim de disparo: o último fica em JSON na
-- linha do site; os dias (31 por envio) vão para a tabela diária, que soma todos os sites da organização.
ALTER TABLE `wp_plugin_sites`
  ADD COLUMN `site_name` VARCHAR(120) NULL AFTER `php_version`,
  ADD COLUMN `stats` JSON NULL AFTER `site_name`,
  ADD COLUMN `stats_at` DATETIME(3) NULL AFTER `stats`;

CREATE TABLE `wp_plugin_site_stats` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `site_id` CHAR(36) NOT NULL,
  `organization_id` CHAR(36) NOT NULL,
  `day` DATE NOT NULL,
  `impressions` INT NOT NULL DEFAULT 0,
  `clicks` INT NOT NULL DEFAULT 0,
  `granted` INT NOT NULL DEFAULT 0,
  `denied` INT NOT NULL DEFAULT 0,
  `dismissed` INT NOT NULL DEFAULT 0,
  `installed` INT NOT NULL DEFAULT 0,
  `sent` INT NOT NULL DEFAULT 0,
  `failed` INT NOT NULL DEFAULT 0,
  `clicked` INT NOT NULL DEFAULT 0,
  `sent_flow` INT NOT NULL DEFAULT 0,
  `sent_broadcast` INT NOT NULL DEFAULT 0,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_wpstat_site_day` (`site_id`, `day`),
  INDEX `idx_wpstat_org_day` (`organization_id`, `day`),
  CONSTRAINT `fk_wpstat_site` FOREIGN KEY (`site_id`) REFERENCES `wp_plugin_sites` (`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
