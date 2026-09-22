-- Tags (segmentação) + attributes (deep-link start_param etc) no contato do Telegram.
ALTER TABLE `telegram_contacts`
  ADD COLUMN `tags` JSON NULL AFTER `username`,
  ADD COLUMN `attributes` JSON NULL AFTER `tags`;
