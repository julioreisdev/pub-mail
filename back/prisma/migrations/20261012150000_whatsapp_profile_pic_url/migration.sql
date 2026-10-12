-- Foto de perfil: URL atual informada pelo gateway (muda quando a pessoa troca a foto) + quando foi conferida.
ALTER TABLE `whatsapp_contacts`
  ADD COLUMN `profile_pic_url` VARCHAR(500) NULL AFTER `profile_pic_media_id`,
  ADD COLUMN `profile_pic_checked_at` DATETIME(3) NULL AFTER `profile_pic_url`;
