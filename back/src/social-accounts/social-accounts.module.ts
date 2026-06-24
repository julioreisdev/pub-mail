import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SocialAccountsController } from './social-accounts.controller';
import { SocialAccountsCryptoService } from './social-accounts-crypto.service';
import { SocialAccountsService } from './social-accounts.service';

@Module({
  imports: [PrismaModule],
  controllers: [SocialAccountsController],
  providers: [SocialAccountsService, SocialAccountsCryptoService],
  exports: [SocialAccountsService, SocialAccountsCryptoService],
})
export class SocialAccountsModule {}
