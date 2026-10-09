-- Broadcasts anti-ban (09/10/2026): copies sorteadas por destinatário, exclusão de inativos, checagem de
-- existência/bloqueio, disjuntor (pausa automática com "enviar mesmo assim") e respostas por disparo.
ALTER TABLE `whatsapp_broadcasts`
  ADD COLUMN `randomize_copies` TINYINT(1) NOT NULL DEFAULT 0 AFTER `delete_used`,
  ADD COLUMN `exclude_inactive_days` INT NULL AFTER `randomize_copies`;

ALTER TABLE `whatsapp_broadcast_runs`
  ADD COLUMN `copies` JSON NULL AFTER `messages`,
  ADD COLUMN `skipped` INT NOT NULL DEFAULT 0 AFTER `blocked`,
  ADD COLUMN `replied` INT NOT NULL DEFAULT 0 AFTER `skipped`,
  ADD COLUMN `paused_at` DATETIME(3) NULL AFTER `status`,
  ADD COLUMN `pause_reason` VARCHAR(255) NULL AFTER `paused_at`,
  ADD COLUMN `forced_at` DATETIME(3) NULL AFTER `pause_reason`;

ALTER TABLE `whatsapp_broadcast_sends`
  ADD COLUMN `copy_index` INT NULL AFTER `msg_index`,
  ADD COLUMN `skip_reason` VARCHAR(255) NULL AFTER `last_error`,
  ADD COLUMN `replied_at` DATETIME(3) NULL AFTER `sent_at`,
  ADD INDEX `idx_wabcsend_chat` (`organization_id`, `session_id`, `chat_id`, `sent_at`),
  ADD INDEX `idx_wabcsend_run_status` (`run_id`, `status`);

ALTER TABLE `whatsapp_contacts`
  ADD COLUMN `wa_exists` TINYINT(1) NULL AFTER `is_blocked`,
  ADD COLUMN `wa_checked_at` DATETIME(3) NULL AFTER `wa_exists`,
  ADD COLUMN `blocked_us_at` DATETIME(3) NULL AFTER `wa_checked_at`;
