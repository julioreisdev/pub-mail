import type { WaTemplate } from '../wa-template.types';
import { flow, TEMPLATE_BOT_SETTINGS } from './_flow';

// Mercado / delivery: catálogo por seções, carrinho no WhatsApp, taxa de entrega (grátis acima de um valor),
// pedido mínimo, pagamento por PIX ou na entrega, e o que fazer quando faltar um item. Fluxo: fazer pedido ·
// meus pedidos · ofertas da semana · horário e entrega · atendente.

const CUSTOM_FIELDS = {
  customer: [{ key: 'referencia_entrega', label: 'Referência para a entrega', type: 'text', required: false, visible_to_customer: true, ask_in_bot: false }],
  order: [
    { key: 'substituicao', label: 'Se faltar algum item', type: 'select', options: ['Pode trocar por um parecido', 'Me chame antes de trocar', 'Não trocar, pode tirar'], required: true, visible_to_customer: true, ask_in_bot: true },
  ],
};

const ORDER_SETTINGS = {
  enabled: true,
  delivery: { enabled: true, fee_cents: 700, free_from_cents: 15000 },
  pickup: { enabled: true, address: 'Av. Getúlio Vargas, 1.530 — Vila Nova' },
  min_order_cents: 4000,
  payment_methods: ['pix', 'on_delivery'],
  max_items: 40,
  texts: {
    confirmed: 'Pedido *#{{pedido.numero}}* confirmado ✅ Já estamos separando as suas compras 🛒',
    out_for_delivery: 'Seu pedido *#{{pedido.numero}}* saiu para entrega 🛵 Chega em até 40 minutos!',
    delivered: 'Pedido *#{{pedido.numero}}* entregue ✅ Obrigado por comprar no Bom Preço! 🧡',
  },
};

const f = flow('mer');
const oPedido = f.opt('Fazer pedido 🛒', ['pedido', 'comprar', 'compras', 'mercado']);
const oMeus = f.opt('Meus pedidos', ['meus pedidos', 'acompanhar', 'cadê', 'cade', 'entrega']);
const oOfertas = f.opt('Ofertas da semana', ['ofertas', 'promocao', 'promocoes']);
const oHorario = f.opt('Horário e taxa de entrega', ['horario', 'taxa', 'frete', 'aberto']);
const oAtend = f.opt('Falar com o mercado', ['atendente', 'humano', 'pessoa']);
const menu = f.menu('Menu principal', 'Oi, {{primeiro_nome}}! 🧡 Aqui é o *Mercadinho Bom Preço* — entregamos no seu bairro.\nO que você precisa?', [oPedido, oMeus, oOfertas, oHorario, oAtend], 1, 2);
const atend = f.handoff('Atendente', 'Já chamo alguém do mercado para falar com você 🧡', 2, 6);
const fim = f.end('Encerrar', 'Obrigado! Quando precisar, é só mandar *menu* 🧡', 5, 3);
f.link('start', 'out', menu);
f.link(menu, 'invalid', atend);
f.links(menu, [[oAtend, atend]]);

// 1 — pedido
const pedido = f.node('order_cart', {
  title: 'Fazer pedido',
  categories: 'all',
  allow_delivery: true,
  allow_pickup: true,
  payment: 'ask',
  ask_notes: true,
  texts: {
    choose_category: 'Escolha uma seção 🛒',
    ask_notes: 'Alguma observação? (ex.: banana mais verde, troco para R$ 100) — ou responda *pular*.',
    paid: 'Pagamento do pedido *#{{pedido.numero}}* confirmado ✅ Já estamos separando as suas compras!',
  },
}, 2, 0);
const tagCliente = f.tags('Etiqueta cliente', ['@tag:Cliente delivery'], 3, 0);
const obrigado = f.end('Pedido feito', 'Obrigado pela preferência! 🧡 A gente avisa por aqui quando o pedido sair para entrega.', 4, 0);
f.links(menu, [[oPedido, pedido]]);
f.link(pedido, 'paid', tagCliente);
f.link(pedido, 'out', tagCliente);
f.link(tagCliente, 'out', obrigado);
f.link(pedido, 'expired', fim);
f.link(pedido, 'canceled', fim);
f.link(pedido, 'failed', atend);

// 2 — meus pedidos
const meus = f.node('my_orders', { title: 'Meus pedidos', show: 'open', texts: { none: 'Você não tem pedido em andamento 🙂' } }, 2, 2);
f.links(menu, [[oMeus, meus]]);
f.link(meus, 'out', fim);
f.link(meus, 'none', menu);
f.link(meus, 'failed', atend);

// 3/4 — informações → pedir agora?
const oPedirAgora = f.opt('Fazer pedido agora', ['pedir', 'quero', 'sim']);
const oVoltar = f.opt('Voltar ao menu', ['voltar', 'menu']);
const pedirAgora = f.menu('Pedir agora?', 'Quer aproveitar e fazer o pedido?', [oPedirAgora, oVoltar], 4, 4);
f.links(pedirAgora, [[oPedirAgora, pedido], [oVoltar, menu]]);
f.link(pedirAgora, 'invalid', fim);
const ofertas = f.msg('Ofertas da semana', ['🔥 *Ofertas da semana*\n\n🍌 Banana prata — R$ 5,99/kg\n🍅 Tomate italiano — R$ 7,49/kg\n🥖 Pão francês — R$ 15,90/kg\n🥤 Refrigerante 2 L — R$ 8,99\n\n_Válido até domingo ou enquanto durar o estoque._'], 3, 4);
const horario = f.msg('Horário e entrega', ['🕗 *Funcionamento*: segunda a sábado, 7h às 21h · domingo, 7h às 13h\n🛵 *Entrega*: R$ 7,00 no bairro — *grátis acima de R$ 150*\n🧾 *Pedido mínimo*: R$ 40,00\n💳 PIX ou pagamento na entrega (dinheiro ou cartão)'], 3, 5);
f.links(menu, [[oOfertas, ofertas], [oHorario, horario]]);
f.link(ofertas, 'out', pedirAgora);
f.link(horario, 'out', pedirAgora);

const P = (name: string, category: string, cents: number, description = '') => ({ name, description, price_cents: cents, billing: 'once', kind: 'product', category });
const PRODUCTS = [
  P('Banana prata (kg)', 'Hortifrúti', 599),
  P('Tomate italiano (kg)', 'Hortifrúti', 749),
  P('Alface crespa (unidade)', 'Hortifrúti', 350),
  P('Pão francês (kg)', 'Padaria', 1590),
  P('Bolo de fubá (unidade)', 'Padaria', 1800),
  P('Arroz tipo 1 — 5 kg', 'Mercearia', 2690),
  P('Feijão carioca — 1 kg', 'Mercearia', 799),
  P('Café torrado — 500 g', 'Mercearia', 1890),
  P('Refrigerante 2 L', 'Bebidas', 899),
  P('Água mineral 1,5 L', 'Bebidas', 350),
  P('Detergente 500 ml', 'Limpeza', 299),
  P('Sabão em pó — 1,6 kg', 'Limpeza', 2190),
];
const SECTIONS = ['Hortifrúti', 'Padaria', 'Mercearia', 'Bebidas', 'Limpeza'];
const catalog = {
  categories: SECTIONS.map((name) => ({
    name,
    products: PRODUCTS.filter((p) => p.category === name).map((p) => ({ id: `@product:${p.name}`, name: p.name, price_cents: p.price_cents })),
  })),
};

export const mercado: WaTemplate = {
  key: 'mercado',
  name: 'Mercado / delivery',
  description: 'Compras pelo WhatsApp: catálogo por seções, carrinho, taxa de entrega com frete grátis acima de um valor, pedido mínimo, PIX ou pagamento na entrega e o que fazer quando faltar um item.',
  icon: 'shopping-cart',
  highlights: [
    '12 produtos em 5 seções (hortifrúti, padaria, mercearia, bebidas, limpeza)',
    'Entrega R$ 7 (grátis acima de R$ 150) ou retirada; pedido mínimo R$ 40',
    'PIX ou pagamento na entrega',
    'Pergunta o que fazer se faltar um item',
    'Bot: pedido, meus pedidos, ofertas da semana, horário',
  ],
  products: PRODUCTS,
  custom_fields: CUSTOM_FIELDS,
  tags: [
    { name: 'Cliente delivery', color: '#f97316' },
    { name: 'Compra toda semana', color: '#16a34a' },
    { name: 'Pediu substituição', color: '#0ea5e9' },
  ],
  pipeline_stages: [
    { name: 'Primeira compra', color: '#38bdf8', kind: 'open' },
    { name: 'Cliente frequente', color: '#16a34a', kind: 'won' },
  ],
  orders: { settings: ORDER_SETTINGS },
  bot: { name: 'Mercado — pedidos', definition: f.build(), settings: TEMPLATE_BOT_SETTINGS },
  fixture: {
    identity: { require_doc: false },
    customer: null,
    custom_fields: CUSTOM_FIELDS,
    catalog,
    order_settings: ORDER_SETTINGS,
    addresses: [],
    orders: [],
  },
  scenarios: [
    {
      name: 'Pedido com entrega (endereço digitado) e PIX',
      steps: [
        { send: 'oi', expect: { contains: ['Mercadinho Bom Preço'], waiting_for: 'menu' } },
        { send: '1', expect: { contains: ['Escolha uma seção', 'Hortifrúti', 'Limpeza'] } },
        { send: '3', expect: { contains: ['Arroz tipo 1'] } },
        { send: '1' },
        { send: '2', expect: { contains: ['2× Arroz tipo 1'] } },
        { send: '1' },
        { send: '4' },
        { send: '1' },
        { send: '3', expect: { contains: ['3× Refrigerante 2 L'] } },
        { send: '2', expect: { contains: ['Como você quer receber o pedido?'] } },
        { send: '1', expect: { contains: ['Digite o endereço completo'] } },
        { send: 'Rua São João, 45, apto 12, Centro' },
        { send: '1', expect: { contains: ['Se faltar algum item'] } },
        { send: '1' },
        { send: 'pular' },
        { send: '1', expect: { contains: ['Resumo do pedido', 'Pode trocar por um parecido'] } },
        { send: '1', expect: { charge: true, waiting_for: 'charge' } },
        { event: 'charge_paid', expect: { contains: ['confirmado ✅', 'Obrigado pela preferência'], tags: ['Cliente delivery'], ended: true } },
      ],
    },
    {
      name: 'Pedido abaixo do mínimo → completa, retira e paga na retirada',
      steps: [
        { send: 'olá' },
        { send: 'pedido' },
        { send: '2' },
        { send: '2' },
        { send: '1' },
        { send: '2', expect: { contains: ['pedido mínimo', 'R$ 40,00'], waiting_for: 'order:cart' } },
        { send: '1' },
        { send: '3' },
        { send: '1' },
        { send: '1', expect: { contains: ['1× Arroz tipo 1', '1× Bolo de fubá'] } },
        { send: '2', expect: { contains: ['Como você quer receber o pedido?'] } },
        { send: '2', expect: { contains: ['Se faltar algum item'] } },
        { send: '2' },
        { send: 'sem sacola plástica', expect: { contains: ['Pagar na retirada'] } },
        { send: '2', expect: { contains: ['Resumo do pedido', 'Retirada no local', 'Me chame antes de trocar'] } },
        { send: '1', expect: { contains: ['recebido ✅'], charge: false, tags: ['Cliente delivery'], ended: true } },
      ],
    },
    {
      name: 'Ofertas da semana → pedir agora',
      steps: [
        { send: 'oi' },
        { send: 'ofertas', expect: { contains: ['Ofertas da semana', 'Banana prata', 'Quer aproveitar e fazer o pedido?'] } },
        { send: '1', expect: { contains: ['Escolha uma seção'], waiting_for: 'order:category' } },
      ],
    },
  ],
};
