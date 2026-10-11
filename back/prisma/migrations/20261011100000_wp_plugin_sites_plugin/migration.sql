-- 2º plugin WordPress (Push In Play) usa a MESMA chave da conta: a tabela de sites passa a
-- distinguir o plugin (um site pode ter os dois instalados).
ALTER TABLE `wp_plugin_sites`
  ADD COLUMN `plugin` VARCHAR(40) NOT NULL DEFAULT 'tradutor-invisivel' AFTER `site_url`,
  DROP INDEX `uk_wpsite_lic_host`,
  ADD UNIQUE INDEX `uk_wpsite_lic_host_plugin` (`license_id`, `site_host`, `plugin`);
