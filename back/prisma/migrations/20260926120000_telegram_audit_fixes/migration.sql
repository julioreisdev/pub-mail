-- Auditoria 26/09/2026 (Telegram):
-- A-06: claim atômico da entrega do pagamento (evita entrega/assinatura em dobro quando webhook,
--       "Já paguei" e poller chegam juntos). NULL = ninguém entregando; preenchido = em andamento
--       (um claim com mais de 5 min é considerado abandonado e pode ser retomado pelo cron).
ALTER TABLE `telegram_payments` ADD COLUMN `delivering_at` DATETIME(3) NULL AFTER `delivered`;

-- A-34: retomada de copies parciais no broadcast — índice da próxima mensagem da copy a enviar
--       para este destinatário (persistido a cada mensagem entregue; retry começa daqui).
ALTER TABLE `telegram_broadcast_sends` ADD COLUMN `msg_index` INT NOT NULL DEFAULT 0 AFTER `attempts`;
