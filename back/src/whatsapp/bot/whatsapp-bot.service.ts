import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../../platform-billing/access.service';
import {
  cancelCharge,
  createPixCharge,
  getChargeStatus,
} from '../../payments/pix-providers';
import { OpenWaClient } from '../openwa.client';
import { WhatsAppMediaService } from '../whatsapp-media.service';
import { WhatsAppInboundService } from '../whatsapp-inbound.service';
import { WhatsAppContactsService } from '../whatsapp-contacts.service';
import {
  ChatKey,
  WhatsAppAttendanceService,
} from '../whatsapp-attendance.service';
import { WhatsAppPresenter } from '../whatsapp-presenter.service';
import { InboundEvent, WhatsAppHooks } from '../whatsapp-hooks.service';
import {
  SessionRow,
  WhatsAppSessionsService,
  sessionLabel,
} from '../whatsapp-sessions.service';
import { WhatsAppChatService } from '../whatsapp-chat.service';
import { WaAccessService, WaUser } from '../wa-access.service';
import { isGroupJid, phoneFromJid } from '../wa-jid.util';
import { digitsOnly } from '../wa-doc.util';
import { WhatsAppCrmService } from '../whatsapp-crm.service';
import { WhatsAppIdentityService, normalizeIdentity } from '../whatsapp-identity.service';
import { WhatsAppSubscriptionsService, brtDateStr } from '../whatsapp-subscriptions.service';
import { WhatsAppChargesService } from '../whatsapp-charges.service';
import { normalizeChargeSettings } from '../wa-charge-settings.util';
import {
  CRM_ACTIONS,
  CRM_RESULT_ACTIONS,
  CrmFixture,
  MAX_CRM_DEPTH,
  describeCrmAction,
  fieldsToCustomerDto,
  fixtureCtx,
  flowUsesCrm,
  settleFixtureCharge,
  simulateCrmAction,
  toBotCharge,
} from './wa-bot-crm.runtime';
import {
  BOOK_ACTIONS,
  BOOK_READ_ACTIONS,
  BookFixture,
  bookingCharge,
  describeBookAction,
  fixtureAppointments,
  flowUsesAppointments,
  settleFixtureAppointment,
  simulateBookAction,
  toBotAppointment,
  toBotDays,
  toBotService,
} from './wa-bot-booking.runtime';
import { WhatsAppSchedulingService } from '../scheduling/whatsapp-scheduling.service';
import {
  TICKET_ACTIONS,
  TICKET_READ_ACTIONS,
  TicketFixture,
  cleanTicketFixture,
  describeTicketAction,
  fixtureTickets,
  flowUsesTickets,
  mediaKindOf,
  simulateTicketAction,
  toBotCategories,
  toBotTicket,
} from './wa-bot-ticket.runtime';
import { WhatsAppTicketsService } from '../tickets/whatsapp-tickets.service';
import {
  ORDER_ACTIONS,
  ORDER_READ_ACTIONS,
  OrderFixture,
  cfMapForBot,
  cleanOrderFixture,
  customFieldsUserText,
  describeOrderAction,
  fixtureOrders,
  flowUsesCustomFields,
  flowUsesOrders,
  settleFixtureOrder,
  simulateOrderAction,
  toBotAddresses,
  toBotCatalog,
  toBotOrder,
  toBotOrderSettings,
  visibleFields,
} from './wa-bot-order.runtime';
import { WhatsAppOrdersService } from '../orders/whatsapp-orders.service';
import { WhatsAppCustomFieldsService } from '../whatsapp-custom-fields.service';
import {
  BotAction,
  BotAppointment,
  BotContext,
  BotCustomer,
  BotDefinition,
  BotEventPayload,
  BotIdentity,
  BotInputMedia,
  BotProduct,
  BotSettings,
  BotState,
  BotTicket,
  BotCustomFieldMap,
  BotOrder,
  currentCustomer,
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

const SIM_CONTACT = {
  name: 'Cliente Teste',
  phone: '5511999999999',
  saved: false,
};
const MAX_DEF_BYTES = 600_000;
const MAX_FLOWS_PER_ORG = 50;
const CACHE_MS = 10_000;
const RUNNING = ['active', 'waiting'];
const CRM_CACHE_MS = 30_000;
const CRM_WAIT_STUCK_MS = 120_000; // ação de CRM que não respondeu (back reiniciou / número caiu) → recomeça
const MAX_FIXTURE_BYTES = 200_000;
const CRM_EVENTS = ['wait_done', 'pix_paid', 'pix_expired', 'crm_result', 'charge_paid', 'charge_expired', 'book_result'];
const RUNTIME_WAITS = ['crm_wait', 'book:wait', 'ticket:wait', 'order:wait']; // esperando o runtime (CRM / agenda / chamados) — preso > 2 min recomeça
const jidRef = (jid: string) => createHash('sha1').update(String(jid || '')).digest('hex').slice(0, 10); // log sem telefone
// Duas listas de clientes "conhecidos" nesta conversa (vivem em `vars.__verified` / `vars.__seen`):
//  - `__verified`: conferidos pelo CPF/CNPJ (ou já vinculados ao número) → podem ALTERAR (cancelar, pausar,
//    trocar plano, atualizar, assinar, 2ª via) e o número é vinculado ao cliente (decisão D2);
//  - `__seen`: achados pelo código/matrícula → SÓ LEITURA nesta conversa (código é fácil de adivinhar),
//    sem vínculo e sem escrita. `cliente.verificado` da condição = documento conferido ou vinculado.
const verifiedOf = (st: any): string[] => (Array.isArray(st?.__verified) ? st.__verified.map(String).slice(0, 20) : []);
const seenOf = (st: any): string[] => (Array.isArray(st?.__seen) ? st.__seen.map(String).slice(0, 20) : []);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LOOKUP_LIMIT = 6; // consultas `crm_lookup` por conversa por hora (freio contra enumeração de CPF/código)
const LOOKUP_WINDOW_MS = 3_600_000;
const TICKET_CREATE_LIMIT = 5; // chamados abertos pelo bot por conversa por hora (freio contra laço/abuso)
const ORDER_CREATE_LIMIT = 5; // pedidos criados pelo bot por conversa por hora (freio contra laço/abuso)

/** Recusa amigável de uma ação de CRM: o texto vai para o cliente no lugar do `failed_text` (payload.user_text). */
export class BotUserError extends BadRequestException {}

@Injectable()
export class WhatsAppBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppBotService.name);
  private readonly flowCache = new Map<string, { at: number; flow: any }>(); // flowId → linha
  private readonly sessionCache = new Map<
    string,
    { at: number; row: SessionRow | null }
  >(); // `${org}|${sessionId}` → linha do número
  private readonly queues = new Map<string, Promise<void>>();
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private lastPixCheck = 0;
  // CRM (Fase 2): produtos/identidade/motivos por org (30 s) e "o fluxo usa CRM?" por fluxo+versão
  private readonly crmOrgCache = new Map<
    string,
    { at: number; products: BotProduct[]; identity: BotIdentity; cancel_reasons: string[] }
  >();
  private readonly usesCrmCache = new Map<string, { key: string; uses: boolean }>();
  private readonly usesApptCache = new Map<string, { key: string; uses: boolean }>();
  private readonly lookupHits = new Map<string, number[]>(); // `${org}|${número}|${jid}` → instantes das consultas (1 h)
  private readonly usesTicketCache = new Map<string, { key: string; uses: boolean }>();
  private readonly ticketHits = new Map<string, number[]>(); // `${org}|${número}|${jid}` → chamados abertos pelo bot (1 h)
  private readonly usesOrderCache = new Map<string, { key: string; uses: boolean }>();
  private readonly usesCfCache = new Map<string, { key: string; uses: boolean }>();
  private readonly orderHits = new Map<string, number[]>(); // `${org}|${número}|${jid}` → pedidos criados pelo bot (1 h)

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
    private readonly identity: WhatsAppIdentityService,
    private readonly subscriptions: WhatsAppSubscriptionsService,
    private readonly charges: WhatsAppChargesService,
    // agenda (Fase 6): opcional para o boot não depender da ordem dos providers; ausente = blocos de agenda falham com aviso
    @Optional() private readonly scheduling?: WhatsAppSchedulingService,
    // chamados (Fase 6B): opcional pelo mesmo motivo; ausente = blocos de chamado falham com aviso
    @Optional() private readonly tickets?: WhatsAppTicketsService,
    // pedidos e campos personalizados (Fase 7): opcionais pelo mesmo motivo; ausentes = blocos de pedido falham com aviso
    @Optional() private readonly orders?: WhatsAppOrdersService,
    @Optional() private readonly customFields?: WhatsAppCustomFieldsService,
  ) {}

  onModuleInit() {
    this.hooks.onInbound((e) => this.onInbound(e));
    // cobrança criada pelo bot (bloco "Assinar plano"): paga/expirada/cancelada → retoma a conversa
    this.hooks.on('charge_paid', (e) => this.onChargeHook(e, 'charge_paid'));
    this.hooks.on('charge_expired', (e) => this.onChargeHook(e, 'charge_expired'));
    this.hooks.on('charge_canceled', (e) => this.onChargeHook(e, 'charge_expired'));
    // agendamento do bot que expirou sem pagar (o runner da agenda também cancela a cobrança → charge_canceled;
    // a 2ª notícia encontra a conversa fora da espera e é ignorada). `appointment_paid` NÃO é ouvido: o
    // `charge_paid` da cobrança do agendamento (criada com `bot`) já retoma a conversa — ouvir os dois entregaria em dobro.
    this.hooks.on('appointment_expired', (e) => this.onAppointmentExpired(e));
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
    for (const k of [...this.sessionCache.keys()])
      if (k.startsWith(`${orgId}|`)) this.sessionCache.delete(k);
  }

  /** Linha do número (whatsapp_sessions) com cache curto — traz `bot_flow_id` e o estado da conexão. */
  private async sessionRow(
    orgId: string,
    sessionId: string,
  ): Promise<SessionRow | null> {
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
    if (c && Date.now() - c.at < CACHE_MS)
      return c.flow && c.flow.organization_id === orgId ? c.flow : null;
    const f = await this.prisma.whatsapp_bot_flows.findFirst({
      where: { id: String(flowId), organization_id: orgId },
    });
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
    const f = await this.prisma.whatsapp_bot_flows.findFirst({
      where: { id: String(flowId || ''), organization_id: orgId },
    });
    if (!f) throw new NotFoundException('Fluxo não encontrado.');
    return f;
  }

  // ================================================================ fluxos (CRUD)
  private shape(
    f: any,
    extra: { sessions?: any[]; stats?: any } = {},
    full = false,
  ) {
    const base: any = {
      id: f?.id || null,
      name: f?.name || 'Fluxo do bot',
      active: Boolean(f?.active),
      position: f?.position ?? 0,
      published_at: f?.published_at || null,
      updated_at: f?.updated_at || null,
      created_at: f?.created_at || null,
      sessions: extra.sessions || [],
      stats: extra.stats || {
        active_sessions: 0,
        started_24h: 0,
        handoffs_24h: 0,
      },
    };
    if (full) {
      base.definition = this.refreshMediaUrls((f?.definition as any) || null);
      base.settings = this.cleanSettings(f?.settings);
    }
    return base;
  }

  /**
   * A URL de mídia guardada no fluxo é assinada e vence no fim do dia (UTC).
   * Ao devolver o fluxo, renova a URL de toda mídia que tem `id` — senão o
   * construtor mostra "Documento · sem arquivo" no dia seguinte ao upload.
   */
  private refreshMediaUrls(def: any) {
    if (!def || !Array.isArray(def.nodes)) return def;
    for (const n of def.nodes) {
      const msgs = n?.data?.messages;
      if (!Array.isArray(msgs)) continue;
      for (const m of msgs) {
        const id = m?.media?.id;
        if (id && typeof id === 'string') {
          try {
            m.media.url = this.media.signedUrl(id);
          } catch {
            /* mantém a URL antiga */
          }
        }
      }
    }
    return def;
  }

  /** Números da org por fluxo: flowId → [brief do número]. */
  private async sessionsByFlow(orgId: string) {
    const [rows, smap] = await Promise.all([
      this.prisma.whatsapp_sessions.findMany({
        where: { organization_id: orgId, bot_flow_id: { not: null } },
        select: { id: true, bot_flow_id: true, position: true },
        orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
      }),
      this.presenter.sessionMap(orgId),
    ]);
    const out = new Map<string, any[]>();
    for (const r of rows) {
      if (!r.bot_flow_id) continue;
      const b = smap.get(r.id) || {
        id: r.id,
        label: 'Número',
        color: null,
        phone: null,
        status: 'none',
        connected: false,
      };
      const list = out.get(r.bot_flow_id) || [];
      list.push({
        id: b.id,
        label: b.label,
        color: b.color,
        phone: b.phone,
        connected: Boolean(b.connected),
      });
      out.set(r.bot_flow_id, list);
    }
    return out;
  }

  /** Estatísticas por fluxo (conversas em andamento, inícios e transferências nas últimas 24 h). */
  private async statsByFlow(orgId: string, sessionsByFlow: Map<string, any[]>) {
    const since = new Date(Date.now() - 86_400_000);
    const [running, events] = await Promise.all([
      this.prisma.whatsapp_bot_sessions.groupBy({
        by: ['flow_id'],
        where: { organization_id: orgId, status: { in: RUNNING } },
        _count: { _all: true },
      }),
      this.prisma.whatsapp_service_events.findMany({
        where: {
          organization_id: orgId,
          event: { in: ['bot_started', 'bot_restarted', 'handoff'] },
          created_at: { gte: since },
        },
        select: { session_id: true, event: true, meta: true },
      }),
    ]);
    // número → fluxo atual (fallback para eventos antigos sem `meta.flow_id`)
    const flowOfSession = new Map<string, string>();
    for (const [flowId, list] of sessionsByFlow)
      for (const s of list) flowOfSession.set(s.id, flowId);
    const stats = new Map<
      string,
      { active_sessions: number; started_24h: number; handoffs_24h: number }
    >();
    const of = (id: string) => {
      let s = stats.get(id);
      if (!s)
        stats.set(
          id,
          (s = { active_sessions: 0, started_24h: 0, handoffs_24h: 0 }),
        );
      return s;
    };
    for (const r of running)
      if (r.flow_id) of(r.flow_id).active_sessions += r._count._all;
    for (const e of events) {
      const flowId =
        (e.meta as any)?.flow_id ||
        (e.session_id ? flowOfSession.get(e.session_id) : null);
      if (!flowId) continue;
      if (e.event === 'handoff') of(flowId).handoffs_24h += 1;
      else of(flowId).started_24h += 1;
    }
    return stats;
  }

  /** Lista de fluxos da org com os números que usam cada um + estatísticas. */
  async listFlows(orgId: string) {
    const flows = await this.prisma.whatsapp_bot_flows.findMany({
      where: { organization_id: orgId },
      orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
    });
    const byFlow = await this.sessionsByFlow(orgId);
    const stats = await this.statsByFlow(orgId, byFlow);
    return flows.map((f) =>
      this.shape(f, {
        sessions: byFlow.get(f.id) || [],
        stats: stats.get(f.id),
      }),
    );
  }

  /** Compatibilidade: `{ flows, sessions }` (números com fluxo atribuído). */
  async get(orgId: string) {
    const [flows, rows, smap] = await Promise.all([
      this.listFlows(orgId),
      this.prisma.whatsapp_sessions.findMany({
        where: { organization_id: orgId },
        select: { id: true, bot_flow_id: true },
        orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
      }),
      this.presenter.sessionMap(orgId),
    ]);
    const active = new Set(flows.filter((f) => f.active).map((f) => f.id));
    return {
      flows,
      sessions: rows.map((r) => ({
        ...(smap.get(r.id) || {
          id: r.id,
          label: 'Número',
          color: null,
          phone: null,
          status: 'none',
          connected: false,
        }),
        bot_flow_id: r.bot_flow_id,
        bot_active: Boolean(r.bot_flow_id && active.has(r.bot_flow_id)),
      })),
    };
  }

  async getFlow(orgId: string, flowId: string) {
    const f = await this.requireFlow(orgId, flowId);
    const byFlow = await this.sessionsByFlow(orgId);
    const stats = await this.statsByFlow(orgId, byFlow);
    return this.shape(
      f,
      { sessions: byFlow.get(f.id) || [], stats: stats.get(f.id) },
      true,
    );
  }

  private cleanDefinition(def: any): BotDefinition {
    if (def == null) return { nodes: [], edges: [] };
    if (
      typeof def !== 'object' ||
      !Array.isArray(def.nodes) ||
      !Array.isArray(def.edges)
    )
      throw new BadRequestException('Definição do fluxo inválida.');
    if (def.nodes.length > 250)
      throw new BadRequestException('Fluxo grande demais (máximo 250 blocos).');
    if (def.edges.length > 1000)
      throw new BadRequestException('Ligações demais no fluxo.');
    if (Buffer.byteLength(JSON.stringify(def)) > MAX_DEF_BYTES)
      throw new BadRequestException(
        'Fluxo grande demais. Use mídias enviadas pelo botão de upload, não imagens coladas.',
      );
    return def as BotDefinition;
  }

  private cleanSettings(s: any): BotSettings {
    const out: any = typeof s === 'object' && s ? { ...s } : {};
    const strArr = (v: any, max = 200) =>
      Array.isArray(v)
        ? v
            .map((x) => String(x || '').trim())
            .filter(Boolean)
            .slice(0, max)
        : [];
    out.audience = {
      mode: ['all', 'test', 'tags'].includes(out.audience?.mode)
        ? out.audience.mode
        : 'test',
      test_chat_ids: strArr(out.audience?.test_chat_ids, 500),
      tag_ids: strArr(out.audience?.tag_ids, 50),
    };
    out.trigger = {
      mode: out.trigger?.mode === 'keywords' ? 'keywords' : 'any',
      keywords: strArr(out.trigger?.keywords, 50).map((k) => k.slice(0, 60)),
    };
    out.restart_keywords = strArr(out.restart_keywords, 20).map((k) =>
      k.slice(0, 40),
    );
    out.exclude_tag_ids = strArr(out.exclude_tag_ids, 50);
    out.input_timeout_hours = Math.min(
      168,
      Math.max(1, Number(out.input_timeout_hours) || 24),
    );
    out.max_retries = Math.min(10, Math.max(1, Number(out.max_retries) || 3));
    out.typing = out.typing !== false;
    out.numbering = out.numbering === 'number' ? 'number' : 'emoji';
    out.invalid_option_text = String(out.invalid_option_text || '').slice(
      0,
      1000,
    );
    if (out.business_hours) {
      const bh = out.business_hours;
      out.business_hours = {
        enabled: Boolean(bh.enabled),
        days: typeof bh.days === 'object' && bh.days ? bh.days : {},
        outside_text: String(bh.outside_text || '').slice(0, 1000),
        outside_action: [
          'message_and_continue',
          'message_and_handoff',
          'message_only',
        ].includes(bh.outside_action)
          ? bh.outside_action
          : 'message_and_continue',
      };
    }
    return out;
  }

  private cleanName(v: any, fallback = 'Fluxo do bot') {
    return (
      String(v ?? '')
        .trim()
        .slice(0, 120) || fallback
    );
  }

  /** Cria um fluxo (ou clona `clone_of`). SEMPRE nasce desativado e com público em modo teste. */
  async createFlow(
    orgId: string,
    dto: {
      name?: string;
      definition?: any;
      settings?: any;
      clone_of?: string;
    } = {},
  ) {
    const count = await this.prisma.whatsapp_bot_flows.count({
      where: { organization_id: orgId },
    });
    if (count >= MAX_FLOWS_PER_ORG)
      throw new BadRequestException(
        `Limite de ${MAX_FLOWS_PER_ORG} fluxos por organização.`,
      );
    let definition: any =
      dto.definition !== undefined
        ? this.cleanDefinition(dto.definition)
        : null;
    let settings: any =
      dto.settings !== undefined ? this.cleanSettings(dto.settings) : null;
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
    const last = await this.prisma.whatsapp_bot_flows.aggregate({
      where: { organization_id: orgId },
      _max: { position: true },
    });
    const f = await this.prisma.whatsapp_bot_flows.create({
      data: {
        organization_id: orgId,
        name: name || (count ? `Fluxo do bot ${count + 1}` : 'Fluxo do bot'),
        definition: definition ?? undefined,
        settings,
        active: false,
        position: (last._max.position ?? -1) + 1,
      },
    });
    return this.getFlow(orgId, f.id);
  }

  /**
   * Salva nome/definição/configurações. Nunca liga o bot; fluxo ativo não pode ser salvo quebrado e
   * só dono/admin mexe num fluxo ATIVO (membro pode editar os desligados). `user` ausente = chamada interna.
   */
  async updateFlow(
    orgId: string,
    flowId: string,
    dto: { name?: string; definition?: any; settings?: any } = {},
    user?: WaUser | null,
  ) {
    const existing = await this.requireFlow(orgId, flowId);
    if (existing.active && user && !WaAccessService.isAdmin(user.role))
      throw new ForbiddenException(
        'Este fluxo está ativo: só o dono ou um administrador pode alterá-lo. Desligue-o primeiro ou peça a um administrador.',
      );
    const data: any = {};
    if (dto.name !== undefined) data.name = this.cleanName(dto.name);
    if (dto.definition !== undefined)
      data.definition = this.cleanDefinition(dto.definition);
    if (dto.settings !== undefined)
      data.settings = this.cleanSettings(dto.settings);
    if (existing.active && data.definition) {
      const errs = validateDefinition(data.definition);
      if (errs.length)
        throw new BadRequestException(
          `Corrija antes de salvar (o bot está ativo): ${errs[0]}`,
        );
    }
    if (Object.keys(data).length)
      await this.prisma.whatsapp_bot_flows.update({
        where: { id: existing.id },
        data,
      });
    this.invalidateFlow(existing.id);
    return this.getFlow(orgId, existing.id);
  }

  /**
   * Para o bot nas conversas em andamento que casam com `where` (bot_sessions) e libera as
   * conversas que estavam em atendimento "bot" (service_status → none, evento `event`).
   */
  private async stopRunning(
    orgId: string,
    where: { flow_id?: any; session_id?: any },
    event: string,
    meta?: any,
  ) {
    const running = await this.prisma.whatsapp_bot_sessions.findMany({
      where: { organization_id: orgId, status: { in: RUNNING }, ...where },
      select: { session_id: true, chat_id: true },
    });
    if (!running.length) return 0;
    await this.prisma.whatsapp_bot_sessions.updateMany({
      where: { organization_id: orgId, status: { in: RUNNING }, ...where },
      data: { status: 'stopped', wait_until: null },
    });
    for (const r of running) {
      const key: ChatKey = { session_id: r.session_id, chat_id: r.chat_id };
      const c = await this.prisma.whatsapp_chats
        .findUnique({
          where: {
            organization_id_session_id_chat_id: {
              organization_id: orgId,
              ...key,
            },
          },
        })
        .catch(() => null);
      if (c?.service_status === 'bot')
        await this.attendance
          .setStatus(orgId, key, 'none', { event, meta })
          .catch((e) =>
            this.logger.warn(
              `liberar conversa ${r.chat_id}: ${e?.message || e}`,
            ),
          );
    }
    return running.length;
  }

  /** Apaga o fluxo: tira dos números que o usam e para as conversas que ele conduzia. */
  async removeFlow(orgId: string, flowId: string) {
    const f = await this.requireFlow(orgId, flowId);
    await this.stopRunning(orgId, { flow_id: f.id }, 'bot_paused', {
      flow_id: f.id,
      reason: 'flow_deleted',
    });
    await this.prisma.whatsapp_sessions.updateMany({
      where: { organization_id: orgId, bot_flow_id: f.id },
      data: { bot_flow_id: null },
    });
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
    await this.prisma.whatsapp_bot_flows.update({
      where: { id: f.id },
      data: { active, ...(active ? { published_at: new Date() } : {}) },
    });
    this.invalidateFlow(f.id);
    if (!active)
      await this.stopRunning(orgId, { flow_id: f.id }, 'bot_paused', {
        flow_id: f.id,
      });
    return this.getFlow(orgId, f.id);
  }

  /** Atribui o fluxo a esses números (e tira dos demais que o usavam). Os números precisam ser da org e liberados ao usuário. */
  async assignSessions(
    orgId: string,
    user: WaUser,
    flowId: string,
    sessionIds: string[],
  ) {
    const f = await this.requireFlow(orgId, flowId);
    const ids = [
      ...new Set(
        (Array.isArray(sessionIds) ? sessionIds : [])
          .map((x) => String(x || '').trim())
          .filter(Boolean),
      ),
    ];
    for (const id of ids) {
      await this.sessions.requireRow(orgId, id);
      await this.waAccess.assertSession(user, id);
    }
    const current = await this.prisma.whatsapp_sessions.findMany({
      where: { organization_id: orgId, bot_flow_id: f.id },
      select: { id: true },
    });
    const removed = current.map((c) => c.id).filter((id) => !ids.includes(id));
    // quem perde o fluxo: usuário restrito só pode mexer em números dele
    for (const id of removed) await this.waAccess.assertSession(user, id);
    await this.prisma.$transaction([
      this.prisma.whatsapp_sessions.updateMany({
        where: {
          organization_id: orgId,
          bot_flow_id: f.id,
          ...(ids.length ? { id: { notIn: ids } } : {}),
        },
        data: { bot_flow_id: null },
      }),
      ...(ids.length
        ? [
            this.prisma.whatsapp_sessions.updateMany({
              where: { organization_id: orgId, id: { in: ids } },
              data: { bot_flow_id: f.id },
            }),
          ]
        : []),
    ]);
    this.invalidateOrgSessions(orgId);
    // números que deixaram este fluxo: conversas que ele conduzia param
    if (removed.length)
      await this.stopRunning(
        orgId,
        { flow_id: f.id, session_id: { in: removed } },
        'bot_paused',
        { flow_id: f.id, reason: 'unassigned' },
      );
    // números que trocaram de fluxo: conversas do fluxo antigo param (o novo começa na próxima mensagem)
    if (ids.length)
      await this.stopRunning(
        orgId,
        { session_id: { in: ids }, flow_id: { not: f.id } },
        'bot_paused',
        { flow_id: f.id, reason: 'flow_changed' },
      );
    return this.getFlow(orgId, f.id);
  }

  // ================================================================ simulador
  /**
   * Simulador (mesmo interpretador, nada vai ao WhatsApp). Blocos de CRM:
   *  - `crm_fixture` (cliente fictício): as ações `crm_*` são resolvidas EM MEMÓRIA e o fluxo continua
   *    sozinho (`crm_result`); cobrança "criada" vira a pseudo-ação `{type:'charge', charge}`; o cliente
   *    da simulação volta em `state.__fixture_customer` (o front reenvia o estado).
   *  - `crm_mode:'org'` (+ `crm_phone`): dados REAIS da org só para leitura (identificar, status, 2ª via
   *    mostrada mas não enviada); escritas viram "info" e o estado fica em `crm_wait`.
   *  - sem fixture: ações `crm_*` viram "info" ("Procuraria o cliente…") e o estado fica em `crm_wait`
   *    (o chamador pode mandar `event:'crm_result'` + `event_payload`).
   */
  async simulate(orgId: string, dto: any) {
    const saved = dto?.flow_id
      ? await this.requireFlow(orgId, dto.flow_id)
      : null;
    if (dto?.definition === undefined && !saved)
      throw new BadRequestException(
        'Informe flow_id ou definition para simular.',
      );
    const def = this.cleanDefinition(
      dto?.definition ?? saved?.definition ?? null,
    );
    const settings = this.cleanSettings(dto?.settings ?? saved?.settings ?? {});
    const prev: BotState | null =
      dto?.state && typeof dto.state === 'object'
        ? { ...emptyState(), ...dto.state }
        : null;
    const ctx: BotContext = {
      contact: { ...SIM_CONTACT },
      chatTagIds: Array.isArray(dto?.state?.__tags) ? dto.state.__tags : [],
      now: new Date(),
      settings,
    };
    const fx = this.cleanFixture(dto?.crm_fixture);
    const mode: 'fixture' | 'org' | 'none' = fx
      ? 'fixture'
      : dto?.crm_mode === 'org'
        ? 'org'
        : 'none';
    const org = await this.crmOrg(orgId, true).catch(() => null); // simulador = dados do momento
    const defaults = {
      identity: org?.identity || this.identityOf(normalizeIdentity(null)),
      cancel_reasons:
        org?.cancel_reasons || normalizeChargeSettings(null).cancel_reasons,
    };
    if (mode === 'fixture') Object.assign(ctx, fixtureCtx(fx!, prev, defaults));
    else if (mode === 'org')
      Object.assign(ctx, await this.simOrgCtx(orgId, dto, prev, defaults, org));
    else
      // sem fixture: só o cliente devolvido por um `crm_result` manual (guardado no estado) + produtos reais
      Object.assign(ctx, fixtureCtx({}, prev, defaults), {
        products: org?.products || [],
      });
    // agenda (Fase 6): agendamentos fictícios (os criados na simulação + os da fixture) para condições/variáveis
    const bfx = this.bookFixture(dto);
    ctx.appointments = fixtureAppointments(prev, bfx);
    // chamados (Fase 6B): `crm_fixture.tickets` = {categories?, tickets?, fail_create?}; com dados reais (`org`) a
    // condição/variáveis leem os chamados em andamento dos clientes do `crm_phone` (só leitura)
    const tfx: TicketFixture = cleanTicketFixture(dto?.crm_fixture?.tickets);
    ctx.tickets =
      mode === 'org' && this.tickets && flowUsesTickets(def)
        ? await this.ticketsOf(orgId, null, (ctx.customers || []).map((c) => c.id), true).catch(() => [])
        : fixtureTickets(prev, tfx).filter((t) => t.status === 'open' || t.status === 'pending');
    // campos personalizados (Fase 7): os da fixture (`crm_fixture.custom_fields`, mapa por entidade) ou os reais da org (só leitura)
    const fxCf = dto?.crm_fixture?.custom_fields;
    if (fxCf && typeof fxCf === 'object') ctx.custom_fields = cfMapForBot(fxCf);
    else if (this.customFields) ctx.custom_fields = await this.cfMap(orgId, true).catch(() => undefined);
    // pedidos (Fase 7): `crm_fixture.catalog/order_settings/orders/addresses`; com dados reais (`org`) a condição/variáveis
    // leem os pedidos em andamento dos clientes do `crm_phone` (só leitura)
    const ofx: OrderFixture = cleanOrderFixture(dto?.crm_fixture);
    ctx.orders =
      mode === 'org' && this.orders && flowUsesOrders(def)
        ? await this.ordersOf(orgId, null, (ctx.customers || []).map((c) => c.id), true, ctx.custom_fields).catch(() => [])
        : fixtureOrders(prev, ofx, ctx.custom_fields?.order || []).filter((o) => ['new', 'confirmed', 'preparing', 'out_for_delivery'].includes(o.status));
    // arquivo que o "cliente" mandou no simulador (foto/documento fictício): `input_media` ou `state.__sim_media`
    const simMedia = this.simMedia(dto, prev);

    let r: { state: BotState; actions: BotAction[] };
    if (prev && dto?.event) {
      const event = String(dto.event);
      if (!CRM_EVENTS.includes(event))
        throw new BadRequestException('Evento inválido para o simulador.');
      let payload: BotEventPayload | undefined =
        dto?.event_payload && typeof dto.event_payload === 'object'
          ? { ...dto.event_payload }
          : undefined;
      if (event === 'charge_paid' || event === 'charge_expired') {
        // cobrança de um agendamento fictício: o agendamento vira pago/expirado e vai no payload
        const ap = settleFixtureAppointment(
          prev,
          payload?.charge_id || prev.charge?.id || null,
          event === 'charge_paid',
        );
        if (ap) payload = { ...(payload || {}), appointment: ap };
        // cobrança de um pedido fictício: o pedido vira pago/expirado e vai no payload
        const so = settleFixtureOrder(prev, payload?.charge_id || prev.charge?.id || null, event === 'charge_paid');
        if (so) payload = { ...(payload || {}), order: so };
      }
      if (
        mode === 'fixture' &&
        (event === 'charge_paid' || event === 'charge_expired')
      ) {
        const chargeId = payload?.charge_id || prev.charge?.id || null;
        const c = settleFixtureCharge(
          currentCustomer(prev, ctx),
          chargeId,
          event === 'charge_paid',
        );
        payload = { ...(payload || {}), ...(c ? { customer: c } : {}) };
      }
      r = handleEvent(def, prev, event as any, ctx, payload);
    } else if (prev) r = handleInput(def, prev, String(dto?.input ?? ''), ctx, simMedia);
    else r = startFlow(def, ctx, dto?.input ?? null);

    const out: any[] = [];
    const tags = await this.presenter.tagMap(orgId);
    const state: any = await this.simActions(
      orgId,
      def,
      r.actions,
      r.state,
      ctx,
      mode,
      fx,
      out,
      tags,
      0,
      bfx,
      tfx,
      ofx,
    );
    const customer = currentCustomer(state, ctx);
    if (mode !== 'org') state.__fixture_customer = customer;
    state.__tags = ctx.chatTagIds;
    return {
      actions: out,
      state,
      ended: ['done', 'handoff', 'stopped'].includes(state.status),
      flow_id: saved?.id || null,
      customer,
    };
  }

  /** Agenda fictícia do simulador: `book_fixture` (ou `crm_fixture.scheduling`), copiada e limitada. */
  private bookFixture(dto: any): BookFixture {
    const raw =
      dto?.book_fixture && typeof dto.book_fixture === 'object'
        ? dto.book_fixture
        : dto?.crm_fixture?.scheduling && typeof dto.crm_fixture.scheduling === 'object'
          ? dto.crm_fixture.scheduling
          : null;
    if (!raw || Array.isArray(raw)) return {};
    let json = '';
    try {
      json = JSON.stringify(raw);
    } catch {
      throw new BadRequestException('Agenda fictícia inválida.');
    }
    if (Buffer.byteLength(json) > MAX_FIXTURE_BYTES)
      throw new BadRequestException('Agenda fictícia grande demais.');
    const fx = JSON.parse(json);
    return {
      services: Array.isArray(fx.services) ? fx.services.slice(0, 30) : undefined,
      appointments: Array.isArray(fx.appointments) ? fx.appointments.slice(0, 10) : undefined,
      payment: ['on_site', 'on_booking', 'deposit', 'included'].includes(fx.payment) ? fx.payment : null,
      no_slots: Boolean(fx.no_slots),
      conflict: Boolean(fx.conflict),
    };
  }

  /**
   * Arquivo fictício que o "cliente" mandou no simulador (blocos de chamado aceitam foto/documento): `dto.input_media`
   * ou `state.__sim_media` = `{kind:'image'|'document'|…, filename?}` (ou `{failed:true}` = arquivo que não baixou).
   * Vira `{id:'sim-media-…', kind}` — nada é guardado. Sai do estado depois de usado.
   */
  private simMedia(dto: any, prev: BotState | null): BotInputMedia | null {
    const raw = dto?.input_media ?? (prev as any)?.__sim_media ?? null;
    if (prev) delete (prev as any).__sim_media;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const kind = mediaKindOf(raw.kind) || 'image';
    return {
      id: raw.failed ? null : `sim-media-${Math.random().toString(36).slice(2, 10)}`,
      kind,
      mime: typeof raw.mime === 'string' ? raw.mime.slice(0, 80) : null,
      filename: typeof raw.filename === 'string' ? raw.filename.slice(0, 120) : null,
    };
  }

  /** `crm_fixture` vindo do front: objeto pequeno, copiado (nunca o objeto da requisição). */
  private cleanFixture(raw: any): CrmFixture | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    let json = '';
    try {
      json = JSON.stringify(raw);
    } catch {
      throw new BadRequestException('Cliente fictício inválido.');
    }
    if (Buffer.byteLength(json) > MAX_FIXTURE_BYTES)
      throw new BadRequestException('Cliente fictício grande demais.');
    return JSON.parse(json);
  }

  /** Ações do simulador → saída para a tela; ações de CRM resolvidas conforme o modo (fixture/org/none). */
  private async simActions(
    orgId: string,
    def: BotDefinition,
    actions: BotAction[],
    state: BotState,
    ctx: BotContext,
    mode: 'fixture' | 'org' | 'none',
    fx: CrmFixture | null,
    out: any[],
    tags: Map<string, any>,
    depth: number,
    bfx: BookFixture = {},
    tfx: TicketFixture = {},
    ofx: OrderFixture = {},
  ): Promise<BotState> {
    for (const a of actions) {
      if (ORDER_ACTIONS.has(a.type)) {
        // pedidos: em memória (sem banco); "dados reais" só consulta catálogo/configuração/pedidos de verdade — nunca cria
        out.push({ type: 'info', text: describeOrderAction(a) });
        let res: { payload: BotEventPayload | null; extra: any[] };
        if (depth >= MAX_CRM_DEPTH)
          res = {
            payload: { ok: false, error: 'Ações demais em sequência (laço no fluxo?)' },
            extra: [{ type: 'info', text: 'Ações demais em sequência — esta não foi executada; o fluxo segue por “Deu erro”.' }],
          };
        else if (mode === 'org' && ORDER_READ_ACTIONS.has(a.type) && this.orders) {
          const cur = currentCustomer(state, ctx);
          const strong = (ctx.customers || []).filter((c) => c.verified).map((c) => c.id);
          const seen = (ctx.customers || []).filter((c) => !c.verified).map((c) => c.id);
          res = await this.orderRead(orgId, a, { contact_id: null, strong, seen, address_customer_id: cur?.verified ? cur.id : null }, ctx.custom_fields)
            .then((payload) => ({ payload, extra: [] as any[] }))
            .catch((e: any) => ({
              payload: { ok: false, error: String(e?.response?.message || e?.message || e).slice(0, 200) },
              extra: [],
            }));
        } else {
          res = simulateOrderAction(a, state, ofx, ctx.custom_fields?.order || []);
          if (mode === 'org' && !ORDER_READ_ACTIONS.has(a.type))
            res.extra.push({ type: 'info', text: 'Simulação com dados reais: NENHUM pedido foi criado e nenhuma cobrança foi gerada.' });
        }
        out.push(...res.extra);
        if (!res.payload || depth > MAX_CRM_DEPTH) continue;
        const r2 = handleEvent(def, state, 'crm_result', ctx, res.payload);
        state = await this.simActions(orgId, def, r2.actions, r2.state, ctx, mode, fx, out, tags, depth + 1, bfx, tfx, ofx);
        continue;
      }
      if (TICKET_ACTIONS.has(a.type)) {
        // chamados: em memória (sem banco); "dados reais" só consulta categorias/chamados de verdade — nunca abre nem altera
        out.push({ type: 'info', text: describeTicketAction(a) });
        let res: { payload: BotEventPayload | null; extra: any[] };
        if (depth >= MAX_CRM_DEPTH)
          res = {
            payload: { ok: false, error: 'Ações demais em sequência (laço no fluxo?)' },
            extra: [{ type: 'info', text: 'Ações demais em sequência — esta não foi executada; o fluxo segue por “Deu erro”.' }],
          };
        else if (mode === 'org' && TICKET_READ_ACTIONS.has(a.type) && this.tickets)
          res = await this.ticketRead(
            orgId,
            a,
            this.ticketWho(
              state,
              { contact: null, linked: (ctx.customers || []).filter((c) => c.verified).map((c) => ({ id: c.id })) },
              (ctx.customers || []).filter((c) => !c.verified).map((c) => c.id),
            ),
          )
            .then((payload) => ({ payload, extra: [] as any[] }))
            .catch((e: any) => ({
              payload: { ok: false, error: String(e?.response?.message || e?.message || e).slice(0, 200) },
              extra: [],
            }));
        else {
          res = simulateTicketAction(a, state, tfx, new Date(), ctx.custom_fields?.ticket || []);
          if (mode === 'org' && !TICKET_READ_ACTIONS.has(a.type))
            res.extra.push({ type: 'info', text: 'Simulação com dados reais: NENHUM chamado foi aberto ou alterado.' });
        }
        out.push(...res.extra);
        if (!res.payload || depth > MAX_CRM_DEPTH) continue;
        const r2 = handleEvent(def, state, 'crm_result', ctx, res.payload);
        state = await this.simActions(orgId, def, r2.actions, r2.state, ctx, mode, fx, out, tags, depth + 1, bfx, tfx, ofx);
        continue;
      }
      if (BOOK_ACTIONS.has(a.type)) {
        // agenda: em memória (sem banco); "dados reais" só consulta serviços/profissionais/horários de verdade
        out.push({ type: 'info', text: describeBookAction(a) });
        let res: { payload: BotEventPayload | null; extra: any[] };
        if (depth >= MAX_CRM_DEPTH)
          res = {
            payload: { ok: false, error: 'Ações demais em sequência (laço no fluxo?)' },
            extra: [{ type: 'info', text: 'Ações demais em sequência — esta não foi executada; o fluxo segue por “Deu erro”.' }],
          };
        else if (mode === 'org' && BOOK_READ_ACTIONS.has(a.type) && this.scheduling)
          res = await this.bookRead(orgId, a)
            .then((payload) => ({ payload, extra: [] as any[] }))
            .catch((e: any) => ({
              payload: { ok: false, error: String(e?.response?.message || e?.message || e).slice(0, 200) },
              extra: [],
            }));
        else {
          res = simulateBookAction(a, state, bfx);
          if (mode === 'org' && !BOOK_READ_ACTIONS.has(a.type))
            res.extra.push({ type: 'info', text: 'Simulação com dados reais: NADA foi reservado/alterado na agenda.' });
        }
        out.push(...res.extra);
        if (!res.payload || depth > MAX_CRM_DEPTH) continue;
        const r2 = handleEvent(def, state, 'book_result', ctx, res.payload);
        state = await this.simActions(orgId, def, r2.actions, r2.state, ctx, mode, fx, out, tags, depth + 1, bfx, tfx, ofx);
        continue;
      }
      if (CRM_ACTIONS.has(a.type)) {
        if (mode === 'none') {
          out.push({ type: 'info', text: describeCrmAction(a, ctx) });
          continue;
        }
        out.push(a); // o front mostra a nota "Procurando o cliente…"
        if (depth > MAX_CRM_DEPTH) {
          out.push({
            type: 'info',
            text: 'Ações de CRM demais em sequência — simulação interrompida.',
          });
          continue;
        }
        let res: { payload: BotEventPayload | null; extra: any[] };
        if (depth >= MAX_CRM_DEPTH)
          // mesmo que o runtime: no limite a ação não roda e o motor segue por `failed` (não fica em crm_wait)
          res = {
            payload: { ok: false, error: 'Ações de CRM demais em sequência (laço no fluxo?)' },
            extra: [{ type: 'info', text: 'Ações de CRM demais em sequência — esta não foi executada; o fluxo segue por “Deu erro”.' }],
          };
        else if (mode === 'fixture')
          res = simulateCrmAction(a, state, ctx, fx || {}, brtDateStr());
        else res = await this.simOrgAction(orgId, a, state, ctx);
        out.push(...res.extra);
        if (!res.payload) continue;
        const r2 = handleEvent(def, state, 'crm_result', ctx, res.payload);
        state = await this.simActions(
          orgId,
          def,
          r2.actions,
          r2.state,
          ctx,
          mode,
          fx,
          out,
          tags,
          depth + 1,
          bfx,
          tfx,
          ofx,
        );
        continue;
      }
      if (a.type === 'tags')
        out.push({
          type: 'tags',
          add: a.add.map(
            (id) =>
              tags.get(id) || {
                id,
                name: 'Etiqueta removida',
                color: '#94a3b8',
              },
          ),
          remove: a.remove.map(
            (id) =>
              tags.get(id) || {
                id,
                name: 'Etiqueta removida',
                color: '#94a3b8',
              },
          ),
        });
      else if (a.type === 'pix') {
        // PIX simulado: código fictício pro texto do bloco
        const code =
          '00020126SIMULADO5204000053039865802BR5913PUB MAIL TESTE6009SAO PAULO';
        state.pix = {
          ...(state.pix || {
            amount_cents: a.amount_cents,
            description: a.description,
          }),
          code,
        };
        out.push({
          type: 'pix',
          amount_cents: a.amount_cents,
          description: a.description,
          code,
        });
        for (const m of this.pixMessages(a, state, ctx, false)) out.push(m);
      } else if (a.type === 'pix_check')
        out.push({
          type: 'info',
          text: 'O cliente disse que pagou — o bot confere no gateway. No simulador, use “Simular pagamento”.',
        });
      else out.push(a);
    }
    return state;
  }

  /** Simulador com dados REAIS da org (somente leitura): clientes do `crm_phone` + os achados por documento/código. */
  private async simOrgCtx(
    orgId: string,
    dto: any,
    prev: BotState | null,
    defaults: { identity: BotIdentity; cancel_reasons: string[] },
    org: { products: BotProduct[] } | null,
  ) {
    const ids: string[] = [];
    const phone = String(dto?.crm_phone || '').replace(/\D/g, '');
    if (phone.length >= 8) {
      const r = await this.identity
        .findCustomer(orgId, { phone })
        .catch(() => ({ found: [] as any[] }));
      for (const c of r.found) ids.push(String(c.id));
    }
    const verified = new Set([...ids, ...verifiedOf(prev)]); // do telefone = "vinculado"; conferidos pelo documento
    for (const id of verifiedOf(prev)) if (!ids.includes(id)) ids.push(id);
    for (const id of seenOf(prev)) if (!ids.includes(id)) ids.push(id); // achados pelo código: só leitura
    const list = (
      await Promise.all(
        ids
          .slice(0, 5)
          .map((id) =>
            this.crm
              .botCustomer(orgId, id, { verified: verified.has(id) })
              .catch(() => null),
          ),
      )
    ).filter(Boolean) as BotCustomer[];
    const wanted = prev?.customer_id || null;
    return {
      customer: (wanted && list.find((c) => c.id === wanted)) || list[0] || null,
      customers: list,
      products: org?.products || [],
      identity: defaults.identity,
      cancel_reasons: defaults.cancel_reasons,
    };
  }

  /** Ação de CRM no modo "dados reais" do simulador: lê de verdade, nunca escreve nem envia. */
  private async simOrgAction(
    orgId: string,
    a: BotAction,
    state: BotState,
    ctx: BotContext,
  ): Promise<{ payload: BotEventPayload | null; extra: any[] }> {
    if (a.type === 'crm_lookup') {
      const r = await this.identity.findCustomer(
        orgId,
        a.by === 'code' ? { code: a.value } : { doc: a.value },
      );
      const ids = r.found.slice(0, 5).map((c: any) => String(c.id));
      // mesma regra do runtime: documento → verificado; código → só visto (leitura)
      const byDoc = a.by !== 'code';
      const key = byDoc ? '__verified' : '__seen';
      const cur = byDoc ? verifiedOf(state) : seenOf(state);
      (state as any)[key] = [...new Set([...cur, ...ids])].slice(-20);
      const list = (
        await Promise.all(
          ids.map((id) =>
            this.crm
              .botCustomer(orgId, id, { verified: byDoc })
              .catch(() => null),
          ),
        )
      ).filter(Boolean) as BotCustomer[];
      return { payload: { ok: true, customers: list }, extra: [] };
    }
    if (a.type === 'crm_send_charge') {
      const o = (currentCustomer(state, ctx)?.open_charges || []).find(
        (x) => x.id === a.charge_id,
      );
      if (!o)
        return {
          payload: { ok: false, error: 'Cobrança não encontrada.' },
          extra: [],
        };
      const charge = toBotCharge(o);
      return {
        payload: { ok: true, charge },
        extra: [
          { type: 'charge', charge, resend: true },
          {
            type: 'info',
            text: 'Simulação com dados reais: a 2ª via NÃO foi enviada nem recalculada no gateway.',
          },
        ],
      };
    }
    return {
      payload: null,
      extra: [
        {
          type: 'info',
          text: `Simulação com dados reais (nada é gravado): ${describeCrmAction(a, ctx)}`,
        },
      ],
    };
  }

  /** Mensagens que acompanham a cobrança: texto do bloco + código copia-e-cola separado. */
  private pixMessages(
    a: Extract<BotAction, { type: 'pix' }>,
    state: BotState,
    ctx: BotContext,
    withTyping = true,
  ): BotAction[] {
    const out: BotAction[] = [];
    const text = fillVars(
      a.text ||
        `Segue o PIX de *{{pix_valor}}* referente a ${a.description}. Copie o código abaixo e pague no app do seu banco 👇`,
      state,
      ctx,
    ).trim();
    if (text) {
      if (withTyping && ctx.settings.typing !== false)
        out.push({ type: 'typing', ms: 1200 });
      out.push({
        type: 'send',
        delay_ms: withTyping ? 1200 : 0,
        message: { kind: 'text', text },
      });
    }
    if (state.pix?.code && !String(a.text || '').includes('{{pix_codigo}}'))
      out.push({
        type: 'send',
        delay_ms: 600,
        message: { kind: 'text', text: state.pix.code },
      });
    return out;
  }

  // ================================================================ runtime (mensagem do cliente)
  private enqueue(
    orgId: string,
    sessionId: string,
    jid: string,
    job: () => Promise<void>,
  ) {
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
    void this.enqueue(e.orgId, e.sessionId, e.chatId, () =>
      this.processInbound(e),
    );
  }

  private keyOf(chat: { session_id: string; chat_id: string }): ChatKey {
    return { session_id: chat.session_id, chat_id: chat.chat_id };
  }

  private chatWhere(orgId: string, k: ChatKey) {
    return {
      organization_id_session_id_chat_id: {
        organization_id: orgId,
        session_id: k.session_id,
        chat_id: k.chat_id,
      },
    };
  }

  private async findChat(orgId: string, k: ChatKey) {
    return this.prisma.whatsapp_chats.findUnique({
      where: this.chatWhere(orgId, k),
    });
  }

  private async findBotSession(orgId: string, k: ChatKey) {
    return this.prisma.whatsapp_bot_sessions.findUnique({
      where: this.chatWhere(orgId, k),
    });
  }

  private async eligible(
    orgId: string,
    session: SessionRow,
    settings: BotSettings,
    chat: any,
  ) {
    const tags: string[] = Array.isArray(chat.tags) ? chat.tags : [];
    if ((settings.exclude_tag_ids || []).some((t) => tags.includes(t)))
      return false;
    const mode = settings.audience?.mode || 'test';
    if (mode === 'all') return true;
    if (mode === 'tags')
      return (settings.audience?.tag_ids || []).some((t) => tags.includes(t));
    const list = settings.audience?.test_chat_ids || [];
    if (list.includes(chat.chat_id) || list.includes(chat.id)) return true;
    const canon = await Promise.all(
      list.map((id) =>
        this.contacts.canonicalChatId(orgId, session, id).catch(() => id),
      ),
    );
    return canon.includes(chat.chat_id);
  }

  /** Identidade da org no formato do motor. */
  private identityOf(idn: ReturnType<typeof normalizeIdentity>): BotIdentity {
    return {
      require_doc: idn.require_doc,
      use_code: idn.use_code,
      code_label: idn.code_label,
      ask_doc_text: idn.ask_doc_text,
      doc_not_found_text: idn.doc_not_found_text,
      doc_invalid_text: idn.doc_invalid_text,
    };
  }

  /** Produtos ativos + identidade + motivos de cancelamento da org (cache 30 s). */
  private async crmOrg(orgId: string, fresh = false) {
    const c = this.crmOrgCache.get(orgId);
    if (!fresh && c && Date.now() - c.at < CRM_CACHE_MS) return c;
    const [products, row] = await Promise.all([
      this.crm.botProducts(orgId),
      this.prisma.whatsapp_crm_settings.findUnique({
        where: { organization_id: orgId },
        select: { identity: true, charge: true },
      }),
    ]);
    const v = {
      at: Date.now(),
      products,
      identity: this.identityOf(normalizeIdentity(row?.identity)),
      cancel_reasons: normalizeChargeSettings(row?.charge).cancel_reasons,
    };
    this.crmOrgCache.set(orgId, v);
    return v;
  }

  /** O fluxo usa CRM? (cache por fluxo + versão; sem fluxo salvo = calcula na hora) */
  private flowNeedsCrm(flow: any, def: BotDefinition | null | undefined) {
    if (!def) return false;
    if (!flow?.id) return flowUsesCrm(def);
    const key = String(
      flow.updated_at ? new Date(flow.updated_at).getTime() : 0,
    );
    const c = this.usesCrmCache.get(flow.id);
    if (c && c.key === key) return c.uses;
    const uses = flowUsesCrm(def);
    this.usesCrmCache.set(flow.id, { key, uses });
    return uses;
  }

  private async ctxFor(
    orgId: string,
    chat: any,
    settings: BotSettings,
    opts: {
      flow?: any;
      def?: BotDefinition | null;
      state?: BotState | null;
    } = {},
  ): Promise<BotContext> {
    const useCrm = this.flowNeedsCrm(opts.flow, opts.def);
    const contact = await this.prisma.whatsapp_contacts
      .findUnique({
        where: {
          organization_id_wa_id: {
            organization_id: orgId,
            wa_id: chat.chat_id,
          },
        },
      })
      .catch(() => null);
    const name =
      contact?.name ||
      contact?.push_name ||
      (chat.name &&
      !/^\+?\d+$/.test(chat.name) &&
      chat.name !== 'Contato sem nome'
        ? chat.name
        : '') ||
      '';
    const base: BotContext = {
      contact: {
        name,
        phone: contact?.phone || phoneFromJid(chat.chat_id) || '',
        saved: Boolean(contact?.saved),
      },
      // fluxo com CRM: o motor monta {{cliente.*}} a partir de ctx.customer (varsForChat seria refeito)
      vars: useCrm
        ? {}
        : await this.crm.varsForChat(orgId, chat.id).catch(() => ({})),
      chatTagIds: Array.isArray(chat.tags) ? [...chat.tags] : [],
      now: new Date(),
      settings,
    };
    // agenda (Fase 6): próximos agendamentos só quando o fluxo usa condição/variável de agendamento fora dos blocos
    if (this.scheduling && this.flowNeedsAppointments(opts.flow, opts.def)) {
      const parties = await this.chatParties(orgId, { session_id: chat.session_id, chat_id: chat.chat_id });
      const ids = [...new Set([...parties.linked.map((x) => x.id), ...verifiedOf(opts.state), ...seenOf(opts.state)])];
      base.appointments = await this.listUpcoming(orgId, parties.contact?.id ? String(parties.contact.id) : null, ids).catch(() => []);
    }
    // chamados (Fase 6B): chamados em andamento só quando o fluxo usa condição/variável de chamado fora dos blocos
    if (this.tickets && this.flowNeedsTickets(opts.flow, opts.def)) {
      const parties = await this.chatParties(orgId, { session_id: chat.session_id, chat_id: chat.chat_id });
      const ids = [...new Set([...parties.linked.map((x) => x.id), ...verifiedOf(opts.state), ...seenOf(opts.state)])];
      base.tickets = await this.ticketsOf(orgId, parties.contact?.id ? String(parties.contact.id) : null, ids, true).catch(() => []);
    }
    // campos personalizados (Fase 7): definições quando o fluxo pergunta/mostra campos (cache de 60 s no serviço)
    if (this.customFields && this.flowNeedsCustomFields(opts.flow, opts.def)) base.custom_fields = await this.cfMap(orgId);
    // pedidos (Fase 7): pedidos em andamento só quando o fluxo usa condição/variável de pedido fora dos blocos
    if (this.orders && this.flowNeedsOrders(opts.flow, opts.def)) {
      const parties = await this.chatParties(orgId, { session_id: chat.session_id, chat_id: chat.chat_id });
      const ids = [...new Set([...parties.linked.map((x) => x.id), ...verifiedOf(opts.state), ...seenOf(opts.state)])];
      base.orders = await this.ordersOf(orgId, parties.contact?.id ? String(parties.contact.id) : null, ids, true, base.custom_fields).catch(() => []);
    }
    if (!useCrm) return base;
    try {
      const org = await this.crmOrg(orgId);
      const found = await this.identity.customersOfJid(
        orgId,
        chat.session_id,
        chat.chat_id,
      );
      const verified = new Set(verifiedOf(opts.state));
      const ids = found.customers.map((x) => String(x.customer.id));
      const wanted = opts.state?.customer_id || null;
      // cliente escolhido e conferido pelo DOCUMENTO nesta conversa (vários no mesmo CPF: escolheu um) → vincula o número agora.
      // Achado pelo código (`__seen`) NUNCA vincula.
      if (wanted && !ids.includes(wanted) && verified.has(wanted)) {
        if (found.contact)
          await this.identity
            .ensureLinked(orgId, wanted, found.contact.id, 'bot', 'user')
            .catch(() => null);
        ids.unshift(wanted);
      }
      // os demais conferidos/vistos entram no contexto (é daí que `crm_choose` resolve a escolha e os textos leem o cliente)
      for (const id of [...verified, ...seenOf(opts.state)]) if (!ids.includes(id)) ids.push(id);
      const list = (
        await Promise.all(
          ids.slice(0, 5).map((id) =>
            this.crm
              .botCustomer(orgId, id, {
                contactId: found.contact?.id || null,
                verified: verified.has(id), // + vinculado (o botCustomer faz o OU); `__seen` fica false
              })
              .catch(() => null),
          ),
        )
      ).filter(Boolean) as BotCustomer[];
      return {
        ...base,
        customer: (wanted && list.find((c) => c.id === wanted)) || list[0] || null,
        customers: list,
        products: org.products,
        identity: org.identity,
        cancel_reasons: org.cancel_reasons,
      };
    } catch (e: any) {
      this.logger.warn(
        `bot CRM org=${orgId}: contexto do cliente indisponível (${String(e?.message || e).slice(0, 120)})`,
      );
      return { ...base, customer: null, customers: [], products: [] };
    }
  }

  private stateOf(row: any): BotState {
    const v: any = row?.vars || {};
    const st: any = {
      ...emptyState(),
      node_id: row?.node_id || null,
      status: row?.status || 'active',
      waiting_for: v.__waiting_for || null,
      vars: v.vars || {},
      retries: row?.retries || 0,
      wait_until: row?.wait_until
        ? new Date(row.wait_until).toISOString()
        : null,
      last_input: v.__last_input || null,
      pix: v.__pix || null,
      customer_id: v.__customer_id || null,
      crm: v.__crm || null,
      charge: v.__charge || null,
      book: v.__book || null,
      ticket: v.__ticket || null,
      order: v.__order || null,
    };
    if (Array.isArray(v.__verified)) st.__verified = v.__verified;
    if (Array.isArray(v.__seen)) st.__seen = v.__seen;
    return st as BotState;
  }

  private async persist(
    orgId: string,
    k: ChatKey,
    flowId: string,
    state: BotState,
    paymentId?: string | null,
  ) {
    const vars = {
      vars: state.vars,
      __waiting_for: state.waiting_for,
      __last_input: state.last_input,
      __pix: state.pix,
      __customer_id: state.customer_id || null,
      __crm: state.crm || null,
      __charge: state.charge || null,
      __book: state.book || null,
      __ticket: state.ticket || null,
      __order: state.order || null,
      __verified: verifiedOf(state),
      __seen: seenOf(state),
    };
    const data = {
      flow_id: flowId,
      node_id: state.node_id,
      status: state.status,
      vars: vars as any, // JSON (BotState tem `unknown`/`Record` que o tipo do Prisma não aceita direto)
      retries: state.retries,
      wait_until: state.wait_until ? new Date(state.wait_until) : null,
      ...(paymentId !== undefined ? { payment_id: paymentId } : {}),
    };
    await this.prisma.whatsapp_bot_sessions.upsert({
      where: this.chatWhere(orgId, k),
      create: {
        organization_id: orgId,
        session_id: k.session_id,
        chat_id: k.chat_id,
        started_at: new Date(),
        ...data,
      },
      update: data,
    });
    // a agenda decide quem responde "1/2" (pergunta dela × pergunta do bot) pelo mais recente
    this.hooks.emit('bot_state', { orgId, sessionId: k.session_id, chatId: k.chat_id, status: state.status, waiting_for: state.waiting_for || null });
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
      await this.attendance.setStatus(orgId, key, 'closed', {
        event: 'auto_closed',
        meta: { reset_hours: svc.reset_hours },
      });
    }
    if (!(await this.eligible(orgId, session, settings, chat))) return;

    const text = String(message?.body || '').trim();
    const sess = await this.findBotSession(orgId, key);
    const restart =
      Boolean(text) &&
      (settings.restart_keywords || []).some(
        (k) => norm(k) && norm(text) === norm(k),
      );
    const stale =
      sess &&
      Date.now() - new Date(sess.updated_at).getTime() >
        (settings.input_timeout_hours || 24) * 3600_000;

    // bloco atual sumiu (fluxo regravado com ids novos) → não fica preso: recomeça do início
    const nodeGone =
      sess &&
      sess.node_id &&
      !(def.nodes || []).some((n: any) => n?.id === sess.node_id);
    const sessState = sess ? this.stateOf(sess) : null;
    // ação de CRM que nunca respondeu (back reiniciou no meio / número desconectado) → recomeça
    const stuckCrm =
      RUNTIME_WAITS.includes(String(sessState?.waiting_for || '')) &&
      Date.now() - new Date(sess!.updated_at).getTime() > CRM_WAIT_STUCK_MS;
    const continuing = Boolean(
      sess &&
        RUNNING.includes(sess.status) &&
        !stale &&
        !restart &&
        !nodeGone &&
        !stuckCrm &&
        sess.flow_id === flow.id,
    );
    const ctx = await this.ctxFor(orgId, chat, settings, {
      flow,
      def,
      state: continuing ? sessState : null,
    });
    if (sess && continuing) {
      // mensagem escrita ANTES do bot terminar de responder (cliente mandou várias seguidas)
      // não é resposta ao menu/pergunta — ignora em vez de responder "opção inválida"
      const lastOut = (sess.vars as any)?.__last_out_at
        ? new Date((sess.vars as any).__last_out_at).getTime()
        : 0;
      const sentAt = message?.timestamp
        ? new Date(message.timestamp).getTime()
        : Date.now();
      if (lastOut && sentAt < lastOut - 1000) return;
      // arquivo da mensagem (foto/documento…) — os blocos de chamado aceitam como resposta
      const kind = mediaKindOf(message?.type);
      const media: BotInputMedia | null = kind
        ? { id: message?.media_id ? String(message.media_id) : null, kind, mime: null, filename: null }
        : null;
      const r = handleInput(def, sessState!, text, ctx, media);
      await this.persist(orgId, key, flow.id, r.state);
      await this.execute(
        orgId,
        session,
        key,
        flow.id,
        r.actions,
        r.state,
        ctx,
        def,
      );
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
    await this.begin(
      orgId,
      session,
      chat,
      flow,
      def,
      settings,
      ctx,
      text,
      restart ? 'bot_restarted' : 'bot_started',
    );
  }

  private async begin(
    orgId: string,
    session: SessionRow,
    chat: any,
    flow: any,
    def: BotDefinition,
    settings: BotSettings,
    ctx: BotContext,
    text: string | null,
    event: string,
    actor?: string | null,
  ) {
    const key = this.keyOf(chat);
    const r = startFlow(def, ctx, text);
    await this.persist(orgId, key, flow.id, r.state, null);
    await this.attendance.setStatus(orgId, key, 'bot', {
      event,
      actor: actor ?? null,
      meta: { flow_id: flow.id },
    });
    await this.execute(
      orgId,
      session,
      key,
      flow.id,
      r.actions,
      r.state,
      ctx,
      def,
    );
  }

  // ================================================================ execução das ações
  private async execute(
    orgId: string,
    session: SessionRow,
    k: ChatKey,
    flowId: string,
    actions: BotAction[],
    state: BotState,
    ctx: BotContext,
    def?: BotDefinition | null,
  ) {
    const sid = session?.openwa_session_id;
    if (!sid || session.status !== 'ready') {
      this.logger.warn(
        `bot org=${orgId} número=${sessionLabel(session)}: WhatsApp desconectado, ações descartadas`,
      );
      return;
    }
    try {
      await this.run(orgId, session, k, flowId, actions, state, ctx, def, 0);
    } finally {
      // marca quando o bot terminou de falar (ver processInbound)
      const row = await this.findBotSession(orgId, k).catch(() => null);
      if (row)
        await this.prisma.whatsapp_bot_sessions
          .update({
            where: { id: row.id },
            data: {
              vars: {
                ...((row.vars as any) || {}),
                __last_out_at: new Date().toISOString(),
              },
            },
          })
          .catch(() => undefined);
    }
  }

  private async run(
    orgId: string,
    session: SessionRow,
    k: ChatKey,
    flowId: string,
    actions: BotAction[],
    state: BotState,
    ctx: BotContext,
    def?: BotDefinition | null,
    depth = 0,
  ) {
    const sid = String(session.openwa_session_id);
    const jid = k.chat_id;
    for (const a of actions) {
      try {
        if (CRM_RESULT_ACTIONS.has(a.type)) {
          await this.runCrm(orgId, session, k, flowId, a, state, ctx, def, depth);
          continue;
        }
        if (BOOK_ACTIONS.has(a.type)) {
          await this.runBook(orgId, session, k, flowId, a, state, ctx, def, depth);
          continue;
        }
        if (TICKET_ACTIONS.has(a.type)) {
          await this.runTicket(orgId, session, k, flowId, a, state, ctx, def, depth);
          continue;
        }
        if (ORDER_ACTIONS.has(a.type)) {
          await this.runOrder(orgId, session, k, flowId, a, state, ctx, def, depth);
          continue;
        }
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
            await this.attendance.setStatus(
              orgId,
              k,
              a.assign_user_id ? 'human' : 'waiting',
              {
                assign: a.assign_user_id || null,
                event: 'handoff',
                meta: { by: 'bot', flow_id: flowId },
              },
            );
            break;
          case 'close':
            await this.attendance.setStatus(orgId, k, 'closed', {
              event: 'bot_closed',
              meta: { flow_id: flowId },
            });
            break;
          case 'finish': {
            const c = await this.findChat(orgId, k);
            if (c?.service_status === 'bot')
              await this.attendance.setStatus(orgId, k, 'none', {
                event: 'bot_finished',
                meta: { flow_id: flowId },
              });
            break;
          }
          case 'pix':
            await this.createPix(orgId, session, k, flowId, a, state, ctx);
            break;
          case 'pix_check':
            await this.checkPixNow(orgId, session, k, true);
            break;
          case 'charge_check':
            await this.checkChargeNow(orgId, session, k, a.charge_id, state);
            break;
          default:
            break; // set_var / wait / info: estado já persistido
        }
      } catch (e: any) {
        this.logger.warn(`bot ação ${a.type} ${jid}: ${e?.message || e}`);
      }
    }
  }

  // ================================================================ CRM (Fase 2 — contrato §1.4 e §6)
  /**
   * Executa uma ação de CRM do motor, devolve o resultado ao motor (`crm_result`), grava o estado e
   * executa o que vier (inclusive outra ação de CRM, até MAX_CRM_DEPTH). Roda DENTRO da fila da
   * conversa (`enqueue`). Falha inesperada = `crm_result {ok:false}` (o motor segue pela porta `failed`).
   */
  private async runCrm(
    orgId: string,
    session: SessionRow,
    k: ChatKey,
    flowId: string,
    a: BotAction,
    state: BotState,
    ctx: BotContext,
    def: BotDefinition | null | undefined,
    depth: number,
  ) {
    // laço de ações de CRM: no limite a ação NÃO roda e o motor recebe `{ok:false}` (segue por `failed`,
    // em vez de ficar preso em `crm_wait`); uma rodada além disso corta de vez.
    if (depth > MAX_CRM_DEPTH) {
      this.logger.warn(
        `bot CRM org=${orgId} conversa=${jidRef(k.chat_id)}: ações de CRM demais em sequência (${a.type} ignorada)`,
      );
      return;
    }
    const d =
      def || ((await this.flowById(orgId, flowId))?.definition as any) || null;
    if (!d) return;
    let payload: BotEventPayload;
    if (depth >= MAX_CRM_DEPTH) {
      this.logger.warn(
        `bot CRM org=${orgId} conversa=${jidRef(k.chat_id)}: ações de CRM demais em sequência (${a.type} não executada — fluxo em laço?)`,
      );
      payload = { ok: false, error: 'Ações de CRM demais em sequência (laço no fluxo?)' };
    } else {
      try {
        payload = await this.crmAction(orgId, k, flowId, a, state, ctx);
      } catch (e: any) {
        payload = {
          ok: false,
          error: String(e?.response?.message || e?.message || e).slice(0, 200),
        };
        if (e instanceof BotUserError) payload.user_text = String(e.message).slice(0, 500);
        else if (customFieldsUserText(e?.response)) payload.user_text = customFieldsUserText(e?.response)!;
      }
    }
    this.logger.log(
      `bot CRM org=${orgId} número=${String(k.session_id).slice(0, 8)} conversa=${jidRef(k.chat_id)} ação=${a.type} → ${payload.ok ? 'ok' : `falhou (${String(payload.error || '').slice(0, 100)})`}`,
    );
    const r = handleEvent(d, state, 'crm_result', ctx, payload);
    await this.persist(orgId, k, flowId, r.state);
    await this.run(orgId, session, k, flowId, r.actions, r.state, ctx, d, depth + 1);
  }

  /**
   * Cliente atual do bot (mesma resolução do motor: `state.customer_id` em `ctx.customers`, senão o do número —
   * identificado que sumiu do contexto NÃO cai no do número). Precisa ser desta conversa (vinculado, conferido
   * pelo documento ou visto pelo código). `write:true` (cancelar, pausar, trocar, atualizar, assinar, 2ª via)
   * exige vínculo ou documento conferido — quem só informou o código recebe uma recusa clara.
   */
  private ownCustomerId(state: BotState, ctx: BotContext, opts: { write?: boolean } = {}) {
    const c = currentCustomer(state, ctx);
    const id = c?.id || null;
    if (!id) throw new BadRequestException('Nenhum cliente identificado nesta conversa.');
    const known =
      (ctx.customers || []).some((x) => x.id === id) ||
      ctx.customer?.id === id ||
      verifiedOf(state).includes(id) ||
      seenOf(state).includes(id);
    if (!known)
      throw new BadRequestException('Cliente não pertence a esta conversa.');
    if (opts.write && !this.canWrite(state, ctx, id))
      throw new BotUserError(
        'Para alterar a assinatura ou os dados, confirme o seu CPF/CNPJ (o código sozinho só permite consultar).',
      );
    return id;
  }

  /**
   * Pode ALTERAR este cliente nesta conversa? = conferido pelo documento (`__verified`) ou vinculado ao número
   * (`botCustomer.verified`, que o `ctxFor` só liga para vinculados/conferidos — quem está só em `__seen` vem false).
   */
  private canWrite(state: BotState, ctx: BotContext, id: string) {
    if (verifiedOf(state).includes(id)) return true;
    const c = (ctx.customers || []).find((x) => x.id === id) || (ctx.customer?.id === id ? ctx.customer : null);
    return Boolean(c?.verified);
  }

  private async crmAction(
    orgId: string,
    k: ChatKey,
    flowId: string,
    a: BotAction,
    state: BotState,
    ctx: BotContext,
  ): Promise<BotEventPayload> {
    const contact = await this.identity.contactOfJid(
      orgId,
      k.session_id,
      k.chat_id,
    );
    const refresh = (id: string) =>
      this.crm.botCustomer(orgId, id, {
        contactId: contact?.id || null,
        verified: verifiedOf(state).includes(id),
      });
    // documento conferido → `__verified` (pode alterar + vincula o número); código → `__seen` (só leitura, sem vínculo)
    const markVerified = (ids: string[], kind: 'doc' | 'code' = 'doc') => {
      const key = kind === 'code' ? '__seen' : '__verified';
      const cur = kind === 'code' ? seenOf(state) : verifiedOf(state);
      (state as any)[key] = [...new Set([...cur, ...ids])].slice(-20);
    };
    switch (a.type) {
      case 'crm_lookup': {
        // freio: no máx. LOOKUP_LIMIT consultas por conversa por hora (ninguém enumera CPF/código pelo bot)
        const lk = `${orgId}|${k.session_id}|${k.chat_id}`;
        const nowMs = Date.now();
        const hits = (this.lookupHits.get(lk) || []).filter((t) => nowMs - t < LOOKUP_WINDOW_MS);
        if (hits.length >= LOOKUP_LIMIT) {
          this.lookupHits.set(lk, hits);
          throw new BotUserError('Muitas tentativas de identificação por aqui 🙏 Aguarde um pouco e tente de novo mais tarde.');
        }
        hits.push(nowMs);
        this.lookupHits.set(lk, hits);
        if (this.lookupHits.size > 5000) for (const [key, v] of this.lookupHits) if (!v.some((t) => nowMs - t < LOOKUP_WINDOW_MS)) this.lookupHits.delete(key);

        const r = await this.identity.findCustomer(
          orgId,
          a.by === 'code' ? { code: a.value } : { doc: a.value },
        );
        const ids = r.found.slice(0, 5).map((c: any) => String(c.id));
        if (!ids.length) return { ok: true, customers: [] };
        // Só o CPF/CNPJ conferido vale como verificação (pode alterar) e vincula o número de vez (decisão D2);
        // código/matrícula é fácil de adivinhar → só leitura nesta conversa, sem vínculo permanente.
        const byDoc = a.by !== 'code';
        markVerified(ids, byDoc ? 'doc' : 'code');
        if (ids.length === 1 && contact && byDoc)
          await this.identity.ensureLinked(orgId, ids[0], contact.id, 'bot', 'user');
        const list = (
          await Promise.all(ids.map((id) => refresh(id).catch(() => null)))
        ).filter(Boolean) as BotCustomer[];
        return { ok: true, customers: list };
      }

      case 'crm_create_customer': {
        // Regra (simples e segura) quando o número JÁ tem cliente:
        //  - cadastro do número ainda SEM documento → "completar o cadastro": atualiza esse cliente (nunca sobrescreve doc/código preenchidos);
        //  - cliente já tem documento e o digitado é OUTRO → é outra pessoa: cria um NOVO cliente neste número (`another:true`);
        //  - cliente já tem documento e o digitado é o mesmo (ou não perguntou documento) → atualiza nome/e-mail/endereço/campos, sem tocar em doc/código.
        const found = await this.identity.customersOfJid(
          orgId,
          k.session_id,
          k.chat_id,
        );
        const ids = found.customers.map((x) => String(x.customer.id));
        const target =
          state.customer_id && ids.includes(state.customer_id)
            ? state.customer_id
            : ids[0] || null;
        const cur = target
          ? await this.prisma.whatsapp_customers.findFirst({ where: { id: target, organization_id: orgId } })
          : null;
        const typedDoc = digitsOnly(a.fields?.doc);
        const curDoc = digitsOnly((cur as any)?.doc);
        const samePerson = cur && (!typedDoc || !curDoc || typedDoc === curDoc);
        if (cur && samePerson) {
          const dto = fieldsToCustomerDto(a.fields, cur as any);
          if (curDoc) delete dto.doc;
          if (String((cur as any).code || '').trim()) delete dto.code;
          if (Object.keys(dto).length) await this.crm.updateCustomer(orgId, cur.id, dto);
          return { ok: true, customer: await refresh(cur.id) };
        }
        const ct = found.contact || contact;
        if (!ct)
          throw new BadRequestException('Contato da conversa não encontrado.');
        const dto = fieldsToCustomerDto(a.fields);
        const created = await this.crm.createCustomer(orgId, null, {
          ...dto,
          contact_id: ct.id,
          source: 'bot',
          ...(cur ? { another: true } : {}),
        });
        if (a.link_role && a.link_role !== 'owner')
          await this.identity
            .setRole(orgId, created.id, ct.id, a.link_role)
            .catch(() => undefined);
        markVerified([created.id]);
        return { ok: true, customer: await refresh(created.id) };
      }

      case 'crm_update_customer': {
        const id = this.ownCustomerId(state, ctx, { write: true });
        const cur = await this.prisma.whatsapp_customers.findFirst({
          where: { id, organization_id: orgId },
        });
        if (!cur) throw new NotFoundException('Cliente não encontrado.');
        const dto = fieldsToCustomerDto(a.fields, cur as any);
        // documento e código preenchidos não mudam pelo bot (identidade do cliente)
        if (dto.doc && digitsOnly((cur as any).doc) && digitsOnly(dto.doc) !== digitsOnly((cur as any).doc))
          throw new BotUserError('O CPF/CNPJ do cadastro não pode ser alterado por aqui. Fale com um atendente 🙂');
        if (dto.code && String((cur as any).code || '').trim() && String(dto.code).trim() !== String((cur as any).code).trim())
          throw new BotUserError('O código do cliente não pode ser alterado por aqui. Fale com um atendente 🙂');
        if (dto.doc && digitsOnly((cur as any).doc)) delete dto.doc;
        if (dto.code && String((cur as any).code || '').trim()) delete dto.code;
        if (!Object.keys(dto).length)
          throw new BadRequestException('Nenhum dado para atualizar.');
        await this.crm.updateCustomer(orgId, id, dto);
        return { ok: true, customer: await refresh(id) };
      }

      case 'crm_subscribe': {
        const id = this.ownCustomerId(state, ctx, { write: true });
        const product = await this.prisma.whatsapp_products.findFirst({
          where: { id: String(a.product_id || ''), organization_id: orgId, active: true },
        });
        if (!product) throw new BadRequestException('Esse plano não está disponível.');
        // mesma conversa já gerou a cobrança deste plano neste bloco e ela segue em aberto → reenvia (sem assinatura em dobro)
        const pending = await this.prisma.whatsapp_charges.findFirst({
          where: {
            organization_id: orgId,
            customer_id: id,
            status: 'PENDING',
            bot_flow_id: flowId,
            bot_node_id: a.node_id,
            product_id: product.id,
            created_at: { gte: new Date(Date.now() - 2 * 86_400_000) },
          },
          orderBy: { created_at: 'desc' },
        });
        if (pending?.subscription_id) {
          const shaped = await this.charges.resend(orgId, pending.id);
          const sub = await this.subscriptions.get(orgId, pending.subscription_id);
          return {
            ok: true,
            customer: await refresh(id),
            subscription: this.crm.botSubscription(sub),
            charge: toBotCharge(shaped),
          };
        }
        // já assina este plano (ativa/em atraso/pausada) → nada de assinatura em dobro (o motor já filtra; aqui é a trava)
        const dup = await this.prisma.whatsapp_subscriptions.findFirst({
          where: {
            organization_id: orgId,
            customer_id: id,
            product_id: product.id,
            status: { in: ['active', 'overdue', 'paused'] },
          },
          select: { id: true },
        });
        if (dup)
          throw new BotUserError(`Você já tem uma assinatura de *${product.name}* 🙂 Para mudar algo nela, é só me chamar.`);
        if (a.charge_now) {
          // confere antes de criar a assinatura (assim não sobra assinatura sem a 1ª cobrança)
          const pv = await this.subscriptions.preview(orgId, id, { product_id: product.id });
          if (pv.first_charge) {
            const cfg = await this.charges.settings(orgId);
            if (!cfg.gateway_ready)
              throw new BadRequestException('Gateway de pagamento não configurado.');
            if (a.method === 'boleto' && !cfg.boleto_available)
              throw new BadRequestException('O gateway configurado não emite boleto.');
          }
        }
        const sub = await this.subscriptions.createSubscription(
          orgId,
          id,
          { product_id: product.id },
          { source: 'bot' },
        );
        let charge: BotState['charge'] = null;
        if (a.charge_now && sub.first_charge) {
          try {
            const shaped = await this.charges.create(
              orgId,
              null,
              {
                customer_id: id,
                subscription_id: sub.id,
                amount_cents: sub.first_charge.amount_cents,
                description: sub.first_charge.description,
                due_at: sub.first_charge.due_at,
                kind: a.method === 'boleto' ? 'boleto' : 'pix',
                session_id: k.session_id,
                chat_id: k.chat_id,
                bot: { flow_id: flowId, node_id: a.node_id },
                send: true,
              },
              'bot',
            );
            charge = toBotCharge(shaped);
          } catch (e) {
            // sem a 1ª cobrança a assinatura não fica de pé (não daria acesso sem pagar)
            await this.subscriptions
              .cancel(orgId, sub.id, {
                policy: 'immediate',
                reason: 'Falha ao gerar a 1ª cobrança pelo bot',
                source: 'bot',
              })
              .catch(() => undefined);
            throw e;
          }
        }
        return {
          ok: true,
          customer: await refresh(id),
          subscription: this.crm.botSubscription(sub),
          ...(charge ? { charge } : {}),
        };
      }

      case 'crm_send_charge': {
        // 2ª via = cobrança passa a sair NESTA conversa → só para quem está vinculado ou conferiu o documento
        // (quem só informou o código não recebe a cobrança de outra pessoa aqui, nem em outro lugar)
        const id = this.ownCustomerId(state, ctx, { write: true });
        const ch = await this.prisma.whatsapp_charges.findFirst({
          where: { id: String(a.charge_id || ''), organization_id: orgId },
        });
        if (!ch || ch.customer_id !== id)
          throw new NotFoundException('Cobrança não encontrada.');
        if (ch.status !== 'PENDING')
          throw new BadRequestException('Essa cobrança não está mais em aberto.');
        // a 2ª via sai NESTA conversa (o cliente pediu aqui), mesmo que a cobrança tenha ido por outro número
        if (ch.session_id !== k.session_id || ch.chat_id !== k.chat_id)
          await this.prisma.whatsapp_charges.update({
            where: { id: ch.id },
            data: { session_id: k.session_id, chat_id: k.chat_id },
          });
        const shaped = await this.charges.resend(
          orgId,
          ch.id,
          a.method === 'same' ? {} : { kind: a.method },
        );
        return { ok: true, customer: await refresh(id), charge: toBotCharge(shaped) };
      }

      case 'crm_cancel_subscription':
      case 'crm_pause_subscription':
      case 'crm_change_plan': {
        const id = this.ownCustomerId(state, ctx, { write: true });
        const sub = await this.prisma.whatsapp_subscriptions.findFirst({
          where: { id: String(a.subscription_id || ''), organization_id: orgId },
          select: { id: true, customer_id: true },
        });
        if (!sub || sub.customer_id !== id)
          throw new NotFoundException('Assinatura não encontrada.');
        let shaped: any;
        let product: BotProduct | undefined;
        if (a.type === 'crm_cancel_subscription')
          shaped = await this.subscriptions.cancel(orgId, sub.id, {
            policy: a.policy,
            reason: a.reason,
            source: 'bot',
          });
        else if (a.type === 'crm_pause_subscription')
          shaped = await this.subscriptions.pause(orgId, sub.id, {
            days: a.days,
            source: 'bot',
          });
        else {
          const p = await this.prisma.whatsapp_products.findFirst({
            where: { id: String(a.product_id || ''), organization_id: orgId, active: true },
          });
          if (!p) throw new BadRequestException('Esse plano não está disponível.');
          shaped = await this.subscriptions.changePlan(orgId, sub.id, p.id, {
            source: 'bot',
          });
          product =
            (await this.crmOrg(orgId)).products.find((x) => x.id === p.id) ||
            undefined;
        }
        return {
          ok: true,
          customer: await refresh(id),
          subscription: this.crm.botSubscription(shaped),
          ...(product ? { product } : {}),
        };
      }
      default:
        return { ok: false, error: `Ação ${a.type} desconhecida.` };
    }
  }

  // ================================================================ AGENDA (Fase 6 — contrato §9.4)
  /** O fluxo lê os próximos agendamentos fora dos blocos de agenda? (cache por fluxo + versão) */
  private flowNeedsAppointments(flow: any, def: BotDefinition | null | undefined) {
    if (!def) return false;
    if (!flow?.id) return flowUsesAppointments(def);
    const key = String(flow.updated_at ? new Date(flow.updated_at).getTime() : 0);
    const c = this.usesApptCache.get(flow.id);
    if (c && c.key === key) return c.uses;
    const uses = flowUsesAppointments(def);
    this.usesApptCache.set(flow.id, { key, uses });
    return uses;
  }

  /** Próximos agendamentos (até 5) do contato da conversa + dos clientes dele (vinculados, conferidos ou vistos). */
  private async listUpcoming(orgId: string, contactId: string | null, customerIds: string[]): Promise<BotAppointment[]> {
    const sch = this.scheduling;
    if (!sch) return [];
    const queries: Promise<any[]>[] = [];
    if (contactId) queries.push(Promise.resolve(sch.upcomingOf(orgId, { contact_id: contactId, limit: 5 } as any)).catch(() => []));
    for (const id of customerIds.slice(0, 5)) queries.push(Promise.resolve(sch.upcomingOf(orgId, { customer_id: id, limit: 5 } as any)).catch(() => []));
    const seen = new Set<string>();
    const out: BotAppointment[] = [];
    for (const list of await Promise.all(queries))
      for (const a of Array.isArray(list) ? list : []) {
        if (!a?.id || seen.has(String(a.id))) continue;
        seen.add(String(a.id));
        out.push(toBotAppointment(a));
      }
    return out.sort((x, y) => String(x.starts_at).localeCompare(String(y.starts_at))).slice(0, 5);
  }

  /** Contato da conversa + ids dos clientes VINCULADOS ao número (o "dono" para a agenda). */
  private async chatParties(orgId: string, k: ChatKey) {
    const f = await this.identity
      .customersOfJid(orgId, k.session_id, k.chat_id)
      .catch(() => ({ contact: null as any, customers: [] as any[] }));
    const linked = f.customers.map((x: any) => ({ id: String(x.customer.id), role: String(x.role || '') }));
    return { contact: f.contact || null, linked };
  }

  /**
   * Cliente em nome de quem o bot AGENDA: o identificado nesta conversa (vinculado ao número ou conferido pelo
   * documento), senão o titular vinculado ao número (ou o 1º), senão nenhum (o serviço agenda só pelo contato).
   * Cliente só "visto" pelo código não pode agendar no cadastro dele (consumiria uso do plano / crédito).
   */
  private async bookCustomerId(orgId: string, k: ChatKey, state: BotState, parties: { linked: { id: string; role: string }[] }) {
    const linked = parties.linked.map((x) => x.id);
    const id = state.customer_id;
    if (id) {
      if (linked.includes(id) || verifiedOf(state).includes(id)) return id;
      if (seenOf(state).includes(id))
        throw new BotUserError('Para agendar no seu cadastro, confirme o seu CPF/CNPJ (o código sozinho só permite consultar).');
    }
    return (parties.linked.find((x) => x.role === 'owner') || parties.linked[0])?.id || null;
  }

  /**
   * O agendamento é desta conversa? (`WhatsAppSchedulingService.belongsTo`) = do contato da conversa, ou de um cliente
   * vinculado ao número / conferido pelo documento. Cliente só visto pelo código: lê e confirma presença, mas NÃO
   * remarca nem cancela (recusa amigável pedindo o CPF/CNPJ). Outro dono = 404 (não revela que existe).
   */
  private async assertApptOwner(
    orgId: string,
    id: string,
    state: BotState,
    parties: { contact: any; linked: { id: string }[] },
    opts: { write: boolean },
  ) {
    const sch = this.scheduling!;
    const contact_id = parties.contact?.id ? String(parties.contact.id) : null;
    const strong = [...new Set([...parties.linked.map((x) => x.id), ...verifiedOf(state)])];
    if (await sch.belongsTo(orgId, String(id || ''), { contact_id, customer_ids: strong })) return;
    const seen = seenOf(state).filter((x) => !strong.includes(x));
    if (seen.length && (await sch.belongsTo(orgId, String(id || ''), { customer_ids: seen }))) {
      if (!opts.write) return;
      throw new BotUserError('Para remarcar ou cancelar, confirme o seu CPF/CNPJ (o código sozinho só permite consultar).');
    }
    throw new NotFoundException('Agendamento não encontrado.');
  }

  /** Leituras da agenda (runtime e simulador com dados reais). */
  private async bookRead(orgId: string, a: BotAction): Promise<BotEventPayload> {
    const sch = this.scheduling;
    if (!sch) throw new BadRequestException('Agenda indisponível.');
    if (a.type === 'book_services') return { ok: true, services: ((await sch.services(orgId)) || []).map(toBotService) };
    if (a.type === 'book_resources') {
      const list: any[] = (await sch.resourcesFor(orgId, a.product_id)) || [];
      return { ok: true, resources: list.filter((r) => r?.id).map((r) => ({ id: String(r.id), name: String(r.name || '') })) };
    }
    if (a.type === 'book_availability')
      return {
        ok: true,
        days: toBotDays(
          await sch.availability(orgId, {
            product_id: a.product_id,
            ...(a.resource_id ? { resource_id: a.resource_id } : {}),
            from: a.from,
            days: Math.max(1, Math.min(60, Number(a.days) || 14)),
          } as any),
        ),
      };
    return { ok: false, error: `Ação ${a.type} não é de leitura.` };
  }

  /** Executa uma ação de agenda e devolve `book_result` (mesma mecânica do `runCrm`). */
  private async runBook(
    orgId: string,
    session: SessionRow,
    k: ChatKey,
    flowId: string,
    a: BotAction,
    state: BotState,
    ctx: BotContext,
    def: BotDefinition | null | undefined,
    depth: number,
  ) {
    if (depth > MAX_CRM_DEPTH) {
      this.logger.warn(`bot agenda org=${orgId} conversa=${jidRef(k.chat_id)}: ações demais em sequência (${a.type} ignorada)`);
      return;
    }
    const d = def || ((await this.flowById(orgId, flowId))?.definition as any) || null;
    if (!d) return;
    let payload: BotEventPayload;
    if (depth >= MAX_CRM_DEPTH) payload = { ok: false, error: 'Ações demais em sequência (laço no fluxo?)' };
    else {
      try {
        payload = await this.bookAction(orgId, k, flowId, a, state);
      } catch (e: any) {
        const resp = e?.response && typeof e.response === 'object' ? e.response : {};
        payload = {
          ok: false,
          error: String(resp.message || e?.message || e).slice(0, 200),
          ...(resp.code || e?.code ? { code: String(resp.code || e.code) } : {}),
        };
        const status = Number(e?.status || e?.getStatus?.() || 0);
        if (e instanceof BotUserError) payload.user_text = String(e.message).slice(0, 500);
        else if (payload.code === 'CUSTOMER_REQUIRED')
          payload.user_text = 'Para agendar este serviço eu preciso do seu cadastro 🙂 Fale com um atendente ou faça o cadastro primeiro.';
        else if (
          (status === 400 || status === 409) &&
          !payload.code &&
          ['book_create', 'book_reschedule', 'appt_confirm', 'appt_cancel'].includes(a.type) &&
          typeof resp.message === 'string'
        )
          // mensagens de regra da agenda (fora do horário, antecedência, limite de remarcações…) são escritas para o cliente
          payload.user_text = String(resp.message).slice(0, 300);
      }
    }
    this.logger.log(
      `bot agenda org=${orgId} número=${String(k.session_id).slice(0, 8)} conversa=${jidRef(k.chat_id)} ação=${a.type} → ${payload.ok ? 'ok' : `falhou (${payload.code || ''} ${String(payload.error || '').slice(0, 100)})`}`,
    );
    const r = handleEvent(d, state, 'book_result', ctx, payload);
    await this.persist(orgId, k, flowId, r.state);
    await this.run(orgId, session, k, flowId, r.actions, r.state, ctx, d, depth + 1);
  }

  private async bookAction(orgId: string, k: ChatKey, flowId: string, a: BotAction, state: BotState): Promise<BotEventPayload> {
    const sch = this.scheduling;
    if (!sch) throw new BadRequestException('Agenda indisponível.');
    if (BOOK_READ_ACTIONS.has(a.type)) return this.bookRead(orgId, a);
    const parties = await this.chatParties(orgId, k);
    switch (a.type) {
      case 'book_create': {
        const customerId = await this.bookCustomerId(orgId, k, state, parties);
        const r: any = await sch.book(orgId, {
          product_id: a.product_id,
          ...(a.resource_id ? { resource_id: a.resource_id } : {}),
          starts_at: a.starts_at,
          ...(customerId ? { customer_id: customerId } : {}),
          ...(parties.contact?.id ? { contact_id: String(parties.contact.id) } : {}),
          session_id: k.session_id,
          chat_id: k.chat_id,
          source: 'bot',
          bot: { flow_id: flowId, node_id: a.node_id },
        } as any);
        const appointment = r?.appointment ? toBotAppointment(r.appointment) : null;
        return { ok: true, appointment, charge: bookingCharge(r?.charge, r?.appointment) };
      }
      case 'book_reschedule': {
        await this.assertApptOwner(orgId, a.appointment_id, state, parties, { write: true });
        const r: any = await sch.reschedule(orgId, String(a.appointment_id), {
          starts_at: a.starts_at,
          ...(a.resource_id ? { resource_id: a.resource_id } : {}),
          by: 'customer',
        } as any);
        const shaped = r?.appointment || r;
        return { ok: true, appointment: shaped?.id ? toBotAppointment(shaped) : null };
      }
      case 'appt_list': {
        // leitura: contato da conversa + clientes vinculados, conferidos pelo documento ou vistos pelo código
        const ids = [...new Set([...parties.linked.map((x) => x.id), ...verifiedOf(state), ...seenOf(state)])];
        return { ok: true, appointments: await this.listUpcoming(orgId, parties.contact?.id ? String(parties.contact.id) : null, ids) };
      }
      case 'appt_confirm': {
        await this.assertApptOwner(orgId, a.id, state, parties, { write: false }); // confirmar presença: leitura basta
        const r: any = await sch.confirm(orgId, String(a.id), { by: 'customer' } as any);
        const shaped = r?.appointment || r;
        return { ok: true, appointment: shaped?.id ? toBotAppointment(shaped) : null };
      }
      case 'appt_cancel': {
        await this.assertApptOwner(orgId, a.id, state, parties, { write: true });
        const r: any = await sch.cancel(orgId, String(a.id), { by: 'customer', reason: a.reason || 'Cancelado pelo cliente no WhatsApp' } as any);
        const shaped = r?.appointment || r;
        return { ok: true, appointment: shaped?.id ? toBotAppointment(shaped) : null };
      }
      case 'waitlist_join': {
        if (!parties.contact?.id) throw new BadRequestException('Contato da conversa não encontrado.');
        // cliente só entra se for desta conversa com direito de escrita (senão a espera fica só no contato)
        let customerId: string | null = null;
        try {
          customerId = await this.bookCustomerId(orgId, k, state, parties);
        } catch {
          customerId = null;
        }
        await sch.waitlistJoin(orgId, {
          product_id: a.product_id,
          ...(a.resource_id ? { resource_id: a.resource_id } : {}),
          period: a.period,
          date_from: a.date_from,
          date_to: a.date_to,
          contact_id: String(parties.contact.id),
          ...(customerId ? { customer_id: customerId } : {}),
          session_id: k.session_id,
          chat_id: k.chat_id,
        } as any);
        return { ok: true };
      }
      default:
        return { ok: false, error: `Ação ${a.type} desconhecida.` };
    }
  }

  // ================================================================ chamados (Fase 6B — contrato §10.5)
  private flowNeedsTickets(flow: any, def: BotDefinition | null | undefined) {
    if (!def) return false;
    if (!flow?.id) return flowUsesTickets(def);
    const key = String(flow.updated_at ? new Date(flow.updated_at).getTime() : 0);
    const c = this.usesTicketCache.get(flow.id);
    if (c && c.key === key) return c.uses;
    const uses = flowUsesTickets(def);
    this.usesTicketCache.set(flow.id, { key, uses });
    return uses;
  }

  /**
   * Quem é "dono" nesta conversa para os chamados: contato da conversa + clientes VINCULADOS ao número ou conferidos
   * pelo documento (`strong` — podem juntar informação) e clientes só vistos pelo código (`seen` — só leitura).
   */
  private ticketWho(state: BotState, parties: { contact: any; linked: { id: string }[] }, extraSeen: string[] = []) {
    const contact_id = parties.contact?.id ? String(parties.contact.id) : null;
    const strong = [...new Set([...parties.linked.map((x) => String(x.id)), ...verifiedOf(state)])];
    const seen = [...new Set([...seenOf(state), ...extraSeen])].filter((x) => !strong.includes(x));
    return { contact_id, strong, seen };
  }

  /** Chamado no formato do motor + "pode juntar informação nesta conversa?" (contato ou cliente forte). */
  private async botTicket(orgId: string, t: any, who: { contact_id: string | null; strong: string[] }, withUpdate = true): Promise<BotTicket> {
    const last = withUpdate && this.tickets ? await this.tickets.lastPublicUpdate(orgId, String(t.id)).catch(() => null) : null;
    const canWrite = Boolean((who.contact_id && t.contact_id === who.contact_id) || (t.customer?.id && who.strong.includes(String(t.customer.id))));
    // campos personalizados do chamado visíveis ao cliente (Fase 7) — "Meus chamados" mostra
    const defs = this.customFields ? (await this.cfMap(orgId)).ticket || [] : [];
    return toBotTicket(t, { last_update: last?.body ? String(last.body).slice(0, 500) : null, can_add_info: canWrite, fields: visibleFields(defs, t?.custom) });
  }

  /** Chamados (em andamento ou todos, mais recentes primeiro) do contato + destes clientes. */
  private async ticketsOf(orgId: string, contactId: string | null, customerIds: string[], activeOnly: boolean, limit = 10): Promise<BotTicket[]> {
    if (!this.tickets) return [];
    const list: any[] = await this.tickets.ofContact(orgId, { contact_id: contactId, customer_ids: customerIds.slice(0, 10) }, { limit, active_only: activeOnly });
    return (Array.isArray(list) ? list : []).map((t) => toBotTicket(t, { last_update: null }));
  }

  /** Leituras de chamados (runtime e simulador com dados reais). */
  private async ticketRead(orgId: string, a: BotAction, who: { contact_id: string | null; strong: string[]; seen: string[] }): Promise<BotEventPayload> {
    const tk = this.tickets;
    if (!tk) throw new BadRequestException('Chamados indisponíveis.');
    const all = [...who.strong, ...who.seen];
    if (a.type === 'ticket_categories') return { ok: true, categories: toBotCategories(await tk.settings(orgId)) };
    if (a.type === 'ticket_list') {
      const rows: any[] = await tk.ofContact(orgId, { contact_id: who.contact_id, customer_ids: all.slice(0, 10) }, { limit: Math.max(1, Math.min(10, Number(a.limit) || 5)), active_only: a.show !== 'all' });
      return { ok: true, tickets: await Promise.all((rows || []).map((t) => this.botTicket(orgId, t, who))) };
    }
    if (a.type === 'ticket_lookup') {
      // só acha se for do contato/cliente (outro dono = "não encontrado", nunca revela que existe)
      const t = await tk.byProtocol(orgId, a.protocol, { contact_id: who.contact_id, customer_ids: all });
      return { ok: true, ticket: t ? await this.botTicket(orgId, t, who) : null };
    }
    return { ok: false, error: `Ação ${a.type} não é de leitura.` };
  }

  /** Executa uma ação de chamado e devolve `crm_result` (mesma mecânica do `runBook`). */
  private async runTicket(
    orgId: string,
    session: SessionRow,
    k: ChatKey,
    flowId: string,
    a: BotAction,
    state: BotState,
    ctx: BotContext,
    def: BotDefinition | null | undefined,
    depth: number,
  ) {
    if (depth > MAX_CRM_DEPTH) {
      this.logger.warn(`bot chamados org=${orgId} conversa=${jidRef(k.chat_id)}: ações demais em sequência (${a.type} ignorada)`);
      return;
    }
    const d = def || ((await this.flowById(orgId, flowId))?.definition as any) || null;
    if (!d) return;
    let payload: BotEventPayload;
    if (depth >= MAX_CRM_DEPTH) payload = { ok: false, error: 'Ações demais em sequência (laço no fluxo?)' };
    else {
      try {
        payload = await this.ticketAction(orgId, k, a, state);
      } catch (e: any) {
        const resp = e?.response && typeof e.response === 'object' ? e.response : {};
        payload = {
          ok: false,
          error: String(resp.message || e?.message || e).slice(0, 200),
          ...(resp.code || e?.code ? { code: String(resp.code || e.code) } : {}),
        };
        if (e instanceof BotUserError) payload.user_text = String(e.message).slice(0, 500);
        else if (customFieldsUserText(resp)) payload.user_text = customFieldsUserText(resp)!;
        else if (payload.code === 'CATEGORY_INVALID')
          payload.user_text = 'Essa opção de chamado não está disponível no momento 😕 Fale com um atendente, por favor.';
      }
    }
    this.logger.log(
      `bot chamados org=${orgId} número=${String(k.session_id).slice(0, 8)} conversa=${jidRef(k.chat_id)} ação=${a.type} → ${payload.ok ? 'ok' : `falhou (${payload.code || ''} ${String(payload.error || '').slice(0, 100)})`}`,
    );
    const r = handleEvent(d, state, 'crm_result', ctx, payload);
    await this.persist(orgId, k, flowId, r.state);
    await this.run(orgId, session, k, flowId, r.actions, r.state, ctx, d, depth + 1);
  }

  private async ticketAction(orgId: string, k: ChatKey, a: BotAction, state: BotState): Promise<BotEventPayload> {
    const tk = this.tickets;
    if (!tk) throw new BadRequestException('Chamados indisponíveis.');
    const parties = await this.chatParties(orgId, k);
    const who = this.ticketWho(state, parties);
    if (TICKET_READ_ACTIONS.has(a.type)) return this.ticketRead(orgId, a, who);
    switch (a.type) {
      case 'ticket_create': {
        const key = `${orgId}|${k.session_id}|${k.chat_id}`;
        const now = Date.now();
        const hits = (this.ticketHits.get(key) || []).filter((t) => now - t < LOOKUP_WINDOW_MS);
        if (hits.length >= TICKET_CREATE_LIMIT)
          throw new BotUserError('Você já abriu vários chamados agora há pouco 🙏 Aguarde o retorno da equipe ou fale com um atendente.');
        // em nome de quem: o cliente identificado (vinculado/conferido pelo documento), senão o titular do número;
        // cliente só VISTO pelo código não recebe o chamado no cadastro dele (fica só no contato da conversa)
        const linked = parties.linked.map((x) => x.id);
        const sid = state.customer_id && (linked.includes(state.customer_id) || verifiedOf(state).includes(state.customer_id)) ? state.customer_id : null;
        const customerId = sid || (parties.linked.find((x) => x.role === 'owner') || parties.linked[0])?.id || null;
        const t: any = await tk.create(orgId, {
          category: a.category,
          subject: a.subject || null,
          description: a.description,
          priority: a.priority || null,
          ...(customerId ? { customer_id: customerId } : {}),
          ...(parties.contact?.id ? { contact_id: String(parties.contact.id) } : {}),
          session_id: k.session_id,
          chat_id: k.chat_id,
          media_ids: (a.media_ids || []).slice(0, 3),
          ...(a.custom && Object.keys(a.custom).length ? { custom: a.custom } : {}),
          source: 'bot',
          user_id: null,
        } as any);
        hits.push(now);
        this.ticketHits.set(key, hits);
        if (this.ticketHits.size > 5000) for (const [kk, v] of this.ticketHits) if (!v.some((x) => now - x < LOOKUP_WINDOW_MS)) this.ticketHits.delete(kk);
        return { ok: true, ticket: await this.botTicket(orgId, t, who, false) };
      }
      case 'ticket_add_info': {
        // é desta conversa? contato ou cliente forte = pode; só visto pelo código = recusa amigável; outro dono = 404
        const id = String(a.id || '');
        if (!(await tk.belongsTo(orgId, id, { contact_id: who.contact_id, customer_ids: who.strong }))) {
          if (who.seen.length && (await tk.belongsTo(orgId, id, { customer_ids: who.seen })))
            throw new BotUserError('Para enviar informações sobre este chamado, confirme o seu CPF/CNPJ (o código sozinho só permite consultar).');
          throw new NotFoundException('Chamado não encontrado.');
        }
        const r: any = await tk.customerMessage(orgId, id, { body: a.body || null, media_id: a.media_id || null }, { by: 'bot' });
        if (!r?.ok) {
          const ticket = r?.ticket ? await this.botTicket(orgId, r.ticket, who, false) : null;
          if (r?.reason === 'closed') return { ok: false, code: 'CLOSED', error: 'Chamado encerrado.', ticket };
          return { ok: false, error: r?.reason === 'empty' ? 'Mensagem vazia.' : 'Não foi possível juntar a mensagem.', ticket };
        }
        return { ok: true, ticket: await this.botTicket(orgId, r.ticket, who) };
      }
      default:
        return { ok: false, error: `Ação ${a.type} desconhecida.` };
    }
  }

  // ================================================================ pedidos + campos personalizados (Fase 7 — contrato §11.1/§11.3)
  private cachedUse(cache: Map<string, { key: string; uses: boolean }>, flow: any, def: BotDefinition | null | undefined, fn: (d: BotDefinition) => boolean) {
    if (!def) return false;
    if (!flow?.id) return fn(def);
    const key = String(flow.updated_at ? new Date(flow.updated_at).getTime() : 0);
    const c = cache.get(flow.id);
    if (c && c.key === key) return c.uses;
    const uses = fn(def);
    cache.set(flow.id, { key, uses });
    return uses;
  }
  private flowNeedsOrders(flow: any, def: BotDefinition | null | undefined) {
    return this.cachedUse(this.usesOrderCache, flow, def, flowUsesOrders);
  }
  private flowNeedsCustomFields(flow: any, def: BotDefinition | null | undefined) {
    return this.cachedUse(this.usesCfCache, flow, def, flowUsesCustomFields);
  }

  /** Definições dos campos personalizados (cliente/chamado/pedido) no formato do motor (cache de 60 s no serviço). */
  private async cfMap(orgId: string, fresh = false): Promise<BotCustomFieldMap> {
    if (!this.customFields) return {};
    if (fresh) this.customFields.invalidate(orgId);
    return cfMapForBot(await this.customFields.map(orgId).catch(() => null));
  }

  /** Pedidos (em andamento ou todos, mais recentes primeiro) do contato + destes clientes. */
  private async ordersOf(orgId: string, contactId: string | null, customerIds: string[], openOnly: boolean, cf?: BotCustomFieldMap, limit = 10): Promise<BotOrder[]> {
    if (!this.orders) return [];
    const list: any[] = await this.orders.ofContact(orgId, { contact_id: contactId, customer_ids: customerIds.slice(0, 10) }, { limit, open_only: openOnly });
    const defs = (cf || (await this.cfMap(orgId))).order || [];
    return (Array.isArray(list) ? list : []).map((o) => toBotOrder(o, defs));
  }

  /** Pedido de uma cobrança (texto de pago/expirado, entrega tardia). */
  private async orderOfCharge(orgId: string, chargeId: string): Promise<BotOrder | null> {
    if (!this.orders || !chargeId) return null;
    const row = await this.prisma.whatsapp_orders
      .findFirst({ where: { organization_id: orgId, charge_id: chargeId }, orderBy: { created_at: 'desc' }, select: { id: true } })
      .catch(() => null);
    if (!row) return null;
    const o = await Promise.resolve(this.orders.get(orgId, row.id)).catch(() => null);
    return o ? toBotOrder(o, (await this.cfMap(orgId)).order || []) : null;
  }

  /**
   * Em nome de quem o bot FAZ o pedido: o cliente identificado (vinculado ao número ou conferido pelo documento), senão o
   * titular vinculado ao número (ou o 1º), senão nenhum (o serviço cria o cliente pelo contato quando precisa do PIX).
   * Cliente só visto pelo código NÃO recebe pedido no cadastro dele (nem tem os endereços oferecidos).
   */
  private orderCustomerId(state: BotState, parties: { linked: { id: string; role: string }[] }) {
    const linked = parties.linked.map((x) => x.id);
    const id = state.customer_id;
    if (id && (linked.includes(id) || verifiedOf(state).includes(id))) return id;
    return (parties.linked.find((x) => x.role === 'owner') || parties.linked[0])?.id || null;
  }

  /** Leituras de pedidos (runtime e simulador com dados reais): catálogo + configuração + endereços · lista do contato. */
  private async orderRead(
    orgId: string,
    a: BotAction,
    who: { contact_id: string | null; strong: string[]; seen: string[]; address_customer_id: string | null },
    cf?: BotCustomFieldMap,
  ): Promise<BotEventPayload> {
    const os = this.orders;
    if (!os) throw new BadRequestException('Pedidos indisponíveis.');
    if (a.type === 'order_catalog') {
      const [catalog, settings, cust] = await Promise.all([
        os.catalog(orgId),
        os.settings(orgId),
        who.address_customer_id
          ? this.prisma.whatsapp_customers.findFirst({ where: { id: who.address_customer_id, organization_id: orgId }, select: { addresses: true } }).catch(() => null)
          : Promise.resolve(null),
      ]);
      return { ok: true, catalog: toBotCatalog(catalog), order_settings: toBotOrderSettings(settings), addresses: toBotAddresses((cust as any)?.addresses) };
    }
    if (a.type === 'order_list') {
      // leitura: contato da conversa + clientes vinculados, conferidos pelo documento ou vistos pelo código
      const ids = [...new Set([...who.strong, ...who.seen])];
      return { ok: true, orders: await this.ordersOf(orgId, who.contact_id, ids, a.show !== 'all', cf, Math.max(1, Math.min(10, Number(a.limit) || 5))) };
    }
    return { ok: false, error: `Ação ${a.type} não é de leitura.` };
  }

  /** Executa uma ação de pedido e devolve `crm_result` (mesma mecânica do `runTicket`). */
  private async runOrder(
    orgId: string,
    session: SessionRow,
    k: ChatKey,
    flowId: string,
    a: BotAction,
    state: BotState,
    ctx: BotContext,
    def: BotDefinition | null | undefined,
    depth: number,
  ) {
    if (depth > MAX_CRM_DEPTH) {
      this.logger.warn(`bot pedidos org=${orgId} conversa=${jidRef(k.chat_id)}: ações demais em sequência (${a.type} ignorada)`);
      return;
    }
    const d = def || ((await this.flowById(orgId, flowId))?.definition as any) || null;
    if (!d) return;
    let payload: BotEventPayload;
    if (depth >= MAX_CRM_DEPTH) payload = { ok: false, error: 'Ações demais em sequência (laço no fluxo?)' };
    else {
      try {
        payload = await this.orderAction(orgId, k, flowId, a, state, ctx);
      } catch (e: any) {
        const resp = e?.response && typeof e.response === 'object' ? e.response : {};
        const msg = String(resp.message || e?.message || e);
        payload = { ok: false, error: msg.slice(0, 200), ...(resp.code ? { code: String(resp.code) } : {}) };
        const status = Number(e?.status || e?.getStatus?.() || 0);
        if (e instanceof BotUserError) payload.user_text = String(e.message).slice(0, 500);
        else if (customFieldsUserText(resp)) payload.user_text = customFieldsUserText(resp)!;
        else if (a.type === 'order_create' && status === 400 && typeof resp.message === 'string') {
          // regras do pedido (produto indisponível, pedido mínimo, entrega indisponível…) são escritas para o cliente;
          // a falha do gateway e "desligado nas configurações" ganham um texto próprio
          if (/^Não foi possível gerar a cobrança/i.test(msg)) payload.user_text = 'Não consegui gerar o PIX do pedido agora 😕 Tente de novo em instantes ou fale com um atendente.';
          else if (/desligad/i.test(msg)) payload.user_text = 'No momento não estamos recebendo pedidos por aqui 😕';
          else payload.user_text = msg.slice(0, 300);
        }
      }
    }
    this.logger.log(
      `bot pedidos org=${orgId} número=${String(k.session_id).slice(0, 8)} conversa=${jidRef(k.chat_id)} ação=${a.type} → ${payload.ok ? 'ok' : `falhou (${payload.code || ''} ${String(payload.error || '').slice(0, 100)})`}`,
    );
    const r = handleEvent(d, state, 'crm_result', ctx, payload);
    await this.persist(orgId, k, flowId, r.state);
    await this.run(orgId, session, k, flowId, r.actions, r.state, ctx, d, depth + 1);
  }

  private async orderAction(orgId: string, k: ChatKey, flowId: string, a: BotAction, state: BotState, ctx: BotContext): Promise<BotEventPayload> {
    const os = this.orders;
    if (!os) throw new BadRequestException('Pedidos indisponíveis.');
    const parties = await this.chatParties(orgId, k);
    const contact_id = parties.contact?.id ? String(parties.contact.id) : null;
    const strong = [...new Set([...parties.linked.map((x) => String(x.id)), ...verifiedOf(state)])];
    const seen = seenOf(state).filter((x) => !strong.includes(x));
    const customerId = this.orderCustomerId(state, parties);
    if (ORDER_READ_ACTIONS.has(a.type)) return this.orderRead(orgId, a, { contact_id, strong, seen, address_customer_id: customerId }, ctx.custom_fields);
    if (a.type !== 'order_create') return { ok: false, error: `Ação ${a.type} desconhecida.` };
    const key = `${orgId}|${k.session_id}|${k.chat_id}`;
    const now = Date.now();
    const hits = (this.orderHits.get(key) || []).filter((t) => now - t < LOOKUP_WINDOW_MS);
    if (hits.length >= ORDER_CREATE_LIMIT)
      throw new BotUserError('Você já fez vários pedidos agora há pouco 🙏 Aguarde a confirmação ou fale com um atendente.');
    // endereço salvo só vale se for do cliente em nome de quem o pedido é feito (o serviço confere de novo)
    const dlv: any = a.delivery || {};
    const delivery =
      dlv.mode === 'delivery'
        ? {
            mode: 'delivery' as const,
            ...(dlv.address_id && customerId ? { address_id: String(dlv.address_id) } : {}),
            ...(dlv.address ? { address: { ...dlv.address, id: undefined } } : {}),
          }
        : { mode: 'pickup' as const };
    const r: any = await os.create(orgId, {
      items: (a.items || []).slice(0, 100).map((i) => ({ product_id: String(i.product_id), qty: Number(i.qty) })),
      ...(customerId ? { customer_id: customerId } : {}),
      ...(contact_id ? { contact_id } : {}),
      session_id: k.session_id,
      chat_id: k.chat_id,
      delivery,
      payment_method: a.payment_method === 'none' ? null : a.payment_method,
      notes: a.notes || null,
      ...(a.custom && Object.keys(a.custom).length ? { custom: a.custom } : {}),
      source: 'bot',
      user_id: null,
      bot: { flow_id: flowId, node_id: a.node_id },
    });
    hits.push(now);
    this.orderHits.set(key, hits);
    if (this.orderHits.size > 5000) for (const [kk, v] of this.orderHits) if (!v.some((x) => now - x < LOOKUP_WINDOW_MS)) this.orderHits.delete(kk);
    const order = toBotOrder(r?.order, (ctx.custom_fields || (await this.cfMap(orgId))).order || []);
    let charge: BotState['charge'] = null;
    if (r?.charge?.id) {
      // pedido do bot nasce com a cobrança SEM envio: manda agora a mensagem padrão da cobrança (QR + código, igual
      // às cobranças da Fase 2). Falhou o envio → o motor manda o código no texto (`sent:false`).
      let shaped: any = r.charge;
      let sent = false;
      try {
        shaped = await this.charges.resend(orgId, String(r.charge.id));
        sent = true;
      } catch (e: any) {
        this.logger.warn(`bot pedidos org=${orgId} conversa=${jidRef(k.chat_id)}: envio da cobrança do pedido #${order.number} falhou (${String(e?.message || e).slice(0, 120)}) — o bot manda o código`);
      }
      charge = { ...toBotCharge(shaped), sent };
      if (!charge.pix_code) charge.pix_code = toBotCharge(r.charge).pix_code || order.charge?.pix_code || null;
    }
    return { ok: true, order, ...(charge ? { charge } : {}) };
  }

  /** Agendamento de uma cobrança (para o texto de pago/expirado e a entrega tardia). */
  private async appointmentOfCharge(orgId: string, chargeId: string): Promise<any | null> {
    if (!this.scheduling || !chargeId) return null;
    const row = await this.prisma.whatsapp_appointments
      .findFirst({ where: { organization_id: orgId, charge_id: chargeId }, orderBy: { created_at: 'desc' }, select: { id: true } })
      .catch(() => null);
    if (!row) return null;
    return Promise.resolve(this.scheduling.get(orgId, row.id)).catch(() => null);
  }

  /** `appointment_expired` de um agendamento feito pelo bot → a conversa que espera a cobrança dele segue por "expirou". */
  private onAppointmentExpired(e: any) {
    const ap = e?.appointment;
    const orgId = String(e?.orgId || '');
    const chargeId = ap?.charge?.id || ap?.charge_id;
    const jid = ap?.jid || (ap?.chat_id && String(ap.chat_id).includes('@') ? ap.chat_id : null);
    if (!orgId || !chargeId || !ap?.session_id || !jid) return;
    const c = { id: String(chargeId), session_id: String(ap.session_id), chat_id: String(jid), customer_id: ap.customer?.id || ap.customer_id || null, subscription_id: null };
    return this.enqueue(orgId, c.session_id, c.chat_id, () => this.resumeCharge(orgId, c, 'charge_expired'));
  }

  /** "Paguei" com cobrança do bot pendente: confere no gateway (pagou → o hook `charge_paid` retoma o fluxo). */
  private async checkChargeNow(
    orgId: string,
    session: SessionRow,
    k: ChatKey,
    chargeId: string,
    state: BotState,
  ) {
    const ch = await this.prisma.whatsapp_charges.findFirst({
      where: { id: String(chargeId || ''), organization_id: orgId },
    });
    if (!ch || (state.customer_id && ch.customer_id !== state.customer_id)) return;
    if (ch.status === 'PENDING') {
      const r: any = await this.charges.check(orgId, ch.id).catch(() => null);
      // pagou → hook charge_paid; venceu → hook charge_expired (ambos retomam a conversa pela fila)
      if (r && r.status !== 'PENDING') return;
      await this.send(orgId, session, k.chat_id, {
        kind: 'text',
        text: 'Ainda não identifiquei o pagamento por aqui. Assim que ele cair eu te aviso 😉',
      });
      return;
    }
    // já estava paga/encerrada (o aviso se perdeu) → retoma depois desta rodada (mesma fila)
    void this.enqueue(orgId, k.session_id, k.chat_id, () =>
      this.resumeCharge(
        orgId,
        ch,
        ch.status === 'PAID' ? 'charge_paid' : 'charge_expired',
      ),
    );
  }

  /** Hooks das cobranças: só as criadas pelo bot (`bot_flow_id`) retomam a conversa. */
  private onChargeHook(e: any, event: 'charge_paid' | 'charge_expired') {
    const c = e?.charge;
    if (!c?.bot_flow_id || !c.session_id || !c.chat_id) return;
    const orgId = String(e?.orgId || c.organization_id || '');
    if (!orgId) return;
    return this.enqueue(orgId, String(c.session_id), String(c.chat_id), () =>
      this.resumeCharge(orgId, c, event),
    );
  }

  /** `verified` = o cliente da cobrança pode ser tratado como conferido nesta conversa (entrega tardia num número não vinculado → false). */
  private async chargePayload(orgId: string, c: any, verified = true): Promise<BotEventPayload> {
    const payload: BotEventPayload = { charge_id: String(c.id) };
    const customer = c.customer_id
      ? await this.crm.botCustomer(orgId, String(c.customer_id), { verified }).catch(() => null)
      : null;
    if (customer) payload.customer = customer;
    // cobrança de um agendamento (bloco "Agendar"): o agendamento vai junto para os textos de pago/expirado
    const appt = await this.appointmentOfCharge(orgId, String(c.id));
    if (appt) payload.appointment = toBotAppointment(appt);
    // cobrança de um pedido (bloco "Fazer pedido"): o pedido vai junto para {{pedido.*}} nos textos de pago/expirado
    const ord = await this.orderOfCharge(orgId, String(c.id));
    if (ord) payload.order = ord;
    if (c.subscription_id) {
      const sub = await this.subscriptions
        .get(orgId, String(c.subscription_id))
        .catch(() => null);
      if (sub) payload.subscription = this.crm.botSubscription(sub);
    }
    return payload;
  }

  /**
   * Cobrança do bot paga/expirada. A conversa esperando ESTA cobrança → segue pela porta paid/expired.
   * Paga fora de hora (cliente saiu do bloco, atendente assumiu, fluxo desligado…) → entrega tardia.
   * Expirada fora de hora → ignora.
   */
  private async resumeCharge(
    orgId: string,
    c: any,
    event: 'charge_paid' | 'charge_expired',
  ) {
    const k: ChatKey = {
      session_id: String(c.session_id),
      chat_id: String(c.chat_id),
    };
    // pedido marcado como pago à mão (dinheiro/maquininha): o serviço de pedidos CANCELA o PIX aberto → o hook chega
    // como "expirou", mas para o cliente o pedido está pago — segue pela porta "pago"
    if (event === 'charge_expired' && this.orders) {
      const ord = await this.prisma.whatsapp_orders
        .findFirst({ where: { organization_id: orgId, charge_id: String(c.id) }, select: { payment_status: true } })
        .catch(() => null);
      if (ord?.payment_status === 'paid') event = 'charge_paid';
    }
    const sess = await this.findBotSession(orgId, k);
    const st = sess ? this.stateOf(sess) : null;
    const waiting = Boolean(
      sess &&
        sess.status === 'waiting' &&
        st?.waiting_for === 'charge' &&
        st.charge?.id === c.id,
    );
    if (!waiting) {
      if (event === 'charge_paid') await this.deliverLateCharge(orgId, k, sess, c);
      return;
    }
    const flow = sess!.flow_id ? await this.flowById(orgId, sess!.flow_id) : null;
    const chat = await this.findChat(orgId, k);
    const human =
      chat?.service_status === 'human' || chat?.service_status === 'waiting';
    if (!flow?.active || !chat || human) {
      if (event === 'charge_paid') await this.deliverLateCharge(orgId, k, sess, c);
      return;
    }
    const session = await this.sessionRow(orgId, k.session_id);
    if (!session) return;
    const settings = this.cleanSettings(flow.settings);
    const def = flow.definition as BotDefinition;
    const ctx = await this.ctxFor(orgId, chat, settings, { flow, def, state: st });
    const r = handleEvent(def, st!, event, ctx, await this.chargePayload(orgId, c));
    await this.persist(orgId, k, flow.id, r.state);
    this.logger.log(
      `bot CRM org=${orgId} conversa=${jidRef(k.chat_id)}: cobrança ${event === 'charge_paid' ? 'paga' : 'expirada'} — fluxo retomado`,
    );
    await this.execute(orgId, session, k, flow.id, r.actions, r.state, ctx, def);
  }

  /**
   * Entrega tardia de uma cobrança do bot (cuidado 7 do plano; mesmo padrão do PIX): reconstrói o
   * estado no bloco que gerou a cobrança (`bot_flow_id`/`bot_node_id`) esperando ESTA cobrança e segue
   * pela porta "pago". Atendente na conversa → só mensagens/etiquetas (sem encerrar/transferir) e o
   * estado da conversa não é tocado; bot no meio de outra coisa → idem para o estado.
   */
  private async deliverLateCharge(orgId: string, k: ChatKey, sess: any, c: any) {
    const flow = c.bot_flow_id ? await this.flowById(orgId, c.bot_flow_id) : null;
    const def = flow?.definition as BotDefinition | undefined;
    const node = c.bot_node_id
      ? (def?.nodes || []).find((n: any) => n?.id === c.bot_node_id)
      : null;
    if (!flow || !def || !node) {
      this.logger.warn(
        `Cobrança do bot paga fora de hora (org=${orgId} conversa=${jidRef(k.chat_id)} cobrança=${c.id}): bloco ${c.bot_node_id || '?'} não existe mais — entrega manual necessária`,
      );
      return;
    }
    const chat = await this.findChat(orgId, k);
    const session = await this.sessionRow(orgId, k.session_id);
    if (!chat || !session) return;
    // cobrança de agendamento paga depois de o horário ser liberado: a agenda decide (crédito/estorno); o bot não diz "agendado"
    const isBooking = node.type === 'book_service';
    const appt = isBooking ? await this.appointmentOfCharge(orgId, String(c.id)) : null;
    if (isBooking && appt && ['expired', 'canceled'].includes(String(appt.status))) {
      this.logger.warn(
        `Cobrança de agendamento paga depois de o horário expirar (org=${orgId} conversa=${jidRef(k.chat_id)} cobrança=${c.id}) — o bot não confirma; a equipe/agenda decide`,
      );
      return;
    }
    // cobrança de pedido paga depois de o pedido ser cancelado: a equipe decide (estorno/crédito); o bot não confirma
    const isOrder = node.type === 'order_cart';
    const order = isOrder ? await this.orderOfCharge(orgId, String(c.id)) : null;
    if (isOrder && order && order.status === 'canceled') {
      this.logger.warn(
        `Cobrança de pedido paga depois de o pedido ser cancelado (org=${orgId} conversa=${jidRef(k.chat_id)} cobrança=${c.id}) — o bot não confirma; a equipe decide`,
      );
      return;
    }
    const settings = this.cleanSettings(flow.settings);
    const prev = sess ? this.stateOf(sess) : emptyState();
    // o cliente da cobrança só entra como "verificado" se o número desta conversa está vinculado a ele;
    // senão entra como "visto" (os textos leem o cliente, mas nada é alterado/vinculado por causa de um pagamento)
    const linked = await this.identity
      .customersOfJid(orgId, k.session_id, k.chat_id)
      .then((f) => f.customers.some((x) => String(x.customer.id) === String(c.customer_id)))
      .catch(() => false);
    const state: any = {
      ...emptyState(),
      vars: { ...(prev.vars || {}) },
      node_id: node.id,
      status: 'waiting',
      waiting_for: 'charge',
      customer_id: c.customer_id ? String(c.customer_id) : null,
      // `paid_text` fala do produto certo ({{produto.nome}} vem de state.crm.product_id)
      crm: isBooking || isOrder ? null : { purpose: 'subscribe', step: 'action', subscription_id: c.subscription_id ? String(c.subscription_id) : null, product_id: c.product_id ? String(c.product_id) : null },
      // pedido: {{pedido.*}} do texto de pago vêm daqui
      order: isOrder ? { mode: 'cart', step: 'charge', order } : null,
      // agendamento: {{agendamento.*}} do texto de pago vêm daqui
      book: isBooking ? { mode: 'book', step: 'create', appointment: appt ? toBotAppointment(appt) : null } : null,
      charge: toBotCharge(c),
      ...(c.customer_id ? (linked ? { __verified: [String(c.customer_id)] } : { __seen: [String(c.customer_id)] }) : {}),
    };
    const ctx = await this.ctxFor(orgId, chat, settings, { flow, def, state });
    const r = handleEvent(def, state, 'charge_paid', ctx, await this.chargePayload(orgId, c, linked));
    const human =
      chat.service_status === 'human' || chat.service_status === 'waiting';
    const botWasRunning = Boolean(sess && RUNNING.includes(sess.status) && !human);
    const keepState = human || botWasRunning;
    // estado de outra conversa em andamento (ou atendente): só o que é mensagem/etiqueta
    const actions = keepState
      ? r.actions.filter(
          (a) =>
            a.type !== 'close' &&
            a.type !== 'finish' &&
            a.type !== 'handoff' &&
            a.type !== 'pix' &&
            !CRM_ACTIONS.has(a.type) &&
            !BOOK_ACTIONS.has(a.type) &&
            !TICKET_ACTIONS.has(a.type) &&
            !ORDER_ACTIONS.has(a.type),
        )
      : r.actions;
    if (!keepState) await this.persist(orgId, k, flow.id, r.state);
    this.logger.log(
      `Cobrança do bot paga fora de hora (org=${orgId} conversa=${jidRef(k.chat_id)}): entregando pela porta "pago" do bloco ${node.id}${human ? ' (atendimento humano preservado)' : botWasRunning ? ' (conversa do bot preservada)' : ''}`,
    );
    await this.execute(orgId, session, k, flow.id, actions, r.state, ctx, def);
  }

  /** Envia pelo NÚMERO da conversa e grava a mensagem OUT marcada `extra.bot` (com `session_id`). */
  private async send(
    orgId: string,
    session: SessionRow,
    jid: string,
    msg: { kind: string; text?: string; media?: any },
  ) {
    const sid = String(session.openwa_session_id);
    const sessionId = String(session.id);
    let r: any;
    let type = 'text';
    let mediaId: string | null = null;
    if (msg.kind !== 'text' && msg.media?.id) {
      const f = await this.media.readBase64(orgId, String(msg.media.id));
      const kind =
        f.kind === 'voice' || f.kind === 'audio'
          ? 'audio'
          : f.kind === 'image'
            ? 'image'
            : f.kind === 'video'
              ? 'video'
              : 'document';
      r = await this.openwa.sendMedia(sid, kind as any, jid, {
        base64: f.base64,
        mimetype: f.mime,
        filename: f.filename || undefined,
        caption: msg.text || undefined,
        ...(f.kind === 'voice' ? { ptt: true } : {}),
      });
      type = f.kind === 'voice' ? 'voice' : kind;
      mediaId = String(msg.media.id);
    } else {
      if (!msg.text) return;
      r = await this.openwa.sendText(sid, jid, msg.text);
    }
    const at = r?.timestamp ? new Date(Number(r.timestamp) * 1000) : new Date();
    const waId = String(
      r?.messageId ||
        `bot_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    );
    await this.prisma.whatsapp_messages
      .create({
        data: {
          organization_id: orgId,
          session_id: sessionId,
          chat_id: jid,
          wa_message_id: waId,
          direction: 'OUT',
          type,
          body: msg.text || null,
          media_id: mediaId,
          ack: 1,
          timestamp: at,
          extra: { bot: true },
        },
      })
      .catch(async (e: any) => {
        // o eco chegou antes: marca como do bot
        if (e?.code === 'P2002')
          await this.prisma.whatsapp_messages
            .update({
              where: {
                organization_id_session_id_wa_message_id: {
                  organization_id: orgId,
                  session_id: sessionId,
                  wa_message_id: waId,
                },
              },
              data: { extra: { bot: true } },
            })
            .catch(() => undefined);
      });
    await this.inbound.bumpChat(orgId, sessionId, jid, {
      type,
      body: msg.text,
      direction: 'OUT',
      at,
    });
    this.presenter.message(orgId, { waId, sessionId });
  }

  private async saveContact(
    orgId: string,
    jid: string,
    field: 'name' | 'email',
    value: string,
  ) {
    const c = await this.prisma.whatsapp_contacts.findUnique({
      where: { organization_id_wa_id: { organization_id: orgId, wa_id: jid } },
    });
    if (!c) return;
    if (field === 'name' && !c.name)
      await this.prisma.whatsapp_contacts.update({
        where: { id: c.id },
        data: { name: value.slice(0, 255) },
      });
    if (field === 'email') {
      const notes = String(c.notes || '');
      if (!notes.toLowerCase().includes(value.toLowerCase()))
        await this.prisma.whatsapp_contacts.update({
          where: { id: c.id },
          data: {
            notes: `${notes ? `${notes}\n` : ''}E-mail: ${value}`.slice(
              0,
              2000,
            ),
          },
        });
    }
  }

  // ================================================================ PIX
  private webhookUrl(provider: string) {
    const base = String(
      process.env.PUBLIC_API_URL || 'https://api.reveleonline.com',
    ).replace(/\/+$/, '');
    return `${base}/payments/webhook/${provider || 'mercadopago'}`;
  }

  private async createPix(
    orgId: string,
    session: SessionRow,
    k: ChatKey,
    flowId: string,
    a: Extract<BotAction, { type: 'pix' }>,
    state: BotState,
    ctx: BotContext,
  ) {
    const jid = k.chat_id;
    const gw = await this.prisma.telegram_payment_settings.findUnique({
      where: { organization_id: orgId },
    });
    const fail = async (why: string) => {
      this.logger.warn(`bot PIX org=${orgId} ${jid}: ${why}`);
      await this.send(orgId, session, jid, {
        kind: 'text',
        text: 'Não consegui gerar o PIX agora 😕 Vou te passar para um atendente.',
      });
      await this.attendance.setStatus(orgId, k, 'waiting', {
        event: 'handoff',
        meta: { by: 'bot', reason: 'pix_failed', flow_id: flowId },
      });
      state.status = 'handoff';
      state.waiting_for = null;
      await this.persist(orgId, k, flowId, state);
    };
    if (!gw?.active || !gw.access_token)
      return fail('gateway de pagamento não configurado');
    if (!(a.amount_cents > 0)) return fail('valor inválido');
    const payerRef = createHash('sha1')
      .update(`${orgId}:${jid}`)
      .digest('hex')
      .slice(0, 12);
    const res = await createPixCharge(
      gw.provider,
      gw.access_token,
      a.amount_cents,
      a.description,
      {
        payerRef,
        name: ctx.contact.name || 'Cliente',
        webhookUrl: this.webhookUrl(gw.provider),
        expiresInMin: a.expires_minutes,
        idempotency: `wa-${orgId}-${k.session_id}-${jid}-${a.node_id}-${Math.floor(Date.now() / 60000)}`,
      },
    );
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
    state.pix = {
      amount_cents: a.amount_cents,
      description: a.description,
      code: res.pixCode || null,
      payment_id: pay.id,
    };
    await this.persist(orgId, k, flowId, state, pay.id);
    for (const m of this.pixMessages(a, state, ctx)) {
      if (m.type === 'typing')
        await this.openwa
          .typing(String(session.openwa_session_id), jid, 'typing')
          .catch(() => undefined);
      if (m.type === 'send') {
        if (m.delay_ms) await sleep(m.delay_ms);
        await this.send(orgId, session, jid, m.message);
      }
    }
    if (a.send_qr && res.qrBase64) {
      try {
        const qr = await this.media.storeBase64(
          orgId,
          res.qrBase64,
          'image/png',
          'pix.png',
          'image',
        );
        await this.send(orgId, session, jid, {
          kind: 'image',
          text: `QR Code do PIX · ${formatBRL(a.amount_cents)}`,
          media: { id: qr.id },
        });
      } catch (e: any) {
        this.logger.debug(`QR do PIX: ${e?.message || e}`);
      }
    }
  }

  /** Confere o PIX pendente da conversa (deste número) no gateway; se pago, continua o fluxo. */
  private async checkPixNow(
    orgId: string,
    session: SessionRow,
    k: ChatKey,
    fromCustomer: boolean,
  ) {
    const pay = await this.prisma.whatsapp_payments.findFirst({
      where: {
        organization_id: orgId,
        session_id: k.session_id,
        chat_id: k.chat_id,
        status: 'PENDING',
      },
      orderBy: { created_at: 'desc' },
    });
    if (!pay) return;
    const paid = await this.refreshPayment(pay);
    if (!paid && fromCustomer && session?.openwa_session_id) {
      await this.send(orgId, session, k.chat_id, {
        kind: 'text',
        text: 'Ainda não identifiquei o pagamento por aqui. Assim que ele cair eu te aviso 😉',
      });
    }
  }

  /** Atualiza o status de uma cobrança pelo gateway; retorna true se ficou PAGA agora. */
  private async refreshPayment(pay: any): Promise<boolean> {
    const gw = await this.prisma.telegram_payment_settings.findUnique({
      where: { organization_id: pay.organization_id },
    });
    if (!gw?.access_token || !pay.provider_charge_id) return false;
    const st = await getChargeStatus(
      pay.provider,
      gw.access_token,
      pay.provider_charge_id,
    );
    if (st.ok && st.status === 'PAID') {
      const u = await this.prisma.whatsapp_payments.updateMany({
        where: { id: pay.id, status: 'PENDING' },
        data: { status: 'PAID', paid_at: new Date() },
      });
      if (u.count) {
        await this.resumeAfterPayment(pay, 'pix_paid');
        // funil: "pago → etapa" também para o PIX do bot (o CRM já fazia isso nas cobranças); quem ouve é o WhatsAppPipelineService
        if (pay.session_id)
          this.hooks.emit('bot_pix_paid', {
            orgId: pay.organization_id,
            key: { session_id: String(pay.session_id), chat_id: pay.chat_id },
            payment_id: pay.id,
            amount_cents: pay.amount_cents,
          });
      }
      return u.count > 0;
    }
    if (pay.expires_at && new Date(pay.expires_at).getTime() < Date.now()) {
      const u = await this.prisma.whatsapp_payments.updateMany({
        where: { id: pay.id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
      if (u.count) {
        await cancelCharge(
          pay.provider,
          gw.access_token,
          pay.provider_charge_id,
        ).catch(() => undefined);
        await this.resumeAfterPayment(pay, 'pix_expired');
      }
    }
    return false;
  }

  private async resumeAfterPayment(
    pay: {
      organization_id: string;
      session_id?: string | null;
      chat_id: string;
      node_id?: string | null;
      amount_cents?: number;
      description?: string | null;
      pix_code?: string | null;
      id?: string;
      context?: any;
    },
    event: 'pix_paid' | 'pix_expired',
  ) {
    const sessionId = pay.session_id ? String(pay.session_id) : null;
    if (!sessionId) {
      // cobrança antiga sem número (antes do multi-número): não há como saber por qual número retomar
      this.logger.warn(
        `PIX ${event} sem session_id (org=${pay.organization_id} ${pay.chat_id}) — fluxo não retomado`,
      );
      return;
    }
    await this.enqueue(pay.organization_id, sessionId, pay.chat_id, () =>
      this.resume(
        pay.organization_id,
        { session_id: sessionId, chat_id: pay.chat_id },
        event,
        event === 'pix_paid' ? pay : undefined,
      ),
    );
  }

  private async resume(
    orgId: string,
    k: ChatKey,
    event: 'wait_done' | 'pix_paid' | 'pix_expired',
    paid?: {
      node_id?: string | null;
      amount_cents?: number;
      description?: string | null;
      pix_code?: string | null;
      id?: string;
      context?: any;
    },
  ) {
    const sess = await this.findBotSession(orgId, k);
    const waitingPix =
      sess?.status === 'waiting' &&
      this.stateOf(sess).waiting_for === 'pix' &&
      (!paid?.node_id || sess.node_id === paid.node_id);
    if (event === 'pix_paid' && paid && !waitingPix) {
      // O cliente pagou DEPOIS de o fluxo sair do bloco PIX (mandou "menu"/"oi", passou o
      // prazo de 24 h, um atendente assumiu, o fluxo foi regravado…). O dinheiro entrou:
      // entrega mesmo assim, saindo do bloco PIX que gerou a cobrança pela porta "pago".
      await this.deliverLatePayment(orgId, k, sess, paid);
      return;
    }
    if (!sess || sess.status !== 'waiting' || !sess.flow_id) return;
    const flow = await this.flowById(orgId, sess.flow_id);
    if (!flow?.active) return;
    const chat = await this.findChat(orgId, k);
    if (!chat) return;
    // humano assumiu enquanto o bot esperava → não retoma (o pagamento fica registrado)
    if (chat.service_status === 'human' || chat.service_status === 'waiting')
      return;
    const session = await this.sessionRow(orgId, k.session_id);
    if (!session) return;
    const settings = this.cleanSettings(flow.settings);
    const def = flow.definition as BotDefinition;
    const st = this.stateOf(sess);
    const ctx = await this.ctxFor(orgId, chat, settings, {
      flow,
      def,
      state: st,
    });
    const r = handleEvent(def, st, event, ctx);
    await this.persist(orgId, k, flow.id, r.state);
    await this.execute(
      orgId,
      session,
      k,
      flow.id,
      r.actions,
      r.state,
      ctx,
      def,
    );
  }

  /**
   * Entrega de um PIX pago fora de hora: reconstrói o estado no bloco PIX da cobrança e segue
   * pela porta "pago". Se um atendente está na conversa, manda as mensagens/etiquetas da entrega
   * mas NÃO mexe no atendimento (sem encerrar/transferir).
   */
  private async deliverLatePayment(
    orgId: string,
    k: ChatKey,
    sess: any,
    paid: {
      node_id?: string | null;
      amount_cents?: number;
      description?: string | null;
      pix_code?: string | null;
      id?: string;
      context?: any;
    },
  ) {
    const flowId: string | null =
      paid.context?.flow_id || sess?.flow_id || null;
    const flow = flowId ? await this.flowById(orgId, flowId) : null;
    const def = flow?.definition as BotDefinition | undefined;
    const node = paid.node_id
      ? (def?.nodes || []).find((n: any) => n?.id === paid.node_id)
      : null;
    if (!flow || !def || !node) {
      this.logger.warn(
        `PIX pago fora de hora (org=${orgId} ${k.chat_id}): bloco PIX ${paid.node_id || '?'} não existe mais — entrega manual necessária`,
      );
      return;
    }
    const chat = await this.findChat(orgId, k);
    const session = await this.sessionRow(orgId, k.session_id);
    if (!chat || !session) return;
    const settings = this.cleanSettings(flow.settings);
    const prev = sess ? this.stateOf(sess) : emptyState();
    const ctx = await this.ctxFor(orgId, chat, settings, {
      flow,
      def,
      state: prev,
    });
    const state: BotState = {
      ...emptyState(),
      vars: { ...(prev.vars || {}) },
      node_id: String(paid.node_id),
      status: 'waiting',
      waiting_for: 'pix',
      pix: {
        amount_cents: Number(paid.amount_cents) || 0,
        description: String(paid.description || ''),
        code: paid.pix_code || null,
        payment_id: paid.id || null,
      },
    };
    const r = handleEvent(def, state, 'pix_paid', ctx);
    const human =
      chat.service_status === 'human' || chat.service_status === 'waiting';
    const actions = human
      ? r.actions.filter(
          (a) => a.type !== 'close' && a.type !== 'finish' && a.type !== 'handoff',
        )
      : r.actions;
    const botWasRunning = sess && RUNNING.includes(sess.status) && !human;
    // só assume o estado da conversa quando o bot não está no meio de outra coisa
    if (!botWasRunning && !human) await this.persist(orgId, k, flow.id, r.state);
    this.logger.log(
      `PIX pago fora de hora (org=${orgId} ${k.chat_id}): entregando pela porta "pago" do bloco ${paid.node_id}${human ? ' (atendimento humano preservado)' : ''}`,
    );
    await this.execute(orgId, session, k, flow.id, actions, r.state, ctx, def);
  }

  /** Webhook único de pagamentos (Configurações → Pagamentos): acha a cobrança do bot. */
  async handleWebhookCharge(
    provider: string,
    chargeId: string,
  ): Promise<boolean> {
    const pay = await this.prisma.whatsapp_payments.findFirst({
      where: { provider_charge_id: String(chargeId), provider },
    });
    if (!pay) return false;
    if (pay.status === 'PENDING')
      await this.refreshPayment(pay).catch(() => undefined);
    return true;
  }

  // ================================================================ runner (esperas e PIX)
  private async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const due = await this.prisma.whatsapp_bot_sessions.findMany({
        where: { status: 'waiting', wait_until: { lte: new Date() } },
        take: 50,
      });
      for (const s of due) {
        const st = this.stateOf(s);
        if (st.waiting_for !== 'wait') continue;
        if (
          !(await this.access.isOrgActive(s.organization_id).catch(() => false))
        )
          continue;
        const k: ChatKey = { session_id: s.session_id, chat_id: s.chat_id };
        void this.enqueue(s.organization_id, k.session_id, k.chat_id, () =>
          this.resume(s.organization_id, k, 'wait_done'),
        );
      }
      // PIX pendentes: confere no gateway a cada 30 s (o webhook costuma chegar antes)
      if (Date.now() - this.lastPixCheck > 30_000) {
        this.lastPixCheck = Date.now();
        const pend = await this.prisma.whatsapp_payments.findMany({
          where: {
            status: 'PENDING',
            created_at: { lt: new Date(Date.now() - 15_000) },
          },
          orderBy: { created_at: 'asc' },
          take: 20,
        });
        for (const p of pend)
          await this.refreshPayment(p).catch((e) =>
            this.logger.debug(`pix ${p.id}: ${e?.message || e}`),
          );
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
    if (chat.kind !== 'individual' || isGroupJid(chat.chat_id))
      throw new BadRequestException('O bot atende só conversas individuais.');
    const row = await this.sessions.rowById(orgId, chat.session_id);
    if (!row) throw new NotFoundException('Número da conversa não encontrado.');
    if (!row.bot_flow_id)
      throw new BadRequestException(
        `O número "${sessionLabel(row)}" não tem fluxo do bot. Atribua um em WhatsApp → Fluxo do Bot.`,
      );
    const flow = await this.prisma.whatsapp_bot_flows.findFirst({
      where: { id: row.bot_flow_id, organization_id: orgId },
    });
    if (!flow?.definition)
      throw new BadRequestException(
        'Monte o fluxo do bot primeiro (WhatsApp → Fluxo do Bot).',
      );
    if (!flow.active)
      throw new BadRequestException(
        `O fluxo "${flow.name}" está desativado. Ative-o antes de enviar a conversa para o bot.`,
      );
    const errs = validateDefinition(flow.definition as any);
    if (errs.length)
      throw new BadRequestException(`O fluxo tem problemas: ${errs[0]}`);
    const session = await this.sessions.requireReady(orgId, chat.session_id);
    this.sessionCache.set(`${orgId}|${session.id}`, {
      at: Date.now(),
      row: session,
    });
    const settings = this.cleanSettings(flow.settings);
    const ctx = await this.ctxFor(orgId, chat, settings, {
      flow,
      def: flow.definition as any,
    });
    await this.enqueue(orgId, chat.session_id, chat.chat_id, () =>
      this.begin(
        orgId,
        session,
        chat,
        flow,
        flow.definition as any,
        settings,
        ctx,
        null,
        'bot_started',
        user.userId,
      ),
    );
    const [shaped] = await this.presenter.shapeChats(orgId, [
      await this.prisma.whatsapp_chats.findUnique({ where: { id: chat.id } }),
    ]);
    return shaped;
  }

  /** "Tirar do bot". */
  async stopForChat(orgId: string, user: WaUser, chatUuid: string) {
    const chat = await this.chat.chatRow(orgId, chatUuid);
    await this.waAccess.assertChat(user, chat);
    const key = this.keyOf(chat);
    await this.attendance.stopBot(orgId, key, 'stopped');
    if (chat.service_status === 'bot')
      await this.attendance.setStatus(orgId, key, 'none', {
        event: 'bot_stopped',
        actor: user.userId,
      });
    const [shaped] = await this.presenter.shapeChats(orgId, [
      await this.prisma.whatsapp_chats.findUnique({ where: { id: chat.id } }),
    ]);
    return shaped;
  }

  /** Conversas em que o bot está conduzindo agora (monitor), só dos números liberados ao usuário. */
  async monitor(orgId: string, user: WaUser, sessionId?: string | null) {
    const where = await this.waAccess.sessionWhere(user, sessionId || null);
    if (where === null) return [];
    const rows = await this.prisma.whatsapp_bot_sessions.findMany({
      where: { organization_id: orgId, status: { in: RUNNING }, ...where },
      orderBy: { updated_at: 'desc' },
      take: 100,
    });
    if (!rows.length) return [];
    const chats = await this.prisma.whatsapp_chats.findMany({
      where: {
        organization_id: orgId,
        session_id: { in: [...new Set(rows.map((r) => r.session_id))] },
        chat_id: { in: [...new Set(rows.map((r) => r.chat_id))] },
      },
    });
    const shaped = await this.presenter.shapeChats(orgId, chats);
    const byKey = new Map(
      shaped.map((c: any) => [`${c.session_id}|${c.jid}`, c]),
    );
    return rows.map((r) => ({
      chat: byKey.get(`${r.session_id}|${r.chat_id}`) || {
        session_id: r.session_id,
        jid: r.chat_id,
      },
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
