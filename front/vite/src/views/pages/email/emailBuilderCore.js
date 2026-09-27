// ============================================================================
// Core do builder visual de e-mail.
// Modelo por blocos (JSON) -> HTML SIMPLES (o mais "humano"/arcaico possível:
// só <div>/<p>/<a>/<img>/<hr>, estilos inline, SEM tabelas e SEM comentários).
// O modelo é guardado no BANCO (coluna builder_model), não no HTML -> por isso
// o HTML sai limpo. Puro (sem React) => testável isolado.
// ============================================================================

let _seq = 0;
export function uid(p = 'b') {
  _seq += 1;
  return `${p}_${Date.now().toString(36)}_${_seq.toString(36)}`;
}

export const EMAIL_VARIABLES = [
  { key: '{{name}}', desc: 'Nome do lead' },
  { key: '{{email}}', desc: 'E-mail do lead' },
  { key: '{{phone}}', desc: 'Telefone do lead' },
  { key: '{{unsubscribe_link}}', desc: 'Link de descadastro (gerado pela Pub Mail)' },
  { key: '{{base_webhook_cta_click}}', desc: 'Rastreia clique — use no link: href="{{base_webhook_cta_click}}?redirectUrl=SUA_URL"' }
];

export const FONT_OPTIONS = [
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica' },
  { value: "'Trebuchet MS', Helvetica, sans-serif", label: 'Trebuchet' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: "'Times New Roman', Times, serif", label: 'Times' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
  { value: 'Tahoma, Geneva, sans-serif', label: 'Tahoma' }
];

function escAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escText(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---- validação de valores interpolados em style="" (A-76) ----
// Cores: só hex (#rgb/#rgba/#rrggbb/#rrggbbaa) ou rgb()/rgba() com números.
// Qualquer outra coisa (ex.: `accent_color` do CSV com `"` ou `;`) cai no
// fallback — nunca chega ao HTML.
const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_RE = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/i;
export function isValidColor(value) {
  const v = String(value ?? '').trim();
  return HEX_RE.test(v) || RGB_RE.test(v);
}
export function safeColor(value, fallback = '') {
  const v = String(value ?? '').trim();
  return isValidColor(v) ? v : fallback;
}
// Fonte: só letras/números/espaço/vírgula/aspas/hífen (ex.: 'Segoe UI', Arial, sans-serif).
const FONT_RE = /^[A-Za-z0-9 ,'"\-]{1,120}$/;
function safeFont(value, fallback = 'Arial, Helvetica, sans-serif') {
  const v = String(value ?? '').trim();
  return FONT_RE.test(v) ? v : fallback;
}
const ALIGN = new Set(['left', 'center', 'right', 'justify']);
function safeAlign(value, fallback = 'left') {
  return ALIGN.has(value) ? value : fallback;
}
function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
// style="" sempre passa por escAttr (aspas viram &quot;) — belt + suspenders.
function styleAttr(css) {
  return `style="${escAttr(css)}"`;
}

export function createDefaultBody() {
  return {
    background: '#f3f4f6',
    contentBg: '#ffffff',
    width: 600,
    radius: 8,
    paddingX: 28,
    fontFamily: 'Arial, Helvetica, sans-serif',
    textColor: '#1f2937',
    barColor: '' // barra colorida no topo do card (vazio = sem barra)
  };
}

export function createBlock(type) {
  const base = { id: uid(), type, space: 10 };
  switch (type) {
    case 'text':
      return { ...base, html: 'Escreva seu texto aqui. Use <b>negrito</b>, links e variáveis como {{name}}.', fontSize: 15, color: '#334155', align: 'left', lineHeight: 1.6, weight: 400 };
    case 'heading':
      return { ...base, type: 'text', html: 'Título do e-mail', fontSize: 24, color: '#111827', align: 'left', lineHeight: 1.3, weight: 700 };
    case 'image':
      return { ...base, src: '', alt: '', widthPct: 100, align: 'center', href: '', radius: 6 };
    case 'button':
      return { ...base, text: 'Clique aqui', href: 'https://', tracked: true, bg: '#4f46e5', color: '#ffffff', radius: 6, fontSize: 15, weight: 700, align: 'center', px: 26, py: 12, fullWidth: false };
    case 'divider':
      return { ...base, color: '#e5e7eb', thickness: 1 };
    case 'spacer':
      return { ...base, height: 24 };
    case 'card':
      return { ...base, bg: '#fff7ed', borderColor: '#fdba74', borderWidth: 1, radius: 12, padding: 16, icon: '', title: 'Título do bloco', titleColor: '#111827', titleSize: 16, text: 'Descrição de apoio do bloco.', textColor: '#6b7280', textSize: 14, align: 'left' };
    case 'columns':
      return {
        ...base,
        valign: 'top',
        left: { kind: 'image', src: '', alt: '', text: 'Coluna esquerda', align: 'left', widthPct: 100 },
        right: { kind: 'text', src: '', alt: '', text: 'Coluna direita', align: 'right', widthPct: 100 }
      };
    default:
      return base;
  }
}

export function createDefaultModel() {
  return {
    version: 1,
    body: createDefaultBody(),
    blocks: [
      { ...createBlock('heading'), align: 'center', html: 'Olá {{name}}! 👋' },
      createBlock('text'),
      { ...createBlock('button'), href: 'https://seusite.com' },
      createBlock('divider'),
      { ...createBlock('text'), fontSize: 12, color: '#9ca3af', align: 'center', html: 'Se não quiser mais receber, <a href="{{unsubscribe_link}}">descadastre-se aqui</a>.' }
    ]
  };
}

export function normalizeModel(raw) {
  const def = createDefaultModel();
  if (!raw || typeof raw !== 'object') return def;
  const body = { ...createDefaultBody(), ...(raw.body || {}) };
  const blocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  const norm = blocks
    .filter((b) => b && typeof b === 'object')
    .map((b) => {
      const t = ['image', 'button', 'divider', 'spacer', 'card', 'columns'].includes(b.type) ? b.type : 'text';
      const fresh = createBlock(t);
      const merged = { ...fresh, ...b, id: b.id || uid(), type: t };
      // colunas têm sub-objetos (left/right) — mescla campo a campo p/ não perder defaults
      if (t === 'columns') {
        merged.left = { ...fresh.left, ...(b.left || {}) };
        merged.right = { ...fresh.right, ...(b.right || {}) };
      }
      return merged;
    });
  const preheader = typeof raw.preheader === 'string' ? raw.preheader.slice(0, 200) : '';
  const fromName = typeof raw.from_name === 'string' ? raw.from_name.slice(0, 120) : '';
  return { version: 1, body, blocks: norm.length ? norm : def.blocks, preheader, from_name: fromName };
}

// Bloco oculto de pré-visualização (o texto que aparece ao lado do assunto na
// caixa de entrada). O "filler" empurra o conteúdo real pra fora da prévia.
function preheaderHtml(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  const filler = '&#847;&zwnj;&nbsp;'.repeat(40);
  return (
    `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#ffffff;opacity:0;">` +
    `${escText(t)}${filler}` +
    `</div>`
  );
}

// href com tracking de CTA / variáveis
function resolveHref(href, tracked) {
  const raw = String(href ?? '').trim();
  if (!raw) return '#';
  if (raw.startsWith('{{')) return raw; // variável (ex.: {{unsubscribe_link}})
  if (tracked) return `{{base_webhook_cta_click}}?redirectUrl=${encodeURIComponent(raw)}`;
  return raw;
}

// bloco -> HTML simples (exportado p/ o canvas do builder renderizar = real)
export function renderBlockHtml(b) {
  return renderBlock(b);
}
function renderBlock(b) {
  const m = `margin:${b.space}px 0;`;
  switch (b.type) {
    case 'text':
      return `<p ${styleAttr(`${m}font-size:${num(b.fontSize, 15)}px;line-height:${num(b.lineHeight, 1.6)};color:${safeColor(b.color, '#334155')};text-align:${safeAlign(b.align)};font-weight:${num(b.weight, 400)};`)}>${b.html || ''}</p>`;
    case 'image': {
      const src = String(b.src || '').trim();
      if (!src) return '';
      const img = `<img src="${escAttr(src)}" alt="${escAttr(b.alt)}" ${styleAttr(`width:${num(b.widthPct, 100)}%;max-width:100%;border-radius:${num(b.radius, 0)}px;display:inline-block;`)} />`;
      const inner = b.href ? `<a href="${escAttr(resolveHref(b.href, false))}">${img}</a>` : img;
      return `<div ${styleAttr(`${m}text-align:${safeAlign(b.align, 'center')};`)}>${inner}</div>`;
    }
    case 'button': {
      const disp = b.fullWidth ? 'display:block;text-align:center;' : 'display:inline-block;';
      return `<div ${styleAttr(`${m}text-align:${safeAlign(b.align, 'center')};`)}><a href="${escAttr(resolveHref(b.href, b.tracked))}" ${styleAttr(`${disp}background-color:${safeColor(b.bg, '#4f46e5')};color:${safeColor(b.color, '#ffffff')};font-size:${num(b.fontSize, 15)}px;font-weight:${num(b.weight, 700)};text-decoration:none;padding:${num(b.py, 12)}px ${num(b.px, 26)}px;border-radius:${num(b.radius, 6)}px;`)}>${escText(b.text)}</a></div>`;
    }
    case 'divider':
      return `<hr ${styleAttr(`border:0;border-top:${num(b.thickness, 1)}px solid ${safeColor(b.color, '#e5e7eb')};${m}`)} />`;
    case 'spacer':
      return `<div ${styleAttr(`height:${num(b.height, 16)}px;`)}></div>`;
    case 'card': {
      const border = num(b.borderWidth, 0) > 0 ? `border:${num(b.borderWidth, 1)}px solid ${safeColor(b.borderColor, '#fdba74')};` : '';
      const icon = b.icon ? `<span style="display:inline-block;vertical-align:top;font-size:22px;line-height:1.2;margin-right:10px;">${escText(b.icon)}</span>` : '';
      // título/descrição são campos de texto puro no builder (não HTML) → escapados
      const inner =
        `<div style="display:inline-block;vertical-align:top;${b.icon ? 'max-width:82%;' : 'width:100%;'}">` +
        `<div ${styleAttr(`font-weight:700;font-size:${num(b.titleSize, 16)}px;color:${safeColor(b.titleColor, '#111827')};line-height:1.35;`)}>${escText(b.title || '')}</div>` +
        (b.text ? `<div ${styleAttr(`font-size:${num(b.textSize, 14)}px;color:${safeColor(b.textColor, '#6b7280')};margin-top:5px;line-height:1.55;`)}>${escText(b.text).replace(/\r?\n/g, '<br />')}</div>` : '') +
        `</div>`;
      return `<div ${styleAttr(`${m}${border}background-color:${safeColor(b.bg, '#fff7ed')};border-radius:${num(b.radius, 12)}px;padding:${num(b.padding, 16)}px;text-align:${safeAlign(b.align)};`)}>${icon}${inner}</div>`;
    }
    case 'columns': {
      const cell = (c) => {
        if ((c.kind || 'image') === 'text') {
          // célula de texto = TextField simples (texto puro) → escapado
          return `<div style="font-size:14px;line-height:1.55;color:#334155;">${escText(c.text || '').replace(/\r?\n/g, '<br />')}</div>`;
        }
        const src = String(c.src || '').trim();
        if (!src) return '';
        return `<img src="${escAttr(src)}" alt="${escAttr(c.alt)}" ${styleAttr(`width:${num(c.widthPct, 100)}%;max-width:100%;display:inline-block;`)} />`;
      };
      const valign = ['top', 'middle', 'bottom'].includes(b.valign) ? b.valign : 'middle';
      const col = (c, defAlign) => `<div ${styleAttr(`display:inline-block;vertical-align:${valign};width:48%;text-align:${safeAlign(c.align, defAlign)};`)}>${cell(c)}</div>`;
      return `<div ${styleAttr(`${m}font-size:0;`)}>${col(b.left, 'left')}<div style="display:inline-block;width:4%;"></div>${col(b.right, 'right')}</div>`;
    }
    default:
      return '';
  }
}

// modelo -> HTML final (simples, sem comentário)
export function modelToHtml(model) {
  const m = normalizeModel(model);
  const b = m.body;
  const inner = m.blocks.map((bl) => renderBlock(bl)).filter(Boolean).join('\n');
  const pre = preheaderHtml(m.preheader);
  // barra colorida no topo do card (opcional) — cantos superiores arredondados;
  // o card abaixo fica com o topo reto pra emendar sem costura.
  const width = num(b.width, 600);
  const radius = num(b.radius, 8);
  const barColor = safeColor(b.barColor, '');
  const bar = barColor
    ? `<div ${styleAttr(`max-width:${width}px;margin:0 auto;height:6px;background-color:${barColor};border-radius:${radius}px ${radius}px 0 0;`)}></div>\n`
    : '';
  const cardRadius = barColor ? `0 0 ${radius}px ${radius}px` : `${radius}px`;
  return (
    `<div ${styleAttr(`background-color:${safeColor(b.background, '#f3f4f6')};padding:24px 10px;`)}>\n` +
    (pre ? `${pre}\n` : '') +
    bar +
    `<div ${styleAttr(`max-width:${width}px;margin:0 auto;background-color:${safeColor(b.contentBg, '#ffffff')};border-radius:${cardRadius};padding:14px ${num(b.paddingX, 28)}px;font-family:${safeFont(b.fontFamily)};color:${safeColor(b.textColor, '#1f2937')};`)}>\n` +
    `${inner}\n` +
    `</div>\n{{open_email_pixel}}\n</div>`
  );
}
