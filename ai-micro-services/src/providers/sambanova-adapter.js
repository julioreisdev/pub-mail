import { BaseOpenAIAdapter } from './base-openai-adapter.js';

// SambaNova Cloud — OpenAI-compat. Free tier limitado (~10 req/min).
// Modelos disponíveis (validado via GET /v1/models em 2026-05-03):
//   - Meta-Llama-3.3-70B-Instruct        ✅ default
//   - Llama-4-Maverick-17B-128E-Instruct ✅ alternativa moderna
//   - DeepSeek-V3.1                       ✅ raciocínio
//   - Meta-Llama-3.1-8B-Instruct          ❌ HTTP 410 (deprecado)
//
// HISTÓRICO: o nome era "Llama-3.3-70B-Instruct" (sem prefix Meta-) e
// retornava 404. SambaNova padronizou pra prefix "Meta-" em todos os Llama.
export class SambaNovaAdapter extends BaseOpenAIAdapter {
  constructor() {
    super({
      name: 'sambanova',
      baseUrl: 'https://api.sambanova.ai/v1',
      defaultModel: 'Meta-Llama-3.3-70B-Instruct',
      fallbackModel: 'Llama-4-Maverick-17B-128E-Instruct',
      priority: 5, // era 6 — subiu porque Cerebras desceu
      freeQuota: {
        // Free tier flutuante (~10 RPM). Cap conservador estimado.
        reqsPerDay: 200,
        tokensPerDay: null,
        estimatedTokensPerRequest: 4000,
      },
    });
  }
}
