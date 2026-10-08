import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns';
import { existsSync, mkdirSync, promises as fsp } from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import { isIP } from 'node:net';
import { join } from 'node:path';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import type { IncomingMessage } from 'node:http';

// =============================================================================
// Prévia de links do chat (título, descrição e imagem, como o WhatsApp mostra).
//
// O servidor baixa a página e lê as meta tags Open Graph / Twitter / <title>. Segurança:
//  - só http/https nas portas 80/443, no máx. 4 redirecionamentos, 6 s e 768 KB por página;
//  - o IP de destino é conferido NA HORA DA CONEXÃO (opção `lookup` do http/https), então
//    nada de rede interna, loopback, link-local etc. — nem por DNS que muda entre checagens;
//  - a imagem passa pelo sharp (máx. 600 px, JPEG) e fica em `uploads/link-previews/`,
//    servida direto pelo nginx (nunca é o arquivo original do site).
// Cache: memória + disco (`protected/link-previews/<sha1>.json`), 3 dias; falha = 2 h.
// =============================================================================

export type LinkPreview = {
  url: string;
  final_url?: string;
  domain: string;
  site?: string | null;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  image_w?: number | null;
  image_h?: number | null;
  empty?: boolean;
};

const OK_TTL = 3 * 24 * 3600_000;
const FAIL_TTL = 2 * 3600_000;
const PAGE_MAX = 768 * 1024;
const IMG_MAX = 6 * 1024 * 1024;
const TIMEOUT = 6000;
// o WhatsApp e o robô do Facebook recebem as meta tags até de sites que exigem login (Facebook, Instagram)
const UA_WHATSAPP = 'WhatsApp/2.24.20.80 A';
const UA_FACEBOOK = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

function ipv4Private(ip: string) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
  const [a, b] = p;
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && p[2] === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}
export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return ipv4Private(ip);
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === '::' || x === '::1') return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
    if (mapped) return ipv4Private(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(x);
  }
  return true;
}

// lookup usado pelo http/https: recusa a conexão se QUALQUER endereço resolvido for interno
function safeLookup(hostname: string, options: any, cb: any) {
  dnsLookup(hostname, { all: true }, (err, addrs: any) => {
    if (err) return cb(err);
    const list = Array.isArray(addrs) ? addrs : [];
    if (!list.length || list.some((a: any) => isPrivateIp(a.address))) return cb(Object.assign(new Error('destino bloqueado'), { code: 'EBLOCKED' }));
    if (options?.all) return cb(null, list);
    return cb(null, list[0].address, list[0].family);
  });
}

/** Normaliza o que o usuário escreveu: "site.com.br/x" → "https://site.com.br/x". */
export function normalizePreviewUrl(raw: string): URL | null {
  let s = String(raw || '').trim().replace(/[)\].,;:!?'"»”]+$/, '');
  if (!s || s.length > 2000) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  if (u.username || u.password) return null;
  if (u.port && !['80', '443'].includes(u.port)) return null;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return null;
  if (isIP(host) && isPrivateIp(host)) return null;
  if (!isIP(host) && !host.includes('.')) return null;
  u.hash = '';
  return u;
}

type Fetched = { status: number; headers: http.IncomingHttpHeaders; body: Buffer; url: URL };

function decodeStream(res: IncomingMessage) {
  const enc = String(res.headers['content-encoding'] || '').toLowerCase();
  if (enc.includes('gzip')) return res.pipe(createGunzip());
  if (enc.includes('br')) return res.pipe(createBrotliDecompress());
  if (enc.includes('deflate')) return res.pipe(createInflate());
  return res;
}

function fetchOnce(url: URL, ua: string, accept: string, max: number): Promise<Fetched> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request(
      url,
      {
        method: 'GET',
        lookup: safeLookup as any,
        timeout: TIMEOUT,
        headers: {
          'User-Agent': ua,
          Accept: accept,
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
        },
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, headers: res.headers, body: Buffer.alloc(0), url });
        }
        const chunks: Buffer[] = [];
        let size = 0;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve({ status, headers: res.headers, body: Buffer.concat(chunks), url });
        };
        const stream = decodeStream(res);
        stream.on('data', (c: Buffer) => {
          size += c.length;
          if (size > max) {
            chunks.push(c.subarray(0, Math.max(0, c.length - (size - max))));
            req.destroy();
            finish();
            return;
          }
          chunks.push(c);
        });
        stream.on('end', finish);
        stream.on('error', (e) => (done ? undefined : chunks.length ? finish() : reject(e)));
      },
    );
    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
    req.end();
  });
}

async function fetchFollow(start: URL, ua: string, accept: string, max: number): Promise<Fetched> {
  let url = start;
  for (let hop = 0; hop <= 4; hop++) {
    const r = await fetchOnce(url, ua, accept, max);
    if (r.status >= 300 && r.status < 400 && r.headers.location) {
      const next = normalizePreviewUrl(new URL(String(r.headers.location), url).href);
      if (!next) throw new Error('redirecionamento bloqueado');
      url = next;
      continue;
    }
    return r;
  }
  throw new Error('redirecionamentos demais');
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', middot: '·', copy: '©', reg: '®' };
function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try {
        return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : m;
      } catch {
        return m;
      }
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}
const clean = (s: any, max: number) => {
  const v = decodeEntities(String(s || '')).replace(/\s+/g, ' ').trim();
  return v ? (v.length > max ? `${v.slice(0, max - 1).trimEnd()}…` : v) : null;
};

function decodeHtml(body: Buffer, contentType: string) {
  const head = body.subarray(0, 4096).toString('latin1');
  const cs = (/charset=["']?([\w-]+)/i.exec(contentType)?.[1] || /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] || 'utf-8').toLowerCase();
  try {
    return new TextDecoder(cs === 'iso-8859-1' || cs === 'latin1' ? 'windows-1252' : cs).decode(body);
  } catch {
    return body.toString('utf8');
  }
}

export function parseMeta(html: string) {
  const metas: Record<string, string> = {};
  const re = /<meta\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const attr = (n: string) => new RegExp(`\\b${n}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
    const key = attr('property') || attr('name') || attr('itemprop');
    const val = attr('content');
    if (!key || !val) continue;
    const k = (key[1] ?? key[2] ?? key[3] ?? '').toLowerCase().trim();
    const v = val[1] ?? val[2] ?? val[3] ?? '';
    if (k && !(k in metas)) metas[k] = v;
  }
  const title = /<title[^>]*>([\s\S]{0,600}?)<\/title>/i.exec(html)?.[1];
  return { metas, title };
}

@Injectable()
export class WhatsAppLinkPreviewService {
  private readonly logger = new Logger(WhatsAppLinkPreviewService.name);
  private readonly mem = new Map<string, { at: number; data: LinkPreview }>();
  private readonly inflight = new Map<string, Promise<LinkPreview>>();

  private uploadsDir() {
    return join(process.cwd(), 'uploads', 'link-previews');
  }
  private cacheDir() {
    return join(process.cwd(), 'protected', 'link-previews');
  }
  private publicBase() {
    return String(process.env.BASE_API_URL || process.env.PUBLIC_API_URL || '').trim().replace(/\/$/, '');
  }

  async get(raw: string): Promise<LinkPreview> {
    const u = normalizePreviewUrl(raw);
    if (!u) throw new BadRequestException('Link inválido.');
    const key = createHash('sha1').update(u.href).digest('hex');
    const now = Date.now();
    const hit = this.mem.get(key);
    if (hit && now - hit.at < (hit.data.empty ? FAIL_TTL : OK_TTL)) return hit.data;
    const running = this.inflight.get(key);
    if (running) return running;
    const p = this.load(u, key).finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  private remember(key: string, data: LinkPreview) {
    if (this.mem.size > 3000) this.mem.delete(this.mem.keys().next().value as string);
    this.mem.set(key, { at: Date.now(), data });
  }

  private async load(u: URL, key: string): Promise<LinkPreview> {
    const file = join(this.cacheDir(), `${key}.json`);
    try {
      const st = await fsp.stat(file);
      const data = JSON.parse(await fsp.readFile(file, 'utf8')) as LinkPreview;
      if (Date.now() - st.mtimeMs < (data.empty ? FAIL_TTL : OK_TTL)) {
        this.remember(key, data);
        return data;
      }
    } catch {
      /* sem cache em disco */
    }
    let data: LinkPreview;
    try {
      data = await this.build(u, key);
    } catch (e: any) {
      this.logger.debug(`prévia de ${u.hostname} falhou: ${e?.code || e?.message || e}`);
      data = { url: u.href, domain: u.hostname.replace(/^www\./, ''), empty: true };
    }
    this.remember(key, data);
    try {
      if (!existsSync(this.cacheDir())) mkdirSync(this.cacheDir(), { recursive: true, mode: 0o750 });
      await fsp.writeFile(file, JSON.stringify(data), { mode: 0o640 });
    } catch {
      /* cache em disco é opcional */
    }
    return data;
  }

  private async page(u: URL, ua: string) {
    const r = await fetchFollow(u, ua, 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', PAGE_MAX);
    const ct = String(r.headers['content-type'] || '');
    if (r.status >= 400) throw new Error(`HTTP ${r.status}`);
    if (ct && !/html|xml/i.test(ct)) return { final: r.url, meta: null as ReturnType<typeof parseMeta> | null, ct };
    return { final: r.url, meta: parseMeta(decodeHtml(r.body, ct)), ct };
  }

  private async build(u: URL, key: string): Promise<LinkPreview> {
    let res = await this.page(u, UA_WHATSAPP).catch(() => null);
    if (!res?.meta?.metas['og:title']) {
      const alt = await this.page(u, UA_FACEBOOK).catch(() => null);
      if (alt?.meta && (alt.meta.metas['og:title'] || !res?.meta)) res = alt;
    }
    const domain = (res?.final || u).hostname.replace(/^www\./, '');
    if (!res) throw new Error('página indisponível');
    if (!res.meta) {
      // link direto para uma imagem
      if (/^image\//i.test(res.ct)) {
        const img = await this.saveImage(res.final, key).catch(() => null);
        if (img) return { url: u.href, final_url: res.final.href, domain, site: null, title: null, description: null, ...img };
      }
      return { url: u.href, final_url: res.final.href, domain, empty: true };
    }
    const g = (k: string) => res!.meta!.metas[k];
    const title = clean(g('og:title') || g('twitter:title') || res.meta.title, 160);
    const description = clean(g('og:description') || g('twitter:description') || g('description'), 280);
    const site = clean(g('og:site_name') || g('application-name'), 60);
    const imgRaw = g('og:image:secure_url') || g('og:image') || g('og:image:url') || g('twitter:image') || g('twitter:image:src');
    let image: { image: string; image_w: number; image_h: number } | null = null;
    if (imgRaw) {
      try {
        const iu = normalizePreviewUrl(new URL(decodeEntities(imgRaw), res.final).href);
        if (iu) image = await this.saveImage(iu, key);
      } catch (e: any) {
        this.logger.debug(`imagem da prévia de ${domain} falhou: ${e?.message || e}`);
      }
    }
    if (!title && !description && !image) return { url: u.href, final_url: res.final.href, domain, empty: true };
    return { url: u.href, final_url: res.final.href, domain, site, title, description, ...(image || { image: null, image_w: null, image_h: null }) };
  }

  private async saveImage(iu: URL, key: string) {
    const r = await fetchFollow(iu, UA_WHATSAPP, 'image/avif,image/webp,image/*;q=0.9,*/*;q=0.3', IMG_MAX);
    if (r.status >= 400 || !r.body.length) throw new Error(`imagem HTTP ${r.status}`);
    let sharp: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      sharp = require('sharp');
    } catch {
      return null;
    }
    const { data, info } = await sharp(r.body, { failOn: 'none', limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    const dir = this.uploadsDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o755 });
    await fsp.writeFile(join(dir, `${key}.jpg`), data, { mode: 0o644 });
    return { image: `${this.publicBase()}/uploads/link-previews/${key}.jpg`, image_w: info.width as number, image_h: info.height as number };
  }
}
