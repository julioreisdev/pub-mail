import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditRoute, ENTITY_META, capJson, diffRows, entityLabel, recordName, sanitize, summaryFor } from './audit-routes.util';

export const REDACTED_SUFFIX = ' (dados removidos — LGPD)';

// ============================================================================
// Auditoria da organização (Fase 8, contrato §12.4) — tabela `org_audit_log`.
// `log()` é best-effort (nunca lança). `capture()` é chamado pelo `OrgAuditInterceptor` DEPOIS da resposta.
// Entidades com linha própria (cliente, produto, assinatura, cobrança, cupom, unidade) guardam antes × depois;
// as demais guardam o corpo saneado (máx. 8 KB). Poda diária: > 400 dias.
// ============================================================================

export type AuditInput = {
  orgId: string;
  userId?: string | null;
  userName?: string | null;
  actor?: 'user' | 'api' | 'system';
  action: string;
  entity?: string | null;
  entityId?: string | null;
  summary?: string | null;
  changes?: unknown;
  method?: string | null;
  path?: string | null;
  status?: number | null;
  ip?: string | null;
};

/** Entidades que têm linha própria (antes × depois). */
const ROW_MODELS: Record<string, string> = {
  customers: 'whatsapp_customers',
  products: 'whatsapp_products',
  subscriptions: 'whatsapp_subscriptions',
  charges: 'whatsapp_charges',
  coupons: 'whatsapp_coupons',
  units: 'whatsapp_units',
};
export const hasRowModel = (entity: string) => Boolean(ROW_MODELS[entity]);

const RETENTION_DAYS = 400;
const PRUNE_BATCH = 5_000;
const NAME_TTL = 5 * 60_000;
const BRT_OFFSET_H = 3; // America/Sao_Paulo sem horário de verão

export type CaptureCtx = {
  route: AuditRoute;
  orgId: string;
  userId: string | null;
  apiKeyId: string | null;
  apiKeyName: string | null;
  method: string;
  path: string;
  status: number;
  ip: string | null;
  body: unknown;
  response: unknown;
  before: Record<string, any> | null;
};

@Injectable()
export class OrgAuditService {
  private readonly logger = new Logger(OrgAuditService.name);
  private readonly names = new Map<string, { name: string | null; at: number }>();
  private readonly keyOwners = new Map<string, { userId: string | null; at: number }>();
  private pruning = false;

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- gravação
  /** Grava uma linha (nunca lança). */
  async log(input: AuditInput): Promise<void> {
    try {
      if (!input?.orgId || !input.action) return;
      const userName = input.userName ?? (input.userId ? await this.userName(input.userId) : null);
      await this.prisma.org_audit_log.create({
        data: {
          organization_id: input.orgId,
          user_id: input.userId || null,
          user_name: userName ? String(userName).slice(0, 160) : null,
          actor: (input.actor || 'user').slice(0, 16),
          action: String(input.action).slice(0, 64),
          entity: input.entity ? String(input.entity).slice(0, 40) : null,
          entity_id: input.entityId ? String(input.entityId).slice(0, 64) : null,
          summary: input.summary ? String(input.summary).slice(0, 255) : null,
          changes: input.changes == null ? undefined : (capJson(input.changes) as any),
          method: input.method ? String(input.method).slice(0, 8) : null,
          path: input.path ? String(input.path).slice(0, 255) : null,
          status_code: input.status != null && Number.isFinite(Number(input.status)) ? Math.max(0, Math.min(999, Number(input.status))) : null,
          ip: input.ip ? String(input.ip).replace(/^::ffff:/, '').slice(0, 45) : null,
        },
      });
    } catch (e: any) {
      this.logger.warn(`auditoria ${input?.action}: ${e?.message || e}`);
    }
  }

  async userName(userId: string): Promise<string | null> {
    const hit = this.names.get(userId);
    if (hit && Date.now() - hit.at < NAME_TTL) return hit.name;
    const u = await this.prisma.users.findUnique({ where: { id: userId }, select: { name: true } }).catch(() => null);
    const name = u?.name || null;
    this.names.set(userId, { name, at: Date.now() });
    if (this.names.size > 2_000) this.names.delete(this.names.keys().next().value as string);
    return name;
  }

  private async apiKeyOwner(keyId: string): Promise<string | null> {
    const hit = this.keyOwners.get(keyId);
    if (hit && Date.now() - hit.at < NAME_TTL) return hit.userId;
    const k = await this.prisma.org_api_keys.findUnique({ where: { id: keyId }, select: { created_by: true } }).catch(() => null);
    const userId = k?.created_by || null;
    this.keyOwners.set(keyId, { userId, at: Date.now() });
    if (this.keyOwners.size > 500) this.keyOwners.delete(this.keyOwners.keys().next().value as string);
    return userId;
  }

  /** Linha atual de uma entidade auditável (org-scoped). Null se não for entidade com linha ou não existir. */
  async fetchRow(orgId: string, entity: string, id: string | null | undefined): Promise<Record<string, any> | null> {
    const model = ROW_MODELS[entity];
    if (!model || !id) return null;
    try {
      return (await (this.prisma as any)[model].findFirst({ where: { id: String(id), organization_id: orgId } })) || null;
    } catch {
      return null;
    }
  }

  /** Monta e grava a linha de uma requisição já respondida (chamado fora do caminho da resposta). */
  async capture(c: CaptureCtx): Promise<void> {
    try {
      if (c.status < 200 || c.status >= 300) return;
      const { route } = c;
      const resp: any = c.response && typeof c.response === 'object' ? c.response : null;
      const entityId = route.entityId || (route.verb === 'create' && typeof resp?.id === 'string' ? resp.id : null);
      const isRow = hasRowModel(route.entity);
      let after: Record<string, any> | null = null;
      if (isRow && entityId && c.method !== 'DELETE') after = await this.fetchRow(c.orgId, route.entity, entityId);

      let changes: Record<string, unknown>;
      if (isRow && c.before && after) {
        const fields = diffRows(c.before, after);
        // ação sobre tabela vizinha (ex.: vincular número ao cliente) não muda a linha → guarda o corpo também
        changes = fields.length ? { fields } : { fields, body: sanitize(c.body ?? null) };
      } else if (isRow && c.before && c.method === 'DELETE') {
        changes = { before: sanitize(c.before) };
      } else {
        changes = { body: sanitize(c.body ?? null) };
      }
      const customerId =
        route.customerId ||
        (route.entity === 'customers' ? entityId : null) ||
        (after?.customer_id as string) ||
        (c.before?.customer_id as string) ||
        (typeof resp?.customer_id === 'string' ? resp.customer_id : null);
      if (customerId) changes.customer_id = customerId;

      const name = recordName(after) || recordName(c.before) || recordName(resp) || (route.verb === 'create' ? recordName(c.body) : null);
      let userId = c.userId;
      let userName: string | null = null;
      if (route.actor === 'api' && c.apiKeyId) {
        userId = await this.apiKeyOwner(c.apiKeyId);
        userName = `API · ${c.apiKeyName || 'chave'}`;
      }
      await this.log({
        orgId: c.orgId,
        userId,
        userName: userName ?? undefined,
        actor: route.actor,
        action: route.action,
        entity: route.entity,
        entityId,
        summary: summaryFor(route, name),
        changes,
        method: c.method,
        path: c.path,
        status: c.status,
        ip: c.ip,
      });
    } catch (e: any) {
      this.logger.warn(`auditoria (captura) ${c?.route?.action}: ${e?.message || e}`);
    }
  }

  // ---------------------------------------------------------------- LGPD (A-1)
  /**
   * Apagamento de dados do cliente: as linhas da auditoria sobre ele perdem o conteúdo. `changes` vira
   * `{customer_id, redacted:true}` e o resumo é refeito sem o nome ("Alterou o cliente (dados removidos — LGPD)").
   * Pega o cadastro (`entity=customers&entity_id`), tudo com `changes.customer_id` e, se passados, os registros das
   * assinaturas/cobranças dele (`extra`). Devolve quantas linhas mudaram. Nunca lança.
   */
  async redactCustomer(orgId: string, customerId: string, extra: Array<{ entity: string; ids: string[] }> = []): Promise<number> {
    try {
      if (!orgId || !customerId) return 0;
      const ors: any[] = [{ entity: 'customers', entity_id: customerId }, { changes: { path: '$.customer_id', equals: customerId } }];
      for (const x of extra) {
        const ids = [...new Set((x.ids || []).filter(Boolean))];
        for (let i = 0; i < ids.length; i += 500) ors.push({ entity: x.entity, entity_id: { in: ids.slice(i, i + 500) } });
      }
      let total = 0;
      // em lotes de condições (a lista de ids pode ser longa)
      for (let i = 0; i < ors.length; i += 10) {
        const part = ors.slice(i, i + 10);
        const where = { organization_id: orgId, OR: part };
        const groups = await this.prisma.org_audit_log.groupBy({ by: ['entity', 'action'], where });
        for (const g of groups) {
          const entity = g.entity || '';
          const verb = entity && g.action.startsWith(`${entity}.`) ? g.action.slice(entity.length + 1) : g.action;
          const summary = `${summaryFor({ entity: entity || 'customers', verb }, null)}${REDACTED_SUFFIX}`.slice(0, 255);
          const r = await this.prisma.org_audit_log.updateMany({
            where: { AND: [where, { entity: g.entity, action: g.action }] },
            data: { summary, changes: { customer_id: customerId, redacted: true } as any },
          });
          total += r.count;
        }
      }
      return total;
    } catch (e: any) {
      this.logger.warn(`auditoria (apagar dados do cliente ${customerId}): ${e?.message || e}`);
      return 0;
    }
  }

  // ---------------------------------------------------------------- leitura
  private static dayStartUtc(d: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    const t = new Date(`${d}T00:00:00Z`);
    if (Number.isNaN(+t)) return null;
    return new Date(+t + BRT_OFFSET_H * 3_600_000);
  }

  async list(orgId: string, q: any = {}) {
    const page = Math.max(1, parseInt(String(q.page || '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(String(q.page_size || '30'), 10) || 30));
    const and: any[] = [{ organization_id: orgId }];
    const entity = q.entity ? String(q.entity).slice(0, 40) : '';
    const entityId = q.entity_id ? String(q.entity_id).slice(0, 64) : '';
    if (entity === 'customers' && entityId) {
      // histórico do cliente: o próprio cadastro + o que foi feito em assinaturas/cobranças/cartões dele
      and.push({ OR: [{ entity: 'customers', entity_id: entityId }, { changes: { path: '$.customer_id', equals: entityId } }] });
    } else {
      if (entity) and.push({ entity });
      if (entityId) and.push({ entity_id: entityId });
    }
    if (q.user_id) and.push({ user_id: String(q.user_id).slice(0, 36) });
    if (q.actor && ['user', 'api', 'system'].includes(String(q.actor))) and.push({ actor: String(q.actor) });
    if (q.action) and.push({ action: { startsWith: String(q.action).slice(0, 64) } });
    const from = q.from ? OrgAuditService.dayStartUtc(String(q.from)) : null;
    const toStart = q.to ? OrgAuditService.dayStartUtc(String(q.to)) : null;
    if (from) and.push({ created_at: { gte: from } });
    if (toStart) and.push({ created_at: { lt: new Date(+toStart + 86_400_000) } });
    const text = String(q.q || '').trim().slice(0, 80);
    if (text) and.push({ OR: [{ summary: { contains: text } }, { action: { contains: text } }, { user_name: { contains: text } }, { entity_id: text }, { path: { contains: text } }] });
    const where = { AND: and };
    const [rows, total] = await Promise.all([
      this.prisma.org_audit_log.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.org_audit_log.count({ where }),
    ]);
    const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
    const users = ids.length ? await this.prisma.users.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return {
      items: rows.map((r) => {
        const u = r.user_id ? byId.get(r.user_id) : null;
        const apiName = r.actor === 'api' ? r.user_name : null;
        return {
          id: r.id,
          created_at: r.created_at,
          actor: r.actor,
          user_id: r.user_id,
          user_name: apiName || u?.name || r.user_name || (r.actor === 'system' ? 'Sistema' : null),
          user_email: u?.email || null,
          action: r.action,
          entity: r.entity,
          entity_label: entityLabel(r.entity),
          entity_id: r.entity_id,
          summary: r.summary,
          changes: r.changes,
          method: r.method,
          path: r.path,
          status_code: r.status_code,
          ip: r.ip,
        };
      }),
      total,
      page,
      page_size: pageSize,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /** Opções dos filtros da tela: usuários da org e entidades que já têm registro. */
  async meta(orgId: string) {
    const [users, groups] = await Promise.all([
      this.prisma.users.findMany({ where: { organization_id: orgId }, select: { id: true, name: true, email: true, role: true, active: true }, orderBy: { name: 'asc' } }),
      this.prisma.org_audit_log.groupBy({ by: ['entity'], where: { organization_id: orgId, entity: { not: null } } }),
    ]);
    const present = new Set(groups.map((g) => g.entity).filter(Boolean) as string[]);
    const entities = [...present].map((e) => ({ value: e, label: entityLabel(e) })).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    return {
      users: users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active })),
      entities,
      all_entities: Object.keys(ENTITY_META).map((e) => ({ value: e, label: entityLabel(e) })),
      retention_days: RETENTION_DAYS,
    };
  }

  // ---------------------------------------------------------------- poda (04:25 BRT)
  @Cron('0 25 7 * * *')
  async prune() {
    if (this.pruning) return 0;
    this.pruning = true;
    let total = 0;
    try {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
      for (let i = 0; i < 400; i++) {
        const n = Number(await this.prisma.$executeRaw`DELETE FROM org_audit_log WHERE created_at < ${cutoff} LIMIT 5000`);
        total += n;
        if (n < PRUNE_BATCH) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      if (total) this.logger.log(`auditoria: ${total} registro(s) com mais de ${RETENTION_DAYS} dias apagado(s)`);
    } catch (e: any) {
      this.logger.warn(`auditoria (poda): ${e?.message || e}`);
    } finally {
      this.pruning = false;
    }
    return total;
  }
}
