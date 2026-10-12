// Gera front/vite/public/og-image-square.png (1024×1024): a mesma arte da og-image.png (fundo navy com brilho,
// selo "PM", "Pub Mail" e a frase) em formato quadrado para foto de perfil do WhatsApp/redes.
// A foto de perfil vira um círculo: tudo que importa fica dentro do círculo central (~80 % do lado).
// Uso (na raiz do repo, com o back instalado): node docs/tools/make_og_square.cjs
const path = require('path');
const sharp = require(path.join(__dirname, '../../back/node_modules/sharp'));
const out = path.join(__dirname, '../../front/vite/public/og-image-square.png');
const S = 1024;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f1d3d"/><stop offset="1" stop-color="#0a1020"/></linearGradient>
    <radialGradient id="glow" cx="0.3" cy="0.18" r="0.75"><stop offset="0" stop-color="#1e4fb3" stop-opacity="0.75"/><stop offset="1" stop-color="#1e4fb3" stop-opacity="0"/></radialGradient>
    <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f90f7"/><stop offset="1" stop-color="#1b55bd"/></linearGradient>
    <radialGradient id="sheen" cx="0.25" cy="0.12" r="0.9"><stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/><stop offset="0.55" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="url(#bg)"/>
  <rect width="${S}" height="${S}" fill="url(#glow)"/>
  <!-- selo PM (centralizado, um pouco acima do meio) -->
  <g transform="translate(362 214)">
    <rect width="300" height="300" rx="68" fill="url(#mark)"/>
    <rect width="300" height="300" rx="68" fill="url(#sheen)"/>
    <text x="150" y="${Math.round(150 + 300 * 0.44 * 0.716 / 2)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${Math.round(300 * 0.44)}" letter-spacing="-6" fill="#ffffff">PM</text>
  </g>
  <!-- nome -->
  <text x="512" y="650" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="108" letter-spacing="-3"><tspan fill="#ffffff">Pub </tspan><tspan fill="#4f90f7">Mail</tspan></text>
  <!-- frase -->
  <text x="512" y="728" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="400" font-size="46" fill="#cbd5e1">Marketing, CRM, IA &amp; CIA</text>
</svg>`;
(async () => {
  await sharp(Buffer.from(svg), { density: 300 }).resize(S, S).png({ compressionLevel: 9 }).toFile(out);
  console.log('ok', out);
})();
