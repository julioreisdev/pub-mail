-- Criptografia em repouso das mensagens e mídias do WhatsApp (08/10/2026).
-- Uma chave por organização (32 bytes aleatórios), guardada CIFRADA pela chave mestra do
-- servidor (env WHATSAPP_DATA_KEYS). Apagar a linha deixa os dados daquela org ilegíveis,
-- inclusive em backups antigos. Sem FK de propósito: admin.removeOrganization desliga as
-- FKs e apaga esta tabela explicitamente.
CREATE TABLE `whatsapp_data_keys` (
  `id` VARCHAR(16) NOT NULL,
  `organization_id` CHAR(36) NOT NULL,
  `master_key_id` VARCHAR(8) NOT NULL,
  `wrapped_key` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wadatakeys_org` (`organization_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
