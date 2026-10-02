import { Body, Controller, Headers, HttpCode, Logger, Param, Post, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { createHmac, timingSafeEqual } from 'crypto';
import { Public } from '../auth/public.decorator';
import { WhatsAppSessionsService } from './whatsapp-sessions.service';
import { WhatsAppInboundService } from './whatsapp-inbound.service';
import { WhatsAppBootstrapService } from './whatsapp-bootstrap.service';
import { WhatsAppContactStatusesService } from './whatsapp-contact-statuses.service';

// Receptor dos eventos do OpenWA (um webhook por sessão: /webhooks/whatsapp/<id da linha>).
// - assinatura HMAC-SHA256 do OpenWA sobre o corpo bruto (`X-OpenWA-Signature: sha256=<hex>`)
//   com o segredo daquela sessão (gerado por nós);
// - idempotência por `X-OpenWA-Idempotency-Key` (unique em whatsapp_session_events);
// - ACK 200 imediato e processamento em background (igual ao webhook do Telegram).
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);
  // Fila por sessão: eventos do mesmo número são processados em ORDEM (mensagem antes do ack/reação/edição).
  private readonly queues = new Map<string, Promise<void>>();

  constructor(
    private readonly sessions: WhatsAppSessionsService,
    private readonly inbound: WhatsAppInboundService,
    private readonly bootstrap: WhatsAppBootstrapService,
    private readonly contactStatuses: WhatsAppContactStatusesService,
  ) {}

  private verify(secret: string, raw: Buffer | undefined, header: string | undefined) {
    if (!raw || !header) return false;
    const given = String(header).replace(/^sha256=/i, '').trim();
    const calc = createHmac('sha256', secret).update(raw).digest('hex');
    if (given.length === calc.length && /^[0-9a-f]+$/i.test(given)) {
      return timingSafeEqual(Buffer.from(given.toLowerCase(), 'utf8'), Buffer.from(calc, 'utf8'));
    }
    // alguns emissores mandam base64
    const calcB64 = createHmac('sha256', secret).update(raw).digest('base64');
    return given.length === calcB64.length && timingSafeEqual(Buffer.from(given, 'utf8'), Buffer.from(calcB64, 'utf8'));
  }

  @Post(':rowId')
  @HttpCode(200)
  async receive(
    @Param('rowId') rowId: string,
    @Headers('x-openwa-signature') signature: string,
    @Headers('x-openwa-idempotency-key') idem: string,
    @Headers('x-openwa-event') eventHeader: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    const row = await this.sessions.findByRowId(rowId).catch(() => null);
    if (!row?.webhook_secret) return { ok: false };
    if (!this.verify(row.webhook_secret, req.rawBody, signature)) {
      this.logger.warn(`assinatura inválida no webhook da sessão ${rowId}`);
      return { ok: false };
    }
    const event = String(body?.event || eventHeader || '').slice(0, 48);
    if (!event) return { ok: true };
    const key = idem || body?.idempotencyKey || null;

    const prev = this.queues.get(rowId) || Promise.resolve();
    const next = prev
      .catch(() => undefined)
      .then(() => this.process(row, event, body?.data ?? body, key))
      .catch((e) => this.logger.warn(`webhook ${rowId} ${event} falhou: ${e?.message || e} ${e?.code || ''}`));
    this.queues.set(rowId, next);
    next.finally(() => { if (this.queues.get(rowId) === next) this.queues.delete(rowId); });
    return { ok: true };
  }

  private async process(row: any, event: string, data: any, key: string | null) {
    const isSession = event.startsWith('session.');
    // Eventos de mensagem NÃO vão pro log de sessão (volume); a idempotência deles é por wa_message_id.
    if (isSession) {
      const fresh = await this.sessions.logEvent(row, event, data, key);
      if (!fresh) return; // reentrega
      await this.sessions.applyEvent(row, event, data);
      if (event === 'session.authenticated' || (event === 'session.status' && data?.status === 'ready')) {
        const fresh = await this.sessions.findByRowId(row.id);
        if (fresh?.status === 'ready') this.bootstrap.maybeRun(fresh);
      }
      return;
    }
    const orgId = row.organization_id;
    switch (event) {
      case 'message.received': await this.inbound.onMessage(row, data, false); break;
      case 'message.sent': await this.inbound.onMessage(row, data, true); break;
      case 'message.ack':
      case 'message.failed': await this.inbound.onAck(orgId, data); break;
      case 'message.revoked': await this.inbound.onRevoked(orgId, data); break;
      case 'message.reaction': await this.inbound.onReaction(orgId, data, (row.settings as any)?.own_lid || (row.phone ? `${row.phone}@c.us` : null)); break;
      case 'message.edited': await this.inbound.onEdited(orgId, data); break;
      case 'group.join': case 'group.leave': case 'group.update': case 'group.join_request': await this.inbound.onGroupEvent(orgId, event, data); break;
      case 'status.received': await this.contactStatuses.ingest(orgId, row, data); break;
      default: break; // call.*, presence: ignorados por ora
    }
    await this.sessions.touchEvent(row.id).catch(() => undefined);
  }
}
