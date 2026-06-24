-- Tracking de provisionamento de SSL por domínio de webchat
ALTER TABLE `webchat_domains`
  ADD COLUMN `ssl_status` VARCHAR(32) NULL,
  ADD COLUMN `ssl_error`  VARCHAR(2000) NULL,
  ADD COLUMN `ssl_issued_at` DATETIME(0) NULL,
  ADD COLUMN `ssl_attempted_at` DATETIME(0) NULL;
