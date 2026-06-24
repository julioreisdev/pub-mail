import { Module } from '@nestjs/common';
import { PrismaModule } from "src/prisma/prisma.module";
import { EmailSchedulesRunner} from "./schedules.service"

@Module({
    imports: [PrismaModule],
    providers:[EmailSchedulesRunner]
})
export class SchedulesModule {}
