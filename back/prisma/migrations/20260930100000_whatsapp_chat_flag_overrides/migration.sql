-- Marcações (arquivada/fixada/silenciada) decididas no painel que o gateway não confirmou
-- ou ainda não refletiu: { archived: { value, gw } } — ver WhatsAppChatSyncRunner.
ALTER TABLE `whatsapp_chats` ADD COLUMN `flag_overrides` JSON NULL;
