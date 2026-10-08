-- Ícone próprio por aviso personalizado (URL pública: upload em /uploads/notification-icons ou endereço externo).
ALTER TABLE `notification_custom` ADD COLUMN `icon_url` VARCHAR(500) NULL AFTER `emoji`;
