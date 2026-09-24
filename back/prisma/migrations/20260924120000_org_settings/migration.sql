-- Chaves de API por ORGANIZAÇÃO (antes: singleton system_settings compartilhado entre tenants).
CREATE TABLE `organization_settings` (
  `organization_id` CHAR(36) NOT NULL,
  `groq_api_keys` TEXT NULL,
  `cerebras_api_keys` TEXT NULL,
  `gemini_api_keys` TEXT NULL,
  `mistral_api_keys` TEXT NULL,
  `openrouter_api_keys` TEXT NULL,
  `sambanova_api_keys` TEXT NULL,
  `resend_api_key` VARCHAR(500) NULL,
  `resend_webhook_secret` VARCHAR(255) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`organization_id`),
  CONSTRAINT `fk_org_settings_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migra as chaves globais atuais SÓ para a org dona delas (Blue Grid Media).
INSERT INTO `organization_settings` (organization_id, groq_api_keys, cerebras_api_keys, gemini_api_keys, mistral_api_keys, openrouter_api_keys, sambanova_api_keys, resend_api_key, resend_webhook_secret)
SELECT o.id, s.groq_api_keys, s.cerebras_api_keys, s.gemini_api_keys, s.mistral_api_keys, s.openrouter_api_keys, s.sambanova_api_keys, s.resend_api_key, s.resend_webhook_secret
FROM organizations o JOIN system_settings s ON s.id = 1
WHERE o.id = 'a8854332-a3c7-45eb-96d9-7c2ad1efe4ed'; -- só a org que cadastrou as chaves
