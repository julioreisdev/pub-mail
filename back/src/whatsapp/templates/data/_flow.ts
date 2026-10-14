// Peças comuns dos modelos por ramo (Fase 7, contrato §11.6): montar o fluxo do bot em código com ids
// DETERMINÍSTICOS (prefixo do ramo + contador) e posições em grade (colunas de 420 px, linhas de 360 px —
// os blocos têm ~330 px de largura; sem espaço os balões ficam uns por cima dos outros no construtor).
// Marcadores `@product:` `@tag:` `@stage:` `@resource:` `@category:` são trocados pelos ids na aplicação.

export const COL = (i: number) => i * 420;
export const ROW = (i: number) => i * 360;

/** Configurações padrão do fluxo dos modelos (a aplicação sempre cria o fluxo DESLIGADO e em modo teste). */
export const TEMPLATE_BOT_SETTINGS = {
  audience: { mode: 'test', test_chat_ids: [], tag_ids: [] },
  trigger: { mode: 'any', keywords: [] },
  // NÃO usar "0": nos blocos de chamado/pedido o "0" é "cancelar/pular/voltar"
  restart_keywords: ['menu', 'inicio', 'início', '#inicio'],
  exclude_tag_ids: [],
  input_timeout_hours: 24,
  invalid_option_text: 'Não entendi 🤔 Responda só com o *número* da opção.',
  max_retries: 3,
  typing: true,
  numbering: 'emoji',
  business_hours: { enabled: false },
};

export type FlowNode = { id: string; type: string; position: { x: number; y: number }; data: any; deletable?: boolean };
export type FlowEdge = { id: string; source: string; sourceHandle: string; target: string; targetHandle: string };

/** Construtor de fluxo com ids estáveis: `<prefixo>-n001`, `<prefixo>-o001` (opção), `<prefixo>-m001` (mensagem). */
export function flow(prefix: string) {
  const count: Record<string, number> = {};
  const uid = (p: string) => `${prefix}-${p}${String((count[p] = (count[p] || 0) + 1)).padStart(3, '0')}`;
  const nodes: FlowNode[] = [{ id: 'start', type: 'start', position: { x: COL(0), y: ROW(1) }, data: {}, deletable: false }];
  const edges: FlowEdge[] = [];
  const at = (col: number, row: number) => ({ x: COL(col), y: ROW(row) });
  const add = (type: string, data: any, col: number, row: number) => {
    const n: FlowNode = { id: uid('n'), type, position: at(col, row), data };
    nodes.push(n);
    return n.id;
  };
  const api = {
    /** Opção de menu (o id vira a porta `opt-<id>`). */
    opt: (label: string, keywords: string[] = []) => ({ id: uid('o'), label, keywords }),
    node: add,
    /** Bloco de mensagem com 1+ textos (cada texto = uma mensagem). */
    msg: (title: string, texts: string[], col: number, row: number) =>
      add('message', { title, messages: texts.map((t) => ({ id: uid('m'), kind: 'text', text: t, media: null, delay_seconds: 0 })) }, col, row),
    menu: (title: string, text: string, options: { id: string; label: string; keywords: string[] }[], col: number, row: number, extra: any = {}) =>
      add('menu', { title, text, options, ...extra }, col, row),
    tags: (title: string, add_: string[], col: number, row: number, remove: string[] = []) => add('tags', { title, add: add_, remove }, col, row),
    handoff: (title: string, text: string, col: number, row: number) => add('handoff', { title, text, assign_user_id: null }, col, row),
    end: (title: string, text: string, col: number, row: number, close = true) => add('end', { title, text, close }, col, row),
    /** Liga `source` (porta `handle`) a `target`. */
    link: (source: string, handle: string, target: string) => {
      edges.push({ id: uid('e'), source, sourceHandle: handle, target, targetHandle: 'in' });
    },
    /** Liga cada opção do menu ao alvo correspondente. */
    links: (menuId: string, pairs: [{ id: string }, string][]) => {
      for (const [o, target] of pairs) api.link(menuId, `opt-${o.id}`, target);
    },
    build: () => ({ nodes, edges }),
  };
  return api;
}
