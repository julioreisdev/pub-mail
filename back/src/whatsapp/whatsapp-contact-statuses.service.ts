import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OpenWaClient, OpenWaError } from './openwa.client';
import { WhatsAppMediaService, kindOfMime } from './whatsapp-media.service';
import { WhatsAppContactsService } from './whatsapp-contacts.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { WhatsAppInboundService } from './whatsapp-inbound.service';
import { WhatsAppAttendanceService } from './whatsapp-attendance.service';
import { normJid, phoneFromJid } from './wa-jid.util';

// Status (stories) dos CONTATOS: chegam pelo webhook `status.received` e também são
// sincronizados do store do gateway (GET /sessions/:id/status). Guardamos 24 h + 1 dia
// (a mídia vai para a pasta protegida com a mesma validade). O usuário vê, marca como
// visto (só no Pub Mail), responde (mensagem no chat do contato) e reage.
@Injectable()
export class WhatsAppContactStatusesService {
  private readonly logger = new Logger(WhatsAppContactStatusesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openwa: OpenWaClient,
    private readonly media: WhatsAppMediaService,
    private readonly contacts: WhatsAppContactsService,
    private readonly presenter: WhatsAppPresenter,
    private readonly inbound: WhatsAppInboundService,
    private readonly attendance: WhatsAppAttendanceService,
  ) {}

  private async session(orgId: string) {
    const row = await this.prisma.whatsapp_sessions.findUnique({ where: { organization_id: orgId } });
    if (row?.openwa_session_id) this.openwa.remember(row.openwa_session_id, row.engine);
    return row;
  }

  /** Guarda um status (do webhook ou da sincronização). Idempotente por wa_status_id. */
  async ingest(orgId: string, sessionRow: any, s: any) {
    const waId = String(s?.statusId || s?.id || '');
    const jid = normJid(String(s?.contact?.id || s?.contactJid || ''));
    if (!waId || !jid || /@(g\.us|broadcast|newsletter)$/.test(jid)) return null;
    const existing = await this.prisma.whatsapp_contact_statuses.findUnique({ where: { organization_id_wa_status_id: { organization_id: orgId, wa_status_id: waId } } });
    if (existing) return existing;
    const posted = new Date(s?.postedAt || s?.timestamp || Date.now());
    const expires = new Date(s?.expiresAt || posted.getTime() + 86_400_000);
    if (expires.getTime() < Date.now()) return null;
    const chatId = await this.contacts.canonicalChatId(orgId, jid).catch(() => jid);
    const name = s?.contact?.name || s?.contact?.pushName || null;
    const type = ['text', 'image', 'video', 'voice'].includes(String(s?.type)) ? String(s.type) : 'text';
    let mediaId: string | null = null;
    let omitted = Boolean(s?.mediaOmitted);
    const wantsMedia = type !== 'text' && (s?.hasMedia || s?.mediaUrl || (!s?.mediaOmitted && type !== 'text'));
    if (wantsMedia && sessionRow?.openwa_session_id) {
      try {
        const r = await this.openwa.statusMediaFile(sessionRow.openwa_session_id, waId);
        if (r?.buffer?.length) {
          const m = await this.media.store(orgId, r.buffer, r.mime, null, type === 'voice' ? 'voice' : kindOfMime(r.mime));
          await this.prisma.whatsapp_media.update({ where: { id: m.id }, data: { expires_at: new Date(expires.getTime() + 86_400_000) } }).catch(() => undefined);
          mediaId = m.id;
          omitted = false;
        }
      } catch (e: any) {
        omitted = true;
        if (e instanceof OpenWaError && e.status === 429) return null; // limite do gateway: tenta na próxima sincronização
        if (!(e instanceof OpenWaError && e.status === 404)) this.logger.debug(`mídia do status ${waId}: ${e?.message || e}`);
      }
    } else if (type !== 'text') omitted = true;
    try {
      const row = await this.prisma.whatsapp_contact_statuses.create({
        data: {
          organization_id: orgId,
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
      if (name) await this.contacts.touch(orgId, jid, { pushName: s?.contact?.pushName, name: s?.contact?.name, phone: phoneFromJid(jid) || undefined }).catch(() => undefined);
      const shaped = (await this.shapeList(orgId, [row]))[0];
      this.presenter.emit(orgId, 'wa:status', { contact_chat_id: row.chat_id, status: shaped?.statuses?.[0] || null });
      return row;
    } catch (e: any) {
      if (e?.code === 'P2002') return null;
      throw e;
    }
  }

  /** Puxa do gateway o que ele guardou nas últimas 24 h. */
  async sync(orgId: string) {
    const row = await this.session(orgId);
    if (!row?.openwa_session_id || row.status !== 'ready') throw new BadRequestException('Conecte o WhatsApp primeiro.');
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
      const fresh = !(await this.prisma.whatsapp_contact_statuses.findUnique({ where: { organization_id_wa_status_id: { organization_id: orgId, wa_status_id: String(st.statusId || st.id || '') } }, select: { id: true } }));
      const r = await this.ingest(orgId, row, { ...st, statusId: st.statusId || st.id, postedAt: st.postedAt || st.timestamp }).catch(() => null);
      if (r) added++;
      // o gateway tem limite de requisições: espaça os downloads de mídia
      if (fresh && st.type && st.type !== 'text') await new Promise((res) => setTimeout(res, 350));
    }
    return { ...(await this.list(orgId)), added };
  }

  private async shapeList(orgId: string, rows: any[]) {
    const mediaIds = rows.map((r) => r.media_id).filter(Boolean) as string[];
    const medias = mediaIds.length ? await this.prisma.whatsapp_media.findMany({ where: { id: { in: mediaIds } } }) : [];
    const mm = new Map(medias.map((m) => [m.id, m] as [string, any]));
    const chatIds = [...new Set(rows.map((r) => r.chat_id))];
    const cmap = await this.presenter.contactMap(orgId, chatIds);
    const chats = await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, chat_id: { in: chatIds } }, select: { chat_id: true, name: true } });
    const chatName = new Map(chats.map((c) => [c.chat_id, c.name] as [string, string | null]));
    const groups = new Map<string, any>();
    for (const r of rows) {
      const c = cmap.get(r.chat_id);
      const g = groups.get(r.chat_id) || {
        chat_id: r.chat_id,
        name: c?.name || c?.push_name || r.contact_name || chatName.get(r.chat_id) || (phoneFromJid(r.chat_id) ? `+${phoneFromJid(r.chat_id)}` : 'Contato'),
        phone: c?.phone || phoneFromJid(r.chat_id) || null,
        photo_path: `/whatsapp/chats/${encodeURIComponent(r.chat_id)}/photo`,
        statuses: [] as any[],
      };
      const m = r.media_id ? mm.get(r.media_id) : null;
      g.statuses.push({
        id: r.id,
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
    // não vistos primeiro, depois os mais recentes
    return out.sort((a, b) => Number(a.all_viewed) - Number(b.all_viewed) || new Date(b.last_at).getTime() - new Date(a.last_at).getTime());
  }

  async list(orgId: string) {
    const rows = await this.prisma.whatsapp_contact_statuses.findMany({ where: { organization_id: orgId, expires_at: { gt: new Date() } }, orderBy: { posted_at: 'desc' }, take: 1000 });
    return { contacts: await this.shapeList(orgId, rows), synced_at: new Date().toISOString() };
  }

  private async own(orgId: string, id: string) {
    const r = await this.prisma.whatsapp_contact_statuses.findFirst({ where: { id, organization_id: orgId } });
    if (!r) throw new NotFoundException('Status não encontrado (pode ter expirado).');
    return r;
  }

  async view(orgId: string, id: string) {
    const r = await this.own(orgId, id);
    if (!r.viewed_at) await this.prisma.whatsapp_contact_statuses.update({ where: { id: r.id }, data: { viewed_at: new Date() } });
    return { ok: true };
  }

  /** Responde o status: mensagem no chat do contato (citando o status quando o motor permite). */
  async reply(orgId: string, userId: string, id: string, text: string) {
    const st = await this.own(orgId, id);
    const body = String(text || '').trim().slice(0, 4000);
    if (!body) throw new BadRequestException('Escreva a resposta.');
    const row = await this.session(orgId);
    if (!row?.openwa_session_id || row.status !== 'ready') throw new BadRequestException('O WhatsApp não está conectado.');
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
      .create({ data: { organization_id: orgId, chat_id: st.chat_id, wa_message_id: waId, direction: 'OUT', type: 'text', body: signed, ack: 1, timestamp: at, sent_by_user_id: userId, quoted_preview: quoted ? `Status: ${st.caption || (st.type === 'text' ? '' : st.type)}`.slice(0, 255) : null, extra: { status_reply: st.id } } })
      .catch(() => null);
    await this.inbound.bumpChat(orgId, st.chat_id, { type: 'text', body: signed, direction: 'OUT', at });
    await this.attendance.onPanelSend(orgId, st.chat_id, userId).catch(() => undefined);
    if (msg) this.presenter.message(orgId, { id: msg.id });
    if (!st.viewed_at) await this.prisma.whatsapp_contact_statuses.update({ where: { id: st.id }, data: { viewed_at: new Date() } }).catch(() => undefined);
    return { ok: true, quoted, chat_id: st.chat_id, message: msg ? (await this.presenter.shapeMessages(orgId, [msg]))[0] : null };
  }

  async react(orgId: string, id: string, emoji: string) {
    const st = await this.own(orgId, id);
    const row = await this.session(orgId);
    if (!row?.openwa_session_id || row.status !== 'ready') throw new BadRequestException('O WhatsApp não está conectado.');
    try {
      await this.openwa.react(row.openwa_session_id, 'status@broadcast', st.wa_status_id, String(emoji || '').slice(0, 8));
    } catch {
      throw new BadRequestException('Reação a status não suportada por este motor. Responda com uma mensagem.');
    }
    if (!st.viewed_at) await this.prisma.whatsapp_contact_statuses.update({ where: { id: st.id }, data: { viewed_at: new Date() } }).catch(() => undefined);
    return { ok: true };
  }

  // limpeza: status vencidos há mais de 1 dia
  @Cron(CronExpression.EVERY_HOUR)
  async purge() {
    const r = await this.prisma.whatsapp_contact_statuses.deleteMany({ where: { expires_at: { lt: new Date(Date.now() - 86_400_000) } } }).catch(() => ({ count: 0 }));
    if (r.count) this.logger.log(`status de contatos vencidos apagados: ${r.count}`);
  }
}
