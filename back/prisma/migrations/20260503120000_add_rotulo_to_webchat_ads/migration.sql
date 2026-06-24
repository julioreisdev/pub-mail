-- Rótulo discreto exibido acima de cada anúncio (default "PUBLICIDADE").
-- Necessário pra políticas do Google AdSense/AdManager: identificar
-- visualmente o que é publicidade pro usuário final.
ALTER TABLE `webchat_ads` ADD COLUMN `rotulo` VARCHAR(100) NULL;
