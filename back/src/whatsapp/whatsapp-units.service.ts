import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { WhatsAppSessionsService } from './whatsapp-sessions.service';
import { capFreeValue } from './wa-custom-fields.util';

// Unidades / filiais (Fase 7, contrato §11.2). Cliente e pedido podem apontar para uma unidade; relatório financeiro
// agrupa por ela. Apagar unidade SOLTA o vínculo (unit_id = NULL), não apaga clientes nem pedidos.
const MAX_UNITS = 200;
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function normAddress(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null;
  const a: any = raw;
  const out: any = {
    street: clean(a.street, 120) || undefined, number: clean(a.number, 20) || undefined, complement: clean(a.complement, 60) || undefined,
    district: clean(a.district, 80) || undefined, city: clean(a.city, 80) || undefined, state: clean(a.state, 2).toUpperCase() || undefined,
    zip: String(a.zip ?? '').replace(/\D/g, '').slice(0, 8) || undefined,
  };
  return Object.values(out).some(Boolean) ? out : null;
}

@Injectable()
export class WhatsAppUnitsService {
  constructor(private readonly prisma: PrismaService, private readonly presenter: WhatsAppPresenter, private readonly sessions: WhatsAppSessionsService) {}

  private async shapeMany(orgId: string, rows: any[]) {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const [counts, smap] = await Promise.all([
      this.prisma.whatsapp_customers.groupBy({ by: ['unit_id'], where: { organization_id: orgId, unit_id: { in: ids } }, _count: { _all: true } }),
      this.presenter.sessionMap(orgId),
    ]);
    const cm = new Map(counts.map((c) => [c.unit_id, c._count._all] as [string | null, number]));
    return rows.map((u) => ({
      id: u.id, name: u.name, code: u.code || null, address: u.address || null, phone: u.phone || null,
      session_id: u.session_id || null, session: (u.session_id && smap.get(u.session_id)) || null,
      active: u.active, position: u.position, custom: u.custom && typeof u.custom === 'object' ? u.custom : {},
      customers: cm.get(u.id) || 0, created_at: u.created_at, updated_at: u.updated_at,
    }));
  }

  async list(orgId: string) {
    const rows = await this.prisma.whatsapp_units.findMany({ where: { organization_id: orgId }, orderBy: [{ position: 'asc' }, { name: 'asc' }], take: MAX_UNITS });
    return this.shapeMany(orgId, rows);
  }

  private async data(orgId: string, dto: any, creating: boolean) {
    const d: any = {};
    if (dto.name !== undefined || creating) {
      const n = clean(dto.name, 120);
      if (!n) throw new BadRequestException('Dê um nome à unidade.');
      d.name = n;
    }
    if (dto.code !== undefined) d.code = clean(dto.code, 32) || null;
    if (dto.address !== undefined) d.address = normAddress(dto.address);
    if (dto.phone !== undefined) d.phone = String(dto.phone ?? '').replace(/\D/g, '').slice(0, 13) || null;
    if (dto.active !== undefined) d.active = dto.active !== false;
    // dados livres da unidade: até 30 chaves, cada valor com teto (texto 500; objeto/lista até ~2 KB — maior é descartado)
    if (dto.custom !== undefined) d.custom = dto.custom && typeof dto.custom === 'object' && !Array.isArray(dto.custom)
      ? Object.fromEntries(Object.entries(dto.custom).slice(0, 30).map(([k, v]) => [String(k).slice(0, 40), capFreeValue(v)] as [string, unknown]).filter(([, v]) => v !== undefined))
      : null;
    if (dto.session_id !== undefined) {
      if (dto.session_id) {
        const s = await this.sessions.rowById(orgId, String(dto.session_id));
        if (!s) throw new NotFoundException('Número não encontrado.');
        d.session_id = s.id;
      } else d.session_id = null;
    }
    return d;
  }

  async create(orgId: string, dto: any) {
    const n = await this.prisma.whatsapp_units.count({ where: { organization_id: orgId } });
    if (n >= MAX_UNITS) throw new BadRequestException(`Limite de ${MAX_UNITS} unidades.`);
    const u = await this.prisma.whatsapp_units.create({ data: { organization_id: orgId, position: n, ...(await this.data(orgId, dto, true)) } });
    return (await this.shapeMany(orgId, [u]))[0];
  }

  async update(orgId: string, id: string, dto: any) {
    const cur = await this.prisma.whatsapp_units.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Unidade não encontrada.');
    const data = await this.data(orgId, Object.fromEntries(Object.entries(dto || {}).filter(([, v]) => v !== undefined)), false);
    if (dto.position !== undefined) data.position = Math.max(0, Number(dto.position) || 0);
    const u = await this.prisma.whatsapp_units.update({ where: { id }, data });
    return (await this.shapeMany(orgId, [u]))[0];
  }

  async remove(orgId: string, id: string) {
    const cur = await this.prisma.whatsapp_units.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Unidade não encontrada.');
    await this.prisma.$transaction([
      this.prisma.whatsapp_customers.updateMany({ where: { organization_id: orgId, unit_id: id }, data: { unit_id: null } }),
      this.prisma.whatsapp_orders.updateMany({ where: { organization_id: orgId, unit_id: id }, data: { unit_id: null } }),
      this.prisma.whatsapp_units.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  async reorder(orgId: string, ids: string[]) {
    const rows = await this.prisma.whatsapp_units.findMany({ where: { organization_id: orgId, id: { in: ids } }, select: { id: true } });
    const ok = new Set(rows.map((r) => r.id));
    await this.prisma.$transaction(ids.filter((id) => ok.has(id)).map((id, i) => this.prisma.whatsapp_units.update({ where: { id }, data: { position: i } })));
    return this.list(orgId);
  }
}
