// Modelos por ramo (Fase 7 — contrato `docs/whatsapp-assinaturas-contrato.md` §11.6).
// Um arquivo `.ts` por ramo em `./data/` (vai no `dist` sem configurar assets). Marcadores resolvidos na aplicação,
// em QUALQUER string do fluxo do bot / recursos: `@product:<nome>` → id do produto, `@tag:<nome>` → id da etiqueta,
// `@stage:<nome>` → id da etapa do funil, `@resource:<nome>` → id do recurso da agenda, `@category:<chave>` → chave.

export type WaTemplate = {
  key: string; // clinica | provedor | loja | seguranca | vip | prefeitura | mercado
  name: string;
  description: string;
  icon: string; // nome de ícone Tabler (o front escolhe)
  highlights: string[]; // o que o modelo monta (texto curto para a tela)
  products?: Array<Record<string, any>>; // payload de produto do CRM (name obrigatório); serviços da agenda: kind 'service'
  custom_fields?: Partial<Record<'customer' | 'product' | 'subscription' | 'charge' | 'ticket' | 'appointment' | 'order', Array<Record<string, any>>>>;
  tags?: Array<{ name: string; color?: string }>;
  pipeline_stages?: Array<{ name: string; color?: string; kind?: 'open' | 'won' | 'lost' }>;
  tickets?: { categories?: Array<Record<string, any>>; settings?: Record<string, any> };
  scheduling?: { resources?: Array<Record<string, any> & { name: string; services?: string[] }>; settings?: Record<string, any> };
  orders?: { settings?: Record<string, any> };
  bot?: { name: string; definition: any; settings?: any };
  /** `crm_fixture` do simulador (dados falsos) + cenários testados no E2E (`docs/tools/wa_templates_e2e.mjs`). */
  fixture?: any;
  scenarios?: WaTemplateScenario[];
};

/**
 * Cenário de conversa rodado no simulador (`POST /whatsapp/bot/simulate`) com `crm_fixture = fixture` do modelo.
 * A fixture pode usar os mesmos marcadores do fluxo (`@product:<nome>`…): o E2E troca pelos ids reais da org
 * (localmente, por ids falsos) antes de mandar.
 *
 * Passos (em ordem; o 1º `send` começa a conversa):
 *  - `{ send: 'texto' }`                         → cliente manda uma mensagem
 *  - `{ media: 'image'|'document', text? }`      → cliente manda um arquivo fictício (blocos de chamado)
 *  - `{ event: 'charge_paid'|'charge_expired' }` → cobrança fictícia paga/expirada (usa a cobrança do estado)
 * Cada passo pode ter `expect` (conferido só na resposta daquele passo); o `expect` do cenário confere a conversa
 * inteira (textos de todas as respostas) e o estado final.
 */
export type WaTemplateStep =
  | { send: string; expect?: WaTemplateExpect }
  | { media: 'image' | 'document'; text?: string; expect?: WaTemplateExpect }
  | { event: 'charge_paid' | 'charge_expired'; expect?: WaTemplateExpect };

export type WaTemplateExpect = {
  /** Trechos que precisam aparecer nos textos enviados pelo bot (espaços normalizados; maiúsculas contam). */
  contains?: string[];
  /** Trechos que NÃO podem aparecer. */
  not_contains?: string[];
  /** Nomes das etiquetas aplicadas pelo bloco "Etiquetas" (ação `tags`). */
  tags?: string[];
  /** Houve cartão de cobrança (pseudo-ação `charge` do simulador). */
  charge?: boolean;
  /** Passou para atendente (ação `handoff`). */
  handoff?: boolean;
  /** Conversa terminou (`ended` da resposta). */
  ended?: boolean;
  /** `state.waiting_for` ao final (null = não espera nada). */
  waiting_for?: string | null;
};

/** `fixture` (opcional) = chaves que SUBSTITUEM as da fixture do modelo neste cenário (ex.: `{ customer: null }`). */
export type WaTemplateScenario = { name: string; fixture?: Record<string, any>; steps: WaTemplateStep[]; expect?: WaTemplateExpect };

export const TEMPLATE_PARTS = ['products', 'custom_fields', 'tags', 'pipeline', 'tickets', 'scheduling', 'orders', 'bot'] as const;
export type TemplatePart = (typeof TEMPLATE_PARTS)[number];
