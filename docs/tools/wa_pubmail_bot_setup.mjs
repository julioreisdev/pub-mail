// Configura o fluxo de vendas do WhatsApp OFICIAL do Pub Mail (número "Pub Mail", org SuperAdmin) — roda NO SERVIDOR:
//   ssh pubmail-hostinger 'cat > /opt/pub-mail/back/wa_bot_setup.tmp.mjs' < docs/tools/wa_pubmail_bot_setup.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && node wa_bot_setup.tmp.mjs; rm -f wa_bot_setup.tmp.mjs'
// Pré-requisito: os zips avulsos dos plugins em /var/tmp (tradutor-invisivel.zip, push-in-play.zip) e o gateway PIX
// da org configurado em Configurações → Pagamentos. Idempotente: etiquetas/produtos são achados pelo nome, o fluxo
// pelo nome "Pub Mail" (ou criado), a mídia é reaproveitada quando o fluxo atual já tem o mesmo arquivo.
// Env: DRY=1 só monta e simula (não grava); SIM=0 pula a simulação.
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import mysql from 'mysql2/promise';

const API = 'http://127.0.0.1:8000';
const JULIO = '5589981043496'; // WhatsApp pessoal do Júlio (links personalizados)
const FLOW_NAME = 'Pub Mail';
const SESSION_LABEL = 'Pub Mail';
const VIDEO_PUSH = 'https://www.youtube.com/watch?v=AQUao9amHbs';
const VIDEO_TRAD = 'https://www.youtube.com/watch?v=c5RJ-R7Orho&t=8s';
const PRICE_TRAD = 69100; // R$ 691,00 vitalício
const PRICE_PUSH = 120000; // R$ 1.200,00 vitalício
const DRY = process.env.DRY === '1';

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const db = await mysql.createConnection({ host: '127.0.0.1', user: env.DATABASE_USER, password: env.DATABASE_PASS, database: env.DATABASE_NAME });
const [[u]] = await db.query("SELECT id, organization_id, role FROM users WHERE email='superadmin@pubmail.com'");
const [[sess]] = await db.query('SELECT id, phone FROM whatsapp_sessions WHERE organization_id=? AND label=? LIMIT 1', [u.organization_id, SESSION_LABEL]);
await db.end();
if (!sess) throw new Error(`número "${SESSION_LABEL}" não encontrado`);
const tok = jwt.sign({ sub: u.id, org: u.organization_id, role: u.role }, env.JWT_ACCESS_SECRET, { expiresIn: '10m' });
const H = { Authorization: 'Bearer ' + tok };
const J = { ...H, 'Content-Type': 'application/json' };
const api = async (method, path, body, raw) => {
  const r = await fetch(API + path, { method, headers: raw ? H : J, body: raw ? body : body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = t; }
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${typeof j === 'string' ? j : JSON.stringify(j).slice(0, 300)}`);
  return j;
};
// Ids DETERMINÍSTICOS (por prefixo + contador): rodar o script de novo mantém os mesmos ids de
// blocos/opções, então conversas que estavam no meio do fluxo (ou um PIX pendente) continuam de onde
// estavam. Com ids aleatórios a cada rodada, o bloco atual da conversa "sumia".
const counters = {};
const uid = (p) => `${p}-${String((counters[p] = (counters[p] || 0) + 1)).padStart(3, '0')}`;
const log = (...a) => console.log(...a);

// ---------------------------------------------------------------- etiquetas
const TAGS = [
  ['Lead: WhatsApp', '#25D366'], ['Lead: Telegram', '#2AABEE'], ['Lead: E-mail', '#f59e0b'], ['Lead: Webchat', '#8b5cf6'], ['Lead: Quizzes', '#ec4899'],
  ['Lead: Plugins', '#3858e9'], ['Comprou: Tradutor', '#16a34a'], ['Comprou: Push', '#0ea5e9'],
];
const existingTags = await api('GET', '/whatsapp/tags');
const tagList = Array.isArray(existingTags) ? existingTags : existingTags.items || [];
const tagId = {};
for (const [name, color] of TAGS) {
  let t = tagList.find((x) => String(x.name).toLowerCase() === name.toLowerCase());
  if (!t && !DRY) t = await api('POST', '/whatsapp/tags', { name, color });
  tagId[name] = t?.id || `dry-${name}`;
}
log('etiquetas:', Object.keys(tagId).length);

// ---------------------------------------------------------------- produtos (CRM)
const PRODUCTS = [
  { name: 'Tradutor Invisível — plano vitalício', description: 'Plugin WordPress que traduz o site para o idioma de cada visitante. Sites ilimitados, sem mensalidade.', price_cents: PRICE_TRAD, billing: 'once', active: true, position: 0 },
  { name: 'Push In Play — plano vitalício', description: 'Plugin WordPress de notificações push: popup A/B, automação de boas-vindas, copys e broadcasts por horário. Sites ilimitados, sem mensalidade.', price_cents: PRICE_PUSH, billing: 'once', active: true, position: 1 },
];
const prods = await api('GET', '/whatsapp/products');
const prodList = Array.isArray(prods) ? prods : prods.items || [];
for (const p of PRODUCTS) {
  const cur = prodList.find((x) => String(x.name).toLowerCase() === p.name.toLowerCase());
  if (!DRY) { if (cur) await api('PUT', `/whatsapp/products/${cur.id}`, p); else await api('POST', '/whatsapp/products', p); }
}
log('produtos: ok');

// ---------------------------------------------------------------- funil: entrada automática + pago → Fechado
const stages = await api('GET', '/whatsapp/pipeline/stages');
const stageList = Array.isArray(stages) ? stages : stages.items || [];
const stNovo = stageList.find((s) => /^novo$/i.test(s.name)) || stageList.find((s) => s.kind === 'open');
const stWon = stageList.find((s) => s.kind === 'won');
if (!DRY && stNovo && stWon) await api('PUT', '/whatsapp/pipeline/automation', { auto_enter_stage_id: stNovo.id, paid_stage_id: stWon.id });
log('funil: entrada →', stNovo?.name, '| pago →', stWon?.name);

// ---------------------------------------------------------------- fluxo
const flows = await api('GET', '/whatsapp/bot/flows');
const flowList = Array.isArray(flows) ? flows : flows.items || [];
let flow = flowList.find((f) => String(f.name).toLowerCase() === FLOW_NAME.toLowerCase());
if (!flow && !DRY) flow = await api('POST', '/whatsapp/bot/flows', { name: FLOW_NAME });
const full = flow ? await api('GET', `/whatsapp/bot/flows/${flow.id}`) : null;

// mídia dos plugins (reaproveita se o fluxo atual já tem o arquivo)
const findMedia = (filename) => {
  for (const n of full?.definition?.nodes || []) for (const m of n.data?.messages || []) if (m.media?.filename === filename && m.media?.id) return m.media;
  return null;
};
const upload = async (file, filename) => {
  const cur = findMedia(filename);
  if (cur) return cur;
  if (DRY) return { id: 'dry', kind: 'document', mime: 'application/zip', filename };
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(file)], { type: 'application/zip' }), filename);
  const m = await api('POST', '/whatsapp/media', fd, true);
  return { id: m.id, url: m.url || null, kind: 'document', mime: m.mime || 'application/zip', filename: m.filename || filename };
};
const mediaTrad = await upload('/var/tmp/tradutor-invisivel.zip', 'tradutor-invisivel.zip');
const mediaPush = await upload('/var/tmp/push-in-play.zip', 'push-in-play.zip');
log('mídia:', mediaTrad.id, mediaPush.id);

const wa = (msg) => `https://wa.me/${JULIO}?text=${encodeURIComponent(msg)}`;
const msg = (title, texts, pos) => ({ id: uid('n'), type: 'message', position: pos, data: { title, messages: texts.map((t) => (typeof t === 'string' ? { id: uid('m'), kind: 'text', text: t, media: null, delay_seconds: 0 } : { id: uid('m'), kind: t.kind, text: t.text || '', media: t.media, delay_seconds: 0 })) } });
const tagsNode = (title, add, pos) => ({ id: uid('n'), type: 'tags', position: pos, data: { title, add, remove: [] } });
const opt = (label, keywords = []) => ({ id: uid('o'), label, keywords });
const edge = (source, handle, target) => ({ id: uid('e'), source, sourceHandle: handle, target, targetHandle: 'in' });

const MODULES = [
  ['WhatsApp', 'WhatsApp', 'multi-número, chat da equipe, bot, CRM com funil e cobranças, broadcasts com anti-ban e métricas', 'Lead: WhatsApp'],
  ['Telegram', 'Telegram', 'bots com fluxo inicial, grupos e canais, broadcasts, mensagem rotativa e pagamentos VIP por PIX', 'Lead: Telegram'],
  ['E-mail marketing', 'E-mail marketing', 'projetos, construtor visual de templates, automações por comportamento, testes A/B e analytics', 'Lead: E-mail'],
  ['Webchat', 'Webchat', 'chat com IA no seu domínio, funil de conversa, captação de leads e venda por PIX dentro do chat', 'Lead: Webchat'],
  ['Quizzes', 'Quizzes', 'quizzes de captação no seu domínio, redirecionamento por resposta, anúncios e e-mail automático ao lead', 'Lead: Quizzes'],
];

// Layout: colunas de 420 px (os blocos têm ~330 px de largura) e linhas de 380 px (um bloco de mensagem
// longa chega a ~300 px de altura) — sem isso os balões ficavam uns por cima dos outros no construtor.
const COL = (i) => i * 420;
const ROW = (i) => i * 380;
const start = { id: 'start', type: 'start', position: { x: COL(0), y: ROW(2) + 120 }, data: {}, deletable: false };
const optsMain = [...MODULES.map(([label]) => opt(label)), opt('Plugins WordPress', ['plugin', 'plugins', 'wordpress'])];
const menuMain = { id: uid('n'), type: 'menu', position: { x: COL(1), y: ROW(2) }, data: { title: 'Menu principal', text: '*Pub Mail*\n\nOlá!! 👋\nDigite a opção do módulo desejado:', options: optsMain, numbering: 'number' } };
const endNode = { id: uid('n'), type: 'end', position: { x: COL(8), y: ROW(4) + 60 }, data: { title: 'Encerrar', text: 'Se precisar de mais alguma coisa, é só mandar *menu* para ver as opções de novo. Obrigado pelo contato! 😉', close: true } };

const nodes = [start, menuMain, endNode];
const edges = [edge('start', 'out', menuMain.id)];

// opções 1–5: etiqueta + link personalizado para o Júlio
MODULES.forEach(([label, short, blurb, tag], i) => {
  const y = ROW(i);
  const t = tagsNode(`Etiqueta ${short}`, [tagId[tag]], { x: COL(2), y: y + 60 });
  const link = wa(`Olá Júlio! Tenho interesse no módulo *${short}* do Pub Mail. Pode me explicar como funciona?`);
  const m = msg(`Módulo ${short}`, [`Ótima escolha! 🚀 O módulo *${short}* do Pub Mail traz ${blurb}.\n\nPara ver uma demonstração e tirar dúvidas, fale direto com o Júlio — toque no link que a mensagem já vai pronta:\n${link}`], { x: COL(3), y });
  nodes.push(t, m);
  edges.push(edge(menuMain.id, `opt-${optsMain[i].id}`, t.id), edge(t.id, 'out', m.id), edge(m.id, 'out', endNode.id));
});

// opção 6: submenu dos plugins
const optsPlug = [opt('Plugin de tradução', ['tradutor', 'traducao', 'tradução']), opt('Plugin de Push Notification', ['push', 'notificacao', 'notificação']), opt('Entender como funcionam', ['entender', 'como funciona']), opt('Falar com Júlio', ['julio', 'júlio', 'atendente'])];
// opção 6 fica abaixo dos 5 módulos; as 4 sub-opções em linhas próprias a partir de ROW(5)
const tagPlug = tagsNode('Etiqueta Plugins', [tagId['Lead: Plugins']], { x: COL(2), y: ROW(5) + 60 });
const menuPlug = { id: uid('n'), type: 'menu', position: { x: COL(3), y: ROW(5) }, data: { title: 'Menu plugins', text: '*Pub Mail*\n\nDigite a opção desejada:', options: optsPlug, numbering: 'number' } };
nodes.push(tagPlug, menuPlug);
edges.push(edge(menuMain.id, `opt-${optsMain[5].id}`, tagPlug.id), edge(tagPlug.id, 'out', menuPlug.id));

const TRAD_INTRO = `🌍 *Tradutor Invisível* — plano vitalício por *R$ 691,00*\n\nSeu site WordPress passa a aparecer no idioma de cada visitante, automaticamente: sem botão de idioma, sem configurar nada, com o endereço (URL) traduzido e o conteúdo do post intocado. Instala, ativa e pronto — sites ilimitados, sem mensalidade.\n\nVeja funcionando: ${VIDEO_TRAD}`;
const PUSH_INTRO = `🔔 *Push In Play* — plano vitalício por *R$ 1.200,00*\n\nNotificações push no seu WordPress: convite de permissão personalizável (com teste A/B), automação de boas-vindas, copys importadas de planilha, broadcasts por horário com sorteio de copy e métricas de tudo. Sites ilimitados, sem mensalidade.\n\nVeja funcionando: ${VIDEO_PUSH}`;

const pixNode = (title, cents, description, product, pos) => ({ id: uid('n'), type: 'pix', position: pos, data: {
  title, amount_cents: cents, description,
  text: `Perfeito! 🙌 Para garantir o *${product}* (plano vitalício, sites ilimitados), faça o PIX de *{{pix_valor}}* 👇\n\nCopie o código abaixo e cole no app do seu banco — o QR Code vem em seguida. Assim que o pagamento cair, eu te envio o plugin aqui mesmo, nesta conversa.`,
  send_qr: true, expires_minutes: 60,
  paid_text: 'Pagamento confirmado! ✅ Muito obrigado. Seu plugin está chegando…',
  expired_text: 'O PIX expirou ⌛ Sem problema: mande *menu*, escolha o plugin de novo e eu gero outro na hora.',
} });
const deliver = (product, media, version, afterInstall, pos) => msg(`Entrega ${product}`, [
  `Aqui está o seu *${product}* 🎉\n\n*Como instalar:*\n1. No WordPress, vá em *Plugins → Adicionar novo → Enviar plugin*\n2. Escolha o arquivo .zip abaixo e clique em *Instalar agora*\n3. Clique em *Ativar*\n${afterInstall}\n\nGuarde o arquivo: a licença é vitalícia e vale para sites ilimitados. Qualquer dúvida na instalação, fale com o Júlio: ${wa(`Olá Júlio! Acabei de comprar o ${product} e preciso de ajuda com a instalação.`)}`,
  { kind: 'document', text: `${product} ${version} — arquivo do plugin`, media },
], pos);
const expiredMsg = (pos) => msg('PIX expirado', ['Quando quiser retomar, é só mandar *menu* e escolher o plugin de novo 😉'], pos);

// 6.1 tradutor
const mTrad = msg('Sobre o Tradutor', [TRAD_INTRO], { x: COL(4), y: ROW(5) });
const pixTrad = pixNode('PIX Tradutor', PRICE_TRAD, 'Tradutor Invisível — plano vitalício', 'Tradutor Invisível', { x: COL(5), y: ROW(5) });
const tagTrad = tagsNode('Comprou Tradutor', [tagId['Comprou: Tradutor']], { x: COL(6), y: ROW(5) + 60 });
const dTrad = deliver('Tradutor Invisível', mediaTrad, '1.4.2', '4. Pronto — o site já traduz sozinho para o idioma de cada visitante.', { x: COL(7), y: ROW(5) });
const xTrad = expiredMsg({ x: COL(6), y: ROW(6) });
nodes.push(mTrad, pixTrad, tagTrad, dTrad, xTrad);
edges.push(edge(menuPlug.id, `opt-${optsPlug[0].id}`, mTrad.id), edge(mTrad.id, 'out', pixTrad.id), edge(pixTrad.id, 'paid', tagTrad.id), edge(tagTrad.id, 'out', dTrad.id), edge(dTrad.id, 'out', endNode.id), edge(pixTrad.id, 'expired', xTrad.id), edge(xTrad.id, 'out', endNode.id));

// 6.2 push
const mPush = msg('Sobre o Push', [PUSH_INTRO], { x: COL(4), y: ROW(7) });
const pixPush = pixNode('PIX Push', PRICE_PUSH, 'Push In Play — plano vitalício', 'Push In Play', { x: COL(5), y: ROW(7) });
const tagPush = tagsNode('Comprou Push', [tagId['Comprou: Push']], { x: COL(6), y: ROW(7) + 60 });
const dPush = deliver('Push In Play', mediaPush, '0.10', '4. No menu *Push In Play* do WordPress, abra *Popup Layout* e ligue um layout — os visitantes já passam a ver o convite.', { x: COL(7), y: ROW(7) });
const xPush = expiredMsg({ x: COL(6), y: ROW(8) });
nodes.push(mPush, pixPush, tagPush, dPush, xPush);
edges.push(edge(menuPlug.id, `opt-${optsPlug[1].id}`, mPush.id), edge(mPush.id, 'out', pixPush.id), edge(pixPush.id, 'paid', tagPush.id), edge(tagPush.id, 'out', dPush.id), edge(dPush.id, 'out', endNode.id), edge(pixPush.id, 'expired', xPush.id), edge(xPush.id, 'out', endNode.id));

// 6.3 entender → duas mensagens → volta ao menu dos plugins
const mExplain = msg('Como funcionam', [PUSH_INTRO, TRAD_INTRO + '\n\nQuer um deles? Escolha abaixo 👇'], { x: COL(4), y: ROW(9) });
nodes.push(mExplain);
edges.push(edge(menuPlug.id, `opt-${optsPlug[2].id}`, mExplain.id), edge(mExplain.id, 'out', menuPlug.id));

// 6.4 falar com Júlio
const mJulio = msg('Falar com Júlio', [`Claro! Toque no link abaixo para falar com o Júlio — a mensagem já vai pronta:\n${wa('Olá Júlio! Quero saber mais sobre os plugins WordPress do Pub Mail (Tradutor Invisível e Push In Play).')}`], { x: COL(4), y: ROW(10) + 120 });
nodes.push(mJulio);
edges.push(edge(menuPlug.id, `opt-${optsPlug[3].id}`, mJulio.id), edge(mJulio.id, 'out', endNode.id));

const definition = { nodes, edges };
const settings = {
  audience: { mode: 'all', test_chat_ids: [], tag_ids: [] },
  trigger: { mode: 'any', keywords: [] },
  restart_keywords: ['menu', '#inicio', 'inicio', 'início', '0', 'oi', 'olá', 'ola'],
  exclude_tag_ids: [],
  input_timeout_hours: 24,
  invalid_option_text: 'Não entendi 🤔 Responda só com o *número* da opção.',
  max_retries: 3,
  typing: true,
  numbering: 'number',
  business_hours: { enabled: false },
};

if (!DRY) {
  await api('PUT', `/whatsapp/bot/flows/${flow.id}`, { name: FLOW_NAME, definition, settings });
  await api('PUT', `/whatsapp/bot/flows/${flow.id}/sessions`, { session_ids: [sess.id] });
  await api('POST', `/whatsapp/bot/flows/${flow.id}/active`, { active: true });
  const f = await api('GET', `/whatsapp/bot/flows/${flow.id}`);
  log(`fluxo "${f.name}": ${f.definition.nodes.length} blocos, ${f.definition.edges.length} ligações, ativo=${f.active}, números=${JSON.stringify((f.sessions || f.session_ids || []).map((s) => s.label || s))}`);
}

// ---------------------------------------------------------------- simulação (sem enviar nada)
if (process.env.SIM !== '0') {
  const run = async (label, steps) => {
    let state = null; const lines = [];
    for (const st of steps) {
      const body = { definition, settings, state, ...(st.event ? { event: st.event } : { input: st.input ?? null }) };
      const r = await api('POST', '/whatsapp/bot/simulate', body);
      state = r.state;
      for (const a of r.actions) {
        if (a.type === 'send') lines.push(`  → ${a.message.kind}${a.message.media ? ` [${a.message.media.filename}]` : ''}: ${String(a.message.text || '').replace(/\n/g, ' ⏎ ').slice(0, 110)}`);
        else if (a.type === 'pix') lines.push(`  → PIX ${a.amount_cents / 100} ${a.description}`);
        else if (a.type === 'tags') lines.push(`  → etiquetas +${a.add.map((t) => t.name).join(', ')}`);
        else if (a.type === 'close' || a.type === 'finish') lines.push(`  → ${a.type}`);
      }
      lines.push(`  [${st.event || `input "${st.input}"`}] → status ${state.status}${state.waiting_for ? ' / aguarda ' + state.waiting_for : ''}`);
    }
    log(`\n${label}`); lines.forEach((l) => log(l));
  };
  await run('CENÁRIO A — módulo WhatsApp', [{ input: 'oi' }, { input: '1' }]);
  await run('CENÁRIO B — plugins → tradutor → PIX pago → entrega', [{ input: 'olá' }, { input: '6' }, { input: '1' }, { event: 'pix_paid' }]);
  await run('CENÁRIO C — plugins → push → PIX expirou', [{ input: 'oi' }, { input: 'plugins' }, { input: '2' }, { event: 'pix_expired' }]);
  await run('CENÁRIO D — plugins → entender (2 mensagens) → menu de novo → falar com Júlio', [{ input: 'oi' }, { input: '6' }, { input: '3' }, { input: '4' }]);
  await run('CENÁRIO E — opção inválida 3× → menu de novo', [{ input: 'oi' }, { input: 'x' }, { input: 'y' }, { input: 'z' }]);
}
log('\nconcluído');
