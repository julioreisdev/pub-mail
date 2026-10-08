import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as webPush from 'web-push';

// =============================================================================
// Web Push (VAPID). Chaves em env: WEB_PUSH_VAPID_PUBLIC_KEY / WEB_PUSH_VAPID_PRIVATE_KEY /
// WEB_PUSH_SUBJECT (mailto: ou https://). Sem as chaves o push fica desligado — os avisos
// no painel (WebSocket) continuam funcionando.
// Gerar (no servidor, nunca imprimir a privada no chat):
//   node -e "const w=require('web-push');const k=w.generateVAPIDKeys();console.log(k.publicKey);console.log(k.privateKey)"
// =============================================================================

export type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };
export type PushResult = { ok: true } | { ok: false; gone: boolean; status: number | null; error: string };

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  readonly publicKey = String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || '').trim();
  private readonly privateKey = String(process.env.WEB_PUSH_VAPID_PRIVATE_KEY || '').trim();
  private readonly subject = String(process.env.WEB_PUSH_SUBJECT || 'mailto:julioreisdev@gmail.com').trim();
  readonly enabled = Boolean(this.publicKey && this.privateKey);

  onModuleInit() {
    if (this.enabled) {
      try {
        webPush.setVapidDetails(this.subject, this.publicKey, this.privateKey);
        this.logger.log('Web Push: LIGADO');
      } catch (e: any) {
        this.logger.error(`Web Push: chaves VAPID inválidas (${e?.message || e}) — push desligado`);
        (this as any).enabled = false;
      }
    } else this.logger.log('Web Push: desligado (sem WEB_PUSH_VAPID_*)');
  }

  /** Entrega um push. `gone` = aparelho desinscreveu (404/410) → apagar a inscrição. */
  async send(sub: PushSub, payload: Record<string, unknown>, opts: { ttl?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high'; topic?: string } = {}): Promise<PushResult> {
    if (!this.enabled) return { ok: false, gone: false, status: null, error: 'push desligado' };
    try {
      await webPush.sendNotification(sub, JSON.stringify(payload), {
        TTL: opts.ttl ?? 6 * 3600,
        urgency: opts.urgency || 'normal',
        ...(opts.topic ? { topic: opts.topic.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) } : {}),
      });
      return { ok: true };
    } catch (e: any) {
      const status = Number(e?.statusCode) || null;
      return { ok: false, gone: status === 404 || status === 410, status, error: String(e?.body || e?.message || e).slice(0, 200) };
    }
  }
}
