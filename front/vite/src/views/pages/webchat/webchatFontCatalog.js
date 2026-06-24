// Catálogo de fontes oferecidas no builder visual do webchat.
// As mesmas fontes são carregadas no PublicWebchat via Google Fonts.

export const WEBCHAT_FONT_OPTIONS = [
  { id: 'Inter',                 label: 'Inter',                 stack: '"Inter", system-ui, -apple-system, sans-serif' },
  { id: 'Poppins',               label: 'Poppins',               stack: '"Poppins", system-ui, -apple-system, sans-serif' },
  { id: 'Manrope',               label: 'Manrope',               stack: '"Manrope", system-ui, -apple-system, sans-serif' },
  { id: 'Plus Jakarta Sans',     label: 'Plus Jakarta Sans',     stack: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif' },
  { id: 'Roboto',                label: 'Roboto',                stack: '"Roboto", system-ui, -apple-system, sans-serif' },
  { id: 'Nunito',                label: 'Nunito',                stack: '"Nunito", system-ui, -apple-system, sans-serif' },
  { id: 'Open Sans',             label: 'Open Sans',             stack: '"Open Sans", system-ui, -apple-system, sans-serif' },
  { id: 'DM Sans',               label: 'DM Sans',               stack: '"DM Sans", system-ui, -apple-system, sans-serif' },
  { id: 'Outfit',                label: 'Outfit',                stack: '"Outfit", system-ui, -apple-system, sans-serif' },
  { id: 'Source Sans 3',         label: 'Source Sans 3',         stack: '"Source Sans 3", system-ui, -apple-system, sans-serif' },
  { id: 'system',                label: 'Padrão do sistema',     stack: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif' }
];

export const WEBCHAT_FONT_SIZE_OPTIONS = [
  { id: 13, label: 'Compacto (13px)' },
  { id: 14, label: 'Pequeno (14px)' },
  { id: 15, label: 'Normal (15px)' },
  { id: 16, label: 'Confortável (16px)' },
  { id: 17, label: 'Grande (17px)' },
  { id: 18, label: 'Maior (18px)' }
];

export const WEBCHAT_DEFAULT_FONT = 'Inter';
export const WEBCHAT_DEFAULT_FONT_SIZE = 15;

// URL única do Google Fonts incluindo todas as famílias do catálogo.
export const WEBCHAT_GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?' +
  [
    'family=Inter:wght@400;500;600;700;800',
    'family=Poppins:wght@400;500;600;700;800',
    'family=Manrope:wght@400;500;600;700;800',
    'family=Plus+Jakarta+Sans:wght@400;500;600;700;800',
    'family=Roboto:wght@400;500;700',
    'family=Nunito:wght@400;500;600;700;800',
    'family=Open+Sans:wght@400;500;600;700;800',
    'family=DM+Sans:wght@400;500;600;700',
    'family=Outfit:wght@400;500;600;700;800',
    'family=Source+Sans+3:wght@400;500;600;700;800'
  ].join('&') +
  '&display=swap';

// Resolve uma stack CSS válida a partir de um id ou string livre.
export function resolveFontStack(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) {
    return WEBCHAT_FONT_OPTIONS.find((f) => f.id === WEBCHAT_DEFAULT_FONT)?.stack || 'Inter, sans-serif';
  }
  const match = WEBCHAT_FONT_OPTIONS.find((f) => f.id.toLowerCase() === value.toLowerCase());
  if (match) return match.stack;
  // valor livre (legado): garante fallback sans-serif
  return `${value}, system-ui, sans-serif`;
}

export function isWebchatFontInCatalog(rawValue) {
  const value = String(rawValue || '').trim();
  return WEBCHAT_FONT_OPTIONS.some((f) => f.id.toLowerCase() === value.toLowerCase());
}

export function clampWebchatFontSize(rawValue) {
  const num = Number(rawValue);
  if (!Number.isFinite(num)) return WEBCHAT_DEFAULT_FONT_SIZE;
  return Math.max(11, Math.min(22, Math.round(num)));
}
