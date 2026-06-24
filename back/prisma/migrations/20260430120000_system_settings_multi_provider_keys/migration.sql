-- Multi-provider AI: novas chaves cadastradas pelo front em Conta & Domínios > Integrações.
-- Cada coluna aceita múltiplas chaves separadas por vírgula ou quebra de linha
-- (mesmo padrão do groq_api_keys já existente).
ALTER TABLE `system_settings`
  ADD COLUMN `cerebras_api_keys`   TEXT NULL,
  ADD COLUMN `gemini_api_keys`     TEXT NULL,
  ADD COLUMN `mistral_api_keys`    TEXT NULL,
  ADD COLUMN `openrouter_api_keys` TEXT NULL,
  ADD COLUMN `sambanova_api_keys`  TEXT NULL;
