import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeQuizConfig, sanitizeCssClasses } from './quizConfig';
import { mountQuizAds } from './quizAds';

function cx(...parts) {
  return parts.filter(Boolean).join(' ').trim();
}

// Navega via CLIQUE DE ÂNCORA REAL (não window.location.href) — igual ao webchat:
// scripts de anúncio/GTM que interceptam cliques de link conseguem rodar antes
// de sair da página.
function navigateTo(url) {
  const dest = String(url || '').trim();
  if (!dest || typeof document === 'undefined') return;
  try {
    const a = document.createElement('a');
    a.href = dest;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.parentNode && a.parentNode.removeChild(a), 0);
  } catch {
    window.location.href = dest;
  }
}

// Empurra evento pro dataLayer do GTM (rastreio robusto por Evento Personalizado,
// sem depender de clique/classe no DOM). Best-effort, nunca lança.
function pushDataLayer(obj) {
  if (typeof window === 'undefined') return;
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(obj);
  } catch {
    /* noop */
  }
}

// Renderizador único do quiz. Usado pela página pública (mode="live") e pelo
// preview do builder (mode="preview"). Toda a aparência vem do config.
//
// Props:
//  - config: objeto de configuração (será normalizado)
//  - mode: 'live' | 'preview'
//  - onLeadSubmit: async (data) => void   (live)
//  - onRedirect: (url) => void            (live; default: window.location)
//  - resetKey: muda -> reinicia o fluxo (útil no preview)

const STYLE_ID = 'pubmail-quiz-style';

function ensureStyle() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const css = `
  @keyframes qzSlideIn { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes qzFadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes qzZoomIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
  @keyframes qzPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .4; transform: scale(.7); } }
  .qz-btn { transition: transform .12s ease, box-shadow .18s ease, filter .18s ease, background .18s ease; }
  .qz-btn:hover { transform: translateY(-1px); filter: brightness(1.06); }
  .qz-btn:active { transform: translateY(0) scale(.99); }
  .qz-input:focus { outline: none; border-color: var(--qz-accent) !important; box-shadow: 0 0 0 3px color-mix(in srgb, var(--qz-accent) 22%, transparent); }
  .qz-link { color: var(--qz-accent); text-decoration: none; }
  .qz-link:hover { text-decoration: underline; }
  `;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.appendChild(document.createTextNode(css));
  document.head.appendChild(el);
}

function animName(type) {
  if (type === 'fade') return 'qzFadeIn';
  if (type === 'zoom') return 'qzZoomIn';
  if (type === 'none') return null;
  return 'qzSlideIn';
}

function htmlHasContent(s) {
  return Boolean(String(s || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim());
}

// Renderiza um bloco de conteúdo (abaixo dos botões): texto/título, imagem, divisor.
function renderContentBlock(b, theme) {
  if (!b) return null;
  if (b.type === 'image') {
    if (!b.url) return null;
    return (
      <div key={b.id} style={{ textAlign: b.align || 'center', lineHeight: 0 }}>
        <img src={b.url} alt="" style={{ width: `${b.widthPct || 100}%`, maxWidth: '100%', borderRadius: b.radius ?? 10, display: 'inline-block', objectFit: 'cover' }} />
      </div>
    );
  }
  if (b.type === 'divider') {
    return <div key={b.id} style={{ borderTop: `${b.thickness || 1}px solid ${b.color || '#e5e7eb'}` }} />;
  }
  if (!htmlHasContent(b.text)) return null;
  return (
    <p
      key={b.id}
      style={{
        margin: 0,
        fontFamily: theme.font,
        fontSize: b.size || 14,
        color: b.color || theme.textColor,
        textAlign: b.align || 'center',
        fontWeight: b.weight || 400,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap'
      }}
    >
      {b.text}
    </p>
  );
}

export default function QuizView({ config: rawConfig, mode = 'live', ads = null, onLeadSubmit, onRedirect, resetKey = 0 }) {
  const config = useMemo(() => normalizeQuizConfig(rawConfig), [rawConfig]);
  const theme = config.theme;
  const isPreview = mode === 'preview';
  const hasTopAd = Boolean(!isPreview && ads && ads.topo);

  // fluxo: 'questions' -> 'lead' (se habilitado) -> 'done'
  const [phase, setPhase] = useState('questions');
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [animKey, setAnimKey] = useState(0);
  const [lead, setLead] = useState({ name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [leadError, setLeadError] = useState('');
  const [doneMsg, setDoneMsg] = useState('');
  const scrollRef = useRef(null);
  const redirectRef = useRef(''); // redirect baseado na resposta (último não-vazio vence)

  useEffect(() => ensureStyle(), []);

  // Anúncios (apenas no modo live). Monta após o container existir.
  useEffect(() => {
    if (isPreview || !ads) return undefined;
    const cleanup = mountQuizAds(ads);
    return () => cleanup && cleanup();
  }, [ads, isPreview]);

  // Reset quando resetKey muda ou a quantidade de perguntas muda no preview.
  useEffect(() => {
    setPhase('questions');
    setStepIndex(0);
    setAnswers({});
    setLead({ name: '', email: '', phone: '' });
    setLeadError('');
    setDoneMsg('');
    redirectRef.current = '';
    setAnimKey((k) => k + 1);
  }, [resetKey]);

  // Mantém stepIndex válido se perguntas mudarem (preview ao vivo).
  useEffect(() => {
    if (phase === 'questions' && stepIndex > config.questions.length - 1) {
      setStepIndex(Math.max(0, config.questions.length - 1));
    }
  }, [config.questions.length, phase, stepIndex]);

  const bump = () => {
    setAnimKey((k) => k + 1);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  const goRedirect = () => {
    // redirect por resposta tem prioridade sobre o redirect geral
    const url = String(redirectRef.current || config.redirect?.url || '').trim();
    if (isPreview) {
      setDoneMsg(url ? `Redirecionaria para: ${url}` : 'Fim do quiz (nenhum link de redirecionamento configurado).');
      setPhase('done');
      bump();
      return;
    }
    pushDataLayer({ event: 'quiz_complete', quiz_redirect_url: url || null });
    if (url) {
      if (onRedirect) onRedirect(url);
      else navigateTo(url);
    } else {
      setDoneMsg('¡Gracias por responder!');
      setPhase('done');
      bump();
    }
  };

  const finishQuestions = () => {
    if (config.leadCapture?.enabled) {
      setPhase('lead');
      bump();
    } else {
      goRedirect();
    }
  };

  const handleAnswer = (q, opt) => {
    setAnswers((prev) => ({ ...prev, [q.id]: opt.label }));
    if (String(opt.redirect || '').trim()) redirectRef.current = opt.redirect.trim();
    if (!isPreview) {
      pushDataLayer({ event: 'quiz_answer', quiz_step: stepIndex + 1, quiz_question: q.text || '', quiz_answer: opt.label || '' });
    }
    if (stepIndex < config.questions.length - 1) {
      setStepIndex((i) => i + 1);
      bump();
    } else {
      finishQuestions();
    }
  };

  const submitLead = async (e) => {
    e?.preventDefault?.();
    const lc = config.leadCapture;
    setLeadError('');
    if (lc.captureName && !String(lead.name).trim()) return setLeadError('Preencha o nome.');
    if (lc.captureEmail && !/\S+@\S+\.\S+/.test(String(lead.email).trim())) return setLeadError('E-mail inválido.');
    if (lc.capturePhone && String(lead.phone).replace(/[^\d+]/g, '').length < 6) return setLeadError('Telefone inválido.');

    if (isPreview) {
      goRedirect();
      return;
    }
    setSubmitting(true);
    try {
      if (onLeadSubmit) {
        await onLeadSubmit({
          name: lc.captureName ? lead.name.trim() : undefined,
          email: lc.captureEmail ? lead.email.trim() : undefined,
          phone: lc.capturePhone ? lead.phone.trim() : undefined,
          answers
        });
      }
      // Evento de CONVERSÃO — o especialista cria um trigger de Evento
      // Personalizado "quiz_lead" no GTM (não depende de clique/classe no DOM).
      pushDataLayer({
        event: 'quiz_lead',
        quiz_has_email: Boolean(lc.captureEmail && lead.email),
        quiz_has_phone: Boolean(lc.capturePhone && lead.phone)
      });
      goRedirect();
    } catch (err) {
      setLeadError(err?.response?.data?.message || err?.message || 'No se pudo guardar. Inténtalo de nuevo.');
      setSubmitting(false);
    }
  };

  // -------- estilos derivados --------
  const pageBg = theme.pageGradient || theme.pageBackground;
  const anim = animName(config.animation?.type);
  const animStyle = anim
    ? { animation: `${anim} ${Math.max(120, Number(config.animation?.duration) || 380)}ms ease both` }
    : {};

  const buttonStyle = (() => {
    const base = {
      display: 'block',
      width: '100%',
      border: 'none',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: 15,
      padding: '13px 16px',
      borderRadius: theme.buttonRadius,
      textAlign: 'center',
      fontFamily: theme.font,
      lineHeight: 1.25
    };
    if (theme.buttonStyle === 'outline') {
      return {
        ...base,
        background: 'transparent',
        color: theme.buttonTextColor,
        border: `1.5px solid ${theme.accentColor}`
      };
    }
    if (theme.buttonStyle === 'soft') {
      return {
        ...base,
        background: `color-mix(in srgb, ${theme.accentColor} 14%, transparent)`,
        color: theme.buttonTextColor
      };
    }
    return { ...base, background: theme.buttonBackground, color: theme.buttonTextColor };
  })();

  // Cor de fundo específica do botão de captação (vazio = usa a cor do tema).
  const captureBg = String(config.leadCapture?.buttonBgColor || '').trim();

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 14px',
    borderRadius: 10,
    border: `1px solid ${theme.cardBorder || '#e5e7eb'}`,
    background: '#fff',
    color: '#0f172a',
    fontSize: 15,
    fontFamily: theme.font
  };

  const currentQuestion = config.questions[stepIndex] || config.questions[0];

  return (
    <div
      style={{
        minHeight: isPreview ? '100%' : '100dvh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: pageBg,
        padding: '24px 16px',
        boxSizing: 'border-box',
        fontFamily: theme.font,
        // expõe accent pra usar no CSS (focus/links)
        ['--qz-accent']: theme.accentColor
      }}
    >
      <div style={{ width: '100%', maxWidth: theme.cardWidth, display: 'flex', flexDirection: 'column' }}>
        {/* Anúncio do topo (montado via quizAds no modo live) */}
        {hasTopAd ? <div id="quiz-ad-topo" style={{ width: '100%', marginBottom: 12 }} /> : null}

        <div
          ref={scrollRef}
          style={{
            position: 'relative',
            background: theme.cardBackground,
            borderRadius: theme.cardRadius,
            border: `1px solid ${theme.cardBorder || 'transparent'}`,
            boxShadow: theme.cardShadow ? '0 18px 50px rgba(2,6,23,0.16)' : 'none',
            padding: '26px 24px 22px',
            overflow: 'hidden'
          }}
        >
          {theme.showAccentBar ? (
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: 18,
                bottom: 18,
                width: 4,
                borderRadius: 4,
                background: theme.accentBarColor
              }}
            />
          ) : null}

          {/* Logo */}
          {config.logo?.show && config.logo?.url ? (
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <img src={config.logo.url} alt="logo" style={{ height: config.logo.height || 40, maxWidth: '70%', objectFit: 'contain' }} />
            </div>
          ) : null}

          {/* Imagem hero */}
          {config.image?.show && config.image?.url ? (
            <div style={{ marginBottom: 18 }}>
              <img
                src={config.image.url}
                alt=""
                style={{ width: '100%', display: 'block', borderRadius: config.image.radius ?? 14, objectFit: 'cover' }}
              />
            </div>
          ) : null}

          {/* Título */}
          {config.title?.show && htmlHasContent(config.title?.text) ? (
            <h1
              style={{
                margin: '0 0 18px',
                textAlign: 'center',
                color: theme.accentColor,
                fontSize: config.title.size || 24,
                lineHeight: 1.25,
                fontWeight: 800,
                fontFamily: theme.font
              }}
            >
              {config.title.text}
            </h1>
          ) : null}

          {/* Conteúdo animado por etapa */}
          <div key={animKey} style={animStyle}>
            {phase === 'questions' && currentQuestion ? (
              (() => {
                const hasDesc = htmlHasContent(currentQuestion.description);
                const descAbove = currentQuestion.descriptionPosition === 'above';
                const descBlock = hasDesc ? (
                  <p
                    style={{
                      margin: descAbove ? '0 0 8px' : '0 0 14px',
                      textAlign: currentQuestion.descriptionAlign || 'center',
                      color: currentQuestion.descriptionColor || theme.mutedColor,
                      fontWeight: currentQuestion.descriptionBold ? 700 : 400,
                      fontSize: currentQuestion.descriptionSize || 14,
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {currentQuestion.description}
                  </p>
                ) : null;
                return (
                  <>
                    {descAbove ? descBlock : null}
                    {htmlHasContent(currentQuestion.text) ? (
                      <p
                        style={{
                          margin: hasDesc && !descAbove ? '0 0 8px' : '0 0 14px',
                          textAlign: 'center',
                          color: theme.questionColor,
                          fontWeight: 700,
                          fontSize: 16
                        }}
                      >
                        {currentQuestion.text}
                      </p>
                    ) : null}
                    {!descAbove ? descBlock : null}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {currentQuestion.options.map((opt) => (
                        // Âncora real (não <button>) pra scripts de anúncio/GTM
                        // reconhecerem o clique como link — igual ao webchat. O
                        // href leva o destino (se houver) só pro GTM ler; a
                        // navegação segue controlada pelo JS (redirect no fim).
                        <a
                          key={opt.id}
                          role="button"
                          href={String(opt.redirect || '').trim() || '#'}
                          className={cx('qz-btn', sanitizeCssClasses(opt.cssClass))}
                          style={{ ...buttonStyle, textDecoration: 'none' }}
                          onClick={(e) => {
                            e.preventDefault();
                            handleAnswer(currentQuestion, opt);
                          }}
                        >
                          {opt.label || '—'}
                        </a>
                      ))}
                    </div>

                    {/* Conteúdo livre abaixo dos botões */}
                    {Array.isArray(currentQuestion.content) && currentQuestion.content.length ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                        {currentQuestion.content.map((b) => renderContentBlock(b, theme))}
                      </div>
                    ) : null}
                  </>
                );
              })()
            ) : null}

            {phase === 'lead' ? (
              <form onSubmit={submitLead} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {htmlHasContent(config.leadCapture.introText) ? (
                  <p style={{ margin: '0 0 4px', textAlign: 'center', color: theme.questionColor, fontWeight: 700, fontSize: 15 }}>
                    {config.leadCapture.introText}
                  </p>
                ) : null}
                {config.leadCapture.captureName ? (
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: theme.mutedColor, marginBottom: 5 }}>
                      {config.leadCapture.nameLabel}
                    </label>
                    <input
                      className="qz-input"
                      style={inputStyle}
                      value={lead.name}
                      placeholder={config.leadCapture.namePlaceholder}
                      onChange={(e) => setLead((p) => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                ) : null}
                {config.leadCapture.captureEmail ? (
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: theme.mutedColor, marginBottom: 5 }}>
                      {config.leadCapture.emailLabel}
                    </label>
                    <input
                      className="qz-input"
                      type="email"
                      style={inputStyle}
                      value={lead.email}
                      placeholder={config.leadCapture.emailPlaceholder}
                      onChange={(e) => setLead((p) => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                ) : null}
                {config.leadCapture.capturePhone ? (
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: theme.mutedColor, marginBottom: 5 }}>
                      {config.leadCapture.phoneLabel}
                    </label>
                    <input
                      className="qz-input"
                      style={inputStyle}
                      value={lead.phone}
                      placeholder={config.leadCapture.phonePlaceholder}
                      onChange={(e) => setLead((p) => ({ ...p, phone: e.target.value }))}
                    />
                  </div>
                ) : null}
                {leadError ? <div style={{ color: '#dc2626', fontSize: 13, textAlign: 'center' }}>{leadError}</div> : null}
                {/* Âncora real (rastreável por anúncio/GTM). O clique dispara a
                    captação; o botão submit escondito preserva o "Enter envia". */}
                <a
                  role="button"
                  href="#"
                  className={cx('qz-btn', sanitizeCssClasses(config.leadCapture.buttonCssClass))}
                  aria-disabled={submitting ? 'true' : 'false'}
                  style={{
                    ...buttonStyle,
                    ...(captureBg ? { background: captureBg } : {}),
                    textDecoration: 'none',
                    opacity: submitting ? 0.7 : 1,
                    marginTop: 2
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    if (!submitting) submitLead(e);
                  }}
                >
                  {submitting ? 'Enviando…' : config.leadCapture.buttonLabel}
                </a>
                <button type="submit" aria-hidden="true" tabIndex={-1} style={{ position: 'absolute', width: 1, height: 1, padding: 0, border: 0, opacity: 0, pointerEvents: 'none' }} />
              </form>
            ) : null}

            {phase === 'done' ? (
              <div style={{ textAlign: 'center', color: theme.questionColor, padding: '14px 0', fontWeight: 600 }}>{doneMsg}</div>
            ) : null}
          </div>

          {/* Indicador de online */}
          {config.onlineIndicator?.enabled && phase === 'questions' ? (
            <div style={{ marginTop: 18, paddingTop: 12, borderTop: `1px solid ${theme.cardBorder || '#eef0f4'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: config.onlineIndicator.dotColor, animation: 'qzPulse 1.6s ease-in-out infinite' }} />
              <span style={{ fontSize: 12.5, color: theme.mutedColor }}>
                {Number(config.onlineIndicator.count) || 0} {config.onlineIndicator.label}
              </span>
            </div>
          ) : null}
        </div>

        {/* Rodapé legal */}
        {config.legal?.pages?.length && config.legal.pages.some((p) => p.label) ? (
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: theme.mutedColor, lineHeight: 1.5 }}>
            {config.legal.text ? <span>{config.legal.text} </span> : null}
            {config.legal.pages
              .filter((p) => p.label)
              .map((p, i, arr) => (
                <span key={p.id}>
                  <a className="qz-link" href={p.href || '#'} target="_blank" rel="noreferrer">
                    {p.label}
                  </a>
                  {i < arr.length - 1 ? <span> · </span> : null}
                </span>
              ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
