// KeyStateStore — estado runtime de cada (provider, chave) em Redis.
//
// MODELO SIMPLIFICADO (refatorado pra eliminar race conditions):
//
// Por chave (hash em pubmail:ai_keys:<provider>:<id>):
//   - status: 'healthy' | 'rate_limited' | 'daily_exhausted' | 'invalid'
//   - cooldown_until: timestamp ms (0 = sem cooldown)
//   - daily_reset_at: timestamp ms (0 = sem quota diária consumida)
//   - last_error: string
//   - last_used_at: timestamp ms
//
// >>> NÃO mantemos mais total_uses_today/tokens_used_today POR CHAVE <<<
//   Motivo: gerava complexidade (race em virada de dia, day_bucket por chave,
//   eager reset por chave, etc) e não trazia valor real pra UI.
//
// Contador agregado GLOBAL (hash único em pubmail:ai_keys:_global):
//   - day_bucket: YYYY-MM-DD UTC
//   - total_uses_today: int
//   - tokens_used_today: int
//
// Reset diário: detectado por day_bucket no global. Quando dia UTC vira,
// zera tudo eagerly. Status individual de cada chave (daily_exhausted) volta
// pra healthy via daily_reset_at <= now no getState.
//
// Identidade da chave: hash sha-256 dos primeiros bytes (pra não logar a chave
// inteira; e pra que o mesmo valor produza o mesmo id em qualquer instância).

import Redis from 'ioredis';
import { createHash } from 'node:crypto';

const REDIS_PREFIX = 'pubmail:ai_keys:';
const REDIS_GLOBAL_KEY = `${REDIS_PREFIX}_global`;
const KEY_TTL_SECONDS = 60 * 60 * 26; // 26h — cobre o reset diário com folga

let sharedClient = null;

function getRedis() {
  if (sharedClient) return sharedClient;
  const host = String(process.env.REDIS_HOST || '127.0.0.1').trim();
  const port = Number(process.env.REDIS_PORT || 6379);
  sharedClient = new Redis({
    host,
    port,
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });
  sharedClient.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.warn('[KeyStateStore] Redis error:', err?.message);
  });
  return sharedClient;
}

export function keyId(providerName, apiKey) {
  const hash = createHash('sha256')
    .update(`${providerName}::${String(apiKey || '')}`)
    .digest('hex')
    .slice(0, 16);
  return `${providerName}:${hash}`;
}

// Bucket do dia em UTC (YYYY-MM-DD). Usado para detectar virada de dia no
// contador global, alinhado ao reset diário oficial dos providers (00:00 UTC).
function todayUtcDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export class KeyStateStore {
  constructor() {
    this.redis = getRedis();
  }

  rkey(id) {
    return `${REDIS_PREFIX}${id}`;
  }

  // === Por chave (status only) =================================================

  // Lê o estado de uma chave. Devolve objeto com defaults seguros se não existir.
  // Auto-reset: cooldown vencido → healthy; daily_reset_at vencido → healthy
  // (e zera daily_reset_at no Redis pra evitar resíduo).
  async getState(id) {
    try {
      const raw = await this.redis.hgetall(this.rkey(id));
      const now = Date.now();
      const cooldown_until = Number(raw?.cooldown_until || 0);
      const daily_reset_at = Number(raw?.daily_reset_at || 0);

      let status = (raw?.status || 'healthy').toLowerCase();

      // Auto-recover de rate_limit quando cooldown passou.
      if (status === 'rate_limited' && cooldown_until <= now) {
        status = 'healthy';
      }
      // Auto-recover de daily_exhausted quando dia oficial virou (reset_at no passado).
      if (status === 'daily_exhausted' && daily_reset_at > 0 && daily_reset_at <= now) {
        status = 'healthy';
        // Eager reset no Redis pra deixar o estado consistente.
        this.redis
          .hset(this.rkey(id), {
            status: 'healthy',
            daily_reset_at: 0,
            last_error: '',
          })
          .catch(() => {});
      }

      return {
        status,
        cooldown_until,
        daily_reset_at: status === 'daily_exhausted' ? daily_reset_at : 0,
        last_error: raw?.last_error || '',
        last_used_at: Number(raw?.last_used_at || 0),
      };
    } catch {
      return {
        status: 'healthy',
        cooldown_until: 0,
        daily_reset_at: 0,
        last_error: '',
        last_used_at: 0,
      };
    }
  }

  async getStates(ids) {
    const states = {};
    await Promise.all(
      ids.map(async (id) => {
        states[id] = await this.getState(id);
      }),
    );
    return states;
  }

  // === markUsed: marca chave como healthy + incrementa contador global =========

  async markUsed(id, tokens = 0) {
    try {
      const tokensInt = Math.max(0, Math.floor(Number(tokens) || 0));
      const rkey = this.rkey(id);

      // Atualiza estado individual da chave (sem counters).
      const r = this.redis.multi();
      r.hset(rkey, {
        status: 'healthy',
        last_used_at: Date.now(),
        last_error: '',
        daily_reset_at: 0,
      });
      r.expire(rkey, KEY_TTL_SECONDS);
      await r.exec();

      // Incrementa contador global agregado.
      await this.incrementGlobal(tokensInt);
    } catch {
      // Redis fora não pode bloquear chamada de IA.
    }
  }

  async markRateLimited(id, retryAfterSec, errMsg = '') {
    try {
      // Anti thundering-herd: jitter aleatório de ±20% no cooldown. Sob
      // tráfego pago, várias chaves podem pegar 429 quase simultaneamente
      // (mesmo provider, mesmo segundo). Sem jitter, todas voltam healthy
      // no mesmo instante e disparam outra rajada → 429 de novo. Com
      // jitter, escalonam naturalmente.
      const baseCooldownMs = Math.max(1, Number(retryAfterSec) || 60) * 1000;
      const jitterMs = baseCooldownMs * (Math.random() * 0.4 - 0.2); // ±20%
      const cooldownUntil = Date.now() + Math.floor(baseCooldownMs + jitterMs);
      await this.redis.hset(this.rkey(id), {
        status: 'rate_limited',
        cooldown_until: cooldownUntil,
        last_error: String(errMsg).slice(0, 500),
      });
      await this.redis.expire(this.rkey(id), KEY_TTL_SECONDS);
    } catch {
      /* ignore */
    }
  }

  async markDailyExhausted(id, errMsg = '') {
    try {
      // Reset à meia-noite UTC do dia seguinte
      const now = new Date();
      const reset = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1,
          0,
          5,
          0,
          0, // 00:05 UTC pra ficar seguro de lag de provider
        ),
      );
      await this.redis.hset(this.rkey(id), {
        status: 'daily_exhausted',
        daily_reset_at: reset.getTime(),
        last_error: String(errMsg).slice(0, 500),
      });
      await this.redis.expire(this.rkey(id), KEY_TTL_SECONDS);
    } catch {
      /* ignore */
    }
  }

  async markInvalid(id, errMsg = '') {
    try {
      await this.redis.hset(this.rkey(id), {
        status: 'invalid',
        last_error: String(errMsg).slice(0, 500),
      });
      await this.redis.expire(this.rkey(id), KEY_TTL_SECONDS);
    } catch {
      /* ignore */
    }
  }

  async markTransient(id, errMsg = '') {
    // Erro transiente NÃO marca a chave como ruim — só registra last_error.
    try {
      await this.redis.hset(this.rkey(id), {
        last_error: String(errMsg).slice(0, 500),
      });
      await this.redis.expire(this.rkey(id), KEY_TTL_SECONDS);
    } catch {
      /* ignore */
    }
  }

  // === Contador global agregado ================================================

  // Incrementa total_uses_today e tokens_used_today no contador global,
  // detectando virada de dia UTC (zera ao detectar).
  async incrementGlobal(tokens = 0) {
    try {
      const today = todayUtcDate();
      const tokensInt = Math.max(0, Math.floor(Number(tokens) || 0));
      const currentBucket = await this.redis.hget(REDIS_GLOBAL_KEY, 'day_bucket');

      if (currentBucket !== today) {
        // Sem bucket OU dia virou → reseta + grava 1 uso de hoje.
        await this.redis.hset(REDIS_GLOBAL_KEY, {
          day_bucket: today,
          total_uses_today: 1,
          tokens_used_today: tokensInt,
        });
      } else {
        // Mesmo dia — incrementa atomicamente.
        const r = this.redis.multi();
        r.hincrby(REDIS_GLOBAL_KEY, 'total_uses_today', 1);
        if (tokensInt > 0) r.hincrby(REDIS_GLOBAL_KEY, 'tokens_used_today', tokensInt);
        await r.exec();
      }
      await this.redis.expire(REDIS_GLOBAL_KEY, KEY_TTL_SECONDS);
    } catch {
      /* ignore */
    }
  }

  // Lê o contador global. Faz eager reset se day_bucket está stale.
  async getGlobalCounter() {
    try {
      const raw = await this.redis.hgetall(REDIS_GLOBAL_KEY);
      const today = todayUtcDate();
      const dayBucket = raw?.day_bucket || '';
      const isStaleDay = dayBucket && dayBucket !== today;

      if (isStaleDay) {
        // Eager reset: persiste no Redis pra estado consistente.
        this.redis
          .hset(REDIS_GLOBAL_KEY, {
            day_bucket: today,
            total_uses_today: 0,
            tokens_used_today: 0,
          })
          .catch(() => {});
        return { total_uses_today: 0, tokens_used_today: 0 };
      }

      return {
        total_uses_today: Number(raw?.total_uses_today || 0),
        tokens_used_today: Number(raw?.tokens_used_today || 0),
      };
    } catch {
      return { total_uses_today: 0, tokens_used_today: 0 };
    }
  }
}

export const keyStateStore = new KeyStateStore();
