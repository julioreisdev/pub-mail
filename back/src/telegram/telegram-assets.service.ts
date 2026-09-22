import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'crypto';

const execFileP = promisify(execFile);

let sharp: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  sharp = require('sharp');
} catch {
  sharp = null;
}

const MAX_BYTES = 25 * 1024 * 1024; // 25MB

@Injectable()
export class TelegramAssetsService {
  private readonly logger = new Logger(TelegramAssetsService.name);

  private publicBase(): string {
    let base = (process.env.PUBLIC_API_URL || '').trim().replace(/\/$/, '');
    if (!base || base.includes('localhost') || base.startsWith('http://127.')) {
      base = 'https://api.bluewebchat.online';
    }
    return base;
  }

  private extFromMime(mime: string, fallback = 'bin'): string {
    const map: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/wav': 'wav',
      'application/pdf': 'pdf',
    };
    return map[String(mime || '').toLowerCase()] || fallback;
  }

  private async optimizeImage(buffer: Buffer, ext: string): Promise<{ buffer: Buffer; ext: string }> {
    if (!sharp || ext === 'gif') return { buffer, ext };
    try {
      const img = sharp(buffer, { failOn: 'none' }).rotate();
      const meta = await img.metadata();
      const resized = img.resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true });
      if (meta.hasAlpha) {
        return { buffer: await resized.png({ compressionLevel: 9, palette: true }).toBuffer(), ext: 'png' };
      }
      return { buffer: await resized.jpeg({ quality: 82, progressive: true, mozjpeg: true }).toBuffer(), ext: 'jpg' };
    } catch (e: any) {
      this.logger.warn(`otimização de imagem falhou, salvando original: ${e?.message}`);
      return { buffer, ext };
    }
  }

  // Converte qualquer áudio p/ OGG/OPUS (mensagem de voz do Telegram).
  private async toVoiceOgg(buffer: Buffer, inExt: string): Promise<Buffer> {
    const inPath = join(tmpdir(), `${randomUUID()}.${inExt || 'webm'}`);
    const outPath = join(tmpdir(), `${randomUUID()}.ogg`);
    await writeFile(inPath, buffer);
    try {
      await execFileP('ffmpeg', ['-y', '-i', inPath, '-vn', '-c:a', 'libopus', '-b:a', '48k', '-ar', '48000', outPath], {
        timeout: 60000,
      });
      return await readFile(outPath);
    } finally {
      await unlink(inPath).catch(() => undefined);
      await unlink(outPath).catch(() => undefined);
    }
  }

  async save(file: { buffer: Buffer; mimetype: string; originalname?: string } | undefined, type: string) {
    if (!file || !file.buffer?.length) throw new BadRequestException('Arquivo vazio.');
    if (file.buffer.length > MAX_BYTES) throw new BadRequestException('Arquivo muito grande (máx 25MB).');

    const dir = join(process.cwd(), 'uploads', 'telegram');
    await mkdir(dir, { recursive: true });

    let outBuffer = file.buffer;
    let ext = this.extFromMime(file.mimetype);
    let outType = type;

    if (type === 'photo') {
      const o = await this.optimizeImage(file.buffer, ext === 'bin' ? 'jpg' : ext);
      outBuffer = o.buffer;
      ext = o.ext;
      outType = 'photo';
    } else if (type === 'voice') {
      outBuffer = await this.toVoiceOgg(file.buffer, this.extFromMime(file.mimetype, 'webm'));
      ext = 'ogg';
      outType = 'voice';
    } else if (type === 'video') {
      if (ext === 'bin') ext = 'mp4';
      outType = 'video';
    } else {
      // documento: preserva a extensão do nome original se houver
      const fromName = String(file.originalname || '').split('.').pop();
      if (fromName && fromName.length <= 5) ext = fromName.toLowerCase();
      else if (ext === 'bin') ext = 'dat';
      outType = 'document';
    }

    const filename = `${randomUUID()}.${ext}`;
    await writeFile(join(dir, filename), outBuffer);

    // multer/busboy decodifica o nome como latin1 → acentos viram mojibake ("aì€s").
    // Reinterpreta os bytes como UTF-8 para exibir o nome correto ("às").
    let displayName: string | null = null;
    if (file.originalname) {
      try {
        displayName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      } catch {
        displayName = file.originalname;
      }
    }

    return {
      url: `${this.publicBase()}/uploads/telegram/${filename}`,
      type: outType,
      name: displayName,
    };
  }
}
