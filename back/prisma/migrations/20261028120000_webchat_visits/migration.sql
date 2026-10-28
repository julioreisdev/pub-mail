-- Visitas do webchat: 1 linha por (webchat, sessão do navegador, dia em Brasília).
-- "Visita" = uma pessoa que abriu a página daquele webchat; o front chama GET /public/webchat/:slug/session
-- a cada abertura, e é lá que a visita é gravada (best-effort).
CREATE TABLE `webchat_visits` (
  `id` CHAR(36) NOT NULL DEFAULT (uuid()),
  `organization_id` CHAR(36) NOT NULL,
  `webchat_id` CHAR(36) NOT NULL,
  `session_id` VARCHAR(100) NOT NULL,
  `day` DATE NOT NULL,
  `first_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `hits` INT NOT NULL DEFAULT 1,
  `page_url` VARCHAR(500) NULL,
  `referrer` VARCHAR(500) NULL,
  `user_agent` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_webchat_visits_session_day` (`webchat_id`, `session_id`, `day`),
  KEY `idx_webchat_visits_org_day` (`organization_id`, `day`),
  KEY `idx_webchat_visits_webchat_day` (`webchat_id`, `day`),
  CONSTRAINT `fk_webchat_visits_webchat` FOREIGN KEY (`webchat_id`) REFERENCES `webchats` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
