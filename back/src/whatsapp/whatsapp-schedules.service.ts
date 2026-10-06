import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../platform-billing/access.service';
import { OpenWaClient, OpenWaError } from './openwa.client';
import { WhatsAppSessionsService, SessionRow, sessionLabel } from './whatsapp-sessions.service';
import { WhatsAppMediaService } from './whatsapp-media.service';
import { WhatsAppContactsService } from './whatsapp-contacts.service';
import { WhatsAppChatService } from './whatsapp-chat.service';
import { fillVars } from './whatsapp-broadcasts.service';
import { WhatsAppCrmService } from './whatsapp-crm.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { digitsOf, isGroupJid, jidFromPhone, normJid, phoneFromJid } from './wa-jid.util';

// Agendamento PONTUAL multi-número: N mensagens para N alvos em data/hora (BRT vindo do front em ISO).
//  - Criação com 1..N números gera UMA linha por número (mesmo `batch_id`): `mode='all'` = cada alvo
//    sai por cada número escolhido; `mode='split'` = alvos repartidos entre os números (round-robin).
//  - Alvo pode ser conversa (uuid → sai pelo número da conversa, mesmo que ele não esteja entre os
//    escolhidos), telefone (distribuído) ou jid de grupo (precisa existir conversa de grupo num número escolhido).
//  - Cada linha guarda `targets = [{chat_id: <jid>, session_id, name, kind}]` e é enviada pelo seu número.
//  - Depois de enviado sai da lista de pendentes (fica no histórico). Não obedece ao aquecimento
//    (é ação humana pontual), mas conta. Pula contatos descadastrados (LGPD).
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JID_RE = /^[^\s@]+@[^\s@]+$/;
const MAX_TARGETS = 200;

type ParsedTarget = { uuid?: string; phone?: string; jid?: string; session_id?: string | null };
type StoredTarget = { chat_id: string; session_id: string; name?: string | null; kind?: string };

@Injectable()
export class WhatsAppSchedulesService {
  private readonly logger = new Logger(WhatsAppSchedulesService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly openwa: OpenWaClient,
    private readonly sessions: WhatsAppSessionsService,
    private readonly media: WhatsAppMediaService,
    private readonly contacts: WhatsAppContactsService,
    private readonly chat: WhatsAppChatService,
    private readonly access: AccessService,
    private readonly presenter: WhatsAppPresenter,
    private readonly crm: WhatsAppCrmService,
  ) {}

  // ---------------------------------------------------------------- normalização
  /** Entrada: string (uuid | telefone só dígitos | jid) ou objeto `{chat_id?: uuid|jid, phone?, jid?, session_id?}`. */
  private parseTargets(raw: unknown): ParsedTarget[] {
    if (!Array.isArray(raw)) return [];
    const out: ParsedTarget[] = [];
    const seen = new Set<string>();
    const add = (t: ParsedTarget) => { const k = `${t.uuid || ''}|${t.phone || ''}|${t.jid || ''}|${t.session_id || ''}`; if (!seen.has(k)) { seen.add(k); out.push(t); } };
    for (const x of raw.slice(0, MAX_TARGETS)) {
      if (typeof x === 'string') {
        const s = x.trim();
        if (UUID_RE.test(s)) add({ uuid: s });
        else if (JID_RE.test(s)) add({ jid: normJid(s) });
        else if (digitsOf(s).length >= 8) add({ phone: digitsOf(s) });
        continue;
      }
      if (!x || typeof x !== 'object') continue;
      const o: any = x;
      const sid = o.session_id ? String(o.session_id) : null;
      const cid = o.chat_id !== undefined && o.chat_id !== null ? String(o.chat_id).trim() : '';
      if (cid && UUID_RE.test(cid)) add({ uuid: cid });
      else if (o.jid && JID_RE.test(String(o.jid))) add({ jid: normJid(String(o.jid).trim()), session_id: sid });
      else if (cid && JID_RE.test(cid)) add({ jid: normJid(cid), session_id: sid });
      else if (o.phone && digitsOf(o.phone).length >= 8) add({ phone: digitsOf(o.phone), session_id: sid });
      else if (cid && digitsOf(cid).length >= 8) add({ phone: digitsOf(cid), session_id: sid });
    }
    return out;
  }
  private normStored(raw: unknown): StoredTarget[] {
    if (!Array.isArray(raw)) return [];
    const out: StoredTarget[] = [];
    const seen = new Set<string>();
    for (const x of raw) {
      if (!x || typeof x !== 'object') continue;
      const o: any = x;
      const jid = String(o.chat_id || o.jid || '').trim();
      const sid = String(o.session_id || '');
      if (!JID_RE.test(jid) || !sid) continue;
      const k = `${sid}|${jid}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ chat_id: jid, session_id: sid, name: o.name ? String(o.name).slice(0, 255) : null, kind: o.kind ? String(o.kind) : isGroupJid(jid) ? 'group' : 'individual' });
    }
    return out.slice(0, MAX_TARGETS);
  }
  private normMessages(raw: unknown) {
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 10).map((m: any) => ({ id: String(m?.id || Math.random().toString(36).slice(2)), text: String(m?.text || '').slice(0, 4096), media_id: m?.media?.id ? String(m.media.id) : m?.media_id ? String(m.media_id) : null, delay_seconds: Math.min(30, Math.max(0, Number(m?.delay_seconds || 0))) })).filter((m: any) => m.text || m.media_id);
  }

  /** Números escolhidos: todos da org e dentro de `allowed` (número alheio = 404, como se não existisse). */
  private async chosenSessions(orgId: string, raw: unknown, allowed: Set<string> | null): Promise<SessionRow[]> {
    const ids = Array.isArray(raw) ? [...new Set(raw.map(String).filter(Boolean))].slice(0, 50) : [];
    if (!ids.length) return [];
    const all = await this.sessions.rowsOf(orgId);
    const out: SessionRow[] = [];
    for (const id of ids) {
      const r = all.find((x) => x.id === id);
      if (!r || (allowed && !allowed.has(id))) throw new NotFoundException('Número não encontrado.');
      out.push(r);
    }
    return out;
  }

  // ---------------------------------------------------------------- resolução de alvos
  /** Contatos da org por jid/telefone (nome, LGPD). */
  private async contactsFor(orgId: string, jids: string[]) {
    const ids = [...new Set(jids)];
    const phones = [...new Set(ids.map(phoneFromJid).filter(Boolean))];
    if (!ids.length) return new Map<string, any>();
    const rows = await this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, OR: [{ wa_id: { in: ids } }, { lid: { in: ids } }, ...(phones.length ? [{ phone: { in: phones } }] : [])] }, select: { wa_id: true, lid: true, phone: true, name: true, push_name: true, opted_out_at: true } });
    const map = new Map<string, any>();
    for (const c of rows) { map.set(c.wa_id, c); if (c.lid) map.set(c.lid, c); if (c.phone) map.set(`${c.phone}@c.us`, c); }
    return map;
  }
  private contactName(c: any, jid: string) {
    return c?.name || c?.push_name || (c?.phone ? `+${c.phone}` : phoneFromJid(jid) ? `+${phoneFromJid(jid)}` : 'Contato');
  }

  /**
   * Monta as linhas (uma por número) a partir dos alvos de entrada.
   * - uuid → número da conversa (mesmo fora dos escolhidos); número fora de `allowed` → 404.
   * - jid de grupo → conversas de grupo com esse jid nos números escolhidos ('all' = em cada um; 'split' = no primeiro); nenhuma → aviso.
   * - telefone / jid individual → 'all' = em cada número escolhido; 'split' = round-robin; com `session_id` no alvo → fixo nele.
   */
  private async resolveLines(orgId: string, parsed: ParsedTarget[], chosen: SessionRow[], mode: 'all' | 'split', allowed: Set<string> | null) {
    const lines = new Map<string, StoredTarget[]>();
    const warnings: string[] = [];
    const sessionCache = new Map<string, SessionRow>(chosen.map((r) => [r.id, r] as [string, SessionRow]));
    const sessionOf = async (sid: string) => { if (!sessionCache.has(sid)) { const r = await this.sessions.rowById(orgId, sid); if (r) sessionCache.set(sid, r); } return sessionCache.get(sid) || null; };
    const push = (sid: string, t: StoredTarget) => {
      const arr = lines.get(sid) || [];
      if (arr.some((x) => x.chat_id === t.chat_id)) return;
      if (arr.length >= MAX_TARGETS) return;
      arr.push(t);
      lines.set(sid, arr);
    };
    const free: ParsedTarget[] = [];
    // 1) conversas (uuid) e grupos (jid)
    const uuids = parsed.filter((t) => t.uuid).map((t) => t.uuid as string);
    const chatRows = uuids.length ? await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, id: { in: uuids } } }) : [];
    for (const t of parsed) {
      if (t.uuid) {
        const row = chatRows.find((c) => c.id === t.uuid);
        if (!row || (allowed && !allowed.has(row.session_id))) throw new NotFoundException('Conversa não encontrada.');
        push(row.session_id, { chat_id: row.chat_id, session_id: row.session_id, name: row.name || null, kind: row.kind });
        continue;
      }
      if (t.jid && isGroupJid(t.jid)) {
        const where: any = { organization_id: orgId, chat_id: t.jid, kind: 'group' };
        if (t.session_id) where.session_id = t.session_id; else if (chosen.length) where.session_id = { in: chosen.map((r) => r.id) };
        const groups = await this.prisma.whatsapp_chats.findMany({ where, orderBy: { last_message_at: 'desc' } });
        const ok = groups.filter((g) => !allowed || allowed.has(g.session_id));
        if (!ok.length) { warnings.push(`Grupo ${t.jid} não encontrado nos números escolhidos.`); continue; }
        for (const g of mode === 'all' ? ok : [ok[0]]) push(g.session_id, { chat_id: g.chat_id, session_id: g.session_id, name: g.name || null, kind: 'group' });
        continue;
      }
      free.push(t);
    }
    // 2) telefones / jids individuais
    if (free.length) {
      const cmap = await this.contactsFor(orgId, free.map((t) => (t.phone ? jidFromPhone(t.phone) : (t.jid as string))));
      let rr = 0;
      for (const t of free) {
        const baseJid = t.phone ? jidFromPhone(t.phone) : (t.jid as string);
        let targetsSessions: SessionRow[];
        if (t.session_id) {
          if (allowed && !allowed.has(t.session_id)) throw new NotFoundException('Número não encontrado.');
          const s = await sessionOf(t.session_id);
          if (!s) throw new NotFoundException('Número não encontrado.');
          targetsSessions = [s];
        } else {
          if (!chosen.length) throw new BadRequestException('Escolha ao menos um número para enviar.');
          targetsSessions = mode === 'all' ? chosen : [chosen[rr++ % chosen.length]];
        }
        const c = cmap.get(baseJid) || (phoneFromJid(baseJid) ? cmap.get(`${phoneFromJid(baseJid)}@c.us`) : null);
        for (const s of targetsSessions) {
          const jid = await this.contacts.canonicalChatId(orgId, s, baseJid).catch(() => baseJid);
          push(s.id, { chat_id: jid, session_id: s.id, name: this.contactName(c, jid), kind: 'individual' });
        }
      }
    }
    return { lines, warnings };
  }

  // ---------------------------------------------------------------- shape
  private async shape(orgId: string, s: any, smap?: Map<string, any>) {
    const sessions = smap || (await this.presenter.sessionMap(orgId));
    const msgs = this.normMessages(s.messages);
    const ids = msgs.map((m) => m.media_id).filter(Boolean) as string[];
    const medias = ids.length ? await this.prisma.whatsapp_media.findMany({ where: { id: { in: ids } } }) : [];
    const mmap = new Map(medias.map((m) => [m.id, m] as [string, any]));
    const stored = this.normStored(s.targets);
    const jids = stored.map((t) => t.chat_id);
    const [chats, cmap] = await Promise.all([
      jids.length ? this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, session_id: s.session_id, chat_id: { in: jids } }, select: { id: true, chat_id: true, name: true, kind: true } }) : [],
      this.contactsFor(orgId, jids.filter((j) => !isGroupJid(j))),
    ]);
    const chmap = new Map(chats.map((c) => [c.chat_id, c] as [string, any]));
    return {
      id: s.id,
      session_id: s.session_id,
      session: sessions.get(s.session_id) || null,
      batch_id: s.batch_id || null,
      mode: s.mode === 'split' ? 'split' : 'all',
      targets: stored.map((t) => {
        const ch = chmap.get(t.chat_id);
        const kind = ch?.kind || t.kind || (isGroupJid(t.chat_id) ? 'group' : 'individual');
        const c = kind === 'group' ? null : cmap.get(t.chat_id);
        const name = ch?.name || c?.name || c?.push_name || t.name || (phoneFromJid(t.chat_id) ? `+${phoneFromJid(t.chat_id)}` : kind === 'group' ? 'Grupo' : 'Contato');
        return { chat_id: ch?.id || null, jid: t.chat_id, name, kind };
      }),
      messages: msgs.map((m) => ({ id: m.id, text: m.text, media: m.media_id ? this.media.toPublic(mmap.get(m.media_id)) : null, delay_seconds: m.delay_seconds })),
      schedule_at: s.schedule_at,
      status: s.status,
      results: Array.isArray(s.results) ? s.results : [],
      error: s.error,
      sent_at: s.sent_at,
      created_by: s.created_by || null,
      created_at: s.created_at,
    };
  }

  // ---------------------------------------------------------------- CRUD
  /** `q.status` pending|history, `q.only` sent|failed|canceled, `q.session_id`, `q.batch_id`, `q.page`, `q.page_size`. Só números em `allowed` (null = todos). */
  async list(orgId: string, q: any = {}, allowed: Set<string> | null = null) {
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(100, Math.max(5, parseInt(String(q.page_size || 20), 10) || 20));
    const history = q.status === 'history';
    const where: any = { organization_id: orgId, status: history ? { in: ['sent', 'failed', 'canceled'] } : { in: ['pending', 'sending'] } };
    if (history && q.only && ['sent', 'failed', 'canceled'].includes(String(q.only))) where.status = String(q.only);
    if (q.batch_id) where.batch_id = String(q.batch_id);
    if (q.session_id) {
      const sid = String(q.session_id);
      if (allowed && !allowed.has(sid)) return { items: [], total: 0, page, pages: 1 };
      where.session_id = sid;
    } else if (allowed) {
      if (!allowed.size) return { items: [], total: 0, page, pages: 1 };
      where.session_id = { in: [...allowed] };
    }
    const [total, rows, smap] = await Promise.all([
      this.prisma.whatsapp_schedules.count({ where }),
      this.prisma.whatsapp_schedules.findMany({ where, orderBy: history ? [{ sent_at: 'desc' }, { schedule_at: 'desc' }] : [{ schedule_at: 'asc' }, { created_at: 'asc' }], skip: (page - 1) * size, take: size }),
      this.presenter.sessionMap(orgId),
    ]);
    const items: any[] = [];
    for (const r of rows) items.push(await this.shape(orgId, r, smap));
    return { items, total, page, pages: Math.max(1, Math.ceil(total / size)) };
  }

  private validate(dto: any, partial = false) {
    const out: any = {};
    if (!partial || dto.messages !== undefined) {
      out.messages = this.normMessages(dto.messages);
      if (!out.messages.length) throw new BadRequestException('Escreva ao menos uma mensagem.');
    }
    if (!partial || dto.schedule_at !== undefined) {
      const d = new Date(String(dto.schedule_at || ''));
      if (Number.isNaN(d.getTime())) throw new BadRequestException('Data/hora inválida.');
      if (d.getTime() < Date.now() - 60_000) throw new BadRequestException('A data/hora já passou.');
      out.schedule_at = d;
    }
    return out;
  }

  /**
   * Cria 1 linha por número (mesmo `batch_id`). Resposta: a 1ª linha (compat) + `batch_id`, `items` (todas) e `warnings`.
   * `dto.session_ids` (1..N), `dto.mode` 'all'|'split', `dto.targets`, `dto.messages`, `dto.schedule_at`.
   */
  async create(orgId: string, userId: string, dto: any, allowed: Set<string> | null = null) {
    const v = this.validate(dto);
    const mode: 'all' | 'split' = dto.mode === 'split' ? 'split' : 'all';
    const parsed = this.parseTargets(dto.targets);
    if (!parsed.length) throw new BadRequestException('Escolha ao menos um contato, conversa ou grupo.');
    const chosen = await this.chosenSessions(orgId, dto.session_ids, allowed);
    const { lines, warnings } = await this.resolveLines(orgId, parsed, chosen, mode, allowed);
    if (!lines.size) throw new BadRequestException(warnings[0] || 'Nenhum destino válido.');
    const batch_id = randomUUID();
    const created: any[] = [];
    for (const [sid, targets] of lines) {
      created.push(await this.prisma.whatsapp_schedules.create({ data: { organization_id: orgId, session_id: sid, batch_id, mode, targets: targets as any, messages: v.messages, schedule_at: v.schedule_at, status: 'pending', created_by: userId, results: warnings.length ? warnings.map((w) => ({ status: 'skipped', error: w })) : undefined } }));
    }
    const smap = await this.presenter.sessionMap(orgId);
    const items: any[] = [];
    for (const r of created) items.push(await this.shape(orgId, r, smap));
    return { ...items[0], batch_id, items, warnings };
  }

  private async pending(orgId: string, id: string, allowed: Set<string> | null) {
    const s = await this.prisma.whatsapp_schedules.findFirst({ where: { id, organization_id: orgId } });
    if (!s || (allowed && !allowed.has(s.session_id))) throw new NotFoundException('Agendamento não encontrado.');
    return s;
  }

  /**
   * Edita UMA linha (pendente): `messages`, `schedule_at`, `targets` (resolvidos só contra o número da linha —
   * conversa de outro número = 400). `apply_to_batch: true` replica messages/schedule_at nas outras linhas pendentes do lote.
   */
  async patch(orgId: string, id: string, dto: any, allowed: Set<string> | null = null) {
    const s = await this.pending(orgId, id, allowed);
    if (s.status !== 'pending') throw new BadRequestException('Só agendamentos pendentes podem ser editados.');
    const v = this.validate(dto, true);
    if (dto.targets !== undefined) {
      const parsed = this.parseTargets(dto.targets);
      if (!parsed.length) throw new BadRequestException('Escolha ao menos um contato, conversa ou grupo.');
      const row = await this.sessions.requireRow(orgId, s.session_id);
      const { lines, warnings } = await this.resolveLines(orgId, parsed, [row], 'all', allowed);
      const others = [...lines.keys()].filter((k) => k !== s.session_id);
      if (others.length) throw new BadRequestException('Conversa de outro número: crie um novo agendamento para ela.');
      const targets = lines.get(s.session_id) || [];
      if (!targets.length) throw new BadRequestException(warnings[0] || 'Nenhum destino válido.');
      v.targets = targets;
      if (warnings.length) v.results = warnings.map((w) => ({ status: 'skipped', error: w }));
    }
    const upd = await this.prisma.whatsapp_schedules.update({ where: { id }, data: v });
    if (dto.apply_to_batch && s.batch_id && (v.messages || v.schedule_at)) {
      await this.prisma.whatsapp_schedules.updateMany({ where: { organization_id: orgId, batch_id: s.batch_id, status: 'pending', id: { not: id } }, data: { ...(v.messages ? { messages: v.messages } : {}), ...(v.schedule_at ? { schedule_at: v.schedule_at } : {}) } });
    }
    return this.shape(orgId, upd);
  }

  async remove(orgId: string, id: string, allowed: Set<string> | null = null) {
    const s = await this.pending(orgId, id, allowed);
    if (s.status === 'pending') { await this.prisma.whatsapp_schedules.update({ where: { id }, data: { status: 'canceled' } }); return { ok: true, canceled: true }; }
    if (s.status === 'sending') throw new BadRequestException('Envio em andamento.');
    await this.prisma.whatsapp_schedules.delete({ where: { id } });
    return { ok: true };
  }

  async sendNow(orgId: string, id: string, allowed: Set<string> | null = null) {
    const s = await this.pending(orgId, id, allowed);
    if (s.status !== 'pending') throw new BadRequestException('Este agendamento já foi processado.');
    await this.process(id);
    return this.shape(orgId, (await this.prisma.whatsapp_schedules.findUnique({ where: { id } }))!);
  }

  // ---------------------------------------------------------------- envio
  // Claim atômico pending→sending; envia pelo NÚMERO da linha para cada destino; grava resultado por destino.
  async process(id: string) {
    const claimed = await this.prisma.whatsapp_schedules.updateMany({ where: { id, status: 'pending' }, data: { status: 'sending' } });
    if (!claimed.count) return;
    const s = (await this.prisma.whatsapp_schedules.findUnique({ where: { id } }))!;
    const orgId = s.organization_id;
    const row = await this.sessions.rowById(orgId, s.session_id);
    const targets = this.normStored(s.targets);
    const msgs = this.normMessages(s.messages);
    // avisos registrados na criação (grupo não encontrado etc.) permanecem no histórico
    const results: any[] = (Array.isArray(s.results) ? (s.results as any[]) : []).filter((r) => r && r.status === 'skipped' && !r.chat_id);
    if (!row?.openwa_session_id || row.status !== 'ready') {
      const label = sessionLabel(row);
      await this.prisma.whatsapp_schedules.update({ where: { id }, data: { status: 'failed', error: `Número "${label}" não conectado no horário`, results: [...results, ...targets.map((t) => ({ chat_id: t.chat_id, name: t.name, status: 'failed', error: 'WhatsApp não conectado' }))] } });
      return;
    }
    const cmap = await this.contactsFor(orgId, targets.filter((t) => !isGroupJid(t.chat_id)).map((t) => t.chat_id));
    const needsCrm = msgs.some((m) => /\{\{\s*cliente\./i.test(String(m.text || '')));
    for (const t of targets) {
      const contact = isGroupJid(t.chat_id) ? null : cmap.get(t.chat_id) || (phoneFromJid(t.chat_id) ? cmap.get(`${phoneFromJid(t.chat_id)}@c.us`) : null);
      const name = t.name || this.contactName(contact, t.chat_id);
      // LGPD: quem pediu para não receber fica de fora dos agendamentos (envio em lote)
      if (contact?.opted_out_at) { results.push({ chat_id: t.chat_id, name, status: 'skipped', error: 'Contato descadastrado (LGPD)' }); continue; }
      // jid canônico deste número (telefone ↔ lid conforme o motor)
      const jid = isGroupJid(t.chat_id) ? t.chat_id : await this.contacts.canonicalChatId(orgId, row, t.chat_id).catch(() => t.chat_id);
      const vars: Record<string, string> = { nome: contact?.name || contact?.push_name || '', name: contact?.name || contact?.push_name || '', telefone: contact?.phone || phoneFromJid(jid), phone: contact?.phone || phoneFromJid(jid) };
      if (needsCrm) Object.assign(vars, await this.crm.varsForChat(orgId, jid, row.id).catch(() => ({})));
      const extra = { scheduled: true, schedule_id: id, ...(s.batch_id ? { batch_id: s.batch_id } : {}) };
      try {
        for (const m of msgs) {
          if (m.delay_seconds) { await this.openwa.typing(row.openwa_session_id, jid, 'typing').catch(() => undefined); await sleep(m.delay_seconds * 1000); }
          const text = fillVars(m.text, vars);
          if (m.media_id) {
            const media = await this.media.readBase64(orgId, m.media_id);
            const kind = media.kind === 'voice' || media.kind === 'audio' ? 'audio' : media.kind === 'image' ? 'image' : media.kind === 'video' ? 'video' : 'document';
            const r = await this.openwa.sendMedia(row.openwa_session_id, kind as any, jid, { base64: media.base64, mimetype: media.mime, filename: media.filename || undefined, caption: text || undefined, ...(media.kind === 'voice' ? { ptt: true } : {}) });
            // grava com session_id, bumpChat e emite no tempo real (sala do número)
            await this.chat.recordOut(row, jid, r as any, { type: media.kind === 'voice' ? 'voice' : kind, body: text || null, media_id: m.media_id, extra });
          } else {
            const r = await this.openwa.sendText(row.openwa_session_id, jid, text);
            await this.chat.recordOut(row, jid, r as any, { type: 'text', body: text, media_id: null, extra });
          }
        }
        results.push({ chat_id: t.chat_id, name, status: 'sent', sent_at: new Date().toISOString() });
      } catch (e: any) {
        results.push({ chat_id: t.chat_id, name, status: 'failed', error: (e instanceof OpenWaError ? e.message : String(e?.message || e)).slice(0, 255) });
      }
      await sleep(1500 + Math.random() * 1500); // ritmo humano entre destinos
    }
    const attempted = results.filter((r) => r.chat_id && r.status !== 'skipped');
    const failed = attempted.filter((r) => r.status === 'failed').length;
    await this.prisma.whatsapp_schedules.update({ where: { id }, data: { status: attempted.length && failed === attempted.length ? 'failed' : 'sent', results, sent_at: new Date(), error: failed ? `${failed} de ${attempted.length} falharam` : null } });
    this.logger.log(`agendamento ${id} (${sessionLabel(row)}) enviado: ${attempted.length - failed}/${attempted.length}`);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.prisma.whatsapp_schedules.findMany({ where: { status: 'pending', schedule_at: { lte: new Date() } }, orderBy: { schedule_at: 'asc' }, take: 20 });
      for (const s of due) {
        if (!(await this.access.isOrgActive(s.organization_id))) continue;
        await this.process(s.id).catch((e) => this.logger.warn(`schedule ${s.id}: ${e?.message || e}`));
      }
    } finally {
      this.running = false;
    }
  }
}
