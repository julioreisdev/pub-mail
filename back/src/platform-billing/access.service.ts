import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ALL_MODULES, ModuleKey, normalizeModules } from './modules.const';

// Estado de acesso de uma ORGANIZAÇÃO (plano/assinatura) e módulos de um USUÁRIO.
//  - plano/pagamento vive em `organization_access` (1 por org);
//  - módulos vivem em `users.modules` (por usuário — na mesma conta um pode ter
//    Configurações e outro não);
//  - números do WhatsApp liberados vivem em `users.whatsapp_sessions` (ids; null = todos;
//    OWNER/ADMIN/SUPER_ADMIN sempre todos — a checagem por rota é do WaAccessService);
//  - SUPER_ADMIN nunca é cobrado nem filtrado (bypass por role, tratado nos consumidores).
// Tudo cacheado 60 s em memória (mesmo padrão do JwtStrategy) e invalidado nos writes.

export type OrgStatus = 'FREE' | 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'BLOCKED';
export const ORG_STATUSES: OrgStatus[] = ['FREE', 'PENDING', 'ACTIVE', 'EXPIRED', 'BLOCKED'];
const BLOCKING: OrgStatus[] = ['PENDING', 'EXPIRED', 'BLOCKED'];
const TTL_MS = 60_000;
const DAY_MS = 86_400_000;
export const EXPIRING_SOON_DAYS = 3;

export type OrgState = {
  status: OrgStatus; // status EFETIVO (ACTIVE vencido já aparece como EXPIRED)
  stored_status: OrgStatus;
  needs_payment: boolean;
  price_cents: number;
  period_days: number | null;
  lifetime: boolean;
  access_until: Date | null;
  days_left: number | null;
  expiring_soon: boolean;
  first_paid_at: Date | null;
  last_paid_at: Date | null;
  notes: string | null;
};

type Cached<T> = { value: T; expiresAt: number };

/** `users.whatsapp_sessions` cru → `string[]` (ids únicos, sem vazios) ou `null` (= todos). */
export function normalizeWhatsAppSessions(raw: unknown): string[] | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) return null; // valor inesperado no JSON = sem restrição (mesma regra do WaAccessService)
  const out: string[] = [];
  for (const v of raw) {
    const id = String(v ?? '').trim();
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

@Injectable()
export class AccessService {
  private readonly logger = new Logger(AccessService.name);
  private readonly orgCache = new Map<string, Cached<any>>();
  private readonly userCache = new Map<string, Cached<{ modules: ModuleKey[]; welcomed: boolean; whatsapp_sessions: string[] | null }>>();

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- cache
  invalidateOrg(orgId?: string) {
    if (orgId) this.orgCache.delete(orgId);
    else this.orgCache.clear();
  }
  invalidateUser(userId?: string) {
    if (userId) this.userCache.delete(userId);
    else this.userCache.clear();
  }
  private sweep<T>(m: Map<string, Cached<T>>) {
    if (m.size < 5000) return;
    const now = Date.now();
    for (const [k, v] of m) if (v.expiresAt <= now) m.delete(k);
  }

  // ---------------------------------------------------------------- leitura
  // Linha crua (ou null). Cacheada.
  private async orgRow(orgId: string) {
    const now = Date.now();
    const c = this.orgCache.get(orgId);
    if (c && c.expiresAt > now) return c.value;
    let row: any = null;
    try {
      row = await this.prisma.organization_access.findUnique({ where: { organization_id: orgId } });
    } catch (e: any) {
      this.logger.warn(`organization_access read falhou org=${orgId}: ${e?.message || e}`);
      if (c) return c.value; // banco instável: usa o último conhecido
      return null;
    }
    this.sweep(this.orgCache);
    this.orgCache.set(orgId, { value: row, expiresAt: now + TTL_MS });
    return row;
  }

  // Estado calculado AO VIVO (não depende do cron ter rodado pra vencer).
  stateOf(row: any, now = new Date()): OrgState {
    const price = Number(row?.price_cents || 0);
    const period = row?.period_days == null ? null : Number(row.period_days);
    const stored = (ORG_STATUSES.includes(row?.status) ? row.status : 'FREE') as OrgStatus;
    const until: Date | null = row?.access_until ? new Date(row.access_until) : null;
    let status: OrgStatus = stored;
    if (status === 'ACTIVE' && until && until.getTime() <= now.getTime()) status = 'EXPIRED';
    const daysLeft = status === 'ACTIVE' && until ? Math.max(0, Math.ceil((until.getTime() - now.getTime()) / DAY_MS)) : null;
    return {
      status,
      stored_status: stored,
      // BLOCKED trava sempre (também conta grátis); os demais só trancam quando há preço.
      needs_payment: status === 'BLOCKED' || (price > 0 && BLOCKING.includes(status)),
      price_cents: price,
      period_days: period,
      lifetime: period == null,
      access_until: until,
      days_left: daysLeft,
      expiring_soon: status === 'ACTIVE' && daysLeft != null && daysLeft <= EXPIRING_SOON_DAYS,
      first_paid_at: row?.first_paid_at || null,
      last_paid_at: row?.last_paid_at || null,
      notes: row?.notes || null,
    };
  }

  async getOrgState(orgId: string): Promise<OrgState> {
    return this.stateOf(await this.orgRow(orgId));
  }

  // Pra runners/rotas públicas: a organização pode operar (crons, webchat/quiz público…)?
  async isOrgActive(orgId: string): Promise<boolean> {
    try {
      return !(await this.getOrgState(orgId)).needs_payment;
    } catch {
      return true; // nunca derruba o serviço por falha de leitura
    }
  }

  async getUserModules(userId: string): Promise<ModuleKey[]> {
    return (await this.userEntry(userId)).modules;
  }

  private async userEntry(userId: string) {
    const now = Date.now();
    const c = this.userCache.get(userId);
    if (c && c.expiresAt > now) return c.value;
    let value = { modules: [] as ModuleKey[], welcomed: false, whatsapp_sessions: null as string[] | null };
    try {
      const u = await this.prisma.users.findUnique({ where: { id: userId }, select: { modules: true, welcomed_at: true, role: true, whatsapp_sessions: true } });
      value = {
        modules: u?.role === 'SUPER_ADMIN' ? ALL_MODULES : normalizeModules(u?.modules),
        welcomed: !!u?.welcomed_at,
        // dono/admin = todos (null), mesmo que a coluna tenha algo gravado
        whatsapp_sessions: AccessService.seesAllWhatsApp(u?.role) ? null : normalizeWhatsAppSessions(u?.whatsapp_sessions),
      };
    } catch (e: any) {
      this.logger.warn(`users.modules read falhou user=${userId}: ${e?.message || e}`);
      return c ? c.value : value; // não cacheia o resultado de uma falha
    }
    this.sweep(this.userCache);
    this.userCache.set(userId, { value, expiresAt: now + TTL_MS });
    return value;
  }

  // Payload de `/auth/me`.
  async forMe(userId: string, orgId: string, role: string) {
    const isSuper = role === 'SUPER_ADMIN';
    const st = isSuper ? this.stateOf(null) : await this.getOrgState(orgId);
    const u = await this.userEntry(userId);
    const modules = isSuper ? ALL_MODULES : u.modules;
    return {
      is_super: isSuper,
      modules,
      // números do WhatsApp que o usuário vê (null = todos os da org)
      whatsapp_sessions: AccessService.seesAllWhatsApp(role) ? null : u.whatsapp_sessions,
      status: st.status,
      needs_payment: isSuper ? false : st.needs_payment,
      // Boas-vindas: 1ª vez, conta gratuita (quem paga já tem a tela de sucesso do PIX).
      welcome_pending: !isSuper && !u.welcomed && st.status === 'FREE',
      price_cents: st.price_cents,
      period_days: st.period_days,
      lifetime: st.lifetime,
      access_until: st.access_until ? st.access_until.toISOString() : null,
      days_left: st.days_left,
      expiring_soon: isSuper ? false : st.expiring_soon,
      last_paid_at: st.last_paid_at ? new Date(st.last_paid_at).toISOString() : null,
    };
  }

  // ---------------------------------------------------------------- escrita
  private validatePlan(priceCents: unknown, periodDays: unknown) {
    const price = Math.round(Number(priceCents));
    if (!Number.isFinite(price) || price < 0) throw new BadRequestException('Preço inválido.');
    if (price > 100_000_00) throw new BadRequestException('Preço acima do limite (R$ 100.000,00).');
    let period: number | null = null;
    if (periodDays !== null && periodDays !== undefined && periodDays !== '') {
      period = Math.round(Number(periodDays));
      if (!Number.isFinite(period) || period < 1 || period > 3650) throw new BadRequestException('Período inválido (1 a 3650 dias).');
    }
    return { price, period };
  }

  // Cria/atualiza o plano da org. Regras (D5): módulos são por usuário (não aqui);
  // preço 0 → FREE na hora; preço > 0 e nunca pagou → PENDING; ACTIVE segue
  // ACTIVE (novo preço/período valem na próxima cobrança).
  async upsertPlan(orgId: string, dto: { price_cents?: unknown; period_days?: unknown; notes?: unknown }, tx?: any) {
    const db = tx || this.prisma;
    const current = await db.organization_access.findUnique({ where: { organization_id: orgId } });
    const { price, period } = this.validatePlan(
      dto.price_cents === undefined ? current?.price_cents ?? 0 : dto.price_cents,
      dto.period_days === undefined ? current?.period_days ?? null : dto.period_days,
    );
    let status: OrgStatus = (current?.status as OrgStatus) || 'FREE';
    const paidOnce = !!current?.first_paid_at;
    if (price === 0) status = 'FREE';
    else if (status === 'FREE') {
      const stillValid = period == null || (current?.access_until && current.access_until > new Date());
      status = paidOnce ? (stillValid ? 'ACTIVE' : 'EXPIRED') : 'PENDING';
    }
    // (PENDING/ACTIVE/EXPIRED/BLOCKED mantêm)
    const data: any = { price_cents: price, period_days: period, status };
    if (dto.notes !== undefined) data.notes = dto.notes == null ? null : String(dto.notes).slice(0, 255) || null;
    const row = await db.organization_access.upsert({
      where: { organization_id: orgId },
      create: { organization_id: orgId, ...data },
      update: data,
    });
    this.invalidateOrg(orgId);
    return this.stateOf(row);
  }

  async setUserModules(userId: string, modules: unknown, tx?: any) {
    const db = tx || this.prisma;
    const mods = normalizeModules(modules);
    await db.users.update({ where: { id: userId }, data: { modules: mods } });
    this.invalidateUser(userId);
    return mods;
  }

  // Números do WhatsApp liberados p/ o usuário. `null` = todos. NÃO valida se os ids são da
  // org do usuário (quem chama — admin — normaliza antes); só grava e invalida o cache daqui.
  // O chamador ainda precisa invalidar o WaAccessService e re-inscrever o socket (RealtimeService).
  async setUserWhatsAppSessions(userId: string, ids: string[] | null | undefined, tx?: any) {
    const db = tx || this.prisma;
    const value = normalizeWhatsAppSessions(ids);
    await db.users.update({ where: { id: userId }, data: { whatsapp_sessions: value === null ? Prisma.DbNull : value } });
    this.invalidateUser(userId);
    return value;
  }

  static seesAllWhatsApp(role?: string | null) {
    return role === 'OWNER' || role === 'ADMIN' || role === 'SUPER_ADMIN';
  }

  async markWelcomed(userId: string) {
    await this.prisma.users.updateMany({ where: { id: userId, welcomed_at: null }, data: { welcomed_at: new Date() } });
    this.invalidateUser(userId);
    return { ok: true };
  }

  // Pagamento confirmado (D3): o período SEMPRE conta do dia do pagamento.
  async markPaid(orgId: string, paidAt: Date, periodDays: number | null) {
    const until = periodDays == null ? null : new Date(paidAt.getTime() + periodDays * DAY_MS);
    const current = await this.prisma.organization_access.findUnique({ where: { organization_id: orgId } });
    // Bloqueio manual do admin prevalece: o pagamento é registrado (access_until/last_paid_at)
    // mas a conta só volta com "Desbloquear" (que calcula ACTIVE a partir do access_until).
    const keepBlocked = current?.status === 'BLOCKED';
    if (keepBlocked) this.logger.warn(`Pagamento recebido de org BLOQUEADA org=${orgId} — permanece bloqueada até desbloqueio manual.`);
    await this.prisma.organization_access.upsert({
      where: { organization_id: orgId },
      create: { organization_id: orgId, status: 'ACTIVE', access_until: until, first_paid_at: paidAt, last_paid_at: paidAt },
      update: { status: keepBlocked ? 'BLOCKED' : 'ACTIVE', access_until: until, last_paid_at: paidAt, ...(current?.first_paid_at ? {} : { first_paid_at: paidAt }) },
    });
    this.invalidateOrg(orgId);
    this.logger.log(`Acesso ATIVO org=${orgId} até ${until ? until.toISOString() : 'vitalício'}`);
    return this.getOrgState(orgId);
  }

  // Cron (1x/hora): ACTIVE vencido → EXPIRED (o estado ao vivo já bloqueia antes disso).
  async expireDue() {
    const r = await this.prisma.organization_access.updateMany({
      where: { status: 'ACTIVE', access_until: { not: null, lte: new Date() } },
      data: { status: 'EXPIRED' },
    });
    if (r.count > 0) {
      this.invalidateOrg();
      this.logger.log(`${r.count} acesso(s) expirado(s).`);
    }
    return r.count;
  }

  // ---- ações do superadmin ----
  // Org sem linha (ex.: cadastro público via /auth/register) = FREE — cria a linha default.
  private async requireRow(orgId: string) {
    const org = await this.prisma.organizations.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!org) throw new NotFoundException('Organização não encontrada.');
    return this.prisma.organization_access.upsert({
      where: { organization_id: orgId },
      create: { organization_id: orgId, price_cents: 0, period_days: null, status: 'FREE' },
      update: {},
    });
  }

  // Estende N dias a partir do vencimento atual (ou de agora, se já venceu). Reativa.
  async extend(orgId: string, days: unknown) {
    const n = Math.round(Number(days));
    if (!Number.isFinite(n) || n < 1 || n > 3650) throw new BadRequestException('Dias inválidos (1 a 3650).');
    const row = await this.requireRow(orgId);
    if (row.price_cents > 0 && row.period_days == null) throw new BadRequestException('Plano vitalício não tem vencimento para estender.');
    if (row.status === 'BLOCKED') throw new BadRequestException('Conta bloqueada: desbloqueie antes de estender.');
    const now = new Date();
    const base = row.access_until && row.access_until > now ? row.access_until : now;
    const until = new Date(base.getTime() + n * DAY_MS);
    await this.prisma.organization_access.update({
      where: { organization_id: orgId },
      // Estender uma conta que nunca pagou = conceder acesso (first_paid_at marca isso;
      // senão um bloqueio/desbloqueio depois a devolveria pra PENDING).
      data: { status: row.price_cents > 0 ? 'ACTIVE' : 'FREE', access_until: row.price_cents > 0 ? until : null, ...(row.first_paid_at ? {} : { first_paid_at: now }) },
    });
    this.invalidateOrg(orgId);
    return this.getOrgState(orgId);
  }

  async block(orgId: string) {
    await this.requireRow(orgId);
    await this.prisma.organization_access.update({ where: { organization_id: orgId }, data: { status: 'BLOCKED' } });
    this.invalidateOrg(orgId);
    return this.getOrgState(orgId);
  }

  async unblock(orgId: string) {
    const row = await this.requireRow(orgId);
    let status: OrgStatus = 'FREE';
    if (row.price_cents > 0) {
      if (!row.first_paid_at) status = 'PENDING';
      else if (row.period_days == null || (row.access_until && row.access_until > new Date())) status = 'ACTIVE';
      else status = 'EXPIRED';
    }
    await this.prisma.organization_access.update({ where: { organization_id: orgId }, data: { status } });
    this.invalidateOrg(orgId);
    return this.getOrgState(orgId);
  }
}
