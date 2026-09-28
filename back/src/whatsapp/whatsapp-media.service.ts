import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { existsSync, mkdirSync, promises as fsp } from 'fs';
import { extname, join, resolve } from 'path';
import { PrismaService } from '../prisma/prisma.service';

// Mídia do WhatsApp (recebida ou enviada) em pasta PROTEGIDA:
// <cwd>/protected/whatsapp/<org>/<uuid>.<ext> — fora do /uploads (que o nginx serve
// direto). Download só por URL assinada (HMAC com JWT_ACCESS_SECRET, TTL 7 dias).
// Retenção: 90 dias (D5) — cron diário apaga arquivo + linha.
export const MEDIA_RETENTION_DAYS = 90;
export const MEDIA_QUOTA_BYTES = Number(process.env.WHATSAPP_MEDIA_QUOTA_MB || 2048) * 1024 * 1024; // por organização
const SIGNED_TTL_SEC = 7 * 24 * 3600;
const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/3gpp': '3gp', 'video/quicktime': 'mov',
  'audio/ogg': 'ogg', 'audio/ogg; codecs=opus': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/webm': 'webm',
  'application/pdf': 'pdf',
};

export function kindOfMime(mime: string, ptt = false): string {
  const m = String(mime || '').toLowerCase();
  if (m.startsWith('image/')) return m.includes('webp') ? 'sticker' : 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return ptt ? 'voice' : 'audio';
  return 'document';
}

@Injectable()
export class WhatsAppMediaService {
  private readonly logger = new Logger(WhatsAppMediaService.name);

  root() {
    return resolve(process.cwd(), 'protected', 'whatsapp');
  }
  private secret() {
    return String(process.env.JWT_ACCESS_SECRET || process.env.JWT_REFRESH_SECRET || 'pubmail');
  }
  private sig(id: string, exp: number) {
    return createHmac('sha256', this.secret()).update(`${id}.${exp}`).digest('hex').slice(0, 40);
  }
  baseUrl() {
    return String(process.env.PUBLIC_API_URL || 'https://api.reveleonline.com').replace(/\/+$/, '');
  }

  signedUrl(id: string, ttl = SIGNED_TTL_SEC) {
    const exp = Math.floor(Date.now() / 1000) + ttl;
    return `${this.baseUrl()}/public/whatsapp-media/${id}?e=${exp}&s=${this.sig(id, exp)}`;
  }

  verify(id: string, e: string, s: string) {
    const exp = parseInt(String(e || ''), 10);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
    const want = this.sig(id, exp);
    const got = String(s || '');
    return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
  }

  // Grava um buffer/base64 e devolve a linha.
  async usage(orgId: string) {
    const a = await this.prisma.whatsapp_media.aggregate({ where: { organization_id: orgId }, _sum: { size_bytes: true } });
    return Number(a._sum.size_bytes || 0);
  }

  async store(orgId: string, buf: Buffer, mime: string, filename?: string | null, kind?: string) {
    if (buf.length > 1024 && (await this.usage(orgId)) + buf.length > MEDIA_QUOTA_BYTES) {
      throw new Error(`Cota de mídia da organização atingida (${Math.round(MEDIA_QUOTA_BYTES / 1024 / 1024)} MB).`);
    }
    const ext = MIME_EXT[String(mime || '').toLowerCase()] || (filename && extname(filename).replace('.', '').toLowerCase().slice(0, 8)) || 'bin';
    const dir = join(this.root(), orgId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o750 });
    const id = randomUUID();
    const rel = join(orgId, `${id}.${ext}`);
    await fsp.writeFile(join(this.root(), rel), buf, { mode: 0o640 });
    return this.prismaCreate({
      id,
      organization_id: orgId,
      kind: kind || kindOfMime(mime),
      mime: String(mime || 'application/octet-stream').slice(0, 128),
      filename: filename ? String(filename).slice(0, 255) : null,
      size_bytes: BigInt(buf.length),
      storage_path: rel,
      sha1: createHash('sha1').update(buf).digest('hex'),
      expires_at: new Date(Date.now() + MEDIA_RETENTION_DAYS * 86_400_000),
    });
  }

  private prismaCreate(data: any) {
    return this.prisma.whatsapp_media.create({ data });
  }

  async storeBase64(orgId: string, b64: string, mime: string, filename?: string | null, kind?: string) {
    const clean = String(b64 || '').replace(/^data:[^;]+;base64,/, '');
    return this.store(orgId, Buffer.from(clean, 'base64'), mime, filename, kind);
  }

  async get(orgId: string, id: string) {
    const m = await this.prisma.whatsapp_media.findFirst({ where: { id, organization_id: orgId } });
    if (!m) throw new NotFoundException('Mídia não encontrada.');
    return m;
  }

  async getAny(id: string) {
    const m = await this.prisma.whatsapp_media.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Mídia não encontrada.');
    return m;
  }

  absPath(m: { storage_path: string }) {
    const abs = resolve(this.root(), m.storage_path);
    if (!abs.startsWith(this.root())) throw new NotFoundException('Mídia não encontrada.');
    return abs;
  }

  async readBase64(orgId: string, id: string) {
    const m = await this.get(orgId, id);
    const buf = await fsp.readFile(this.absPath(m));
    return { base64: buf.toString('base64'), mime: m.mime, filename: m.filename, kind: m.kind };
  }

  toPublic(m: any) {
    if (!m) return null;
    return { id: m.id, kind: m.kind, mime: m.mime, filename: m.filename, size: Number(m.size_bytes), url: this.signedUrl(m.id) };
  }

  constructor(private readonly prisma: PrismaService) {}

  // Retenção (D5): apaga mídia vencida — arquivo e linha. Mensagens mantêm `media_id`
  // apontando pro nada → o front mostra "mídia expirada".
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeExpired() {
    const rows = await this.prisma.whatsapp_media.findMany({ where: { expires_at: { lte: new Date() } }, take: 2000 });
    let n = 0;
    for (const m of rows) {
      try { await fsp.unlink(this.absPath(m)); } catch { /* já não existe */ }
      await this.prisma.whatsapp_media.delete({ where: { id: m.id } }).catch(() => undefined);
      n++;
    }
    if (n) this.logger.log(`Mídia expirada apagada: ${n}`);
  }
}
