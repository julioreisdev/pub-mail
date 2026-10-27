-- Plugin desativado/apagado no site: o plugin avisa (POST /public/wp-plugin/remove) e a linha sai da
-- lista "Sites usando o plugin" até a próxima verificação (reativação zera a coluna).
ALTER TABLE `wp_plugin_sites` ADD COLUMN `removed_at` DATETIME(3) NULL AFTER `stats_at`;
