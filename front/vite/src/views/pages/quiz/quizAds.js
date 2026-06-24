// Engine de renderização de anúncios do quiz — espelha a do PublicWebchat
// (3 modos: HTML fixo / GPT slot do Google Ad Manager / código-como-HTML),
// carrega o gpt.js sob demanda e injeta os <script> recriados pra executarem.
// Sem tracking de eventos (o quiz não precisa por ora).

function safeText(v) {
  return v === null || v === undefined ? '' : String(v);
}

export function ensureGptScript() {
  if (typeof document === 'undefined') return;
  if (window.googletag) return;
  if (document.querySelector('script[data-gpt-quiz="1"]')) return;
  const script = document.createElement('script');
  script.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.setAttribute('data-gpt-quiz', '1');
  document.head.appendChild(script);
}

function parseSizes(rawSizes) {
  if (!rawSizes) return [300, 100];
  if (Array.isArray(rawSizes)) return rawSizes;
  if (typeof rawSizes === 'string') {
    const compact = rawSizes.replace(/\s+/g, '');
    const match = compact.match(/^(\d{2,4})x(\d{2,4})$/i);
    if (match) return [Number(match[1]), Number(match[2])];
    try {
      const parsed = JSON.parse(rawSizes);
      return Array.isArray(parsed) ? parsed : [300, 100];
    } catch {
      return [300, 100];
    }
  }
  return [300, 100];
}

function looksLikeHtmlSnippet(rawValue) {
  const value = safeText(rawValue).trim();
  if (!value) return false;
  return /<\/?[a-z][\s\S]*>/i.test(value) || /&lt;\/?[a-z][\s\S]*&gt;/i.test(value);
}

function resolveAdCode(anuncio) {
  return safeText(anuncio?.codigo_tag || anuncio?.codigo || '');
}
function resolveAdFixedHtml(anuncio) {
  return safeText(anuncio?.anuncio_fixed || anuncio?.html || '');
}
function resolveAdRotulo(anuncio) {
  if (anuncio?.rotuloAtivo === false) return '';
  const raw = safeText(anuncio?.rotulo).trim();
  return (raw || 'PUBLICIDADE').slice(0, 100);
}

function resolveGptSlotFromAd(anuncio, code) {
  const explicit = safeText(anuncio?.gpt_slot);
  if (explicit) return explicit;
  const source = safeText(code);
  const fromDefineSlot = source.match(/defineSlot\(\s*['"]([^'"]+)['"]/i)?.[1];
  if (fromDefineSlot) return safeText(fromDefineSlot);
  const compact = safeText(source).trim();
  if (compact.startsWith('/') && !looksLikeHtmlSnippet(compact)) return compact;
  return '';
}
function resolveGptDivIdFromAd(anuncio, code, fallbackDivId) {
  const explicit = safeText(anuncio?.gpt_div_id);
  if (explicit) return explicit;
  const source = safeText(code);
  const fromDefineSlot = source.match(/defineSlot\(\s*['"][^'"]+['"]\s*,\s*\[[^\]]+\]\s*,\s*['"]([^'"]+)['"]/i)?.[1];
  if (fromDefineSlot) return safeText(fromDefineSlot);
  const fromDisplay = source.match(/display\(\s*['"]([^'"]+)['"]\s*\)/i)?.[1];
  if (fromDisplay) return safeText(fromDisplay);
  return safeText(fallbackDivId) || 'gpt-ad-quiz-slot';
}
function resolveGptSizesFromAd(anuncio, code, fallbackSizes = '[300,100]') {
  if (anuncio?.gpt_sizes) return anuncio.gpt_sizes;
  const source = safeText(code);
  const fromDefineSlot = source.match(/defineSlot\(\s*['"][^'"]+['"]\s*,\s*(\[[\s\S]*?\])\s*,/i)?.[1];
  return fromDefineSlot || fallbackSizes;
}

function buildAdLabelElement(rotulo) {
  const text = safeText(rotulo).trim();
  if (!text) return null;
  const label = document.createElement('div');
  label.setAttribute('data-quiz-ad-label', '1');
  label.textContent = text;
  Object.assign(label.style, {
    fontSize: '10px',
    lineHeight: '1.2',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(0,0,0,0.45)',
    textAlign: 'center',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    margin: '0 auto 4px auto',
    userSelect: 'none',
    pointerEvents: 'none'
  });
  return label;
}

function buildAdContainerStyles(sizes) {
  return {
    minWidth: `${Array.isArray(sizes) ? sizes[0] : 300}px`,
    minHeight: `${Array.isArray(sizes) ? sizes[1] : 100}px`
  };
}

// Injeta HTML recriando <script> (innerHTML não executa scripts).
function mountAdMarkup(container, rawHtml) {
  if (!container) return;
  const html = safeText(rawHtml).trim();
  if (!html) return;
  const template = document.createElement('template');
  template.innerHTML = html;
  if (!template.content.firstElementChild && /&lt;\/?[a-z][\s\S]*&gt;/i.test(html)) {
    const decoder = document.createElement('textarea');
    decoder.innerHTML = html;
    template.innerHTML = decoder.value;
  }
  const scripts = Array.from(template.content.querySelectorAll('script'));
  scripts.forEach((s) => s.remove());
  container.appendChild(template.content.cloneNode(true));
  scripts.forEach((scriptNode) => {
    const script = document.createElement('script');
    Array.from(scriptNode.attributes).forEach((attr) => script.setAttribute(attr.name, attr.value));
    if (scriptNode.textContent) script.text = scriptNode.textContent;
    container.appendChild(script);
  });
}

function destroyCodeAdSlot(slotDivId) {
  if (typeof document === 'undefined') return;
  document.querySelectorAll(`[data-quiz-ad-slot="${slotDivId}"]`).forEach((n) => n.remove());
}
function destroyGptSlot(divId) {
  if (typeof window !== 'undefined' && window.googletag) {
    window.gptSlots = window.gptSlots || {};
    if (window.gptSlots[divId]) {
      try {
        window.googletag.destroySlots([window.gptSlots[divId]]);
      } catch {
        /* noop */
      }
      window.gptSlots[divId] = null;
    }
  }
  if (typeof document === 'undefined') return;
  const node = document.getElementById(divId);
  if (node && node.parentNode) node.parentNode.removeChild(node);
}

function renderGptSlot(anuncio, position, containerId, slotDivId) {
  if (typeof window === 'undefined') return;
  const container = document.getElementById(containerId);
  if (!container) return;

  const code = resolveAdCode(anuncio);
  const fixedHtml = resolveAdFixedHtml(anuncio);
  const gptSlot = resolveGptSlotFromAd(anuncio, code);
  const gptDivId = resolveGptDivIdFromAd(anuncio, code, slotDivId);
  const gptSizes = resolveGptSizesFromAd(anuncio, code, '[320,100]');
  const rotulo = resolveAdRotulo(anuncio);

  destroyCodeAdSlot(slotDivId);
  destroyGptSlot(slotDivId);
  if (gptDivId !== slotDivId) destroyGptSlot(gptDivId);

  const buildOuterWrapper = () => {
    const outer = document.createElement('div');
    outer.setAttribute('data-quiz-ad-slot', slotDivId);
    Object.assign(outer.style, {
      width: '100%',
      maxWidth: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto'
    });
    const labelEl = buildAdLabelElement(rotulo);
    if (labelEl) outer.appendChild(labelEl);
    return outer;
  };

  const attach = (outer) => {
    if (position === 'topo') container.insertBefore(outer, container.firstChild);
    else container.appendChild(outer);
  };

  // 1) HTML fixo (ADX etc.)
  if (fixedHtml) {
    const sizes = parseSizes(gptSizes);
    const { minWidth, minHeight } = buildAdContainerStyles(sizes);
    const outer = buildOuterWrapper();
    const inner = document.createElement('div');
    Object.assign(inner.style, { display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth, minHeight, maxWidth: '100%' });
    mountAdMarkup(inner, fixedHtml);
    outer.appendChild(inner);
    attach(outer);
    return;
  }

  // 2) GPT slot (Google Ad Manager)
  if (gptSlot && window.googletag) {
    const outer = buildOuterWrapper();
    const slotDiv = document.createElement('div');
    slotDiv.id = gptDivId;
    Object.assign(slotDiv.style, { display: 'flex', justifyContent: 'center', alignItems: 'center' });
    outer.appendChild(slotDiv);
    attach(outer);
    const sizes = parseSizes(gptSizes);
    window.googletag.cmd.push(() => {
      window.gptSlots = window.gptSlots || {};
      window.gptSlots[gptDivId] = window.googletag.defineSlot(gptSlot, sizes, gptDivId).addService(window.googletag.pubads());
      window.googletag.enableServices();
      window.googletag.display(gptDivId);
    });
    return;
  }

  // 3) código-como-HTML
  if (code && looksLikeHtmlSnippet(code)) {
    const sizes = parseSizes(gptSizes);
    const { minWidth, minHeight } = buildAdContainerStyles(sizes);
    const outer = buildOuterWrapper();
    const inner = document.createElement('div');
    Object.assign(inner.style, { display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth, minHeight, maxWidth: '100%' });
    mountAdMarkup(inner, code);
    outer.appendChild(inner);
    attach(outer);
  }
}

// Mapa posição -> { containerId, slotDivId }. Hoje só topo; estrutura pronta
// pra rodapé/intersticial.
const SLOT_MAP = {
  topo: { containerId: 'quiz-ad-topo', slotDivId: 'gpt-ad-quiz-topo' },
  rodape: { containerId: 'quiz-ad-rodape', slotDivId: 'gpt-ad-quiz-rodape' }
};

// Monta os anúncios do quiz. Retorna função de cleanup.
export function mountQuizAds(adsConfig) {
  const ads = adsConfig && typeof adsConfig === 'object' ? adsConfig : {};
  const positions = Object.keys(SLOT_MAP).filter((p) => ads[p]);
  if (positions.length === 0) return () => {};

  ensureGptScript();

  let cancelled = false;
  let retryTimer = null;
  let attempts = 0;
  const maxAttempts = 16;

  const requiresGoogletag = positions.some((p) => Boolean(resolveGptSlotFromAd(ads[p], resolveAdCode(ads[p]))));

  const renderAll = () => {
    if (cancelled) return;
    positions.forEach((p) => {
      const { containerId, slotDivId } = SLOT_MAP[p];
      renderGptSlot(ads[p], p, containerId, slotDivId);
    });
  };

  const run = () => {
    if (cancelled) return;
    if (!requiresGoogletag || (typeof window !== 'undefined' && window.googletag?.cmd)) {
      renderAll();
      return;
    }
    if (attempts >= maxAttempts) {
      renderAll(); // tenta de qualquer forma (HTML fixo/código ainda renderiza)
      return;
    }
    attempts += 1;
    retryTimer = window.setTimeout(run, 250);
  };

  run();

  return () => {
    cancelled = true;
    if (retryTimer) window.clearTimeout(retryTimer);
    Object.values(SLOT_MAP).forEach(({ slotDivId }) => {
      destroyCodeAdSlot(slotDivId);
      destroyGptSlot(slotDivId);
    });
  };
}
