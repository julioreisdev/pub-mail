import { BaseOpenAIAdapter } from './base-openai-adapter.js';

// Groq — OpenAI-compat completo. Modelo padrão: gpt-oss-120b (raciocínio, 131k ctx,
// rápido no hardware da Groq). Fallback: gpt-oss-20b (degrade emergencial).
// Free tier (gpt-oss-120b): 1k req/dia, 30 req/min, ~200k tokens/dia.
//
// HISTÓRICO (set/2026): os modelos Llama 3.x (llama-3.3-70b-versatile,
// llama-3.1-8b-instant) foram DESCONTINUADOS pela Groq — passaram a responder
// 404 model_not_found e o router marcava a chave como "inválida". Se voltar a
// acontecer, confira a lista viva em GET https://api.groq.com/openai/v1/models.
const GPT_OSS_RE = /^openai\/gpt-oss/;

export class GroqAdapter extends BaseOpenAIAdapter {
  constructor() {
    super({
      name: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      defaultModel: 'openai/gpt-oss-120b',
      fallbackModel: 'openai/gpt-oss-20b',
      priority: 1, // mais rápido, prioridade máxima
      freeQuota: {
        reqsPerDay: 1000,
        tokensPerDay: 200000,
        estimatedTokensPerRequest: 4000,
      },
    });
  }

  // gpt-oss é modelo de raciocínio: sem isso o "pensamento" consome o max_tokens
  // e a resposta pode vir vazia/truncada. Esforço baixo = latência de chat e o
  // JSON final intacto; include_reasoning=false tira o campo "reasoning" do payload.
  buildRequestBody(payload, modelOverride) {
    const body = super.buildRequestBody(payload, modelOverride);
    if (GPT_OSS_RE.test(body.model)) {
      body.reasoning_effort = 'low';
      body.include_reasoning = false;
      // Saída estruturada (out/2026): com `json_object` o gpt-oss respondia em PROSA
      // em ~3 de 4 respostas longas de chat — a Groq valida e devolve 400
      // `json_validate_failed`. Com `json_schema` a decodificação é restrita à
      // gramática do schema: medido 4/4 JSON válido com o prompt real do webchat.
      // Quem chama manda `payload.jsonSchema` ({ name, schema }); sem isso fica o
      // json_object de sempre.
      if (body.response_format && payload.jsonSchema?.schema) {
        body.response_format = {
          type: 'json_schema',
          json_schema: {
            name: String(payload.jsonSchema.name || 'response'),
            schema: payload.jsonSchema.schema,
          },
        };
      }
    }
    return body;
  }
}
