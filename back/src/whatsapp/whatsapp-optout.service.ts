import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppHooks, InboundEvent } from './whatsapp-hooks.service';
import { ChatKey, WhatsAppAttendanceService } from './whatsapp-attendance.service';
import { WhatsAppSystemSender } from './whatsapp-system-send.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import { isGroupJid, phoneFromJid } from './wa-jid.util';

// ============================================================================
// LGPD / descadastro (fase 4 do CRM): o contato manda a palavra de saída
// ("PARE", "SAIR"… configurável) → `whatsapp_contacts.opted_out_at`, confirmação
// automática, sai dos broadcasts. A mensagem é consumida (o bot não responde).
// Reverter: PATCH /whatsapp/contacts/:id { opted_out: false } (tela Contatos).
//
// Multi-número: o contato é DA ORG (descadastrou = fora dos envios de todos os números);
// a confirmação sai pelo número em que a pessoa escreveu.
// ============================================================================

const norm = (s: string) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();

@Injectable()
export class WhatsAppOptoutService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppOptoutService.name);
  private readonly cache = new Map<string, { at: number; enabled: boolean; words: Set<string>; reply: string }>();
  constructor(private readonly prisma: PrismaService, private readonly hooks: WhatsAppHooks, private readonly attendance: WhatsAppAttendanceService, private readonly sender: WhatsAppSystemSender, private readonly presenter: WhatsAppPresenter) {}

  onModuleInit() {
    this.hooks.onInboundFilter((e) => this.filter(e));
  }

  /** Configuração em cache (60 s) para o filtro síncrono; o 1º uso de cada org aquece em background. */
  private cfg(orgId: string) {
    const c = this.cache.get(orgId);
    if (!c || Date.now() - c.at > 60_000) {
      void this.attendance
        .settings(orgId)
        .then((s) => this.cache.set(orgId, { at: Date.now(), enabled: Boolean(s.optout?.enabled), words: new Set((s.optout?.keywords || []).map(norm).filter(Boolean)), reply: s.optout?.reply || '' }))
        .catch(() => undefined);
    }
    return c || null;
  }

  /** Aquece o cache (chamado pelo pipeline de sessão/boot e ao salvar as configurações). */
  invalidate(orgId: string) { this.cache.delete(orgId); this.cfg(orgId); }

  private filter(e: InboundEvent): boolean {
    if (isGroupJid(e.chatId) || !e.sessionId) return false;
    const c = this.cfg(e.orgId);
    if (!c?.enabled || !c.words.size) return false;
    if (e.message?.type && e.message.type !== 'text') return false;
    const body = norm(e.message?.body || '');
    if (!body || body.length > 40 || !c.words.has(body)) return false;
    void this.optOut(e.orgId, { session_id: e.sessionId, chat_id: e.chatId }, body, c.reply);
    return true;
  }

  private async optOut(orgId: string, k: ChatKey, word: string, reply: string) {
    const jid = k.chat_id;
    try {
      const phone = phoneFromJid(jid);
      let contact = await this.prisma.whatsapp_contacts.findFirst({ where: { organization_id: orgId, OR: [{ wa_id: jid }, { lid: jid }, ...(phone ? [{ phone }] : [])] } });
      if (!contact) contact = await this.prisma.whatsapp_contacts.create({ data: { organization_id: orgId, wa_id: jid, phone: phone || null, source: 'session' } });
      if (!contact.opted_out_at) await this.prisma.whatsapp_contacts.update({ where: { id: contact.id }, data: { opted_out_at: new Date() } });
      await this.attendance.event(orgId, k, 'opted_out', null, { word });
      if (reply) await this.sender.text(orgId, k.session_id, jid, reply, { optout: true });
      this.presenter.chat(orgId, k.session_id, jid);
      const chatUuid = await this.presenter.chatUuid(orgId, k.session_id, jid);
      this.presenter.emit(orgId, 'wa:contact', { action: 'opted_out', contact_id: contact.id, chat_id: chatUuid, session_id: k.session_id, jid });
    } catch (err: any) {
      this.logger.warn(`descadastro ${jid}: ${err?.message || err}`);
    }
  }
}
