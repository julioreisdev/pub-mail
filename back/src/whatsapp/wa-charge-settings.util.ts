// Configurações de cobrança/assinatura da org (`whatsapp_crm_settings.charge`) — normalização PURA,
// usada pelo serviço de cobranças (settings/updateSettings), pelo de assinaturas (textos/juros) e
// pela fila de envio (ritmo). Sem Nest, sem banco.

export type ReminderRules = { before: { enabled: boolean; days: number }; due: { enabled: boolean }; after: { enabled: boolean; days: number }; after2: { enabled: boolean; days: number } };
export type ChargeTexts = {
  charge: string; boleto: string; reminder_before: string; reminder_due: string; reminder_after: string; paid: string; expired: string;
  trial_ending: string; cancel_scheduled: string; canceled: string; paused: string; resumed: string; plan_changed: string; price_changed: string; second_copy: string;
  card: string; card_reminder: string; card_auto: string; card_declined: string;
};
export type ChargeSettings = {
  pix_days: number; // validade do PIX depois do vencimento (dias)
  boleto_days: number; // validade do boleto depois do vencimento (dias)
  default_kind: 'pix' | 'boleto' | 'both';
  days_before_due: number; // cobrança recorrente gerada N dias antes
  auto_recurring: boolean;
  send_qr: boolean;
  overdue_tag: boolean;
  reminders: ReminderRules;
  texts: ChargeTexts;
  // Fase 3
  late_fee_percent: number; // multa (%) aplicada na 2ª via depois do vencimento
  interest_month_percent: number; // juros ao mês (%), pro rata die
  grace_days_default: number; // dias após vencer antes de marcar a assinatura em atraso (produto pode sobrescrever)
  cancel_reasons: string[];
  readjust: { enabled: boolean; percent: number; month: number; notify: boolean };
  outbox_per_minute: number; // ritmo da fila de envio, por número
};

export const DEFAULT_CANCEL_REASONS = ['Está caro', 'Não uso mais', 'Mudei de serviço', 'Problemas no atendimento', 'Outro'];

export const DEFAULT_CHARGE_SETTINGS: ChargeSettings = {
  pix_days: 7,
  boleto_days: 7,
  default_kind: 'pix',
  days_before_due: 5,
  auto_recurring: true,
  send_qr: true,
  overdue_tag: true,
  reminders: { before: { enabled: true, days: 3 }, due: { enabled: true }, after: { enabled: true, days: 1 }, after2: { enabled: true, days: 5 } },
  texts: {
    charge: 'Olá, {{cliente.primeiro_nome}}! 😊\nSegue a cobrança de *{{cobranca.valor}}* referente a *{{cobranca.descricao}}*, com vencimento em *{{cobranca.vencimento}}*.\n\nPara pagar pelo PIX, copie o código abaixo e cole no app do seu banco 👇',
    boleto: 'Se preferir boleto, aqui está o link: {{cobranca.boleto_link}}\nLinha digitável: {{cobranca.boleto_codigo}}',
    reminder_before: 'Oi, {{cliente.primeiro_nome}}! Lembrete: a cobrança de *{{cobranca.valor}}* ({{cobranca.descricao}}) vence em *{{cobranca.vencimento}}*. O PIX copia e cola segue abaixo 👇',
    reminder_due: 'Oi, {{cliente.primeiro_nome}}! A cobrança de *{{cobranca.valor}}* ({{cobranca.descricao}}) *vence hoje*. O PIX copia e cola segue abaixo 👇',
    reminder_after: 'Oi, {{cliente.primeiro_nome}}. A cobrança de *{{cobranca.valor}}* ({{cobranca.descricao}}) venceu em {{cobranca.vencimento}} e ainda consta em aberto. Se já pagou, desconsidere. O PIX segue abaixo 👇',
    paid: 'Pagamento de *{{cobranca.valor}}* confirmado ✅ Obrigado, {{cliente.primeiro_nome}}!',
    expired: 'A cobrança de *{{cobranca.valor}}* ({{cobranca.descricao}}) expirou. Se quiser, respondo com uma nova.',
    trial_ending: 'Oi, {{cliente.primeiro_nome}}! Seu período de teste de *{{assinatura.produto}}* termina em *{{assinatura.fim_teste}}*. A partir daí a mensalidade de *{{assinatura.valor}}* passa a valer. Qualquer dúvida é só responder aqui 🙂',
    cancel_scheduled: 'Cancelamento de *{{assinatura.produto}}* agendado. {{assinatura.fim_texto}} Se mudar de ideia, é só falar com a gente.',
    canceled: 'Sua assinatura de *{{assinatura.produto}}* foi cancelada. Obrigado por ter ficado com a gente, {{cliente.primeiro_nome}}!',
    paused: 'Sua assinatura de *{{assinatura.produto}}* está pausada até *{{assinatura.pausa_ate}}* ⏸️ Nesse período não há cobrança.',
    resumed: 'Sua assinatura de *{{assinatura.produto}}* voltou a valer ✅ Próximo vencimento: *{{assinatura.vencimento}}*.',
    plan_changed: 'Plano alterado para *{{assinatura.produto}}* ({{assinatura.valor}}) ✅ O crédito do período que não foi usado já está descontado na próxima cobrança.',
    price_changed: 'Aviso: a partir do vencimento de {{assinatura.vencimento}} o valor de *{{assinatura.produto}}* passa a ser *{{assinatura.valor}}* (reajuste de {{assinatura.reajuste}}).',
    second_copy: 'Oi, {{cliente.primeiro_nome}}! Segue a 2ª via de *{{cobranca.descricao}}*: {{cobranca.valor_original}} + {{cobranca.dias_atraso}} dia(s) de atraso (multa {{cobranca.multa}} e juros {{cobranca.juros}}) = *{{cobranca.valor}}*. O PIX copia e cola segue abaixo 👇',
    card: 'Olá, {{cliente.primeiro_nome}}! 😊\nSegue a cobrança de *{{cobranca.valor}}* referente a *{{cobranca.descricao}}*, com vencimento em *{{cobranca.vencimento}}*.\n\nPara pagar no cartão, use o link seguro (o número do cartão é digitado na página do banco, não passa por nós): {{cobranca.cartao_link}}',
    card_reminder: 'Oi, {{cliente.primeiro_nome}}! Lembrete da cobrança de *{{cobranca.valor}}* ({{cobranca.descricao}}), vencimento em *{{cobranca.vencimento}}*. Para pagar no cartão: {{cobranca.cartao_link}}',
    card_auto: 'Oi, {{cliente.primeiro_nome}}! A cobrança de *{{cobranca.valor}}* ({{cobranca.descricao}}) será debitada automaticamente no cartão {{cartao.bandeira}} final {{cartao.final}} em *{{cobranca.vencimento}}*. Detalhes: {{cobranca.link}}',
    card_declined: 'Oi, {{cliente.primeiro_nome}}. Não conseguimos cobrar *{{cobranca.valor}}* ({{cobranca.descricao}}) no cartão {{cartao.bandeira}} final {{cartao.final}}. Vamos tentar de novo em {{cartao.proxima}}. Se preferir, pague agora por aqui: {{cobranca.link}}',
  },
  late_fee_percent: 2,
  interest_month_percent: 1,
  grace_days_default: 0,
  cancel_reasons: DEFAULT_CANCEL_REASONS,
  readjust: { enabled: false, percent: 0, month: 1, notify: true },
  outbox_per_minute: 20,
};

export const clampInt = (v: unknown, min: number, max: number, def: number) => { const n = parseInt(String(v), 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
export const clampNum = (v: unknown, min: number, max: number, def: number) => { const n = parseFloat(String(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 100) / 100)) : def; };

/** Régua (lembretes) normalizada; `base` = valores quando faltam. */
export function normalizeReminderRules(raw: unknown, base: ReminderRules = DEFAULT_CHARGE_SETTINGS.reminders): ReminderRules {
  const rem: any = raw && typeof raw === 'object' ? raw : {};
  return {
    before: { enabled: rem.before?.enabled !== undefined ? Boolean(rem.before.enabled) : base.before.enabled, days: clampInt(rem.before?.days, 1, 15, base.before.days) },
    due: { enabled: rem.due?.enabled !== undefined ? Boolean(rem.due.enabled) : base.due.enabled },
    after: { enabled: rem.after?.enabled !== undefined ? Boolean(rem.after.enabled) : base.after.enabled, days: clampInt(rem.after?.days, 1, 30, base.after.days) },
    after2: { enabled: rem.after2?.enabled !== undefined ? Boolean(rem.after2.enabled) : base.after2.enabled, days: clampInt(rem.after2?.days, 2, 60, base.after2.days) },
  };
}

export function normalizeCancelReasons(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_CANCEL_REASONS];
  const out = [...new Set(raw.map((x) => String(x ?? '').trim().slice(0, 80)).filter(Boolean))].slice(0, 20);
  return out.length ? out : [...DEFAULT_CANCEL_REASONS];
}

/** `charge` JSON da org → configurações completas (defaults + clamps). Nunca lança. */
export function normalizeChargeSettings(raw: unknown): ChargeSettings {
  const c: any = raw && typeof raw === 'object' ? raw : {};
  const d = DEFAULT_CHARGE_SETTINGS;
  const tx = c.texts && typeof c.texts === 'object' ? c.texts : {};
  const texts = {} as ChargeTexts;
  for (const k of Object.keys(d.texts) as (keyof ChargeTexts)[]) texts[k] = String(tx[k] ?? d.texts[k]).slice(0, 1500);
  const rj: any = c.readjust && typeof c.readjust === 'object' ? c.readjust : {};
  return {
    pix_days: clampInt(c.pix_days, 1, 30, d.pix_days),
    boleto_days: clampInt(c.boleto_days, 3, 60, d.boleto_days),
    default_kind: ['pix', 'boleto', 'both'].includes(c.default_kind) ? c.default_kind : d.default_kind,
    days_before_due: clampInt(c.days_before_due, 0, 30, d.days_before_due),
    auto_recurring: c.auto_recurring !== false,
    send_qr: c.send_qr !== false,
    overdue_tag: c.overdue_tag !== false,
    reminders: normalizeReminderRules(c.reminders),
    texts,
    late_fee_percent: clampNum(c.late_fee_percent, 0, 20, d.late_fee_percent),
    interest_month_percent: clampNum(c.interest_month_percent, 0, 20, d.interest_month_percent),
    grace_days_default: clampInt(c.grace_days_default, 0, 90, d.grace_days_default),
    cancel_reasons: normalizeCancelReasons(c.cancel_reasons),
    readjust: { enabled: Boolean(rj.enabled), percent: clampNum(rj.percent, 0, 100, 0), month: clampInt(rj.month, 1, 12, 1), notify: rj.notify !== false },
    outbox_per_minute: clampInt(c.outbox_per_minute, 1, 60, d.outbox_per_minute),
  };
}

/** Mescla um DTO de update (chaves ausentes = `undefined` = mantém) sobre as configurações atuais. */
export function mergeChargeSettings(cur: ChargeSettings, dto: any): ChargeSettings {
  const next: any = { ...cur, reminders: { ...cur.reminders }, texts: { ...cur.texts }, readjust: { ...cur.readjust }, cancel_reasons: [...cur.cancel_reasons] };
  if (dto.pix_days !== undefined) next.pix_days = clampInt(dto.pix_days, 1, 30, cur.pix_days);
  if (dto.boleto_days !== undefined) next.boleto_days = clampInt(dto.boleto_days, 3, 60, cur.boleto_days);
  if (dto.default_kind !== undefined && ['pix', 'boleto', 'both'].includes(dto.default_kind)) next.default_kind = dto.default_kind;
  if (dto.days_before_due !== undefined) next.days_before_due = clampInt(dto.days_before_due, 0, 30, cur.days_before_due);
  if (dto.auto_recurring !== undefined) next.auto_recurring = Boolean(dto.auto_recurring);
  if (dto.send_qr !== undefined) next.send_qr = Boolean(dto.send_qr);
  if (dto.overdue_tag !== undefined) next.overdue_tag = Boolean(dto.overdue_tag);
  if (dto.reminders && typeof dto.reminders === 'object') next.reminders = normalizeReminderRules(dto.reminders, cur.reminders);
  if (dto.texts && typeof dto.texts === 'object') for (const k of Object.keys(DEFAULT_CHARGE_SETTINGS.texts) as (keyof ChargeTexts)[]) if (typeof dto.texts[k] === 'string') next.texts[k] = String(dto.texts[k]).slice(0, 1500);
  if (dto.late_fee_percent !== undefined) next.late_fee_percent = clampNum(dto.late_fee_percent, 0, 20, cur.late_fee_percent);
  if (dto.interest_month_percent !== undefined) next.interest_month_percent = clampNum(dto.interest_month_percent, 0, 20, cur.interest_month_percent);
  if (dto.grace_days_default !== undefined) next.grace_days_default = clampInt(dto.grace_days_default, 0, 90, cur.grace_days_default);
  if (dto.cancel_reasons !== undefined) next.cancel_reasons = normalizeCancelReasons(dto.cancel_reasons);
  if (dto.readjust && typeof dto.readjust === 'object') {
    const r = dto.readjust;
    next.readjust = { enabled: r.enabled !== undefined ? Boolean(r.enabled) : cur.readjust.enabled, percent: r.percent !== undefined ? clampNum(r.percent, 0, 100, cur.readjust.percent) : cur.readjust.percent, month: r.month !== undefined ? clampInt(r.month, 1, 12, cur.readjust.month) : cur.readjust.month, notify: r.notify !== undefined ? Boolean(r.notify) : cur.readjust.notify };
  }
  if (dto.outbox_per_minute !== undefined) next.outbox_per_minute = clampInt(dto.outbox_per_minute, 1, 60, cur.outbox_per_minute);
  return next as ChargeSettings;
}
