import { Controller, ForbiddenException, Get, Param, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { basename } from 'path';
import { Public } from '../auth/public.decorator';
import { WhatsAppMediaService } from './whatsapp-media.service';
import { serveWaFile } from './crypto/wa-file-serve';

// Download de mídia do WhatsApp por URL ASSINADA (imagens/áudios/vídeos do chat).
// Inline por padrão (o <img>/<video>/<audio> do painel usa direto); `&dl=1` força download.
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('public/whatsapp-media')
export class PublicWhatsAppMediaController {
  constructor(private readonly media: WhatsAppMediaService) {}

  @Get(':id')
  async download(@Param('id') id: string, @Query('e') e: string, @Query('s') s: string, @Query('dl') dl: string, @Req() req: Request, @Res() res: Response) {
    if (!this.media.verify(id, e, s)) throw new ForbiddenException('Link inválido ou expirado.');
    const m = await this.media.getAny(id);
    const abs = this.media.absPath(m);
    const name = (m.filename || basename(abs)).replace(/[^\w.\-() ]+/g, '_');
    res.setHeader('Content-Type', m.mime);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('Content-Disposition', `${dl === '1' ? 'attachment' : 'inline'}; filename="${name}"`);
    await serveWaFile(abs, req, res);
  }
}
