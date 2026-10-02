import { Body, Controller, Delete, Get, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WhatsAppSessionsService } from './whatsapp-sessions.service';
import { WhatsAppBootstrapService } from './whatsapp-bootstrap.service';
import { WhatsAppDataService } from './whatsapp-data.service';
import { PacingDto, PairingCodeDto, PurgeDataDto, SwitchEngineDto, TestMessageDto, UpdateProfileDto } from './dto/whatsapp.dto';

// WhatsApp → Configurações (sessão da org: conectar/QR/pareamento, perfil, teste, desconectar).
@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp')
export class WhatsAppController {
  constructor(
    private readonly sessions: WhatsAppSessionsService,
    private readonly bootstrap: WhatsAppBootstrapService,
    private readonly data: WhatsAppDataService,
  ) {}

  @Get('session') get(@Req() req: any) { return this.sessions.get(req.user.organizationId); }
  @Get('session/qr') qr(@Req() req: any) { return this.sessions.qr(req.user.organizationId); }
  @Get('session/diagnostics') diagnostics(@Req() req: any) { return this.sessions.diagnostics(req.user.organizationId); }
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

  // Trocar o motor do gateway (whatsapp-web.js ↔ Baileys): encerra a conexão atual e mostra um QR novo.
  @Post('session/switch-engine')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  switchEngine(@Req() req: any, @Body() dto: SwitchEngineDto) { return this.sessions.switchEngine(req.user.organizationId, dto.engine); }

  // Desconectar / trocar de número
  @Post('session/logout')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  logout(@Req() req: any) { return this.sessions.logout(req.user.organizationId); }

  // Dados guardados do número (contagens p/ o card "Dados do número" e o aviso da limpeza)
  @Get('session/data-summary') dataSummary(@Req() req: any) { return this.data.summary(req.user.organizationId); }

  // Limpar todos os dados do número (desconecta se ainda houver sessão). Irreversível.
  @Post('session/purge')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  purge(@Req() req: any, @Body() dto: PurgeDataDto) { return this.data.purge(req.user.organizationId, { keepContacts: dto.keep_contacts === true }); }

  // Importar do celular de novo (conversas, contatos, histórico recente)
  @Post('session/bootstrap')
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  runBootstrap(@Req() req: any, @Body() dto: any) {
    // opções: chats (10–200, padrão 60) e per_chat (10–100, padrão 40); roda em background
    const orgId = req.user.organizationId;
    const opts = { chats: parseInt(String(dto?.chats || ''), 10) || undefined, perChat: parseInt(String(dto?.per_chat || ''), 10) || undefined };
    this.bootstrap.run(orgId, true, opts).catch(() => undefined);
    return { started: true };
  }

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
