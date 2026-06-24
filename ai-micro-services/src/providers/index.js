import { GroqAdapter } from './groq-adapter.js';
import { CerebrasAdapter } from './cerebras-adapter.js';
import { MistralAdapter } from './mistral-adapter.js';
import { OpenRouterAdapter } from './openrouter-adapter.js';
import { GeminiAdapter } from './gemini-adapter.js';
import { SambaNovaAdapter } from './sambanova-adapter.js';

// Registry global de adapters. Ordem segue priority (1 = mais alto).
// Pra adicionar novo provider: criar adapter, importar, adicionar aqui.
export const adapters = {
  groq: new GroqAdapter(),
  cerebras: new CerebrasAdapter(),
  mistral: new MistralAdapter(),
  openrouter: new OpenRouterAdapter(),
  gemini: new GeminiAdapter(),
  sambanova: new SambaNovaAdapter(),
};

export const PROVIDER_ORDER = Object.entries(adapters)
  .sort(([, a], [, b]) => a.priority - b.priority)
  .map(([name]) => name);

export function getAdapter(providerName) {
  return adapters[providerName] || null;
}
