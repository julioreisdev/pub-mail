import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// @Global: um único PrismaService (um único pool) para toda a aplicação.
// Módulos NÃO devem redeclarar PrismaService em `providers` (A-79).
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
