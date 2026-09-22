-- Templates selecionados por agendamento. Se preenchido, o disparo sorteia
-- entre eles e NÃO apaga os templates. Vazio/NULL = comportamento atual.
ALTER TABLE `email_projects_schedules` ADD COLUMN `template_ids` JSON NULL AFTER `last_run`;
