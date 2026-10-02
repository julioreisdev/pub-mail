import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { promises as fsp } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { OpenWaClient, OpenWaError, WA_ENGINES, WaEngine } from './openwa.client';
import { WhatsAppPresenter } from './whatsapp-presenter.service';

// Sessão WhatsApp da organização (1 por org) por cima do OpenWA.
// - `whatsapp_sessions` guarda o espelho (status/telefone/webhook) — a verdade ao vivo é o OpenWA;
// - o webhook do OpenWA (assinado) atualiza o espelho e grava `whatsapp_session_events`;
// - erros do gateway viram mensagens claras (BadRequest/ServiceUnavailable).

export const SESSION_STATUSES = ['none', 'created', 'initializing', 'qr_ready', 'authenticating', 'ready', 'disconnected', 'action_required', 'failed'] as const;

const WEBHOOK_EVENTS = [
  'session.status', 'session.qr', 'session.authenticated', 'session.disconnected', 'session.reconnect_loop', 'session.restriction',
  'message.received', 'message.sent', 'message.ack', 'message.failed', 'message.revoked', 'message.reaction', 'message.edited',
  'group.join', 'group.leave', 'group.update', 'group.join_request', 'call.received', 'status.received',
];

// Rate de "digitação" e afins entram na Fase 3; aqui só o ciclo de vida da sessão.
@Injectable()
export class WhatsAppSessionsService {
  private readonly logger = new Logger(WhatsAppSessionsService.name);
  // cache curto do GET /sessions/:id (o front faz polling de 3 s)
  private readonly liveCache = new Map<string, { at: number; value: any }>();

  constructor(private readonly prisma: PrismaService, private readonly openwa: OpenWaClient, private readonly presenter: WhatsAppPresenter) {}

  private webhookBase() {
    return String(process.env.OPENWA_WEBHOOK_BASE || 'http://host.docker.internal:8000').replace(/\/+$/, '');
  }

  private translate(e: any): never {
    if (e instanceof OpenWaError) {
      if (e.status === 404) throw new NotFoundException('Sessão não encontrada no gateway. Clique em "Conectar" para criar de novo.');
      if (e.status === 429) throw new BadRequestException(e.retryAfterSeconds ? `Limite de envio atingido. Tente em ${e.retryAfterSeconds}s.` : 'Limite de envio atingido.');
      if (e.status >= 500 || e.status === 503 || e.status === 504) throw new ServiceUnavailableException(e.message);
      throw new BadRequestException(e.message);
    }
    throw e;
  }

  // ---------------------------------------------------------------- leitura
  async row(orgId: string) {
    const r = await this.prisma.whatsapp_sessions.findUnique({ where: { organization_id: orgId } });
    if (r?.openwa_session_id) this.openwa.remember(r.openwa_session_id, r.engine);
    return r;
  }

  private async live(openwaId: string, maxAgeMs = 2500) {
    const c = this.liveCache.get(openwaId);
    if (c && Date.now() - c.at < maxAgeMs) return c.value;
    const v = await this.openwa.getSession(openwaId);
    this.liveCache.set(openwaId, { at: Date.now(), value: v });
    return v;
  }

  private shape(row: any, liveSess: any | null, extra: any = {}) {
    // sem sessão no gateway = não conectado (o espelho pode ter ficado com um status velho)
    const status = liveSess?.status || (row?.openwa_session_id ? row?.status : null) || 'none';
    const engine = (row?.openwa_session_id ? row?.engine : null) || null;
    const def = this.openwa.defaultEngine;
    return {
      configured: this.openwa.configured,
      exists: Boolean(row?.openwa_session_id),
      // motor do gateway: 'wwjs' (antigo, sem download de mídia recebida) | 'baileys' (recomendado)
      engine,
      default_engine: def,
      engine_upgrade: Boolean(engine && engine !== def && this.openwa.isEngineAvailable(def)),
      status,
      connected: status === 'ready',
      phone: liveSess?.phone || row?.phone || null,
      push_name: liveSess?.pushName || row?.push_name || null,
      paired_at: row?.paired_at || null,
      last_status_at: row?.last_status_at || null,
      last_event_at: row?.last_event_at || null,
      restricted_at: row?.restricted_at || null,
      disconnected_at: row?.disconnected_at || null,
      last_error: liveSess?.lastError || row?.last_error || null,
      pacing_enabled: row?.pacing_enabled ?? true,
      warmup_ack_at: row?.warmup_ack_at || null,
      // aquecimento: dia N desde o pareamento (o cronograma do OpenWA é por idade da sessão)
      warmup_day: row?.paired_at ? Math.min(30, Math.floor((Date.now() - new Date(row.paired_at).getTime()) / 86_400_000) + 1) : null,
      created_at: row?.created_at || null,
      sync: (row?.settings as any)?.sync || null, // progresso da última sincronização (fase, contagens)
      ...extra,
    };
  }

  // Nome de exibição no motor Baileys: o gateway só lê `sock.user.name` na hora de conectar e,
  // no 1º pareamento, o WhatsApp ainda não mandou o nome (chega logo depois pela sincronização
  // e fica em creds.json). Lê de lá, no volume do gateway, e guarda no espelho.
  private readonly nameTried = new Map<string, number>();
  private async fillBaileysName(row: any) {
    if (row?.push_name || row?.engine !== 'baileys' || !row?.openwa_session_id) return;
    const sid = String(row.openwa_session_id);
    if (!/^[0-9a-f-]{36}$/i.test(sid) || Date.now() - (this.nameTried.get(sid) || 0) < 60_000) return;
    this.nameTried.set(sid, Date.now());
    try {
      const dir = String(process.env.OPENWA_BAILEYS_DATA_DIR || '/opt/openwa-baileys/data');
      const creds = JSON.parse(await fsp.readFile(join(dir, 'baileys', sid, 'creds.json'), 'utf8'));
      const name = String(creds?.me?.name || '').trim().slice(0, 255);
      if (!name) return;
      await this.prisma.whatsapp_sessions.update({ where: { id: row.id }, data: { push_name: name } });
      row.push_name = name;
    } catch {
      /* sem acesso ao volume do gateway: fica sem nome */
    }
  }

  // Estado atual (espelho + ao vivo). Nunca lança por falha do gateway: devolve `gateway_error`.
  async get(orgId: string) {
    const row = await this.row(orgId);
    if (!row?.openwa_session_id) return this.shape(row, null);
    try {
      const liveSess = await this.live(row.openwa_session_id);
      await this.syncFromLive(row, liveSess);
      if (liveSess?.status === 'ready' && !liveSess?.pushName) await this.fillBaileysName(row);
      return this.shape(row, liveSess);
    } catch (e: any) {
      if (e instanceof OpenWaError && e.status === 404) {
        // sessão sumiu no gateway (container recriado sem volume?) → limpa e deixa reconectar
        await this.prisma.whatsapp_sessions.update({ where: { id: row.id }, data: { openwa_session_id: null, status: 'none', last_error: 'Sessão não existe mais no gateway.' } });
        return this.shape({ ...row, openwa_session_id: null, status: 'none' }, null, { gateway_error: 'Sessão não existe mais no gateway. Conecte de novo.' });
      }
      return this.shape(row, null, { gateway_error: e?.message || 'Gateway indisponível' });
    }
  }

  private async syncFromLive(row: any, liveSess: any) {
    const data: any = {};
    const st = String(liveSess?.status || '');
    if (st && st !== row.status) { data.status = st; data.last_status_at = new Date(); }
    if (liveSess?.phone && liveSess.phone !== row.phone) data.phone = String(liveSess.phone).slice(0, 32);
    if (liveSess?.pushName && liveSess.pushName !== row.push_name) data.push_name = String(liveSess.pushName).slice(0, 255);
    if (st === 'ready' && !row.paired_at) data.paired_at = new Date();
    if (liveSess?.lastError !== undefined && (liveSess.lastError || null) !== (row.last_error || null)) data.last_error = liveSess.lastError ? String(liveSess.lastError).slice(0, 500) : null;
    if (Object.keys(data).length) {
      await this.prisma.whatsapp_sessions.update({ where: { id: row.id }, data });
      Object.assign(row, data);
    }
  }

  // ---------------------------------------------------------------- ciclo de vida
  // Garante linha + sessão no OpenWA + webhook assinado.
  async ensure(orgId: string, engine?: WaEngine) {
    let row = await this.row(orgId);
    if (!row) {
      row = await this.prisma.whatsapp_sessions.create({ data: { organization_id: orgId, status: 'none', engine: engine || this.openwa.defaultEngine, webhook_secret: randomBytes(32).toString('hex') } });
    }
    if (!row.webhook_secret) {
      row = await this.prisma.whatsapp_sessions.update({ where: { id: row.id }, data: { webhook_secret: randomBytes(32).toString('hex') } });
    }
    if (!row.openwa_session_id) {
      // pareamento novo → motor pedido ou o padrão (reconectar já migra para o motor recomendado)
      const eng: WaEngine = engine || this.openwa.defaultEngine;
      if (!this.openwa.isEngineAvailable(eng)) throw new ServiceUnavailableException('Gateway WhatsApp indisponível para esse motor.');
      const name = `org-${orgId.replace(/-/g, '').slice(0, 12)}-${Date.now().toString(36)}`;
      let sess: any;
      try { sess = await this.openwa.createSession(name, eng); } catch (e) { this.translate(e); }
      row = await this.prisma.whatsapp_sessions.update({
        where: { id: row.id },
        data: { openwa_session_id: String(sess.id), openwa_name: name, engine: eng, status: String(sess.status || 'created'), webhook_id: null, phone: null, push_name: null, paired_at: null, restricted_at: null, disconnected_at: null, last_error: null },
      });
      this.openwa.remember(row.openwa_session_id, eng);
      this.logger.log(`Sessão OpenWA criada org=${orgId} session=${sess.id} engine=${eng}`);
    }
    if (!row.webhook_id) {
      const url = `${this.webhookBase()}/webhooks/whatsapp/${row.id}`;
      try {
        const wh = await this.openwa.createWebhook(row.openwa_session_id!, { url, events: WEBHOOK_EVENTS, secret: row.webhook_secret! });
        row = await this.prisma.whatsapp_sessions.update({ where: { id: row.id }, data: { webhook_id: String(wh?.id || wh?.webhookId || 'ok') } });
      } catch (e: any) {
        this.logger.warn(`createWebhook falhou org=${orgId}: ${e?.message || e}`);
        // sem webhook o watchdog ainda sincroniza o status; não bloqueia o pareamento
      }
    }
    return row;
  }

  // "Conectar": cria se preciso e inicia (vai para qr_ready).
  async start(orgId: string, engine?: WaEngine) {
    const row = await this.ensure(orgId, engine);
    try {
      await this.openwa.startSession(row.openwa_session_id!);
    } catch (e: any) {
      // já iniciada/inicializando no gateway → segue (o status ao vivo diz onde está)
      const already = e instanceof OpenWaError && (e.status === 400 || e.status === 409) && /already|running|initializ|starting|in progress/i.test(e.message);
      if (!already) this.translate(e);
    }
    this.liveCache.delete(row.openwa_session_id!);
    await this.prisma.whatsapp_sessions.update({ where: { id: row.id }, data: { last_restart_at: new Date(), status: 'initializing', last_status_at: new Date() } });
    this.presenter.session(orgId, { event: 'local.start', status: 'initializing' });
    return this.get(orgId);
  }

  async stop(orgId: string) {
    const row = await this.row(orgId);
    if (!row?.openwa_session_id) throw new BadRequestException('Nenhuma sessão para parar.');
    try { await this.openwa.stopSession(row.openwa_session_id); } catch (e) { this.translate(e); }
    this.liveCache.delete(row.openwa_session_id);
    return this.get(orgId);
  }

  async qr(orgId: string) {
    const row = await this.row(orgId);
    if (!row?.openwa_session_id) return { status: 'none', qr: null };
    try {
      const r = await this.openwa.getQr(row.openwa_session_id);
      if (r?.qrCode) await this.prisma.whatsapp_sessions.update({ where: { id: row.id }, data: { last_qr_at: new Date() } }).catch(() => undefined);
      return { status: r?.status || row.status, qr: r?.qrCode || null };
    } catch (e: any) {
      if (e instanceof OpenWaError && (e.status === 404 || e.status === 409 || e.status === 400)) {
        // sem QR disponível (ainda inicializando, ou já pareada)
        const st = await this.get(orgId);
        return { status: st.status, qr: null, message: e.message };
      }
      this.translate(e);
    }
  }

  async pairingCode(orgId: string, phone: string) {
    const row = await this.ensure(orgId);
    try {
      const r = await this.openwa.requestPairingCode(row.openwa_session_id!, phone);
      return { code: r?.code || r?.pairingCode || null };
    } catch (e) { this.translate(e); }
  }

  // "Desconectar / trocar de número": sai do WhatsApp e apaga a sessão no gateway.
  // A linha da org continua (contatos/broadcasts/agendamentos são da org, não da sessão).
  async logout(orgId: string) {
    const row = await this.row(orgId);
    if (!row?.openwa_session_id) throw new BadRequestException('Nenhuma sessão conectada.');
    const id = row.openwa_session_id;
    await this.openwa.logoutSession(id).catch(() => undefined);
    await this.openwa.deleteSession(id).catch(() => undefined);
    this.liveCache.delete(id);
    await this.prisma.whatsapp_sessions.update({
      where: { id: row.id },
      data: { openwa_session_id: null, openwa_name: null, webhook_id: null, status: 'none', phone: null, push_name: null, paired_at: null, restricted_at: null, disconnected_at: new Date(), last_error: null },
    });
    await this.logEvent(row, 'local.logout', { by: 'user' });
    this.presenter.session(orgId, { event: 'local.logout', status: 'none' });
    return this.get(orgId);
  }

  // Troca o motor do gateway: encerra a sessão atual (sai do WhatsApp nesse aparelho vinculado)
  // e cria outra no motor pedido, já iniciada (QR novo). Mensagens, contatos, etiquetas e
  // fluxos são da org e continuam; o histórico novo é sincronizado ao conectar.
  async switchEngine(orgId: string, engine: string) {
    const target = String(engine || '').toLowerCase() as WaEngine;
    if (!WA_ENGINES.includes(target)) throw new BadRequestException('Motor inválido.');
    if (!this.openwa.isEngineAvailable(target)) throw new ServiceUnavailableException('Esse motor não está disponível no servidor.');
    const row = await this.row(orgId);
    if (row?.openwa_session_id && row.engine === target) throw new BadRequestException('A conexão já usa esse motor.');
    if (row?.openwa_session_id) {
      const id = row.openwa_session_id;
      await this.openwa.logoutSession(id).catch(() => undefined);
      await this.openwa.deleteSession(id).catch(() => undefined);
      this.liveCache.delete(id);
      await this.prisma.whatsapp_sessions.update({
        where: { id: row.id },
        data: { openwa_session_id: null, openwa_name: null, webhook_id: null, status: 'none', phone: null, push_name: null, paired_at: null, restricted_at: null, disconnected_at: new Date(), last_error: null },
      });
      await this.logEvent(row, 'local.switch_engine', { from: row.engine, to: target });
    }
    return this.start(orgId, target);
  }

  // "Limpar todos os dados": sai do WhatsApp (se ainda houver sessão), apaga a sessão no gateway
  // e zera o espelho. Troca o segredo do webhook para que evento atrasado da sessão antiga
  // não recrie nada. Mantém só a configuração de atendimento (settings.service), o motor e
  // o limitador de envio da org.
  async wipe(orgId: string) {
    const row = await this.row(orgId);
    if (!row) return { had_session: false };
    const id = row.openwa_session_id;
    if (id) {
      await this.openwa.logoutSession(id).catch(() => undefined);
      await this.openwa.deleteSession(id).catch(() => undefined);
      this.liveCache.delete(id);
    }
    const service = ((row.settings as any) || {}).service;
    await this.prisma.whatsapp_sessions.update({
      where: { id: row.id },
      data: {
        openwa_session_id: null, openwa_name: null, webhook_id: null, webhook_secret: null, status: 'none', phone: null, push_name: null,
        paired_at: null, last_qr_at: null, restricted_at: null, disconnected_at: id ? new Date() : row.disconnected_at, last_error: null,
        settings: service ? { service } : {},
      },
    });
    return { had_session: Boolean(id), row_id: row.id };
  }

  // Apagar tudo da org (admin.removeOrganization). Best-effort no gateway.
  async destroyForOrg(orgId: string) {
    const row = await this.row(orgId);
    if (row?.openwa_session_id) {
      await this.openwa.logoutSession(row.openwa_session_id).catch(() => undefined);
      await this.openwa.deleteSession(row.openwa_session_id).catch(() => undefined);
    }
  }

  // ---------------------------------------------------------------- perfil
  private async requireReady(orgId: string) {
    const row = await this.row(orgId);
    if (!row?.openwa_session_id) throw new BadRequestException('Conecte o WhatsApp primeiro.');
    const st = await this.get(orgId);
    if (st.status !== 'ready') throw new BadRequestException('O WhatsApp não está conectado no momento.');
    return row;
  }

  async getProfile(orgId: string) {
    const row = await this.requireReady(orgId);
    let picture: string | null = null;
    if (row.phone) {
      try { picture = (await this.openwa.profilePicture(row.openwa_session_id!, `${row.phone}@c.us`))?.url || null; } catch { picture = null; }
    }
    await this.fillBaileysName(row);
    const settings: any = row.settings || {};
    // O WhatsApp não deixa ler o próprio recado por esta conexão: só sabemos o que foi salvo pelo Pub Mail.
    return { name: row.push_name || null, status: settings.about ?? null, status_known: settings.about != null, picture, phone: row.phone };
  }

  async updateProfile(orgId: string, dto: { name?: string; status?: string }) {
    const row = await this.requireReady(orgId);
    try {
      if (dto.name !== undefined && String(dto.name).trim()) {
        await this.openwa.setProfileName(row.openwa_session_id!, String(dto.name).trim());
        await this.prisma.whatsapp_sessions.update({ where: { id: row.id }, data: { push_name: String(dto.name).trim().slice(0, 255) } });
      }
      if (dto.status !== undefined) {
        await this.openwa.setProfileStatus(row.openwa_session_id!, String(dto.status));
        await this.prisma.whatsapp_sessions.update({ where: { id: row.id }, data: { settings: { ...((row.settings as any) || {}), about: String(dto.status) } } });
      }
    } catch (e) { this.translate(e); }
    return this.getProfile(orgId);
  }

  async setProfilePicture(orgId: string, file: { buffer: Buffer; mimetype: string; size: number }) {
    const row = await this.requireReady(orgId);
    if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) throw new BadRequestException('Envie uma imagem JPG, PNG ou WebP.');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('Imagem até 5 MB.');
    try { await this.openwa.setProfilePicture(row.openwa_session_id!, file.buffer.toString('base64'), file.mimetype); } catch (e) { this.translate(e); }
    return { ok: true };
  }

  async deleteProfilePicture(orgId: string) {
    const row = await this.requireReady(orgId);
    try { await this.openwa.deleteProfilePicture(row.openwa_session_id!); } catch (e) { this.translate(e); }
    return { ok: true };
  }

  // Mensagem de teste para o PRÓPRIO número da sessão.
  async sendTest(orgId: string, text?: string) {
    const row = await this.requireReady(orgId);
    if (!row.phone) throw new BadRequestException('Número da sessão ainda não identificado. Aguarde alguns segundos.');
    const chatId = `${String(row.phone).replace(/\D/g, '')}@c.us`;
    const body = (text || '').trim() || `✅ Pub Mail conectado ao seu WhatsApp (${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}).`;
    try {
      const r = await this.openwa.sendText(row.openwa_session_id!, chatId, body);
      return { ok: true, message_id: r?.messageId || null, to: chatId };
    } catch (e) { this.translate(e); }
  }

  async setPacing(orgId: string, enabled: boolean) {
    const row = await this.ensure(orgId);
    await this.prisma.whatsapp_sessions.update({ where: { id: row.id }, data: { pacing_enabled: enabled, ...(enabled ? {} : { warmup_ack_at: new Date() }) } });
    return this.get(orgId);
  }

  async events(orgId: string, limit = 50) {
    const row = await this.row(orgId);
    if (!row) return [];
    return this.prisma.whatsapp_session_events.findMany({
      where: { session_id: row.id, event: { startsWith: 'session.' } },
      orderBy: { created_at: 'desc' },
      take: Math.min(200, Math.max(1, limit)),
      select: { id: true, event: true, payload: true, created_at: true },
    });
  }

  // ---------------------------------------------------------------- diagnóstico
  /** Saúde da conexão para a tela de Configurações (gateway, eventos, mensagens e mídia nas últimas 24 h). */
  async diagnostics(orgId: string) {
    const row = await this.row(orgId);
    const since = new Date(Date.now() - 86_400_000);
    let gateway: any = { ok: false, ms: null, error: null };
    const engine = (row?.engine as WaEngine) || this.openwa.defaultEngine;
    const t0 = Date.now();
    try {
      await this.openwa.health(engine);
      gateway = { ok: true, ms: Date.now() - t0, error: null };
    } catch (e: any) {
      gateway = { ok: false, ms: Date.now() - t0, error: String(e?.message || e).slice(0, 200) };
    }
    const [msgIn, msgOut, mediaOk, mediaMissing] = await Promise.all([
      this.prisma.whatsapp_messages.count({ where: { organization_id: orgId, direction: 'IN', timestamp: { gte: since } } }),
      this.prisma.whatsapp_messages.count({ where: { organization_id: orgId, direction: 'OUT', timestamp: { gte: since } } }),
      this.prisma.whatsapp_messages.count({ where: { organization_id: orgId, direction: 'IN', timestamp: { gte: since }, media_id: { not: null } } }),
      this.prisma.whatsapp_messages.count({ where: { organization_id: orgId, direction: 'IN', timestamp: { gte: since }, media_omitted: true, media_id: null } }),
    ]);
    return {
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
  async logEvent(row: any, event: string, payload: any, idempotencyKey?: string | null) {
    try {
      await this.prisma.whatsapp_session_events.create({
        data: { session_id: row.id, organization_id: row.organization_id, event: event.slice(0, 48), idempotency_key: idempotencyKey ? String(idempotencyKey).slice(0, 191) : null, payload: payload ?? undefined },
      });
      return true;
    } catch (e: any) {
      if (e?.code === 'P2002') return false; // reentrega → já processado
      this.logger.warn(`logEvent falhou: ${e?.message || e}`);
      return true;
    }
  }

  // Aplica um evento de SESSÃO no espelho. Eventos de mensagem entram na Fase 2.
  // Só vale para a sessão ATUAL: evento atrasado de uma sessão já encerrada (ex.: o
  // "desconectado" que o gateway manda durante o logout) não pode ressuscitar o status.
  async applyEvent(row: any, event: string, data: any) {
    const fresh = await this.findByRowId(row.id);
    const current = fresh?.openwa_session_id || null;
    const sid = data?.sessionId ? String(data.sessionId) : null;
    if (!current || (sid && sid !== current && sid !== fresh?.openwa_name)) return;
    row = fresh;
    const now = new Date();
    const patch: any = { last_event_at: now };
    const st = String(data?.status || '');
    switch (event) {
      case 'session.status':
        if (st) { patch.status = st; patch.last_status_at = now; }
        if (st === 'ready') { patch.paired_at = row.paired_at || now; patch.restricted_at = null; patch.last_error = null; }
        if (st === 'disconnected' || st === 'failed') patch.disconnected_at = now;
        break;
      case 'session.authenticated':
        patch.status = 'ready'; patch.last_status_at = now; patch.paired_at = row.paired_at || now;
        if (data?.phone) patch.phone = String(data.phone).replace(/\D/g, '').slice(0, 32);
        if (data?.pushName) patch.push_name = String(data.pushName).slice(0, 255);
        break;
      case 'session.disconnected':
        patch.status = 'disconnected'; patch.last_status_at = now; patch.disconnected_at = now;
        if (data?.reason) patch.last_error = String(data.reason).slice(0, 500);
        break;
      case 'session.restriction':
        patch.restricted_at = now; patch.last_error = String(data?.reason || data?.message || 'Restrição aplicada pelo WhatsApp').slice(0, 500);
        break;
      case 'session.reconnect_loop':
        patch.last_error = 'Reconectando em loop — verifique o celular/rede.';
        break;
      case 'session.qr':
        patch.last_qr_at = now; patch.status = 'qr_ready';
        break;
      default:
        break;
    }
    this.liveCache.delete(current);
    const r = await this.prisma.whatsapp_sessions.updateMany({ where: { id: row.id, openwa_session_id: current }, data: patch });
    if (!r.count) return; // encerrada enquanto isso
    // o front recarrega o estado da conexão (QR novo, conectado, caiu…)
    this.presenter.session(row.organization_id, { event, status: patch.status || row.status });
  }

  async touchEvent(id: string) {
    await this.prisma.whatsapp_sessions.update({ where: { id }, data: { last_event_at: new Date() } });
  }

  async findByRowId(id: string) {
    return this.prisma.whatsapp_sessions.findUnique({ where: { id } });
  }
}
