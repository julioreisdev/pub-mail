import { Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, createHmac, createPrivateKey, createPublicKey, KeyObject, randomBytes, sign, timingSafeEqual } from 'crypto';

// Chaves do plugin WordPress:
//  - Ed25519: assina a resposta da verificação de licença (o plugin só confia em resposta assinada);
//  - AES-256-GCM: guarda a chave da licença de forma reversível (vai embutida em cada download);
//  - HMAC: token de curta duração para a atualização automática baixar o pacote.
// Semente: WP_PLUGIN_SIGNING_KEY (32 bytes em hex ou base64). Sem ela, deriva do JWT_ACCESS_SECRET
// (funciona, mas trocar o JWT invalidaria as assinaturas — por isso a variável dedicada).

const log = new Logger('WpPluginCrypto');
let cachedSeed: Buffer | null = null;
let cachedPriv: KeyObject | null = null;

export function seed(): Buffer {
  if (cachedSeed) return cachedSeed;
  const raw = String(process.env.WP_PLUGIN_SIGNING_KEY || '').trim();
  let s: Buffer | null = null;
  if (/^[0-9a-f]{64}$/i.test(raw)) s = Buffer.from(raw, 'hex');
  else if (raw) {
    const b = Buffer.from(raw, 'base64');
    if (b.length === 32) s = b;
  }
  if (!s) {
    const jwt = String(process.env.JWT_ACCESS_SECRET || '');
    if (!jwt) throw new Error('WP_PLUGIN_SIGNING_KEY/JWT_ACCESS_SECRET ausentes');
    log.warn('WP_PLUGIN_SIGNING_KEY não definida: usando chave derivada do JWT_ACCESS_SECRET');
    s = createHmac('sha256', jwt).update('trinv-ed25519-v1').digest();
  }
  cachedSeed = s;
  return s;
}

function privateKey(): KeyObject {
  if (cachedPriv) return cachedPriv;
  const der = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed()]);
  cachedPriv = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  return cachedPriv;
}

/** Chave pública Ed25519 (32 bytes, base64) — vai no license.php do plugin. */
export function publicKeyB64(): string {
  const spki = createPublicKey(privateKey()).export({ format: 'der', type: 'spki' }) as Buffer;
  return spki.subarray(spki.length - 32).toString('base64');
}

/** Resposta assinada: { d: base64(JSON), s: base64(assinatura de d decodificado) }. */
export function signed(payload: Record<string, unknown>) {
  const json = Buffer.from(JSON.stringify(payload), 'utf8');
  return { d: json.toString('base64'), s: sign(null, json, privateKey()).toString('base64') };
}

const encKey = () => createHash('sha256').update(seed()).update('trinv-key-enc-v1').digest();

export function encrypt(text: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', encKey(), iv);
  const ct = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}

export function decrypt(b64: string): string {
  const buf = Buffer.from(b64, 'base64');
  const d = createDecipheriv('aes-256-gcm', encKey(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
}

export const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

/**
 * Token do pacote para a atualização automática: "<licença>.<validade>.<hmac>".
 * O plugin entra no HMAC (o Tradutor, 1º plugin, continua sem sufixo — tokens antigos seguem válidos).
 */
export function packageToken(licenseId: string, plugin = 'tradutor-invisivel', ttlSeconds = 2 * 86400): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${licenseId}.${exp}.${hmacPkg(licenseId, exp, plugin)}`;
}

export function verifyPackageToken(tok: string, plugin = 'tradutor-invisivel'): string | null {
  const m = /^([0-9a-f-]{36})\.(\d{9,12})\.([0-9a-f]{32})$/.exec(String(tok || ''));
  if (!m) return null;
  if (Number(m[2]) < Math.floor(Date.now() / 1000)) return null;
  const want = hmacPkg(m[1], Number(m[2]), plugin);
  return want.length === m[3].length && timingSafeEqual(Buffer.from(want), Buffer.from(m[3])) ? m[1] : null;
}

const hmacPkg = (id: string, exp: number, plugin: string) =>
  createHmac('sha256', seed())
    .update(plugin === 'tradutor-invisivel' ? `trinv-pkg|${id}|${exp}` : `trinv-pkg|${id}|${exp}|${plugin}`)
    .digest('hex')
    .slice(0, 32);
