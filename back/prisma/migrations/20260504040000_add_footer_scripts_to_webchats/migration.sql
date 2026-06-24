-- Coluna pra HTML/scripts injetados no rodapé do webchat público (tracking,
-- pixels de conversão, scripts de analytics que precisam estar antes de </body>).
-- Mesmo padrão de header_scripts mas com semântica de footer.
ALTER TABLE `webchats` ADD COLUMN `footer_scripts` TEXT NULL;
