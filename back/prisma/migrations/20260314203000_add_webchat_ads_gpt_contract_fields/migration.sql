ALTER TABLE `webchat_ads`
    ADD COLUMN `gpt_slot` VARCHAR(255) NULL AFTER `gpt_sizes`,
    ADD COLUMN `gpt_div_id` VARCHAR(255) NULL AFTER `gpt_slot`,
    ADD COLUMN `anuncio_fixed` TEXT NULL AFTER `gpt_div_id`;
