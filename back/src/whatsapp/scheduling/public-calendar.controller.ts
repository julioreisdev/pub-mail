import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../auth/public.decorator';
import { WhatsAppSchedulingService } from './whatsapp-scheduling.service';

// Feed iCalendar de um recurso (Google Agenda / Apple / Outlook assinam a URL e releem sozinhos).
// `GET /public/calendar/<token>.ics` — token aleatório do recurso (girar = link antigo para de funcionar).
// Sem dados sensíveis: só primeiro nome do cliente + serviço.
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('public/calendar')
export class PublicCalendarController {
  constructor(private readonly svc: WhatsAppSchedulingService) {}

  @Get(':file')
  async feed(@Param('file') file: string, @Res() res: Response) {
    const token = String(file || '').replace(/\.ics$/i, '');
    const feed = await this.svc.icsFeed(token);
    if (!feed) throw new NotFoundException('Calendário não encontrado.');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Content-Disposition', `inline; filename="${feed.name.replace(/[^\w.\- ]+/g, '_') || 'agenda'}.ics"`);
    res.send(feed.body);
  }
}
