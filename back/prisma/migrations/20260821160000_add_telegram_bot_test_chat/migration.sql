-- Guarda o chat_id privado que conversou com o bot (usado p/ enviar mensagem de teste ao dono).
ALTER TABLE `telegram_bots` ADD COLUMN `test_chat_id` BIGINT NULL AFTER `first_name`;
