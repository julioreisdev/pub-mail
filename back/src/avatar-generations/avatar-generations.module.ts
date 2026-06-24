import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AvatarGenerationsController } from './avatar-generations.controller';
import { AvatarGenerationsService } from './avatar-generations.service';

@Module({
    imports: [PrismaModule],
    controllers: [AvatarGenerationsController],
    providers: [AvatarGenerationsService],
    exports: [AvatarGenerationsService],
})
export class AvatarGenerationsModule { }
