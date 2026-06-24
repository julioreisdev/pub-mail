import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { CaptureWebchatLeadDto } from './dto/capture-webchat-lead.dto';
import { SendWebchatMessageDto } from './dto/send-webchat-message.dto';
import { TrackWebchatAdEventsDto } from './dto/track-webchat-ad-events.dto';
import { WebchatsService } from './webchat.service';

@ApiTags('Public Webchat')
@Public()
@Controller('public/webchat')
export class PublicWebchatsController {
  constructor(private readonly webchatsService: WebchatsService) {}

  @Get(':slug/config')
  @ApiOperation({ summary: 'Buscar configuração pública do webchat por slug' })
  getConfig(
    @Param('slug') slug: string,
    @Query('domain') domainQuery: string | undefined,
    @Req() req: any,
  ) {
    const domainHint = this.resolveDomainHint(req, domainQuery);
    return this.webchatsService.getPublicConfig(slug, domainHint);
  }

  @Get(':slug/session')
  @ApiOperation({ summary: 'Resgatar sessão pública do webchat por session_id' })
  getSession(
    @Param('slug') slug: string,
    @Query('session_id') sessionId: string | undefined,
    @Query('domain') domainQuery: string | undefined,
    @Req() req: any,
  ) {
    const domainHint = this.resolveDomainHint(req, domainQuery);
    return this.webchatsService.getPublicSessionState(
      slug,
      domainHint,
      sessionId,
    );
  }

  @Post(':slug/leads')
  @ApiOperation({
    summary:
      'Capturar lead público do webchat com deduplicação manual e roteamento',
  })
  captureLead(
    @Param('slug') slug: string,
    @Query('domain') domainQuery: string | undefined,
    @Body() dto: CaptureWebchatLeadDto,
    @Req() req: any,
  ) {
    const domainHint = this.resolveDomainHint(req, domainQuery);
    return this.webchatsService.captureLead(slug, domainHint, dto);
  }

  @Post(':slug/messages')
  @ApiOperation({
    summary:
      'Enviar mensagem para IA do webchat (cobrança de tokens por requisição)',
  })
  sendMessage(
    @Param('slug') slug: string,
    @Query('domain') domainQuery: string | undefined,
    @Body() dto: SendWebchatMessageDto,
    @Req() req: any,
  ) {
    const domainHint = this.resolveDomainHint(req, domainQuery);
    return this.webchatsService.sendMessage(slug, domainHint, dto);
  }

  @Post(':slug/ad-events')
  @ApiOperation({
    summary: 'Registrar eventos de anúncios do webchat público',
  })
  trackAdEvents(
    @Param('slug') slug: string,
    @Query('domain') domainQuery: string | undefined,
    @Body() dto: TrackWebchatAdEventsDto,
    @Req() req: any,
  ) {
    const domainHint = this.resolveDomainHint(req, domainQuery);
    return this.webchatsService.trackPublicAdEvents(slug, domainHint, dto);
  }

  private resolveDomainHint(req: any, domainQuery?: string) {
    const headerDomain = req.headers?.['x-webchat-domain'];
    const host = req.headers?.host;
    const candidate = headerDomain || domainQuery || host || '';
    return String(candidate || '');
  }
}
