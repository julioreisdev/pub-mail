import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as tg from './telegram-api.util';

const PAGE_SIZE = 30;

type MediaParts = {
  text: string;
  media_type?: string;
  media_file_id?: string;
  preview: string;
};

function extractMedia(m: any): MediaParts {
  if (m.text) return { text: m.text, preview: m.text };
  if (m.photo?.length) {
    const f = m.photo[m.photo.length - 1];
    const cap = m.caption || '';
    return { text: cap, media_type: 'photo', media_file_id: f.file_id, preview: cap ? `📷 ${cap}` : '📷 Foto' };
  }
  if (m.sticker) {
    return {
      text: m.sticker.emoji || '',
      media_type: 'sticker',
      media_file_id: m.sticker.file_id,
      preview: m.sticker.emoji ? `${m.sticker.emoji} Sticker` : '🖼️ Sticker',
    };
  }
  if (m.animation) return { text: m.caption || '', media_type: 'animation', media_file_id: m.animation.file_id, preview: '🎞️ GIF' };
  if (m.video) return { text: m.caption || '', media_type: 'video', media_file_id: m.video.file_id, preview: '🎬 Vídeo' };
  if (m.voice) return { text: '', media_type: 'voice', media_file_id: m.voice.file_id, preview: '🎤 Áudio' };
  if (m.audio) return { text: m.caption || '', media_type: 'audio', media_file_id: m.audio.file_id, preview: '🎵 Áudio' };
  if (m.document) {
    return {
      text: m.caption || '',
      media_type: 'document',
      media_file_id: m.document.file_id,
      preview: m.document.file_name ? `📎 ${m.document.file_name}` : '📎 Arquivo',
    };
  }
  return { text: '', preview: '💬 Mensagem' };
}

@Injectable()
export class TelegramChatService {
  private readonly logger = new Logger(TelegramChatService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------- captura via webhook ----------------
  async captureUpdate(bot: { id: string; organization_id: string }, update: any): Promise<void> {
    try {
      // Descoberta de grupo/canal por my_chat_member (bot adicionado/removido/promovido).
      const cm = update?.my_chat_member || update?.chat_member;
      if (!update?.message && !update?.edited_message && !update?.channel_post && !update?.edited_channel_post && cm?.chat) {
        if (['group', 'supergroup', 'channel'].includes(cm.chat.type)) {
          await this.upsertGroup(bot, cm.chat);
        }
        return;
      }

      const m = update?.message || update?.edited_message || update?.channel_post || update?.edited_channel_post;
      const chat = m?.chat;
      if (!chat) return;

      // migração grupo→supergrupo: remove a linha antiga (evita duplicado no seletor).
      if (m?.migrate_to_chat_id) {
        await this.prisma.telegram_groups.deleteMany({ where: { bot_id: bot.id, tg_chat_id: BigInt(chat.id) } }).catch(() => undefined);
        return;
      }
      if (m?.migrate_from_chat_id) {
        await this.prisma.telegram_groups
          .deleteMany({ where: { bot_id: bot.id, tg_chat_id: BigInt(m.migrate_from_chat_id) } })
          .catch(() => undefined);
      }

      const parts = extractMedia(m);

      if (chat.type === 'private') {
        const from = m.from || {};
        const contact = await this.upsertContact(bot, from, parts);
        await this.prisma.telegram_messages.create({
          data: {
            organization_id: bot.organization_id,
            bot_id: bot.id,
            chat_kind: 'CONTACT',
            contact_id: contact.id,
            tg_chat_id: BigInt(chat.id),
            direction: 'IN',
            tg_message_id: m.message_id ? BigInt(m.message_id) : null,
            text: parts.text || null,
            media_type: parts.media_type || null,
            media_file_id: parts.media_file_id || null,
          },
        });
        // mantém o botão de teste funcionando
        await this.prisma.telegram_bots
          .update({ where: { id: bot.id }, data: { test_chat_id: BigInt(chat.id) } })
          .catch(() => undefined);
      } else if (chat.type === 'group' || chat.type === 'supergroup' || chat.type === 'channel') {
        const from = m.from || {};
        // canal não tem `from` (post anônimo); usa a assinatura ou o título.
        const fromName =
          chat.type === 'channel'
            ? m.author_signature || chat.title || 'Canal'
            : [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || 'Alguém';
        // na lista, a prévia mostra quem enviou.
        const group = await this.upsertGroup(bot, chat, { ...parts, preview: `${fromName}: ${parts.preview}` });
        await this.prisma.telegram_messages.create({
          data: {
            organization_id: bot.organization_id,
            bot_id: bot.id,
            chat_kind: 'GROUP',
            group_id: group.id,
            tg_chat_id: BigInt(chat.id),
            direction: 'IN',
            tg_message_id: m.message_id ? BigInt(m.message_id) : null,
            text: parts.text || null,
            media_type: parts.media_type || null,
            media_file_id: parts.media_file_id || null,
            from_name: fromName,
          },
        });
      }
    } catch (err: any) {
      this.logger.warn(`captureUpdate falhou: ${err?.message || err}`);
    }
  }

  private async upsertContact(bot: { id: string; organization_id: string }, from: any, parts?: MediaParts) {
    const existing = await this.prisma.telegram_contacts.findFirst({
      where: { bot_id: bot.id, tg_user_id: BigInt(from.id) },
      select: { id: true },
    });
    const data: any = {
      first_name: from.first_name || null,
      last_name: from.last_name || null,
      username: from.username || null,
    };
    if (parts) {
      data.last_message_text = parts.preview.slice(0, 500);
      data.last_message_at = new Date();
      data.last_message_dir = 'IN';
    }
    if (existing) {
      await this.prisma.telegram_contacts.update({ where: { id: existing.id }, data });
      return existing;
    }
    return this.prisma.telegram_contacts.create({
      data: {
        organization_id: bot.organization_id,
        bot_id: bot.id,
        tg_user_id: BigInt(from.id),
        ...data,
      },
      select: { id: true },
    });
  }

  private async upsertGroup(bot: { id: string; organization_id: string }, chat: any, parts?: MediaParts) {
    const existing = await this.prisma.telegram_groups.findFirst({
      where: { bot_id: bot.id, tg_chat_id: BigInt(chat.id) },
      select: { id: true },
    });
    const data: any = {
      title: chat.title || null,
      username: chat.username || null,
      type: chat.type || null,
    };
    if (parts) {
      data.last_message_text = parts.preview.slice(0, 500);
      data.last_message_at = new Date();
    }
    if (existing) {
      await this.prisma.telegram_groups.update({ where: { id: existing.id }, data });
      return existing;
    }
    return this.prisma.telegram_groups.create({
      data: {
        organization_id: bot.organization_id,
        bot_id: bot.id,
        tg_chat_id: BigInt(chat.id),
        ...data,
      },
      select: { id: true },
    });
  }

  // ---------------- mapeadores ----------------
  private mapContact(c: any) {
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.username || 'Sem nome';
    return {
      id: c.id,
      kind: 'CONTACT',
      tg_user_id: String(c.tg_user_id),
      name,
      username: c.username,
      tags: Array.isArray(c.tags) ? c.tags : [],
      last_message_text: c.last_message_text,
      last_message_at: c.last_message_at,
      last_message_dir: c.last_message_dir,
    };
  }

  private mapGroup(g: any) {
    return {
      id: g.id,
      kind: 'GROUP',
      tg_chat_id: String(g.tg_chat_id),
      name: g.title || 'Grupo',
      username: g.username,
      type: g.type,
      last_message_text: g.last_message_text,
      last_message_at: g.last_message_at,
    };
  }

  private mapMessage(m: any) {
    const isImage = m.media_type === 'photo' || m.media_type === 'sticker';
    return {
      id: m.id,
      direction: m.direction,
      text: m.text,
      media_type: m.media_type,
      has_image: isImage && !!m.media_file_id,
      from_name: m.from_name,
      tg_message_id: m.tg_message_id != null ? String(m.tg_message_id) : null,
      created_at: m.created_at,
    };
  }

  // ---------------- leitura ----------------
  private async assertBot(orgId: string, botId: string) {
    const bot = await this.prisma.telegram_bots.findFirst({
      where: { id: botId, organization_id: orgId },
      select: { id: true, token: true, status: true, name: true, username: true },
    });
    if (!bot) throw new NotFoundException('Bot não encontrado.');
    return bot;
  }

  async listConversations(orgId: string, botId: string, q: string, page: number) {
    const isAll = botId === 'all';
    if (!isAll) await this.assertBot(orgId, botId);
    const p = Math.max(1, Number(page) || 1);

    const where: any = { organization_id: orgId };
    if (!isAll) where.bot_id = botId;
    const term = String(q || '').trim();
    if (term) {
      const ors: any[] = [
        { username: { contains: term } },
        { first_name: { contains: term } },
        { last_name: { contains: term } },
      ];
      const digits = term.replace(/\D/g, '');
      if (digits) {
        try {
          ors.push({ tg_user_id: BigInt(digits) });
        } catch {
          /* ignore */
        }
      }
      where.OR = ors;
    }

    const [total, rows] = await Promise.all([
      this.prisma.telegram_contacts.count({ where }),
      this.prisma.telegram_contacts.findMany({
        where,
        orderBy: [{ last_message_at: 'desc' }, { created_at: 'desc' }],
        skip: (p - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);

    return {
      items: rows.map((r) => this.mapContact(r)),
      page: p,
      page_size: PAGE_SIZE,
      total,
      has_more: p * PAGE_SIZE < total,
    };
  }

  async listGroups(orgId: string, botId: string) {
    return this.listChats(orgId, botId, false);
  }
  async listChannels(orgId: string, botId: string) {
    return this.listChats(orgId, botId, true);
  }

  private async listChats(orgId: string, botId: string, channel: boolean) {
    const isAll = botId === 'all';
    if (!isAll) await this.assertBot(orgId, botId);
    const where: any = { organization_id: orgId };
    if (!isAll) where.bot_id = botId;
    where.type = channel ? 'channel' : { not: 'channel' };

    const rows = await this.prisma.telegram_groups.findMany({
      where,
      orderBy: [{ last_message_at: 'desc' }, { created_at: 'desc' }],
      take: 100,
    });
    if (!rows.length) return [];

    // contagem de inscritos (getChatMemberCount) — token por bot.
    const botIds = [...new Set(rows.map((r) => r.bot_id))];
    const bots = await this.prisma.telegram_bots.findMany({
      where: { id: { in: botIds }, organization_id: orgId },
      select: { id: true, token: true, name: true, username: true, status: true },
    });
    const tokenById = new Map(bots.map((b) => [b.id, b.token]));
    const botById = new Map(bots.map((b) => [b.id, { id: b.id, name: b.name, username: b.username, status: b.status }]));

    const [counts, lasts] = await Promise.all([
      Promise.all(
        rows.map(async (r) => {
          const token = tokenById.get(r.bot_id);
          if (!token) return null;
          const c = await tg.getChatMemberCount(token, String(r.tg_chat_id));
          return c.ok && typeof c.result === 'number' ? c.result : null;
        }),
      ),
      // prévia calculada na hora (com o autor) — robusto p/ dados antigos e novos.
      Promise.all(
        rows.map((r) =>
          this.prisma.telegram_messages.findFirst({
            where: { group_id: r.id },
            orderBy: { created_at: 'desc' },
            select: { direction: true, from_name: true, text: true, media_type: true },
          }),
        ),
      ),
    ]);

    // Dedupe de duplicatas MORTAS (migração grupo→supergrupo cria 2 linhas com o mesmo
    // bot+título; a antiga não responde ao getChatMemberCount). Apaga a morta quando há uma viva.
    const byKey = new Map<string, { g: any; count: number | null; last: any }[]>();
    rows.forEach((g, i) => {
      const key = `${g.bot_id}::${String(g.title || '').trim().toLowerCase()}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push({ g, count: counts[i], last: lasts[i] });
    });
    const toDelete: string[] = [];
    const kept: { g: any; count: number | null; last: any }[] = [];
    for (const arr of byKey.values()) {
      if (arr.length > 1 && arr.some((x) => x.count != null)) {
        for (const x of arr) {
          if (x.count == null) toDelete.push(x.g.id);
          else kept.push(x);
        }
      } else {
        kept.push(...arr);
      }
    }
    if (toDelete.length) {
      await this.prisma.telegram_groups.deleteMany({ where: { id: { in: toDelete } } }).catch(() => undefined);
    }
    kept.sort((a, b) => new Date(b.g.last_message_at || 0).getTime() - new Date(a.g.last_message_at || 0).getTime());

    return kept.map(({ g, count, last }) => {
      const base = this.mapGroup(g);
      if (last) {
        const sender = last.direction === 'OUT' ? 'Você' : last.from_name || 'Alguém';
        base.last_message_text = `${sender}: ${last.text || this.mediaLabel(last.media_type)}`;
      }
      return { ...base, member_count: count, bot: botById.get(g.bot_id) || null };
    });
  }

  // Bot sai do grupo + remove a linha (mensagens em cascata).
  async leaveGroup(orgId: string, groupId: string) {
    const g = await this.prisma.telegram_groups.findFirst({ where: { id: groupId, organization_id: orgId } });
    if (!g) throw new NotFoundException('Grupo não encontrado.');
    const bot = await this.prisma.telegram_bots.findFirst({ where: { id: g.bot_id, organization_id: orgId }, select: { token: true } });
    if (bot?.token) await tg.leaveChat(bot.token, String(g.tg_chat_id)).catch(() => undefined);
    await this.prisma.telegram_groups.delete({ where: { id: g.id } }).catch(() => undefined);
    return { ok: true, id: g.id };
  }

  private mediaLabel(t?: string | null): string {
    switch (t) {
      case 'photo':
        return '📷 Foto';
      case 'sticker':
        return '🖼️ Sticker';
      case 'video':
        return '🎬 Vídeo';
      case 'voice':
      case 'audio':
        return '🎤 Áudio';
      case 'animation':
        return '🎞️ GIF';
      case 'document':
        return '📎 Arquivo';
      default:
        return '💬 Mensagem';
    }
  }

  private async loadTarget(orgId: string, kind: string, id: string) {
    if (kind === 'CONTACT') {
      const c = await this.prisma.telegram_contacts.findFirst({ where: { id, organization_id: orgId } });
      if (!c) throw new NotFoundException('Conversa não encontrada.');
      return { kind: 'CONTACT' as const, row: c, botId: c.bot_id, chatId: c.tg_user_id };
    }
    if (kind === 'GROUP') {
      const g = await this.prisma.telegram_groups.findFirst({ where: { id, organization_id: orgId } });
      if (!g) throw new NotFoundException('Grupo não encontrado.');
      return { kind: 'GROUP' as const, row: g, botId: g.bot_id, chatId: g.tg_chat_id };
    }
    throw new BadRequestException('Tipo de chat inválido.');
  }

  async getMessages(orgId: string, kind: string, id: string, since?: string) {
    const target = await this.loadTarget(orgId, kind, id);
    const where: any = { organization_id: orgId };
    if (kind === 'CONTACT') where.contact_id = id;
    else where.group_id = id;

    let rows: any[];
    if (since) {
      const dt = new Date(since);
      if (!Number.isNaN(dt.getTime())) where.created_at = { gt: dt };
      rows = await this.prisma.telegram_messages.findMany({ where, orderBy: { created_at: 'asc' }, take: 200 });
    } else {
      const desc = await this.prisma.telegram_messages.findMany({ where, orderBy: { created_at: 'desc' }, take: 100 });
      rows = desc.reverse();
    }

    return {
      messages: rows.map((m) => this.mapMessage(m)),
      server_time: new Date().toISOString(),
      chat: kind === 'CONTACT' ? this.mapContact(target.row) : this.mapGroup(target.row),
    };
  }

  // ---------------- envio ----------------
  async send(
    orgId: string,
    kind: string,
    id: string,
    text: string | undefined,
    file?: { buffer: Buffer; originalname: string },
  ) {
    const target = await this.loadTarget(orgId, kind, id);
    const bot = await this.assertBot(orgId, target.botId);
    if (bot.status === 'BANNED') {
      throw new BadRequestException('Bot indisponível (banido). Revalide ou troque o token.');
    }
    const cleanText = String(text || '').trim();
    if (!file && !cleanText) throw new BadRequestException('Escreva uma mensagem ou anexe uma foto.');

    let result: tg.TgResult<any>;
    let mediaType: string | null = null;
    let mediaFileId: string | null = null;
    let storedText: string | null = cleanText || null;

    if (file) {
      result = await tg.sendPhoto(bot.token, String(target.chatId), file.buffer, file.originalname, cleanText || undefined);
      if (result.ok && Array.isArray(result.result?.photo) && result.result.photo.length) {
        mediaType = 'photo';
        mediaFileId = result.result.photo[result.result.photo.length - 1].file_id;
      }
    } else {
      result = await tg.sendMessage(bot.token, String(target.chatId), cleanText);
    }

    if (!result.ok) {
      if (result.error_code === 403) {
        throw new BadRequestException(
          'Não consegui enviar: o destinatário parou/bloqueou o bot (ou o bot não está no grupo).',
        );
      }
      if (result.unauthorized) throw new BadRequestException('Token inválido/revogado. Revalide o bot.');
      throw new BadRequestException(`Falha ao enviar: ${result.description || 'erro desconhecido'}.`);
    }

    const created = await this.prisma.telegram_messages.create({
      data: {
        organization_id: orgId,
        bot_id: bot.id,
        chat_kind: kind === 'GROUP' ? 'GROUP' : 'CONTACT',
        contact_id: kind === 'CONTACT' ? id : null,
        group_id: kind === 'GROUP' ? id : null,
        tg_chat_id: target.chatId,
        direction: 'OUT',
        tg_message_id: result.result?.message_id ? BigInt(result.result.message_id) : null,
        text: storedText,
        media_type: mediaType,
        media_file_id: mediaFileId,
      },
    });

    // atualiza a prévia da conversa
    const preview = mediaType === 'photo' ? (storedText ? `📷 ${storedText}` : '📷 Foto') : storedText || '';
    if (kind === 'CONTACT') {
      await this.prisma.telegram_contacts
        .update({ where: { id }, data: { last_message_text: preview.slice(0, 500), last_message_at: new Date(), last_message_dir: 'OUT' } })
        .catch(() => undefined);
    } else {
      await this.prisma.telegram_groups
        .update({ where: { id }, data: { last_message_text: `Você: ${preview}`.slice(0, 500), last_message_at: new Date() } })
        .catch(() => undefined);
    }

    return this.mapMessage(created);
  }

  // ---------------- mídia (proxy binário) ----------------
  async getContactPhoto(orgId: string, contactId: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const c = await this.prisma.telegram_contacts.findFirst({ where: { id: contactId, organization_id: orgId } });
    if (!c) return null;
    const bot = await this.prisma.telegram_bots.findFirst({
      where: { id: c.bot_id, organization_id: orgId },
      select: { token: true },
    });
    if (!bot) return null;

    const photos = await tg.getUserProfilePhotos(bot.token, String(c.tg_user_id));
    const arr = photos.ok ? photos.result?.photos : null;
    if (!arr || !arr.length || !arr[0]?.length) return null;
    const sizes = arr[0];
    const fileId = (sizes[1] || sizes[0]).file_id; // tamanho pequeno/médio p/ avatar
    const file = await tg.getFile(bot.token, fileId);
    if (!file.ok || !file.result?.file_path) return null;
    return tg.downloadFile(bot.token, file.result.file_path);
  }

  // Link de convite do grupo: público → t.me/@user; privado → cria via bot admin.
  async getGroupInviteLink(orgId: string, groupId: string): Promise<{ url: string }> {
    const g = await this.prisma.telegram_groups.findFirst({ where: { id: groupId, organization_id: orgId } });
    if (!g) throw new NotFoundException('Grupo não encontrado.');
    if (g.username) return { url: `https://t.me/${g.username}` };
    const bot = await this.prisma.telegram_bots.findFirst({
      where: { id: g.bot_id, organization_id: orgId },
      select: { token: true },
    });
    if (!bot) throw new NotFoundException('Bot não encontrado.');
    const r = await tg.createChatInviteLink(bot.token, String(g.tg_chat_id), 'Pub Mail');
    if (!r.ok || !r.result?.invite_link) {
      throw new BadRequestException(
        `Não foi possível gerar o link: ${r.description || 'erro'}. O bot precisa ser admin do grupo com permissão de convidar.`,
      );
    }
    return { url: r.result.invite_link };
  }

  async getGroupPhoto(orgId: string, groupId: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const g = await this.prisma.telegram_groups.findFirst({ where: { id: groupId, organization_id: orgId } });
    if (!g) return null;
    const bot = await this.prisma.telegram_bots.findFirst({
      where: { id: g.bot_id, organization_id: orgId },
      select: { token: true },
    });
    if (!bot) return null;
    const chat = await tg.getChat(bot.token, String(g.tg_chat_id));
    const photo = chat.ok ? chat.result?.photo : null;
    const fileId = photo?.small_file_id || photo?.big_file_id;
    if (!fileId) return null;
    const file = await tg.getFile(bot.token, fileId);
    if (!file.ok || !file.result?.file_path) return null;
    return tg.downloadFile(bot.token, file.result.file_path);
  }

  async getMessageMedia(orgId: string, messageId: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const m = await this.prisma.telegram_messages.findFirst({ where: { id: messageId, organization_id: orgId } });
    if (!m || !m.media_file_id) return null;
    const bot = await this.prisma.telegram_bots.findFirst({
      where: { id: m.bot_id, organization_id: orgId },
      select: { token: true },
    });
    if (!bot) return null;
    const file = await tg.getFile(bot.token, m.media_file_id);
    if (!file.ok || !file.result?.file_path) return null;
    return tg.downloadFile(bot.token, file.result.file_path);
  }
}
