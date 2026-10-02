// Captura a página WordPress → Tradução Invisível do Pub Mail logado como o cliente temporário (token injetado, nunca impresso).
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const S = new URL('.', import.meta.url).pathname;
const st = JSON.parse(fs.readFileSync(S + 'wp_lic_state.json', 'utf8'));
const tok = st.tok[st.email].t;
const [,, w = '1366', h = '900', out = 'panel.png', mode = 'light'] = process.argv;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9800 + Math.floor(Math.random() * 300);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-'));
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, `--window-size=${w},${h}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t; for (let i = 0; i < 80; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', (e) => { const d = JSON.parse(e.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } });
const send = (m, p = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
await send('Page.enable'); await send('Runtime.enable');
if (+w < 700) await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 2, mobile: true });
await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('token', ${JSON.stringify(tok)});localStorage.setItem('theme-mode', ${JSON.stringify(mode)});}catch(e){}` });
await send('Page.navigate', { url: 'https://reveleonline.com/wordpress/tradutor' });
await sleep(7000);
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
fs.writeFileSync(S + out, Buffer.from(shot.result.data, 'base64'));
const info = await send('Runtime.evaluate', { expression: '({url: location.pathname, text: document.body.innerText.slice(0, 400), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth})', returnByValue: true });
console.log(JSON.stringify(info.result.result.value));
ws.close(); proc.kill('SIGKILL');
