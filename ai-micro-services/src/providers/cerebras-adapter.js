import { BaseOpenAIAdapter } from './base-openai-adapter.js';

// Cerebras Cloud — OpenAI-compat completo, infraestrutura própria (CS-3 chips).
// Free tier: 1M tokens/dia, 30 req/min. Cap efetivo: 1M/4k = 250 reqs/dia.
//
// Modelos no free tier (validado via teste real com chave free):
//   - llama3.1-8b                     ✅ ÚNICO que funciona
//   - qwen-3-235b-a22b-instruct-2507  ❌ 429 sempre (RPM ínfimo no free)
//   - gpt-oss-120b                    ❌ 404 model_not_found (tier pago)
//   - zai-glm-4.7                     ❌ 404 model_not_found (tier pago)
//
// HISTÓRICO de quebras:
//   - llama-3.3-70b foi REMOVIDO do free tier (era o default original).
//   - qwen-3-235b parecia disponível mas retorna 429 imediatamente em
//     qualquer chamada (ainda que GET /v1/models o liste). Confirmado em
//     2026-05-03: 3/3 tentativas retornaram 429 RPM exceeded.
//   - llama3.1-8b é a opção real e estável no free tier hoje.
export class CerebrasAdapter extends BaseOpenAIAdapter {
  constructor() {
    super({
      name: 'cerebras',
      baseUrl: 'https://api.cerebras.ai/v1',
      defaultModel: 'llama3.1-8b',
      fallbackModel: null, // não há outro modelo free utilizável neste tier
      // priority 6 (último): llama3.1-8b é pequeno e ocasionalmente gera
      // saídas com bytes UTF-8 corrompidos em respostas multilingues. Mantemos
      // como fallback de emergência. Mistral/Gemini têm qualidade muito melhor.
      priority: 6,
      freeQuota: {
        reqsPerDay: null, // sem limite RPD explícito (TPD é o cap real)
        tokensPerDay: 1000000,
        estimatedTokensPerRequest: 4000,
      },
    });
  }
}
