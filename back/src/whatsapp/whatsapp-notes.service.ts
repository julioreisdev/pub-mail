import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { WhatsAppAttendanceService } from './whatsapp-attendance.service';
import { WhatsAppContactsService } from './whatsapp-contacts.service';

// ============================================================================
// Notas internas por conversa (fase 3 do CRM): só a equipe vê; nunca vão ao WhatsApp.
// ============================================================================

@Injectable()
export class WhatsAppNotesService {
  constructor(private readonly prisma: PrismaService, private readonly presenter: WhatsAppPresenter, private readonly attendance: WhatsAppAttendanceService, private readonly contacts: WhatsAppContactsService) {}

  private async canonical(orgId: string, chatId: string) {
    return this.contacts.canonicalChatId(orgId, chatId).catch(() => chatId);
  }

  private async shape(rows: any[]) {
    const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean) as string[])];
    const users = ids.length ? await this.prisma.users.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }) : [];
    const names = new Map(users.map((u) => [u.id, u.name || u.email]));
    return rows.map((r) => ({ id: r.id, chat_id: r.chat_id, text: r.text, pinned: r.pinned, user: r.user_id ? { id: r.user_id, name: names.get(r.user_id) || null } : null, created_at: r.created_at, updated_at: r.updated_at }));
  }

  async list(orgId: string, chatId: string) {
    const canonical = await this.canonical(orgId, chatId);
    const rows = await this.prisma.whatsapp_chat_notes.findMany({ where: { organization_id: orgId, chat_id: { in: [...new Set([canonical, chatId])] } }, orderBy: [{ pinned: 'desc' }, { created_at: 'desc' }], take: 200 });
    return this.shape(rows);
  }

  async create(orgId: string, userId: string | null, chatId: string, dto: any) {
    const text = String(dto?.text || '').trim();
    if (!text) throw new BadRequestException('Escreva a nota.');
    const canonical = await this.canonical(orgId, chatId);
    const row = await this.prisma.whatsapp_chat_notes.create({ data: { organization_id: orgId, chat_id: canonical, user_id: userId, text: text.slice(0, 4000), pinned: Boolean(dto?.pinned) } });
    await this.attendance.event(orgId, canonical, 'note_added', userId, { note_id: row.id, preview: text.slice(0, 120) });
    const [shaped] = await this.shape([row]);
    this.presenter.emit(orgId, 'wa:note', { action: 'created', note: shaped });
    return shaped;
  }

  async update(orgId: string, userId: string | null, role: string, chatId: string, id: string, dto: any) {
    const cur = await this.prisma.whatsapp_chat_notes.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Nota não encontrada.');
    const admin = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(role);
    if (dto?.text !== undefined && cur.user_id && cur.user_id !== userId && !admin) throw new ForbiddenException('Só quem escreveu (ou um administrador) pode editar a nota.');
    const data: any = {};
    if (dto?.text !== undefined) { const t = String(dto.text || '').trim(); if (!t) throw new BadRequestException('Escreva a nota.'); data.text = t.slice(0, 4000); }
    if (dto?.pinned !== undefined) data.pinned = Boolean(dto.pinned);
    const row = await this.prisma.whatsapp_chat_notes.update({ where: { id }, data });
    const [shaped] = await this.shape([row]);
    this.presenter.emit(orgId, 'wa:note', { action: 'updated', note: shaped });
    return shaped;
  }

  async remove(orgId: string, userId: string | null, role: string, chatId: string, id: string) {
    const cur = await this.prisma.whatsapp_chat_notes.findFirst({ where: { id, organization_id: orgId } });
    if (!cur) throw new NotFoundException('Nota não encontrada.');
    const admin = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(role);
    if (cur.user_id && cur.user_id !== userId && !admin) throw new ForbiddenException('Só quem escreveu (ou um administrador) pode apagar a nota.');
    await this.prisma.whatsapp_chat_notes.delete({ where: { id } });
    this.presenter.emit(orgId, 'wa:note', { action: 'deleted', note: { id, chat_id: cur.chat_id } });
    return { ok: true };
  }
}
