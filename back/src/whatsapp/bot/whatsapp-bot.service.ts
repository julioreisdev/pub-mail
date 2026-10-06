import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../../platform-billing/access.service';
import { cancelCharge, createPixCharge, getChargeStatus } from '../../payments/pix-providers';
import { OpenWaClient } from '../openwa.client';
import { WhatsAppMediaService } from '../whatsapp-media.service';
import { WhatsAppInboundService } from '../whatsapp-inbound.service';
import { WhatsAppContactsService } from '../whatsapp-contacts.service';
import { ChatKey, WhatsAppAttendanceService } from '../whatsapp-attendance.service';
import { WhatsAppPresenter } from '../whatsapp-presenter.service';
import { InboundEvent, WhatsAppHooks } from '../whatsapp-hooks.service';
import { SessionRow, WhatsAppSessionsService, sessionLabel } from '../whatsapp-sessions.service';
import { WhatsAppChatService } from '../whatsapp-chat.service';
import { WaAccessService, WaUser } from '../wa-access.service';
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

// Fluxo do Bot do WhatsApp — runtime (multi-número).
//  - N fluxos por organização (whatsapp_bot_flows); cada NÚMERO (whatsapp_sessions.bot_flow_id)
//    aponta para 0 ou 1 fluxo; o mesmo fluxo pode estar em vários números.
//  - Bot ativo num número = o número tem `bot_flow_id` E o fluxo tem `active=true`.
//  - Estado por (número, conversa) em whatsapp_bot_sessions; fila por `${org}|${número}|${jid}`.
//  - Cliente manda mensagem → o bot conduz (atendimento "bot"); atendente responde (painel ou
//    celular) → o bot para naquela conversa; atendimento humano parado há `reset_hours` → a
//    próxima mensagem volta ao bot (regra no WhatsAppAttendanceService).
//  - Cobrança PIX usa o gateway da própria organização (Configurações → Pagamentos).
//  - O simulador usa o MESMO interpretador, sem enviar nada.
//  - REGRA do dono: fluxo novo nasce DESATIVADO e em modo teste; salvar nunca liga; ligar só por
//    POST /whatsapp/bot/flows/:id/active (dono/admin) com validação do fluxo.

const SIM_CONTACT = { name: 'Cliente Teste', phone: '5511999999999', saved: false };
const MAX_DEF_BYTES = 600_000;
const MAX_FLOWS_PER_ORG = 50;
const CACHE_MS = 10_000;
const RUNNING = ['active', 'waiting'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class WhatsAppBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppBotService.name);
  private readonly flowCache = new Map<string, { at: number; flow: any }>(); // flowId → linha
  private readonly sessionCache = new Map<string, { at: number; row: SessionRow | null }>(); // `${org}|${sessionId}` → linha do número
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
    private readonly sessions: WhatsAppSessionsService,
    private readonly chat: WhatsAppChatService,
    private readonly waAccess: WaAccessService,
  ) {}

  onModuleInit() {
    this.hooks.onInbound((e) => this.onInbound(e));
    this.timer = setInterval(() => void this.tick(), 10_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ================================================================ caches (10 s)
  private invalidateFlow(flowId: string) {
    this.flowCache.delete(flowId);
  }

  private invalidateOrgSessions(orgId: string) {
    for (const k of [...this.sessionCache.keys()]) if (k.startsWith(`${orgId}|`)) this.sessionCache.delete(k);
  }

  /** Linha do número (whatsapp_sessions) com cache curto — traz `bot_flow_id` e o estado da conexão. */
  private async sessionRow(orgId: string, sessionId: string): Promise<SessionRow | null> {
    if (!sessionId) return null;
    const key = `${orgId}|${sessionId}`;
    const c = this.sessionCache.get(key);
    if (c && Date.now() - c.at < CACHE_MS) return c.row;
    const row = await this.sessions.rowById(orgId, sessionId);
    this.sessionCache.set(key, { at: Date.now(), row });
    return row;
  }

  /** Linha do fluxo (da org) com cache curto; null se não existe. */
  private async flowById(orgId: string, flowId: string | null | undefined) {
    if (!flowId) return null;
    const c = this.flowCache.get(flowId);
    if (c && Date.now() - c.at < CACHE_MS) return c.flow && c.flow.organization_id === orgId ? c.flow : null;
    const f = await this.prisma.whatsapp_bot_flows.findFirst({ where: { id: String(flowId), organization_id: orgId } });
    this.flowCache.set(flowId, { at: Date.now(), flow: f || null });
    return f || null;
  }

  /** Fluxo ATIVO do número (null = sem bot neste número). */
  private async activeFlowForSession(orgId: string, sessionId: string) {
    const row = await this.sessionRow(orgId, sessionId);
    if (!row?.bot_flow_id) return { row, flow: null };
    const flow = await this.flowById(orgId, row.bot_flow_id);
    return { row, flow: flow?.active ? flow : null };
  }

  private async requireFlow(orgId: string, flowId: string) {
    const f = await this.prisma.whatsapp_bot_flows.findFirst({ where: { id: String(flowId || ''), organization_id: orgId } });
    if (!f) throw new NotFoundException('Fluxo não encontrado.');
    return f;
  }

  // ================================================================ fluxos (CRUD)
  private shape(f: any, extra: { sessions?: any[]; stats?: any } = {}, full = false) {
    const base: any = {
      id: f?.id || null,
      name: f?.name || 'Fluxo do bot',
      active: Boolean(f?.active),
      position: f?.position ?? 0,
      published_at: f?.published_at || null,
      updated_at: f?.updated_at || null,
      created_at: f?.created_at || null,
      sessions: extra.sessions || [],
      stats: extra.stats || { active_sessions: 0, started_24h: 0, handoffs_24h: 0 },
    };
    if (full) {
      base.definition = (f?.definition as any) || null;
      base.settings = this.cleanSettings(f?.settings);
    }
    return base;
  }

  /** Números da org por fluxo: flowId → [brief do número]. */
  private async sessionsByFlow(orgId: string) {
    const [rows, smap] = await Promise.all([
      this.prisma.whatsapp_sessions.findMany({ where: { organization_id: orgId, bot_flow_id: { not: null } }, select: { id: true, bot_flow_id: true, position: true }, orderBy: [{ position: 'asc' }, { created_at: 'asc' }] }),
      this.presenter.sessionMap(orgId),
    ]);
    const out = new Map<string, any[]>();
    for (const r of rows) {
      if (!r.bot_flow_id) continue;
      const b = smap.get(r.id) || { id: r.id, label: 'Número', color: null, phone: null, status: 'none', connected: false };
      const list = out.get(r.bot_flow_id) || [];
      list.push({ id: b.id, label: b.label, color: b.color, phone: b.phone, connected: Boolean(b.connected) });
      out.set(r.bot_flow_id, list);
    }
    return out;
  }

  /** Estatísticas por fluxo (conversas em andamento, inícios e transferências nas últimas 24 h). */
  private async statsByFlow(orgId: string, sessionsByFlow: Map<string, any[]>) {
    const since = new Date(Date.now() - 86_400_000);
    const [running, events] = await Promise.all([
      this.prisma.whatsapp_bot_sessions.groupBy({ by: ['flow_id'], where: { organization_id: orgId, status: { in: RUNNING } }, _count: { _all: true } }),
      this.prisma.whatsapp_service_events.findMany({ where: { organization_id: orgId, event: { in: ['bot_started', 'bot_restarted', 'handoff'] }, created_at: { gte: since } }, select: { session_id: true, event: true, meta: true } }),
    ]);
    // número → fluxo atual (fallback para eventos antigos sem `meta.flow_id`)
    const flowOfSession = new Map<string, string>();
    for (const [flowId, list] of sessionsByFlow) for (const s of list) flowOfSession.set(s.id, flowId);
    const stats = new Map<string, { active_sessions: number; started_24h: number; handoffs_24h: number }>();
    const of = (id: string) => {
      let s = stats.get(id);
      if (!s) stats.set(id, (s = { active_sessions: 0, started_24h: 0, handoffs_24h: 0 }));
      return s;
    };
    for (const r of running) if (r.flow_id) of(r.flow_id).active_sessions += r._count._all;
    for (const e of events) {
      const flowId = (e.meta as any)?.flow_id || (e.session_id ? flowOfSession.get(e.session_id) : null);
      if (!flowId) continue;
      if (e.event === 'handoff') of(flowId).handoffs_24h += 1;
      else of(flowId).started_24h += 1;
    }
    return stats;
  }

  /** Lista de fluxos da org com os números que usam cada um + estatísticas. */
  async listFlows(orgId: string) {
    const flows = await this.prisma.whatsapp_bot_flows.findMany({ where: { organization_id: orgId }, orderBy: [{ position: 'asc' }, { created_at: 'asc' }] });
    const byFlow = await this.sessionsByFlow(orgId);
    const stats = await this.statsByFlow(orgId, byFlow);
    return flows.map((f) => this.shape(f, { sessions: byFlow.get(f.id) || [], stats: stats.get(f.id) }));
  }

  /** Compatibilidade: `{ flows, sessions }` (números com fluxo atribuído). */
  async get(orgId: string) {
    const [flows, rows, smap] = await Promise.all([
      this.listFlows(orgId),
      this.prisma.whatsapp_sessions.findMany({ where: { organization_id: orgId }, select: { id: true, bot_flow_id: true }, orderBy: [{ position: 'asc' }, { created_at: 'asc' }] }),
      this.presenter.sessionMap(orgId),
    ]);
    const active = new Set(flows.filter((f) => f.active).map((f) => f.id));
    return {
      flows,
      sessions: rows.map((r) => ({ ...(smap.get(r.id) || { id: r.id, label: 'Número', color: null, phone: null, status: 'none', connected: false }), bot_flow_id: r.bot_flow_id, bot_active: Boolean(r.bot_flow_id && active.has(r.bot_flow_id)) })),
    };
  }

  async getFlow(orgId: string, flowId: string) {
    const f = await this.requireFlow(orgId, flowId);
    const byFlow = await this.sessionsByFlow(orgId);
    const stats = await this.statsByFlow(orgId, byFlow);
    return this.shape(f, { sessions: byFlow.get(f.id) || [], stats: stats.get(f.id) }, true);
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

  private cleanName(v: any, fallback = 'Fluxo do bot') {
    return String(v ?? '').trim().slice(0, 120) || fallback;
  }

  /** Cria um fluxo (ou clona `clone_of`). SEMPRE nasce desativado e com público em modo teste. */
  async createFlow(orgId: string, dto: { name?: string; definition?: any; settings?: any; clone_of?: string } = {}) {
    const count = await this.prisma.whatsapp_bot_flows.count({ where: { organization_id: orgId } });
    if (count >= MAX_FLOWS_PER_ORG) throw new BadRequestException(`Limite de ${MAX_FLOWS_PER_ORG} fluxos por organização.`);
    let definition: any = dto.definition !== undefined ? this.cleanDefinition(dto.definition) : null;
    let settings: any = dto.settings !== undefined ? this.cleanSettings(dto.settings) : null;
    let name = dto.name !== undefined ? this.cleanName(dto.name) : null;
    if (dto.clone_of) {
      const src = await this.requireFlow(orgId, dto.clone_of);
      if (definition === null) definition = (src.definition as any) || null;
      if (settings === null) settings = this.cleanSettings(src.settings);
      if (name === null) name = this.cleanName(`${src.name} (cópia)`);
    }
    settings = settings || this.cleanSettings({});
    // REGRA: fluxo novo nasce em modo teste (só os contatos escolhidos), mesmo quando clonado
    settings.audience = { ...settings.audience, mode: 'test' };
    const last = await this.prisma.whatsapp_bot_flows.aggregate({ where: { organization_id: orgId }, _max: { position: true } });
    const f = await this.prisma.whatsapp_bot_flows.create({
      data: { organization_id: orgId, name: name || (count ? `Fluxo do bot ${count + 1}` : 'Fluxo do bot'), definition: definition ?? undefined, settings, active: false, position: (last._max.position ?? -1) + 1 },
    });
    return this.getFlow(orgId, f.id);
  }

  /** Salva nome/definição/configurações. Nunca liga o bot; fluxo ativo não pode ser salvo quebrado. */
  async updateFlow(orgId: string, flowId: string, dto: { name?: string; definition?: any; settings?: any } = {}) {
    const existing = await this.requireFlow(orgId, flowId);
    const data: any = {};
    if (dto.name !== undefined) data.name = this.cleanName(dto.name);
    if (dto.definition !== undefined) data.definition = this.cleanDefinition(dto.definition);
    if (dto.settings !== undefined) data.settings = this.cleanSettings(dto.settings);
    if (existing.active && data.definition) {
      const errs = validateDefinition(data.definition);
      if (errs.length) throw new BadRequestException(`Corrija antes de salvar (o bot está ativo): ${errs[0]}`);
    }
    if (Object.keys(data).length) await this.prisma.whatsapp_bot_flows.update({ where: { id: existing.id }, data });
    this.invalidateFlow(existing.id);
    return this.getFlow(orgId, existing.id);
  }

  /**
   * Para o bot nas conversas em andamento que casam com `where` (bot_sessions) e libera as
   * conversas que estavam em atendimento "bot" (service_status → none, evento `event`).
   */
  private async stopRunning(orgId: string, where: { flow_id?: any; session_id?: any }, event: string, meta?: any) {
    const running = await this.prisma.whatsapp_bot_sessions.findMany({ where: { organization_id: orgId, status: { in: RUNNING }, ...where }, select: { session_id: true, chat_id: true } });
    if (!running.length) return 0;
    await this.prisma.whatsapp_bot_sessions.updateMany({ where: { organization_id: orgId, status: { in: RUNNING }, ...where }, data: { status: 'stopped', wait_until: null } });
    for (const r of running) {
      const key: ChatKey = { session_id: r.session_id, chat_id: r.chat_id };
      const c = await this.prisma.whatsapp_chats.findUnique({ where: { organization_id_session_id_chat_id: { organization_id: orgId, ...key } } }).catch(() => null);
      if (c?.service_status === 'bot') await this.attendance.setStatus(orgId, key, 'none', { event, meta }).catch((e) => this.logger.warn(`liberar conversa ${r.chat_id}: ${e?.message || e}`));
    }
    return running.length;
  }

  /** Apaga o fluxo: tira dos números que o usam e para as conversas que ele conduzia. */
  async removeFlow(orgId: string, flowId: string) {
    const f = await this.requireFlow(orgId, flowId);
    await this.stopRunning(orgId, { flow_id: f.id }, 'bot_paused', { flow_id: f.id, reason: 'flow_deleted' });
    await this.prisma.whatsapp_sessions.updateMany({ where: { organization_id: orgId, bot_flow_id: f.id }, data: { bot_flow_id: null } });
    await this.prisma.whatsapp_bot_flows.delete({ where: { id: f.id } });
    this.invalidateFlow(f.id);
    this.invalidateOrgSessions(orgId);
    return { ok: true, id: f.id };
  }

  /** Liga/desliga o fluxo (dono/admin). Ligar valida o fluxo; desligar libera as conversas. */
  async setActive(orgId: string, flowId: string, active: boolean) {
    const f = await this.requireFlow(orgId, flowId);
    if (active) {
      const errs = validateDefinition(f.definition as any);
      if (errs.length) throw new BadRequestException(errs.join(' '));
    }
    await this.prisma.whatsapp_bot_flows.update({ where: { id: f.id }, data: { active, ...(active ? { published_at: new Date() } : {}) } });
    this.invalidateFlow(f.id);
    if (!active) await this.stopRunning(orgId, { flow_id: f.id }, 'bot_paused', { flow_id: f.id });
    return this.getFlow(orgId, f.id);
  }

  /** Atribui o fluxo a esses números (e tira dos demais que o usavam). Os números precisam ser da org e liberados ao usuário. */
  async assignSessions(orgId: string, user: WaUser, flowId: string, sessionIds: string[]) {
    const f = await this.requireFlow(orgId, flowId);
    const ids = [...new Set((Array.isArray(sessionIds) ? sessionIds : []).map((x) => String(x || '').trim()).filter(Boolean))];
    for (const id of ids) {
      await this.sessions.requireRow(orgId, id);
      await this.waAccess.assertSession(user, id);
    }
    const current = await this.prisma.whatsapp_sessions.findMany({ where: { organization_id: orgId, bot_flow_id: f.id }, select: { id: true } });
    const removed = current.map((c) => c.id).filter((id) => !ids.includes(id));
    // quem perde o fluxo: usuário restrito só pode mexer em números dele
    for (const id of removed) await this.waAccess.assertSession(user, id);
    await this.prisma.$transaction([
      this.prisma.whatsapp_sessions.updateMany({ where: { organization_id: orgId, bot_flow_id: f.id, ...(ids.length ? { id: { notIn: ids } } : {}) }, data: { bot_flow_id: null } }),
      ...(ids.length ? [this.prisma.whatsapp_sessions.updateMany({ where: { organization_id: orgId, id: { in: ids } }, data: { bot_flow_id: f.id } })] : []),
    ]);
    this.invalidateOrgSessions(orgId);
    // números que deixaram este fluxo: conversas que ele conduzia param
    if (removed.length) await this.stopRunning(orgId, { flow_id: f.id, session_id: { in: removed } }, 'bot_paused', { flow_id: f.id, reason: 'unassigned' });
    // números que trocaram de fluxo: conversas do fluxo antigo param (o novo começa na próxima mensagem)
    if (ids.length) await this.stopRunning(orgId, { session_id: { in: ids }, flow_id: { not: f.id } }, 'bot_paused', { flow_id: f.id, reason: 'flow_changed' });
    return this.getFlow(orgId, f.id);
  }

  // ================================================================ simulador
  async simulate(orgId: string, dto: any) {
    const saved = dto?.flow_id ? await this.requireFlow(orgId, dto.flow_id) : null;
    if (dto?.definition === undefined && !saved) throw new BadRequestException('Informe flow_id ou definition para simular.');
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
    return { actions: out, state, ended: ['done', 'handoff', 'stopped'].includes(r.state.status), flow_id: saved?.id || null };
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
  private enqueue(orgId: string, sessionId: string, jid: string, job: () => Promise<void>) {
    const key = `${orgId}|${sessionId}|${jid}`;
    const prev = this.queues.get(key) || Promise.resolve();
    const next = prev
      .catch(() => undefined)
      .then(job)
      .catch((e) => this.logger.warn(`bot ${jid}: ${e?.message || e}`));
    this.queues.set(key, next);
    void next.finally(() => {
      if (this.queues.get(key) === next) this.queues.delete(key);
    });
    return next;
  }

  private onInbound(e: InboundEvent) {
    if (!e?.sessionId || isGroupJid(e.chatId)) return;
    void this.enqueue(e.orgId, e.sessionId, e.chatId, () => this.processInbound(e));
  }

  private keyOf(chat: { session_id: string; chat_id: string }): ChatKey {
    return { session_id: chat.session_id, chat_id: chat.chat_id };
  }

  private chatWhere(orgId: string, k: ChatKey) {
    return { organization_id_session_id_chat_id: { organization_id: orgId, session_id: k.session_id, chat_id: k.chat_id } };
  }

  private async findChat(orgId: string, k: ChatKey) {
    return this.prisma.whatsapp_chats.findUnique({ where: this.chatWhere(orgId, k) });
  }

  private async findBotSession(orgId: string, k: ChatKey) {
    return this.prisma.whatsapp_bot_sessions.findUnique({ where: this.chatWhere(orgId, k) });
  }

  private async eligible(orgId: string, session: SessionRow, settings: BotSettings, chat: any) {
    const tags: string[] = Array.isArray(chat.tags) ? chat.tags : [];
    if ((settings.exclude_tag_ids || []).some((t) => tags.includes(t))) return false;
    const mode = settings.audience?.mode || 'test';
    if (mode === 'all') return true;
    if (mode === 'tags') return (settings.audience?.tag_ids || []).some((t) => tags.includes(t));
    const list = settings.audience?.test_chat_ids || [];
    if (list.includes(chat.chat_id) || list.includes(chat.id)) return true;
    const canon = await Promise.all(list.map((id) => this.contacts.canonicalChatId(orgId, session, id).catch(() => id)));
    return canon.includes(chat.chat_id);
  }

  private async ctxFor(orgId: string, chat: any, settings: BotSettings): Promise<BotContext> {
    const contact = await this.prisma.whatsapp_contacts.findUnique({ where: { organization_id_wa_id: { organization_id: orgId, wa_id: chat.chat_id } } }).catch(() => null);
    const name = contact?.name || contact?.push_name || (chat.name && !/^\+?\d+$/.test(chat.name) && chat.name !== 'Contato sem nome' ? chat.name : '') || '';
    return {
      contact: { name, phone: contact?.phone || phoneFromJid(chat.chat_id) || '', saved: Boolean(contact?.saved) },
      vars: await this.crm.varsForChat(orgId, chat.id).catch(() => ({})),
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

  private async persist(orgId: string, k: ChatKey, flowId: string, state: BotState, paymentId?: string | null) {
    const vars = { vars: state.vars, __waiting_for: state.waiting_for, __last_input: state.last_input, __pix: state.pix };
    const data = { flow_id: flowId, node_id: state.node_id, status: state.status, vars, retries: state.retries, wait_until: state.wait_until ? new Date(state.wait_until) : null, ...(paymentId !== undefined ? { payment_id: paymentId } : {}) };
    await this.prisma.whatsapp_bot_sessions.upsert({
      where: this.chatWhere(orgId, k),
      create: { organization_id: orgId, session_id: k.session_id, chat_id: k.chat_id, started_at: new Date(), ...data },
      update: data,
    });
  }

  private async processInbound(e: InboundEvent) {
    const { orgId, sessionId, chatId, message } = e;
    if (!(await this.access.isOrgActive(orgId).catch(() => false))) return;
    const { row, flow } = await this.activeFlowForSession(orgId, sessionId);
    if (!flow) return;
    const session: SessionRow = row || e.session;
    const def = flow.definition as BotDefinition;
    const settings = this.cleanSettings(flow.settings);
    const key: ChatKey = { session_id: sessionId, chat_id: chatId };
    const chat = await this.findChat(orgId, key);
    if (!chat || chat.kind !== 'individual') return;

    // atendimento humano em andamento: o bot não se mete (a menos que tenha vencido)
    if (chat.service_status === 'human' || chat.service_status === 'waiting') {
      const svc = await this.attendance.settings(orgId);
      if (!this.attendance.expired(chat as any, svc.reset_hours)) return;
      await this.attendance.setStatus(orgId, key, 'closed', { event: 'auto_closed', meta: { reset_hours: svc.reset_hours } });
    }
    if (!(await this.eligible(orgId, session, settings, chat))) return;

    const text = String(message?.body || '').trim();
    const sess = await this.findBotSession(orgId, key);
    const restart = Boolean(text) && (settings.restart_keywords || []).some((k) => norm(k) && norm(text) === norm(k));
    const stale = sess && Date.now() - new Date(sess.updated_at).getTime() > (settings.input_timeout_hours || 24) * 3600_000;
    const ctx = await this.ctxFor(orgId, chat, settings);

    if (sess && RUNNING.includes(sess.status) && !stale && !restart && sess.flow_id === flow.id) {
      // mensagem escrita ANTES do bot terminar de responder (cliente mandou várias seguidas)
      // não é resposta ao menu/pergunta — ignora em vez de responder "opção inválida"
      const lastOut = (sess.vars as any)?.__last_out_at ? new Date((sess.vars as any).__last_out_at).getTime() : 0;
      const sentAt = message?.timestamp ? new Date(message.timestamp).getTime() : Date.now();
      if (lastOut && sentAt < lastOut - 1000) return;
      const r = handleInput(def, this.stateOf(sess), text, ctx);
      await this.persist(orgId, key, flow.id, r.state);
      await this.execute(orgId, session, key, flow.id, r.actions, r.state, ctx);
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

  private async begin(orgId: string, session: SessionRow, chat: any, flow: any, def: BotDefinition, settings: BotSettings, ctx: BotContext, text: string | null, event: string, actor?: string | null) {
    const key = this.keyOf(chat);
    const r = startFlow(def, ctx, text);
    await this.persist(orgId, key, flow.id, r.state, null);
    await this.attendance.setStatus(orgId, key, 'bot', { event, actor: actor ?? null, meta: { flow_id: flow.id } });
    await this.execute(orgId, session, key, flow.id, r.actions, r.state, ctx);
  }

  // ================================================================ execução das ações
  private async execute(orgId: string, session: SessionRow, k: ChatKey, flowId: string, actions: BotAction[], state: BotState, ctx: BotContext) {
    const sid = session?.openwa_session_id;
    if (!sid || session.status !== 'ready') {
      this.logger.warn(`bot org=${orgId} número=${sessionLabel(session)}: WhatsApp desconectado, ações descartadas`);
      return;
    }
    try {
      await this.run(orgId, session, k, flowId, actions, state, ctx);
    } finally {
      // marca quando o bot terminou de falar (ver processInbound)
      const row = await this.findBotSession(orgId, k).catch(() => null);
      if (row) await this.prisma.whatsapp_bot_sessions.update({ where: { id: row.id }, data: { vars: { ...((row.vars as any) || {}), __last_out_at: new Date().toISOString() } } }).catch(() => undefined);
    }
  }

  private async run(orgId: string, session: SessionRow, k: ChatKey, flowId: string, actions: BotAction[], state: BotState, ctx: BotContext) {
    const sid = String(session.openwa_session_id);
    const jid = k.chat_id;
    for (const a of actions) {
      try {
        switch (a.type) {
          case 'typing':
            await this.openwa.typing(sid, jid, 'typing').catch(() => undefined);
            break;
          case 'send':
            if (a.delay_ms) await sleep(Math.min(30_000, a.delay_ms));
            await this.send(orgId, session, jid, a.message);
            break;
          case 'tags':
            await this.attendance.changeTags(orgId, k, a.add, a.remove);
            break;
          case 'save_contact':
            await this.saveContact(orgId, jid, a.field, a.value);
            break;
          case 'handoff':
            await this.attendance.setStatus(orgId, k, a.assign_user_id ? 'human' : 'waiting', { assign: a.assign_user_id || null, event: 'handoff', meta: { by: 'bot', flow_id: flowId } });
            break;
          case 'close':
            await this.attendance.setStatus(orgId, k, 'closed', { event: 'bot_closed', meta: { flow_id: flowId } });
            break;
          case 'finish': {
            const c = await this.findChat(orgId, k);
            if (c?.service_status === 'bot') await this.attendance.setStatus(orgId, k, 'none', { event: 'bot_finished', meta: { flow_id: flowId } });
            break;
          }
          case 'pix':
            await this.createPix(orgId, session, k, flowId, a, state, ctx);
            break;
          case 'pix_check':
            await this.checkPixNow(orgId, session, k, true);
            break;
          default:
            break; // set_var / wait / info: estado já persistido
        }
      } catch (e: any) {
        this.logger.warn(`bot ação ${a.type} ${jid}: ${e?.message || e}`);
      }
    }
  }

  /** Envia pelo NÚMERO da conversa e grava a mensagem OUT marcada `extra.bot` (com `session_id`). */
  private async send(orgId: string, session: SessionRow, jid: string, msg: { kind: string; text?: string; media?: any }) {
    const sid = String(session.openwa_session_id);
    const sessionId = String(session.id);
    let r: any;
    let type = 'text';
    let mediaId: string | null = null;
    if (msg.kind !== 'text' && msg.media?.id) {
      const f = await this.media.readBase64(orgId, String(msg.media.id));
      const kind = f.kind === 'voice' || f.kind === 'audio' ? 'audio' : f.kind === 'image' ? 'image' : f.kind === 'video' ? 'video' : 'document';
      r = await this.openwa.sendMedia(sid, kind as any, jid, { base64: f.base64, mimetype: f.mime, filename: f.filename || undefined, caption: msg.text || undefined, ...(f.kind === 'voice' ? { ptt: true } : {}) });
      type = f.kind === 'voice' ? 'voice' : kind;
      mediaId = String(msg.media.id);
    } else {
      if (!msg.text) return;
      r = await this.openwa.sendText(sid, jid, msg.text);
    }
    const at = r?.timestamp ? new Date(Number(r.timestamp) * 1000) : new Date();
    const waId = String(r?.messageId || `bot_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    await this.prisma.whatsapp_messages
      .create({ data: { organization_id: orgId, session_id: sessionId, chat_id: jid, wa_message_id: waId, direction: 'OUT', type, body: msg.text || null, media_id: mediaId, ack: 1, timestamp: at, extra: { bot: true } } })
      .catch(async (e: any) => {
        // o eco chegou antes: marca como do bot
        if (e?.code === 'P2002') await this.prisma.whatsapp_messages.update({ where: { organization_id_session_id_wa_message_id: { organization_id: orgId, session_id: sessionId, wa_message_id: waId } }, data: { extra: { bot: true } } }).catch(() => undefined);
      });
    await this.inbound.bumpChat(orgId, sessionId, jid, { type, body: msg.text, direction: 'OUT', at });
    this.presenter.message(orgId, { waId, sessionId });
  }

  private async saveContact(orgId: string, jid: string, field: 'name' | 'email', value: string) {
    const c = await this.prisma.whatsapp_contacts.findUnique({ where: { organization_id_wa_id: { organization_id: orgId, wa_id: jid } } });
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

  private async createPix(orgId: string, session: SessionRow, k: ChatKey, flowId: string, a: Extract<BotAction, { type: 'pix' }>, state: BotState, ctx: BotContext) {
    const jid = k.chat_id;
    const gw = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: orgId } });
    const fail = async (why: string) => {
      this.logger.warn(`bot PIX org=${orgId} ${jid}: ${why}`);
      await this.send(orgId, session, jid, { kind: 'text', text: 'Não consegui gerar o PIX agora 😕 Vou te passar para um atendente.' });
      await this.attendance.setStatus(orgId, k, 'waiting', { event: 'handoff', meta: { by: 'bot', reason: 'pix_failed', flow_id: flowId } });
      state.status = 'handoff';
      state.waiting_for = null;
      await this.persist(orgId, k, flowId, state);
    };
    if (!gw?.active || !gw.access_token) return fail('gateway de pagamento não configurado');
    if (!(a.amount_cents > 0)) return fail('valor inválido');
    const payerRef = createHash('sha1').update(`${orgId}:${jid}`).digest('hex').slice(0, 12);
    const res = await createPixCharge(gw.provider, gw.access_token, a.amount_cents, a.description, {
      payerRef,
      name: ctx.contact.name || 'Cliente',
      webhookUrl: this.webhookUrl(gw.provider),
      expiresInMin: a.expires_minutes,
      idempotency: `wa-${orgId}-${k.session_id}-${jid}-${a.node_id}-${Math.floor(Date.now() / 60000)}`,
    });
    if (!res.ok || !res.chargeId) return fail(res.error || 'gateway recusou');
    const sess = await this.findBotSession(orgId, k);
    const pay = await this.prisma.whatsapp_payments.create({
      data: {
        organization_id: orgId,
        session_id: k.session_id,
        chat_id: jid,
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
        context: { flow_id: flowId, session_id: k.session_id },
      },
    });
    state.pix = { amount_cents: a.amount_cents, description: a.description, code: res.pixCode || null, payment_id: pay.id };
    await this.persist(orgId, k, flowId, state, pay.id);
    for (const m of this.pixMessages(a, state, ctx)) {
      if (m.type === 'typing') await this.openwa.typing(String(session.openwa_session_id), jid, 'typing').catch(() => undefined);
      if (m.type === 'send') {
        if (m.delay_ms) await sleep(m.delay_ms);
        await this.send(orgId, session, jid, m.message);
      }
    }
    if (a.send_qr && res.qrBase64) {
      try {
        const qr = await this.media.storeBase64(orgId, res.qrBase64, 'image/png', 'pix.png', 'image');
        await this.send(orgId, session, jid, { kind: 'image', text: `QR Code do PIX · ${formatBRL(a.amount_cents)}`, media: { id: qr.id } });
      } catch (e: any) {
        this.logger.debug(`QR do PIX: ${e?.message || e}`);
      }
    }
  }

  /** Confere o PIX pendente da conversa (deste número) no gateway; se pago, continua o fluxo. */
  private async checkPixNow(orgId: string, session: SessionRow, k: ChatKey, fromCustomer: boolean) {
    const pay = await this.prisma.whatsapp_payments.findFirst({ where: { organization_id: orgId, session_id: k.session_id, chat_id: k.chat_id, status: 'PENDING' }, orderBy: { created_at: 'desc' } });
    if (!pay) return;
    const paid = await this.refreshPayment(pay);
    if (!paid && fromCustomer && session?.openwa_session_id) {
      await this.send(orgId, session, k.chat_id, { kind: 'text', text: 'Ainda não identifiquei o pagamento por aqui. Assim que ele cair eu te aviso 😉' });
    }
  }

  /** Atualiza o status de uma cobrança pelo gateway; retorna true se ficou PAGA agora. */
  private async refreshPayment(pay: any): Promise<boolean> {
    const gw = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: pay.organization_id } });
    if (!gw?.access_token || !pay.provider_charge_id) return false;
    const st = await getChargeStatus(pay.provider, gw.access_token, pay.provider_charge_id);
    if (st.ok && st.status === 'PAID') {
      const u = await this.prisma.whatsapp_payments.updateMany({ where: { id: pay.id, status: 'PENDING' }, data: { status: 'PAID', paid_at: new Date() } });
      if (u.count) await this.resumeAfterPayment(pay, 'pix_paid');
      return u.count > 0;
    }
    if (pay.expires_at && new Date(pay.expires_at).getTime() < Date.now()) {
      const u = await this.prisma.whatsapp_payments.updateMany({ where: { id: pay.id, status: 'PENDING' }, data: { status: 'EXPIRED' } });
      if (u.count) {
        await cancelCharge(pay.provider, gw.access_token, pay.provider_charge_id).catch(() => undefined);
        await this.resumeAfterPayment(pay, 'pix_expired');
      }
    }
    return false;
  }

  private async resumeAfterPayment(pay: { organization_id: string; session_id?: string | null; chat_id: string }, event: 'pix_paid' | 'pix_expired') {
    const sessionId = pay.session_id ? String(pay.session_id) : null;
    if (!sessionId) {
      // cobrança antiga sem número (antes do multi-número): não há como saber por qual número retomar
      this.logger.warn(`PIX ${event} sem session_id (org=${pay.organization_id} ${pay.chat_id}) — fluxo não retomado`);
      return;
    }
    await this.enqueue(pay.organization_id, sessionId, pay.chat_id, () => this.resume(pay.organization_id, { session_id: sessionId, chat_id: pay.chat_id }, event));
  }

  private async resume(orgId: string, k: ChatKey, event: 'wait_done' | 'pix_paid' | 'pix_expired') {
    const sess = await this.findBotSession(orgId, k);
    if (!sess || sess.status !== 'waiting' || !sess.flow_id) return;
    const flow = await this.flowById(orgId, sess.flow_id);
    if (!flow?.active) return;
    const chat = await this.findChat(orgId, k);
    if (!chat) return;
    // humano assumiu enquanto o bot esperava → não retoma (o pagamento fica registrado)
    if (chat.service_status === 'human' || chat.service_status === 'waiting') return;
    const session = await this.sessionRow(orgId, k.session_id);
    if (!session) return;
    const settings = this.cleanSettings(flow.settings);
    const ctx = await this.ctxFor(orgId, chat, settings);
    const r = handleEvent(flow.definition as any, this.stateOf(sess), event, ctx);
    await this.persist(orgId, k, flow.id, r.state);
    await this.execute(orgId, session, k, flow.id, r.actions, r.state, ctx);
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
        const k: ChatKey = { session_id: s.session_id, chat_id: s.chat_id };
        void this.enqueue(s.organization_id, k.session_id, k.chat_id, () => this.resume(s.organization_id, k, 'wait_done'));
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

  // ================================================================ ações do painel (conversa = uuid)
  /** "Enviar para o bot": usa o fluxo do NÚMERO da conversa. */
  async startForChat(orgId: string, user: WaUser, chatUuid: string) {
    const chat = await this.chat.chatRow(orgId, chatUuid);
    await this.waAccess.assertChat(user, chat);
    if (chat.kind !== 'individual' || isGroupJid(chat.chat_id)) throw new BadRequestException('O bot atende só conversas individuais.');
    const row = await this.sessions.rowById(orgId, chat.session_id);
    if (!row) throw new NotFoundException('Número da conversa não encontrado.');
    if (!row.bot_flow_id) throw new BadRequestException(`O número "${sessionLabel(row)}" não tem fluxo do bot. Atribua um em WhatsApp → Fluxo do Bot.`);
    const flow = await this.prisma.whatsapp_bot_flows.findFirst({ where: { id: row.bot_flow_id, organization_id: orgId } });
    if (!flow?.definition) throw new BadRequestException('Monte o fluxo do bot primeiro (WhatsApp → Fluxo do Bot).');
    if (!flow.active) throw new BadRequestException(`O fluxo "${flow.name}" está desativado. Ative-o antes de enviar a conversa para o bot.`);
    const errs = validateDefinition(flow.definition as any);
    if (errs.length) throw new BadRequestException(`O fluxo tem problemas: ${errs[0]}`);
    const session = await this.sessions.requireReady(orgId, chat.session_id);
    this.sessionCache.set(`${orgId}|${session.id}`, { at: Date.now(), row: session });
    const settings = this.cleanSettings(flow.settings);
    const ctx = await this.ctxFor(orgId, chat, settings);
    await this.enqueue(orgId, chat.session_id, chat.chat_id, () => this.begin(orgId, session, chat, flow, flow.definition as any, settings, ctx, null, 'bot_started', user.userId));
    const [shaped] = await this.presenter.shapeChats(orgId, [await this.prisma.whatsapp_chats.findUnique({ where: { id: chat.id } })]);
    return shaped;
  }

  /** "Tirar do bot". */
  async stopForChat(orgId: string, user: WaUser, chatUuid: string) {
    const chat = await this.chat.chatRow(orgId, chatUuid);
    await this.waAccess.assertChat(user, chat);
    const key = this.keyOf(chat);
    await this.attendance.stopBot(orgId, key, 'stopped');
    if (chat.service_status === 'bot') await this.attendance.setStatus(orgId, key, 'none', { event: 'bot_stopped', actor: user.userId });
    const [shaped] = await this.presenter.shapeChats(orgId, [await this.prisma.whatsapp_chats.findUnique({ where: { id: chat.id } })]);
    return shaped;
  }

  /** Conversas em que o bot está conduzindo agora (monitor), só dos números liberados ao usuário. */
  async monitor(orgId: string, user: WaUser, sessionId?: string | null) {
    const where = await this.waAccess.sessionWhere(user, sessionId || null);
    if (where === null) return [];
    const rows = await this.prisma.whatsapp_bot_sessions.findMany({ where: { organization_id: orgId, status: { in: RUNNING }, ...where }, orderBy: { updated_at: 'desc' }, take: 100 });
    if (!rows.length) return [];
    const chats = await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, session_id: { in: [...new Set(rows.map((r) => r.session_id))] }, chat_id: { in: [...new Set(rows.map((r) => r.chat_id))] } } });
    const shaped = await this.presenter.shapeChats(orgId, chats);
    const byKey = new Map(shaped.map((c: any) => [`${c.session_id}|${c.jid}`, c]));
    return rows.map((r) => ({
      chat: byKey.get(`${r.session_id}|${r.chat_id}`) || { session_id: r.session_id, jid: r.chat_id },
      flow_id: r.flow_id,
      session_id: r.session_id,
      node_id: r.node_id,
      status: r.status,
      waiting_for: (r.vars as any)?.__waiting_for || null,
      started_at: r.started_at,
      updated_at: r.updated_at,
    }));
  }
}
