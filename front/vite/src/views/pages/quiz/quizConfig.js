// ============================================================================
// Configuração de Quiz — shape único usado pelo Builder e pela página pública.
// quiz.settings (JSON livre no back) armazena exatamente este objeto.
// ============================================================================

let _seq = 0;
export function uid(prefix = 'id') {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq.toString(36)}`;
}

// ---- Defaults (base de qualquer config; normalize() preenche o que faltar) ----
export function createDefaultQuizConfig() {
  return {
    version: 1,
    preset: 'clean',
    theme: {
      pageBackground: '#ffffff',
      pageGradient: '', // se preenchido, sobrepõe pageBackground (ex.: 'linear-gradient(...)')
      cardBackground: '#ffffff',
      cardWidth: 380,
      cardRadius: 18,
      cardShadow: true,
      cardBorder: '#eef0f4',
      accentColor: '#16a34a', // título / destaques
      accentBarColor: '#2563eb', // barra vertical à esquerda
      showAccentBar: true,
      textColor: '#0f172a',
      questionColor: '#0f172a',
      mutedColor: '#94a3b8',
      buttonBackground: '#0b2942',
      buttonTextColor: '#ffffff',
      buttonRadius: 10,
      buttonStyle: 'solid', // 'solid' | 'outline' | 'soft'
      font: 'Inter, system-ui, sans-serif'
    },
    logo: { url: '', height: 40, show: true },
    image: { url: '', radius: 14, show: true },
    title: {
      text: 'Consulta todos los Cursos Gratuitos según tu disponibilidad',
      size: 24,
      show: true
    },
    questions: [
      {
        id: uid('q'),
        text: '¿Cuál es tu nivel de estudios?',
        options: [
          { id: uid('o'), label: '✅ Primaria' },
          { id: uid('o'), label: '✅ Secundaria' },
          { id: uid('o'), label: '✅ Superior' }
        ]
      }
    ],
    onlineIndicator: {
      enabled: true,
      label: 'Personas consultando opciones en este momento',
      count: 413,
      dotColor: '#3b82f6'
    },
    leadCapture: {
      enabled: true,
      introText: 'Tu recomendación está lista. Ingresa tus datos para continuar.',
      captureName: true,
      nameLabel: 'Nombre',
      namePlaceholder: 'Tu nombre',
      captureEmail: true,
      emailLabel: 'Correo',
      emailPlaceholder: 'tucorreo@gmail.com',
      capturePhone: false,
      phoneLabel: 'Teléfono',
      phonePlaceholder: '+57 300 000 0000',
      buttonLabel: 'VER MI RESULTADO'
    },
    redirect: { url: '' },
    legal: {
      text: 'Al proseguir, aceptas nuestros',
      pages: [
        { id: uid('lp'), label: 'términos de servicio', href: '' },
        { id: uid('lp'), label: 'política de privacidad', href: '' }
      ]
    },
    animation: { type: 'slide', duration: 380 } // 'slide' | 'fade' | 'zoom' | 'none'
  };
}

// ---- Deep-merge defaults <- raw (raw vence; arrays do raw substituem) ----
function isObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}
function deepMerge(base, override) {
  if (!isObj(override)) return override === undefined ? base : override;
  const out = Array.isArray(base) ? [...base] : { ...base };
  Object.keys(override).forEach((k) => {
    if (isObj(out[k]) && isObj(override[k])) out[k] = deepMerge(out[k], override[k]);
    else out[k] = override[k];
  });
  return out;
}

// Normaliza qualquer settings (parcial/legado) num config completo e seguro.
export function normalizeQuizConfig(raw) {
  const base = createDefaultQuizConfig();
  const source = isObj(raw) ? (isObj(raw.personalizacao) ? raw.personalizacao : raw) : {};
  const merged = deepMerge(base, source);

  // Garante ids e estrutura mínima nas perguntas/opções.
  merged.questions = (Array.isArray(merged.questions) ? merged.questions : [])
    .filter(Boolean)
    .map((q) => ({
      id: q.id || uid('q'),
      text: typeof q.text === 'string' ? q.text : '',
      options: (Array.isArray(q.options) ? q.options : [])
        .filter(Boolean)
        .map((o) => ({
          id: o.id || uid('o'),
          label: typeof o.label === 'string' ? o.label : '',
          redirect: typeof o.redirect === 'string' ? o.redirect : ''
        }))
    }));
  if (merged.questions.length === 0) merged.questions = base.questions;

  merged.legal.pages = (Array.isArray(merged.legal?.pages) ? merged.legal.pages : [])
    .filter(Boolean)
    .map((p) => ({ id: p.id || uid('lp'), label: p.label || '', href: p.href || '' }));

  return merged;
}

// ============================================================================
// PRESETS prontos (3) — usados no Builder ("Modelos prontos").
// ============================================================================

// 1) CLEAN — inspirado no print (mais bonito): card branco, título verde,
//    botões azul-marinho, barra azul à esquerda, indicador de online.
function presetClean() {
  const c = createDefaultQuizConfig();
  c.preset = 'clean';
  return c;
}

// 2) VIBRANTE — fundo em gradiente quente, card translúcido, botões pill,
//    visual energético com emojis.
function presetVibrant() {
  const c = createDefaultQuizConfig();
  c.preset = 'vibrant';
  c.theme = {
    ...c.theme,
    pageGradient: 'linear-gradient(135deg, #7c3aed 0%, #db2777 55%, #f97316 100%)',
    pageBackground: '#7c3aed',
    cardBackground: 'rgba(255,255,255,0.96)',
    cardWidth: 400,
    cardRadius: 26,
    cardShadow: true,
    cardBorder: 'rgba(255,255,255,0.4)',
    accentColor: '#db2777',
    accentBarColor: '#f97316',
    showAccentBar: false,
    textColor: '#1f2937',
    questionColor: '#111827',
    mutedColor: '#9ca3af',
    buttonBackground: 'linear-gradient(135deg, #db2777 0%, #7c3aed 100%)',
    buttonTextColor: '#ffffff',
    buttonRadius: 999,
    buttonStyle: 'solid',
    font: 'Poppins, Inter, system-ui, sans-serif'
  };
  c.title.text = '🎯 Descubre tu resultado en 30 segundos';
  c.title.size = 26;
  c.questions = [
    {
      id: uid('q'),
      text: '¿Qué te gustaría lograr primero?',
      options: [
        { id: uid('o'), label: '🚀 Crecer rápido' },
        { id: uid('o'), label: '💡 Aprender algo nuevo' },
        { id: uid('o'), label: '💰 Ganar más dinero' }
      ]
    },
    {
      id: uid('q'),
      text: '¿Cuánto tiempo tienes por día?',
      options: [
        { id: uid('o'), label: '⏰ Menos de 1 hora' },
        { id: uid('o'), label: '⏳ Entre 1 y 3 horas' },
        { id: uid('o'), label: '🔥 Más de 3 horas' }
      ]
    }
  ];
  c.onlineIndicator = {
    enabled: true,
    label: 'personas haciendo el quiz ahora 🔥',
    count: 1287,
    dotColor: '#f97316'
  };
  c.leadCapture = {
    ...c.leadCapture,
    introText: '🎉 ¡Listo! Déjanos tus datos para enviarte el resultado.',
    capturePhone: true,
    buttonLabel: 'QUIERO MI RESULTADO 🎁'
  };
  return c;
}

// 3) DARK NEON — fundo escuro, acentos neon, vibe moderna/tech.
function presetDarkNeon() {
  const c = createDefaultQuizConfig();
  c.preset = 'dark-neon';
  c.theme = {
    ...c.theme,
    pageGradient: 'radial-gradient(1200px 600px at 50% -10%, #1e293b 0%, #0b1120 60%, #060912 100%)',
    pageBackground: '#0b1120',
    cardBackground: 'rgba(17,24,39,0.85)',
    cardWidth: 400,
    cardRadius: 20,
    cardShadow: true,
    cardBorder: 'rgba(56,189,248,0.25)',
    accentColor: '#22d3ee',
    accentBarColor: '#22d3ee',
    showAccentBar: true,
    textColor: '#e5e7eb',
    questionColor: '#f8fafc',
    mutedColor: '#64748b',
    buttonBackground: 'rgba(34,211,238,0.12)',
    buttonTextColor: '#e0f2fe',
    buttonRadius: 12,
    buttonStyle: 'outline',
    font: 'Inter, system-ui, sans-serif'
  };
  c.title.text = 'Responde y desbloquea tu acceso';
  c.title.size = 25;
  c.questions = [
    {
      id: uid('q'),
      text: '¿Cuál es tu nivel actual?',
      options: [
        { id: uid('o'), label: 'Principiante' },
        { id: uid('o'), label: 'Intermedio' },
        { id: uid('o'), label: 'Avanzado' }
      ]
    }
  ];
  c.onlineIndicator = {
    enabled: true,
    label: 'usuarios conectados ahora',
    count: 642,
    dotColor: '#22d3ee'
  };
  c.leadCapture = {
    ...c.leadCapture,
    introText: 'Acceso casi listo. Ingresa tu correo para continuar.',
    buttonLabel: 'DESBLOQUEAR ACCESO'
  };
  return c;
}

export const QUIZ_PRESETS = [
  {
    id: 'clean',
    name: 'Clean',
    description: 'Card branco, título verde, botões sóbrios. Foco e conversão.',
    build: presetClean
  },
  {
    id: 'vibrant',
    name: 'Vibrante',
    description: 'Gradiente quente, botões pill e emojis. Visual energético.',
    build: presetVibrant
  },
  {
    id: 'dark-neon',
    name: 'Dark Neon',
    description: 'Fundo escuro com acentos neon. Vibe moderna/tech.',
    build: presetDarkNeon
  }
];

export function buildPresetConfig(presetId) {
  const p = QUIZ_PRESETS.find((x) => x.id === presetId) || QUIZ_PRESETS[0];
  return p.build();
}
