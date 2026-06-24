import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
    imports: [PrismaModule], // se não existir, me diga que eu ajusto para o seu caso
    controllers: [BillingController],
    providers: [BillingService],
})
export class BillingModule { }
