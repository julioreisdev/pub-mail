-- Discrimina domínios por tipo: 'webchat' (default) ou 'quiz'. O
-- provisionamento (nginx/certbot/ads.txt) é idêntico para os dois.
ALTER TABLE `webchat_domains` ADD COLUMN `kind` VARCHAR(20) NOT NULL DEFAULT 'webchat';
