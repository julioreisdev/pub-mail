-- Broadcasts com vários números: como a audiência de CONTATOS é repartida.
--   shared = "Usar em conjunto": soma a audiência e divide igualmente entre os números conectados
--   own    = "Cada número dispara para seus contatos": o contato sai pelo número com que já conversa
ALTER TABLE `whatsapp_broadcasts` ADD COLUMN `distribution` VARCHAR(16) NOT NULL DEFAULT 'shared' AFTER `session_ids`;
