import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from 'generated/prisma/client';
import { AccessService } from '../platform-billing/access.service';
import { asaasFindByReference, createBoletoCharge, createCardCharge, createPixCharge, getChargeStatus } from '../payments/pix-providers';
import { asaasDetails, asaasList } from '../payments/providers/asaas';
import { Gateway, cancelChargeRemote, crmProvidersOf, gatewayFor, publicApiUrl, resolveGateways, tokenFor, webhookUrlFor } from '../payments/gateways.util';
import { WhatsAppMediaService } from './whatsapp-media.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { WhatsAppHooks } from './whatsapp-hooks.service';
import { ChatKey, WhatsAppAttendanceService } from './whatsapp-attendance.service';
import { WhatsAppSessionsService } from './whatsapp-sessions.service';
import { WhatsAppCrmService } from './whatsapp-crm.service';
import { WhatsAppPipelineService } from './whatsapp-pipeline.service';
import { WhatsAppOutboxService } from './whatsapp-outbox.service';
import { WhatsAppSubscriptionsService, brtDateStr, dateOnlyUTC } from './whatsapp-subscriptions.service';
import { WhatsAppCustomFieldsService } from './whatsapp-custom-fields.service';
import { fillCrmVars, formatBRL } from './wa-crm-vars.util';
import { ChargeSettings, DEFAULT_CHARGE_SETTINGS, mergeChargeSettings, normalizeChargeSettings, normalizeReminderRules } from './wa-charge-settings.util';
import { daysBetween, penaltyBreakdown, toDateStr as mathDateStr } from './wa-subscription-math.util';
import { isGroupJid, jidFromPhone, phoneFromJid } from './wa-jid.util';

// ============================================================================
// Cobranças pelo WhatsApp (CRM, fase 2)
//
//  - Uma cobrança = valor + descrição + vencimento para um CLIENTE, paga por PIX
//    (copia-e-cola + QR, validade longa) e/ou BOLETO (só Mercado Pago).
//  - Origem: manual (botão "Cobrar" na conversa / tela Cobranças), recorrente
//    (gerada N dias antes do vencimento da assinatura) ou bot.
//  - Confirmação: webhook único /payments/webhook/:provider (reconfere no gateway),
//    runner a cada 5 min e botão "Verificar". Pagou → recibo, assinatura avança o
//    vencimento, etiqueta "Inadimplente" sai.
//  - Régua: lembretes antes / no dia / depois do vencimento (textos editáveis),
//    param ao pagar; D+1 marca a assinatura em atraso e aplica a etiqueta.
//  - Atenção Mercado Pago: PIX pago depois de vencido vira estorno pro pagador →
//    a validade do PIX = vencimento + `pix_days` (padrão 7) e EXPIRED para tudo.
//  - Fase 3 (assinaturas): 2ª via com multa + juros (`amountWithPenalty`, recria o PIX/boleto
//    no gateway quando o valor mudou), carência por produto antes de `overdue`, régua por produto,
//    `bot_flow_id/bot_node_id` para a entrega tardia do bot, hooks `charge_expired`/`charge_canceled`,
//    e TODO envio do runner diário (recorrentes, lembretes) vai pela fila `whatsapp_outbox`.
//    A 1ª cobrança de uma assinatura nova (pró-rata/avulsa) é criada pelo hook
//    `subscription_first_charge` (na hora) e pelo runner (rede de segurança, `custom.first_charge`).
//
//  - Fase 4 (gateways): cada MEIO sai pelo gateway escolhido para ele (`gateways.util` → `resolveGateways`) e a
//    cobrança guarda quem gerou cada um (`pix_provider`/`boleto_provider`/`card_provider`) — consulta, 2ª via,
//    cancelamento e liquidação falam com o gateway certo (`cancelChargeRemote`). Cartão (só Asaas): sem cartão
//    salvo = página segura do Asaas (`card_url`); com cartão salvo (`payment_method_id`) = cobrança automática por
//    token no dia do vencimento, novas tentativas em D+2 e D+5 e, recusado de novo, vira PIX. Toda cobrança tem
//    um link público (`pay_link_token` → `{{cobranca.link}}`, página /pay/:token) com PIX, boleto e cartão.
//
// Revisão geral (14/10/2026): `purpose` ('order' | 'appointment', vindo de `dto.__purpose` — interno, nunca do DTO público)
// marca cobrança de pedido/agendamento: fica FORA da régua de lembretes, da etiqueta Inadimplente, do `charge_overdue`,
// de multa/juros na 2ª via e não marca assinatura em atraso; `dto.__expires_minutes` = validade curta do PIX (em vez de
// vencimento + `pix_days`). Cartão salvo só é herdado da assinatura por origem `recurring`/`bot` (C-H1): manual/API só
// debita com `payment_method_id` explícito. 2ª via/reenvio cancelam os avisos da cobrança que estavam na fila (C-H3).
//
// Multi-número: `whatsapp_charges.session_id` = NÚMERO pelo qual a cobrança (e os lembretes,
// o recibo) saem; `chat_id` = jid. Cobrar a partir de uma conversa (uuid) usa o número dela;
// a partir do cliente usa `session_id` informado → conversa mais recente do contato num número
// permitido → qualquer número conectado. Na API a cobrança devolve `chat_id` (uuid), `jid`,
// `session_id` e `session`.
// ============================================================================

export const CHARGE_STATUSES = ['PENDING', 'PAID', 'EXPIRED', 'CANCELED', 'FAILED'] as const;
const DAY = 86_400_000;
const DAILY_BATCH = 500; // rotina diária: lote por cursor (Fase 8)
const REMINDER_CONCURRENCY = 6; // lembretes montados em paralelo na rotina diária (pool do banco = 10)
const OVERDUE_TAG = { name: 'Inadimplente', color: '#EF4444' };
const UUID_RE = /^[0-9a-f-]{36}$/i;
export type { ChargeSettings };
export { DEFAULT_CHARGE_SETTINGS, brtDateStr, dateOnlyUTC };
export type ChargeWhich = 'charge' | 'reminder_before' | 'reminder_due' | 'reminder_after' | 'second_copy' | 'card_declined';
export type ChargeKind = 'pix' | 'boleto' | 'both' | 'card';
const KINDS: ChargeKind[] = ['pix', 'boleto', 'both', 'card'];
const CARD_MAX_ATTEMPTS = 3; // D, D+2, D+5 — depois vira PIX
const MIN_INSTALLMENT_CENTS = 500; // Asaas: parcela mínima R$ 5,00
const onlyDigits = (v: any) => String(v || '').replace(/\D/g, '');
// endereço do painel (o mesmo `APP_PUBLIC_URL` do plugin WordPress; padrão: PUBLIC_API_URL sem o "api.")
const appUrl = () => String(process.env.APP_PUBLIC_URL || publicApiUrl().replace('://api.', '://')).replace(/\/+$/, '');
const UNREADABLE_TOKEN = /^\[conteúdo criptografado|^-$/; // token do cartão ilegível (chave de cripto ausente) ou já removido
/** Nova tentativa do cartão: D+2 e depois D+5 (a partir da recusa), sempre às 09:00 BRT. */
const retryAt09 = (days: number) => new Date(`${brtDateStr(new Date(Date.now() + days * DAY))}T09:00:00-03:00`);
const newPayToken = () => randomBytes(18).toString('base64url');
const safeEqual = (a: string, b: string) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

const toDateStr = (d: Date) => d.toISOString().slice(0, 10);
const fmtBR = (s?: string | null) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
const endOfDayBRT = (dateStr: string) => new Date(`${dateStr}T23:59:59-03:00`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const chatKeyOf = (sessionId: string | null | undefined, jid: string) => `${sessionId || ''}|${jid}`;

@Injectable()
export class WhatsAppChargesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppChargesService.name);
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: WhatsAppMediaService,
    private readonly presenter: WhatsAppPresenter,
    private readonly attendance: WhatsAppAttendanceService,
    private readonly sessions: WhatsAppSessionsService,
    private readonly crm: WhatsAppCrmService,
    private readonly access: AccessService,
    private readonly pipeline: WhatsAppPipelineService,
    private readonly hooks: WhatsAppHooks,
    private readonly outbox: WhatsAppOutboxService,
    private readonly subscriptions: WhatsAppSubscriptionsService,
    private readonly cf: WhatsAppCustomFieldsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), 5 * 60_000);
    // 1ª cobrança de assinatura nova (painel/importação/API): cria e envia na hora, best-effort
    this.hooks.on('subscription_first_charge', async (e: any) => {
      const sub = await this.prisma.whatsapp_subscriptions.findFirst({ where: { id: e?.subscription?.id, organization_id: e?.orgId } });
      if (sub) await this.firstChargeFor(e.orgId, sub, false).catch((err) => this.logger.warn(`1ª cobrança ${sub.id}: ${err?.message || err}`));
    });
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  // ---------------------------------------------------------------- configurações
  async settings(orgId: string): Promise<ChargeSettings & { provider: string | null; gateway_ready: boolean; pix_available: boolean; boleto_available: boolean; card_available: boolean; providers: { pix: string | null; boleto: string | null; card: string | null } }> {
    const [row, gw] = await Promise.all([
      this.prisma.whatsapp_crm_settings.findUnique({ where: { organization_id: orgId } }),
      this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: orgId } }),
    ]);
    const g = resolveGateways(gw);
    return {
      ...normalizeChargeSettings(row?.charge),
      provider: g.principal?.provider || gw?.provider || null,
      gateway_ready: Boolean(g.pix || g.boleto || g.card),
      pix_available: Boolean(g.pix),
      boleto_available: Boolean(g.boleto),
      card_available: Boolean(g.card),
      providers: { pix: g.pix?.provider || null, boleto: g.boleto?.provider || null, card: g.card?.provider || null },
    };
  }

  /** Update PARCIAL (chaves ausentes/`undefined` mantêm o valor; clamps e defaults em `wa-charge-settings.util`). */
  async updateSettings(orgId: string, dto: any) {
    const cur: any = await this.settings(orgId);
    for (const k of ['provider', 'gateway_ready', 'pix_available', 'boleto_available', 'card_available', 'providers']) delete cur[k];
    const next = mergeChargeSettings(cur as ChargeSettings, dto || {});
    const row = await this.prisma.whatsapp_crm_settings.findUnique({ where: { organization_id: orgId } });
    const charge = { ...((row?.charge as any) || {}), ...next };
    await this.prisma.whatsapp_crm_settings.upsert({ where: { organization_id: orgId }, create: { organization_id: orgId, charge }, update: { charge } });
    return this.settings(orgId);
  }

  // ---------------------------------------------------------------- formato
  private shape(c: any, extra?: { customer?: any; smap?: Map<string, any>; cmap?: Map<string, string>; cfg?: ChargeSettings }) {
    const today = brtDateStr();
    const due = toDateStr(new Date(c.due_at));
    const days = Math.round((dateOnlyUTC(due).getTime() - dateOnlyUTC(today).getTime()) / DAY);
    const cfg = extra?.cfg || DEFAULT_CHARGE_SETTINGS;
    const penalty = c.status === 'PENDING' ? penaltyBreakdown(c.base_amount_cents ?? c.amount_cents, due, today, c.purpose ? 0 : cfg.late_fee_percent, c.purpose ? 0 : cfg.interest_month_percent) : null;
    return {
      id: c.id, customer_id: c.customer_id, subscription_id: c.subscription_id, product_id: c.product_id,
      // conversa: uuid (quando existe), jid e número pelo qual a cobrança sai
      chat_id: extra?.cmap?.get(chatKeyOf(c.session_id, c.chat_id)) || null,
      jid: c.chat_id,
      session_id: c.session_id || null,
      session: (c.session_id && extra?.smap?.get(c.session_id)) || null,
      kind: c.kind, amount_cents: c.amount_cents, amount_label: formatBRL(c.amount_cents), base_amount_cents: c.base_amount_cents ?? c.amount_cents, description: c.description,
      // 2ª via: valor recalculado com multa + juros (só muda de fato ao reenviar)
      penalty,
      bot_flow_id: c.bot_flow_id || null, bot_node_id: c.bot_node_id || null,
      due_at: due, due_label: fmtBR(due), days_to_due: days, overdue: c.status === 'PENDING' && days < 0,
      status: c.status, origin: c.origin, provider: c.provider, purpose: c.purpose || null,
      pix: c.pix_charge_id ? { code: c.pix_code, qr_media_id: c.pix_qr_media_id, expires_at: c.pix_expires_at } : null,
      boleto: c.boleto_charge_id ? { url: c.boleto_url, barcode: c.boleto_barcode, digitable: c.boleto_digitable, expires_at: c.boleto_expires_at } : null,
      // Fase 4: cartão (página segura ou cartão salvo), provedor de cada meio e link público
      card: c.card_charge_id || c.payment_method_id || c.kind === 'card' ? { url: c.card_url || null, saved: Boolean(c.payment_method_id), payment_method_id: c.payment_method_id || null, attempts: c.card_attempts || 0, next_attempt_at: c.card_next_attempt_at || null, error: c.card_error || null, installments: c.installments || 1 } : null,
      providers: { pix: c.pix_provider || (c.pix_charge_id ? c.provider : null) || null, boleto: c.boleto_provider || (c.boleto_charge_id ? c.provider : null) || null, card: c.card_provider || null },
      pay_link: this.payLinkUrl(c.pay_link_token),
      paid_via: c.paid_via, paid_at: c.paid_at, sent_at: c.sent_at, reminders: Array.isArray(c.reminders) ? c.reminders : [], error: c.error,
      custom: c.custom && typeof c.custom === 'object' ? c.custom : {},
      created_at: c.created_at, updated_at: c.updated_at,
      customer: extra?.customer ? { id: extra.customer.id, name: extra.customer.name, phone: extra.customer.phone } : undefined,
    };
  }

  /** Mapas para o shape: números (brief) + uuid das conversas (número|jid → uuid). */
  private async decorate(orgId: string, rows: any[]) {
    const pairs = new Map<string, any>();
    for (const r of rows) if (r.session_id && r.chat_id) pairs.set(chatKeyOf(r.session_id, r.chat_id), { session_id: r.session_id, chat_id: r.chat_id });
    const [smap, chats, cfg] = await Promise.all([
      this.presenter.sessionMap(orgId),
      pairs.size ? this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, OR: [...pairs.values()] }, select: { id: true, session_id: true, chat_id: true } }) : Promise.resolve([] as any[]),
      this.subscriptions.chargeSettings(orgId),
    ]);
    const cmap = new Map<string, string>(chats.map((c: any) => [chatKeyOf(c.session_id, c.chat_id), c.id] as [string, string]));
    return { smap, cmap, cfg };
  }

  private async shapeOne(orgId: string, c: any, customer?: any) {
    const { smap, cmap, cfg } = await this.decorate(orgId, [c]);
    return this.shape(c, { customer, smap, cmap, cfg });
  }

  /** Multa + juros pro rata die sobre o valor base (antes de encargos), para a 2ª via. Pedido/agendamento (`purpose`) não tem encargos. */
  async amountWithPenalty(charge: any, today?: string, cfg?: ChargeSettings) {
    const c = cfg || (await this.subscriptions.chargeSettings(charge.organization_id));
    const free = Boolean(charge.purpose);
    return penaltyBreakdown(charge.base_amount_cents ?? charge.amount_cents, toDateStr(new Date(charge.due_at)), today || brtDateStr(), free ? 0 : c.late_fee_percent, free ? 0 : c.interest_month_percent);
  }

  /** Cobranças em aberto do cliente (mais antiga primeiro) — o bot usa na 2ª via. */
  async openOf(orgId: string, customerId: string) {
    const rows = await this.prisma.whatsapp_charges.findMany({ where: { organization_id: orgId, customer_id: customerId, status: 'PENDING' }, orderBy: [{ due_at: 'asc' }, { created_at: 'asc' }] });
    if (!rows.length) return [];
    const { smap, cmap, cfg } = await this.decorate(orgId, rows);
    return rows.map((r) => this.shape(r, { smap, cmap, cfg }));
  }

  private gwRow(orgId: string) {
    return this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: orgId } });
  }

  // ---------------------------------------------------------------- pagador nos gateways (Fase 4)
  /** Chave do id do cliente num gateway, por CONTA (sandbox × produção, troca de conta = cliente novo lá). */
  private refKey(g: Gateway) {
    return `${g.provider}:${createHash('sha1').update(g.token).digest('hex').slice(0, 8)}`;
  }
  /** Pagador para o gateway (o Asaas exige CPF/CNPJ; `ref` = id do cliente, acha o cadastro existente lá). */
  private payerFor(customer: any, g: Gateway) {
    const refs = customer?.provider_refs && typeof customer.provider_refs === 'object' ? (customer.provider_refs as Record<string, string>) : {};
    return { ref: String(customer.id), name: String(customer.name || 'Cliente'), doc: customer.doc || null, email: customer.email || null, customerId: refs[this.refKey(g)] || null };
  }
  /** Guarda o id do cliente no gateway (próximas cobranças não procuram de novo). */
  private async rememberRef(customer: any, g: Gateway, customerId?: string | null) {
    if (!customerId || !customer?.id) return;
    const refs = { ...((customer.provider_refs && typeof customer.provider_refs === 'object' ? customer.provider_refs : {}) as Record<string, string>) };
    const k = this.refKey(g);
    if (refs[k] === customerId) return;
    refs[k] = customerId;
    customer.provider_refs = refs;
    await this.prisma.whatsapp_customers.update({ where: { id: customer.id }, data: { provider_refs: refs } }).catch(() => undefined);
  }
  /** O que falta no cadastro para o boleto daquele gateway (null = ok). */
  private boletoMissing(provider: string, customer: any): string | null {
    const doc = onlyDigits(customer?.doc);
    if (provider === 'asaas') return doc.length === 11 || doc.length === 14 ? null : 'Para boleto pelo Asaas o cliente precisa de CPF/CNPJ. Complete o cadastro.';
    const addr: any = customer?.address || {};
    if (!doc || !customer?.email || !addr.zip || !addr.street || !addr.number || !addr.city || !addr.state) return 'Para boleto o cliente precisa de CPF/CNPJ, e-mail e endereço completo (CEP, rua, número, cidade e UF). Complete o cadastro.';
    return null;
  }
  private payLinkUrl(token?: string | null) {
    return token ? `${appUrl()}/pay/${token}` : null;
  }
  /** Link público da cobrança (cobrança antiga ganha o token na 1ª vez). */
  private async ensurePayLink(c: any): Promise<string> {
    if (c.pay_link_token) return c.pay_link_token;
    await this.prisma.whatsapp_charges.updateMany({ where: { id: c.id, pay_link_token: null }, data: { pay_link_token: newPayToken() } });
    const r = await this.prisma.whatsapp_charges.findUnique({ where: { id: c.id }, select: { pay_link_token: true } });
    c.pay_link_token = r?.pay_link_token || null;
    return c.pay_link_token;
  }
  /** Parcelas permitidas no cartão: só produto avulso com `installments_max` > 1, parcela mínima R$ 5,00. */
  private async installmentsMax(c: any) {
    if (c.subscription_id || !c.product_id) return 1;
    const p = await this.prisma.whatsapp_products.findUnique({ where: { id: c.product_id }, select: { billing: true, installments_max: true } });
    if (!p || p.billing !== 'once') return 1;
    return Math.max(1, Math.min(p.installments_max || 1, 12, Math.floor(c.amount_cents / MIN_INSTALLMENT_CENTS)));
  }

  /** Confere ANTES de gravar: o meio tem gateway e o cadastro do cliente tem o que aquele gateway exige. */
  private precheck(kind: ChargeKind, customer: any, cfg: { gateway_ready: boolean; providers: { pix: string | null; boleto: string | null; card: string | null } }) {
    const p = cfg.providers;
    const hasDoc = [11, 14].includes(onlyDigits(customer?.doc).length);
    if (!cfg.gateway_ready) throw new BadRequestException('Configure o gateway de pagamento em Configurações → Pagamentos antes de cobrar.');
    if ((kind === 'pix' || kind === 'both') && !p.pix) throw new BadRequestException('Nenhum gateway de PIX configurado para as cobranças. Escolha um em Configurações → Pagamentos.');
    if ((kind === 'pix' || kind === 'both') && p.pix === 'asaas' && !hasDoc) throw new BadRequestException('O PIX das cobranças sai pelo Asaas, que exige o CPF/CNPJ do cliente. Complete o cadastro.');
    if (kind === 'boleto' || kind === 'both') {
      if (!p.boleto) throw new BadRequestException('Nenhum gateway de boleto configurado (Mercado Pago ou Asaas). Cobre por PIX ou escolha um em Configurações → Pagamentos.');
      const miss = this.boletoMissing(p.boleto, customer);
      if (miss) throw new BadRequestException(miss);
    }
    if (kind === 'card') {
      if (!p.card) throw new BadRequestException('Cartão precisa do Asaas configurado em Configurações → Pagamentos → Cobranças do WhatsApp.');
      if (!hasDoc) throw new BadRequestException('Para cobrar no cartão o cliente precisa de CPF/CNPJ (exigência do Asaas). Complete o cadastro.');
    }
  }

  /** Meio de uma cobrança sem `kind` informado: o da assinatura (se o gateway existe), senão o padrão — boleto sem documento vira PIX. */
  private kindFor(sub: any, customer: any, cfg: any): ChargeKind {
    const hasDoc = [11, 14].includes(onlyDigits(customer?.doc).length);
    const pm = sub?.payment_method && KINDS.includes(sub.payment_method) ? (sub.payment_method as ChargeKind) : null;
    if (pm === 'card' && cfg.card_available && hasDoc) return 'card';
    const k: ChargeKind = pm && pm !== 'card' ? pm : cfg.default_kind;
    if ((k === 'boleto' || k === 'both') && (!cfg.boleto_available || (cfg.providers?.boleto && this.boletoMissing(cfg.providers.boleto, customer)))) return 'pix';
    return k;
  }

  /**
   * Gera no gateway os meios pedidos — cada um no gateway escolhido para ele. NÃO grava; devolve os campos da
   * linha + os erros por meio. `due` = vencimento (YYYY-MM-DD); `tag` diferencia a idempotência (criação × 2ª via).
   */
  private async issue(orgId: string, c: { id: string; description: string }, customer: any, amount: number, kind: ChargeKind, due: string, cfg: any, tag: string, opts: { installments?: number | null; expiresMinutes?: number | null } = {}) {
    const g = resolveGateways(await this.gwRow(orgId));
    const wantPix = kind === 'pix' || kind === 'both';
    const wantBoleto = kind === 'boleto' || kind === 'both';
    const wantCard = kind === 'card';
    this.precheck(kind, customer, { gateway_ready: Boolean(g.pix || g.boleto || g.card), providers: { pix: g.pix?.provider || null, boleto: g.boleto?.provider || null, card: g.card?.provider || null } });
    const today = brtDateStr();
    const gwDue = due < today ? today : due; // gateways não aceitam vencimento no passado
    const payerRef = createHash('sha1').update(`${orgId}:${customer.id}`).digest('hex').slice(0, 12);
    const data: any = {};
    const errors: string[] = [];
    if (wantPix) {
      const gp = g.pix!;
      // validade: pedido/agendamento = curta (`expiresMinutes`); fatura = vencimento + `pix_days`
      const expires = opts.expiresMinutes ? new Date(Date.now() + opts.expiresMinutes * 60_000) : new Date(endOfDayBRT(due).getTime() + cfg.pix_days * DAY);
      const r = await createPixCharge(gp.provider, gp.token, amount, c.description, { payerRef, payer: this.payerFor(customer, gp), name: customer.name, email: customer.email || undefined, dueAt: gwDue, externalReference: c.id, webhookUrl: this.webhookUrl(gp.provider, orgId), expiresInMin: Math.max(30, Math.round((expires.getTime() - Date.now()) / 60000)), idempotency: `wacharge-${c.id}-pix-${tag}` });
      await this.rememberRef(customer, gp, r.customerId);
      if (r.ok && r.chargeId) {
        data.pix_charge_id = r.chargeId; data.pix_code = r.pixCode || null; data.pix_expires_at = expires; data.pix_provider = gp.provider;
        if (r.qrBase64 && cfg.send_qr) { try { const m = await this.media.storeBase64(orgId, r.qrBase64, 'image/png', 'pix.png', 'image'); data.pix_qr_media_id = m.id; } catch (e: any) { this.logger.debug(`QR: ${e?.message || e}`); } }
      } else errors.push(`PIX: ${r.error || 'gateway recusou'}`);
    }
    if (wantBoleto) {
      const gb = g.boleto!;
      const addr: any = customer.address || {};
      // Mercado Pago: vencimento ≥ 3 dias e o boleto vale até ele; Asaas: aceita hoje e vale `boleto_days` depois
      const mpDue = new Date(Math.max(endOfDayBRT(due).getTime(), Date.now() + 3 * DAY));
      const expires = gb.provider === 'asaas' ? new Date(endOfDayBRT(gwDue).getTime() + cfg.boleto_days * DAY) : mpDue;
      const r = await createBoletoCharge(gb.provider, gb.token, amount, c.description, { name: customer.name, email: customer.email || '', doc: customer.doc || '', address: { zip: addr.zip, street: addr.street, number: addr.number, district: addr.district || 'Centro', city: addr.city, state: addr.state } }, { dueAt: gb.provider === 'asaas' ? gwDue : mpDue, payer: this.payerFor(customer, gb), externalReference: c.id, webhookUrl: this.webhookUrl(gb.provider, orgId), idempotency: `wacharge-${c.id}-bol-${tag}` });
      await this.rememberRef(customer, gb, r.customerId);
      if (r.ok && r.chargeId) { data.boleto_charge_id = r.chargeId; data.boleto_url = r.url || null; data.boleto_barcode = r.barcode || null; data.boleto_digitable = r.digitable || null; data.boleto_expires_at = expires; data.boleto_provider = gb.provider; }
      else errors.push(`Boleto: ${r.error || 'gateway recusou'}`);
    }
    if (wantCard) {
      const gc = g.card!;
      const n = Math.max(1, Math.round(Number(opts.installments) || 1));
      const r = await createCardCharge(gc.provider, gc.token, amount, c.description, { payer: this.payerFor(customer, gc), dueAt: gwDue, installments: n, externalReference: c.id });
      await this.rememberRef(customer, gc, r.customerId);
      if (r.ok && r.chargeId) { data.card_charge_id = r.chargeId; data.card_url = r.invoiceUrl || null; data.card_provider = gc.provider; data.installments = n; }
      else errors.push(`Cartão: ${r.error || 'gateway recusou'}`);
    }
    return { data, errors, provider: (data.pix_provider || data.boleto_provider || data.card_provider || g.principal?.provider || null) as string | null };
  }
  private webhookUrl(provider: string, orgId?: string | null) {
    return webhookUrlFor(provider, orgId);
  }

  // ---------------------------------------------------------------- número da cobrança
  /** jids pelos quais o contato pode aparecer numa conversa. */
  private contactJids(contact: any): string[] {
    return [...new Set([contact?.wa_id, contact?.lid, contact?.phone ? jidFromPhone(contact.phone) : null].filter(Boolean))] as string[];
  }

  /**
   * Por qual número cobrar um cliente (sem conversa informada): `wanted` (session_id do DTO) →
   * conversa mais recente do contato num número permitido → qualquer número conectado (permitido).
   */
  private async pickSession(orgId: string, contact: any, wanted?: string | null, allowed: Set<string> | null = null): Promise<ChatKey> {
    const jids = this.contactJids(contact);
    const fallbackJid = contact?.phone ? jidFromPhone(contact.phone) : String(contact?.wa_id || '');
    if (!fallbackJid) throw new BadRequestException('O contato do cliente não tem telefone.');
    if (wanted) {
      const row = await this.sessions.requireRow(orgId, String(wanted));
      if (allowed !== null && !allowed.has(row.id)) throw new NotFoundException('Número não encontrado.');
      const chat = await this.prisma.whatsapp_chats.findFirst({ where: { organization_id: orgId, session_id: row.id, kind: 'individual', chat_id: { in: jids } }, orderBy: { last_message_at: 'desc' } });
      return { session_id: row.id, chat_id: chat?.chat_id || fallbackJid };
    }
    const recent = jids.length
      ? await this.prisma.whatsapp_chats.findFirst({ where: { organization_id: orgId, kind: 'individual', chat_id: { in: jids }, ...(allowed !== null ? { session_id: { in: [...allowed] } } : {}) }, orderBy: { last_message_at: 'desc' } })
      : null;
    if (recent) return { session_id: recent.session_id, chat_id: recent.chat_id };
    const ready = (await this.sessions.readyRows(orgId)).filter((r) => allowed === null || allowed.has(r.id));
    if (!ready.length) throw new BadRequestException('Nenhum número do WhatsApp conectado para enviar a cobrança.');
    return { session_id: ready[0].id, chat_id: fallbackJid };
  }

  // ---------------------------------------------------------------- criar + enviar
  /**
   * `dto.chat_id` = uuid da conversa (cobra pelo número dela) OU jid + `dto.session_id` (bot) OU
   * `dto.customer_id` (+ `dto.session_id` opcional). Com `chat_id` E `customer_id`, o cliente é o
   * informado (número compartilhado por vários clientes) e o número é o da conversa.
   * `dto.bot = { flow_id, node_id }` = bloco do bot que gerou (entrega tardia). `dto.amount_cents` ausente
   * com `subscription_id` = preço com desconto vigente (`subscriptions.amountFor`).
   * `allowed` = números do usuário (null = todos) — só vale para escolher o número a partir do cliente.
   */
  async create(orgId: string, userId: string | null, dto: any, origin: 'manual' | 'recurring' | 'bot' = 'manual', allowed: Set<string> | null = null) {
    const cfg = await this.settings(orgId);
    // P7-3 (contrato da revisão geral): cobrança de pedido/agendamento — interno (o ValidationPipe recusa `__*` vindo da rede)
    const purpose: 'order' | 'appointment' | null = dto.__purpose === 'order' || dto.__purpose === 'appointment' ? dto.__purpose : null;
    const expiresMinutes = purpose && Number(dto.__expires_minutes) > 0 ? Math.min(30 * 24 * 60, Math.max(5, Math.round(Number(dto.__expires_minutes)))) : null;
    let customer: any = null;
    let key: ChatKey | null = null;
    if (dto.chat_id) {
      const ref = String(dto.chat_id);
      let chat: { session_id: string; chat_id: string; kind?: string };
      if (UUID_RE.test(ref) && !ref.includes('@')) chat = await this.attendance.chatRow(orgId, ref);
      else {
        if (!dto.session_id) throw new BadRequestException('Informe o número (session_id) junto com o jid da conversa.');
        const row = await this.sessions.requireRow(orgId, String(dto.session_id));
        chat = { session_id: row.id, chat_id: ref, kind: isGroupJid(ref) ? 'group' : 'individual' };
      }
      if (isGroupJid(chat.chat_id) || (chat.kind && chat.kind !== 'individual')) throw new BadRequestException('Cobrança é só para conversas individuais.');
      if (dto.customer_id) customer = await this.prisma.whatsapp_customers.findFirst({ where: { id: String(dto.customer_id), organization_id: orgId } });
      else {
        const r = await this.crm.byContactJid(orgId, chat.session_id, chat.chat_id);
        if (!r.customer) throw new BadRequestException('Este contato ainda não é cliente. Cadastre-o primeiro (painel "Cliente" da conversa).');
        customer = await this.prisma.whatsapp_customers.findUnique({ where: { id: r.customer.id } });
      }
      key = { session_id: chat.session_id, chat_id: chat.chat_id };
    } else if (dto.customer_id) customer = await this.prisma.whatsapp_customers.findFirst({ where: { id: String(dto.customer_id), organization_id: orgId } });
    if (!customer) throw new NotFoundException('Cliente não encontrado.');
    if (customer.status !== 'active') throw new BadRequestException('Cliente inativo. Reative-o para cobrar.');
    const contact = await this.prisma.whatsapp_contacts.findUnique({ where: { id: customer.contact_id } });
    if (!contact) throw new BadRequestException('O contato do cliente não existe mais.');
    if (!key) key = await this.pickSession(orgId, contact, dto.session_id, allowed);

    // valor/descrição: da assinatura, do produto ou livres
    let sub: any = null, product: any = null;
    if (dto.subscription_id) { sub = await this.prisma.whatsapp_subscriptions.findFirst({ where: { id: String(dto.subscription_id), customer_id: customer.id } }); if (!sub) throw new NotFoundException('Assinatura não encontrada.'); }
    if (dto.product_id) { product = await this.prisma.whatsapp_products.findFirst({ where: { id: String(dto.product_id), organization_id: orgId } }); if (!product) throw new NotFoundException('Produto não encontrado.'); }
    const amount = Math.round(Number(dto.amount_cents ?? (sub ? this.subscriptions.amountFor(sub, product, dto.due_at || null) : product?.price_cents ?? 0)));
    if (!(amount >= 100)) throw new BadRequestException('Informe um valor de pelo menos R$ 1,00.');
    const bot = dto.bot && typeof dto.bot === 'object' && dto.bot.flow_id ? { bot_flow_id: String(dto.bot.flow_id).slice(0, 36), bot_node_id: String(dto.bot.node_id || '').slice(0, 64) || null } : {};
    const description = String(dto.description || sub?.product_name || product?.name || 'Cobrança').trim().slice(0, 255);
    // meio: o pedido; senão o da assinatura (Fase 4); senão o padrão das cobranças
    const kind: ChargeKind = KINDS.includes(dto.kind) ? dto.kind : this.kindFor(sub, customer, cfg);
    // vencimento: o informado; senão o da assinatura (se ainda não passou); senão hoje
    const subDue = sub?.next_due_at ? sub.next_due_at.toISOString().slice(0, 10) : null;
    const dueStr = /^\d{4}-\d{2}-\d{2}$/.test(String(dto.due_at || '')) ? String(dto.due_at) : subDue && subDue >= brtDateStr() ? subDue : brtDateStr();
    if (dueStr < brtDateStr() && origin === 'manual') throw new BadRequestException('O vencimento não pode ficar no passado.');

    // cartão salvo (assinatura no cartão ou escolhido): cobra sozinho no vencimento, sem mensagem até dar certo/errado
    let method: any = null;
    if (kind === 'card') {
      if (!cfg.card_available) throw new BadRequestException('Cartão precisa do Asaas configurado em Configurações → Pagamentos → Cobranças do WhatsApp.');
      // C-H1: herdar o cartão salvo da assinatura só na geração automática (rotina/bot); manual/API debita só com `payment_method_id` explícito
      const mid = dto.payment_method_id || ((origin === 'recurring' || origin === 'bot') && sub?.payment_method === 'card' ? sub.payment_method_id : null);
      if (mid) {
        method = await this.prisma.whatsapp_payment_methods.findFirst({ where: { id: String(mid), customer_id: customer.id, organization_id: orgId, status: 'active', provider: cfg.providers.card || 'asaas' } });
        if (!method && dto.payment_method_id) throw new BadRequestException('Cartão salvo não encontrado (ou removido). Cobre pela página segura do cartão.');
      }
    }
    if (!method) this.precheck(kind, customer, cfg);
    const maxInst = !sub && product?.billing === 'once' ? Math.max(1, Math.min(product.installments_max || 1, 12, Math.floor(amount / MIN_INSTALLMENT_CENTS))) : 1;
    const installments = kind === 'card' ? Math.max(1, Math.min(maxInst, Math.round(Number(dto.installments) || 1))) : null;
    // campos personalizados de cobrança (Fase 7): obrigatórios só na cobrança feita à mão (painel/API); recorrente e bot não têm quem preencha
    // `__internal` = cobrança gerada por pedido/agendamento (nunca vem do DTO público: o ValidationPipe descarta)
    const custom = await this.cf.apply(orgId, 'charge', dto.custom, { mode: 'create', skipRequired: origin !== 'manual' || dto.__internal === true || Boolean(purpose) });
    const row = await this.prisma.whatsapp_charges.create({
      data: {
        custom: custom && Object.keys(custom).length ? (custom as any) : undefined,
        organization_id: orgId, session_id: key.session_id, customer_id: customer.id, subscription_id: sub?.id || null, product_id: product?.id || sub?.product_id || null, chat_id: key.chat_id,
        kind, amount_cents: amount, base_amount_cents: amount, description, due_at: dateOnlyUTC(dueStr), status: 'PENDING', origin, provider: cfg.provider, created_by: userId, reminders: [], pay_link_token: newPayToken(), purpose,
        ...(method ? { payment_method_id: method.id, card_provider: method.provider, card_next_attempt_at: dueStr <= brtDateStr() ? new Date() : new Date(`${dueStr}T09:00:00-03:00`) } : {}),
        ...bot,
      },
    });
    let charge: any = row;
    if (method) {
      if (sub) await this.subscriptions.clearFirstCharge(sub.id).catch(() => undefined);
      if (dueStr <= brtDateStr()) await this.attemptSavedCard(row.id).catch((e) => this.logger.warn(`cartão ${row.id}: ${e?.message || e}`));
      charge = (await this.prisma.whatsapp_charges.findUnique({ where: { id: row.id } })) || row;
      this.hooks.emit('charge_created', { orgId, charge }); // Fase 5: webhooks de saída
      return this.shapeOne(orgId, charge, { ...customer, phone: contact.phone });
    }
    let issued: Awaited<ReturnType<WhatsAppChargesService['issue']>>;
    try {
      issued = await this.issue(orgId, { id: row.id, description }, customer, amount, kind, dueStr, cfg, String(Math.floor(Date.now() / 60000)), { installments, expiresMinutes });
    } catch (e: any) {
      await this.prisma.whatsapp_charges.update({ where: { id: row.id }, data: { status: 'FAILED', error: String(e?.message || e).slice(0, 255) } }).catch(() => undefined);
      throw e;
    }
    const { data, errors } = issued;
    if (!data.pix_charge_id && !data.boleto_charge_id && !data.card_charge_id) {
      await this.prisma.whatsapp_charges.update({ where: { id: row.id }, data: { status: 'FAILED', error: errors.join(' | ').slice(0, 255) } });
      throw new BadRequestException(`Não foi possível gerar a cobrança. ${errors.join(' | ')}`);
    }
    if (errors.length) data.error = errors.join(' | ').slice(0, 255);
    charge = await this.prisma.whatsapp_charges.update({ where: { id: row.id }, data: { ...data, provider: issued.provider } });
    if (sub) await this.subscriptions.clearFirstCharge(sub.id).catch(() => undefined); // a 1ª cobrança (pró-rata/avulsa) já existe
    if (dto.send !== false) charge = await this.sendCharge(orgId, charge, customer, 'charge').catch((e) => { this.logger.warn(`envio da cobrança ${row.id}: ${e?.message || e}`); return charge; });
    this.hooks.emit('charge_created', { orgId, charge }); // Fase 5: webhooks de saída (só cobrança gerada; FAILED não emite)
    return this.shapeOne(orgId, charge, { ...customer, phone: contact.phone });
  }

  /** Recria os meios no gateway com outro valor/meio (2ª via com encargos, troca de meio, cartão recusado → PIX) e cancela os antigos. */
  private async reissue(orgId: string, c: any, customer: any, amount: number, kind: ChargeKind, today: string) {
    const cfg = await this.settings(orgId);
    // pedido/agendamento: o PIX novo vale o que restava do antigo (mín. 30 min), nunca vencimento + `pix_days`
    const left = c.purpose && c.pix_expires_at ? Math.round((new Date(c.pix_expires_at).getTime() - Date.now()) / 60_000) : 0;
    const expiresMinutes = c.purpose ? Math.max(30, left) : null;
    const { data, errors, provider } = await this.issue(orgId, { id: c.id, description: c.description }, customer, amount, kind, today, cfg, `r${amount}-${today}-${kind}`, { installments: kind === 'card' ? c.installments || 1 : null, expiresMinutes });
    if (!data.pix_charge_id && !data.boleto_charge_id && !data.card_charge_id) throw new BadRequestException(`Não foi possível gerar a 2ª via. ${errors.join(' | ')}`);
    // os antigos saem do gateway (ninguém paga o valor velho)
    await cancelChargeRemote(await this.gwRow(orgId), c);
    // C-H3: os avisos desta cobrança que estavam na fila levam o PIX/valor antigo → cancelados (a chave de dedupe é liberada
    // para o aviso novo poder entrar hoje mesmo)
    await this.outbox.cancelPending(orgId, { dedupe_prefix: `charge:${c.id}:`, reason: 'Cobrança reemitida (PIX/valor novo)', release_dedupe: true }).catch(() => undefined);
    const reset = { pix_charge_id: null, pix_code: null, pix_qr_media_id: null, pix_expires_at: null, pix_provider: null, boleto_charge_id: null, boleto_url: null, boleto_barcode: null, boleto_digitable: null, boleto_expires_at: null, boleto_provider: null, card_charge_id: null, card_url: null, card_next_attempt_at: null, ...(kind === 'card' ? {} : { card_provider: null }) };
    return this.prisma.whatsapp_charges.update({ where: { id: c.id }, data: { ...reset, ...data, amount_cents: amount, base_amount_cents: c.base_amount_cents ?? c.amount_cents, kind, error: errors.length ? errors.join(' | ').slice(0, 255) : null, provider: provider || c.provider } });
  }

  /**
   * 1ª cobrança de uma assinatura nova (`custom.first_charge`): cria e envia na hora (hook) ou pela
   * fila (runner). Idempotente: se já existe cobrança da assinatura para aquele vencimento, só limpa a marca.
   */
  async firstChargeFor(orgId: string, sub: any, viaQueue: boolean) {
    const fc: any = sub?.custom && typeof sub.custom === 'object' ? (sub.custom as any).first_charge : null;
    if (!fc || !(fc.amount_cents >= 100)) { if (fc) await this.subscriptions.clearFirstCharge(sub.id); return null; }
    const today = brtDateStr();
    const due = mathDateStr(fc.due_at) && mathDateStr(fc.due_at) > today ? mathDateStr(fc.due_at) : today;
    const lockKey = `first:${sub.id}`;
    if (this.creating.has(lockKey)) return null; // hook e rotina diária ao mesmo tempo → só um cria
    this.creating.add(lockKey);
    try {
    const exists = await this.prisma.whatsapp_charges.findFirst({ where: { subscription_id: sub.id, status: { in: ['PENDING', 'PAID'] } }, orderBy: { created_at: 'asc' } });
    if (exists) { await this.subscriptions.clearFirstCharge(sub.id); return null; }
    const customer = await this.prisma.whatsapp_customers.findUnique({ where: { id: sub.customer_id } });
    if (!customer || customer.status !== 'active') { await this.subscriptions.clearFirstCharge(sub.id); return null; } // cliente inativo: não fica tentando todo dia
    const cfg = await this.settings(orgId);
    const charge = await this.create(orgId, null, { customer_id: customer.id, subscription_id: sub.id, amount_cents: Math.round(fc.amount_cents), description: String(fc.description || sub.product_name), due_at: due, kind: this.kindFor(sub, customer, cfg), send: !viaQueue }, 'recurring');
    if (viaQueue) { const row = await this.prisma.whatsapp_charges.findUnique({ where: { id: charge.id } }); if (row && row.status === 'PENDING' && !row.payment_method_id) await this.enqueueCharge(orgId, row, customer, 'charge'); }
    return charge;
    } finally { this.creating.delete(lockKey); }
  }

  // ---------------------------------------------------------------- mensagens
  private async varsFor(orgId: string, c: any, customer: any, cfg?: ChargeSettings, baseIn?: Record<string, string> | null) {
    const base = baseIn || (await this.crm.varsForChat(orgId, c.chat_id, c.session_id || null));
    const name = customer?.name || base['cliente.nome'] || '';
    const due = toDateStr(new Date(c.due_at));
    const p = penaltyBreakdown(c.base_amount_cents ?? c.amount_cents, due, brtDateStr(), c.purpose ? 0 : cfg?.late_fee_percent ?? DEFAULT_CHARGE_SETTINGS.late_fee_percent, c.purpose ? 0 : cfg?.interest_month_percent ?? DEFAULT_CHARGE_SETTINGS.interest_month_percent);
    const link = this.payLinkUrl(await this.ensurePayLink(c).catch(() => null)) || '';
    const method = c.payment_method_id ? await this.prisma.whatsapp_payment_methods.findUnique({ where: { id: c.payment_method_id }, select: { brand: true, last4: true } }).catch(() => null) : null;
    return {
      ...base, nome: name, 'cliente.nome': name, 'cliente.primeiro_nome': name.split(/\s+/)[0] || '',
      'cobranca.valor': formatBRL(c.amount_cents), 'cobranca.descricao': c.description, 'cobranca.vencimento': fmtBR(due),
      'cobranca.pix': c.pix_code || '', 'cobranca.boleto_link': c.boleto_url || '', 'cobranca.boleto_codigo': c.boleto_digitable || c.boleto_barcode || '',
      // 2ª via (Fase 3)
      'cobranca.valor_original': formatBRL(c.base_amount_cents ?? c.amount_cents), 'cobranca.multa': formatBRL(p.fee_cents), 'cobranca.juros': formatBRL(p.interest_cents), 'cobranca.dias_atraso': String(p.days_late),
      // Fase 4: link público (PIX, boleto e cartão numa página) e cartão
      'cobranca.link': link, 'cobranca.cartao_link': c.card_url || link,
      'cartao.bandeira': method?.brand || '', 'cartao.final': method?.last4 || '', 'cartao.proxima': c.card_next_attempt_at ? fmtBR(brtDateStr(new Date(c.card_next_attempt_at))) : '',
    };
  }

  /** Número pronto da cobrança (400 claro quando não está). Cobrança antiga sem número usa qualquer um conectado e adota-o. */
  private async sessionFor(orgId: string, c: any) {
    if (c.session_id) return this.sessions.requireReady(orgId, c.session_id);
    const row = await this.sessions.anyReady(orgId);
    if (!row) throw new BadRequestException('O WhatsApp não está conectado.');
    await this.prisma.whatsapp_charges.update({ where: { id: c.id }, data: { session_id: row.id } }).catch(() => undefined);
    c.session_id = row.id;
    return row;
  }

  /** Envia pelo número `row` para o jid; grava a mensagem OUT com `session_id` e `extra.charge` (helper único na fila). */
  private async send(orgId: string, row: any, jid: string, msg: { kind: 'text' | 'image'; text?: string; mediaId?: string | null }, chargeId: string) {
    await this.outbox.sendNow(orgId, row, jid, msg, { charge: chargeId });
  }

  /** As mensagens de uma cobrança/lembrete: texto + PIX copia-e-cola + QR (só na 1ª) + boleto. */
  private async chargeMessages(orgId: string, c: any, customer: any, which: ChargeWhich, cfg: ChargeSettings, baseVars?: Record<string, string> | null) {
    const vars = await this.varsFor(orgId, c, customer, cfg, baseVars);
    const out: Array<{ kind: 'text' | 'image'; text?: string; media_id?: string | null }> = [];
    // cartão: a cobrança é o link seguro; lembretes avisam e repetem o link (os textos de PIX falam do código)
    if (c.kind === 'card' && !c.pix_code && !c.boleto_charge_id) {
      const auto = Boolean(c.payment_method_id) && !c.card_charge_id && (c.card_attempts || 0) === 0;
      const t = fillCrmVars(which === 'card_declined' ? cfg.texts.card_declined : auto ? cfg.texts.card_auto : which === 'charge' || which === 'second_copy' ? cfg.texts.card : cfg.texts.card_reminder, vars).trim();
      if (t) out.push({ kind: 'text', text: t });
      return out;
    }
    if (which === 'card_declined') { const t = fillCrmVars(cfg.texts.card_declined, vars).trim(); if (t) out.push({ kind: 'text', text: t }); return out; }
    const text = fillCrmVars(cfg.texts[which], vars).trim();
    if (text) out.push({ kind: 'text', text });
    if (c.pix_code) {
      out.push({ kind: 'text', text: c.pix_code });
      if ((which === 'charge' || which === 'second_copy') && c.pix_qr_media_id && cfg.send_qr) out.push({ kind: 'image', media_id: c.pix_qr_media_id, text: `QR Code do PIX · ${formatBRL(c.amount_cents)}` });
    }
    if (c.boleto_charge_id && (c.boleto_url || c.boleto_digitable || c.boleto_barcode)) {
      const bt = fillCrmVars(cfg.texts.boleto, vars).trim();
      if (bt) out.push({ kind: 'text', text: bt });
    }
    return out;
  }

  /** Envia a cobrança (ou um lembrete / 2ª via) na conversa, AGORA (bot/atendente). */
  private async sendCharge(orgId: string, c: any, customer: any, which: ChargeWhich) {
    const row = await this.sessionFor(orgId, c);
    const cfg = await this.settings(orgId);
    const msgs = await this.chargeMessages(orgId, c, customer, which, cfg);
    let i = 0;
    for (const m of msgs) {
      if (i++) await sleep(400);
      await this.send(orgId, row, c.chat_id, { kind: m.kind, text: m.text, mediaId: m.media_id }, c.id).catch((e) => { if (m.kind === 'image') this.logger.debug(`QR: ${e?.message || e}`); else throw e; });
    }
    const reminders = Array.isArray(c.reminders) ? [...c.reminders] : [];
    if (which !== 'charge') reminders.push({ kind: which, at: new Date().toISOString(), day: brtDateStr() });
    return this.prisma.whatsapp_charges.update({ where: { id: c.id }, data: { ...(c.sent_at && which !== 'charge' ? {} : { sent_at: new Date() }), reminders } }); // `sent_at` = 1º envio
  }

  /** Mesmo conteúdo, mas pela FILA com ritmo (runner diário). A fila grava `sent_at`/`reminders` ao sair. */
  private async enqueueCharge(orgId: string, c: any, customer: any, which: ChargeWhich, cfgIn?: ChargeSettings, baseVars?: Record<string, string> | null) {
    const cfg = cfgIn || (await this.settings(orgId));
    let sessionId: string = c.session_id || '';
    if (!sessionId) { const row = await this.sessions.anyReady(orgId); if (!row) throw new BadRequestException('Nenhum número do WhatsApp conectado.'); sessionId = String(row.id); await this.prisma.whatsapp_charges.update({ where: { id: c.id }, data: { session_id: sessionId } }).catch(() => undefined); }
    const messages = await this.chargeMessages(orgId, c, customer, which, cfg, baseVars);
    return this.outbox.enqueue(orgId, { session_id: sessionId, chat_id: c.chat_id, kind: `charge_${which}`, payload: { messages, mark: { charge: c.id }, charge: { id: c.id, which, pix: c.pix_code || null, amount_cents: c.amount_cents } }, dedupe_key: `charge:${c.id}:${which}:${brtDateStr()}` });
  }

  // ---------------------------------------------------------------- consultas
  /** Cláusula de número para listagens: `session_id` pedido (se permitido) ou todos os permitidos. null = nada. */
  private sessionFilter(sessionId: unknown, allowed: Set<string> | null): { session_id?: any } | null {
    const sid = sessionId ? String(sessionId) : '';
    if (sid) return allowed !== null && !allowed.has(sid) ? null : { session_id: sid };
    if (allowed === null) return {};
    if (!allowed.size) return null;
    return { session_id: { in: [...allowed] } };
  }

  /** `q.session_id` filtra um número; `q.chat_id` = uuid da conversa; `allowed` = números do usuário (null = todos). */
  async list(orgId: string, q: any = {}, allowed: Set<string> | null = null) {
    const page = Math.max(1, parseInt(String(q.page || 1), 10) || 1);
    const size = Math.min(200, Math.max(5, parseInt(String(q.page_size || 25), 10) || 25));
    const zero = { count: 0, cents: 0, label: formatBRL(0) };
    const empty = { items: [] as any[], total: 0, page, page_size: size, pages: 1, kpis: { pending: zero, overdue: zero, paid_month: zero } };
    const sess = this.sessionFilter(q.session_id, allowed);
    if (sess === null) return empty;
    const where: any = { organization_id: orgId, ...sess };
    if (q.status && q.status !== 'all') {
      if (q.status === 'OVERDUE') { where.status = 'PENDING'; where.due_at = { lt: dateOnlyUTC(brtDateStr()) }; }
      else if (CHARGE_STATUSES.includes(String(q.status).toUpperCase() as any)) where.status = String(q.status).toUpperCase();
    }
    if (q.customer_id) where.customer_id = String(q.customer_id);
    if (q.chat_id) {
      const chat = await this.prisma.whatsapp_chats.findFirst({ where: { id: String(q.chat_id), organization_id: orgId }, select: { session_id: true, chat_id: true } });
      if (!chat || (allowed !== null && !allowed.has(chat.session_id))) return empty;
      where.session_id = chat.session_id;
      where.chat_id = chat.chat_id;
    }
    if (q.kind && KINDS.includes(q.kind)) where.kind = q.kind;
    if (q.origin && ['manual', 'recurring', 'bot'].includes(q.origin)) where.origin = q.origin;
    if (q.from || q.to) where.due_at = { ...(where.due_at || {}), ...(q.from ? { gte: dateOnlyUTC(String(q.from).slice(0, 10)) } : {}), ...(q.to ? { lte: dateOnlyUTC(String(q.to).slice(0, 10)) } : {}) };
    if (q.q) {
      const s = String(q.q).trim();
      const custs = await this.prisma.whatsapp_customers.findMany({ where: { organization_id: orgId, name: { contains: s } }, select: { id: true }, take: 500 });
      where.OR = [{ description: { contains: s } }, ...(custs.length ? [{ customer_id: { in: custs.map((c) => c.id) } }] : [])];
    }
    const todayStr = brtDateStr();
    const monthStart = new Date(`${todayStr.slice(0, 7)}-01T00:00:00-03:00`);
    const kpiBase = { organization_id: orgId, ...sess };
    const [total, rows, pend, overdueRows, paidMonth] = await Promise.all([
      this.prisma.whatsapp_charges.count({ where }),
      this.prisma.whatsapp_charges.findMany({ where, orderBy: [{ created_at: 'desc' }], skip: (page - 1) * size, take: size }),
      this.prisma.whatsapp_charges.aggregate({ where: { ...kpiBase, status: 'PENDING' }, _sum: { amount_cents: true }, _count: { _all: true } }),
      this.prisma.whatsapp_charges.aggregate({ where: { ...kpiBase, status: 'PENDING', due_at: { lt: dateOnlyUTC(todayStr) } }, _sum: { amount_cents: true }, _count: { _all: true } }),
      this.prisma.whatsapp_charges.aggregate({ where: { ...kpiBase, status: 'PAID', paid_at: { gte: monthStart } }, _sum: { amount_cents: true }, _count: { _all: true } }),
    ]);
    const custIds = [...new Set(rows.map((r) => r.customer_id))];
    const custs = custIds.length ? await this.prisma.whatsapp_customers.findMany({ where: { id: { in: custIds } } }) : [];
    const contacts = custs.length ? await this.prisma.whatsapp_contacts.findMany({ where: { id: { in: custs.map((c) => c.contact_id) } }, select: { id: true, phone: true } }) : [];
    const phone = new Map(contacts.map((c) => [c.id, c.phone]));
    const byId = new Map(custs.map((c) => [c.id, { ...c, phone: phone.get(c.contact_id) || null }]));
    const { smap, cmap, cfg } = await this.decorate(orgId, rows);
    const kpi = (a: any) => ({ count: a._count._all, cents: a._sum.amount_cents || 0, label: formatBRL(a._sum.amount_cents || 0) });
    return { items: rows.map((r) => this.shape(r, { customer: byId.get(r.customer_id), smap, cmap, cfg })), total, page, page_size: size, pages: Math.max(1, Math.ceil(total / size)), kpis: { pending: kpi(pend), overdue: kpi(overdueRows), paid_month: kpi(paidMonth) } };
  }

  async get(orgId: string, id: string) {
    const c = await this.prisma.whatsapp_charges.findFirst({ where: { id, organization_id: orgId } });
    if (!c) throw new NotFoundException('Cobrança não encontrada.');
    const customer = await this.prisma.whatsapp_customers.findUnique({ where: { id: c.customer_id } });
    const contact = customer ? await this.prisma.whatsapp_contacts.findUnique({ where: { id: customer.contact_id }, select: { phone: true } }) : null;
    return this.shapeOne(orgId, c, customer ? { ...customer, phone: contact?.phone || null } : undefined);
  }

  /** Número da cobrança (para o controller conferir o acesso). */
  async sessionOf(orgId: string, id: string) {
    const c = await this.prisma.whatsapp_charges.findFirst({ where: { id, organization_id: orgId }, select: { session_id: true } });
    if (!c) throw new NotFoundException('Cobrança não encontrada.');
    return c.session_id;
  }

  // ---------------------------------------------------------------- ações
  /**
   * 2ª via: recalcula com multa + juros (`amountWithPenalty`); se o valor (ou o meio) mudou, recria o
   * PIX/boleto no gateway e cancela os antigos; envia na hora com o texto `second_copy` (atrasada) ou `charge`.
   */
  async resend(orgId: string, id: string, opts: { kind?: ChargeKind } = {}) {
    let c: any = await this.prisma.whatsapp_charges.findFirst({ where: { id, organization_id: orgId } });
    if (!c) throw new NotFoundException('Cobrança não encontrada.');
    if (c.status !== 'PENDING') throw new BadRequestException('Só cobranças em aberto podem ser reenviadas.');
    const customer = await this.prisma.whatsapp_customers.findUnique({ where: { id: c.customer_id } });
    // C-H3: o reenvio substitui o que estava na fila para esta cobrança (nada de o cliente receber o mesmo aviso de novo, ou o PIX velho)
    await this.outbox.cancelPending(orgId, { dedupe_prefix: `charge:${c.id}:`, reason: 'Substituída pelo reenvio manual' }).catch(() => undefined);
    // cartão salvo ainda não cobrado: vencida/vence hoje = tenta cobrar agora; futura = só reenvia o aviso com o link
    if (c.kind === 'card' && c.payment_method_id && !c.card_charge_id && (!opts.kind || opts.kind === 'card')) {
      // debita agora só se a tentativa já estava devida (nunca antecipa a espera de D+2/D+5 nem atropela uma em curso)
      const dueNow = toDateStr(new Date(c.due_at)) <= brtDateStr() && (!c.card_next_attempt_at || new Date(c.card_next_attempt_at).getTime() <= Date.now());
      if (dueNow) { await this.attemptSavedCard(c.id); return this.get(orgId, id); }
      return this.shapeOne(orgId, await this.sendCharge(orgId, c, customer, 'charge'), customer);
    }
    const today = brtDateStr();
    const cfg = await this.settings(orgId);
    const p = await this.amountWithPenalty(c, today, cfg);
    const kind = (opts.kind && KINDS.includes(opts.kind) ? opts.kind : c.kind) as ChargeKind;
    const noMeans = !c.pix_charge_id && !c.boleto_charge_id && !c.card_charge_id;
    if (p.amount_cents !== c.amount_cents || kind !== c.kind || noMeans) {
      // o cliente pode ter pago segundos antes: reconfere antes de trocar os ids no gateway
      if (await this.refresh(c)) throw new BadRequestException('Esta cobrança acabou de ser paga.');
      c = await this.reissue(orgId, c, customer, p.amount_cents, kind, today);
    }
    const upd = await this.sendCharge(orgId, c, customer, p.days_late > 0 ? 'second_copy' : 'charge');
    return this.shapeOne(orgId, upd, customer);
  }

  async cancel(orgId: string, id: string) {
    const c = await this.prisma.whatsapp_charges.findFirst({ where: { id, organization_id: orgId } });
    if (!c) throw new NotFoundException('Cobrança não encontrada.');
    if (c.status !== 'PENDING') throw new BadRequestException('Só cobranças em aberto podem ser canceladas.');
    // só cancela quem ainda está em aberto (um pagamento confirmado no meio tempo não vira CANCELED)
    const u = await this.prisma.whatsapp_charges.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'CANCELED', card_next_attempt_at: null } });
    if (!u.count) throw new BadRequestException('A cobrança mudou de situação enquanto você cancelava. Atualize a lista.');
    await cancelChargeRemote(await this.gwRow(orgId), c);
    const upd = (await this.prisma.whatsapp_charges.findUnique({ where: { id } })) || { ...c, status: 'CANCELED' };
    await this.outbox.cancelPending(orgId, { dedupe_prefix: `charge:${c.id}:` }).catch(() => undefined);
    this.hooks.emit('charge_canceled', { orgId, charge: upd, reason: 'manual' });
    return this.shapeOne(orgId, upd);
  }

  async markPaid(orgId: string, userId: string, id: string) {
    const c = await this.prisma.whatsapp_charges.findFirst({ where: { id, organization_id: orgId } });
    if (!c) throw new NotFoundException('Cobrança não encontrada.');
    if (c.status === 'PAID') throw new BadRequestException('Esta cobrança já está paga.');
    if (c.status === 'CANCELED') throw new BadRequestException('Cobrança cancelada não pode ser marcada como paga.');
    await this.settle(c, 'manual', userId);
    return this.get(orgId, id);
  }

  async check(orgId: string, id: string) {
    const c = await this.prisma.whatsapp_charges.findFirst({ where: { id, organization_id: orgId } });
    if (!c) throw new NotFoundException('Cobrança não encontrada.');
    await this.refresh(c);
    return this.get(orgId, id);
  }

  // ---------------------------------------------------------------- confirmação
  /** Webhook único: a cobrança é achada pelo id do gateway (PIX, boleto ou cartão). */
  async handleWebhookCharge(provider: string, chargeId: string): Promise<boolean> {
    // só o meio gerado por ESSE provedor (cobrança antiga: `provider` da linha); cartão é só do Asaas, que tem rota própria
    const legacy = { pix_provider: null, provider };
    const c = await this.prisma.whatsapp_charges.findFirst({ where: { OR: [{ pix_charge_id: chargeId, pix_provider: provider }, { pix_charge_id: chargeId, ...legacy }, { boleto_charge_id: chargeId, boleto_provider: provider }, { boleto_charge_id: chargeId, boleto_provider: null, provider }] } });
    if (!c) return false;
    await this.refresh(c).catch((e) => this.logger.warn(`webhook ${chargeId}: ${e?.message || e}`));
    return true;
  }

  /**
   * Webhook do Asaas (Fase 4): o Asaas manda o `asaas-access-token` cadastrado POR CONTA (cada org tem o seu,
   * `providers.asaas_webhook_token`). Token errado = ignora (o status ainda seria reconferido na API, mas assim
   * ninguém faz o Pub Mail consultar o gateway à toa). `true` = a cobrança é nossa (não procura em outro lugar).
   */
  async handleAsaasWebhook(chargeId: string, token: string | null | undefined, orgId?: string | null): Promise<boolean> {
    const c = await this.prisma.whatsapp_charges.findFirst({ where: { ...(orgId ? { organization_id: orgId } : {}), OR: [{ pix_charge_id: chargeId, pix_provider: 'asaas' }, { boleto_charge_id: chargeId, boleto_provider: 'asaas' }, { card_charge_id: chargeId, card_provider: 'asaas' }] } });
    if (!c) return false;
    const expected = crmProvidersOf(await this.gwRow(c.organization_id)).asaas_webhook_token;
    if (!expected || !token || !safeEqual(expected, String(token))) { this.logger.warn(`webhook Asaas com token inválido (${chargeId}) — ignorado`); return true; }
    await this.refresh(c).catch((e) => this.logger.warn(`webhook Asaas ${chargeId}: ${e?.message || e}`));
    return true;
  }

  /** Meios de uma cobrança com o provedor de cada um (cobrança antiga = `provider`). */
  private means(c: any, gwRow: any): Array<['pix' | 'boleto' | 'card', string, string | null]> {
    const out: Array<['pix' | 'boleto' | 'card', string, string | null]> = [];
    if (c.pix_charge_id) out.push(['pix', c.pix_charge_id, c.pix_provider || c.provider || gwRow?.provider || null]);
    if (c.boleto_charge_id) out.push(['boleto', c.boleto_charge_id, c.boleto_provider || c.provider || gwRow?.provider || null]);
    if (c.card_charge_id) out.push(['card', c.card_charge_id, c.card_provider || null]);
    return out;
  }

  /** Status de um meio no gateway. Cartão do Asaas traz o token do cartão (vira cartão salvo). */
  private async remoteStatus(g: Gateway, via: 'pix' | 'boleto' | 'card', id: string) {
    if (g.provider === 'asaas') {
      const d = await asaasDetails(g.token, id);
      return { ok: d.ok, status: d.status, raw: d.raw, card: via === 'card' ? d.card || null : null };
    }
    const st = await getChargeStatus(g.provider, g.token, id);
    return { ok: st.ok, status: st.status, card: null };
  }

  /** Reconfere no gateway. Pagou → liquida; vencido além da validade → EXPIRED (e cancela no gateway). */
  private async refresh(c: any): Promise<boolean> {
    if (c.status !== 'PENDING') return false;
    const gwRow = await this.gwRow(c.organization_id);
    const checks = this.means(c, gwRow);
    if (!checks.length) return false; // cartão salvo ainda não cobrado: quem cuida é `attemptSavedCard`
    let allGone = true;
    for (const [via, id, provider] of checks) {
      const g = gatewayFor(gwRow, provider);
      if (!g) { allGone = false; continue; }
      const st = await this.remoteStatus(g, via, id);
      if (st.ok && st.status === 'PAID') {
        await this.settle(c, via, null, via === 'card' ? { provider: g.provider, card: st.card } : undefined);
        return true;
      }
      // cartão salvo que ficou "em análise" e depois foi recusado/estornado: volta para a régua de tentativas
      if (via === 'card' && st.ok && st.status === 'FAILED' && c.payment_method_id && c.kind === 'card') {
        await this.cardDeclinedLater(c, `Recusado pelo emissor após análise`);
        return false;
      }
      if (!(st.ok && st.status === 'EXPIRED')) allGone = false;
    }
    // validade: a maior entre PIX e boleto; cobrança só de cartão (página segura) vale até o vencimento + `pix_days`
    let latest = Math.max(c.pix_expires_at ? new Date(c.pix_expires_at).getTime() : 0, c.boleto_expires_at ? new Date(c.boleto_expires_at).getTime() : 0);
    if (!latest && c.card_charge_id) {
      const cfg = await this.subscriptions.chargeSettings(c.organization_id).catch(() => DEFAULT_CHARGE_SETTINGS);
      latest = endOfDayBRT(toDateStr(new Date(c.due_at))).getTime() + cfg.pix_days * DAY;
    }
    if (allGone || (latest && latest < Date.now())) {
      const u = await this.prisma.whatsapp_charges.updateMany({ where: { id: c.id, status: 'PENDING' }, data: { status: 'EXPIRED', card_next_attempt_at: null } });
      if (u.count) {
        this.logger.log(`cobrança ${c.id} expirou`);
        await cancelChargeRemote(gwRow, c); // no Asaas o PIX/boleto vencido ainda pode ser pago — sai de lá
        await this.outbox.cancelPending(c.organization_id, { dedupe_prefix: `charge:${c.id}:` }).catch(() => undefined);
        const customer = await this.prisma.whatsapp_customers.findUnique({ where: { id: c.customer_id } }).catch(() => null);
        this.hooks.emit('charge_expired', { orgId: c.organization_id, charge: { ...c, status: 'EXPIRED' }, customer });
      }
    }
    return false;
  }

  private keyOf(c: any): ChatKey | null {
    return c?.session_id && c?.chat_id ? { session_id: c.session_id, chat_id: c.chat_id } : null;
  }

  /** Liquida a cobrança (uma vez só): assinatura avança, recibo, etiqueta sai. */
  private async settle(c: any, via: 'pix' | 'boleto' | 'card' | 'manual', userId: string | null, cardInfo?: { provider: string; card: { token: string; brand: string | null; last4: string | null } | null }) {
    const u = await this.prisma.whatsapp_charges.updateMany({ where: { id: c.id, status: { not: 'PAID' } }, data: { status: 'PAID', paid_at: new Date(), paid_via: via, paid_manual_by: via === 'manual' ? userId : null, card_next_attempt_at: null } });
    if (!u.count) return;
    const orgId = c.organization_id;
    if (c.status === 'CANCELED') this.logger.warn(`cobrança ${c.id} paga DEPOIS de cancelada (via ${via}) — conferir estorno`);
    // o cartão só é guardado por quem venceu a liquidação (webhook e "verificar" ao mesmo tempo não criam 2 cartões)
    if (cardInfo?.card) await this.saveCardFrom(c, cardInfo.provider, cardInfo.card).catch((e) => this.logger.warn(`cartão salvo ${c.id}: ${e?.message || e}`));
    // os outros meios são cancelados no gateway de cada um para não pagar duas vezes
    await cancelChargeRemote(await this.gwRow(orgId), c, via);
    if (c.subscription_id) await this.subscriptions.markPaid(orgId, c.subscription_id, { id: c.id, amount_cents: c.amount_cents, due_at: c.due_at, paid_via: via }, { source: via === 'manual' ? 'panel' : 'system', user_id: userId }).catch((e) => this.logger.warn(`assinatura ${c.subscription_id} pago: ${e?.message || e}`));
    await this.outbox.cancelPending(orgId, { dedupe_prefix: `charge:${c.id}:` }).catch(() => undefined); // lembrete na fila de uma cobrança paga não sai
    const key = this.keyOf(c);
    if (key) {
      await this.syncOverdueTag(orgId, c.customer_id, key).catch(() => undefined);
      await this.pipeline.onPaid(orgId, key); // funil: pago → etapa (se configurado)
    }
    const customer = await this.prisma.whatsapp_customers.findUnique({ where: { id: c.customer_id } });
    const paidRow = (await this.prisma.whatsapp_charges.findUnique({ where: { id: c.id } })) || { ...c, status: 'PAID', paid_via: via };
    this.hooks.emit('charge_paid', { orgId, charge: paidRow, customer, via });
    // pedido/agendamento: o próprio módulo manda o "pago" (com os dados do pedido/horário) — sem recibo duplicado
    if (c.purpose === 'order' || c.purpose === 'appointment' || paidRow.purpose === 'order' || paidRow.purpose === 'appointment') { this.logger.log(`cobrança ${c.id} paga via ${via}`); return; }
    try {
      const row = await this.sessionFor(orgId, c);
      const cfg = await this.settings(orgId);
      const text = fillCrmVars(cfg.texts.paid, await this.varsFor(orgId, c, customer)).trim();
      if (text) await this.send(orgId, row, c.chat_id, { kind: 'text', text }, c.id);
    } catch (e: any) { this.logger.debug(`recibo ${c.id}: ${e?.message || e}`); }
    this.logger.log(`cobrança ${c.id} paga via ${via}`);
  }

  /** Etiqueta "Inadimplente" na conversa (número + jid) quando há cobrança vencida em aberto; sai quando não há mais. */
  private async syncOverdueTag(orgId: string, customerId: string, key: ChatKey) {
    const cfg = await this.settings(orgId);
    if (!cfg.overdue_tag) return;
    const overdue = await this.prisma.whatsapp_charges.count({ where: { organization_id: orgId, customer_id: customerId, status: 'PENDING', purpose: null, due_at: { lt: dateOnlyUTC(brtDateStr()) } } });
    let tag = await this.prisma.whatsapp_tags.findFirst({ where: { organization_id: orgId, name: OVERDUE_TAG.name } });
    if (!tag && overdue) tag = await this.prisma.whatsapp_tags.create({ data: { organization_id: orgId, name: OVERDUE_TAG.name, color: OVERDUE_TAG.color, position: 99 } }).catch(() => null as any);
    if (!tag) return;
    await this.attendance.changeTags(orgId, key, overdue ? [tag.id] : [], overdue ? [] : [tag.id]);
  }

  /** Rotina diária: põe a etiqueta "Inadimplente" nas conversas em atraso que ainda não têm (em lote, 1 leitura por 200 conversas). */
  private async addOverdueTagBatch(orgId: string, keys: ChatKey[]) {
    let tag = await this.prisma.whatsapp_tags.findFirst({ where: { organization_id: orgId, name: OVERDUE_TAG.name } });
    if (!tag) tag = await this.prisma.whatsapp_tags.create({ data: { organization_id: orgId, name: OVERDUE_TAG.name, color: OVERDUE_TAG.color, position: 99 } }).catch(() => null as any);
    if (!tag) return;
    // 1 leitura + 1 UPDATE por lote de 500 conversas (antes: 1 UPDATE + 1 aviso ao vivo por conversa — 7.500 conversas = 99 s);
    // a lista do Chat pega a etiqueta na próxima atualização (rotina das 9h, não precisa de aviso por conversa)
    for (let i = 0; i < keys.length; i += 500) {
      const part = keys.slice(i, i + 500);
      const chats = await this.prisma.whatsapp_chats.findMany({ where: { organization_id: orgId, OR: part.map((k) => ({ session_id: k.session_id, chat_id: k.chat_id })) }, select: { id: true, tags: true } });
      const ids = chats.filter((c) => { const cur = Array.isArray(c.tags) ? (c.tags as string[]) : []; return !cur.includes(tag.id) && cur.length < 20; }).map((c) => c.id);
      if (!ids.length) continue;
      await this.prisma.$executeRaw`UPDATE whatsapp_chats SET tags = JSON_ARRAY_APPEND(COALESCE(tags, JSON_ARRAY()), '$', ${tag.id})
        WHERE organization_id = ${orgId} AND id IN (${Prisma.join(ids)}) AND NOT JSON_CONTAINS(COALESCE(tags, JSON_ARRAY()), JSON_QUOTE(${tag.id}))`;
    }
  }

  // ---------------------------------------------------------------- cartão (Fase 4)
  /**
   * Cartão aprovado (página segura do Asaas) → guarda o token como cartão salvo do cliente (mesma bandeira + final
   * = atualiza o existente). Assinatura que cobra no cartão passa a usar esse cartão nos próximos ciclos.
   */
  private async saveCardFrom(c: any, provider: string, card: { token: string; brand: string | null; last4: string | null }) {
    if (!card?.token) return null;
    // mesma bandeira + final = o mesmo cartão (token novo substitui); sem final conhecido, nunca "funde" com outro
    const exist = card.last4 ? await this.prisma.whatsapp_payment_methods.findFirst({ where: { organization_id: c.organization_id, customer_id: c.customer_id, provider, brand: card.brand, last4: card.last4, status: 'active' } }) : null;
    const m = exist
      ? await this.prisma.whatsapp_payment_methods.update({ where: { id: exist.id }, data: { provider_token: card.token, last_used_at: new Date(), failures: 0 } })
      : await this.prisma.whatsapp_payment_methods.create({ data: { organization_id: c.organization_id, customer_id: c.customer_id, provider, provider_token: card.token, brand: card.brand, last4: card.last4, status: 'active', last_used_at: new Date(), created_from_charge_id: c.id } });
    await this.prisma.whatsapp_charges.updateMany({ where: { id: c.id, payment_method_id: null }, data: { payment_method_id: m.id } });
    if (c.subscription_id) await this.prisma.whatsapp_subscriptions.updateMany({ where: { id: c.subscription_id, payment_method: 'card' }, data: { payment_method_id: m.id } });
    return m;
  }

  /**
   * Cobra uma cobrança no cartão salvo (`payment_method_id`). Trava atômica (`card_next_attempt_at` empurrado
   * 10 min) — duas rodadas nunca cobram em dobro. Aprovado → liquida; em análise → o webhook/runner confirma;
   * recusado → aviso ao cliente com o link de pagamento e nova tentativa em D+2 e D+5; depois disso vira PIX.
   */
  async attemptSavedCard(chargeId: string): Promise<'paid' | 'pending' | 'declined' | 'retry' | 'fallback' | 'skipped'> {
    const now = new Date();
    const claim = await this.prisma.whatsapp_charges.updateMany({
      where: { id: chargeId, status: 'PENDING', kind: 'card', payment_method_id: { not: null }, card_charge_id: null, card_next_attempt_at: { lte: now } },
      data: { card_next_attempt_at: new Date(now.getTime() + 10 * 60_000) },
    });
    if (!claim.count) return 'skipped';
    const c: any = await this.prisma.whatsapp_charges.findUnique({ where: { id: chargeId } });
    if (!c) return 'skipped';
    const orgId = c.organization_id;
    const [gwRow, customer, method] = await Promise.all([
      this.gwRow(orgId),
      this.prisma.whatsapp_customers.findUnique({ where: { id: c.customer_id } }),
      this.prisma.whatsapp_payment_methods.findFirst({ where: { id: c.payment_method_id, customer_id: c.customer_id, status: 'active' } }),
    ]);
    if (!customer || customer.status !== 'active') return this.cardFallback(c, customer, 'Cliente inativo ou removido.', c.card_attempts || 0);
    if (!method || UNREADABLE_TOKEN.test(String(method.provider_token || '')) || !method.provider_token) {
      if (method) await this.prisma.whatsapp_payment_methods.update({ where: { id: method.id }, data: { status: 'invalid' } }).catch(() => undefined);
      return this.cardFallback(c, customer, 'Cartão salvo indisponível (removido ou ilegível).', c.card_attempts || 0);
    }
    const g = gwRow?.active ? gatewayFor(gwRow, method.provider) : null;
    if (!g) {
      // gateway desligado/sem chave: NÃO desiste do cartão — tenta de novo em 1 h (religar resolve)
      await this.prisma.whatsapp_charges.updateMany({ where: { id: c.id, status: 'PENDING' }, data: { card_error: 'Gateway do cartão desligado ou sem chave — nova tentativa em 1 h', card_next_attempt_at: new Date(Date.now() + 3_600_000) } });
      return 'retry';
    }
    // queda/timeout numa tentativa anterior: o Asaas pode ter cobrado sem a gente gravar → adota antes de cobrar de novo
    let r: Awaited<ReturnType<typeof createCardCharge>> | null = null;
    if (g.provider === 'asaas') {
      const prev = await asaasFindByReference(g.token, c.id, 'CREDIT_CARD');
      const hit = prev.ok ? prev.items.find((p) => p.status === 'PAID') || prev.items.find((p) => p.status === 'PENDING') : null;
      if (!prev.ok) { await this.prisma.whatsapp_charges.updateMany({ where: { id: c.id, status: 'PENDING' }, data: { card_error: `Sem resposta do Asaas — nova tentativa em 1 h`, card_next_attempt_at: new Date(Date.now() + 3_600_000) } }); return 'retry'; }
      if (hit) r = { ok: true, chargeId: hit.id, status: hit.status, invoiceUrl: hit.invoiceUrl, card: hit.card };
    }
    if (!r) {
      r = await createCardCharge(g.provider, g.token, c.amount_cents, c.description, { payer: this.payerFor(customer, g), dueAt: brtDateStr(), cardToken: method.provider_token, externalReference: c.id });
      await this.rememberRef(customer, g, r.customerId);
    }
    if (r.ok && r.chargeId) {
      const w = await this.prisma.whatsapp_charges.updateMany({ where: { id: c.id, status: 'PENDING' }, data: { card_charge_id: r.chargeId, card_provider: g.provider, card_url: r.invoiceUrl || null, card_error: null, card_next_attempt_at: null } });
      await this.prisma.whatsapp_payment_methods.update({ where: { id: method.id }, data: { last_used_at: new Date(), failures: 0 } }).catch(() => undefined);
      if (!w.count) {
        // a cobrança foi cancelada/paga enquanto o Asaas processava: pago = registra mesmo assim; em análise = remove lá
        const fresh = await this.prisma.whatsapp_charges.findUnique({ where: { id: c.id } });
        if (r.status === 'PAID') { await this.settle({ ...(fresh || c), card_charge_id: r.chargeId, card_provider: g.provider }, 'card', null, { provider: g.provider, card: r.card || null }); return 'paid'; }
        await cancelChargeRemote(gwRow, { card_charge_id: r.chargeId, card_provider: g.provider });
        return 'skipped';
      }
      if (r.status === 'PAID') { await this.settle({ ...c, card_charge_id: r.chargeId, card_provider: g.provider }, 'card', null, { provider: g.provider, card: r.card || null }); return 'paid'; }
      return 'pending'; // análise de risco: webhook/runner confirmam (ou recusam → `cardDeclinedLater`)
    }
    const err = String(r.error || 'Cartão recusado').slice(0, 255);
    if (!r.declined) {
      // rede/5xx/erro do gateway: NÃO conta como recusa — de novo em 1 h (a cobrança vencida há mais de `pix_days` vira PIX na rodada)
      this.logger.warn(`cobrança ${c.id}: erro ao cobrar o cartão: ${err}`);
      await this.prisma.whatsapp_charges.updateMany({ where: { id: c.id, status: 'PENDING' }, data: { card_error: err, card_next_attempt_at: new Date(Date.now() + 3_600_000) } });
      return 'retry';
    }
    return this.cardDeclined(c, customer, method.id, err);
  }

  /** Recusa do emissor: conta a tentativa; D+2 e D+5 (09:00 BRT); na 3ª recusa a cobrança vira PIX. */
  private async cardDeclined(c: any, customer: any, methodId: string | null, err: string): Promise<'declined' | 'fallback'> {
    const attempts = (c.card_attempts || 0) + 1;
    if (methodId) await this.prisma.whatsapp_payment_methods.updateMany({ where: { id: methodId, failures: { lt: 120 } }, data: { failures: { increment: 1 } } }).catch(() => undefined);
    this.logger.log(`cobrança ${c.id}: cartão recusado (tentativa ${attempts}): ${err}`);
    if (attempts >= CARD_MAX_ATTEMPTS) return this.cardFallback(c, customer, err, attempts);
    const next = retryAt09(attempts === 1 ? 2 : 3);
    const w = await this.prisma.whatsapp_charges.updateMany({ where: { id: c.id, status: 'PENDING' }, data: { card_attempts: attempts, card_error: err.slice(0, 255), card_next_attempt_at: next, card_charge_id: null } });
    if (w.count) {
      const upd = await this.prisma.whatsapp_charges.findUnique({ where: { id: c.id } });
      if (upd && customer) await this.enqueueCharge(c.organization_id, upd, customer, 'card_declined').catch((e) => this.logger.warn(`aviso de cartão recusado ${c.id}: ${e?.message || e}`));
    }
    return 'declined';
  }

  /** Cartão salvo que ficou "em análise" no gateway e foi recusado depois (visto pelo webhook/runner). */
  private async cardDeclinedLater(c: any, err: string) {
    const customer = await this.prisma.whatsapp_customers.findUnique({ where: { id: c.customer_id } });
    await cancelChargeRemote(await this.gwRow(c.organization_id), { card_charge_id: c.card_charge_id, card_provider: c.card_provider }).catch(() => undefined);
    return this.cardDeclined(c, customer, c.payment_method_id, err);
  }

  /** Cartão não deu (3 recusas ou cartão indisponível): a cobrança vira PIX (ou boleto) e vai pela fila. */
  private async cardFallback(c: any, customer: any, err: string, attempts: number): Promise<'fallback'> {
    const orgId = c.organization_id;
    const w = await this.prisma.whatsapp_charges.updateMany({ where: { id: c.id, status: 'PENDING' }, data: { card_attempts: attempts, card_error: err.slice(0, 255), card_next_attempt_at: null, card_charge_id: null } });
    if (!w.count) return 'fallback';
    const cfg = await this.settings(orgId);
    const kind: ChargeKind | null = cfg.pix_available && !(cfg.providers.pix === 'asaas' && ![11, 14].includes(onlyDigits(customer?.doc).length)) ? 'pix' : cfg.boleto_available && customer && !this.boletoMissing(cfg.providers.boleto!, customer) ? 'boleto' : null;
    if (!kind || !customer) {
      // sem outro meio agora (gateway desligado?): fica em aberto e a rodada tenta de novo em 1 h
      this.logger.warn(`cobrança ${c.id}: cartão falhou e não há outro meio — nova tentativa em 1 h`);
      await this.prisma.whatsapp_charges.updateMany({ where: { id: c.id, status: 'PENDING' }, data: { card_next_attempt_at: new Date(Date.now() + 3_600_000) } }).catch(() => undefined);
      return 'fallback';
    }
    try {
      const fresh = (await this.prisma.whatsapp_charges.findUnique({ where: { id: c.id } })) || c;
      const upd = await this.reissue(orgId, fresh, customer, fresh.amount_cents, kind, brtDateStr());
      await this.enqueueCharge(orgId, upd, customer, 'charge');
      this.logger.log(`cobrança ${c.id}: cartão falhou ${attempts}× → ${kind.toUpperCase()}`);
    } catch (e: any) {
      await this.prisma.whatsapp_charges.updateMany({ where: { id: c.id, status: 'PENDING' }, data: { error: `Cartão falhou e o ${kind.toUpperCase()} não foi gerado: ${e?.message || e}`.slice(0, 255), card_next_attempt_at: new Date(Date.now() + 3_600_000) } }).catch(() => undefined);
    }
    return 'fallback';
  }

  /** Rodada do cartão salvo (no tick de 5 min): cobranças do dia e novas tentativas. */
  private async cardRound() {
    const due = await this.prisma.whatsapp_charges.findMany({ where: { status: 'PENDING', kind: 'card', payment_method_id: { not: null }, card_charge_id: null, card_next_attempt_at: { lte: new Date() } }, orderBy: { card_next_attempt_at: 'asc' }, take: 50 });
    const active = new Map<string, boolean>();
    for (const c of due) {
      if (!active.has(c.organization_id)) active.set(c.organization_id, await this.access.isOrgActive(c.organization_id).catch(() => false));
      if (!active.get(c.organization_id)) continue;
      // erro de gateway repetindo por dias (não recusa): vencida há mais de `pix_days` → desiste do cartão e vira PIX
      if (c.card_error && toDateStr(new Date(c.due_at)) < brtDateStr(new Date(Date.now() - 7 * DAY))) {
        const customer = await this.prisma.whatsapp_customers.findUnique({ where: { id: c.customer_id } });
        await this.cardFallback(c, customer, `Cartão sem resposta por vários dias: ${c.card_error}`, c.card_attempts || 0).catch((e) => this.logger.warn(`fallback ${c.id}: ${e?.message || e}`));
        continue;
      }
      await this.attemptSavedCard(c.id).catch((e) => this.logger.warn(`cartão ${c.id}: ${e?.message || e}`));
    }
  }

  // ---------------------------------------------------------------- cartões salvos (painel)
  async paymentMethods(orgId: string, customerId: string) {
    const rows = await this.prisma.whatsapp_payment_methods.findMany({ where: { organization_id: orgId, customer_id: customerId, status: 'active' }, orderBy: { created_at: 'desc' } });
    const subs = await this.prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, customer_id: customerId, payment_method_id: { in: rows.map((r) => r.id) } }, select: { id: true, payment_method_id: true, product_name: true } });
    return rows.map((m) => ({ id: m.id, provider: m.provider, brand: m.brand, last4: m.last4, failures: m.failures, last_used_at: m.last_used_at, created_at: m.created_at, subscriptions: subs.filter((s) => s.payment_method_id === m.id).map((s) => ({ id: s.id, product_name: s.product_name })) }));
  }

  /** Remove o cartão salvo (o token some do banco). Assinaturas que usavam ele voltam a cobrar pela página do cartão. */
  async removePaymentMethod(orgId: string, customerId: string, id: string) {
    const m = await this.prisma.whatsapp_payment_methods.findFirst({ where: { id, organization_id: orgId, customer_id: customerId } });
    if (!m) throw new NotFoundException('Cartão não encontrado.');
    await this.prisma.whatsapp_payment_methods.update({ where: { id }, data: { status: 'removed', provider_token: '-' } });
    await this.prisma.whatsapp_subscriptions.updateMany({ where: { organization_id: orgId, payment_method_id: id }, data: { payment_method_id: null } });
    return this.paymentMethods(orgId, customerId);
  }

  // ---------------------------------------------------------------- link público de pagamento (Fase 4)
  private payLocks = new Set<string>();
  private publicChecks = new Map<string, number>();

  private async byPayToken(token: string) {
    const t = String(token || '');
    if (!/^[A-Za-z0-9_-]{16,40}$/.test(t)) throw new NotFoundException('Link de pagamento inválido.');
    const c = await this.prisma.whatsapp_charges.findFirst({ where: { pay_link_token: t } });
    if (!c) throw new NotFoundException('Link de pagamento inválido.');
    return c;
  }

  /** Página pública /pay/:token — só o necessário para pagar (nada de documento, endereço ou telefone). */
  async publicView(token: string) {
    const c: any = await this.byPayToken(token);
    const [org, customer, gwRow, maxInst] = await Promise.all([
      this.prisma.organizations.findUnique({ where: { id: c.organization_id }, select: { name: true } }),
      this.prisma.whatsapp_customers.findUnique({ where: { id: c.customer_id }, select: { name: true, doc: true } }),
      this.gwRow(c.organization_id),
      this.installmentsMax(c),
    ]);
    const g = resolveGateways(gwRow);
    const due = toDateStr(new Date(c.due_at));
    const open = c.status === 'PENDING';
    // cartão salvo que ainda vai ser debitado sozinho: a página só informa (pagar à parte cobraria duas vezes)
    const autoPending = open && c.kind === 'card' && Boolean(c.payment_method_id) && !c.card_charge_id && (c.card_attempts || 0) === 0;
    const method = autoPending ? await this.prisma.whatsapp_payment_methods.findUnique({ where: { id: c.payment_method_id }, select: { brand: true, last4: true } }).catch(() => null) : null;
    const cardOk = open && !autoPending && Boolean(g.card) && [11, 14].includes(onlyDigits(customer?.doc).length);
    return {
      org: org?.name || '', customer_first_name: String(customer?.name || '').split(/\s+/)[0] || '',
      description: c.description, amount_cents: c.amount_cents, amount_label: formatBRL(c.amount_cents), due_at: due, due_label: fmtBR(due),
      status: c.status, paid_at: c.paid_at, paid_via: c.paid_via,
      pix: open && c.pix_code ? { code: c.pix_code, qr_url: c.pix_qr_media_id ? this.media.signedUrl(c.pix_qr_media_id) : null, expires_at: c.pix_expires_at } : null,
      boleto: open && c.boleto_charge_id ? { url: c.boleto_url, digitable: c.boleto_digitable || c.boleto_barcode || null } : null,
      card: cardOk ? { url: c.card_url || null, installments: c.installments || 1, installments_max: maxInst } : null,
      auto_card: autoPending ? { brand: method?.brand || null, last4: method?.last4 || null, date_label: fmtBR(brtDateStr(new Date(c.card_next_attempt_at || Date.now()))) } : null,
    };
  }

  /** Reconfere o pagamento (botão "Já paguei" / polling da página). No máx. 1× a cada 5 s por cobrança. */
  async publicCheck(token: string) {
    const c = await this.byPayToken(token);
    const last = this.publicChecks.get(c.id) || 0;
    if (c.status === 'PENDING' && Date.now() - last > 5000) {
      this.publicChecks.set(c.id, Date.now());
      if (this.publicChecks.size > 5000) this.publicChecks.clear();
      await this.refresh(c).catch(() => undefined);
    }
    return this.publicView(token);
  }

  /**
   * Pagar no cartão pela página: cria (ou reaproveita) a cobrança de cartão no Asaas e devolve a página segura dele
   * (o cartão é digitado LÁ). Parcelas só em produto avulso (`installments_max`). Uma por vez por cobrança.
   */
  async publicCard(token: string, installments?: number) {
    const c: any = await this.byPayToken(token);
    if (c.status !== 'PENDING') throw new BadRequestException(c.status === 'PAID' ? 'Esta cobrança já está paga.' : 'Esta cobrança não está mais em aberto.');
    if (c.kind === 'card' && c.payment_method_id && !c.card_charge_id && (c.card_attempts || 0) === 0) throw new BadRequestException('Esta cobrança será debitada automaticamente no cartão salvo.');
    if (this.payLocks.has(c.id)) throw new BadRequestException('Gerando o pagamento… tente de novo em instantes.');
    this.payLocks.add(c.id);
    try {
      const max = await this.installmentsMax(c);
      const n = Math.max(1, Math.min(max, Math.round(Number(installments) || 1)));
      if (c.card_charge_id && c.card_url && (c.installments || 1) === n) return { url: c.card_url };
      const gwRow = await this.gwRow(c.organization_id);
      if (c.card_charge_id) {
        // outra quantidade de parcelas: a página antiga sai do gateway (se já foi paga, liquida; em análise, não mexe)
        const g0 = gatewayFor(gwRow, c.card_provider);
        if (!g0) throw new BadRequestException('Pagamento no cartão indisponível no momento.');
        const st = await this.remoteStatus(g0, 'card', c.card_charge_id);
        if (st.ok && st.status === 'PAID') { await this.refresh(c); throw new BadRequestException('Esta cobrança já está paga.'); }
        if (!st.ok) throw new BadRequestException('Não foi possível confirmar o pagamento anterior. Tente de novo em instantes.');
        if (st.status === 'PENDING' && !/^(PENDING|OVERDUE)$/.test(String((st as any).raw || 'PENDING'))) throw new BadRequestException('Um pagamento no cartão está em análise. Aguarde a confirmação.');
        const cancel = await cancelChargeRemote(gwRow, { card_charge_id: c.card_charge_id, card_provider: c.card_provider }).then(() => true).catch(() => false);
        if (!cancel) throw new BadRequestException('Não foi possível trocar as parcelas agora. Tente de novo em instantes.');
      }
      const customer = await this.prisma.whatsapp_customers.findUnique({ where: { id: c.customer_id } });
      const g = resolveGateways(gwRow).card;
      if (!g || !customer) throw new BadRequestException('Pagamento no cartão indisponível para esta cobrança.');
      if (![11, 14].includes(onlyDigits(customer.doc).length)) throw new BadRequestException('Pagamento no cartão indisponível (cadastro sem CPF/CNPJ). Pague por PIX ou fale com a empresa.');
      const r = await createCardCharge(g.provider, g.token, c.amount_cents, c.description, { payer: this.payerFor(customer, g), dueAt: brtDateStr(), installments: n, externalReference: c.id });
      await this.rememberRef(customer, g, r.customerId);
      if (!r.ok || !r.chargeId || !r.invoiceUrl) { this.logger.warn(`link de pagamento ${c.id}: cartão recusado pelo gateway: ${r.error || '?'}`); throw new BadRequestException('Não foi possível abrir o pagamento no cartão agora. Tente de novo ou use outro meio.'); }
      // só grava se nada mudou enquanto o Asaas respondia (webhook/débito automático podem ter liquidado); senão desfaz lá
      const w = await this.prisma.whatsapp_charges.updateMany({ where: { id: c.id, status: 'PENDING', card_charge_id: c.card_charge_id ?? null }, data: { card_charge_id: r.chargeId, card_url: r.invoiceUrl, card_provider: g.provider, installments: n } });
      if (!w.count) { await cancelChargeRemote(gwRow, { card_charge_id: r.chargeId, card_provider: g.provider }); throw new BadRequestException('Esta cobrança mudou de situação. Atualize a página.'); }
      return { url: r.invoiceUrl };
    } finally {
      this.payLocks.delete(c.id);
    }
  }

  // ---------------------------------------------------------------- conciliação (Fase 4)
  /**
   * Compara as cobranças do gateway (hoje: Asaas, o único com listagem) com as do Pub Mail no período (data de
   * criação, BRT). Divergências: pago lá e aberto/vencido/cancelado aqui (`paid_remote`, corrigível), pago aqui
   * e não lá (`paid_local`), vencido/removido lá e aberto aqui (`stale`, corrigível), cobrança do Pub Mail que não
   * está lá (`missing_remote`) e cobrança lá sem par aqui (`unknown`).
   */
  async reconcile(orgId: string, fromIn?: string, toIn?: string) {
    const today = brtDateStr();
    const to = /^\d{4}-\d{2}-\d{2}$/.test(String(toIn || '')) ? String(toIn) : today;
    const from = /^\d{4}-\d{2}-\d{2}$/.test(String(fromIn || '')) ? String(fromIn) : toDateStr(new Date(dateOnlyUTC(to).getTime() - 30 * DAY));
    if (from > to) throw new BadRequestException('Período inválido.');
    if (daysBetween(from, to) > 92) throw new BadRequestException('Concilie no máximo 3 meses por vez.');
    const gwRow = await this.gwRow(orgId);
    const token = tokenFor(gwRow, 'asaas');
    if (!token) return { supported: false, from, to, providers: [], remote_total: 0, local_total: 0, ok_count: 0, items: [] as any[] };
    const r = await asaasList(token, from, to);
    if (!r.ok) throw new BadRequestException(`O Asaas não respondeu: ${r.error || 'erro'}`);
    const remote = new Map(r.items.map((i) => [i.id, i] as [string, any]));
    const ids = [...remote.keys()];
    const fromD = new Date(`${from}T00:00:00-03:00`);
    const toD = new Date(`${to}T23:59:59-03:00`);
    const local = await this.prisma.whatsapp_charges.findMany({
      where: { organization_id: orgId, OR: [...(ids.length ? [{ pix_charge_id: { in: ids } }, { boleto_charge_id: { in: ids } }, { card_charge_id: { in: ids } }] : []), { created_at: { gte: fromD, lte: toD }, OR: [{ pix_provider: 'asaas' }, { boleto_provider: 'asaas' }, { card_provider: 'asaas' }] }] },
      take: 2000,
    });
    const custs = local.length ? await this.prisma.whatsapp_customers.findMany({ where: { id: { in: [...new Set(local.map((c) => c.customer_id))] } }, select: { id: true, name: true } }) : [];
    const cname = new Map(custs.map((c) => [c.id, c.name]));
    const seen = new Set<string>();
    const items: any[] = [];
    let okCount = 0;
    const base = (c: any) => ({ charge_id: c.id, customer: cname.get(c.customer_id) || '—', description: c.description, amount_cents: c.amount_cents, amount_label: formatBRL(c.amount_cents), local_status: c.status, paid_via: c.paid_via || null, due_at: toDateStr(new Date(c.due_at)) });
    for (const c of local) {
      const mine = ([['pix', c.pix_charge_id, c.pix_provider || c.provider], ['boleto', c.boleto_charge_id, c.boleto_provider || c.provider], ['card', c.card_charge_id, c.card_provider]] as Array<[string, string | null, string | null]>).filter(([, id, p]) => id && p === 'asaas');
      if (!mine.length) continue;
      const listed = mine.map(([via, id]) => ({ via, id: id!, rem: remote.get(id!) })).filter((x) => x.rem);
      for (const x of listed) seen.add(x.id);
      const paid = listed.find((x) => x.rem.status === 'PAID');
      const paidLegs = listed.filter((x) => x.rem.status === 'PAID');
      if (paidLegs.length > 1) { items.push({ ...base(c), kind: 'double_paid', via: paidLegs.map((x) => x.via).join('+'), remote_id: paidLegs.map((x) => x.id).join(', '), remote_status: paidLegs.map((x) => x.rem.raw).join(', '), fixable: false }); continue; }
      if (paid && c.status !== 'PAID') { items.push({ ...base(c), kind: 'paid_remote', via: paid.via, remote_id: paid.id, remote_status: paid.rem.raw, remote_value_label: formatBRL(paid.rem.value_cents), fixable: true }); continue; }
      if (!paid && c.status === 'PAID' && c.paid_via !== 'manual' && listed.length && listed.some((x) => x.via === c.paid_via)) { const x = listed.find((y) => y.via === c.paid_via)!; items.push({ ...base(c), kind: 'paid_local', via: x.via, remote_id: x.id, remote_status: x.rem.raw, fixable: false }); continue; }
      if (c.status === 'PENDING' && listed.length && listed.every((x) => x.rem.status === 'EXPIRED' || x.rem.status === 'FAILED')) { items.push({ ...base(c), kind: 'stale', via: listed[0].via, remote_id: listed[0].id, remote_status: listed[0].rem.raw, fixable: true }); continue; }
      if (!listed.length && c.created_at >= fromD && c.created_at <= toD && c.status === 'PENDING') { items.push({ ...base(c), kind: 'missing_remote', via: mine[0][0], remote_id: mine[0][1], remote_status: null, fixable: true }); continue; }
      okCount++;
    }
    // parcelas 2..N de um parcelamento nosso (a 1ª é a que guardamos) não são "desconhecidas"
    const knownPlans = new Set([...seen].map((id) => remote.get(id)?.installment).filter(Boolean));
    for (const [id, rem] of remote) {
      if (seen.has(id) || (rem.installment && knownPlans.has(rem.installment))) continue;
      items.push({ charge_id: null, kind: 'unknown', remote_id: id, remote_status: rem.raw, remote_value_label: formatBRL(rem.value_cents), billing_type: rem.billing_type, external_reference: rem.external_reference, description: null, fixable: false });
    }
    const order: Record<string, number> = { double_paid: 0, paid_remote: 1, stale: 2, missing_remote: 3, paid_local: 4, unknown: 5 };
    items.sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9));
    return { supported: true, from, to, providers: ['asaas'], truncated: Boolean(r.truncated), remote_total: r.items.length, local_total: local.length, ok_count: okCount, items };
  }

  /** Corrige uma divergência: pago no gateway → liquida (recibo, assinatura avança); aberto aqui → reconfere. */
  async reconcileFix(orgId: string, chargeId: string) {
    const c: any = await this.prisma.whatsapp_charges.findFirst({ where: { id: chargeId, organization_id: orgId } });
    if (!c) throw new NotFoundException('Cobrança não encontrada.');
    if (c.status === 'PAID') return { fixed: false, charge: await this.get(orgId, chargeId), message: 'Já está paga.' };
    const gwRow = await this.gwRow(orgId);
    for (const [via, id, provider] of this.means(c, gwRow)) {
      const g = gatewayFor(gwRow, provider);
      if (!g) continue;
      const st = await this.remoteStatus(g, via, id);
      if (st.ok && st.status === 'PAID') {
        if (via === 'card' && st.card) await this.saveCardFrom(c, g.provider, st.card).catch(() => undefined);
        await this.settle(c, via, null);
        return { fixed: true, charge: await this.get(orgId, chargeId), message: 'Pagamento confirmado no gateway — cobrança liquidada.' };
      }
    }
    if (c.status === 'PENDING') {
      await this.refresh(c);
      const after = await this.get(orgId, chargeId);
      return { fixed: after.status !== 'PENDING', charge: after, message: after.status === 'PENDING' ? 'Continua em aberto no gateway.' : `Atualizada: ${after.status}.` };
    }
    return { fixed: false, charge: await this.get(orgId, chargeId), message: 'Nada a corrigir: não consta pagamento no gateway.' };
  }

  // ---------------------------------------------------------------- runner
  private async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      // só as que têm algo no gateway; a mais antiga conferida primeiro (`updated_at` é tocado a cada conferência —
      // sem isso, com mais de 100 em aberto, as mais novas nunca eram conferidas pelo runner)
      const pend = await this.prisma.whatsapp_charges.findMany({ where: { status: 'PENDING', created_at: { lt: new Date(Date.now() - 20_000) }, OR: [{ pix_charge_id: { not: null } }, { boleto_charge_id: { not: null } }, { card_charge_id: { not: null } }] }, orderBy: { updated_at: 'asc' }, take: 100 });
      for (const c of pend) {
        await this.refresh(c).catch((e) => this.logger.debug(`refresh ${c.id}: ${e?.message || e}`));
        await this.prisma.whatsapp_charges.updateMany({ where: { id: c.id, status: 'PENDING' }, data: { updated_at: new Date() } }).catch(() => undefined);
      }
      await this.cardRound();
    } catch (e: any) { this.logger.debug(`tick: ${e?.message || e}`); } finally { this.ticking = false; }
  }

  /** Diário (09:00 BRT = 12:00 UTC): gera cobranças recorrentes, manda lembretes, marca atrasos. */
  @Cron('0 5 12 * * *')
  async daily() {
    const orgs = await this.prisma.whatsapp_crm_settings.findMany({ select: { organization_id: true } });
    const subsOrgs = await this.prisma.whatsapp_subscriptions.groupBy({ by: ['organization_id'], where: { status: { in: ['active', 'overdue'] } } });
    const ids = [...new Set([...orgs.map((o) => o.organization_id), ...subsOrgs.map((o) => o.organization_id)])];
    for (const orgId of ids) {
      if (!(await this.access.isOrgActive(orgId).catch(() => false))) continue;
      await this.runDailyFor(orgId).catch((e) => this.logger.warn(`daily ${orgId}: ${e?.message || e}`));
    }
  }

  /**
   * Diário por organização (também pelo botão `POST /whatsapp/charges/run-daily`):
   *  0) assinaturas: cancelamento agendado, fim de pausa, aviso de trial (D-3), reajuste;
   *  1) recorrentes: cobrança do próximo vencimento (N dias antes, por produto) + 1ª cobrança pendente;
   *  2) lembretes (régua da org ou do produto) e atraso (respeita a carência do produto).
   * Todo envio daqui vai pela fila `whatsapp_outbox` (ritmo por número) — nada sai direto.
   */
  private dailyRunning = new Set<string>();
  private creating = new Set<string>();

  async runDailyFor(orgId: string) {
    if (this.dailyRunning.has(orgId)) throw new BadRequestException('A rotina diária já está rodando para esta organização.');
    this.dailyRunning.add(orgId);
    try { return await this.runDailyInner(orgId); } finally { this.dailyRunning.delete(orgId); }
  }

  private async runDailyInner(orgId: string) {
    const cfg = await this.settings(orgId);
    const today = brtDateStr();
    const todayD = dateOnlyUTC(today);
    const result = { generated: 0, first_charges: 0, reminders: 0, overdue: 0, queued: 0, closed: 0, resumed: 0, trial_notices: 0, readjusted: 0, errors: [] as string[], timings: {} as Record<string, number> };
    let tMark = Date.now();
    const lap = (k: string) => { const n = Date.now(); result.timings[k] = (result.timings[k] || 0) + (n - tMark); tMark = n; };
    // 0) manutenção das assinaturas
    try {
      const m = await this.subscriptions.dailyMaintenance(orgId, cfg, today);
      result.closed = m.closed; result.resumed = m.resumed; result.trial_notices = m.trial_notices; result.readjusted = m.readjusted; result.errors.push(...m.errors);
    } catch (e: any) { result.errors.push(`assinaturas: ${e?.message || e}`); }
    lap('maintenance_ms');
    const products = new Map((await this.prisma.whatsapp_products.findMany({ where: { organization_id: orgId } })).map((p) => [p.id, p] as [string, any]));
    // 1) recorrentes: vence em até N dias (da org ou do produto) e ainda não tem cobrança para esse vencimento
    if (cfg.auto_recurring && cfg.gateway_ready) {
      const limit = new Date(todayD.getTime() + 30 * DAY);
      // em lotes por cursor (nunca acumula tudo em memória): por lote, UMA consulta das cobranças que já existem
      // para o vencimento e UMA dos clientes — antes eram 2 consultas por assinatura (Fase 8, contrato §12.2)
      let cursor: string | null = null;
      for (;;) {
        // `id > cursor` (não `cursor+skip`): se a última linha do lote mudou de status no meio, o cursor do Prisma pulava/parava cedo (C-M1)
        const page: any[] = await this.prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, status: { in: ['active', 'overdue'] }, billing: { not: 'once' }, next_due_at: { not: null, lte: limit }, ...(cursor ? { id: { gt: cursor } } : {}) }, orderBy: { id: 'asc' }, take: DAILY_BATCH });
        if (!page.length) break;
        cursor = page[page.length - 1].id;
        const due = page.filter((sub) => {
          const product = sub.product_id ? products.get(sub.product_id) : null;
          const dueStr = toDateStr(new Date(sub.next_due_at!));
          if (daysBetween(today, dueStr) > (product?.charge_days_before ?? cfg.days_before_due)) return false;
          return !(sub.cancel_at && toDateStr(new Date(sub.cancel_at)) <= dueStr); // cancelamento agendado: o próximo ciclo não é cobrado
        });
        if (due.length) {
          const existing = await this.prisma.whatsapp_charges.findMany({ where: { organization_id: orgId, subscription_id: { in: due.map((x) => x.id) }, status: { in: ['PENDING', 'PAID'] } }, select: { subscription_id: true, due_at: true } });
          const has = new Set(existing.map((e) => `${e.subscription_id}:${toDateStr(new Date(e.due_at))}`));
          const custIds = [...new Set(due.map((x) => x.customer_id))];
          const customers = new Map((await this.prisma.whatsapp_customers.findMany({ where: { organization_id: orgId, id: { in: custIds } } })).map((c) => [c.id, c] as [string, any]));
          for (const sub of due) {
            const product = sub.product_id ? products.get(sub.product_id) : null;
            const dueStr = toDateStr(new Date(sub.next_due_at!));
            const lockKey = `${sub.id}:${dueStr}`;
            if (has.has(lockKey) || this.creating.has(lockKey)) continue;
            const customer = customers.get(sub.customer_id);
            if (!customer || customer.status !== 'active') continue;
            this.creating.add(lockKey);
            try {
              // reconfere na hora (outro processo/rota pode ter criado entre a consulta do lote e agora)
              if (await this.prisma.whatsapp_charges.findFirst({ where: { subscription_id: sub.id, due_at: sub.next_due_at!, status: { in: ['PENDING', 'PAID'] } }, select: { id: true } })) continue;
              // fim do teste grátis com dia escolhido: proporcional até o dia escolhido (ou cheio, produto sem proporcional)
              const trial = this.subscriptions.trialChargeFor(sub, product, dueStr);
              const amount = trial ? trial.amount_cents : this.subscriptions.amountFor(sub, product, dueStr);
              if (amount < 100) { // crédito/desconto cobre o ciclo: avança sem cobrar
                await this.subscriptions.markPaid(orgId, sub.id, { id: 'free', amount_cents: amount, due_at: dueStr, paid_via: 'credit' }, { source: 'system' });
                continue;
              }
              const charge = await this.create(orgId, null, { customer_id: customer.id, subscription_id: sub.id, amount_cents: amount, ...(trial ? { description: trial.description } : {}), kind: this.kindFor(sub, customer, cfg), due_at: dueStr, send: false }, 'recurring');
              const row = await this.prisma.whatsapp_charges.findUnique({ where: { id: charge.id } });
              // cartão salvo: sem mensagem agora (cobra sozinho no vencimento; recibo ou aviso de recusa depois)
              if (row && row.status === 'PENDING' && !row.payment_method_id && (await this.enqueueCharge(orgId, row, customer, 'charge'))) result.queued++;
              result.generated++;
            } catch (e: any) { if (result.errors.length < 200) result.errors.push(`${customer.name}: ${e?.message || e}`); }
            finally { this.creating.delete(lockKey); }
          }
        }
        if (page.length < DAILY_BATCH) break;
      }
      // 1b) 1ª cobrança (pró-rata/avulsa) ainda não criada — rede de segurança do hook `subscription_first_charge`
      const pendingFirst = await this.prisma.whatsapp_subscriptions.findMany({ where: { organization_id: orgId, status: { in: ['active', 'overdue'] }, custom: { path: '$.first_charge.auto', equals: true } }, take: 200 }).catch(() => [] as any[]);
      for (const sub of pendingFirst) {
        try { if (await this.firstChargeFor(orgId, sub, true)) { result.first_charges++; result.queued++; } }
        catch (e: any) { result.errors.push(`1ª cobrança ${sub.id}: ${e?.message || e}`); }
      }
    }
    lap('recurring_ms');
    // 2) lembretes + atraso — TODAS as pendentes, em lotes por cursor (antes parava nas 1.000 primeiras: acima disso
    // ninguém recebia lembrete nem virava "em atraso"). Etiqueta "Inadimplente": uma vez por conversa por rodada, em lote.
    const yesterday = new Date(dateOnlyUTC(brtDateStr()).getTime() - 86_400_000).getTime(); // venceram ONTEM (runner diário → 1 aviso por cobrança)
    const overdueKeys = new Map<string, ChatKey>();
    let pcursor: string | null = null;
    for (;;) {
      // `purpose` (pedido/agendamento) fica fora da régua, da etiqueta, do `charge_overdue` e do "em atraso" (P7-3); `id > cursor` (C-M1)
      const pend: any[] = await this.prisma.whatsapp_charges.findMany({ where: { organization_id: orgId, status: 'PENDING', purpose: null, ...(pcursor ? { id: { gt: pcursor } } : {}) }, orderBy: { id: 'asc' }, take: DAILY_BATCH });
      if (!pend.length) break;
      pcursor = pend[pend.length - 1].id;
      const subIds = [...new Set(pend.map((c) => c.subscription_id).filter(Boolean))] as string[];
      const subs = new Map((subIds.length ? await this.prisma.whatsapp_subscriptions.findMany({ where: { id: { in: subIds } } }) : []).map((x) => [x.id, x] as [string, any]));
      for (const c of pend) if (c.due_at && new Date(c.due_at).getTime() === yesterday) this.hooks.emit('charge_overdue', { orgId, charge: c });
      // quem precisa de lembrete hoje (os clientes desses vêm numa consulta só)
      const todo: { c: any; which: ChargeWhich }[] = [];
      const toOverdue: Array<{ subId: string; kind: 'overdue'; data: Record<string, unknown> }> = [];
      for (const c of pend) {
        const due = toDateStr(new Date(c.due_at));
        const days = Math.round((todayD.getTime() - dateOnlyUTC(due).getTime()) / DAY); // >0 = dias de atraso
        const sub = c.subscription_id ? subs.get(c.subscription_id) : null;
        const product = (sub?.product_id && products.get(sub.product_id)) || (c.product_id && products.get(c.product_id)) || null;
        const rules = product?.reminder_rules ? normalizeReminderRules(product.reminder_rules, cfg.reminders) : cfg.reminders;
        const sentKinds = new Set((Array.isArray(c.reminders) ? c.reminders : []).map((r: any) => `${r.kind}:${r.day}`));
        let which: ChargeWhich | null = null;
        if (rules.before.enabled && days === -rules.before.days) which = 'reminder_before';
        else if (rules.due.enabled && days === 0) which = 'reminder_due';
        else if (rules.after.enabled && days === rules.after.days) which = 'reminder_after';
        else if (rules.after2.enabled && days === rules.after2.days) which = 'reminder_after';
        if (which && !sentKinds.has(`${which}:${today}`) && c.sent_at) todo.push({ c, which });
        if (days >= 1) {
          // assinatura em atraso só depois da carência (do produto, senão a da org)
          const grace = sub ? (product?.grace_days ?? cfg.grace_days_default) : 0;
          if (sub && sub.status === 'active' && days >= 1 + grace) {
            sub.status = 'overdue'; // marcado em lote no fim deste lote (1 UPDATE + 1 INSERT de eventos)
            toOverdue.push({ subId: sub.id, kind: 'overdue', data: { charge_id: c.id, due_at: due, days_late: days, grace_days: grace } });
          }
          const key = this.keyOf(c);
          if (key) overdueKeys.set(`${key.session_id}|${key.chat_id}`, key);
        }
      }
      if (toOverdue.length) {
        // só as que ainda estão ativas viram "em atraso" (uma leitura confirma quais o UPDATE vai pegar)
        const still = new Set((await this.prisma.whatsapp_subscriptions.findMany({ where: { id: { in: toOverdue.map((x) => x.subId) }, status: 'active' }, select: { id: true } })).map((x) => x.id));
        const marks = toOverdue.filter((x) => still.has(x.subId));
        if (marks.length) {
          const u = await this.prisma.whatsapp_subscriptions.updateMany({ where: { id: { in: marks.map((x) => x.subId) }, status: 'active' }, data: { status: 'overdue' } });
          result.overdue += u.count;
          await this.subscriptions.recordEvents(orgId, marks, { source: 'system' });
        }
      }
      lap('pending_scan_ms');
      // lembrete que já entrou na fila hoje (mesma chave de dedupe da fila) não é montado de novo — rodar a rotina 2× no dia
      // custava o mesmo que a 1ª vez só para o INSERT bater no unique
      if (todo.length) {
        const keyOf = (t: { c: any; which: ChargeWhich }) => `charge:${t.c.id}:${t.which}:${today}`;
        const queuedToday = new Set((await this.prisma.whatsapp_outbox.findMany({ where: { organization_id: orgId, dedupe_key: { in: todo.map(keyOf) } }, select: { dedupe_key: true } })).map((x) => x.dedupe_key));
        for (let i = todo.length - 1; i >= 0; i--) if (queuedToday.has(keyOf(todo[i]))) todo.splice(i, 1);
      }
      if (todo.length) {
        const customers = new Map((await this.prisma.whatsapp_customers.findMany({ where: { organization_id: orgId, id: { in: [...new Set(todo.map((t) => t.c.customer_id))] } } })).map((x) => [x.id, x] as [string, any]));
        const varsOf = await this.crm.varsForCustomers(orgId, [...customers.values()]).catch(() => new Map<string, Record<string, string>>());
        // em paralelo (6 por vez): cada lembrete monta as variáveis do cliente (várias consultas) e enfileira
        let next = 0;
        const worker = async () => {
          for (;;) {
            const t = todo[next++];
            if (!t) return;
            try { if (await this.enqueueCharge(orgId, t.c, customers.get(t.c.customer_id) || null, t.which, cfg, varsOf.get(t.c.customer_id) || null)) { result.reminders++; result.queued++; } }
            catch (e: any) { if (result.errors.length < 200) result.errors.push(`lembrete ${t.c.id}: ${e?.message || e}`); }
          }
        };
        await Promise.all(Array.from({ length: Math.min(REMINDER_CONCURRENCY, todo.length) }, worker));
      }
      lap('reminders_ms');
      if (pend.length < DAILY_BATCH) break;
    }
    if (overdueKeys.size && cfg.overdue_tag) await this.addOverdueTagBatch(orgId, [...overdueKeys.values()]).catch((e) => result.errors.push(`etiqueta de atraso: ${e?.message || e}`));
    lap('overdue_tag_ms');
    if (result.generated || result.reminders || result.closed || result.resumed || result.readjusted || result.errors.length) this.logger.log(`daily ${orgId}: ${JSON.stringify(result)}`);
    return result;
  }

  /** Vendas unificadas (Configurações → Pagamentos → Vendas). */
  async listSales(orgId: string, status?: string) {
    const where: any = { organization_id: orgId };
    if (status && status !== 'all') where.status = String(status).toUpperCase();
    // C-L2: o que veio da importação (histórico pago e saldo anterior) não é venda feita pelo Pub Mail
    const rows = await this.prisma.whatsapp_charges.findMany({ where: { ...where, origin: { not: 'import' } }, orderBy: { created_at: 'desc' }, take: 2000 });
    const custs = rows.length ? await this.prisma.whatsapp_customers.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.customer_id))] } }, select: { id: true, name: true } }) : [];
    const name = new Map(custs.map((c) => [c.id, c.name]));
    // PIX gerados pelo Fluxo do Bot (whatsapp_payments) também são vendas do canal
    const botRows = await this.prisma.whatsapp_payments.findMany({ where, orderBy: { created_at: 'desc' }, take: 2000 }).catch(() => [] as any[]);
    const smap = rows.length || botRows.length ? await this.presenter.sessionMap(orgId) : new Map<string, any>();
    const crm = rows.map((r) => ({ id: r.id, channel: 'whatsapp', title: r.description, source_name: r.purpose === 'order' ? 'Pedido' : r.purpose === 'appointment' ? 'Agendamento' : r.origin === 'recurring' ? 'Cobrança recorrente' : r.origin === 'bot' ? 'Bot' : 'Cobrança manual', customer: name.get(r.customer_id) || phoneFromJid(r.chat_id) || '—', amount_cents: r.amount_cents, amount_label: formatBRL(r.amount_cents), status: r.status, provider: r.provider, delivered: r.status === 'PAID', paid_at: r.paid_at, created_at: r.created_at, session_id: r.session_id || null, session: (r.session_id && smap.get(r.session_id)) || null }));
    const bot = botRows.map((r: any) => ({ id: r.id, channel: 'whatsapp', title: r.description || 'PIX do bot', source_name: 'Fluxo do Bot (PIX)', customer: phoneFromJid(r.chat_id) || '—', amount_cents: r.amount_cents, amount_label: formatBRL(r.amount_cents), status: r.status, provider: r.provider, delivered: r.status === 'PAID', paid_at: r.paid_at, created_at: r.created_at, session_id: r.session_id || null, session: (r.session_id && smap.get(r.session_id)) || null }));
    return [...crm, ...bot].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}
