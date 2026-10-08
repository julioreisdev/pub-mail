import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { execFile } from 'child_process';
import { existsSync, mkdirSync, promises as fsp } from 'fs';
import { extname, join, resolve } from 'path';
import { promisify } from 'util';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from 'generated/prisma/client';
import { isOggOpus, repacketizeOggOpusToCode3 } from './opus-repacketize.util';
import { waKeyring } from './crypto/wa-keyring';
import { plainTmpDir } from './crypto/wa-file-serve';

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

const execFileP = promisify(execFile);
export const VOICE_MIME = 'audio/ogg; codecs=opus';

// O WhatsApp só toca mensagem de voz em OGG/Opus e não aceita WebM (formato que o navegador
// grava). Sem converter, o servidor aceita o envio mas o áudio nunca chega ao contato.
export function needsAudioConversion(mime: string, voice: boolean) {
  const m = String(mime || '').toLowerCase();
  if (!m.startsWith('audio/') && !(voice && m.startsWith('video/webm'))) return false;
  if (m.includes('webm')) return true;
  return voice && !m.startsWith('audio/ogg');
}

export async function toOggOpus(buf: Buffer): Promise<Buffer> {
  const id = randomUUID();
  const inPath = join(plainTmpDir(), `wa-${id}.in`);
  const outPath = join(plainTmpDir(), `wa-${id}.ogg`);
  await fsp.writeFile(inPath, buf);
  try {
    await execFileP('ffmpeg', ['-y', '-i', inPath, '-vn', '-map_metadata', '-1', '-c:a', 'libopus', '-b:a', '32k', '-ac', '1', '-ar', '48000', '-application', 'voip', '-f', 'ogg', outPath], { timeout: 60_000 });
    return await fsp.readFile(outPath);
  } finally {
    await fsp.unlink(inPath).catch(() => undefined);
    await fsp.unlink(outPath).catch(() => undefined);
  }
}

export const WAVEFORM_BARS = 64;
/**
 * Forma de onda de um áudio: decodifica com ffmpeg (mono, 8 kHz, PCM 16 bits, no máx. 10 min) e tira o
 * RMS de 64 blocos, normalizado para 0..100 (igual ao WhatsApp mostra). Também devolve a duração.
 */
export async function audioWaveform(input: string | Buffer): Promise<{ peaks: number[]; duration_ms: number }> {
  // Buffer (conteúdo já decifrado): vai para um temporário em memória e é apagado em seguida
  if (Buffer.isBuffer(input)) {
    const tmp = join(plainTmpDir(), `wa-wave-${randomUUID()}`);
    await fsp.writeFile(tmp, input, { mode: 0o600 });
    try {
      return await audioWaveform(tmp);
    } finally {
      await fsp.unlink(tmp).catch(() => undefined);
    }
  }
  const absPath = input;
  const { stdout } = await execFileP('ffmpeg', ['-v', 'error', '-t', '600', '-i', absPath, '-vn', '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], { timeout: 60_000, encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 } as any);
  const pcm = stdout as unknown as Buffer;
  const samples = Math.floor(pcm.length / 2);
  if (samples < 80) throw new Error('áudio vazio');
  const block = Math.max(1, Math.floor(samples / WAVEFORM_BARS));
  const rms: number[] = [];
  for (let b = 0; b < WAVEFORM_BARS; b++) {
    const start = b * block;
    const end = b === WAVEFORM_BARS - 1 ? samples : Math.min(samples, start + block);
    if (start >= samples) { rms.push(0); continue; }
    let acc = 0;
    for (let i = start; i < end; i++) { const v = pcm.readInt16LE(i * 2) / 32768; acc += v * v; }
    rms.push(Math.sqrt(acc / Math.max(1, end - start)));
  }
  const max = Math.max(...rms, 1e-6);
  // raiz quadrada da proporção: valoriza os trechos baixos (fala) sem achatar os picos
  const peaks = rms.map((v) => Math.max(0, Math.min(100, Math.round(Math.sqrt(v / max) * 100))));
  return { peaks, duration_ms: Math.round((samples / 8000) * 1000) };
}

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
    // validade arredondada para o fim do dia (UTC): o link de uma mídia é o MESMO o dia inteiro.
    // Se mudasse a cada leitura, o <audio>/<video> do painel recarregava e zerava no meio da reprodução.
    const exp = Math.ceil((Math.floor(Date.now() / 1000) + ttl) / 86_400) * 86_400;
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

  // Áudio em formato que o WhatsApp aceita (ver needsAudioConversion). Falha na conversão
  // devolve o original (o envio segue; melhor tentar do que perder a mensagem).
  //
  // Mensagem de VOZ (ptt) ainda passa pelo reempacotamento Opus "code 3" (opus-repacketize.util):
  // o WhatsApp do iOS recusa voz em pacotes de 1 quadro, que é o que o ffmpeg gera —
  // "Este áudio não está mais disponível" no celular mesmo com ✓✓. `converted:true` sempre
  // que os bytes mudaram (quem guarda o arquivo regrava).
  async normalizeAudio(buf: Buffer, mime: string, voice: boolean, filename?: string | null) {
    let out = buf;
    let outMime = mime;
    let name: string | null = filename || null;
    let converted = false;
    if (needsAudioConversion(mime, voice)) {
      try {
        out = await toOggOpus(buf);
        outMime = VOICE_MIME;
        name = filename ? `${String(filename).replace(/\.[a-z0-9]{1,8}$/i, '')}.ogg` : null;
        converted = true;
      } catch (e: any) {
        this.logger.warn(`conversão de áudio p/ OGG falhou (${mime}): ${String(e?.message || e).slice(0, 200)}`);
        return { buffer: buf, mime, filename: filename || null, converted: false };
      }
    }
    if (voice && isOggOpus(out)) {
      try {
        const re = repacketizeOggOpusToCode3(out);
        if (re !== out) {
          out = re;
          converted = true;
        }
      } catch (e: any) {
        this.logger.warn(`reempacotamento Opus da voz falhou: ${String(e?.message || e).slice(0, 200)}`);
      }
    }
    return { buffer: out, mime: outMime, filename: name, converted };
  }

  /** Voz precisa passar pelo normalizeAudio (conversão e/ou reempacotamento); outros áudios só se o formato exigir. */
  private needsNormalize(mime: string, voice: boolean) {
    return voice || needsAudioConversion(mime, voice);
  }

  async store(orgId: string, buf: Buffer, mime: string, filename?: string | null, kind?: string) {
    if (this.needsNormalize(mime, kind === 'voice')) ({ buffer: buf, mime, filename } = await this.normalizeAudio(buf, mime, kind === 'voice', filename));
    if (buf.length > 1024 && (await this.usage(orgId)) + buf.length > MEDIA_QUOTA_BYTES) {
      throw new Error(`Cota de mídia da organização atingida (${Math.round(MEDIA_QUOTA_BYTES / 1024 / 1024)} MB).`);
    }
    const ext = MIME_EXT[String(mime || '').toLowerCase()] || (filename && extname(filename).replace('.', '').toLowerCase().slice(0, 8)) || 'bin';
    const dir = join(this.root(), orgId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o750 });
    const id = randomUUID();
    const rel = join(orgId, `${id}.${ext}`);
    await this.writeStored(orgId, rel, buf);
    const finalKind = kind || kindOfMime(mime);
    let wave: { peaks: number[]; duration_ms: number } | null = null;
    if (finalKind === 'audio' || finalKind === 'voice') wave = await audioWaveform(buf).catch(() => null);
    return this.prismaCreate({
      id,
      organization_id: orgId,
      kind: finalKind,
      mime: String(mime || 'application/octet-stream').slice(0, 128),
      filename: filename ? String(filename).slice(0, 255) : null,
      size_bytes: BigInt(buf.length),
      storage_path: rel,
      sha1: createHash('sha1').update(buf).digest('hex'),
      ...(wave ? { waveform: wave.peaks, duration_ms: wave.duration_ms } : {}),
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

  /** Grava o arquivo CIFRADO (quando a criptografia está ligada): escreve num temporário e troca de uma vez. */
  async writeStored(orgId: string, rel: string, plain: Buffer) {
    const out = await waKeyring().encryptFile(orgId, plain);
    const abs = join(this.root(), rel);
    const tmp = `${abs}.tmp-${randomUUID().slice(0, 8)}`;
    await fsp.writeFile(tmp, out, { mode: 0o640 });
    await fsp.rename(tmp, abs);
  }

  /** Conteúdo original do arquivo (decifra se estiver cifrado). */
  async readFile(m: { storage_path: string }): Promise<Buffer> {
    return waKeyring().decryptFileBuffer(await fsp.readFile(this.absPath(m)));
  }

  absPath(m: { storage_path: string }) {
    const abs = resolve(this.root(), m.storage_path);
    if (!abs.startsWith(this.root())) throw new NotFoundException('Mídia não encontrada.');
    return abs;
  }

  async readBase64(orgId: string, id: string) {
    let m = await this.get(orgId, id);
    let buf: Buffer = await this.readFile(m);
    // áudio guardado antes da conversão existir (ex.: gravado no navegador em WebM) ou voz
    // guardada antes do reempacotamento code 3: converte uma vez e passa a guardar o OGG certo
    if (this.needsNormalize(m.mime, m.kind === 'voice')) {
      const n = await this.normalizeAudio(buf, m.mime, m.kind === 'voice', m.filename);
      if (n.converted) {
        const rel = join(m.organization_id, `${m.id}.ogg`);
        await this.writeStored(m.organization_id, rel, n.buffer);
        if (rel !== m.storage_path) await fsp.unlink(this.absPath(m)).catch(() => undefined);
        m = await this.prisma.whatsapp_media.update({
          where: { id: m.id },
          data: { mime: n.mime, filename: n.filename, size_bytes: BigInt(n.buffer.length), storage_path: rel, sha1: createHash('sha1').update(n.buffer).digest('hex') },
        });
        buf = n.buffer;
      }
    }
    return { base64: buf.toString('base64'), mime: m.mime, filename: m.filename, kind: m.kind };
  }

  toPublic(m: any) {
    if (!m) return null;
    const wf = Array.isArray(m.waveform) && m.waveform.length ? (m.waveform as number[]) : null;
    return { id: m.id, kind: m.kind, mime: m.mime, filename: m.filename, size: Number(m.size_bytes), url: this.signedUrl(m.id), waveform: wf, duration_ms: m.duration_ms ?? null };
  }

  // ---------------------------------------------------------------- forma de onda (áudios antigos)
  private readonly waveBusy = new Set<string>();

  /** Calcula a forma de onda das mídias de áudio que ainda não têm (best-effort). Devolve os ids que mudaram. */
  async ensureWaveforms(ids: string[]): Promise<string[]> {
    const todo = [...new Set(ids)].filter((id) => id && !this.waveBusy.has(id)).slice(0, 25);
    if (!todo.length) return [];
    todo.forEach((id) => this.waveBusy.add(id));
    const done: string[] = [];
    try {
      const rows = await this.prisma.whatsapp_media.findMany({ where: { id: { in: todo }, kind: { in: ['audio', 'voice'] }, waveform: { equals: Prisma.DbNull } } });
      for (const m of rows) {
        try {
          const wave = await audioWaveform(await this.readFile(m));
          await this.prisma.whatsapp_media.update({ where: { id: m.id }, data: { waveform: wave.peaks, duration_ms: wave.duration_ms } });
          done.push(m.id);
        } catch (e: any) {
          // marca "tentou" ([]) para não ficar refazendo um arquivo que o ffmpeg não lê
          await this.prisma.whatsapp_media.update({ where: { id: m.id }, data: { waveform: [] } }).catch(() => undefined);
          this.logger.debug(`waveform ${m.id}: ${String(e?.message || e).slice(0, 120)}`);
        }
      }
    } finally {
      todo.forEach((id) => this.waveBusy.delete(id));
    }
    return done;
  }

  /** Backfill dos áudios anteriores a esta versão: 40 por rodada, a cada 5 min (e 30 s depois do boot). */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async backfillWaveforms() {
    try {
      const rows = await this.prisma.whatsapp_media.findMany({ where: { kind: { in: ['audio', 'voice'] }, waveform: { equals: Prisma.DbNull } }, select: { id: true }, orderBy: { created_at: 'desc' }, take: 40 });
      if (!rows.length) return;
      const done = await this.ensureWaveforms(rows.map((r) => r.id));
      if (done.length) this.logger.log(`Forma de onda calculada para ${done.length} áudio(s)`);
    } catch (e: any) {
      this.logger.debug(`backfill waveform: ${e?.message || e}`);
    }
  }
  onModuleInit() { setTimeout(() => this.backfillWaveforms().catch(() => undefined), 30_000); }

  constructor(private readonly prisma: PrismaService) {}

  // Mídias usadas por CONFIGURAÇÕES da org (anexo de resposta rápida, mídia do fluxo do bot,
  // mídia das copies de broadcast). Não vencem nem são apagadas pela limpeza de dados do número.
  async referencedIds(orgIds?: string[]): Promise<Set<string>> {
    const where = orgIds?.length ? { organization_id: { in: orgIds } } : {};
    const [replies, flows, copies, team] = await Promise.all([
      this.prisma.whatsapp_quick_replies.findMany({ where: { ...where, media_id: { not: null } }, select: { media_id: true } }),
      this.prisma.whatsapp_bot_flows.findMany({ where, select: { definition: true } }),
      this.prisma.whatsapp_broadcast_copies.findMany({ where, select: { messages: true } }),
      this.prisma.team_messages.findMany({ where: { ...where, media_id: { not: null }, deleted_at: null }, select: { media_id: true } }).catch(() => [] as { media_id: string | null }[]),
    ]);
    const ids = new Set<string>();
    for (const r of replies) if (r.media_id) ids.add(r.media_id);
    for (const r of team) if (r.media_id) ids.add(r.media_id);
    const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    for (const json of [...flows.map((f) => f.definition), ...copies.map((c) => c.messages)]) {
      for (const m of JSON.stringify(json ?? null).match(uuid) || []) ids.add(m.toLowerCase());
    }
    return ids;
  }

  // Retenção (D5): apaga mídia vencida — arquivo e linha. Mensagens mantêm `media_id`
  // apontando pro nada → o front mostra "mídia expirada". Mídia usada em configuração
  // (respostas rápidas, bot, broadcasts) perde o vencimento em vez de ser apagada.
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeExpired() {
    const rows = await this.prisma.whatsapp_media.findMany({ where: { expires_at: { lte: new Date() } }, take: 2000 });
    const keep = rows.length ? await this.referencedIds([...new Set(rows.map((m) => m.organization_id))]) : new Set<string>();
    const pinned = rows.filter((m) => keep.has(m.id)).map((m) => m.id);
    if (pinned.length) await this.prisma.whatsapp_media.updateMany({ where: { id: { in: pinned } }, data: { expires_at: null } });
    let n = 0;
    for (const m of rows) {
      if (keep.has(m.id)) continue;
      try { await fsp.unlink(this.absPath(m)); } catch { /* já não existe */ }
      await this.prisma.whatsapp_media.delete({ where: { id: m.id } }).catch(() => undefined);
      n++;
    }
    if (n) this.logger.log(`Mídia expirada apagada: ${n}`);
  }
}
