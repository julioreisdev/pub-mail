import { BaseOpenAIAdapter } from './base-openai-adapter.js';

// Groq — OpenAI-compat completo. Modelo 70B versátil (rápido + qualidade alta).
// Free tier: 1k req/dia, 30 req/min, 100k tokens/dia para 70B.
// Cap efetivo por chave: min(1000, 100000/4000) = 25 reqs reais de webchat.
export class GroqAdapter extends BaseOpenAIAdapter {
  constructor() {
    super({
      name: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      defaultModel: 'llama-3.3-70b-versatile',
      fallbackModel: 'llama-3.1-8b-instant', // 14k req/dia/conta (degrade emergencial)
      priority: 1, // mais rápido, prioridade máxima
      freeQuota: {
        reqsPerDay: 1000,
        tokensPerDay: 100000,
        estimatedTokensPerRequest: 4000,
      },
    });
  }
}
