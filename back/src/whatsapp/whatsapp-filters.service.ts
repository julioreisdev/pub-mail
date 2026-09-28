import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Filtros personalizados do chat: abas com os contatos/grupos que o usuário escolher.
const MAX_FILTERS = 20;
const MAX_CHATS = 500;

@Injectable()
export class WhatsAppFiltersService {
  constructor(private readonly prisma: PrismaService) {}

  private normIds(raw: unknown) {
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.map((x) => String(x || '').trim()).filter((x) => /^[^\s@]+@[^\s@]+$/.test(x)))].slice(0, MAX_CHATS);
  }

  private shape(f: any) {
    const ids = this.normIds(f.chat_ids);
    return { id: f.id, name: f.name, chat_ids: ids, position: f.position, count: ids.length };
  }

  async list(orgId: string) {
    const rows = await this.prisma.whatsapp_chat_filters.findMany({ where: { organization_id: orgId }, orderBy: [{ position: 'asc' }, { created_at: 'asc' }] });
    return rows.map((r) => this.shape(r));
  }

  async idsOf(orgId: string, id: string) {
    const f = await this.prisma.whatsapp_chat_filters.findFirst({ where: { id, organization_id: orgId } });
    if (!f) throw new NotFoundException('Filtro não encontrado.');
    return this.normIds(f.chat_ids);
  }

  async create(orgId: string, dto: { name: string; chat_ids?: unknown }) {
    const name = String(dto.name || '').trim().slice(0, 60);
    if (!name) throw new BadRequestException('Dê um nome ao filtro.');
    const n = await this.prisma.whatsapp_chat_filters.count({ where: { organization_id: orgId } });
    if (n >= MAX_FILTERS) throw new BadRequestException(`Limite de ${MAX_FILTERS} filtros.`);
    const f = await this.prisma.whatsapp_chat_filters.create({ data: { organization_id: orgId, name, chat_ids: this.normIds(dto.chat_ids), position: n } });
    return this.shape(f);
  }

  async update(orgId: string, id: string, dto: { name?: string; chat_ids?: unknown; position?: number }) {
    const f = await this.prisma.whatsapp_chat_filters.findFirst({ where: { id, organization_id: orgId } });
    if (!f) throw new NotFoundException('Filtro não encontrado.');
    const data: any = {};
    if (dto.name !== undefined) { const name = String(dto.name || '').trim().slice(0, 60); if (!name) throw new BadRequestException('Nome vazio.'); data.name = name; }
    if (dto.chat_ids !== undefined) data.chat_ids = this.normIds(dto.chat_ids);
    if (dto.position !== undefined) data.position = Math.max(0, Number(dto.position) || 0);
    return this.shape(await this.prisma.whatsapp_chat_filters.update({ where: { id }, data }));
  }

  async remove(orgId: string, id: string) {
    const f = await this.prisma.whatsapp_chat_filters.findFirst({ where: { id, organization_id: orgId } });
    if (!f) throw new NotFoundException('Filtro não encontrado.');
    await this.prisma.whatsapp_chat_filters.delete({ where: { id } });
    return { ok: true };
  }
}
