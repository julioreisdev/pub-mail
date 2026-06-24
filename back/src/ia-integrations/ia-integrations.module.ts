import { Module } from '@nestjs/common';
import { IaIntegrationsController } from './ia-integrations.controller';
import { IaIntegrationsService } from './ia-integrations.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [IaIntegrationsController],
    providers: [IaIntegrationsService],
})
export class IaIntegrationsModule { }
