import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenWaClient, OpenWaError } from './openwa.client';
import { WhatsAppSessionsService } from './whatsapp-sessions.service';
import { WhatsAppMediaService } from './whatsapp-media.service';

// Contatos do WhatsApp da organização.
// - `source='session'`: veio do celular (sync) ou apareceu numa conversa;
// - `saved=true`: guardado NA ORGANIZAÇÃO — sobrevive à troca de número (D6);
// - `wa_id` = jid (`<digitos>@c.us` ou `<id>@lid`); `phone` = só dígitos quando conhecido.

export { digitsOf, jidFromPhone, phoneFromJid, isGroupJid, isLidJid, normJid, hasDeviceSuffix } from './wa-jid.util';
import { digitsOf, jidFromPhone, phoneFromJid, isGroupJid, isLidJid, normJid, hasDeviceSuffix } from './wa-jid.util';

function normTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const t of raw) {
    const v = String(t || '').trim().slice(0, 40);
    if (v && !out.includes(v)) out.push(v);
  }
  return out.slice(0, 30);
}

@Injectable()
export class WhatsAppContactsService {
  private readonly logger = new Logger(WhatsAppContactsService.name);

  constructor(private readonly prisma: PrismaService, private readonly openwa: OpenWaClient, private readonly sessions: WhatsAppSessionsService, private readonly media: WhatsAppMediaService) {}

  private shape(c: any, chatIds?: Map<string, string>) {
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
      chat_id: chatIds ? chatIds.get(c.wa_id) || null : null,
      created_at: c.created_at,
    };
  }

  // Upsert leve usado pelo pipeline de entrada (nunca sobrescreve nome salvo manualmente).
  async touch(orgId: string, waId: string, info: { phone?: string; pushName?: string; name?: string; lid?: string; at?: Date }) {
    if (!waId || isGroupJid(waId)) return null;
    const phone = info.phone ? digitsOf(info.phone) : phoneFromJid(waId);
    const data: any = { last_message_at: info.at || new Date() };
    if (phone) data.phone = phone.slice(0, 32);
    if (info.lid) data.lid = String(info.lid).slice(0, 64);
    if (info.pushName) data.push_name = String(info.pushName).slice(0, 255);
    try {
      const c = await this.prisma.whatsapp_contacts.upsert({
        where: { organization_id_wa_id: { organization_id: orgId, wa_id: waId } },
        create: { organization_id: orgId, wa_id: waId, source: 'session', name: info.name ? String(info.name).slice(0, 255) : null, ...(isLidJid(waId) ? { lid: waId } : {}), ...data },
        update: { ...data, ...(isLidJid(waId) ? { lid: waId } : {}) },
      });
      if (c.lid && c.phone) await this.mergeChats(orgId, c.phone, c.lid).catch(() => undefined);
      return c;
    } catch (e: any) {
      this.logger.warn(`touch contact falhou ${waId}: ${e?.message || e}`);
      return null;
    }
  }

  // O WhatsApp usa <lid>@lid nas conversas; quando a mesma pessoa também existe como
  // <phone>@c.us (chat aberto por telefone / envio antigo), unifica tudo no chat @lid.
  async mergeChats(orgId: string, phone: string, lid: string) {
    const phoneJid = `${digitsOf(phone)}@c.us`;
    if (!digitsOf(phone) || !isLidJid(lid) || phoneJid === lid) return;
    const pc = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: phoneJid } } });
    if (!pc) return;
    const lc = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: lid } } });
    // mensagens: move (ignora colisão de wa_message_id, que já existe no lid)
    const msgs = await this.prisma.whatsapp_messages.findMany({ where: { organization_id: orgId, chat_id: phoneJid }, select: { id: true } });
    for (const m of msgs) await this.prisma.whatsapp_messages.update({ where: { id: m.id }, data: { chat_id: lid } }).catch(() => this.prisma.whatsapp_messages.delete({ where: { id: m.id } }).catch(() => undefined));
    if (lc) {
      const newer = !lc.last_message_at || (pc.last_message_at && pc.last_message_at > lc.last_message_at);
      await this.prisma.whatsapp_chats.update({ where: { id: lc.id }, data: { name: lc.name || pc.name, unread_count: lc.unread_count + pc.unread_count, ...(newer && pc.last_message_at ? { last_message_at: pc.last_message_at, last_message_preview: pc.last_message_preview, last_message_direction: pc.last_message_direction } : {}) } });
      await this.prisma.whatsapp_chats.delete({ where: { id: pc.id } });
    } else {
      await this.prisma.whatsapp_chats.update({ where: { id: pc.id }, data: { chat_id: lid } });
    }
    // contato duplicado (@c.us) some em favor do @lid, preservando salvo/tags/nome
    const dupe = await this.prisma.whatsapp_contacts.findUnique({ where: { organization_id_wa_id: { organization_id: orgId, wa_id: phoneJid } } });
    const keep = await this.prisma.whatsapp_contacts.findUnique({ where: { organization_id_wa_id: { organization_id: orgId, wa_id: lid } } });
    if (dupe && keep && dupe.id !== keep.id) {
      await this.prisma.whatsapp_contacts.update({ where: { id: keep.id }, data: { name: keep.name || dupe.name, saved: keep.saved || dupe.saved, tags: [...new Set([...normTags(keep.tags), ...normTags(dupe.tags)])], notes: keep.notes || dupe.notes, phone: keep.phone || dupe.phone, source: dupe.source === 'manual' || dupe.source === 'import' ? dupe.source : keep.source } });
      await this.prisma.whatsapp_contacts.delete({ where: { id: dupe.id } });
    }
  }

  async mergeAll(orgId: string) {
    const rows = await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, lid: { not: null }, phone: { not: null } }, select: { phone: true, lid: true } });
    let n = 0;
    for (const r of rows) { await this.mergeChats(orgId, r.phone!, r.lid!).catch(() => undefined); n++; }
    return { checked: n };
  }

  // chat_id canônico: se veio <phone>@c.us e conhecemos o lid dessa pessoa, usa o @lid
  async canonicalChatId(orgId: string, chatId: string) {
    const jid = normJid(chatId);
    if (!/@c\.us$/.test(jid)) return jid;
    const c = await this.prisma.whatsapp_contacts.findFirst({ where: { organization_id: orgId, phone: phoneFromJid(jid), lid: { not: null } }, select: { lid: true } });
    return c?.lid || jid;
  }

  async list(orgId: string, q: any = {}) {
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(500, Math.max(5, parseInt(String(q.page_size || 25), 10) || 25));
    const where: any = { organization_id: orgId };
    if (q.saved === '1' || q.saved === 'true') where.saved = true;
    if (q.saved === '0' || q.saved === 'false') where.saved = false;
    if (q.tag) where.tags = { array_contains: String(q.tag) };
    if (q.agenda === '1' || q.agenda === 'true') where.is_my_contact = true;
    if (q.optout === '1' || q.optout === 'true') where.opted_out_at = { not: null };
    if (q.optout === '0' || q.optout === 'false') where.opted_out_at = null;
    if (q.q) {
      const s = String(q.q).trim();
      const d = digitsOf(s);
      where.OR = [{ name: { contains: s } }, { push_name: { contains: s } }, ...(d ? [{ phone: { contains: d } }] : [])];
    }
    const [total, rows, counts, allTags] = await Promise.all([
      this.prisma.whatsapp_contacts.count({ where }),
      this.prisma.whatsapp_contacts.findMany({ where, orderBy: [{ saved: 'desc' }, { is_my_contact: 'desc' }, { last_message_at: 'desc' }, { name: 'asc' }], skip: (page - 1) * size, take: size }),
      this.prisma.whatsapp_contacts.groupBy({ by: ['saved'], where: { organization_id: orgId }, _count: { _all: true } }),
      this.tags(orgId),
    ]);
    const chats = rows.length ? await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, chat_id: { in: rows.map((r) => r.wa_id) } }, select: { chat_id: true } }) : [];
    const chatIds = new Map(chats.map((c) => [c.chat_id, c.chat_id] as [string, string]));
    const saved = counts.find((c) => c.saved)?._count._all || 0;
    const session = counts.find((c) => !c.saved)?._count._all || 0;
    const agenda = await this.prisma.whatsapp_contacts.count({ where: { organization_id: orgId, is_my_contact: true } });
    return { items: rows.map((r) => this.shape(r, chatIds)), total, page, page_size: size, pages: Math.max(1, Math.ceil(total / size)), tags: allTags, counts: { total: saved + session, saved, session, agenda } };
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
    return this.shape(c);
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

  // CSV: phone,name,tags (tags separadas por | ). Aceita ; ou , e BOM.
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

  // Puxa a agenda do celular pelo gateway. Nunca sobrescreve `name` salvo manualmente.
  async sync(orgId: string) {
    const row = await this.sessions.row(orgId);
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
        await this.prisma.whatsapp_contacts.update({ where: { id: existing.id }, data: { ...data, ...(agendaName && !existing.name ? { name: agendaName } : {}) } });
        updated++;
        if (isLidJid(waId) && phone) await this.mergeChats(orgId, phone, waId).catch(() => undefined);
      } else {
        await this.prisma.whatsapp_contacts.create({ data: { organization_id: orgId, wa_id: waId, source: 'session', name: agendaName || null, ...data } });
        imported++;
        if (isLidJid(waId) && phone) await this.mergeChats(orgId, phone, waId).catch(() => undefined);
      }
    }
    return { imported, updated, total: list.length };
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

  // Foto de perfil (contato ou grupo) com cache de 7 dias na pasta protegida.
  // Devolve o caminho absoluto + mime, ou null (sem foto / gateway fora).
  async photo(orgId: string, target: { contactId?: string; chatId?: string }) {
    const row = await this.sessions.row(orgId);
    let waId = target.chatId ? normJid(target.chatId) : '';
    let contact: any = null;
    if (target.contactId) { contact = await this.getOrFail(orgId, target.contactId); waId = contact.wa_id; }
    if (!waId) return null;
    const group = isGroupJid(waId);
    const chat = group ? await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: waId } } }) : null;
    const cachedId = group ? (chat?.group_meta as any)?.photo_media_id : contact?.profile_pic_media_id;
    if (cachedId) {
      const m = await this.prisma.whatsapp_media.findUnique({ where: { id: cachedId } });
      if (m && (!m.expires_at || m.expires_at > new Date())) return { path: this.media.absPath(m), mime: m.mime };
    }
    if (!row?.openwa_session_id || row.status !== 'ready') return null;
    const missKey = `${orgId}|${waId}`;
    const missUntil = this.photoMiss.get(missKey);
    if (missUntil && missUntil > Date.now()) return null;
    let buf: Buffer | null = null, mime = 'image/jpeg';
    try {
      await this.photoSlot(async () => {
        if (group) {
          const r: any = await this.openwa.groupPicture(row.openwa_session_id!, waId);
          if (r?.buffer?.length && /^image\//.test(r.mime)) { buf = r.buffer; mime = r.mime; }
          else if (r?.buffer?.length) { const j = JSON.parse(r.buffer.toString('utf8')); if (j?.url) ({ buf, mime } = await this.fetchImage(j.url)); }
        } else {
          const r = await this.openwa.profilePicture(row.openwa_session_id!, waId);
          if (r?.url) ({ buf, mime } = await this.fetchImage(r.url));
        }
      });
    } catch (e: any) {
      const limited = (e as any)?.status === 429 || /too many/i.test(String(e?.message || ''));
      this.photoMiss.set(missKey, Date.now() + (limited ? 60_000 : 10 * 60_000));
      this.logger.debug(`photo ${waId}: ${e?.message || e}`);
      return null;
    }
    if (!buf || !(buf as Buffer).length) {
      this.photoMiss.set(missKey, Date.now() + 6 * 3600_000); // sem foto de perfil
      if (this.photoMiss.size > 20_000) this.photoMiss.clear();
      return null;
    }
    const m = await this.media.store(orgId, buf, mime, null, 'avatar');
    await this.prisma.whatsapp_media.update({ where: { id: m.id }, data: { expires_at: new Date(Date.now() + 7 * 86_400_000) } });
    if (group && chat) await this.prisma.whatsapp_chats.update({ where: { id: chat.id }, data: { group_meta: { ...((chat.group_meta as any) || {}), photo_media_id: m.id } } });
    else if (contact) await this.prisma.whatsapp_contacts.update({ where: { id: contact.id }, data: { profile_pic_media_id: m.id } });
    else {
      // chat individual sem linha de contato ainda → cria pra guardar o cache
      const c = await this.touch(orgId, waId, {});
      if (c) await this.prisma.whatsapp_contacts.update({ where: { id: c.id }, data: { profile_pic_media_id: m.id } });
    }
    return { path: this.media.absPath(m), mime };
  }

  private async fetchImage(url: string): Promise<{ buf: Buffer | null; mime: string }> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) return { buf: null, mime: '' };
      const mime = res.headers.get('content-type') || 'image/jpeg';
      if (!/^image\//.test(mime)) return { buf: null, mime: '' };
      const buf = Buffer.from(await res.arrayBuffer());
      return { buf: buf.length > 5 * 1024 * 1024 ? null : buf, mime };
    } finally { clearTimeout(t); }
  }

  async check(orgId: string, id: string) {
    const c = await this.getOrFail(orgId, id);
    const row = await this.sessions.row(orgId);
    if (!row?.openwa_session_id || row.status !== 'ready') throw new BadRequestException('Conecte o WhatsApp primeiro.');
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
