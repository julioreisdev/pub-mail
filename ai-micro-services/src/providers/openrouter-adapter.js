import { BaseOpenAIAdapter } from './base-openai-adapter.js';

// OpenRouter — agregador. Acessa modelos free com sufixo `:free`.
//
// Modelos no free tier (validado live em 2026-05-03):
//   - openai/gpt-oss-120b:free         ✅ default — 120B params, ctx 131k
//   - z-ai/glm-4.5-air:free            ✅ fallback — qualidade alta, ctx 131k
//   - openai/gpt-oss-20b:free          ✅ alternativa rápida
//   - minimax/minimax-m2.5:free        ✅ alternativa
//
// SATURADOS upstream (HTTP 429 constante, fila global no OpenRouter):
//   - meta-llama/llama-3.3-70b-instruct:free
//   - meta-llama/llama-3.2-3b-instruct:free
//   - qwen/qwen3-coder:free
//   - nousresearch/hermes-3-llama-3.1-405b:free
//   - google/gemma-3-27b-it:free
//
// Os modelos populares (Llama 70B free) sempre estão em fila. Os GPT-OSS da
// OpenAI são alternativa estável porque a infraestrutura tem capacidade.
export class OpenRouterAdapter extends BaseOpenAIAdapter {
  constructor() {
    super({
      name: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      defaultModel: 'openai/gpt-oss-120b:free',
      fallbackModel: 'z-ai/glm-4.5-air:free',
      priority: 3, // era 4 — subiu porque Cerebras desceu pra 6
      freeQuota: {
        reqsPerDay: 50, // ~50 RPD por modelo `:free` (limite forte do RPD)
        tokensPerDay: null, // sem cap explícito de TPD; RPD limita
        estimatedTokensPerRequest: 4000,
      },
    });
  }

  buildHeaders(apiKey) {
    return {
      ...super.buildHeaders(apiKey),
      // OpenRouter recomenda esses headers pra rastreamento
      'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://pub-mail.local',
      'X-Title': 'Pub Mail Webchat',
    };
  }

  // Modelos OSS via OpenRouter (gpt-oss-*, glm-air, etc) ignoram ou retornam
  // string vazia quando recebem `response_format: { type: 'json_object' }`.
  // O prompt já instrui o modelo a retornar JSON, e o parseJsonResponse no
  // service tolera markdown fences se aparecer.
  buildRequestBody(payload, modelOverride) {
    const body = super.buildRequestBody(payload, modelOverride);
    delete body.response_format;
    return body;
  }
}
