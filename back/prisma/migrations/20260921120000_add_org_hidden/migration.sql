-- Organização oculta (conta do desenvolvedor): não aparece nem é gerenciável pela API admin.
ALTER TABLE `organizations` ADD COLUMN `hidden` BOOLEAN NOT NULL DEFAULT false;
