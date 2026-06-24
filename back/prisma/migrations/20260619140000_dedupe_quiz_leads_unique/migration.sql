-- Deduplica quiz_leads existentes e trava no banco (1 lead por quiz+email).
-- 1) Remove duplicados por (quiz_id, email) mantendo o mais recente.
DELETE q1 FROM `quiz_leads` q1
JOIN `quiz_leads` q2
  ON q1.`quiz_id` = q2.`quiz_id`
 AND q1.`email` = q2.`email`
WHERE q1.`email` IS NOT NULL
  AND (
    q1.`created_at` < q2.`created_at`
    OR (q1.`created_at` = q2.`created_at` AND q1.`id` > q2.`id`)
  );

-- 2) Remove duplicados de leads só-telefone por (quiz_id, phone).
DELETE q1 FROM `quiz_leads` q1
JOIN `quiz_leads` q2
  ON q1.`quiz_id` = q2.`quiz_id`
 AND q1.`phone` = q2.`phone`
WHERE q1.`email` IS NULL AND q2.`email` IS NULL
  AND q1.`phone` IS NOT NULL
  AND (
    q1.`created_at` < q2.`created_at`
    OR (q1.`created_at` = q2.`created_at` AND q1.`id` > q2.`id`)
  );

-- 3) Trava: 1 e-mail por quiz. (email NULL é permitido múltiplas vezes no MySQL,
--    então leads só-telefone não são bloqueados.)
ALTER TABLE `quiz_leads`
  ADD UNIQUE KEY `uk_quiz_leads_quiz_email` (`quiz_id`, `email`);
