import { Module } from '@nestjs/common';
import { OrganiztionsService } from './organiztions.service';
import { OrganiztionsController } from './organiztions.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports:[PrismaModule],
  controllers: [OrganiztionsController],
  providers: [OrganiztionsService],
})
export class OrganiztionsModule {}
