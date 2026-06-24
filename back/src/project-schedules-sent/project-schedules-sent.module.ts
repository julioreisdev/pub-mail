import { Module } from "@nestjs/common";
import { PrismaModule } from "src/prisma/prisma.module";
import { ProjectSchedulesSentController } from "./project-schedules-sent.controller";
import { ProjectSchedulesSentService } from "./project-schedules-sent.service";

@Module({
  imports: [PrismaModule],
  controllers: [ ProjectSchedulesSentController],
  providers: [ProjectSchedulesSentService],
})
export class ProjectSchedulesSentModule {}
