import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateWebchatDomainDto } from './dto/create-webchat-domain.dto';
import { UpdateAdsTxtDto } from './dto/update-ads-txt.dto';
import { WebchatDomainsService } from './webchat-domains.service';

@ApiTags('Webchat Domains')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('webchat-domains')
export class WebchatDomainsController {
  constructor(private readonly webchatDomainsService: WebchatDomainsService) {}

  // Cadastrar/remover domínio: só OWNER/ADMIN (A-07). Leitura para todos.
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Cadastrar domínio para publicação de webchat' })
  @ApiCreatedResponse({ description: 'Domínio de webchat cadastrado com sucesso' })
  create(@Req() req: any, @Body() dto: CreateWebchatDomainDto) {
    return this.webchatDomainsService.create(req.user.organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar domínios de webchat da organização' })
  @ApiOkResponse({ description: 'Lista de domínios retornada com sucesso' })
  list(@Req() req: any) {
    return this.webchatDomainsService.list(req.user.organizationId);
  }

  @Patch(':id/verify')
  @ApiOperation({
    summary: 'Verificar DNS e provisionar SSL automaticamente no servidor',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  verify(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.webchatDomainsService.verify(req.user.organizationId, id);
  }

  @Patch(':id/ads-txt')
  @ApiOperation({ summary: 'Atualizar conteúdo do ads.txt deste domínio' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  updateAdsTxt(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAdsTxtDto,
  ) {
    return this.webchatDomainsService.updateAdsTxt(
      req.user.organizationId,
      id,
      dto.ads_txt,
    );
  }

  // Reescreve os vhosts do servidor (mexe em SSL de TODOS os domínios) —
  // operação de plataforma, só SUPER_ADMIN (A-20).
  @Post('regenerate-nginx')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary:
      'Re-aplica o template nginx em todos os domínios da organização (idempotente).',
  })
  @ApiOkResponse({ description: 'Resumo da regeneração por domínio' })
  regenerateNginx(@Req() req: any) {
    return this.webchatDomainsService.regenerateAllNginxBlocks(
      req.user.organizationId,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Remover domínio de webchat' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  remove(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.webchatDomainsService.remove(req.user.organizationId, id);
  }
}
