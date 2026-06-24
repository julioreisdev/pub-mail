import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSocialAccountDto } from './dto/create-social-account.dto';
import { ListSocialAccountsDto } from './dto/list-social-accounts.dto';
import { UpsertTikTokAppCredentialsDto } from './dto/upsert-tiktok-app-credentials.dto';
import { UpdateSocialAccountDto } from './dto/update-social-account.dto';
import { SocialAccountsService } from './social-accounts.service';

@ApiTags('Organization - Social Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('social-accounts')
export class SocialAccountsController {
  constructor(private readonly socialAccountsService: SocialAccountsService) {}

  @Get('meta')
  @ApiOperation({
    summary:
      'Metadados do gerenciamento de logins (redes e status suportados)',
  })
  getMeta() {
    return this.socialAccountsService.getMeta();
  }

  @Get('oauth/:network/url')
  @ApiOperation({
    summary:
      'Gerar URL OAuth para conectar conta social (abre em nova aba no frontend)',
  })
  async getOAuthUrl(
    @Req() req: any,
    @Param('network') network: string,
    @Query('return_to') returnTo?: string,
  ) {
    const requestOrigin =
      req?.headers?.origin ||
      req?.headers?.referer ||
      req?.headers?.referrer;

    return this.socialAccountsService.getOAuthAuthorizationUrl(
      req.user.organizationId,
      req.user.userId,
      network,
      returnTo,
      requestOrigin,
    );
  }

  @Get('app-credentials/tiktok')
  @ApiOperation({
    summary:
      'Consultar configuração de Keys e APIs do TikTok para a organização',
  })
  getTikTokAppCredentials(@Req() req: any) {
    return this.socialAccountsService.getTikTokAppCredentialsSettings(
      req.user.organizationId,
    );
  }

  @Put('app-credentials/tiktok')
  @ApiOperation({
    summary: 'Salvar/atualizar Keys e APIs do TikTok da organização',
  })
  upsertTikTokAppCredentials(
    @Req() req: any,
    @Body() dto: UpsertTikTokAppCredentialsDto,
  ) {
    return this.socialAccountsService.upsertTikTokAppCredentials(
      req.user.organizationId,
      dto,
    );
  }

  @Public()
  @Get('oauth/:network/callback')
  @ApiOperation({
    summary: 'Callback público do OAuth da rede social',
  })
  async oauthCallback(
    @Param('network') network: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: any,
  ) {
    const redirectUrl = await this.socialAccountsService.handleOAuthCallback({
      network,
      code,
      state,
      error,
      errorDescription,
    });

    return res.redirect(redirectUrl);
  }

  @Get()
  @ApiOperation({
    summary:
      'Listar contas sociais conectadas da organização com filtros opcionais',
  })
  list(@Req() req: any, @Query() query: ListSocialAccountsDto) {
    return this.socialAccountsService.list(req.user.organizationId, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Cadastrar uma conta social para a organização',
  })
  create(@Req() req: any, @Body() dto: CreateSocialAccountDto) {
    return this.socialAccountsService.create(req.user.organizationId, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualizar dados de uma conta social da organização',
  })
  update(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSocialAccountDto,
  ) {
    return this.socialAccountsService.update(req.user.organizationId, id, dto);
  }

  @Post(':id/sync-profile')
  @ApiOperation({
    summary: 'Sincronizar nome/username/avatar da conta social via API oficial',
  })
  syncProfile(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.socialAccountsService.syncTikTokProfile(
      req.user.organizationId,
      id,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Remover uma conta social da organização',
  })
  remove(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.socialAccountsService.remove(req.user.organizationId, id);
  }
}
