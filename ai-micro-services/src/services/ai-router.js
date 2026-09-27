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
async function selectCandidates(allCandidates, states) {
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
 * @param {number} [args.deadlineMs] - Prazo TOTAL (ms) pra todas as tentativas; vem do
 *   back (`deadline_ms`, ~85s) pra não estourar o timeout dele. Sem valor = sem prazo.
 * @returns {Promise<{ provider, model, data, raw }>}
 * @throws {Error} se nenhuma chave funcionar
 */
export async function callAi({ providerKeys, payload, allowDegrade = true, deadlineMs }) {
  const allCandidates = flattenProviderKeys(providerKeys);
  if (allCandidates.length === 0) {
    throw new Error('Nenhuma chave de provider configurada.');
  }

  const startedAt = Date.now();
  const hasDeadline = Number.isFinite(deadlineMs) && deadlineMs > 0;
  // Tempo restante do deadline (ms) ou Infinity. <= 0 => parar de tentar.
  const remaining = () => (hasDeadline ? deadlineMs - (Date.now() - startedAt) : Infinity);
  // Menos de 3s restantes não dá pra completar uma chamada útil.
  const outOfTime = () => hasDeadline && remaining() < 3000;

  const states = await keyStateStore.getStates(allCandidates.map((c) => c.id));
  const candidates = await selectCandidates(allCandidates, states);
  if (candidates.length === 0) {
    // Todas em cooldown / esgotadas — tenta a primeira mesmo assim
    // (o estado pode ter sido injustamente marcado; uma tentativa não vai matar)
    candidates.push(allCandidates[0]);
  }

  // Providers que deram `fatal` (modelo inexistente/payload inválido): as
  // outras chaves do mesmo provider vão falhar igual — pula todas (A-69).
  const skipProviders = new Set();
  const errors = [];
  for (const candidate of candidates) {
    if (skipProviders.has(candidate.provider)) continue;
    if (outOfTime()) {
      errors.push(`deadline de ${deadlineMs}ms atingido antes de tentar ${candidate.provider}`);
      break;
    }
    const adapter = getAdapter(candidate.provider);
    if (!adapter) continue;

    try {
      const result = await adapter.chat({
        apiKey: candidate.apiKey,
        payload,
        timeoutMs: hasDeadline ? remaining() : undefined,
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
      if (result.errorKind === 'fatal') {
        skipProviders.add(candidate.provider);
        // eslint-disable-next-line no-console
        console.warn(`[ai-router] ${candidate.provider}: erro fatal (adapter/modelo) — pulando as demais chaves deste provider. ${result.error}`);
        continue;
      }
    } catch (err) {
      const msg = err?.message || String(err);
      errors.push(`${candidate.provider}/${candidate.id}: throw — ${msg}`);
      await keyStateStore.markTransient(candidate.id, msg);
    }
  }

  // Última cartada: degrade para o fallbackModel da Groq se houver chaves Groq.
  // Só chaves em estado utilizável (pula invalid/daily_exhausted) e dentro do prazo.
  if (allowDegrade && !outOfTime()) {
    const groqKeys = allCandidates.filter((c) => {
      if (c.provider !== 'groq') return false;
      const st = states[c.id]?.status || 'healthy';
      return st !== 'invalid' && st !== 'daily_exhausted';
    });
    if (groqKeys.length > 0) {
      const groqAdapter = getAdapter('groq');
      for (const candidate of groqKeys) {
        if (outOfTime()) break;
        try {
          const result = await groqAdapter.chat({
            apiKey: candidate.apiKey,
            payload,
            modelOverride: groqAdapter.fallbackModel,
            timeoutMs: hasDeadline ? remaining() : undefined,
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
