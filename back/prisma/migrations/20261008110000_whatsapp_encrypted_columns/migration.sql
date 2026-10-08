-- Texto cifrado ocupa mais que o original (prefixo + IV + etiqueta + base64): as prévias que
-- eram VARCHAR(255) viram TEXT para caber a versão cifrada (08/10/2026).
ALTER TABLE `whatsapp_messages` MODIFY `quoted_preview` TEXT NULL;
ALTER TABLE `whatsapp_chats` MODIFY `last_message_preview` TEXT NULL;
