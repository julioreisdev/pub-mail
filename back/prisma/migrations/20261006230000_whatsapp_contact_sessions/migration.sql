-- De qual NÚMERO cada contato veio (agenda sincronizada por ele ou conversa/mensagem por ele).
-- Os contatos continuam sendo da organização; este vínculo responde "contatos DESTE número"
-- (broadcast "cada número dispara para seus contatos" e filtro por número em Contatos).
CREATE TABLE `whatsapp_contact_sessions` (
  `contact_id` CHAR(36) NOT NULL,
  `session_id` CHAR(36) NOT NULL,
  `organization_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`contact_id`, `session_id`),
  KEY `idx_wacontsess_org_session` (`organization_id`, `session_id`),
  KEY `idx_wacontsess_session` (`session_id`),
  CONSTRAINT `fk_wacontsess_contact` FOREIGN KEY (`contact_id`) REFERENCES `whatsapp_contacts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_wacontsess_session` FOREIGN KEY (`session_id`) REFERENCES `whatsapp_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- histórico 1: quem já tem conversa individual com o número (pelo jid, pelo @lid ou pelo telefone)
INSERT IGNORE INTO `whatsapp_contact_sessions` (`contact_id`, `session_id`, `organization_id`)
SELECT c.`id`, ch.`session_id`, c.`organization_id`
FROM `whatsapp_contacts` c
JOIN `whatsapp_chats` ch ON ch.`organization_id` = c.`organization_id` AND ch.`kind` = 'individual' AND ch.`chat_id` = c.`wa_id`;

INSERT IGNORE INTO `whatsapp_contact_sessions` (`contact_id`, `session_id`, `organization_id`)
SELECT c.`id`, ch.`session_id`, c.`organization_id`
FROM `whatsapp_contacts` c
JOIN `whatsapp_chats` ch ON ch.`organization_id` = c.`organization_id` AND ch.`kind` = 'individual' AND ch.`chat_id` = c.`lid`
WHERE c.`lid` IS NOT NULL;

INSERT IGNORE INTO `whatsapp_contact_sessions` (`contact_id`, `session_id`, `organization_id`)
SELECT c.`id`, ch.`session_id`, c.`organization_id`
FROM `whatsapp_contacts` c
JOIN `whatsapp_chats` ch ON ch.`organization_id` = c.`organization_id` AND ch.`kind` = 'individual' AND ch.`chat_id` = CONCAT(c.`phone`, '@c.us')
WHERE c.`phone` IS NOT NULL;

-- histórico 2: contato vindo do WhatsApp (agenda/mensagens) quando a organização só tinha UM número → é daquele número
INSERT IGNORE INTO `whatsapp_contact_sessions` (`contact_id`, `session_id`, `organization_id`)
SELECT c.`id`, s.`id`, c.`organization_id`
FROM `whatsapp_contacts` c
JOIN `whatsapp_sessions` s ON s.`organization_id` = c.`organization_id` AND s.`created_at` <= c.`created_at`
WHERE c.`source` = 'session'
  AND (SELECT COUNT(*) FROM `whatsapp_sessions` s2 WHERE s2.`organization_id` = c.`organization_id` AND s2.`created_at` <= c.`created_at`) = 1;
