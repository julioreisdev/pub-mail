-- Motor do gateway por sessão: 'wwjs' (whatsapp-web.js, OpenWA :2785) ou 'baileys' (OpenWA :2786).
-- Sessões existentes continuam no whatsapp-web.js até o usuário migrar em Configurações.
ALTER TABLE `whatsapp_sessions` ADD COLUMN `engine` VARCHAR(16) NOT NULL DEFAULT 'wwjs';
