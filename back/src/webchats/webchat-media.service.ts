import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fsp } from 'fs';
import { extname, join } from 'path';
import { VIDEO_MP4, toWhatsAppMp4 } from '../whatsapp/whatsapp-media.service';

// Vídeo PÚBLICO do webchat (mensagem "Vídeo" do funil e das boas-vindas) — diferente do
// "Vídeo protegido" (webchat_assets, só liberado após pagamento). Vai para
// uploads/webchat/<org>/<uuid>.mp4, servido direto pelo nginx em /uploads/ (cache 1 ano),
// e é normalizado para MP4 + H.264 + AAC (o único formato que todo navegador/celular toca:
// .mov do iPhone/Mac, HEVC e WebM não abrem no Safari/Chrome de todo mundo).
export const MAX_WEBCHAT_VIDEO_BYTES = 120 * 1024 * 1024; // 120 MB (antes da conversão)

@Injectable()
export class WebchatMediaService {
  private readonly logger = new Logger(WebchatMediaService.name);

  private publicBase() {
    return String(process.env.PUBLIC_API_URL || process.env.BASE_API_URL || '').replace(/\/+$/, '');
  }

  async storeVideo(orgId: string, file: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('Arquivo obrigatório.');
    const mime = String(file.mimetype || '').toLowerCase();
    const ext = extname(String(file.originalname || '')).toLowerCase();
    const looksVideo = mime.startsWith('video/') || ['.mp4', '.mov', '.webm', '.m4v', '.mkv', '.avi'].includes(ext);
    if (!looksVideo) throw new BadRequestException('Selecione um arquivo de vídeo (mp4, mov, webm…).');
    if (file.size > MAX_WEBCHAT_VIDEO_BYTES) throw new BadRequestException('Vídeo acima de 120 MB. Comprima antes ou hospede fora e cole o link.');

    let buffer = file.buffer;
    let outMime = mime || 'video/mp4';
    let outExt = ext === '.webm' ? '.webm' : '.mp4';
    try {
      const conv = await toWhatsAppMp4(file.buffer, mime);
      if (conv) {
        buffer = conv.buffer;
        outMime = VIDEO_MP4;
        outExt = '.mp4';
        this.logger.log(`vídeo do webchat ${file.originalname} → MP4 (${conv.mode}) ${file.size} → ${buffer.length} bytes`);
      } else if (mime === VIDEO_MP4) {
        outExt = '.mp4';
      }
    } catch (e: any) {
      // ffmpeg indisponível/falhou: guarda o original (pode não tocar em todo aparelho)
      this.logger.warn(`vídeo do webchat sem conversão (${e?.message || e}); salvando o original`);
    }

    const dir = join(process.cwd(), 'uploads', 'webchat', orgId);
    await fsp.mkdir(dir, { recursive: true, mode: 0o755 });
    const filename = `${randomUUID()}${outExt}`;
    const abs = join(dir, filename);
    await fsp.writeFile(abs, buffer, { mode: 0o644 });
    // nome original latin1→utf8 (busboy) só para exibir no construtor
    let name = String(file.originalname || 'video');
    try { name = Buffer.from(name, 'latin1').toString('utf8'); } catch { /* mantém */ }
    name = name.replace(/[\u0000-\u001f]/g, '').slice(0, 255) || 'video';
    return {
      url: `${this.publicBase()}/uploads/webchat/${orgId}/${filename}`,
      name,
      size_bytes: buffer.length,
      mime: outMime,
    };
  }
}
