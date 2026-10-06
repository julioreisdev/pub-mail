import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { WhatsAppMediaService, kindOfMime } from '../whatsapp/whatsapp-media.service';

// ---------------------------------------------------------------- chat interno da equipe
// Conversas entre usuários da MESMA organização: diretas (dm, uma por par de usuários) e grupos
// (nome, membros, admins). Mensagens de texto ou mídia (arquivo guardado pelo serviço de mídia do
// WhatsApp, em `protected/whatsapp/<org>/`, com URL assinada). Não lidas = mensagens de outros
// depois de `last_read_at` do membro. Tempo real: evento por usuário (`team:message`, `team:chat`).

type User = { userId: string; organizationId: string; role?: string };
const PAGE = 50;
const MAX_MEMBERS = 200;

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService, private readonly realtime: RealtimeService, private readonly media: WhatsAppMediaService) {}

  // ---------------------------------------------------------------- usuários da org
  async users(orgId: string, me: string) {
    const rows = await this.prisma.users.findMany({ where: { organization_id: orgId, active: true }, select: { id: true, name: true, email: true, role: true }, orderBy: { name: 'asc' } });
    const online = new Set(this.realtime.onlineUserIds(orgId, 'team'));
    const onlineAny = new Set([...this.realtime.onlineUserIds(orgId, 'whatsapp'), ...this.realtime.onlineUserIds(orgId, 'email')]);
    return rows.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, is_me: u.id === me, online: online.has(u.id) || onlineAny.has(u.id) }));
  }

  private async userMap(ids: string[]) {
    const uniq = [...new Set(ids.filter(Boolean))];
    if (!uniq.length) return new Map<string, any>();
    const rows = await this.prisma.users.findMany({ where: { id: { in: uniq } }, select: { id: true, name: true, email: true, role: true, active: true } });
    return new Map(rows.map((u) => [u.id, u] as [string, any]));
  }

  // ---------------------------------------------------------------- acesso
  private async chatRow(orgId: string, chatId: string) {
    const c = await this.prisma.team_chats.findFirst({ where: { id: chatId, organization_id: orgId } });
    if (!c) throw new NotFoundException('Conversa não encontrada.');
    return c;
  }
  private async membership(chatId: string, userId: string) {
    return this.prisma.team_chat_members.findUnique({ where: { chat_id_user_id: { chat_id: chatId, user_id: userId } } });
  }
  private async requireMember(orgId: string, chatId: string, userId: string) {
    const chat = await this.chatRow(orgId, chatId);
    const m = await this.membership(chatId, userId);
    if (!m) throw new NotFoundException('Conversa não encontrada.');
    return { chat, member: m };
  }
  private async requireAdmin(orgId: string, chatId: string, user: User) {
    const { chat, member } = await this.requireMember(orgId, chatId, user.userId);
    const orgAdmin = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(String(user.role || ''));
    if (chat.kind !== 'group') throw new BadRequestException('Só grupos têm administração.');
    if (member.role !== 'admin' && !orgAdmin) throw new ForbiddenException('Só administradores do grupo podem fazer isso.');
    return chat;
  }

  // ---------------------------------------------------------------- shapes
  private async shapeChats(orgId: string, me: string, chats: any[]) {
    if (!chats.length) return [];
    const ids = chats.map((c) => c.id);
    const members = await this.prisma.team_chat_members.findMany({ where: { chat_id: { in: ids } } });
    const umap = await this.userMap([...members.map((m) => m.user_id), ...chats.map((c) => c.last_user_id).filter(Boolean)]);
    const online = new Set(this.realtime.onlineUserIds(orgId, 'team'));
    const byChat = new Map<string, any[]>();
    for (const m of members) byChat.set(m.chat_id, [...(byChat.get(m.chat_id) || []), m]);
    // não lidas: mensagens de OUTROS depois do meu last_read_at
    const mine = members.filter((m) => m.user_id === me);
    const unread = new Map<string, number>();
    await Promise.all(
      mine.map(async (m) => {
        const n = await this.prisma.team_messages.count({ where: { chat_id: m.chat_id, deleted_at: null, user_id: { not: me }, ...(m.last_read_at ? { created_at: { gt: m.last_read_at } } : {}) } });
        unread.set(m.chat_id, n);
      }),
    );
    return chats.map((c) => {
      const ms = (byChat.get(c.id) || []).map((m) => {
        const u = umap.get(m.user_id);
        return { id: m.user_id, name: u?.name || 'Usuário removido', email: u?.email || null, role: m.role, is_me: m.user_id === me, online: online.has(m.user_id), active: u?.active !== false };
      });
      const other = c.kind === 'dm' ? ms.find((m) => !m.is_me) || ms[0] : null;
      const lastUser = c.last_user_id ? umap.get(c.last_user_id) : null;
      return {
        id: c.id,
        kind: c.kind,
        name: c.kind === 'dm' ? other?.name || 'Conversa' : c.name,
        peer: other ? { id: other.id, name: other.name, email: other.email, online: other.online, active: other.active } : null,
        members: ms,
        members_count: ms.length,
        my_role: ms.find((m) => m.is_me)?.role || 'member',
        last_message_at: c.last_message_at,
        last_preview: c.last_preview,
        last_user: lastUser ? { id: lastUser.id, name: lastUser.name, is_me: lastUser.id === me } : null,
        unread_count: unread.get(c.id) || 0,
        created_by: c.created_by,
        created_at: c.created_at,
      };
    });
  }

  private async shapeMessages(orgId: string, rows: any[], me: string) {
    if (!rows.length) return [];
    const umap = await this.userMap([...rows.map((r) => r.user_id)]);
    const quotedIds = rows.map((r) => r.quoted_id).filter(Boolean);
    const quoted = quotedIds.length ? await this.prisma.team_messages.findMany({ where: { id: { in: quotedIds } } }) : [];
    const qmap = new Map(quoted.map((q) => [q.id, q] as [string, any]));
    const qusers = await this.userMap(quoted.map((q) => q.user_id as string));
    const mediaIds = rows.map((r) => r.media_id).filter(Boolean);
    const medias = mediaIds.length ? await this.prisma.whatsapp_media.findMany({ where: { id: { in: mediaIds } } }) : [];
    const mmap = new Map(medias.map((m) => [m.id, m] as [string, any]));
    return rows.map((r) => {
      const u = umap.get(r.user_id);
      const q = r.quoted_id ? qmap.get(r.quoted_id) : null;
      const media = r.media_id && !r.deleted_at ? mmap.get(r.media_id) : null;
      return {
        id: r.id,
        chat_id: r.chat_id,
        user: { id: r.user_id, name: u?.name || 'Usuário removido', is_me: r.user_id === me },
        type: r.deleted_at ? 'deleted' : r.type,
        body: r.deleted_at ? null : r.body,
        media: media ? this.media.toPublic(media) : null,
        quoted: q ? { id: q.id, user_name: qusers.get(q.user_id)?.name || 'Usuário', preview: q.deleted_at ? 'Mensagem apagada' : this.previewOf(q) } : null,
        edited_at: r.edited_at,
        deleted: Boolean(r.deleted_at),
        created_at: r.created_at,
      };
    });
  }

  private previewOf(m: { type: string; body: string | null }) {
    const labels: Record<string, string> = { image: 'Foto', video: 'Vídeo', audio: 'Áudio', voice: 'Áudio', document: 'Documento' };
    if (m.type === 'text') return String(m.body || '').slice(0, 255);
    const label = labels[m.type] || 'Arquivo';
    return (m.body ? `${label} · ${m.body}` : label).slice(0, 255);
  }

  // ---------------------------------------------------------------- listas
  async list(orgId: string, me: string) {
    const mine = await this.prisma.team_chat_members.findMany({ where: { user_id: me }, select: { chat_id: true } });
    if (!mine.length) return { items: [], unread_total: 0 };
    const chats = await this.prisma.team_chats.findMany({ where: { organization_id: orgId, id: { in: mine.map((m) => m.chat_id) } }, orderBy: [{ last_message_at: 'desc' }, { created_at: 'desc' }] });
    const items = await this.shapeChats(orgId, me, chats);
    return { items, unread_total: items.reduce((a, c) => a + c.unread_count, 0) };
  }

  async get(orgId: string, me: string, chatId: string) {
    const { chat } = await this.requireMember(orgId, chatId, me);
    return (await this.shapeChats(orgId, me, [chat]))[0];
  }

  // ---------------------------------------------------------------- criar
  async openDm(orgId: string, me: string, otherId: string) {
    if (!otherId || otherId === me) throw new BadRequestException('Escolha outro usuário.');
    const other = await this.prisma.users.findFirst({ where: { id: otherId, organization_id: orgId, active: true }, select: { id: true } });
    if (!other) throw new NotFoundException('Usuário não encontrado na sua organização.');
    const key = [me, otherId].sort().join('|');
    let chat = await this.prisma.team_chats.findFirst({ where: { organization_id: orgId, dm_key: key } });
    if (!chat) {
      chat = await this.prisma.team_chats.create({ data: { organization_id: orgId, kind: 'dm', dm_key: key, created_by: me } });
      await this.prisma.team_chat_members.createMany({ data: [me, otherId].map((uid) => ({ chat_id: chat!.id, user_id: uid, role: 'member' })), skipDuplicates: true });
      this.emitChat(orgId, chat.id, [me, otherId], 'created');
    }
    return (await this.shapeChats(orgId, me, [chat]))[0];
  }

  async createGroup(orgId: string, me: string, name: string, memberIds: string[]) {
    const n = String(name || '').trim();
    if (!n) throw new BadRequestException('Dê um nome ao grupo.');
    const ids = [...new Set([me, ...(memberIds || []).map(String)])].slice(0, MAX_MEMBERS);
    const valid = await this.prisma.users.findMany({ where: { id: { in: ids }, organization_id: orgId, active: true }, select: { id: true } });
    const validIds = valid.map((u) => u.id);
    if (validIds.length < 2) throw new BadRequestException('Adicione ao menos um outro usuário ao grupo.');
    const chat = await this.prisma.team_chats.create({ data: { organization_id: orgId, kind: 'group', name: n.slice(0, 80), created_by: me } });
    await this.prisma.team_chat_members.createMany({ data: validIds.map((uid) => ({ chat_id: chat.id, user_id: uid, role: uid === me ? 'admin' : 'member' })), skipDuplicates: true });
    await this.system(orgId, chat.id, me, `criou o grupo "${n}"`);
    this.emitChat(orgId, chat.id, validIds, 'created');
    return (await this.shapeChats(orgId, me, [chat]))[0];
  }

  async rename(orgId: string, user: User, chatId: string, name: string) {
    await this.requireAdmin(orgId, chatId, user);
    const n = String(name || '').trim().slice(0, 80);
    if (!n) throw new BadRequestException('Dê um nome ao grupo.');
    await this.prisma.team_chats.update({ where: { id: chatId }, data: { name: n } });
    await this.system(orgId, chatId, user.userId, `renomeou o grupo para "${n}"`);
    return this.notifyAndGet(orgId, user.userId, chatId, 'updated');
  }

  async addMembers(orgId: string, user: User, chatId: string, userIds: string[]) {
    await this.requireAdmin(orgId, chatId, user);
    const current = await this.prisma.team_chat_members.count({ where: { chat_id: chatId } });
    const ids = [...new Set((userIds || []).map(String))];
    const valid = await this.prisma.users.findMany({ where: { id: { in: ids }, organization_id: orgId, active: true }, select: { id: true, name: true } });
    if (!valid.length) throw new BadRequestException('Nenhum usuário válido para adicionar.');
    if (current + valid.length > MAX_MEMBERS) throw new BadRequestException(`O grupo pode ter no máximo ${MAX_MEMBERS} membros.`);
    const res = await this.prisma.team_chat_members.createMany({ data: valid.map((u) => ({ chat_id: chatId, user_id: u.id, role: 'member' })), skipDuplicates: true });
    if (res.count) await this.system(orgId, chatId, user.userId, `adicionou ${valid.map((u) => u.name).join(', ')}`);
    return this.notifyAndGet(orgId, user.userId, chatId, 'members');
  }

  async removeMember(orgId: string, user: User, chatId: string, targetId: string) {
    const { chat, member } = await this.requireMember(orgId, chatId, user.userId);
    if (chat.kind !== 'group') throw new BadRequestException('Conversas diretas não têm membros para remover.');
    const self = targetId === user.userId;
    const orgAdmin = ['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(String(user.role || ''));
    if (!self && member.role !== 'admin' && !orgAdmin) throw new ForbiddenException('Só administradores do grupo podem remover membros.');
    const target = await this.membership(chatId, targetId);
    if (!target) throw new NotFoundException('Membro não encontrado.');
    await this.prisma.team_chat_members.delete({ where: { chat_id_user_id: { chat_id: chatId, user_id: targetId } } });
    const rest = await this.prisma.team_chat_members.findMany({ where: { chat_id: chatId } });
    if (!rest.length) {
      await this.expireMediaOfChat(chatId);
      await this.prisma.team_chats.delete({ where: { id: chatId } });
      return { ok: true, deleted: true };
    }
    // sem admin → o membro mais antigo vira admin
    if (!rest.some((m) => m.role === 'admin')) {
      const oldest = [...rest].sort((a, b) => a.joined_at.getTime() - b.joined_at.getTime())[0];
      await this.prisma.team_chat_members.update({ where: { chat_id_user_id: { chat_id: chatId, user_id: oldest.user_id } }, data: { role: 'admin' } });
    }
    const tname = (await this.userMap([targetId])).get(targetId)?.name || 'um membro';
    await this.system(orgId, chatId, user.userId, self ? 'saiu do grupo' : `removeu ${tname}`);
    this.emitChat(orgId, chatId, [...rest.map((m) => m.user_id), targetId], self ? 'left' : 'members');
    return { ok: true, deleted: false };
  }

  async setRole(orgId: string, user: User, chatId: string, targetId: string, role: string) {
    await this.requireAdmin(orgId, chatId, user);
    const target = await this.membership(chatId, targetId);
    if (!target) throw new NotFoundException('Membro não encontrado.');
    await this.prisma.team_chat_members.update({ where: { chat_id_user_id: { chat_id: chatId, user_id: targetId } }, data: { role: role === 'admin' ? 'admin' : 'member' } });
    return this.notifyAndGet(orgId, user.userId, chatId, 'members');
  }

  async deleteGroup(orgId: string, user: User, chatId: string) {
    await this.requireAdmin(orgId, chatId, user);
    const members = await this.prisma.team_chat_members.findMany({ where: { chat_id: chatId }, select: { user_id: true } });
    await this.expireMediaOfChat(chatId);
    await this.prisma.team_chats.delete({ where: { id: chatId } });
    this.emitChat(orgId, chatId, members.map((m) => m.user_id), 'deleted');
    return { ok: true };
  }

  // ---------------------------------------------------------------- mensagens
  async messages(orgId: string, me: string, chatId: string, q: { before?: string; since?: string; limit?: string | number }) {
    await this.requireMember(orgId, chatId, me);
    const limit = Math.min(200, Math.max(1, parseInt(String(q.limit || PAGE), 10) || PAGE));
    const where: any = { chat_id: chatId };
    if (q.since) {
      const d = new Date(q.since);
      if (!Number.isNaN(d.getTime())) where.created_at = { gt: d };
      const rows = await this.prisma.team_messages.findMany({ where, orderBy: { created_at: 'asc' }, take: 300 });
      return { items: await this.shapeMessages(orgId, rows, me), server_time: new Date().toISOString() };
    }
    if (q.before) {
      const d = new Date(q.before);
      if (!Number.isNaN(d.getTime())) where.created_at = { lt: d };
    }
    const rows = await this.prisma.team_messages.findMany({ where, orderBy: { created_at: 'desc' }, take: limit + 1 });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).reverse();
    return { items: await this.shapeMessages(orgId, page, me), has_more: hasMore, server_time: new Date().toISOString() };
  }

  async send(orgId: string, me: string, chatId: string, dto: { text?: string; media_id?: string; quoted_id?: string }) {
    const { chat } = await this.requireMember(orgId, chatId, me);
    const text = String(dto.text || '').trim();
    let type = 'text';
    let mediaId: string | null = null;
    if (dto.media_id) {
      const m = await this.prisma.whatsapp_media.findFirst({ where: { id: String(dto.media_id), organization_id: orgId } });
      if (!m) throw new NotFoundException('Arquivo não encontrado.');
      mediaId = m.id;
      type = ['image', 'video', 'audio', 'voice', 'document'].includes(m.kind) ? m.kind : kindOfMime(m.mime);
      if (type === 'sticker') type = 'image';
      // mídia usada no chat da equipe não vence
      await this.prisma.whatsapp_media.update({ where: { id: m.id }, data: { expires_at: null } }).catch(() => undefined);
    }
    if (!text && !mediaId) throw new BadRequestException('Escreva uma mensagem ou anexe um arquivo.');
    let quotedId: string | null = null;
    if (dto.quoted_id) {
      const q = await this.prisma.team_messages.findFirst({ where: { id: String(dto.quoted_id), chat_id: chatId }, select: { id: true } });
      quotedId = q?.id || null;
    }
    const row = await this.prisma.team_messages.create({ data: { organization_id: orgId, chat_id: chatId, user_id: me, type, body: text || null, media_id: mediaId, quoted_id: quotedId } });
    const preview = this.previewOf({ type, body: text });
    await this.prisma.team_chats.update({ where: { id: chatId }, data: { last_message_at: row.created_at, last_preview: preview, last_user_id: me } });
    await this.prisma.team_chat_members.update({ where: { chat_id_user_id: { chat_id: chatId, user_id: me } }, data: { last_read_at: row.created_at } }).catch(() => undefined);
    const shaped = (await this.shapeMessages(orgId, [row], me))[0];
    await this.emitMessage(orgId, chat.id, shaped);
    return shaped;
  }

  async edit(orgId: string, me: string, messageId: string, text: string) {
    const row = await this.prisma.team_messages.findFirst({ where: { id: messageId, organization_id: orgId } });
    if (!row || row.user_id !== me) throw new NotFoundException('Mensagem não encontrada.');
    if (row.deleted_at || row.type !== 'text') throw new BadRequestException('Só mensagens de texto podem ser editadas.');
    const t = String(text || '').trim();
    if (!t) throw new BadRequestException('Mensagem vazia.');
    const upd = await this.prisma.team_messages.update({ where: { id: row.id }, data: { body: t, edited_at: new Date() } });
    const last = await this.prisma.team_messages.findFirst({ where: { chat_id: row.chat_id, deleted_at: null }, orderBy: { created_at: 'desc' }, select: { id: true } });
    if (last?.id === row.id) await this.prisma.team_chats.update({ where: { id: row.chat_id }, data: { last_preview: this.previewOf({ type: 'text', body: t }) } });
    const shaped = (await this.shapeMessages(orgId, [upd], me))[0];
    await this.emitMessage(orgId, row.chat_id, shaped, 'team:message_updated');
    return shaped;
  }

  async remove(orgId: string, user: User, messageId: string) {
    const row = await this.prisma.team_messages.findFirst({ where: { id: messageId, organization_id: orgId } });
    if (!row) throw new NotFoundException('Mensagem não encontrada.');
    if (row.user_id !== user.userId) {
      // admin do grupo pode apagar mensagens de outros
      await this.requireAdmin(orgId, row.chat_id, user);
    }
    const upd = await this.prisma.team_messages.update({ where: { id: row.id }, data: { deleted_at: new Date() } });
    // a mídia da mensagem apagada volta a vencer (o cron de 4h apaga o arquivo se nada mais a referencia)
    if (row.media_id) await this.prisma.whatsapp_media.updateMany({ where: { id: row.media_id }, data: { expires_at: new Date() } }).catch(() => undefined);
    const last = await this.prisma.team_messages.findFirst({ where: { chat_id: row.chat_id, deleted_at: null }, orderBy: { created_at: 'desc' } });
    await this.prisma.team_chats.update({ where: { id: row.chat_id }, data: { last_preview: last ? this.previewOf(last as any) : null, last_user_id: last?.user_id || null } });
    const shaped = (await this.shapeMessages(orgId, [upd], user.userId))[0];
    await this.emitMessage(orgId, row.chat_id, shaped, 'team:message_updated');
    return shaped;
  }

  async markRead(orgId: string, me: string, chatId: string) {
    await this.requireMember(orgId, chatId, me);
    await this.prisma.team_chat_members.update({ where: { chat_id_user_id: { chat_id: chatId, user_id: me } }, data: { last_read_at: new Date() } });
    this.realtime.toUser(orgId, me, 'team:read', { chat_id: chatId });
    return { ok: true };
  }

  async upload(orgId: string, buf: Buffer, mime: string, name: string | null, asVoice = false) {
    const m = await this.media.store(orgId, buf, mime, name, asVoice ? 'voice' : kindOfMime(mime));
    return this.media.toPublic(m);
  }

  /** Ids de mídia usados no chat da equipe (não vencem na limpeza de 90 dias). */
  // conversa apagada: as mídias das mensagens dela voltam a vencer (cron de 4h remove os arquivos órfãos)
  private async expireMediaOfChat(chatId: string) {
    const rows = await this.prisma.team_messages.findMany({ where: { chat_id: chatId, media_id: { not: null } }, select: { media_id: true } });
    const ids = rows.map((r) => r.media_id as string);
    if (ids.length) await this.prisma.whatsapp_media.updateMany({ where: { id: { in: ids } }, data: { expires_at: new Date() } }).catch(() => undefined);
  }

  async referencedMediaIds(orgIds?: string[]) {
    const rows = await this.prisma.team_messages.findMany({ where: { ...(orgIds?.length ? { organization_id: { in: orgIds } } : {}), media_id: { not: null }, deleted_at: null }, select: { media_id: true } });
    return rows.map((r) => r.media_id as string);
  }

  // ---------------------------------------------------------------- mensagens de sistema + tempo real
  private async system(orgId: string, chatId: string, actorId: string, text: string) {
    const row = await this.prisma.team_messages.create({ data: { organization_id: orgId, chat_id: chatId, user_id: actorId, type: 'system', body: text } }).catch(() => null);
    if (row) {
      const shaped = (await this.shapeMessages(orgId, [row], actorId))[0];
      await this.emitMessage(orgId, chatId, shaped);
    }
  }

  private async emitMessage(orgId: string, chatId: string, message: any, event = 'team:message') {
    const members = await this.prisma.team_chat_members.findMany({ where: { chat_id: chatId }, select: { user_id: true } });
    for (const m of members) this.realtime.toUser(orgId, m.user_id, event, { chat_id: chatId, message: { ...message, user: { ...message.user, is_me: message.user?.id === m.user_id } } });
  }

  private emitChat(orgId: string, chatId: string, userIds: string[], action: string) {
    for (const uid of userIds) this.realtime.toUser(orgId, uid, 'team:chat', { chat_id: chatId, action });
  }

  private async notifyAndGet(orgId: string, me: string, chatId: string, action: string) {
    const members = await this.prisma.team_chat_members.findMany({ where: { chat_id: chatId }, select: { user_id: true } });
    this.emitChat(orgId, chatId, members.map((m) => m.user_id), action);
    return this.get(orgId, me, chatId);
  }
}
