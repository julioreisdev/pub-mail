import { Module } from '@nestjs/common';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';

// Chat interno da equipe. Reusa o serviço de mídia do WhatsApp (arquivos protegidos + URL assinada).
@Module({
  imports: [WhatsAppModule],
  providers: [TeamService],
  controllers: [TeamController],
  exports: [TeamService],
})
export class TeamModule {}
