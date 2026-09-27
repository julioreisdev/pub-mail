import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { existsSync, mkdirSync, promises as fsp } from 'fs';
import { extname, join, resolve } from 'path';
import { PrismaService } from '../prisma/prisma.service';

// Arquivos de PRODUTO vendidos no webchat (PDF, vídeo, zip…). Guardados em
// <cwd>/protected/webchat/<org>/<uuid>.<ext> — fora do /uploads público que o
// nginx serve direto. Download só por URL assinada (HMAC + expiração), que o
// back emite APENAS depois de o pagamento estar PAID.
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB
export const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB (PDF, zip, etc.)
export const SIGNED_URL_TTL_SEC = 7 * 24 * 3600; // 7 dias pra baixar

const SAFE_EXT = /^[a-z0-9]{1,8}$/i;

@Injectable()
export class WebchatAssetsService {
  constructor(private readonly prisma: PrismaService) {}

  static rootDir() {
    return resolve(process.cwd(), 'protected', 'webchat');
  }

  static orgDir(orgId: string) {
    const dir = join(WebchatAssetsService.rootDir(), orgId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  static fileName(originalName: string) {
    const ext = extname(String(originalName || '')).replace('.', '').toLowerCase();
    return `${randomUUID()}${SAFE_EXT.test(ext) ? `.${ext}` : ''}`;
  }

  private secret() {
    return String(process.env.JWT_ACCESS_SECRET || process.env.JWT_REFRESH_SECRET || 'pubmail');
  }

  private sign(assetId: string, exp: number) {
    return createHmac('sha256', this.secret()).update(`${assetId}.${exp}`).digest('hex');
  }

  publicBase() {
    return (process.env.PUBLIC_API_URL || process.env.BASE_API_URL || 'https://api.bluewebchat.online').replace(/\/+$/, '');
  }

  signedUrl(assetId: string, ttlSec = SIGNED_URL_TTL_SEC) {
    const exp = Math.floor(Date.now() / 1000) + ttlSec;
    return `${this.publicBase()}/public/webchat-assets/${assetId}?e=${exp}&s=${this.sign(assetId, exp)}`;
  }

  verifySignature(assetId: string, exp: string | number, sig: string) {
    const e = Number(exp);
    if (!Number.isFinite(e) || e < Math.floor(Date.now() / 1000)) return false;
    const expected = Buffer.from(this.sign(assetId, e));
    const got = Buffer.from(String(sig || ''));
    return expected.length === got.length && timingSafeEqual(expected, got);
  }

  // Multer já gravou o arquivo em disco (diskStorage). Aqui só validamos e registramos.
  async register(orgId: string, file: Express.Multer.File, webchatId?: string | null) {
    if (!file) throw new BadRequestException('Arquivo obrigatório.');
    const mime = String(file.mimetype || 'application/octet-stream').slice(0, 128);
    const kind = mime.startsWith('video/') ? 'video' : 'file';
    const limit = kind === 'video' ? MAX_VIDEO_BYTES : MAX_FILE_BYTES;
    if (file.size > limit) {
      await fsp.unlink(file.path).catch(() => undefined);
      throw new BadRequestException(
        kind === 'video' ? 'Vídeo acima de 500 MB — hospede fora e envie o link.' : 'Arquivo acima de 100 MB.',
      );
    }
    if (webchatId) {
      const wc = await this.prisma.webchats.findFirst({ where: { id: webchatId, organization_id: orgId }, select: { id: true } });
      if (!wc) webchatId = null;
    }
    // Nome original vem latin1 do busboy → utf8 (mesmo fix do telegram-assets)
    let name = String(file.originalname || 'arquivo');
    try { name = Buffer.from(name, 'latin1').toString('utf8'); } catch { /* mantém */ }
    name = name.replace(/[\u0000-\u001f]/g, '').slice(0, 255) || 'arquivo';
    const relPath = join(orgId, file.filename).replace(/\\/g, '/');
    const row = await this.prisma.webchat_assets.create({
      data: { organization_id: orgId, webchat_id: webchatId || null, kind, name, mime, size_bytes: BigInt(file.size), storage_path: relPath },
    });
    return this.toResponse(row);
  }

  async list(orgId: string, webchatId?: string) {
    const rows = await this.prisma.webchat_assets.findMany({
      where: { organization_id: orgId, ...(webchatId ? { webchat_id: webchatId } : {}) },
      orderBy: { created_at: 'desc' },
      take: 200,
    });
    return rows.map((r) => this.toResponse(r));
  }

  async remove(orgId: string, id: string) {
    const row = await this.prisma.webchat_assets.findFirst({ where: { id, organization_id: orgId } });
    if (!row) throw new NotFoundException('Arquivo não encontrado.');
    await this.prisma.webchat_assets.delete({ where: { id } });
    await fsp.unlink(join(WebchatAssetsService.rootDir(), row.storage_path)).catch(() => undefined);
    return { ok: true };
  }

  async findForDownload(id: string, exp: string, sig: string) {
    if (!this.verifySignature(id, exp, sig)) throw new ForbiddenException('Link inválido ou expirado.');
    const row = await this.prisma.webchat_assets.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Arquivo não encontrado.');
    const abs = join(WebchatAssetsService.rootDir(), row.storage_path);
    if (!existsSync(abs)) throw new NotFoundException('Arquivo não encontrado no disco.');
    return { row, abs };
  }

  // Resolve vários assets da org de uma vez (entrega pós-pagamento).
  async mapByIds(orgId: string, ids: string[]) {
    const clean = [...new Set(ids.filter(Boolean))];
    if (!clean.length) return new Map<string, any>();
    const rows = await this.prisma.webchat_assets.findMany({ where: { id: { in: clean }, organization_id: orgId } });
    return new Map<string, any>(rows.map((r) => [r.id, r] as [string, any]));
  }

  toResponse(r: any) {
    return {
      id: r.id,
      webchat_id: r.webchat_id,
      kind: r.kind,
      name: r.name,
      mime: r.mime,
      size_bytes: Number(r.size_bytes),
      created_at: r.created_at,
    };
  }
}
