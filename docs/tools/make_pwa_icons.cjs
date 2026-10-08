// Gera os ícones do PWA (front/vite/public/pwa/) a partir do monograma "PM" (mesmas cores do favicon).
// Uso (na raiz do repo, com o back instalado): node docs/tools/make_pwa_icons.cjs
const path = require('path');
const sharp = require(path.join(__dirname, '../../back/node_modules/sharp'));
const out = path.join(__dirname, '../../front/vite/public/pwa/');
const grad = `<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f90f7"/><stop offset="1" stop-color="#1b55bd"/></linearGradient>
  <radialGradient id="h" cx="0.25" cy="0.12" r="0.9"><stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/><stop offset="0.55" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
</defs>`;
// texto: escala = fração do lado ocupada pela altura das letras
const pm = (scale, color = '#ffffff') =>
  `<text x="256" y="${Math.round(256 + 512 * scale * 0.716 / 2)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${Math.round(512 * scale)}" letter-spacing="-${Math.round(512 * scale * 0.05)}" fill="${color}">PM</text>`;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${grad}${body}</svg>`;
const any = svg(`<rect width="512" height="512" rx="114" fill="url(#g)"/><rect width="512" height="512" rx="114" fill="url(#h)"/>${pm(0.44)}`);
const full = svg(`<rect width="512" height="512" fill="url(#g)"/><rect width="512" height="512" fill="url(#h)"/>${pm(0.44)}`);
const mask = svg(`<rect width="512" height="512" fill="url(#g)"/><rect width="512" height="512" fill="url(#h)"/>${pm(0.34)}`); // cabe no círculo de 80 %
const badge = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${pm(0.5)}</svg>`;
const jobs = [
  [any, 'icon-192.png', 192], [any, 'icon-512.png', 512], [any, 'icon-96.png', 96],
  [mask, 'maskable-192.png', 192], [mask, 'maskable-512.png', 512],
  [full, 'apple-touch-icon.png', 180], [badge, 'badge-96.png', 96],
];
(async () => {
  for (const [s, name, size] of jobs) {
    await sharp(Buffer.from(s), { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toFile(out + name);
  }
  console.log('ok');
})();
