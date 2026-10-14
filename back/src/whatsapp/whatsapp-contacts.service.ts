import { createHash } from 'crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { promises as fsp } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { OpenWaClient, OpenWaError } from './openwa.client';
import { WhatsAppSessionsService } from './whatsapp-sessions.service';
import { WhatsAppMediaService } from './whatsapp-media.service';

// Contatos do WhatsApp da organização — SÃO DA ORGANIZAÇÃO (agenda compartilhada entre os números).
// - `source='session'`: veio do celular (sync) ou apareceu numa conversa;
// - `saved=true`: guardado NA ORGANIZAÇÃO — sobrevive à troca de número (D6);
// - `wa_id` = jid (`<digitos>@c.us` ou `<id>@lid`); `phone` = só dígitos quando conhecido.
// O que depende do NÚMERO (motor, telefone próprio, mapeamento @lid do gateway) recebe a
// sessão (linha de whatsapp_sessions) como parâmetro.

export { digitsOf, jidFromPhone, phoneFromJid, isGroupJid, isLidJid, normJid, hasDeviceSuffix } from './wa-jid.util';
import { digitsOf, jidFromPhone, phoneFromJid, isGroupJid, isLidJid, normJid, hasDeviceSuffix, isIdLikeName } from './wa-jid.util';

function normTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const t of raw) {
    const v = String(t || '').trim().slice(0, 40);
    if (v && !out.includes(v)) out.push(v);
  }
  return out.slice(0, 30);
}

type SessionLike = { id: string; engine?: string | null; openwa_session_id?: string | null; phone?: string | null; status?: string | null; organization_id?: string } | string | null | undefined;

// foto de perfil: reconfere a URL (barato) a cada 1 h quando alguém vê a foto; varredura em lote a cada 6 h por contato
const PHOTO_RECHECK_MS = 60 * 60_000;
const PHOTO_SWEEP_MS = 6 * 3600_000;

@Injectable()
export class WhatsAppContactsService {
  private readonly logger = new Logger(WhatsAppContactsService.name);

  constructor(private readonly prisma: PrismaService, private readonly openwa: OpenWaClient, private readonly sessions: WhatsAppSessionsService, private readonly media: WhatsAppMediaService) {}

  private shape(c: any, chats?: Map<string, Array<{ id: string; session_id: string }>>, smap?: Map<string, any>) {
    // cada conversa com `chat_id` (uuid) + `session` (brief), além de `id` (compat)
    const list = (chats?.get(c.wa_id) || []).map((x) => ({ ...x, chat_id: x.id, session: smap?.get(x.session_id) || null }));
    return {
      id: c.id,
      wa_id: c.wa_id,
      phone: c.phone,
      name: c.name,
      push_name: c.push_name,
      display_name: c.name || c.push_name || (c.phone ? `+${c.phone}` : c.wa_id),
      is_business: c.is_business,
      is_my_contact: c.is_my_contact,
      is_blocked: c.is_blocked,
      opted_out_at: c.opted_out_at || null,
      opted_out: Boolean(c.opted_out_at),
      saved: c.saved,
      tags: Array.isArray(c.tags) ? c.tags : [],
      notes: c.notes,
      source: c.source,
      last_message_at: c.last_message_at,
      synced_at: c.synced_at,
      // conversas existentes desta pessoa (uma por número); `chat_id` = a primeira (compat)
      chats: list,
      chat_id: list[0]?.id || null,
      created_at: c.created_at,
    };
  }

  // ---------------------------------------------------------------- sessão (número)
  /** Normaliza "sessão ou id de sessão" para a linha. */
  private async sessionOf(orgId: string, s: SessionLike) {
    if (!s) return null;
    if (typeof s === 'string') return this.sessions.rowById(orgId, s);
    return s;
  }

  private sessionInfo(s: any) {
    return { id: s?.id || null, engine: String(s?.engine || 'wwjs'), sid: s?.openwa_session_id || null, phone: s?.phone ? digitsOf(s.phone) : null };
  }

  // ---------------------------------------------------------------- contato × número
  // `whatsapp_contact_sessions`: de qual número o contato veio (agenda daquele número ou mensagem por ele).
  // Cache curto em memória evita 1 gravação por mensagem recebida; expira em 10 min para que um
  // vínculo apagado (dados do número limpos) seja recriado na próxima mensagem.
  private readonly linkSeen = new Map<string, number>();
  private static readonly LINK_TTL_MS = 10 * 60_000;

  /** Marca que estes contatos são conhecidos por este número (idempotente). */
  async linkToSession(orgId: string, sessionId: string | null | undefined, contactIds: string[]) {
    if (!sessionId || !contactIds.length) return;
    const now = Date.now();
    const fresh = [...new Set(contactIds)].filter((id) => id && (this.linkSeen.get(`${sessionId}|${id}`) || 0) < now);
    if (!fresh.length) return;
    try {
      for (let i = 0; i < fresh.length; i += 1000) {
        await this.prisma.whatsapp_contact_sessions.createMany({ data: fresh.slice(i, i + 1000).map((contact_id) => ({ contact_id, session_id: sessionId, organization_id: orgId })), skipDuplicates: true });
      }
      if (this.linkSeen.size > 100_000) this.linkSeen.clear();
      for (const id of fresh) this.linkSeen.set(`${sessionId}|${id}`, now + WhatsAppContactsService.LINK_TTL_MS);
    } catch (e: any) {
      this.logger.debug(`link contato×número falhou: ${e?.message || e}`); // número/contato apagado no meio do caminho
    }
  }

  // Upsert leve usado pelo pipeline de entrada (nunca sobrescreve nome salvo manualmente).
  async touch(orgId: string, session: SessionLike, waId: string, info: { phone?: string; pushName?: string; name?: string; lid?: string; at?: Date }) {
    if (!waId || isGroupJid(waId)) return null;
    const sess = await this.sessionOf(orgId, session);
    if (isLidJid(waId) && !info.lid && sess) {
      const canon = await this.canonicalChatId(orgId, sess, waId).catch(() => waId);
      if (canon !== waId) return this.touch(orgId, sess, canon, { ...info, phone: phoneFromJid(canon), lid: normJid(waId) });
    }
    const phone = info.phone ? digitsOf(info.phone) : phoneFromJid(waId);
    const data: any = { last_message_at: info.at || new Date() };
    if (phone) data.phone = phone.slice(0, 32);
    if (info.lid) data.lid = String(info.lid).slice(0, 64);
    if (info.pushName && !isIdLikeName(info.pushName)) data.push_name = String(info.pushName).slice(0, 255);
    try {
      const c = await this.prisma.whatsapp_contacts.upsert({
        where: { organization_id_wa_id: { organization_id: orgId, wa_id: waId } },
        create: { organization_id: orgId, wa_id: waId, source: 'session', name: info.name && !isIdLikeName(info.name) ? String(info.name).slice(0, 255) : null, ...(isLidJid(waId) ? { lid: waId } : {}), ...data },
        update: { ...data, ...(isLidJid(waId) ? { lid: waId } : {}) },
      });
      if (sess?.id) await this.linkToSession(orgId, sess.id, [c.id]);
      if (c.lid && c.phone && sess) await this.mergeChats(orgId, sess, c.phone, c.lid).catch(() => undefined);
      return c;
    } catch (e: any) {
      this.logger.warn(`touch contact falhou ${waId}: ${e?.message || e}`);
      return null;
    }
  }

  // ---------------------------------------------------------------- @lid ↔ telefone
  // A mesma pessoa pode aparecer como <lid>@lid e como <telefone>@c.us. O id canônico depende do motor do NÚMERO:
  //  - whatsapp-web.js: as conversas chegam pelo @lid → canônico = @lid;
  //  - Baileys: o gateway entrega pelo telefone → canônico = <telefone>@c.us. O histórico antigo
  //    (importado pelo @lid) é unificado usando o mapa lid↔telefone que o próprio Baileys guarda
  //    em disco (`lid-mapping-<lid>_reverse.json` no volume do gateway, por sessão).
  private readonly lidPhoneCache = new Map<string, { at: number; phone: string | null }>();

  /** Telefone de um @lid: banco primeiro; no Baileys, o arquivo de mapeamento do gateway daquela sessão. */
  async phoneOfLid(orgId: string, session: SessionLike, lid: string): Promise<string | null> {
    const jid = normJid(lid);
    if (!isLidJid(jid)) return null;
    const known = await this.prisma.whatsapp_contacts.findFirst({ where: { organization_id: orgId, lid: jid, phone: { not: null } }, select: { phone: true } });
    if (known?.phone) return digitsOf(known.phone);
    const info = this.sessionInfo(await this.sessionOf(orgId, session));
    if (info.engine !== 'baileys' || !info.sid) return null;
    const key = `${info.sid}:${jid}`;
    const hit = this.lidPhoneCache.get(key);
    if (hit && (hit.phone || Date.now() - hit.at < 10 * 60_000)) return hit.phone;
    let phone: string | null = null;
    try {
      const dir = String(process.env.OPENWA_BAILEYS_DATA_DIR || '/opt/openwa-baileys/data');
      const user = jid.split('@')[0].replace(/[^0-9]/g, '');
      if (user) {
        const raw = JSON.parse(await fsp.readFile(join(dir, 'baileys', info.sid, `lid-mapping-${user}_reverse.json`), 'utf8'));
        const d = digitsOf(String(raw || '').split(':')[0].split('@')[0]);
        if (d.length >= 10 && d.length <= 15) phone = d;
      }
    } catch { /* sem mapeamento ainda */ }
    this.lidPhoneCache.set(key, { at: Date.now(), phone });
    return phone;
  }

  // chat_id canônico (ver bloco acima): Baileys = telefone; whatsapp-web.js = @lid
  async canonicalChatId(orgId: string, session: SessionLike, chatId: string) {
    const jid = normJid(chatId);
    if (isGroupJid(jid)) return jid;
    const sess = await this.sessionOf(orgId, session);
    const info = this.sessionInfo(sess);
    if (info.engine === 'baileys') {
      if (!isLidJid(jid)) return jid;
      const phone = await this.phoneOfLid(orgId, sess, jid);
      return phone && phone !== info.phone ? `${phone}@c.us` : jid;
    }
    if (!/@c\.us$/.test(jid)) return jid;
    const c = await this.prisma.whatsapp_contacts.findFirst({ where: { organization_id: orgId, phone: phoneFromJid(jid), lid: { not: null } }, select: { lid: true } });
    return c?.lid || jid;
  }

  // ---------------------------------------------------------------- quem é quem (menções, participantes, detalhes)
  /**
   * Nome/telefone/contato de vários jids de uma vez (telefone `@c.us` ou `@lid`).
   * Fontes, em ordem: contatos da org (nome da agenda > nome de exibição), mapeamento lid→telefone do gateway
   * (sessão informada) e o `sender_name` das mensagens da conversa (`chatId` + `sessionId`) — quem já falou
   * no grupo tem nome mesmo sem contato.
   */
  async identify(orgId: string, jids: string[], opts: { chatId?: string; session?: SessionLike } = {}) {
    type Info = { jid: string; phone: string | null; lid: string | null; name: string | null; contact_id: string | null; is_my_contact: boolean };
    const out = new Map<string, Info>();
    const uniq = [...new Set(jids.map((j) => normJid(String(j || ''))).filter((j) => j && j.includes('@') && !isGroupJid(j)))];
    if (!uniq.length) return out;
    const sess = await this.sessionOf(orgId, opts.session);
    for (const jid of uniq) out.set(jid, { jid, phone: isLidJid(jid) ? null : phoneFromJid(jid) || null, lid: isLidJid(jid) ? jid : null, name: null, contact_id: null, is_my_contact: false });
    for (const info of out.values()) if (info.lid && !info.phone) info.phone = await this.phoneOfLid(orgId, sess, info.lid);
    const phones = [...new Set([...out.values()].map((i) => i.phone).filter(Boolean))] as string[];
    const waIds = [...new Set([...uniq, ...phones.map(jidFromPhone)])];
    const lids = uniq.filter(isLidJid);
    const contacts = await this.prisma.whatsapp_contacts.findMany({
      where: { organization_id: orgId, OR: [{ wa_id: { in: waIds } }, ...(phones.length ? [{ phone: { in: phones } }] : []), ...(lids.length ? [{ lid: { in: lids } }] : [])] },
      select: { id: true, wa_id: true, phone: true, lid: true, name: true, push_name: true, is_my_contact: true },
    });
    for (const info of out.values()) {
      const cs = contacts.filter((c) => c.wa_id === info.jid || (info.phone && (c.phone === info.phone || c.wa_id === jidFromPhone(info.phone))) || (info.lid && c.lid === info.lid));
      if (!cs.length) continue;
      const best = cs.find((c) => c.name) || cs.find((c) => c.push_name) || cs[0];
      info.contact_id = best.id;
      info.name = best.name || best.push_name || null;
      info.is_my_contact = cs.some((c) => c.is_my_contact);
      if (!info.phone) info.phone = cs.map((c) => c.phone).find(Boolean) || null;
    }
    const missing = [...out.values()].filter((i) => !i.name);
    if (missing.length && opts.chatId) {
      const froms = [...new Set(missing.flatMap((i) => [i.jid, i.lid, i.phone ? jidFromPhone(i.phone) : null].filter(Boolean)))] as string[];
      const rows = await this.prisma.whatsapp_messages.groupBy({ by: ['from_jid'], where: { organization_id: orgId, ...(sess?.id ? { session_id: sess.id } : {}), chat_id: opts.chatId, from_jid: { in: froms }, sender_name: { not: null } }, _max: { sender_name: true } });
      const byFrom = new Map(rows.map((r) => [r.from_jid, r._max.sender_name] as [string | null, string | null]));
      for (const i of missing) i.name = byFrom.get(i.jid) || (i.lid ? byFrom.get(i.lid) : null) || (i.phone ? byFrom.get(jidFromPhone(i.phone)) : null) || null;
    }
    return out;
  }

  /**
   * Menções em grupo: o corpo traz `@<lid>` (ou `@<telefone>`) e `extra.mentions` os jids por telefone.
   * Resolve o nome de cada `@id` e grava `extra.mention_names = { id: { name, phone } }` (só quando algo resolveu —
   * assim uma menção a quem ainda não tem nome volta a ser tentada na próxima leitura).
   */
  async fillMentions(orgId: string, rows: any[]) {
    const re = /@(\d{7,16})(?!\d)/g;
    const todo = rows.filter((r) => r?.body && re.test(String(r.body)) && !((r.extra as any) || {}).mention_names);
    if (!todo.length) return;
    const byChat = new Map<string, any[]>();
    for (const r of todo) byChat.set(`${r.session_id}|${r.chat_id}`, [...(byChat.get(`${r.session_id}|${r.chat_id}`) || []), r]);
    for (const [key, msgs] of byChat) {
      const [sessionId, chatId] = key.split('|');
      try {
        const tokens = new Set<string>();
        for (const m of msgs) for (const t of String(m.body).matchAll(re)) tokens.add(t[1]);
        const mentionedAll = [...new Set(msgs.flatMap((m) => (Array.isArray(m.extra?.mentions) ? m.extra.mentions.map((j: any) => normJid(String(j))) : [])))];
        const info = await this.identify(orgId, [...tokens].flatMap((t) => [`${t}@lid`, jidFromPhone(t)]).concat(mentionedAll), { chatId, session: sessionId });
        for (const m of msgs) {
          const mentioned: string[] = Array.isArray(m.extra?.mentions) ? m.extra.mentions.map((j: any) => normJid(String(j))) : [];
          const mine = [...new Set([...String(m.body).matchAll(re)].map((t) => t[1]))];
          const names: Record<string, { name: string | null; phone: string | null }> = {};
          mine.forEach((t, idx) => {
            const asPhone = info.get(jidFromPhone(t));
            const asLid = info.get(`${t}@lid`);
            let pick = mentioned.includes(jidFromPhone(t)) ? asPhone : asLid?.phone ? asLid : asPhone?.name ? asPhone : null;
            // sem pista: a i-ésima menção do corpo é a i-ésima de extra.mentions
            if (!pick && mentioned.length === mine.length && mentioned[idx]) pick = info.get(mentioned[idx]) || null;
            if (pick && (pick.name || pick.phone)) names[t] = { name: pick.name, phone: pick.phone };
          });
          if (!Object.keys(names).length) continue;
          const extra = { ...((m.extra as any) || {}), mention_names: names };
          m.extra = extra;
          await this.prisma.whatsapp_messages.update({ where: { id: m.id }, data: { extra } }).catch(() => {});
        }
      } catch (e: any) {
        this.logger.debug(`fillMentions ${chatId}: ${e?.message || e}`);
      }
    }
  }

  /** Participantes de um grupo com nome/contato (gateway só manda o telefone). */
  async enrichParticipants(orgId: string, session: SessionLike, chatId: string, participants: any[]) {
    if (!participants?.length) return participants || [];
    const sess = await this.sessionOf(orgId, session);
    const me = this.sessionInfo(sess);
    const info = await this.identify(orgId, participants.map((p) => p.id), { chatId, session: sess }).catch(() => new Map());
    return participants.map((p) => {
      const i: any = info.get(normJid(String(p.id || ''))) || {};
      const phone = p.phone || i.phone || null;
      return { ...p, phone, name: p.name || i.name || null, contact_id: i.contact_id || null, lid: i.lid || null, is_me: Boolean(me.phone && phone && digitsOf(phone) === me.phone) };
    });
  }

  /**
   * Detalhes de uma pessoa (clique na foto): contato, telefone, conversas (uma por número) e cliente do CRM.
   * `sessionId` escolhe qual conversa vem como principal (`chat`).
   */
  async lookup(orgId: string, jidOrPhone: string, opts: { sessionId?: string | null; chatId?: string | null; allowed?: Set<string> | null } = {}) {
    const raw = String(jidOrPhone || '').trim();
    const jid = raw.includes('@') ? normJid(raw) : digitsOf(raw) ? jidFromPhone(digitsOf(raw)) : '';
    if (!jid || isGroupJid(jid)) throw new BadRequestException('Contato inválido.');
    const sess = opts.sessionId ? await this.sessions.rowById(orgId, opts.sessionId) : null;
    const info = (await this.identify(orgId, [jid], { chatId: opts.chatId || undefined, session: sess }))!.get(jid)!;
    const me = this.sessionInfo(sess);
    const baseJid = info.phone ? jidFromPhone(info.phone) : jid;
    const jids = [...new Set([baseJid, jid, info.lid].filter(Boolean))] as string[];
    const rows = await this.prisma.whatsapp_chats.findMany({
      where: { organization_id: orgId, chat_id: { in: jids }, kind: 'individual', ...(opts.allowed ? { session_id: { in: [...opts.allowed] } } : {}) },
      select: { id: true, session_id: true, chat_id: true, name: true, tags: true, service_status: true, stage_id: true, last_inbound_at: true, last_outbound_at: true, last_message_at: true },
      orderBy: { last_message_at: 'desc' },
    });
    const smap = new Map((await this.sessions.rowsOf(orgId)).map((r) => [r.id, r] as [string, any]));
    const chats = rows.map((c) => ({ chat_id: c.id, jid: c.chat_id, session_id: c.session_id, session: this.sessions.brief(smap.get(c.session_id)), name: c.name, tags: c.tags, service_status: c.service_status, stage_id: c.stage_id, last_message_at: c.last_message_at }));
    const chat = (opts.sessionId ? chats.find((c) => c.session_id === opts.sessionId) : null) || chats[0] || null;
    const contact = info.contact_id ? await this.prisma.whatsapp_contacts.findUnique({ where: { id: info.contact_id } }) : null;
    const links = contact ? await this.prisma.whatsapp_customer_contacts.findMany({ where: { contact_id: contact.id } }).catch(() => [] as any[]) : [];
    const custRows = links.length ? await this.prisma.whatsapp_customers.findMany({ where: { organization_id: orgId, id: { in: links.map((l: any) => l.customer_id) } }, select: { id: true, name: true, status: true, code: true } }) : [];
    const rank: Record<string, number> = { owner: 0, financial: 1, user: 2, dependent: 3 };
    const customers = links.map((l: any) => ({ ...(custRows.find((c) => c.id === l.customer_id) || null), role: l.role })).filter((c: any) => c.id).sort((a: any, b: any) => (rank[a.role] ?? 9) - (rank[b.role] ?? 9));
    const customer = customers[0] ? { id: customers[0].id, name: customers[0].name, status: customers[0].status } : null;
    const name = info.name || (chat?.name && chat.name !== 'Contato sem nome' ? chat.name : null);
    const photoQuery = new URLSearchParams({ jid: baseJid, ...(chat?.session_id ? { session_id: chat.session_id } : sess?.id ? { session_id: sess.id } : {}) });
    return {
      jid,
      phone: info.phone,
      lid: info.lid,
      name,
      is_me: Boolean(me.phone && info.phone && digitsOf(info.phone) === me.phone),
      contact: contact ? this.shape(contact) : null,
      chat,
      chats,
      customer,
      customers,
      photo_path: chat ? `/whatsapp/chats/${encodeURIComponent(chat.chat_id)}/photo${contact?.profile_pic_media_id ? `?v=${String(contact.profile_pic_media_id).slice(0, 8)}` : ''}` : `/whatsapp/photo?${photoQuery.toString()}`,
    };
  }

  /** Junta as duas conversas da mesma pessoa (DENTRO de um número) no id canônico do motor; contato duplicado some. */
  async mergeChats(orgId: string, session: SessionLike, phone: string, lid: string) {
    const phoneJid = `${digitsOf(phone)}@c.us`;
    if (!digitsOf(phone) || !isLidJid(lid) || phoneJid === lid) return false;
    const sess = await this.sessionOf(orgId, session);
    if (!sess) return false;
    const info = this.sessionInfo(sess);
    if (info.phone && digitsOf(phone) === info.phone) return false; // conversa "Eu": não mexe
    const [from, to] = info.engine === 'baileys' ? [lid, phoneJid] : [phoneJid, lid];
    const key = (jid: string) => ({ organization_id_session_id_chat_id: { organization_id: orgId, session_id: sess.id, chat_id: jid } });
    const fc = await this.prisma.whatsapp_chats.findUnique({ where: key(from) });
    let moved = false;
    if (fc) {
      const tc = await this.prisma.whatsapp_chats.findUnique({ where: key(to) });
      // mensagens: move (colisão de wa_message_id = já existe no destino → descarta a duplicada)
      const msgs = await this.prisma.whatsapp_messages.findMany({ where: { organization_id: orgId, session_id: sess.id, chat_id: from }, select: { id: true } });
      for (const m of msgs) await this.prisma.whatsapp_messages.update({ where: { id: m.id }, data: { chat_id: to } }).catch(() => this.prisma.whatsapp_messages.delete({ where: { id: m.id } }).catch(() => undefined));
      // tudo que é guardado por conversa acompanha
      const w = { where: { organization_id: orgId, session_id: sess.id, chat_id: from }, data: { chat_id: to } };
      await this.prisma.whatsapp_service_events.updateMany(w).catch(() => undefined);
      await this.prisma.whatsapp_tasks.updateMany(w).catch(() => undefined);
      await this.prisma.whatsapp_chat_notes.updateMany(w).catch(() => undefined);
      await this.prisma.whatsapp_charges.updateMany(w).catch(() => undefined);
      await this.prisma.whatsapp_ratings.updateMany(w).catch(() => undefined);
      await this.prisma.whatsapp_bot_sessions.updateMany(w).catch(() => undefined);
      if (tc) {
        const newer = !tc.last_message_at || (fc.last_message_at && fc.last_message_at > tc.last_message_at);
        const tags = [...new Set([...(Array.isArray(tc.tags) ? (tc.tags as string[]) : []), ...(Array.isArray(fc.tags) ? (fc.tags as string[]) : [])])];
        await this.prisma.whatsapp_chats.update({
          where: { id: tc.id },
          data: {
            name: tc.name || fc.name, unread_count: tc.unread_count + fc.unread_count, tags,
            ...(tc.stage_id ? {} : { stage_id: fc.stage_id, deal_cents: tc.deal_cents ?? fc.deal_cents, stage_moved_at: fc.stage_moved_at }),
            ...(tc.service_status === 'none' && fc.service_status !== 'none' ? { service_status: fc.service_status, assigned_user_id: fc.assigned_user_id, service_started_at: fc.service_started_at, service_last_human_at: fc.service_last_human_at, service_closed_at: fc.service_closed_at } : {}),
            ...(newer && fc.last_message_at ? { last_message_at: fc.last_message_at, last_message_preview: fc.last_message_preview, last_message_direction: fc.last_message_direction } : {}),
            ...(fc.last_inbound_at && (!tc.last_inbound_at || fc.last_inbound_at > tc.last_inbound_at) ? { last_inbound_at: fc.last_inbound_at } : {}),
            ...(fc.last_outbound_at && (!tc.last_outbound_at || fc.last_outbound_at > tc.last_outbound_at) ? { last_outbound_at: fc.last_outbound_at } : {}),
          },
        });
        await this.prisma.whatsapp_chats.delete({ where: { id: fc.id } });
      } else {
        await this.prisma.whatsapp_chats.update({ where: { id: fc.id }, data: { chat_id: to } });
      }
      moved = true;
    }
    // contato duplicado some em favor do canônico, preservando salvo/tags/nome/agenda e o cliente do CRM
    const dupe = await this.prisma.whatsapp_contacts.findUnique({ where: { organization_id_wa_id: { organization_id: orgId, wa_id: from } } });
    const keep = await this.prisma.whatsapp_contacts.findUnique({ where: { organization_id_wa_id: { organization_id: orgId, wa_id: to } } });
    if (dupe && keep && dupe.id !== keep.id) {
      await this.prisma.whatsapp_contacts.update({
        where: { id: keep.id },
        data: {
          name: keep.name || dupe.name, push_name: keep.push_name || dupe.push_name, saved: keep.saved || dupe.saved, is_my_contact: keep.is_my_contact || dupe.is_my_contact,
          tags: [...new Set([...normTags(keep.tags), ...normTags(dupe.tags)])], notes: keep.notes || dupe.notes, phone: keep.phone || digitsOf(phone), lid,
          opted_out_at: keep.opted_out_at || dupe.opted_out_at,
          ...(dupe.source !== 'session' && keep.source === 'session' ? { source: dupe.source } : {}),
        },
      });
      // clientes do CRM: o principal e os vínculos (cliente↔número) passam para o contato canônico
      await this.prisma.whatsapp_customers.updateMany({ where: { organization_id: orgId, contact_id: dupe.id }, data: { contact_id: keep.id } }).catch(() => undefined);
      const dupeCust = await this.prisma.whatsapp_customer_contacts.findMany({ where: { contact_id: dupe.id } }).catch(() => [] as any[]);
      for (const l of dupeCust) {
        await this.prisma.whatsapp_customer_contacts.upsert({ where: { customer_id_contact_id: { customer_id: l.customer_id, contact_id: keep.id } }, create: { customer_id: l.customer_id, contact_id: keep.id, role: l.role, linked_by: l.linked_by }, update: {} }).catch(() => undefined);
        await this.prisma.whatsapp_customer_contacts.delete({ where: { customer_id_contact_id: { customer_id: l.customer_id, contact_id: dupe.id } } }).catch(() => undefined);
      }
      const dupeLinks = await this.prisma.whatsapp_contact_sessions.findMany({ where: { contact_id: dupe.id }, select: { session_id: true } }).catch(() => [] as Array<{ session_id: string }>);
      for (const l of dupeLinks) await this.linkToSession(orgId, l.session_id, [keep.id]);
      const stillCustomer = await this.prisma.whatsapp_customers.findFirst({ where: { organization_id: orgId, contact_id: dupe.id }, select: { id: true } });
      if (!stillCustomer) await this.prisma.whatsapp_contacts.delete({ where: { id: dupe.id } }).catch(() => undefined); // FK do cliente é CASCADE: só apaga sem cliente
      moved = true;
    } else if (dupe && !keep) {
      // só existia o contato do id antigo → vira o canônico
      await this.prisma.whatsapp_contacts.update({ where: { id: dupe.id }, data: { wa_id: to, phone: digitsOf(phone), lid } }).catch(() => undefined);
      moved = true;
    } else if (keep && (!keep.lid || !keep.phone)) {
      await this.prisma.whatsapp_contacts.update({ where: { id: keep.id }, data: { lid, phone: keep.phone || digitsOf(phone) } }).catch(() => undefined);
    }
    return moved;
  }

  /** Baileys: descobre o telefone dos @lid ainda soltos (conversas do número e contatos) e unifica. */
  async resolveLids(orgId: string, session: SessionLike) {
    const sess = await this.sessionOf(orgId, session);
    const info = this.sessionInfo(sess);
    if (!sess || info.engine !== 'baileys' || !info.sid) return { merged: 0, pending: 0 };
    const [chats, contacts] = await Promise.all([
      this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, session_id: sess.id, kind: 'individual', chat_id: { endsWith: '@lid' } }, select: { chat_id: true } }),
      this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, wa_id: { endsWith: '@lid' } }, select: { wa_id: true } }),
    ]);
    const lids = [...new Set([...chats.map((c) => c.chat_id), ...contacts.map((c) => c.wa_id)])];
    let merged = 0, pending = 0;
    for (const lid of lids) {
      const phone = await this.phoneOfLid(orgId, sess, lid);
      if (!phone) { pending++; continue; }
      const ok = await this.mergeChats(orgId, sess, phone, lid).catch((e) => { this.logger.warn(`merge ${lid}: ${e?.message || e}`); return false; });
      if (ok) merged++;
    }
    if (merged) this.logger.log(`@lid unificados org=${orgId} número=${sess.id}: ${merged} (sem telefone conhecido: ${pending})`);
    return { merged, pending };
  }

  async mergeAll(orgId: string, session: SessionLike) {
    const sess = await this.sessionOf(orgId, session);
    if (!sess) return { checked: 0, merged: 0, pending: 0 };
    const rows = await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, lid: { not: null }, phone: { not: null } }, select: { phone: true, lid: true } });
    let n = 0;
    for (const r of rows) { await this.mergeChats(orgId, sess, r.phone!, r.lid!).catch(() => undefined); n++; }
    const extra = await this.resolveLids(orgId, sess).catch(() => ({ merged: 0, pending: 0 }));
    return { checked: n, ...extra };
  }

  // ---------------------------------------------------------------- listagem / CRUD
  /** `q.session_id` = contatos DAQUELE número (agenda dele ou conversa por ele); `allowed` restringe os números do usuário. */
  async list(orgId: string, q: any = {}, allowed: Set<string> | null = null) {
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(500, Math.max(5, parseInt(String(q.page_size || 25), 10) || 25));
    const where: any = { organization_id: orgId };
    if (q.saved === '1' || q.saved === 'true') where.saved = true;
    if (q.saved === '0' || q.saved === 'false') where.saved = false;
    if (q.tag) where.tags = { array_contains: String(q.tag) };
    if (q.agenda === '1' || q.agenda === 'true') where.is_my_contact = true;
    if (q.optout === '1' || q.optout === 'true') where.opted_out_at = { not: null };
    if (q.optout === '0' || q.optout === 'false') where.opted_out_at = null;
    if (q.session_id) {
      const sid = String(q.session_id);
      if (allowed && !allowed.has(sid)) return { items: [], total: 0, page, page_size: size, pages: 1, tags: [], counts: { total: 0, saved: 0, session: 0, agenda: 0 } };
      const jids = await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, session_id: sid, kind: 'individual' }, select: { chat_id: true } });
      const lids = jids.map((c) => c.chat_id).filter(isLidJid);
      where.OR = [{ sessions: { some: { session_id: sid } } }, { wa_id: { in: jids.map((c) => c.chat_id) } }, ...(lids.length ? [{ lid: { in: lids } }] : [])];
    }
    if (q.q) {
      const s = String(q.q).trim();
      const d = digitsOf(s);
      const cond = { OR: [{ name: { contains: s } }, { push_name: { contains: s } }, ...(d ? [{ phone: { contains: d } }] : [])] };
      where.AND = [...(where.AND || []), cond];
    }
    const [total, rows, counts, allTags] = await Promise.all([
      this.prisma.whatsapp_contacts.count({ where }),
      this.prisma.whatsapp_contacts.findMany({ where, orderBy: [{ saved: 'desc' }, { is_my_contact: 'desc' }, { last_message_at: 'desc' }, { name: 'asc' }], skip: (page - 1) * size, take: size }),
      this.prisma.whatsapp_contacts.groupBy({ by: ['saved'], where: { organization_id: orgId }, _count: { _all: true } }),
      this.tags(orgId),
    ]);
    const chatRows = rows.length
      ? await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, chat_id: { in: rows.flatMap((r) => [r.wa_id, r.lid].filter(Boolean) as string[]) }, ...(allowed ? { session_id: { in: [...allowed] } } : {}) }, select: { id: true, chat_id: true, session_id: true }, orderBy: { last_message_at: 'desc' } })
      : [];
    const chats = new Map<string, Array<{ id: string; session_id: string }>>();
    for (const c of chatRows) chats.set(c.chat_id, [...(chats.get(c.chat_id) || []), { id: c.id, session_id: c.session_id }]);
    for (const r of rows) if (r.lid && chats.get(r.lid) && !chats.get(r.wa_id)) chats.set(r.wa_id, chats.get(r.lid)!);
    const saved = counts.find((c) => c.saved)?._count._all || 0;
    const session = counts.find((c) => !c.saved)?._count._all || 0;
    const agenda = await this.prisma.whatsapp_contacts.count({ where: { organization_id: orgId, is_my_contact: true } });
    const smap = new Map((await this.sessions.rowsOf(orgId)).map((r) => [r.id, this.sessions.brief(r)] as [string, any]));
    return { items: rows.map((r) => this.shape(r, chats, smap)), total, page, page_size: size, pages: Math.max(1, Math.ceil(total / size)), tags: allTags, counts: { total: saved + session, saved, session, agenda } };
  }

  async tags(orgId: string): Promise<string[]> {
    const rows = await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, tags: { not: null as any } }, select: { tags: true }, take: 5000 });
    const set = new Set<string>();
    for (const r of rows) for (const t of normTags(r.tags)) set.add(t);
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  async getOrFail(orgId: string, id: string) {
    const c = await this.prisma.whatsapp_contacts.findFirst({ where: { id, organization_id: orgId } });
    if (!c) throw new NotFoundException('Contato não encontrado.');
    return c;
  }

  async patch(orgId: string, id: string, dto: { saved?: boolean; tags?: unknown; name?: string; notes?: string; opted_out?: boolean }) {
    const cur = await this.getOrFail(orgId, id);
    const data: any = {};
    if (dto.opted_out !== undefined) data.opted_out_at = dto.opted_out ? (cur as any).opted_out_at || new Date() : null;
    if (dto.saved !== undefined) data.saved = Boolean(dto.saved);
    if (dto.tags !== undefined) data.tags = normTags(dto.tags);
    if (dto.name !== undefined) data.name = String(dto.name || '').trim().slice(0, 255) || null;
    if (dto.notes !== undefined) data.notes = String(dto.notes || '').trim().slice(0, 500) || null;
    const c = await this.prisma.whatsapp_contacts.update({ where: { id }, data });
    // Renomear vale também para as conversas da pessoa (em todos os números): a lista do chat mostra
    // o nome da conversa antes do nome do contato. O controller emite `wa:chat` para cada uma.
    let renamed: Array<{ session_id: string; chat_id: string }> = [];
    if (dto.name !== undefined) {
      const jids = [c.wa_id, c.phone ? `${c.phone}@c.us` : null, c.lid].filter(Boolean) as string[];
      const where = { organization_id: orgId, kind: 'individual', chat_id: { in: jids } };
      renamed = await this.prisma.whatsapp_chats.findMany({ where, select: { session_id: true, chat_id: true } });
      if (renamed.length) await this.prisma.whatsapp_chats.updateMany({ where, data: { name: data.name } });
    }
    return { ...this.shape(c), renamed_chats: renamed };
  }

  async bulk(orgId: string, dto: { ids: string[]; saved?: boolean; add_tags?: unknown; remove_tags?: unknown }) {
    const ids = Array.isArray(dto.ids) ? dto.ids.map(String).slice(0, 2000) : [];
    if (!ids.length) throw new BadRequestException('Selecione ao menos um contato.');
    const rows = await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, id: { in: ids } } });
    const add = normTags(dto.add_tags), rem = normTags(dto.remove_tags);
    let n = 0;
    for (const r of rows) {
      const data: any = {};
      if (dto.saved !== undefined) data.saved = Boolean(dto.saved);
      if (add.length || rem.length) {
        const cur = normTags(r.tags).filter((t) => !rem.includes(t));
        for (const t of add) if (!cur.includes(t)) cur.push(t);
        data.tags = cur;
      }
      if (Object.keys(data).length) { await this.prisma.whatsapp_contacts.update({ where: { id: r.id }, data }); n++; }
    }
    return { updated: n };
  }

  async createManual(orgId: string, dto: { phone: string; name?: string; tags?: unknown }) {
    const phone = digitsOf(dto.phone);
    if (phone.length < 10 || phone.length > 15) throw new BadRequestException('Telefone inválido. Use DDI+DDD+número, só dígitos (ex.: 5511999999999).');
    const waId = jidFromPhone(phone);
    const c = await this.prisma.whatsapp_contacts.upsert({
      where: { organization_id_wa_id: { organization_id: orgId, wa_id: waId } },
      create: { organization_id: orgId, wa_id: waId, phone, name: String(dto.name || '').trim().slice(0, 255) || null, tags: normTags(dto.tags), saved: true, source: 'manual' },
      update: { saved: true, ...(dto.name ? { name: String(dto.name).trim().slice(0, 255) } : {}), ...(dto.tags !== undefined ? { tags: normTags(dto.tags) } : {}) },
    });
    return this.shape(c);
  }

  async remove(orgId: string, id: string) {
    const c = await this.getOrFail(orgId, id);
    // Contato de sessão só "desmarca"; apagar de verdade só os manuais/importados.
    if (c.source === 'session') {
      await this.prisma.whatsapp_contacts.update({ where: { id }, data: { saved: false, tags: [] } });
      return { ok: true, unsaved: true };
    }
    await this.prisma.whatsapp_contacts.delete({ where: { id } });
    return { ok: true };
  }

  async importCsv(orgId: string, buf: Buffer) {
    const text = buf.toString('utf8').replace(/^﻿/, '');
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) throw new BadRequestException('Arquivo vazio.');
    const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
    let imported = 0, skipped = 0;
    const start = /telefone|phone/i.test(lines[0]) ? 1 : 0;
    for (const line of lines.slice(start, 5000)) {
      const [p, n, t] = line.split(sep).map((x) => x.replace(/^"|"$/g, '').trim());
      const phone = digitsOf(p);
      if (phone.length < 10 || phone.length > 15) { skipped++; continue; }
      await this.prisma.whatsapp_contacts.upsert({
        where: { organization_id_wa_id: { organization_id: orgId, wa_id: jidFromPhone(phone) } },
        create: { organization_id: orgId, wa_id: jidFromPhone(phone), phone, name: n || null, tags: normTags((t || '').split('|')), saved: true, source: 'import' },
        update: { saved: true, ...(n ? { name: n.slice(0, 255) } : {}), ...(t ? { tags: normTags(t.split('|')) } : {}) },
      });
      imported++;
    }
    return { imported, skipped };
  }

  async exportCsv(orgId: string, savedOnly: boolean) {
    const rows = await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, ...(savedOnly ? { saved: true } : {}) }, orderBy: { name: 'asc' }, take: 20000 });
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = ['phone,name,tags,saved,source'];
    for (const r of rows) lines.push([esc(r.phone || ''), esc(r.name || r.push_name || ''), esc(normTags(r.tags).join('|')), r.saved ? 1 : 0, r.source].join(','));
    return '﻿' + lines.join('\n');
  }

  // Puxa a agenda de UM número pelo gateway. Nunca sobrescreve `name` salvo manualmente.
  async sync(orgId: string, session: SessionLike) {
    const row = await this.sessionOf(orgId, session);
    if (!row?.openwa_session_id || row.status !== 'ready') throw new BadRequestException('Conecte o WhatsApp primeiro.');
    let list: any[] = [];
    try {
      // paginado: o gateway devolve no máx. 1000 por chamada
      for (let offset = 0; offset < 20000; offset += 1000) {
        const page = await this.openwa.listContacts(row.openwa_session_id, 1000, offset);
        if (!Array.isArray(page) || !page.length) break;
        list.push(...page);
        if (page.length < 1000) break;
      }
    } catch (e: any) {
      if (e instanceof OpenWaError) throw new BadRequestException(e.message);
      throw e;
    }
    let imported = 0, updated = 0;
    const now = new Date();
    const linked: string[] = []; // contatos da agenda DESTE número
    for (const c of list) {
      const waId = normJid(String(c?.id?._serialized || c?.id || c?.jid || '').trim());
      if (!waId || isGroupJid(waId) || /@broadcast$/.test(waId) || /@newsletter$/.test(waId)) continue;
      // entradas sem nome, sem número próprio e bloqueadas = lixo da agenda do WhatsApp
      const phone = digitsOf(c?.number || c?.phone || phoneFromJid(waId));
      if (!phone && !c?.name && !c?.pushName && !c?.pushname) continue;
      if (c?.isBlocked && !c?.name && !c?.isMyContact) continue;
      const data: any = {
        phone: phone || undefined,
        lid: isLidJid(waId) ? waId : undefined,
        push_name: c?.pushname || c?.pushName || undefined,
        is_business: Boolean(c?.isBusiness),
        is_my_contact: Boolean(c?.isMyContact ?? true),
        is_blocked: Boolean(c?.isBlocked),
        synced_at: now,
      };
      const agendaName = String(c?.name || c?.shortName || '').trim().slice(0, 255);
      const existing = await this.prisma.whatsapp_contacts.findUnique({ where: { organization_id_wa_id: { organization_id: orgId, wa_id: waId } } });
      if (existing) {
        // agenda é compartilhada: um número NÃO desmarca "na agenda" que outro número marcou
        const d = { ...data, is_my_contact: existing.is_my_contact || data.is_my_contact };
        await this.prisma.whatsapp_contacts.update({ where: { id: existing.id }, data: { ...d, ...(agendaName && !existing.name ? { name: agendaName } : {}) } });
        linked.push(existing.id);
        updated++;
        if (isLidJid(waId) && phone) await this.mergeChats(orgId, row, phone, waId).catch(() => undefined);
      } else {
        const created = await this.prisma.whatsapp_contacts.create({ data: { organization_id: orgId, wa_id: waId, source: 'session', name: agendaName || null, ...data } });
        linked.push(created.id);
        imported++;
        if (isLidJid(waId) && phone) await this.mergeChats(orgId, row, phone, waId).catch(() => undefined);
      }
    }
    // a fusão @lid↔telefone pode ter apagado duplicados no caminho: vincula só os que ainda existem
    const alive = linked.length ? await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, id: { in: [...new Set(linked)] } }, select: { id: true } }) : [];
    await this.linkToSession(orgId, row.id, alive.map((x) => x.id));
    return { imported, updated, total: list.length, session_id: row.id };
  }

  // Buscas de foto no gateway: no máximo 3 ao mesmo tempo (a lista e os status pedem
  // dezenas de fotos de uma vez e o OpenWA responde 429). "Sem foto" fica lembrado 6 h
  // e "limite atingido" 1 min, pra não perguntar de novo a cada renderização.
  private photoActive = 0;
  private readonly photoWaiters: (() => void)[] = [];
  private readonly photoMiss = new Map<string, number>();
  private async photoSlot<T>(fn: () => Promise<T>): Promise<T> {
    if (this.photoActive >= 3) await new Promise<void>((r) => this.photoWaiters.push(r));
    this.photoActive++;
    try {
      return await fn();
    } finally {
      this.photoActive--;
      this.photoWaiters.shift()?.();
    }
  }

  /**
   * Foto de perfil (contato ou grupo) com cache de 7 dias na pasta protegida.
   * Alvo: contato (id), conversa (uuid) ou jid solto (+ número preferido). O gateway usado é o do
   * número da conversa; para jid solto, o número informado ou qualquer um conectado.
   * Devolve o caminho absoluto + mime, ou null (sem foto / gateway fora).
   */
  /** URL PÚBLICA assinada da foto do contato/grupo (ícone de notificação) — null se não há foto. */
  async photoUrl(orgId: string, target: { contactId?: string; chatUuid?: string; jid?: string; sessionId?: string | null }) {
    try {
      const r = await this.photo(orgId, target);
      return r?.id ? this.media.signedUrl(r.id) : null;
    } catch {
      return null;
    }
  }

  /** Versão curta da foto (entra na URL do avatar para o navegador/front buscarem de novo quando ela muda). */
  static photoVersion(contact?: any, chat?: any) {
    const id = contact?.profile_pic_media_id || (chat?.group_meta as any)?.photo_media_id || null;
    return id ? String(id).slice(0, 8) : null;
  }

  /**
   * Foto de perfil (contato ou grupo) com cache em `whatsapp_media kind=avatar`.
   * Revalidação: a URL que o gateway devolve muda quando a pessoa troca a foto → a cada
   * `PHOTO_RECHECK_MS` (ou com `force`) compara a URL atual com a guardada e só baixa de novo se mudou.
   * Antes disso a foto ficava presa por 7 dias (bug relatado em 12/10/2026).
   */
  async photo(orgId: string, target: { contactId?: string; chatUuid?: string; jid?: string; sessionId?: string | null }, opts: { force?: boolean } = {}) {
    let waId = target.jid ? normJid(target.jid) : '';
    let sessionId = target.sessionId || null;
    let contact: any = null;
    let chat: any = null;
    if (target.chatUuid) {
      chat = await this.prisma.whatsapp_chats.findFirst({ where: { id: target.chatUuid, organization_id: orgId } });
      if (!chat) return null;
      waId = chat.chat_id;
      sessionId = chat.session_id;
    }
    if (target.contactId) { contact = await this.getOrFail(orgId, target.contactId); waId = contact.wa_id; }
    if (!waId) return null;
    const group = isGroupJid(waId);
    if (group && !chat && sessionId) chat = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_session_id_chat_id: { organization_id: orgId, session_id: sessionId, chat_id: waId } } });
    if (!contact && !group) {
      contact = await this.prisma.whatsapp_contacts.findFirst({ where: { organization_id: orgId, OR: [{ wa_id: waId }, { lid: waId }, ...(phoneFromJid(waId) ? [{ phone: phoneFromJid(waId) }] : [])] }, orderBy: { saved: 'desc' } });
    }
    const meta: any = (chat?.group_meta as any) || {};
    const cachedId = group ? meta.photo_media_id : contact?.profile_pic_media_id;
    const storedUrl: string | null = group ? meta.photo_url || null : contact?.profile_pic_url || null;
    const checkedAt = group ? (meta.photo_checked_at ? new Date(meta.photo_checked_at).getTime() : 0) : contact?.profile_pic_checked_at ? new Date(contact.profile_pic_checked_at).getTime() : 0;
    let cached: { path: string; mime: string; id: string; sha1?: string | null } | null = null;
    if (cachedId) {
      const m = await this.prisma.whatsapp_media.findUnique({ where: { id: cachedId } });
      if (m && (!m.expires_at || m.expires_at > new Date())) cached = { path: this.media.absPath(m), mime: m.mime, id: m.id, sha1: m.sha1 };
    }
    const fresh = checkedAt && Date.now() - checkedAt < PHOTO_RECHECK_MS;
    if (cached && fresh && !opts.force) return cached;
    const row = await this.sessions.anyReady(orgId, sessionId);
    if (!row?.openwa_session_id) return cached;
    const missKey = `${orgId}|${waId}`;
    const missUntil = this.photoMiss.get(missKey);
    if (!opts.force && missUntil && missUntil > Date.now()) return cached;
    const markChecked = async (url: string | null, mediaId?: string | null) => {
      const now = new Date();
      if (group && chat) await this.prisma.whatsapp_chats.update({ where: { id: chat.id }, data: { group_meta: { ...meta, photo_url: url, photo_checked_at: now.toISOString(), ...(mediaId !== undefined ? { photo_media_id: mediaId } : {}) } } }).catch(() => undefined);
      else if (contact) await this.prisma.whatsapp_contacts.update({ where: { id: contact.id }, data: { profile_pic_url: url, profile_pic_checked_at: now, ...(mediaId !== undefined ? { profile_pic_media_id: mediaId } : {}) } }).catch(() => undefined);
    };
    let buf: Buffer | null = null, mime = 'image/jpeg', url: string | null = null, unchanged = false;
    try {
      await this.photoSlot(async () => {
        if (group) {
          const r: any = await this.openwa.groupPicture(row.openwa_session_id!, waId);
          if (r?.buffer?.length && /^image\//.test(r.mime)) { buf = r.buffer; mime = r.mime; }
          else if (r?.buffer?.length) { const j = JSON.parse(r.buffer.toString('utf8')); if (j?.url) { url = String(j.url); if (cached && storedUrl === url) unchanged = true; else ({ buf, mime } = await this.fetchImage(j.url)); } }
        } else {
          const r = await this.openwa.profilePicture(row.openwa_session_id!, waId);
          url = r?.url ? String(r.url) : null;
          if (url && cached && storedUrl === url) unchanged = true;
          else if (url) ({ buf, mime } = await this.fetchImage(url));
        }
      });
    } catch (e: any) {
      const limited = (e as any)?.status === 429 || /too many/i.test(String(e?.message || ''));
      this.photoMiss.set(missKey, Date.now() + (limited ? 60_000 : 10 * 60_000));
      this.logger.debug(`photo ${waId}: ${e?.message || e}`);
      return cached;
    }
    if (unchanged && cached) {
      await markChecked(url);
      await this.prisma.whatsapp_media.update({ where: { id: cached.id }, data: { expires_at: new Date(Date.now() + 7 * 86_400_000) } }).catch(() => undefined);
      return cached;
    }
    if (!buf || !(buf as Buffer).length) {
      // sem foto de perfil (ou a pessoa removeu a que tinha)
      this.photoMiss.set(missKey, Date.now() + 6 * 3600_000);
      if (this.photoMiss.size > 20_000) this.photoMiss.clear();
      await markChecked(null, cached ? null : undefined);
      return null;
    }
    // grupo: o gateway devolve o binário direto; se é o mesmo arquivo, não troca
    if (group && cached?.sha1 && createHash('sha1').update(buf as Buffer).digest('hex') === cached.sha1) {
      await markChecked(url);
      return cached;
    }
    const m = await this.media.store(orgId, buf, mime, null, 'avatar');
    await this.prisma.whatsapp_media.update({ where: { id: m.id }, data: { expires_at: new Date(Date.now() + 7 * 86_400_000) } });
    if (group && chat) await this.prisma.whatsapp_chats.update({ where: { id: chat.id }, data: { group_meta: { ...meta, photo_media_id: m.id, photo_url: url, photo_checked_at: new Date().toISOString() } } });
    else if (contact) await this.prisma.whatsapp_contacts.update({ where: { id: contact.id }, data: { profile_pic_media_id: m.id, profile_pic_url: url, profile_pic_checked_at: new Date() } });
    else if (!group) {
      // pessoa sem linha de contato ainda → cria pra guardar o cache
      await this.prisma.whatsapp_contacts
        .create({ data: { organization_id: orgId, wa_id: waId, phone: phoneFromJid(waId) || null, source: 'session', profile_pic_media_id: m.id, profile_pic_url: url, profile_pic_checked_at: new Date() } })
        .catch(() => undefined);
    }
    if (cached?.id && cached.id !== m.id) await this.prisma.whatsapp_media.update({ where: { id: cached.id }, data: { expires_at: new Date() } }).catch(() => undefined); // a antiga vence já
    return { path: this.media.absPath(m), mime: m.mime, id: m.id };
  }

  /**
   * Varredura periódica (chamada pelo WhatsAppChatSyncRunner): compara, em lote, a URL atual da foto
   * dos contatos com conversa recente neste número e baixa de novo só as que mudaram.
   * Devolve os jids cuja foto mudou (o runner reemite a conversa para a lista atualizar).
   */
  async refreshPhotos(orgId: string, row: { id: string; openwa_session_id: string | null }, limit = 50): Promise<string[]> {
    if (!row.openwa_session_id) return [];
    const since = new Date(Date.now() - 30 * 86_400_000);
    const stale = new Date(Date.now() - PHOTO_SWEEP_MS);
    const chats = await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, session_id: row.id, kind: 'individual', last_message_at: { gte: since } }, select: { chat_id: true }, orderBy: { last_message_at: 'desc' }, take: 400 });
    if (!chats.length) return [];
    const ids = chats.map((c) => c.chat_id);
    const contacts = await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, wa_id: { in: ids }, profile_pic_media_id: { not: null }, OR: [{ profile_pic_checked_at: null }, { profile_pic_checked_at: { lt: stale } }] }, select: { id: true, wa_id: true, profile_pic_url: true }, take: limit });
    if (!contacts.length) return [];
    let pics: Record<string, string | null> = {};
    try {
      const r = await this.openwa.profilePictures(row.openwa_session_id, contacts.map((c) => c.wa_id));
      pics = r?.pictures || {};
    } catch (e: any) {
      this.logger.debug(`refreshPhotos ${row.id}: ${e?.message || e}`);
      return [];
    }
    const changed: string[] = [];
    const now = new Date();
    for (const c of contacts) {
      const url = pics[c.wa_id] ?? null;
      if (url && url === c.profile_pic_url) {
        await this.prisma.whatsapp_contacts.update({ where: { id: c.id }, data: { profile_pic_checked_at: now } }).catch(() => undefined);
        continue;
      }
      if (!url) {
        // removeu a foto
        await this.prisma.whatsapp_contacts.update({ where: { id: c.id }, data: { profile_pic_media_id: null, profile_pic_url: null, profile_pic_checked_at: now } }).catch(() => undefined);
        changed.push(c.wa_id);
        continue;
      }
      const r = await this.photo(orgId, { jid: c.wa_id, sessionId: row.id }, { force: true }).catch(() => null);
      if (r) changed.push(c.wa_id);
    }
    if (changed.length) this.logger.log(`fotos de perfil atualizadas número=${row.id}: ${changed.length}`);
    return changed;
  }

  private async fetchImage(url: string): Promise<{ buf: Buffer; mime: string }> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { buf: Buffer.from(await res.arrayBuffer()), mime: res.headers.get('content-type') || 'image/jpeg' };
    } finally {
      clearTimeout(t);
    }
  }

  /** O número existe no WhatsApp? (pelo número informado ou qualquer um conectado) */
  async check(orgId: string, id: string, sessionId?: string | null) {
    const c = await this.getOrFail(orgId, id);
    const row = await this.sessions.anyReady(orgId, sessionId);
    if (!row?.openwa_session_id) throw new BadRequestException('Conecte o WhatsApp primeiro.');
    const phone = c.phone || phoneFromJid(c.wa_id);
    if (!phone) return { exists: null, wa_id: c.wa_id };
    try {
      const r = await this.openwa.checkNumber(row.openwa_session_id, phone);
      return { exists: Boolean(r?.exists), wa_id: r?.whatsappId || c.wa_id };
    } catch (e: any) {
      if (e instanceof OpenWaError) throw new BadRequestException(e.message);
      throw e;
    }
  }
}
