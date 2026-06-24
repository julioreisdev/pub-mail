import { generateWebchatReply } from '../services/webchat.service.js';

const ALLOWED_PROVIDERS = new Set([
  'groq',
  'cerebras',
  'gemini',
  'mistral',
  'openrouter',
  'sambanova',
]);

const normalizeKeysList = (raw) => {
  if (Array.isArray(raw)) {
    return raw.map((k) => String(k || '').trim()).filter((k) => k.length > 0);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,\n]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }
  return [];
};

// Aceita o formato novo (provider_keys: { groq: [...], cerebras: [...], ... })
// ou o legado (groq_api_keys: [...]) e converte para o formato unificado.
const resolveProviderKeys = (body) => {
  if (body?.provider_keys && typeof body.provider_keys === 'object' && !Array.isArray(body.provider_keys)) {
    const out = {};
    for (const [provider, value] of Object.entries(body.provider_keys)) {
      if (!ALLOWED_PROVIDERS.has(provider)) continue;
      const list = normalizeKeysList(value);
      if (list.length > 0) out[provider] = list;
    }
    return out;
  }
  // Legado: só Groq
  if (body?.groq_api_keys !== undefined) {
    const list = normalizeKeysList(body.groq_api_keys);
    if (list.length > 0) return { groq: list };
  }
  return null;
};

export const createWebchatReply = async (req, res) => {
  try {
    const { message, agent, lead_state, conversation_history } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'O campo "message" é obrigatório no corpo da requisição.',
      });
    }

    if (!agent || typeof agent !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'O campo "agent" é obrigatório e deve ser um objeto.',
      });
    }

    const providerKeys = resolveProviderKeys(req.body);
    const totalKeys = providerKeys
      ? Object.values(providerKeys).reduce((sum, arr) => sum + arr.length, 0)
      : 0;

    if (totalKeys === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhuma chave de IA foi enviada. Configure pelo menos um provedor em Conta & Domínios > Integrações.',
      });
    }

    const data = await generateWebchatReply({
      message,
      agent,
      lead_state,
      conversation_history,
      providerKeys,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[ia-webchat][error]', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Erro interno no servidor.',
    });
  }
};
