-- Última vez que o usuário fez login (null = nunca). Gravado em /auth/login e /auth/register.
ALTER TABLE `users` ADD COLUMN `last_login_at` DATETIME(3) NULL AFTER `welcomed_at`;
