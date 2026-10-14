import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../platform-billing/access.service';
import { WhatsAppHooks } from '../whatsapp/whatsapp-hooks.service';
import { OrgWebhooksService } from './org-webhooks.service';
import { MAX_DELIVERY_ATTEMPTS, backoffFor } from './webhook-sign.util';

// Entregador dos webhooks de saída (Fase 5, contrato §8.5; revisão de 14/10/2026 — A-3, A-11, A-19).
//  - JUSTIÇA entre webhooks: no máx. PER_HOOK entregas em voo por webhook e GLOBAL_MAX no total; a escolha pega as
//    mais antigas DE CADA webhook (ROW_NUMBER por webhook), então um webhook lento/morto não ocupa a fila dos outros.
//    O tick não espera o lote inteiro: cada entrega libera a vaga quando termina e acorda a próxima escolha.
//  - DISJUNTOR por webhook: BREAKER_AFTER tempos esgotados/erros de rede SEGUIDOS → o webhook fica parado por
//    10 min (dobra a cada reabertura que falha de novo, teto 1 h) e as entregas vencidas dele vão para depois do
//    disjuntor (sem contar tentativa). Sucesso fecha o disjuntor.
//  - 2xx = `delivered` (zera `failures`). Outro status/erro = nova tentativa em +1 min, +5 min, +30 min, +2 h, +6 h;
//    a 6ª falha = `failed`. `failures` do webhook = tentativas com falha SEGUIDAS; o webhook é desligado
//    (`hooks.emit('webhook_disabled')`) com DISABLE_AFTER falhas seguidas OU com DISABLE_DEAD_MIN falhas seguidas e
//    nenhum sucesso nas últimas 24 h ("falhando há mais de 24 h").
//  - Org sem acesso ativo = adia 1 h sem contar tentativa. Entrega pendente com mais de EXPIRE_DAYS dias (org
//    inativa, disjuntor aberto por muito tempo) = `failed` "Expirou". `sending` preso há > 5 min volta para a fila.
//    Poda diária: entregas com mais de 30 dias.
const TICK_MS = 5_000;
const GLOBAL_MAX = 8;
const PER_HOOK = 2;
const PICK_LIMIT = 100;
const STUCK_MS = 5 * 60_000;
const DISABLE_AFTER = 100;
const DISABLE_DEAD_MIN = 10;
const DEAD_MS = 24 * 3600_000;
const KEEP_DAYS = 30;
const EXPIRE_DAYS = 7;
const BREAKER_AFTER = 5;
const BREAKER_BASE_MS = 10 * 60_000;
const BREAKER_MAX_MS = 60 * 60_000;

type Breaker = { streak: number; openUntil: number; openMs: number };

@Injectable()
export class OrgWebhooksWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrgWebhooksWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private soonTimer: NodeJS.Timeout | null = null;
  private picking = false;
  private lastRecover = 0;
  private active = 0;
  private readonly inflight = new Map<string, number>(); // webhook_id → entregas em voo
  private readonly breakers = new Map<string, Breaker>();

  constructor(private readonly prisma: PrismaService, private readonly svc: OrgWebhooksService, private readonly access: AccessService, private readonly hooks: WhatsAppHooks) {}

  onModuleInit() {
    this.svc.onEnqueue(() => this.soon());
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.soonTimer) clearTimeout(this.soonTimer);
  }

  /** Acorda o worker em ~300 ms (agrupa vários disparos seguidos). */
  soon() {
    if (this.soonTimer) return;
    this.soonTimer = setTimeout(() => { this.soonTimer = null; void this.tick(); }, 300);
  }

  private breakerOpen(webhookId: string) {
    const b = this.breakers.get(webhookId);
    return Boolean(b && b.openUntil > Date.now());
  }

  async tick() {
    if (this.picking || this.active >= GLOBAL_MAX) return;
    this.picking = true;
    try {
      if (Date.now() - this.lastRecover > 60_000) {
        this.lastRecover = Date.now();
        await this.prisma.org_webhook_deliveries.updateMany({ where: { status: 'sending', updated_at: { lt: new Date(Date.now() - STUCK_MS) } }, data: { status: 'pending', next_try_at: new Date() } }).catch(() => undefined);
        // A-19: pendente velha demais (org inativa, disjuntor) não fica na fila para sempre
        await this.prisma.org_webhook_deliveries
          .updateMany({ where: { status: 'pending', created_at: { lt: new Date(Date.now() - EXPIRE_DAYS * 86_400_000) } }, data: { status: 'failed', next_try_at: null, last_error: `Expirou: não foi entregue em ${EXPIRE_DAYS} dias.` } })
          .catch(() => undefined);
        for (const [id, b] of this.breakers) if (b.openUntil < Date.now() - BREAKER_MAX_MS && b.streak === 0) this.breakers.delete(id);
      }
      const now = new Date();
      // as mais antigas de CADA webhook (no máx. PER_HOOK por webhook), webhooks diferentes intercalados
      const picks: Array<{ id: string; webhook_id: string }> = await this.prisma.$queryRaw`
        SELECT id, webhook_id FROM (
          SELECT id, webhook_id, next_try_at,
                 ROW_NUMBER() OVER (PARTITION BY webhook_id ORDER BY next_try_at, created_at) AS rn
          FROM org_webhook_deliveries
          WHERE status = 'pending' AND next_try_at IS NOT NULL AND next_try_at <= ${now}
        ) t
        WHERE t.rn <= ${PER_HOOK}
        ORDER BY t.rn, t.next_try_at
        LIMIT ${PICK_LIMIT}`;
      // legado: next_try_at NULL (não deveria existir — o dispatch grava agora)
      if (picks.length < PICK_LIMIT) {
        const legacy = await this.prisma.org_webhook_deliveries.findMany({ where: { status: 'pending', next_try_at: null }, select: { id: true, webhook_id: true }, take: 20 });
        picks.push(...legacy);
      }
      let launched = 0;
      for (const p of picks) {
        if (this.active >= GLOBAL_MAX) break;
        if ((this.inflight.get(p.webhook_id) || 0) >= PER_HOOK || this.breakerOpen(p.webhook_id)) continue;
        const c = await this.prisma.org_webhook_deliveries.updateMany({ where: { id: p.id, status: 'pending' }, data: { status: 'sending' } });
        if (!c.count) continue;
        launched++;
        this.active++;
        this.inflight.set(p.webhook_id, (this.inflight.get(p.webhook_id) || 0) + 1);
        void this.processOne(p.id)
          .catch((e) => this.logger.warn(`entrega ${p.id}: ${e?.message || e}`))
          .finally(() => {
            this.active = Math.max(0, this.active - 1);
            const n = (this.inflight.get(p.webhook_id) || 1) - 1;
            if (n <= 0) this.inflight.delete(p.webhook_id); else this.inflight.set(p.webhook_id, n);
            this.soon(); // vaga livre: escolhe a próxima sem esperar o tick
          });
      }
      if (launched && picks.length >= PICK_LIMIT) this.soon();
    } catch (e: any) {
      this.logger.debug(`webhooks tick: ${e?.message || e}`);
    } finally {
      this.picking = false;
    }
  }

  private async processOne(id: string) {
    const d = await this.prisma.org_webhook_deliveries.findUnique({ where: { id } });
    if (!d || d.status !== 'sending') return;
    const w = await this.prisma.org_webhooks.findUnique({ where: { id: d.webhook_id } });
    if (!w || !w.active) {
      await this.prisma.org_webhook_deliveries.updateMany({ where: { id, status: 'sending' }, data: { status: 'failed', last_error: 'Webhook desativado' } });
      return;
    }
    if (!(await this.access.isOrgActive(d.organization_id))) {
      await this.prisma.org_webhook_deliveries.updateMany({ where: { id, status: 'sending' }, data: { status: 'pending', next_try_at: new Date(Date.now() + 3600_000), last_error: 'Organização sem acesso ativo' } });
      return;
    }
    if (this.breakerOpen(w.id)) {
      const b = this.breakers.get(w.id)!;
      await this.prisma.org_webhook_deliveries.updateMany({ where: { id, status: 'sending' }, data: { status: 'pending', next_try_at: new Date(b.openUntil) } });
      return;
    }
    const r = await this.svc.post(w, d.event, d.id, d.payload);
    const now = new Date();
    if (r.ok) {
      this.breakers.delete(w.id);
      await this.prisma.org_webhook_deliveries.updateMany({ where: { id, status: 'sending' }, data: { status: 'delivered', attempts: Math.min(127, d.attempts + 1), last_status: r.status, last_error: null, duration_ms: r.duration_ms, delivered_at: now, next_try_at: null } });
      await this.prisma.org_webhooks.update({ where: { id: w.id }, data: { failures: 0, last_status: r.status, last_error: null, last_delivery_at: now } }).catch(() => undefined);
      return;
    }
    const attempts = Math.min(127, d.attempts + 1);
    const wait = attempts >= MAX_DELIVERY_ATTEMPTS ? null : backoffFor(attempts);
    const err = (r.error || 'falha').slice(0, 255);
    if (wait !== null) await this.prisma.org_webhook_deliveries.updateMany({ where: { id, status: 'sending' }, data: { status: 'pending', attempts, last_status: r.status, last_error: err, duration_ms: r.duration_ms, next_try_at: new Date(Date.now() + wait) } });
    else await this.prisma.org_webhook_deliveries.updateMany({ where: { id, status: 'sending' }, data: { status: 'failed', attempts, last_status: r.status, last_error: err, duration_ms: r.duration_ms, next_try_at: null } });

    // A-3: tempo esgotado / erro de rede seguidos abrem o disjuntor deste webhook
    if (r.status == null) await this.noteNetworkFailure(w.id, w.organization_id);
    else { const b = this.breakers.get(w.id); if (b) b.streak = 0; }

    // A-11: falhas SEGUIDAS (por tentativa) e "falhando há mais de 24 h"
    const upd = await this.prisma.org_webhooks.update({ where: { id: w.id }, data: { failures: { increment: 1 }, last_status: r.status, last_error: err } }).catch(() => null);
    if (!upd) return;
    const lastOk = upd.last_delivery_at ? new Date(upd.last_delivery_at).getTime() : new Date(upd.created_at).getTime();
    const dead = upd.failures >= DISABLE_DEAD_MIN && Date.now() - lastOk > DEAD_MS;
    if (upd.failures >= DISABLE_AFTER || dead) {
      const why = dead ? `sem nenhuma entrega com sucesso há mais de 24 h (${upd.failures} falhas seguidas)` : `${upd.failures} falhas seguidas`;
      const off = await this.prisma.org_webhooks.updateMany({ where: { id: w.id, active: true }, data: { active: false, last_error: `Desativado: ${why}. Último erro: ${err}`.slice(0, 255) } });
      if (off.count) {
        this.svc.invalidate(w.organization_id);
        this.breakers.delete(w.id);
        this.logger.warn(`webhook ${w.id} (org ${w.organization_id}) desativado: ${why}`);
        this.hooks.emit('webhook_disabled', { orgId: w.organization_id, webhook_id: w.id, name: w.name, url: w.url, error: err });
      }
    }
  }

  private async noteNetworkFailure(webhookId: string, orgId: string) {
    const b = this.breakers.get(webhookId) || { streak: 0, openUntil: 0, openMs: 0 };
    b.streak++;
    this.breakers.set(webhookId, b);
    if (b.streak < BREAKER_AFTER) return;
    // reabriu e falhou de novo: dobra o tempo parado (teto 1 h)
    b.openMs = b.openMs ? Math.min(BREAKER_MAX_MS, b.openMs * 2) : BREAKER_BASE_MS;
    b.openUntil = Date.now() + b.openMs;
    b.streak = 0;
    const until = new Date(b.openUntil);
    this.logger.warn(`webhook ${webhookId} (org ${orgId}): ${BREAKER_AFTER} falhas de rede seguidas — pausado até ${until.toISOString()}`);
    await this.prisma.org_webhook_deliveries.updateMany({ where: { webhook_id: webhookId, status: 'pending', next_try_at: { lt: until } }, data: { next_try_at: until } }).catch(() => undefined);
  }

  /** Poda diária (04:20 BRT = 07:20 UTC): entregas com mais de 30 dias, em lotes. */
  @Cron('0 20 7 * * *')
  async prune() {
    const before = new Date(Date.now() - KEEP_DAYS * 24 * 3600_000);
    let total = 0;
    for (let i = 0; i < 200; i++) {
      const ids = await this.prisma.org_webhook_deliveries.findMany({ where: { created_at: { lt: before }, status: { in: ['delivered', 'failed'] } }, select: { id: true }, take: 1000 });
      if (!ids.length) break;
      const r = await this.prisma.org_webhook_deliveries.deleteMany({ where: { id: { in: ids.map((x) => x.id) } } });
      total += r.count;
    }
    if (total) this.logger.log(`webhooks: ${total} entrega(s) antigas removidas`);
    return total;
  }
}
