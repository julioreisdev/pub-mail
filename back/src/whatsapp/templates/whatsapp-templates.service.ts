import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppCrmService } from '../whatsapp-crm.service';
import { WhatsAppAttendanceService } from '../whatsapp-attendance.service';
import { WhatsAppPipelineService } from '../whatsapp-pipeline.service';
import { WhatsAppBotService } from '../bot/whatsapp-bot.service';
import { WhatsAppSchedulingService } from '../scheduling/whatsapp-scheduling.service';
import { WhatsAppTicketsService } from '../tickets/whatsapp-tickets.service';
import { WhatsAppOrdersService } from '../orders/whatsapp-orders.service';
import { normalizeCustomFieldMap, cfKey } from '../wa-custom-fields.util';
import { categoryKey } from '../tickets/wa-ticket.util';
import { WA_TEMPLATES } from './data';
import { TEMPLATE_PARTS, TemplatePart, WaTemplate } from './wa-template.types';

// Modelos por ramo (Fase 7, contrato §11.6): cria o que falta (por NOME), nunca duplica, nunca liga o bot.
// Revisão 14/10/2026: configurações de agenda/chamados/pedidos SÓ entram quando a área ainda não tem nada salvo
// (senão vão em `skipped` — reaplicar um modelo nunca sobrescreve o que a org já ajustou); categorias de chamado
// novas continuam sendo acrescentadas. Campo que não coube (limite por entidade) vai em `skipped`, não em `created`.
// Uma aplicação por organização de cada vez (trava em memória; o back roda num processo só).
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

@Injectable()
export class WhatsAppTemplatesService {
  private readonly logger = new Logger(WhatsAppTemplatesService.name);
  private readonly applying = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly crm: WhatsAppCrmService,
    private readonly attendance: WhatsAppAttendanceService,
    private readonly pipeline: WhatsAppPipelineService,
    private readonly bot: WhatsAppBotService,
    private readonly scheduling: WhatsAppSchedulingService,
    private readonly tickets: WhatsAppTicketsService,
    private readonly orders: WhatsAppOrdersService,
  ) {}

  /** Resumo para a tela (sem fluxo/fixture inteiros). */
  list() {
    return WA_TEMPLATES.map((t) => ({
      key: t.key, name: t.name, description: t.description, icon: t.icon, highlights: t.highlights,
      counts: {
        products: (t.products || []).filter((p) => p.kind !== 'service').length,
        services: (t.products || []).filter((p) => p.kind === 'service').length,
        custom_fields: Object.values(t.custom_fields || {}).reduce((a, l) => a + (l?.length || 0), 0),
        tags: (t.tags || []).length, pipeline_stages: (t.pipeline_stages || []).length,
        ticket_categories: (t.tickets?.categories || []).length, resources: (t.scheduling?.resources || []).length,
        orders: Boolean(t.orders), bot: Boolean(t.bot),
      },
      parts: TEMPLATE_PARTS.filter((p) => this.has(t, p)),
    }));
  }

  get(key: string): WaTemplate {
    const t = WA_TEMPLATES.find((x) => x.key === key);
    if (!t) throw new NotFoundException('Modelo não encontrado.');
    return t;
  }

  private has(t: WaTemplate, p: TemplatePart) {
    switch (p) {
      case 'products': return Boolean(t.products?.length);
      case 'custom_fields': return Object.values(t.custom_fields || {}).some((l) => l?.length);
      case 'tags': return Boolean(t.tags?.length);
      case 'pipeline': return Boolean(t.pipeline_stages?.length);
      case 'tickets': return Boolean(t.tickets?.categories?.length || t.tickets?.settings);
      case 'scheduling': return Boolean(t.scheduling?.resources?.length || t.scheduling?.settings);
      case 'orders': return Boolean(t.orders);
      case 'bot': return Boolean(t.bot);
    }
  }

  /** Troca os marcadores `@product:` `@tag:` `@stage:` `@resource:` `@category:` em qualquer string. */
  private resolve(v: any, maps: Record<string, Map<string, string>>, missing: Set<string>): any {
    if (typeof v === 'string') {
      const m = v.match(/^@(product|tag|stage|resource|category):(.+)$/);
      if (!m) return v;
      if (m[1] === 'category') return categoryKey(m[2]);
      const id = maps[m[1]]?.get(norm(m[2]));
      if (!id) { missing.add(v); return v; }
      return id;
    }
    if (Array.isArray(v)) return v.map((x) => this.resolve(x, maps, missing));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, this.resolve(x, maps, missing)]));
    return v;
  }

  async apply(orgId: string, key: string, parts?: string[] | null) {
    const t = this.get(key);
    if (this.applying.has(orgId)) throw new BadRequestException('Já tem um modelo sendo aplicado nesta conta. Espere terminar e tente de novo.');
    this.applying.add(orgId);
    try {
      return await this.applyInner(orgId, t, parts);
    } finally {
      this.applying.delete(orgId);
    }
  }

  private async applyInner(orgId: string, t: WaTemplate, parts?: string[] | null) {
    const want = new Set<TemplatePart>((parts?.length ? parts : TEMPLATE_PARTS).filter((p): p is TemplatePart => (TEMPLATE_PARTS as readonly string[]).includes(p)));
    const created: Record<string, string[]> = {};
    const skipped: Record<string, string[]> = {};
    const errors: string[] = [];
    const add = (bucket: Record<string, string[]>, k: string, v: string) => { (bucket[k] = bucket[k] || []).push(v); };
    // o que a org JÁ salvou (lido antes de qualquer escrita desta aplicação): área com configuração = não sobrescreve
    const saved = await this.prisma.whatsapp_crm_settings.findUnique({ where: { organization_id: orgId }, select: { scheduling: true, tickets: true, orders: true } }).catch(() => null);
    const hasSaved = (v: unknown) => Boolean(v && typeof v === 'object' && Object.keys(v as object).length);

    // ---- campos personalizados (antes dos produtos: produto com campo obrigatório precisa da definição)
    if (want.has('custom_fields') && t.custom_fields) {
      const cur = (await this.crm.settings(orgId)).custom_fields;
      const next: any = { ...cur };
      const wanted: Array<[string, string]> = [];
      for (const [entity, defs] of Object.entries(t.custom_fields)) {
        const have = new Set(((cur as any)[entity] || []).map((d: any) => d.key));
        const extra = (defs || []).filter((d) => { const k = cfKey(d.key || d.label); if (have.has(k)) { add(skipped, 'custom_fields', `${entity}.${k}`); return false; } wanted.push([entity, k]); return true; });
        next[entity] = [...((cur as any)[entity] || []), ...extra];
      }
      const normalized: any = normalizeCustomFieldMap(next);
      // o normalizador corta no limite por entidade (e descarta definição inválida): só é "criado" o que ficou
      for (const [entity, k] of wanted) {
        if ((normalized[entity] || []).some((d: any) => d.key === k)) add(created, 'custom_fields', `${entity}.${k}`);
        else add(skipped, 'custom_fields', `${entity}.${k} (não coube: limite de campos)`);
      }
      if (wanted.some(([entity, k]) => (normalized[entity] || []).some((d: any) => d.key === k))) await this.crm.updateSettings(orgId, { custom_fields: normalized });
    }

    // ---- etiquetas (antes dos produtos: regra "Ao pagar, liberar…" pode usar @tag:)
    const tags = await this.prisma.whatsapp_tags.findMany({ where: { organization_id: orgId }, select: { id: true, name: true } });
    const tagMap = new Map(tags.map((x) => [norm(x.name), x.id] as [string, string]));
    if (want.has('tags')) for (const tg of t.tags || []) {
      if (tagMap.has(norm(tg.name))) { add(skipped, 'tags', tg.name); continue; }
      try { const r: any = await this.attendance.createTag(orgId, tg); tagMap.set(norm(tg.name), r.id); add(created, 'tags', tg.name); } catch (e: any) { errors.push(`Etiqueta "${tg.name}": ${e?.response?.message || e?.message || e}`); }
    }

    // ---- produtos (e serviços da agenda)
    const products = await this.prisma.whatsapp_products.findMany({ where: { organization_id: orgId }, select: { id: true, name: true } });
    const productMap = new Map(products.map((p) => [norm(p.name), p.id] as [string, string]));
    if (want.has('products') || want.has('scheduling')) {
      for (const p of t.products || []) {
        const isService = p.kind === 'service';
        if (isService ? !want.has('scheduling') && !want.has('products') : !want.has('products')) continue;
        if (productMap.has(norm(p.name))) { add(skipped, 'products', p.name); continue; }
        try {
          const pMissing = new Set<string>();
          const data = this.resolve({ ...p, included_in_plans: undefined }, { tag: tagMap, product: productMap }, pMissing);
          if (pMissing.size && Array.isArray(data?.entitlement?.rules)) {
            // regra que aponta para algo que não foi criado (ex.: aplicou produtos sem etiquetas) sai do produto
            data.entitlement = { ...data.entitlement, rules: data.entitlement.rules.filter((r: any) => !String(r?.ref || '').startsWith('@')) };
            add(skipped, 'entitlements', `${p.name}: ${[...pMissing].join(', ')}`);
          } else if (pMissing.size) errors.push(`Produto "${p.name}": marcadores sem destino ${[...pMissing].join(', ')}`);
          const r: any = await this.crm.createProduct(orgId, data);
          productMap.set(norm(p.name), r.id);
          add(created, isService ? 'services' : 'products', p.name);
        } catch (e: any) { errors.push(`Produto "${p.name}": ${e?.response?.message || e?.message || e}`); }
      }
      // planos que incluem serviços (precisa dos ids dos dois lados)
      for (const p of (t.products || []).filter((x) => Array.isArray(x.included_in_plans) && x.included_in_plans.length)) {
        const id = productMap.get(norm(p.name));
        if (!id) continue;
        const inc = p.included_in_plans.map((x: any) => ({ ...x, plan_id: productMap.get(norm(String(x.plan_id || x.plan || '').replace(/^@product:/, ''))) })).filter((x: any) => x.plan_id);
        if (inc.length) await this.crm.updateProduct(orgId, id, { included_in_plans: inc }).catch((e: any) => errors.push(`Planos de "${p.name}": ${e?.message || e}`));
      }
    }

    // ---- funil
    const stages: any[] = await this.pipeline.stages(orgId);
    const stageMap = new Map(stages.map((x: any) => [norm(x.name), x.id] as [string, string]));
    if (want.has('pipeline')) for (const st of t.pipeline_stages || []) {
      if (stageMap.has(norm(st.name))) { add(skipped, 'pipeline_stages', st.name); continue; }
      try { const r: any = await this.pipeline.createStage(orgId, st); stageMap.set(norm(st.name), r?.id || r?.stage?.id); add(created, 'pipeline_stages', st.name); } catch (e: any) { errors.push(`Etapa "${st.name}": ${e?.response?.message || e?.message || e}`); }
    }

    // ---- chamados (categorias por chave)
    if (want.has('tickets') && t.tickets) {
      const cur = await this.tickets.settings(orgId);
      const have = new Set(cur.categories.map((c) => c.key));
      const extra = (t.tickets.categories || []).filter((c) => { const k = categoryKey(c.key || c.label); if (have.has(k)) { add(skipped, 'ticket_categories', c.label); return false; } add(created, 'ticket_categories', c.label); return true; });
      // os 3 padrões da org nova saem se o modelo traz as próprias e a org nunca mexeu nelas
      const untouched = cur.categories.length === 3 && ['duvida', 'problema', 'solicitacao'].every((k) => have.has(k)) && !(await this.prisma.whatsapp_tickets.count({ where: { organization_id: orgId } }));
      const keepSettings = hasSaved(saved?.tickets);
      if (t.tickets.settings) add(keepSettings ? skipped : created, 'tickets', keepSettings ? 'configuração de chamados (já existe)' : 'configuração de chamados');
      if (extra.length || (!keepSettings && t.tickets.settings)) await this.tickets.updateSettings(orgId, { ...(keepSettings ? {} : t.tickets.settings || {}), categories: [...(untouched && extra.length ? [] : cur.categories), ...extra] });
    }

    // ---- agenda (recursos)
    const resources: any[] = want.has('scheduling') ? await this.scheduling.listResources(orgId) : [];
    const resMap = new Map(resources.map((r: any) => [norm(r.name), r.id] as [string, string]));
    if (want.has('scheduling') && t.scheduling) {
      if (t.scheduling.settings) {
        if (hasSaved(saved?.scheduling)) add(skipped, 'scheduling', 'configuração da agenda (já existe)');
        else await this.scheduling.updateSettings(orgId, t.scheduling.settings).then(() => add(created, 'scheduling', 'configuração da agenda')).catch((e: any) => errors.push(`Agenda: ${e?.message || e}`));
      }
      for (const r of t.scheduling.resources || []) {
        if (resMap.has(norm(r.name))) { add(skipped, 'resources', r.name); continue; }
        try {
          const services = (r.services || []).map((n: string) => productMap.get(norm(String(n).replace(/^@product:/, '')))).filter(Boolean);
          const x: any = await this.scheduling.createResource(orgId, { ...r, services });
          resMap.set(norm(r.name), x.id);
          add(created, 'resources', r.name);
        } catch (e: any) { errors.push(`Recurso "${r.name}": ${e?.response?.message || e?.message || e}`); }
      }
    }

    // ---- pedidos
    if (want.has('orders') && t.orders?.settings) {
      if (hasSaved(saved?.orders)) add(skipped, 'orders', 'configuração de pedidos (já existe)');
      else { await this.orders.updateSettings(orgId, t.orders.settings); add(created, 'orders', 'configuração de pedidos'); }
    }

    // ---- fluxo do bot (DESLIGADO, sem número — regra do Júlio)
    let flow: any = null;
    if (want.has('bot') && t.bot) {
      const missing = new Set<string>();
      const definition = this.resolve(t.bot.definition, { product: productMap, tag: tagMap, stage: stageMap, resource: resMap }, missing);
      if (missing.size) errors.push(`Fluxo: referências não encontradas (${[...missing].slice(0, 5).join(', ')}) — aplique também produtos/etiquetas do modelo.`);
      const exists = await this.prisma.whatsapp_bot_flows.findFirst({ where: { organization_id: orgId, name: t.bot.name }, select: { id: true } });
      const name = exists ? `${t.bot.name} (${new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)})` : t.bot.name;
      try {
        flow = await this.bot.createFlow(orgId, { name, definition, settings: t.bot.settings });
        add(created, 'bot', name);
      } catch (e: any) { errors.push(`Fluxo: ${e?.response?.message || e?.message || e}`); }
    }
    this.logger.log(`modelo "${t.key}" aplicado na org ${orgId}: ${Object.entries(created).map(([k, v]) => `${k}=${v.length}`).join(' ') || 'nada novo'}${errors.length ? ` · ${errors.length} erro(s)` : ''}`);
    return { key: t.key, created, skipped, errors, flow_id: flow?.id || flow?.flow?.id || null };
  }

  /** Para o E2E: o modelo inteiro (fixture e cenários incluídos). */
  full(key: string) {
    const t = this.get(key);
    if (!t) throw new BadRequestException('Modelo não encontrado.');
    return t;
  }
}
