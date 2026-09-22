import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import * as tg from './telegram-api.util';

// Base pública da API (mesmo host do back). Usado pra montar a URL do webhook do Telegram.
const PUBLIC_API_BASE = (process.env.PUBLIC_API_URL || 'https://api.bluewebchat.online').replace(/\/+$/, '');

type BotRow = {
  id: string;
  organization_id: string;
  name: string;
  token: string;
  tg_bot_id: bigint | null;
  username: string | null;
  first_name: string | null;
  test_chat_id: bigint | null;
  status: 'ACTIVE' | 'BANNED' | 'ERROR';
  webhook_set: boolean;
  webhook_secret: string | null;
  last_error: string | null;
  last_checked_at: Date | null;
  flood_until: Date | null;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class TelegramBotsService {
  private readonly logger = new Logger(TelegramBotsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ------- helpers -------
  private webhookUrl(botId: string): string {
    return `${PUBLIC_API_BASE}/telegram/webhook/${botId}`;
  }

  // Mascara o token: mantém o id numérico antes do ':' + 4 últimos chars da parte secreta.
  private maskToken(token: string): string {
    const raw = String(token || '');
    const idx = raw.indexOf(':');
    if (idx <= 0) {
      return raw.length <= 6 ? '••••' : `${raw.slice(0, 3)}••••${raw.slice(-3)}`;
    }
    const id = raw.slice(0, idx);
    const secret = raw.slice(idx + 1);
    const tail = secret.length >= 4 ? secret.slice(-4) : secret;
    return `${id}:••••${tail}`;
  }

  private toResponse(b: BotRow, counts?: { groups: number; leads: number }) {
    return {
      id: b.id,
      name: b.name,
      token_masked: this.maskToken(b.token),
      tg_bot_id: b.tg_bot_id != null ? String(b.tg_bot_id) : null,
      username: b.username,
      first_name: b.first_name,
      status: b.status,
      webhook_set: b.webhook_set,
      last_error: b.last_error,
      last_checked_at: b.last_checked_at,
      // flood-wait do Telegram (429): pausa TEMPORÁRIA de envio; volta sozinho no horário abaixo.
      flood_until: b.flood_until ? b.flood_until.toISOString() : null,
      flooded: !!(b.flood_until && b.flood_until.getTime() > Date.now()),
      created_at: b.created_at,
      updated_at: b.updated_at,
      // true quando alguém já conversou com o bot em privado (dá pra mandar msg de teste).
      can_test: b.test_chat_id != null,
      groups_count: counts?.groups ?? 0,
      leads_count: counts?.leads ?? 0,
    };
  }

  private async countsFor(orgId: string, botId: string): Promise<{ groups: number; leads: number }> {
    const [groups, leads] = await Promise.all([
      this.prisma.telegram_groups.count({ where: { organization_id: orgId, bot_id: botId } }),
      this.prisma.telegram_contacts.count({ where: { organization_id: orgId, bot_id: botId } }),
    ]);
    return { groups, leads };
  }

  private genSecret(): string {
    return randomBytes(24).toString('hex'); // 48 chars
  }

  // Valida o token no Telegram; erro vira BadRequest com mensagem amigável.
  private async validateToken(token: string): Promise<tg.TgMe> {
    const me = await tg.getMe(token);
    if (!me.ok || !me.result) {
      if (me.network_error) {
        throw new BadRequestException(
          'Não foi possível validar o token com o Telegram agora. Tente novamente em instantes.',
        );
      }
      if (me.unauthorized) {
        throw new BadRequestException('Token inválido ou revogado. Confira o token no @BotFather.');
      }
      throw new BadRequestException(`Falha ao validar o token: ${me.description || 'erro desconhecido'}.`);
    }
    if (!me.result.is_bot) {
      throw new BadRequestException('Esse token não pertence a um bot.');
    }
    return me.result;
  }

  private async trySetWebhook(botId: string, token: string, secret: string): Promise<{ ok: boolean; error?: string }> {
    const r = await tg.setWebhook(token, this.webhookUrl(botId), secret);
    if (!r.ok) {
      this.logger.warn(`setWebhook falhou p/ bot ${botId}: ${r.description}`);
      return { ok: false, error: r.description };
    }
    return { ok: true };
  }

  // ------- CRUD -------
  async list(organizationId: string) {
    const rows = (await this.prisma.telegram_bots.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'asc' },
    })) as unknown as BotRow[];

    const botIds = rows.map((r) => r.id);
    const [g, c] = await Promise.all([
      this.prisma.telegram_groups.groupBy({
        by: ['bot_id'],
        where: { organization_id: organizationId, bot_id: { in: botIds } },
        _count: { _all: true },
      }),
      this.prisma.telegram_contacts.groupBy({
        by: ['bot_id'],
        where: { organization_id: organizationId, bot_id: { in: botIds } },
        _count: { _all: true },
      }),
    ]);
    const gMap = new Map(g.map((x: any) => [x.bot_id, x._count._all]));
    const cMap = new Map(c.map((x: any) => [x.bot_id, x._count._all]));

    return rows.map((r) => this.toResponse(r, { groups: gMap.get(r.id) || 0, leads: cMap.get(r.id) || 0 }));
  }

  async create(organizationId: string, name: string, token: string) {
    const cleanToken = String(token || '').trim();
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new BadRequestException('Informe um nome para o bot.');
    if (!cleanToken) throw new BadRequestException('Informe o token do bot.');

    const me = await this.validateToken(cleanToken);

    // Já existe esse bot (mesmo tg_bot_id) nesta organização?
    const dup = await this.prisma.telegram_bots.findFirst({
      where: { organization_id: organizationId, tg_bot_id: BigInt(me.id) },
      select: { id: true },
    });
    if (dup) {
      throw new BadRequestException(`O bot @${me.username || me.id} já está cadastrado nesta conta.`);
    }

    const secret = this.genSecret();
    const created = (await this.prisma.telegram_bots.create({
      data: {
        organization_id: organizationId,
        name: cleanName,
        token: cleanToken,
        tg_bot_id: BigInt(me.id),
        username: me.username || null,
        first_name: me.first_name || null,
        status: 'ACTIVE',
        webhook_set: false,
        webhook_secret: secret,
        last_error: null,
        last_checked_at: new Date(),
      },
    })) as unknown as BotRow;

    const wh = await this.trySetWebhook(created.id, cleanToken, secret);
    const row = (await this.prisma.telegram_bots.update({
      where: { id: created.id },
      data: { webhook_set: wh.ok, last_error: wh.ok ? null : wh.error || null },
    })) as unknown as BotRow;

    return this.toResponse(row, await this.countsFor(organizationId, row.id));
  }

  private async findOwned(organizationId: string, id: string): Promise<BotRow> {
    const bot = (await this.prisma.telegram_bots.findFirst({
      where: { id, organization_id: organizationId },
    })) as unknown as BotRow | null;
    if (!bot) throw new NotFoundException('Bot não encontrado.');
    return bot;
  }

  async update(organizationId: string, id: string, dto: { name?: string; token?: string }) {
    const bot = await this.findOwned(organizationId, id);
    const data: any = {};

    if (typeof dto.name === 'string' && dto.name.trim()) {
      data.name = dto.name.trim();
    }

    // Troca de token → revalida, atualiza info e re-seta o webhook.
    if (typeof dto.token === 'string' && dto.token.trim() && dto.token.trim() !== bot.token) {
      const newToken = dto.token.trim();
      const me = await this.validateToken(newToken);

      const dup = await this.prisma.telegram_bots.findFirst({
        where: {
          organization_id: organizationId,
          tg_bot_id: BigInt(me.id),
          NOT: { id: bot.id },
        },
        select: { id: true },
      });
      if (dup) throw new BadRequestException(`O bot @${me.username || me.id} já está cadastrado nesta conta.`);

      data.token = newToken;
      data.tg_bot_id = BigInt(me.id);
      data.username = me.username || null;
      data.first_name = me.first_name || null;
      data.status = 'ACTIVE';
      data.last_checked_at = new Date();

      const secret = bot.webhook_secret || this.genSecret();
      data.webhook_secret = secret;
      const wh = await this.trySetWebhook(bot.id, newToken, secret);
      data.webhook_set = wh.ok;
      data.last_error = wh.ok ? null : wh.error || null;
    }

    if (Object.keys(data).length === 0) return this.toResponse(bot, await this.countsFor(organizationId, bot.id));

    const row = (await this.prisma.telegram_bots.update({
      where: { id: bot.id },
      data,
    })) as unknown as BotRow;
    return this.toResponse(row, await this.countsFor(organizationId, row.id));
  }

  // Reconsulta o Telegram: atualiza nome/username/status e re-seta o webhook.
  async revalidate(organizationId: string, id: string) {
    const bot = await this.findOwned(organizationId, id);
    const me = await tg.getMe(bot.token);

    if (!me.ok || !me.result) {
      // Rede instável não marca como banido (evita falso positivo).
      if (me.network_error) {
        const row = (await this.prisma.telegram_bots.update({
          where: { id: bot.id },
          data: { last_error: me.description || 'Falha de rede.', last_checked_at: new Date() },
        })) as unknown as BotRow;
        return this.toResponse(row, await this.countsFor(organizationId, row.id));
      }
      // Token revogado/apagado = bot banido/removido no Telegram.
      const status = me.unauthorized ? 'BANNED' : 'ERROR';
      const row = (await this.prisma.telegram_bots.update({
        where: { id: bot.id },
        data: {
          status,
          webhook_set: false,
          last_error: me.description || 'Token inválido.',
          last_checked_at: new Date(),
        },
      })) as unknown as BotRow;
      return this.toResponse(row, await this.countsFor(organizationId, row.id));
    }

    const secret = bot.webhook_secret || this.genSecret();
    const wh = await this.trySetWebhook(bot.id, bot.token, secret);
    const row = (await this.prisma.telegram_bots.update({
      where: { id: bot.id },
      data: {
        username: me.result.username || null,
        first_name: me.result.first_name || null,
        status: 'ACTIVE',
        webhook_secret: secret,
        webhook_set: wh.ok,
        last_error: wh.ok ? null : wh.error || null,
        last_checked_at: new Date(),
      },
    })) as unknown as BotRow;
    return this.toResponse(row, await this.countsFor(organizationId, row.id));
  }

  async remove(organizationId: string, id: string) {
    const bot = await this.findOwned(organizationId, id);
    // Best-effort: remove o webhook no Telegram antes de apagar.
    await tg.deleteWebhook(bot.token).catch(() => undefined);
    // Cascade das entidades filhas (grupos/links/broadcasts) pluga aqui quando existirem.
    await this.prisma.telegram_bots.delete({ where: { id: bot.id } });
    return { ok: true, id: bot.id };
  }

  // Envia uma mensagem de teste pro chat privado que já conversou com o bot (tipicamente o dono).
  async sendTest(organizationId: string, id: string) {
    const bot = await this.findOwned(organizationId, id);
    if (bot.status === 'BANNED') {
      throw new BadRequestException('Bot indisponível (banido). Revalide ou troque o token antes de testar.');
    }
    if (bot.test_chat_id == null) {
      throw new BadRequestException(
        `Para testar, abra o seu bot no Telegram${bot.username ? ` (@${bot.username})` : ''} e envie /start. Depois clique novamente em "Enviar teste".`,
      );
    }

    const text =
      `✅ Mensagem de teste do Pub Mail\n\n` +
      `Bot: ${bot.name}${bot.username ? ` (@${bot.username})` : ''}\n` +
      `Se você recebeu isto, o bot está funcionando e pronto para enviar mensagens.`;

    const r = await tg.sendMessage(bot.token, String(bot.test_chat_id), text);
    if (!r.ok) {
      // 403 = usuário bloqueou/parou o bot → limpa o chat p/ forçar novo /start.
      if (r.error_code === 403) {
        await this.prisma.telegram_bots
          .update({ where: { id: bot.id }, data: { test_chat_id: null } })
          .catch(() => undefined);
        throw new BadRequestException(
          'Não consegui enviar (o bot foi parado/bloqueado nesse chat). Envie /start pro seu bot de novo e tente.',
        );
      }
      if (r.unauthorized) {
        throw new BadRequestException('Token inválido/revogado. Revalide o bot.');
      }
      throw new BadRequestException(`Falha ao enviar a mensagem de teste: ${r.description || 'erro desconhecido'}.`);
    }
    return { ok: true };
  }

  // Foto de perfil do próprio bot (proxy binário — token no server).
  async getBotPhoto(orgId: string, id: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const bot = await this.prisma.telegram_bots.findFirst({
      where: { id, organization_id: orgId },
      select: { token: true, tg_bot_id: true },
    });
    if (!bot || bot.tg_bot_id == null) return null;

    let fileId: string | null = null;
    const photos = await tg.getUserProfilePhotos(bot.token, String(bot.tg_bot_id));
    const arr = photos.ok ? photos.result?.photos : null;
    if (arr?.length && arr[0]?.length) {
      const sizes = arr[0];
      fileId = (sizes[1] || sizes[0]).file_id;
    }
    if (!fileId) {
      const chat = await tg.getChat(bot.token, String(bot.tg_bot_id));
      const p = chat.ok ? chat.result?.photo : null;
      fileId = p?.small_file_id || p?.big_file_id || null;
    }
    if (!fileId) return null;
    const file = await tg.getFile(bot.token, fileId);
    if (!file.ok || !file.result?.file_path) return null;
    return tg.downloadFile(bot.token, file.result.file_path);
  }

  // Lê o perfil do bot no Telegram (nome/descrição/sobre/comandos + privacidade/grupos via getMe).
  async getProfile(orgId: string, id: string) {
    const bot = await this.findOwned(orgId, id);
    const [nameR, descR, shortR, cmdsR, meR] = await Promise.all([
      tg.getMyName(bot.token),
      tg.getMyDescription(bot.token),
      tg.getMyShortDescription(bot.token),
      tg.getMyCommands(bot.token),
      tg.getMe(bot.token),
    ]);
    return {
      name: nameR.ok ? nameR.result?.name || '' : bot.first_name || '',
      description: descR.ok ? descR.result?.description || '' : '',
      short_description: shortR.ok ? shortR.result?.short_description || '' : '',
      commands: cmdsR.ok && Array.isArray(cmdsR.result) ? cmdsR.result : [],
      username: meR.ok ? meR.result?.username || bot.username : bot.username,
      can_join_groups: meR.ok ? !!meR.result?.can_join_groups : null,
      can_read_all_group_messages: meR.ok ? !!meR.result?.can_read_all_group_messages : null,
    };
  }

  // Atualiza o perfil do bot via Bot API (nome/descrição/sobre/comandos).
  async updateProfile(
    orgId: string,
    id: string,
    dto: { name?: string; description?: string; short_description?: string; commands?: any[] },
  ) {
    const bot = await this.findOwned(orgId, id);
    const errors: string[] = [];

    if (dto.name !== undefined) {
      const name = String(dto.name).slice(0, 64);
      const r = await tg.setMyName(bot.token, name);
      if (!r.ok) errors.push(`nome (${r.description})`);
      else {
        await this.prisma.telegram_bots
          .update({ where: { id: bot.id }, data: { first_name: name || null } })
          .catch(() => undefined);
      }
    }
    if (dto.description !== undefined) {
      const r = await tg.setMyDescription(bot.token, String(dto.description).slice(0, 512));
      if (!r.ok) errors.push(`descrição (${r.description})`);
    }
    if (dto.short_description !== undefined) {
      const r = await tg.setMyShortDescription(bot.token, String(dto.short_description).slice(0, 120));
      if (!r.ok) errors.push(`sobre (${r.description})`);
    }
    if (dto.commands !== undefined) {
      const cmds = (Array.isArray(dto.commands) ? dto.commands : [])
        .map((c: any) => ({
          command: String(c?.command || '')
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '')
            .slice(0, 32),
          description: String(c?.description || '').slice(0, 256),
        }))
        .filter((c) => c.command && c.description);
      const r = await tg.setMyCommands(bot.token, cmds);
      if (!r.ok) errors.push(`comandos (${r.description})`);
    }

    if (errors.length) throw new BadRequestException(`Falha ao salvar: ${errors.join('; ')}.`);
    return this.getProfile(orgId, id);
  }

  // Usado pelo webhook público p/ conferir o secret sem expor o token.
  async findByIdForWebhook(
    id: string,
  ): Promise<{ id: string; organization_id: string; webhook_secret: string | null } | null> {
    return this.prisma.telegram_bots.findUnique({
      where: { id },
      select: { id: true, organization_id: true, webhook_secret: true },
    });
  }

  // Captura o chat_id privado de quem conversou com o bot (base p/ msg de teste).
  // Best-effort: nunca lança (o webhook precisa ACKar 200 sempre).
  async captureFromUpdate(botId: string, update: any): Promise<void> {
    try {
      const msg = update?.message || update?.edited_message;
      const chat = msg?.chat;
      if (chat && chat.type === 'private' && chat.id != null) {
        await this.prisma.telegram_bots.update({
          where: { id: botId },
          data: { test_chat_id: BigInt(chat.id) },
        });
      }
    } catch {
      /* ignore */
    }
  }
}
