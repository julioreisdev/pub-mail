import { ENCRYPTED_FIELDS, EXTRA_ENC_KEY, EXTRA_SECRET_KEYS, TEXT_PREFIX, WaKeyring } from './wa-keyring';

// =============================================================================
// Extensão do Prisma que cifra/decifra as mensagens do WhatsApp em UM lugar só:
// todo create/update/upsert de whatsapp_messages, whatsapp_chats, whatsapp_contact_statuses, whatsapp_customers (doc), whatsapp_payment_methods (token do cartão), org_webhooks (segredo), org_webhook_deliveries (corpo), whatsapp_tickets (descrição) e whatsapp_ticket_events (comentários)
// passa pelos campos de ENCRYPTED_FIELDS (e pelas chaves sensíveis do JSON `extra`) antes de
// ir ao banco, e todo resultado volta decifrado. Os serviços continuam lendo e gravando texto
// normal — nenhum deles precisa saber que existe criptografia.
// Nenhuma consulta filtra por esses campos (conferido em 08/10/2026); se um dia precisar,
// o filtro terá de ser feito em memória, depois de ler.
// =============================================================================

const WRITE_OPS = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert']);

const isPlainObject = (v: any) => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

function findOrgInWhere(where: any, depth = 0): string | null {
  if (!where || typeof where !== 'object' || depth > 3) return null;
  if (typeof where.organization_id === 'string') return where.organization_id;
  for (const v of Object.values(where)) {
    if (isPlainObject(v)) {
      const hit = findOrgInWhere(v, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

function hasSecret(model: string, data: any): boolean {
  if (!isPlainObject(data)) return false;
  for (const f of ENCRYPTED_FIELDS[model] || []) {
    const v = data[f];
    if ((typeof v === 'string' && v && !v.startsWith(TEXT_PREFIX)) || (isPlainObject(v) && typeof v.set === 'string' && v.set)) return true;
  }
  if (model === 'whatsapp_messages' && isPlainObject(data.extra)) return EXTRA_SECRET_KEYS.some((k) => data.extra[k] != null);
  return false;
}

async function encryptData(kr: WaKeyring, model: string, data: any, orgId: string) {
  if (!isPlainObject(data)) return;
  for (const f of ENCRYPTED_FIELDS[model] || []) {
    const v = data[f];
    if (typeof v === 'string') data[f] = await kr.encryptText(orgId, v);
    else if (isPlainObject(v) && typeof v.set === 'string') v.set = await kr.encryptText(orgId, v.set);
  }
  if (model === 'whatsapp_messages' && isPlainObject(data.extra)) {
    const extra = { ...data.extra };
    const secret: Record<string, unknown> = {};
    for (const k of EXTRA_SECRET_KEYS) {
      if (extra[k] != null) secret[k] = extra[k];
      delete extra[k];
    }
    if (Object.keys(secret).length) extra[EXTRA_ENC_KEY] = await kr.encryptText(orgId, JSON.stringify(secret));
    data.extra = extra;
  }
}

// Cifra numa CÓPIA dos dados: o objeto que o serviço montou continua com o texto normal
// (vários serviços reaproveitam o mesmo objeto depois de gravar).
const cloneData = (d: any) => {
  if (!isPlainObject(d)) return d;
  const c = { ...d };
  for (const [k, v] of Object.entries(c)) if (isPlainObject(v)) c[k] = { ...(v as any) };
  return c;
};

async function encryptArgs(kr: WaKeyring, base: any, model: string, operation: string, args: any) {
  const items: any[] = [];
  if (operation === 'upsert') {
    args.create = cloneData(args.create);
    args.update = cloneData(args.update);
    items.push(args.create, args.update);
  } else if (Array.isArray(args.data)) {
    args.data = args.data.map(cloneData);
    items.push(...args.data);
  } else {
    args.data = cloneData(args.data);
    items.push(args.data);
  }
  if (!items.some((d) => hasSecret(model, d))) return;
  for (const d of items) {
    if (!hasSecret(model, d)) continue;
    let org: string | null = typeof d.organization_id === 'string' ? d.organization_id : findOrgInWhere(args.where) || (operation === 'upsert' && typeof args.create?.organization_id === 'string' ? args.create.organization_id : null);
    if (!org && args.where) {
      const row = await base[model].findFirst({ where: args.where, select: { organization_id: true } });
      org = row?.organization_id || null;
    }
    if (!org) throw new Error(`criptografia: não deu para descobrir a organização ao gravar ${model}`);
    await encryptData(kr, model, d, org);
  }
}

// ---------------------------------------------------------------- leitura
function collect(v: any, ids: Set<string>) {
  if (typeof v === 'string') {
    if (v.startsWith(TEXT_PREFIX)) ids.add(WaKeyring.dekIdOfText(v));
  } else if (Array.isArray(v)) {
    for (const x of v) collect(x, ids);
  } else if (isPlainObject(v)) {
    for (const x of Object.values(v)) collect(x, ids);
  }
}
function apply(kr: WaKeyring, v: any): any {
  if (typeof v === 'string') return v.startsWith(TEXT_PREFIX) ? kr.decryptTextSync(v) : v;
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) v[i] = apply(kr, v[i]);
    return v;
  }
  if (isPlainObject(v)) {
    for (const k of Object.keys(v)) {
      if (k === EXTRA_ENC_KEY && typeof v[k] === 'string') {
        const raw = kr.decryptTextSync(v[k]);
        delete v[k];
        try {
          const secret = JSON.parse(raw);
          if (isPlainObject(secret)) for (const [sk, sv] of Object.entries(secret)) if (v[sk] == null) v[sk] = sv;
        } catch {
          /* chave indisponível: as chaves sensíveis somem, o resto do extra continua */
        }
        continue;
      }
      v[k] = apply(kr, v[k]);
    }
    return v;
  }
  return v;
}

export async function decryptDeep<T>(kr: WaKeyring, result: T): Promise<T> {
  if (result == null || typeof result !== 'object') return result;
  const ids = new Set<string>();
  collect(result, ids);
  if (!ids.size) return result;
  await kr.preload(ids);
  return apply(kr, result);
}

/** Argumento para `client.$extends(...)`. `base` = o client SEM a extensão (para achar a org de um update). */
export function waCryptoExtension(kr: WaKeyring, base: any) {
  const handler = (model: string) =>
    async function ({ operation, args, query }: { operation: string; args: any; query: (a: any) => Promise<any> }) {
      let a = args;
      if (kr.enabled && WRITE_OPS.has(operation) && args) {
        a = { ...args };
        await encryptArgs(kr, base, model, operation, a);
      }
      return decryptDeep(kr, await query(a));
    };
  return {
    name: 'whatsapp-at-rest-encryption',
    query: {
      whatsapp_messages: { $allOperations: handler('whatsapp_messages') },
      whatsapp_chats: { $allOperations: handler('whatsapp_chats') },
      whatsapp_contact_statuses: { $allOperations: handler('whatsapp_contact_statuses') },
      whatsapp_customers: { $allOperations: handler('whatsapp_customers') },
      whatsapp_payment_methods: { $allOperations: handler('whatsapp_payment_methods') },
      org_webhooks: { $allOperations: handler('org_webhooks') }, // Fase 5: segredo do webhook de saída
      org_webhook_deliveries: { $allOperations: handler('org_webhook_deliveries') }, // Fase 5: corpo da entrega
      whatsapp_tickets: { $allOperations: handler('whatsapp_tickets') }, // Fase 6B: descrição do chamado
      whatsapp_ticket_events: { $allOperations: handler('whatsapp_ticket_events') }, // Fase 6B: comentários
    },
  };
}
