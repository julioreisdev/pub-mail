import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { promises as fsp } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';

// =============================================================================
// Criptografia EM REPOUSO das mensagens e mídias do WhatsApp.
//
//  • Chave MESTRA (KEK) no servidor: env WHATSAPP_DATA_KEYS = "1:<base64 32 bytes>[,2:<…>]".
//    A de maior id cifra as chaves novas; as antigas continuam abrindo o que já existe.
//  • Uma chave por ORGANIZAÇÃO (DEK, 32 bytes aleatórios) na tabela whatsapp_data_keys,
//    guardada cifrada pela mestra. Apagar a linha = os dados daquela org ficam ilegíveis,
//    inclusive em backups antigos ("crypto-shredding").
//  • Texto: "wenc1:<dekId>:<base64url(iv12 | tag16 | cifrado)>" — AES-256-GCM.
//  • Arquivo: cabeçalho "PMWAE001" + dekId + prefixo de nonce, depois blocos de 64 KiB
//    com AES-256-GCM (construção STREAM: nonce = prefixo | nº do bloco | flag de último).
//    Dá para ler QUALQUER trecho (Range do <audio>/<video>) decifrando só os blocos dele.
//  • Tudo é autodescritivo: texto/arquivo sem o prefixo é dado antigo em claro e passa direto.
//  • Sem WHATSAPP_DATA_KEYS (ambiente local) a gravação fica em claro e nada quebra.
// =============================================================================

export const TEXT_PREFIX = 'wenc1:';
export const FILE_MAGIC = Buffer.from('PMWAE001', 'ascii');
export const CHUNK = 64 * 1024;
const TAG = 16;
const ALGO = 'aes-256-gcm';
export const UNREADABLE = '[conteúdo criptografado indisponível]';

type Dek = { id: string; key: Buffer };
type KeyRow = { id: string; organization_id: string; master_key_id: string; wrapped_key: string };

/** Acesso mínimo ao banco que o chaveiro precisa (o PrismaClient base satisfaz). */
export interface KeyStore {
  whatsapp_data_keys: {
    findUnique(args: any): Promise<KeyRow | null>;
    findFirst(args: any): Promise<KeyRow | null>;
    findMany(args: any): Promise<KeyRow[]>;
    create(args: any): Promise<KeyRow>;
  };
}

function parseMasterKeys(raw: string | undefined): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  for (const part of String(raw || '').split(',')) {
    const i = part.indexOf(':');
    if (i <= 0) continue;
    const id = part.slice(0, i).trim();
    const key = Buffer.from(part.slice(i + 1).trim(), 'base64');
    if (!/^\d{1,4}$/.test(id) || key.length !== 32) throw new Error(`WHATSAPP_DATA_KEYS: chave "${id}" inválida (precisa ser base64 de 32 bytes)`);
    out.set(id, key);
  }
  return out;
}

function seal(key: Buffer, plain: Buffer) {
  const iv = randomBytes(12);
  const c = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]);
}
function open(key: Buffer, box: Buffer) {
  if (box.length < 28) throw new Error('cifrado curto');
  const d = createDecipheriv(ALGO, key, box.subarray(0, 12));
  d.setAuthTag(box.subarray(12, 28));
  return Buffer.concat([d.update(box.subarray(28)), d.final()]);
}

export class WaKeyring {
  private readonly masters: Map<string, Buffer>;
  private readonly newest: string | null;
  private readonly byId = new Map<string, Dek>();
  private readonly byOrg = new Map<string, Dek>();
  private readonly creating = new Map<string, Promise<Dek>>();
  private readonly missing = new Set<string>(); // dekIds que não existem mais (org apagada)

  constructor(private readonly store: KeyStore, rawMasters = process.env.WHATSAPP_DATA_KEYS) {
    this.masters = parseMasterKeys(rawMasters);
    const ids = [...this.masters.keys()].sort((a, b) => Number(b) - Number(a));
    this.newest = ids[0] || null;
  }

  /** Criptografia ligada? (sem chave mestra = grava em claro) */
  get enabled() {
    return Boolean(this.newest);
  }

  private unwrap(row: KeyRow): Dek {
    const kek = this.masters.get(row.master_key_id);
    if (!kek) throw new Error(`chave mestra ${row.master_key_id} ausente em WHATSAPP_DATA_KEYS`);
    const dek = { id: row.id, key: open(kek, Buffer.from(row.wrapped_key, 'base64')) };
    if (dek.key.length !== 32) throw new Error('chave da organização corrompida');
    this.byId.set(dek.id, dek);
    this.byOrg.set(row.organization_id, dek);
    return dek;
  }

  /** Chave da organização para CIFRAR (cria na 1ª vez). */
  async dekForOrg(orgId: string): Promise<Dek> {
    const hit = this.byOrg.get(orgId);
    if (hit) return hit;
    const run = this.creating.get(orgId);
    if (run) return run;
    const p = (async () => {
      const row = await this.store.whatsapp_data_keys.findFirst({ where: { organization_id: orgId } });
      if (row) return this.unwrap(row);
      const kek = this.masters.get(this.newest!)!;
      const key = randomBytes(32);
      const id = randomBytes(6).toString('hex');
      try {
        const created = await this.store.whatsapp_data_keys.create({
          data: { id, organization_id: orgId, master_key_id: this.newest!, wrapped_key: seal(kek, key).toString('base64') },
        });
        return this.unwrap(created);
      } catch (e: any) {
        // outra requisição criou ao mesmo tempo (unique por organização): usa a dela
        const again = await this.store.whatsapp_data_keys.findFirst({ where: { organization_id: orgId } });
        if (again) return this.unwrap(again);
        throw e;
      }
    })().finally(() => this.creating.delete(orgId));
    this.creating.set(orgId, p);
    return p;
  }

  /** Carrega de uma vez as chaves (por dekId) que ainda não estão em memória. */
  async preload(dekIds: Iterable<string>) {
    const need = [...new Set(dekIds)].filter((id) => !this.byId.has(id) && !this.missing.has(id));
    if (!need.length) return;
    const rows = await this.store.whatsapp_data_keys.findMany({ where: { id: { in: need } } });
    for (const r of rows) {
      try {
        this.unwrap(r);
      } catch {
        this.missing.add(r.id);
      }
    }
    for (const id of need) if (!this.byId.has(id)) this.missing.add(id);
  }

  // ------------------------------------------------------------------ texto
  static isEncryptedText(v: unknown): v is string {
    return typeof v === 'string' && v.startsWith(TEXT_PREFIX);
  }
  static dekIdOfText(v: string) {
    const i = v.indexOf(':', TEXT_PREFIX.length);
    return i > 0 ? v.slice(TEXT_PREFIX.length, i) : '';
  }

  async encryptText(orgId: string, plain: string): Promise<string> {
    if (!this.enabled || plain == null || plain === '' || WaKeyring.isEncryptedText(plain)) return plain;
    const dek = await this.dekForOrg(orgId);
    const out = `${TEXT_PREFIX}${dek.id}:${seal(dek.key, Buffer.from(plain, 'utf8')).toString('base64url')}`;
    // confere antes de gravar: nunca troca um texto por algo que não volta igual
    if (this.decryptTextSync(out) !== plain) throw new Error('falha ao conferir a criptografia');
    return out;
  }

  /** Decifra com as chaves já carregadas (use preload antes). Texto em claro passa direto. */
  decryptTextSync(v: string): string {
    if (!WaKeyring.isEncryptedText(v)) return v;
    const id = WaKeyring.dekIdOfText(v);
    const dek = this.byId.get(id);
    if (!dek) return UNREADABLE;
    try {
      return open(dek.key, Buffer.from(v.slice(TEXT_PREFIX.length + id.length + 1), 'base64url')).toString('utf8');
    } catch {
      return UNREADABLE;
    }
  }

  // ------------------------------------------------------------------ arquivo
  /** Cifra um buffer inteiro no formato de arquivo (blocos de 64 KiB). */
  async encryptFile(orgId: string, plain: Buffer): Promise<Buffer> {
    if (!this.enabled) return plain;
    const dek = await this.dekForOrg(orgId);
    const idBuf = Buffer.from(dek.id, 'ascii');
    const prefix = randomBytes(7);
    const parts: Buffer[] = [FILE_MAGIC, Buffer.from([idBuf.length]), idBuf, prefix];
    const n = Math.max(1, Math.ceil(plain.length / CHUNK));
    for (let i = 0; i < n; i++) {
      const c = createCipheriv(ALGO, dek.key, chunkNonce(prefix, i, i === n - 1));
      parts.push(c.update(plain.subarray(i * CHUNK, (i + 1) * CHUNK)), c.final(), c.getAuthTag());
    }
    const out = Buffer.concat(parts);
    const back = await this.decryptFileBuffer(out);
    if (back.length !== plain.length || !back.equals(plain)) throw new Error('falha ao conferir a criptografia do arquivo');
    return out;
  }

  /** Lê o cabeçalho; null = arquivo em claro (antigo). */
  static parseHeader(head: Buffer): { dekId: string; prefix: Buffer; headerLen: number } | null {
    if (head.length < FILE_MAGIC.length + 1 || !head.subarray(0, FILE_MAGIC.length).equals(FILE_MAGIC)) return null;
    const len = head[FILE_MAGIC.length];
    const headerLen = FILE_MAGIC.length + 1 + len + 7;
    if (head.length < headerLen) return null;
    return {
      dekId: head.subarray(FILE_MAGIC.length + 1, FILE_MAGIC.length + 1 + len).toString('ascii'),
      prefix: head.subarray(headerLen - 7, headerLen),
      headerLen,
    };
  }

  static plainSize(fileSize: number, headerLen: number) {
    const body = fileSize - headerLen;
    const full = Math.floor(body / (CHUNK + TAG));
    const rem = body % (CHUNK + TAG);
    return { size: full * CHUNK + (rem > 0 ? rem - TAG : 0), chunks: full + (rem > 0 ? 1 : 0) };
  }

  async decryptFileBuffer(buf: Buffer): Promise<Buffer> {
    const h = WaKeyring.parseHeader(buf.subarray(0, 64));
    if (!h) return buf;
    await this.preload([h.dekId]);
    const dek = this.byId.get(h.dekId);
    if (!dek) throw new Error('chave da mídia indisponível');
    const { chunks } = WaKeyring.plainSize(buf.length, h.headerLen);
    const out: Buffer[] = [];
    for (let i = 0; i < chunks; i++) {
      const start = h.headerLen + i * (CHUNK + TAG);
      const end = Math.min(buf.length, start + CHUNK + TAG);
      out.push(openChunk(dek.key, h.prefix, i, i === chunks - 1, buf.subarray(start, end)));
    }
    return Buffer.concat(out);
  }

  /**
   * Abre um arquivo para leitura por trechos. Devolve null se o arquivo está em claro.
   * read(a, b) devolve os bytes [a, b] (inclusive) do conteúdo original.
   */
  async openFile(path: string): Promise<null | { size: number; read: (a: number, b: number) => AsyncGenerator<Buffer>; close: () => Promise<void> }> {
    const fh: FileHandle = await fsp.open(path, 'r');
    try {
      const head = Buffer.alloc(64);
      const { bytesRead } = await fh.read(head, 0, 64, 0);
      const h = WaKeyring.parseHeader(head.subarray(0, bytesRead));
      if (!h) {
        await fh.close();
        return null;
      }
      await this.preload([h.dekId]);
      const dek = this.byId.get(h.dekId);
      if (!dek) throw new Error('chave da mídia indisponível');
      const st = await fh.stat();
      const { size, chunks } = WaKeyring.plainSize(st.size, h.headerLen);
      async function* read(a: number, b: number) {
        if (size === 0 || a > b) return;
        const first = Math.floor(a / CHUNK);
        const last = Math.floor(b / CHUNK);
        const buf = Buffer.alloc(CHUNK + TAG);
        for (let i = first; i <= last; i++) {
          const pos = h!.headerLen + i * (CHUNK + TAG);
          const { bytesRead: n } = await fh.read(buf, 0, CHUNK + TAG, pos);
          const plain = openChunk(dek!.key, h!.prefix, i, i === chunks - 1, buf.subarray(0, n));
          const from = i === first ? a - i * CHUNK : 0;
          const to = i === last ? b - i * CHUNK + 1 : plain.length;
          yield plain.subarray(from, to);
        }
      }
      return { size, read, close: () => fh.close() };
    } catch (e) {
      await fh.close().catch(() => undefined);
      throw e;
    }
  }
}

function chunkNonce(prefix: Buffer, index: number, last: boolean) {
  const n = Buffer.alloc(12);
  prefix.copy(n, 0, 0, 7);
  n.writeUInt32BE(index >>> 0, 7);
  n[11] = last ? 1 : 0;
  return n;
}
function openChunk(key: Buffer, prefix: Buffer, index: number, last: boolean, data: Buffer) {
  if (data.length < TAG) throw new Error('bloco truncado');
  const d = createDecipheriv(ALGO, key, chunkNonce(prefix, index, last));
  d.setAuthTag(data.subarray(data.length - TAG));
  return Buffer.concat([d.update(data.subarray(0, data.length - TAG)), d.final()]);
}

// ------------------------------------------------------------------ campos por tabela
/** Campos de texto cifrados por tabela + chaves do JSON `extra` que vão cifradas. */
export const ENCRYPTED_FIELDS: Record<string, string[]> = {
  whatsapp_messages: ['body', 'quoted_preview'],
  whatsapp_chats: ['last_message_preview'],
  whatsapp_contact_statuses: ['caption'],
  whatsapp_customers: ['doc'], // CPF/CNPJ (a busca usa a coluna doc_hash)
  whatsapp_payment_methods: ['provider_token'], // token do cartão no gateway (Fase 4) — nunca em claro no banco
  org_webhooks: ['secret'], // segredo que assina os webhooks de saída (Fase 5)
  org_webhook_deliveries: ['payload'], // corpo da entrega (dados do cliente) — Fase 5
  whatsapp_tickets: ['description'], // relato do cliente no chamado — Fase 6B
  whatsapp_ticket_events: ['body'], // comentários/mensagens do chamado — Fase 6B (criar SEMPRE direto, nunca aninhado no ticket)
};
export const EXTRA_SECRET_KEYS = ['contact', 'location', 'poll', 'mention_names', 'button', 'buttons'];
export const EXTRA_ENC_KEY = '_wenc';

let singleton: WaKeyring | null = null;
export function setWaKeyring(k: WaKeyring) {
  singleton = k;
}
/** O chaveiro criado pelo PrismaService (único no processo). */
export function waKeyring(): WaKeyring {
  if (!singleton) throw new Error('chaveiro do WhatsApp ainda não iniciado');
  return singleton;
}
