// Adapter base que fala o protocolo OpenAI-compat (POST /chat/completions
// com Authorization: Bearer <key>). 5 dos 6 providers usam esse formato:
// Groq, Cerebras, Mistral, OpenRouter, SambaNova. Gemini também expõe um
// endpoint OpenAI-compat (`/v1beta/openai/`).
//
// Cada subclasse só precisa definir: name, baseUrl, defaultModel, fallbackModel.
// O parser de erro identifica rate_limit / daily_exhausted / invalid_key /
// transient / fatal a partir do status HTTP + body.

import { setTimeout as sleep } from 'node:timers/promises';

export class BaseOpenAIAdapter {
  constructor(config) {
    this.name = config.name;                  // ex: 'groq'
    this.baseUrl = config.baseUrl;            // ex: 'https://api.groq.com/openai/v1'
    this.defaultModel = config.defaultModel;  // ex: 'llama-3.3-70b-versatile'
    this.fallbackModel = config.fallbackModel || null; // modelo menor pra degrade
    this.timeoutMs = config.timeoutMs || 45_000;
    this.priority = config.priority ?? 999;   // menor = mais prioritário
    // Quota free tier por chave. Usado pra estimar capacidade restante no
    // painel "Status de API". Cada provider preenche com valores reais
    // (free tier oficial). `estimatedTokensPerRequest` é a média real medida
    // em prod do webchat (system prompt + history + reply ≈ 4000 tokens).
    this.freeQuota = config.freeQuota || {
      reqsPerDay: null,
      tokensPerDay: null,
      estimatedTokensPerRequest: 4000,
    };
  }

  // Monta o body OpenAI-compat. Subclasses podem sobrescrever pra ajustar
  // (ex: Gemini não suporta response_format estrito).
  buildRequestBody(payload, modelOverride) {
    return {
      model: modelOverride || this.defaultModel,
      messages: payload.messages,
      temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.7,
      max_tokens: typeof payload.maxTokens === 'number' ? payload.maxTokens : 800,
      response_format: { type: 'json_object' },
    };
  }

  // Headers padrão. Subclasses podem adicionar (ex: SambaNova exige x-api-key).
  buildHeaders(apiKey) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
  }

  // Faz a request. Retorna { ok, status, data, error, errorKind, retryAfterSec, raw }.
  async chat({ apiKey, payload, modelOverride }) {
    const url = `${this.baseUrl}/chat/completions`;
    const body = this.buildRequestBody(payload, modelOverride);
    const headers = this.buildHeaders(apiKey);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response;
    let rawText = '';
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      rawText = await response.text();
    } catch (err) {
      clearTimeout(timeoutId);
      const isAbort = err?.name === 'AbortError';
      return {
        ok: false,
        errorKind: isAbort ? 'transient' : 'transient',
        error: isAbort ? 'timeout' : (err?.message || 'network error'),
        retryAfterSec: 5,
      };
    }
    clearTimeout(timeoutId);

    if (response.ok) {
      try {
        const data = JSON.parse(rawText);
        return { ok: true, data, raw: rawText };
      } catch (err) {
        return {
          ok: false,
          errorKind: 'transient',
          error: `Invalid JSON response: ${err?.message}`,
        };
      }
    }

    // Não OK: classifica
    const errorKind = this.classifyError(response.status, rawText);
    const retryAfterSec = this.extractRetryAfter(response.headers, rawText, errorKind);
    return {
      ok: false,
      status: response.status,
      errorKind,
      retryAfterSec,
      error: this.compactError(rawText, response.status),
    };
  }

  classifyError(status, body) {
    if (status === 429) {
      // 429 = rate limit. Distinguir entre quota DIÁRIA (TPD/RPD) vs taxa
      // POR MINUTO (TPM/RPM). A diferença é crítica: daily fica esgotado até
      // 00:05 UTC do dia seguinte; rate por minuto volta em segundos.
      const lower = String(body || '').toLowerCase();

      // Sinais EXPLÍCITOS de quota diária (TPD/RPD).
      if (
        lower.includes('per day') ||
        lower.includes('tokens per day') ||
        lower.includes('requests per day') ||
        lower.includes('tpd') ||
        lower.includes('rpd') ||
        lower.includes('daily quota') ||
        lower.includes('daily limit')
      ) {
        return 'daily_exhausted';
      }

      // Sinais EXPLÍCITOS de rate por minuto/segundo.
      if (
        lower.includes('per minute') ||
        lower.includes('per second') ||
        lower.includes('rpm') ||
        lower.includes('tpm') ||
        lower.includes('too many requests')
      ) {
        return 'rate_limit';
      }

      // "daily" sozinho como palavra: provável daily.
      if (/\bdaily\b/.test(lower)) return 'daily_exhausted';

      // Default conservador: rate_limit (cooldown curto). Se for daily real,
      // a próxima tentativa após cooldown vai retornar 429 com mensagem mais
      // específica e aí classificamos certo.
      return 'rate_limit';
    }
    if (status === 401 || status === 403) return 'invalid_key';
    if (status >= 500) return 'transient';
    if (status === 400) return 'fatal'; // payload bug — não vale tentar outras chaves
    // 404 model_not_found: o adapter está mal configurado (modelo removido do
    // free tier ou nome mudou). Marcamos como invalid_key pra que a UI mostre
    // a chave em vermelho e o admin perceba — NÃO é a chave que está ruim,
    // mas o adapter precisa de attention. Sem isso, last_error fica enterrado
    // e o ai-router gasta tempo tentando inutilmente.
    if (status === 404) return 'invalid_key';
    return 'transient';
  }

  extractRetryAfter(headers, body, errorKind) {
    if (errorKind === 'daily_exhausted') return null; // será calculado pra meia-noite
    const headerValue = headers?.get?.('retry-after');
    if (headerValue) {
      const n = Number(headerValue);
      if (Number.isFinite(n) && n > 0) return Math.min(n, 300);
    }
    // Tenta extrair "try again in 12.345s" do body
    const match = String(body || '').match(/(\d+(?:\.\d+)?)\s*s(?:econds?)?/i);
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > 0) return Math.min(Math.ceil(n), 300);
    }
    return errorKind === 'rate_limit' ? 60 : 5;
  }

  compactError(body, status) {
    const trimmed = String(body || '').slice(0, 300).replace(/\s+/g, ' ').trim();
    return `HTTP ${status}: ${trimmed}`;
  }
}

// utility para tests / debug
export const _sleep = sleep;
