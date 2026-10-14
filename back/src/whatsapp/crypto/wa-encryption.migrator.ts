import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { promises as fsp } from 'node:fs';
import { docHash } from '../wa-doc.util';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppMediaService } from '../whatsapp-media.service';
import { FILE_MAGIC, TEXT_PREFIX, waKeyring } from './wa-keyring';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// =============================================================================
// Cifra o que foi gravado ANTES da criptografia (ou enquanto a chave estava desligada):
// mensagens, prévias das conversas, legendas de status e os arquivos de mídia.
// Lotes pequenos com pausa (não pesa no servidor), cursor por id (uma passada por vez),
// e sem mexer em `updated_at` — senão as conversas abertas receberiam tudo como "novo".
// Roda 90 s depois do boot e a cada 30 min (encontra o que sobrar). Idempotente.
// =============================================================================
@Injectable()
export class WaEncryptionMigrator implements OnModuleInit {
  private readonly logger = new Logger(WaEncryptionMigrator.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: WhatsAppMediaService,
  ) {}

  onModuleInit() {
    const kr = waKeyring();
    this.logger.log(kr.enabled ? 'Criptografia das mensagens do WhatsApp: LIGADA' : 'Criptografia das mensagens do WhatsApp: desligada (sem WHATSAPP_DATA_KEYS)');
    setTimeout(() => void this.run(), 90_000);
  }

  @Cron('0 */30 * * * *')
  tick() {
    void this.run();
  }

  async run() {
    if (!waKeyring().enabled || this.running) return;
    this.running = true;
    const t0 = Date.now();
    try {
      const msgs = await this.messages();
      const chats = await this.chats();
      const statuses = await this.statuses();
      const customers = await this.customers();
      const files = await this.files();
      if (msgs || chats || statuses || customers || files) {
        this.logger.log(`Cifrados: ${msgs} mensagens, ${chats} prévias de conversa, ${statuses} legendas de status, ${customers} documentos de cliente, ${files} arquivos (${Math.round((Date.now() - t0) / 1000)} s)`);
      }
    } catch (e: any) {
      this.logger.error(`migração da criptografia parou: ${e?.message || e}`);
    } finally {
      this.running = false;
    }
  }

  private async messages() {
    let cursor = '';
    let n = 0;
    const like = `${TEXT_PREFIX}%`;
    for (;;) {
      const ids: { id: string }[] = await this.prisma.$queryRaw`
        SELECT id FROM whatsapp_messages
        WHERE id > ${cursor} AND (
          (body IS NOT NULL AND body <> '' AND body NOT LIKE ${like})
          OR (quoted_preview IS NOT NULL AND quoted_preview <> '' AND quoted_preview NOT LIKE ${like})
          OR (extra IS NOT NULL AND JSON_CONTAINS_PATH(extra, 'one', '$.contact', '$.location', '$.poll', '$.mention_names', '$.button', '$.buttons'))
        )
        ORDER BY id LIMIT 200`;
      if (!ids.length) break;
      const rows = await this.prisma.whatsapp_messages.findMany({
        where: { id: { in: ids.map((r) => r.id) } },
        select: { id: true, organization_id: true, body: true, quoted_preview: true, extra: true, updated_at: true },
      });
      for (const r of rows) {
        await this.prisma.whatsapp_messages.update({
          where: { id: r.id, organization_id: r.organization_id },
          data: { body: r.body, quoted_preview: r.quoted_preview, ...(r.extra != null ? { extra: r.extra as any } : {}), updated_at: r.updated_at },
        });
        n++;
      }
      cursor = ids[ids.length - 1].id;
      await sleep(150);
    }
    return n;
  }

  private async chats() {
    let cursor = '';
    let n = 0;
    const like = `${TEXT_PREFIX}%`;
    for (;;) {
      const ids: { id: string }[] = await this.prisma.$queryRaw`
        SELECT id FROM whatsapp_chats
        WHERE id > ${cursor} AND last_message_preview IS NOT NULL AND last_message_preview <> '' AND last_message_preview NOT LIKE ${like}
        ORDER BY id LIMIT 200`;
      if (!ids.length) break;
      const rows = await this.prisma.whatsapp_chats.findMany({ where: { id: { in: ids.map((r) => r.id) } }, select: { id: true, organization_id: true, last_message_preview: true, updated_at: true } });
      for (const r of rows) {
        await this.prisma.whatsapp_chats.update({ where: { id: r.id, organization_id: r.organization_id }, data: { last_message_preview: r.last_message_preview, updated_at: r.updated_at } });
        n++;
      }
      cursor = ids[ids.length - 1].id;
      await sleep(150);
    }
    return n;
  }

  private async statuses() {
    let cursor = '';
    let n = 0;
    const like = `${TEXT_PREFIX}%`;
    for (;;) {
      const ids: { id: string }[] = await this.prisma.$queryRaw`
        SELECT id FROM whatsapp_contact_statuses
        WHERE id > ${cursor} AND caption IS NOT NULL AND caption <> '' AND caption NOT LIKE ${like}
        ORDER BY id LIMIT 200`;
      if (!ids.length) break;
      const rows = await this.prisma.whatsapp_contact_statuses.findMany({ where: { id: { in: ids.map((r) => r.id) } }, select: { id: true, organization_id: true, caption: true } });
      for (const r of rows) {
        await this.prisma.whatsapp_contact_statuses.update({ where: { id: r.id, organization_id: r.organization_id }, data: { caption: r.caption } });
        n++;
      }
      cursor = ids[ids.length - 1].id;
      await sleep(150);
    }
    return n;
  }

  /** CPF/CNPJ de clientes gravados em claro (antes da Fase 1 das assinaturas): cifra e garante o doc_hash. */
  private async customers() {
    let cursor = '';
    let n = 0;
    const like = `${TEXT_PREFIX}%`;
    for (;;) {
      const ids: { id: string }[] = await this.prisma.$queryRaw`
        SELECT id FROM whatsapp_customers
        WHERE id > ${cursor} AND doc IS NOT NULL AND doc <> '' AND doc NOT LIKE ${like}
        ORDER BY id LIMIT 200`;
      if (!ids.length) break;
      const rows = await this.prisma.whatsapp_customers.findMany({ where: { id: { in: ids.map((r) => r.id) } }, select: { id: true, organization_id: true, doc: true, doc_hash: true, updated_at: true } });
      for (const r of rows) {
        await this.prisma.whatsapp_customers.update({ where: { id: r.id, organization_id: r.organization_id }, data: { doc: r.doc, doc_hash: r.doc_hash || docHash(r.organization_id, r.doc), updated_at: r.updated_at } });
        n++;
      }
      cursor = ids[ids.length - 1].id;
      await sleep(150);
    }
    return n;
  }

  private async files() {
    let cursor = '';
    let n = 0;
    for (;;) {
      const rows = await this.prisma.whatsapp_media.findMany({ where: { id: { gt: cursor } }, orderBy: { id: 'asc' }, take: 100, select: { id: true, organization_id: true, storage_path: true } });
      if (!rows.length) break;
      for (const m of rows) {
        let abs: string;
        try {
          abs = this.media.absPath(m);
          const fh = await fsp.open(abs, 'r');
          const head = Buffer.alloc(FILE_MAGIC.length);
          const { bytesRead } = await fh.read(head, 0, head.length, 0);
          await fh.close();
          if (bytesRead === FILE_MAGIC.length && head.equals(FILE_MAGIC)) continue; // já cifrado
          const plain = await fsp.readFile(abs);
          await this.media.writeStored(m.organization_id, m.storage_path, plain); // confere antes de trocar
          n++;
          await sleep(25);
        } catch (e: any) {
          if (e?.code !== 'ENOENT') this.logger.warn(`arquivo ${m.id} não cifrado: ${e?.message || e}`);
        }
      }
      cursor = rows[rows.length - 1].id;
    }
    return n;
  }
}
