// Logos dos clientes para a faixa "Quem já usa o Pub Mail" da landing.
// Entrada: as peças originais (clintes/images/*.png — cada uma num padrão diferente: texto branco,
// colorida, print de foto de perfil com fundo). Saída: front/vite/public/clientes/<nome>.png, todas no
// MESMO padrão dos sites de referência: silhueta cinza (#4b5563), fundo transparente, recorte justo,
// 2× de retina (altura 240 px; a altura de exibição é definida no componente, por logo).
//   node docs/tools/make_client_logos.cjs [pasta-de-origem]
// Usa o sharp do back (back/node_modules). Logo nova = acrescentar em LOGOS com a receita certa.
const path = require('node:path');
const fs = require('node:fs');
const sharp = require(path.join(__dirname, '../../back/node_modules/sharp'));

const ROOT = path.join(__dirname, '../..');
const SRC = path.resolve(process.argv[2] || path.join(ROOT, 'clintes/images'));
const OUT = path.join(ROOT, 'front/vite/public/clientes');
const GRAY = [0x4b, 0x55, 0x63]; // slate-600: lê bem sobre branco e vira branco no escuro via filter
const OUT_H = 240;

// Recorta o fundo de um print opaco por luminância: fundo/decoração escuros viram transparentes,
// texto claro vira opaco, com rampa suave (lo→hi) nas bordas serrilhadas.
function maskByLuminance(rgb, lo, hi) {
  const out = Buffer.alloc(rgb.length / 3);
  for (let i = 0, j = 0; i < rgb.length; i += 3, j++) {
    const l = 0.299 * rgb[i] + 0.587 * rgb[i + 1] + 0.114 * rgb[i + 2];
    out[j] = Math.max(0, Math.min(255, Math.round(((l - lo) / (hi - lo)) * 255)));
  }
  return out;
}

// Pinta uma máscara (alpha) com cinza chapado → silhueta única, como Honda/Nissan nos exemplos.
function flatFill(alpha, w, h, rgb = GRAY) {
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    px[i * 4] = rgb[0];
    px[i * 4 + 1] = rgb[1];
    px[i * 4 + 2] = rgb[2];
    px[i * 4 + 3] = alpha[i];
  }
  return sharp(px, { raw: { width: w, height: h, channels: 4 } });
}

// Dois tons de cinza a partir da luminância original (logo colorida com duas cores): mantém o
// contraste interno (ex.: "gerir" × "frota") dentro de uma faixa discreta de cinzas.
function twoToneGray(rgba, w, h, dark = 0x3f, light = 0x8a) {
  const px = Buffer.alloc(w * h * 4);
  let min = 255;
  let max = 0;
  const lums = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const l = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
    lums[i] = l;
    if (rgba[i * 4 + 3] > 200) {
      if (l < min) min = l;
      if (l > max) max = l;
    }
  }
  const span = Math.max(1, max - min);
  for (let i = 0; i < w * h; i++) {
    const t = Math.max(0, Math.min(1, (lums[i] - min) / span));
    const g = Math.round(dark + (light - dark) * t);
    px[i * 4] = g;
    px[i * 4 + 1] = g;
    px[i * 4 + 2] = g;
    px[i * 4 + 3] = rgba[i * 4 + 3];
  }
  return sharp(px, { raw: { width: w, height: h, channels: 4 } });
}

const LOGOS = {
  // Texto branco + anel colorido sobre transparente (arte para fundo escuro): a forma está no alpha.
  async audmetrix(file) {
    const { data, info } = await sharp(file).ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
    return flatFill(data, info.width, info.height);
  },
  // Print da foto de perfil (opaco, fundo azul-marinho com hexágonos): fica só o wordmark
  // "GCP MONITORAMENTO" (faixa vertical 115–250 do print), recortado por luminância.
  async gcp(file) {
    const meta = await sharp(file).metadata();
    const top = Math.round(meta.height * 0.36);
    const height = Math.round(meta.height * 0.43);
    const left = Math.round(meta.width * 0.06);
    const width = Math.round(meta.width * 0.86);
    // print pequeno (375 px), em duas faixas: as letras grandes "GCP" (corte duro + limpeza de pontos
    // soltos) e o "MONITORAMENTO" fino logo abaixo (corte suave, sem limpeza — a mediana comia o traço).
    const split = Math.round(height * 0.64);
    const band = async (y0, h, lo, hi, blurSigma, clean) => {
      const { data, info } = await sharp(file)
        .extract({ left, top: top + y0, width, height: h })
        .removeAlpha()
        .blur(blurSigma)
        .raw()
        .toBuffer({ resolveWithObject: true });
      const img = flatFill(maskByLuminance(data, lo, hi), info.width, info.height);
      const buf = await img.png().toBuffer();
      return clean ? sharp(buf).median(3).png().toBuffer() : buf;
    };
    const topBuf = await band(0, split, 72, 100, 0.6, true);
    const bottomBuf = await band(split, height - split, 48, 92, 0.4, false);
    return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([
      { input: topBuf, left: 0, top: 0 },
      { input: bottomBuf, left: 0, top: split }
    ]);
  },
  // Colorida (azul-marinho + azul) sobre transparente: dois tons de cinza pela luminância.
  async gerirfrota(file) {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return twoToneGray(data, info.width, info.height);
  }
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, recipe] of Object.entries(LOGOS)) {
    const file = path.join(SRC, `${name}.png`);
    if (!fs.existsSync(file)) {
      console.log(`- ${name}: origem não encontrada (${file})`);
      continue;
    }
    const img = await recipe(file);
    const trimmed = await img.png().toBuffer();
    const out = path.join(OUT, `${name}.png`);
    const info = await sharp(trimmed)
      .trim({ threshold: 8 })
      .resize({ height: OUT_H, fit: 'inside', withoutEnlargement: true }) // print pequeno (GCP) fica no tamanho nativo: ampliar só borra
      .png({ compressionLevel: 9, palette: false })
      .toFile(out);
    console.log(`✓ ${name}: ${info.width}×${info.height} → ${path.relative(ROOT, out)}`);
  }
  // prévia lado a lado em fundo claro e escuro (só para conferência; não entra no site)
  const files = Object.keys(LOGOS).map((n) => path.join(OUT, `${n}.png`)).filter((f) => fs.existsSync(f));
  const metas = await Promise.all(files.map((f) => sharp(f).metadata()));
  const H = 120;
  const gap = 90;
  const items = await Promise.all(
    files.map(async (f, i) => {
      const w = Math.round((metas[i].width * H) / metas[i].height);
      return { buf: await sharp(f).resize({ height: H }).png().toBuffer(), w };
    })
  );
  const W = items.reduce((a, it) => a + it.w, 0) + gap * (items.length + 1);
  for (const [tag, bg, filter] of [
    ['light', '#ffffff', null],
    ['dark', '#0b1120', 'invert']
  ]) {
    let x = gap;
    const comps = [];
    for (const it of items) {
      const buf = filter ? await sharp(it.buf).negate({ alpha: false }).png().toBuffer() : it.buf;
      comps.push({ input: buf, left: x, top: 60 });
      x += it.w + gap;
    }
    await sharp({ create: { width: W, height: H + 120, channels: 4, background: bg } })
      .composite(comps)
      .png()
      .toFile(path.join(process.env.PREVIEW_DIR || OUT, `_preview-${tag}.png`));
  }
  console.log('prévias geradas em', process.env.PREVIEW_DIR || OUT);
})();
