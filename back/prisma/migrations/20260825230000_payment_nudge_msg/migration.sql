-- Guarda o id da última mensagem de "não pagou" p/ apagá-la ao confirmar o pagamento.
ALTER TABLE `telegram_payments` ADD COLUMN `nudge_message_id` BIGINT NULL;
