-- Revisão geral das 9 etapas (14/10/2026): finalidade da cobrança — 'order' (PIX de pedido) e 'appointment' (reserva/sinal da agenda)
-- não são "faturas": ficam fora da régua de lembretes, da etiqueta Inadimplente, do aviso de vencida e de multa/juros.
ALTER TABLE `whatsapp_charges` ADD COLUMN `purpose` VARCHAR(16) NULL AFTER `origin`;
