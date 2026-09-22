import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as tg from './telegram-api.util';
import { createPixCharge, getChargeStatus, testProvider, KNOWN_PROVIDERS } from './telegram-payment-providers';
import { TelegramRotatorsRunner } from './telegram-rotators.runner';

const BRL = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100);
const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const maskToken = (t?: string | null) => (t ? `${t.slice(0, 4)}••••${t.slice(-4)}` : '');
const fmtDate = (d: any) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(d));
const DAY = 24 * 3600 * 1000;

// Config editável das mensagens do checkout (com defaults).
const DEFAULT_CHECKOUT = {
  send_qr: true,
  send_pix_separate: true,
  instruction_text: '💎 <b>{plano}</b> — <b>{valor}</b>\n\nPague com <b>PIX</b> e toque em ✅ Já paguei para liberar seu acesso.',
  pix_message_text: '📋 PIX copia e cola (toque no código para copiar):',
  copy_button_text: '📋 Copiar código PIX', // botão nativo que copia o código ao toque (vazio = sem botão)
  paid_button: '✅ Já paguei',
  cancel_button: '❌ Cancelar',
  pending_text: '⏳ Ainda não identificamos seu pagamento. Se você já pagou, aguarde alguns segundos e toque em "Já paguei" de novo. Se ainda não pagou, use o PIX acima.',
  expired_text: '⌛ Esta cobrança expirou. Toque em "Gerar novo PIX" para tentar de novo.',
};

function mergeCheckout(raw: any) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const str = (v: any, def: string, max = 3000) => (typeof v === 'string' && v.trim() ? String(v).slice(0, max) : def);
  const bool = (v: any, def: boolean) => (typeof v === 'boolean' ? v : def);
  return {
    send_qr: bool(c.send_qr, DEFAULT_CHECKOUT.send_qr),
    send_pix_separate: bool(c.send_pix_separate, DEFAULT_CHECKOUT.send_pix_separate),
    instruction_text: str(c.instruction_text, DEFAULT_CHECKOUT.instruction_text),
    pix_message_text: str(c.pix_message_text, DEFAULT_CHECKOUT.pix_message_text, 500),
    copy_button_text: typeof c.copy_button_text === 'string' ? String(c.copy_button_text).slice(0, 64) : DEFAULT_CHECKOUT.copy_button_text,
    paid_button: str(c.paid_button, DEFAULT_CHECKOUT.paid_button, 64),
    cancel_button: str(c.cancel_button, DEFAULT_CHECKOUT.cancel_button, 64),
    pending_text: str(c.pending_text, DEFAULT_CHECKOUT.pending_text),
    expired_text: str(c.expired_text, DEFAULT_CHECKOUT.expired_text),
  };
}

@Injectable()
export class TelegramPaymentsService {
  private readonly logger = new Logger(TelegramPaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rotators: TelegramRotatorsRunner,
  ) {}

  private baseUrl() {
    return (process.env.PUBLIC_API_URL || 'https://api.bluewebchat.online').replace(/\/$/, '');
  }

  // -------------------------------- Settings --------------------------------
  async getSettings(orgId: string) {
    const s = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: orgId } });
    return {
      provider: s?.provider || 'mercadopago',
      active: s?.active ?? false,
      has_token: !!s?.access_token,
      token_masked: maskToken(s?.access_token),
      pix_key: s?.pix_key || '',
      checkout: mergeCheckout(s?.checkout_config),
      webhook_url: `${this.baseUrl()}/telegram/payments/webhook/${s?.provider || 'mercadopago'}`,
    };
  }

  async saveSettings(orgId: string, dto: any) {
    // update PARCIAL: só mexe nos campos enviados (salvar "mensagens" não zera o gateway e vice-versa).
    const data: any = {};
    if (dto?.provider !== undefined) data.provider = KNOWN_PROVIDERS.includes(dto.provider) ? dto.provider : 'mercadopago';
    if (dto?.active !== undefined) data.active = !!dto.active;
    if (dto?.pix_key !== undefined) data.pix_key = dto.pix_key ? String(dto.pix_key).slice(0, 255) : null;
    if (dto?.checkout !== undefined) data.checkout_config = mergeCheckout(dto.checkout);
    // só sobrescreve o token se veio um novo não-mascarado; remove espaços/quebras/lixo
    if (dto?.access_token && !String(dto.access_token).includes('••')) {
      data.access_token = String(dto.access_token)
        .split('')
        .filter((c) => c.charCodeAt(0) > 32 && c.charCodeAt(0) !== 127)
        .join('');
    }
    await this.prisma.telegram_payment_settings.upsert({
      where: { organization_id: orgId },
      create: {
        organization_id: orgId,
        provider: data.provider || 'mercadopago',
        active: data.active ?? true,
        pix_key: data.pix_key ?? null,
        access_token: data.access_token || null,
        checkout_config: data.checkout_config ?? null,
      },
      update: data,
    });
    return this.getSettings(orgId);
  }

  async testSettings(orgId: string) {
    const s = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: orgId } });
    if (!s?.access_token) throw new BadRequestException('Cadastre a credencial do gateway primeiro.');
    const r = await testProvider(s.provider, s.access_token);
    return { ok: r.ok, detail: r.detail, provider: s.provider };
  }

  private async requireSettings(orgId: string) {
    const s = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: orgId } });
    if (!s || !s.active || !s.access_token) return null;
    return s;
  }

  // --------------------------------- Plans ----------------------------------
  private mapPlan(p: any, group?: any) {
    return {
      id: p.id,
      bot_id: p.bot_id,
      name: p.name,
      description: p.description || '',
      price_cents: p.price_cents,
      price_label: BRL(p.price_cents),
      duration_days: p.duration_days || 0,
      duration_label: p.duration_days > 0 ? `${p.duration_days} dias` : 'vitalício',
      deliver_group_id: p.deliver_group_id,
      deliver_group: group ? { id: group.id, title: group.title, type: group.type } : null,
      deliver_message: p.deliver_message || '',
      deliver_media: p.deliver_media || null,
      active: p.active,
      position: p.position,
    };
  }

  async listPlans(orgId: string, botId?: string) {
    const rows = await this.prisma.telegram_plans.findMany({
      where: { organization_id: orgId, ...(botId && botId !== 'all' ? { bot_id: botId } : {}) },
      orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
    });
    const gids = [...new Set(rows.map((r) => r.deliver_group_id).filter(Boolean) as string[])];
    const grps = gids.length ? await this.prisma.telegram_groups.findMany({ where: { id: { in: gids } }, select: { id: true, title: true, type: true } }) : [];
    const gmap = new Map(grps.map((g) => [g.id, g]));
    return rows.map((p) => this.mapPlan(p, p.deliver_group_id ? gmap.get(p.deliver_group_id) : undefined));
  }

  private async validatePlanInputs(orgId: string, dto: any, requireBot: boolean) {
    const out: any = {};
    if (dto.name !== undefined) out.name = String(dto.name || 'Plano').slice(0, 255);
    if (dto.description !== undefined) out.description = dto.description ? String(dto.description).slice(0, 4000) : null;
    if (dto.price_cents !== undefined) out.price_cents = Math.max(0, Math.round(Number(dto.price_cents) || 0));
    if (dto.duration_days !== undefined) out.duration_days = Math.max(0, Math.min(3650, parseInt(dto.duration_days, 10) || 0));
    if (dto.active !== undefined) out.active = !!dto.active;
    if (dto.position !== undefined) out.position = parseInt(dto.position, 10) || 0;
    if (dto.deliver_message !== undefined) out.deliver_message = dto.deliver_message ? String(dto.deliver_message).slice(0, 4000) : null;
    if (dto.deliver_media !== undefined) out.deliver_media = dto.deliver_media && dto.deliver_media.url ? { type: dto.deliver_media.type, url: dto.deliver_media.url, name: dto.deliver_media.name || null } : null;
    if (dto.bot_id !== undefined || requireBot) {
      const bot = await this.prisma.telegram_bots.findFirst({ where: { id: String(dto.bot_id || ''), organization_id: orgId }, select: { id: true } });
      if (!bot) throw new BadRequestException('Bot inválido.');
      out.bot_id = bot.id;
    }
    if (dto.deliver_group_id !== undefined) {
      if (!dto.deliver_group_id) out.deliver_group_id = null;
      else {
        const grp = await this.prisma.telegram_groups.findFirst({ where: { id: String(dto.deliver_group_id), organization_id: orgId }, select: { id: true } });
        if (!grp) throw new BadRequestException('Grupo/canal de entrega inválido.');
        out.deliver_group_id = grp.id;
      }
    }
    return out;
  }

  async createPlan(orgId: string, dto: any) {
    const data = await this.validatePlanInputs(orgId, dto, true);
    if (!data.price_cents) throw new BadRequestException('Informe o valor do plano.');
    const p = await this.prisma.telegram_plans.create({
      data: {
        organization_id: orgId,
        bot_id: data.bot_id,
        name: data.name || 'Plano',
        description: data.description ?? null,
        price_cents: data.price_cents,
        duration_days: data.duration_days ?? 0,
        deliver_group_id: data.deliver_group_id ?? null,
        deliver_message: data.deliver_message ?? null,
        deliver_media: data.deliver_media ?? null,
        active: data.active ?? true,
        position: data.position ?? 0,
      },
    });
    return this.mapPlan(p);
  }

  async updatePlan(orgId: string, id: string, dto: any) {
    const existing = await this.prisma.telegram_plans.findFirst({ where: { id, organization_id: orgId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Plano não encontrado.');
    const data = await this.validatePlanInputs(orgId, dto, false);
    const p = await this.prisma.telegram_plans.update({ where: { id }, data });
    return this.mapPlan(p);
  }

  async removePlan(orgId: string, id: string) {
    const existing = await this.prisma.telegram_plans.findFirst({ where: { id, organization_id: orgId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Plano não encontrado.');
    await this.prisma.telegram_plans.delete({ where: { id } });
    return { ok: true, id };
  }

  // -------------------------------- Payments (lista) -------------------------
  async listPayments(orgId: string, opts: any = {}) {
    const where: any = { organization_id: orgId };
    if (opts.status && opts.status !== 'all') where.status = String(opts.status).toUpperCase();
    if (opts.bot_id && opts.bot_id !== 'all') where.bot_id = opts.bot_id;
    const page = Math.max(1, parseInt(opts.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(5, parseInt(opts.page_size, 10) || 15));
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.telegram_payments.count({ where }),
      this.prisma.telegram_payments.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    const planIds = [...new Set(rows.map((r) => r.plan_id).filter(Boolean) as string[])];
    const plans = planIds.length ? await this.prisma.telegram_plans.findMany({ where: { id: { in: planIds } }, select: { id: true, name: true } }) : [];
    const pmap = new Map(plans.map((p) => [p.id, p.name]));
    const stats = await this.prisma.telegram_payments.groupBy({ by: ['status'], where: { organization_id: orgId }, _count: { _all: true }, _sum: { amount_cents: true } });
    const paidSum = stats.find((s) => s.status === 'PAID')?._sum.amount_cents || 0;
    return {
      items: rows.map((r) => ({
        id: r.id,
        plan_name: r.plan_id ? pmap.get(r.plan_id) || '—' : '—',
        tg_user_id: String(r.tg_user_id),
        amount_label: BRL(r.amount_cents),
        status: r.status,
        provider: r.provider,
        delivered: r.delivered,
        paid_at: r.paid_at,
        created_at: r.created_at,
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / pageSize)),
      revenue_paid: BRL(paidSum),
      paid_count: stats.find((s) => s.status === 'PAID')?._count._all || 0,
    };
  }

  // ----------------------------- Runtime helpers -----------------------------
  private async botToken(botId: string): Promise<string | null> {
    const bot = await this.prisma.telegram_bots.findUnique({ where: { id: botId }, select: { token: true, status: true } });
    return bot && bot.status !== 'BANNED' ? bot.token : null;
  }

  // Envia a lista de planos ativos como botões (callback pay:<id>).
  async sendPlanList(bot: { id: string; organization_id: string }, chatId: number | string) {
    const token = await this.botToken(bot.id);
    if (!token) return;
    const plans = await this.prisma.telegram_plans.findMany({
      where: { organization_id: bot.organization_id, bot_id: bot.id, active: true },
      orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
    });
    if (!plans.length) {
      await tg.sendMessage(token, chatId, 'Nenhum plano disponível no momento.', {});
      return;
    }
    const keyboard = plans.map((p) => [{ text: `${p.name} — ${BRL(p.price_cents)}`, callback_data: `pay:${p.id}` }]);
    await tg.sendMessage(token, chatId, '💎 <b>Escolha seu plano:</b>', { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
  }

  // Cria a cobrança PIX e envia as instruções + botão "Já paguei".
  async startCharge(bot: { id: string; organization_id: string }, planId: string, tgUserId: number | string, chatId: number | string) {
    const token = await this.botToken(bot.id);
    if (!token) return;
    const settings = await this.requireSettings(bot.organization_id);
    if (!settings) {
      await tg.sendMessage(token, chatId, '⚠️ Pagamento indisponível no momento. Fale com o suporte.', {});
      return;
    }
    const plan = await this.prisma.telegram_plans.findFirst({ where: { id: planId, organization_id: bot.organization_id, bot_id: bot.id, active: true } });
    if (!plan) {
      await tg.sendMessage(token, chatId, 'Plano indisponível.', {});
      return;
    }

    const contact = await this.prisma.telegram_contacts.findFirst({ where: { bot_id: bot.id, tg_user_id: BigInt(tgUserId) }, select: { id: true, first_name: true } });
    await tg.sendChatAction(token, chatId, 'typing').catch(() => undefined);

    const charge = await createPixCharge(settings.provider, settings.access_token!, plan.price_cents, `${plan.name}`.slice(0, 200), {
      tgUserId,
      name: contact?.first_name || 'Lead',
      webhookUrl: `${this.baseUrl()}/telegram/payments/webhook/${settings.provider}`,
    });
    if (!charge.ok || !charge.pixCode) {
      this.logger.warn(`createPixCharge falhou: ${charge.error}`);
      await tg.sendMessage(token, chatId, '❌ Não consegui gerar o PIX agora. Tente novamente em instantes.', {});
      return;
    }

    const payment = await this.prisma.telegram_payments.create({
      data: {
        organization_id: bot.organization_id,
        bot_id: bot.id,
        plan_id: plan.id,
        tg_user_id: BigInt(tgUserId),
        contact_id: contact?.id || null,
        provider: settings.provider,
        provider_charge_id: charge.chargeId || null,
        amount_cents: plan.price_cents,
        status: 'PENDING',
        pix_code: charge.pixCode,
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    const cfg = mergeCheckout((settings as any).checkout_config);
    const interp = (t: string) => String(t || '').replace(/\{plano\}/g, esc(plan.name)).replace(/\{valor\}/g, BRL(plan.price_cents));
    const caption = interp(cfg.instruction_text);
    // <pre> renderiza o código num bloco com botão "copiar" nativo do Telegram (na própria bolha).
    const pixLine = `<pre>${esc(charge.pixCode)}</pre>`;
    // botão copy_text (Bot API 8.0): copia o código ao toque, com rótulo próprio. Vazio ⇒ sem botão.
    const copyRow = cfg.copy_button_text.trim()
      ? [[{ text: cfg.copy_button_text, copy_text: { text: charge.pixCode } }]]
      : [];
    const markup = {
      inline_keyboard: [
        ...copyRow,
        [{ text: cfg.paid_button, callback_data: `paycheck:${payment.id}` }],
        [{ text: cfg.cancel_button, callback_data: `paycancel:${payment.id}` }],
      ],
    };

    let messageId: number | null = null;
    let isPhoto = false;

    // 1) QR code (opcional). Os botões ficam aqui só se o PIX NÃO vai em mensagem separada.
    if (cfg.send_qr && charge.qrBase64) {
      try {
        const buf = Buffer.from(charge.qrBase64, 'base64');
        const qrCap = cfg.send_pix_separate ? caption : `${caption}\n\n${pixLine}`;
        const kb = cfg.send_pix_separate ? {} : { reply_markup: markup };
        const res = await tg.sendPhoto(token, chatId, buf, 'pix.png', qrCap, { parse_mode: 'HTML', ...kb });
        if (res.ok && !cfg.send_pix_separate) {
          messageId = res.result?.message_id || null;
          isPhoto = true;
        }
      } catch {
        /* segue pro fallback */
      }
    } else if (!cfg.send_pix_separate) {
      // sem QR e sem PIX separado → instrução + código + botões numa mensagem só
      const res = await tg.sendMessage(token, chatId, `${caption}\n\n${pixLine}`, { parse_mode: 'HTML', reply_markup: markup });
      if (res.ok) messageId = res.result?.message_id || null;
    } else {
      // sem QR, com PIX separado → só a instrução (os botões vão na msg do PIX)
      await tg.sendMessage(token, chatId, caption, { parse_mode: 'HTML' }).catch(() => undefined);
    }

    // 2) PIX em DUAS mensagens: (a) o rótulo, (b) SÓ o código (fácil de copiar) + botões
    if (cfg.send_pix_separate) {
      const label = interp(cfg.pix_message_text);
      if (label.trim()) await tg.sendMessage(token, chatId, label, { parse_mode: 'HTML' }).catch(() => undefined);
      const res = await tg.sendMessage(token, chatId, pixLine, { parse_mode: 'HTML', reply_markup: markup });
      if (res.ok) {
        messageId = res.result?.message_id || null;
        isPhoto = false;
      }
    }

    // fallback: garante que os botões foram enviados mesmo se o QR falhou
    if (!messageId) {
      const res = await tg.sendMessage(token, chatId, `${caption}\n\n${pixLine}`, { parse_mode: 'HTML', reply_markup: markup });
      messageId = res.ok ? res.result?.message_id || null : null;
    }

    if (messageId) {
      await this.prisma.telegram_payments.update({ where: { id: payment.id }, data: { tg_message_id: BigInt(messageId), tg_message_is_photo: isPhoto } }).catch(() => undefined);
    }

    // empurra a mensagem rotativa (se houver) pra baixo do PIX recém-enviado
    await this.rotators.bumpForContact(bot.id, tgUserId).catch(() => undefined);
  }

  // Envia a mensagem de "ainda não caiu" (com botão de verificar de novo). Usado no /paycheck.
  async sendNotPaidNudge(paymentId: string, expired = false) {
    const payment = await this.prisma.telegram_payments.findUnique({ where: { id: paymentId } });
    if (!payment) return;
    const token = await this.botToken(payment.bot_id);
    if (!token) return;
    const settings = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: payment.organization_id } });
    const cfg = mergeCheckout((settings as any)?.checkout_config);
    const text = expired ? cfg.expired_text : cfg.pending_text;
    // se ainda dá pra pagar, oferece verificar de novo; se expirou, oferece comprar de novo
    const markup =
      !expired && payment.status === 'PENDING'
        ? { inline_keyboard: [[{ text: cfg.paid_button, callback_data: `paycheck:${payment.id}` }]] }
        : payment.plan_id
          ? { inline_keyboard: [[{ text: '🔄 Gerar novo PIX', callback_data: `pay:${payment.plan_id}` }]] }
          : {};
    // apaga o aviso anterior (mantém só UM por vez, sem sujar o chat)
    if ((payment as any).nudge_message_id) {
      await tg.deleteMessage(token, String(payment.tg_user_id), Number((payment as any).nudge_message_id)).catch(() => undefined);
    }
    const sent = await tg.sendMessage(token, String(payment.tg_user_id), text, { parse_mode: 'HTML', ...markup });
    await this.prisma.telegram_payments
      .update({ where: { id: payment.id }, data: { nudge_message_id: sent.ok && sent.result?.message_id ? BigInt(sent.result.message_id) : null } })
      .catch(() => undefined);
  }

  // Consulta o status no gateway; se pago, entrega. Retorna o status normalizado.
  async checkPayment(paymentId: string, opts: { answerChatId?: number | string } = {}) {
    const payment = await this.prisma.telegram_payments.findUnique({ where: { id: paymentId } });
    if (!payment) return 'NOT_FOUND';
    if (payment.status === 'PAID' && payment.delivered) return 'PAID';

    const settings = await this.prisma.telegram_payment_settings.findUnique({ where: { organization_id: payment.organization_id } });
    if (!settings?.access_token || !payment.provider_charge_id) return payment.status;

    const st = await getChargeStatus(payment.provider, settings.access_token, payment.provider_charge_id);
    if (!st.ok || !st.status) return payment.status;

    if (st.status === 'PAID') {
      await this.markPaidAndDeliver(payment);
      return 'PAID';
    }
    if (st.status !== payment.status) {
      await this.prisma.telegram_payments.update({ where: { id: payment.id }, data: { status: st.status } }).catch(() => undefined);
    }
    return st.status;
  }

  // Webhook: acha a cobrança pelo id do gateway e entrega se estiver paga.
  async handleWebhookCharge(provider: string, chargeId: string) {
    const payment = await this.prisma.telegram_payments.findFirst({ where: { provider, provider_charge_id: chargeId }, orderBy: { created_at: 'desc' } });
    if (!payment) return;
    await this.checkPayment(payment.id);
  }

  private async markPaidAndDeliver(payment: any) {
    // idempotência: marca PAID uma vez; entrega uma vez
    if (payment.status !== 'PAID') {
      await this.prisma.telegram_payments.update({ where: { id: payment.id }, data: { status: 'PAID', paid_at: new Date() } }).catch(() => undefined);
    }
    const fresh = await this.prisma.telegram_payments.findUnique({ where: { id: payment.id } });
    if (!fresh || fresh.delivered) return;
    await this.deliver(fresh);
  }

  private async deliver(payment: any) {
    const token = await this.botToken(payment.bot_id);
    if (!token) return;
    const chatId = String(payment.tg_user_id);
    const plan = payment.plan_id ? await this.prisma.telegram_plans.findUnique({ where: { id: payment.plan_id } }) : null;

    // 1) link de convite de uso único p/ o grupo/canal VIP
    let invite: string | null = null;
    if (plan?.deliver_group_id) {
      const grp = await this.prisma.telegram_groups.findUnique({ where: { id: plan.deliver_group_id }, select: { tg_chat_id: true } });
      if (grp) {
        const r = await tg.createChatInviteLink(token, String(grp.tg_chat_id), 'VIP', { member_limit: 1, expire_date: Math.floor(Date.now() / 1000) + 3 * 24 * 3600 });
        if (r.ok) invite = r.result?.invite_link || null;
      }
    }

    // 2) assinatura por tempo (se o plano tem duração) — estende a partir do fim atual
    const accessUntil = await this.grantSubscription(payment, plan);

    // 3) mensagem de confirmação + entrega
    let msg = '✅ <b>Pagamento confirmado!</b>';
    if (plan?.deliver_message) msg += `\n\n${esc(plan.deliver_message)}`;
    if (invite) msg += `\n\n🔓 Seu acesso: ${invite}`;
    if (accessUntil) msg += `\n\n⏳ Acesso válido até <b>${fmtDate(accessUntil)}</b>.`;
    if (plan?.deliver_media && (plan.deliver_media as any).url) {
      const media: any = plan.deliver_media;
      await tg.sendMediaUrl(token, chatId, media.type, media.url, undefined, {}).catch(() => undefined);
    }
    await tg.sendMessage(token, chatId, msg, { parse_mode: 'HTML', disable_web_page_preview: false }).catch(() => undefined);

    // 3) atualiza a mensagem de cobrança (some o botão)
    if (payment.tg_message_id) {
      const mid = Number(payment.tg_message_id);
      const paidCaption = '✅ <b>Pagamento confirmado!</b> Acesso liberado no chat. 🎉';
      if (payment.tg_message_is_photo) {
        await tg.editMessageCaption(token, chatId, mid, paidCaption, { parse_mode: 'HTML' }).catch(() => undefined);
        await tg.editMessageReplyMarkup(token, chatId, mid, { inline_keyboard: [] }).catch(() => undefined);
      } else {
        await tg.editMessageText(token, chatId, mid, paidCaption, { parse_mode: 'HTML' }).catch(() => undefined);
      }
    }

    await this.prisma.telegram_payments.update({ where: { id: payment.id }, data: { delivered: true, delivered_at: new Date(), invite_link: invite } }).catch(() => undefined);

    // limpa o aviso de "não pagou" (obsoleto após confirmar) e empurra a rotativa pra baixo da confirmação
    if (payment.nudge_message_id) await tg.deleteMessage(token, chatId, Number(payment.nudge_message_id)).catch(() => undefined);
    await this.rotators.bumpForContact(payment.bot_id, payment.tg_user_id).catch(() => undefined);
  }

  // Cria/estende a assinatura por tempo. Estende a partir do fim atual (se ainda válido) ou de agora.
  private async grantSubscription(payment: any, plan: any): Promise<Date | null> {
    if (!plan || !plan.duration_days || plan.duration_days <= 0) return null;
    const existing = await this.prisma.telegram_subscriptions.findFirst({
      where: { bot_id: payment.bot_id, tg_user_id: payment.tg_user_id, plan_id: plan.id },
      orderBy: { created_at: 'desc' },
    });
    const now = Date.now();
    const cur = existing?.access_until ? new Date(existing.access_until).getTime() : 0;
    const base = cur > now ? cur : now;
    const until = new Date(base + plan.duration_days * DAY);
    const data: any = {
      status: 'ACTIVE',
      access_until: until,
      last_payment_id: payment.id,
      group_id: plan.deliver_group_id || null,
      contact_id: payment.contact_id || null,
      reminded_at: null,
    };
    if (existing) await this.prisma.telegram_subscriptions.update({ where: { id: existing.id }, data }).catch(() => undefined);
    else
      await this.prisma.telegram_subscriptions
        .create({ data: { organization_id: payment.organization_id, bot_id: payment.bot_id, plan_id: plan.id, tg_user_id: payment.tg_user_id, ...data } })
        .catch(() => undefined);
    return until;
  }

  // Runner: lembra renovação (2 dias antes) e expira (remove do VIP) as vencidas.
  async processSubscriptions() {
    const now = Date.now();
    const expired = await this.prisma.telegram_subscriptions.findMany({ where: { status: 'ACTIVE', access_until: { lte: new Date(now) } }, take: 200 });
    for (const s of expired) await this.expireSubscription(s).catch(() => undefined);

    const soon = await this.prisma.telegram_subscriptions.findMany({
      where: {
        status: 'ACTIVE',
        access_until: { gt: new Date(now), lte: new Date(now + 2 * DAY) },
        OR: [{ reminded_at: null }, { reminded_at: { lte: new Date(now - DAY) } }],
      },
      take: 200,
    });
    for (const s of soon) await this.remindSubscription(s).catch(() => undefined);
  }

  private async renewMarkup(planId?: string | null) {
    if (!planId) return {};
    const plan = await this.prisma.telegram_plans.findUnique({ where: { id: planId } });
    if (!plan || !plan.active) return {};
    return { reply_markup: { inline_keyboard: [[{ text: `🔓 Renovar — ${BRL(plan.price_cents)}`, callback_data: `pay:${plan.id}` }]] } };
  }

  private async expireSubscription(s: any) {
    await this.prisma.telegram_subscriptions.update({ where: { id: s.id }, data: { status: 'EXPIRED' } }).catch(() => undefined);
    const token = await this.botToken(s.bot_id);
    if (!token) return;
    if (s.group_id) {
      const grp = await this.prisma.telegram_groups.findUnique({ where: { id: s.group_id }, select: { tg_chat_id: true } });
      if (grp) {
        // kick + unban = remove agora, mas permite voltar ao renovar
        await tg.banChatMember(token, String(grp.tg_chat_id), String(s.tg_user_id)).catch(() => undefined);
        await tg.unbanChatMember(token, String(grp.tg_chat_id), String(s.tg_user_id)).catch(() => undefined);
      }
    }
    const markup = await this.renewMarkup(s.plan_id);
    await tg.sendMessage(token, String(s.tg_user_id), '⛔ <b>Seu acesso VIP expirou.</b> Renove para voltar:', { parse_mode: 'HTML', ...markup }).catch(() => undefined);
  }

  private async remindSubscription(s: any) {
    const token = await this.botToken(s.bot_id);
    if (!token) {
      await this.prisma.telegram_subscriptions.update({ where: { id: s.id }, data: { reminded_at: new Date() } }).catch(() => undefined);
      return;
    }
    const markup = await this.renewMarkup(s.plan_id);
    await tg.sendMessage(token, String(s.tg_user_id), `⏳ Seu acesso VIP vence em <b>${fmtDate(s.access_until)}</b>. Renove para não perder:`, { parse_mode: 'HTML', ...markup }).catch(() => undefined);
    await this.prisma.telegram_subscriptions.update({ where: { id: s.id }, data: { reminded_at: new Date() } }).catch(() => undefined);
  }

  async listSubscriptions(orgId: string, opts: any = {}) {
    const where: any = { organization_id: orgId };
    if (opts.status && opts.status !== 'all') where.status = String(opts.status).toUpperCase();
    if (opts.bot_id && opts.bot_id !== 'all') where.bot_id = opts.bot_id;
    const page = Math.max(1, parseInt(opts.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(5, parseInt(opts.page_size, 10) || 15));
    const [total, rows, active] = await this.prisma.$transaction([
      this.prisma.telegram_subscriptions.count({ where }),
      this.prisma.telegram_subscriptions.findMany({ where, orderBy: { access_until: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.telegram_subscriptions.count({ where: { organization_id: orgId, status: 'ACTIVE' } }),
    ]);
    const planIds = [...new Set(rows.map((r) => r.plan_id).filter(Boolean) as string[])];
    const plans = planIds.length ? await this.prisma.telegram_plans.findMany({ where: { id: { in: planIds } }, select: { id: true, name: true } }) : [];
    const pmap = new Map(plans.map((p) => [p.id, p.name]));
    return {
      items: rows.map((r) => ({
        id: r.id,
        plan_name: r.plan_id ? pmap.get(r.plan_id) || '—' : '—',
        tg_user_id: String(r.tg_user_id),
        status: r.status,
        access_until: r.access_until,
        created_at: r.created_at,
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / pageSize)),
      active_count: active,
    };
  }

  async cancelPayment(paymentId: string) {
    const payment = await this.prisma.telegram_payments.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status === 'PAID') return;
    await this.prisma.telegram_payments.update({ where: { id: paymentId }, data: { status: 'EXPIRED' } }).catch(() => undefined);
    const token = await this.botToken(payment.bot_id);
    if (token && payment.tg_message_id) {
      const mid = Number(payment.tg_message_id);
      const chatId = String(payment.tg_user_id);
      // deixa um botão de "gerar novo PIX" no lugar (não força o usuário a digitar /vip)
      const again = payment.plan_id ? { inline_keyboard: [[{ text: '🔄 Gerar novo PIX', callback_data: `pay:${payment.plan_id}` }]] } : { inline_keyboard: [] };
      if (payment.tg_message_is_photo) {
        await tg.editMessageCaption(token, chatId, mid, '❌ Cobrança cancelada.', { parse_mode: 'HTML' }).catch(() => undefined);
        await tg.editMessageReplyMarkup(token, chatId, mid, again).catch(() => undefined);
      } else {
        await tg.editMessageText(token, chatId, mid, '❌ Cobrança cancelada.', { parse_mode: 'HTML', reply_markup: again }).catch(() => undefined);
      }
    }
  }

  // Runner: reconcilia pendentes (rede de segurança do webhook) e expira as velhas.
  async reconcilePending() {
    const pend = await this.prisma.telegram_payments.findMany({
      where: { status: 'PENDING' },
      orderBy: { created_at: 'asc' },
      take: 200,
    });
    for (const p of pend) {
      if (p.expires_at && new Date(p.expires_at).getTime() < Date.now()) {
        await this.prisma.telegram_payments.update({ where: { id: p.id }, data: { status: 'EXPIRED' } }).catch(() => undefined);
        await this.expireMessage(p).catch(() => undefined);
        continue;
      }
      await this.checkPayment(p.id).catch(() => undefined);
    }
  }

  // Ao expirar (via poller), edita a mensagem do PIX para "expirou" + botão de gerar novo
  // (o usuário não precisa digitar /vip de novo).
  private async expireMessage(p: any) {
    const token = await this.botToken(p.bot_id);
    if (!token) return;
    const chatId = String(p.tg_user_id);
    const again = p.plan_id ? { inline_keyboard: [[{ text: '🔄 Gerar novo PIX', callback_data: `pay:${p.plan_id}` }]] } : { inline_keyboard: [] };
    if (!p.tg_message_id) {
      await this.sendNotPaidNudge(p.id, true).catch(() => undefined);
      return;
    }
    const mid = Number(p.tg_message_id);
    if (p.tg_message_is_photo) {
      await tg.editMessageCaption(token, chatId, mid, '⌛ Este PIX expirou.', { parse_mode: 'HTML' }).catch(() => undefined);
      await tg.editMessageReplyMarkup(token, chatId, mid, again).catch(() => undefined);
    } else {
      await tg.editMessageText(token, chatId, mid, '⌛ Este PIX expirou.', { parse_mode: 'HTML', reply_markup: again }).catch(() => undefined);
    }
  }
}
