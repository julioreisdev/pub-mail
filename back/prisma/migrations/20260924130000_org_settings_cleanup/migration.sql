-- Correção: a org oculta do dev NÃO deve herdar chaves (só quem cadastrou — Blue Grid Media — mantém).
DELETE FROM `organization_settings`
WHERE `organization_id` IN (SELECT `id` FROM `organizations` WHERE `hidden` = 1);

-- system_settings vira SÓ infra da plataforma: remove as colunas legadas de chaves (dados em repouso).
ALTER TABLE `system_settings`
  DROP COLUMN `groq_api_keys`,
  DROP COLUMN `cerebras_api_keys`,
  DROP COLUMN `gemini_api_keys`,
  DROP COLUMN `mistral_api_keys`,
  DROP COLUMN `openrouter_api_keys`,
  DROP COLUMN `sambanova_api_keys`,
  DROP COLUMN `resend_api_key`,
  DROP COLUMN `resend_webhook_secret`;
