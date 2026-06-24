import { getKeysSnapshot } from '../services/ai-router.js';
import { adapters } from '../providers/index.js';
import { keyStateStore } from '../services/key-state-store.js';

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

const resolveProviderKeys = (body) => {
  const out = {
    groq: [], cerebras: [], gemini: [], mistral: [], openrouter: [], sambanova: [],
  };
  if (body?.provider_keys && typeof body.provider_keys === 'object' && !Array.isArray(body.provider_keys)) {
    for (const [provider, value] of Object.entries(body.provider_keys)) {
      if (!ALLOWED_PROVIDERS.has(provider)) continue;
      out[provider] = normalizeKeysList(value);
    }
  }
  return out;
};

const buildKeyInfoMap = (providerKeys) => {
  const map = {};
  for (const [provider, list] of Object.entries(providerKeys)) {
    map[provider] = list.map((apiKey) => ({
      api_key: apiKey,
      length: apiKey.length,
    }));
  }
  return map;
};

// Capacidade total estimada de UMA chave de um provider (em mensagens/dia).
// Combina RPD e TPD/tokens-por-msg, retornando o mais restritivo.
function totalCapacityForKey(adapter) {
  const quota = adapter.freeQuota || {};
  const tokensPerReq = Math.max(1, Number(quota.estimatedTokensPerRequest) || 4000);
  let cap = Infinity;
  if (Number.isFinite(quota.reqsPerDay) && quota.reqsPerDay > 0) {
    cap = Math.min(cap, quota.reqsPerDay);
  }
  if (Number.isFinite(quota.tokensPerDay) && quota.tokensPerDay > 0) {
    cap = Math.min(cap, Math.floor(quota.tokensPerDay / tokensPerReq));
  }
  return Number.isFinite(cap) ? cap : null;
}

export const getKeysStatus = async (req, res) => {
  try {
    const providerKeys = resolveProviderKeys(req.body);
    const totalKeys = Object.values(providerKeys).reduce((sum, arr) => sum + arr.length, 0);

    if (totalKeys === 0) {
      const global = await keyStateStore.getGlobalCounter();
      return res.status(200).json({
        success: true,
        data: {
          providers: [],
          totals: {
            keys: 0,
            healthy: 0,
            rate_limited: 0,
            daily_exhausted: 0,
            invalid: 0,
            // Mensagens trocadas (agregado global, não por chave)
            reqs_used_today: global.total_uses_today,
            reqs_capacity_today: 0,
            reqs_remaining_today: 0,
            tokens_used_today: global.tokens_used_today,
          },
        },
      });
    }

    const snapshot = await getKeysSnapshot(providerKeys);
    const infoMap = buildKeyInfoMap(providerKeys);
    const global = await keyStateStore.getGlobalCounter();

    const providersOut = [];
    const totals = {
      keys: 0,
      healthy: 0,
      rate_limited: 0,
      daily_exhausted: 0,
      invalid: 0,
      reqs_used_today: Number(global.total_uses_today) || 0,
      reqs_remaining_today: 0,
      reqs_capacity_today: 0,
      tokens_used_today: Number(global.tokens_used_today) || 0,
    };

    for (const [providerName, adapter] of Object.entries(adapters)) {
      const list = snapshot[providerName] || [];
      const infos = infoMap[providerName] || [];
      const capacityPerKey = totalCapacityForKey(adapter); // null se indefinido

      // Estado por chave: SEM contadores individuais. Apenas status/cooldown/erro.
      const keys = list.map((entry, idx) => ({
        id: entry.id,
        api_key: infos[idx]?.api_key || '',
        length: infos[idx]?.length || 0,
        status: entry.status,
        cooldown_until: entry.cooldown_until || 0,
        daily_reset_at: entry.daily_reset_at || 0,
        last_error: entry.last_error || '',
        last_used_at: entry.last_used_at || 0,
      }));

      // Conta status por categoria pra tabela de totais.
      let providerHealthy = 0;
      keys.forEach((k) => {
        totals.keys += 1;
        if (k.status === 'healthy') {
          totals.healthy += 1;
          providerHealthy += 1;
        } else if (k.status === 'rate_limited') totals.rate_limited += 1;
        else if (k.status === 'daily_exhausted') totals.daily_exhausted += 1;
        else if (k.status === 'invalid') totals.invalid += 1;
      });

      // Capacidade DESTE provider: (chaves não-inválidas e não-esgotadas) × cap_per_key.
      // Considera chaves saudáveis E em rate_limit (cooldown curto, vão voltar).
      // Esgotadas e inválidas contam 0 — não vão render mensagens hoje.
      const usableKeys = keys.filter(
        (k) => k.status === 'healthy' || k.status === 'rate_limited',
      ).length;
      const providerCapacity = capacityPerKey != null ? usableKeys * capacityPerKey : 0;

      totals.reqs_capacity_today += providerCapacity;

      providersOut.push({
        provider: providerName,
        priority: adapter.priority,
        default_model: adapter.defaultModel,
        fallback_model: adapter.fallbackModel || null,
        base_url: adapter.baseUrl,
        free_quota: {
          reqs_per_day: adapter.freeQuota?.reqsPerDay ?? null,
          tokens_per_day: adapter.freeQuota?.tokensPerDay ?? null,
          estimated_tokens_per_request:
            adapter.freeQuota?.estimatedTokensPerRequest ?? null,
        },
        capacity_per_key: capacityPerKey, // null se não der pra estimar
        provider_totals: {
          // Total usado / restante NÃO é por provider neste schema simplificado:
          // o uso é agregado globalmente. Mantemos só capacidade pra breakdown UI.
          reqs_capacity_today: providerCapacity,
          healthy_keys: providerHealthy,
        },
        keys,
      });
    }

    // Restantes = capacidade total - usados hoje (clampado em 0).
    totals.reqs_remaining_today = Math.max(
      0,
      totals.reqs_capacity_today - totals.reqs_used_today,
    );

    providersOut.sort((a, b) => a.priority - b.priority);

    return res.status(200).json({
      success: true,
      data: {
        providers: providersOut,
        totals,
        server_time: Date.now(),
      },
    });
  } catch (error) {
    console.error('[ia-keys-status][error]', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Erro interno no servidor.',
    });
  }
};
