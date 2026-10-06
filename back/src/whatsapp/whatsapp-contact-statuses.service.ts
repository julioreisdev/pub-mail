import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OpenWaClient, OpenWaError } from './openwa.client';
import { WhatsAppMediaService, kindOfMime } from './whatsapp-media.service';
import { WhatsAppSessionsService, SessionRow } from './whatsapp-sessions.service';
import { WhatsAppContactsService } from './whatsapp-contacts.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { WhatsAppInboundService } from './whatsapp-inbound.service';
import { WhatsAppAttendanceService } from './whatsapp-attendance.service';
import { normJid, phoneFromJid } from './wa-jid.util';

// Status (stories) dos CONTATOS, vistos por cada NÚMERO da organização: chegam pelo webhook
// `status.received` (sessão do webhook) e também são sincronizados do store do gateway
// (GET /sessions/:id/status) número a número. Guardamos 24 h + 1 dia (a mídia vai para a pasta
// protegida com a mesma validade). O usuário vê, marca como visto (só no Pub Mail), responde
// (mensagem na conversa do contato PELO MESMO número) e reage.
// Unique: (org, session_id, wa_status_id) — o mesmo status pode ser visto por 2 números.
@Injectable()
export class WhatsAppContactStatusesService {
  private readonly logger = new Logger(WhatsAppContactStatusesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openwa: OpenWaClient,
    private readonly media: WhatsAppMediaService,
    private readonly sessions: WhatsAppSessionsService,
    private readonly contacts: WhatsAppContactsService,
    private readonly presenter: WhatsAppPresenter,
    private readonly inbound: WhatsAppInboundService,
    private readonly attendance: WhatsAppAttendanceService,
  ) {}

  // ---------------------------------------------------------------- entrada (webhook / sync)
  /** Guarda um status visto por UM número (`row` = linha da sessão). Idempotente por (número, wa_status_id). */
  async ingest(row: SessionRow, s: any) {
    if (!row?.id || !row.organization_id) return null;
    const orgId: string = row.organization_id;
    const sessionId: string = row.id;
    const waId = String(s?.statusId || s?.id || '');
    const jid = normJid(String(s?.contact?.id || s?.contactJid || ''));
    if (!waId || !jid || /@(g\.us|broadcast|newsletter)$/.test(jid)) return null;
    const existing = await this.prisma.whatsapp_contact_statuses.findUnique({ where: { organization_id_session_id_wa_status_id: { organization_id: orgId, session_id: sessionId, wa_status_id: waId.slice(0, 191) } } });
    if (existing) return existing;
    const posted = new Date(s?.postedAt || s?.timestamp || Date.now());
    const expires = new Date(s?.expiresAt || posted.getTime() + 86_400_000);
    if (expires.getTime() < Date.now()) return null;
    const chatId = await this.contacts.canonicalChatId(orgId, row, jid).catch(() => jid);
    const name = s?.contact?.name || s?.contact?.pushName || null;
    const type = ['text', 'image', 'video', 'voice'].includes(String(s?.type)) ? String(s.type) : 'text';
    let mediaId: string | null = null;
    let omitted = Boolean(s?.mediaOmitted);
    const wantsMedia = type !== 'text' && (s?.hasMedia || s?.mediaUrl || (!s?.mediaOmitted && type !== 'text'));
    if (wantsMedia && row.openwa_session_id) {
      this.openwa.remember(row.openwa_session_id, row.engine);
      try {
        const r = await this.openwa.statusMediaFile(row.openwa_session_id, waId);
        if (r?.buffer?.length) {
          const m = await this.media.store(orgId, r.buffer, r.mime, null, type === 'voice' ? 'voice' : kindOfMime(r.mime));
          await this.prisma.whatsapp_media.update({ where: { id: m.id }, data: { expires_at: new Date(expires.getTime() + 86_400_000) } }).catch(() => undefined);
          mediaId = m.id;
          omitted = false;
        }
      } catch (e: any) {
        omitted = true;
        if (e instanceof OpenWaError && e.status === 429) return null; // limite do gateway: tenta na próxima sincronização
        if (!(e instanceof OpenWaError && e.status === 404)) this.logger.debug(`mídia do status ${waId} (número ${sessionId}): ${e?.message || e}`);
      }
    } else if (type !== 'text') omitted = true;
    try {
      const created = await this.prisma.whatsapp_contact_statuses.create({
        data: {
          organization_id: orgId,
          session_id: sessionId,
          wa_status_id: waId.slice(0, 191),
          contact_jid: jid.slice(0, 64),
          chat_id: chatId.slice(0, 64),
          contact_name: name ? String(name).slice(0, 255) : null,
          type,
          caption: s?.caption ? String(s.caption) : s?.text ? String(s.text) : null,
          background_color: s?.backgroundColor ? String(s.backgroundColor).slice(0, 16) : null,
          font: s?.font != null && Number.isFinite(Number(s.font)) ? Number(s.font) : null,
          media_id: mediaId,
          media_omitted: omitted,
          posted_at: posted,
          expires_at: expires,
        },
      });
      if (name) await this.contacts.touch(orgId, row, jid, { pushName: s?.contact?.pushName, name: s?.contact?.name, phone: phoneFromJid(jid) || undefined }).catch(() => undefined);
      // tempo real: sala do número (só quem tem acesso a ele recebe)
      const [chatUuid, shaped] = await Promise.all([
        this.presenter.chatUuid(orgId, sessionId, created.chat_id).catch(() => null),
        this.shapeList(orgId, sessionId, [created]).catch(() => [] as any[]),
      ]);
      this.presenter.emitSession(orgId, sessionId, 'wa:status', {
        session_id: sessionId,
        contact_chat_id: chatUuid || null,
        contact_jid: created.chat_id,
        status: shaped?.[0]?.statuses?.[0] || null,
      });
      return created;
    } catch (e: any) {
      if (e?.code === 'P2002') return null;
      throw e;
    }
  }

  /** Lê o store do gateway de UM número (últimas 24 h) e guarda o que faltar. Devolve quantos entraram. */
  private async pull(row: SessionRow) {
    const orgId: string = row.organization_id;
    let list: any[] = [];
    try {
      const r: any = await this.openwa.contactStatuses(row.openwa_session_id);
      list = Array.isArray(r?.statuses) ? r.statuses : Array.isArray(r) ? r : [];
    } catch (e: any) {
      throw new BadRequestException(e instanceof OpenWaError ? e.message : 'Não foi possível ler os status agora.');
    }
    // a lista pode vir agrupada por contato ({contact, statuses:[…]}) ou plana
    const flat: any[] = [];
    for (const it of list) {
      if (Array.isArray(it?.statuses)) for (const st of it.statuses) flat.push({ ...st, contact: st.contact || it.contact });
      else flat.push(it);
    }
    let added = 0;
    for (const st of flat.slice(0, 500)) {
      const waId = String(st.statusId || st.id || '').slice(0, 191);
      const fresh = !waId || !(await this.prisma.whatsapp_contact_statuses.findUnique({ where: { organization_id_session_id_wa_status_id: { organization_id: orgId, session_id: row.id, wa_status_id: waId } }, select: { id: true } }));
      if (!fresh) continue;
      const r = await this.ingest(row, { ...st, statusId: st.statusId || st.id, postedAt: st.postedAt || st.timestamp }).catch(() => null);
      if (r) added++;
      // o gateway tem limite de requisições: espaça os downloads de mídia
      if (st.type && st.type !== 'text') await new Promise((res) => setTimeout(res, 350));
    }
    return added;
  }

  /** Sincroniza um número (precisa estar conectado) e devolve a listagem daquele número + `added`. */
  async sync(orgId: string, sessionId: string) {
    const row = await this.sessions.requireReady(orgId, sessionId);
    const added = await this.pull(row);
    return { ...(await this.list(orgId, null, sessionId)), added };
  }

  /** Um número (`sessionId`) ou todos os permitidos que estão conectados. Erro de um número não derruba os outros. */
  async syncMany(orgId: string, allowed: Set<string> | null, sessionId: string | null = null) {
    let rows: SessionRow[];
    if (sessionId) {
      if (allowed !== null && !allowed.has(sessionId)) throw new NotFoundException('Número não encontrado.');
      rows = [await this.sessions.requireReady(orgId, sessionId)];
    } else {
      rows = (await this.sessions.readyRows(orgId)).filter((r) => allowed === null || allowed.has(r.id));
      if (!rows.length) throw new BadRequestException('Nenhum número conectado para sincronizar.');
    }
    const by_session: { session_id: string; added: number; error?: string }[] = [];
    let added_total = 0;
    for (const row of rows) {
      try {
        const added = await this.pull(row);
        added_total += added;
        by_session.push({ session_id: row.id, added });
      } catch (e: any) {
        by_session.push({ session_id: row.id, added: 0, error: String(e?.message || e).slice(0, 255) });
      }
    }
    return { ...(await this.list(orgId, allowed, sessionId)), added_total, by_session };
  }

  // ---------------------------------------------------------------- formato
  /** Agrupa os status de UM número por contato (não vistos primeiro, depois os mais recentes). */
  private async shapeList(orgId: string, sessionId: string, rows: any[]) {
    if (!rows.length) return [] as any[];
    const mediaIds = rows.map((r) => r.media_id).filter(Boolean) as string[];
    const medias = mediaIds.length ? await this.prisma.whatsapp_media.findMany({ where: { id: { in: mediaIds } } }) : [];
    const mm = new Map(medias.map((m) => [m.id, m] as [string, any]));
    const chatIds = [...new Set(rows.map((r) => r.chat_id))];
    const cmap = await this.presenter.contactMap(orgId, chatIds);
    const chats = await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, session_id: sessionId, chat_id: { in: chatIds } }, select: { id: true, chat_id: true, name: true } });
    const chatRow = new Map(chats.map((c) => [c.chat_id, c] as [string, { id: string; chat_id: string; name: string | null }]));
    const groups = new Map<string, any>();
    for (const r of rows) {
      const c = cmap.get(r.chat_id);
      const ch = chatRow.get(r.chat_id);
      const g = groups.get(r.chat_id) || {
        session_id: sessionId,
        chat_id: ch?.id || null, // uuid da conversa (null = ainda não existe conversa com esse número)
        jid: r.chat_id,
        name: c?.name || c?.push_name || r.contact_name || ch?.name || (phoneFromJid(r.chat_id) ? `+${phoneFromJid(r.chat_id)}` : 'Contato'),
        phone: c?.phone || phoneFromJid(r.chat_id) || null,
        photo_path: ch?.id ? `/whatsapp/chats/${ch.id}/photo` : `/whatsapp/photo?jid=${encodeURIComponent(r.chat_id)}&session_id=${encodeURIComponent(sessionId)}`,
        statuses: [] as any[],
      };
      const m = r.media_id ? mm.get(r.media_id) : null;
      g.statuses.push({
        id: r.id,
        session_id: sessionId,
        type: r.type,
        text: r.type === 'text' ? r.caption : null,
        caption: r.type !== 'text' ? r.caption : null,
        background_color: r.background_color,
        font: r.font,
        media: m ? { url: this.media.signedUrl(m.id), mime: m.mime } : null,
        media_omitted: r.media_omitted || (r.type !== 'text' && !m),
        posted_at: r.posted_at,
        expires_at: r.expires_at,
        viewed: Boolean(r.viewed_at),
      });
      groups.set(r.chat_id, g);
    }
    const out = [...groups.values()].map((g) => {
      g.statuses.sort((a: any, b: any) => new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime());
      g.last_at = g.statuses[g.statuses.length - 1]?.posted_at || null;
      g.all_viewed = g.statuses.every((s: any) => s.viewed);
      return g;
    });
    return out.sort((a, b) => Number(a.all_viewed) - Number(b.all_viewed) || new Date(b.last_at).getTime() - new Date(a.last_at).getTime());
  }

  /**
   * Um bloco por número permitido (ordem das abas), mesmo vazio:
   * `{ sessions: [{ session: brief, contacts: [...] }], synced_at }`. `sessionId` limita a um número
   * (não permitido → lista vazia).
   */
  async list(orgId: string, allowed: Set<string> | null = null, sessionId: string | null = null) {
    const synced_at = new Date().toISOString();
    let rows = (await this.sessions.rowsOf(orgId)).filter((r) => allowed === null || allowed.has(r.id));
    if (sessionId) rows = rows.filter((r) => r.id === sessionId);
    if (!rows.length) return { sessions: [] as any[], synced_at };
    const ids = rows.map((r) => r.id);
    const all = await this.prisma.whatsapp_contact_statuses.findMany({
      where: { organization_id: orgId, session_id: { in: ids }, expires_at: { gt: new Date() } },
      orderBy: { posted_at: 'desc' },
      take: 1000 * ids.length,
    });
    const bySession = new Map<string, any[]>();
    for (const r of all) {
      const arr = bySession.get(r.session_id) || [];
      if (arr.length < 1000) arr.push(r);
      bySession.set(r.session_id, arr);
    }
    const sessions: any[] = [];
    for (const row of rows) sessions.push({ session: this.sessions.brief(row), contacts: await this.shapeList(orgId, row.id, bySession.get(row.id) || []) });
    return { sessions, synced_at };
  }

  // ---------------------------------------------------------------- ações
  /** Status de número que o usuário não vê = inexistente (404). */
  private async own(orgId: string, id: string, allowed: Set<string> | null) {
    const r = await this.prisma.whatsapp_contact_statuses.findFirst({ where: { id, organization_id: orgId } });
    if (!r || (allowed !== null && !allowed.has(r.session_id))) throw new NotFoundException('Status não encontrado (pode ter expirado).');
    return r;
  }

  async view(orgId: string, id: string, allowed: Set<string> | null = null) {
    const r = await this.own(orgId, id, allowed);
    if (!r.viewed_at) await this.prisma.whatsapp_contact_statuses.update({ where: { id: r.id }, data: { viewed_at: new Date() } });
    return { ok: true };
  }

  /** Responde o status: mensagem na conversa do contato, PELO número que viu o status (citando quando o motor permite). */
  async reply(orgId: string, userId: string, id: string, text: string, allowed: Set<string> | null = null) {
    const st = await this.own(orgId, id, allowed);
    const body = String(text || '').trim().slice(0, 4000);
    if (!body) throw new BadRequestException('Escreva a resposta.');
    const row = await this.sessions.requireReady(orgId, st.session_id);
    const signed = await this.attendance.sign(orgId, userId, body);
    let r: any;
    let quoted = true;
    try {
      r = await this.openwa.sendText(row.openwa_session_id, st.contact_jid, signed, { quotedMessageId: st.wa_status_id });
    } catch {
      // motor não aceitou citar o status → manda com uma referência em texto
      quoted = false;
      const ref = st.caption ? `“${String(st.caption).slice(0, 60)}${String(st.caption).length > 60 ? '…' : ''}”` : 'seu status';
      try {
        r = await this.openwa.sendText(row.openwa_session_id, st.contact_jid, `↩️ Sobre ${ref}:\n${signed}`);
      } catch (e: any) {
        throw new BadRequestException(e instanceof OpenWaError ? e.message : 'Não foi possível enviar a resposta.');
      }
    }
    const at = r?.timestamp ? new Date(Number(r.timestamp) * 1000) : new Date();
    const waId = String(r?.messageId || `st_${Date.now()}`);
    const msg = await this.prisma.whatsapp_messages
      .create({
        data: {
          organization_id: orgId,
          session_id: st.session_id,
          chat_id: st.chat_id,
          wa_message_id: waId,
          direction: 'OUT',
          type: 'text',
          body: signed,
          ack: 1,
          timestamp: at,
          sent_by_user_id: userId,
          quoted_preview: quoted ? `Status: ${st.caption || (st.type === 'text' ? '' : st.type)}`.slice(0, 255) : null,
          extra: { status_reply: st.id },
        },
      })
      .catch(() => null);
    await this.inbound.bumpChat(orgId, st.session_id, st.chat_id, { type: 'text', body: signed, direction: 'OUT', at });
    await this.attendance.onPanelSend(orgId, { session_id: st.session_id, chat_id: st.chat_id }, userId).catch(() => undefined);
    if (msg) this.presenter.message(orgId, { id: msg.id });
    if (!st.viewed_at) await this.prisma.whatsapp_contact_statuses.update({ where: { id: st.id }, data: { viewed_at: new Date() } }).catch(() => undefined);
    const chatUuid = await this.presenter.chatUuid(orgId, st.session_id, st.chat_id).catch(() => null);
    return { ok: true, quoted, chat_id: chatUuid, session_id: st.session_id, message: msg ? (await this.presenter.shapeMessages(orgId, [msg]))[0] : null };
  }

  async react(orgId: string, id: string, emoji: string, allowed: Set<string> | null = null) {
    const st = await this.own(orgId, id, allowed);
    const row = await this.sessions.requireReady(orgId, st.session_id);
    try {
      await this.openwa.react(row.openwa_session_id, 'status@broadcast', st.wa_status_id, String(emoji || '').slice(0, 8));
    } catch {
      throw new BadRequestException('Reação a status não suportada por este motor. Responda com uma mensagem.');
    }
    if (!st.viewed_at) await this.prisma.whatsapp_contact_statuses.update({ where: { id: st.id }, data: { viewed_at: new Date() } }).catch(() => undefined);
    return { ok: true, session_id: st.session_id };
  }

  // ---------------------------------------------------------------- limpeza: status vencidos há mais de 1 dia
  @Cron(CronExpression.EVERY_HOUR)
  async purge() {
    const r = await this.prisma.whatsapp_contact_statuses.deleteMany({ where: { expires_at: { lt: new Date(Date.now() - 86_400_000) } } }).catch(() => ({ count: 0 }));
    if (r.count) this.logger.log(`status de contatos vencidos apagados: ${r.count}`);
  }
}
