import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';

type SvixHeaders = {
  id?: string;
  timestamp?: string;
  signature?: string;
};

@Injectable()
export class ResendWebhooksService {
  private readonly logger = new Logger(ResendWebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettings: SystemSettingsService,
  ) {}

  // ------------------------------------------------------------- Svix verify
  // Resend assina os webhooks via Svix. A assinatura é HMAC-SHA256 sobre
  // `${svix-id}.${svix-timestamp}.${rawBody}`, com a chave = base64decode do
  // segredo (sem o prefixo whsec_). O header svix-signature traz uma ou mais
  // assinaturas "v1,<base64>" separadas por espaço.
  private verify(secret: string, h: SvixHeaders, rawBody: string): boolean {
    if (!h.id || !h.timestamp || !h.signature) return false;

    const ts = Number(h.timestamp);
    if (!Number.isFinite(ts)) return false;
    // tolerância de 5 min contra replay
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > 60 * 5) return false;

    let secretBytes: Buffer;
    try {
      secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    } catch {
      return false;
    }

    const signedContent = `${h.id}.${h.timestamp}.${rawBody}`;
    const expected = crypto
      .createHmac('sha256', secretBytes)
      .update(signedContent)
      .digest('base64');
    const expectedBuf = Buffer.from(expected);

    return h.signature.split(' ').some((part) => {
      const comma = part.indexOf(',');
      const sig = comma >= 0 ? part.slice(comma + 1) : part;
      if (!sig) return false;
      const sigBuf = Buffer.from(sig);
      if (sigBuf.length !== expectedBuf.length) return false;
      try {
        return crypto.timingSafeEqual(sigBuf, expectedBuf);
      } catch {
        return false;
      }
    });
  }

  // ------------------------------------------------------------- extractors
  private dispatchIdOf(data: any): string | null {
    const t = data?.tags;
    if (!t) return null;
    if (Array.isArray(t)) {
      const f = t.find((x: any) => x?.name === 'dispatch_id');
      return f?.value ? String(f.value) : null;
    }
    if (typeof t === 'object' && t.dispatch_id) return String(t.dispatch_id);
    return null;
  }

  private recipientsOf(data: any): string[] {
    const to = data?.to;
    if (!to) return [];
    const arr = Array.isArray(to) ? to : [to];
    return arr
      .map((x: any) => String(x || '').trim())
      .filter((x: string) => x.length > 0);
  }

  // Resend manda email.bounced para bounces reais. Bounce "Transient/soft" não
  // deve suprimir; qualquer outro (Permanent/hard, ou sem tipo) suprime.
  private isHardBounce(data: any): boolean {
    const b = data?.bounce || {};
    const type = String(b.type || data?.bounce_type || '').toLowerCase();
    if (type.includes('transient') || type.includes('soft')) return false;
    return true;
  }

  private async incr(
    dispatchId: string,
    field: 'delivered_count' | 'bounced_count' | 'complained_count',
  ) {
    try {
      await this.prisma.email_projects_schedules_sent.update({
        where: { id: dispatchId },
        data: { [field]: { increment: 1 } } as any,
      });
    } catch {
      // dispatch pode não existir (ex.: envio fora do fluxo) — ignora
    }
  }

  // Supressão global por endereço (a conta Resend é única na plataforma): um
  // hard-bounce/reclamação vale para todos os projetos daquele e-mail. O disparo
  // já filtra global_status=ACTIVE, então isso remove o lead dos próximos envios.
  private async suppress(
    organizationId: string,
    recipients: string[],
    status: 'BOUNCED' | 'COMPLAINED',
  ) {
    if (recipients.length === 0) return 0;
    const res = await this.prisma.email_leads.updateMany({
      where: { organization_id: organizationId, email: { in: recipients }, global_status: 'ACTIVE' },
      data: { global_status: status as any },
    });
    return res.count;
  }

  // ------------------------------------------------------------- handler
  async handle(headers: Record<string, any>, rawBody: string, body: any) {
    // A org dona do evento vem da tag dispatch_id (sent row) — cada org tem seu próprio
    // Resend + Signing Secret, então a assinatura é verificada com o segredo DAQUELA org.
    const dispatchIdEarly = this.dispatchIdOf(body?.data || {});
    const sent = dispatchIdEarly
      ? await this.prisma.email_projects_schedules_sent
          .findUnique({ where: { id: dispatchIdEarly }, select: { organization_id: true } })
          .catch(() => null)
      : null;
    if (!sent) {
      this.logger.warn('Webhook do Resend sem dispatch_id conhecido — ignorando.');
      return { ok: false, reason: 'unknown_dispatch' };
    }
    const organizationId = sent.organization_id;
    const secret = await this.systemSettings.getResendWebhookSecret(organizationId);
    if (!secret) {
      this.logger.warn(
        `Webhook do Resend recebido, mas a org ${organizationId} não tem resend_webhook_secret — ignorando.`,
      );
      return { ok: false, reason: 'webhook_secret_not_configured' };
    }

    const h: SvixHeaders = {
      id: headers['svix-id'],
      timestamp: headers['svix-timestamp'],
      signature: headers['svix-signature'],
    };

    if (!this.verify(secret, h, rawBody)) {
      throw new UnauthorizedException('Assinatura do webhook inválida.');
    }

    // idempotência via svix-id
    if (h.id) {
      try {
        await this.prisma.email_webhook_events.create({ data: { id: String(h.id) } });
      } catch (e: any) {
        if (e?.code === 'P2002') return { ok: true, duplicate: true };
        // falha inesperada ao gravar idempotência: loga e segue processando
        this.logger.warn(`Falha ao registrar svix-id ${h.id}: ${e?.message}`);
      }
    }

    const type = String(body?.type || '');
    const data = body?.data || {};
    const dispatchId = this.dispatchIdOf(data);
    const recipients = this.recipientsOf(data);

    let suppressed = 0;
    switch (type) {
      case 'email.delivered':
        if (dispatchId) await this.incr(dispatchId, 'delivered_count');
        break;
      case 'email.bounced':
        if (dispatchId) await this.incr(dispatchId, 'bounced_count');
        if (this.isHardBounce(data)) suppressed = await this.suppress(organizationId, recipients, 'BOUNCED');
        break;
      case 'email.complained':
        if (dispatchId) await this.incr(dispatchId, 'complained_count');
        suppressed = await this.suppress(organizationId, recipients, 'COMPLAINED');
        break;
      default:
        // sent / delivery_delayed / opened / clicked etc. — não tratados aqui
        break;
    }

    this.logger.log(
      `[resend-webhook] type=${type} dispatch=${dispatchId ?? '-'} recipients=${recipients.length} suppressed=${suppressed}`,
    );
    return { ok: true, type, suppressed };
  }
}
