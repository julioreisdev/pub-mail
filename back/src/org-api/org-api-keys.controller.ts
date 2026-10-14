import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OrgApiKeysService } from './org-api-keys.service';
import { API_SCOPES, DEFAULT_API_SCOPES, MAX_API_KEYS_PER_ORG } from './api-scopes';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto/org-api.dto';

// Painel: chaves de API da organização (dono/admin). `/org/*` exige o módulo `settings` (modules.const.ts).
@ApiTags('API da organização')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
@Controller('org/api-keys')
export class OrgApiKeysController {
  constructor(private readonly keys: OrgApiKeysService) {}

  @Get() list(@Req() req: any) { return this.keys.list(req.user.organizationId); }
  /** Catálogo de escopos (o front pode usar para montar a tela). */
  @Get('scopes') scopes() { return { scopes: API_SCOPES, default_scopes: DEFAULT_API_SCOPES, max: MAX_API_KEYS_PER_ORG }; }
  @Post() @Throttle({ default: { limit: 20, ttl: 60_000 } }) create(@Req() req: any, @Body() dto: CreateApiKeyDto) { return this.keys.create(req.user.organizationId, req.user.userId || null, dto); }
  @Put(':id') update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateApiKeyDto) { return this.keys.update(req.user.organizationId, id, dto); }
  @Delete(':id') revoke(@Req() req: any, @Param('id') id: string) { return this.keys.revoke(req.user.organizationId, id); }
}
