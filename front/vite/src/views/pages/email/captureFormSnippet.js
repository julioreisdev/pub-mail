// captureFormSnippet.js — gerador PURO (sem React/MUI) do formulário de captação de leads.
// Gera UM único bloco copiável (estilo WordPress: <!-- wp:html --> + <!-- wp:group -->) que
// funciona colado no editor de código do WP (e depois é editável no editor visual, porque o texto
// de destaque, o botão e a nota são blocos core reais) — e também em qualquer HTML comum
// (os comentários wp:* são ignorados e o CSS aqui estiliza as classes wp-block-*).
//
// REGRA DE OURO (validação de bloco do WP): nos blocos core (paragraph/button/group) o JSON do
// comentário e o HTML gerado PRECISAM bater 1:1 (cores, tamanhos, classes). Nunca coloque
// atributos custom (data-*) no wrapper de bloco core — só dentro dos blocos wp:html (raw).

export const CAPTURE_FORM_VERSION = 2;

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normalizeHex(value, fallback) {
    const v = String(value || '').trim().toLowerCase();
    if (!HEX_RE.test(v)) return fallback;
    if (v.length === 4) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
    return v;
}

export function hexToRgb(hex) {
    const h = normalizeHex(hex, '#000000').slice(1);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// escurece uma cor hex (0..1) — usado no hover do botão
export function darkenHex(hex, amount = 0.15) {
    const [r, g, b] = hexToRgb(hex);
    const f = (c) => Math.max(0, Math.min(255, Math.round(c * (1 - amount))));
    const to2 = (c) => f(c).toString(16).padStart(2, '0');
    return `#${to2(r)}${to2(g)}${to2(b)}`;
}

export function normalizeUrl(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    if (/^(https?:)?\/\//i.test(s) || s.startsWith('/') || s.startsWith('#') || /^mailto:|^tel:/i.test(s)) return s;
    return `https://${s}`;
}

export function isValidUrl(raw) {
    const s = normalizeUrl(raw);
    if (!s) return true; // vazio é permitido (botão só cadastra)
    if (s.startsWith('/') || s.startsWith('#')) return true;
    try {
        const u = new URL(s);
        return Boolean(u.protocol && u.host) || /^mailto:|^tel:/i.test(s);
    } catch {
        return false;
    }
}

export function defaultCaptureConfig() {
    return {
        version: CAPTURE_FORM_VERSION,
        maxWidth: 412,
        colors: {
            accent: '#ff7800', // texto de destaque + foco dos campos
            glow: '#ff7800', // brilho pulsante do botão
            buttonBg: '#1a4de8',
            buttonText: '#ffffff',
            note: '#047857'
        },
        fields: {
            name: { enabled: true, label: 'Seu nome', placeholder: 'Ex: Maria Silva' },
            email: { label: 'Seu e-mail', placeholder: 'Ex: maria@email.com' },
            phone: { enabled: false, label: 'Seu telefone', placeholder: 'Ex: (11) 99999-9999' }
        },
        prompt: { text: '' }, // texto de destaque acima do botão (vazio = não aparece)
        button: { text: 'CONTINUAR', url: '' },
        note: { text: 'Você permanecerá no mesmo site' }, // texto abaixo do botão (vazio = não aparece)
        feedback: { enabled: false, successText: '', errorText: 'Não foi possível enviar. Tente novamente.' },
        pixelEvent: 'CliqueBotao', // fbq('trackCustom', ...) no clique (vazio = não dispara)
        extraAttributes: { origin: 'website', country: 'BR' }
    };
}

const str = (v, def, max = 500) => (typeof v === 'string' ? v.slice(0, max) : def);
const bool = (v, def) => (typeof v === 'boolean' ? v : def);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);

// Mescla um JSON salvo (pode ser antigo/parcial/inválido) com os defaults. NUNCA lança.
export function normalizeCaptureConfig(raw) {
    const d = defaultCaptureConfig();
    const r = obj(raw) || {};
    const c = obj(r.colors) || {};
    const f = obj(r.fields) || {};
    const fn = obj(f.name) || {};
    const fe = obj(f.email) || {};
    const fp = obj(f.phone) || {};
    const mw = Number(r.maxWidth);
    return {
        version: CAPTURE_FORM_VERSION,
        maxWidth: Number.isFinite(mw) ? Math.min(1200, Math.max(240, Math.round(mw))) : d.maxWidth,
        colors: {
            accent: normalizeHex(c.accent, d.colors.accent),
            glow: normalizeHex(c.glow, d.colors.glow),
            buttonBg: normalizeHex(c.buttonBg, d.colors.buttonBg),
            buttonText: normalizeHex(c.buttonText, d.colors.buttonText),
            note: normalizeHex(c.note, d.colors.note)
        },
        fields: {
            name: {
                enabled: bool(fn.enabled, d.fields.name.enabled),
                label: str(fn.label, d.fields.name.label, 120),
                placeholder: str(fn.placeholder, d.fields.name.placeholder, 120)
            },
            email: {
                label: str(fe.label, d.fields.email.label, 120),
                placeholder: str(fe.placeholder, d.fields.email.placeholder, 120)
            },
            phone: {
                enabled: bool(fp.enabled, d.fields.phone.enabled),
                label: str(fp.label, d.fields.phone.label, 120),
                placeholder: str(fp.placeholder, d.fields.phone.placeholder, 120)
            }
        },
        prompt: { text: str(obj(r.prompt)?.text, d.prompt.text, 300) },
        button: {
            text: str(obj(r.button)?.text, d.button.text, 120),
            url: str(obj(r.button)?.url, d.button.url, 2000)
        },
        note: { text: str(obj(r.note)?.text, d.note.text, 300) },
        feedback: {
            enabled: bool(obj(r.feedback)?.enabled, d.feedback.enabled),
            successText: str(obj(r.feedback)?.successText, d.feedback.successText, 300),
            errorText: str(obj(r.feedback)?.errorText, d.feedback.errorText, 300)
        },
        pixelEvent: str(r.pixelEvent, d.pixelEvent, 80).trim(),
        extraAttributes: obj(r.extraAttributes) || d.extraAttributes
    };
}

// ---------- escapes ----------
export const escText = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const escAttr = (s) => escText(s).replace(/"/g, '&quot;');
// JSON dentro de <script>: impede fechar a tag / abrir comentário HTML
export const safeJson = (o) =>
    JSON.stringify(o)
        .replace(/<\/(script)/gi, '<\\/$1')
        .replace(/<!--/g, '<\\!--')
        .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
        .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029');

export function buildEndpoint(apiBase, organizationId, projectId) {
    const base = String(apiBase || '').replace(/\/+$/, '');
    return `${base}/email/leads/subscribe/${organizationId}/${projectId}`;
}

export function formIdFor(projectId) {
    const short = String(projectId || '')
        .replace(/[^a-z0-9]/gi, '')
        .slice(0, 8)
        .toLowerCase();
    return `pmf-${short || 'form'}`;
}

// ---------- CSS (porte fiel da base, prefixo pmf-) ----------
function buildCss(cfg) {
    const glow = hexToRgb(cfg.colors.glow).join(', ');
    const hover = darkenHex(cfg.colors.buttonBg, 0.17);
    const noteStroke = cfg.colors.note.replace('#', '%23');
    return `    /* ===== TAMANHO / CORES: altere só estas linhas ===== */
    .wp-block-group.pmf-form-wrap {
        --cta-width: 100%;               /* largura em % do espaço disponível */
        --cta-max-width: ${cfg.maxWidth}px;       /* largura máxima em px */
        --cta-glow: ${glow};      /* cor RGB do brilho pulsante do botão */
        --form-accent: ${cfg.colors.accent};       /* cor do texto de destaque e do foco dos campos */
        --btn-bg: ${cfg.colors.buttonBg};
        --btn-bg-hover: ${hover};
        --btn-text: ${cfg.colors.buttonText};
        --note-color: ${cfg.colors.note};
    }
    /* ==================================================== */

    .wp-block-group.pmf-form-wrap {
        margin: 12px auto;
        margin-top: 12px !important;
        margin-bottom: 12px !important;
        padding: 0;
        font-family: Inter, -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
        line-height: 1.6;
        text-align: center
    }

    .pmf-form-wrap>* {
        margin-top: 0;
        margin-bottom: 0;
        margin-block-start: 0;
        margin-block-end: 0
    }

    /* ---------- CAMPOS ---------- */
    .pmf-form-wrap .pmf-form {
        width: var(--cta-width);
        max-width: var(--cta-max-width);
        box-sizing: border-box;
        margin: 0 auto 4px !important;
        padding: 0;
        position: relative;
        z-index: 1;
        text-align: left
    }

    .pmf-form-wrap .pmf-field {
        margin: 0 0 12px !important;
        padding: 0;
        text-align: left
    }

    .pmf-form-wrap .pmf-field label {
        display: block;
        font-family: Inter, -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        font-weight: 700;
        line-height: 1.6;
        color: #374151;
        margin: 0 0 5px !important;
        padding: 0;
        text-transform: none;
        letter-spacing: normal
    }

    .pmf-form-wrap .pmf-field input {
        display: block;
        width: 100%;
        box-sizing: border-box;
        margin: 0 !important;
        padding: 14px 15px;
        border: 1.5px solid #e5e7eb;
        border-radius: 12px;
        background: #f9fafb;
        font-family: Inter, -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
        font-size: 16px;
        line-height: 1.5;
        color: #111827;
        box-shadow: none;
        appearance: none;
        -webkit-appearance: none;
        outline: none;
        transition: border-color .2s, box-shadow .2s, background .2s
    }

    .pmf-form-wrap .pmf-field input::placeholder {
        color: #6b7280;
        opacity: 1
    }

    .pmf-form-wrap .pmf-field input:focus {
        border-color: var(--form-accent);
        background: #ffffff;
        outline: none;
        box-shadow: 0 0 0 4px rgba(var(--cta-glow), .14)
    }

    /* ---------- FEEDBACK (só aparece se ativado na configuração) ---------- */
    .pmf-form-wrap .pmf-msg {
        width: var(--cta-width);
        max-width: var(--cta-max-width);
        box-sizing: border-box;
        margin: 0 auto 10px !important;
        padding: 10px 12px;
        border-radius: 10px;
        font-family: Inter, -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
        font-weight: 600;
        line-height: 1.5;
        text-align: center
    }

    .pmf-form-wrap .pmf-msg[hidden] { display: none !important }
    .pmf-form-wrap .pmf-msg.pmf-ok { color: #047857; background: rgba(5, 150, 105, .08) }
    .pmf-form-wrap .pmf-msg.pmf-err { color: #b91c1c; background: rgba(185, 28, 28, .08) }

    /* ---------- TEXTO DE DESTAQUE ---------- */
    .pmf-form-wrap .pmf-prompt {
        width: var(--cta-width);
        max-width: var(--cta-max-width);
        box-sizing: border-box;
        margin: 18px auto 14px !important;
        padding: 0;
        font-family: Inter, -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
        font-size: 16px;
        font-weight: 800;
        line-height: 1.3;
        color: var(--form-accent);
        text-transform: uppercase;
        letter-spacing: .4px;
        text-align: center
    }

    /* ---------- BOTÃO ---------- */
    .pmf-form-wrap .wp-block-buttons {
        display: block;
        width: var(--cta-width);
        max-width: var(--cta-max-width);
        margin: 0 auto 18px !important;
        padding: 0
    }

    .pmf-form-wrap .wp-block-button.pmf-btn {
        display: block;
        width: 100%;
        max-width: none;
        margin: 0 !important;
        padding: 0;
        background: transparent !important;
        box-shadow: none;
        border: 0;
        border-radius: 0
    }

    .pmf-form-wrap .wp-block-button.pmf-btn .wp-block-button__link {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        min-height: 122px;
        box-sizing: border-box;
        padding: 24px !important;
        background: var(--btn-bg) !important;
        color: var(--btn-text) !important;
        border: 0 !important;
        border-radius: 18px !important;
        font-family: Inter, -apple-system, system-ui, "Segoe UI", Roboto, sans-serif !important;
        font-size: 26px !important;
        font-weight: 800 !important;
        line-height: 1 !important;
        text-transform: uppercase !important;
        letter-spacing: .04em !important;
        text-decoration: none !important;
        text-align: center;
        cursor: pointer;
        position: relative;
        overflow: hidden;
        z-index: 1;
        box-shadow: 0 10px 24px -6px rgba(var(--cta-glow), .55);
        animation: pmf-btn-glow 2s ease-in-out infinite;
        transition: transform .2s, background .3s
    }

    @keyframes pmf-btn-glow {
        0%, 100% { box-shadow: 0 10px 24px -6px rgba(var(--cta-glow), .55) }
        50% { box-shadow: 0 10px 34px -2px rgba(var(--cta-glow), .85), 0 0 0 6px rgba(var(--cta-glow), .1) }
    }

    .pmf-form-wrap .wp-block-button.pmf-btn .wp-block-button__link::before {
        content: "";
        position: absolute;
        top: 0;
        left: -80%;
        width: 55%;
        height: 100%;
        background: linear-gradient(105deg, transparent 0%, rgba(255, 255, 255, .05) 30%, rgba(255, 255, 255, .45) 50%, rgba(255, 255, 255, .05) 70%, transparent 100%);
        transform: skewX(-20deg);
        animation: pmf-shine 2.6s ease-in-out infinite;
        pointer-events: none
    }

    @keyframes pmf-shine {
        0% { left: -80% }
        55%, 100% { left: 130% }
    }

    .pmf-form-wrap .wp-block-button.pmf-btn .wp-block-button__link::after {
        content: "→";
        display: inline-block;
        animation: pmf-arrow 1.2s ease-in-out infinite
    }

    @keyframes pmf-arrow {
        0%, 100% { transform: translateX(0) }
        50% { transform: translateX(5px) }
    }

    .pmf-form-wrap .wp-block-button.pmf-btn .wp-block-button__link:hover,
    .pmf-form-wrap .wp-block-button.pmf-btn .wp-block-button__link:focus {
        transform: scale(1.03);
        background: var(--btn-bg-hover) !important;
        color: var(--btn-text) !important;
        text-decoration: none !important
    }

    .pmf-form-wrap .wp-block-button.pmf-btn .wp-block-button__link:active {
        transform: scale(.97)
    }

    .pmf-form-wrap .wp-block-button.pmf-btn .wp-block-button__link[data-pmf-busy] {
        opacity: .75;
        cursor: progress
    }

    /* ---------- NOTA ABAIXO DO BOTÃO ---------- */
    .pmf-form-wrap .pmf-security {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        width: var(--cta-width);
        max-width: var(--cta-max-width);
        box-sizing: border-box;
        margin: 0 auto !important;
        padding: 11px 14px;
        font-family: Inter, -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.6;
        color: var(--note-color);
        background: linear-gradient(135deg, rgba(5, 150, 105, .07) 0%, rgba(16, 185, 129, .05) 100%);
        border: 1px solid rgba(5, 150, 105, .15);
        border-radius: 10px;
        text-align: center;
        text-transform: none;
        letter-spacing: normal
    }

    .pmf-form-wrap .pmf-security::before {
        content: "";
        display: inline-block;
        width: 15px;
        height: 15px;
        flex-shrink: 0;
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='${noteStroke}' viewBox='0 0 24 24'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'/%3E%3C/svg%3E") center / contain no-repeat
    }

    /* ---------- MOBILE ---------- */
    @media (max-width: 480px) {
        .pmf-form-wrap .pmf-field input {
            padding: 13px 14px;
            font-size: 16px
        }

        .pmf-form-wrap .pmf-prompt {
            font-size: 14px;
            margin: 14px auto 12px !important
        }

        .pmf-form-wrap .wp-block-buttons {
            margin-bottom: 15px !important
        }

        .pmf-form-wrap .wp-block-button.pmf-btn .wp-block-button__link {
            min-height: 112px;
            padding: 22px 20px !important;
            font-size: 23px !important
        }

        .pmf-form-wrap .pmf-security {
            font-size: 12px;
            padding: 9px 12px
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .pmf-form-wrap .wp-block-button.pmf-btn .wp-block-button__link,
        .pmf-form-wrap .wp-block-button.pmf-btn .wp-block-button__link::before,
        .pmf-form-wrap .wp-block-button.pmf-btn .wp-block-button__link::after {
            animation: none
        }
    }`;
}

// ---------- SCRIPT do site (ES5, sem dependências, delegado no document) ----------
// Comportamento:
//  - clique no botão SEM e-mail preenchido → segue o link normalmente (não chama API);
//  - COM e-mail → preventDefault, POST no endpoint (name só se preenchido; phone em attributes),
//    espera no máx 4s (fetch keepalive termina mesmo se a página navegar) e redireciona pra URL do botão;
//  - feedback visual só se cfg.feedback=true (mostra texto e aguarda 1.2s antes de redirecionar);
//  - sem config (bloco do script removido) → link normal. Nunca prende o lead na página.
function buildScript(formId, runtimeCfg) {
    return `    (function () {
        var W = window, D = document;
        W.__PMF__ = W.__PMF__ || {};
        W.__PMF__[${safeJson(formId)}] = ${safeJson(runtimeCfg)};
        if (W.__PMF_BOUND__) return; /* listeners globais só uma vez (vários formulários na página ok) */
        W.__PMF_BOUND__ = true;

        function closest(el, sel) {
            if (!el) return null;
            if (el.closest) return el.closest(sel);
            while (el && el.nodeType === 1) { if (el.matches && el.matches(sel)) return el; el = el.parentNode; }
            return null;
        }
        function cfgOf(wrap) {
            var f = wrap && wrap.querySelector('.pmf-form');
            var id = f && f.getAttribute('data-pmf');
            return (id && W.__PMF__[id]) || null;
        }
        function val(wrap, name) {
            var i = wrap.querySelector('.pmf-form input[name="' + name + '"]');
            return i ? String(i.value || '').replace(/^\\s+|\\s+$/g, '') : '';
        }
        function dest(a) {
            var h = a.getAttribute('href');
            return (h && h !== '#') ? a.href : '';
        }
        function go(a) { var d = dest(a); if (d) W.location.href = d; }
        function showMsg(wrap, text, ok) {
            var m = wrap.querySelector('.pmf-msg');
            if (!m) return;
            if (!text) { m.hidden = true; return; }
            m.textContent = text;
            m.className = 'pmf-msg ' + (ok ? 'pmf-ok' : 'pmf-err');
            m.hidden = false;
        }

        D.addEventListener('click', function (e) {
            var a = closest(e.target, '.pmf-form-wrap .pmf-btn a');
            if (!a) return;
            var wrap = closest(a, '.pmf-form-wrap');
            var cfg = cfgOf(wrap);

            if (cfg && cfg.pixel && typeof W.fbq === 'function') { try { W.fbq('trackCustom', cfg.pixel); } catch (_) {} }
            if (!cfg) return; /* sem config → link normal */

            var email = val(wrap, 'email');
            var d = dest(a);

            if (W.__PMF_PREVIEW__) {
                e.preventDefault();
                showMsg(wrap, email
                    ? ('✅ Preview: o lead "' + email + '" seria salvo no projeto' + (d ? ' e depois redirecionado para ' + d : ' (sem redirecionamento: URL do botão vazia)'))
                    : ('↪ Preview: sem e-mail, o clique iria direto para ' + (d || '(URL do botão vazia — nada acontece)')), !!email);
                return;
            }

            if (!email) return; /* sem e-mail → segue o link normalmente */

            e.preventDefault();
            if (a.getAttribute('data-pmf-busy')) return;
            a.setAttribute('data-pmf-busy', '1');

            var name = val(wrap, 'name');
            var phone = val(wrap, 'phone');
            var attrs = {};
            var base = cfg.attrs || {};
            for (var k in base) { if (Object.prototype.hasOwnProperty.call(base, k)) attrs[k] = base[k]; }
            if (phone) attrs.phone = phone;
            var body = { email: email, attributes: attrs };
            if (name) body.name = name;

            var done = false, timer = null;
            function finish(ok) {
                if (done) return;
                done = true;
                if (timer) clearTimeout(timer);
                a.removeAttribute('data-pmf-busy');
                var text = '';
                if (cfg.feedback && ok !== null) text = ok ? cfg.successText : cfg.errorText;
                if (cfg.feedback) showMsg(wrap, text, !!ok);
                var wait = text ? 1200 : 0;
                if (d) setTimeout(function () { go(a); }, wait);
            }
            timer = setTimeout(function () { finish(null); }, 4000); /* API lenta → nunca prende o lead */

            try {
                W.fetch(cfg.endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    keepalive: true
                }).then(function (r) { finish(!!(r && r.ok)); })
                  .catch(function () { finish(false); });
            } catch (_) { finish(false); }
        });

        /* Enter dentro de um campo = clicar no botão */
        D.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            var inp = closest(e.target, '.pmf-form-wrap .pmf-field input');
            if (!inp) return;
            var wrap = closest(inp, '.pmf-form-wrap');
            var a = wrap && wrap.querySelector('.pmf-btn a');
            if (a) { e.preventDefault(); a.click(); }
        });
    })();`;
}

// ---------- HTML ----------
function fieldHtml(id, name, type, autocomplete, f, extra = '') {
    return `        <div class="pmf-field">
            <label for="${id}">${escText(f.label)}</label>
            <input type="${type}" id="${id}" name="${name}" placeholder="${escAttr(f.placeholder)}" autocomplete="${autocomplete}"${extra}>
        </div>`;
}

/**
 * Gera o snippet único.
 * @param {object} rawConfig  config (será normalizada)
 * @param {object} ctx        { apiBase, organizationId, projectId }
 * @returns {string}
 */
export function buildCaptureSnippet(rawConfig, ctx) {
    const cfg = normalizeCaptureConfig(rawConfig);
    const formId = formIdFor(ctx.projectId);
    const endpoint = buildEndpoint(ctx.apiBase, ctx.organizationId, ctx.projectId);
    const url = normalizeUrl(cfg.button.url);

    const runtimeCfg = {
        endpoint,
        attrs: cfg.extraAttributes,
        feedback: cfg.feedback.enabled,
        successText: cfg.feedback.successText,
        errorText: cfg.feedback.errorText,
        pixel: cfg.pixelEvent
    };

    const fields = [];
    if (cfg.fields.name.enabled) fields.push(fieldHtml(`${formId}-name`, 'name', 'text', 'name', cfg.fields.name));
    fields.push(fieldHtml(`${formId}-email`, 'email', 'email', 'email', cfg.fields.email, ' inputmode="email"'));
    if (cfg.fields.phone.enabled) fields.push(fieldHtml(`${formId}-phone`, 'phone', 'tel', 'tel', cfg.fields.phone, ' inputmode="tel"'));

    const accent = cfg.colors.accent;
    const btnBg = cfg.colors.buttonBg;
    const btnText = cfg.colors.buttonText;
    const note = cfg.colors.note;

    // ⚠️ JSON do bloco e HTML precisam bater 1:1 (validação do editor do WP).
    const promptBlock = cfg.prompt.text.trim()
        ? `
    <!-- wp:paragraph {"align":"center","className":"pmf-prompt","style":{"color":{"text":"${accent}"},"typography":{"fontSize":"16px","fontWeight":"800","textTransform":"uppercase"}}} -->
    <p class="has-text-align-center pmf-prompt has-text-color" style="color:${accent};font-size:16px;font-weight:800;text-transform:uppercase">${escText(cfg.prompt.text.trim())}</p>
    <!-- /wp:paragraph -->
`
        : '';

    const hrefAttr = url ? ` href="${escAttr(url)}"` : '';
    const buttonBlock = `
    <!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->
    <div class="wp-block-buttons">
        <!-- wp:button {"width":100,"className":"pmf-btn btn-cta","style":{"color":{"text":"${btnText}","background":"${btnBg}"},"border":{"radius":"18px"},"typography":{"fontSize":"26px","fontWeight":"800","textTransform":"uppercase"},"spacing":{"padding":{"top":"24px","right":"24px","bottom":"24px","left":"24px"}}}} -->
        <div class="wp-block-button has-custom-width wp-block-button__width-100 pmf-btn btn-cta"><a class="wp-block-button__link has-text-color has-background has-custom-font-size wp-element-button"${hrefAttr} style="border-radius:18px;color:${btnText};background-color:${btnBg};padding-top:24px;padding-right:24px;padding-bottom:24px;padding-left:24px;font-size:26px;font-weight:800;text-transform:uppercase">${escText(cfg.button.text.trim() || 'CONTINUAR')}</a></div>
        <!-- /wp:button -->
    </div>
    <!-- /wp:buttons -->
`;

    const noteBlock = cfg.note.text.trim()
        ? `
    <!-- wp:paragraph {"align":"center","className":"pmf-security","style":{"color":{"text":"${note}"},"typography":{"fontSize":"13px","fontWeight":"600"}}} -->
    <p class="has-text-align-center pmf-security has-text-color" style="color:${note};font-size:13px;font-weight:600">${escText(cfg.note.text.trim())}</p>
    <!-- /wp:paragraph -->
`
        : '';

    return `<!-- wp:html -->
<style>
${buildCss(cfg)}
</style>
<script>
${buildScript(formId, runtimeCfg)}
</script>
<!-- /wp:html -->

<!-- wp:group {"className":"pmf-form-wrap","layout":{"type":"constrained","contentSize":"${cfg.maxWidth}px"}} -->
<div class="wp-block-group pmf-form-wrap">
    <!-- wp:html -->
    <div class="pmf-form" data-pmf="${formId}">
${fields.join('\n')}
        <div class="pmf-msg" hidden></div>
    </div>
    <!-- /wp:html -->
${promptBlock}${buttonBlock}${noteBlock}</div>
<!-- /wp:group -->`;
}

// Documento completo p/ o <iframe srcDoc> do preview: roda o MESMO snippet com a flag de preview
// (clique simula o que faria — sem chamar a API nem redirecionar).
export function buildPreviewDoc(snippet) {
    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body { padding: 28px 16px 40px; font-family: Inter, -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; color: #111827; }
  .wp-block-group { box-sizing: border-box; }
  .pmf-preview-tip { max-width: 560px; margin: 0 auto 18px; padding: 10px 12px; border-radius: 10px; background: #f3f4f6; color: #4b5563; font-size: 12.5px; text-align: center; }
</style>
<script>window.__PMF_PREVIEW__ = true;</script>
</head>
<body>
<div class="pmf-preview-tip">Preview real do código gerado. Preencha e clique no botão para simular o comportamento (aqui nada é enviado nem redirecionado).</div>
${snippet}
</body>
</html>`;
}
