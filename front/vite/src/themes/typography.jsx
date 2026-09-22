// Escala tipográfica (Ubuntu: pesos 300/400/500/700). Hierarquia de ênfase:
// 700 = títulos/negrito · 500 = médio (ênfase suave) · 400 = corpo.
export default function Typography(fontFamily) {
  return {
    fontFamily,
    h6: { fontWeight: 500, fontSize: '0.75rem', lineHeight: 1.4 },
    h5: { fontWeight: 700, fontSize: '0.875rem', lineHeight: 1.4 },
    h4: { fontWeight: 700, fontSize: '1.0625rem', lineHeight: 1.35, letterSpacing: '-0.01em' },
    h3: { fontWeight: 700, fontSize: '1.25rem', lineHeight: 1.3, letterSpacing: '-0.015em' },
    h2: { fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.25, letterSpacing: '-0.02em' },
    h1: { fontWeight: 700, fontSize: '2rem', lineHeight: 1.2, letterSpacing: '-0.02em' },
    subtitle1: { fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.45 },
    subtitle2: { fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.45 },
    caption: { fontSize: '0.75rem', fontWeight: 400, lineHeight: 1.5 },
    body1: { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.55 },
    body2: { fontSize: '0.8125rem', fontWeight: 400, lineHeight: 1.55, letterSpacing: '0em' },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0em' },
    commonAvatar: { cursor: 'pointer', borderRadius: '8px' },
    smallAvatar: { width: '22px', height: '22px', fontSize: '1rem' },
    mediumAvatar: { width: '34px', height: '34px', fontSize: '1.2rem' },
    largeAvatar: { width: '44px', height: '44px', fontSize: '1.5rem' }
  };
}
