import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { ChatKey, WhatsAppAttendanceService } from './whatsapp-attendance.service';

// ============================================================================
// Notas internas por conversa (fase 3 do CRM): só a equipe vê; nunca vão ao WhatsApp.
// Multi-número: a rota recebe o uuid da conversa; a nota guarda (session_id, jid) e o
// evento em tempo real sai na sala do número com `chat_id` = uuid.
// ============================================================================

@Injectable()
export class WhatsAppNotesService {
  constructor(private readonly prisma: PrismaService, private readonly presenter: WhatsAppPresenter, private readonly attendance: WhatsAppAttendanceService) {}

  private async shape(rows: any[], chatUuid: string) {
    const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean) as string[])];
    const users = ids.length ? await this.prisma.users.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }) : [];
    const names = new Map(users.map((u) => [u.id, u.name || u.email]));
    return rows.map((r) => ({ id: r.id, chat_id: chatUuid, session_id: r.session_id || null, jid: r.chat_id, text: r.text, pinned: r.pinned, user: r.user_id ? { id: r.user_id, name: names.get(r.user_id) || null } : null, created_at: r.created_at, updated_at: r.updated_at }));
  }

  /** Notas da conversa: as do número + as antigas gravadas sem número (mesmo jid). */
  private noteWhere(orgId: string, chat: { session_id: string; chat_id: string }) {
    return { organization_id: orgId, chat_id: chat.chat_id, OR: [{ session_id: chat.session_id }, { session_id: null }] };
  }

  async list(orgId: string, chatUuid: string) {
    const chat = await this.attendance.chatRow(orgId, chatUuid);
    const rows = await this.prisma.whatsapp_chat_notes.findMany({ where: this.noteWhere(orgId, chat), orderBy: [{ pinned: 'desc' }, { created_at: 'desc' }], take: 200 });
    return this.shape(rows, chat.id);
  }

  async create(orgId: string, userId: string | null, chatUuid: string, dto: any) {
    const text = String(dto?.text || '').trim();
    if (!text) throw new BadRequestException('Escreva a nota.');
    const chat = await this.attendance.chatRow(orgId, chatUuid);
    const key: ChatKey = { session_id: chat.session_id, chat_id: chat.chat_id };
    const row = await this.prisma.whatsapp_chat_notes.create({ data: { organization_id: orgId, session_id: chat.session_id, chat_id: chat.chat_id, user_id: userId, text: text.slice(0, 4000), pinned: Boolean(dto?.pinned) } });
    await this.attendance.event(orgId, key, 'note_added', userId, { note_id: row.id, preview: text.slice(0, 120) });
    const [shaped] = await this.shape([row], chat.id);
    this.presenter.emitSession(orgId, chat.session_id, 'wa:note', { action: 'created', chat_id: chat.id, session_id: chat.session_id, note: shaped });
    return shaped;
  }

  async update(orgId: string, userId: string | null, role: string, chatUuid: string, id: string, dto: any) {
    const chat = await this.attendance.chatRow(orgId, chatUuid);
    const cur = await this.prisma.whatsapp_chat_notes.findFirst({ where: { id, ...this.noteWhere(orgId, chat) } });
    if (!cur) throw new NotFoundException('Nota não encontrada.');
    const admin = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(role);
    if (dto?.text !== undefined && cur.user_id && cur.user_id !== userId && !admin) throw new ForbiddenException('Só quem escreveu (ou um administrador) pode editar a nota.');
    const data: any = {};
    if (dto?.text !== undefined) { const t = String(dto.text || '').trim(); if (!t) throw new BadRequestException('Escreva a nota.'); data.text = t.slice(0, 4000); }
    if (dto?.pinned !== undefined) data.pinned = Boolean(dto.pinned);
    if (!cur.session_id) data.session_id = chat.session_id; // adota o número ao mexer numa nota antiga
    const row = await this.prisma.whatsapp_chat_notes.update({ where: { id }, data });
    const [shaped] = await this.shape([row], chat.id);
    this.presenter.emitSession(orgId, chat.session_id, 'wa:note', { action: 'updated', chat_id: chat.id, session_id: chat.session_id, note: shaped });
    return shaped;
  }

  async remove(orgId: string, userId: string | null, role: string, chatUuid: string, id: string) {
    const chat = await this.attendance.chatRow(orgId, chatUuid);
    const cur = await this.prisma.whatsapp_chat_notes.findFirst({ where: { id, ...this.noteWhere(orgId, chat) } });
    if (!cur) throw new NotFoundException('Nota não encontrada.');
    const admin = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(role);
    if (cur.user_id && cur.user_id !== userId && !admin) throw new ForbiddenException('Só quem escreveu (ou um administrador) pode apagar a nota.');
    await this.prisma.whatsapp_chat_notes.delete({ where: { id } });
    this.presenter.emitSession(orgId, chat.session_id, 'wa:note', { action: 'deleted', chat_id: chat.id, session_id: chat.session_id, note: { id, chat_id: chat.id } });
    return { ok: true };
  }
}
