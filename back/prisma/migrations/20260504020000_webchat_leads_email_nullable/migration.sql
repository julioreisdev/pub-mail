-- Permite leads sem email (quando o agente captura só nome+telefone via toggle).
-- O dedup ainda usa email quando presente; quando ausente, dedup por phone.
ALTER TABLE `webchat_leads` MODIFY `email` VARCHAR(255) NULL;
