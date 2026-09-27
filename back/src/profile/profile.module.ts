import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  controllers: [ProfileController],
  // PrismaService vem do PrismaModule (@Global) — não instanciar outro pool (A-79).
  providers: [ProfileService],
})
export class ProfileModule {}