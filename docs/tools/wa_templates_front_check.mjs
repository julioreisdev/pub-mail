// Confere os fluxos dos modelos por ramo com a validação do CONSTRUTOR (front `botModel.validateFlow`), igual ao que o
// dono vê ao abrir o fluxo aplicado: erros (bloqueiam ativar), avisos e informações. Sem banco, sem build.
//   node docs/tools/wa_bot_overlay_dist.cjs . <scratch>/dist   (uma vez)
//   LOCAL_DIST=<scratch>/dist node docs/tools/wa_templates_e2e.mjs   (re-transpila os modelos)
//   LOCAL_DIST=<scratch>/dist node docs/tools/wa_templates_front_check.mjs
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const LOCAL = path.resolve(process.env.LOCAL_DIST || '');
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const req = createRequire(path.join(LOCAL, 'package.json'));
const { WA_TEMPLATES } = req(path.join(LOCAL, 'src/whatsapp/templates/data/index.js'));
const { categoryKey } = req(path.join(LOCAL, 'src/whatsapp/tickets/wa-ticket.util.js'));
const { normalizeCustomFieldMap } = req(path.join(LOCAL, 'src/whatsapp/wa-custom-fields.util.js'));
const model = await import(pathToFileURL(path.join(repo, 'front/vite/src/views/pages/whatsapp/bot/botModel.js')).href);

const lc = (s) => String(s ?? '').trim().toLowerCase();
const fakeId = (kind, name) => {
  const h = createHash('sha1').update(`${kind}:${lc(name)}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
function resolve(v, maps) {
  if (typeof v === 'string') {
    const m = v.match(/^@(product|tag|stage|resource|category):(.+)$/);
    if (!m) return v;
    if (m[1] === 'category') return categoryKey(m[2]);
    return maps[m[1]]?.get(lc(m[2])) || v;
  }
  if (Array.isArray(v)) return v.map((x) => resolve(x, maps));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x, maps)]));
  return v;
}

let errors = 0;
for (const t of WA_TEMPLATES) {
  const products = (t.products || []).map((p) => ({ ...p, id: fakeId('product', p.name), active: true, kind: p.kind || (p.billing && p.billing !== 'once' ? 'plan' : 'product') }));
  const maps = {
    product: new Map(products.map((p) => [lc(p.name), p.id])),
    tag: new Map((t.tags || []).map((x) => [lc(x.name), fakeId('tag', x.name)])),
    stage: new Map((t.pipeline_stages || []).map((x) => [lc(x.name), fakeId('stage', x.name)])),
    resource: new Map((t.scheduling?.resources || []).map((x) => [lc(x.name), fakeId('resource', x.name)])),
  };
  const def = resolve(t.bot.definition, maps);
  const cfMap = normalizeCustomFieldMap(t.custom_fields || {});
  const ctx = {
    settings: t.bot.settings,
    tags: (t.tags || []).map((x) => ({ id: fakeId('tag', x.name), name: x.name })),
    attendants: [],
    gateway: { ready: true },
    products,
    crmSettings: { custom_fields: cfMap.customer, custom_field_map: cfMap, identity: { require_doc: false, use_code: false } },
    customFieldMap: cfMap,
    bookServices: products.filter((p) => p.kind === 'service').map((p) => ({ id: p.id, name: p.name })),
    ticketCategories: (t.tickets?.categories || [{ key: 'duvida' }, { key: 'problema' }, { key: 'solicitacao' }]).map((c) => ({ ...c, key: categoryKey(c.key || c.label), active: true })),
    catalogCategories: [...new Set(products.filter((p) => p.kind === 'product').map((p) => p.category).filter(Boolean))],
  };
  const issues = model.validateFlow(def.nodes, def.edges, ctx);
  const by = (lv) => issues.filter((i) => i.level === lv);
  const title = (id) => def.nodes.find((n) => n.id === id)?.data?.title || id;
  errors += by('error').length;
  console.log(`\n=== ${t.key}: ${by('error').length} erro(s), ${by('warning').length} aviso(s), ${by('info').length} informação(ões)`);
  for (const i of issues) console.log(`  ${i.level.toUpperCase().padEnd(7)} [${title(i.nodeId)}] ${i.text}`);
}
console.log(`\nTotal de erros (bloqueiam ativar): ${errors}`);
process.exit(errors ? 1 : 0);
