import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WhatsAppSessionsService } from './whatsapp-sessions.service';
import { WhatsAppBootstrapService } from './whatsapp-bootstrap.service';
import { WhatsAppDataService } from './whatsapp-data.service';
import { WaAccessService } from './wa-access.service';
import { CreateSessionDto, PacingDto, PairingCodeDto, PurgeDataDto, ReorderSessionsDto, SwitchEngineDto, TestMessageDto, UpdateProfileDto, UpdateSessionDto } from './dto/whatsapp.dto';

// WhatsApp → Configurações: NÚMEROS da organização (N por org). Cada número = uma sessão do gateway.
//   GET    /whatsapp/sessions                 lista (só os números que o usuário pode ver)
//   POST   /whatsapp/sessions                 "Novo número" (dono/admin)
//   PUT    /whatsapp/sessions/reorder         ordem das abas
//   GET    /whatsapp/sessions/:id             estado de um número (espelho + ao vivo)
//   PATCH  /whatsapp/sessions/:id             nome interno / cor / fluxo do bot
//   DELETE /whatsapp/sessions/:id             apaga o número e tudo dele
//   …/sessions/:id/{qr,start,stop,pairing-code,switch-engine,logout,test,pacing,bootstrap,events,
//                    diagnostics,data-summary,purge,profile,profile/picture}
@ApiTags('WhatsApp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('whatsapp')
export class WhatsAppController {
  constructor(
    private readonly sessions: WhatsAppSessionsService,
    private readonly bootstrap: WhatsAppBootstrapService,
    private readonly data: WhatsAppDataService,
    private readonly access: WaAccessService,
  ) {}

  private async allow(req: any, sessionId: string) {
    await this.access.assertSession(req.user, sessionId);
  }

  // ---------------------------------------------------------------- números
  @Get('sessions')
  async list(@Req() req: any) {
    return this.sessions.list(req.user.organizationId, await this.access.allowedIds(req.user));
  }

  @Post('sessions')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@Req() req: any, @Body() dto: CreateSessionDto) { return this.sessions.create(req.user.organizationId, dto || {}); }

  @Put('sessions/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  reorder(@Req() req: any, @Body() dto: ReorderSessionsDto) { return this.sessions.reorder(req.user.organizationId, dto.ids || []); }

  // Dados guardados (contagens p/ o card "Dados" e o aviso da limpeza) — de tudo ou de um número
  @Get('sessions/data-summary') dataSummaryAll(@Req() req: any) { return this.data.summary(req.user.organizationId, null); }

  // Limpar TUDO da org (todos os números). Irreversível.
  @Post('sessions/purge')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  purgeAll(@Req() req: any, @Body() dto: PurgeDataDto) { return this.data.purge(req.user.organizationId, { sessionId: null, keepContacts: dto.keep_contacts === true }); }

  @Get('sessions/:id')
  async get(@Req() req: any, @Param('id') id: string) { await this.allow(req, id); return this.sessions.get(req.user.organizationId, id); }

  @Put('sessions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateSessionDto) { return this.sessions.update(req.user.organizationId, id, dto || {}); }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  remove(@Req() req: any, @Param('id') id: string) { return this.sessions.remove(req.user.organizationId, id); }

  @Get('sessions/:id/qr')
  async qr(@Req() req: any, @Param('id') id: string) { await this.allow(req, id); return this.sessions.qr(req.user.organizationId, id); }

  @Get('sessions/:id/diagnostics')
  async diagnostics(@Req() req: any, @Param('id') id: string) { await this.allow(req, id); return this.sessions.diagnostics(req.user.organizationId, id); }

  @Get('sessions/:id/events')
  async events(@Req() req: any, @Param('id') id: string, @Query('limit') limit?: string) { await this.allow(req, id); return this.sessions.events(req.user.organizationId, id, parseInt(String(limit || 50), 10) || 50); }

  @Post('sessions/:id/start')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  start(@Req() req: any, @Param('id') id: string) { return this.sessions.start(req.user.organizationId, id); }

  @Post('sessions/:id/stop')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  stop(@Req() req: any, @Param('id') id: string) { return this.sessions.stop(req.user.organizationId, id); }

  @Post('sessions/:id/pairing-code')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  pairing(@Req() req: any, @Param('id') id: string, @Body() dto: PairingCodeDto) { return this.sessions.pairingCode(req.user.organizationId, id, dto.phone); }

  // Trocar o motor do gateway (whatsapp-web.js ↔ Baileys): encerra a conexão atual e mostra um QR novo.
  @Post('sessions/:id/switch-engine')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  switchEngine(@Req() req: any, @Param('id') id: string, @Body() dto: SwitchEngineDto) { return this.sessions.switchEngine(req.user.organizationId, id, dto.engine); }

  // Desconectar / trocar de número (a linha continua)
  @Post('sessions/:id/logout')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  logout(@Req() req: any, @Param('id') id: string) { return this.sessions.logout(req.user.organizationId, id); }

  @Get('sessions/:id/data-summary')
  async dataSummary(@Req() req: any, @Param('id') id: string) { await this.allow(req, id); return this.data.summary(req.user.organizationId, id); }

  // Limpar os dados DESTE número (desconecta se ainda houver sessão). Irreversível.
  @Post('sessions/:id/purge')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  purge(@Req() req: any, @Param('id') id: string, @Body() dto: PurgeDataDto) { void dto; return this.data.purge(req.user.organizationId, { sessionId: id }); }

  // Importar do celular de novo (conversas, contatos, histórico recente)
  @Post('sessions/:id/bootstrap')
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  async runBootstrap(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    await this.allow(req, id);
    // opções: chats (10–200, padrão 60) e per_chat (10–100, padrão 40); roda em background
    const opts = { chats: parseInt(String(dto?.chats || ''), 10) || undefined, perChat: parseInt(String(dto?.per_chat || ''), 10) || undefined };
    this.bootstrap.run(req.user.organizationId, id, true, opts).catch(() => undefined);
    return { started: true };
  }

  @Post('sessions/:id/test')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async test(@Req() req: any, @Param('id') id: string, @Body() dto: TestMessageDto) { await this.allow(req, id); return this.sessions.sendTest(req.user.organizationId, id, dto?.text); }

  @Put('sessions/:id/pacing')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  pacing(@Req() req: any, @Param('id') id: string, @Body() dto: PacingDto) { return this.sessions.setPacing(req.user.organizationId, id, dto.enabled); }

  @Get('sessions/:id/profile')
  async profile(@Req() req: any, @Param('id') id: string) { await this.allow(req, id); return this.sessions.getProfile(req.user.organizationId, id); }

  @Put('sessions/:id/profile')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  updateProfile(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateProfileDto) { return this.sessions.updateProfile(req.user.organizationId, id, dto); }

  @Put('sessions/:id/profile/picture')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  picture(@Req() req: any, @Param('id') id: string, @UploadedFile() file: any) {
    return this.sessions.setProfilePicture(req.user.organizationId, id, { buffer: file?.buffer, mimetype: String(file?.mimetype || ''), size: Number(file?.size || 0) });
  }

  @Delete('sessions/:id/profile/picture')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  deletePicture(@Req() req: any, @Param('id') id: string) { return this.sessions.deleteProfilePicture(req.user.organizationId, id); }
}
