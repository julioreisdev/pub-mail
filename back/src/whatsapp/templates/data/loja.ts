import type { WaTemplate } from '../wa-template.types';
import { flow, TEMPLATE_BOT_SETTINGS } from './_flow';

// Loja (moda / varejo): catálogo de produtos avulsos por categoria, pedido com entrega ou retirada e PIX ou
// pagamento na entrega. Fluxo: fazer pedido · meus pedidos · trocas e devoluções · atendente.

const CUSTOM_FIELDS = {
  customer: [
    { key: 'data_aniversario', label: 'Aniversário', type: 'date', required: false, visible_to_customer: false, ask_in_bot: false, help: 'Para mandar o cupom de aniversário' },
    { key: 'tamanho_preferido', label: 'Tamanho que costuma usar', type: 'select', options: ['PP', 'P', 'M', 'G', 'GG'], required: false, visible_to_customer: true, ask_in_bot: false },
  ],
  order: [
    { key: 'presente', label: 'É para presente? (embalagem especial)', type: 'bool', required: false, visible_to_customer: true, ask_in_bot: true },
  ],
};

const ORDER_SETTINGS = {
  enabled: true,
  delivery: { enabled: true, fee_cents: 1200, free_from_cents: 19900 },
  pickup: { enabled: true, address: 'Rua XV de Novembro, 480 — Centro (seg a sáb, 9h às 19h)' },
  min_order_cents: 3000,
  payment_methods: ['pix', 'on_delivery'],
  max_items: 20,
  texts: {
    created: 'Recebemos o seu pedido *#{{pedido.numero}}* 🛍️ Total: {{pedido.total}}. Já vamos separar!',
    out_for_delivery: 'Seu pedido *#{{pedido.numero}}* saiu para entrega 🛵',
    delivered: 'Pedido *#{{pedido.numero}}* entregue ✅ Obrigado pela compra! 💜',
  },
};

const f = flow('loj');
const oPedido = f.opt('Fazer um pedido', ['pedido', 'comprar', 'catalogo', 'produtos']);
const oMeus = f.opt('Meus pedidos', ['meus pedidos', 'rastrear', 'entrega', 'status']);
const oTrocas = f.opt('Trocas e devoluções', ['troca', 'trocar', 'devolucao', 'devolver']);
const oAtend = f.opt('Falar com uma vendedora', ['atendente', 'vendedora', 'humano', 'pessoa']);
const menu = f.menu('Menu principal', 'Oi, {{primeiro_nome}}! 💜 Bem-vinda à *Bella Moda*.\nO que você quer fazer?', [oPedido, oMeus, oTrocas, oAtend], 1, 1);
const atend = f.handoff('Vendedora', 'Já chamo uma vendedora para te atender 💜 Só um instante!', 2, 4);
const fim = f.end('Encerrar', 'Obrigada! Quando quiser, é só mandar *menu* 💜', 5, 2);
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
    choose_category: 'O que você procura hoje? 🛍️ Escolha uma categoria:',
    ask_notes: 'Quer deixar alguma observação? (ex.: tamanho, cor, troco para R$ 100) — ou responda *pular*.',
    paid: 'Pagamento do pedido *#{{pedido.numero}}* confirmado ✅ Já vamos separar tudo com carinho!',
  },
}, 2, 0);
const tagCliente = f.tags('Etiqueta cliente', ['@tag:Comprou pelo WhatsApp'], 3, 0);
const obrigado = f.end('Pedido feito', 'Obrigada pela compra! 💜 Você recebe aqui cada atualização do pedido. Para acompanhar, mande *menu* → Meus pedidos.', 4, 0);
f.links(menu, [[oPedido, pedido]]);
f.link(pedido, 'paid', tagCliente);
f.link(pedido, 'out', tagCliente);
f.link(tagCliente, 'out', obrigado);
f.link(pedido, 'expired', fim);
f.link(pedido, 'canceled', fim);
f.link(pedido, 'failed', atend);

// 2 — meus pedidos
const meus = f.node('my_orders', { title: 'Meus pedidos', show: 'open' }, 2, 2);
f.links(menu, [[oMeus, meus]]);
f.link(meus, 'out', fim);
f.link(meus, 'none', menu);
f.link(meus, 'failed', atend);

// 3 — trocas
const trocas = f.msg('Política de trocas', [
  '🔄 *Trocas e devoluções*\n\n• Troca em até *30 dias* com etiqueta e nota fiscal\n• Devolução por arrependimento em até *7 dias* após o recebimento\n• Peças em promoção trocam só por defeito\n\nPara trocar, traga a peça na loja ou fale com uma vendedora por aqui.',
], 2, 3);
const oTrocarAgora = f.opt('Quero trocar uma peça', ['trocar', 'quero']);
const oVoltar = f.opt('Voltar ao menu', ['voltar', 'menu']);
const trocaMenu = f.menu('Trocar agora?', 'Posso te ajudar com isso?', [oTrocarAgora, oVoltar], 3, 3);
const tagTroca = f.tags('Etiqueta troca', ['@tag:Troca solicitada'], 4, 3);
const atendTroca = f.handoff('Vendedora (troca)', 'Combinado! Uma vendedora já vai te ajudar com a troca 💜 Se puder, mande uma foto da peça e o número do pedido.', 5, 3);
f.links(menu, [[oTrocas, trocas]]);
f.link(trocas, 'out', trocaMenu);
f.links(trocaMenu, [[oTrocarAgora, tagTroca], [oVoltar, menu]]);
f.link(trocaMenu, 'invalid', atend);
f.link(tagTroca, 'out', atendTroca);

const P = (name: string, category: string, cents: number, description: string) => ({ name, description, price_cents: cents, billing: 'once', kind: 'product', category });
const PRODUCTS = [
  P('Camiseta básica algodão', 'Camisetas', 5990, '100% algodão, várias cores.'),
  P('Camiseta estampada', 'Camisetas', 7990, 'Estampas exclusivas da coleção.'),
  P('Calça jeans slim', 'Calças e shorts', 15990, 'Jeans com elastano, lavagem média.'),
  P('Bermuda sarja', 'Calças e shorts', 9990, 'Sarja leve, bolsos faca.'),
  P('Boné aba curva', 'Acessórios', 4990, 'Ajuste traseiro com fivela.'),
  P('Kit 3 meias cano alto', 'Acessórios', 3490, 'Algodão penteado.'),
];
const cat = (name: string) => ({
  name,
  products: PRODUCTS.filter((p) => p.category === name).map((p) => ({ id: `@product:${p.name}`, name: p.name, price_cents: p.price_cents })),
});

export const loja: WaTemplate = {
  key: 'loja',
  name: 'Loja (moda e varejo)',
  description: 'Catálogo por categoria, pedido pelo WhatsApp com entrega ou retirada na loja, PIX ou pagamento na entrega, e acompanhamento do pedido pelo bot.',
  icon: 'shopping-bag',
  highlights: [
    '6 produtos em 3 categorias (catálogo do pedido)',
    'Entrega com taxa (grátis acima de R$ 199) ou retirada na loja',
    'PIX ou pagamento na entrega; pedido mínimo de R$ 30',
    'Bot: fazer pedido, meus pedidos, trocas e devoluções',
  ],
  products: PRODUCTS,
  custom_fields: CUSTOM_FIELDS,
  tags: [
    { name: 'Comprou pelo WhatsApp', color: '#8b5cf6' },
    { name: 'Cliente VIP', color: '#f59e0b' },
    { name: 'Troca solicitada', color: '#0ea5e9' },
    { name: 'Carrinho abandonado', color: '#ef4444' },
  ],
  pipeline_stages: [
    { name: 'Interessada', color: '#38bdf8', kind: 'open' },
    { name: 'Pedido feito', color: '#6366f1', kind: 'open' },
    { name: 'Cliente recorrente', color: '#16a34a', kind: 'won' },
  ],
  orders: { settings: ORDER_SETTINGS },
  bot: { name: 'Loja — vendas', definition: f.build(), settings: TEMPLATE_BOT_SETTINGS },
  fixture: {
    identity: { require_doc: false },
    customer: null,
    custom_fields: CUSTOM_FIELDS,
    catalog: { categories: [cat('Camisetas'), cat('Calças e shorts'), cat('Acessórios')] },
    order_settings: ORDER_SETTINGS,
    addresses: [{ id: 'fx-addr-1', kind: 'delivery', label: 'Casa', street: 'Rua das Palmeiras', number: '85', district: 'Jardim América', city: 'Curitiba', state: 'PR', zip: '80000000', is_default: true }],
    orders: [{
      id: 'fx-ord-1', number: 1042, status: 'out_for_delivery', payment_method: 'pix', payment_status: 'paid',
      items: [{ product_id: '@product:Calça jeans slim', name: 'Calça jeans slim', qty: 1, unit_cents: 15990, total_cents: 15990 }],
      subtotal_cents: 15990, delivery_fee_cents: 1200, total_cents: 17190, delivery: { mode: 'delivery', address: { street: 'Rua das Palmeiras', number: '85', district: 'Jardim América' } },
      created_at: '2026-10-12T15:00:00.000Z',
    }],
  },
  scenarios: [
    {
      name: 'Pedido com entrega no endereço salvo e PIX',
      steps: [
        { send: 'oi', expect: { contains: ['Bella Moda'], waiting_for: 'menu' } },
        { send: '1', expect: { contains: ['O que você procura hoje?', 'Camisetas'] } },
        { send: '1', expect: { contains: ['Camiseta básica algodão'] } },
        { send: '1' },
        { send: '2', expect: { contains: ['2× Camiseta básica algodão', 'Finalizar pedido'] } },
        { send: '2', expect: { contains: ['Como você quer receber o pedido?'] } },
        { send: '1', expect: { contains: ['Rua das Palmeiras'] } },
        { send: '1', expect: { contains: ['É para presente?'] } },
        { send: 'sim' },
        { send: 'tamanho M, cor preta' },
        { send: '1', expect: { contains: ['Resumo do pedido', 'Total'] } },
        { send: '1', expect: { charge: true, waiting_for: 'charge' } },
        { event: 'charge_paid', expect: { contains: ['confirmado ✅', 'Obrigada pela compra'], tags: ['Comprou pelo WhatsApp'], ended: true } },
      ],
    },
    {
      name: 'Retirada na loja pagando na retirada',
      steps: [
        { send: 'olá' },
        { send: 'pedido' },
        { send: '3' },
        { send: '1' },
        { send: '1' },
        { send: '2' },
        { send: '2' },
        { send: 'pular' },
        { send: 'pular' },
        { send: '2' },
        { send: '1', expect: { contains: ['recebido ✅', 'Retirada no local'], charge: false, tags: ['Comprou pelo WhatsApp'], ended: true } },
      ],
    },
    {
      name: 'Acompanhar pedido',
      steps: [
        { send: 'oi' },
        { send: '2', expect: { contains: ['1042', 'Saiu para entrega'], ended: true } },
      ],
    },
  ],
};
