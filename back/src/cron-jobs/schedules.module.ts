import { Global, Module } from '@nestjs/common';
import { PrismaModule } from "src/prisma/prisma.module";
import { EmailSchedulesRunner} from "./schedules.service"

@Global()
@Module({
    imports: [PrismaModule],
    providers:[EmailSchedulesRunner],
    exports:[EmailSchedulesRunner],
})
export class SchedulesModule {}
