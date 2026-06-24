// Normalização de anúncios — funções PURAS espelhadas da engine do webchat
// (webchat.service: normalizeAdContract & helpers). Mantém o mesmo contrato pra
// o anúncio imprimir igual: infere gpt_slot/div/sizes do código colado, detecta
// HTML fixo (ADX) e preserva o rótulo. Qualquer divergência aqui = anúncio não
// imprime, então é cópia fiel.

const DEFAULT_GPT_SIZES: Record<string, string> = {
  topo: '[320,100]',
  rodape: '[320,100]',
  intersticial: '[300,250]',
};

export function defaultGptSizes(position: string): string {
  const normalized = String(position || '').trim().toLowerCase();
  return DEFAULT_GPT_SIZES[normalized] || DEFAULT_GPT_SIZES.topo;
}

export function looksLikeHtmlSnippet(rawValue: unknown): boolean {
  const value = String(rawValue ?? '').trim();
  if (!value) return false;
  return (
    /<\/?[a-z][\s\S]*>/i.test(value) || /&lt;\/?[a-z][\s\S]*&gt;/i.test(value)
  );
}

export function normalizeGptSizes(rawValue: unknown, position: string): string {
  if (Array.isArray(rawValue)) return JSON.stringify(rawValue);
  const value = String(rawValue ?? '').trim();
  if (!value) return defaultGptSizes(position);
  const compact = value.replace(/\s+/g, '');
  const match = compact.match(/^(\d{2,4})x(\d{2,4})$/i);
  if (match) return `[${match[1]},${match[2]}]`;
  return value;
}

export function extractGptSlotFromCode(rawCode: unknown): string {
  const source = String(rawCode ?? '');
  const fromDefineSlot = source.match(/defineSlot\(\s*['"]([^'"]+)['"]/i)?.[1];
  if (fromDefineSlot) return String(fromDefineSlot).trim();
  const compact = String(rawCode ?? '').trim();
  if (compact.startsWith('/') && !looksLikeHtmlSnippet(compact)) return compact;
  return '';
}

export function extractGptDivIdFromCode(rawCode: unknown): string {
  const source = String(rawCode ?? '');
  const fromDefineSlot = source.match(
    /defineSlot\(\s*['"][^'"]+['"]\s*,\s*\[[^\]]+\]\s*,\s*['"]([^'"]+)['"]/i,
  )?.[1];
  if (fromDefineSlot) return String(fromDefineSlot).trim();
  const fromDisplay = source.match(/display\(\s*['"]([^'"]+)['"]\s*\)/i)?.[1];
  if (fromDisplay) return String(fromDisplay).trim();
  return '';
}

function asRecord(v: unknown): Record<string, any> {
  return v && typeof v === 'object' ? (v as Record<string, any>) : {};
}

// Retorna o contrato normalizado, ou null se o anúncio não tem conteúdo válido.
export function normalizeAdContract(rawAdRaw: unknown, position: string) {
  const rawAd = asRecord(rawAdRaw);
  const code = String(rawAd.codigo_tag ?? rawAd.codigo ?? '').trim();
  const explicitSlot = String(rawAd.gpt_slot ?? '').trim();
  const explicitDivId = String(rawAd.gpt_div_id ?? '').trim();
  const explicitFixed = String(rawAd.anuncio_fixed ?? rawAd.html ?? '').trim();
  const gptSizes = normalizeGptSizes(rawAd.gpt_sizes, position);
  const rotulo = (() => {
    const raw = String(rawAd.rotulo ?? '').trim();
    return raw.slice(0, 100) || 'PUBLICIDADE';
  })();

  const inferredSlot = explicitSlot || extractGptSlotFromCode(code);
  const inferredDivId = explicitDivId || extractGptDivIdFromCode(code);
  const inferredFixed =
    explicitFixed || (!inferredSlot && looksLikeHtmlSnippet(code) ? code : '');
  const storageCode = code || inferredSlot || inferredFixed;

  const hasLegacyCode = Boolean(code);
  const hasFixed = Boolean(inferredFixed);
  const hasGptContract = Boolean(inferredSlot && gptSizes);

  if (!hasLegacyCode && !hasFixed && !hasGptContract) return null;

  const rotuloAtivo = (rawAd.rotuloAtivo ?? rawAd.rotulo_ativo) !== false;

  return {
    codigo_tag: storageCode,
    codigo: storageCode,
    gpt_slot: inferredSlot || null,
    gpt_div_id: inferredDivId || null,
    anuncio_fixed: inferredFixed || null,
    gpt_sizes: gptSizes,
    rotulo,
    rotuloAtivo,
    ativo: rawAd.ativo !== false,
  };
}
