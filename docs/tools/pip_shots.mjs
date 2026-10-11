// Capturas + teste funcional do Push In Play em sites.reveleonline.com (roda no servidor).
import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = 'https://sites.reveleonline.com';
const OUT = '/tmp/pipshots'; fs.mkdirSync(OUT, { recursive: true });
const cookies = JSON.parse(fs.readFileSync('/tmp/pip_cookies.json', 'utf8'));
const browser = await chromium.launch();
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const UA_M = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const human = (c) => c.addInitScript(() => { try { Object.defineProperty(navigator, 'webdriver', { get: () => false }); Object.defineProperty(Notification, 'permission', { get: () => 'default' }); } catch (e) {} });
const errors = [];
async function ctx(opts = {}) {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, ...opts });
  await c.addCookies([
    { name: cookies.sec.name, value: cookies.sec.value, domain: 'sites.reveleonline.com', path: '/', secure: true, httpOnly: true },
    { name: cookies.li.name, value: cookies.li.value, domain: 'sites.reveleonline.com', path: '/', secure: true, httpOnly: true },
  ]);
  return c;
}
function watch(page, label) {
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${label}] console: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${label}] pageerror: ${e.message}`));
}
const ADMIN = `${BASE}/wp-admin/admin.php?page=push-in-play-popup-layout`;
// 1) lista + editor desktop
{
  const c = await ctx(); const p = await c.newPage(); watch(p, 'admin');
  await p.goto(ADMIN, { waitUntil: 'networkidle' });
  await p.screenshot({ path: `${OUT}/01-lista.png`, fullPage: true });
  await p.goto(`${ADMIN}&edit=1`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#pip-stage .pip-root', { timeout: 8000 }).catch(() => errors.push('editor: prévia não renderizou'));
  await p.screenshot({ path: `${OUT}/02-editor.png`, fullPage: true });
  // troca o tipo na prévia e vê se ela segue
  for (const t of ['corner-br', 'bar-top']) {
    await p.click(`.pip-type-card input[value="${t}"]`, { force: true });
    await p.waitForTimeout(250);
    const cls = await p.$eval('#pip-stage .pip-root', el => el.className);
    if (!cls.includes(t)) errors.push(`editor: prévia não trocou para ${t} (${cls})`);
  }
  await p.screenshot({ path: `${OUT}/03-editor-bar-top.png`, fullPage: false });
  // modo celular da prévia
  await p.click('[data-stage-size="phone"]'); await p.waitForTimeout(250);
  await p.screenshot({ path: `${OUT}/04-editor-phone-preview.png` });
  // CSS avançado: carregar o padrão
  await p.click('.pip-advanced summary'); await p.waitForTimeout(150);
  await p.click('#pip-css-default'); await p.waitForTimeout(150);
  const css = await p.$eval('textarea[name="custom_css"]', el => el.value.length);
  if (css < 200) errors.push('editor: botão CSS padrão não preencheu');
  await c.close();
}
// 2) admin no celular
{
  const c = await ctx({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p = await c.newPage(); watch(p, 'admin-mobile');
  await p.goto(ADMIN, { waitUntil: 'networkidle' });
  await p.screenshot({ path: `${OUT}/05-lista-mobile.png`, fullPage: true });
  await p.goto(`${ADMIN}&edit=1`, { waitUntil: 'networkidle' });
  await p.screenshot({ path: `${OUT}/06-editor-mobile.png`, fullPage: true });
  const hs = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (hs) errors.push('editor-mobile: rolagem horizontal');
  await c.close();
}
// 3) front: cada tipo (o layout 1 está ligado durante o teste; tipo trocado por SQL fora daqui)
const types = (process.env.TYPES || 'modal,bar-top,bar-bottom,corner-tl,corner-tr,corner-bl,corner-br').split(',');
for (const t of types) {
  // sinaliza o tipo pro shell trocar via SQL (arquivo de controle)
  fs.writeFileSync('/tmp/pip_type_req', t);
  while (fs.existsSync('/tmp/pip_type_req')) await new Promise(r => setTimeout(r, 150));
  for (const mob of [false, true]) {
    const c = await browser.newContext(mob ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: UA_M } : { viewport: { width: 1440, height: 900 }, userAgent: UA });
    await human(c);
    const p = await c.newPage(); watch(p, `front-${t}`);
    await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    const ok = await p.waitForSelector('.pip-root', { timeout: 8000 }).then(() => true).catch(() => false);
    if (!ok) errors.push(`front-${t}: popup não apareceu`);
    const cls = ok ? await p.$eval('.pip-root', el => el.className) : '';
    if (ok && !cls.includes(t)) errors.push(`front-${t}: classe ${cls}`);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/10-front-${t}${mob ? '-mobile' : ''}.png` });
    if (!mob && ok) {
      await p.click('.pip-dismiss'); await p.waitForTimeout(600);
      const gone = await p.$('.pip-root');
      if (gone) errors.push(`front-${t}: popup não fechou ao dispensar`);
    }
    await c.close();
  }
}
// 4) aceitar (permissão concedida) — conta clique; granted depende do subscribe real
{
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['notifications'], userAgent: UA });
  await human(c);
  await c.addInitScript(() => { try { Notification.requestPermission = () => Promise.resolve('granted'); } catch (e) {} });
  const p = await c.newPage(); watch(p, 'front-accept');
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const okA = await p.waitForSelector('.pip-accept', { timeout: 8000 }).then(() => true).catch(() => false);
  if (!okA) errors.push('front-accept: botão não apareceu');
  if (okA) { await p.click('.pip-accept'); await p.waitForTimeout(3000); }
  const sw = await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration('/'); return r ? (r.active || r.installing || r.waiting) ? 'registrado' : 'sem worker' : 'nenhum'; });
  console.log('service worker:', sw);
  const sub = await p.evaluate(() => localStorage.getItem('pip_subscribed'));
  console.log('pip_subscribed:', sub);
  await c.close();
}
await browser.close();
fs.writeFileSync('/tmp/pip_type_req', 'END');
console.log(errors.length ? 'ERROS:\n' + errors.join('\n') : 'SEM ERROS DE CONSOLE/FLUXO');
