// POST JSON para um SITE DE CLIENTE (o "Sincronizar agora" do Push In Play pede o resumo ao WordPress).
// O endereço vem do que o plugin informou no check (controlado pelo cliente), então vale o mesmo
// cuidado anti-SSRF da prévia de links: só https na porta 443, nome de host (não IP literal), destino
// conferido NA CONEXÃO (lookup próprio recusa loopback/rede privada/link-local/CGNAT/multicast, IPv4 e
// IPv6 mapeado), sem redirecionamento, tempo e tamanho limitados. O corpo só leva um token.
import * as https from 'node:https';
import * as http from 'node:http';
import { lookup as dnsLookup } from 'node:dns';
import { isIP } from 'node:net';

export class SafeHttpError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 0,
  ) {
    super(message);
  }
}

function ipv4Private(ip: string) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
    return true;
  const [a, b] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && p[2] === 0) || // 192.0.0.0/24 (IETF)
    (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15 (testes de rede)
    a >= 224
  );
}

/** IPv6 → 8 grupos de 16 bits (aceita "::", IPv4 no fim e zona "%eth0"). null = inválido. */
function ipv6Words(ip: string): number[] | null {
  let s = ip.toLowerCase().split('%')[0];
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (v4) {
    const p = v4[1].split('.').map(Number);
    if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    s = s.slice(0, -v4[1].length) + `${((p[0] << 8) | p[1]).toString(16)}:${((p[2] << 8) | p[3]).toString(16)}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const parse = (h: string) => (h ? h.split(':') : []).map((x) => (/^[0-9a-f]{1,4}$/.test(x) ? parseInt(x, 16) : NaN));
  const head = parse(halves[0]);
  const tail = halves.length === 2 ? parse(halves[1]) : [];
  if ([...head, ...tail].some((n) => Number.isNaN(n))) return null;
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
  return [...head, ...new Array(fill).fill(0), ...tail];
}
const v4of = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;

export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return ipv4Private(ip);
  if (v !== 6) return true;
  const w = ipv6Words(ip);
  if (!w) return true;
  // ::/96 — não especificado, loopback e IPv4-compatível (::a.b.c.d, obsoleto): tudo bloqueado
  if (w.slice(0, 6).every((x) => x === 0)) return true;
  // ::ffff:a.b.c.d (IPv4 mapeado) — vale a regra do IPv4 de dentro
  if (w.slice(0, 5).every((x) => x === 0) && w[5] === 0xffff) return ipv4Private(v4of(w[6], w[7]));
  // ::ffff:0:a.b.c.d (IPv4 traduzido) — bloqueado
  if (w.slice(0, 4).every((x) => x === 0) && w[4] === 0xffff && w[5] === 0) return true;
  // 64:ff9b::/96 (NAT64 público) e 64:ff9b:1::/48 (NAT64 local) — a rede do servidor pode traduzir para qualquer IPv4
  if (w[0] === 0x64 && w[1] === 0xff9b) return true;
  // 2002::/16 (6to4): IPv4 embutido nos bits 16–47
  if (w[0] === 0x2002) return ipv4Private(v4of(w[1], w[2]));
  // 2001:0::/32 (Teredo: IPv4 ofuscado) e 2001:db8::/32 (documentação)
  if (w[0] === 0x2001 && (w[1] === 0 || w[1] === 0xdb8)) return true;
  // 100::/64 (descarte)
  if (w[0] === 0x100 && w[1] === 0 && w[2] === 0 && w[3] === 0) return true;
  // fc00::/7 (ULA), fe80::/10 (link-local), fec0::/10 (site-local), ff00::/8 (multicast)
  return (w[0] & 0xfe00) === 0xfc00 || (w[0] & 0xffc0) === 0xfe80 || (w[0] & 0xffc0) === 0xfec0 || (w[0] & 0xff00) === 0xff00;
}

function safeLookup(hostname: string, options: any, cb: any) {
  dnsLookup(
    hostname,
    { ...(options || {}), all: true },
    (err: any, list: any) => {
      if (err) return cb(err);
      const arr = Array.isArray(list) ? list : [list];
      if (!arr.length || arr.some((a: any) => isPrivateIp(a.address)))
        return cb(
          Object.assign(new Error('destino bloqueado'), { code: 'EBLOCKED' }),
        );
      if (options?.all) return cb(null, arr);
      cb(null, arr[0].address, arr[0].family);
    },
  );
}

export function postJson(
  rawUrl: string,
  body: unknown,
  opts: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<any> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return Promise.reject(new SafeHttpError('endereço inválido', 'EURL'));
  }
  if (u.protocol !== 'https:' || u.username || u.password)
    return Promise.reject(
      new SafeHttpError('o site precisa ser https', 'EURL'),
    );
  if (u.port && u.port !== '443')
    return Promise.reject(new SafeHttpError('porta não permitida', 'EURL'));
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (
    isIP(host) ||
    host === 'localhost' ||
    /\.(local|internal|localhost)$/.test(host)
  )
    return Promise.reject(new SafeHttpError('destino bloqueado', 'EBLOCKED'));
  const data = Buffer.from(JSON.stringify(body), 'utf8');
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const maxBytes = opts.maxBytes ?? 1_048_576;
  return new Promise((resolve, reject) => {
    const req = https.request(
      u,
      {
        method: 'POST',
        lookup: safeLookup as any,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
          Accept: 'application/json',
          'User-Agent': 'PubMail-Sync/1',
        },
        timeout: timeoutMs,
      },
      (res) => {
        const status = res.statusCode || 0;
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (c: Buffer) => {
          size += c.length;
          if (size > maxBytes) {
            req.destroy(new SafeHttpError('resposta grande demais', 'EBIG'));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => {
          if (status < 200 || status >= 300)
            return reject(new SafeHttpError(`HTTP ${status}`, 'EHTTP', status));
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch {
            reject(new SafeHttpError('resposta não é JSON', 'EJSON', status));
          }
        });
      },
    );
    const hard = setTimeout(
      () => req.destroy(new SafeHttpError('tempo esgotado', 'ETIMEOUT')),
      timeoutMs + 2_000,
    );
    req.on('timeout', () =>
      req.destroy(new SafeHttpError('tempo esgotado', 'ETIMEOUT')),
    );
    req.on('close', () => clearTimeout(hard));
    req.on('error', (e: any) =>
      reject(
        e instanceof SafeHttpError
          ? e
          : new SafeHttpError(e?.message || 'falha de rede', e?.code || 'ENET'),
      ),
    );
    req.end(data);
  });
}

// ---------------------------------------------------------------------------------------------------------
// Webhooks de saída da organização (Fase 5): POST de um corpo JÁ SERIALIZADO (a assinatura é sobre os bytes
// exatos), com cabeçalhos próprios, devolvendo o status mesmo quando não é 2xx (quem chama decide a nova
// tentativa). Mesmo anti-SSRF do `postJson` (https:443, host não-IP, IP conferido na conexão, sem redirect).
// Exceção SÓ para teste: `ORG_WEBHOOK_ALLOW_LOCAL_PORTS="18999,19000"` libera `http://127.0.0.1:<porta listada>`.
// `postJson` acima continua igual (o Push In Play depende dele).
export function allowedLocalPorts(): number[] {
  return String(process.env.ORG_WEBHOOK_ALLOW_LOCAL_PORTS || '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0 && n < 65536);
}

/** Confere um endereço de webhook. Lança `SafeHttpError` com mensagem clara; devolve a URL normalizada. */
export function checkWebhookUrl(rawUrl: string, localPorts: number[] = allowedLocalPorts()): { url: string; local: boolean } {
  let u: URL;
  try {
    u = new URL(String(rawUrl || '').trim());
  } catch {
    throw new SafeHttpError('Endereço inválido.', 'EURL');
  }
  if (u.username || u.password) throw new SafeHttpError('O endereço não pode ter usuário/senha.', 'EURL');
  if (u.protocol === 'http:' && u.hostname === '127.0.0.1' && u.port && localPorts.includes(Number(u.port))) return { url: u.toString(), local: true };
  if (u.protocol !== 'https:') throw new SafeHttpError('O webhook precisa ser https://', 'EURL');
  if (u.port && u.port !== '443') throw new SafeHttpError('Só a porta 443 é permitida.', 'EURL');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) || host === 'localhost' || /\.(local|internal|localhost)$/.test(host) || !host.includes('.'))
    throw new SafeHttpError('Use um domínio público (IP e rede interna não são aceitos).', 'EBLOCKED');
  return { url: u.toString(), local: false };
}

export type RawPostResult = { status: number; body: string; duration_ms: number };

/** POST de `body` (string) com `headers`. Resolve com o status (qualquer um); rejeita em erro de rede/bloqueio/tempo. */
export function postRaw(rawUrl: string, body: string, opts: { headers?: Record<string, string>; timeoutMs?: number; maxBytes?: number; localPorts?: number[] } = {}): Promise<RawPostResult> {
  let target: { url: string; local: boolean };
  try {
    target = checkWebhookUrl(rawUrl, opts.localPorts ?? allowedLocalPorts());
  } catch (e) {
    return Promise.reject(e);
  }
  const u = new URL(target.url);
  const data = Buffer.from(body, 'utf8');
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const maxBytes = opts.maxBytes ?? 65_536;
  const started = Date.now();
  const mod: any = target.local ? http : https;
  return new Promise((resolve, reject) => {
    const req = mod.request(
      u,
      {
        method: 'POST',
        ...(target.local ? {} : { lookup: safeLookup as any }),
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(opts.headers || {}), 'Content-Length': data.length },
        timeout: timeoutMs,
      },
      (res: any) => {
        const status = res.statusCode || 0;
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (c: Buffer) => {
          size += c.length;
          if (size <= maxBytes) chunks.push(c); // resposta grande: só guarda o começo (o status é o que importa)
        });
        res.on('end', () => resolve({ status, body: Buffer.concat(chunks).toString('utf8').slice(0, 2000), duration_ms: Date.now() - started }));
        res.on('error', (e: any) => reject(new SafeHttpError(e?.message || 'falha de rede', e?.code || 'ENET')));
      },
    );
    const hard = setTimeout(() => req.destroy(new SafeHttpError('tempo esgotado', 'ETIMEOUT')), timeoutMs + 2_000);
    req.on('timeout', () => req.destroy(new SafeHttpError('tempo esgotado', 'ETIMEOUT')));
    req.on('close', () => clearTimeout(hard));
    req.on('error', (e: any) => reject(e instanceof SafeHttpError ? e : new SafeHttpError(e?.code === 'EBLOCKED' ? 'destino bloqueado' : e?.message || 'falha de rede', e?.code || 'ENET')));
    req.end(data);
  });
}
