import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AgentesService } from './agentes.service';
import { AgentesController } from './agentes.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AgentesController],
  providers: [AgentesService],
  exports: [AgentesService],
})
export class AgentesModule {}
