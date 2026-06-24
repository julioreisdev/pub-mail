import { Module } from '@nestjs/common';
import { ProjectSchedulesService } from './project_schedules.service';
import { ProjectSchedulesController } from './project_schedules.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EmailSchedulesRunner } from 'src/cron-jobs/schedules.service';
// import {SchedulesModule} from "src/schedules/schedules.module";

@Module({
  imports: [PrismaModule],
  controllers: [ProjectSchedulesController],
  providers: [ProjectSchedulesService, EmailSchedulesRunner],
})
export class ProjectSchedulesModule { }
