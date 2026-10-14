import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from 'generated/prisma/client';
import { AccessService } from '../platform-billing/access.service';
import { OpenWaClient } from './openwa.client';
import { WhatsAppSessionsService, sessionLabel } from './whatsapp-sessions.service';
import { WhatsAppMediaService } from './whatsapp-media.service';
import { WhatsAppInboundService } from './whatsapp-inbound.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { WhatsAppPacingService, brtDayStart } from './whatsapp-pacing.service';
import { WhatsAppHooks } from './whatsapp-hooks.service';
import { mergeChargeSettings, normalizeChargeSettings } from './wa-charge-settings.util';
import { jidFromPhone } from './wa-jid.util';

// ============================================================================
// Fila de envio com ritmo (`whatsapp_outbox`) — Fase 3 das assinaturas.
//
//  - Quem enfileira: runner diário das cobranças (recorrentes, lembretes), avisos do motor de
//    assinatura (trial acabando, cancelamento, pausa, retomada, troca de plano, reajuste).
//    Cobrança pedida pelo bot/atendente na hora continua saindo direto (`sendNow`).
//  - Worker (ver "Revisão geral" abaixo — hoje é 1 worker por número, em paralelo): antes pegava a linha vencida MAIS ANTIGA DE CADA NÚMERO (ROW_NUMBER por `session_id`, até 200
//    números por rodada — um número com fila gigante não deixa os outros sem vez), claim atômico (pending → sending),
//    no máx. `charge.outbox_per_minute` por NÚMERO por minuto e ESPAÇADOS (intervalo = 60 s ÷ ritmo, nunca em rajada);
//    envio preso em `sending` (back reiniciou no meio) volta para `pending` depois de 10 min (preso pela 3ª vez = failed),
//    pula org sem acesso ativo, número desconectado = reagenda +5 min, respeita o aquecimento (`PacingService.canSend`;
//    frio/limite → amanhã 09:00 BRT), 3 tentativas → failed; linha pendente há mais de 7 dias (cobrança: 10) → failed
//    "expirou na fila" (nada fica na fila para sempre). Payload com várias mensagens que falha na N-ésima guarda
//    `sent_index` e a nova tentativa continua da N (não repete as que já saíram). Grava a mensagem OUT em `whatsapp_messages`.
//  - `sendNow` é o helper ÚNICO de "enviar e gravar OUT" (as cobranças usam o mesmo).
//
// Payload: { messages: [{ text?, media_id?, kind? }], mark?: { charge?, subscription?, system? }, charge?: { id, which }, sent_index? }
//   (`charge` = depois de enviar, grava `sent_at`/`reminders` na cobrança — sem depender do serviço de cobranças).
// Este serviço NÃO importa CRM, cobranças nem assinaturas (eles importam este).
//
// Fase 8 (§12.1): PAUSA POR NÚMERO (`whatsapp_sessions.outbox_paused_at` — o worker não pega nada daquele número;
// as linhas continuam `pending`, sem contar tentativa; o TTL continua valendo) — manual pelo painel ou automática
// no hook `session_restricted`; RITMO POR NÚMERO (`outbox_per_minute` 1–60; null = o da org, `charge.outbox_per_minute`);
// painel (`summary`/`list`/retry/cancel/em massa) e tempo real `wa:outbox` (sala da org, agrupado 2 s).
// `run_at` de uma linha `failed` = quando falhou (o claim grava o início do envio; expiração/recuperação gravam agora).
//
// Revisão geral (14/10/2026):
//  - C-M6 RITMO REAL: o tique (1 s) só escolhe NÚMEROS com fila vencida (pausado fica de fora no SQL) e dispara um
//    worker por número, até `MAX_PARALLEL_SESSIONS` em paralelo. Cada worker envia VÁRIAS linhas do seu número (lotes
//    de 20, por ordem de `run_at`) esperando o intervalo do ritmo entre uma e outra (60 s ÷ ritmo, teto por minuto),
//    por até `WORKER_BUDGET_MS`; o tique seguinte relança. Claim atômico, recuperação de travados, TTL, `sent_index`,
//    pacing e pausa continuam iguais. Número desconectado / org sem acesso / número apagado tratam a FILA do número de
//    uma vez (antes: 1 linha por tique). ETA = pendentes ÷ min(ritmo, vazão medida), e o limite diário do aquecimento
//    empurra o resto para amanhã (`eta_note`).
//  - C-H3 CONTEÚDO VELHO: antes de enviar (e ao "tentar de novo"), linha ligada a uma cobrança (`payload.charge.id` /
//    `mark.charge`) só sai se a cobrança ainda está PENDING com o MESMO código PIX/valor; ligada a um agendamento
//    (`mark.appointment`, avisos que dependem dele estar de pé) só sai se ele ainda está marcado. Senão: `canceled` +
//    motivo em `last_error`.
//  - C-M7 PODA: `sent`/`canceled` > 15 dias e `failed` > 30 dias são apagados (a cada 6 h, em lotes); o resumo conta
//    enviadas/falhas/canceladas dos últimos 30 dias.
//  - A-4 `redactForJids(org, jids)`: apagamento LGPD zera o payload de TODAS as linhas daqueles jids (pendentes viram canceladas).
// ============================================================================

export type OutboxMessage = { kind?: 'text' | 'image' | 'video' | 'audio' | 'document'; text?: string | null; media_id?: string | null };
export type OutboxPayload = { messages: OutboxMessage[]; mark?: Record<string, unknown>; charge?: { id: string; which: string; pix?: string | null; amount_cents?: number | null }; sent_index?: number };
export type OutboxInput = { session_id: string; chat_id: string; kind: string; payload: OutboxPayload | { text?: string; media_id?: string | null; mark?: Record<string, unknown>; charge?: { id: string; which: string; pix?: string | null; amount_cents?: number | null } }; run_at?: Date | null; dedupe_key?: string | null };
export const OUTBOX_MAX_ATTEMPTS = 3;
const TICK_MS = 1_000;
const MAX_PARALLEL_SESSIONS = 8; // números enviando ao mesmo tempo (pool do banco = 10)
const WORKER_BUDGET_MS = 20_000; // um worker de número envia por no máx. isso e devolve a vez (o tique relança)
const WORKER_BATCH = 20; // linhas lidas por vez por worker (uma ordenação por lote, não por linha)
const PRUNE_EVERY_MS = 6 * 3600_000;
const PRUNE_SENT_MS = 15 * 24 * 3600_000; // sent/canceled
const PRUNE_FAILED_MS = 30 * 24 * 3600_000; // failed
const PRUNE_CHUNK = 5_000;
const SUMMARY_WINDOW_MS = 30 * 24 * 3600_000; // totais de enviadas/falhas/canceladas no resumo
/**
 * Avisos de agendamento que dependem dele AINDA estar de pé (status permitidos na hora de enviar). Avisos de desfecho
 * (cancelado, expirado, falta, pago fora do prazo, lista de espera) saem sempre.
 */
const APPT_ALIVE: Record<string, string[]> = {
  appt_pending: ['pending_payment'],
  appt_booked: ['booked', 'confirmed', 'in_progress'],
  appt_paid: ['booked', 'confirmed', 'in_progress'],
  appt_confirmed: ['booked', 'confirmed', 'in_progress'],
  appt_rescheduled: ['pending_payment', 'booked', 'confirmed'],
  appt_reply2: ['pending_payment', 'booked', 'confirmed'],
  appt_d1: ['booked', 'confirmed'],
  appt_d1_confirm: ['booked', 'confirmed'],
  appt_h2: ['booked', 'confirmed'],
};
const CHARGE_STATUS_LABEL: Record<string, string> = { PAID: 'paga', EXPIRED: 'expirada', CANCELED: 'cancelada', FAILED: 'com falha' };
const EMV_RE = /^000201/; // começo de um PIX copia-e-cola
const STUCK_MS = 10 * 60_000; // `sending` há mais que isso = o processo caiu no meio do envio
const MAX_ATTEMPTS_EVER = 100; // o contador de tentativas nunca passa disso (recuperações repetidas)
export const OUTBOX_TTL_MS = 7 * 24 * 3600_000; // pendente há mais que isso (desde a criação) = expirou na fila
export const OUTBOX_TTL_CHARGE_MS = 10 * 24 * 3600_000; // cobranças/lembretes (`charge_*`) esperam um pouco mais
const READY_CACHE_MS = 15_000; // números conectados da org (cache curto para rodadas do runner que enfileiram em lote)
const SESSION_CACHE_MS = 15_000; // pausa/ritmo por número (invalidado pelas ações do painel)
const EMIT_DEBOUNCE_MS = 2_000; // `wa:outbox` agrupado por org
export const OUTBOX_SESSION_RATE_MAX = 60;
export const OUTBOX_ORG_RATE_MAX = 60; // o ritmo da org também é POR NÚMERO: o mesmo teto do ritmo próprio do número (C-M6)
const RETRY_WINDOW_MS = 72 * 3600_000; // "tentar de novo as falhas" = só as das últimas 72 h
const BULK_MAX = 5_000;
export const OUTBOX_RESTRICTED_REASON = 'O WhatsApp restringiu este número';
export const OUTBOX_STATUSES = ['pending', 'sending', 'sent', 'failed', 'canceled'] as const;

// ---------------------------------------------------------------- rótulos (PT) dos tipos enfileirados
// Grupos = prefixo do `kind` (`charge_*`, `subscription_*`, `appt_*`, `ticket_*`, `order_*`, `entitlement_*`, `api_message`).
export const OUTBOX_KIND_GROUPS: { value: string; label: string }[] = [
  { value: 'charge', label: 'Cobranças' },
  { value: 'subscription', label: 'Assinaturas' },
  { value: 'appt', label: 'Agendamentos' },
  { value: 'ticket', label: 'Chamados' },
  { value: 'order', label: 'Pedidos' },
  { value: 'entitlement', label: 'Acessos liberados' },
  { value: 'api', label: 'API' },
];
const KIND_LABELS: Record<string, string> = {
  charge_charge: 'Cobrança',
  charge_reminder_before: 'Lembrete antes do vencimento',
  charge_reminder_due: 'Lembrete no vencimento',
  charge_reminder_after: 'Cobrança em atraso',
  charge_second_copy: '2ª via da cobrança',
  charge_card_declined: 'Cartão recusado',
  subscription_trial_ending: 'Fim do período de teste',
  subscription_canceled: 'Assinatura cancelada',
  subscription_cancel_scheduled: 'Cancelamento agendado',
  subscription_paused: 'Assinatura pausada',
  subscription_resumed: 'Assinatura retomada',
  subscription_plan_changed: 'Troca de plano',
  subscription_price_changed: 'Aviso de reajuste',
  entitlement_invite: 'Convite para o grupo',
  entitlement_file: 'Entrega de arquivo',
  appt_d1: 'Lembrete do agendamento (véspera)',
  appt_d1_confirm: 'Confirmação do agendamento',
  appt_h2: 'Lembrete do agendamento (2 h antes)',
  appt_waitlist_offer: 'Vaga da lista de espera',
  api_message: 'Mensagem pela API',
};
const GROUP_SINGULAR: Record<string, string> = { charge: 'Cobrança', subscription: 'Assinatura', appt: 'Agendamento', ticket: 'Chamado', order: 'Pedido', entitlement: 'Acesso liberado', api: 'API' };
const SUFFIX_LABELS: Record<string, string> = {
  created: 'aberto', resolved: 'resolvido', closed: 'encerrado', status: 'status alterado', comment: 'novo comentário',
  booked: 'confirmado', pending: 'aguardando pagamento', pending_payment: 'aguardando pagamento', paid: 'pago', paid_late: 'pago (atrasado)',
  expired: 'expirado', canceled: 'cancelado', canceled_late: 'cancelado em cima da hora', confirmed: 'confirmado', started: 'iniciado',
  done: 'concluído', no_show: 'falta', rescheduled: 'remarcado', waitlist: 'lista de espera', waitlist_booked: 'vaga garantida',
  waitlist_declined: 'vaga recusada', waitlist_failed: 'vaga indisponível', manual: 'aviso manual', ready: 'pronto', shipped: 'enviado', delivered: 'entregue',
};
export function outboxKindGroup(kind: string) {
  const k = String(kind || '');
  if (k === 'api_message' || k.startsWith('api_')) return 'api';
  const g = k.split('_')[0];
  return GROUP_SINGULAR[g] ? g : 'other';
}
export function outboxKindLabel(kind: string) {
  const k = String(kind || '');
  if (KIND_LABELS[k]) return KIND_LABELS[k];
  const g = outboxKindGroup(k);
  if (g === 'other') return k ? k.replace(/_/g, ' ') : 'Mensagem';
  const rest = k.slice(g.length + 1);
  const suf = SUFFIX_LABELS[rest] || rest.replace(/_/g, ' ');
  return suf ? `${GROUP_SINGULAR[g]} · ${suf}` : GROUP_SINGULAR[g];
}
/** Filtro Prisma do `kind` (grupo = prefixo; senão o valor exato). */
export function outboxKindWhere(kind?: string | null): any {
  const k = String(kind || '').trim();
  if (!k) return undefined;
  if (k === 'api') return { startsWith: 'api_' };
  if (GROUP_SINGULAR[k]) return { startsWith: `${k}_` };
  return k.slice(0, 32);
}
const MEDIA_LABEL: Record<string, string> = { image: 'Imagem', video: 'Vídeo', audio: 'Áudio', document: 'Documento' };
export function outboxPreview(payload: any) {
  const msgs = Array.isArray(payload?.messages) ? payload.messages : payload?.text || payload?.media_id ? [payload] : [];
  const m = msgs[0];
  if (!m) return '';
  const text = String(m.text || '').replace(/\s+/g, ' ').trim();
  if (text) return text.length > 80 ? `${text.slice(0, 79)}…` : text;
  return m.media_id ? `[${MEDIA_LABEL[m.kind] || 'Arquivo'}]` : '';
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class WhatsAppOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppOutboxService.name);
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private lastRecover = 0;
  private lastPrune = 0;
  private readonly busy = new Set<string>(); // números com worker rodando
  private readonly restUntil = new Map<string, number>(); // número → só volta a ter worker depois disto (esperando o ritmo)
  private readonly sendMs = new Map<string, number>(); // número → duração média de um envio (EMA), para a previsão
  private readonly sentAt = new Map<string, number[]>(); // número → timestamps dos envios do último minuto
  private readonly orgCache = new Map<string, { at: number; active: boolean; perMinute: number }>();
  private readonly readyCache = new Map<string, { at: number; rows: any[] }>();
  private readonly sessionCache = new Map<string, { at: number; paused: boolean; perMinute: number | null }>(); // número → pausa/ritmo
  private readonly emitTimers = new Map<string, NodeJS.Timeout>(); // org → `wa:outbox` agendado

  constructor(
    private readonly prisma: PrismaService,
    private readonly openwa: OpenWaClient,
    private readonly sessions: WhatsAppSessionsService,
    private readonly media: WhatsAppMediaService,
    private readonly inbound: WhatsAppInboundService,
    private readonly presenter: WhatsAppPresenter,
    private readonly pacing: WhatsAppPacingService,
    private readonly access: AccessService,
    private readonly hooks: WhatsAppHooks,
  ) {}

  onModuleInit() {
    // envios que ficaram em `sending` quando o processo caiu: voltam para a fila (contam como tentativa)
    void this.recoverStuck(0).catch((e) => this.logger.warn(`outbox recover: ${e?.message || e}`));
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    // WhatsApp restringiu o número → pausa a fila daquele número (as linhas esperam; retomar pelo painel)
    this.hooks.on('session_restricted', (e) => this.onRestricted(e));
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    for (const t of this.emitTimers.values()) clearTimeout(t);
    this.emitTimers.clear();
  }

  // ---------------------------------------------------------------- enfileirar
  private normPayload(p: OutboxInput['payload']): OutboxPayload {
    const anyP: any = p || {};
    const messages: OutboxMessage[] = Array.isArray(anyP.messages) ? anyP.messages : [{ text: anyP.text, media_id: anyP.media_id }];
    const clean = messages.map((m) => ({ kind: m.kind || (m.media_id ? 'image' : 'text'), text: m.text ? String(m.text).slice(0, 4000) : null, media_id: m.media_id || null })).filter((m) => m.text || m.media_id);
    return { messages: clean, ...(anyP.mark ? { mark: anyP.mark } : {}), ...(anyP.charge ? { charge: anyP.charge } : {}) };
  }

  /** Enfileira um envio. Devolve a linha ou null (sem mensagem / dedupe já existente). */
  async enqueue(orgId: string, input: OutboxInput) {
    const payload = this.normPayload(input.payload);
    if (!payload.messages.length || !input.session_id || !input.chat_id) return null;
    try {
      return await this.prisma.whatsapp_outbox.create({ data: { organization_id: orgId, session_id: input.session_id, chat_id: input.chat_id, kind: String(input.kind || 'message').slice(0, 32), payload: payload as any, run_at: input.run_at || new Date(), dedupe_key: input.dedupe_key ? String(input.dedupe_key).slice(0, 120) : null } });
    } catch (e: any) {
      if (e?.code === 'P2002') return null; // dedupe
      throw e;
    }
  }

  /** jids pelos quais um contato pode aparecer numa conversa. */
  private contactJids(contact: any): string[] {
    return [...new Set([contact?.wa_id, contact?.lid, contact?.phone ? jidFromPhone(contact.phone) : null].filter(Boolean))] as string[];
  }

  /**
   * Por qual (número, jid) falar com um contato: conversa individual mais recente num número
   * CONECTADO → qualquer conversa → qualquer número conectado com o telefone. null = sem como.
   */
  async chatKeyForContact(orgId: string, contactId: string): Promise<{ session_id: string; chat_id: string } | null> {
    const contact = await this.prisma.whatsapp_contacts.findFirst({ where: { id: contactId, organization_id: orgId } });
    if (!contact) return null;
    const jids = this.contactJids(contact);
    const ready = await this.readyRowsCached(orgId);
    const readyIds = new Set(ready.map((r) => r.id));
    const chats = jids.length ? await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, kind: 'individual', chat_id: { in: jids } }, orderBy: { last_message_at: 'desc' }, select: { session_id: true, chat_id: true } }) : [];
    const best = chats.find((c) => readyIds.has(c.session_id)) || chats[0];
    if (best) return { session_id: best.session_id, chat_id: best.chat_id };
    const fallbackJid = contact.phone ? jidFromPhone(contact.phone) : String(contact.wa_id || '');
    if (!fallbackJid || !ready.length) return null;
    return { session_id: ready[0].id, chat_id: fallbackJid };
  }

  /** Números conectados da org com cache de 15 s (o runner diário enfileira centenas de avisos seguidos). */
  private async readyRowsCached(orgId: string) {
    const c = this.readyCache.get(orgId);
    if (c && Date.now() - c.at < READY_CACHE_MS) return c.rows;
    const rows = await this.sessions.readyRows(orgId);
    this.readyCache.set(orgId, { at: Date.now(), rows });
    return rows;
  }

  /** Enfileira para o contato principal de um cliente (resolve o número). null quando não há como enviar. */
  async enqueueForCustomer(orgId: string, customer: { id: string; contact_id: string }, kind: string, payload: OutboxInput['payload'], opts: { run_at?: Date | null; dedupe_key?: string | null } = {}) {
    const key = await this.chatKeyForContact(orgId, customer.contact_id);
    if (!key) { this.logger.debug(`outbox: cliente ${customer.id} sem número para enviar (${kind})`); return null; }
    return this.enqueue(orgId, { ...key, kind, payload, run_at: opts.run_at, dedupe_key: opts.dedupe_key });
  }

  /**
   * Cancela pendentes (ex.: cobrança cancelada antes de sair). `reason` vai para `last_error`. `release_dedupe` = a chave
   * de dedupe é liberada (o mesmo aviso pode ser enfileirado de novo no mesmo dia com conteúdo novo — ex.: PIX recriado).
   */
  async cancelPending(orgId: string, where: { kind?: string; dedupe_prefix?: string; chat_id?: string; reason?: string | null; release_dedupe?: boolean }) {
    const w: any = { organization_id: orgId, status: 'pending' };
    if (where.kind) w.kind = where.kind;
    if (where.chat_id) w.chat_id = where.chat_id;
    if (where.dedupe_prefix) w.dedupe_key = { startsWith: where.dedupe_prefix };
    const data: any = { status: 'canceled', ...(where.reason ? { last_error: String(where.reason).slice(0, 255) } : {}) };
    const r = await this.prisma.whatsapp_outbox.updateMany({ where: w, data });
    if (where.release_dedupe && where.dedupe_prefix) {
      // as canceladas (agora ou antes) daquela chave deixam de segurar o dedupe
      await this.prisma.whatsapp_outbox.updateMany({ where: { organization_id: orgId, status: 'canceled', dedupe_key: { startsWith: where.dedupe_prefix } }, data: { dedupe_key: null } }).catch(() => undefined);
    }
    if (r.count) this.scheduleEmit(orgId);
    return r.count;
  }

  /**
   * LGPD (A-4): apaga o CONTEÚDO de todas as linhas da fila destes jids (qualquer status) — `payload` vira
   * `{messages:[], redacted:true}` e o motivo de erro some; o que estava pendente/enviando vira `canceled`.
   * Devolve quantas linhas foram tocadas. Chamado pelo apagamento de dados do cliente (whatsapp-privacy).
   */
  async redactForJids(orgId: string, jids: string[]) {
    const list = [...new Set((jids || []).map((j) => String(j || '').trim()).filter(Boolean))].slice(0, 2000);
    if (!orgId || !list.length) return { canceled: 0, redacted: 0 };
    const empty = { messages: [], redacted: true } as any;
    let canceled = 0, redacted = 0;
    for (let i = 0; i < list.length; i += 500) {
      const part = list.slice(i, i + 500);
      const a = await this.prisma.whatsapp_outbox.updateMany({ where: { organization_id: orgId, chat_id: { in: part }, status: { in: ['pending', 'sending'] } }, data: { status: 'canceled', payload: empty, last_error: 'Dados do cliente apagados (LGPD)' } });
      const b = await this.prisma.whatsapp_outbox.updateMany({ where: { organization_id: orgId, chat_id: { in: part }, status: { notIn: ['pending', 'sending'] } }, data: { payload: empty, last_error: null } });
      canceled += a.count; redacted += a.count + b.count;
    }
    if (redacted) this.scheduleEmit(orgId);
    return { canceled, redacted };
  }

  // ---------------------------------------------------------------- enviar + gravar OUT (helper único)
  /**
   * Envia pelo número `row` (linha de whatsapp_sessions pronta) para o jid e grava a mensagem OUT
   * com `session_id` + `extra` (ex.: `{ charge: id }`, `{ system: true, subscription: id }`).
   * Devolve o wa_message_id. Lança se o gateway falhar.
   */
  async sendNow(orgId: string, row: any, jid: string, msg: { kind: 'text' | 'image' | 'video' | 'audio' | 'document'; text?: string | null; mediaId?: string | null }, extra: Record<string, unknown>) {
    const sid = String(row.openwa_session_id);
    let r: any; let type = 'text';
    if (msg.kind !== 'text' && msg.mediaId) {
      const f = await this.media.readBase64(orgId, msg.mediaId);
      r = await this.openwa.sendMedia(sid, msg.kind, jid, { base64: f.base64, mimetype: f.mime, filename: f.filename || undefined, caption: msg.text || undefined });
      type = msg.kind;
    } else {
      if (!msg.text) return null;
      r = await this.openwa.sendText(sid, jid, msg.text);
    }
    if (r && typeof r === 'object' && r.success === false) throw new Error(String(r.message || r.error || 'O gateway recusou o envio.')); // OpenWA responde 200 {success:false} em falha
    // daqui em diante a mensagem JÁ SAIU: nada pode lançar (o chamador tentaria de novo e o cliente receberia em dobro — C-L6)
    const at = r?.timestamp ? new Date(Number(r.timestamp) * 1000) : new Date();
    const waId = String(r?.messageId || `out_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    try {
      await this.prisma.whatsapp_messages
        .create({ data: { organization_id: orgId, session_id: row.id, chat_id: jid, wa_message_id: waId, direction: 'OUT', type, body: msg.text || null, media_id: msg.kind !== 'text' ? msg.mediaId || null : null, ack: 1, timestamp: at, extra: extra as any } })
        .catch(async (e: any) => { if (e?.code === 'P2002') await this.prisma.whatsapp_messages.update({ where: { organization_id_session_id_wa_message_id: { organization_id: orgId, session_id: row.id, wa_message_id: waId } }, data: { extra: extra as any } }).catch(() => undefined); else throw e; });
    } catch (e: any) { this.logger.warn(`mensagem enviada (${waId}) mas não gravada no histórico: ${e?.message || e}`); }
    await this.inbound.bumpChat(orgId, row.id, jid, { type, body: msg.text, direction: 'OUT', at }).catch((e: any) => this.logger.debug(`bumpChat ${jid}: ${e?.message || e}`));
    try { this.presenter.message(orgId, { waId, sessionId: row.id }); } catch (e: any) { this.logger.debug(`presenter ${waId}: ${e?.message || e}`); }
    return waId;
  }

  // ---------------------------------------------------------------- worker
  private async orgInfo(orgId: string) {
    const c = this.orgCache.get(orgId);
    if (c && Date.now() - c.at < 60_000) return c;
    const [active, row] = await Promise.all([
      this.access.isOrgActive(orgId).catch(() => false),
      this.prisma.whatsapp_crm_settings.findUnique({ where: { organization_id: orgId }, select: { charge: true } }).catch(() => null),
    ]);
    const info = { at: Date.now(), active, perMinute: normalizeChargeSettings(row?.charge).outbox_per_minute };
    this.orgCache.set(orgId, info);
    return info;
  }

  /**
   * `sending` mais antigo que `olderThanMs` (pelo `run_at`, que o claim atualiza) volta para `pending` (+1 tentativa).
   * Preso pela 3ª vez (`attempts ≥ 3`) não volta: falha de vez. O contador nunca passa de 100.
   */
  private async recoverStuck(olderThanMs = STUCK_MS) {
    const stale = { status: 'sending', run_at: { lt: new Date(Date.now() - olderThanMs) } };
    const dead = await this.prisma.whatsapp_outbox.updateMany({ where: { ...stale, attempts: { gte: OUTBOX_MAX_ATTEMPTS } }, data: { status: 'failed', last_error: 'Envio interrompido repetidas vezes', run_at: new Date() } });
    const r = await this.prisma.whatsapp_outbox.updateMany({ where: { ...stale, attempts: { lt: MAX_ATTEMPTS_EVER } }, data: { status: 'pending', last_error: 'Envio interrompido (o servidor reiniciou); tentando de novo', attempts: { increment: 1 } } });
    if (r.count || dead.count) this.logger.warn(`outbox: ${r.count} envio(s) interrompido(s) voltaram para a fila${dead.count ? `, ${dead.count} falharam de vez` : ''}`);
    return r.count;
  }

  /** Pendente velho demais (7 dias desde a criação; `charge_*` 10) falha com "expirou na fila" — reagendar não renova o prazo. */
  private async expireOld() {
    const now = Date.now();
    const a = await this.prisma.whatsapp_outbox.updateMany({ where: { status: 'pending', kind: { startsWith: 'charge_' }, created_at: { lt: new Date(now - OUTBOX_TTL_CHARGE_MS) } }, data: { status: 'failed', last_error: 'expirou na fila', run_at: new Date() } });
    const b = await this.prisma.whatsapp_outbox.updateMany({ where: { status: 'pending', NOT: { kind: { startsWith: 'charge_' } }, created_at: { lt: new Date(now - OUTBOX_TTL_MS) } }, data: { status: 'failed', last_error: 'expirou na fila', run_at: new Date() } });
    const n = a.count + b.count;
    if (n) this.logger.warn(`outbox: ${n} envio(s) expiraram na fila`);
    return n;
  }

  /** Quanto falta (ms) para o número poder enviar de novo: intervalo (60 s ÷ ritmo) e teto de `ritmo` envios no último minuto. */
  private rateWait(sessionId: string, perMinute: number) {
    const now = Date.now();
    const list = (this.sentAt.get(sessionId) || []).filter((t) => now - t < 60_000);
    this.sentAt.set(sessionId, list);
    const rate = Math.max(1, perMinute);
    const last = list[list.length - 1] || 0;
    const gapWait = last ? last + Math.floor(60_000 / rate) - now : 0;
    const minuteWait = list.length >= rate ? list[list.length - rate] + 60_000 - now : 0;
    return Math.max(0, gapWait, minuteWait);
  }

  /** Um envio começou em `startedAt` e levou `ms` (o intervalo do ritmo conta do INÍCIO: o tempo do envio cabe dentro dele). */
  private noteSend(sessionId: string, startedAt: number, ms: number) {
    this.sentAt.set(sessionId, [...(this.sentAt.get(sessionId) || []), startedAt]);
    const prev = this.sendMs.get(sessionId);
    this.sendMs.set(sessionId, prev ? Math.round(prev * 0.8 + ms * 0.2) : ms);
  }

  /** Amanhã 09:00 BRT (para quem bateu no aquecimento). */
  static tomorrow9BRT(now = new Date()) {
    return new Date(brtDayStart(now).getTime() + 24 * 3600_000 + 9 * 3600_000);
  }

  /**
   * Tique (1 s): manutenção (recupera travados/expira a cada 1 min, poda a cada 6 h) e dispara um worker para cada
   * NÚMERO com fila vencida que ainda não tem worker (até `MAX_PARALLEL_SESSIONS`). Número pausado fica de fora no SQL.
   */
  private async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      if (Date.now() - this.lastRecover > 60_000) { this.lastRecover = Date.now(); await this.recoverStuck().catch(() => undefined); await this.expireOld().catch(() => undefined); }
      if (Date.now() - this.lastPrune > PRUNE_EVERY_MS) { this.lastPrune = Date.now(); void this.prune().catch((e) => this.logger.warn(`outbox prune: ${e?.message || e}`)); }
      const slots = MAX_PARALLEL_SESSIONS - this.busy.size;
      if (slots <= 0) return;
      const now = Date.now();
      for (const [sid, t] of this.restUntil) if (t <= now) this.restUntil.delete(sid);
      const busy = [...new Set([...this.busy, ...this.restUntil.keys()])].slice(0, 2000); // com worker OU esperando o ritmo: não ocupam vaga
      const picks: { session_id: string }[] = await this.prisma.$queryRaw`
        SELECT o.session_id, MIN(o.run_at) AS first_run
        FROM whatsapp_outbox o LEFT JOIN whatsapp_sessions s ON s.id = o.session_id
        WHERE o.status = 'pending' AND o.run_at <= ${new Date()} AND (s.id IS NULL OR s.outbox_paused_at IS NULL)
          ${busy.length ? Prisma.sql`AND o.session_id NOT IN (${Prisma.join(busy)})` : Prisma.empty}
        GROUP BY o.session_id ORDER BY first_run LIMIT ${slots}`;
      for (const p of picks) {
        const sid = String(p.session_id);
        if (this.busy.has(sid) || this.busy.size >= MAX_PARALLEL_SESSIONS) continue;
        this.busy.add(sid);
        void this.runSession(sid).catch((e) => this.logger.warn(`outbox número ${sid}: ${e?.message || e}`)).finally(() => this.busy.delete(sid));
      }
    } catch (e: any) { this.logger.debug(`outbox tick: ${e?.message || e}`); } finally { this.ticking = false; }
  }

  /** Reagenda de uma vez as linhas vencidas de um número (desconectado, org sem acesso) — sem contar tentativa. */
  private async holdSession(sessionId: string, runAt: Date, reason: string) {
    await this.prisma.whatsapp_outbox.updateMany({ where: { session_id: sessionId, status: 'pending', run_at: { lte: new Date() } }, data: { run_at: runAt, last_error: reason.slice(0, 255) } });
  }

  /**
   * Worker de UM número: envia as linhas vencidas dele em ordem, no ritmo (espera o intervalo entre uma e outra), por até
   * `WORKER_BUDGET_MS`. Lê em lotes de 20 (uma ordenação por lote). Para cedo quando o número não pode enviar.
   */
  private async runSession(sessionId: string) {
    const deadline = Date.now() + WORKER_BUDGET_MS;
    for (;;) {
      if (Date.now() >= deadline) return;
      const rows = await this.prisma.whatsapp_outbox.findMany({ where: { session_id: sessionId, status: 'pending', run_at: { lte: new Date() } }, orderBy: [{ run_at: 'asc' }, { created_at: 'asc' }], take: WORKER_BATCH });
      if (!rows.length) return;
      const orgId = rows[0].organization_id;
      const info = await this.orgInfo(orgId);
      if (!info.active) { await this.holdSession(sessionId, new Date(Date.now() + 3600_000), 'Organização sem acesso ativo'); return; }
      const session = await this.sessions.rowById(orgId, sessionId);
      if (!session) {
        const r = await this.prisma.whatsapp_outbox.updateMany({ where: { session_id: sessionId, status: 'pending' }, data: { status: 'failed', last_error: 'Número não existe mais', run_at: new Date() } });
        if (r.count) this.scheduleEmit(orgId);
        return;
      }
      if (session.outbox_paused_at) { this.sessionCache.set(sessionId, { at: Date.now(), paused: true, perMinute: session.outbox_per_minute ?? null }); return; }
      if (!session.openwa_session_id || session.status !== 'ready') { await this.holdSession(sessionId, new Date(Date.now() + 5 * 60_000), 'Número desconectado'); this.scheduleEmit(orgId); return; }
      // conteúdo velho (cobrança paga/PIX trocado, agendamento cancelado) sai da fila antes de esperar o ritmo
      const stale = await this.staleReasons(rows);
      for (const [id, why] of stale) await this.prisma.whatsapp_outbox.updateMany({ where: { id, status: 'pending' }, data: { status: 'canceled', last_error: why.slice(0, 255) } });
      if (stale.size) this.scheduleEmit(orgId);
      for (const row of rows) {
        if (stale.has(row.id)) continue;
        const sinfo = await this.sessionInfo(orgId, sessionId);
        if (sinfo.paused) return;
        const perMinute = sinfo.perMinute ?? info.perMinute;
        const wait = this.rateWait(sessionId, perMinute);
        if (wait > 0) {
          if (Date.now() + wait > deadline) { this.restUntil.set(sessionId, Date.now() + wait - 500); return; } // o tique relança só quando der
          await sleep(wait);
        }
        const r = await this.processOne(row, session).catch((e) => { this.logger.warn(`outbox ${row.id}: ${e?.message || e}`); return 'skip' as const; });
        if (r === 'stop') return;
      }
      if (rows.length < WORKER_BATCH) return;
    }
  }

  private async reschedule(id: string, runAt: Date, error: string | null, attempts?: number, payload?: OutboxPayload) {
    await this.prisma.whatsapp_outbox.updateMany({ where: { id, status: 'sending' }, data: { status: 'pending', run_at: runAt, last_error: error ? error.slice(0, 255) : null, ...(attempts !== undefined ? { attempts } : {}), ...(payload ? { payload: payload as any } : {}) } });
  }

  /**
   * C-H3: por que estas linhas NÃO devem mais sair (id → motivo). Cobrança: precisa estar PENDING e, quando o aviso leva
   * o PIX, com o MESMO código (e o mesmo valor, quando guardado). Agendamento: os avisos de `APPT_ALIVE` só saem com ele
   * ainda marcado. Payload sem mensagens (apagado por LGPD) também não sai.
   */
  async staleReasons(rows: any[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (!rows.length) return out;
    const chargeOf = (r: any) => { const p: any = r.payload || {}; return String(p.charge?.id || p.mark?.charge || '') || null; };
    const apptOf = (r: any) => { const p: any = r.payload || {}; return APPT_ALIVE[r.kind] && p.mark?.appointment ? String(p.mark.appointment) : null; };
    const chargeIds = [...new Set(rows.map(chargeOf).filter(Boolean))] as string[];
    const apptIds = [...new Set(rows.map(apptOf).filter(Boolean))] as string[];
    const [charges, appts] = await Promise.all([
      chargeIds.length ? this.prisma.whatsapp_charges.findMany({ where: { id: { in: chargeIds } }, select: { id: true, status: true, pix_code: true, amount_cents: true } }) : Promise.resolve([] as any[]),
      apptIds.length ? this.prisma.whatsapp_appointments.findMany({ where: { id: { in: apptIds } }, select: { id: true, status: true } }) : Promise.resolve([] as any[]),
    ]);
    const cmap = new Map(charges.map((c: any) => [c.id, c] as [string, any]));
    const amap = new Map(appts.map((a: any) => [a.id, a] as [string, any]));
    for (const r of rows) {
      const p: any = r.payload || {};
      const msgs: any[] = Array.isArray(p.messages) ? p.messages : [];
      if (p.redacted || (!msgs.length && !p.text && !p.media_id)) { out.set(r.id, 'Sem conteúdo para enviar'); continue; }
      const cid = chargeOf(r);
      if (cid) {
        const c = cmap.get(cid);
        if (!c) { out.set(r.id, 'A cobrança não existe mais'); continue; }
        if (c.status !== 'PENDING') { out.set(r.id, `A cobrança não está mais em aberto (${CHARGE_STATUS_LABEL[c.status] || String(c.status).toLowerCase()})`); continue; }
        const cur = String(c.pix_code || '').trim();
        if (p.charge && 'pix' in p.charge) {
          if (String(p.charge.pix || '').trim() !== cur) { out.set(r.id, 'O PIX desta cobrança mudou (2ª via ou troca de meio)'); continue; }
        } else {
          // linha antiga (sem o código guardado): procura o copia-e-cola entre as mensagens
          const emv = msgs.map((m) => String(m?.text || '').trim()).find((t) => EMV_RE.test(t));
          if (emv && emv !== cur) { out.set(r.id, 'O PIX desta cobrança mudou (2ª via ou troca de meio)'); continue; }
        }
        if (p.charge && p.charge.amount_cents != null && Number.isFinite(Number(p.charge.amount_cents)) && Number(p.charge.amount_cents) !== Number(c.amount_cents)) { out.set(r.id, 'O valor da cobrança mudou'); continue; }
      }
      const aid = apptOf(r);
      if (aid) {
        const a = amap.get(aid);
        if (!a) { out.set(r.id, 'O agendamento não existe mais'); continue; }
        if (!APPT_ALIVE[r.kind].includes(a.status)) { out.set(r.id, `O agendamento mudou de situação (${a.status})`); continue; }
      }
    }
    return out;
  }

  /**
   * Envia UMA linha pelo número (já conferido: existe, conectado, não pausado). 'stop' = o número não deve continuar nesta
   * rodada (pausado no meio, aquecimento do dia esgotado); 'skip' = linha não saiu (mudou de situação/falhou), segue para a próxima.
   */
  private async processOne(row: any, session: any): Promise<'sent' | 'skip' | 'stop'> {
    const prevRunAt = row.run_at;
    const claim = await this.prisma.whatsapp_outbox.updateMany({ where: { id: row.id, status: 'pending' }, data: { status: 'sending', run_at: new Date() } }); // run_at = início do envio (recuperação de travados)
    if (!claim.count) return 'skip';
    const fresh = await this.prisma.whatsapp_sessions.findFirst({ where: { id: row.session_id }, select: { outbox_paused_at: true, outbox_per_minute: true } }).catch(() => null);
    if (fresh?.outbox_paused_at) { // pausado entre a leitura e o claim: devolve sem contar tentativa nem mexer no erro
      this.sessionCache.set(row.session_id, { at: Date.now(), paused: true, perMinute: fresh.outbox_per_minute ?? null });
      await this.prisma.whatsapp_outbox.updateMany({ where: { id: row.id, status: 'sending' }, data: { status: 'pending', run_at: prevRunAt } });
      return 'stop';
    }
    const pace = await this.pacing.canSend(session, row.chat_id).catch(() => ({ ok: true as const }));
    if (!pace.ok) {
      const why = String((pace as any).reason || 'Aquecimento');
      await this.reschedule(row.id, WhatsAppOutboxService.tomorrow9BRT(), why);
      if (!/Limite do dia/.test(why)) return 'skip'; // limite de frios: só os contatos frios esperam; os outros seguem
      // limite do dia do número: todas as conversas individuais vencidas dele vão para amanhã 9h de uma vez
      await this.prisma.whatsapp_outbox.updateMany({ where: { session_id: row.session_id, status: 'pending', run_at: { lte: new Date() }, chat_id: { endsWith: '@c.us' } }, data: { run_at: WhatsAppOutboxService.tomorrow9BRT(), last_error: why.slice(0, 255) } });
      this.scheduleEmit(row.organization_id);
      return 'stop';
    }
    const payload: OutboxPayload = (row.payload as any) || { messages: [] };
    const extra = { system: true, outbox: row.kind, ...(payload.mark || {}) };
    const startAt = Math.max(0, Math.round(Number(payload.sent_index) || 0)); // mensagens já enviadas numa tentativa anterior
    let sent = startAt;
    const t0 = Date.now();
    try {
      for (const [idx, m] of (payload.messages || []).entries()) {
        if (idx < startAt) continue;
        if (idx > startAt) await sleep(400);
        await this.sendNow(row.organization_id, session, row.chat_id, { kind: (m.kind as any) || (m.media_id ? 'image' : 'text'), text: m.text, mediaId: m.media_id }, extra);
        sent = idx + 1;
      }
      this.noteSend(row.session_id, t0, Date.now() - t0);
      this.pacing.noteSent(row.session_id, Boolean((pace as any).cold));
      await this.prisma.whatsapp_outbox.updateMany({ where: { id: row.id }, data: { status: 'sent', sent_at: new Date(), last_error: null } });
      if (payload.charge?.id) await this.markChargeSent(payload.charge.id, payload.charge.which).catch(() => undefined);
      this.hooks.emit('outbox_sent', { orgId: row.organization_id, outbox: { ...row, status: 'sent' } });
      this.scheduleEmit(row.organization_id);
      return 'sent';
    } catch (e: any) {
      const attempts = Math.min(MAX_ATTEMPTS_EVER, (row.attempts || 0) + 1);
      const msg = String(e?.message || e);
      const next = sent > startAt ? { ...payload, sent_index: sent } : undefined; // a próxima tentativa continua da mensagem que falhou
      if (sent > startAt) { this.noteSend(row.session_id, t0, Date.now() - t0); this.pacing.noteSent(row.session_id, Boolean((pace as any).cold)); } // o que saiu conta no ritmo
      if (attempts >= OUTBOX_MAX_ATTEMPTS) { await this.prisma.whatsapp_outbox.updateMany({ where: { id: row.id }, data: { status: 'failed', attempts, last_error: msg.slice(0, 255), run_at: new Date(), ...(next ? { payload: next as any } : {}) } }); this.logger.warn(`outbox ${row.id} falhou ${attempts}x: ${msg}`); }
      else await this.reschedule(row.id, new Date(Date.now() + (attempts === 1 ? 30_000 : 2 * 60_000)), msg, attempts, next);
      this.scheduleEmit(row.organization_id);
      return 'skip';
    }
  }

  /** C-M7: poda (sent/canceled > 15 dias; failed > 30 dias), em lotes — a fila guarda o texto das mensagens em claro. */
  private async prune() {
    let total = 0;
    const sentBefore = new Date(Date.now() - PRUNE_SENT_MS);
    const failedBefore = new Date(Date.now() - PRUNE_FAILED_MS);
    for (let i = 0; i < 200; i++) {
      const n = await this.prisma.$executeRaw`DELETE FROM whatsapp_outbox WHERE status IN ('sent', 'canceled') AND run_at < ${sentBefore} LIMIT ${PRUNE_CHUNK}`;
      total += n;
      if (n < PRUNE_CHUNK) break;
      await sleep(200);
    }
    for (let i = 0; i < 200; i++) {
      const n = await this.prisma.$executeRaw`DELETE FROM whatsapp_outbox WHERE status = 'failed' AND run_at < ${failedBefore} LIMIT ${PRUNE_CHUNK}`;
      total += n;
      if (n < PRUNE_CHUNK) break;
      await sleep(200);
    }
    if (total) this.logger.log(`outbox: ${total} envio(s) antigos apagados da fila`);
    return total;
  }

  /** Depois de sair pela fila: cobrança ganha `sent_at` e o lembrete entra no histórico (`reminders`). */
  private async markChargeSent(chargeId: string, which: string) {
    const c = await this.prisma.whatsapp_charges.findUnique({ where: { id: chargeId }, select: { reminders: true, sent_at: true } });
    if (!c) return;
    const reminders = Array.isArray(c.reminders) ? [...(c.reminders as any[])] : [];
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    if (which && which !== 'charge') reminders.push({ kind: which, at: new Date().toISOString(), day });
    // `sent_at` = 1º envio da cobrança (lembrete não sobrescreve)
    await this.prisma.whatsapp_charges.update({ where: { id: chargeId }, data: { ...(c.sent_at && which !== 'charge' ? {} : { sent_at: new Date() }), reminders } });
  }

  // ---------------------------------------------------------------- pausa / ritmo por número (Fase 8, §12.1)
  /** Pausa + ritmo do número (cache 15 s; as ações do painel invalidam). Número inexistente = não pausado. */
  private async sessionInfo(orgId: string, sessionId: string) {
    const c = this.sessionCache.get(sessionId);
    if (c && Date.now() - c.at < SESSION_CACHE_MS) return c;
    const r = await this.prisma.whatsapp_sessions.findFirst({ where: { id: sessionId, organization_id: orgId }, select: { outbox_paused_at: true, outbox_per_minute: true } }).catch(() => null);
    const v = { at: Date.now(), paused: Boolean(r?.outbox_paused_at), perMinute: r?.outbox_per_minute ?? null };
    this.sessionCache.set(sessionId, v);
    return v;
  }

  private async onRestricted(e: any) {
    const orgId = String(e?.orgId || e?.row?.organization_id || '');
    const sessionId = String(e?.row?.id || '');
    if (!orgId || !sessionId) return;
    try {
      const r = await this.prisma.whatsapp_sessions.updateMany({ where: { id: sessionId, organization_id: orgId, outbox_paused_at: null }, data: { outbox_paused_at: new Date(), outbox_pause_reason: OUTBOX_RESTRICTED_REASON } });
      this.sessionCache.delete(sessionId);
      if (r.count) { this.logger.warn(`outbox: número ${sessionId} pausado (restrição do WhatsApp)`); this.scheduleEmit(orgId, true); }
    } catch (err: any) { this.logger.warn(`outbox: pausar número restrito ${sessionId}: ${err?.message || err}`); }
  }

  private async sessionOrFail(orgId: string, sessionId: string) {
    const row = await this.prisma.whatsapp_sessions.findFirst({ where: { id: String(sessionId || ''), organization_id: orgId }, select: { id: true } });
    if (!row) throw new NotFoundException('Número não encontrado.');
    return row;
  }

  /** Pausa manual (o motivo padrão é "Pausado manualmente"). Já pausado = mantém a data, troca o motivo se veio um. */
  async pauseSession(orgId: string, sessionId: string, reason?: string | null) {
    await this.sessionOrFail(orgId, sessionId);
    const cur = await this.prisma.whatsapp_sessions.findUnique({ where: { id: sessionId }, select: { outbox_paused_at: true, outbox_pause_reason: true } });
    const why = String(reason || '').trim().slice(0, 255) || (cur?.outbox_paused_at ? cur.outbox_pause_reason : null) || 'Pausado manualmente';
    await this.prisma.whatsapp_sessions.update({ where: { id: sessionId }, data: { outbox_paused_at: cur?.outbox_paused_at || new Date(), outbox_pause_reason: why } });
    this.sessionCache.delete(sessionId);
    this.scheduleEmit(orgId, true);
    return this.sessionSummary(orgId, sessionId);
  }

  /** Retomar = limpa pausa e motivo; o que estava pendente volta a sair no ritmo. */
  async resumeSession(orgId: string, sessionId: string) {
    await this.sessionOrFail(orgId, sessionId);
    await this.prisma.whatsapp_sessions.update({ where: { id: sessionId }, data: { outbox_paused_at: null, outbox_pause_reason: null } });
    this.sessionCache.delete(sessionId);
    this.scheduleEmit(orgId, true);
    return this.sessionSummary(orgId, sessionId);
  }

  /** Ritmo do número (1–60 por minuto); null = volta ao da organização. */
  async setSessionRate(orgId: string, sessionId: string, perMinute: number | null | undefined) {
    await this.sessionOrFail(orgId, sessionId);
    const v = perMinute === null || perMinute === undefined || (perMinute as any) === '' ? null : Math.round(Number(perMinute));
    if (v !== null && (!Number.isFinite(v) || v < 1 || v > OUTBOX_SESSION_RATE_MAX)) throw new BadRequestException(`O ritmo do número vai de 1 a ${OUTBOX_SESSION_RATE_MAX} mensagens por minuto.`);
    await this.prisma.whatsapp_sessions.update({ where: { id: sessionId }, data: { outbox_per_minute: v } });
    this.sessionCache.delete(sessionId);
    this.scheduleEmit(orgId, true);
    return this.sessionSummary(orgId, sessionId);
  }

  /** Ritmo da organização (`charge.outbox_per_minute`, 1–120) — as outras configurações de cobrança ficam intactas. */
  async setOrgRate(orgId: string, perMinute: number) {
    const v = Math.round(Number(perMinute));
    if (!Number.isFinite(v) || v < 1 || v > OUTBOX_ORG_RATE_MAX) throw new BadRequestException(`O ritmo vai de 1 a ${OUTBOX_ORG_RATE_MAX} mensagens por minuto, por número.`);
    const row = await this.prisma.whatsapp_crm_settings.findUnique({ where: { organization_id: orgId }, select: { charge: true } });
    const raw = row?.charge && typeof row.charge === 'object' ? (row.charge as any) : {};
    const next = mergeChargeSettings(normalizeChargeSettings(raw), { outbox_per_minute: v });
    const charge = { ...raw, ...next };
    await this.prisma.whatsapp_crm_settings.upsert({ where: { organization_id: orgId }, create: { organization_id: orgId, charge: charge as any }, update: { charge: charge as any } });
    this.orgCache.delete(orgId);
    this.scheduleEmit(orgId, true);
    return this.summary(orgId, null);
  }

  // ---------------------------------------------------------------- painel: resumo
  private sessionWhere(allowed: Set<string> | null | undefined, sessionId?: string | null): any {
    if (sessionId) {
      if (allowed && !allowed.has(String(sessionId))) return { session_id: '__none__' };
      return { session_id: String(sessionId) };
    }
    if (!allowed) return {};
    return { session_id: { in: [...allowed] } };
  }

  /**
   * Totais da org (só dos números que o usuário vê) + por número: pendentes, enviando, falhas e enviadas nas
   * últimas 24 h, próximo envio, ritmo efetivo e previsão para esvaziar (pendentes ÷ ritmo; null se pausado/desconectado).
   */
  async summary(orgId: string, allowed: Set<string> | null = null) {
    const since = new Date(Date.now() - 24 * 3600_000);
    const window = new Date(Date.now() - SUMMARY_WINDOW_MS);
    const sw = this.sessionWhere(allowed);
    const [sessions, liveStatus, doneStatus, bySession, failed24, sent24, nextRun, info] = await Promise.all([
      this.prisma.whatsapp_sessions.findMany({
        where: { organization_id: orgId, ...(allowed ? { id: { in: [...allowed] } } : {}) },
        orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
        select: { id: true, organization_id: true, label: true, color: true, phone: true, status: true, openwa_session_id: true, outbox_paused_at: true, outbox_pause_reason: true, outbox_per_minute: true, paired_at: true, pacing_enabled: true },
      }),
      this.prisma.whatsapp_outbox.groupBy({ by: ['status'], where: { organization_id: orgId, ...sw, status: { in: ['pending', 'sending'] } }, _count: { _all: true } }),
      // enviadas/falhas/canceladas: só a janela recente (a fila é podada — C-M7)
      this.prisma.whatsapp_outbox.groupBy({ by: ['status'], where: { organization_id: orgId, ...sw, status: { in: ['sent', 'failed', 'canceled'] }, created_at: { gte: window } }, _count: { _all: true } }),
      this.prisma.whatsapp_outbox.groupBy({ by: ['session_id', 'status'], where: { organization_id: orgId, ...sw, status: { in: ['pending', 'sending'] } }, _count: { _all: true } }),
      this.prisma.whatsapp_outbox.groupBy({ by: ['session_id'], where: { organization_id: orgId, ...sw, status: 'failed', run_at: { gte: since } }, _count: { _all: true } }),
      this.prisma.whatsapp_outbox.groupBy({ by: ['session_id'], where: { organization_id: orgId, ...sw, status: 'sent', sent_at: { gte: since } }, _count: { _all: true } }),
      this.prisma.whatsapp_outbox.groupBy({ by: ['session_id'], where: { organization_id: orgId, ...sw, status: 'pending' }, _min: { run_at: true } }),
      this.orgInfo(orgId),
    ]);
    const totals: Record<string, number> = { pending: 0, sending: 0, sent: 0, failed: 0, canceled: 0 };
    for (const g of [...liveStatus, ...doneStatus]) totals[g.status] = (totals[g.status] || 0) + g._count._all;
    const live = new Map<string, { pending: number; sending: number }>();
    for (const g of bySession) {
      const v = live.get(g.session_id) || { pending: 0, sending: 0 };
      if (g.status === 'pending') v.pending += g._count._all; else v.sending += g._count._all;
      live.set(g.session_id, v);
    }
    const f24 = new Map(failed24.map((g) => [g.session_id, g._count._all] as const));
    const s24 = new Map(sent24.map((g) => [g.session_id, g._count._all] as const));
    const next = new Map(nextRun.map((g) => [g.session_id, g._min?.run_at ?? null] as const));
    const orgPerMinute = info.perMinute;
    // aquecimento do dia (só de quem tem fila e está conectado)
    const pacingOf = new Map<string, { remaining: number; daily_limit: number; enabled: boolean }>();
    await Promise.all(sessions.filter((s) => (live.get(s.id)?.pending || 0) > 0 && s.openwa_session_id && s.status === 'ready').map(async (s) => {
      const p = await this.pacing.summary(s as any).catch(() => null);
      if (p) pacingOf.set(s.id, { remaining: p.remaining, daily_limit: p.daily_limit, enabled: p.pacing_enabled });
    }));
    const by_session = sessions.map((s) => {
      const connected = Boolean(s.openwa_session_id) && s.status === 'ready';
      const effective = s.outbox_per_minute ?? orgPerMinute;
      const pend = live.get(s.id)?.pending || 0;
      const paused = Boolean(s.outbox_paused_at);
      // vazão de verdade: o ritmo configurado OU o que o número consegue (envios lentos/várias mensagens por aviso), o menor
      const avgMs = this.sendMs.get(s.id) || 0;
      const rate = Math.max(0.1, Math.min(effective, avgMs ? 60_000 / avgMs : effective));
      let eta: number | null = pend ? null : 0;
      let note: string | null = null;
      if (pend && !paused && connected) {
        const pc = pacingOf.get(s.id);
        if (pc && pc.enabled && pc.remaining < pend) {
          const rest = pend - pc.remaining;
          const until9 = Math.max(0, (WhatsAppOutboxService.tomorrow9BRT().getTime() - Date.now()) / 60_000);
          eta = Math.ceil(until9 + rest / rate);
          note = pc.remaining ? `Aquecimento do número: hoje saem só mais ${pc.remaining}; o resto (${rest}) a partir de amanhã 9h.` : `Aquecimento do número: limite de hoje (${pc.daily_limit}) atingido; a fila volta amanhã 9h.`;
        } else eta = Math.ceil(pend / rate);
      }
      return {
        session_id: s.id,
        label: sessionLabel(s),
        color: s.color || null,
        phone: s.phone || null,
        status: s.openwa_session_id ? s.status : 'none',
        connected,
        paused_at: s.outbox_paused_at,
        pause_reason: s.outbox_pause_reason || null,
        per_minute: s.outbox_per_minute ?? null,
        effective_per_minute: effective,
        real_per_minute: Math.round(rate * 10) / 10,
        pending: pend,
        sending: live.get(s.id)?.sending || 0,
        failed_24h: f24.get(s.id) || 0,
        sent_24h: s24.get(s.id) || 0,
        next_run_at: next.get(s.id) || null,
        eta_minutes: eta,
        eta_note: note,
      };
    });
    return { totals, totals_window_days: Math.round(SUMMARY_WINDOW_MS / 86_400_000), by_session, org_per_minute: orgPerMinute, limits: { session_max: OUTBOX_SESSION_RATE_MAX, org_max: OUTBOX_ORG_RATE_MAX }, at: new Date().toISOString() };
  }

  private async sessionSummary(orgId: string, sessionId: string) {
    const s = await this.summary(orgId, new Set([sessionId]));
    return s.by_session[0] || null;
  }

  // ---------------------------------------------------------------- painel: lista
  /** Lista paginada (filtros: status, número, tipo/grupo, busca por nome/telefone). Pendentes = próximos primeiro. */
  async list(orgId: string, allowed: Set<string> | null, q: { status?: string; session_id?: string; kind?: string; q?: string; page?: any; page_size?: any } = {}) {
    const page = Math.max(1, Math.floor(Number(q.page) || 1));
    const pageSize = Math.min(100, Math.max(5, Math.floor(Number(q.page_size) || 25)));
    const status = OUTBOX_STATUSES.includes(String(q.status || '') as any) ? String(q.status) : '';
    const where: any = { organization_id: orgId, ...this.sessionWhere(allowed, q.session_id || null) };
    if (status) where.status = status;
    const kw = outboxKindWhere(q.kind);
    if (kw) where.kind = kw;
    const term = String(q.q || '').trim().slice(0, 80);
    if (term) {
      const digits = term.replace(/\D/g, '');
      if (digits.length >= 4 && digits.length >= term.replace(/[\s()+\-.]/g, '').length) where.chat_id = { contains: digits };
      else {
        const [contacts, chats] = await Promise.all([
          this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, OR: [{ name: { contains: term } }, { push_name: { contains: term } }] }, select: { wa_id: true, lid: true, phone: true }, take: 300 }),
          this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, kind: 'individual', name: { contains: term } }, select: { chat_id: true }, take: 300 }),
        ]);
        const jids = new Set<string>(chats.map((c) => c.chat_id));
        for (const c of contacts) for (const j of this.contactJids(c)) jids.add(j);
        if (!jids.size) return { items: [], total: 0, page, page_size: pageSize, pages: 0, kind_groups: OUTBOX_KIND_GROUPS };
        where.chat_id = { in: [...jids].slice(0, 1000) };
      }
    }
    const orderBy: any = status === 'pending' || status === 'sending' ? [{ run_at: 'asc' }, { created_at: 'asc' }] : [{ created_at: 'desc' }];
    const [total, rows] = await Promise.all([
      this.prisma.whatsapp_outbox.count({ where }),
      this.prisma.whatsapp_outbox.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    const items = await this.shapeRows(orgId, rows);
    return { items, total, page, page_size: pageSize, pages: Math.ceil(total / pageSize), kind_groups: OUTBOX_KIND_GROUPS };
  }

  private async shapeRows(orgId: string, rows: any[]) {
    if (!rows.length) return [];
    const jids = [...new Set(rows.map((r) => r.chat_id))];
    const phones = [...new Set(jids.filter((j) => /@(c\.us|s\.whatsapp\.net)$/.test(j)).map((j) => j.split('@')[0]))];
    const sessionIds = [...new Set(rows.map((r) => r.session_id))];
    const [chats, contacts, sessions] = await Promise.all([
      this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, chat_id: { in: jids }, session_id: { in: sessionIds } }, select: { id: true, session_id: true, chat_id: true, name: true } }),
      this.prisma.whatsapp_contacts.findMany({ where: { organization_id: orgId, OR: [{ wa_id: { in: jids } }, { lid: { in: jids } }, ...(phones.length ? [{ phone: { in: phones } }] : [])] }, select: { id: true, wa_id: true, lid: true, phone: true, name: true, push_name: true } }),
      this.prisma.whatsapp_sessions.findMany({ where: { organization_id: orgId, id: { in: sessionIds } }, select: { id: true, label: true, color: true, phone: true, status: true, openwa_session_id: true } }),
    ]);
    const chatBy = new Map(chats.map((c) => [`${c.session_id}|${c.chat_id}`, c] as const));
    const contactBy = new Map<string, any>();
    for (const c of contacts) for (const j of this.contactJids(c)) if (!contactBy.has(j)) contactBy.set(j, c);
    const sessBy = new Map(sessions.map((s) => [s.id, s] as const));
    return rows.map((r) => {
      const chat = chatBy.get(`${r.session_id}|${r.chat_id}`);
      const contact = contactBy.get(r.chat_id);
      const s = sessBy.get(r.session_id);
      const jidPhone = /@(c\.us|s\.whatsapp\.net)$/.test(r.chat_id) ? r.chat_id.split('@')[0] : null;
      const payload: any = r.payload || {};
      const msgs = Array.isArray(payload.messages) ? payload.messages : [];
      return {
        id: r.id,
        kind: r.kind,
        kind_label: outboxKindLabel(r.kind),
        kind_group: outboxKindGroup(r.kind),
        session_id: r.session_id,
        session: s ? { id: s.id, label: sessionLabel(s), color: s.color || null, phone: s.phone || null, status: s.openwa_session_id ? s.status : 'none', connected: Boolean(s.openwa_session_id) && s.status === 'ready' } : null,
        chat_id: chat?.id || null, // uuid da conversa (link para o chat), quando existe
        jid: r.chat_id,
        destination: { name: contact?.name || chat?.name || contact?.push_name || null, phone: contact?.phone || jidPhone || null },
        preview: outboxPreview(payload),
        messages_count: msgs.length,
        sent_index: Number(payload.sent_index) || 0,
        status: r.status,
        attempts: r.attempts,
        last_error: r.last_error || null,
        run_at: r.run_at,
        sent_at: r.sent_at,
        created_at: r.created_at,
      };
    });
  }

  // ---------------------------------------------------------------- painel: ações
  private async rowOrFail(orgId: string, id: string, allowed: Set<string> | null) {
    const row = await this.prisma.whatsapp_outbox.findFirst({ where: { id: String(id || ''), organization_id: orgId } });
    if (!row || (allowed && !allowed.has(row.session_id))) throw new NotFoundException('Envio não encontrado.');
    return row;
  }

  /** Falha/cancelado → pendente agora (tentativas zeradas; se parou no meio, continua da mensagem que faltou). */
  async retry(orgId: string, id: string, allowed: Set<string> | null) {
    const row = await this.rowOrFail(orgId, id, allowed);
    if (row.status !== 'failed' && row.status !== 'canceled') throw new BadRequestException('Só envios com falha ou cancelados podem ser enviados de novo.');
    // C-H3: cobrança paga/PIX trocado/agendamento cancelado → não reenvia conteúdo velho
    const why = (await this.staleReasons([row])).get(row.id);
    if (why) {
      if (row.status === 'failed') await this.prisma.whatsapp_outbox.updateMany({ where: { id: row.id, status: 'failed' }, data: { status: 'canceled', last_error: why.slice(0, 255) } });
      this.scheduleEmit(orgId, true);
      throw new BadRequestException(`Não dá para enviar de novo: ${why.charAt(0).toLowerCase()}${why.slice(1)}.`);
    }
    const r = await this.prisma.whatsapp_outbox.updateMany({ where: { id: row.id, status: row.status }, data: { status: 'pending', attempts: 0, run_at: new Date(), last_error: null, created_at: new Date() } });
    if (!r.count) throw new BadRequestException('O envio mudou de situação; atualize a lista.');
    this.scheduleEmit(orgId, true);
    return (await this.shapeRows(orgId, [await this.prisma.whatsapp_outbox.findUnique({ where: { id: row.id } })]))[0];
  }

  /** Pendente → cancelado (o que já está saindo não para). */
  async cancel(orgId: string, id: string, allowed: Set<string> | null) {
    const row = await this.rowOrFail(orgId, id, allowed);
    if (row.status !== 'pending') throw new BadRequestException(row.status === 'sending' ? 'Esse envio já está saindo e não pode ser cancelado.' : 'Só envios pendentes podem ser cancelados.');
    const r = await this.prisma.whatsapp_outbox.updateMany({ where: { id: row.id, status: 'pending' }, data: { status: 'canceled' } });
    if (!r.count) throw new BadRequestException('O envio mudou de situação; atualize a lista.');
    this.scheduleEmit(orgId, true);
    return (await this.shapeRows(orgId, [await this.prisma.whatsapp_outbox.findUnique({ where: { id: row.id } })]))[0];
  }

  /** Em massa: falhas das últimas 72 h (máx. 5.000, as mais recentes) voltam para a fila. */
  async retryFailed(orgId: string, allowed: Set<string> | null, sessionId?: string | null) {
    const rows = await this.prisma.whatsapp_outbox.findMany({ where: { organization_id: orgId, ...this.sessionWhere(allowed, sessionId), status: 'failed', run_at: { gte: new Date(Date.now() - RETRY_WINDOW_MS) } }, orderBy: { run_at: 'desc' }, take: BULK_MAX, select: { id: true, kind: true, payload: true } });
    if (!rows.length) return { count: 0, canceled: 0 };
    let count = 0, canceled = 0;
    const now = new Date();
    for (let i = 0; i < rows.length; i += 1000) {
      const part = rows.slice(i, i + 1000);
      // C-H3: as que perderam o sentido (cobrança paga, PIX trocado, agendamento cancelado) viram canceladas com o motivo
      const stale = await this.staleReasons(part);
      for (const [id, why] of stale) { const u = await this.prisma.whatsapp_outbox.updateMany({ where: { id, status: 'failed' }, data: { status: 'canceled', last_error: why.slice(0, 255) } }); canceled += u.count; }
      const ok = part.filter((x) => !stale.has(x.id)).map((x) => x.id);
      if (!ok.length) continue;
      const r = await this.prisma.whatsapp_outbox.updateMany({ where: { id: { in: ok }, status: 'failed' }, data: { status: 'pending', attempts: 0, run_at: now, last_error: null, created_at: now } });
      count += r.count;
    }
    this.logger.log(`outbox: ${count} falha(s) voltaram para a fila${canceled ? `, ${canceled} cancelada(s) por conteúdo desatualizado` : ''} (org ${orgId})`);
    this.scheduleEmit(orgId, true);
    return { count, canceled };
  }

  /** Em massa: cancela pendentes (de um número e/ou de um tipo/grupo). */
  async cancelPendingBulk(orgId: string, allowed: Set<string> | null, opts: { session_id?: string | null; kind?: string | null } = {}) {
    const where: any = { organization_id: orgId, ...this.sessionWhere(allowed, opts.session_id || null), status: 'pending' };
    const kw = outboxKindWhere(opts.kind);
    if (kw) where.kind = kw;
    const r = await this.prisma.whatsapp_outbox.updateMany({ where, data: { status: 'canceled' } });
    if (r.count) this.logger.log(`outbox: ${r.count} pendente(s) cancelado(s) (org ${orgId})`);
    this.scheduleEmit(orgId, true);
    return { count: r.count };
  }

  // ---------------------------------------------------------------- tempo real
  /**
   * `wa:outbox` (sala da org) com o resumo, agrupado em 2 s. O worker só agenda quando há alguém do módulo
   * conectado (`force` = ações do painel e pausa automática, que agendam sempre).
   */
  private scheduleEmit(orgId: string, force = false) {
    if (!orgId || this.emitTimers.has(orgId)) return;
    if (!force && !this.presenter.watching(orgId)) return;
    const t = setTimeout(() => {
      this.emitTimers.delete(orgId);
      if (!this.presenter.watching(orgId)) return;
      this.summary(orgId, null)
        .then((s) => this.presenter.emit(orgId, 'wa:outbox', s))
        .catch((e) => this.logger.debug(`wa:outbox ${orgId}: ${e?.message || e}`));
    }, EMIT_DEBOUNCE_MS);
    t.unref?.();
    this.emitTimers.set(orgId, t);
  }
}
