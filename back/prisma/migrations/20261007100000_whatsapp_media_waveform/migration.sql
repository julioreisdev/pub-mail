-- Forma de onda dos áudios (barras 0..100, calculadas com ffmpeg) + duração, para o player do chat.
-- waveform = [] marca "tentou e não deu" (não fica recalculando).
ALTER TABLE `whatsapp_media`
  ADD COLUMN `waveform` JSON NULL AFTER `sha1`,
  ADD COLUMN `duration_ms` INT NULL AFTER `waveform`;
