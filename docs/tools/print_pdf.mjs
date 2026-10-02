// Imprime um HTML em PDF com o Chrome headless (DevTools). Rodapé "<texto>   N / total" se houver texto.
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const [,, input, output, footer] = process.argv;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9300 + Math.floor(Math.random() * 500);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-'));
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t; for (let i = 0; i < 80; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pend = new Map(); let loaded = false;
ws.addEventListener('message', (e) => { const d = JSON.parse(e.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } if (d.method === 'Page.loadEventFired') loaded = true; });
const send = (m, p = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
await send('Page.enable'); await send('Page.navigate', { url: 'file://' + path.resolve(input) });
for (let i = 0; i < 100 && !loaded; i++) await sleep(100); await sleep(500);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const res = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: !!footer, headerTemplate: '<span></span>',
  footerTemplate: footer ? `<div style="width:100%;font-size:8px;color:#64748b;padding:0 16mm;display:flex;justify-content:space-between;font-family:Arial"><span>${esc(footer)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>` : '<span></span>' });
fs.writeFileSync(output, Buffer.from(res.result.data, 'base64'));
ws.close(); proc.kill('SIGKILL'); setTimeout(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }, 1000);
