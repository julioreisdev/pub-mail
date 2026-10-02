import { Module } from '@nestjs/common';
import { WpPluginController, WpPluginPublicController } from './wp-plugin.controller';
import { WpPluginService } from './wp-plugin.service';

// Módulo "WordPress": plugin Tradutor Invisível vinculado à conta (download, licença, atualização).
@Module({
  controllers: [WpPluginController, WpPluginPublicController],
  providers: [WpPluginService],
})
export class WordpressModule {}
