import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as tg from './telegram-api.util';
import { noteFlood, clearFlood } from './telegram-flood.util';

// Roda um loop contínuo: para cada rotativa ativa que está "vencida" (last_rotated_at +
// interval <= agora), edita a mensagem no grupo/canal para o próximo texto (ou envia a 1ª).
//
// SEGURANÇA ANTI-FLOOD (o Telegram bane o bot com 429 retry_after de HORAS se editar/enviar
// demais): (1) cadência mínima — DM 30s, grupo/canal 10s; (2) ao tomar 429, respeita o
// retry_after REAL e coloca o bot em cooldown (NÃO fica reenviando, que era o que amplificava).
const DM_MIN_INTERVAL = 30; // s — editar DM de cada lead no máx a cada 30s
const GROUP_MIN_INTERVAL = 10; // s
const MAX_COOLDOWN = 6 * 3600; // teto do flood-wait honrado
const EDITS_PER_HOUR = 10; // teto de edições da rotativa por lead numa janela de 1h
const HOUR_MS = 3600 * 1000;
const MIN_EDIT_GAP = Math.floor(HOUR_MS / EDITS_PER_HOUR); // ~6 min entre edições do mesmo lead

@Injectable()
export class TelegramRotatorsRunner implements OnModuleInit {
  private readonly logger = new Logger(TelegramRotatorsRunner.name);
  private ticking = false;
  // trava por contato (bot:tgUserId) p/ o sweep de fundo e o bump do fluxo não colidirem (duplicar)
  private busy = new Set<string>();
  // cooldown por bot (flood-wait). Enquanto vigente, NENHUMA chamada é feita p/ aquele bot.
  private botCooldown = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  private lock(key: string): boolean {
    if (this.busy.has(key)) return false;
    this.busy.add(key);
    return true;
  }
  private unlock(key: string) {
    this.busy.delete(key);
  }

  // true = bot está em flood-wait; não deve receber nenhuma chamada agora.
  private cooling(botId: string): boolean {
    const until = this.botCooldown.get(botId) || 0;
    return Date.now() < until;
  }
  // registra 429: coloca o bot em cooldown pelo retry_after REAL do Telegram.
  private note429(botId: string, res: any): boolean {
    if (res && res.error_code === 429) {
      const retry = Math.min(Number(res?.parameters?.retry_after) || 30, MAX_COOLDOWN);
      this.botCooldown.set(botId, Date.now() + retry * 1000);
      void noteFlood(this.prisma, botId, res); // marca no card do bot (aviso no front)
      this.logger.warn(`rotativa: bot ${botId} em flood-wait ${retry}s (429) — pausando.`);
      return true;
    }
    return false;
  }

  // erro que indica que NÃO adianta mais mandar pra esse lead (ele saiu do Telegram / bloqueou
  // o bot / apagou a conta). Marca o lead como "morto" → a rotativa para de editar nele.
  private isDeadError(res: any): boolean {
    if (!res) return false;
    if (res.error_code === 403) return true; // bot bloqueado pelo lead
    const d = String(res.description || '').toLowerCase();
    return (
      d.includes('chat not found') ||
      d.includes('bot was blocked') ||
      d.includes('user is deactivated') ||
      d.includes('user is deleted') ||
      d.includes('peer_id_invalid') ||
      d.includes('bot was kicked')
    );
  }

  // envio/edição funcionou → limpa o flood-wait do card se o bot estava marcado.
  private onOk(botId: string) {
    if (this.botCooldown.has(botId)) {
      this.botCooldown.delete(botId);
      void clearFlood(this.prisma, botId);
    }
  }

  onModuleInit() {
    this.loop().catch((e) => this.logger.error(`rotator loop morreu: ${e?.message || e}`));
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async loop() {
    await this.sleep(6000);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await this.tick();
      } catch (e: any) {
        this.logger.warn(`rotator tick falhou: ${e?.message || e}`);
      }
      await this.sleep(3000);
    }
  }

  private async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const now = Date.now();
      const rotators = await this.prisma.telegram_rotators.findMany({ where: { active: true } });
      for (const r of rotators) {
        if (this.cooling(r.bot_id)) continue; // bot em flood-wait → não toca
        const last = r.last_rotated_at ? new Date(r.last_rotated_at).getTime() : 0;
        if (r.target_kind === 'dm') {
          // DM: varre os contatos em lotes (rate-limited), no MÁXIMO a cada DM_MIN_INTERVAL.
          const eff = Math.max(DM_MIN_INTERVAL, r.interval_seconds || 15);
          if (now - last < eff * 1000) continue;
          await this.dmSweep(r, eff).catch((e) => this.logger.warn(`dmSweep ${r.id} falhou: ${e?.message || e}`));
          continue;
        }
        const eff = Math.max(GROUP_MIN_INTERVAL, r.interval_seconds || 15);
        if (now - last < eff * 1000) continue;
        await this.rotate(r).catch((e) => this.logger.warn(`rotate ${r.id} falhou: ${e?.message || e}`));
      }
    } finally {
      this.ticking = false;
    }
  }

  // {{nome}}: sorteia SEMPRE da lista de nomes cadastrada (prova social = outros nomes,
  // não o do próprio lead). Sem lista → vira vazio.
  private fill(text: string, pool: any): string {
    const names = Array.isArray(pool) ? pool.filter(Boolean) : [];
    const pick = () => (names.length ? names[Math.floor(Math.random() * names.length)] : '') || '';
    return String(text || '').replace(/\{\{\s*(nome|name|first_name)\s*\}\}/gi, pick);
  }

  private textsOf(r: any): string[] {
    return (Array.isArray(r.messages) ? r.messages : [])
      .map((m: any) => (typeof m === 'string' ? m : String(m?.text || '')))
      .filter((s: string) => s && s.trim());
  }

  private async rotate(r: any) {
    const texts = this.textsOf(r);
    if (!texts.length) return;

    const bot = await this.prisma.telegram_bots.findUnique({ where: { id: r.bot_id }, select: { token: true, status: true } });
    if (!bot || bot.status === 'BANNED' || !bot.token) return;
    if (!r.group_id) return;
    const grp = await this.prisma.telegram_groups.findUnique({ where: { id: r.group_id }, select: { tg_chat_id: true } });
    if (!grp) return;
    const chatId = String(grp.tg_chat_id);

    const idx = r.mode === 'random' ? Math.floor(Math.random() * texts.length) : (r.current_index || 0) % texts.length;
    const text = this.fill(texts[idx], r.name_pool);
    let messageId: number | null = r.current_message_id ? Number(r.current_message_id) : null;

    if (messageId) {
      const res = await tg.editMessageText(bot.token, chatId, messageId, text, {});
      if (!res.ok) {
        if (this.note429(r.bot_id, res)) return; // flood → recua, NÃO reenvia
        if (this.isDeadError(res)) return; // bot expulso do grupo/canal → não fica reenviando
        const d = String(res.description || '').toLowerCase();
        if (d.includes('not modified')) {
          // texto igual ao atual (modo aleatório caiu no mesmo) — só avança o índice
        } else {
          // mensagem apagada / inválida — reenvia uma nova e passa a editar essa
          const sent = await tg.sendMessage(bot.token, chatId, text, {});
          if (this.note429(r.bot_id, sent)) return;
          messageId = sent.ok ? sent.result?.message_id || null : null;
        }
      }
    } else {
      const sent = await tg.sendMessage(bot.token, chatId, text, {});
      if (this.note429(r.bot_id, sent)) return;
      messageId = sent.ok ? sent.result?.message_id || null : null;
    }

    this.onOk(r.bot_id); // chegou aqui sem 429 → bot funcional, limpa flood do card
    const nextIdx = (idx + 1) % texts.length;
    await this.prisma.telegram_rotators
      .update({
        where: { id: r.id },
        data: {
          current_index: nextIdx,
          current_message_id: messageId ? BigInt(messageId) : r.current_message_id,
          last_rotated_at: new Date(),
        },
      })
      .catch(() => undefined);
  }

  // DM: mantém UMA mensagem rotativa por contato do bot, editada em loop.
  // Varre os contatos em lotes (rate-limited), avançando o cursor a cada sweep.
  private readonly DM_BATCH = 20;

  private async dmSweep(r: any, eff: number) {
    const texts = this.textsOf(r);
    if (!texts.length) return;

    const bot = await this.prisma.telegram_bots.findUnique({ where: { id: r.bot_id }, select: { token: true, status: true } });
    if (!bot || bot.status === 'BANNED' || !bot.token) return;

    const idx = Math.floor(Date.now() / (eff * 1000)) % texts.length; // texto atual (por tempo)

    const cursor = r.dm_cursor || 0;
    const contacts = await this.prisma.telegram_contacts.findMany({
      where: { bot_id: r.bot_id },
      orderBy: { id: 'asc' },
      skip: cursor,
      take: this.DM_BATCH,
      select: { id: true, tg_user_id: true, first_name: true, attributes: true },
    });
    if (!contacts.length) {
      if (cursor > 0) await this.prisma.telegram_rotators.update({ where: { id: r.id }, data: { dm_cursor: 0 } }).catch(() => undefined);
      return;
    }

    // maior id de mensagem registrada por contato → saber se a rotativa "afundou" (não é mais a última)
    const maxes = await this.prisma.telegram_messages.groupBy({
      by: ['contact_id'],
      where: { contact_id: { in: contacts.map((c) => c.id) } },
      _max: { tg_message_id: true },
    });
    const maxMap = new Map(maxes.map((m: any) => [m.contact_id, m._max.tg_message_id ? Number(m._max.tg_message_id) : 0]));

    for (const c of contacts) {
      if (this.cooling(r.bot_id)) break; // flood no meio do lote → para o bot por agora
      const key = `${r.bot_id}:${c.tg_user_id}`;
      if (!this.lock(key)) continue; // um bump está processando este contato agora
      try {
        // relê o estado atual (um bump pode ter mudado o rotator_msg_id entre o fetch e aqui)
        const fresh = await this.prisma.telegram_contacts.findUnique({ where: { id: c.id }, select: { attributes: true } });
        const attrs: any = fresh?.attributes && typeof fresh.attributes === 'object' ? { ...(fresh.attributes as any) } : {};

        // lead saiu do Telegram / bloqueou o bot → não fica editando pra sempre (só volta via bump)
        if (attrs.rotator_dead) continue;

        const now = Date.now();
        // espaçamento mínimo entre edições do MESMO lead (~6 min) → distribui as ≤10/h na hora
        // toda em vez de 10 seguidas. (Leitura pura; sem persistir nada ao pular.)
        if (attrs.rotator_last_edit && now - Number(attrs.rotator_last_edit) < MIN_EDIT_GAP) continue;

        // teto RÍGIDO de EDITS_PER_HOUR edições por lead numa janela deslizante de 1h (backstop)
        if (!attrs.rotator_window || now - Number(attrs.rotator_window) >= HOUR_MS) {
          attrs.rotator_window = now;
          attrs.rotator_edits = 0;
        }
        if (Number(attrs.rotator_edits || 0) >= EDITS_PER_HOUR) {
          // já editou 10x nesta hora → espera a janela virar (persiste o reset de janela se houve)
          await this.prisma.telegram_contacts.update({ where: { id: c.id }, data: { attributes: attrs } }).catch(() => undefined);
          continue;
        }

        const prevId = attrs.rotator_msg_id ? Number(attrs.rotator_msg_id) : null;
        const lastLogged = maxMap.get(c.id) || 0;
        const text = this.fill(texts[idx], r.name_pool);
        const buried = !prevId || lastLogged > prevId; // chegou msg nova depois → não é mais a última
        let newId: number | null = prevId;
        let counted = false; // fez uma edição/envio que conta pro teto?

        if (buried) {
          if (prevId) await tg.deleteMessage(bot.token, String(c.tg_user_id), prevId).catch(() => undefined);
          const sent = await tg.sendMessage(bot.token, String(c.tg_user_id), text, { disable_notification: true });
          if (this.note429(r.bot_id, sent)) break;
          if (this.isDeadError(sent)) attrs.rotator_dead = true;
          else if (sent.ok) {
            newId = sent.result?.message_id || null;
            counted = true;
          }
        } else {
          const res = await tg.editMessageText(bot.token, String(c.tg_user_id), prevId as number, text, {});
          if (res.ok) {
            counted = true;
          } else if (this.note429(r.bot_id, res)) {
            break; // flood → para, NÃO reenvia
          } else if (this.isDeadError(res)) {
            attrs.rotator_dead = true; // lead sumiu → para de editar nele
          } else {
            const d = String(res.description || '').toLowerCase();
            if (d.includes('not modified')) {
              counted = true; // texto igual — conta como tentativa da janela
            } else {
              // mensagem sumiu mas o chat existe → reenvia embaixo
              const sent = await tg.sendMessage(bot.token, String(c.tg_user_id), text, { disable_notification: true });
              if (this.note429(r.bot_id, sent)) break;
              if (this.isDeadError(sent)) attrs.rotator_dead = true;
              else if (sent.ok) {
                newId = sent.result?.message_id || null;
                counted = true;
              }
            }
          }
        }

        if (counted && !attrs.rotator_dead) {
          this.onOk(r.bot_id); // bot funcional → limpa flood do card
          attrs.rotator_edits = Number(attrs.rotator_edits || 0) + 1;
          attrs.rotator_last_edit = now;
        }
        if (newId && newId !== prevId) attrs.rotator_msg_id = newId;
        await this.prisma.telegram_contacts.update({ where: { id: c.id }, data: { attributes: attrs } }).catch(() => undefined);
      } finally {
        this.unlock(key);
      }
      await this.sleep(150); // ~6-7 msgs/s por bot
    }

    const next = contacts.length < this.DM_BATCH ? 0 : cursor + contacts.length;
    await this.prisma.telegram_rotators.update({ where: { id: r.id }, data: { dm_cursor: next, last_rotated_at: new Date() } }).catch(() => undefined);
  }

  // Empurra a rotativa de DM pra baixo do último envio (chamado pelo fluxo após enviar um nó).
  // Apaga a anterior e reenvia embaixo, silencioso → vira a última mensagem na hora.
  async bumpForContact(botId: string, tgUserId: number | string) {
    if (this.cooling(botId)) return; // bot em flood-wait → não toca
    const key = `${botId}:${tgUserId}`;
    if (!this.lock(key)) return; // já tem um sweep/bump processando este contato
    try {
      const r = await this.prisma.telegram_rotators.findFirst({ where: { bot_id: botId, target_kind: 'dm', active: true } });
      if (!r) return;
      const texts = this.textsOf(r);
      if (!texts.length) return;
      const bot = await this.prisma.telegram_bots.findUnique({ where: { id: botId }, select: { token: true, status: true } });
      if (!bot || bot.status === 'BANNED' || !bot.token) return;
      const contact = await this.prisma.telegram_contacts.findFirst({ where: { bot_id: botId, tg_user_id: BigInt(tgUserId) }, select: { id: true, attributes: true } });
      if (!contact) return;

      const eff = Math.max(DM_MIN_INTERVAL, r.interval_seconds || 15);
      const idx = Math.floor(Date.now() / (eff * 1000)) % texts.length;
      const text = this.fill(texts[idx], r.name_pool);
      const attrs: any = contact.attributes && typeof contact.attributes === 'object' ? { ...(contact.attributes as any) } : {};
      const prevId = attrs.rotator_msg_id ? Number(attrs.rotator_msg_id) : null;
      if (prevId) await tg.deleteMessage(bot.token, String(tgUserId), prevId).catch(() => undefined);
      const sent = await tg.sendMessage(bot.token, String(tgUserId), text, { disable_notification: true });
      if (this.note429(botId, sent)) return;
      // bump é disparado por interação do lead → ele está VIVO. Se enviou, ressuscita (limpa 'dead');
      // se ainda assim deu erro de lead sumido, marca morto. (Bump não conta no teto de 10/h — é evento.)
      if (this.isDeadError(sent)) {
        attrs.rotator_dead = true;
        await this.prisma.telegram_contacts.update({ where: { id: contact.id }, data: { attributes: attrs } }).catch(() => undefined);
      } else if (sent.ok && sent.result?.message_id) {
        this.onOk(botId);
        attrs.rotator_dead = false;
        attrs.rotator_msg_id = sent.result.message_id;
        attrs.rotator_last_edit = Date.now(); // conta pro espaçamento (evita edição logo após o bump)
        await this.prisma.telegram_contacts.update({ where: { id: contact.id }, data: { attributes: attrs } }).catch(() => undefined);
      }
    } finally {
      this.unlock(key);
    }
  }
}
