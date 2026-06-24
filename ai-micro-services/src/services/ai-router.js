// AI Router — orquestra a chamada à IA passando por múltiplos providers e
// múltiplas chaves por provider, com rotação inteligente baseada no estado
// persistido em Redis.
//
// Regras:
//   1. Coleta todas as (provider, key) recebidas e seu estado atual
//   2. Filtra: ignora chaves rate_limited (em cooldown ainda) ou daily_exhausted
//   3. Ordena: provider.priority ASC, depois total_uses_today ASC (round-robin)
//   4. Tenta a primeira; se erro, marca estado e tenta a próxima
//   5. Se todas falharem no modelo padrão, tenta degrade pro fallbackModel da
//      Groq (Llama 3.1 8B = 14k req/dia/conta) como última cartada.
//
// Importante: o prompt enviado é IDÊNTICO em todos os providers — quem monta
// o `messages` é o webchat.service.js. Aqui só fazemos o transporte.

import { adapters, getAdapter } from '../providers/index.js';
import { keyStateStore, keyId } from './key-state-store.js';

// Lista de provider keys vinda do back: { groq: [...], cerebras: [...], ... }
function flattenProviderKeys(providerKeysObject) {
  const out = [];
  if (!providerKeysObject || typeof providerKeysObject !== 'object') return out;
  for (const [providerName, keysList] of Object.entries(providerKeysObject)) {
    if (!getAdapter(providerName)) continue;
    if (!Array.isArray(keysList)) continue;
    for (const k of keysList) {
      const trimmed = String(k || '').trim();
      if (!trimmed) continue;
      out.push({
        provider: providerName,
        apiKey: trimmed,
        id: keyId(providerName, trimmed),
      });
    }
  }
  return out;
}

// Ordena candidatos por provider priority (ASC) e, dentro do mesmo provider,
// por last_used_at ASC (a chave que foi usada há mais tempo entra primeiro
// → round-robin natural). Inválidas, esgotadas e em cooldown saem.
async function selectCandidates(allCandidates) {
  const ids = allCandidates.map((c) => c.id);
  const states = await keyStateStore.getStates(ids);

  const enriched = allCandidates
    .map((c) => ({ ...c, state: states[c.id] }))
    .filter((c) => c.state.status === 'healthy');

  return enriched.sort((a, b) => {
    const pa = adapters[a.provider].priority;
    const pb = adapters[b.provider].priority;
    if (pa !== pb) return pa - pb;
    return (a.state.last_used_at || 0) - (b.state.last_used_at || 0);
  });
}

// Registra o resultado de uma tentativa no Redis.
async function recordOutcome(candidate, result) {
  if (result.ok) {
    const tokens = result.data?.usage?.total_tokens || 0;
    await keyStateStore.markUsed(candidate.id, tokens);
    return;
  }
  const errMsg = result.error || `${candidate.provider} error`;
  switch (result.errorKind) {
    case 'rate_limit':
      await keyStateStore.markRateLimited(candidate.id, result.retryAfterSec || 60, errMsg);
      break;
    case 'daily_exhausted':
      await keyStateStore.markDailyExhausted(candidate.id, errMsg);
      break;
    case 'invalid_key':
      await keyStateStore.markInvalid(candidate.id, errMsg);
      break;
    default:
      await keyStateStore.markTransient(candidate.id, errMsg);
  }
}

/**
 * Faz a chamada à IA tentando sequencialmente as chaves saudáveis.
 *
 * @param {object} args
 * @param {object} args.providerKeys - { groq: [...], cerebras: [...], ... }
 * @param {object} args.payload - { messages, temperature, maxTokens }
 * @param {boolean} [args.allowDegrade=true] - Se true, tenta fallback Groq 8B se todos falharem
 * @returns {Promise<{ provider, model, data, raw }>}
 * @throws {Error} se nenhuma chave funcionar
 */
export async function callAi({ providerKeys, payload, allowDegrade = true }) {
  const allCandidates = flattenProviderKeys(providerKeys);
  if (allCandidates.length === 0) {
    throw new Error('Nenhuma chave de provider configurada.');
  }

  const candidates = await selectCandidates(allCandidates);
  if (candidates.length === 0) {
    // Todas em cooldown / esgotadas — tenta a primeira mesmo assim
    // (o estado pode ter sido injustamente marcado; uma tentativa não vai matar)
    candidates.push(allCandidates[0]);
  }

  const errors = [];
  for (const candidate of candidates) {
    const adapter = getAdapter(candidate.provider);
    if (!adapter) continue;

    try {
      const result = await adapter.chat({
        apiKey: candidate.apiKey,
        payload,
      });
      await recordOutcome(candidate, result);
      if (result.ok) {
        return {
          provider: candidate.provider,
          model: adapter.defaultModel,
          data: result.data,
          raw: result.raw,
        };
      }
      errors.push(`${candidate.provider}/${candidate.id}: ${result.errorKind} — ${result.error}`);
      // Se for fatal (payload bug, model não existe), não vale tentar outras keys do MESMO provider
      // mas de outro provider sim. Continua o loop.
      if (result.errorKind === 'fatal') {
        // skip outras keys do mesmo provider (apenas as desse)
        continue;
      }
    } catch (err) {
      const msg = err?.message || String(err);
      errors.push(`${candidate.provider}/${candidate.id}: throw — ${msg}`);
      await keyStateStore.markTransient(candidate.id, msg);
    }
  }

  // Última cartada: degrade para Groq 8B (14k req/dia/conta) se houver chaves Groq
  if (allowDegrade) {
    const groqKeys = allCandidates.filter((c) => c.provider === 'groq');
    if (groqKeys.length > 0) {
      const groqAdapter = getAdapter('groq');
      for (const candidate of groqKeys) {
        try {
          const result = await groqAdapter.chat({
            apiKey: candidate.apiKey,
            payload,
            modelOverride: groqAdapter.fallbackModel,
          });
          await recordOutcome(candidate, result);
          if (result.ok) {
            // eslint-disable-next-line no-console
            console.warn(`[ai-router] DEGRADED to ${groqAdapter.fallbackModel} via groq`);
            return {
              provider: 'groq',
              model: groqAdapter.fallbackModel,
              data: result.data,
              raw: result.raw,
              degraded: true,
            };
          }
        } catch { /* segue */ }
      }
    }
  }

  const errorSummary = errors.slice(0, 5).join(' | ');
  throw new Error(`Todas as chaves de IA falharam. ${errorSummary}`);
}

// Endpoint debug: expõe estado das chaves (sem expor a chave).
export async function getKeysSnapshot(providerKeys) {
  const all = flattenProviderKeys(providerKeys);
  const ids = all.map((c) => c.id);
  const states = await keyStateStore.getStates(ids);
  const grouped = {};
  for (const c of all) {
    grouped[c.provider] = grouped[c.provider] || [];
    grouped[c.provider].push({
      id: c.id,
      ...states[c.id],
    });
  }
  return grouped;
}
