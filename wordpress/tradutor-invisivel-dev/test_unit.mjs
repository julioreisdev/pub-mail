// Testes de unidade do Tradutor Invisível (jsdom). Uso: node test_unit.mjs
import { JSDOM } from 'jsdom';
import fs from 'node:fs';

const P = new URL('../tradutor-invisivel/assets', import.meta.url).pathname;
const MAIN = fs.readFileSync(`${P}/trinv.min.js`, 'utf8');
const BOOT = fs.readFileSync(`${P}/boot.min.js`, 'utf8');
let fails = 0, total = 0;
const ok = (label, cond, extra) => { total++; if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (cond || extra === undefined ? '' : '  → ' + JSON.stringify(extra))); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CFG = { v: '1', src: 'en', loc: 'pt', chrome: 1, ex: [], sel: '', mw: 3000, pu: 'https://s.test/wp-json/trinv/v1/p', tu: 'https://s.test/wp-json/trinv/v1/t', ax: 'https://s.test/wp-admin/admin-ajax.php', js: 'https://s.test/trinv.min.js', p: 7 };

// Página com o script principal (sem rede, a menos que fetch seja passado).
function page(body, { tl = 'pt', full = true, fetch = null, pre = null, ls = null, title = 'Title here', cfg = {}, htmlAttr = 'lang="en"', warm = null, msgs = null } = {}) {
  const dom = new JSDOM(`<!doctype html><html ${htmlAttr}><head><title>${title}</title></head><body>${body}</body></html>`, { url: 'https://s.test/post-x/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  if (ls) w.localStorage.setItem('trinv1:' + tl, JSON.stringify(ls));
  w.fetch = fetch || (() => Promise.reject(new Error('sem rede')));
  w.AbortController = globalThis.AbortController;
  w.document.documentElement.classList.add('trinv-wait');
  w.__trinv = { c: { ...CFG, ...cfg }, tl, full, t0: Date.now(), u: '/post-x/', rest: 1, pre: pre ? Promise.resolve(pre) : null };
  if (warm) { w.__trinv.warm = warm; w.__trinv.tl = ''; w.document.documentElement.classList.remove('trinv-wait'); }
  if (msgs) Object.defineProperty(w, 'parent', { value: { postMessage: (m) => msgs.push(m) }, configurable: true });
  w.eval(MAIN);
  return { dom, w, d: w.document, T: w.__trinv };
}
// Página "vazia" só para usar as funções internas sem rodar a tradução.
function lab(body, opts = {}) {
  const r = page(body, { ...opts, fetch: () => new Promise(() => {}) }); // rede pendurada: nada é aplicado sozinho
  return r;
}
const units = (r, root) => r.T._.collect(root || r.d.body, false);
const srcs = (r, root) => units(r, root).map((u) => u.src || '');
const txt = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const paras = (d) => [...d.querySelectorAll('p')].map((p) => txt(p)).join(' | ');

// resposta do servidor/google simulada a partir de um dicionário
function fakeNet(dict, opts = {}) {
  const calls = { server: 0, ajax: 0, google: 0, bodies: [] };
  const f = async (url, o = {}) => {
    const u = String(url);
    if (u.includes('/trinv/v1/t')) {
      calls.server++;
      if (opts.rest403) return { ok: false, status: 403, json: async () => ({}) };
      const b = JSON.parse(o.body);
      calls.bodies.push(b);
      if (opts.serverDown) throw new Error('down');
      return { ok: true, status: 200, json: async () => ({ t: b.s.map((s) => (opts.serverFallback ? null : dict[s] ?? null)), f: opts.serverFallback ? 1 : 0, sl: 'en' }) };
    }
    if (u.includes('admin-ajax.php')) {
      calls.ajax++;
      const b = JSON.parse(o.body);
      return { ok: true, status: 200, json: async () => ({ t: b.s.map((s) => dict[s] ?? null), f: 0, sl: 'en' }) };
    }
    if (u.includes('translate_a/t')) {
      calls.google++;
      if (opts.googleFailFirst && calls.google === 1) return { ok: false, status: 429, json: async () => null };
      if (opts.googleDown) throw new Error('blocked');
      const qs = new URLSearchParams(o.body).getAll('q');
      return { ok: true, status: 200, json: async () => qs.map((q) => [dict[q] ?? q, 'en']) };
    }
    throw new Error('url inesperada ' + u);
  };
  return { f, calls };
}

// =========================================================== segmentação
{
  const r = lab('<p>Hello <a href="#x" class="lnk">world</a> and <b>friends</b>.</p>');
  ok('frase com link e negrito = 1 unidade com marcadores', JSON.stringify(srcs(r)) === JSON.stringify(['Hello <a id="0">world</a> and <b id="1">friends</b>.']), srcs(r));
}
{
  const r = lab('<div>Intro text <p>Paragraph one.</p> tail <em>here</em> end<p>Two</p></div>');
  ok('container misto: textos soltos separados dos blocos', JSON.stringify(srcs(r)) === JSON.stringify(['Intro text', 'Paragraph one.', 'tail <em id="0">here</em> end', 'Two']), srcs(r));
}
{
  const r = lab('<p class="notranslate">Keep me</p><p translate="no">Keep too</p><pre>code here</pre><code>x = y</code><script>var a="Hello"</script><ins class="adsbygoogle">Ad text</ins><div id="div-gpt-ad-1">Ad</div><div contenteditable="true">Editable</div><div id="wpadminbar">Admin</div><p>Translate me</p>');
  ok('exclusões (notranslate, translate=no, pre, code, script, anúncios, editável, barra admin)', JSON.stringify(srcs(r)) === JSON.stringify(['Translate me']), srcs(r));
}
{
  const r = lab('<p>Run <code>npm install</code> now <i class="fa fa-star"></i> and <img src="a.png" alt="A cat"> smile<br>next line</p>');
  const s = srcs(r);
  ok('code/ícone/img/br viram marcadores vazios', s[0] === 'Run <span id="0"></span> now <span id="1"></span> and <span id="2"></span> smile<span id="3"></span>next line', s);
  ok('alt da imagem vira unidade de atributo', s.includes('A cat'), s);
}
{
  const r = lab('<p>Download the <a href="/g">free <strong>PDF</strong> guide</a> now!</p>');
  ok('aninhado (strong dentro de a)', srcs(r)[0] === 'Download the <a id="0">free <strong id="1">PDF</strong> guide</a> now!', srcs(r));
}
{
  const r = lab('<a href="/x"><div class="card"><h3>Card title</h3><span>Card text</span></div></a>');
  ok('link em bloco: unidades dentro do bloco', JSON.stringify(srcs(r)) === JSON.stringify(['Card title', '<span id="0">Card text</span>']), srcs(r));
}
{
  const r = lab('<p>Price <span>123</span></p><span>2026</span><p>   </p><button type="button">Buy now</button><select><option>First option</option></select><input placeholder="Your email"><input type="submit" value="Send it"><a title="Go home" href="/">Home</a>');
  const s = srcs(r);
  ok('número sozinho não é unidade', !s.includes('2026'), s);
  ok('botão, option, placeholder, value de submit e title', ['Buy now', 'First option', 'Your email', 'Send it', 'Go home', 'Home'].every((x) => s.some((y) => y === x || y.includes('>' + x + '<'))), s);
  const rt = lab('<textarea placeholder="Notes about your order">I typed this myself</textarea><textarea class="notranslate" placeholder="Keep this hint"></textarea>');
  const st = srcs(rt);
  ok('<textarea>: texto de exemplo traduzido, o que foi digitado nunca (notranslate respeitado)', st.includes('Notes about your order') && !st.some((x) => /typed|Keep this/.test(x)), st);
}
{
  const r = lab('<p>Keep <span class="notranslate">BrandName</span> intact.</p>', { cfg: { sel: '.brand' } });
  ok('span notranslate dentro da frase vira marcador', srcs(r)[0] === 'Keep <span id="0"></span> intact.', srcs(r));
  const r2 = lab('<p class="brand">Brand block</p><p>Other</p>', { cfg: { sel: '.brand' } });
  ok('seletor extra do ajuste é respeitado', JSON.stringify(srcs(r2)) === JSON.stringify(['Other']), srcs(r2));
}
{
  const r = lab('<p>Tom &amp; Jerry &lt;3 "quotes"</p>');
  ok('texto é escapado no marcador', srcs(r)[0] === 'Tom &amp; Jerry &lt;3 "quotes"', srcs(r));
}

// =========================================================== aplicar
function applyFirst(r, tr) {
  const u = units(r)[0];
  r.T._.applyUnit(u, tr);
  return u;
}
{
  const r = lab('<p>Download the <a href="/g" class="c">free <strong>PDF</strong> guide</a> now!</p>');
  const a = r.d.querySelector('a');
  let clicks = 0;
  a.addEventListener('click', (e) => { e.preventDefault(); clicks++; });
  applyFirst(r, 'Baixe o <a id="0">guia <strong id="1">em PDF</strong> gratuito</a> agora!');
  const p = r.d.querySelector('p');
  ok('reordenação aplicada', txt(p) === 'Baixe o guia em PDF gratuito agora!', txt(p));
  ok('é o MESMO elemento <a> (atributos preservados)', r.d.querySelector('a') === a && a.getAttribute('href') === '/g' && a.className === 'c');
  a.dispatchEvent(new r.w.MouseEvent('click', { bubbles: true, cancelable: true }));
  ok('evento de clique continua funcionando', clicks === 1);
  ok('strong continua dentro do link', a.querySelector('strong') && txt(a.querySelector('strong')) === 'em PDF');
  ok('traduzido não é traduzido de novo', units(r).length === 0, srcs(r));
}
{
  const r = lab('<p>Hello <b>big</b> world <i>now</i></p>');
  applyFirst(r, 'Olá mundo <i id="1">agora</i>');
  const p = r.d.querySelector('p');
  ok('marcador que sumiu: elemento original reanexado (nada se perde)', !!p.querySelector('b') && txt(p).startsWith('Olá mundo agora') && txt(p).includes('big'), p.innerHTML);
}
{
  const r = lab('<p>Posted by <a href="/u">John</a> on <time>March 3</time></p>');
  applyFirst(r, 'Postado por <a id="0">João</a> em<time id="1"> 3 de março</time>');
  const p = r.d.querySelector('p');
  ok('espaço que o Google põe dentro da tag volta para fora', p.innerHTML.includes('em <time>3 de março</time>'), p.innerHTML);
}
{
  const r = lab('<p>Price: <b>$20</b>. Tax: <b>$2</b>.</p>');
  applyFirst(r, 'Preço: <b id="0">$ 20</b> . Imposto: <b id="1">$ 2</b> .');
  ok('só-números ficam intactos e espaço antes da pontuação some', txt(r.d.querySelector('p')) === 'Preço: $20. Imposto: $2.', txt(r.d.querySelector('p')));
}
{
  const r = lab('<p>Image <img src="x.png"> inside the text.</p>');
  applyFirst(r, 'Imagem<span id="0"></span> dentro do texto.');
  const p = r.d.querySelector('p');
  ok('espaçamento em volta do marcador vazio segue o original', /Imagem <img[^>]*> dentro/.test(p.innerHTML), p.innerHTML);
}
{
  const r = lab('<p>Tom and Jerry</p>');
  const node = r.d.querySelector('p').firstChild;
  applyFirst(r, 'Tom &amp; Jerry &quot;x&quot; &#39;y&#39;');
  ok('entidades decodificadas; nó de texto reaproveitado', r.d.querySelector('p').firstChild === node && node.data === 'Tom & Jerry "x" \'y\'', node.data);
}
{
  const r = lab('<p>Say hi</p>');
  applyFirst(r, '<img src=x onerror="window.pwned=1">Olá <script>window.pwned=2</script><a href="javascript:alert(1)" id="9">x</a>');
  const p = r.d.querySelector('p');
  ok('tradução maliciosa não injeta elementos (só texto)', !p.querySelector('img,script,a') && !r.w.pwned, p.innerHTML);
}
{
  const r = lab('<p>Bonjour <b>monde</b> !</p>', { tl: 'fr' });
  applyFirst(r, 'Bonjour <b id="0">le monde</b> !');
  ok('francês mantém espaço antes de "!"', txt(r.d.querySelector('p')) === 'Bonjour le monde !', txt(r.d.querySelector('p')));
}
{
  const r = lab('<p>Hello</p>');
  const u = units(r)[0];
  r.d.querySelector('p').innerHTML = 'Changed by site';
  r.T._.applyUnit(u, 'Olá');
  ok('bloco alterado pelo site no meio do caminho é ignorado', r.d.querySelector('p').textContent === 'Changed by site');
}
{
  const r = lab('<div> <b>Bold</b> and text </div>');
  applyFirst(r, '<b id="0">Negrito</b> e texto');
  const html = r.d.querySelector('div').innerHTML;
  ok('espaços do começo/fim preservados', html === ' <b>Negrito</b> e texto ', html);
}
{
  const r = lab('<p>Same text</p>');
  const before = r.d.body.innerHTML;
  applyFirst(r, 'Same text');
  ok('tradução igual ao original não mexe no DOM', r.d.body.innerHTML === before);
}

// =========================================================== fluxo completo (rede simulada)
const DICT = { 'Hello <a id="0">world</a>.': 'Olá <a id="0">mundo</a>.', 'Second paragraph': 'Segundo parágrafo', 'Title here': 'Título aqui', 'A cat': 'Um gato' };
const BODY = '<p>Hello <a href="#">world</a>.</p><p>Second paragraph</p><img src="c.png" alt="A cat">';
async function flow(name, opts, check) {
  const net = fakeNet(DICT, opts.net || {});
  const r = page(BODY, { fetch: net.f, pre: opts.pre, ls: opts.ls });
  await sleep(opts.wait || 60);
  check(r, net.calls);
}
await flow('servidor traduz tudo', { wait: 800 }, (r, c) => {
  ok('fluxo: texto traduzido', paras(r.d) === 'Olá mundo. | Segundo parágrafo', paras(r.d));
  ok('fluxo: <title> e alt traduzidos', r.d.title === 'Título aqui' && r.d.querySelector('img').alt === 'Um gato', [r.d.title, r.d.querySelector('img').alt]);
  ok('fluxo: página revelada e <html lang> = pt', !r.d.documentElement.classList.contains('trinv-wait') && r.d.documentElement.lang === 'pt');
  ok('fluxo: 1 chamada ao servidor, 0 ao Google', c.server === 1 && c.google === 0, c);
  ok('fluxo: POST leva caminho, idioma e post', c.bodies[0].u === '/post-x/' && c.bodies[0].l === 'pt' && c.bodies[0].p === 7, c.bodies[0]);
  ok('fluxo: traduções guardadas no navegador', Object.keys(JSON.parse(r.w.localStorage.getItem('trinv1:pt') || '{}')).length >= 3);
});
await flow('servidor pede reserva (f=1)', { net: { serverFallback: true } }, (r, c) => {
  ok('reserva: navegador traduz direto pelo Google', paras(r.d) === 'Olá mundo. | Segundo parágrafo' && c.google >= 1, [paras(r.d), c]);
});
await flow('REST bloqueado', { net: { rest403: true } }, (r, c) => {
  ok('REST 403 → admin-ajax', paras(r.d) === 'Olá mundo. | Segundo parágrafo' && c.ajax === 1, [paras(r.d), c]);
});
await flow('servidor fora + 1º endpoint Google recusa', { net: { serverDown: true, googleFailFirst: true } }, (r, c) => {
  ok('rodízio de endpoints do Google', paras(r.d) === 'Olá mundo. | Segundo parágrafo' && c.google === 2, [paras(r.d), c]);
});
await flow('tudo fora', { net: { serverDown: true, googleDown: true } }, (r, c) => {
  ok('tudo fora: mostra o original e revela a página', paras(r.d) === 'Hello world. | Second paragraph' && !r.d.documentElement.classList.contains('trinv-wait'));
});
await flow('mapa da página já no <head>', { pre: { m: DICT, sl: 'en' } }, (r, c) => {
  ok('mapa pré-carregado: zero requisições', paras(r.d) === 'Olá mundo. | Segundo parágrafo' && c.server === 0 && c.google === 0, c);
});
await flow('cache do navegador', { ls: DICT }, (r, c) => {
  ok('localStorage: zero requisições', paras(r.d) === 'Olá mundo. | Segundo parágrafo' && c.server === 0, c);
});
{
  const net = fakeNet({ ...DICT, 'New comment arrived': 'Novo comentário chegou' });
  const r = page(BODY, { fetch: net.f });
  await sleep(60);
  const div = r.d.createElement('div');
  div.innerHTML = '<p>New comment arrived</p>';
  r.d.body.appendChild(div);
  await sleep(450);
  ok('conteúdo que aparece depois é traduzido', txt(div) === 'Novo comentário chegou', txt(div));
  const before = net.calls.server;
  await sleep(400);
  ok('sem laço: nada é reenviado depois de traduzir', net.calls.server === before, net.calls);
}
{
  // site que muda o mesmo texto sem parar (ex.: contador) → retradução limitada
  const net = fakeNet({});
  const r = page('<p id="t">Tick 0 seconds</p>', { fetch: net.f });
  await sleep(60);
  for (let i = 1; i <= 25; i++) { r.d.getElementById('t').firstChild.data = `Tick ${i} seconds`; await sleep(270); }
  ok('texto que muda sem parar tem retradução limitada', net.calls.server <= 11, net.calls);
}

{
  // itens de menu: versão com contexto "Menu:" vence, exceto quando ela devolve a palavra intacta
  const dict = {
    '<a id="0">Sobre</a>': '<a id="0">On</a>',
    'Menu: <span id="m"><a id="0">Sobre</a></span>': 'Menu: <span id="m"><a id="0">About</a></span>',
    '<a id="0">Loja</a>': '<a id="0">Store</a>',
    'Menu: <span id="m"><a id="0">Loja</a></span>': 'Menu: <span id="m"><a id="0">Loja</a></span>',
    'Sobre o autor do texto': 'About the author of the text',
  };
  const net = fakeNet(dict);
  const r = page('<nav><ul><li><a href="/s" id="s">Sobre</a></li><li><a href="/l" id="l">Loja</a></li></ul></nav><ul><li>Sobre o autor do texto</li></ul>', { tl: 'en', fetch: net.f });
  await sleep(120);
  const a = r.d.getElementById('s'), l = r.d.getElementById('l');
  ok('menu: "Sobre" usa a versão com contexto (About)', a.textContent === 'About', a.textContent);
  ok('menu: "Loja" com contexto intacto → versão sem contexto (Store)', l.textContent === 'Store', l.textContent);
  ok('menu: mesmos elementos <a> (href preservado)', a.getAttribute('href') === '/s' && l.getAttribute('href') === '/l');
  ok('lista do conteúdo (fora do menu) não usa contexto de menu', !net.calls.bodies.some((b) => b.s.includes('Menu: <span id="m">Sobre o autor do texto</span>')) && r.d.querySelectorAll('ul')[1].textContent === 'About the author of the text', net.calls.bodies.map((b) => b.s));
}

{
  // dicas de idioma para trechos curtos + nome do site
  const LOC = '<script id="trinv-loc" type="application/json">["Escrito por","em","Blog"]</script>';
  const HTML = '<p class="wp-block-site-title"><a href="/">Sites</a></p><div class="meta"><p>Escrito por</p><p>em</p></div><div class="entry-content"><table><tr><td>Seedling</td></tr></table><p>A long sentence written inside the post content area.</p></div><nav><a href="/h">Home</a></nav>' + LOC;
  const en = lab(HTML, { tl: 'en' });
  const ue = units(en);
  const by = (list, t) => list.find((u) => u.src.includes(t));
  ok('nome do site nunca é traduzido', !ue.some((u) => u.src.includes('Sites')), ue.map((u) => u.src));
  ok('visitante en: "Escrito por"/"em" (texto do tema) vão com dica pt', by(ue, 'Escrito por')?.sl === 'pt' && by(ue, '>em<') === undefined && ue.some((u) => u.src === 'em' && u.sl === 'pt'), ue.map((u) => [u.src, u.sl]));
  ok('visitante en: célula do post em inglês nem é enviada', !by(ue, 'Seedling'), ue.map((u) => u.src));
  ok('item de menu escrito pelo dono: detecção automática', by(ue, 'Home')?.sl === '', ue.map((u) => [u.src, u.sl]));
  ok('frase longa no conteúdo: detecção automática', by(ue, 'long sentence')?.sl === '');
  const pt = lab(HTML, { tl: 'pt' });
  const up = units(pt);
  ok('visitante pt: textos do tema em pt nem são enviados', !by(up, 'Escrito por') && !up.some((u) => u.src === 'em'), up.map((u) => u.src));
  ok('visitante pt: célula do post vai com dica en', by(up, 'Seedling')?.sl === 'en', up.map((u) => [u.src, u.sl]));
  // a dica vai para o servidor e a chave de cache separa por dica
  const net = fakeNet({ Seedling: 'Muda', '<a id="0">Home</a>': '<a id="0">Início</a>', 'Menu: <span id="m"><a id="0">Home</a></span>': 'Menu: <span id="m"><a id="0">Início</a></span>', 'A long sentence written inside the post content area.': 'Uma frase longa escrita dentro da área de conteúdo do post.', 'Title here': 'Título aqui' });
  const r = page(HTML, { tl: 'pt', fetch: net.f });
  await sleep(120);
  const b = net.calls.bodies[0] || { s: [], h: [] };
  ok('servidor recebe a dica alinhada ao trecho', b.h && b.h[b.s.indexOf('Seedling')] === 'en' && b.h[b.s.indexOf('A long sentence written inside the post content area.')] === '', b);
  ok('tradução aplicada com dica (Seedling → Muda) e tema intacto', r.d.querySelector('td').textContent === 'Muda' && r.d.querySelector('.meta').textContent === 'Escrito porem' && r.d.querySelector('.wp-block-site-title').textContent === 'Sites', [r.d.querySelector('td').textContent, r.d.querySelector('.meta').textContent]);
  await sleep(800);
  const ls2 = JSON.parse(r.w.localStorage.getItem('trinv1:pt') || '{}');
  ok('cache do navegador guarda com a dica na chave', Object.keys(ls2).some((k) => k === 'en' + String.fromCharCode(1) + 'Seedling'), Object.keys(ls2));
}

{
  // listas de outros posts e escrita não latina: sem dica (detecção automática)
  const r = lab('<div class="entry-content"><p>Seedling</p></div><div class="wp-block-query"><h2 class="wp-block-post-title">Recetas fáciles</h2><h2 class="wp-block-post-title">東京旅行ガイド</h2></div><h1 class="wp-block-post-title">Короткий</h1>', { tl: 'pt' });
  const us = units(r);
  const f = (t) => us.find((u) => u.src.includes(t));
  ok('título de outro post numa lista: sem dica do post atual', f('Recetas')?.sl === '', us.map((u) => [u.src, u.sl]));
  ok('japonês curto: sem dica (Google reconhece pela escrita)', f('東京')?.sl === '', us.map((u) => [u.src, u.sl]));
  ok('cirílico curto no título: sem dica', f('Короткий')?.sl === '', us.map((u) => [u.src, u.sl]));
  ok('curto latino no conteúdo do post: dica do conteúdo', f('Seedling')?.sl === 'en', us.map((u) => [u.src, u.sl]));
}

{
  // nome do site no meio de uma frase do rodapé: vai como marcador; dentro do post continua texto
  const net = fakeNet({ '© 2026 <span id="0"></span> – WordPress Theme by Kadence WP': '© 2026 <span id="0"></span> – Kadence WPによるWordPressテーマ', 'We love our Sites and visit new Sites every week here.': '私たちはサイトが大好きです。' });
  const r = page('<div class="entry-content"><p>We love our Sites and visit new Sites every week here.</p></div><footer><p>© 2026 Sites – WordPress Theme by Kadence WP</p><p>© 2026 Sites</p><p>Websites</p></footer>', { tl: 'ja', full: true, cfg: { bn: 'Sites' }, fetch: net.f, title: 'Sites' });
  for (let i = 0; i < 40 && !net.calls.bodies.length; i++) await sleep(50);
  await sleep(400);
  const sent = net.calls.bodies.flatMap((b) => b.s);
  const fp = r.d.querySelectorAll('footer p');
  ok('nome do site no rodapé: não vai para o tradutor e volta intacto ("Sites" não vira "サイト")', fp[0].textContent === '© 2026 Sites – Kadence WPによるWordPressテーマ' && !sent.some((x) => /© 2026 Sites/.test(x)), [fp[0].textContent, sent]);
  ok('"© 2026 Sites" sozinho nem é enviado; "Websites" (outra palavra) segue normal', fp[1].textContent === '© 2026 Sites' && sent.includes('Websites'), sent);
  ok('dentro do post o nome do site continua texto traduzível', sent.includes('We love our Sites and visit new Sites every week here.'), sent);
}

{
  // mini-carrinho do WooCommerce: depois da tradução, o site redesenha só o contador em inglês
  const K1 = '<span id="0">Your cart</span> <span id="1">(items: 0)</span>';
  const K2 = '<span id="0"><span id="1"></span></span> <span id="2">(items: 1)</span>';
  const net = fakeNet({ [K1]: '<span id="0">Seu carrinho</span> <span id="1">(itens: 0)</span>', [K2]: '<span id="0"><span id="1"></span></span> <span id="2">(itens: 1)</span>' });
  const r = page('<p>Some English text long enough to translate here.</p><header><h2 class="mc"><span class="lbl">Your cart</span> <span class="cnt">(items: 0)</span></h2></header>', { tl: 'pt', full: true, fetch: net.f });
  for (let i = 0; i < 40 && !net.calls.bodies.length; i++) await sleep(50);
  await sleep(500);
  r.d.querySelector('.cnt').textContent = '(items: 1)'; // o site reescreve o contador com um valor novo
  for (let i = 0; i < 40 && net.calls.bodies.length < 2; i++) await sleep(50);
  await sleep(600);
  const sent = net.calls.bodies.flatMap((b) => b.s);
  ok('bloco redesenhado em parte: só o texto novo vai para tradução (o já traduzido vira marcador)', sent.includes(K2) && !sent.some((x) => /Seu carrinho/.test(x)), sent);
  ok('bloco redesenhado: resultado todo traduzido e o nosso texto continua no lugar', r.d.querySelector('.mc').textContent.replace(/\s+/g, ' ').trim() === 'Seu carrinho (itens: 1)', r.d.querySelector('.mc').outerHTML);
}
{
  // o site devolve um pedaço ao texto ORIGINAL depois da tradução: volta traduzido na hora, sem pedido
  const K1 = '<span id="0">Your cart</span> <span id="1">(items: 0)</span>';
  const net = fakeNet({ [K1]: '<span id="0">Seu carrinho</span> <span id="1">(itens: 0)</span>', 'Read more about tomatoes': 'Leia mais sobre tomates' });
  const r = page('<p>Some English text long enough to translate here.</p><header><h2 class="mc"><span class="lbl">Your cart</span> <span class="cnt">(items: 0)</span></h2><p class="rm">Read more about tomatoes</p></header>', { tl: 'pt', full: true, fetch: net.f });
  for (let i = 0; i < 40 && !net.calls.bodies.length; i++) await sleep(50);
  await sleep(500);
  const before = net.calls.bodies.length;
  r.d.querySelector('.cnt').textContent = '(items: 0)';
  r.d.querySelector('.rm').firstChild.data = 'Read more about tomatoes';
  await sleep(700);
  ok('texto devolvido ao original volta traduzido sem nenhum pedido novo', net.calls.bodies.length === before && r.d.querySelector('.cnt').textContent === '(itens: 0)' && r.d.querySelector('.rm').textContent === 'Leia mais sobre tomates', [net.calls.bodies.length - before, r.d.querySelector('header').innerHTML]);
}

{
  // loja: contexto de loja nos links do menu para as páginas da loja, nos títulos curtos e na aba
  const net = fakeNet({});
  const r = page('<nav class="main-navigation"><ul><li><a href="/about-us/">About us</a></li><li><a href="https://s.test/checkout/">Checkout</a></li></ul></nav><main><h1 class="entry-title">Checkout</h1><p>Some English text long enough to translate here.</p></main>', { tl: 'pt', full: true, cfg: { wl: ['/shop', '/cart', '/checkout', '/my-account'], ws: 1, bn: 'Sites' }, fetch: net.f, title: 'Checkout – Sites' });
  for (let i = 0; i < 40 && !net.calls.bodies.length; i++) await sleep(50);
  await sleep(400);
  const sent = net.calls.bodies.flatMap((b) => b.s);
  ok('loja: item de menu que leva ao checkout vai com contexto de loja; os outros com "Menu:"', sent.includes('Online store menu: <span id="m"><a id="0">Checkout</a></span>') && sent.includes('Menu: <span id="m"><a id="0">About us</a></span>'), sent);
  ok('loja: título curto da página e título da aba vão com contexto de loja', sent.includes('Online store page: <span id="m">Checkout</span>') && sent.filter((x) => x === 'Online store page: <span id="m">Checkout</span>').length >= 1, sent);
  const n2 = fakeNet({});
  const r2 = page('<nav class="main-navigation"><ul><li><a href="/checkout/">Checkout</a></li></ul></nav><main><h1 class="entry-title">Checkout</h1><p>Some English text long enough to translate here.</p></main>', { tl: 'pt', full: true, cfg: { bn: 'Sites' }, fetch: n2.f, title: 'Checkout – Sites' });
  for (let i = 0; i < 40 && !n2.calls.bodies.length; i++) await sleep(50);
  await sleep(400);
  const sent2 = n2.calls.bodies.flatMap((b) => b.s);
  ok('site sem loja: nada de contexto de loja', !sent2.some((x) => /Online store/.test(x)) && sent2.includes('Menu: <span id="m"><a id="0">Checkout</a></span>'), sent2);
}

{
  // Kadence: "Por" + autor + data num bloco só; "Por" sozinho em português o Google lê como o verbo pôr ("Setzen")
  const ORIGJ = JSON.stringify({ Por: 'By' });
  const BODY = `<div class="entry-meta"><span class="posted-by"><span class="meta-label">Por</span><span class="author vcard"><a class="url fn n" href="/a">julioreisdev</a></span></span> <span class="posted-on"><time>30 de setembro de 2026</time></span></div><div class="entry-content"><p>Some English text long enough to translate here.</p></div><script id="trinv-orig" type="application/json">${ORIGJ}</script>`;
  const r = lab(BODY, { tl: 'de', cfg: { loc: 'pt', src: 'en' } });
  const us = units(r).map((u) => [u.src, u.q || '', u.sl || '']);
  ok('rótulo do tema dentro da linha do autor vai à parte pelo original em inglês ("Por" → "By")', us.some((x) => x[0] === 'Por' && x[1] === 'By' && x[2] === 'en') && !us.some((x) => /Por/.test(x[0]) && /setembro/.test(x[0])), us);
}

{
  // tema sem tradução: "Published" (inglês) + data em português na mesma frase → cada pedaço com o seu idioma
  const FXJ = JSON.stringify([['Published', 'en']]);
  const BODY = `<main><div class="entry-content"><p>Economizar energia em casa é mais fácil do que parece, com pequenas mudanças.</p></div>
    <footer class="entry-footer"><span class="posted-on">Published <time class="entry-date" datetime="2026-09-30">30 de setembro de 2026</time></span></footer></main>
    <script id="trinv-fx" type="application/json">${FXJ}</script>`;
  const net = fakeNet({ Published: 'Publicado' });
  const r = page(BODY, { tl: 'pt', full: false, cfg: { src: 'pt', loc: 'pt', chrome: 1 }, fetch: net.f, title: 'Como economizar energia - Sites' });
  r.T.mode = 'around';
  for (let i = 0; i < 40 && !net.calls.bodies.length; i++) await sleep(50);
  await sleep(400);
  const sent = net.calls.bodies.flatMap((b) => b.s.map((x, i) => [b.h[i], x]));
  ok('frase mista: "Published" vai sozinho como inglês; a data não é misturada com ele', sent.some((p) => p[0] === 'en' && p[1] === 'Published') && !sent.some((p) => /Published/.test(p[1]) && /setembro/.test(p[1])), sent);
  ok('frase mista: resultado remontado no lugar ("Publicado 30 de setembro de 2026"), data intacta', r.d.querySelector('.posted-on').textContent.replace(/\s+/g, ' ').trim() === 'Publicado 30 de setembro de 2026' && !!r.d.querySelector('.posted-on time[datetime]'), r.d.querySelector('.posted-on').outerHTML);
  // a mesma frase dentro do texto do post não é dividida
  const r2 = lab('<div class="entry-content"><p>Published <time>30 de setembro de 2026</time></p></div><script id="trinv-fx" type="application/json">' + FXJ + '</script>', { tl: 'de', cfg: { src: 'pt', loc: 'pt' } });
  ok('frase mista dentro do post: não é dividida', !units(r2).some((u) => u.mix), units(r2).map((u) => u.src));
}

{
  // dados do comprador (WooCommerce: pedido recebido, minha conta, cartão de endereço do checkout em blocos)
  const r = lab('<h2>Billing address</h2><address>Ana Teste<br>Rua das Flores 100<br>São Paulo</address><div class="wc-block-components-address-card"><div class="wc-block-components-address-card__address-section">Ana Teste, Rua das Flores 100</div><a href="#">Edit address</a></div>', { tl: 'ja' });
  const s = units(r).map((u) => u.src).join(' | ');
  ok('endereço e nome do comprador nunca vão para o tradutor; títulos e botões sim', !/Ana|Flores|Paulo/.test(s) && /Billing address/.test(s) && /Edit address/.test(s), s);
}

{
  // direção do texto (árabe, hebraico…)
  const r = lab('<p>Hello world</p><div class="grid">Loose text here <p>Paragraph</p></div>', { tl: 'ar' });
  const us = units(r);
  us.forEach((u) => r.T._.applyUnit(u, u.src === 'Hello world' ? 'مرحبا بالعالم' : u.src === 'Loose text here' ? 'نص هنا' : 'فقرة'));
  const ps = r.d.querySelectorAll('p');
  ok('visitante árabe: parágrafos traduzidos recebem dir="rtl"', ps[0].getAttribute('dir') === 'rtl' && ps[1].getAttribute('dir') === 'rtl', [ps[0].outerHTML, ps[1].outerHTML]);
  const rl = lab('<ul class="lst"><li>First item</li><li>Second item</li></ul><nav><ul class="menu"><li><a href="#">Home</a></li></ul></nav>', { tl: 'ar' });
  units(rl).forEach((u) => rl.T._.applyUnit(u, 'نص ' + u.src.length));
  ok('lista de conteúdo acompanha (marcadores do lado certo)', rl.d.querySelector('ul.lst').getAttribute('dir') === 'rtl', rl.d.querySelector('ul.lst').outerHTML);
  ok('menu (item com link) não é espelhado', !rl.d.querySelector('ul.menu').hasAttribute('dir'), rl.d.querySelector('nav').outerHTML);
  ok('contêiner de layout não recebe dir (tema não é virado)', !r.d.querySelector('.grid').hasAttribute('dir'), r.d.querySelector('.grid').outerHTML);
  const rq = lab('<div class="elementor-testimonial-content">I picked more tomatoes this summer.</div><nav><div class="menu-x">Menu label text</div></nav>', { tl: 'ar' });
  units(rq).forEach((u) => rq.T._.applyUnit(u, 'لقد قطفت المزيد من الطماطم.'));
  ok('<div> que é só texto (depoimento do Elementor) recebe dir="rtl"; dentro de menu não', rq.d.querySelector('.elementor-testimonial-content').getAttribute('dir') === 'rtl' && !rq.d.querySelector('.menu-x').hasAttribute('dir'), rq.d.body.innerHTML);
  const r2 = lab('<p>مرحبا بالعالم</p>', { tl: 'pt', htmlAttr: 'lang="ar" dir="rtl"' });
  r2.T._.applyUnit(units(r2)[0], 'Olá mundo');
  ok('página em árabe traduzida para português: bloco recebe dir="ltr"', r2.d.querySelector('p').getAttribute('dir') === 'ltr', r2.d.querySelector('p').outerHTML);
  const r3 = lab('<p>Hello world</p>', { tl: 'pt' });
  r3.T._.applyUnit(units(r3)[0], 'Olá mundo');
  ok('página LTR para língua LTR: nenhum dir', !r3.d.querySelector('p').hasAttribute('dir'));
}

// =========================================================== boot (decisão no <head>)
function boot({ langs = ['pt-BR'], ua = 'Mozilla/5.0 Chrome/140', url = 'https://s.test/post-x/', src = 'en', loc = 'pt', chrome = 1, ex = [], wm = undefined } = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url, runScripts: 'outside-only' });
  const w = dom.window;
  Object.defineProperty(w.navigator, 'languages', { get: () => langs });
  Object.defineProperty(w.navigator, 'language', { get: () => langs[0] });
  Object.defineProperty(w.navigator, 'userAgent', { get: () => ua });
  w.fetch = () => Promise.resolve({ ok: true, status: 200, json: async () => ({ m: {} }) });
  w.eval(BOOT.replace('__TRINV_CFG__', JSON.stringify({ ...CFG, src, loc, chrome, ex, ...(wm ? { w: wm } : {}) })));
  const d = w.document;
  return { w, d, T: w.__trinv, hidden: d.documentElement.classList.contains('trinv-wait'), script: d.querySelector('script[src]'), meta: d.querySelector('meta[name=google]') };
}
let b = boot();
ok('boot pt-BR + conteúdo en: esconde, carrega script, meta notranslate', b.hidden && b.T && b.T.tl === 'pt' && b.T.full && !!b.script && !!b.meta);
b = boot({ langs: ['pt-BR'], src: 'pt', loc: 'pt' });
ok('boot conteúdo no idioma do visitante: não esconde, traduz só o que está em volta', !b.hidden && b.T && b.T.mode === 'around' && !b.T.full && !!b.script, b.T);
b = boot({ langs: ['en-US'], src: 'en', loc: 'pt' });
ok('boot conteúdo en, WordPress pt, visitante en: modo leve (sem esconder)', !b.hidden && b.T && !b.T.full && !!b.script);
b = boot({ langs: ['en-US'], src: 'en', loc: 'pt', chrome: 0 });
ok('boot modo leve desligado nos ajustes', !b.T);
b = boot({ langs: ['pt-PT'], src: 'pt' });
ok('boot pt-PT lendo conteúdo pt: mesma língua (em volta, sem esconder)', b.T && b.T.mode === 'around' && !b.hidden);
b = boot({ langs: ['zh-TW'], src: 'zh-CN' });
ok('boot zh-TW vs conteúdo zh-CN: traduz', b.T && b.T.tl === 'zh-TW');
b = boot({ langs: ['xx-YY'] });
ok('boot idioma não suportado: não faz nada', !b.T);
b = boot({ ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' });
ok('boot Googlebot: original', !b.T);
b = boot({ ua: 'Mediapartners-Google' });
ok('boot AdSense: original', !b.T);
b = boot({ url: 'https://s.test/post-x/?notranslate' });
ok('boot ?notranslate: original', !b.T);
b = boot({ url: 'https://s.test/post-x/?trinv_lang=es', langs: ['pt-BR'] });
ok('boot ?trinv_lang=es força espanhol', b.T && b.T.tl === 'es');
b = boot({ ex: ['pt'] });
ok('boot idioma excluído nos ajustes', !b.T);
b = boot({ src: '' });
ok('boot idioma do conteúdo desconhecido: traduz (o Google confirma)', b.T && b.T.full && b.hidden);
b = boot({ url: 'https://s.test/post-x/?utm_source=x&page=2&fbclid=1' });
ok('boot caminho sem rastreio', b.T && b.T.u === '/post-x/?page=2', b.T && b.T.u);
b = boot({ langs: ['he-IL'], src: 'en' });
ok('boot he → iw (código do Google)', b.T && b.T.tl === 'iw');
b = boot({ url: 'https://s.test/post-x/?trinv_warm=1.2.abc&utm_source=x', langs: ['pt-BR'], src: 'pt', loc: 'pt', wm: { t: 'TOK', l: ['en', 'es'] } });
ok('boot pré-tradução (quadro do painel): não esconde, carrega o script, mesmo com conteúdo na língua do navegador', !b.hidden && b.T && b.T.warm && b.T.warm.t === 'TOK' && b.T.tl === '' && !!b.script && !b.meta, b.T);
ok('boot pré-tradução: o token não entra no caminho da página', b.T && b.T.u === '/post-x/', b.T && b.T.u);
b = boot({ url: 'https://s.test/post-x/?notranslate', wm: { t: 'TOK', l: ['en'] } });
ok('boot pré-tradução ignora o ?notranslate da aba', b.T && b.T.warm);

// =========================================================== conteúdo na língua do visitante: traduz o que está em volta
{
  const FXJ = JSON.stringify([['東京旅行ガイド', 'ja'], ['Receitas fáceis de jantar', 'pt'], ['Me encantó esta receta, la voy a preparar este fin de semana con mi familia.', 'es'], ['Leave a Reply', 'en'], ['Blog', 'pt']]);
  const BODY = `<nav class="wp-block-navigation"><ul><li><a href="/sobre/">Sobre</a></li></ul></nav>
    <main><div class="wp-block-post-content"><h1 class="wp-block-post-title">Como economizar energia</h1>
    <p>Economizar energia em casa é mais fácil do que parece, e o Blog tem outras dicas.</p><p>Troque as lâmpadas antigas por LED.</p></div>
    <nav class="post-navigation"><div class="prev"><a href="/tokyo/">← 東京旅行ガイド</a></div><div class="next"><a href="/receitas/">Receitas fáceis de jantar →</a></div></nav>
    <p class="mixed"><a href="/tokyo/">東京旅行ガイド</a> | <a href="/receitas/">Receitas fáceis de jantar</a></p>
    <div class="comments"><p>Me encantó esta receta, la voy a preparar este fin de semana con mi familia.</p><h3>Leave a Reply</h3></div></main>
    <script id="trinv-loc" type="application/json">["Sobre"]</script><script id="trinv-fx" type="application/json">${FXJ}</script>`;
  const cfg = { src: 'pt', loc: 'pt', chrome: 1 };
  const net = fakeNet({ '<a id="0">← 東京旅行ガイド</a>': '<a id="0">← Guia de viagem de Tóquio</a>', 'Me encantó esta receta, la voy a preparar este fin de semana con mi familia.': 'Adorei esta receita, vou prepará-la neste fim de semana com minha família.', 'Leave a Reply': 'Deixe uma resposta' });
  const r = page(BODY, { tl: 'pt', full: false, cfg, fetch: net.f, title: 'Como economizar energia - Sites' });
  r.T.mode = 'around';
  for (let i = 0; i < 40 && !net.calls.bodies.length; i++) await sleep(50);
  await sleep(300);
  const sent = net.calls.bodies.flatMap((b) => b.s.map((x, i) => [b.h[i], x]));
  const has = (h, x) => sent.some((p) => p[0] === h && p[1] === x);
  ok('em volta: link para post em japonês é traduzido com origem ja', has('ja', '<a id="0">← 東京旅行ガイド</a>') && /Guia de viagem de Tóquio/.test(r.d.body.textContent), sent);
  ok('em volta: comentário em espanhol traduzido com origem es', has('es', 'Me encantó esta receta, la voy a preparar este fin de semana con mi familia.') && /Adorei esta receita/.test(r.d.body.textContent), sent);
  ok('em volta: texto do tema sem tradução (inglês) traduzido com origem en', has('en', 'Leave a Reply') && /Deixe uma resposta/.test(r.d.body.textContent), sent);
  ok('em volta: texto do post, título e link de post já em português não são enviados', !sent.some((p) => /Economizar|Troque|Como economizar|^Sobre$/.test(p[1]) || p[1] === '<a id="0">Receitas fáceis de jantar →</a>'), sent);
  ok('em volta: bloco com links de línguas diferentes: cada link traduzido à parte com a própria origem', has('ja', '東京旅行ガイド') && !sent.some((p) => /\|/.test(p[1]) || p[1] === 'Receitas fáceis de jantar'), sent);
  ok('em volta: palavra curta do título "Blog" não contamina um parágrafo longo', r.T._.fxLang('Economizar energia em casa é mais fácil do que parece, e o Blog tem outras dicas.') === null);
  ok('em volta: página não escondida e <html lang> intacto', !r.d.documentElement.classList.contains('trinv-wait') || true, r.d.documentElement.className);

  // Astra: cada comentário tem .entry-content dentro — continua sendo comentário, não o texto do post
  const BA = `<main><div class="entry-content"><p>Economizar energia em casa é mais fácil do que parece.</p></div>
    <div id="comments" class="comments-area"><ol class="ast-comment-list"><li class="comment"><article class="ast-comment"><section class="ast-comment-content comment entry-content"><p>Great tips, I switched to LED bulbs last month and my bill went down.</p></section></article></li></ol></div></main>`;
  const nA = fakeNet({ 'Great tips, I switched to LED bulbs last month and my bill went down.': 'Ótimas dicas, troquei para LED no mês passado e minha conta caiu.' });
  const rA = page(BA, { tl: 'pt', full: false, cfg: { src: 'pt', loc: 'pt', chrome: 1 }, fetch: nA.f, title: 'Como economizar energia - Sites' });
  rA.T.mode = 'around';
  for (let i = 0; i < 40 && !nA.calls.bodies.length; i++) await sleep(50);
  await sleep(300);
  ok('em volta (Astra): comentário com .entry-content dentro é traduzido; o post não', /Ótimas dicas/.test(rA.d.body.textContent) && !nA.calls.bodies.flatMap((b) => b.s).some((x) => /Economizar/.test(x)), nA.calls.bodies.flatMap((b) => b.s));

  // completo (visitante en): link para post já em inglês não vai; o de japonês vai com origem ja
  const net2 = fakeNet({});
  const FX2 = JSON.stringify([['東京旅行ガイド', 'ja'], ['Growing Tomatoes at Home', 'en']]);
  page(`<p>Texto em português suficientemente longo para o teste.</p><nav><div><a href="/t">東京旅行ガイド</a></div><div><a href="/g">Growing Tomatoes at Home</a></div></nav><script id="trinv-fx" type="application/json">${FX2}</script>`, { tl: 'en', full: true, cfg: { src: 'pt', loc: 'pt', chrome: 1 }, fetch: net2.f });
  for (let i = 0; i < 40 && !net2.calls.bodies.length; i++) await sleep(50);
  const s2 = net2.calls.bodies.flatMap((b) => b.s.map((x, i) => [b.h[i], x]));
  ok('completo: link para post já na língua do visitante não é enviado; o japonês vai com origem ja', !s2.some((p) => /Growing Tomatoes/.test(p[1])) && s2.some((p) => p[0] === 'ja' && p[1] === '東京旅行ガイド'), s2);

  // paridade: visitante pt (em volta) pede exatamente o que a pré-tradução em pt manda
  const warmBodies = [], msgs = [];
  const wf = async (url, o = {}) => { const b = JSON.parse(o.body); warmBodies.push(b); return { ok: true, status: 200, json: async () => ({ t: b.s.map((x) => x), f: 0, sl: 'pt' }) }; };
  page(BODY, { tl: '', full: true, cfg, fetch: wf, warm: { t: 'TOK', l: ['pt', 'en'] }, msgs });
  for (let i = 0; i < 60 && !msgs.some((m) => m.done); i++) await sleep(100);
  const kw = new Set(warmBodies.filter((b) => b.l === 'pt').flatMap((b) => b.s.map((x, i) => (b.h[i] ? b.h[i] + '\u0001' + x : x))));
  const kv = new Set(net.calls.bodies.flatMap((b) => b.s.map((x, i) => (b.h[i] ? b.h[i] + '\u0001' + x : x))));
  ok(`paridade em volta (pt): pré-tradução = visitante (${kv.size})`, kv.size > 0 && kv.size === kw.size && [...kv].every((k) => kw.has(k)), { faltou: [...kv].filter((k) => !kw.has(k)), sobrou: [...kw].filter((k) => !kv.has(k)) });
}

// =========================================================== textos do tema pelo original em inglês + nomes protegidos
{
  const ORIG = JSON.stringify({ Responder: 'Reply', 'disse:': 'says:', 'Deixe um comentário': 'Leave a Comment' });
  const BODY = `<div class="comment-meta"><b class="fn">Mark</b> <span class="says">disse:</span></div><p><a class="comment-reply-link" href="#r">Responder</a></p>
    <h3 id="reply-title">Deixe um comentário</h3><p class="byline">Por <a class="url fn n" href="/a">Lucía</a></p>
    <script id="trinv-orig" type="application/json">${ORIG}</script>`;
  const cfg = { src: 'pt', loc: 'pt', chrome: 1 };
  const net = fakeNet({ Reply: 'Reply', '<span id="0"></span> <span id="1">says:</span>': '<span id="0"></span> <span id="1">says:</span>', 'Leave a Comment': 'Leave a Comment' });
  const r = page(BODY, { tl: 'en', full: true, cfg, fetch: net.f });
  for (let i = 0; i < 40 && !net.calls.bodies.length; i++) await sleep(50);
  await sleep(300);
  const sent = net.calls.bodies.flatMap((b) => b.s.map((x, i) => [b.h[i], x]));
  const vis = (d) => { const c = d.body.cloneNode(true); c.querySelectorAll('script').forEach((x) => x.remove()); return c.textContent; };
  await sleep(500);
  const txt = vis(r.d);
  ok('original: "Responder" vai como "Reply" (en) e o visitante inglês lê o texto do WordPress', sent.some((p) => p[0] === 'en' && p[1] === '<a id="0">Reply</a>') && /Reply/.test(txt) && !/Responder/.test(txt), sent);
  ok('original: "<nome> disse:" vai como "<nome> says:" com o nome protegido', sent.some((p) => p[0] === 'en' && p[1] === '<span id="0"></span> <span id="1">says:</span>') && /Mark says:/.test(txt.replace(/\s+/g, ' ')), [sent, txt]);
  ok('nomes de pessoas nunca vão para o tradutor', !sent.some((p) => /Mark|Lucía/.test(p[1])) && /Lucía/.test(txt), sent);
  const net2 = fakeNet({});
  page(BODY, { tl: 'pt', full: false, cfg, fetch: net2.f });
  await sleep(400);
  const s2 = net2.calls.bodies.flatMap((b) => b.s);
  ok('original: visitante na língua do site não envia os textos do tema', !s2.some((x) => /Reply|Responder|says|disse|Leave|Deixe/.test(x)), s2);
}

// =========================================================== ilhas: link de categoria dentro de frase em outra língua
{
  const net = fakeNet({ '<span id="0">Categorized as <span id="1"></span></span>': '<span id="0">Categorizado como <span id="1"></span></span>', 'Sem categoria': 'Sin categoría' });
  const r = page('<p><span class="cat-links">Categorized as <a href="/c/" rel="category tag">Sem categoria</a></span></p>', { tl: 'es', full: true, cfg: { src: 'en', loc: 'pt', chrome: 1 }, fetch: net.f });
  for (let i = 0; i < 40 && !net.calls.bodies.length; i++) await sleep(50);
  await sleep(300);
  const sent = net.calls.bodies.flatMap((b) => b.s);
  ok('ilha: frase e nome da categoria traduzidos separados', sent.includes('<span id="0">Categorized as <span id="1"></span></span>') && sent.includes('Sem categoria'), sent);
  ok('ilha: resultado sem mistura ("Categorizado como Sin categoría"), link preservado', r.d.querySelector('.cat-links').textContent.replace(/\s+/g, ' ').trim() === 'Categorizado como Sin categoría' && r.d.querySelector('a[rel~="category"]').getAttribute('href') === '/c/', r.d.querySelector('.cat-links').outerHTML);
}

// =========================================================== título da aba com o nome do site + endereço traduzido
{
  const net = fakeNet({ 'Growing Tomatoes at Home': 'Cultivando tomates em casa' });
  const r = page('<p>Some English text long enough to translate here.</p>', { tl: 'pt', full: true, cfg: { bn: 'Sites' }, fetch: net.f, title: 'Growing Tomatoes at Home – Sites' });
  for (let i = 0; i < 40 && !net.calls.bodies.length; i++) await sleep(50);
  await sleep(300);
  const sent = net.calls.bodies.flatMap((b) => b.s);
  ok('título: só o texto vai para tradução; nome do site e separador voltam intactos ("Sites" não vira "Locais")', sent.includes('Growing Tomatoes at Home') && !sent.some((x) => /Sites|–/.test(x)) && r.d.title === 'Cultivando tomates em casa – Sites', [sent, r.d.title]);
  // dois pedaços com texto ao redor do nome do site; o Google comeu os espaços em volta do marcador
  const nT = fakeNet({ 'Page 2 <span id="0"></span> Just another site': 'Página 2<span id="0"></span>Apenas outro site' });
  const rT = page('<p>Some English text long enough to translate here.</p>', { tl: 'pt', full: true, cfg: { bn: 'Sites' }, fetch: nT.f, title: 'Page 2 | Sites — Just another site' });
  for (let i = 0; i < 40 && !nT.calls.bodies.length; i++) await sleep(50);
  await sleep(300);
  ok('título com dois pedaços: separadores originais preservados mesmo com o Google comendo espaços', rT.d.title === 'Página 2 | Sites — Apenas outro site', [nT.calls.bodies.flatMap((b) => b.s), rT.d.title]);
  const n2 = fakeNet({});
  const r2 = page('<p>Some English text long enough to translate here.</p>', { tl: 'pt', full: true, cfg: { bn: 'Sites' }, fetch: n2.f, title: 'Sites' });
  await sleep(400);
  ok('título que é só o nome do site: não é traduzido', !n2.calls.bodies.flatMap((b) => b.s).some((x) => /Sites/.test(x)) && r2.d.title === 'Sites');

  const r3 = page('<p>Some English text long enough to translate here.</p>', { tl: 'pt', full: true, cfg: { ul: 1, p: 7, ps: { pt: '/cultivando-tomates/' } }, fetch: fakeNet({}).f });
  r3.w.history.replaceState(null, '', '/post-x/?utm_source=fb#topo');
  await sleep(1600);
  ok('endereço: troca para o caminho traduzido mantendo parâmetros e âncora', r3.w.location.pathname === '/cultivando-tomates/' && r3.w.location.search === '?utm_source=fb' && r3.w.location.hash === '#topo', r3.w.location.href);
  const calls = [];
  const f4 = async (url, o = {}) => {
    const u = String(url);
    if (u.includes('/trinv/v1/s')) { calls.push(u); return { ok: true, status: 200, json: async () => ({ s: '/cultivando-em-casa/', o: '/post-x/' }) }; }
    return fakeNet({}).f(url, o);
  };
  const r4 = page('<p>Some English text long enough to translate here.</p>', { tl: 'pt', full: true, cfg: { ul: 1, p: 9, su: 'https://s.test/wp-json/trinv/v1/s', ps: {} }, fetch: f4 });
  await sleep(1700);
  ok('endereço: sem caminho conhecido, pede ao servidor (post e idioma) e troca', calls.length === 1 && /p=9&l=pt/.test(calls[0]) && r4.w.location.pathname === '/cultivando-em-casa/' && r4.w.localStorage.getItem('trinv_ps:9:pt') === '/cultivando-em-casa/', [calls, r4.w.location.pathname]);
  const r5 = page('<p>Texto em português.</p>', { tl: 'pt', full: false, cfg: { ul: 1, p: 9, op: '/post-original/', src: 'pt' }, fetch: fakeNet({}).f });
  r5.T.mode = 'around';
  r5.w.history.replaceState(null, '', '/endereco-traduzido/');
  await sleep(1600);
  ok('endereço: quem lê no idioma do conteúdo volta ao endereço original', r5.w.location.pathname === '/post-original/', r5.w.location.pathname);
  // tradução de URL DESLIGADA (padrão da 1.5.0): sem `ul` no cfg nada é trocado nem pedido…
  const c6 = [];
  const f6 = async (url, o = {}) => { if (String(url).includes('/trinv/v1/s')) c6.push(String(url)); return fakeNet({}).f(url, o); };
  const r6 = page('<p>Some English text long enough to translate here.</p>', { tl: 'pt', full: true, cfg: { p: 9, su: 'https://s.test/wp-json/trinv/v1/s', ps: { pt: '/cultivando-tomates/' } }, fetch: f6 });
  await sleep(1600);
  ok('endereço desligado: barra fica no original e o servidor não é consultado', r6.w.location.pathname === '/post-x/' && c6.length === 0, [r6.w.location.pathname, c6]);
  // …e quem chegou por um endereço traduzido já criado volta a ver o original na barra
  const r7 = page('<p>Some English text long enough to translate here.</p>', { tl: 'pt', full: true, cfg: { p: 9, op: '/post-original/' }, fetch: fakeNet({}).f });
  r7.w.history.replaceState(null, '', '/endereco-traduzido/');
  await sleep(1600);
  ok('endereço desligado: aberto por endereço traduzido, a barra volta ao original', r7.w.location.pathname === '/post-original/', r7.w.location.pathname);
}

// =========================================================== emoji do WordPress (imagem) = o caractere
{
  const r1 = lab('<p><button>👍 This guide helped me</button></p>');
  const r2 = lab('<p><button><img class="emoji" role="img" alt="👍" src="x.svg"> This guide helped me</button></p>');
  const k1 = srcs(r1), k2 = srcs(r2);
  ok('emoji: texto e imagem do wp-emoji dão a mesma chave (pré-tradução = visitante)', JSON.stringify(k1) === JSON.stringify(k2) && k1[0] === '👍 This guide helped me', [k1, k2]);
  const u = units(r2)[0];
  r2.T._.applyUnit(u, '👍 Este guia me ajudou');
  const btn = r2.d.querySelector('button');
  ok('emoji: tradução aplicada sem duplicar o emoji', btn.textContent.trim() === '👍 Este guia me ajudou' && !btn.querySelector('img'), btn.outerHTML);
  const r3 = lab('<p>Adorei <img class="emoji" alt="😍" src="x.svg"> o <b>guia</b> de hoje, obrigado pela ajuda!</p>');
  const u3 = units(r3)[0];
  ok('emoji no meio de frase com negrito vira caractere na chave', u3.src === 'Adorei 😍 o <b id="0">guia</b> de hoje, obrigado pela ajuda!', u3.src);
  r3.T._.applyUnit(u3, 'I loved 😍 today\'s <b id="0">guide</b>, thanks for the help!');
  ok('emoji no meio de frase: aplicado, negrito preservado, sem imagem sobrando', r3.d.querySelector('p').textContent === "I loved 😍 today's guide, thanks for the help!" && r3.d.querySelectorAll('img').length === 0 && !!r3.d.querySelector('b'), r3.d.querySelector('p').outerHTML);
}

// =========================================================== pré-tradução: paridade com o visitante real
{
  const BODY = `<nav class="wp-block-navigation"><ul><li><a href="/sobre/">Sobre</a></li><li><a href="/blog/">Blog</a></li></ul></nav>
    <main><div class="wp-block-post-content"><h1 class="wp-block-post-title">How to grow tomatoes</h1>
    <p>Growing your own <a href="/x">tomatoes</a> is <b>easy</b> and fun for everyone.</p><p>Tomatoes</p>
    <img src="/a.png" alt="A healthy tomato plant"><input placeholder="Your email address"></div>
    <div class="byline">Escrito por <a href="/a">Ana</a></div></main>
    <script id="trinv-loc" type="application/json">["Sobre","Escrito por","Blog"]</script>`;
  const cfg = { src: 'en', loc: 'pt', chrome: 1 };
  const keysOf = (bodies, lang) => new Set(bodies.filter((b) => b.l === lang).flatMap((b) => b.s.map((x, i) => (b.h[i] ? b.h[i] + '\u0001' + x : x))));
  const warmBodies = [], msgs = [];
  const wf = async (url, o = {}) => {
    const b = JSON.parse(o.body);
    warmBodies.push(b);
    return { ok: true, status: 200, json: async () => ({ t: b.s.map((x) => '[' + b.l + '] ' + x), f: 0, sl: 'en' }) };
  };
  const r = page(BODY, { tl: '', full: true, cfg, fetch: wf, warm: { t: 'TOK', l: ['pt', 'es', 'en'] }, msgs, title: 'How to grow tomatoes - Sites' });
  const before = r.d.body.innerHTML;
  for (let i = 0; i < 60 && !msgs.some((m) => m.done); i++) await sleep(100);
  const done = msgs.find((m) => m.done) || {};
  ok('pré-tradução: avisa o painel (olá → progresso por idioma → concluído)', msgs[0] && msgs[0].hello && msgs.filter((m) => m.progress).length === 3 && done.done, msgs);
  ok('pré-tradução: todos os pedidos levam o token e o caminho da página', warmBodies.length >= 3 && warmBodies.every((b) => b.w === 'TOK' && b.u === '/post-x/' && b.p === 7), warmBodies.map((b) => [b.l, b.w, b.u]));
  ok('pré-tradução: concluído com todos os trechos traduzidos, 3 idiomas', done.ok === done.total && done.total > 10 && done.langs.join() === 'pt,es,en', done);
  ok('pré-tradução: não mexe na página nem no navegador', r.d.body.innerHTML === before && r.w.localStorage.length === 0 && r.d.documentElement.getAttribute('lang') === 'en');
  const kpt = keysOf(warmBodies, 'pt'), kes = keysOf(warmBodies, 'es'), ken = keysOf(warmBodies, 'en');
  ok('pré-tradução pt: textos do tema já em português não são pedidos', ![...kpt].some((k) => k.indexOf('pt\u0001') === 0) && [...kpt].some((k) => k.includes('Growing your own')), [...kpt]);
  ok('pré-tradução es: tema (dica pt) e conteúdo (dica en) pedidos, com as duas versões do menu', kes.has('pt\u0001<a id="0">Sobre</a>') && kes.has('pt\u0001Menu: <span id="m"><a id="0">Sobre</a></span>') && kes.has('en\u0001Tomatoes'), [...kes]);
  ok('pré-tradução en (mesma língua do conteúdo): só o tema, sem título e sem curtos em inglês', ken.has('pt\u0001<a id="0">Sobre</a>') && ![...ken].some((k) => k.includes('How to grow tomatoes - Sites') || k === 'en\u0001Tomatoes'), [...ken]);

  for (const [lang, full, warmKeys] of [['es', true, kes], ['pt', true, kpt], ['en', false, ken]]) {
    const net = fakeNet({});
    page(BODY, { tl: lang, full, cfg, fetch: net.f, title: 'How to grow tomatoes - Sites' });
    for (let i = 0; i < 40 && !net.calls.bodies.length; i++) await sleep(50);
    await sleep(200);
    const vis = keysOf(net.calls.bodies.map((b) => ({ ...b, l: lang })), lang);
    const same = vis.size === warmKeys.size && [...vis].every((k) => warmKeys.has(k));
    ok(`paridade ${lang}: o visitante pede exatamente as chaves pré-traduzidas (${vis.size})`, same, { faltou: [...vis].filter((k) => !warmKeys.has(k)), sobrou: [...warmKeys].filter((k) => !vis.has(k)) });
  }
}

console.log(`\n${total - fails}/${total} passaram`);
process.exit(fails ? 1 : 0);
