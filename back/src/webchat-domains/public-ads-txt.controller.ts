import { Controller, Get, Headers, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { Public } from '../auth/public.decorator';
import { WebchatDomainsService } from './webchat-domains.service';

@ApiTags('Public ads.txt')
@Public()
@Controller()
export class PublicAdsTxtController {
  constructor(private readonly service: WebchatDomainsService) {}

  // GET /ads.txt — resolve por Host header. Devolvido como text/plain.
  // - Domínio cadastrado SEM ads.txt salvo → 200 vazio (válido pra IAB).
  // - Domínio NÃO cadastrado → 404.
  // Cache-Control 5min: balanceia entre propagação rápida e economia de hits
  // pelo Cloudflare/crawlers.
  @Get('ads.txt')
  @ApiOperation({
    summary:
      'Serve o ads.txt do domínio (resolvido pelo Host header). Rota pública.',
  })
  async serveAdsTxt(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('host') hostHeader?: string,
  ) {
    const host = String(req.hostname || hostHeader || '');
    const content = await this.service.getAdsTxtByHost(host);

    if (content === null) {
      res
        .status(404)
        .type('text/plain; charset=utf-8')
        .set('Cache-Control', 'public, max-age=60')
        .send('# domain not registered\n');
      return;
    }

    res
      .status(200)
      .type('text/plain; charset=utf-8')
      .set('Cache-Control', 'public, max-age=300')
      .send(content);
  }
}
