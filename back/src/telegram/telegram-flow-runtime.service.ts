import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramAutomationsService } from './telegram-automations.service';
import { TelegramRotatorsRunner } from './telegram-rotators.runner';
import * as tg from './telegram-api.util';

type Bot = { id: string; organization_id: string };
type Info = { first_name?: string; last_name?: string; username?: string; start_param?: string };

@Injectable()
export class TelegramFlowRuntimeService {
  private readonly logger = new Logger(TelegramFlowRuntimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly automations: TelegramAutomationsService,
    private readonly rotators: TelegramRotatorsRunner,
  ) {}

  // Chamado pelo webhook após a captura. Best-effort, nunca lança.
  async handleUpdate(bot: Bot, update: any): Promise<void> {
    try {
      // Inscreve nas automações no /start (independente de haver fluxo).
      const sm = update.message;
      if (sm && sm.chat?.type === 'private' && /^\/start(\b|@|$)/i.test(String(sm.text || '').trim())) {
        await this.automations.enrollOnStart(bot, sm.from?.id).catch(() => undefined);
      }

      const flow = await this.prisma.telegram_flows.findFirst({
        where: { bot_id: bot.id, organization_id: bot.organization_id, active: true },
      });
      if (!flow || !flow.definition) return;
      const def: any = flow.definition;
      if (!Array.isArray(def.nodes) || !def.nodes.length) return;

      const botRow = await this.prisma.telegram_bots.findFirst({ where: { id: bot.id }, select: { token: true } });
      if (!botRow?.token) return;
      const token = botRow.token;

      if (update.callback_query) {
        await this.onCallback(bot, token, def, update.callback_query);
        return;
      }
      const m = update.message;
      if (m && m.chat?.type === 'private') {
        await this.onMessage(bot, token, def, m);
      }
    } catch (e: any) {
      this.logger.warn(`flow handleUpdate falhou: ${e?.message || e}`);
    }
  }

  // ---------- helpers de grafo ----------
  private findNode(def: any, id?: string | null) {
    if (!id) return null;
    return (def.nodes || []).find((n: any) => n.id === id) || null;
  }
  private edgeTarget(def: any, nodeId: string, handle: string): string | null {
    const e = (def.edges || []).find((x: any) => x.source === nodeId && x.sourceHandle === handle);
    return e?.target || null;
  }
  private hasOutgoing(def: any, nodeId: string): boolean {
    return (def.edges || []).some((x: any) => x.source === nodeId);
  }

  private interpolate(text: string, info: Info): string {
    return String(text || '')
      .replace(/\{\{\s*(nome|name|first_name)\s*\}\}/gi, info.first_name || '')
      .replace(/\{\{\s*(sobrenome|last_name)\s*\}\}/gi, info.last_name || '')
      .replace(/\{\{\s*username\s*\}\}/gi, info.username ? `@${info.username}` : '')
      .replace(/\{\{\s*(start_param|param|origem)\s*\}\}/gi, info.start_param || '');
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async attrsOf(bot: Bot, tgUserId: number | string): Promise<any> {
    const c = await this.prisma.telegram_contacts.findFirst({
      where: { bot_id: bot.id, tg_user_id: BigInt(tgUserId) },
      select: { attributes: true },
    });
    return (c?.attributes as any) || {};
  }

  private async storeStartParam(bot: Bot, tgUserId: number | string, param: string) {
    const c = await this.prisma.telegram_contacts.findFirst({
      where: { bot_id: bot.id, tg_user_id: BigInt(tgUserId) },
      select: { id: true, attributes: true },
    });
    if (!c) return;
    const attrs = c.attributes && typeof c.attributes === 'object' ? { ...(c.attributes as any) } : {};
    attrs.start_param = String(param).slice(0, 255);
    await this.prisma.telegram_contacts.update({ where: { id: c.id }, data: { attributes: attrs } }).catch(() => undefined);
  }

  // Aplica tags no contato (append, sem duplicar). Usado por fluxo e automações.
  async applyTags(bot: Bot, tgUserId: number | string, tags: string[]) {
    if (!Array.isArray(tags) || !tags.length) return;
    const c = await this.prisma.telegram_contacts.findFirst({
      where: { bot_id: bot.id, tg_user_id: BigInt(tgUserId) },
      select: { id: true, tags: true },
    });
    if (!c) return;
    const cur = Array.isArray(c.tags) ? (c.tags as any[]) : [];
    const set = new Set(cur.map((t) => String(t)));
    for (const t of tags) {
      const v = String(t || '').trim();
      if (v) set.add(v);
    }
    await this.prisma.telegram_contacts.update({ where: { id: c.id }, data: { tags: [...set] } }).catch(() => undefined);
  }

  // ---------- entrada por mensagem ----------
  private async onMessage(bot: Bot, token: string, def: any, m: any) {
    const from = m.from || {};
    const chatId = m.chat.id;
    const text = String(m.text || '').trim();
    const info: Info = { first_name: from.first_name, last_name: from.last_name, username: from.username };

    if (/^\/start(\b|@|$)/i.test(text)) {
      const paramMatch = text.match(/^\/start(?:@\w+)?\s+(.+)$/i);
      const param = paramMatch ? paramMatch[1].trim() : null;
      if (param) await this.storeStartParam(bot, from.id, param);
      info.start_param = param || (await this.attrsOf(bot, from.id))?.start_param || '';

      const startTarget = this.edgeTarget(def, 'start', 'out');
      if (!startTarget) return;
      await this.resetEnrollment(bot, from.id);
      await this.advance(bot, token, chatId, from.id, def, startTarget, info);
      return;
    }

    info.start_param = (await this.attrsOf(bot, from.id))?.start_param || '';
    const enr = await this.prisma.telegram_flow_enrollments.findFirst({
      where: { bot_id: bot.id, tg_user_id: BigInt(from.id), status: 'ACTIVE' },
    });
    if (!enr || !enr.current_node_id) return;
    const node = this.findNode(def, enr.current_node_id);
    if (!node) return;

    let targetId: string | null = null;
    const low = text.toLowerCase();
    for (const a of node.data?.answers || []) {
      const kw = String(a.keyword || '').toLowerCase().trim();
      if (kw && low.includes(kw)) {
        targetId = this.edgeTarget(def, node.id, `ans-${a.id}`);
        if (targetId) break;
      }
    }
    if (!targetId) targetId = this.edgeTarget(def, node.id, 'fallback');
    if (!targetId) return; // fica no mesmo passo
    await this.advance(bot, token, chatId, from.id, def, targetId, info);
  }

  // ---------- entrada por botão ----------
  private async onCallback(bot: Bot, token: string, def: any, cq: any) {
    const from = cq.from || {};
    const chatId = cq.message?.chat?.id ?? from.id;
    await tg.answerCallbackQuery(token, cq.id).catch(() => undefined);

    const data = String(cq.data || '');
    if (!data.startsWith('fb:')) return;
    const buttonId = data.slice(3);

    const enr = await this.prisma.telegram_flow_enrollments.findFirst({
      where: { bot_id: bot.id, tg_user_id: BigInt(from.id), status: 'ACTIVE' },
    });
    if (!enr || !enr.current_node_id) return;
    const node = this.findNode(def, enr.current_node_id);
    if (!node) return;

    const targetId = this.edgeTarget(def, node.id, `btn-${buttonId}`);
    if (!targetId) return;
    const info: Info = {
      first_name: from.first_name,
      last_name: from.last_name,
      username: from.username,
      start_param: (await this.attrsOf(bot, from.id))?.start_param || '',
    };
    await this.advance(bot, token, chatId, from.id, def, targetId, info);
  }

  // ---------- avançar (envia nó + grava posição) ----------
  private async advance(bot: Bot, token: string, chatId: number, tgUserId: number, def: any, nodeId: string, info: Info) {
    await this.sendNode(bot, token, chatId, tgUserId, def, nodeId, info);
    // empurra a mensagem rotativa (se houver) pra baixo do que acabou de ser enviado
    await this.rotators.bumpForContact(bot.id, tgUserId).catch(() => undefined);
    const terminal = !this.hasOutgoing(def, nodeId);
    await this.prisma.telegram_flow_enrollments
      .updateMany({
        where: { bot_id: bot.id, tg_user_id: BigInt(tgUserId) },
        data: { current_node_id: nodeId, status: terminal ? 'COMPLETED' : 'ACTIVE', last_interaction_at: new Date() },
      })
      .catch(() => undefined);
  }

  private async sendNode(bot: Bot, token: string, chatId: number, tgUserId: number, def: any, nodeId: string, info: Info) {
    const node = this.findNode(def, nodeId);
    if (!node) return;

    const rows: any[] = [];
    for (const b of node.data?.buttons || []) {
      if (b.action === 'plan' && b.plan_id) rows.push([{ text: b.label || 'Comprar', callback_data: `pay:${b.plan_id}` }]);
      else if (b.action === 'next') rows.push([{ text: b.label || 'Botão', callback_data: `fb:${b.id}` }]);
      else if (b.url) rows.push([{ text: b.label || 'Abrir', url: b.url }]);
    }
    const keyboard = rows.length ? { reply_markup: { inline_keyboard: rows } } : {};

    // sequência de mensagens (compat: nó antigo com {text, media} vira lista de 1).
    const rawMsgs =
      Array.isArray(node.data?.messages) && node.data.messages.length
        ? node.data.messages
        : [{ text: node.data?.text, media: node.data?.media, delay_seconds: node.data?.delay_seconds }];
    const msgs = rawMsgs.filter((m: any) => (m?.text && String(m.text).trim()) || (m?.media && m.media.url));
    if (!msgs.length && rows.length) msgs.push({ text: '' }); // botões precisam de uma mensagem carregadora

    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      const isLast = i === msgs.length - 1;
      const caption = this.interpolate(m.text || '', info);
      const delaySec = Math.min(10, Math.max(0, Number(m.delay_seconds) || 0));
      if (delaySec) {
        await tg.sendChatAction(token, chatId, 'typing').catch(() => undefined);
        await this.sleep(delaySec * 1000);
      }
      await this.deliver(bot, token, chatId, tgUserId, caption, m.media, isLast ? keyboard : {});
    }

    if (Array.isArray(node.data?.apply_tags) && node.data.apply_tags.length) {
      await this.applyTags(bot, tgUserId, node.data.apply_tags);
    }
  }

  // Envio genérico (mídia/texto/botões) + log OUT. Reusado por fluxo e automações.
  async deliver(
    bot: Bot,
    token: string,
    chatId: number | string,
    tgUserId: number | string,
    caption: string,
    media: any,
    extra: Record<string, any>,
  ) {
    let r: any;
    if (media && media.url && media.type) {
      const action = media.type === 'voice' ? 'record_voice' : media.type === 'video' ? 'upload_video' : 'upload_photo';
      await tg.sendChatAction(token, chatId, action).catch(() => undefined);
      r = await tg.sendMediaUrl(token, chatId, media.type, media.url, caption || undefined, extra);
    } else {
      await tg.sendChatAction(token, chatId, 'typing').catch(() => undefined);
      r = await tg.sendMessage(token, chatId, caption || '…', extra);
    }
    if (r.ok) {
      const { mediaType, fileId, preview } = this.extractSent(media?.type, r.result, caption);
      await this.logOut(bot, chatId, tgUserId, caption || null, r.result?.message_id, mediaType, fileId, preview);
    }
    return r;
  }

  // Usado pelo runner de automações: envia uma mensagem composta (texto+mídia+botões URL).
  async sendComposed(bot: Bot, token: string, chatId: number | string, tgUserId: number | string, msg: any, info: Info) {
    const caption = this.interpolate(msg?.text || '', info);
    const rows: any[] = [];
    for (const b of msg?.buttons || []) {
      if (b.plan_id) rows.push([{ text: b.label || 'Comprar', callback_data: `pay:${b.plan_id}` }]);
      else if (b.url) rows.push([{ text: b.label || 'Abrir', url: b.url }]);
    }
    const extra = rows.length ? { reply_markup: { inline_keyboard: rows } } : {};
    return this.deliver(bot, token, chatId, tgUserId, caption, msg?.media, extra);
  }

  interpolatePublic(text: string, info: Info) {
    return this.interpolate(text, info);
  }

  // extrai media_type + file_id + prévia do resultado do envio
  private extractSent(type: string | undefined, result: any, caption: string) {
    if (!type) return { mediaType: null as string | null, fileId: null as string | null, preview: caption };
    let fileId: string | null = null;
    if (type === 'photo') fileId = Array.isArray(result?.photo) ? result.photo[result.photo.length - 1]?.file_id : null;
    else fileId = result?.[type]?.file_id || null;
    const labels: Record<string, string> = { photo: '📷 Foto', video: '🎬 Vídeo', voice: '🎤 Áudio', audio: '🎵 Áudio', document: '📎 Arquivo' };
    const preview = caption ? `${labels[type] || ''} ${caption}`.trim() : labels[type] || '💬 Mensagem';
    return { mediaType: type, fileId, preview };
  }

  // grava a mensagem OUT (aparece nas DMs) + atualiza prévia da conversa
  private async logOut(
    bot: Bot,
    chatId: number | string,
    tgUserId: number | string,
    text: string | null,
    msgId?: number,
    mediaType?: string | null,
    mediaFileId?: string | null,
    preview?: string,
  ) {
    const contact = await this.prisma.telegram_contacts.findFirst({
      where: { bot_id: bot.id, tg_user_id: BigInt(tgUserId) },
      select: { id: true },
    });
    if (!contact) return;
    await this.prisma.telegram_messages
      .create({
        data: {
          organization_id: bot.organization_id,
          bot_id: bot.id,
          chat_kind: 'CONTACT',
          contact_id: contact.id,
          tg_chat_id: BigInt(chatId),
          direction: 'OUT',
          tg_message_id: msgId ? BigInt(msgId) : null,
          text: text || null,
          media_type: mediaType || null,
          media_file_id: mediaFileId || null,
        },
      })
      .catch(() => undefined);
    await this.prisma.telegram_contacts
      .update({
        where: { id: contact.id },
        data: { last_message_text: String(preview || text || '').slice(0, 500), last_message_at: new Date(), last_message_dir: 'OUT' },
      })
      .catch(() => undefined);
  }

  private async resetEnrollment(bot: Bot, tgUserId: number) {
    const contact = await this.prisma.telegram_contacts.findFirst({
      where: { bot_id: bot.id, tg_user_id: BigInt(tgUserId) },
      select: { id: true },
    });
    const existing = await this.prisma.telegram_flow_enrollments.findFirst({
      where: { bot_id: bot.id, tg_user_id: BigInt(tgUserId) },
      select: { id: true },
    });
    const data: any = {
      current_node_id: null,
      status: 'ACTIVE',
      started_at: new Date(),
      last_interaction_at: new Date(),
      contact_id: contact?.id || null,
      context: {},
    };
    if (existing) {
      await this.prisma.telegram_flow_enrollments.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.telegram_flow_enrollments.create({
        data: { organization_id: bot.organization_id, bot_id: bot.id, tg_user_id: BigInt(tgUserId), ...data },
      });
    }
  }
}
