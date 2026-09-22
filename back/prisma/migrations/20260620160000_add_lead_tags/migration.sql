-- Tags (rótulos) manuais por lead. Array JSON de strings.
ALTER TABLE `email_leads` ADD COLUMN `tags` JSON NULL AFTER `attributes`;
