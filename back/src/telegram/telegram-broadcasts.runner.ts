import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import * as tg from './telegram-api.util';
import { noteFlood, clearFlood } from './telegram-flood.util';

const RATE_PER_BOT = 25; // mensagens/seg por bot
const MSG_INTERVAL_MS = Math.ceil(1000 / RATE_PER_BOT);
const BATCH = 200;
const CONCURRENCY = 40;
const MAX_ATTEMPTS = 5;

// minuto-do-dia (0..1439) em América/São_Paulo (BRT) — igual ao módulo de e-mail.
function brtMinuteOfDay(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hh = Number(parts.find((p) => p.type === 'hour')?.value || 0) % 24;
  const mm = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  return hh * 60 + mm;
}

@Injectable()
export class TelegramBroadcastsRunner implements OnModuleInit {
  private readonly logger = new Logger(TelegramBroadcastsRunner.name);
  private dispatching = false;
  private working = false;
  private botNextAt = new Map<string, number>();
  private botCooldown = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Worker contínuo (não bloqueia o boot).
    this.loop().catch((e) => this.logger.error(`worker morreu: ${e?.message || e}`));
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // Interpola variáveis do contato ({{nome}} etc). Em grupos/canais (sem contato) → vazio.
  private interpolate(text: string, info: any): string {
    const i = info || {};
    return String(text || '')
      .replace(/\{\{\s*(nome|name|first_name)\s*\}\}/gi, i.first_name || '')
      .replace(/\{\{\s*(sobrenome|last_name)\s*\}\}/gi, i.last_name || '')
      .replace(/\{\{\s*username\s*\}\}/gi, i.username ? `@${i.username}` : '')
      .replace(/\{\{\s*(start_param|param|origem)\s*\}\}/gi, i.start_param || '');
  }

  // ---------------- DISPATCHER (cron a cada minuto) ----------------
  @Cron(CronExpression.EVERY_MINUTE)
  async dispatch() {
    if (this.dispatching) return;
    this.dispatching = true;
    try {
      const minute = brtMinuteOfDay();
      const runAt = new Date();
      runAt.setSeconds(0, 0);
      const bcs = await this.prisma.telegram_broadcasts.findMany({ where: { active: true } });
      for (const b of bcs) {
        const times = Array.isArray(b.times) ? (b.times as any[]) : [];
        if (!times.includes(minute)) continue;
        await this.fire(b, runAt).catch((e) => this.logger.warn(`fire broadcast ${b.id} falhou: ${e?.message || e}`));
      }
    } catch (e: any) {
      this.logger.error(`dispatch falhou: ${e?.message || e}`);
    } finally {
      this.dispatching = false;
    }
  }

  // Cria a run + enfileira os sends (idempotente por minuto).
  async fire(b: any, runAt: Date) {
    const copies = await this.prisma.telegram_broadcast_copies.findMany({
      where: { broadcast_id: b.id },
      orderBy: { position: 'asc' },
    });
    if (!copies.length) return;

    const idx = b.mode === 'random' ? Math.floor(Math.random() * copies.length) : (b.last_copy_index || 0) % copies.length;
    const copy = copies[idx];

    let run: any;
    try {
      run = await this.prisma.telegram_broadcast_runs.create({
        data: {
          organization_id: b.organization_id,
          broadcast_id: b.id,
          copy_id: copy.id,
          messages: copy.messages as any,
          run_at: runAt,
          status: 'SENDING',
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') return; // já disparado neste minuto
      throw e;
    }

    if (b.mode !== 'random') {
      await this.prisma.telegram_broadcasts
        .update({ where: { id: b.id }, data: { last_copy_index: (idx + 1) % copies.length } })
        .catch(() => undefined);
    }

    // resolve audiência
    const targets: any = b.targets || {};
    const botIds: string[] = Array.isArray(b.bot_ids) ? b.bot_ids : [];
    const sends: any[] = [];

    if (targets.dms && botIds.length) {
      const contacts = await this.prisma.telegram_contacts.findMany({
        where: { organization_id: b.organization_id, bot_id: { in: botIds } },
        select: { id: true, bot_id: true, tg_user_id: true },
      });
      for (const c of contacts) {
        sends.push({ target_kind: 'CONTACT', tg_chat_id: c.tg_user_id, contact_id: c.id, group_id: null, bot_id: c.bot_id });
      }
    }
    const chatIds: string[] = [...(targets.group_ids || []), ...(targets.channel_ids || [])];
    if (chatIds.length) {
      const grows = await this.prisma.telegram_groups.findMany({
        where: { id: { in: chatIds }, organization_id: b.organization_id },
        select: { id: true, bot_id: true, tg_chat_id: true, type: true },
      });
      for (const g of grows) {
        sends.push({
          target_kind: g.type === 'channel' ? 'CHANNEL' : 'GROUP',
          tg_chat_id: g.tg_chat_id,
          contact_id: null,
          group_id: g.id,
          bot_id: g.bot_id,
        });
      }
    }

    const rows = sends.map((s) => ({
      organization_id: b.organization_id,
      broadcast_id: b.id,
      run_id: run.id,
      bot_id: s.bot_id,
      target_kind: s.target_kind,
      tg_chat_id: s.tg_chat_id,
      contact_id: s.contact_id,
      group_id: s.group_id,
    }));
    for (let i = 0; i < rows.length; i += 1000) {
      await this.prisma.telegram_broadcast_sends.createMany({ data: rows.slice(i, i + 1000) as any });
    }
    await this.prisma.telegram_broadcast_runs.update({
      where: { id: run.id },
      data: { total: rows.length, status: rows.length ? 'SENDING' : 'DONE' },
    });

    if (b.delete_used) {
      await this.prisma.telegram_broadcast_copies.delete({ where: { id: copy.id } }).catch(() => undefined);
    }
    this.logger.log(`broadcast ${b.name} → ${rows.length} destinatários enfileirados.`);
  }

  // ---------------- WORKER (loop contínuo) ----------------
  private async loop() {
    // pequeno atraso no boot
    await this.sleep(4000);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const raw = await this.prisma.telegram_broadcast_sends.findMany({
          where: { status: 'PENDING' },
          orderBy: { id: 'asc' },
          take: BATCH,
        });
        if (!raw.length) {
          await this.sleep(2500);
          continue;
        }
        // Pula sends de bots em flood-wait: deixa-os PENDING e NÃO bloqueia o worker (nem
        // hammera o Telegram). Assim um bot floodado não trava os outros. Volta a processá-los
        // sozinho quando o cooldown expira.
        const batch = raw.filter((s) => !this.cooling(s.bot_id));
        if (!batch.length) {
          await this.sleep(2500);
          continue;
        }
        await this.processBatch(batch);
      } catch (e: any) {
        this.logger.warn(`loop tick falhou: ${e?.message || e}`);
        await this.sleep(2000);
      }
    }
  }

  // true = bot em flood-wait; não deve receber chamada nem "typing" agora.
  private cooling(botId: string): boolean {
    return Date.now() < (this.botCooldown.get(botId) || 0);
  }

  private async gate(botId: string) {
    const now = Date.now();
    const cd = this.botCooldown.get(botId) || 0;
    const na = Math.max(now, this.botNextAt.get(botId) || 0, cd);
    this.botNextAt.set(botId, na + MSG_INTERVAL_MS);
    const wait = na - now;
    if (wait > 0) await this.sleep(wait);
  }

  private async processBatch(batch: any[]) {
    const runCache = new Map<string, any>();
    const botCache = new Map<string, string | null>();

    const getRunMessages = async (runId: string) => {
      if (runCache.has(runId)) return runCache.get(runId);
      const r = await this.prisma.telegram_broadcast_runs.findUnique({ where: { id: runId }, select: { messages: true } });
      const msgs = Array.isArray(r?.messages) ? (r!.messages as any[]) : [];
      runCache.set(runId, msgs);
      return msgs;
    };
    const getToken = async (botId: string): Promise<string | null> => {
      if (botCache.has(botId)) return botCache.get(botId) ?? null;
      const bot = await this.prisma.telegram_bots.findUnique({ where: { id: botId }, select: { token: true, status: true } });
      const token = bot && bot.status !== 'BANNED' ? bot.token : null;
      botCache.set(botId, token);
      return token;
    };

    // info dos contatos p/ interpolar {{nome}}/{{sobrenome}}/{{username}}/{{origem}}
    const contactMap = new Map<string, any>();
    const contactIds = [...new Set(batch.filter((s) => s.contact_id).map((s) => s.contact_id))];
    if (contactIds.length) {
      const cs = await this.prisma.telegram_contacts.findMany({
        where: { id: { in: contactIds } },
        select: { id: true, first_name: true, last_name: true, username: true, attributes: true },
      });
      for (const c of cs) {
        contactMap.set(c.id, {
          first_name: c.first_name || '',
          last_name: c.last_name || '',
          username: c.username || '',
          start_param: (c.attributes as any)?.start_param || '',
        });
      }
    }

    let i = 0;
    const worker = async () => {
      while (i < batch.length) {
        const s = batch[i++];
        try {
          await this.sendOne(s, getRunMessages, getToken, contactMap);
        } catch (e: any) {
          this.logger.warn(`send ${s.id} erro: ${e?.message || e}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batch.length) }, worker));

    // reconcilia métricas das runs tocadas
    const runIds = [...new Set(batch.map((s) => s.run_id))];
    for (const rid of runIds) {
      const grouped = await this.prisma.telegram_broadcast_sends.groupBy({
        by: ['status'],
        where: { run_id: rid },
        _count: { _all: true },
      });
      const c: any = {};
      grouped.forEach((g: any) => (c[g.status] = g._count._all));
      const pending = c.PENDING || 0;
      await this.prisma.telegram_broadcast_runs
        .update({
          where: { id: rid },
          data: { sent: c.DONE || 0, failed: c.FAILED || 0, blocked: c.BLOCKED || 0, status: pending > 0 ? 'SENDING' : 'DONE' },
        })
        .catch(() => undefined);
    }
  }

  private async setSend(id: string, status: string, patch: any = {}) {
    await this.prisma.telegram_broadcast_sends
      .update({ where: { id }, data: { status: status as any, ...patch } })
      .catch(() => undefined);
  }

  private async sendOne(
    s: any,
    getRunMessages: (id: string) => Promise<any[]>,
    getToken: (id: string) => Promise<string | null>,
    contactMap: Map<string, any>,
  ) {
    if (this.cooling(s.bot_id)) return; // bot em flood-wait → deixa PENDING, sem "typing" nem envio
    const token = await getToken(s.bot_id);
    if (!token) {
      await this.setSend(s.id, 'FAILED', { last_error: 'Bot indisponível/banido.' });
      return;
    }
    const info = s.contact_id ? contactMap.get(s.contact_id) || {} : {};
    const messages = (await getRunMessages(s.run_id)).filter(
      (m) => (m?.text && String(m.text).trim()) || (m?.media && m.media.url) || (Array.isArray(m?.buttons) && m.buttons.length),
    );
    if (!messages.length) {
      await this.setSend(s.id, 'DONE', { sent_at: new Date() });
      return;
    }

    for (const m of messages) {
      await this.gate(s.bot_id);
      const media = m.media;
      const caption = this.interpolate(String(m.text || ''), info);
      const rows: any[] = [];
      for (const btn of Array.isArray(m.buttons) ? m.buttons : []) {
        if (btn?.plan_id) rows.push([{ text: btn.label || 'Comprar', callback_data: `pay:${btn.plan_id}` }]);
        else if (btn?.url) rows.push([{ text: btn.label || 'Abrir', url: btn.url }]);
      }
      const extra = rows.length ? { reply_markup: { inline_keyboard: rows } } : {};
      let r: any;
      if (media && media.url && media.type) {
        const action = media.type === 'voice' ? 'record_voice' : media.type === 'video' ? 'upload_video' : 'upload_photo';
        await tg.sendChatAction(token, String(s.tg_chat_id), action).catch(() => undefined);
        r = await tg.sendMediaUrl(token, String(s.tg_chat_id), media.type, media.url, caption || undefined, extra);
      } else {
        await tg.sendChatAction(token, String(s.tg_chat_id), 'typing').catch(() => undefined);
        r = await tg.sendMessage(token, String(s.tg_chat_id), caption || '…', extra);
      }

      if (!r.ok) {
        if (r.error_code === 429) {
          // Honra o retry_after REAL do Telegram (pode ser horas em flood). Sem ele, 30s.
          const retry = Math.min(Number(r?.parameters?.retry_after) || 30, 6 * 3600);
          this.botCooldown.set(s.bot_id, Date.now() + retry * 1000);
          await noteFlood(this.prisma, s.bot_id, r); // marca no card do bot (aviso no front)
          this.logger.warn(`broadcast: bot ${s.bot_id} em flood-wait ${retry}s (429).`);
          return; // fica PENDING, tenta de novo depois
        }
        if (r.error_code === 403) {
          await this.setSend(s.id, 'BLOCKED', { last_error: r.description || 'Bloqueado.' });
          return;
        }
        if (r.unauthorized) {
          await this.setSend(s.id, 'FAILED', { last_error: 'Token inválido.' });
          return;
        }
        const attempts = (s.attempts || 0) + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await this.setSend(s.id, 'FAILED', { last_error: r.description || 'Falha.', attempts });
        } else {
          await this.setSend(s.id, 'PENDING', { attempts, last_error: r.description || 'Falha (retry).' });
        }
        return;
      }

      // log OUT (aparece nas DMs)
      let fileId: string | null = null;
      if (media?.type === 'photo') fileId = Array.isArray(r.result?.photo) ? r.result.photo[r.result.photo.length - 1]?.file_id : null;
      else if (media?.type) fileId = r.result?.[media.type]?.file_id || null;
      await this.logOut(s, caption, media, r.result?.message_id, fileId);

      if (m.delay_seconds) await this.sleep(Math.min(10, Math.max(0, Number(m.delay_seconds))) * 1000);
    }

    // enviou com sucesso → se o bot estava marcado em flood, limpa o aviso do card.
    if (this.botCooldown.has(s.bot_id)) {
      this.botCooldown.delete(s.bot_id);
      await clearFlood(this.prisma, s.bot_id);
    }
    await this.setSend(s.id, 'DONE', { sent_at: new Date() });
  }

  private async logOut(s: any, text: string, media: any, msgId?: number, fileId?: string | null) {
    const preview = media
      ? `${{ photo: '📷 Foto', video: '🎬 Vídeo', voice: '🎤 Áudio', document: '📎 Arquivo' }[media.type] || ''} ${text}`.trim()
      : text;
    await this.prisma.telegram_messages
      .create({
        data: {
          organization_id: s.organization_id,
          bot_id: s.bot_id,
          chat_kind: s.target_kind === 'CONTACT' ? 'CONTACT' : 'GROUP',
          contact_id: s.contact_id || null,
          group_id: s.group_id || null,
          tg_chat_id: s.tg_chat_id,
          direction: 'OUT',
          tg_message_id: msgId ? BigInt(msgId) : null,
          text: text || null,
          media_type: media?.type || null,
          media_file_id: fileId || null,
        },
      })
      .catch(() => undefined);
    // atualiza prévia
    if (s.contact_id) {
      await this.prisma.telegram_contacts
        .update({ where: { id: s.contact_id }, data: { last_message_text: (preview || '').slice(0, 500), last_message_at: new Date(), last_message_dir: 'OUT' } })
        .catch(() => undefined);
    } else if (s.group_id) {
      await this.prisma.telegram_groups
        .update({ where: { id: s.group_id }, data: { last_message_text: `Você: ${preview || ''}`.slice(0, 500), last_message_at: new Date() } })
        .catch(() => undefined);
    }
  }

  // "Disparar agora" (manual). Reusa o fire com o minuto atual.
  async fireNow(orgId: string, broadcastId: string) {
    const b = await this.prisma.telegram_broadcasts.findFirst({ where: { id: broadcastId, organization_id: orgId } });
    if (!b) return { ok: false };
    // usa o segundo atual (não zera) p/ não colidir com a run agendada do minuto.
    const runAt = new Date();
    runAt.setMilliseconds(0);
    await this.fire(b, runAt);
    return { ok: true };
  }
}
