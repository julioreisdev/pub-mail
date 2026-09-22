-- Config editável das mensagens do checkout (QR on/off, textos, rótulos de botão,
-- PIX em mensagem separada, mensagens de "não pagou"/"expirou").
ALTER TABLE `telegram_payment_settings` ADD COLUMN `checkout_config` JSON NULL;
