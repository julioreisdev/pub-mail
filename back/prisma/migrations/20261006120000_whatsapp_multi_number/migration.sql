-- WhatsApp multi-número: cada organização conecta N números (whatsapp_sessions N por org).
-- Tudo que é "do número" ganha session_id (backfill = a única sessão que cada org tinha).

-- ---------------------------------------------------------------- sessões
ALTER TABLE `whatsapp_sessions`
  DROP INDEX `uk_wasess_org`,
  ADD COLUMN `label` VARCHAR(80) NULL AFTER `organization_id`,
  ADD COLUMN `color` VARCHAR(16) NULL AFTER `label`,
  ADD COLUMN `position` INT NOT NULL DEFAULT 0 AFTER `color`,
  ADD COLUMN `bot_flow_id` CHAR(36) NULL AFTER `position`,
  ADD INDEX `idx_wasess_org_pos` (`organization_id`, `position`);

-- ---------------------------------------------------------------- usuários: números liberados (null = todos)
ALTER TABLE `users` ADD COLUMN `whatsapp_sessions` JSON NULL AFTER `welcomed_at`;

-- ---------------------------------------------------------------- session_id (obrigatório)
ALTER TABLE `whatsapp_chats` ADD COLUMN `session_id` CHAR(36) NULL AFTER `organization_id`;
ALTER TABLE `whatsapp_messages` ADD COLUMN `session_id` CHAR(36) NULL AFTER `organization_id`;
ALTER TABLE `whatsapp_bot_sessions` ADD COLUMN `session_id` CHAR(36) NULL AFTER `organization_id`;
ALTER TABLE `whatsapp_contact_statuses` ADD COLUMN `session_id` CHAR(36) NULL AFTER `organization_id`;
ALTER TABLE `whatsapp_statuses` ADD COLUMN `session_id` CHAR(36) NULL AFTER `organization_id`, ADD COLUMN `batch_id` CHAR(36) NULL AFTER `session_id`;
ALTER TABLE `whatsapp_schedules` ADD COLUMN `session_id` CHAR(36) NULL AFTER `organization_id`, ADD COLUMN `batch_id` CHAR(36) NULL AFTER `session_id`, ADD COLUMN `mode` VARCHAR(8) NOT NULL DEFAULT 'all' AFTER `batch_id`;

-- ---------------------------------------------------------------- session_id (opcional)
ALTER TABLE `whatsapp_service_events` ADD COLUMN `session_id` CHAR(36) NULL AFTER `organization_id`;
ALTER TABLE `whatsapp_payments` ADD COLUMN `session_id` CHAR(36) NULL AFTER `organization_id`;
ALTER TABLE `whatsapp_broadcast_sends` ADD COLUMN `session_id` CHAR(36) NULL AFTER `organization_id`;
ALTER TABLE `whatsapp_charges` ADD COLUMN `session_id` CHAR(36) NULL AFTER `organization_id`;
ALTER TABLE `whatsapp_tasks` ADD COLUMN `session_id` CHAR(36) NULL AFTER `organization_id`;
ALTER TABLE `whatsapp_chat_notes` ADD COLUMN `session_id` CHAR(36) NULL AFTER `organization_id`;
ALTER TABLE `whatsapp_ratings` ADD COLUMN `session_id` CHAR(36) NULL AFTER `organization_id`;

-- backfill: hoje cada org tem no máximo 1 sessão
UPDATE `whatsapp_chats` t JOIN `whatsapp_sessions` s ON s.organization_id = t.organization_id SET t.session_id = s.id WHERE t.session_id IS NULL;
UPDATE `whatsapp_messages` t JOIN `whatsapp_sessions` s ON s.organization_id = t.organization_id SET t.session_id = s.id WHERE t.session_id IS NULL;
UPDATE `whatsapp_bot_sessions` t JOIN `whatsapp_sessions` s ON s.organization_id = t.organization_id SET t.session_id = s.id WHERE t.session_id IS NULL;
UPDATE `whatsapp_contact_statuses` t JOIN `whatsapp_sessions` s ON s.organization_id = t.organization_id SET t.session_id = s.id WHERE t.session_id IS NULL;
UPDATE `whatsapp_statuses` t JOIN `whatsapp_sessions` s ON s.organization_id = t.organization_id SET t.session_id = s.id WHERE t.session_id IS NULL;
UPDATE `whatsapp_schedules` t JOIN `whatsapp_sessions` s ON s.organization_id = t.organization_id SET t.session_id = s.id WHERE t.session_id IS NULL;
UPDATE `whatsapp_service_events` t JOIN `whatsapp_sessions` s ON s.organization_id = t.organization_id SET t.session_id = s.id WHERE t.session_id IS NULL;
UPDATE `whatsapp_payments` t JOIN `whatsapp_sessions` s ON s.organization_id = t.organization_id SET t.session_id = s.id WHERE t.session_id IS NULL;
UPDATE `whatsapp_broadcast_sends` t JOIN `whatsapp_sessions` s ON s.organization_id = t.organization_id SET t.session_id = s.id WHERE t.session_id IS NULL;
UPDATE `whatsapp_charges` t JOIN `whatsapp_sessions` s ON s.organization_id = t.organization_id SET t.session_id = s.id WHERE t.session_id IS NULL;
UPDATE `whatsapp_tasks` t JOIN `whatsapp_sessions` s ON s.organization_id = t.organization_id SET t.session_id = s.id WHERE t.session_id IS NULL AND t.chat_id IS NOT NULL;
UPDATE `whatsapp_chat_notes` t JOIN `whatsapp_sessions` s ON s.organization_id = t.organization_id SET t.session_id = s.id WHERE t.session_id IS NULL;
UPDATE `whatsapp_ratings` t JOIN `whatsapp_sessions` s ON s.organization_id = t.organization_id SET t.session_id = s.id WHERE t.session_id IS NULL;

-- dados sem nenhuma sessão (org que nunca conectou) não têm como existir pelo gateway; se houver, saem
DELETE FROM `whatsapp_messages` WHERE `session_id` IS NULL;
DELETE FROM `whatsapp_chats` WHERE `session_id` IS NULL;
DELETE FROM `whatsapp_bot_sessions` WHERE `session_id` IS NULL;
DELETE FROM `whatsapp_contact_statuses` WHERE `session_id` IS NULL;
DELETE FROM `whatsapp_statuses` WHERE `session_id` IS NULL;
DELETE FROM `whatsapp_schedules` WHERE `session_id` IS NULL;

ALTER TABLE `whatsapp_chats`
  MODIFY `session_id` CHAR(36) NOT NULL,
  DROP INDEX `uk_wachat_org_chat`,
  ADD UNIQUE INDEX `uk_wachat_org_sess_chat` (`organization_id`, `session_id`, `chat_id`),
  ADD INDEX `idx_wachat_sess_last` (`session_id`, `last_message_at`),
  ADD CONSTRAINT `fk_wachat_session` FOREIGN KEY (`session_id`) REFERENCES `whatsapp_sessions`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `whatsapp_messages`
  MODIFY `session_id` CHAR(36) NOT NULL,
  DROP INDEX `uk_wamsg_org_wa`,
  ADD UNIQUE INDEX `uk_wamsg_org_sess_wa` (`organization_id`, `session_id`, `wa_message_id`),
  ADD INDEX `idx_wamsg_sess_chat_ts` (`session_id`, `chat_id`, `timestamp`),
  ADD INDEX `idx_wamsg_sess_chat_upd` (`session_id`, `chat_id`, `updated_at`),
  ADD CONSTRAINT `fk_wamsg_session` FOREIGN KEY (`session_id`) REFERENCES `whatsapp_sessions`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `whatsapp_bot_sessions`
  MODIFY `session_id` CHAR(36) NOT NULL,
  DROP INDEX `uk_wabs_org_chat`,
  ADD UNIQUE INDEX `uk_wabs_org_sess_chat` (`organization_id`, `session_id`, `chat_id`),
  ADD CONSTRAINT `fk_wabs_session` FOREIGN KEY (`session_id`) REFERENCES `whatsapp_sessions`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `whatsapp_contact_statuses`
  MODIFY `session_id` CHAR(36) NOT NULL,
  DROP INDEX `uk_wacs_org_status`,
  ADD UNIQUE INDEX `uk_wacs_org_sess_status` (`organization_id`, `session_id`, `wa_status_id`),
  ADD CONSTRAINT `fk_wacs_session` FOREIGN KEY (`session_id`) REFERENCES `whatsapp_sessions`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `whatsapp_statuses`
  MODIFY `session_id` CHAR(36) NOT NULL,
  ADD CONSTRAINT `fk_wastatus_session` FOREIGN KEY (`session_id`) REFERENCES `whatsapp_sessions`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `whatsapp_schedules`
  MODIFY `session_id` CHAR(36) NOT NULL,
  ADD CONSTRAINT `fk_wasched_session` FOREIGN KEY (`session_id`) REFERENCES `whatsapp_sessions`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `whatsapp_service_events` ADD CONSTRAINT `fk_wasvcevt_session` FOREIGN KEY (`session_id`) REFERENCES `whatsapp_sessions`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE `whatsapp_payments` ADD CONSTRAINT `fk_wapay_session` FOREIGN KEY (`session_id`) REFERENCES `whatsapp_sessions`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE `whatsapp_broadcast_sends` ADD CONSTRAINT `fk_wabcsend_session` FOREIGN KEY (`session_id`) REFERENCES `whatsapp_sessions`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE `whatsapp_charges` ADD CONSTRAINT `fk_wacharge_session` FOREIGN KEY (`session_id`) REFERENCES `whatsapp_sessions`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE `whatsapp_tasks` ADD CONSTRAINT `fk_watask_session` FOREIGN KEY (`session_id`) REFERENCES `whatsapp_sessions`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE `whatsapp_chat_notes` ADD CONSTRAINT `fk_wanote_session` FOREIGN KEY (`session_id`) REFERENCES `whatsapp_sessions`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE `whatsapp_ratings` ADD CONSTRAINT `fk_warating_session` FOREIGN KEY (`session_id`) REFERENCES `whatsapp_sessions`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- ---------------------------------------------------------------- bot: N fluxos por org; cada número aponta para 0..1
ALTER TABLE `whatsapp_bot_flows`
  DROP INDEX `uk_wabot_org`,
  ADD COLUMN `position` INT NOT NULL DEFAULT 0 AFTER `organization_id`,
  ADD INDEX `idx_wabot_org_pos` (`organization_id`, `position`);
UPDATE `whatsapp_sessions` s JOIN `whatsapp_bot_flows` f ON f.organization_id = s.organization_id AND f.active = 1 SET s.bot_flow_id = f.id;

-- ---------------------------------------------------------------- configuração de atendimento → org (whatsapp_crm_settings.service)
ALTER TABLE `whatsapp_crm_settings` ADD COLUMN `service` JSON NULL AFTER `pipeline`;
INSERT INTO `whatsapp_crm_settings` (`organization_id`, `service`, `updated_at`)
  SELECT s.organization_id, JSON_EXTRACT(s.settings, '$.service'), NOW()
  FROM `whatsapp_sessions` s
  WHERE JSON_EXTRACT(s.settings, '$.service') IS NOT NULL
ON DUPLICATE KEY UPDATE `service` = VALUES(`service`);

-- ---------------------------------------------------------------- broadcasts: números + ritmo; run: contagem por número
ALTER TABLE `whatsapp_broadcasts` ADD COLUMN `session_ids` JSON NULL AFTER `name`, ADD COLUMN `pacing` JSON NULL AFTER `session_ids`;
UPDATE `whatsapp_broadcasts` b JOIN `whatsapp_sessions` s ON s.organization_id = b.organization_id SET b.session_ids = JSON_ARRAY(s.id) WHERE b.session_ids IS NULL;
ALTER TABLE `whatsapp_broadcast_runs` ADD COLUMN `by_session` JSON NULL AFTER `copy_id`;

-- nome interno padrão do número que já existia
UPDATE `whatsapp_sessions` SET `label` = 'Principal', `color` = '#25D366' WHERE `label` IS NULL;
