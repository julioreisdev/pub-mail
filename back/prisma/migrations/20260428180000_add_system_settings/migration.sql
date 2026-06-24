-- CreateTable: singleton de configurações do sistema (substitui envs GROQ/RESEND/WEBCHAT_EDGE_IP/CERTBOT)
CREATE TABLE `system_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `groq_api_keys` TEXT NULL,
    `resend_api_key` VARCHAR(500) NULL,
    `webchat_edge_ip` VARCHAR(45) NULL,
    `certbot_email` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed: inicializa a linha singleton (id = 1) vazia
INSERT INTO `system_settings` (`id`, `updated_at`) VALUES (1, CURRENT_TIMESTAMP(0));
