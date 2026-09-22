import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'crypto';
// sharp é opcional em runtime: se não carregar, salvamos o original (sem
// otimização) em vez de quebrar o upload.
let sharp: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  sharp = require('sharp');
} catch {
  sharp = null;
}

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_BYTES = 3 * 1024 * 1024; // 3MB decodificado

// Hospeda imagens do builder de e-mail. IMPORTANTE: e-mail não renderiza data
// URL (Gmail bloqueia) — por isso salvamos o arquivo e devolvemos uma URL
// pública (servida pelo back em /uploads via useStaticAssets no main.ts).
@Injectable()
export class EmailAssetsService {
  private readonly logger = new Logger(EmailAssetsService.name);

  // Redimensiona + comprime + normaliza formato p/ carregar RÁPIDO no e-mail.
  // Sem alpha => JPEG (universal, leve). Com alpha => PNG. GIF animado mantido.
  private async optimize(
    buffer: Buffer,
    ext: string,
  ): Promise<{ buffer: Buffer; ext: string }> {
    if (!sharp || ext === 'gif') return { buffer, ext };
    try {
      const img = sharp(buffer, { failOn: 'none' }).rotate(); // auto-orient
      const meta = await img.metadata();
      const resized = img.resize({
        width: 1000,
        height: 1000,
        fit: 'inside',
        withoutEnlargement: true,
      });
      if (meta.hasAlpha) {
        const out = await resized
          .png({ compressionLevel: 9, palette: true, quality: 82 })
          .toBuffer();
        return { buffer: out, ext: 'png' };
      }
      const out = await resized
        .jpeg({ quality: 80, progressive: true, mozjpeg: true })
        .toBuffer();
      return { buffer: out, ext: 'jpg' };
    } catch (e: any) {
      this.logger.warn(`Falha ao otimizar imagem, salvando original: ${e?.message}`);
      return { buffer, ext };
    }
  }

  private publicBase(): string {
    let base = (process.env.EMAIL_ASSETS_BASE || process.env.BASE_API_URL || '')
      .trim()
      .replace(/\/$/, '');
    if (!base || base.includes('localhost') || base.startsWith('http://127.')) {
      base = 'https://api.bluewebchat.online';
    }
    return base;
  }

  async saveDataUrl(dataUrl: string): Promise<{ url: string }> {
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(
      String(dataUrl || '').trim(),
    );
    if (!match) {
      throw new BadRequestException(
        'Imagem inválida (esperado data URL base64).',
      );
    }
    const mime = match[1].toLowerCase();
    const ext = MIME_EXT[mime];
    if (!ext) {
      throw new BadRequestException(
        'Formato não suportado. Use PNG, JPG, WEBP ou GIF.',
      );
    }
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0) {
      throw new BadRequestException('Imagem vazia.');
    }
    if (buffer.length > MAX_BYTES) {
      throw new BadRequestException('Imagem muito grande (máx 3MB).');
    }

    // Otimiza (redimensiona + comprime) pra carregar rápido no e-mail.
    const optimized = await this.optimize(buffer, ext);

    const dir = join(process.cwd(), 'uploads', 'email');
    await mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}.${optimized.ext}`;
    await writeFile(join(dir, filename), optimized.buffer);

    return { url: `${this.publicBase()}/uploads/email/${filename}` };
  }
}
