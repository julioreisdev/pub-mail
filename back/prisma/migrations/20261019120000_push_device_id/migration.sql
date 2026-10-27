-- Aparelho do push: id fixo do navegador (localStorage), para trocar a inscrição antiga em vez de acumular linhas.
ALTER TABLE `push_subscriptions`
  ADD COLUMN `device_id` VARCHAR(64) NULL AFTER `device_label`,
  ADD KEY `idx_pushsub_device` (`organization_id`, `user_id`, `device_id`);
