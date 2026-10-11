// POST JSON para um SITE DE CLIENTE (o "Sincronizar agora" do Push In Play pede o resumo ao WordPress).
// O endereço vem do que o plugin informou no check (controlado pelo cliente), então vale o mesmo
// cuidado anti-SSRF da prévia de links: só https na porta 443, nome de host (não IP literal), destino
// conferido NA CONEXÃO (lookup próprio recusa loopback/rede privada/link-local/CGNAT/multicast, IPv4 e
// IPv6 mapeado), sem redirecionamento, tempo e tamanho limitados. O corpo só leva um token.
import * as https from 'node:https';
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
    a >= 224
  );
}

export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return ipv4Private(ip);
  if (v !== 6) return true;
  const s = ip.toLowerCase();
  if (s === '::' || s === '::1') return true;
  if (s.startsWith('::ffff:')) {
    const m = s.slice(7);
    return isIP(m) === 4 ? ipv4Private(m) : true;
  }
  return /^(fc|fd|fe[89ab]|ff)/.test(s);
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
