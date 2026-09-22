-- Horários "quebrados": `time` passa a ser SEMPRE minuto-do-dia (0..1439).
-- Valores legados eram HORA (0..23, o front só oferecia horas cheias) →
-- converte para minuto-do-dia multiplicando por 60. Só toca 0..23, então é
-- seguro mesmo se já houver algum valor em minuto-do-dia.
UPDATE `email_projects_schedules`
  SET `time` = `time` * 60
  WHERE `time` IS NOT NULL AND `time` BETWEEN 0 AND 23;

-- Snapshots históricos dos envios (para exibir HH:MM consistente).
UPDATE `email_projects_schedules_sent`
  SET `schedule_time` = `schedule_time` * 60
  WHERE `schedule_time` IS NOT NULL AND `schedule_time` BETWEEN 0 AND 23;
