import { Body, Controller, Delete, Get, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WhatsAppSessionsService } from './whatsapp-sessions.service';
import { WhatsAppBootstrapService } from './whatsapp-bootstrap.service';
import { PacingDto, PairingCodeDto, TestMessageDto, UpdateProfileDto } from './dto/whatsapp.dto';

// WhatsApp → Configurações (sessão da org: conectar/QR/pareamento, perfil, teste, desconectar).
@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly sessions: WhatsAppSessionsService, private readonly bootstrap: WhatsAppBootstrapService) {}

  @Get('session') get(@Req() req: any) { return this.sessions.get(req.user.organizationId); }
  @Get('session/qr') qr(@Req() req: any) { return this.sessions.qr(req.user.organizationId); }
  @Get('session/events') events(@Req() req: any, @Query('limit') limit?: string) { return this.sessions.events(req.user.organizationId, parseInt(String(limit || 50), 10) || 50); }

  @Post('session/start')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  start(@Req() req: any) { return this.sessions.start(req.user.organizationId); }

  @Post('session/stop')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  stop(@Req() req: any) { return this.sessions.stop(req.user.organizationId); }

  @Post('session/pairing-code')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  pairing(@Req() req: any, @Body() dto: PairingCodeDto) { return this.sessions.pairingCode(req.user.organizationId, dto.phone); }

  // Desconectar / trocar de número
  @Post('session/logout')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  logout(@Req() req: any) { return this.sessions.logout(req.user.organizationId); }

  // Importar do celular de novo (conversas, contatos, histórico recente)
  @Post('session/bootstrap')
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  runBootstrap(@Req() req: any) { return this.bootstrap.run(req.user.organizationId, true); }

  @Post('session/test')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  test(@Req() req: any, @Body() dto: TestMessageDto) { return this.sessions.sendTest(req.user.organizationId, dto?.text); }

  @Put('session/pacing')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  pacing(@Req() req: any, @Body() dto: PacingDto) { return this.sessions.setPacing(req.user.organizationId, dto.enabled); }

  @Get('profile') profile(@Req() req: any) { return this.sessions.getProfile(req.user.organizationId); }

  @Put('profile')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) { return this.sessions.updateProfile(req.user.organizationId, dto); }

  @Put('profile/picture')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  picture(@Req() req: any, @UploadedFile() file: any) {
    return this.sessions.setProfilePicture(req.user.organizationId, { buffer: file?.buffer, mimetype: String(file?.mimetype || ''), size: Number(file?.size || 0) });
  }

  @Delete('profile/picture')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  deletePicture(@Req() req: any) { return this.sessions.deleteProfilePicture(req.user.organizationId); }
}
