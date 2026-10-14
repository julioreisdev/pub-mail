// E2E da Fase 7 — modelos por ramo (contrato docs/whatsapp-assinaturas-contrato.md §11.6).
//
// NO SERVIDOR (127.0.0.1:8000; uma org temporária POR MODELO, criada por /admin/clients e apagada no fim):
//   scp docs/tools/wa_templates_e2e.mjs pubmail-hostinger:/opt/pub-mail/back/wa_templates_e2e.tmp.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && node wa_templates_e2e.tmp.mjs; rm -f wa_templates_e2e.tmp.mjs'
//   (ONLY=clinica,vip para rodar só alguns)
// Para cada modelo: GET /whatsapp/templates/:key → POST …/apply (contagens, sem erros, fluxo criado DESLIGADO, sem
// marcador sobrando, fluxo válido pelo motor do `dist`) → 2ª aplicação não cria nada novo (só o fluxo com a data no
// nome e a configuração de pedidos, que é regravada) → cenários no simulador (`flow_id` + `crm_fixture` do modelo,
// marcadores da fixture trocados pelos ids reais) → apaga a org e confere a limpeza.
//
// LOCAL, sem banco nem build (valida as definições e roda os cenários com o simulador do back em memória):
//   node docs/tools/wa_bot_overlay_dist.cjs . <scratch>/dist     (uma vez; copia back/dist + transpila back/src)
//   LOCAL_DIST=<scratch>/dist node docs/tools/wa_templates_e2e.mjs
// O modo local re-transpila só back/src/whatsapp/templates (rápido) e troca os marcadores por ids falsos.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCAL = process.env.LOCAL_DIST ? path.resolve(process.env.LOCAL_DIST) : '';
const ONLY = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const VERBOSE = process.env.VERBOSE === '1';
let fails = 0;
let total = 0;
const ok = (l, c, x) => {
  total++;
  if (!c) fails++;
  console.log((c ? 'PASS ' : 'FAIL ') + l + (c || x === undefined ? '' : '  → ' + JSON.stringify(x).slice(0, 700)));
};
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const lc = (s) => String(s ?? '').trim().toLowerCase();
const PARTS_SKIP_ON_REAPPLY = new Set(['bot', 'orders']); // fluxo novo com a data no nome; pedidos = configuração regravada

// ---------------------------------------------------------------- marcadores
/** Mesma regra do `WhatsAppTemplatesService.resolve`: string inteira `@tipo:nome` → id. */
function resolveMarkers(v, maps, missing, categoryKey) {
  if (typeof v === 'string') {
    const m = v.match(/^@(product|tag|stage|resource|category):(.+)$/);
    if (!m) return v;
    if (m[1] === 'category') return categoryKey(m[2]);
    const id = maps[m[1]]?.get(lc(m[2]));
    if (!id) { missing.add(v); return v; }
    return id;
  }
  if (Array.isArray(v)) return v.map((x) => resolveMarkers(x, maps, missing, categoryKey));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveMarkers(x, maps, missing, categoryKey)]));
  return v;
}
const markersIn = (v) => [...new Set((JSON.stringify(v ?? null).match(/"@(product|tag|stage|resource|category):[^"]+"/g) || []).map((s) => s.slice(1, -1)))];

// ---------------------------------------------------------------- cenários (mesmo código nos dois modos)
const textsOf = (r) => (r?.j?.actions || []).filter((a) => a.type === 'send').map((a) => a.message?.text || '');
const tagsOf = (r) => (r?.j?.actions || []).filter((a) => a.type === 'tags').flatMap((a) => (a.add || []).map((t) => t?.name || t));
function checkExpect(label, exp, blobTexts, tags, rs, last) {
  if (!exp) return;
  const blob = norm(blobTexts.join('\n'));
  for (const c of exp.contains || []) ok(`${label}: contém “${c}”`, blob.includes(norm(c)), blob.slice(-900));
  for (const c of exp.not_contains || []) ok(`${label}: não contém “${c}”`, !blob.includes(norm(c)), blob.slice(-900));
  for (const t of exp.tags || []) ok(`${label}: etiqueta “${t}”`, tags.includes(t), tags);
  if (exp.charge !== undefined) ok(`${label}: cobrança ${exp.charge ? 'gerada' : 'não gerada'}`, rs.some((r) => (r.j?.actions || []).some((a) => a.type === 'charge')) === exp.charge);
  if (exp.handoff !== undefined) ok(`${label}: atendente ${exp.handoff ? 'chamado' : 'não chamado'}`, rs.some((r) => (r.j?.actions || []).some((a) => a.type === 'handoff')) === exp.handoff);
  if (exp.ended !== undefined) ok(`${label}: terminou=${exp.ended}`, Boolean(last?.j?.ended) === exp.ended, { ended: last?.j?.ended, status: last?.j?.state?.status });
  if (exp.waiting_for !== undefined) ok(`${label}: aguarda ${exp.waiting_for}`, (last?.j?.state?.waiting_for ?? null) === exp.waiting_for, last?.j?.state?.waiting_for);
}
async function runScenario(sim, tpl, sc, base) {
  let state = null;
  const all = [];
  const allTags = [];
  const rs = [];
  let last = null;
  for (const [i, st] of sc.steps.entries()) {
    const body = { ...base, ...(state ? { state } : {}) };
    if ('send' in st) body.input = st.send;
    else if ('media' in st) {
      body.input = st.text || '';
      body.state = { ...(state || {}), __sim_media: { kind: st.media, filename: st.media === 'image' ? 'foto.jpg' : 'documento.pdf' } };
    } else if ('event' in st) body.event = st.event;
    const r = await sim(body);
    if (r.s !== 200 && r.s !== 201) {
      ok(`[${tpl.key}] ${sc.name} — passo ${i + 1} respondeu`, false, r.j);
      return;
    }
    state = r.j.state;
    last = r;
    rs.push(r);
    const t = textsOf(r);
    all.push(...t);
    allTags.push(...tagsOf(r));
    if (VERBOSE) console.log(`   [${'send' in st ? st.send : 'media' in st ? `<${st.media}>` : st.event}] → ${t.map((x) => norm(x).slice(0, 140)).join(' ⏎ ')} {${r.j.state.status}/${r.j.state.waiting_for || '-'}}`);
    checkExpect(`[${tpl.key}] ${sc.name} — passo ${i + 1}`, st.expect, t, tagsOf(r), [r], r);
  }
  checkExpect(`[${tpl.key}] ${sc.name}`, sc.expect, all, allTags, rs, last);
}

// ================================================================ LOCAL
async function runLocal() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repo = path.resolve(here, '..', '..');
  const back = path.join(repo, 'back');
  // re-transpila só os modelos (o resto vem do overlay)
  const ts = createRequire(path.join(back, 'package.json'))('typescript');
  const opts = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true };
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((f) => (f.isDirectory() ? walk(path.join(d, f.name)) : f.name.endsWith('.ts') ? [path.join(d, f.name)] : []));
  for (const f of walk(path.join(back, 'src/whatsapp/templates'))) {
    const dst = path.join(LOCAL, path.relative(back, f)).replace(/\.ts$/, '.js');
    mkdirSync(path.dirname(dst), { recursive: true });
    writeFileSync(dst, ts.transpileModule(readFileSync(f, 'utf8'), { compilerOptions: opts, fileName: f }).outputText);
  }
  const req = createRequire(path.join(LOCAL, 'package.json'));
  const { WA_TEMPLATES } = req(path.join(LOCAL, 'src/whatsapp/templates/data/index.js'));
  const engine = req(path.join(LOCAL, 'src/whatsapp/bot/wa-bot.engine.js'));
  const { categoryKey, normalizeTicketSettings } = req(path.join(LOCAL, 'src/whatsapp/tickets/wa-ticket.util.js'));
  const { normalizeBooking, normalizeAvailability } = req(path.join(LOCAL, 'src/whatsapp/scheduling/wa-schedule.util.js'));
  const { normalizeOrderSettings } = req(path.join(LOCAL, 'src/whatsapp/orders/wa-order.util.js'));
  const { normalizeCustomFieldMap, cfKey } = req(path.join(LOCAL, 'src/whatsapp/wa-custom-fields.util.js'));
  const { WhatsAppBotService } = req(path.join(LOCAL, 'src/whatsapp/bot/whatsapp-bot.service.js'));

  const fakeId = (kind, name) => {
    const h = createHash('sha1').update(`${kind}:${lc(name)}`).digest('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
  };
  const templates = WA_TEMPLATES.filter((t) => !ONLY.length || ONLY.includes(t.key));
  ok(`registro: ${WA_TEMPLATES.length} modelos (${WA_TEMPLATES.map((t) => t.key).join(', ')})`, WA_TEMPLATES.length === 7, WA_TEMPLATES.map((t) => t.key));
  ok('chaves únicas', new Set(WA_TEMPLATES.map((t) => t.key)).size === WA_TEMPLATES.length);

  for (const tpl of templates) {
    console.log(`\n=== ${tpl.key} — ${tpl.name}`);
    // ---- payloads (o que a aplicação manda para cada serviço)
    ok(`[${tpl.key}] nome/descrição/ícone/destaques`, tpl.name && tpl.description && tpl.icon && tpl.highlights?.length >= 3 && tpl.highlights.length <= 5, { icon: tpl.icon, h: tpl.highlights?.length });
    const products = tpl.products || [];
    const pnames = products.map((p) => lc(p.name));
    ok(`[${tpl.key}] produtos com nome único (≤120)`, new Set(pnames).size === pnames.length && products.every((p) => p.name && p.name.length <= 120), pnames);
    const BILL = ['once', 'monthly', 'quarterly', 'semiannual', 'yearly'];
    for (const p of products) {
      const bad = [];
      if (p.kind && !['product', 'plan', 'service'].includes(p.kind)) bad.push('kind');
      if (p.billing && !BILL.includes(p.billing)) bad.push('billing');
      if (p.kind === 'service' && !(p.duration_minutes >= 5 && p.duration_minutes <= 720)) bad.push('duração');
      if (p.kind === 'service' && p.billing && p.billing !== 'once') bad.push('serviço recorrente');
      if (p.kind === 'plan' && (!p.billing || p.billing === 'once')) bad.push('plano sem recorrência');
      if (!(Number.isInteger(p.price_cents) && p.price_cents >= 0)) bad.push('preço');
      if (p.booking && JSON.stringify(normalizeBooking(p.booking).payment) !== JSON.stringify(p.booking.payment || 'on_site')) bad.push('booking.payment');
      for (const x of p.included_in_plans || []) {
        const pn = String(x.plan_id || '').replace(/^@product:/, '');
        const plan = products.find((q) => lc(q.name) === lc(pn));
        if (!plan || !plan.billing || plan.billing === 'once') bad.push(`incluso em "${pn}" (não é plano)`);
        if (!(x.uses_per_cycle >= 1 && x.uses_per_cycle <= 100)) bad.push('usos por ciclo');
      }
      if (p.custom) for (const k of Object.keys(p.custom)) if (!(tpl.custom_fields?.product || []).some((f) => cfKey(f.key || f.label) === k)) bad.push(`custom.${k} sem definição`);
      ok(`[${tpl.key}] produto “${p.name}”`, !bad.length, bad);
    }
    const cfIn = tpl.custom_fields || {};
    const cfOut = normalizeCustomFieldMap(cfIn);
    for (const [ent, defs] of Object.entries(cfIn)) ok(`[${tpl.key}] campos de ${ent}: ${defs.length} válidos`, (cfOut[ent] || []).length === defs.length, { in: defs.map((d) => d.key), out: (cfOut[ent] || []).map((d) => d.key) });
    const tagNames = (tpl.tags || []).map((t) => lc(t.name));
    ok(`[${tpl.key}] etiquetas únicas, ≤40, não reservadas`, new Set(tagNames).size === tagNames.length && (tpl.tags || []).every((t) => t.name.length <= 40 && !['bot', 'aguardando', 'encerrado', 'celular'].includes(lc(t.name)) && (!t.color || /^#[0-9a-f]{6}$/i.test(t.color))), tagNames);
    const stg = tpl.pipeline_stages || [];
    ok(`[${tpl.key}] etapas do funil (≤10, sem colidir com as padrão)`, stg.length <= 10 && stg.every((s) => !['novo', 'em contato', 'proposta', 'fechado', 'perdido'].includes(lc(s.name)) && ['open', 'won', 'lost', undefined].includes(s.kind)), stg.map((s) => s.name));
    if (tpl.tickets) {
      const ts2 = normalizeTicketSettings({ ...(tpl.tickets.settings || {}), categories: tpl.tickets.categories || [] });
      ok(`[${tpl.key}] categorias de chamado válidas (${(tpl.tickets.categories || []).length})`, ts2.categories.length === (tpl.tickets.categories || []).length, ts2.categories.map((c) => c.key));
      if (tpl.tickets.settings?.prefix) ok(`[${tpl.key}] prefixo do protocolo`, ts2.prefix === tpl.tickets.settings.prefix, ts2.prefix);
    }
    for (const r of tpl.scheduling?.resources || []) {
      const av = normalizeAvailability(r.availability);
      const days = Object.values(av.weekly).filter((l) => l.length).length;
      const unknown = (r.services || []).filter((n) => !products.some((p) => p.kind === 'service' && lc(p.name) === lc(String(n).replace(/^@product:/, ''))));
      ok(`[${tpl.key}] recurso “${r.name}” (${days} dias na semana, serviços conhecidos)`, days > 0 && !unknown.length && (!r.kind || ['person', 'room', 'bay', 'equipment', 'other'].includes(r.kind)), { days, unknown });
    }
    if (tpl.orders?.settings) {
      const os = normalizeOrderSettings(tpl.orders.settings);
      ok(`[${tpl.key}] configuração de pedidos`, os.enabled && os.payment_methods.length >= 1, os);
      ok(`[${tpl.key}] catálogo: produtos avulsos com categoria`, products.filter((p) => (p.kind || (p.billing && p.billing !== 'once' ? 'plan' : 'product')) === 'product').every((p) => p.category), products.filter((p) => !p.category).map((p) => p.name));
    }

    // ---- fluxo: marcadores conhecidos + validação do motor
    const maps = {
      product: new Map(products.map((p) => [lc(p.name), fakeId('product', p.name)])),
      tag: new Map((tpl.tags || []).map((t) => [lc(t.name), fakeId('tag', t.name)])),
      stage: new Map(stg.map((s) => [lc(s.name), fakeId('stage', s.name)])),
      resource: new Map((tpl.scheduling?.resources || []).map((r) => [lc(r.name), fakeId('resource', r.name)])),
    };
    const missing = new Set();
    const def = resolveMarkers(tpl.bot.definition, maps, missing, categoryKey);
    ok(`[${tpl.key}] fluxo: todos os marcadores existem no modelo`, !missing.size, [...missing]);
    const catKeys = new Set((tpl.tickets?.categories || []).map((c) => categoryKey(c.key || c.label)));
    const catRefs = markersIn(tpl.bot.definition).filter((m) => m.startsWith('@category:')).map((m) => categoryKey(m.slice(10)));
    ok(`[${tpl.key}] fluxo: categorias de chamado existem`, catRefs.every((k) => catKeys.has(k)), catRefs);
    const errs = engine.validateDefinition(def);
    ok(`[${tpl.key}] fluxo válido pelo motor (${def.nodes.length} blocos, ${def.edges.length} ligações)`, !errs.length, errs);
    const ids = new Set(def.nodes.map((n) => n.id));
    ok(`[${tpl.key}] fluxo: ids únicos`, ids.size === def.nodes.length);
    const reach = new Set(['start']);
    for (let changed = true; changed; ) { changed = false; for (const e of def.edges) if (reach.has(e.source) && !reach.has(e.target)) { reach.add(e.target); changed = true; } }
    ok(`[${tpl.key}] fluxo: todo bloco é alcançável a partir do início`, def.nodes.every((n) => reach.has(n.id)), def.nodes.filter((n) => !reach.has(n.id)).map((n) => n.data?.title || n.id));
    const pos = def.nodes.map((n) => `${n.position.x}|${n.position.y}`);
    ok(`[${tpl.key}] fluxo: blocos sem posição repetida`, new Set(pos).size === pos.length, pos.filter((p, i) => pos.indexOf(p) !== i));
    ok(`[${tpl.key}] fluxo: tamanho aceito pelo serviço`, def.nodes.length <= 250 && Buffer.byteLength(JSON.stringify(def)) < 512_000);

    // ---- cenários no simulador (serviço real do back em memória, sem banco)
    const tagMap = new Map((tpl.tags || []).map((t) => [fakeId('tag', t.name), { id: fakeId('tag', t.name), name: t.name, color: t.color || '#64748b' }]));
    const prisma = { whatsapp_crm_settings: { findUnique: async () => null }, whatsapp_bot_flows: { findFirst: async () => null } };
    const crm = { botProducts: async () => [], botCustomer: async () => { throw new Error('sem banco'); } };
    const presenter = { tagMap: async () => tagMap };
    const identity = { findCustomer: async () => ({ found: [] }) };
    const nil = {};
    const svc = new WhatsAppBotService(prisma, nil, nil, nil, nil, nil, presenter, { on() {}, onInbound() {} }, nil, crm, nil, nil, nil, identity, nil, nil);
    const sim = async (body) => {
      try { return { s: 201, j: await svc.simulate('org-local', JSON.parse(JSON.stringify(body))) }; } catch (e) { return { s: e?.status || 500, j: { message: e?.message } }; }
    };
    const fmissing = new Set();
    resolveMarkers([tpl.fixture || {}, ...(tpl.scenarios || []).map((sc) => sc.fixture || {})], maps, fmissing, categoryKey);
    ok(`[${tpl.key}] fixture: marcadores existem`, !fmissing.size, [...fmissing]);
    ok(`[${tpl.key}] 2 a 4 cenários`, (tpl.scenarios || []).length >= 2 && (tpl.scenarios || []).length <= 4, (tpl.scenarios || []).length);
    for (const sc of tpl.scenarios || []) {
      if (VERBOSE) console.log(` -- ${sc.name}`);
      const fixture = resolveMarkers({ ...(tpl.fixture || {}), ...(sc.fixture || {}) }, maps, new Set(), categoryKey);
      await runScenario(sim, tpl, sc, { definition: def, settings: tpl.bot.settings || {}, crm_fixture: fixture });
    }
  }
}

// ================================================================ SERVIDOR
async function runServer() {
  const jwt = (await import('jsonwebtoken')).default;
  const API = 'http://127.0.0.1:8000';
  const env = Object.fromEntries(readFileSync('/opt/pub-mail/back/.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
  const DB_PASS = readFileSync('/root/pubmail.secrets', 'utf8').split('\n').find((l) => l.startsWith('DB_PASS='))?.slice(8).trim();
  const sql = (q) => execFileSync('mysql', ['-upubmail', `-p${DB_PASS}`, '-h127.0.0.1', '-N', '-e', q, 'pubmail'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  const sign = (u) => jwt.sign({ sub: u.id, org: u.org, role: u.role }, env.JWT_ACCESS_SECRET, { expiresIn: '40m' });
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  // 429 (limite de requisições) = espera e tenta de novo; a rota de aplicar tem 10/min — as aplicações são espaçadas
  const call = async (tok, m, p, b) => {
    for (let i = 0; ; i++) {
      const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: b ? JSON.stringify(b) : undefined });
      let j = null;
      const t = await r.text();
      try { j = JSON.parse(t); } catch { j = t; }
      if (r.status === 429 && i < 4) { await sleep(15_000); continue; }
      return { s: r.status, j };
    }
  };
  let lastApply = 0;
  const apply = async (tok, key) => {
    const wait = lastApply + 7_000 - Date.now();
    if (wait > 0) await sleep(wait);
    lastApply = Date.now();
    return call(tok, 'POST', `/whatsapp/templates/${key}/apply`, {});
  };
  const list = (j) => (Array.isArray(j) ? j : j?.items || []);
  const req = createRequire('/opt/pub-mail/back/package.json');
  const engine = req('/opt/pub-mail/back/dist/src/whatsapp/bot/wa-bot.engine.js');
  const { categoryKey } = req('/opt/pub-mail/back/dist/src/whatsapp/tickets/wa-ticket.util.js');

  const SA = sql(`SELECT CONCAT(u.id,'|',u.organization_id) FROM users u WHERE u.email='superadmin@pubmail.com' LIMIT 1`).split('|');
  const saTok = sign({ id: SA[0], org: SA[1], role: 'SUPER_ADMIN' });
  const stamp = Date.now().toString(36);

  let r = await call(saTok, 'GET', '/whatsapp/templates');
  const summary = list(r.j);
  ok('GET /whatsapp/templates: 7 modelos', r.s === 200 && summary.length === 7, summary.map((t) => t.key));
  const keys = summary.map((t) => t.key).filter((k) => !ONLY.length || ONLY.includes(k));

  for (const key of keys) {
    console.log(`\n=== ${key}`);
    let orgId = null;
    try {
      r = await call(saTok, 'POST', '/admin/clients', { name: `Modelo ${key}`, email: `tpl-${key}-${stamp}@teste.local`, password: 'Senha!Teste123', org_name: `E2E Modelo ${key} ${stamp}`, modules: ['whatsapp', 'settings'], price_cents: 0 });
      orgId = r.j?.organization?.id;
      const ownerId = r.j?.user?.id;
      ok(`[${key}] org temporária criada`, r.s === 201 && orgId, r.j);
      if (!orgId) continue;
      const tok = sign({ id: ownerId, org: orgId, role: 'OWNER' });

      r = await call(tok, 'GET', `/whatsapp/templates/${key}`);
      const tpl = r.j;
      ok(`[${key}] GET do modelo completo (fluxo, fixture e cenários)`, r.s === 200 && tpl?.bot?.definition?.nodes?.length && tpl.fixture && tpl.scenarios?.length >= 2, { s: r.s, keys: Object.keys(tpl || {}) });
      const sum = summary.find((t) => t.key === key);

      // ---- 1ª aplicação
      r = await apply(tok, key);
      const ap = r.j || {};
      ok(`[${key}] aplicar: sem erros`, (r.s === 200 || r.s === 201) && Array.isArray(ap.errors) && !ap.errors.length, ap);
      const n = (k) => (ap.created?.[k] || []).length;
      const products = tpl.products || [];
      ok(`[${key}] criou produtos (${products.filter((p) => p.kind !== 'service').length}) e serviços (${products.filter((p) => p.kind === 'service').length})`, n('products') === products.filter((p) => p.kind !== 'service').length && n('services') === products.filter((p) => p.kind === 'service').length, ap.created);
      ok(`[${key}] criou etiquetas (${(tpl.tags || []).length})`, n('tags') === (tpl.tags || []).length, ap.created?.tags);
      ok(`[${key}] criou etapas do funil (${(tpl.pipeline_stages || []).length})`, n('pipeline_stages') === (tpl.pipeline_stages || []).length, ap.created?.pipeline_stages);
      ok(`[${key}] criou campos (${sum.counts.custom_fields})`, n('custom_fields') === sum.counts.custom_fields, ap.created?.custom_fields);
      ok(`[${key}] criou categorias de chamado (${sum.counts.ticket_categories})`, n('ticket_categories') === sum.counts.ticket_categories, ap.created?.ticket_categories);
      ok(`[${key}] criou recursos da agenda (${sum.counts.resources})`, n('resources') === sum.counts.resources, ap.created?.resources);
      ok(`[${key}] fluxo criado`, n('bot') === 1 && ap.flow_id, { bot: ap.created?.bot, flow_id: ap.flow_id });

      // ---- conferências no banco/API
      r = await call(tok, 'GET', `/whatsapp/bot/flows/${ap.flow_id}`);
      const flow = r.j;
      ok(`[${key}] fluxo DESLIGADO e sem número`, r.s === 200 && flow.active === false && !(flow.sessions || flow.session_ids || []).length, { active: flow?.active, sessions: flow?.sessions });
      ok(`[${key}] fluxo sem marcador sobrando`, !markersIn(flow?.definition).length, markersIn(flow?.definition));
      const verrs = engine.validateDefinition(flow?.definition);
      ok(`[${key}] fluxo salvo válido pelo motor (${flow?.definition?.nodes?.length} blocos)`, !verrs.length, verrs);
      const prods = list((await call(tok, 'GET', '/whatsapp/products')).j);
      ok(`[${key}] produtos na org`, products.every((p) => prods.some((x) => lc(x.name) === lc(p.name))), prods.map((x) => x.name));
      for (const p of products.filter((x) => Array.isArray(x.included_in_plans) && x.included_in_plans.length)) {
        const got = prods.find((x) => lc(x.name) === lc(p.name));
        ok(`[${key}] “${p.name}” incluso em ${p.included_in_plans.length} plano(s)`, (got?.included_in_plans || []).length === p.included_in_plans.length, got?.included_in_plans);
      }
      const tagsNow = list((await call(tok, 'GET', '/whatsapp/tags')).j);
      for (const p of products.filter((x) => x.entitlement?.rules?.length)) {
        const got = prods.find((x) => lc(x.name) === lc(p.name));
        const rules = got?.entitlement?.rules || (Array.isArray(got?.entitlement) ? got.entitlement : []);
        const want = p.entitlement.rules.map((r) => String(r.ref).startsWith('@tag:') ? tagsNow.find((t) => lc(t.name) === lc(String(r.ref).slice(5)))?.id : r.ref);
        ok(`[${key}] “${p.name}”: ${p.entitlement.rules.length} regra(s) “Ao pagar, liberar…” com o id real`, rules.length === want.length && want.every((id) => id && rules.some((r) => r.ref === id)), { rules, want });
      }
      for (const p of products.filter((x) => x.kind === 'service')) {
        const got = prods.find((x) => lc(x.name) === lc(p.name));
        ok(`[${key}] serviço “${p.name}”: ${p.duration_minutes} min, pagamento ${p.booking?.payment || 'on_site'}`, got?.kind === 'service' && got.duration_minutes === p.duration_minutes && got.booking?.payment === (p.booking?.payment || 'on_site'), got);
      }
      const tags = list((await call(tok, 'GET', '/whatsapp/tags')).j);
      const stages = list((await call(tok, 'GET', '/whatsapp/pipeline/stages')).j);
      const resources = list((await call(tok, 'GET', '/whatsapp/scheduling/resources')).j);
      if (tpl.scheduling?.resources?.length) {
        for (const rs of tpl.scheduling.resources) {
          const got = resources.find((x) => lc(x.name) === lc(rs.name));
          ok(`[${key}] recurso “${rs.name}” com ${(rs.services || []).length} serviço(s)`, got && (got.services || []).length === (rs.services || []).length, got);
        }
      }
      if (tpl.tickets?.categories?.length) {
        const ts = (await call(tok, 'GET', '/whatsapp/tickets/settings')).j;
        ok(`[${key}] categorias de chamado = as do modelo (padrões substituídas)`, ts.categories?.length === tpl.tickets.categories.length && tpl.tickets.categories.every((c) => ts.categories.some((x) => x.key === categoryKey(c.key || c.label))), ts.categories?.map((c) => c.key));
        if (tpl.tickets.settings?.prefix) ok(`[${key}] prefixo do protocolo ${tpl.tickets.settings.prefix}`, ts.prefix === tpl.tickets.settings.prefix, ts.prefix);
      }
      if (tpl.orders?.settings) {
        const os = (await call(tok, 'GET', '/whatsapp/orders/settings')).j;
        ok(`[${key}] configuração de pedidos gravada`, os.delivery?.fee_cents === (tpl.orders.settings.delivery?.fee_cents ?? os.delivery?.fee_cents) && os.min_order_cents === (tpl.orders.settings.min_order_cents ?? os.min_order_cents), os);
      }
      const cfs = (await call(tok, 'GET', '/whatsapp/crm-settings')).j?.custom_fields || {};
      for (const [ent, defs] of Object.entries(tpl.custom_fields || {})) ok(`[${key}] campos de ${ent} gravados (${defs.length})`, defs.every((d) => (cfs[ent] || []).some((x) => x.key === d.key)), (cfs[ent] || []).map((x) => x.key));

      // ---- 2ª aplicação: nada novo (fluxo novo com data; pedidos regravados)
      r = await apply(tok, key);
      const ap2 = r.j || {};
      const extra = Object.entries(ap2.created || {}).filter(([k, v]) => !PARTS_SKIP_ON_REAPPLY.has(k) && v.length);
      ok(`[${key}] 2ª aplicação: nada duplicado`, (r.s === 200 || r.s === 201) && !ap2.errors?.length && !extra.length, ap2);
      ok(`[${key}] 2ª aplicação: tudo pulado`, (ap2.skipped?.products || []).length === products.length && (ap2.skipped?.tags || []).length === (tpl.tags || []).length, ap2.skipped);
      ok(`[${key}] 2ª aplicação: fluxo novo com a data no nome (desligado)`, /\(\d{4}-\d{2}-\d{2}\)$/.test(ap2.created?.bot?.[0] || '') && ap2.flow_id && ap2.flow_id !== ap.flow_id, ap2.created?.bot);
      const prods2 = list((await call(tok, 'GET', '/whatsapp/products')).j);
      ok(`[${key}] produtos continuam ${prods.length}`, prods2.length === prods.length, prods2.length);
      const flows = list((await call(tok, 'GET', '/whatsapp/bot/flows')).j);
      ok(`[${key}] 2 fluxos, ambos desligados`, flows.length === 2 && flows.every((f) => !f.active), flows.map((f) => [f.name, f.active]));

      // ---- cenários com a fixture do modelo (marcadores → ids reais)
      const maps = {
        product: new Map(prods.map((p) => [lc(p.name), p.id])),
        tag: new Map(tags.map((t) => [lc(t.name), t.id])),
        stage: new Map(stages.map((s) => [lc(s.name), s.id])),
        resource: new Map(resources.map((x) => [lc(x.name), x.id])),
      };
      const fmissing = new Set();
      resolveMarkers([tpl.fixture || {}, ...(tpl.scenarios || []).map((sc) => sc.fixture || {})], maps, fmissing, categoryKey);
      ok(`[${key}] fixture: marcadores resolvidos`, !fmissing.size, [...fmissing]);
      const sim = (body) => call(tok, 'POST', '/whatsapp/bot/simulate', body);
      for (const sc of tpl.scenarios || []) {
        if (VERBOSE) console.log(` -- ${sc.name}`);
        const fixture = resolveMarkers({ ...(tpl.fixture || {}), ...(sc.fixture || {}) }, maps, new Set(), categoryKey);
        await runScenario(sim, tpl, sc, { flow_id: ap.flow_id, crm_fixture: fixture });
      }
    } catch (e) {
      fails++;
      console.log('ERRO', e?.stack || e);
    } finally {
      if (orgId) {
        r = await call(saTok, 'DELETE', `/admin/organizations/${orgId}`);
        const left = ['whatsapp_products', 'whatsapp_tags', 'whatsapp_pipeline_stages', 'whatsapp_bot_flows', 'whatsapp_resources', 'whatsapp_crm_settings'].map((t) => `${t}=${sql(`SELECT COUNT(*) FROM ${t} WHERE organization_id='${orgId}'`)}`);
        ok(`[${key}] org apagada e limpa`, (r.s === 200 || r.s === 204) && left.every((x) => x.endsWith('=0')) && sql(`SELECT COUNT(*) FROM organizations WHERE id='${orgId}'`) === '0', left);
      }
    }
  }
}

try {
  if (LOCAL) await runLocal();
  else await runServer();
} catch (e) {
  fails++;
  console.log('ERRO', e?.stack || e);
}
console.log(`\n${total - fails}/${total} passaram${fails ? ` — ${fails} FALHAS` : ''}`);
process.exit(fails ? 1 : 0);
