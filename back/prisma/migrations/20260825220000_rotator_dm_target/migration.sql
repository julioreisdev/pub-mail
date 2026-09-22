-- Mensagem rotativa também na DM do próprio bot (uma por contato, editada em loop).
-- target_kind: 'group' (grupo/canal, atual) ou 'dm' (todos os contatos do bot).
ALTER TABLE `telegram_rotators` DROP FOREIGN KEY `fk_tgrotator_group`;
ALTER TABLE `telegram_rotators` MODIFY COLUMN `group_id` CHAR(36) NULL;
ALTER TABLE `telegram_rotators` ADD CONSTRAINT `fk_tgrotator_group` FOREIGN KEY (`group_id`) REFERENCES `telegram_groups` (`id`) ON DELETE CASCADE;
ALTER TABLE `telegram_rotators` ADD COLUMN `target_kind` VARCHAR(16) NOT NULL DEFAULT 'group';
ALTER TABLE `telegram_rotators` ADD COLUMN `dm_cursor` INT NOT NULL DEFAULT 0;
