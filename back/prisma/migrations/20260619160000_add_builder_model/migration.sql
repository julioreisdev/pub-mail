-- Modelo do builder visual (JSON) — HTML fica limpo, o modelo editável vive aqui.
ALTER TABLE `email_templates` ADD COLUMN `builder_model` JSON NULL AFTER `body_text`;
ALTER TABLE `quizzes` ADD COLUMN `lead_email_model` JSON NULL AFTER `lead_email_subject`;
