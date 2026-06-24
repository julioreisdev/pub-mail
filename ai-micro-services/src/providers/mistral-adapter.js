import { BaseOpenAIAdapter } from './base-openai-adapter.js';

// Mistral La Plateforme — OpenAI-compat. Cota free generosa (1B tokens/mês ≈
// 33M/dia). Limita 1 req/s no free tier (= 86k RPD teórico). Cap efetivo:
// 33M/4k = ~8000 reqs/dia.
export class MistralAdapter extends BaseOpenAIAdapter {
  constructor() {
    super({
      name: 'mistral',
      baseUrl: 'https://api.mistral.ai/v1',
      defaultModel: 'mistral-small-latest',
      fallbackModel: null,
      // priority 2 (era 3): elevamos pra cima do Cerebras porque o Cerebras
      // free tier só permite llama3.1-8b, que tem qualidade inferior e
      // gera saídas corrompidas ocasionalmente. Mistral-small é bem melhor.
      priority: 2,
      freeQuota: {
        reqsPerDay: 86400, // 1 RPS × 86400s
        tokensPerDay: 33000000, // 1B/mês ÷ 30
        estimatedTokensPerRequest: 4000,
      },
    });
  }
}
