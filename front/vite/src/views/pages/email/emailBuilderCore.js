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
      return `<p style="${m}font-size:${b.fontSize}px;line-height:${b.lineHeight};color:${b.color};text-align:${b.align};font-weight:${b.weight};">${b.html || ''}</p>`;
    case 'image': {
      const src = String(b.src || '').trim();
      if (!src) return '';
      const img = `<img src="${escAttr(src)}" alt="${escAttr(b.alt)}" style="width:${b.widthPct}%;max-width:100%;border-radius:${b.radius}px;display:inline-block;" />`;
      const inner = b.href ? `<a href="${escAttr(resolveHref(b.href, false))}">${img}</a>` : img;
      return `<div style="${m}text-align:${b.align};">${inner}</div>`;
    }
    case 'button': {
      const disp = b.fullWidth ? 'display:block;text-align:center;' : 'display:inline-block;';
      return `<div style="${m}text-align:${b.align};"><a href="${escAttr(resolveHref(b.href, b.tracked))}" style="${disp}background-color:${b.bg};color:${b.color};font-size:${b.fontSize}px;font-weight:${b.weight};text-decoration:none;padding:${b.py}px ${b.px}px;border-radius:${b.radius}px;">${escText(b.text)}</a></div>`;
    }
    case 'divider':
      return `<hr style="border:0;border-top:${b.thickness}px solid ${b.color};${m}" />`;
    case 'spacer':
      return `<div style="height:${b.height}px;"></div>`;
    case 'card': {
      const border = b.borderWidth > 0 ? `border:${b.borderWidth}px solid ${b.borderColor};` : '';
      const icon = b.icon ? `<span style="display:inline-block;vertical-align:top;font-size:22px;line-height:1.2;margin-right:10px;">${escText(b.icon)}</span>` : '';
      const inner =
        `<div style="display:inline-block;vertical-align:top;${b.icon ? 'max-width:82%;' : 'width:100%;'}">` +
        `<div style="font-weight:700;font-size:${b.titleSize}px;color:${b.titleColor};line-height:1.35;">${b.title || ''}</div>` +
        (b.text ? `<div style="font-size:${b.textSize}px;color:${b.textColor};margin-top:5px;line-height:1.55;">${b.text}</div>` : '') +
        `</div>`;
      return `<div style="${m}${border}background-color:${b.bg};border-radius:${b.radius}px;padding:${b.padding}px;text-align:${b.align};">${icon}${inner}</div>`;
    }
    case 'columns': {
      const cell = (c) => {
        if ((c.kind || 'image') === 'text') {
          return `<div style="font-size:14px;line-height:1.55;color:#334155;">${c.text || ''}</div>`;
        }
        const src = String(c.src || '').trim();
        if (!src) return '';
        return `<img src="${escAttr(src)}" alt="${escAttr(c.alt)}" style="width:${c.widthPct || 100}%;max-width:100%;display:inline-block;" />`;
      };
      const col = (c, defAlign) => `<div style="display:inline-block;vertical-align:${b.valign};width:48%;text-align:${c.align || defAlign};">${cell(c)}</div>`;
      return `<div style="${m}font-size:0;">${col(b.left, 'left')}<div style="display:inline-block;width:4%;"></div>${col(b.right, 'right')}</div>`;
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
  const bar = b.barColor
    ? `<div style="max-width:${b.width}px;margin:0 auto;height:6px;background-color:${b.barColor};border-radius:${b.radius}px ${b.radius}px 0 0;"></div>\n`
    : '';
  const cardRadius = b.barColor ? `0 0 ${b.radius}px ${b.radius}px` : `${b.radius}px`;
  return (
    `<div style="background-color:${b.background};padding:24px 10px;">\n` +
    (pre ? `${pre}\n` : '') +
    bar +
    `<div style="max-width:${b.width}px;margin:0 auto;background-color:${b.contentBg};border-radius:${cardRadius};padding:14px ${b.paddingX}px;font-family:${b.fontFamily};color:${b.textColor};">\n` +
    `${inner}\n` +
    `</div>\n{{open_email_pixel}}\n</div>`
  );
}
