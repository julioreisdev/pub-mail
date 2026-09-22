import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailAbController } from './ab.controller';
import { EmailAbService } from './ab.service';
import { EmailAbRunner } from './ab-runner.service';

@Module({
  imports: [PrismaModule],
  controllers: [EmailAbController],
  providers: [EmailAbService, EmailAbRunner],
})
export class EmailAbModule {}
