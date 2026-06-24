import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_MODEL = process.env.WEBCHAT_DEFAULT_MODEL || 'llama-3.3-70b-versatile';
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_HISTORY_LIMIT = 12;
// Ordem RÍGIDA: nome → telefone → e-mail. Não mexer sem alinhar com getLeadConversationStage.
const DEFAULT_REQUIRED_FIELDS = [
  { key: 'nome', label: 'Nome', type: 'texto', required: true },
  { key: 'telefone', label: 'Telefone', type: 'telefone', required: true },
  { key: 'email', label: 'E-mail', type: 'email', required: true },
];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Mínimo de 8 dígitos pra aceitar como telefone confiável (BR fixo, móvel ou
// internacional). Aceita pontuação na entrada — extraímos só os dígitos.
const PHONE_MIN_DIGITS = 8;
const INTRO_MARKER_REGEX = /\b(sou|me\s+chamo|eu\s+sou)\b[^.!?\n]{0,90}\b(agente|assistente)\b/i;
const REPEATED_INTRO_PREFIX_REGEXES = [
  /^\s*(?:ol[áa][^.!?]*[.!?]\s*)?(?:sou|eu\s+sou)\s+(?:o|a)\s+(?:agente|assistente)\b[^.!?]*[.!?]?\s*/i,
  /^\s*ol[áa][^,!?]*,\s*(?:sou|eu\s+sou)\s+(?:o|a)\s+(?:agente|assistente)\b[^.!?]*[.!?]?\s*/i,
  /^\s*(?:me\s+chamo)\s+[^.!?]{1,60}[.!?]?\s*/i,
];
const LEAD_STAGE = {
  CAPTURE_NAME: 'capture_name',
  CAPTURE_EMAIL: 'capture_email',
  CAPTURE_PHONE: 'capture_phone',
  FREE_CHAT: 'free_chat',
};

// Detecção de opt-out: o dono do agente pode escrever no prompt_mestre
// instruções pra NÃO pedir dados do lead (ex.: "não peça nome", "do not
// ask for email", "no preguntes el teléfono"). Quando detectado, pulamos
// todo o fluxo rígido de captura — o agente vai direto pro free_chat e
// só ajuda com o tema, sem solicitar nome/telefone/e-mail.
//
// Cobrimos PT/EN/ES com regex de proximidade: directive negativa + alvo
// (nome/telefone/e-mail/dados/lead/contato) dentro de ~80 chars.
const LEAD_CAPTURE_DISABLED_PATTERNS = [
  // Português: "não peça/pedir/solicite/pergunte/capture/colete ... nome/telefone/email/dados/lead/contato"
  /(?:n[aã]o|nunca)\s+(?:pe[cç]a|pe[cç]ar|pedir|solicite|solicitar|pergunte|perguntar|capture|capturar|colete|coletar|exija|exigir)\b[\s\S]{0,80}?\b(nome|telefone|celular|e-?mail|dados|informa[cç][aã]o|informa[cç][oõ]es|lead|contato|whatsapp)/i,
  // Português: "sem pedir/solicitar/perguntar/capturar/coletar ... <alvo>"
  /\bsem\s+(?:pedir|solicitar|perguntar|capturar|coletar)\b[\s\S]{0,80}?\b(nome|telefone|celular|e-?mail|dados|informa[cç][aã]o|informa[cç][oõ]es|lead|contato|whatsapp)/i,
  // Português: "não capture/colete leads" (forma curta sem alvo específico)
  /(?:n[aã]o|nunca)\s+(?:capture|capturar|colete|coletar)\s+(?:lead|leads|dados|informa)/i,
  // English: "don't / do not / never ask|request|capture|collect|require|prompt ... <target>"
  /\b(?:do\s+not|don'?t|never)\s+(?:ask|request|capture|collect|require|prompt|gather)\b[\s\S]{0,80}?\b(name|phone|email|e-?mail|lead|contact|personal\s+data|info|information)/i,
  // English: marcadores explícitos
  /\b(?:skip|disable|no)\s+lead\s+(?:capture|collection|capturing|gathering)\b/i,
  // Español: "no pidas/solicites/preguntes/captures/recopiles ... <alvo>"
  /\bno\s+(?:pidas|pedir|solicites|solicitar|preguntes|preguntar|captures|capturar|recopiles|recopilar)\b[\s\S]{0,80}?\b(nombre|tel[eé]fono|email|correo|datos|lead|contacto|informaci[oó]n)/i,
];

const isLeadCaptureDisabledForAgent = (agent) => {
  const promptMestre = String(agent?.ia_config?.prompt_mestre || '');
  if (!promptMestre.trim()) return false;
  return LEAD_CAPTURE_DISABLED_PATTERNS.some((re) => re.test(promptMestre));
};

const normalizeNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
};

const toSafeString = (value) => String(value ?? '').trim();

const normalizeHistoryRole = (rawRole) => {
  const role = toSafeString(rawRole).toLowerCase();
  if (['assistant', 'bot', 'model', 'ai'].includes(role)) return 'assistant';
  if (['user', 'human', 'client', 'cliente'].includes(role)) return 'user';
  return '';
};

const normalizeConversationHistory = (rawHistory, currentMessage) => {
  const source = Array.isArray(rawHistory) ? rawHistory : [];
  const maxHistory = Math.max(
    1,
    Math.floor(
      normalizeNumber(process.env.WEBCHAT_HISTORY_LIMIT, DEFAULT_HISTORY_LIMIT),
    ),
  );
  const normalized = source
    .map((entry) => toObject(entry))
    .map((entry) => {
      const role = normalizeHistoryRole(entry.role || entry.type);
      const content = toSafeString(entry.content || entry.message || entry.text);
      if (!role || !content) return null;
      return { role, content };
    })
    .filter(Boolean);

  if (normalized.length === 0) return [];

  const currentText = toSafeString(currentMessage);
  const deduped = [...normalized];
  const lastMessage = deduped[deduped.length - 1];

  if (
    lastMessage?.role === 'user' &&
    currentText &&
    lastMessage.content === currentText
  ) {
    deduped.pop();
  }

  return deduped.slice(-maxHistory);
};

// Walk dinâmico em required_fields (na ordem cadastrada). Retorna o estágio
// CAPTURE_<key> do primeiro campo obrigatório ainda vazio. Se required_fields
// é [], cai direto em FREE_CHAT.
//
// Os 3 estágios padrão (capture_name/phone/email) cobrem os campos default;
// pra campos custom (campos_lead em ia_config), retornamos `capture_${key}`.
const FIELD_TO_STAGE = {
  nome: LEAD_STAGE.CAPTURE_NAME,
  telefone: LEAD_STAGE.CAPTURE_PHONE,
  email: LEAD_STAGE.CAPTURE_EMAIL,
};

const getLeadConversationStage = (leadState) => {
  if (leadState?.released || leadState?.capture_completed) {
    return LEAD_STAGE.FREE_CHAT;
  }
  const collected = toObject(leadState?.collected);
  const fields = Array.isArray(leadState?.required_fields)
    ? leadState.required_fields
    : [];
  for (const field of fields) {
    if (field.required === false) continue;
    if (!toSafeString(collected[field.key])) {
      return FIELD_TO_STAGE[field.key] || `capture_${field.key}`;
    }
  }
  return LEAD_STAGE.FREE_CHAT;
};

const shouldAvoidReintroduction = (historyMessages, leadState) => {
  const stage = getLeadConversationStage(leadState);
  if (stage !== LEAD_STAGE.CAPTURE_NAME) return true;

  const collected = toObject(leadState?.collected);
  if (toSafeString(collected.nome) || toSafeString(collected.email)) return true;

  return historyMessages.some(
    (entry) =>
      entry.role === 'assistant' && INTRO_MARKER_REGEX.test(entry.content),
  );
};

const stripRepeatedIntroduction = (rawReply) => {
  const original = toSafeString(rawReply);
  if (!original) return '';

  let next = original;
  REPEATED_INTRO_PREFIX_REGEXES.forEach((regex) => {
    next = next.replace(regex, '');
  });
  const sentences = next
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (sentences.length > 1 && INTRO_MARKER_REGEX.test(sentences[0])) {
    next = sentences.slice(1).join(' ').trim();
  }
  next = next.replace(/^[\s,;:.-]+/, '').trim();

  if (!next) return original;
  return next.charAt(0).toUpperCase() + next.slice(1);
};

const normalizeFieldKey = (rawKey) => {
  const key = toSafeString(rawKey).toLowerCase();
  if (!key) return '';

  if (['nome', 'name', 'first_name', 'firstname'].includes(key)) return 'nome';
  if (['email', 'e-mail', 'mail'].includes(key)) return 'email';
  if (['telefone', 'phone', 'celular', 'whatsapp'].includes(key)) return 'telefone';

  return key.replace(/[^a-z0-9_]/g, '_').slice(0, 60);
};

const normalizeFieldType = (rawType) => {
  const type = toSafeString(rawType).toLowerCase();
  if (!type) return 'texto';
  if (['email', 'mail'].includes(type)) return 'email';
  if (['telefone', 'phone', 'celular', 'whatsapp'].includes(type)) return 'telefone';
  if (['numero', 'number'].includes(type)) return 'numero';
  if (['boolean', 'bool'].includes(type)) return 'boolean';
  if (['data', 'date'].includes(type)) return 'data';
  return 'texto';
};

const normalizeLeadFields = (rawFields) => {
  const source = Array.isArray(rawFields) ? rawFields : [];
  const seen = new Set();
  const fields = [];

  source.forEach((field, index) => {
    const value = toObject(field);
    const key = normalizeFieldKey(value.key || value.nome || value.name || `campo_${index + 1}`);
    if (!key || seen.has(key)) return;
    seen.add(key);
    fields.push({
      key,
      label: toSafeString(value.label || value.nome || value.name || key),
      type: normalizeFieldType(value.tipo || value.type),
      required: value.obrigatorio !== false && value.required !== false,
      prompt: toSafeString(value.prompt || value.pergunta || ''),
    });
  });

  if (fields.length > 0) return fields;

  return DEFAULT_REQUIRED_FIELDS.map((field) => ({ ...field }));
};

// Determina quais campos coletar com base nos toggles do agente:
//   captar_telefone (bool) e captar_email (bool) em ia_config.
//
// Prioridade:
//   1. campos_lead explícito (config avançada/legada) — usuário sabe o que quer
//   2. Toggles explícitos (captar_telefone/captar_email são boolean)
//        - ambos false        → [] (sem captura)
//        - phone on, mail off → [nome, telefone]
//        - phone off, mail on → [nome, email]
//        - ambos true         → [nome, telefone, email]
//   3. Sem toggles e sem campos_lead (agente legado pré-toggles):
//        - mantém comportamento atual: nome+telefone+email RÍGIDO
//        - mas se o prompt_mestre tiver opt-out por linguagem natural
//          (ex: "não peça nome"), retornamos [] (legacy escape hatch)
const resolveLeadFieldsFromAgent = (agent) => {
  const iaConfig = toObject(agent?.ia_config);

  // 1. campos_lead explícito vence tudo
  if (Array.isArray(iaConfig.campos_lead) && iaConfig.campos_lead.length > 0) {
    return normalizeLeadFields(iaConfig.campos_lead);
  }

  // 2. Toggles explícitos
  const hasExplicitToggles =
    typeof iaConfig.captar_telefone === 'boolean' ||
    typeof iaConfig.captar_email === 'boolean';

  if (hasExplicitToggles) {
    const captarTelefone = iaConfig.captar_telefone === true;
    const captarEmail = iaConfig.captar_email === true;
    if (!captarTelefone && !captarEmail) return [];

    const fields = [
      { key: 'nome', label: 'Nome', type: 'texto', required: true },
    ];
    if (captarTelefone) {
      fields.push({ key: 'telefone', label: 'Telefone', type: 'telefone', required: true });
    }
    if (captarEmail) {
      fields.push({ key: 'email', label: 'E-mail', type: 'email', required: true });
    }
    return fields;
  }

  // 3. Legacy: agente sem toggles. Honra opt-out por linguagem natural se
  // estiver no prompt_mestre, caso contrário cai no fluxo padrão (3 campos).
  if (isLeadCaptureDisabledForAgent(agent)) return [];

  return DEFAULT_REQUIRED_FIELDS.map((field) => ({ ...field }));
};

const normalizeLeadValue = (key, value) => {
  const text = toSafeString(value);
  if (!text) return '';

  if (key === 'email') {
    const normalized = text.toLowerCase();
    return EMAIL_REGEX.test(normalized) ? normalized : '';
  }

  if (key === 'nome') {
    if (text.length < 2) return '';
    if (EMAIL_REGEX.test(text)) return '';
    return text.slice(0, 255);
  }

  if (key === 'telefone') {
    const digits = text.replace(/\D+/g, '');
    if (digits.length < PHONE_MIN_DIGITS) return '';
    // Preserva o formato original digitado (com + e separadores) mas trunca.
    return text.slice(0, 30);
  }

  return text.slice(0, 255);
};

const normalizeCollectedFields = (rawCollected, fields) => {
  const source = toObject(rawCollected);
  const allowedKeys = new Set(fields.map((field) => field.key));
  const collected = {};

  Object.entries(source).forEach(([rawKey, value]) => {
    const key = normalizeFieldKey(rawKey);
    if (!key || !allowedKeys.has(key)) return;
    const normalized = normalizeLeadValue(key, value);
    if (normalized) collected[key] = normalized;
  });

  return collected;
};

const normalizeAttempts = (rawAttempts, fields) => {
  const source = toObject(rawAttempts);
  const attempts = {};
  fields.forEach((field) => {
    const value = Number(source[field.key]);
    attempts[field.key] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  });
  return attempts;
};

const normalizeLeadState = (leadState, agent) => {
  const source = toObject(leadState);
  // Sempre derivado da config do agente. NÃO usamos source.required_fields
  // porque sessões antigas (webchat_sessions) podem ter cacheado um array
  // desatualizado (ex.: sem telefone) e dominariam o fluxo eternamente.
  // resolveLeadFieldsFromAgent já trata: campos_lead > toggles > legacy.
  const requiredFields = resolveLeadFieldsFromAgent(agent);
  const captureDisabled = requiredFields.length === 0;
  const collected = normalizeCollectedFields(source.collected, requiredFields);
  const attempts = normalizeAttempts(source.attempts, requiredFields);
  const maxAttempts = Math.max(
    1,
    Math.floor(normalizeNumber(source.max_attempts, DEFAULT_MAX_ATTEMPTS)),
  );

  return {
    required_fields: requiredFields,
    collected,
    attempts,
    max_attempts: maxAttempts,
    allow_continue_after_attempts: source.allow_continue_after_attempts !== false,
    // Quando capture está desativado (required_fields=[]), forçamos
    // released+completed pra que getLeadConversationStage retorne FREE_CHAT
    // desde o primeiro turno.
    released: Boolean(source.released) || captureDisabled,
    capture_completed: Boolean(source.capture_completed) || captureDisabled,
    capture_disabled: captureDisabled,
  };
};

const getMissingRequiredFields = (leadState) =>
  leadState.required_fields
    .filter((field) => field.required !== false)
    .map((field) => field.key)
    .filter((key) => !toSafeString(leadState.collected[key]));

const getNextField = (leadState, missingRequiredFields) => {
  if (leadState.released || leadState.capture_completed) return null;
  return missingRequiredFields[0] || null;
};

const buildLeadCaptureInstructions = (leadState, conversationStage) => {
  const fieldsList = leadState.required_fields
    .map((field) => {
      const required = field.required ? 'sim' : 'nao';
      const extra = field.prompt ? ` | dica: ${field.prompt}` : '';
      return `- key=${field.key} | label=${field.label} | tipo=${field.type} | obrigatorio=${required}${extra}`;
    })
    .join('\n');

  const missingRequiredFields = getMissingRequiredFields(leadState);
  const nextField = getNextField(leadState, missingRequiredFields);
  const collectedFieldsText = Object.keys(leadState.collected).length
    ? JSON.stringify(leadState.collected)
    : '{}';
  const attemptsText = JSON.stringify(leadState.attempts);

  // Texto dinâmico baseado em required_fields. Se o agente quer só nome+email
  // (telefone toggle off), a sequência reflete isso — não menciona telefone.
  const totalFields = leadState.required_fields.length;
  const fieldKeysUpper = leadState.required_fields.map((f) => f.key.toUpperCase());
  const fieldsLabelJoined = fieldKeysUpper.join(', ');
  const sequenceLines = leadState.required_fields
    .map((field, i) => `  ${i + 1}. Pergunta o ${field.label.toUpperCase()}.`)
    .join('\n');
  const releaseLine = `  ${totalFields + 1}. Apos receber o ultimo dado, libera o chat (free_chat) e ai sim ajuda com o tema.`;

  // Estágio dinâmico: descreve quais dados o agente já tem e o que falta agora.
  // Ex.: se o agente só capta nome+email, no estágio capture_email a reply
  // deve dizer "voce ja tem o nome", não "ja tem nome e telefone".
  const collectedKeysSoFar = leadState.required_fields
    .map((f) => f.key)
    .filter((k) => toSafeString(leadState.collected[k]));
  const collectedSummary = collectedKeysSoFar.length
    ? `Voce ja tem: ${collectedKeysSoFar.join(', ').toUpperCase()}.`
    : 'Voce ainda nao tem nenhum dado.';

  const nextFieldDef = leadState.required_fields.find((f) => f.key === nextField);
  const stageBehavior = nextFieldDef
    ? [
        `ESTAGIO ATUAL: ${conversationStage}.`,
        collectedSummary,
        `Sua reply deve ser APENAS um agradecimento curto (se ja houver dado coletado) + uma pergunta pedindo o ${nextFieldDef.label.toUpperCase()}. Nada mais.`,
      ].join(' ')
    : `ESTAGIO ATUAL: free_chat. Voce ja tem todos os dados necessarios (${fieldsLabelJoined}). Agora SIM pode ajudar com o tema. NUNCA pergunte dados pessoais novamente.`;

  const behavior = nextField
    ? `Neste turno, priorize capturar o campo "${nextField}". Se nao houver dado confiavel para esse campo, pergunte apenas por ele e evite entrar em respostas longas.`
    : 'Se os campos obrigatorios ja estiverem completos ou liberados, responda normalmente.';

  // captured_fields template — só lista os campos configurados.
  const capturedFieldsTemplate = leadState.required_fields
    .map((f) => `"${f.key}": ""`)
    .join(', ');

  // Exemplo dinâmico baseado nos campos. Se só nome → 2 turnos. Se nome+email → 3.
  const exampleTurns = [];
  exampleTurns.push(
    '  Turno 1 (sem o primeiro dado):',
    '    User: "oi, quanto custa o produto?"',
    `    Reply correta: "Olá! 👋 Para te ajudar, preciso primeiro do seu ${leadState.required_fields[0].label.toLowerCase()}. ${leadState.required_fields[0].key === 'nome' ? 'Como você se chama?' : `Pode me passar?`}"`,
    '    options: []',
  );
  if (totalFields >= 2) {
    exampleTurns.push(
      '  Turno 2 (recebeu o primeiro dado):',
      '    User: "Maria"',
      `    captured_fields: { "${leadState.required_fields[0].key}": "Maria" }`,
      `    Reply correta: "Obrigado, Maria! Agora me passa seu ${leadState.required_fields[1].label.toLowerCase()}?"`,
      '    options: []',
    );
  }
  if (totalFields >= 3) {
    exampleTurns.push(
      '  Turno 3 (recebeu o segundo dado):',
      `    User: "(11) 99999-9999"`,
      `    captured_fields: { "${leadState.required_fields[1].key}": "(11) 99999-9999" }`,
      `    Reply correta: "Perfeito! ✅ Por último, qual seu ${leadState.required_fields[2].label.toLowerCase()}?"`,
      '    options: []',
    );
  }
  exampleTurns.push(
    `  Turno ${totalFields + 1} (recebeu o último dado) — agora SIM ajuda com profundidade:`,
    `    captured_fields: { "${leadState.required_fields[totalFields - 1].key}": "..." }`,
    '    Reply correta: resposta substantiva sobre o tema (3-8 frases bem estruturadas, com exemplos/contexto). options: [] por padrão; só inclua 2-3 opções se realmente abrir caminhos não óbvios.',
  );

  return [
    'OBJETIVO DE CAPTURA DE LEADS — REGRA INEGOCIAVEL:',
    `Voce EXIGE ${totalFields} dado(s) antes de poder ajudar com qualquer coisa: ${fieldsLabelJoined}.`,
    'Esta regra vale para QUALQUER idioma e QUALQUER nicho de webchat. Sem excecao.',
    '',
    'SEQUENCIA OBRIGATORIA (rigida, nao mude a ordem):',
    sequenceLines,
    releaseLine,
    '',
    'COMPORTAMENTO RIGIDO ENQUANTO FALTAR DADO:',
    '- A reply DEVE ser CURTA: no maximo 1 frase de agradecimento + 1 frase pedindo o proximo dado.',
    '- NAO responda perguntas do usuario, NAO de explicacoes do tema, NAO de exemplos, NAO compare opcoes, NAO ensine nada.',
    '- Se o usuario tentar mudar de assunto ou perguntar algo do tema, retorne educadamente: "Antes de te ajudar com isso, preciso de [proximo dado]" — e peca o dado.',
    '- NUNCA peca 2 dados na mesma reply. UM por vez.',
    '- NUNCA pule a sequencia.',
    '- NUNCA repita pedido de dado ja coletado (verifique "Campos ja coletados" abaixo).',
    `- NUNCA peca dados que NAO estao na lista "Campos configurados" (ex: se o agente so capta NOME e E-MAIL, NAO peca telefone).`,
    `Se voce desviar dessa regra ou tentar ajudar antes dos ${totalFields} dado(s), voce esta errado.`,
    '',
    'EXEMPLOS DE COMPORTAMENTO CORRETO (independente do idioma do usuario):',
    ...exampleTurns,
    '',
    'EXEMPLOS DO QUE NAO FAZER (NUNCA):',
    '  ❌ Responder perguntas do tema antes de ter todos os dados configurados',
    '  ❌ Pedir 2 ou mais dados na mesma reply',
    '  ❌ Pedir um dado que NAO esta em "Campos configurados" abaixo',
    '  ❌ Repetir pedido de dado que ja esta em "Campos ja coletados"',
    '',
    'Campos configurados:',
    fieldsList,
    '',
    `Campos ja coletados: ${collectedFieldsText}`,
    `Tentativas por campo: ${attemptsText}`,
    `Campos obrigatorios faltantes: ${JSON.stringify(missingRequiredFields)}`,
    `Campo prioritario atual: ${nextField || 'nenhum'}`,
    `Tentativas maximas por campo: ${leadState.max_attempts}`,
    `Liberar conversa apos limite: ${leadState.allow_continue_after_attempts ? 'sim' : 'nao'}`,
    `Apos coletar TODOS os ${totalFields} dado(s) (${fieldsLabelJoined}), agradeca BREVE e SIGA AJUDANDO o lead aqui no chat: ofereca assuntos/duvidas relacionadas ao tema do agente para continuar a conversa. NAO diga que "alguem entrara em contato", NAO diga que "recebera material por e-mail", NAO direcione para canais externos. Voce (o especialista) continua atendendo o lead aqui mesmo. Apenas mantenha o limite de papel: voce ensina/esclarece, mas nao executa a operacao final em nome da instituicao.`,
    stageBehavior,
    behavior,
    '',
    'RETORNE SOMENTE JSON VALIDO COM ESTE FORMATO:',
    '{',
    '  "reply": "resposta NO IDIOMA EXATO da última mensagem do usuário (mesmo que estas instruções estejam em portugués)",',
    `  "captured_fields": { ${capturedFieldsTemplate} },`,
    '  "release_chat": false,',
    '  "options": []',
    '}',
    'Regras:',
    '- "captured_fields" deve incluir apenas campos capturados na mensagem atual.',
    '- Se nao capturou nenhum campo novo, use {}.',
    '- Use APENAS as keys listadas em "Campos configurados" — nao invente outras keys.',
    '- Nao use markdown fora do JSON.',
    '- O campo "reply" SEMPRE no idioma do usuário; nunca em portugués só porque estas instruções estão em portugués.',
    '',
    '🎯 CONTEÚDO DA "REPLY" — PRIORIDADE MÁXIMA: AGREGAR VALOR',
    '- Cada resposta deve EFETIVAMENTE ajudar o lead: responda a pergunta com profundidade, traga contexto, exemplos concretos, comparações, números. Não devolva 1 frase rasa só pra puxar opção.',
    '- Tamanho ideal: 3-8 frases bem estruturadas (ou parágrafos curtos), entregando informação útil de verdade. Pode usar listas curtas dentro do reply quando ajudar (ex: 3 pontos de comparação).',
    '- O lead deve sair de cada turno tendo APRENDIDO algo concreto, não só recebido um menu.',
    '',
    '🎯 CAMPO "options" — USE COM PARCIMÔNIA:',
    '- DEFAULT: "options" DEVE ser [] (lista vazia). A maioria dos turnos NÃO precisa de opções — uma resposta substantiva já basta.',
    '- USE OPÇÕES (2-3 itens) APENAS quando há ganho real de UX: o lead acabou de receber explicação de um conceito amplo e há 2-3 sub-direções claras pra aprofundar; o lead parece em dúvida sobre qual caminho seguir; ou você acabou de encerrar um sub-tópico e quer abrir 2-3 ângulos novos não óbvios.',
    '- NÃO USE OPÇÕES quando: (a) o lead fez uma pergunta direta — responda direto com substância, sem opções no fim; (b) você já mostrou opções nos turnos imediatamente anteriores (não vire menu repetitivo); (c) a conversa flui naturalmente e não há ramificação real; (d) está pedindo um dos "Campos configurados" — aí options OBRIGATORIAMENTE [].',
    '- Quando USAR opções: cada uma 3-7 palavras, 1 emoji sutil, ESPECÍFICAS ao tema (do prompt_mestre) — nunca genéricas tipo "Sim/Não/Saber mais". Máximo 3, mesmo idioma do usuário, sem repetição.',
    '- Regra prática: se você está em dúvida se cabe opção, NÃO coloque. É melhor um reply rico sem opções do que um reply raso com 3 opções.',
    '',
    '😀 EMOJIS:',
    '- TODA "reply" DEVE conter PELO MENOS 1 emoji (1-3 no total, distribuídos com bom gosto). Quando houver opções, cada opção também tem pelo menos 1.',
    '- Escolha emojis que casem com o tom: B2B/educativo → sutis (✅ 💡 📩 🧠 📊); B2C/varejo → mais empolgados (🔥 🚀 🎁 💸).',
    '- Não polua: emoji é tempero, não enchimento.',
  ].join('\n');
};

const buildSystemPrompt = (
  agent,
  leadState,
  avoidReintroduction = false,
  conversationStage = LEAD_STAGE.FREE_CHAT,
) => {
  const iaConfig = agent?.ia_config || {};
  const promptMestre = String(iaConfig.prompt_mestre || '').trim();
  const observacoes = String(iaConfig.observacoes || '').trim();

  const parts = [
    'Você é um assistente de webchat focado em ENGAJAR e CONVERTER o lead.',
    'Responda de forma útil, objetiva, natural e persuasiva.',
    'Não invente informações factuais quando não tiver contexto.',
    'Use o histórico da conversa para manter continuidade.',
    '',
    '🎓 PAPEL DO AGENTE — VOCÊ É O ESPECIALISTA NO TEMA:',
    '- Você É O especialista que conversa com o lead AQUI, no chat. É VOCÊ quem ajuda, ensina, tira dúvidas, explica conceitos, dá exemplos, compara opções, mostra caminhos. Não direcione para "outro especialista" ou "alguém entrará em contato" — VOCÊ é quem resolve no chat.',
    '- Sua prioridade é AGREGAR VALOR a cada resposta: explique com profundidade adequada, dê contexto, exemplos concretos, números/dados quando fizerem sentido, e guie o lead a uma compreensão real do tema. Respostas substantivas valem mais que muitos turnos curtos.',
    '- ENTREGUE PRIMEIRO, refine depois. Quando o lead pede algo concreto (receita, explicação, passo-a-passo, comparação), você entrega NO PRIMEIRO TURNO usando defaults razoáveis e menciona alternativas no fim. Nada de bombardear com perguntas antes de produzir conteúdo. Ver bloco "ENTREGUE VALOR JÁ NO PRIMEIRO TURNO" abaixo.',
    '- Use o "prompt_mestre" do agente (mais abaixo, em "Instruções do agente") como fonte primária: nicho, produto, persona, tom, ofertas, CTAs. As explicações e exemplos devem refletir EXATAMENTE esse contexto. A persona molda COMO você entrega — não vira desculpa pra postergar a entrega.',
    '',
    '🚫 LIMITE DO PAPEL — VOCÊ NÃO É A INSTITUIÇÃO:',
    '- Você NÃO é a instituição/marca/empresa/banco/loja/clínica/escritório/fintech/imobiliária/curso que entrega o produto ou serviço final. Você é o especialista que ESCLARECE e ORIENTA sobre o tema dentro do chat.',
    '- O lead NUNCA deve sair daqui achando que contratou/comprou/aprovou/agendou/matriculou algo só de ter conversado com você. Em qualquer nicho:',
    '  • Empréstimo/crédito: você ensina como funciona, compara modalidades, simula entendimento, tira dúvidas; NÃO aprova, NÃO libera, NÃO contrata.',
    '  • Imóveis: você ajuda a entender o mercado, características de imóveis, financiamento, documentação; NÃO vende, NÃO fecha negócio, NÃO reserva.',
    '  • Saúde/clínica: você esclarece sobre o tema/procedimento; NÃO diagnostica, NÃO prescreve, NÃO agenda em nome da clínica.',
    '  • Educação/curso: você explica grade, metodologia, carreira; NÃO matricula, NÃO emite contrato.',
    '  • Varejo/e-commerce: você ajuda a entender produtos, comparar, escolher; NÃO cobra, NÃO processa pedido.',
    '  • Jurídico/advocacia: você explica conceitos e termos jurídicos de forma educativa; NÃO presta consultoria jurídica formal NEM assume causa.',
    '  • Qualquer outro nicho: ensina, esclarece, mostra caminhos — NUNCA executa a operação final em nome da instituição.',
    '- Se o lead pedir para "contratar/comprar/aprovar/agendar oficialmente" com você, redirecione COM SUAVIDADE para continuar a conversa de aprendizado/dúvidas no chat (sem soar negativo) e ofereça novos assuntos relacionados.',
    '- Respeite a persona/voz do agente do "prompt_mestre", inclusive tons mais persuasivos — mas o limite acima permanece intacto.',
    '',
    '⚡ DIRETIVAS DE ENGAJAMENTO:',
    '- Toda "reply" DEVE ter pelo menos 1 emoji (sutil, não polui — 1 a 3 no máximo).',
    '- A "reply" deve ser SUBSTANTIVA e agregar valor: explique com profundidade, traga exemplos, contexto, números quando fizerem sentido. Evite respostas de 1-2 frases que apenas devolvem a pergunta com opções.',
    '- Quando o lead faz uma pergunta, RESPONDA a pergunta com profundidade primeiro. Só depois (se for útil) sugira um próximo passo.',
    '',
    '🚀 ENTREGUE VALOR JÁ NO PRIMEIRO TURNO — SEM INTERROGATÓRIO:',
    '- Quando o lead pede algo concreto (uma receita, uma explicação, um passo-a-passo, uma comparação, uma simulação, uma orientação), ENTREGUE NO PRIMEIRO TURNO. Não faça 2-3 perguntas de clareza antes do conteúdo — isso é interrogatório, não atendimento.',
    '- Use DEFAULTS RAZOÁVEIS no lugar de perguntas: assuma a versão mais clássica/popular/segura, entregue o conteúdo completo, e MENCIONE BREVEMENTE no fim que pode adaptar. Ex.: "Vou trazer a versão clássica X. Se preferir Y ou Z, é só me avisar que adapto." — em vez de perguntar antes de entregar.',
    '- LIMITE: no máximo 1 pergunta de clareza ANTES de entregar conteúdo, e SOMENTE se for impossível entregar algo útil sem essa info. "Pra quantas pessoas?", "qual sabor?", "qual modelo?" quase sempre podem ser substituídos por um default e uma menção rápida das alternativas.',
    '- Se já houve 1 pergunta de clareza no histórico, na próxima resposta VOCÊ ENTREGA O CONTEÚDO — não faça 2ª pergunta. O lead veio aprender, não responder enquete.',
    '',
    'PADRÃO RUIM (interrogatório — NUNCA faça): "Pudim?" → "tradicional ou air fryer?" → "Air fryer" → "pra quantas pessoas?" → "2" → "leite condensado, chocolate ou coco?" → 3 turnos sem valor entregue.',
    'PADRÃO BOM (entrega já no 1º turno): "Pudim?" → resposta única e completa: ingredientes + modo de preparo + dica do especialista + uma frase no fim "se preferir [variação A] ou [variação B], me avisa que adapto". Lead sai sabendo fazer.',
  ];

  const captureDisabled = leadState?.capture_disabled === true;

  if (!captureDisabled) {
    parts.push(
      '- Enquanto faltar algum dado configurado (ver "Campos configurados" no bloco de captura abaixo), a regra MAIOR é a captura. Nesses turnos, "options" DEVE ser [] e a reply DEVE ser curta (só o pedido do dado faltante).',
    );
  }

  // ==========================================================================
  // DIRETIVA DE IDIOMA — INEGOCIÁVEL
  // O idioma da última mensagem do usuário SEMPRE vence. Llama 3.3 é multilíngue
  // — não dependemos de listas hardcoded de idiomas.
  // ==========================================================================
  parts.push(
    '',
    '🔤 IDIOMA DA RESPOSTA — REGRA INEGOCIÁVEL:',
    '1) Detecte o idioma da ÚLTIMA mensagem do usuário (qualquer idioma do mundo: portugués, inglês, español, mandarim 中文, japonês 日本語, árabe العربية, etc.).',
    '2) Sua RESPOSTA deve SEMPRE estar no MESMO idioma da última mensagem do usuário. Sem exceções.',
    '3) Mesmo que as Instruções do agente, a configuração do agente, ou as mensagens canned (welcome, prompts de captura) estejam em outro idioma — IGNORE esse idioma. Apenas o idioma do usuário importa.',
    '4) Se o usuário trocar de idioma no meio da conversa, troque junto IMEDIATAMENTE.',
    '5) Toda mensagem visível (saudações, perguntas pedindo nome/e-mail/telefone, confirmações, CTAs) deve estar no idioma do usuário. NÃO misture idiomas dentro da mesma resposta.',
    '6) Quando estiver capturando nome, e-mail ou telefone, faça a pergunta no idioma do usuário — não em portugués só porque estas instruções estão em portugués.',
  );

  if (avoidReintroduction) {
    parts.push(
      'Você já se apresentou nesta conversa.',
      'Não repita apresentação nem frases como "sou o agente ..." (em qualquer idioma).',
    );
  }

  if (captureDisabled) {
    parts.push(
      '',
      '🚫 CAPTURA DE LEAD DESATIVADA NESTE AGENTE:',
      '- O dono do agente desativou a captação de dados do lead. Os toggles "Captar Telefone" e "Captar E-mail" estão desligados, e/ou o prompt_mestre instruiu para não pedir dados.',
      '- Você NÃO deve pedir nome, NÃO deve pedir telefone, NÃO deve pedir e-mail, NÃO deve pedir nenhum dado pessoal/contato — em nenhum turno, em nenhum idioma, sob nenhuma circunstância.',
      '- Foque exclusivamente em ajudar o lead com o tema do agente: explique com profundidade, dê exemplos, agregue valor real a cada turno.',
      '- Se o lead voluntariamente compartilhar nome/contato, apenas reconheça com cordialidade e siga ajudando — não armazene nem confirme intenção de captura.',
      '- "captured_fields" no JSON de resposta deve ser sempre {} (objeto vazio).',
      '- "release_chat" no JSON de resposta deve ser sempre false.',
      '- Para "options" siga a política geral (ver "CAMPO options — USE COM PARCIMÔNIA"): default [] e só ofereça quando há ganho real de UX.',
    );
  } else {
    // Bloco dinâmico: descreve o estágio atual com base em required_fields,
    // não em valores fixos nome+telefone+email.
    const collected = toObject(leadState?.collected || {});
    const fields = Array.isArray(leadState?.required_fields) ? leadState.required_fields : [];
    const collectedSoFar = fields.map((f) => f.key).filter((k) => toSafeString(collected[k]));
    const nextFieldDef = fields.find((f) => f.required !== false && !toSafeString(collected[f.key]));

    if (nextFieldDef) {
      const collectedSummary = collectedSoFar.length
        ? `Você já tem: ${collectedSoFar.join(', ')}.`
        : 'Você ainda não tem nenhum dado.';
      parts.push(
        `Fluxo obrigatório atual: capturar ${nextFieldDef.label.toUpperCase()} (key=${nextFieldDef.key}).`,
        collectedSummary,
        `Sua reply DEVE ser apenas 1 saudação/agradecimento curto + pergunta pelo ${nextFieldDef.label.toLowerCase()}, NO IDIOMA DO USUÁRIO. NÃO responda perguntas do usuário, NÃO explique nada do tema, NÃO peça outros dados na mesma reply.`,
      );
    } else {
      const fieldsLabelLower = fields.map((f) => f.label.toLowerCase()).join(', ');
      parts.push(
        `Fluxo atual: conversa livre. Você já capturou todos os dados configurados (${fieldsLabelLower}).`,
        'AGORA SIM você pode ajudar com o tema. NUNCA mais pergunte dados pessoais. Não volte para apresentação. Foque em entregar respostas substantivas que agreguem valor real ao lead — não força menu de opções a cada turno.',
      );
    }
  }

  if (promptMestre) {
    parts.push(
      '',
      'Instruções do agente (somente como CONTEXTO/PERSONA — o idioma da resposta segue o usuário, não estas instruções):',
      promptMestre
    );
  }

  if (observacoes) {
    parts.push('', `Observações adicionais: ${observacoes}`);
  }

  // Bloco grande de captura (com lista de campos, exemplos, sequência rígida)
  // só faz sentido quando captura está ativa. Quando o agente opta por não
  // pedir dados, esse bloco fica fora do system prompt.
  if (leadState && !captureDisabled) {
    parts.push('', buildLeadCaptureInstructions(leadState, conversationStage));
  }

  return parts.join('\n');
};

// Sanitiza caracteres que quebram JSON.parse OU corrompem rendering downstream:
// - Zero-width chars (U+200B-U+200D, U+FEFF)
// - Caracteres de controle ASCII inv\u00E1lidos em strings JSON (U+0000-U+001F
//   exceto \t, \n, \r) \u2014 modelos pequenos como llama3.1-8b ocasionalmente
//   geram esses bytes mid-string em respostas multil\u00EDngues, levando a
//   "Invalid control character at line 1 column N" no parse.
// - Replacement chars (U+FFFD) que aparecem quando o tokenizer corrompe
//   sequ\u00EAncias UTF-8 multibyte (caracteres acentuados, emojis).
const sanitizeForJsonParse = (text) => {
  let s = String(text || '');
  // Zero-width chars
  s = s.replace(new RegExp('[\u200B-\u200D\uFEFF]', 'g'), '');
  // Controle ASCII invalido em string JSON (preserva \t \n \r)
  s = s.replace(new RegExp('[\u0000-\u0008\u000B\u000C\u000E-\u001F]', 'g'), '');
  // Replacement char (UTF-8 corrompido)
  s = s.replace(new RegExp('\uFFFD', 'g'), '');
  return s;
};

// Sanitiza texto final exibido ao usuario (reply, options).
const sanitizeUserFacingText = (text) => {
  let s = String(text || '');
  s = s.replace(new RegExp('[\u0000-\u0008\u000B\u000C\u000E-\u001F]', 'g'), '');
  s = s.replace(new RegExp('\uFFFD', 'g'), '');
  return s;
}

// Remove markdown code fences ao redor de JSON. Gemini, vários modelos do
// OpenRouter (GPT-OSS, GLM-Air etc) e outros LLMs ocasionalmente embrulham
// a resposta em ```json ... ``` ou ``` ... ```.
const stripMarkdownCodeFences = (text) => {
  let s = String(text || '').trim();
  // Remove ```json\n...\n``` ou ```\n...\n``` (com newlines opcionais)
  const fenceMatch = s.match(/^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fenceMatch) return fenceMatch[1].trim();
  // Remove só o opening fence se tiver (caso truncado)
  s = s.replace(/^```(?:json|JSON)?\s*\n?/, '');
  s = s.replace(/\n?```\s*$/, '');
  return s.trim();
};

const parseJsonResponse = (rawValue) => {
  const text = sanitizeForJsonParse(toSafeString(rawValue));
  if (!text) return {};

  // Tenta o texto bruto e também sem markdown fences (ordem: bruto, sem fence,
  // substring entre {...}). Cobre o caso onde o modelo respondeu já em JSON
  // limpo ou embrulhou em ```json ... ```.
  const candidates = [text];
  const stripped = stripMarkdownCodeFences(text);
  if (stripped !== text) candidates.push(stripped);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch { /* tenta próximo */ }
  }

  // Fallback: pega substring entre { e } (resposta com texto solto antes/depois).
  const lastCandidate = candidates[candidates.length - 1];
  const start = lastCandidate.indexOf('{');
  const end = lastCandidate.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(lastCandidate.slice(start, end + 1));
    } catch {
      return {};
    }
  }

  return {};
};

const extractEmailFallback = (message) => {
  const match = toSafeString(message).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? toSafeString(match[0]).toLowerCase() : '';
};

const normalizeCapturedFields = (rawCapturedFields, leadState, message) => {
  const source = toObject(rawCapturedFields);
  const allowedKeys = new Set(leadState.required_fields.map((field) => field.key));
  const capturedFields = {};

  Object.entries(source).forEach(([rawKey, value]) => {
    const key = normalizeFieldKey(rawKey);
    if (!key || !allowedKeys.has(key)) return;
    const normalized = normalizeLeadValue(key, value);
    if (normalized) capturedFields[key] = normalized;
  });

  if (!capturedFields.email && allowedKeys.has('email')) {
    const fallbackEmail = normalizeLeadValue('email', extractEmailFallback(message));
    if (fallbackEmail) capturedFields.email = fallbackEmail;
  }

  return capturedFields;
};

const mergeLeadCaptureState = (leadState, capturedFields, releaseChat) => {
  const mergedCollected = {
    ...leadState.collected,
    ...capturedFields,
  };
  const missingBefore = getMissingRequiredFields(leadState);
  const nextBefore = missingBefore[0] || null;
  const attempts = {
    ...leadState.attempts,
  };

  if (nextBefore && !capturedFields[nextBefore]) {
    attempts[nextBefore] = (attempts[nextBefore] || 0) + 1;
  }

  const nextStateDraft = {
    ...leadState,
    collected: mergedCollected,
    attempts,
  };
  const missingAfter = getMissingRequiredFields(nextStateDraft);
  const blockingMissing = missingAfter.filter((fieldKey) => {
    if (!leadState.allow_continue_after_attempts) return true;
    const count = Number(attempts[fieldKey] || 0);
    return count < leadState.max_attempts;
  });
  const skippedRequiredFields = missingAfter.filter((fieldKey) => {
    if (!leadState.allow_continue_after_attempts) return false;
    const count = Number(attempts[fieldKey] || 0);
    return count >= leadState.max_attempts;
  });
  const captureCompleted = missingAfter.length === 0;
  const released =
    Boolean(leadState.released) ||
    Boolean(releaseChat) ||
    (leadState.allow_continue_after_attempts && blockingMissing.length === 0);
  const nextField = released ? null : blockingMissing[0] || null;

  return {
    ...nextStateDraft,
    released,
    capture_completed: captureCompleted,
    missing_required_fields: missingAfter,
    blocking_missing_fields: blockingMissing,
    skipped_required_fields: skippedRequiredFields,
    next_field: nextField,
    captured_fields: capturedFields,
    should_prompt_for_capture: Boolean(nextField),
  };
};

export const generateWebchatReply = async ({
  message,
  agent,
  lead_state,
  conversation_history,
  completionProvider,
  // Novo formato (multi-provider): { groq: [...], cerebras: [...], gemini: [...], ... }
  providerKeys,
  // Legado (manter por backward-compat): array só de Groq
  apiKeys,
}) => {
  // Resolve providerKeys: aceita formato novo ou converte legado pra ele.
  const normalizedProviderKeys = providerKeys && typeof providerKeys === 'object'
    ? providerKeys
    : Array.isArray(apiKeys) && apiKeys.length > 0
      ? { groq: apiKeys }
      : null;

  if (!completionProvider && (!normalizedProviderKeys || Object.values(normalizedProviderKeys).every((arr) => !Array.isArray(arr) || arr.length === 0))) {
    throw new Error('ERRO CRÍTICO: nenhuma chave de IA recebida pelo backend.');
  }

  if (!message || !String(message).trim()) {
    throw new Error('O campo "message" é obrigatório.');
  }

  const iaConfig = agent?.ia_config || {};
  const temperature = normalizeNumber(iaConfig.temperatura, 0.7);
  // Default 3000 (era 800): a nova diretriz do prompt manda entregar respostas
  // substantivas (receita completa, explicação com profundidade) já no 1º turno.
  // Token a mais é barato; 502 com popup vermelho pro lead é caro. Trade
  // assumido pelo dono do produto: melhor gastar do que falhar.
  const baseMaxTokens = Math.max(64, normalizeNumber(iaConfig.max_tokens, 3000));
  const leadState = normalizeLeadState(lead_state, agent);
  const conversationStage = getLeadConversationStage(leadState);
  // Em capture stage, a reply É naturalmente curta (1-2 frases pedindo o dado),
  // mas damos folga (500) pra evitar truncamento se o modelo decorar com persona.
  const isCaptureStage = conversationStage !== LEAD_STAGE.FREE_CHAT;
  const maxTokens = isCaptureStage ? Math.min(baseMaxTokens, 500) : baseMaxTokens;
  const historyMessages = normalizeConversationHistory(conversation_history, message);
  const avoidReintroduction = shouldAvoidReintroduction(
    historyMessages,
    leadState,
  );
  const systemPrompt = buildSystemPrompt(
    agent,
    leadState,
    avoidReintroduction,
    conversationStage,
  );

  // Payload neutro — o adapter do provider escolhido decide o nome do modelo.
  const completionPayload = {
    messages: [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: String(message) },
    ],
    temperature,
    maxTokens,
  };

  let chatCompletion = null;
  let usedProvider = null;
  let usedModel = null;
  let degraded = false;

  // Wrapper que executa a chamada à IA com payload custom (usado pra retry com
  // max_tokens maior se reply for truncada). Retorna { chatCompletion, provider,
  // model, degraded }.
  const runCompletion = async (effectivePayload) => {
    if (completionProvider) {
      const data = await completionProvider({
        messages: effectivePayload.messages,
        temperature: effectivePayload.temperature,
        max_tokens: effectivePayload.maxTokens,
        response_format: { type: 'json_object' },
        model: iaConfig.modelo || DEFAULT_MODEL,
      });
      return {
        chatCompletion: data,
        provider: 'mock',
        model: iaConfig.modelo || DEFAULT_MODEL,
        degraded: false,
      };
    }
    const { callAi } = await import('./ai-router.js');
    const routed = await callAi({
      providerKeys: normalizedProviderKeys,
      payload: effectivePayload,
    });
    return {
      chatCompletion: routed.data,
      provider: routed.provider,
      model: routed.model,
      degraded: Boolean(routed.degraded),
    };
  };

  // Tenta extrair reply válido. Se vazio, faz UM retry com max_tokens maior
  // (cobre o caso de finish_reason='length' truncando JSON antes do reply).
  // Se mesmo assim falhar, retorna fallback gracioso ao invés de 502 — o lead
  // recebe uma mensagem cordial em vez de erro técnico.
  const extractReply = (completion) => {
    const content = completion?.choices?.[0]?.message?.content || '';
    const finishReason = completion?.choices?.[0]?.finish_reason || '';
    const parsed = parseJsonResponse(content);
    const replyRaw = sanitizeUserFacingText(
      toSafeString(parsed.reply || parsed.resposta || parsed.message),
    );
    return { content, finishReason, parsed, replyRaw };
  };

  let firstRun = await runCompletion(completionPayload);
  chatCompletion = firstRun.chatCompletion;
  usedProvider = firstRun.provider;
  usedModel = firstRun.model;
  degraded = firstRun.degraded;

  let { content: rawContent, finishReason, parsed: payload, replyRaw } =
    extractReply(chatCompletion);
  let reply = avoidReintroduction ? stripRepeatedIntroduction(replyRaw) : replyRaw;

  // Retry escalonado quando reply vem vazio. Duas tentativas, cada uma mais
  // agressiva, pra maximizar a chance de obter resposta substantiva.
  // Estratégia: token nunca é o gargalo — gastamos mais tokens em vez de
  // falhar. Só joga 502 se TODAS as tentativas (incluindo as de outros
  // providers via ai-router) falharem.
  const buildRetryPayload = (prevPayload, prevFinish, prevContent, attempt) => {
    // attempt 1: dobra max_tokens; mantém prompt original.
    // attempt 2: triplica max_tokens; adiciona nudge final reforçando "reply".
    const expanded = attempt === 1
      ? Math.min(2 * (prevPayload.maxTokens || 1500), 6000)
      : Math.min(3 * (completionPayload.maxTokens || 1500), 8000);
    const truncated = prevFinish === 'length';
    const messages = truncated && attempt === 1
      ? prevPayload.messages
      : [
          ...prevPayload.messages,
          {
            role: 'system',
            content:
              attempt === 1
                ? 'IMPORTANTE: responda AGORA com JSON válido e o campo "reply" preenchido com o texto pro lead.'
                : 'CRÍTICO: as tentativas anteriores não tiveram o campo "reply" preenchido. Sua resposta DEVE ser um JSON COMPLETO e VÁLIDO no formato { "reply": "<texto substantivo pro lead aqui>", "captured_fields": {}, "release_chat": false, "options": [] }. SEM markdown, SEM texto fora do JSON. Foque em entregar valor real ao lead com a "reply".',
          },
        ];
    return { ...prevPayload, messages, maxTokens: expanded };
  };

  if (!reply) {
    let attempt = 1;
    let lastPayload = completionPayload;
    while (!reply && attempt <= 2) {
      const retryPayload = buildRetryPayload(lastPayload, finishReason, rawContent, attempt);
      console.warn(
        `[ia-webchat] reply vazio (attempt=${attempt} provider=${usedProvider} model=${usedModel} finish=${finishReason} content_len=${rawContent.length}). Retentando com max_tokens=${retryPayload.maxTokens}.`,
      );
      try {
        const retryRun = await runCompletion(retryPayload);
        chatCompletion = retryRun.chatCompletion;
        usedProvider = retryRun.provider;
        usedModel = retryRun.model;
        degraded = retryRun.degraded || degraded;
        const retryExtract = extractReply(chatCompletion);
        payload = retryExtract.parsed;
        finishReason = retryExtract.finishReason;
        rawContent = retryExtract.content;
        reply = avoidReintroduction
          ? stripRepeatedIntroduction(retryExtract.replyRaw)
          : retryExtract.replyRaw;
        lastPayload = retryPayload;
      } catch (retryErr) {
        console.warn(`[ia-webchat] retry ${attempt} lançou: ${retryErr?.message || retryErr}`);
      }
      attempt++;
    }
  }

  if (!reply) {
    // Todas as tentativas falharam (incluindo ai-router cycling entre
    // providers). Logamos diagnóstico completo e propagamos 502 honesto.
    // Sem fallback cringe — melhor um erro real do que mensagem fake.
    console.error(
      `[ia-webchat] FATAL: reply vazio após 3 tentativas. provider=${usedProvider} model=${usedModel} finish=${finishReason} content_snippet=${JSON.stringify(rawContent.slice(0, 400))}`,
    );
    throw new Error('A IA não retornou uma resposta válida.');
  }

  const capturedFields = normalizeCapturedFields(payload.captured_fields, leadState, message);

  const nextLeadState = mergeLeadCaptureState(
    leadState,
    capturedFields,
    payload.release_chat === true,
  );
  nextLeadState.conversation_stage = getLeadConversationStage(nextLeadState);

  // "options": opções de resposta rápida sugeridas pela IA. Front renderiza
  // como quick replies no bubble do bot. Máx 3, cada uma curta.
  // Guardrail: se ainda estamos pedindo nome/e-mail/telefone do lead, NUNCA
  // mandamos quick replies — o lead precisa digitar o dado livremente.
  const LEAD_CAPTURE_FIELD_KEYS = new Set(['nome', 'email', 'telefone']);
  const isAskingLeadIdentityField =
    !nextLeadState.released &&
    !nextLeadState.capture_completed &&
    LEAD_CAPTURE_FIELD_KEYS.has(toSafeString(nextLeadState.next_field));
  // Normalizador defensivo de options: alguns modelos (ex: Gemini, Mistral
  // ocasionalmente) retornam options como objeto em vez de string, tipo
  // [{"label":"X","emoji":"🚀"}] ou {"text":"Y"}. Pegamos o melhor campo
  // textual disponível ou fallback pra string vazia.
  const extractOptionText = (opt) => {
    if (typeof opt === 'string') return opt;
    if (opt && typeof opt === 'object') {
      const candidate =
        opt.label ?? opt.text ?? opt.title ?? opt.value ?? opt.content ?? opt.option ?? opt.name;
      if (typeof candidate === 'string') return candidate;
    }
    return '';
  };
  const rawOptions = Array.isArray(payload.options) ? payload.options : [];
  const options = isAskingLeadIdentityField
    ? []
    : rawOptions
        .map((opt) => sanitizeUserFacingText(toSafeString(extractOptionText(opt))))
        .filter((opt) => opt.length > 0)
        .slice(0, 3);

  return {
    reply,
    model: usedModel,
    provider: usedProvider,
    degraded,
    usage: chatCompletion.usage || null,
    lead_capture: nextLeadState,
    options,
  };
};