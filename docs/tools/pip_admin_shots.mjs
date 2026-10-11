// Capturas das telas do Push In Play no wp-admin do site de teste (roda no servidor, em /opt/keepalive).
// Antes: gerar /tmp/pip_cookies.json com `wp eval` (WP_Session_Tokens + wp_generate_auth_cookie) — ver CLAUDE.md.
// Env: PAGES=settings,automation,popup-layout (padrão; aceita query: copys?new=1, broadcasts?view=history), OUT=/tmp/pipshots, MOBILE=1 (390 px).
import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = process.env.OUT || '/tmp/pipshots';
fs.mkdirSync(OUT, { recursive: true });
const cookies = JSON.parse(fs.readFileSync('/tmp/pip_cookies.json', 'utf8'));
const pages = (process.env.PAGES || 'settings,automation,popup-layout').split(',').map((s) => s.trim()).filter(Boolean);
const mobile = !!process.env.MOBILE;
const browser = await chromium.launch();
const c = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
await c.addCookies([
  { name: cookies.sec.name, value: cookies.sec.value, domain: 'sites.reveleonline.com', path: '/', secure: true, httpOnly: true },
  { name: cookies.li.name, value: cookies.li.value, domain: 'sites.reveleonline.com', path: '/', secure: true, httpOnly: true }
]);
const errors = [];
for (const key of pages) {
  const p = await c.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`[${key}] console: ${m.text()}`); });
  p.on('pageerror', (e) => errors.push(`[${key}] pageerror: ${e.message}`));
  const [screen, extra] = key.split('?');
  const slug = screen === 'copys' ? 'push-in-play' : `push-in-play-${screen}`;
  await p.goto(`https://sites.reveleonline.com/wp-admin/admin.php?page=${slug}${extra ? '&' + extra : ''}`, { waitUntil: 'networkidle' });
  const body = await p.locator('body').innerText();
  const php = body.match(/(Warning|Notice|Fatal error|Deprecated): .{0,120}/);
  if (php) errors.push(`[${key}] PHP: ${php[0]}`);
  const hscroll = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  const fname = key.replace(/[^a-z0-9-]+/gi, '_');
  await p.screenshot({ path: `${OUT}/${fname}${mobile ? '-mobile' : ''}.png`, fullPage: true });
  console.log(`${key}: hscroll=${hscroll} | ${body.replace(/\s+/g, ' ').slice(0, 700)}`);
  await p.close();
}
console.log('errors:', errors.length ? errors : 'nenhum');
await browser.close();
