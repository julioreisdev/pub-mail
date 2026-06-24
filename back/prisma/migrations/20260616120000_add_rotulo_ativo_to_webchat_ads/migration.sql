-- Adiciona flag para permitir desativar o rótulo de publicidade por anúncio.
ALTER TABLE `webchat_ads` ADD COLUMN `rotulo_ativo` BOOLEAN NOT NULL DEFAULT true;
