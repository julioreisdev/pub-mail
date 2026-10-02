-- WhatsApp CRM (02/10/2026): automações do funil por org (entrada automática, etapa ao pagar).
ALTER TABLE `whatsapp_crm_settings` ADD COLUMN `pipeline` JSON NULL AFTER `charge`;
