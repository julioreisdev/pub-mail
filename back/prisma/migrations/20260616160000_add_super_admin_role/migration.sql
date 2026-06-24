-- Adiciona o papel SUPER_ADMIN (admin de plataforma) ao enum de roles.
ALTER TABLE `users` MODIFY COLUMN `role` ENUM('OWNER', 'ADMIN', 'MEMBER', 'SUPER_ADMIN') NOT NULL DEFAULT 'OWNER';
