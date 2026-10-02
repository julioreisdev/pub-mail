// Testes em outros navegadores (Firefox, Safari/WebKit, iPhone, Android) com Playwright.
// Roda NO SERVIDOR (Ubuntu): ./run-browsers.sh  (copia este arquivo para /opt/trinv-browsers e executa)
import { firefox, webkit, chromium, devices } from 'playwright';
import fs from 'node:fs';

const BASE = 'https://sites.reveleonline.com';
const OUT = '/opt/trinv-browsers/shots';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0, total = 0;
const ok = (label, cond, extra) => { total++; if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (cond || extra === undefined ? '' : '  → ' + JSON.stringify(extra).slice(0, 900))); };

const INSTR = `(function(){var T=window.__tl={hidden:false,reveal:null,revealText:''};
function chk(){var h=document.documentElement;if(!h||!h.classList)return;if(h.classList.contains('trinv-wait'))T.hidden=true;else if(T.hidden&&T.reveal===null){T.reveal=performance.now();T.revealText=(document.body&&document.body.innerText||'').slice(0,6000);}}
new MutationObserver(chk).observe(document,{attributes:true,subtree:true,childList:true,attributeFilter:['class']});})();`;

const ENGINES = [
  ['Firefox (computador)', firefox, {}],
  ['Safari (computador)', webkit, {}],
  ['iPhone (Safari)', webkit, devices['iPhone 15']],
  ['Android (Chrome)', chromium, devices['Pixel 7']],
];
const PAGES = [
  ['/grow-tomatoes/', 'Growing your own', true],
  ['/tomato-course/', 'Grow juicy tomatoes', true],
  ['/product/self-watering-pot/', 'A large pot with a water reservoir', true],
  ['/', null, false],
];
const LANGS = [['pt-BR', 'pt'], ['de-DE', 'de'], ['ja', 'ja'], ['en-US', 'en']];
const KEEP = /GreenThumb|TOMATO10|^Advertisement$|julioreisdev|Lucía|Mark|Joana|Sarah Miller|Kadence WP|^Sites$|^[\d\W]+$|@|https?:|R\$/;
const linesOf = (t) => t.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l.split(' ').length >= 2 && (l.match(/\p{L}/gu) || []).length >= 6 && !KEEP.test(l));
const inLang = (V, l) => (V === 'ja' ? /[ぁ-んァ-ン一-龯]/.test(l) : false);

const only = process.argv[2] || '';
const times = {};
for (const [name, engine, dev] of ENGINES) {
  if (only && !name.includes(only)) continue;
  const browser = await engine.launch();
  // o original de cada página, no mesmo motor (para comparar linha a linha)
  const base = {};
  {
    const ctx = await browser.newContext({ ...dev, locale: 'pt-BR' });
    const p = await ctx.newPage();
    for (const [pg] of PAGES) {
      await p.goto(BASE + pg + '?notranslate', { waitUntil: 'load' });
      await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
      await sleep(1200);
      base[pg] = linesOf(await p.evaluate(() => document.body.innerText));
    }
    await ctx.close();
  }
  for (const [locale, V] of LANGS) {
    const ctx = await browser.newContext({ ...dev, locale });
    await ctx.addInitScript(INSTR);
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/favicon|status of 404|adsbygoogle/i.test(m.text())) errors.push('console: ' + m.text()); });
    const bad = [];
    for (const [pg, en, post] of PAGES) {
      errors.length = 0;
      await p.goto(BASE + pg, { waitUntil: 'load' });
      await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
      let st = null;
      for (let i = 0; i < 40; i++) {
        st = await p.evaluate(() => ({ wait: document.documentElement.classList.contains('trinv-wait'), mode: window.__trinv && window.__trinv.mode, tl: window.__trinv && window.__trinv.tl }));
        if (!st.wait) break;
        await sleep(150);
      }
      await sleep(1500);
      let left = [];
      const check = async () => {
        const txt = await p.evaluate(() => document.body.innerText);
        const now = new Set(linesOf(txt));
        const same = V === 'de' || V === 'ja' ? base[pg].filter((l) => now.has(l) && !inLang(V, l)) : [];
        const enLeft = V !== 'en' && en && txt.includes(en) ? ['inglês: ' + en] : [];
        return same.concat(enLeft);
      };
      left = await check();
      for (let i = 0; i < 8 && left.length; i++) { await sleep(700); left = await check(); }
      const tl = await p.evaluate(() => window.__tl);
      const flash = V !== 'en' && en && tl.reveal !== null && tl.revealText.includes(en);
      if (tl.reveal !== null) (times[name] = times[name] || []).push(tl.reveal);
      let path = await p.evaluate(() => location.pathname);
      if (post && V !== 'en') {
        for (let i = 0; i < 30 && path === pg; i++) { await sleep(300); path = await p.evaluate(() => location.pathname); }
      }
      const urlOk = !post || V === 'en' ? path === pg : path !== pg;
      if (V === 'ja' && pg === '/grow-tomatoes/') await p.screenshot({ path: `${OUT}/${name.replace(/\W+/g, '-')}-ja.png` });
      if (V === 'de' && pg === '/tomato-course/') await p.screenshot({ path: `${OUT}/${name.replace(/\W+/g, '-')}-de-elementor.png` });
      if (left.length || st.wait || flash || errors.length || !urlOk) bad.push({ pg, sobrou: left.slice(0, 4), escondida: st.wait, flash, erros: errors.slice(0, 3), path, mode: st.mode });
    }
    // depois de traduzir: navegar pelo link do menu e voltar (bfcache do Safari/Firefox)
    await p.goto(BASE + '/grow-tomatoes/', { waitUntil: 'load' });
    await sleep(2500);
    await p.goto(BASE + '/tomato-course/', { waitUntil: 'load' });
    await sleep(2000);
    await p.goBack({ waitUntil: 'load' }).catch(() => {});
    await sleep(2500);
    const back = await p.evaluate(() => ({ wait: document.documentElement.classList.contains('trinv-wait'), txt: document.body.innerText.slice(0, 3000) }));
    if (back.wait || (V !== 'en' && back.txt.includes('Growing your own'))) bad.push({ voltar: true, escondida: back.wait, txt: back.txt.slice(0, 200) });
    ok(`${name} · ${V}: ${PAGES.length} páginas 100% traduzidas, sem piscar, sem erros, endereço certo, botão Voltar ok`, !bad.length, bad);
    await ctx.close();
  }
  await browser.close();
}
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return Math.round(b[Math.floor(b.length / 2)]); };
for (const [k, v] of Object.entries(times)) console.log(`   tempo até aparecer traduzida (mediana, ${v.length} visitas): ${k} ${med(v)} ms`);
console.log(`\n${total - fails}/${total} passaram`);
process.exit(fails ? 1 : 0);
