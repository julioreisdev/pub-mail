// Capturas: card da licença no wp-admin (ativa / pausada) e a página Push In Play do Pub Mail (claro/escuro/celular).
// Roda no servidor. Env: PM_TOKEN (JWT), PM_ME (json do /auth/me), ONLY=wp|pm, WP_SHOT (nome da captura do wp-admin).
import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = '/tmp/pipshots';
fs.mkdirSync(OUT, { recursive: true });
const only = process.env.ONLY || '';
const browser = await chromium.launch();
const errors = [];
function watch(p, l) {
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`[${l}] console: ${m.text()}`); });
  p.on('pageerror', (e) => errors.push(`[${l}] pageerror: ${e.message}`));
}
if (!only || only === 'wp') {
  const cookies = JSON.parse(fs.readFileSync('/tmp/pip_cookies.json', 'utf8'));
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await c.addCookies([
    { name: cookies.sec.name, value: cookies.sec.value, domain: 'sites.reveleonline.com', path: '/', secure: true, httpOnly: true },
    { name: cookies.li.name, value: cookies.li.value, domain: 'sites.reveleonline.com', path: '/', secure: true, httpOnly: true }
  ]);
  const p = await c.newPage();
  watch(p, 'wp');
  await p.goto('https://sites.reveleonline.com/wp-admin/admin.php?page=push-in-play-settings', { waitUntil: 'networkidle' });
  const name = process.env.WP_SHOT || 'wp-license';
  await p.screenshot({ path: `${OUT}/${name}.png`, clip: { x: 0, y: 0, width: 1440, height: 560 } });
  const txt = await p.locator('.pip-license').innerText().catch(() => '(sem card)');
  console.log(`WP card [${name}]:`, txt.replace(/\s+/g, ' ').trim());
  // "Verificar agora" de verdade
  if (process.env.WP_CHECK) {
    await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle' }), p.locator('.pip-license a', { hasText: 'Verificar agora' }).click()]);
    console.log('após Verificar agora:', p.url().replace(/^.*\?/, '?'), '|', (await p.locator('.pip-notice').first().innerText().catch(() => '')).trim());
    await p.screenshot({ path: `${OUT}/${name}-checked.png`, clip: { x: 0, y: 0, width: 1440, height: 560 } });
  }
  await c.close();
}
if (!only || only === 'pm') {
  const tok = process.env.PM_TOKEN;
  const me = JSON.parse(process.env.PM_ME || '{}');
  const shots = [
    { name: 'pm-light', vp: { width: 1440, height: 1000 }, dark: false },
    { name: 'pm-dark', vp: { width: 1440, height: 1000 }, dark: true },
    { name: 'pm-mobile', vp: { width: 390, height: 844 }, dark: false, mobile: true }
  ];
  for (const s of shots) {
    const c = await browser.newContext({
      viewport: s.vp,
      deviceScaleFactor: s.mobile ? 2 : 1,
      isMobile: Boolean(s.mobile),
      hasTouch: Boolean(s.mobile),
      colorScheme: s.dark ? 'dark' : 'light'
    });
    await c.addInitScript(
      ([t, u, d]) => {
        try {
          localStorage.setItem('token', t);
          localStorage.setItem('refreshToken', t);
          localStorage.setItem('user', JSON.stringify(u));
          localStorage.setItem('theme-mode', d ? 'dark' : 'light');
        } catch {}
      },
      [tok, me, s.dark]
    );
    const p = await c.newPage();
    watch(p, s.name);
    await p.goto('https://reveleonline.com/wordpress/push-in-play', { waitUntil: 'networkidle' });
    await p.waitForTimeout(1800);
    const hscroll = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    const pills = await p.locator('main, body').first().innerText().then((t) => t.replace(/\s+/g, ' ').slice(0, 900));
    console.log(`${s.name}: hscroll=${hscroll} | ${pills}`);
    await p.screenshot({ path: `${OUT}/${s.name}.png`, fullPage: true });
    await c.close();
  }
}
console.log('errors:', errors.length ? errors : 'nenhum');
await browser.close();
