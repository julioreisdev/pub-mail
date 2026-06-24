-- Adiciona conteúdo do ads.txt por domínio de webchat. NULL/empty ⇒ servimos
-- /ads.txt vazio com 200 (continua válido pra IAB).
ALTER TABLE `webchat_domains` ADD COLUMN `ads_txt` TEXT NULL;
