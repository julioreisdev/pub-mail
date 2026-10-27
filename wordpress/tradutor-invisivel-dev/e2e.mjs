// Testes ponta a ponta do Tradutor Invisível com Chrome real (CDP) em sites.reveleonline.com.
// Uso: node e2e.mjs [filtro]
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'https://sites.reveleonline.com';
const OUT = path.dirname(new URL(import.meta.url).pathname) + '/shots';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FILTER = process.argv[2] || '';
let fails = 0, total = 0;
let lastLabel = '(início)', lastAt = Date.now();
const ok = (label, cond, extra) => { total++; if (!cond) fails++; lastLabel = label; lastAt = Date.now(); console.log((cond ? 'PASS ' : 'FAIL ') + label + (cond || extra === undefined ? '' : '  → ' + JSON.stringify(extra).slice(0, 700))); };
// vigia: se nenhum teste avançar em 6 min (Chrome travado, CDP sem resposta), avisa onde parou e sai
setInterval(() => { if (Date.now() - lastAt > 6 * 60000) { console.log(`TRAVOU: nenhum teste avançou em 6 min. Último: ${lastLabel}`); process.exit(2); } }, 20000).unref();
export const ssh = (cmd) => execSync(`ssh pubmail-hostinger ${JSON.stringify(cmd)}`, { encoding: 'utf8' });
const wp = (php) => ssh(`cd /var/www/sites.reveleonline.com && sudo -u www-data wp eval ${JSON.stringify(php)}`);
// PHP arbitrário sem passar "$" pelo shell local (base64).
const wpx = (php) => ssh(`cd /var/www/sites.reveleonline.com && sudo -u www-data wp eval "eval(base64_decode('${Buffer.from(php).toString('base64')}'));"`);
// Chrome com o painel logado (cookies de autenticação gerados no servidor; nunca impressos).
async function adminBrowser(opts = {}) {
  const ck = wpx('echo SECURE_AUTH_COOKIE.PHP_EOL.wp_generate_auth_cookie(1,time()+1800,"secure_auth").PHP_EOL.LOGGED_IN_COOKIE.PHP_EOL.wp_generate_auth_cookie(1,time()+1800,"logged_in");').trim().split('\n');
  const b = await browser({ lang: 'pt-BR', w: 1280, h: 900, ...opts });
  for (const [name, value] of [[ck[0], ck[1]], [ck[2], ck[3]]]) await b.send('Network.setCookie', { name, value, domain: 'sites.reveleonline.com', path: '/', secure: true, httpOnly: true });
  b.go = async (url) => { b.cur = { reqs: [], errors: [], loaded: false, resps: [], failed: [] }; await b.send('Page.navigate', { url }); for (let i = 0; i < 150 && !b.cur.loaded; i++) await sleep(100); await sleep(500); };
  b.shot = async (name, clip) => { const x = await b.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(x.data, 'base64')); };
  b.pill = () => b.eval(`(function(){var x=document.getElementById('trinv-warm-box');if(!x)return null;var t=x.querySelector('.t'),r=x.getBoundingClientRect();return {t:x.innerText.replace(/\\s+/g,' '),c:x.className,cut:t.scrollWidth>t.clientWidth,out:r.right>innerWidth||r.bottom>innerHeight||r.left<0}})()`);
  b.waitPill = async (re, ms = 90000) => { const seen = []; for (let i = 0; i < ms / 200; i++) { const p = await b.pill(); if (p && seen[seen.length - 1] !== p.t) seen.push(p.t); if (p && re.test(p.t)) return { ok: true, seen, last: p }; await sleep(200); } return { ok: false, seen }; };
  return b;
}
const clearCache = () => wp('TRINV_Store::clear(); delete_transient("trinv_blocked");');

const INSTR = `(function(){var T=window.__tl={hidden:false,reveal:null,revealText:'',errors:[]};var h=document.documentElement||document;
function chk(){if(!h||!h.classList)return;if(h.classList.contains('trinv-wait'))T.hidden=true;else if(T.hidden&&T.reveal===null){T.reveal=performance.now();T.revealText=(document.body&&document.body.innerText||'').slice(0,6000);}}
new MutationObserver(function(){h=document.documentElement||h;chk();}).observe(document,{attributes:true,subtree:true,childList:true,attributeFilter:['class']});
window.addEventListener('error',function(e){T.errors.push(String(e.message))});window.addEventListener('load',function(){T.loadPath=location.pathname});})();`;

async function browser(opts = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await browserOnce(opts); } catch (e) { await sleep(1500); }
  }
  throw new Error('Chrome não abriu');
}
async function browserOnce({ lang = 'pt-BR', w = 1366, h = 900 } = {}) {
  const port = 9400 + Math.floor(Math.random() * 3000);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trinv-e2e-'));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, `--window-size=${w},${h}`, `--lang=${lang}`, `--accept-lang=${lang}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 80; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
  if (!targets) { proc.kill('SIGKILL'); throw new Error('sem DevTools'); }
  const pageT = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(pageT.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  const b = { cur: null, listeners: [], urls: {} };
  ws.addEventListener('message', (ev) => {
    const d = JSON.parse(ev.data);
    if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result); return; }
    if (!d.method || !b.cur) return;
    const c = b.cur;
    if (d.method === 'Network.requestWillBeSent') { c.reqs.push(d.params.request.url); b.urls[d.params.requestId] = d.params.request.url; }
    if (d.method === 'Network.requestWillBeSent' && /trinv\/v1\/t|action=trinv_t/.test(d.params.request.url) && d.params.request.postData) (c.posts = c.posts || []).push(d.params.request.postData);
    if (d.method === 'Network.responseReceived') (c.resps = c.resps || []).push(d.params.response.url);
    if (d.method === 'Network.loadingFailed') (c.failed = c.failed || []).push({ url: b.urls[d.params.requestId], why: d.params.blockedReason || d.params.errorText });
    if (d.method === 'Runtime.exceptionThrown') c.errors.push('exc: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') c.errors.push('log: ' + d.params.entry.text + ' ' + (d.params.entry.url || ''));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') c.errors.push('console: ' + d.params.args.map((a) => a.value || a.description).join(' '));
    if (d.method === 'Page.loadEventFired') c.loaded = true;
  });
  b.send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await b.send('Page.enable'); await b.send('Runtime.enable'); await b.send('Network.enable'); await b.send('Log.enable');
  await b.send('Network.setCacheDisabled', { cacheDisabled: false });
  b.close = () => { try { ws.close(); } catch {} proc.kill('SIGKILL'); setTimeout(() => { try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { /* o Chrome ainda está fechando */ } }, 1500); };
  b.eval = async (expr) => (await b.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
  return b;
}

const COLLECT = `(function(){var T=window.__tl||{};var q=function(s){var e=document.querySelector(s);return e?e.innerText.trim():null};
var pe=performance.getEntriesByType('paint'),nav=performance.getEntriesByType('navigation')[0];
return {lang:document.documentElement.lang,title:document.title,hidden:T.hidden,reveal:T.reveal,revealText:T.revealText,stillHidden:document.documentElement.classList.contains('trinv-wait'),
text:document.body.innerText.slice(0,8000),h1:q('h1'),fcp:(pe.find(function(p){return p.name==='first-contentful-paint'})||{}).startTime,dcl:nav&&nav.domContentLoadedEventEnd,load:nav&&nav.loadEventEnd,
brand:q('.notranslate'),code:q('p code'),pre:q('pre'),ad:q('ins.adsbygoogle'),later:q('#later'),btn:q('#likeBtn'),placeholder:(document.querySelector('input[type=email]')||{}).placeholder,
submit:(document.querySelector('input[type=submit]')||{}).value,alt:(document.querySelector('figure img')||{}).alt,link:(document.querySelector('a.guide-link')||{}).href,
meta:!!document.querySelector('meta[name=google][content=notranslate]'),site:q('.wp-block-site-title'),byline:(function(){var a=document.querySelector('.wp-block-post-author-name');return a&&a.parentElement?a.parentElement.innerText.replace(/\\s+/g,' ').trim():null})(),locList:(function(){var n=document.getElementById('trinv-loc');return n?JSON.parse(n.textContent):null})(),trinv:!!window.__trinv,full:window.__trinv&&window.__trinv.full,tl:window.__trinv&&window.__trinv.tl,footer:q('footer'),tlErrors:T.errors,navLangs:navigator.languages}})()`;

async function visit(b, url, opts = {}) {
  b.cur = { reqs: [], errors: [], loaded: false };
  const sid = (await b.send('Page.addScriptToEvaluateOnNewDocument', { source: INSTR })).identifier;
  if (opts.ua || opts.acceptLanguage) await b.send('Emulation.setUserAgentOverride', { userAgent: opts.ua || (await b.eval('navigator.userAgent')), acceptLanguage: opts.acceptLanguage });
  if (opts.mobile) await b.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  if (opts.cpu) await b.send('Emulation.setCPUThrottlingRate', { rate: opts.cpu });
  if (opts.net) await b.send('Network.emulateNetworkConditions', { offline: false, latency: opts.net.latency, downloadThroughput: opts.net.down, uploadThroughput: opts.net.up });
  await b.send('Page.navigate', { url });
  for (let i = 0; i < 200 && !b.cur.loaded; i++) await sleep(100);
  await sleep(opts.wait ?? 2500);
  const data = await b.eval(COLLECT);
  if (opts.click) data.clicks = await b.eval(`(function(){var b=document.getElementById('likeBtn');b.click();b.click();return document.getElementById('likeCount').textContent})()`);
  if (opts.shot) { const s = await b.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${opts.shot}.png`, Buffer.from(s.data, 'base64')); }
  await b.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: sid });
  data.reqs = b.cur.reqs;
  data.resps = b.cur.resps || [];
  data.posts = b.cur.posts || [];
  data.errors = b.cur.errors.concat(data.tlErrors || []).filter((e) => !/favicon|adsbygoogle|googlesyndication/i.test(e));
  data.n = {
    p: data.reqs.filter((u) => u.includes('trinv/v1/p') || u.includes('action=trinv_p') || u.includes('/uploads/trinv/')).length,
    st: data.reqs.filter((u) => u.includes('/uploads/trinv/')).length,
    t: data.reqs.filter((u) => u.includes('trinv/v1/t') || u.includes('action=trinv_t')).length,
    ajax: data.reqs.filter((u) => u.includes('admin-ajax.php')).length,
    js: data.reqs.filter((u) => u.includes('trinv.min.js')).length,
    google: data.reqs.filter((u) => u.includes('translate_a/t')).length,
  };
  b.cur = null;
  return data;
}
const has = (t, s) => (t || '').toLowerCase().includes(s.toLowerCase());
const SKIP = (process.env.TRINV_SKIP || '').split(',').filter(Boolean);
const ONLY = (process.env.TRINV_ONLY || '').split(',').filter(Boolean); // nomes exatos: TRINV_ONLY=C,D,W
const run = (name) => (ONLY.length ? ONLY.includes(name) : (!FILTER || name.includes(FILTER)) && !SKIP.includes(name));
const EN = `${BASE}/grow-tomatoes/`;

// ============================================================ A/B/C — post em inglês, visitante pt-BR
if (run('A')) {
  clearCache();
  const b = await browser({ lang: 'pt-BR' });
  const a = await visit(b, EN, { shot: 'A-primeira-visita', click: true });
  ok('A navegador pt-BR (navigator.languages)', a.navLangs[0] === 'pt-BR', a.navLangs);
  ok('A 1ª visita (sem cache): conteúdo traduzido para português', has(a.text, 'tomate') && !has(a.text, 'Growing your own'), a.text.slice(0, 300));
  ok('A título e <h1> traduzidos', !has(a.title, 'Growing Tomatoes') && has(a.h1, 'tomate'), [a.title, a.h1]);
  ok('A página ficou escondida e revelou JÁ traduzida (o visitante não viu inglês)', a.hidden && a.reveal !== null && has(a.revealText, 'tomate') && !has(a.revealText, 'Growing your own'), [a.hidden, a.reveal, a.revealText.slice(0, 200)]);
  ok('A <html lang="pt"> e meta notranslate (Chrome não oferece tradução)', a.lang === 'pt' && a.meta, [a.lang, a.meta]);
  ok('A marca "notranslate" intacta', a.brand === 'GreenThumb Pro', a.brand);
  ok('A nome do site ("Sites") não é traduzido', a.site === 'Sites', a.site);
  ok('A texto do tema em português intacto ("Escrito por … em Sem categoria")', /Escrito por .* em Sem categoria/.test(a.byline || ''), a.byline);
  ok('A servidor listou os textos do tema (gettext)', Array.isArray(a.locList) && a.locList.includes('em') && a.locList.includes('Escrito por'), a.locList && a.locList.slice(0, 20));
  ok('A código promocional (<code>) intacto', a.code === 'TOMATO10', a.code);
  ok('A anúncio (ins.adsbygoogle) intacto', a.ad === 'Advertisement', a.ad);
  ok('A botão traduzido e o JavaScript dele continua funcionando', !has(a.btn, 'This guide helped me') && a.clicks === '2', [a.btn, a.clicks]);
  ok('A placeholder, botão de envio e alt da imagem traduzidos', !has(a.placeholder, 'Your email') && !has(a.submit, 'Subscribe') && !has(a.alt, 'healthy tomato plant'), [a.placeholder, a.submit, a.alt]);
  ok('A link continua com o mesmo destino', a.link === 'https://example.com/harvest', a.link);
  ok('A parágrafo inserido depois por script também traduzido', a.later && !has(a.later, 'water early'), a.later);
  ok('A requisições: no máx. 1 mapa (vazio), tradução pelo servidor, sem Google no navegador', a.n.p <= 1 && a.n.t >= 1 && a.n.js === 1 && a.n.google === 0, a.n);
  ok('A sem erros no console', a.errors.length === 0, a.errors);
  console.log(`   ⏱  A: página revelada em ${Math.round(a.reveal)} ms (DOMContentLoaded ${Math.round(a.dcl)} ms)`);

  const c = await visit(b, EN, { shot: 'C-cache-navegador' });
  ok('C 2ª visita mesmo navegador: traduzida sem nenhuma requisição de tradução', has(c.text, 'tomate') && c.n.t === 0 && c.n.google === 0, { n: c.n, pedidos: c.posts.map((x) => { try { const j = JSON.parse(x); return j.s.map((t, i) => (j.h[i] ? j.h[i] + ':' : '') + t.slice(0, 80)); } catch { return x.slice(0, 100); } }) });
  console.log(`   ⏱  C: revelada em ${Math.round(c.reveal)} ms (DCL ${Math.round(c.dcl)} ms)`);
  b.close();

  const b2 = await browser({ lang: 'pt-BR' });
  const bb = await visit(b2, EN);
  ok('B outro visitante (cache do servidor): zero chamadas de tradução, só o mapa estático', has(bb.text, 'tomate') && bb.n.t === 0 && bb.n.st === 1, bb.n);
  ok('B revelou já traduzida', has(bb.revealText, 'tomate'), bb.revealText.slice(0, 120));
  console.log(`   ⏱  B: revelada em ${Math.round(bb.reveal)} ms (DCL ${Math.round(bb.dcl)} ms)`);
  b2.close();
}

// ============================================================ D — conteúdo já no idioma do visitante
if (run('D')) {
  clearCache();
  const b = await browser({ lang: 'pt-BR' });
  const d = await visit(b, `${BASE}/economizar-energia/`, { wait: 3500, shot: 'D-mesma-lingua' });
  const mode = await b.eval('window.__trinv && window.__trinv.mode');
  ok('D post em português + visitante pt-BR: página não é escondida (modo "em volta")', !d.hidden && mode === 'around', { hidden: d.hidden, mode });
  ok('D texto do post intacto', has(d.text, 'Economizar energia em casa é mais fácil do que parece') && has(d.text, 'Troque as lâmpadas antigas'), d.text.slice(0, 200));
  let dt = d.text;
  for (let i = 0; i < 9 && /[ぁ-んァ-ン一-龯]/.test(dt); i++) { await sleep(1000); dt = await b.eval('document.body.innerText'); }
  ok('D links/lista de posts em japonês traduzidos (nada em japonês na página)', !/[ぁ-んァ-ン一-龯]/.test(dt), (dt.match(/[ぁ-んァ-ン一-龯].{0,20}/) || [''])[0]);
  ok('D comentários em espanhol e inglês traduzidos', !has(d.text, 'Me encantó este artículo') && !has(d.text, 'Great tips, I switched'), d.text.slice(-900));
  ok('D sem Google direto do navegador e sem erros', d.n.google === 0 && d.errors.length === 0, [d.n, d.errors]);
  b.close();
  const b2 = await browser({ lang: 'pt-BR' });
  const d2 = await visit(b2, `${BASE}/economizar-energia/`, { wait: 2500 });
  ok('D outro visitante pt: vem do mapa estático, sem chamada de tradução', d2.n.t === 0 && d2.n.st === 1 && !/[ぁ-んァ-ン一-龯]/.test(d2.text), { n: d2.n, pedidos: d2.posts.map((x) => { try { const j = JSON.parse(x); return j.s.map((t, i) => (j.h[i] ? j.h[i] + ':' : '') + t.slice(0, 60)); } catch { return x.slice(0, 100); } }) });
  b2.close();
}

// ============================================================ E — modo leve: conteúdo en, WordPress pt, visitante en
if (run('E')) {
  const b = await browser({ lang: 'en-US' });
  const e = await visit(b, EN, { shot: 'E-modo-leve' });
  ok('E visitante en em post en (WordPress pt): não esconde a página', !e.hidden && e.trinv && e.full === false, { hidden: e.hidden, full: e.full });
  ok('E conteúdo em inglês intacto', has(e.text, 'Growing your own tomatoes'), e.text.slice(0, 80));
  ok('E textos do tema traduzidos para inglês (rodapé)', e.footer && !has(e.footer, 'Criado com') && has(e.footer, 'Created with'), e.footer);
  ok('E menu do rodapé: "Sobre" → "About" (não "On")', has(e.footer, 'About') && !/\bOn\b/.test(e.footer), e.footer);
  ok('E <html lang> não muda no modo leve', e.lang !== 'pt', e.lang);
  ok('E texto do tema traduzido do português ("Written by … in Uncategorized")', /Written by .* in Uncategorized/i.test(e.byline || ''), e.byline);
  ok('E nome do site intacto', e.site === 'Sites', e.site);
  b.close();
}

// ============================================================ F/G/H — outros idiomas de origem e destino
if (run('F')) {
  const b = await browser({ lang: 'pt-BR' });
  const f = await visit(b, `${BASE}/recetas-cena/`);
  ok('F espanhol → português', has(f.text, 'jantar') || has(f.text, 'massa') || has(f.text, 'manjericão'), f.text.slice(0, 200));
  const g = await visit(b, `${BASE}/tokyo-guide/`);
  ok('G japonês → português', has(g.text, 'Tóquio') && !/[ぁ-ん]/.test(g.text), g.text.slice(0, 200));
  b.close();
  const b2 = await browser({ lang: 'de-DE' });
  const h = await visit(b2, `${BASE}/cafe-parfait/`, { shot: 'H-frances-para-alemao' });
  ok('H francês → alemão', h.tl === 'de' && (has(h.text, 'Kaffee') || has(h.text, 'Wasser')), [h.tl, h.text.slice(0, 200)]);
  const h2 = await visit(b2, `${BASE}/economizar-energia/`);
  ok('H português → alemão', has(h2.text, 'Energie') || has(h2.text, 'sparen'), h2.text.slice(0, 200));
  b2.close();
}

// ============================================================ I/J — original para quem pede e para robôs
if (run('I')) {
  const b = await browser({ lang: 'pt-BR' });
  const i = await visit(b, `${EN}?notranslate`);
  ok('I ?notranslate: original, sem rede', has(i.text, 'Growing your own') && !i.trinv && i.n.js === 0, i.n);
  const i2 = await visit(b, EN);
  ok('I continua original na mesma aba (sessão)', has(i2.text, 'Growing your own') && !i2.trinv);
  const i3 = await visit(b, `${EN}?trinv=on`);
  ok('I ?trinv=on volta a traduzir', has(i3.text, 'tomate'), i3.text.slice(0, 80));
  const i4 = await visit(b, `${EN}?trinv_lang=es`);
  ok('I ?trinv_lang=es força espanhol', i4.tl === 'es' && has(i4.text, 'tomates'), [i4.tl, i4.text.slice(0, 120)]);
  await visit(b, `${EN}?trinv=on`);
  b.close();
  const b2 = await browser({ lang: 'pt-BR' });
  const j = await visit(b2, EN, { ua: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', acceptLanguage: 'pt-BR' });
  ok('J Googlebot sempre recebe o original', has(j.text, 'Growing your own') && !j.trinv && j.n.js === 0, j.n);
  const j2 = await visit(b2, EN, { ua: 'Mediapartners-Google', acceptLanguage: 'pt-BR' });
  ok('J robô do AdSense recebe o original', has(j2.text, 'Growing your own') && !j2.trinv);
  b2.close();
}

// ============================================================ K — celular lento (CPU 4× + rede 3G)
if (run('K')) {
  clearCache();
  const b = await browser({ lang: 'pt-BR', w: 390, h: 844 });
  const k = await visit(b, EN, { mobile: true, cpu: 4, net: { latency: 150, down: 1.6 * 1024 * 1024 / 8, up: 750 * 1024 / 8 }, wait: 4000, shot: 'K-celular-lento' });
  ok('K celular lento, 1ª visita sem cache: traduzido', has(k.text, 'tomate'), k.text.slice(0, 120));
  ok('K revelou já traduzida (ou pelo prazo máximo, sem ficar em branco)', k.reveal !== null && !k.stillHidden, [k.reveal, k.stillHidden]);
  console.log(`   ⏱  K (celular lento, sem cache): revelada em ${Math.round(k.reveal)} ms (DCL ${Math.round(k.dcl)} ms); traduzida no momento da revelação: ${has(k.revealText, 'tomate')}`);
  const k2 = await visit(b, EN, { mobile: true, cpu: 4, net: { latency: 150, down: 1.6 * 1024 * 1024 / 8, up: 750 * 1024 / 8 }, wait: 3000 });
  console.log(`   ⏱  K2 (celular lento, com cache): revelada em ${Math.round(k2.reveal)} ms (DCL ${Math.round(k2.dcl)} ms)`);
  ok('K2 com cache revelou já traduzida', has(k2.revealText, 'tomate'), k2.revealText.slice(0, 100));
  b.close();
}

// ============================================================ L — servidor bloqueado pelo Google → navegador traduz direto
if (run('L')) {
  clearCache();
  wp('set_transient("trinv_blocked", 1, 600);');
  const b = await browser({ lang: 'ja' });
  const l = await visit(b, EN, { shot: 'L-servidor-bloqueado' });
  ok('L servidor bloqueado: navegador fala direto com o Google e traduz', /[ぁ-んァ-ン一-龯]/.test(l.text) && l.n.google >= 1, l.n);
  ok('L sem erros no console (CORS ok)', l.errors.length === 0, l.errors);
  wp('delete_transient("trinv_blocked");');
  b.close();
}

// ============================================================ M — REST bloqueado por plugin de segurança → admin-ajax
if (run('M')) {
  clearCache();
  const mu = Buffer.from(`<?php\n// SÓ PARA TESTE: bloqueia a REST do plugin (simula plugin de segurança).\nadd_filter('rest_pre_dispatch', function ($r, $s, $req) { if (0 === strpos($req->get_route(), '/trinv/v1')) { return new WP_Error('rest_forbidden', 'blocked', array('status' => 403)); } return $r; }, 10, 3);\n`).toString('base64');
  ssh(`echo ${mu} | base64 -d > /var/www/sites.reveleonline.com/wp-content/mu-plugins/trinv-test-block-rest.php && php -l /var/www/sites.reveleonline.com/wp-content/mu-plugins/trinv-test-block-rest.php`);
  const b = await browser({ lang: 'pt-BR' });
  const m = await visit(b, EN);
  ok('M REST bloqueado: usa admin-ajax e traduz', has(m.text, 'tomate') && m.n.ajax >= 1, m.n);
  ok('M sem erros de JavaScript', m.errors.filter((e) => !/403/.test(e)).length === 0, m.errors);
  ssh('rm -f /var/www/sites.reveleonline.com/wp-content/mu-plugins/trinv-test-block-rest.php');
  b.close();
}

// ============================================================ N — lista de posts (home) com vários idiomas
if (run('N')) {
  const b = await browser({ lang: 'pt-BR' });
  const n = await visit(b, `${BASE}/`, { shot: 'N-home-lista' });
  ok('N home com posts em vários idiomas: sem erros e revelada', !n.stillHidden && n.errors.length === 0, n.errors);
  ok('N "Blog" do tema não vira "Blogue" e nome do site intacto', !has(n.text, 'Blogue') && n.site === 'Sites', [n.site, n.text.slice(0, 120)]);
  ok('N home com várias línguas: tudo em português', has(n.text, 'tomate') && !has(n.text, 'Recetas fáciles') && !/[ぁ-ん]/.test(n.text) && has(n.text, 'Economizar energia'), n.text.slice(0, 900));
  b.close();
}


// ============================================================ O — HTML servido de cache (arquivo estático, sem PHP)
if (run('O')) {
  const h1 = await (await fetch(EN, { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } })).text();
  const h2 = await (await fetch(EN, { headers: { 'Accept-Language': 'en-US,en;q=0.9', Cookie: 'x=1' } })).text();
  const boot = (h) => (h.match(/<script id="trinv-boot"[\s\S]*?<\/script>/) || [''])[0];
  ok('O HTML do tradutor é igual para visitantes de idiomas diferentes (seguro para cache)', boot(h1) && boot(h1) === boot(h2));
  ssh('curl -s https://sites.reveleonline.com/grow-tomatoes/ > /var/www/sites.reveleonline.com/trinv-cache-test.html && chown www-data /var/www/sites.reveleonline.com/trinv-cache-test.html');
  const b = await browser({ lang: 'pt-BR' });
  const o = await visit(b, `${BASE}/trinv-cache-test.html`, { click: true });
  // o HTML copiado para outro endereço herda a lista de mapas do endereço original → 1 404 esperado (artefato do teste)
  const errs = o.errors.filter((e) => !/uploads\/trinv\/.*404|404.*uploads\/trinv\//.test(e) && !/status of 404/.test(e));
  ok('O página servida como HTML estático (cache): traduzida, botão ok, sem erros', has(o.text, 'tomate') && o.clicks === '2' && errs.length === 0, [o.text.slice(0, 80), o.clicks, o.errors]);
  ok('O HTML estático: revelou já traduzida', has(o.revealText, 'tomate'), o.revealText.slice(0, 100));
  b.close();
  ssh('rm -f /var/www/sites.reveleonline.com/trinv-cache-test.html');
}

// ============================================================ P — otimizador de JS (Autoptimize: junta, adia e inclui inline)
if (run('P')) {
  ssh('cd /var/www/sites.reveleonline.com && sudo -u www-data wp plugin install autoptimize --activate >/dev/null 2>&1; ' + ['autoptimize_js', 'autoptimize_js_aggregate', 'autoptimize_js_include_inline', 'autoptimize_js_defer_inline', 'autoptimize_html'].map((o) => `sudo -u www-data wp option update ${o} on >/dev/null`).join('; ') + '; sudo -u www-data wp option update autoptimize_js_defer_not_aggregate "" >/dev/null; true');
  let html = '';
  for (let i = 0; i < 6; i++) { html = await (await fetch(EN)).text(); if (/cache\/autoptimize\//.test(html)) break; await sleep(700); } // o Autoptimize gera a junção nos primeiros pedidos
  ok('P Autoptimize ativo (scripts agregados em cache/autoptimize)', /cache\/autoptimize\/[^"']+\.(php|js)/.test(html), html.slice(0, 200));
  ok('P boot do tradutor continua inline no <head>', /<script id="trinv-boot"/.test(html));
  const b = await browser({ lang: 'pt-BR' });
  const pp = await visit(b, EN, { click: true });
  ok('P com Autoptimize: traduzido, botão funciona, sem erros do tradutor', has(pp.text, 'tomate') && pp.clicks === '2' && !pp.errors.some((e) => /trinv/i.test(e)), [pp.text.slice(0, 80), pp.clicks, pp.errors]);
  b.close();
  ssh('cd /var/www/sites.reveleonline.com && sudo -u www-data wp plugin deactivate autoptimize --uninstall >/dev/null 2>&1; true');
}

// ============================================================ Q — tema clássico
if (run('Q')) {
  ssh('cd /var/www/sites.reveleonline.com && sudo -u www-data wp theme install twentytwentyone --activate >/dev/null 2>&1; true');
  const b = await browser({ lang: 'pt-BR' });
  const q = await visit(b, EN, { shot: 'Q-tema-classico', click: true });
  ok('Q tema clássico (Twenty Twenty-One): traduzido, botão ok, sem erros', has(q.text, 'tomate') && q.clicks === '2' && q.errors.length === 0, [q.text.slice(0, 80), q.clicks, q.errors]);
  ok('Q tema clássico: revelou já traduzida', has(q.revealText, 'tomate'), q.revealText.slice(0, 100));
  b.close();
  ssh('cd /var/www/sites.reveleonline.com && sudo -u www-data wp theme activate twentytwentyfive >/dev/null 2>&1; sudo -u www-data wp theme delete twentytwentyone >/dev/null 2>&1; true');
}


// ============================================================ R — visitante árabe (direita → esquerda)
if (run('R')) {
  const b = await browser({ lang: 'ar' });
  const r = await visit(b, EN, { shot: 'R-arabe-rtl', click: true });
  const dir = await b.eval(`(function(){var ps=[].slice.call(document.querySelectorAll('.entry-content p, .wp-block-post-content p')).filter(function(p){return p.innerText.trim().length>20&&!p.querySelector('ins')});
    var grid=document.querySelector('.wp-site-blocks');return {n:ps.length,rtl:ps.filter(function(p){return p.getAttribute('dir')==='rtl'}).length,align:ps[0]&&getComputedStyle(ps[0]).direction,
    h1:(document.querySelector('h1')||{}).getAttribute&&document.querySelector('h1').getAttribute('dir'),layout:grid&&grid.getAttribute('dir'),htmlDir:document.documentElement.getAttribute('dir'),bad:ps.filter(function(p){return p.getAttribute('dir')!=='rtl'}).map(function(p){return p.outerHTML.slice(0,300)})}})()`);
  ok('R árabe: conteúdo traduzido', /[\u0600-\u06FF]/.test(r.text) && r.tl === 'ar', [r.tl, r.text.slice(0, 120)]);
  ok('R árabe: parágrafos e título escritos da direita para a esquerda', dir.n > 2 && dir.rtl === dir.n && dir.align === 'rtl' && dir.h1 === 'rtl', dir);
  ok('R árabe: layout do tema não é espelhado (só o texto)', !dir.layout && dir.htmlDir !== 'rtl', dir);
  ok('R árabe: botão continua funcionando e sem erros', r.clicks === '2' && r.errors.length === 0, [r.clicks, r.errors]);
  b.close();
}

// ============================================================ S — tela de ajustes: tradutor oficial (admin logado)
if (run('S')) {
  const FAKE = 'AIzaE2Efake' + Date.now().toString(36) + 'Zq9';
  const saved = wpx('echo wp_json_encode(get_option("trinv_options"));').trim();
  const ck = wpx('echo SECURE_AUTH_COOKIE.PHP_EOL.wp_generate_auth_cookie(1,time()+1800,"secure_auth").PHP_EOL.LOGGED_IN_COOKIE.PHP_EOL.wp_generate_auth_cookie(1,time()+1800,"logged_in");').trim().split('\n');
  const b = await browser({ lang: 'pt-BR', w: 1280, h: 1500 });
  for (const [name, value] of [[ck[0], ck[1]], [ck[2], ck[3]]]) await b.send('Network.setCookie', { name, value, domain: 'sites.reveleonline.com', path: '/', secure: true, httpOnly: true });
  const ADM = `${BASE}/wp-admin/admin.php?page=tradutor-invisivel-ajustes`;
  const st = () => b.eval(`(function(){var f=document.querySelector('.trinv-prov-fields'),r=document.querySelector('.trinv-ms-only'),row=document.getElementById('trinv-official');
    return {fields:f&&getComputedStyle(f).display,region:r&&getComputedStyle(r).display,prov:(document.getElementById('trinv-prov')||{}).value,ph:(document.getElementById('trinv-key')||{}).placeholder,keyVal:(document.getElementById('trinv-key')||{}).value,
    notice:[].map.call(document.querySelectorAll('.notice'),function(n){return n.className+' | '+n.innerText.trim()}).join(' || '),testBtn:!![].filter.call(document.querySelectorAll('button'),function(x){return /Testar tradutor oficial/.test(x.textContent)}).length,
    conn:(function(){var c=[].filter.call(document.querySelectorAll('.trinv-card'),function(x){return /Conexão com o tradutor/.test(x.innerText)})[0];return c?c.innerText.replace(/\\s+/g,' '):''})(),
    leak:document.documentElement.outerHTML.indexOf(${JSON.stringify(FAKE)})>=0,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth}})()`);
  const nav = async (url) => { b.cur = { reqs: [], errors: [], loaded: false }; await b.send('Page.navigate', { url }); for (let i = 0; i < 100 && !b.cur.loaded; i++) await sleep(100); await sleep(600); };
  const shot = async (name) => { const x = await b.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(x.data, 'base64')); };
  const submitAndWait = async (js) => { b.cur = { reqs: [], errors: [], loaded: false }; await b.eval(js); for (let i = 0; i < 150 && !b.cur.loaded; i++) await sleep(100); await sleep(800); };

  await nav(ADM);
  let s0 = await st();
  ok('S tela de ajustes abre logado (linha do tradutor oficial presente)', s0.prov === '' || s0.prov === 'google' || s0.prov === 'microsoft', s0);
  wpx('$o=get_option("trinv_options");$o["provider"]="";$o["provider_key"]="";update_option("trinv_options",$o);delete_transient("trinv_official_health");');
  await nav(ADM);
  s0 = await st();
  ok('S "Nenhum": campos de chave escondidos, sem botão de teste', s0.fields === 'none' && !s0.testBtn, s0);
  await b.eval(`(function(){var s=document.getElementById('trinv-prov');s.value='microsoft';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const sm = await st();
  ok('S escolher Microsoft mostra chave + região na hora (sem recarregar)', sm.fields !== 'none' && sm.region !== 'none', sm);
  await b.eval(`(function(){var s=document.getElementById('trinv-prov');s.value='google';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const sg = await st();
  ok('S Google: chave visível, região escondida', sg.fields !== 'none' && sg.region === 'none', sg);
  await shot('S1-ajustes-google-antes');
  await submitAndWait(`(function(){document.getElementById('trinv-key').value=${JSON.stringify(FAKE)};document.querySelector('#trinv-official input[value=fallback]').checked=true;document.querySelector('form[action="options.php"] #submit').click();})()`);
  const s1 = await st();
  const opt = JSON.parse(wpx('echo wp_json_encode(get_option("trinv_options"));').trim());
  ok('S salvar: chave gravada no servidor, provedor google, modo reserva', opt.provider === 'google' && opt.provider_key === FAKE && opt.provider_mode === 'fallback', { provider: opt.provider, mode: opt.provider_mode, keyOk: opt.provider_key === FAKE });
  ok('S depois de salvar: chave NUNCA volta para a página (só o final no placeholder)', !s1.leak && s1.keyVal === '' && s1.ph.includes(FAKE.slice(-4)), { leak: s1.leak, ph: s1.ph });
  ok('S botão "Testar tradutor oficial" aparece no card de conexão', s1.testBtn && /Google Cloud · reserva/.test(s1.conn), s1.conn);
  await submitAndWait(`(function(){var f=[].filter.call(document.querySelectorAll('button'),function(x){return /Testar tradutor oficial/.test(x.textContent)})[0];f.click();})()`);
  const s2 = await st();
  ok('S teste com chave falsa: aviso de erro claro vindo do Google Cloud', /notice-error/.test(s2.notice) && /(API key not valid|HTTP 400|HTTP 403)/i.test(s2.notice), s2.notice);
  ok('S card de conexão marca "Com erro"', /Com erro/.test(s2.conn), s2.conn);
  ok('S tela sem rolagem lateral e sem erros', !s2.overflow && b.cur.errors.length === 0, [s2.overflow, b.cur.errors]);
  await shot('S2-ajustes-teste-erro');
  await submitAndWait(`(function(){document.querySelector('form[action="options.php"] #submit').click();})()`);
  const keep = JSON.parse(wpx('echo wp_json_encode(get_option("trinv_options"));').trim());
  ok('S salvar de novo com o campo vazio mantém a chave', keep.provider_key === FAKE, { same: keep.provider_key === FAKE });
  const front = await (await fetch(EN)).text();
  ok('S chave não aparece no HTML público', !front.includes(FAKE));
  b.close();
  // visitante com chave falsa em modo reserva: o gratuito continua traduzindo
  clearCache();
  const b2 = await browser({ lang: 'pt-BR' });
  const v = await visit(b2, EN);
  ok('S chave oficial inválida (reserva) não atrapalha: gratuito traduz normal', has(v.text, 'tomate') && v.errors.length === 0, [v.text.slice(0, 80), v.errors]);
  b2.close();
  wpx(`update_option("trinv_options", json_decode(base64_decode("${Buffer.from(saved).toString('base64')}"), true) ?: array()); delete_transient("trinv_official_health"); delete_transient("trinv_official_error");`);
}

// ============================================================ W — pré-tradução pelo painel (idiomas da campanha)
if (run('W')) {
  const saved = wpx('echo wp_json_encode(get_option("trinv_options"));').trim();
  const pid = +wpx('echo url_to_postid("https://sites.reveleonline.com/grow-tomatoes/");').trim();
  wpx('$o=get_option("trinv_options");if(!is_array($o)){$o=array();}$o["campaign"]="es, de, ja";$o["provider"]="";$o["provider_key"]="";update_option("trinv_options",$o);delete_option("trinv_warm_q");delete_post_meta(' + pid + ',"_trinv_warm");');
  clearCache();
  // pixel de anúncio falso: o quadro do painel não pode carregá-lo; o visitante real carrega
  const mu = Buffer.from(`<?php\n// SÓ PARA TESTE: simula um pixel de anúncio.\nadd_action('wp_head', function () { if (is_admin()) { return; } echo '<script async src="https://connect.facebook.net/en_US/fbevents.js"></script><img alt="" height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=1&amp;ev=PageView&amp;noscript=1">'; });\n`).toString('base64');
  ssh(`echo ${mu} | base64 -d > /var/www/sites.reveleonline.com/wp-content/mu-plugins/trinv-test-pixel.php`);
  const fb = (list) => (list || []).filter((u) => /facebook\.(net|com)/.test(u || ''));

  const b = await adminBrowser();
  await b.go(`${BASE}/wp-admin/edit.php`);
  const link = await b.eval(`(function(){var a=document.querySelector('a[href*="trinv_warm_now"][href*="post=${pid}"]');return a?{h:a.getAttribute('href'),t:a.textContent}:null})()`);
  ok('W lista de posts: ação "Pré-traduzir" no post', link && link.t === 'Pré-traduzir', link);
  await b.eval(`document.querySelector('a[href*="trinv_warm_now"][href*="post=${pid}"]').click()`);
  for (let i = 0; i < 50 && !(await b.eval('location.search')).includes('trinv_warm_q'); i++) await sleep(100);
  const notice = await b.eval(`(function(){var n=[].filter.call(document.querySelectorAll('.notice'),function(x){return /pré-tradução/.test(x.innerText)})[0];return n?n.innerText:''})()`);
  ok('W aviso "Página na fila de pré-tradução"', /Página na fila de pré-tradução/.test(notice), notice);
  b.cur = { reqs: [], errors: [], loaded: true, resps: [], failed: [] };
  const w1 = await b.waitPill(/pronto em 3 idiomas/);
  ok('W aviso no canto: andamento por idioma e conclusão', w1.ok && w1.seen.some((t) => /Tradutor Invisível “.*” · pré-traduzindo \d\/3 idiomas/.test(t)) && !w1.last.out, w1);
  await b.shot('W1-aviso-pronto');
  const r1 = b.cur;
  ok('W quadro do painel abriu a página com o token', r1.reqs.some((u) => u.includes('/grow-tomatoes/?trinv_warm=')), r1.reqs.filter((u) => /grow|trinv/.test(u)).slice(0, 5));
  ok('W quadro do painel: nenhum pixel/anúncio de terceiros carregado (CSP)', fb(r1.resps).length === 0, { resps: fb(r1.resps), failed: (r1.failed || []).filter((f) => /facebook/.test(f.url || '')) });
  ok('W sem erros de JavaScript no painel', r1.errors.filter((e) => !/Content Security Policy|facebook|Refused/i.test(e)).length === 0, r1.errors);
  const meta = JSON.parse(wpx(`echo wp_json_encode(get_post_meta(${pid},"_trinv_warm",true));`).trim() || 'null');
  ok('W resultado registrado no post (todos os trechos, 3 idiomas)', meta && meta.ok === meta.total && meta.total > 20 && meta.langs.join() === 'es,de,ja', meta);
  const q = JSON.parse(wpx('echo wp_json_encode(get_option("trinv_warm_q"));').trim() || '[]');
  ok('W fila vazia depois', Array.isArray(q) ? q.length === 0 : Object.keys(q).length === 0, q);
  b.close();

  for (const [lang, test] of [['es', (t) => /tomates/i.test(t)], ['de', (t) => /Tomaten/.test(t)], ['ja', (t) => /[ぁ-んァ-ン一-龯]/.test(t)]]) {
    const v = await browser({ lang });
    const x = await visit(v, EN, { shot: `W-visitante-${lang}` });
    ok(`W 1º visitante ${lang} depois da pré-tradução: página pronta, zero chamadas de tradução, só o mapa estático`, test(x.text) && x.n.t === 0 && x.n.st === 1 && x.n.google === 0 && has(x.revealText, lang === 'ja' ? 'トマト' : lang === 'de' ? 'Tomaten' : 'tomates'), { n: x.n, pedidos: x.posts.map((p) => { try { const j = JSON.parse(p); return j.s.map((t, i) => (j.h[i] ? j.h[i] + ':' : '') + t); } catch { return p.slice(0, 200); } }) });
    if (lang === 'es') ok('W controle: o visitante real carrega o pixel (o teste enxerga pixels)', fb(x.reqs).length > 0, fb(x.reqs));
    console.log(`   ⏱  W ${lang}: revelada em ${Math.round(x.reveal)} ms`);
    v.close();
  }

  // heartbeat: item entra na fila pelo servidor com o painel já aberto (fila vazia no carregamento)
  const b2 = await adminBrowser();
  await b2.go(`${BASE}/wp-admin/index.php`);
  wpx(`TRINV_Warm::enqueue_ids(array(${pid}));`);
  await b2.eval('window.wp && wp.heartbeat && wp.heartbeat.connectNow()');
  const w2 = await b2.waitPill(/pronto em 3 idiomas/, 60000);
  ok('W heartbeat do painel pega a fila sozinho (item entrou depois de abrir o painel)', w2.ok, w2.seen);
  b2.close();

  // editor de blocos: atualizar o post pré-traduz de novo logo depois de salvar
  const at0 = JSON.parse(wpx(`echo wp_json_encode(get_post_meta(${pid},"_trinv_warm",true));`).trim()).at;
  await sleep(1100);
  const b3 = await adminBrowser({ w: 1400, h: 900 });
  await b3.go(`${BASE}/wp-admin/post.php?post=${pid}&action=edit`);
  for (let i = 0; i < 100 && !(await b3.eval(`!!(window.wp&&wp.data&&wp.data.select('core/editor')&&wp.data.select('core/editor').getCurrentPostId())`)); i++) await sleep(200);
  await b3.eval(`wp.data.dispatch('core/editor').savePost()`);
  const w3 = await b3.waitPill(/pronto em 3 idiomas/, 60000);
  const at1 = JSON.parse(wpx(`echo wp_json_encode(get_post_meta(${pid},"_trinv_warm",true));`).trim()).at;
  ok('W editor de blocos: salvar dispara a pré-tradução na hora', w3.ok && at1 > at0, { seen: w3.seen, at0, at1 });
  ok('W aviso: título longo encurta, status inteiro e dentro da tela', w3.last && w3.last.cut && /pronto em 3 idiomas$/.test(w3.last.t) && !w3.last.out, w3.last);
  await b3.shot('W3-editor-blocos');
  ok('W editor de blocos sem erros do tradutor', !b3.cur.errors.some((e) => /trinv/i.test(e)), b3.cur.errors);
  b3.close();

  // tela de ajustes com os idiomas da campanha
  const b4 = await adminBrowser({ h: 1400 });
  await b4.go(`${BASE}/wp-admin/admin.php?page=tradutor-invisivel-ajustes`);
  const row = await b4.eval(`(function(){var r=document.getElementById('trinv-campaign');return r?{v:document.getElementById('trinv-camp').value,t:r.innerText.replace(/\\s+/g,' '),ov:document.documentElement.scrollWidth>document.documentElement.clientWidth}:null})()`);
  ok('W ajustes: idiomas da campanha, botão e fila', row && row.v === 'es, de, ja' && /Pré-traduzir as 20 mais recentes/.test(row.t) && /Fila vazia/.test(row.t) && !row.ov, row);
  await b4.shot('W4-ajustes-campanha');
  b4.close();

  ssh('rm -f /var/www/sites.reveleonline.com/wp-content/mu-plugins/trinv-test-pixel.php');
  wpx(`update_option("trinv_options", json_decode(base64_decode("${Buffer.from(saved).toString('base64')}"), true) ?: array()); delete_option("trinv_warm_q");`);
}

// ============================================================ U — endereço (URL) traduzido
if (run('U')) {
  clearCache();
  const JA = /[ぁ-んァ-ン一-龯]/;
  const b = await browser({ lang: 'pt-BR' });
  const u = await visit(b, `${EN}?utm_source=fb#topo`, { wait: 4000 });
  const loc = await b.eval('({p: location.pathname, s: location.search, h: location.hash, lp: window.__tl.loadPath, t: document.title})');
  ok('U pt: endereço vira o traduzido, com os parâmetros e a âncora', loc.p !== '/grow-tomatoes/' && /tomate/.test(decodeURIComponent(loc.p)) && loc.s === '?utm_source=fb' && loc.h === '#topo', loc);
  ok('U no carregamento (pixels de anúncio) o endereço ainda é o original', loc.lp === '/grow-tomatoes/', loc.lp);
  ok('U título da aba traduzido, com o nome do site intacto', /Sites$/.test(loc.t) && !/Growing|Locais/.test(loc.t), loc.t);
  b.close();
  const tr = BASE + loc.p;
  const res = await fetch(tr);
  const html = await res.text();
  ok('U endereço traduzido responde 200 e o canonical continua no original', res.status === 200 && /rel="canonical" href="https:\/\/sites\.reveleonline\.com\/grow-tomatoes\/"/.test(html), [res.status, (html.match(/rel="canonical"[^>]+/) || [''])[0]]);
  const b2 = await browser({ lang: 'pt-BR' });
  const v2 = await visit(b2, tr, { wait: 3500 });
  ok('U endereço traduzido aberto direto: traduzido, sem erros, e o endereço fica', has(v2.text, 'tomate') && (await b2.eval('location.pathname')) === loc.p && v2.errors.length === 0, [v2.errors, v2.text.slice(0, 80)]);
  ok('U aberto pelo endereço traduzido usa o cache do original (mapa estático)', v2.n.st === 1, v2.n);
  b2.close();
  const b3 = await browser({ lang: 'en-US' });
  await visit(b3, tr, { wait: 3500 });
  ok('U visitante em inglês no endereço em português: volta ao endereço original', (await b3.eval('location.pathname')) === '/grow-tomatoes/', await b3.eval('location.pathname'));
  b3.close();
  const b4 = await browser({ lang: 'es-ES' });
  const v4 = await visit(b4, tr, { wait: 4500 });
  const p4 = await b4.eval('location.pathname');
  ok('U visitante espanhol no endereço em português: vai para o endereço em espanhol', p4 !== loc.p && p4 !== '/grow-tomatoes/' && has(v4.text, 'tomates'), decodeURIComponent(p4));
  b4.close();
  const b5 = await browser({ lang: 'pt-BR' });
  await visit(b5, `${BASE}/about-us/`, { wait: 4500 });
  const p5 = await b5.eval('location.pathname');
  ok('U página "About us" para pt: endereço traduzido', p5 !== '/about-us/' && /sobre/i.test(decodeURIComponent(p5)), decodeURIComponent(p5));
  ok('U endereço traduzido da página responde 200', (await fetch(BASE + p5)).status === 200);
  b5.close();
  const b6 = await browser({ lang: 'ja' });
  await visit(b6, EN, { wait: 4500 });
  const p6 = await b6.eval('location.pathname');
  ok('U japonês: endereço em japonês', JA.test(decodeURIComponent(p6)), decodeURIComponent(p6));
  ok('U endereço em japonês responde 200', (await fetch(BASE + p6)).status === 200);
  b6.close();
  const b7 = await browser({ lang: 'pt-BR' });
  await visit(b7, `${BASE}/economizar-energia/`, { wait: 3500 });
  ok('U post em português para visitante pt: endereço original', (await b7.eval('location.pathname')) === '/economizar-energia/');
  b7.close();
  const b8 = await browser({ lang: 'pt-BR' });
  const v8 = await visit(b8, `${BASE}/`, { wait: 3000 });
  ok('U home: título da aba é o nome do site (não "Locais")', v8.title === 'Sites' || /Sites/.test(v8.title) && !/Locais/.test(v8.title), v8.title);
  b8.close();
}

// ============================================================ X — 100% traduzido: temas × visitantes × páginas
if (run('X')) {
  const strip = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const phr = {};
  const add = (l, t) => { if (!/GreenThumb|TOMATO10|Advertisement/i.test(t)) (phr[l] = phr[l] || new Set()).add(t); };
  const KIT = path.dirname(new URL(import.meta.url).pathname);
  for (const [file, l] of [['en.html', 'en'], ['about.html', 'en'], ['es.html', 'es'], ['fr.html', 'fr'], ['pt.html', 'pt']]) {
    for (const sent of strip(fs.readFileSync(`${KIT}/content/${file}`, 'utf8')).split(/(?<=[.!?:])\s+/)) {
      const w = sent.split(' ').filter(Boolean);
      if (w.length >= 4) add(l, w.slice(0, 4).join(' '));
    }
  }
  [['en', 'Growing Tomatoes at Home'], ['en', 'About us'], ['es', 'Recetas fáciles para la cena'], ['fr', 'Le secret du café parfait'], ['pt', 'Como economizar energia em casa'],
    ['es', 'Me encantó este artículo'], ['en', 'Great tips, I switched'], ['pt', 'Adorei o guia, vou plantar']].forEach(([l, t]) => add(l, t));
  ['Escrito por', 'Sem categoria', 'Deixe um comentário', 'Deixe uma resposta', 'Criado com', 'Pular para o conteúdo', 'Ir para o conteúdo', 'Posts relacionados',
    'Publicar comentário', 'Salvar meus dados', 'Leia mais', 'Continuar lendo', 'de setembro de', 'Campos obrigatórios', 'endereço de e-mail', 'Tema WordPress por', 'Navegação de posts'].forEach((t) => add('pt', t));
  const JA = /[ぁ-んァ-ン一-龯]/;
  const fam = (c) => (c === 'pt-PT' ? 'pt' : c);
  const SAME = { es: ['Escrito por'] }; // frases que são iguais na língua do visitante (tradução correta)
  const leftovers = (text, V) => {
    const low = text.toLowerCase(), out = [];
    for (const [l, set] of Object.entries(phr)) if (fam(l) !== fam(V)) for (const t of set) if (!(SAME[V] || []).includes(t) && low.includes(t.toLowerCase())) out.push(`${l}: ${t}`);
    if (V !== 'ja' && JA.test(text)) out.push('ja: ' + (text.match(/[ぁ-んァ-ン一-龯][^\n]{0,24}/) || [''])[0]);
    return out;
  };
  const THEMES = (process.env.TRINV_THEMES || 'twentytwentyfive,kadence,twentytwentyone').split(',');
  const VISITORS = [['pt-BR', 'pt'], ['en-US', 'en'], ['es-ES', 'es'], ['ja', 'ja'], ['de-DE', 'de'], ['ar', 'ar']];
  const PAGES = ['/grow-tomatoes/', '/recetas-cena/', '/cafe-parfait/', '/tokyo-guide/', '/economizar-energia/', '/about-us/', '/', '/category/sem-categoria/', '/author/julioreisdev/', '/?s=tomate', '/pagina-que-nao-existe/'];
  // linhas do original que NÃO podem continuar iguais para quem lê em alemão/árabe (nenhum conteúdo de teste está nessas línguas)
  const KEEP = /GreenThumb|TOMATO10|^Advertisement$|julioreisdev|Lucía|Mark|Joana|Kadence WP|^Sites$|^[\d\W]+$|@|https?:/;
  const linesOf = (t) => t.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l.split(' ').length >= 2 && (l.match(/\p{L}/gu) || []).length >= 6 && !KEEP.test(l));
  const before = ssh('cd /var/www/sites.reveleonline.com && sudo -u www-data wp theme list --status=active --field=name').trim();
  clearCache();
  for (const theme of THEMES) {
    ssh(`cd /var/www/sites.reveleonline.com && (sudo -u www-data wp theme is-installed ${theme} || sudo -u www-data wp theme install ${theme} >/dev/null 2>&1); sudo -u www-data wp theme activate ${theme} >/dev/null 2>&1; true`);
    const bad = [];
    let checked = 0;
    const base = {};
    const bb = await browser({ lang: 'pt-BR' });
    for (const pg of PAGES) {
      const v = await visit(bb, BASE + pg + (pg.includes('?') ? '&' : '?') + 'notranslate', { wait: 800 });
      base[pg] = { lines: linesOf(v.text), title: v.title, copy: (v.text.match(/© ?\d{4} Sites/) || [null])[0] };
    }
    bb.close();
    for (const [lang, V] of VISITORS) {
      const b = await browser({ lang, w: 1280, h: 900 });
      for (const pg of PAGES) {
        const v = await visit(b, BASE + pg, { wait: 1500 });
        const strict = (t) => (V === 'de' || V === 'ar' ? base[pg].lines.filter((l) => new Set(linesOf(t)).has(l)).map((l) => 'igual ao original: ' + l) : []);
        let text = v.text + '\n' + v.title, lo = leftovers(text, V).concat(strict(v.text));
        for (let i = 0; i < 9 && lo.length; i++) { await sleep(1000); const t2 = await b.eval('document.body.innerText'); const tt = await b.eval('document.title'); text = t2 + '\n' + tt; lo = leftovers(text, V).concat(strict(t2)); }
        const ttl = await b.eval('document.title');
        if (/Locais/.test(ttl) || (/Sites/.test(base[pg].title) && !/Sites/.test(ttl))) lo.push('título sem o nome do site: ' + ttl);
        if (base[pg].copy && !text.includes(base[pg].copy)) lo.push('rodapé sem o nome do site: ' + ((text.match(/©[^\n]{0,40}/) || [''])[0]));
        // "Por <autor>" traduzido como o verbo pôr (Setzen/Poner/Mettre/Put): o rótulo tem de sair pelo original "By"
        // textos de tema em inglês (tema sem tradução) que não podem sobrar para quem não lê inglês
        const ENTHEME = /\b(Published|Categorized as|Tagged|Leave a comment|Leave a Reply|Posted by|Posted on|Read more|Continue reading|Older posts|Newer posts|Previous post|Next post|Skip to content)\b/;
        if (V !== 'en' && ENTHEME.test(text)) lo.push('texto de tema em inglês: ' + text.match(ENTHEME)[0]);
        const POR = { de: /\bSetzen\b/, es: /\bPoner\b/, fr: /\bMettre\b/, en: /^Put\b/m };
        if (POR[V] && POR[V].test(text)) lo.push('"Por" traduzido como verbo: ' + ((text.match(POR[V]) || [''])[0]));
        const flash = v.full && v.reveal !== null ? leftovers(v.revealText || '', V).filter((x) => !/^pt: /.test(x) || fam(V) !== 'pt') : [];
        checked++;
        // a espera máxima é de 3 s (C.mw): só é problema se continuar escondida depois disso
        let hidden = v.stillHidden;
        for (let i = 0; i < 20 && hidden; i++) { await sleep(200); hidden = await b.eval("document.documentElement.classList.contains('trinv-wait') && getComputedStyle(document.body).opacity === '0'"); }
        const errs = v.errors.filter((e) => !(pg === '/pagina-que-nao-existe/' && /status of 404/.test(e))); // a própria página 404
        if (lo.length || hidden || errs.length) bad.push({ V, pg, sobrou: lo.slice(0, 6), escondida: hidden, erros: errs.slice(0, 2) });
        if (pg === '/economizar-energia/' && (V === 'pt' || V === 'en')) {
          const x = await b.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
          fs.writeFileSync(`${OUT}/X-${theme}-${V}-economizar.png`, Buffer.from(x.data, 'base64'));
        }
        if (flash.length && V !== 'pt') bad.push({ V, pg, apareceu_antes_de_traduzir: flash.slice(0, 4) });
      }
      b.close();
    }
    const sum = {};
    for (const x of bad) for (const t of [...(x.sobrou || []).map((y) => 'sobrou ' + y), ...(x.apareceu_antes_de_traduzir || []).map((y) => 'antes ' + y), ...(x.erros || []), ...(x.escondida ? ['escondida'] : [])]) (sum[`${x.V} · ${t}`] = sum[`${x.V} · ${t}`] || []).push(x.pg);
    if (bad.length) console.log(`   X ${theme} — resumo completo: ${JSON.stringify(sum)}`);
    ok(`X ${theme}: ${checked} páginas (6 idiomas × ${PAGES.length} páginas) 100% traduzidas, sem erros`, bad.length === 0, Object.keys(sum).length + ' problema(s)');
  }
  ssh(`cd /var/www/sites.reveleonline.com && sudo -u www-data wp theme activate ${before} >/dev/null 2>&1; true`);
}

// ============================================================ EL — página de vendas do Elementor (setup-ecosystem.sh)
// linhas do original que não podem continuar iguais depois da tradução (nomes próprios, números e o tema ficam de fora)
const KEEP2 = /GreenThumb|TOMATO10|^Advertisement$|julioreisdev|Lucía|Mark|Joana|Sarah Miller|Kadence WP|^Sites$|^[\d\W]+$|@|https?:/;
const linesOf2 = (t) => t.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l.split(' ').length >= 2 && (l.match(/\p{L}/gu) || []).length >= 6 && !KEEP2.test(l));
// a linha original já está no idioma do visitante? (o site de teste tem conteúdo em en, es, fr, ja e pt)
const inLang = (V, l) => V === 'ja' ? /[ぁ-んァ-ン一-龯]/.test(l)
  : V === 'es' ? !/[ãõçêâ]|[ぁ-んァ-ン一-龯]/i.test(l) && !/\b(the|and|your|you|with|this|vous|est|les|avec|pour|não|você)\b/i.test(l)
  : false;
async function untranslated(b, base, V) {
  // linhas do original que continuam iguais e não estão no idioma do visitante
  if (V === 'pt' || V === 'en') return [];
  const now = new Set(linesOf2(await b.eval('document.body.innerText')));
  return base.filter((l) => now.has(l) && !inLang(V, l));
}
if (run('EL')) {
  const PG = '/tomato-course/';
  const pid = wp('echo get_page_by_path("tomato-course")->ID;').trim();
  clearCache();
  const b0 = await browser({ lang: 'pt-BR', w: 1280, h: 2400 }); // alto: o título com animação de entrada só aparece na tela
  const o = await visit(b0, BASE + PG + '?notranslate', { wait: 1500 });
  const bodyClass = await b0.eval('document.body.className');
  b0.close();
  const baseLines = linesOf2(o.text);
  const ORIG_EN = ['Grow juicy tomatoes on your balcony', 'Start the course today', 'Lifetime access to every lesson', 'Happy students', 'How long until my first harvest?', 'Join thousands of happy gardeners'];
  ok('EL página do Elementor montada (widgets renderizados)', ORIG_EN.every((x) => has(o.text, x)) && /elementor-page/.test(bodyClass), [bodyClass, o.text.slice(0, 300)]);
  const INTERACT = `(async function(){var s=function(ms){return new Promise(function(r){setTimeout(r,ms)})};
    var acc=document.querySelectorAll('.elementor-accordion .elementor-tab-title');acc[1].click();await s(700);
    var tabs=document.querySelectorAll('.elementor-tabs-wrapper .elementor-tab-title');tabs[1].click();await s(700);
    var al=document.querySelector('.elementor-alert-dismiss');al&&al.click();await s(500);
    var counter=document.querySelector('.elementor-counter-number');
    return {acc2:document.querySelectorAll('.elementor-accordion .elementor-tab-content')[1].innerText.trim(),acc2open:getComputedStyle(document.querySelectorAll('.elementor-accordion .elementor-tab-content')[1]).display!=='none',
      tab2:[].filter.call(document.querySelectorAll('.elementor-tabs-content-wrapper .elementor-tab-content'),function(x){return getComputedStyle(x).display!=='none'}).map(function(x){return x.innerText.trim()})[0],
      alertGone:!document.querySelector('.elementor-alert')||getComputedStyle(document.querySelector('.elementor-alert')).display==='none'||document.querySelector('.elementor-alert').offsetHeight===0,
      counter:counter&&counter.textContent.trim(),href:(document.querySelector('.elementor-button')||{}).href,
      name:(document.querySelector('.elementor-testimonial-name')||{}).textContent,anim:(document.querySelector('.elementor-invisible, .animated')||{className:''}).className,
      title:document.title,path:location.pathname}})()`;
  for (const [lang, V] of [['de-DE', 'de'], ['pt-BR', 'pt'], ['es-ES', 'es'], ['ja', 'ja'], ['ar', 'ar'], ['en-US', 'en']]) {
    const b = await browser({ lang, w: 1280, h: 2400 });
    const v = await visit(b, BASE + PG, { wait: 2500, shot: `EL-${V}` });
    let left = await untranslated(b, baseLines, V);
    for (let i = 0; i < 6 && left.length; i++) { await sleep(800); left = await untranslated(b, baseLines, V); }
    const enLeft = V === 'en' ? [] : ORIG_EN.filter((x) => has(v.text, x));
    const x = await b.eval(INTERACT);
    await sleep(1200);
    const path2 = await b.eval('location.pathname');
    ok(`EL ${V}: conteúdo do Elementor 100% traduzido`, !left.length && !enLeft.length, { left, enLeft });
    if (V !== 'en') ok(`EL ${V}: sanfona e abas escondidas também traduzidas, alerta fecha, contador e link intactos, nome do depoimento preservado`,
      x.acc2open && !/No\. A sunny balcony/.test(x.acc2) && x.acc2.length > 10 && x.tab2 && !/heirloom/.test(x.tab2) && x.alertGone && x.counter === '1,250' && x.href === 'https://example.com/checkout' && x.name === 'Sarah Miller', x);
    else ok('EL en: página já em inglês — nada escondido e conteúdo intacto', !v.hidden && has(v.text, 'Grow juicy tomatoes') && x.counter === '1,250', [v.mode, v.hidden]);
    ok(`EL ${V}: título traduzido com o separador e o nome do site intactos`, / – Sites$/.test(x.title) && (V === 'en' || !/Tomato growing course/.test(x.title)), x.title);
    ok(`EL ${V}: sem erros no console`, !v.errors.length, v.errors);
    if (V !== 'en') ok(`EL ${V}: endereço traduzido na barra`, path2 !== PG && path2.length > 3, path2);
    if (V === 'de') {
      const direct = await visit(b, BASE + path2, { wait: 1500 });
      ok('EL de: o endereço traduzido abre a mesma página (200, traduzida)', !direct.errors.length && has(direct.text, 'Tomaten') && !has(direct.text, 'Grow juicy'), [path2, direct.errors, direct.text.slice(0, 200)]);
    }
    b.close();
  }
  // o próprio editor do Elementor (dono logado): o tradutor não roda no editor nem na prévia
  const editor = async (shot) => {
    const a = await adminBrowser({ w: 1440, h: 900 });
    await a.go(`${BASE}/wp-admin/post.php?post=${pid}&action=elementor`);
    let ed = null;
    for (let i = 0; i < 90; i++) {
      ed = await a.eval(`(function(){var f=document.getElementById('elementor-preview-iframe');var w=f&&f.contentWindow;var ld=document.getElementById('elementor-loading');var h=w&&w.document&&w.document.querySelector('.elementor-widget-heading .elementor-heading-title');return {ready:!!(window.elementor&&ld&&getComputedStyle(ld).display==='none'&&h),panel:!!document.querySelector('#elementor-panel-elements, .elementor-panel'),trinvTop:!!window.__trinv,trinvPreview:!!(w&&w.__trinv),bootPreview:!!(w&&w.document&&w.document.getElementById('trinv-boot')),heading:h?h.textContent.trim():null}})()`);
      if (ed.ready) break;
      await sleep(1000);
    }
    await a.shot(shot);
    const errs = a.cur.errors.slice(0, 6);
    a.close();
    return { ed, errs };
  };
  const on = await editor('EL-editor');
  const edErr = on.errs.filter((e) => /trinv/i.test(e));
  ok('EL editor do Elementor abre, prévia sem o tradutor e texto original intacto', on.ed.ready && !on.ed.trinvTop && !on.ed.trinvPreview && !on.ed.bootPreview && on.ed.heading === 'Grow juicy tomatoes on your balcony' && !edErr.length, on);
  if (!on.ed.ready && process.env.EL_COMPARE) {
    ssh('cd /var/www/sites.reveleonline.com && sudo -u www-data wp plugin deactivate tradutor-invisivel >/dev/null 2>&1; true');
    const off = await editor('EL-editor-sem-plugin');
    ssh('cd /var/www/sites.reveleonline.com && sudo -u www-data wp plugin activate tradutor-invisivel >/dev/null 2>&1; true');
    console.log('   editor SEM o tradutor:', JSON.stringify(off));
  }
}

// ============================================================ WC — loja WooCommerce: loja, produto, carrinho e checkout em blocos (React), pedido
async function waitFor(b, expr, ms = 15000) {
  for (let i = 0; i < ms / 250; i++) { try { const v = await b.eval(expr); if (v) return v; } catch {} await sleep(250); }
  return null;
}
async function nav(b, url, wait = 1500) { // navegação "de verdade" (clique/envio) mantendo o registro de erros
  b.cur = { reqs: [], errors: [], loaded: false };
  await b.send('Page.navigate', { url });
  for (let i = 0; i < 200 && !b.cur.loaded; i++) await sleep(100);
  await sleep(wait);
}
async function typeInto(b, sel, text) {
  await b.eval(`(function(){var e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;e.scrollIntoView({block:'center'});e.focus();if(e.select)e.select();return true})()`);
  await b.send('Input.insertText', { text });
  await sleep(120);
}
const shotTo = async (b, name) => { const x = await b.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(x.data, 'base64')); };
const WC_EN = /Organic tomato seeds|Self-watering pot|Add to cart|Proceed to checkout|Place order|Order summary|Contact information|Billing address|Payment options|Cash on delivery|Your cart|Estimated total|Order received|Thank you/;
if (run('WC')) {
  clearCache();
  const VIS = (process.env.WC_LANGS || 'de-DE:de,ja:ja,ar:ar,pt-BR:pt').split(',').map((x) => x.split(':'));
  for (const [lang, V] of VIS) {
    const b = await browser({ lang, w: 1280, h: 1800 });
    const errs = [];
    const keepErr = () => { errs.push(...(b.cur ? b.cur.errors : [])); };
    // loja (arquivo de produtos) + "adicionar ao carrinho" por AJAX
    const shop = await visit(b, BASE + '/shop/', { wait: 2500 });
    errs.push(...shop.errors);
    const shopLeft = (shop.text.match(WC_EN) || [])[0];
    b.cur = { reqs: [], errors: [], loaded: true };
    await b.eval(`(document.querySelector('a.add_to_cart_button[data-product_id]')||{click:function(){}}).click()`);
    const viewCart = await waitFor(b, `(function(){var a=document.querySelector('a.added_to_cart');return a&&a.textContent.trim()})()`, 8000);
    await sleep(1500);
    const viewCart2 = await b.eval(`(function(){var a=document.querySelector('a.added_to_cart');return a&&a.textContent.trim()})()`);
    keepErr();
    ok(`WC ${V}: loja traduzida e "adicionar ao carrinho" (AJAX) funciona; "Ver carrinho" que aparece depois também traduzido`, !shopLeft && viewCart && (V === 'en' || !/View cart/i.test(viewCart2)), { shopLeft, viewCart2, text: shop.text.slice(0, 400) });
    // produto: endereço traduzido + formulário de compra
    const prod = await visit(b, BASE + '/product/self-watering-pot/', { wait: 2000 });
    errs.push(...prod.errors);
    const swapped = await waitFor(b, `location.pathname !== '/product/self-watering-pot/' && location.pathname`, 9000);
    ok(`WC ${V}: página do produto traduzida e endereço traduzido (${swapped})`, !(prod.text.match(WC_EN) || [])[0] && !!swapped, [(prod.text.match(WC_EN) || [])[0], swapped]);
    b.cur = { reqs: [], errors: [], loaded: false };
    await b.eval(`document.querySelector('form.cart button[name="add-to-cart"], form.cart button.single_add_to_cart_button').click()`);
    for (let i = 0; i < 100 && !b.cur.loaded; i++) await sleep(100);
    await sleep(2500);
    const notice = await b.eval(`(function(){var n=document.querySelector('.woocommerce-message, .wc-block-components-notice-banner');return n&&n.innerText.replace(/\\s+/g,' ').trim()})()`);
    keepErr();
    ok(`WC ${V}: enviar o formulário de compra funciona e o aviso "adicionado ao carrinho" sai traduzido`, notice && (V === 'en' || !/has been added|have been added|View cart/i.test(notice)), notice);
    // carrinho em blocos (React)
    await nav(b, BASE + '/cart/', 500);
    const cartReady = await waitFor(b, `document.querySelector('.wc-block-cart-items .wc-block-components-product-name') && !document.documentElement.classList.contains('trinv-wait')`, 15000);
    await sleep(2500);
    const cart1 = await b.eval(`({text:document.querySelector('.wp-block-woocommerce-cart').innerText,path:location.pathname,qty:[].map.call(document.querySelectorAll('.wc-block-components-quantity-selector__input'),function(i){return i.value}),total:(document.querySelector('.wc-block-components-totals-footer-item .wc-block-components-totals-item__value')||{}).textContent})`);
    await b.eval(`(document.querySelector('.wc-block-components-quantity-selector__button--plus')||{click:function(){}}).click()`);
    const changed = await waitFor(b, `(function(){var t=(document.querySelector('.wc-block-components-totals-footer-item .wc-block-components-totals-item__value')||{}).textContent;return t&&t!==${JSON.stringify(cart1.total || '')}&&t})()`, 10000);
    await sleep(2500);
    await shotTo(b, `WC-${V}-carrinho`);
    const cart2 = await b.eval(`({text:document.querySelector('.wp-block-woocommerce-cart').innerText,qty:[].map.call(document.querySelectorAll('.wc-block-components-quantity-selector__input'),function(i){return i.value})})`);
    keepErr();
    const cartPath = await waitFor(b, `location.pathname !== '/cart/' && location.pathname`, 10000);
    const menuText = await b.eval(`(document.querySelector('header nav, nav') || {innerText:''}).innerText`);
    ok(`WC ${V}: carrinho (React) traduzido, endereço traduzido (${decodeURIComponent(cartPath || '')}) e menu da loja com palavras de loja`, cartReady && !(cart1.text.match(WC_EN) || [])[0] && !!cartPath && !/Check-out|Confira|Checkout/.test(V === 'pt' ? menuText : '') && (V !== 'pt' || /Finalizar compra/.test(menuText)), [(cart1.text.match(WC_EN) || [])[0], cartPath, menuText, cart1.text.slice(0, 200)]);
    ok(`WC ${V}: mudar a quantidade atualiza o total na tela e o carrinho continua traduzido`, !!changed && !(cart2.text.match(WC_EN) || [])[0], { before: cart1.total, after: changed, qty: cart2.qty, left: (cart2.text.match(WC_EN) || [])[0] });
    // checkout em blocos (React) + pedido
    await nav(b, BASE + '/checkout/', 500);
    await waitFor(b, `document.querySelector('.wc-block-checkout__form #email') && !document.documentElement.classList.contains('trinv-wait')`, 15000);
    await sleep(2500);
    const ck = await b.eval(`({text:document.querySelector('.wp-block-woocommerce-checkout').innerText,path:location.pathname,fields:[].map.call(document.querySelectorAll('.wc-block-checkout__form input, .wc-block-checkout__form select'),function(i){return i.id+':'+i.type})})`);
    if (process.env.WC_DEBUG) console.log(JSON.stringify(ck.fields));
    await shotTo(b, `WC-${V}-checkout`);
    const ckPath = await waitFor(b, `location.pathname !== '/checkout/' && location.pathname`, 10000);
    const ckTitle = await b.eval('document.title + " | " + ((document.querySelector("h1")||{}).innerText||"")');
    ok(`WC ${V}: checkout (React) traduzido, endereço traduzido (${decodeURIComponent(ckPath || '')}), título sem "Confira"/"Check-out"`, !(ck.text.match(WC_EN) || [])[0] && !!ckPath && !/Confira|Check-out|Checkout/.test(V === 'pt' ? ckTitle : ''), [(ck.text.match(WC_EN) || [])[0], ckPath, ckTitle, ck.text.slice(0, 300)]);
    await typeInto(b, '#email', `trinv-test-${V}@example.com`);
    for (const [sel, val] of [['#billing-first_name', 'Ana'], ['#billing-last_name', 'Teste'], ['#billing-address_1', 'Rua das Flores 100'], ['#billing-city', 'São Paulo'], ['#billing-postcode', '01001-000'], ['#billing-phone', '11999999999']]) {
      if (await b.eval(`!!document.querySelector(${JSON.stringify(sel)})`)) await typeInto(b, sel, val);
    }
    await b.eval(`(function(){var s=document.querySelector('#billing-state');if(!s||s.tagName!=='SELECT')return;var set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;set.call(s,'SP');s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    await sleep(1500);
    b.cur.loaded = false;
    await b.eval(`document.querySelector('.wc-block-components-checkout-place-order-button').click()`);
    const received = await waitFor(b, `/order-received/.test(location.pathname) && document.readyState === 'complete' && location.pathname`, 30000);
    await sleep(3000);
    const thanks = received ? await b.eval(`({text:document.body.innerText.slice(0,3000),path:location.pathname,search:location.search})`) : await b.eval(`({text:(document.querySelector('.wc-block-components-notices, .wc-block-store-notices')||document.body).innerText.slice(0,600),path:location.pathname})`);
    keepErr();
    if (received) await shotTo(b, `WC-${V}-pedido`);
    ok(`WC ${V}: pedido feito pelo checkout traduzido; página "pedido recebido" traduzida e com o endereço/chave originais`, !!received && /^\/checkout\/order-received\/\d+\/$/.test(thanks.path) && /key=wc_order_/.test(thanks.search || '') && !(thanks.text.match(WC_EN) || [])[0], thanks);
    if (received) ok(`WC ${V}: nome e endereço do comprador ficam como ele digitou (não traduzidos)`, /Ana Teste/.test(thanks.text) && /Rua das Flores 100/.test(thanks.text) && /São Paulo/.test(thanks.text), thanks.text.slice(-500));
    const bad = errs.filter((e) => !/favicon|sendmail|status of 40[34]/i.test(e));
    ok(`WC ${V}: nenhum erro no console (React intacto)`, !bad.length, bad.slice(0, 5));
    b.close();
  }
  // limpa os pedidos de teste
  wpx('foreach (wc_get_orders(array("limit" => -1, "return" => "ids")) as $id) { $o = wc_get_order($id); if ($o && 0 === strpos((string) $o->get_billing_email(), "trinv-test-")) $o->delete(true); }');
}

// ============================================================ WCC — carrinho e checkout CLÁSSICOS (shortcode + jQuery, AJAX que reescreve a página)
if (run('WCC')) {
  // troca o conteúdo das páginas de carrinho/checkout pelos shortcodes e restaura no fim
  const saved = wpx('echo wp_json_encode(array(get_post_field("post_content", wc_get_page_id("cart")), get_post_field("post_content", wc_get_page_id("checkout"))));');
  wpx('wp_update_post(array("ID" => wc_get_page_id("cart"), "post_content" => "<!-- wp:shortcode -->[woocommerce_cart]<!-- /wp:shortcode -->")); wp_update_post(array("ID" => wc_get_page_id("checkout"), "post_content" => "<!-- wp:shortcode -->[woocommerce_checkout]<!-- /wp:shortcode -->"));');
  try {
    clearCache();
    for (const [lang, V] of (process.env.WC_LANGS || 'de-DE:de,ja:ja,ar:ar').split(',').map((x) => x.split(':'))) {
      const b = await browser({ lang, w: 1280, h: 1800 });
      const errs = [];
      const keepErr = () => { errs.push(...(b.cur ? b.cur.errors : [])); };
      const prod = await visit(b, BASE + '/product/organic-tomato-seeds/', { wait: 1500 });
      errs.push(...prod.errors);
      b.cur = { reqs: [], errors: [], loaded: false };
      await b.eval(`document.querySelector('form.cart button.single_add_to_cart_button').click()`);
      for (let i = 0; i < 100 && !b.cur.loaded; i++) await sleep(100);
      await sleep(1500);
      keepErr();
      await nav(b, BASE + '/cart/', 2500);
      const c1 = await b.eval(`({text:document.querySelector('.woocommerce').innerText,total:(document.querySelector('.order-total .amount')||{}).textContent,path:location.pathname})`);
      await b.eval(`(function(){var q=document.querySelector('.woocommerce-cart-form input.qty');q.value='3';q.dispatchEvent(new Event('change',{bubbles:true}));var u=document.querySelector('button[name="update_cart"]');u.disabled=false;u.removeAttribute('disabled');u.click()})()`);
      const c2total = await waitFor(b, `(function(){var t=(document.querySelector('.order-total .amount')||{}).textContent;return t&&t!==${JSON.stringify(c1.total || '')}&&t})()`, 15000);
      await sleep(2500);
      const c2 = await b.eval(`({text:document.querySelector('.woocommerce').innerText,notice:(document.querySelector('.woocommerce-message')||{innerText:''}).innerText})`);
      await shotTo(b, `WCC-${V}-carrinho`);
      keepErr();
      const wccCart = await waitFor(b, `location.pathname !== '/cart/' && location.pathname`, 10000);
      ok(`WCC ${V}: carrinho clássico com endereço traduzido (${decodeURIComponent(wccCart || '')})`, !!wccCart, wccCart);
      ok(`WCC ${V}: carrinho clássico traduzido; "atualizar carrinho" (AJAX) muda o total e o que volta também sai traduzido`, !(c1.text.match(WC_EN) || [])[0] && !!c2total && !(c2.text.match(WC_EN) || [])[0] && !/Cart updated|Update cart/.test(c2.text), { left1: (c1.text.match(WC_EN) || [])[0], c2total, left2: (c2.text.match(WC_EN) || [])[0], notice: c2.notice });
      await nav(b, BASE + '/checkout/', 2500);
      await waitFor(b, `document.querySelector('#billing_first_name') && !document.querySelector('.blockUI')`, 15000);
      await sleep(2000);
      const ck = await b.eval(`({text:document.querySelector('form.checkout').innerText,path:location.pathname,ph:[].map.call(document.querySelectorAll('form.checkout [placeholder]'),function(i){return i.getAttribute('placeholder')}).join(' | ')})`);
      const wccCk = await waitFor(b, `location.pathname !== '/checkout/' && location.pathname`, 10000);
      ok(`WCC ${V}: checkout clássico traduzido (inclusive o resumo do pedido que o AJAX recarrega e os textos de exemplo dos campos), endereço traduzido (${decodeURIComponent(wccCk || '')})`, !(ck.text.match(WC_EN) || [])[0] && !/Notes about your order|House number and street name/i.test(ck.ph) && !!wccCk, [(ck.text.match(WC_EN) || [])[0], ck.ph, wccCk, ck.text.slice(0, 400)]);
      for (const [sel, val] of [['#billing_first_name', 'Ana'], ['#billing_last_name', 'Teste'], ['#billing_address_1', 'Rua das Flores 100'], ['#billing_city', 'São Paulo'], ['#billing_postcode', '01001-000'], ['#billing_phone', '11999999999'], ['#billing_email', `trinv-test-${V}@example.com`]]) {
        if (await b.eval(`!!document.querySelector(${JSON.stringify(sel)})`)) await typeInto(b, sel, val);
      }
      await b.eval(`(function(){var s=document.querySelector('#billing_state');if(s){if(window.jQuery)jQuery(s).val('SP').trigger('change');else s.value='SP'}var r=document.querySelector('#payment_method_cod');if(r)r.click()})()`);
      await sleep(2500);
      await shotTo(b, `WCC-${V}-checkout`);
      await b.eval(`document.querySelector('#place_order').click()`);
      const received = await waitFor(b, `/order-received/.test(location.pathname) && document.readyState === 'complete' && location.pathname`, 30000);
      await sleep(3000);
      const th = received ? await b.eval(`({text:document.body.innerText.slice(0,3000),path:location.pathname,search:location.search})`) : await b.eval(`({text:(document.querySelector('.woocommerce-error, .woocommerce-NoticeGroup')||document.body).innerText.slice(0,600),path:location.pathname})`);
      keepErr();
      ok(`WCC ${V}: pedido pelo checkout clássico; confirmação traduzida, endereço/chave originais, nome e endereço do comprador intactos`, !!received && /^\/checkout\/order-received\/\d+\/$/.test(th.path) && /key=wc_order_/.test(th.search || '') && !(th.text.match(WC_EN) || [])[0] && /Ana Teste/.test(th.text) && /Rua das Flores 100/.test(th.text), th);
      const bad = errs.filter((e) => !/favicon|sendmail|status of 40[34]/i.test(e));
      ok(`WCC ${V}: nenhum erro no console`, !bad.length, bad.slice(0, 5));
      b.close();
    }
  } finally {
    wpx(`$s = json_decode(base64_decode('${Buffer.from(saved.trim()).toString('base64')}'), true); wp_update_post(array("ID" => wc_get_page_id("cart"), "post_content" => $s[0])); wp_update_post(array("ID" => wc_get_page_id("checkout"), "post_content" => $s[1]));`);
    wpx('foreach (wc_get_orders(array("limit" => -1, "return" => "ids")) as $id) { $o = wc_get_order($id); if ($o && 0 === strpos((string) $o->get_billing_email(), "trinv-test-")) $o->delete(true); }');
  }
}

// ============================================================ CACHE — com um plugin de cache/otimização ativo (CACHE_LABEL nomeia o plugin)
// Cada página é aberta 2× por idiomas diferentes: a 1ª pode gerar o cache de página, a 2ª recebe o HTML do cache.
if (run('CACHE')) {
  const LBL = process.env.CACHE_LABEL || 'cache';
  const PAGES = [['/grow-tomatoes/', 'Growing your own'], ['/tomato-course/', 'Grow juicy tomatoes'], ['/product/organic-tomato-seeds/', 'Organic tomato seeds'], ['/', null], ['/about-us/', null]];
  const VIS = [['de-DE', 'de'], ['ja', 'ja'], ['es-ES', 'es'], ['ar', 'ar']];
  clearCache();
  const base = {};
  const b0 = await browser({ lang: 'pt-BR', w: 1280, h: 2400 });
  for (const [pg] of PAGES) { const v = await visit(b0, BASE + pg + '?notranslate', { wait: 1500 }); await b0.eval('window.dispatchEvent(new Event("mousemove"));window.scrollTo(0,400)'); await sleep(1200); base[pg] = linesOf2(await b0.eval('document.body.innerText')); }
  b0.close();
  const bad = [];
  let checked = 0;
  for (const [lang, V] of VIS) {
    const b = await browser({ lang, w: 1280, h: 2400 });
    for (const [pg, en] of PAGES) {
      const v = await visit(b, BASE + pg, { wait: 1500 });
      await b.eval('window.dispatchEvent(new Event("mousemove"));window.scrollTo(0,400)'); // otimizadores que só rodam o JS do site na 1ª interação
      let left = await untranslated(b, base[pg], V);
      for (let i = 0; i < 8 && left.length; i++) { await sleep(800); left = await untranslated(b, base[pg], V); }
      const boot = await b.eval(`(function(){var s=document.getElementById('trinv-boot');return s?s.parentNode.nodeName+':'+(s.type||'js'):null})()`);
      const flash = v.full && v.reveal !== null && en && has(v.revealText, en);
      let hidden = v.stillHidden;
      for (let i = 0; i < 20 && hidden; i++) { await sleep(200); hidden = await b.eval("document.documentElement.classList.contains('trinv-wait') && getComputedStyle(document.body).opacity === '0'"); }
      const errs = v.errors.filter((e) => !/status of 404/.test(e));
      const path = await b.eval('location.pathname');
      checked++;
      if (left.length || flash || hidden || errs.length || boot !== 'HEAD:js' || v.n.js !== 1) bad.push({ V, pg, sobrou: left.slice(0, 4), flash, hidden, errs: errs.slice(0, 2), boot, js: v.n.js, path });
    }
    b.close();
  }
  if (bad.length) console.log('   ' + JSON.stringify(bad).slice(0, 3000));
  ok(`CACHE ${LBL}: ${checked} visitas (4 idiomas × ${PAGES.length} páginas) 100% traduzidas, sem piscar o original, sem erros, boot intacto no <head>`, !bad.length, bad.length + ' problema(s)');
}

// ============================================================ DBG — inspeção (só com filtro DBG)
if (FILTER === 'DBG') {
  if (process.env.DBG_CLEAR) clearCache();
  const b = await browser({ lang: process.env.DBG_LANG || 'pt-BR' });
  await visit(b, BASE + (process.env.DBG_PAGE || '/economizar-energia/'), { wait: +(process.env.DBG_WAIT || 5000) });
  console.log(JSON.stringify(await b.eval(`(function(){var out=[];var tw=document.createTreeWalker(document.body,4);for(var n=tw.nextNode();n;n=tw.nextNode()){if(/[ぁ-んァ-ン一-龯]/.test(n.data)&&n.parentNode.nodeName!=='SCRIPT'){var e=n.parentNode,chain=[];for(var x=e;x&&x!==document.body&&chain.length<6;x=x.parentElement)chain.push(x.nodeName+(x.className?'.'+String(x.className).split(' ').slice(0,2).join('.'):''));out.push({t:n.data.slice(0,40),chain:chain.join(' < '),html:e.parentElement.outerHTML.slice(0,300)})}}
    var T=window.__trinv;var RX=new RegExp(${JSON.stringify(process.env.DBG_RX || '[ぁ-んァ-ン一-龯]')});var us=T._.collect(document.body,false).filter(function(u){return RX.test(u.src)}).map(function(u){return {src:u.src.slice(0,60),sl:u.sl,inC:u.inContent,wanted:T._.wanted(u,T.tl,T.mode),fx:T._.fxLang(u.src)}});var lines=document.body.innerText.split('\\n').filter(function(l){return RX.test(l)});var els=[];var tw2=document.createTreeWalker(document.body,4);for(var m=tw2.nextNode();m;m=tw2.nextNode()){if(RX.test(m.data)){var q=[];for(var y=m.parentNode;y&&y!==document.body&&q.length<5;y=y.parentElement)q.push(y.nodeName+(y.className?'.'+String(y.className).split(' ').slice(0,2).join('.'):'')+(y.getAttribute&&y.getAttribute('translate')?'[translate]':''));els.push(m.data.slice(0,40)+' @ '+q.join(' < '))}}return {mode:T&&T.mode,p:T.c.p,units:out.length,segs:us,lines:lines,els:els}})()`), null, 1));
  if (process.env.DBG_EVAL) console.log(JSON.stringify(await b.eval(process.env.DBG_EVAL), null, 1));
  b.close();
}

// ============================================================ PEEK — olhar uma página (só com filtro PEEK): PEEK_PAGE, PEEK_LANG, PEEK_WAIT, PEEK_CLEAR, PEEK_MOBILE
if (FILTER === 'PEEK') {
  if (process.env.PEEK_CLEAR) clearCache();
  const lang = process.env.PEEK_LANG || 'de-DE';
  const b = await browser({ lang, w: 1280, h: 2400 });
  const v = await visit(b, BASE + (process.env.PEEK_PAGE || '/'), { wait: +(process.env.PEEK_WAIT || 3000), shot: 'PEEK-' + lang, mobile: !!process.env.PEEK_MOBILE });
  console.log(JSON.stringify({ url: await b.eval('location.href'), title: v.title, mode: await b.eval('window.__trinv&&window.__trinv.mode'), tl: v.tl, n: v.n, errors: v.errors, hidden: v.stillHidden }, null, 1));
  console.log(v.text.slice(0, +(process.env.PEEK_CHARS || 4000)));
  if (process.env.PEEK_EVAL) console.log(JSON.stringify(await b.eval(process.env.PEEK_EVAL), null, 1));
  b.close();
}

// ============================================================ LICSHOT — capturas da edição do Pub Mail (só com filtro LICSHOT)
if (FILTER === 'LICSHOT') {
  const b = await adminBrowser({ h: 1100 });
  await b.go(`${BASE}/wp-admin/plugins.php`);
  const row = await b.eval(`(function(){var r=document.querySelector('tr[data-slug="tradutor-invisivel"]');return r?r.innerText.replace(/\\s+/g,' '):null})()`);
  const VER = (fs.readFileSync(new URL('../tradutor-invisivel/tradutor-invisivel.php', import.meta.url), 'utf8').match(/Version:\s*([\d.]+)/) || [])[1];
  ok(`LICSHOT lista de plugins: autor Júlio Cezar Reis, versão ${VER}`, /Júlio Cezar Reis/.test(row || '') && (row || '').includes(VER), row);
  await b.shot('LIC1-plugins');
  await b.go(`${BASE}/wp-admin/admin.php?page=tradutor-invisivel-ajustes`);
  const card = await b.eval(`(function(){var c=[].filter.call(document.querySelectorAll('.trinv-card'),function(x){return /Licença do Pub Mail/.test(x.innerText)})[0];return c?c.innerText.replace(/\\s+/g,' '):null})()`);
  ok('LICSHOT ajustes: card "Licença do Pub Mail" ativa (com data de fim ou vitalícia)', /Ativa/.test(card || '') && /Válida até|sem data de fim/.test(card || ''), card);
  await b.shot('LIC2-ajustes-ativa');
  wpx('$s = TRINV_License::state(); $s["until"] = time() - 5; update_option("trinv_license", $s, true); TRINV_License::tick();');
  await b.go(`${BASE}/wp-admin/plugins.php`);
  const note = await b.eval(`(function(){var n=[].filter.call(document.querySelectorAll('.notice'),function(x){return /Tradutor Invisível pausado/.test(x.innerText)})[0];return n?n.innerText.replace(/\\s+/g,' '):null})()`);
  ok('LICSHOT pausado: aviso na lista de plugins com "Abrir o Pub Mail" e "Verificar agora"', /venceu/.test(note || '') && /Abrir o Pub Mail/.test(note || '') && /Verificar agora/.test(note || ''), note);
  await b.shot('LIC3-plugins-pausado');
  await b.go(`${BASE}/wp-admin/admin.php?page=tradutor-invisivel-ajustes`);
  await b.shot('LIC4-ajustes-pausado');
  await b.eval(`[].filter.call(document.querySelectorAll('a.button'),function(a){return /Verificar agora/.test(a.textContent)})[0].click()`);
  for (let i = 0; i < 50 && !(await b.eval('location.search')).includes('trinv_msg'); i++) await sleep(200);
  await sleep(800);
  const back = await b.eval(`document.body.innerText.indexOf('Licença ativa') > -1`);
  ok('LICSHOT "Verificar agora" reativa na hora', back);
  await b.shot('LIC5-ajustes-reativada');
  b.close();
}

// ============================================================ UPD — atualização automática pelo Pub Mail (só com filtro UPD)
// Antes: ./license/install-pubmail.sh 1.4.0  (edição do Pub Mail marcada como versão antiga, cache de versões vencido)
if (FILTER === 'UPD') {
  const NEW = (fs.readFileSync(new URL('../tradutor-invisivel/tradutor-invisivel.php', import.meta.url), 'utf8').match(/Version:\s*([\d.]+)/) || [])[1];
  const before = wpx('echo TRINV_VERSION;').trim();
  const a = await adminBrowser();
  await a.go(`${BASE}/wp-admin/update-core.php?force-check=1`);
  const row = await a.eval(`(function(){var t=document.body.innerText;var i=t.indexOf('Tradutor Invisível');return i>-1?t.slice(i,i+160).replace(/\\s+/g,' '):null})()`);
  await a.shot('UPD-atualizacoes');
  a.close();
  const offered = wpx('$u = get_site_transient("update_plugins"); $r = isset($u->response["tradutor-invisivel/tradutor-invisivel.php"]) ? $u->response["tradutor-invisivel/tradutor-invisivel.php"] : null; echo $r ? $r->new_version : "";').trim();
  ok(`UPD "Verificar novamente" no painel acha a versão nova no Pub Mail na hora (${before} → ${offered})`, before !== NEW && offered === NEW && !!row, { before, offered, NEW, row });
  ssh('cd /var/www/sites.reveleonline.com && sudo -u www-data wp plugin update tradutor-invisivel >/dev/null 2>&1; true');
  const after = wpx('TRINV_License::check(); echo TRINV_VERSION, "|", TRINV_EDITION, "|", TRINV_License::active() ? "ativa" : "PARADA";').trim();
  ok('UPD atualização instalada pelo WordPress: versão nova, edição do Pub Mail, licença ativa', after === `${NEW}|pubmail|ativa`, after);
}

// ============================================================ V — captura da página inteira (só com filtro V)
if (FILTER === 'V') {
  const b = await browser({ lang: 'pt-BR', w: 1100, h: 3600 });
  const v = await visit(b, EN, { shot: 'V-pagina-inteira', wait: 3500 });
  console.log('texto:', v.text.slice(0, 2500));
  b.close();
}

// ============================================================ Z — medição de tempo (só com filtro Z)
if (FILTER === 'Z') {
  const med = (a) => { const b = a.slice().sort((x, y) => x - y); return Math.round(b[Math.floor(b.length / 2)]); };
  const R = { base: [], cold: [], server: [], browser: [] };
  for (let i = 0; i < 5; i++) {
    const b0 = await browser({ lang: 'pt-BR' });
    const x = await visit(b0, `${EN}?notranslate&r=${i}`, { wait: 800 });
    R.base.push(x.fcp); b0.close();
    clearCache();
    const b1 = await browser({ lang: 'pt-BR' });
    const c = await visit(b1, EN, { wait: 1500 });
    R.cold.push(c.reveal);
    const bc = await visit(b1, EN, { wait: 800 });
    R.browser.push(bc.reveal);
    b1.close();
    const b2 = await browser({ lang: 'pt-BR' });
    const sv = await visit(b2, EN, { wait: 800 });
    R.server.push(sv.reveal); b2.close();
  }
  console.log('mediana (5 rodadas), desktop, a partir do início da navegação:');
  console.log(`  sem tradução (página aparece — FCP):        ${med(R.base)} ms   ${JSON.stringify(R.base.map(Math.round))}`);
  console.log(`  1º visitante do idioma (sem cache nenhum):  ${med(R.cold)} ms   ${JSON.stringify(R.cold.map(Math.round))}`);
  console.log(`  visitante novo (cache do servidor):         ${med(R.server)} ms   ${JSON.stringify(R.server.map(Math.round))}`);
  console.log(`  visitante voltando (cache do navegador):    ${med(R.browser)} ms   ${JSON.stringify(R.browser.map(Math.round))}`);
}

console.log(`\n${total - fails}/${total} passaram`);
process.exit(fails ? 1 : 0);
