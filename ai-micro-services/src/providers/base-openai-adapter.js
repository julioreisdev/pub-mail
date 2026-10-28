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
    const body = {
      model: modelOverride || this.defaultModel,
      messages: payload.messages,
      temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.7,
      max_tokens: typeof payload.maxTokens === 'number' ? payload.maxTokens : 800,
      response_format: { type: 'json_object' },
    };
    // `payload.jsonMode === false` = pedir texto livre (o chamador extrai o JSON do
    // texto). Usado na 2ª tentativa depois de um `json_validate_failed` da Groq.
    if (payload.jsonMode === false) delete body.response_format;
    return body;
  }

  // Groq valida o JSON do modo `json_object` no servidor: quando o modelo responde em
  // prosa (resposta longa de chat), vem HTTP 400 `json_validate_failed` com o texto
  // gerado em `failed_generation`. Não é defeito de chave nem de modelo — é a resposta
  // que não veio embrulhada em JSON. Devolve o texto quando o corpo for esse caso.
  extractFailedGeneration(status, rawText) {
    if (status !== 400) return null;
    try {
      const data = JSON.parse(rawText);
      const err = data?.error || data;
      const code = String(err?.code || '').toLowerCase();
      const msg = String(err?.message || '').toLowerCase();
      if (code !== 'json_validate_failed' && !msg.includes('failed to generate json')) return null;
      const text = typeof err?.failed_generation === 'string' ? err.failed_generation.trim() : '';
      return text || null;
    } catch {
      return null;
    }
  }

  // Headers padrão. Subclasses podem adicionar (ex: SambaNova exige x-api-key).
  buildHeaders(apiKey) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
  }

  // Faz a request. Retorna { ok, status, data, error, errorKind, retryAfterSec, raw }.
  // `timeoutMs` opcional: o router passa o tempo que ainda resta do deadline
  // global pra nenhuma tentativa isolada estourar o limite do back (A-69).
  async chat({ apiKey, payload, modelOverride, timeoutMs }) {
    const url = `${this.baseUrl}/chat/completions`;
    const body = this.buildRequestBody(payload, modelOverride);
    const headers = this.buildHeaders(apiKey);

    const effectiveTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0
      ? Math.min(this.timeoutMs, timeoutMs)
      : this.timeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

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

    // Não OK. 1º caso especial: o modelo respondeu, só não em JSON (Groq
    // `json_validate_failed`). Tratar como SUCESSO com o texto gerado — quem chama
    // já sabe extrair JSON de texto solto e cair em texto puro se precisar. Antes
    // isso era `fatal`: pulava todas as chaves do provider e o lead via um 502
    // mesmo com a resposta pronta no corpo do erro.
    const failedGeneration = this.extractFailedGeneration(response.status, rawText);
    if (failedGeneration) {
      // eslint-disable-next-line no-console
      console.warn(`[${this.name}] json_validate_failed: usando failed_generation como conteúdo (${failedGeneration.length} chars)`);
      return {
        ok: true,
        jsonValidateFailed: true,
        data: {
          choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: failedGeneration } }],
          usage: {},
          model: body.model,
        },
        raw: rawText,
      };
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
    // 400 (payload/modelo inválido) e 404 model_not_found = o ADAPTER está mal
    // configurado (modelo descontinuado/nome mudou), não a chave. Classificar
    // como `fatal`: o router pula as outras chaves do MESMO provider e NÃO
    // marca a chave inválida (antes, um modelo descontinuado derrubava todas as
    // chaves do provider por 26h — A-69). O last_error fica registrado
    // (markTransient) pra diagnóstico.
    if (status === 400) return 'fatal';
    if (status === 404) return 'fatal';
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
