-- HTML (e assunto) do e-mail enviado imediatamente ao lead após a captação.
ALTER TABLE `quizzes`
  ADD COLUMN `lead_email_html` LONGTEXT NULL AFTER `footer_scripts`,
  ADD COLUMN `lead_email_subject` VARCHAR(255) NULL AFTER `lead_email_html`;
