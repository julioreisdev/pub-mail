import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../../platform-billing/access.service';
import { cancelCharge, createPixCharge, getChargeStatus } from '../../payments/pix-providers';
import { OpenWaClient } from '../openwa.client';
import { WhatsAppMediaService } from '../whatsapp-media.service';
import { WhatsAppInboundService } from '../whatsapp-inbound.service';
import { WhatsAppContactsService } from '../whatsapp-contacts.service';
import { WhatsAppAttendanceService } from '../whatsapp-attendance.service';
import { WhatsAppPresenter } from '../whatsapp-presenter.service';
import { InboundEvent, WhatsAppHooks } from '../whatsapp-hooks.service';
import { isGroupJid, phoneFromJid } from '../wa-jid.util';
import { WhatsAppCrmService } from '../whatsapp-crm.service';
import {
  BotAction,
  BotContext,
  BotDefinition,
  BotSettings,
  BotState,
  emptyState,
  fillVars,
  formatBRL,
  handleEvent,
  handleInput,
  norm,
  startFlow,
  validateDefinition,
} from './wa-bot.engine';

// Fluxo do Bot do WhatsApp — runtime.
//  - 1 fluxo por organização (whatsapp_bot_flows); estado por conversa (whatsapp_bot_sessions).
//  - Cliente manda mensagem → o bot conduz (atendimento "bot"); atendente responde (painel ou
//    celular) → o bot para naquela conversa; atendimento humano parado há `reset_hours` → a
//    próxima mensagem volta ao bot (regra no WhatsAppAttendanceService).
//  - Cada conversa tem sua própria fila (as respostas do bot saem em ordem, com "digitando…").
//  - Cobrança PIX usa o gateway da própria organização (Configurações → Pagamentos).
//  - O simulador usa o MESMO interpretador, sem enviar nada.

const SIM_CONTACT = { name: 'Cliente Teste', phone: '5511999999999', saved: false };
const MAX_DEF_BYTES = 600_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class WhatsAppBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppBotService.name);
  private readonly flowCache = new Map<string, { at: number; flow: any }>();
  private readonly queues = new Map<string, Promise<void>>();
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private lastPixCheck = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly openwa: OpenWaClient,
    private readonly media: WhatsAppMediaService,
    private readonly inbound: WhatsAppInboundService,
    private readonly contacts: WhatsAppContactsService,
    private readonly attendance: WhatsAppAttendanceService,
    private readonly presenter: WhatsAppPresenter,
    private readonly hooks: WhatsAppHooks,
    private readonly access: AccessService,
    private readonly crm: WhatsAppCrmService,
  ) {}

  onModuleInit() {
    this.hooks.onInbound((e) => this.onInbound(e));
    this.timer = setInterval(() => void this.tick(), 10_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ================================================================ fluxo (CRUD)
  private shape(f: any, stats?: any) {
    return {
      id: f?.id || null,
      name: f?.name || 'Fluxo do bot',
      active: Boolean(f?.active),
      definition: (f?.definition as any) || null,
      settings: (f?.settings as any) || {},
      published_at: f?.published_at || null,
      updated_at: f?.updated_at || null,
      stats: stats || { active_sessions: 0, started_24h: 0, handoffs_24h: 0 },
    };
  }

  private async stats(orgId: string) {
    const since = new Date(Date.now() - 86_400_000);
    const [active_sessions, started_24h, handoffs_24h] = await Promise.all([
      this.prisma.whatsapp_bot_sessions.count({ where: { organization_id: orgId, status: { in: ['active', 'waiting'] } } }),
      this.prisma.whatsapp_service_events.count({ where: { organization_id: orgId, event: 'bot_started', created_at: { gte: since } } }),
      this.prisma.whatsapp_service_events.count({ where: { organization_id: orgId, event: 'handoff', created_at: { gte: since } } }),
    ]);
    return { active_sessions, started_24h, handoffs_24h };
  }

  async get(orgId: string) {
    const f = await this.prisma.whatsapp_bot_flows.findUnique({ where: { organization_id: orgId } });
    return this.shape(f, await this.stats(orgId));
  }

  private cleanDefinition(def: any): BotDefinition {
    if (def == null) return { nodes: [], edges: [] };
    if (typeof def !== 'object' || !Array.isArray(def.nodes) || !Array.isArray(def.edges)) throw new BadRequestException('Definição do fluxo inválida.');
    if (def.nodes.length > 250) throw new BadRequestException('Fluxo grande demais (máximo 250 blocos).');
    if (def.edges.length > 1000) throw new BadRequestException('Ligações demais no fluxo.');
    if (Buffer.byteLength(JSON.stringify(def)) > MAX_DEF_BYTES) throw new BadRequestException('Fluxo grande demais. Use mídias enviadas pelo botão de upload, não imagens coladas.');
    return def as BotDefinition;
  }

  private cleanSettings(s: any): BotSettings {
    const out: any = typeof s === 'object' && s ? { ...s } : {};
    const strArr = (v: any, max = 200) => (Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean).slice(0, max) : []);
    out.audience = { mode: ['all', 'test', 'tags'].includes(out.audience?.mode) ? out.audience.mode : 'test', test_chat_ids: strArr(out.audience?.test_chat_ids, 500), tag_ids: strArr(out.audience?.tag_ids, 50) };
    out.trigger = { mode: out.trigger?.mode === 'keywords' ? 'keywords' : 'any', keywords: strArr(out.trigger?.keywords, 50).map((k) => k.slice(0, 60)) };
    out.restart_keywords = strArr(out.restart_keywords, 20).map((k) => k.slice(0, 40));
    out.exclude_tag_ids = strArr(out.exclude_tag_ids, 50);
    out.input_timeout_hours = Math.min(168, Math.max(1, Number(out.input_timeout_hours) || 24));
    out.max_retries = Math.min(10, Math.max(1, Number(out.max_retries) || 3));
    out.typing = out.typing !== false;
    out.numbering = out.numbering === 'number' ? 'number' : 'emoji';
    out.invalid_option_text = String(out.invalid_option_text || '').slice(0, 1000);
    if (out.business_hours) {
      const bh = out.business_hours;
      out.business_hours = {
        enabled: Boolean(bh.enabled),
        days: typeof bh.days === 'object' && bh.days ? bh.days : {},
        outside_text: String(bh.outside_text || '').slice(0, 1000),
        outside_action: ['message_and_continue', 'message_and_handoff', 'message_only'].includes(bh.outside_action) ? bh.outside_action : 'message_and_continue',
      };
    }
    return out;
  }

  async save(orgId: string, dto: any) {
    const data: any = {};
    if (dto?.name !== undefined) data.name = String(dto.name || 'Fluxo do bot').trim().slice(0, 120) || 'Fluxo do bot';
    if (dto?.definition !== undefined) data.definition = this.cleanDefinition(dto.definition);
    if (dto?.settings !== undefined) data.settings = this.cleanSettings(dto.settings);
    const existing = await this.prisma.whatsapp_bot_flows.findUnique({ where: { organization_id: orgId } });
    // fluxo ativo não pode ser salvo quebrado (o bot estaria respondendo clientes)
    if (existing?.active && data.definition) {
      const errs = validateDefinition(data.definition);
      if (errs.length) throw new BadRequestException(`Corrija antes de salvar (o bot está ativo): ${errs[0]}`);
    }
    // REGRA: o bot SEMPRE nasce desativado (e em modo teste) em qualquer organização.
    // Salvar nunca liga o bot; só POST /whatsapp/bot/active, pelo dono/admin, com confirmação.
    const f = existing
      ? await this.prisma.whatsapp_bot_flows.update({ where: { id: existing.id }, data })
      : await this.prisma.whatsapp_bot_flows.create({ data: { organization_id: orgId, ...data, active: false, settings: data.settings ?? this.cleanSettings({}) } });
    this.flowCache.delete(orgId);
    return this.shape(f, await this.stats(orgId));
  }

  async setActive(orgId: string, active: boolean) {
    const f = await this.prisma.whatsapp_bot_flows.findUnique({ where: { organization_id: orgId } });
    if (!f) throw new BadRequestException('Salve o fluxo antes de ativar.');
    if (active) {
      const errs = validateDefinition(f.definition as any);
      if (errs.length) throw new BadRequestException(errs.join(' '));
    }
    const u = await this.prisma.whatsapp_bot_flows.update({ where: { id: f.id }, data: { active, ...(active ? { published_at: new Date() } : {}) } });
    this.flowCache.delete(orgId);
    if (!active) {
      // pausar = o bot para de conduzir; quem estava no meio do fluxo fica livre
      const running = await this.prisma.whatsapp_bot_sessions.findMany({ where: { organization_id: orgId, status: { in: ['active', 'waiting'] } }, select: { chat_id: true } });
      await this.prisma.whatsapp_bot_sessions.updateMany({ where: { organization_id: orgId, status: { in: ['active', 'waiting'] } }, data: { status: 'stopped', wait_until: null } });
      for (const r of running) {
        const c = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: r.chat_id } } });
        if (c?.service_status === 'bot') await this.attendance.setStatus(orgId, r.chat_id, 'none', { event: 'bot_paused' });
      }
    }
    return this.shape(u, await this.stats(orgId));
  }

  private async activeFlow(orgId: string) {
    const c = this.flowCache.get(orgId);
    if (c && Date.now() - c.at < 10_000) return c.flow;
    const f = await this.prisma.whatsapp_bot_flows.findUnique({ where: { organization_id: orgId } });
    const flow = f?.active ? f : null;
    this.flowCache.set(orgId, { at: Date.now(), flow });
    return flow;
  }

  // ================================================================ simulador
  async simulate(orgId: string, dto: any) {
    const saved = await this.prisma.whatsapp_bot_flows.findUnique({ where: { organization_id: orgId } });
    const def = this.cleanDefinition(dto?.definition ?? saved?.definition ?? null);
    const settings = this.cleanSettings(dto?.settings ?? saved?.settings ?? {});
    const prev: BotState | null = dto?.state && typeof dto.state === 'object' ? { ...emptyState(), ...dto.state } : null;
    const ctx: BotContext = { contact: { ...SIM_CONTACT }, chatTagIds: Array.isArray(dto?.state?.__tags) ? dto.state.__tags : [], now: new Date(), settings };
    let r: { state: BotState; actions: BotAction[] };
    if (prev && dto?.event) r = handleEvent(def, prev, dto.event, ctx);
    else if (prev) r = handleInput(def, prev, String(dto?.input ?? ''), ctx);
    else r = startFlow(def, ctx, dto?.input ?? null);
    // PIX simulado: código fictício pro texto do bloco
    const out: any[] = [];
    const tags = await this.presenter.tagMap(orgId);
    for (const a of r.actions) {
      if (a.type === 'tags') out.push({ type: 'tags', add: a.add.map((id) => tags.get(id) || { id, name: 'Etiqueta removida', color: '#94a3b8' }), remove: a.remove.map((id) => tags.get(id) || { id, name: 'Etiqueta removida', color: '#94a3b8' }) });
      else if (a.type === 'pix') {
        const code = '00020126SIMULADO5204000053039865802BR5913PUB MAIL TESTE6009SAO PAULO';
        r.state.pix = { ...(r.state.pix || { amount_cents: a.amount_cents, description: a.description }), code };
        out.push({ type: 'pix', amount_cents: a.amount_cents, description: a.description, code });
        for (const m of this.pixMessages(a, r.state, ctx, false)) out.push(m);
      } else if (a.type === 'pix_check') out.push({ type: 'info', text: 'O cliente disse que pagou — o bot confere no gateway. No simulador, use “Simular pagamento”.' });
      else out.push(a);
    }
    const state: any = { ...r.state, __tags: ctx.chatTagIds };
    return { actions: out, state, ended: ['done', 'handoff', 'stopped'].includes(r.state.status) };
  }

  /** Mensagens que acompanham a cobrança: texto do bloco + código copia-e-cola separado. */
  private pixMessages(a: Extract<BotAction, { type: 'pix' }>, state: BotState, ctx: BotContext, withTyping = true): BotAction[] {
    const out: BotAction[] = [];
    const text = fillVars(a.text || `Segue o PIX de *{{pix_valor}}* referente a ${a.description}. Copie o código abaixo e pague no app do seu banco 👇`, state, ctx).trim();
    if (text) {
      if (withTyping && ctx.settings.typing !== false) out.push({ type: 'typing', ms: 1200 });
      out.push({ type: 'send', delay_ms: withTyping ? 1200 : 0, message: { kind: 'text', text } });
    }
    if (state.pix?.code && !String(a.text || '').includes('{{pix_codigo}}')) out.push({ type: 'send', delay_ms: 600, message: { kind: 'text', text: state.pix.code } });
    return out;
  }

  // ================================================================ runtime (mensagem do cliente)
  private enqueue(orgId: string, chatId: string, job: () => Promise<void>) {
    const key = `${orgId}|${chatId}`;
    const prev = this.queues.get(key) || Promise.resolve();
    const next = prev
      .catch(() => undefined)
      .then(job)
      .catch((e) => this.logger.warn(`bot ${chatId}: ${e?.message || e}`));
    this.queues.set(key, next);
    void next.finally(() => {
      if (this.queues.get(key) === next) this.queues.delete(key);
    });
    return next;
  }

  private onInbound(e: InboundEvent) {
    if (isGroupJid(e.chatId)) return;
    void this.enqueue(e.orgId, e.chatId, () => this.processInbound(e));
  }

  private async eligible(orgId: string, settings: BotSettings, chat: any) {
    const tags: string[] = Array.isArray(chat.tags) ? chat.tags : [];
    if ((settings.exclude_tag_ids || []).some((t) => tags.includes(t))) return false;
    const mode = settings.audience?.mode || 'test';
    if (mode === 'all') return true;
    if (mode === 'tags') return (settings.audience?.tag_ids || []).some((t) => tags.includes(t));
    const list = settings.audience?.test_chat_ids || [];
    if (list.includes(chat.chat_id)) return true;
    const canon = await Promise.all(list.map((id) => this.contacts.canonicalChatId(orgId, id).catch(() => id)));
    return canon.includes(chat.chat_id);
  }

  private async ctxFor(orgId: string, chat: any, settings: BotSettings): Promise<BotContext> {
    const contact = await this.prisma.whatsapp_contacts.findUnique({ where: { organization_id_wa_id: { organization_id: orgId, wa_id: chat.chat_id } } }).catch(() => null);
    const name = contact?.name || contact?.push_name || (chat.name && !/^\+?\d+$/.test(chat.name) && chat.name !== 'Contato sem nome' ? chat.name : '') || '';
    return {
      contact: { name, phone: contact?.phone || phoneFromJid(chat.chat_id) || '', saved: Boolean(contact?.saved) },
      vars: await this.crm.varsForChat(orgId, chat.chat_id).catch(() => ({})),
      chatTagIds: Array.isArray(chat.tags) ? [...chat.tags] : [],
      now: new Date(),
      settings,
    };
  }

  private stateOf(row: any): BotState {
    const v: any = row?.vars || {};
    return {
      ...emptyState(),
      node_id: row?.node_id || null,
      status: row?.status || 'active',
      waiting_for: v.__waiting_for || null,
      vars: v.vars || {},
      retries: row?.retries || 0,
      wait_until: row?.wait_until ? new Date(row.wait_until).toISOString() : null,
      last_input: v.__last_input || null,
      pix: v.__pix || null,
    };
  }

  private async persist(orgId: string, chatId: string, flowId: string, state: BotState, paymentId?: string | null) {
    const vars = { vars: state.vars, __waiting_for: state.waiting_for, __last_input: state.last_input, __pix: state.pix };
    const data = { flow_id: flowId, node_id: state.node_id, status: state.status, vars, retries: state.retries, wait_until: state.wait_until ? new Date(state.wait_until) : null, ...(paymentId !== undefined ? { payment_id: paymentId } : {}) };
    await this.prisma.whatsapp_bot_sessions.upsert({
      where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } },
      create: { organization_id: orgId, chat_id: chatId, started_at: new Date(), ...data },
      update: data,
    });
  }

  private async processInbound(e: InboundEvent) {
    const { orgId, chatId, message } = e;
    if (!(await this.access.isOrgActive(orgId).catch(() => false))) return;
    const flow = await this.activeFlow(orgId);
    if (!flow) return;
    const def = flow.definition as BotDefinition;
    const settings = this.cleanSettings(flow.settings);
    const chat = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } } });
    if (!chat || chat.kind !== 'individual') return;

    // atendimento humano em andamento: o bot não se mete (a menos que tenha vencido)
    if (chat.service_status === 'human' || chat.service_status === 'waiting') {
      const svc = await this.attendance.settings(orgId);
      if (!this.attendance.expired(chat as any, svc.reset_hours)) return;
      await this.attendance.setStatus(orgId, chatId, 'closed', { event: 'auto_closed', meta: { reset_hours: svc.reset_hours } });
    }
    if (!(await this.eligible(orgId, settings, chat))) return;

    const text = String(message?.body || '').trim();
    const sess = await this.prisma.whatsapp_bot_sessions.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } } });
    const restart = Boolean(text) && (settings.restart_keywords || []).some((k) => norm(k) && norm(text) === norm(k));
    const stale = sess && Date.now() - new Date(sess.updated_at).getTime() > (settings.input_timeout_hours || 24) * 3600_000;
    const ctx = await this.ctxFor(orgId, chat, settings);
    const session = e.session;

    if (sess && ['active', 'waiting'].includes(sess.status) && !stale && !restart && sess.flow_id === flow.id) {
      // mensagem escrita ANTES do bot terminar de responder (cliente mandou várias seguidas)
      // não é resposta ao menu/pergunta — ignora em vez de responder "opção inválida"
      const lastOut = (sess.vars as any)?.__last_out_at ? new Date((sess.vars as any).__last_out_at).getTime() : 0;
      const sentAt = message?.timestamp ? new Date(message.timestamp).getTime() : Date.now();
      if (lastOut && sentAt < lastOut - 1000) return;
      const r = handleInput(def, this.stateOf(sess), text, ctx);
      await this.persist(orgId, chatId, flow.id, r.state);
      await this.execute(orgId, session, chatId, flow.id, r.actions, r.state, ctx);
      return;
    }
    // começa do início (1ª mensagem, conversa que terminou, parou de responder ou pediu "menu")
    if (!restart && settings.trigger?.mode === 'keywords') {
      const n = norm(text);
      const hit = (settings.trigger.keywords || []).some((k) => {
        const kk = norm(k);
        return kk && (n === kk || ` ${n} `.includes(` ${kk} `));
      });
      if (!hit) return;
    }
    await this.begin(orgId, session, chat, flow, def, settings, ctx, text, restart ? 'bot_restarted' : 'bot_started');
  }

  private async begin(orgId: string, session: any, chat: any, flow: any, def: BotDefinition, settings: BotSettings, ctx: BotContext, text: string | null, event: string, actor?: string | null) {
    const r = startFlow(def, ctx, text);
    await this.persist(orgId, chat.chat_id, flow.id, r.state, null);
    await this.attendance.setStatus(orgId, chat.chat_id, 'bot', { event, actor: actor ?? null });
    await this.execute(orgId, session, chat.chat_id, flow.id, r.actions, r.state, ctx);
  }

  // ================================================================ execução das ações
  private async execute(orgId: string, session: any, chatId: string, flowId: string, actions: BotAction[], state: BotState, ctx: BotContext) {
    const sid = session?.openwa_session_id;
    if (!sid || session.status !== 'ready') {
      this.logger.warn(`bot org=${orgId}: WhatsApp desconectado, ações descartadas`);
      return;
    }
    try {
      await this.run(orgId, session, sid, chatId, flowId, actions, state, ctx);
    } finally {
      // marca quando o bot terminou de falar (ver processInbound)
      const row = await this.prisma.whatsapp_bot_sessions.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } } }).catch(() => null);
      if (row) await this.prisma.whatsapp_bot_sessions.update({ where: { id: row.id }, data: { vars: { ...((row.vars as any) || {}), __last_out_at: new Date().toISOString() } } }).catch(() => undefined);
    }
  }

  private async run(orgId: string, session: any, sid: string, chatId: string, flowId: string, actions: BotAction[], state: BotState, ctx: BotContext) {
    for (const a of actions) {
      try {
        switch (a.type) {
          case 'typing':
            await this.openwa.typing(sid, chatId, 'typing').catch(() => undefined);
            break;
          case 'send':
            if (a.delay_ms) await sleep(Math.min(30_000, a.delay_ms));
            await this.send(orgId, sid, chatId, a.message);
            break;
          case 'tags':
            await this.attendance.changeTags(orgId, chatId, a.add, a.remove);
            break;
          case 'save_contact':
            await this.saveContact(orgId, chatId, a.field, a.value);
            break;
          case 'handoff':
            await this.attendance.setStatus(orgId, chatId, a.assign_user_id ? 'human' : 'waiting', { assign: a.assign_user_id || null, event: 'handoff', meta: { by: 'bot' } });
            break;
          case 'close':
            await this.attendance.setStatus(orgId, chatId, 'closed', { event: 'bot_closed' });
            break;
          case 'finish': {
            const c = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } } });
            if (c?.service_status === 'bot') await this.attendance.setStatus(orgId, chatId, 'none', { event: 'bot_finished' });
            break;
          }
          case 'pix':
            await this.createPix(orgId, session, chatId, flowId, a, state, ctx);
            break;
          case 'pix_check':
            await this.checkPixNow(orgId, chatId, true);
            break;
          default:
            break; // set_var / wait / info: estado já persistido
        }
      } catch (e: any) {
        this.logger.warn(`bot ação ${a.type} ${chatId}: ${e?.message || e}`);
      }
    }
  }

  private async send(orgId: string, sid: string, chatId: string, msg: { kind: string; text?: string; media?: any }) {
    let r: any;
    let type = 'text';
    let mediaId: string | null = null;
    if (msg.kind !== 'text' && msg.media?.id) {
      const f = await this.media.readBase64(orgId, String(msg.media.id));
      const kind = f.kind === 'voice' || f.kind === 'audio' ? 'audio' : f.kind === 'image' ? 'image' : f.kind === 'video' ? 'video' : 'document';
      r = await this.openwa.sendMedia(sid, kind as any, chatId, { base64: f.base64, mimetype: f.mime, filename: f.filename || undefined, caption: msg.text || undefined, ...(f.kind === 'voice' ? { ptt: true } : {}) });
      type = f.kind === 'voice' ? 'voice' : kind;
      mediaId = String(msg.media.id);
    } else {
      if (!msg.text) return;
      r = await this.openwa.sendText(sid, chatId, msg.text);
    }
    const at = r?.timestamp ? new Date(Number(r.timestamp) * 1000) : new Date();
    const waId = String(r?.messageId || `bot_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    await this.prisma.whatsapp_messages
      .create({ data: { organization_id: orgId, chat_id: chatId, wa_message_id: waId, direction: 'OUT', type, body: msg.text || null, media_id: mediaId, ack: 1, timestamp: at, extra: { bot: true } } })
      .catch(async (e: any) => {
        // o eco chegou antes: marca como do bot
        if (e?.code === 'P2002') await this.prisma.whatsapp_messages.update({ where: { organization_id_wa_message_id: { organization_id: orgId, wa_message_id: waId } }, data: { extra: { bot: true } } }).catch(() => undefined);
      });
    await this.inbound.bumpChat(orgId, chatId, { type, body: msg.text, direction: 'OUT', at });
    this.presenter.message(orgId, { waId });
  }

  private async saveContact(orgId: string, chatId: string, field: 'name' | 'email', value: string) {
    const c = await this.prisma.whatsapp_contacts.findUnique({ where: { organization_id_wa_id: { organization_id: orgId, wa_id: chatId } } });
    if (!c) return;
    if (field === 'name' && !c.name) await this.prisma.whatsapp_contacts.update({ where: { id: c.id }, data: { name: value.slice(0, 255) } });
    if (field === 'email') {
      const notes = String(c.notes || '');
      if (!notes.toLowerCase().includes(value.toLowerCase())) await this.prisma.whatsapp_contacts.update({ where: { id: c.id }, data: { notes: `${notes ? `${notes}\n` : ''}E-mail: ${value}`.slice(0, 2000) } });
    }
  }

  // ================================================================ PIX
  private webhookUrl(provider: string) {
    const base = String(process.env.PUBLIC_API_URL || 'https://api.reveleonline.com').replace(/\/+$/, '');
    return `${base}/payments/webhook/${provider || 'mercadopago'}`;
  }

  private async createPix(orgId: string, session: any, chatId: string, flowId: string, a: Extract<BotAction, { type: 'pix' }>, state: BotState, ctx: BotContext) {
    const gw = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: orgId } });
    const fail = async (why: string) => {
      this.logger.warn(`bot PIX org=${orgId} ${chatId}: ${why}`);
      await this.send(orgId, session.openwa_session_id, chatId, { kind: 'text', text: 'Não consegui gerar o PIX agora 😕 Vou te passar para um atendente.' });
      await this.attendance.setStatus(orgId, chatId, 'waiting', { event: 'handoff', meta: { by: 'bot', reason: 'pix_failed' } });
      state.status = 'handoff';
      state.waiting_for = null;
      await this.persist(orgId, chatId, flowId, state);
    };
    if (!gw?.active || !gw.access_token) return fail('gateway de pagamento não configurado');
    if (!(a.amount_cents > 0)) return fail('valor inválido');
    const payerRef = createHash('sha1').update(`${orgId}:${chatId}`).digest('hex').slice(0, 12);
    const res = await createPixCharge(gw.provider, gw.access_token, a.amount_cents, a.description, {
      payerRef,
      name: ctx.contact.name || 'Cliente',
      webhookUrl: this.webhookUrl(gw.provider),
      expiresInMin: a.expires_minutes,
      idempotency: `wa-${orgId}-${chatId}-${a.node_id}-${Math.floor(Date.now() / 60000)}`,
    });
    if (!res.ok || !res.chargeId) return fail(res.error || 'gateway recusou');
    const sess = await this.prisma.whatsapp_bot_sessions.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } } });
    const pay = await this.prisma.whatsapp_payments.create({
      data: {
        organization_id: orgId,
        chat_id: chatId,
        bot_session_id: sess?.id || null,
        node_id: a.node_id,
        provider: gw.provider,
        provider_charge_id: res.chargeId,
        amount_cents: a.amount_cents,
        description: a.description.slice(0, 255),
        status: 'PENDING',
        pix_code: res.pixCode || null,
        qr_base64: res.qrBase64 || null,
        expires_at: new Date(Date.now() + a.expires_minutes * 60_000),
        context: { flow_id: flowId },
      },
    });
    state.pix = { amount_cents: a.amount_cents, description: a.description, code: res.pixCode || null, payment_id: pay.id };
    await this.persist(orgId, chatId, flowId, state, pay.id);
    for (const m of this.pixMessages(a, state, ctx)) {
      if (m.type === 'typing') await this.openwa.typing(session.openwa_session_id, chatId, 'typing').catch(() => undefined);
      if (m.type === 'send') {
        if (m.delay_ms) await sleep(m.delay_ms);
        await this.send(orgId, session.openwa_session_id, chatId, m.message);
      }
    }
    if (a.send_qr && res.qrBase64) {
      try {
        const qr = await this.media.storeBase64(orgId, res.qrBase64, 'image/png', 'pix.png', 'image');
        await this.send(orgId, session.openwa_session_id, chatId, { kind: 'image', text: `QR Code do PIX · ${formatBRL(a.amount_cents)}`, media: { id: qr.id } });
      } catch (e: any) {
        this.logger.debug(`QR do PIX: ${e?.message || e}`);
      }
    }
  }

  /** Confere o PIX pendente da conversa no gateway; se pago, continua o fluxo. */
  private async checkPixNow(orgId: string, chatId: string, fromCustomer: boolean) {
    const pay = await this.prisma.whatsapp_payments.findFirst({ where: { organization_id: orgId, chat_id: chatId, status: 'PENDING' }, orderBy: { created_at: 'desc' } });
    if (!pay) return;
    const paid = await this.refreshPayment(pay);
    if (!paid && fromCustomer) {
      const session = await this.prisma.whatsapp_sessions.findUnique({ where: { organization_id: orgId } });
      if (session?.openwa_session_id) await this.send(orgId, session.openwa_session_id, chatId, { kind: 'text', text: 'Ainda não identifiquei o pagamento por aqui. Assim que ele cair eu te aviso 😉' });
    }
  }

  /** Atualiza o status de uma cobrança pelo gateway; retorna true se ficou PAGA agora. */
  private async refreshPayment(pay: any): Promise<boolean> {
    const gw = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: pay.organization_id } });
    if (!gw?.access_token || !pay.provider_charge_id) return false;
    const st = await getChargeStatus(pay.provider, gw.access_token, pay.provider_charge_id);
    if (st.ok && st.status === 'PAID') {
      const u = await this.prisma.whatsapp_payments.updateMany({ where: { id: pay.id, status: 'PENDING' }, data: { status: 'PAID', paid_at: new Date() } });
      if (u.count) await this.resumeAfterPayment(pay.organization_id, pay.chat_id, 'pix_paid');
      return u.count > 0;
    }
    if (pay.expires_at && new Date(pay.expires_at).getTime() < Date.now()) {
      const u = await this.prisma.whatsapp_payments.updateMany({ where: { id: pay.id, status: 'PENDING' }, data: { status: 'EXPIRED' } });
      if (u.count) {
        await cancelCharge(pay.provider, gw.access_token, pay.provider_charge_id).catch(() => undefined);
        await this.resumeAfterPayment(pay.organization_id, pay.chat_id, 'pix_expired');
      }
    }
    return false;
  }

  private async resumeAfterPayment(orgId: string, chatId: string, event: 'pix_paid' | 'pix_expired') {
    await this.enqueue(orgId, chatId, () => this.resume(orgId, chatId, event));
  }

  private async resume(orgId: string, chatId: string, event: 'wait_done' | 'pix_paid' | 'pix_expired') {
    const sess = await this.prisma.whatsapp_bot_sessions.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } } });
    if (!sess || sess.status !== 'waiting' || !sess.flow_id) return;
    const flow = await this.prisma.whatsapp_bot_flows.findUnique({ where: { organization_id: orgId } });
    if (!flow || flow.id !== sess.flow_id) return;
    const chat = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } } });
    if (!chat) return;
    // humano assumiu enquanto o bot esperava → não retoma (o pagamento fica registrado)
    if (chat.service_status === 'human' || chat.service_status === 'waiting') return;
    const settings = this.cleanSettings(flow.settings);
    const ctx = await this.ctxFor(orgId, chat, settings);
    const r = handleEvent(flow.definition as any, this.stateOf(sess), event, ctx);
    await this.persist(orgId, chatId, flow.id, r.state);
    const session = await this.prisma.whatsapp_sessions.findUnique({ where: { organization_id: orgId } });
    await this.execute(orgId, session, chatId, flow.id, r.actions, r.state, ctx);
  }

  /** Webhook único de pagamentos (Configurações → Pagamentos): acha a cobrança do bot. */
  async handleWebhookCharge(provider: string, chargeId: string): Promise<boolean> {
    const pay = await this.prisma.whatsapp_payments.findFirst({ where: { provider_charge_id: String(chargeId), provider } });
    if (!pay) return false;
    if (pay.status === 'PENDING') await this.refreshPayment(pay).catch(() => undefined);
    return true;
  }

  // ================================================================ runner (esperas e PIX)
  private async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const due = await this.prisma.whatsapp_bot_sessions.findMany({ where: { status: 'waiting', wait_until: { lte: new Date() } }, take: 50 });
      for (const s of due) {
        const st = this.stateOf(s);
        if (st.waiting_for !== 'wait') continue;
        if (!(await this.access.isOrgActive(s.organization_id).catch(() => false))) continue;
        void this.enqueue(s.organization_id, s.chat_id, () => this.resume(s.organization_id, s.chat_id, 'wait_done'));
      }
      // PIX pendentes: confere no gateway a cada 30 s (o webhook costuma chegar antes)
      if (Date.now() - this.lastPixCheck > 30_000) {
        this.lastPixCheck = Date.now();
        const pend = await this.prisma.whatsapp_payments.findMany({ where: { status: 'PENDING', created_at: { lt: new Date(Date.now() - 15_000) } }, orderBy: { created_at: 'asc' }, take: 20 });
        for (const p of pend) await this.refreshPayment(p).catch((e) => this.logger.debug(`pix ${p.id}: ${e?.message || e}`));
      }
    } catch (e: any) {
      this.logger.debug(`bot tick: ${e?.message || e}`);
    } finally {
      this.ticking = false;
    }
  }

  // ================================================================ ações do painel
  async startForChat(orgId: string, userId: string, chatId: string) {
    if (isGroupJid(chatId)) throw new BadRequestException('O bot atende só conversas individuais.');
    const flow = await this.prisma.whatsapp_bot_flows.findUnique({ where: { organization_id: orgId } });
    if (!flow?.definition) throw new BadRequestException('Crie o fluxo do bot primeiro (WhatsApp → Fluxo do Bot).');
    const errs = validateDefinition(flow.definition as any);
    if (errs.length) throw new BadRequestException(`O fluxo tem problemas: ${errs[0]}`);
    const session = await this.prisma.whatsapp_sessions.findUnique({ where: { organization_id: orgId } });
    if (!session?.openwa_session_id || session.status !== 'ready') throw new BadRequestException('O WhatsApp não está conectado.');
    const chat = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } } });
    if (!chat) throw new BadRequestException('Conversa não encontrada.');
    const settings = this.cleanSettings(flow.settings);
    const ctx = await this.ctxFor(orgId, chat, settings);
    await this.enqueue(orgId, chatId, () => this.begin(orgId, session, chat, flow, flow.definition as any, settings, ctx, null, 'bot_started', userId));
    const [shaped] = await this.presenter.shapeChats(orgId, [await this.prisma.whatsapp_chats.findUnique({ where: { id: chat.id } })]);
    return shaped;
  }

  async stopForChat(orgId: string, userId: string, chatId: string) {
    await this.attendance.stopBot(orgId, chatId, 'stopped');
    const c = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_chat_id: { organization_id: orgId, chat_id: chatId } } });
    if (!c) throw new BadRequestException('Conversa não encontrada.');
    if (c.service_status === 'bot') await this.attendance.setStatus(orgId, chatId, 'none', { event: 'bot_stopped', actor: userId });
    const [shaped] = await this.presenter.shapeChats(orgId, [await this.prisma.whatsapp_chats.findUnique({ where: { id: c.id } })]);
    return shaped;
  }

  /** Conversas em que o bot está conduzindo agora (monitor). */
  async sessions(orgId: string) {
    const rows = await this.prisma.whatsapp_bot_sessions.findMany({ where: { organization_id: orgId, status: { in: ['active', 'waiting'] } }, orderBy: { updated_at: 'desc' }, take: 100 });
    const chats = await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, chat_id: { in: rows.map((r) => r.chat_id) } } });
    const shaped = await this.presenter.shapeChats(orgId, chats);
    const byId = new Map(shaped.map((c: any) => [c.chat_id, c]));
    return rows.map((r) => ({ chat: byId.get(r.chat_id) || { chat_id: r.chat_id }, node_id: r.node_id, status: r.status, waiting_for: (r.vars as any)?.__waiting_for || null, started_at: r.started_at, updated_at: r.updated_at }));
  }
}
