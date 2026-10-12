import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { promises as fsp } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  OpenWaClient,
  OpenWaError,
  WA_ENGINES,
  WaEngine,
} from './openwa.client';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { WhatsAppHooks } from './whatsapp-hooks.service';

// Números do WhatsApp da organização (N por org) por cima do OpenWA. Cada linha de
// `whatsapp_sessions` = um número (sessão do gateway, nome interno, cor, aquecimento, fluxo do bot).
// - o espelho (status/telefone/webhook) vive aqui; a verdade ao vivo é o OpenWA;
// - o webhook do OpenWA (assinado) atualiza o espelho e grava `whatsapp_session_events`;
// - erros do gateway viram mensagens claras (BadRequest/ServiceUnavailable).

export const SESSION_STATUSES = [
  'none',
  'created',
  'initializing',
  'qr_ready',
  'authenticating',
  'ready',
  'disconnected',
  'action_required',
  'failed',
] as const;
export const SESSION_COLORS = [
  '#25D366',
  '#3B82F6',
  '#8B5CF6',
  '#F59E0B',
  '#EC4899',
  '#14B8A6',
  '#EF4444',
  '#6366F1',
  '#84CC16',
  '#F97316',
];
export const MAX_SESSIONS_PER_ORG = 20;

const WEBHOOK_EVENTS = [
  'session.status',
  'session.qr',
  'session.authenticated',
  'session.disconnected',
  'session.reconnect_loop',
  'session.restriction',
  'message.received',
  'message.sent',
  'message.ack',
  'message.failed',
  'message.revoked',
  'message.reaction',
  'message.edited',
  'group.join',
  'group.leave',
  'group.update',
  'group.join_request',
  'call.received',
  'status.received',
];

export type SessionRow = any;

/** Rótulo do número para telas e eventos: nome interno > telefone > "Número". */
export function sessionLabel(
  row: { label?: string | null; phone?: string | null } | null | undefined,
) {
  if (!row) return 'Número';
  if (row.label) return row.label;
  if (row.phone) return `+${String(row.phone).replace(/\D/g, '')}`;
  return 'Número';
}

@Injectable()
export class WhatsAppSessionsService {
  private readonly logger = new Logger(WhatsAppSessionsService.name);
  // cache curto do GET /sessions/:id (o front faz polling de 3 s)
  private readonly liveCache = new Map<string, { at: number; value: any }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly openwa: OpenWaClient,
    private readonly presenter: WhatsAppPresenter,
    private readonly hooks: WhatsAppHooks,
  ) {}

  private webhookBase() {
    return String(
      process.env.OPENWA_WEBHOOK_BASE || 'http://host.docker.internal:8000',
    ).replace(/\/+$/, '');
  }

  private translate(e: any): never {
    if (e instanceof OpenWaError) {
      if (e.status === 404)
        throw new NotFoundException(
          'Sessão não encontrada no gateway. Clique em "Conectar" para criar de novo.',
        );
      if (e.status === 429)
        throw new BadRequestException(
          e.retryAfterSeconds
            ? `Limite de envio atingido. Tente em ${e.retryAfterSeconds}s.`
            : 'Limite de envio atingido.',
        );
      if (e.status >= 500 || e.status === 503 || e.status === 504)
        throw new ServiceUnavailableException(e.message);
      throw new BadRequestException(e.message);
    }
    throw e;
  }

  // ---------------------------------------------------------------- leitura (linhas)
  /** Todos os números da organização, na ordem das abas. */
  async rowsOf(orgId: string): Promise<SessionRow[]> {
    const rows = await this.prisma.whatsapp_sessions.findMany({
      where: { organization_id: orgId },
      orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
    });
    for (const r of rows)
      if (r.openwa_session_id)
        this.openwa.remember(r.openwa_session_id, r.engine);
    return rows;
  }

  /** Números conectados (status ready) da organização. */
  async readyRows(orgId: string): Promise<SessionRow[]> {
    return (await this.rowsOf(orgId)).filter(
      (r) => r.openwa_session_id && r.status === 'ready',
    );
  }

  async rowById(orgId: string, sessionId: string): Promise<SessionRow | null> {
    if (!sessionId) return null;
    const r = await this.prisma.whatsapp_sessions.findFirst({
      where: { id: String(sessionId), organization_id: orgId },
    });
    if (r?.openwa_session_id)
      this.openwa.remember(r.openwa_session_id, r.engine);
    return r;
  }

  async requireRow(orgId: string, sessionId: string): Promise<SessionRow> {
    const r = await this.rowById(orgId, sessionId);
    if (!r) throw new NotFoundException('Número não encontrado.');
    return r;
  }

  /** Número pronto para enviar (400 com mensagem clara quando não está). */
  async requireReady(orgId: string, sessionId: string): Promise<SessionRow> {
    const row = await this.requireRow(orgId, sessionId);
    if (!row.openwa_session_id)
      throw new BadRequestException(
        `O número "${sessionLabel(row)}" não está conectado. Conecte em Configurações.`,
      );
    if (row.status !== 'ready')
      throw new BadRequestException(
        `O número "${sessionLabel(row)}" não está conectado no momento.`,
      );
    return row;
  }

  /** Um número pronto qualquer da org (preferindo `preferId`), ou null. */
  async anyReady(
    orgId: string,
    preferId?: string | null,
  ): Promise<SessionRow | null> {
    const ready = await this.readyRows(orgId);
    return ready.find((r) => r.id === preferId) || ready[0] || null;
  }

  async findByRowId(id: string) {
    return this.prisma.whatsapp_sessions.findUnique({ where: { id } });
  }

  private async live(openwaId: string, maxAgeMs = 2500) {
    const c = this.liveCache.get(openwaId);
    if (c && Date.now() - c.at < maxAgeMs) return c.value;
    const v = await this.openwa.getSession(openwaId);
    this.liveCache.set(openwaId, { at: Date.now(), value: v });
    return v;
  }

  // ---------------------------------------------------------------- shape
  shape(row: any, liveSess: any | null, extra: any = {}) {
    // sem sessão no gateway = não conectado (o espelho pode ter ficado com um status velho)
    const status =
      liveSess?.status ||
      (row?.openwa_session_id ? row?.status : null) ||
      'none';
    const engine = (row?.openwa_session_id ? row?.engine : null) || null;
    const def = this.openwa.defaultEngine;
    return {
      id: row?.id || null,
      label: row?.label || null,
      display_label: sessionLabel(row),
      color: row?.color || SESSION_COLORS[0],
      position: row?.position ?? 0,
      bot_flow_id: row?.bot_flow_id || null,
      configured: this.openwa.configured,
      exists: Boolean(row?.openwa_session_id),
      // motor do gateway: 'wwjs' (antigo, sem download de mídia recebida) | 'baileys' (recomendado)
      engine,
      default_engine: def,
      engine_upgrade: Boolean(
        engine && engine !== def && this.openwa.isEngineAvailable(def),
      ),
      status,
      connected: status === 'ready',
      phone: liveSess?.phone || row?.phone || null,
      push_name: row?.push_name || liveSess?.pushName || null, // o espelho já aplica a regra do nome (syncFromLive); o gateway pode estar desatualizado
      paired_at: row?.paired_at || null,
      last_status_at: row?.last_status_at || null,
      last_event_at: row?.last_event_at || null,
      restricted_at: row?.restricted_at || null,
      disconnected_at: row?.disconnected_at || null,
      last_error: liveSess?.lastError || row?.last_error || null,
      pacing_enabled: row?.pacing_enabled ?? true,
      warmup_ack_at: row?.warmup_ack_at || null,
      // aquecimento: dia N desde o pareamento (o cronograma do OpenWA é por idade da sessão)
      warmup_day: row?.paired_at
        ? Math.min(
            30,
            Math.floor(
              (Date.now() - new Date(row.paired_at).getTime()) / 86_400_000,
            ) + 1,
          )
        : null,
      created_at: row?.created_at || null,
      sync: (row?.settings as any)?.sync || null, // progresso da última sincronização (fase, contagens)
      ...extra,
    };
  }

  /** Resumo leve (chip do número nas conversas, eventos, seletores). */
  brief(row: any) {
    return row
      ? {
          id: row.id,
          label: sessionLabel(row),
          color: row.color || SESSION_COLORS[0],
          phone: row.phone || null,
          status: row.openwa_session_id ? row.status : 'none',
          connected: Boolean(row.openwa_session_id && row.status === 'ready'),
        }
      : null;
  }

  // Nome de exibição no motor Baileys: o gateway só lê `sock.user.name` na hora de conectar e,
  // no 1º pareamento, o WhatsApp ainda não mandou o nome (chega logo depois pela sincronização
  // e fica em creds.json). Lê de lá, no volume do gateway, e guarda no espelho.
  private readonly nameTried = new Map<string, number>();
  private async fillBaileysName(row: any) {
    if (row?.push_name || row?.engine !== 'baileys' || !row?.openwa_session_id)
      return;
    const sid = String(row.openwa_session_id);
    if (
      !/^[0-9a-f-]{36}$/i.test(sid) ||
      Date.now() - (this.nameTried.get(sid) || 0) < 60_000
    )
      return;
    this.nameTried.set(sid, Date.now());
    try {
      const dir = String(
        process.env.OPENWA_BAILEYS_DATA_DIR || '/opt/openwa-baileys/data',
      );
      const creds = JSON.parse(
        await fsp.readFile(join(dir, 'baileys', sid, 'creds.json'), 'utf8'),
      );
      const name = String(creds?.me?.name || '')
        .trim()
        .slice(0, 255);
      if (!name) return;
      await this.prisma.whatsapp_sessions.update({
        where: { id: row.id },
        data: { push_name: name },
      });
      row.push_name = name;
    } catch {
      /* sem acesso ao volume do gateway: fica sem nome */
    }
  }

  /** Estado atual de UM número (espelho + ao vivo). Nunca lança por falha do gateway: devolve `gateway_error`. */
  async getRow(row: any) {
    if (!row?.openwa_session_id) return this.shape(row, null);
    try {
      const liveSess = await this.live(row.openwa_session_id);
      await this.syncFromLive(row, liveSess);
      if (liveSess?.status === 'ready' && !liveSess?.pushName)
        await this.fillBaileysName(row);
      return this.shape(row, liveSess);
    } catch (e: any) {
      if (e instanceof OpenWaError && e.status === 404) {
        // sessão sumiu no gateway (container recriado sem volume?) → limpa e deixa reconectar
        await this.prisma.whatsapp_sessions.update({
          where: { id: row.id },
          data: {
            openwa_session_id: null,
            status: 'none',
            last_error: 'Sessão não existe mais no gateway.',
          },
        });
        this.presenter.invalidateSessions(row.organization_id);
        return this.shape(
          { ...row, openwa_session_id: null, status: 'none' },
          null,
          {
            gateway_error:
              'Sessão não existe mais no gateway. Conecte de novo.',
          },
        );
      }
      return this.shape(row, null, {
        gateway_error: e?.message || 'Gateway indisponível',
      });
    }
  }

  async get(orgId: string, sessionId: string) {
    return this.getRow(await this.requireRow(orgId, sessionId));
  }

  /** Lista dos números (só os permitidos ao usuário quando `allowed` vem preenchido). */
  async list(orgId: string, allowed: Set<string> | null = null) {
    const rows = (await this.rowsOf(orgId)).filter(
      (r) => allowed === null || allowed.has(r.id),
    );
    const out: any[] = [];
    for (const r of rows) out.push(await this.getRow(r));
    return {
      items: out,
      total: out.length,
      max: MAX_SESSIONS_PER_ORG,
      default_engine: this.openwa.defaultEngine,
      configured: this.openwa.configured,
    };
  }

  private async syncFromLive(row: any, liveSess: any) {
    const data: any = {};
    const st = String(liveSess?.status || '');
    if (st && st !== row.status) {
      data.status = st;
      data.last_status_at = new Date();
    }
    if (liveSess?.phone && liveSess.phone !== row.phone)
      data.phone = String(liveSess.phone).slice(0, 32);
    if (liveSess?.pushName) {
      // O gateway Baileys só relê o nome de exibição (`sock.user.name`) ao conectar: depois de "Salvar" no Pub Mail
      // ele continua devolvendo o nome ANTIGO até a próxima reconexão. Só adotamos o nome do gateway quando ELE
      // mudou (reconexão ou troca pelo celular), não quando está apenas desatualizado — senão o nome salvo
      // pelo painel era desfeito a cada leitura da sessão (bug relatado em 12/10/2026).
      const gw = String(liveSess.pushName).slice(0, 255);
      const st0: any = row.settings || {};
      if (gw !== (st0.gw_push_name ?? null)) {
        data.settings = { ...st0, gw_push_name: gw };
        const setByPanel = Boolean(st0.name_set_at) && st0.gw_push_name == null;
        if (gw !== row.push_name && !setByPanel) data.push_name = gw;
      }
    }
    if (st === 'ready' && !row.paired_at) data.paired_at = new Date();
    if (
      liveSess?.lastError !== undefined &&
      (liveSess.lastError || null) !== (row.last_error || null)
    )
      data.last_error = liveSess.lastError
        ? String(liveSess.lastError).slice(0, 500)
        : null;
    if (Object.keys(data).length) {
      await this.prisma.whatsapp_sessions.update({
        where: { id: row.id },
        data,
      });
      Object.assign(row, data);
      if (data.status || data.phone)
        this.presenter.invalidateSessions(row.organization_id);
    }
  }

  // ---------------------------------------------------------------- cadastro (abas "Novo número")
  private cleanLabel(v: unknown) {
    const s = String(v ?? '')
      .trim()
      .slice(0, 80);
    return s || null;
  }
  private cleanColor(v: unknown) {
    const s = String(v || '').trim();
    return /^#[0-9a-f]{6}$/i.test(s) ? s.toUpperCase() : null;
  }

  /** "Novo número": cria a linha (sem gateway ainda — "Conectar" cria a sessão e mostra o QR). */
  async create(
    orgId: string,
    dto: { label?: string; color?: string; engine?: string } = {},
  ) {
    const rows = await this.rowsOf(orgId);
    if (rows.length >= MAX_SESSIONS_PER_ORG)
      throw new BadRequestException(
        `Limite de ${MAX_SESSIONS_PER_ORG} números por organização.`,
      );
    const engine =
      dto.engine && WA_ENGINES.includes(dto.engine as WaEngine)
        ? (dto.engine as WaEngine)
        : this.openwa.defaultEngine;
    const used = new Set(rows.map((r) => r.color).filter(Boolean));
    const color =
      this.cleanColor(dto.color) ||
      SESSION_COLORS.find((c) => !used.has(c)) ||
      SESSION_COLORS[rows.length % SESSION_COLORS.length];
    const row = await this.prisma.whatsapp_sessions.create({
      data: {
        organization_id: orgId,
        status: 'none',
        engine,
        webhook_secret: randomBytes(32).toString('hex'),
        label: this.cleanLabel(dto.label) || `Número ${rows.length + 1}`,
        color,
        position: rows.length,
      },
    });
    this.presenter.invalidateSessions(orgId);
    this.presenter.session(orgId, row.id, {
      event: 'local.create',
      status: 'none',
    });
    return this.shape(row, null);
  }

  async update(
    orgId: string,
    sessionId: string,
    dto: {
      label?: string;
      color?: string;
      position?: number;
      bot_flow_id?: string | null;
    },
  ) {
    const row = await this.requireRow(orgId, sessionId);
    const data: any = {};
    if (dto.label !== undefined) data.label = this.cleanLabel(dto.label);
    if (dto.color !== undefined) {
      const c = this.cleanColor(dto.color);
      if (!c) throw new BadRequestException('Cor inválida (use #RRGGBB).');
      data.color = c;
    }
    if (dto.position !== undefined)
      data.position = Math.max(0, parseInt(String(dto.position), 10) || 0);
    if (dto.bot_flow_id !== undefined) {
      if (dto.bot_flow_id) {
        const f = await this.prisma.whatsapp_bot_flows.findFirst({
          where: { id: String(dto.bot_flow_id), organization_id: orgId },
          select: { id: true },
        });
        if (!f) throw new BadRequestException('Fluxo do bot não encontrado.');
        data.bot_flow_id = f.id;
      } else data.bot_flow_id = null;
    }
    const upd = Object.keys(data).length
      ? await this.prisma.whatsapp_sessions.update({
          where: { id: row.id },
          data,
        })
      : row;
    // Trocou o fluxo do bot deste número: as conversas que estavam no meio do fluxo antigo param
    // (a próxima mensagem do contato entra no fluxo novo do começo). Sem dependência do bot (evita ciclo).
    if (
      data.bot_flow_id !== undefined &&
      data.bot_flow_id !== row.bot_flow_id
    ) {
      await this.prisma.whatsapp_bot_sessions
        .updateMany({
          where: {
            organization_id: orgId,
            session_id: row.id,
            status: 'active',
          },
          data: { status: 'stopped', wait_until: null },
        })
        .catch((e) =>
          this.logger.warn(
            `bot_sessions stop (flow change) ${row.id}: ${e?.message || e}`,
          ),
        );
    }
    this.presenter.invalidateSessions(orgId);
    this.presenter.session(orgId, row.id, {
      event: 'local.update',
      status: upd.openwa_session_id ? upd.status : 'none',
    });
    return this.getRow(upd);
  }

  async reorder(orgId: string, ids: string[]) {
    const rows = await this.rowsOf(orgId);
    const known = new Set(rows.map((r) => r.id));
    const order = (Array.isArray(ids) ? ids : [])
      .map(String)
      .filter((id) => known.has(id));
    for (const r of rows) if (!order.includes(r.id)) order.push(r.id);
    await this.prisma.$transaction(
      order.map((id, i) =>
        this.prisma.whatsapp_sessions.update({
          where: { id },
          data: { position: i },
        }),
      ),
    );
    this.presenter.invalidateSessions(orgId);
    return this.list(orgId);
  }

  // ---------------------------------------------------------------- ciclo de vida
  // Garante sessão no OpenWA + webhook assinado para a linha.
  async ensure(orgId: string, sessionId: string, engine?: WaEngine) {
    let row = await this.requireRow(orgId, sessionId);
    if (!row.webhook_secret) {
      row = await this.prisma.whatsapp_sessions.update({
        where: { id: row.id },
        data: { webhook_secret: randomBytes(32).toString('hex') },
      });
    }
    if (!row.openwa_session_id) {
      // pareamento novo → motor pedido ou o padrão (reconectar já migra para o motor recomendado)
      const eng: WaEngine = engine || this.openwa.defaultEngine;
      if (!this.openwa.isEngineAvailable(eng))
        throw new ServiceUnavailableException(
          'Gateway WhatsApp indisponível para esse motor.',
        );
      const name = `org-${orgId.replace(/-/g, '').slice(0, 12)}-${row.id.replace(/-/g, '').slice(0, 6)}-${Date.now().toString(36)}`;
      let sess: any;
      try {
        sess = await this.openwa.createSession(name, eng);
      } catch (e) {
        this.translate(e);
      }
      row = await this.prisma.whatsapp_sessions.update({
        where: { id: row.id },
        data: {
          openwa_session_id: String(sess.id),
          openwa_name: name,
          engine: eng,
          status: String(sess.status || 'created'),
          webhook_id: null,
          phone: null,
          push_name: null,
          paired_at: null,
          restricted_at: null,
          disconnected_at: null,
          last_error: null,
        },
      });
      this.openwa.remember(row.openwa_session_id, eng);
      this.logger.log(
        `Sessão OpenWA criada org=${orgId} número=${row.id} session=${sess.id} engine=${eng}`,
      );
    }
    if (!row.webhook_id) {
      const url = `${this.webhookBase()}/webhooks/whatsapp/${row.id}`;
      try {
        const wh = await this.openwa.createWebhook(row.openwa_session_id!, {
          url,
          events: WEBHOOK_EVENTS,
          secret: row.webhook_secret!,
        });
        row = await this.prisma.whatsapp_sessions.update({
          where: { id: row.id },
          data: { webhook_id: String(wh?.id || wh?.webhookId || 'ok') },
        });
      } catch (e: any) {
        this.logger.warn(
          `createWebhook falhou org=${orgId} número=${row.id}: ${e?.message || e}`,
        );
        // sem webhook o watchdog ainda sincroniza o status; não bloqueia o pareamento
      }
    }
    this.presenter.invalidateSessions(orgId);
    return row;
  }

  // "Conectar": cria se preciso e inicia (vai para qr_ready).
  async start(orgId: string, sessionId: string, engine?: WaEngine) {
    const row = await this.ensure(orgId, sessionId, engine);
    try {
      await this.openwa.startSession(row.openwa_session_id!);
    } catch (e: any) {
      // já iniciada/inicializando no gateway → segue (o status ao vivo diz onde está)
      const already =
        e instanceof OpenWaError &&
        (e.status === 400 || e.status === 409) &&
        /already|running|initializ|starting|in progress/i.test(e.message);
      if (!already) this.translate(e);
    }
    this.liveCache.delete(row.openwa_session_id!);
    await this.prisma.whatsapp_sessions.update({
      where: { id: row.id },
      data: {
        last_restart_at: new Date(),
        status: 'initializing',
        last_status_at: new Date(),
      },
    });
    this.presenter.session(orgId, row.id, {
      event: 'local.start',
      status: 'initializing',
    });
    return this.get(orgId, row.id);
  }

  async stop(orgId: string, sessionId: string) {
    const row = await this.requireRow(orgId, sessionId);
    if (!row?.openwa_session_id)
      throw new BadRequestException('Nenhuma sessão para parar.');
    try {
      await this.openwa.stopSession(row.openwa_session_id);
    } catch (e) {
      this.translate(e);
    }
    this.liveCache.delete(row.openwa_session_id);
    return this.get(orgId, row.id);
  }

  async qr(orgId: string, sessionId: string) {
    const row = await this.requireRow(orgId, sessionId);
    if (!row?.openwa_session_id) return { status: 'none', qr: null };
    try {
      const r = await this.openwa.getQr(row.openwa_session_id);
      if (r?.qrCode)
        await this.prisma.whatsapp_sessions
          .update({ where: { id: row.id }, data: { last_qr_at: new Date() } })
          .catch(() => undefined);
      return { status: r?.status || row.status, qr: r?.qrCode || null };
    } catch (e: any) {
      if (
        e instanceof OpenWaError &&
        (e.status === 404 || e.status === 409 || e.status === 400)
      ) {
        // sem QR disponível (ainda inicializando, ou já pareada)
        const st = await this.get(orgId, row.id);
        return { status: st.status, qr: null, message: e.message };
      }
      this.translate(e);
    }
  }

  async pairingCode(orgId: string, sessionId: string, phone: string) {
    const row = await this.ensure(orgId, sessionId);
    try {
      const r = await this.openwa.requestPairingCode(
        row.openwa_session_id!,
        phone,
      );
      return { code: r?.code || r?.pairingCode || null };
    } catch (e) {
      this.translate(e);
    }
  }

  private async detachGateway(row: any, extraData: any = {}) {
    const id = row.openwa_session_id;
    if (id) {
      await this.openwa.logoutSession(id).catch(() => undefined);
      await this.openwa.deleteSession(id).catch(() => undefined);
      this.liveCache.delete(id);
    }
    await this.prisma.whatsapp_sessions.update({
      where: { id: row.id },
      data: {
        openwa_session_id: null,
        openwa_name: null,
        webhook_id: null,
        status: 'none',
        phone: null,
        push_name: null,
        paired_at: null,
        restricted_at: null,
        disconnected_at: new Date(),
        last_error: null,
        ...extraData,
      },
    });
    this.presenter.invalidateSessions(row.organization_id);
    return Boolean(id);
  }

  // "Desconectar / trocar de número": sai do WhatsApp e apaga a sessão no gateway.
  // A linha do número continua (conversas, agendamentos e campanhas ficam ligadas a ela).
  async logout(orgId: string, sessionId: string) {
    const row = await this.requireRow(orgId, sessionId);
    if (!row?.openwa_session_id)
      throw new BadRequestException('Nenhuma sessão conectada.');
    await this.detachGateway(row);
    await this.logEvent(row, 'local.logout', { by: 'user' });
    this.presenter.session(orgId, row.id, {
      event: 'local.logout',
      status: 'none',
    });
    return this.get(orgId, row.id);
  }

  // Troca o motor do gateway (whatsapp-web.js ↔ Baileys): encerra a sessão atual (sai do WhatsApp nesse
  // aparelho vinculado) e cria outra no motor pedido, já iniciada (QR novo). Conversas, contatos,
  // etiquetas e fluxos continuam; o histórico novo é sincronizado ao conectar.
  async switchEngine(orgId: string, sessionId: string, engine: string) {
    const target = String(engine || '').toLowerCase() as WaEngine;
    if (!WA_ENGINES.includes(target))
      throw new BadRequestException('Motor inválido.');
    if (!this.openwa.isEngineAvailable(target))
      throw new ServiceUnavailableException(
        'Esse motor não está disponível no servidor.',
      );
    const row = await this.requireRow(orgId, sessionId);
    if (row?.openwa_session_id && row.engine === target)
      throw new BadRequestException('A conexão já usa esse motor.');
    if (row?.openwa_session_id) {
      await this.detachGateway(row);
      await this.logEvent(row, 'local.switch_engine', {
        from: row.engine,
        to: target,
      });
    }
    return this.start(orgId, row.id, target);
  }

  // "Limpar os dados do número": sai do WhatsApp (se ainda houver sessão), apaga a sessão no gateway
  // e zera o espelho. Troca o segredo do webhook para que evento atrasado da sessão antiga
  // não recrie nada. Mantém nome interno, cor, fluxo do bot e o limitador de envio.
  async wipe(orgId: string, sessionId: string) {
    const row = await this.rowById(orgId, sessionId);
    if (!row) return { had_session: false, row_id: null as string | null };
    const had = await this.detachGateway(row, {
      webhook_secret: null,
      last_qr_at: null,
      settings: {},
    });
    return { had_session: had, row_id: row.id };
  }

  /** Apagar o número (linha): sai do gateway e remove a linha — as conversas/mensagens/status/agendamentos vão em cascata (FK). */
  async remove(orgId: string, sessionId: string) {
    const row = await this.requireRow(orgId, sessionId);
    const rows = await this.rowsOf(orgId);
    await this.detachGateway(row);
    await this.prisma.whatsapp_sessions.delete({ where: { id: row.id } });
    // reordena as abas
    const rest = rows.filter((r) => r.id !== row.id);
    await this.prisma
      .$transaction(
        rest.map((r, i) =>
          this.prisma.whatsapp_sessions.update({
            where: { id: r.id },
            data: { position: i },
          }),
        ),
      )
      .catch(() => undefined);
    this.presenter.invalidateSessions(orgId);
    this.presenter.session(orgId, row.id, {
      event: 'local.remove',
      status: 'none',
      removed: true,
    });
    return { ok: true };
  }

  // Apagar tudo da org (admin.removeOrganization). Best-effort no gateway.
  async destroyForOrg(orgId: string) {
    for (const row of await this.rowsOf(orgId)) {
      if (row?.openwa_session_id) {
        await this.openwa
          .logoutSession(row.openwa_session_id)
          .catch(() => undefined);
        await this.openwa
          .deleteSession(row.openwa_session_id)
          .catch(() => undefined);
      }
    }
  }

  // ---------------------------------------------------------------- perfil
  async getProfile(orgId: string, sessionId: string) {
    const row = await this.requireReady(orgId, sessionId);
    let picture: string | null = null;
    if (row.phone) {
      try {
        picture =
          (
            await this.openwa.profilePicture(
              row.openwa_session_id!,
              `${row.phone}@c.us`,
            )
          )?.url || null;
      } catch {
        picture = null;
      }
    }
    await this.fillBaileysName(row);
    const settings: any = row.settings || {};
    // O WhatsApp não deixa ler o próprio recado por esta conexão: só sabemos o que foi salvo pelo Pub Mail.
    return {
      name: row.push_name || null,
      status: settings.about ?? null,
      status_known: settings.about != null,
      picture,
      phone: row.phone,
    };
  }

  async updateProfile(
    orgId: string,
    sessionId: string,
    dto: { name?: string; status?: string },
  ) {
    const row = await this.requireReady(orgId, sessionId);
    try {
      let settings: any = (row.settings as any) || {};
      if (dto.name !== undefined && String(dto.name).trim()) {
        const name = String(dto.name).trim().slice(0, 255);
        await this.openwa.setProfileName(row.openwa_session_id!, name);
        // o gateway segue devolvendo o nome antigo até reconectar: guardamos qual é esse valor para o
        // syncFromLive não desfazer a troca (só um nome DIFERENTE vindo do gateway passa a valer)
        settings = {
          ...settings,
          name_set_at: new Date().toISOString(),
          gw_push_name: settings.gw_push_name ?? row.push_name ?? null,
        };
        await this.prisma.whatsapp_sessions.update({
          where: { id: row.id },
          data: { push_name: name, settings },
        });
        row.push_name = name;
        this.presenter.invalidateSessions(orgId);
      }
      if (dto.status !== undefined) {
        await this.openwa.setProfileStatus(
          row.openwa_session_id!,
          String(dto.status),
        );
        settings = { ...settings, about: String(dto.status) };
        await this.prisma.whatsapp_sessions.update({
          where: { id: row.id },
          data: { settings },
        });
      }
      row.settings = settings;
    } catch (e) {
      this.translate(e);
    }
    return this.getProfile(orgId, sessionId);
  }

  async setProfilePicture(
    orgId: string,
    sessionId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
  ) {
    const row = await this.requireReady(orgId, sessionId);
    if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype))
      throw new BadRequestException('Envie uma imagem JPG, PNG ou WebP.');
    if (file.size > 5 * 1024 * 1024)
      throw new BadRequestException('Imagem até 5 MB.');
    try {
      await this.openwa.setProfilePicture(
        row.openwa_session_id!,
        file.buffer.toString('base64'),
        file.mimetype,
      );
    } catch (e) {
      this.translate(e);
    }
    return { ok: true };
  }

  async deleteProfilePicture(orgId: string, sessionId: string) {
    const row = await this.requireReady(orgId, sessionId);
    try {
      await this.openwa.deleteProfilePicture(row.openwa_session_id!);
    } catch (e) {
      this.translate(e);
    }
    return { ok: true };
  }

  // Mensagem de teste para o PRÓPRIO número da sessão.
  async sendTest(orgId: string, sessionId: string, text?: string) {
    const row = await this.requireReady(orgId, sessionId);
    if (!row.phone)
      throw new BadRequestException(
        'Número da sessão ainda não identificado. Aguarde alguns segundos.',
      );
    const chatId = `${String(row.phone).replace(/\D/g, '')}@c.us`;
    const body =
      (text || '').trim() ||
      `✅ Pub Mail conectado ao seu WhatsApp (${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}).`;
    try {
      const r = await this.openwa.sendText(
        row.openwa_session_id!,
        chatId,
        body,
      );
      return { ok: true, message_id: r?.messageId || null, to: chatId };
    } catch (e) {
      this.translate(e);
    }
  }

  async setPacing(orgId: string, sessionId: string, enabled: boolean) {
    const row = await this.requireRow(orgId, sessionId);
    await this.prisma.whatsapp_sessions.update({
      where: { id: row.id },
      data: {
        pacing_enabled: enabled,
        ...(enabled ? {} : { warmup_ack_at: new Date() }),
      },
    });
    return this.get(orgId, row.id);
  }

  async events(orgId: string, sessionId: string, limit = 50) {
    const row = await this.rowById(orgId, sessionId);
    if (!row) return [];
    return this.prisma.whatsapp_session_events.findMany({
      where: { session_id: row.id, event: { startsWith: 'session.' } },
      orderBy: { created_at: 'desc' },
      take: Math.min(200, Math.max(1, limit)),
      select: { id: true, event: true, payload: true, created_at: true },
    });
  }

  // ---------------------------------------------------------------- diagnóstico
  /** Saúde da conexão de um número (gateway, eventos, mensagens e mídia nas últimas 24 h). */
  async diagnostics(orgId: string, sessionId: string) {
    const row = await this.requireRow(orgId, sessionId);
    const since = new Date(Date.now() - 86_400_000);
    let gateway: any = { ok: false, ms: null, error: null };
    const engine = (row?.engine as WaEngine) || this.openwa.defaultEngine;
    const t0 = Date.now();
    try {
      await this.openwa.health(engine);
      gateway = { ok: true, ms: Date.now() - t0, error: null };
    } catch (e: any) {
      gateway = {
        ok: false,
        ms: Date.now() - t0,
        error: String(e?.message || e).slice(0, 200),
      };
    }
    const base = { organization_id: orgId, session_id: row.id };
    const [msgIn, msgOut, mediaOk, mediaMissing] = await Promise.all([
      this.prisma.whatsapp_messages.count({
        where: { ...base, direction: 'IN', timestamp: { gte: since } },
      }),
      this.prisma.whatsapp_messages.count({
        where: { ...base, direction: 'OUT', timestamp: { gte: since } },
      }),
      this.prisma.whatsapp_messages.count({
        where: {
          ...base,
          direction: 'IN',
          timestamp: { gte: since },
          media_id: { not: null },
        },
      }),
      this.prisma.whatsapp_messages.count({
        where: {
          ...base,
          direction: 'IN',
          timestamp: { gte: since },
          media_omitted: true,
          media_id: null,
        },
      }),
    ]);
    return {
      session_id: row.id,
      label: sessionLabel(row),
      engine: row?.openwa_session_id ? row.engine : null,
      default_engine: this.openwa.defaultEngine,
      status: row?.status || 'none',
      gateway,
      last_event_at: row?.last_event_at || null,
      messages_24h: { in: msgIn, out: msgOut },
      media_24h: { received: mediaOk, missing: mediaMissing },
      sync: (row?.settings as any)?.sync || null,
      checked_at: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------- webhook (chamado pelo controller)
  async logEvent(
    row: any,
    event: string,
    payload: any,
    idempotencyKey?: string | null,
  ) {
    try {
      await this.prisma.whatsapp_session_events.create({
        data: {
          session_id: row.id,
          organization_id: row.organization_id,
          event: event.slice(0, 48),
          idempotency_key: idempotencyKey
            ? String(idempotencyKey).slice(0, 191)
            : null,
          payload: payload ?? undefined,
        },
      });
      return true;
    } catch (e: any) {
      if (e?.code === 'P2002') return false; // reentrega → já processado
      this.logger.warn(`logEvent falhou: ${e?.message || e}`);
      return true;
    }
  }

  // Aplica um evento de SESSÃO no espelho.
  // Só vale para a sessão ATUAL: evento atrasado de uma sessão já encerrada (ex.: o
  // "desconectado" que o gateway manda durante o logout) não pode ressuscitar o status.
  async applyEvent(row: any, event: string, data: any) {
    const fresh = await this.findByRowId(row.id);
    const current = fresh?.openwa_session_id || null;
    const sid = data?.sessionId ? String(data.sessionId) : null;
    if (!current || (sid && sid !== current && sid !== fresh?.openwa_name))
      return;
    row = fresh;
    const prevStatus = String(row.status || '');
    const now = new Date();
    const patch: any = { last_event_at: now };
    const st = String(data?.status || '');
    switch (event) {
      case 'session.status':
        if (st) {
          patch.status = st;
          patch.last_status_at = now;
        }
        if (st === 'ready') {
          patch.paired_at = row.paired_at || now;
          patch.restricted_at = null;
          patch.last_error = null;
        }
        if (st === 'disconnected' || st === 'failed')
          patch.disconnected_at = now;
        break;
      case 'session.authenticated':
        patch.status = 'ready';
        patch.last_status_at = now;
        patch.paired_at = row.paired_at || now;
        if (data?.phone)
          patch.phone = String(data.phone).replace(/\D/g, '').slice(0, 32);
        if (data?.pushName) {
          patch.push_name = String(data.pushName).slice(0, 255);
          patch.settings = {
            ...((row.settings as any) || {}),
            gw_push_name: patch.push_name,
          };
        }
        break;
      case 'session.disconnected':
        patch.status = 'disconnected';
        patch.last_status_at = now;
        patch.disconnected_at = now;
        if (data?.reason) patch.last_error = String(data.reason).slice(0, 500);
        break;
      case 'session.restriction':
        patch.restricted_at = now;
        patch.last_error = String(
          data?.reason || data?.message || 'Restrição aplicada pelo WhatsApp',
        ).slice(0, 500);
        break;
      case 'session.reconnect_loop':
        patch.last_error = 'Reconectando em loop — verifique o celular/rede.';
        break;
      case 'session.qr':
        patch.last_qr_at = now;
        patch.status = 'qr_ready';
        break;
      default:
        break;
    }
    this.liveCache.delete(current);
    const r = await this.prisma.whatsapp_sessions.updateMany({
      where: { id: row.id, openwa_session_id: current },
      data: patch,
    });
    if (!r.count) return; // encerrada enquanto isso
    // notificações: só nas transições de verdade (pronto ↔ caiu)
    if (event === 'session.restriction')
      this.hooks.emit('session_restricted', {
        orgId: row.organization_id,
        row: { ...row, ...patch },
        reason: patch.last_error || null,
      });
    if (patch.status && patch.status !== prevStatus) {
      if (patch.status === 'ready' && prevStatus !== 'ready')
        this.hooks.emit('session_connected', {
          orgId: row.organization_id,
          row: { ...row, ...patch },
        });
      if (
        (patch.status === 'disconnected' || patch.status === 'failed') &&
        prevStatus === 'ready'
      )
        this.hooks.emit('session_disconnected', {
          orgId: row.organization_id,
          row: { ...row, ...patch },
          reason: patch.last_error || null,
        });
    }
    this.presenter.invalidateSessions(row.organization_id);
    // o front recarrega o estado da conexão (QR novo, conectado, caiu…)
    this.presenter.session(row.organization_id, row.id, {
      event,
      status: patch.status || row.status,
    });
  }

  async touchEvent(id: string) {
    await this.prisma.whatsapp_sessions.update({
      where: { id },
      data: { last_event_at: new Date() },
    });
  }
}
