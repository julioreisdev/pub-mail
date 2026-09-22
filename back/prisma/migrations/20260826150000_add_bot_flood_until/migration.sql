-- Guarda até quando o Telegram está barrando envios do bot (429 flood-wait). NULL = sem flood.
ALTER TABLE `telegram_bots` ADD COLUMN `flood_until` DATETIME(3) NULL;
