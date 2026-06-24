import { BaseOpenAIAdapter } from './base-openai-adapter.js';

// Google Gemini — usa o endpoint OpenAI-compat oficial em
// generativelanguage.googleapis.com/v1beta/openai/. Excelente em multilíngue.
//
// Modelos no free tier (validado live em 2026-05-03):
//   - gemini-2.5-flash         ✅ default — 1.500 RPD, qualidade alta
//   - gemini-2.5-flash-lite    ✅ alternativa rápida
//   - gemini-flash-latest      ✅ alias pro mais recente
//   - gemini-2.0-flash         ❌ quota restritiva (HTTP 429 sem uso real)
//   - gemini-1.5-flash         ❌ HTTP 404 (deprecado)
//   - gemini-2.0-flash-exp     ❌ HTTP 404 (deprecado)
//
// HISTÓRICO: gemini-2.0-flash retornava 429 "quota exceeded" mesmo sem uso —
// Google parece ter movido o free tier pra 2.5+.
export class GeminiAdapter extends BaseOpenAIAdapter {
  constructor() {
    super({
      name: 'gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      defaultModel: 'gemini-2.5-flash',
      fallbackModel: 'gemini-2.5-flash-lite',
      priority: 4, // era 5 — subiu porque Cerebras desceu pra 6
      freeQuota: {
        reqsPerDay: 1500, // free tier oficial: 1.500 req/dia
        tokensPerDay: null, // 1M TPM ≈ 1.4B TPD; RPD é o cap
        estimatedTokensPerRequest: 4000,
      },
    });
  }

  // Gemini OpenAI-compat NÃO suporta `response_format: { type: 'json_object' }`
  // de forma confiável. Em vez disso, deixamos o JSON ser inferido pelo prompt
  // (o prompt já instrui "RETORNE SOMENTE JSON VALIDO COM ESTE FORMATO:").
  // O parseJsonResponse no service é tolerante a JSON dentro de texto.
  buildRequestBody(payload, modelOverride) {
    const body = super.buildRequestBody(payload, modelOverride);
    delete body.response_format;
    return body;
  }
}
