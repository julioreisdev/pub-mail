import type { WaTemplate } from '../wa-template.types';
import { flow, TEMPLATE_BOT_SETTINGS } from './_flow';

// Conteúdo VIP / comunidade paga: plano mensal e anual, assinatura e pagamento pelo próprio WhatsApp (PIX),
// 2ª via, troca de plano e cancelamento com motivo. Os planos já liberam a etiqueta "Membro VIP" ao pagar
// (e tiram no atraso/cancelamento); o grupo VIP fica para o dono acrescentar em Produtos → "Ao pagar, liberar…"
// (o modelo não sabe o id do grupo de cada um).

const CUSTOM_FIELDS = {
  customer: [
    { key: 'instagram', label: 'Instagram', type: 'text', required: false, visible_to_customer: true, ask_in_bot: true, help: 'Seu @ (opcional)' },
    { key: 'como_conheceu', label: 'Como conheceu o Clube', type: 'select', options: ['Instagram', 'YouTube', 'TikTok', 'Indicação de amigo', 'Outro'], required: false, visible_to_customer: false, ask_in_bot: true },
  ],
};

const f = flow('vip');
const oAssinar = f.opt('Quero ser VIP 👑', ['assinar', 'vip', 'quero', 'entrar', 'participar']);
const o2via = f.opt('2ª via / renovar pagamento', ['segunda via', '2 via', 'pix', 'renovar', 'pagar', 'pagamento']);
const oMinha = f.opt('Minha assinatura', ['minha assinatura', 'situacao', 'vencimento']);
const oTrocar = f.opt('Trocar de plano', ['trocar', 'mudar', 'anual', 'mensal']);
const oCancelar = f.opt('Cancelar assinatura', ['cancelar', 'cancelamento', 'sair']);
const oSuporte = f.opt('Falar com o suporte', ['suporte', 'atendente', 'humano', 'ajuda']);
const menu = f.menu('Menu principal', 'Oi, {{primeiro_nome}}! 👑 Bem-vindo(a) ao *Clube VIP Cozinha Prática* — receitas novas toda semana, aulas ao vivo e grupo exclusivo.\n\nComo posso te ajudar?', [oAssinar, o2via, oMinha, oTrocar, oCancelar, oSuporte], 1, 3);
const suporte = f.handoff('Suporte', 'Já chamo alguém do suporte para falar com você 🙂', 2, 10);
const fim = f.end('Encerrar', 'Qualquer coisa, é só mandar *menu* 👑', 7, 5);
f.link('start', 'out', menu);
f.link(menu, 'invalid', suporte);
f.links(menu, [[oSuporte, suporte]]);

// 1 — assinar (cadastra se preciso; só os 2 planos do clube)
const idA = f.node('crm_identify', { title: 'Identificar (assinar)', mode: 'phone', retries: 3 }, 2, 0);
const cad = f.node('crm_register', {
  title: 'Cadastro do membro',
  intro_text: 'Que bom ter você aqui! 💛 Só preciso de alguns dados rapidinho.',
  fields: [
    { key: 'name', label: 'Nome', question: 'Qual é o seu nome?', required: true },
    { key: 'email', label: 'E-mail', question: 'Qual é o seu e-mail? (é por ele que você acessa as aulas)', required: true },
  ],
  confirm: true,
  done_text: 'Cadastro pronto ✅',
}, 3, 1);
const assinar = f.node('crm_subscribe', {
  title: 'Assinar o clube',
  product_id: 'choose',
  product_ids: ['@product:VIP Mensal', '@product:VIP Anual'],
  choose_text: 'Escolha o seu plano 👇 (no anual você ganha 2 meses)',
  method: 'pix',
  charge_now: true,
  confirm: true,
  paid_text: 'Pagamento confirmado ✅ Você agora é membro do *{{produto.nome}}*! 👑',
  expired_text: 'O PIX venceu sem pagamento ⌛ Quando quiser, mande *menu* que eu gero outro.',
}, 4, 0);
const tagMembro = f.tags('Etiqueta membro', ['@tag:Membro VIP'], 5, 0);
const boasVindas = f.end('Boas-vindas', 'Seja muito bem-vindo(a)! 🎉 O link do grupo VIP e o acesso às aulas chegam aqui em instantes. Toda segunda tem receita nova 🍲', 6, 0);
f.links(menu, [[oAssinar, idA]]);
f.link(idA, 'found', assinar);
f.link(idA, 'not_found', cad);
f.link(cad, 'done', assinar);
f.link(cad, 'cancel', fim);
f.link(cad, 'failed', suporte);
f.link(assinar, 'paid', tagMembro);
f.link(assinar, 'subscribed', tagMembro);
f.link(tagMembro, 'out', boasVindas);
f.link(assinar, 'expired', fim);
f.link(assinar, 'declined', fim);
f.link(assinar, 'failed', suporte);

// identificação comum para as opções de quem já é membro (2 a 5) — cada uma com o seu bloco
const naoMembro = f.msg('Não é membro', ['Não encontrei uma assinatura neste número 🤔 Para entrar no clube, escolha *Quero ser VIP* no menu.'], 3, 9);
f.link(naoMembro, 'out', menu);

// 2 — 2ª via
const id2 = f.node('crm_identify', { title: 'Identificar (2ª via)', mode: 'phone', retries: 3 }, 2, 2);
const via = f.node('crm_invoice', { title: '2ª via', which: 'open', method: 'same', sent_text: 'Enviei o PIX acima 👆 Assim que cair, o acesso continua liberado.', nothing_open_text: 'Você não tem pagamento em aberto 🙂 Tudo certo com a sua assinatura!' }, 3, 2);
f.links(menu, [[o2via, id2]]);
f.link(id2, 'found', via);
f.link(id2, 'not_found', naoMembro);
f.link(via, 'sent', fim);
f.link(via, 'nothing_open', fim);
f.link(via, 'failed', suporte);

// 3 — minha assinatura
const id3 = f.node('crm_identify', { title: 'Identificar (minha assinatura)', mode: 'phone', retries: 3 }, 2, 4);
const info = f.node('crm_info', { title: 'Minha assinatura', what: 'subscriptions', template: '👑 *Sua assinatura*\n\n{{assinaturas.lista}}\n\nPrecisa de algo mais? Mande *menu*.' }, 3, 4);
f.links(menu, [[oMinha, id3]]);
f.link(id3, 'found', info);
f.link(id3, 'not_found', naoMembro);
f.link(info, 'out', fim);

// 4 — trocar de plano
const id4 = f.node('crm_identify', { title: 'Identificar (trocar)', mode: 'phone', retries: 3 }, 2, 6);
const trocar = f.node('crm_change_plan', {
  title: 'Trocar de plano',
  product_ids: ['@product:VIP Mensal', '@product:VIP Anual'],
  choose_text: 'Para qual plano você quer mudar?',
  confirm: true,
  changed_text: 'Pronto! Seu plano agora é *{{produto.nome}}* ✅ A diferença é ajustada na próxima cobrança.',
}, 3, 6);
f.links(menu, [[oTrocar, id4]]);
f.link(id4, 'found', trocar);
f.link(id4, 'not_found', naoMembro);
f.link(trocar, 'changed', fim);
f.link(trocar, 'kept', fim);
f.link(trocar, 'failed', suporte);

// 5 — cancelar (motivo + tentativa de retenção)
const id5 = f.node('crm_identify', { title: 'Identificar (cancelar)', mode: 'phone', retries: 3 }, 2, 8);
const cancelar = f.node('crm_cancel', {
  title: 'Cancelar assinatura',
  subscription: 'single',
  ask_reason: true,
  reason_text: 'Poxa, que pena 😢 Pode me contar o motivo?',
  reasons: ['Está caro para mim agora', 'Não tenho tempo de acompanhar', 'O conteúdo não era o que eu esperava', 'Outro motivo'],
  retention_text: 'Antes de confirmar: no plano *pausar por 30 dias* você não paga nada e não perde o histórico. É só falar com o suporte 💛',
  policy: 'product',
  canceled_text: 'Assinatura cancelada. {{assinatura.fim_texto}} Obrigado por ter feito parte do clube 💛',
  kept_text: 'Que bom que você fica! 💛 Sua assinatura continua como está.',
}, 3, 8);
const tagCancelou = f.tags('Etiqueta cancelou', ['@tag:Cancelou VIP'], 4, 8, ['@tag:Membro VIP']);
f.links(menu, [[oCancelar, id5]]);
f.link(id5, 'found', cancelar);
f.link(id5, 'not_found', naoMembro);
f.link(cancelar, 'canceled', tagCancelou);
f.link(tagCancelou, 'out', fim);
f.link(cancelar, 'kept', fim);
f.link(cancelar, 'failed', suporte);

const PM = '@product:VIP Mensal';
const PA = '@product:VIP Anual';
const BRUNO = {
  id: 'fx-bruno', name: 'Bruno Carvalho', doc_masked: '', email: 'bruno@exemplo.com', status: 'ok', verified: true, custom: { instagram: '@brunocozinha' },
  subscriptions: [{ id: 'fx-sub-1', product_id: PM, product_name: 'VIP Mensal', price_cents: 3990, billing: 'monthly', status: 'active', next_due_at: '2026-11-02', next_due_label: '02/11/2026', days_overdue: 0, due_day: 2, cancel_at: null, paused_until: null }],
  open_charges: [{ id: 'fx-chg-1', amount_cents: 3990, description: 'VIP Mensal — novembro', due_at: '2026-11-02', due_label: '02/11/2026', days_overdue: 0, kind: 'pix', pix_code: null, boleto_url: null, status: 'PENDING' }],
};

export const vip: WaTemplate = {
  key: 'vip',
  name: 'Conteúdo VIP / comunidade',
  description: 'Clube de assinatura com plano mensal e anual: o membro assina e paga por PIX no próprio WhatsApp, pede 2ª via, troca de plano e cancela com motivo — tudo pelo bot.',
  icon: 'crown',
  highlights: [
    'Planos VIP Mensal e Anual (+ mentoria avulsa)',
    'Assinatura e 1º pagamento por PIX direto no bot',
    'Troca de plano e cancelamento com motivo e retenção',
    'Etiquetas de membro e de cancelado para remarketing',
  ],
  products: [
    { name: 'VIP Mensal', description: 'Receitas novas toda semana, aulas ao vivo e grupo exclusivo.', price_cents: 3990, billing: 'monthly', kind: 'plan', category: 'Clube', grace_days: 3, cancel_policy: 'end_of_cycle', entitlement: { rules: [{ kind: 'tag', ref: '@tag:Membro VIP', label: 'Etiqueta Membro VIP', on_overdue: 'suspend' }] } },
    { name: 'VIP Anual', description: 'Tudo do mensal com 2 meses grátis.', price_cents: 39900, billing: 'yearly', kind: 'plan', category: 'Clube', grace_days: 3, cancel_policy: 'end_of_cycle', entitlement: { rules: [{ kind: 'tag', ref: '@tag:Membro VIP', label: 'Etiqueta Membro VIP', on_overdue: 'suspend' }] } },
    { name: 'Mentoria individual (1 h)', description: 'Encontro online para montar o seu cardápio da semana.', price_cents: 19700, billing: 'once', kind: 'product', category: 'Extras' },
  ],
  custom_fields: CUSTOM_FIELDS,
  tags: [
    { name: 'Membro VIP', color: '#f59e0b' },
    { name: 'Lead VIP', color: '#38bdf8' },
    { name: 'Cancelou VIP', color: '#ef4444' },
  ],
  pipeline_stages: [
    { name: 'Interessado no VIP', color: '#38bdf8', kind: 'open' },
    { name: 'Aguardando pagamento', color: '#f59e0b', kind: 'open' },
    { name: 'Membro ativo', color: '#16a34a', kind: 'won' },
    { name: 'Desistiu', color: '#ef4444', kind: 'lost' },
  ],
  bot: { name: 'Clube VIP — atendimento', definition: f.build(), settings: TEMPLATE_BOT_SETTINGS },
  fixture: {
    identity: { require_doc: false },
    customer: BRUNO,
    products: [
      { id: PM, name: 'VIP Mensal', price_cents: 3990, billing: 'monthly', cancel_policy: 'end_of_cycle' },
      { id: PA, name: 'VIP Anual', price_cents: 39900, billing: 'yearly', cancel_policy: 'end_of_cycle' },
      { id: '@product:Mentoria individual (1 h)', name: 'Mentoria individual (1 h)', price_cents: 19700, billing: 'once' },
    ],
    custom_fields: CUSTOM_FIELDS,
    cancel_reasons: ['Está caro para mim agora', 'Não tenho tempo de acompanhar', 'Outro motivo'],
  },
  scenarios: [
    {
      name: 'Novo membro: cadastra, assina o anual e paga',
      fixture: { customer: null },
      steps: [
        { send: 'quero ser vip', expect: { contains: ['Clube VIP Cozinha Prática'], waiting_for: 'menu' } },
        { send: '1', expect: { contains: ['alguns dados', 'Qual é o seu nome?'] } },
        { send: 'Juliana Martins' },
        { send: 'juliana@exemplo.com' },
        { send: '@ju.martins' },
        { send: '1' },
        { send: '1', expect: { contains: ['Cadastro pronto ✅', 'Escolha o seu plano', 'VIP Anual'], not_contains: ['Mentoria'] } },
        { send: '2', expect: { contains: ['*VIP Anual*', 'por ano'] } },
        { send: 'sim', expect: { charge: true, waiting_for: 'charge' } },
        { event: 'charge_paid', expect: { contains: ['Pagamento confirmado ✅', 'link do grupo VIP'], tags: ['Membro VIP'], ended: true } },
      ],
    },
    {
      name: 'Membro troca do mensal para o anual',
      steps: [
        { send: 'oi' },
        { send: '4', expect: { contains: ['Para qual plano você quer mudar?', 'VIP Anual'], not_contains: ['Mentoria'] } },
        { send: '1' },
        { send: '1', expect: { contains: ['Seu plano agora é *VIP Anual*'], ended: true } },
      ],
    },
    {
      name: 'Membro cancela informando o motivo',
      steps: [
        { send: 'oi' },
        { send: 'cancelar', expect: { contains: ['Pode me contar o motivo?', 'Não tenho tempo de acompanhar'] } },
        { send: '2', expect: { contains: ['pausar por 30 dias', 'Confirma o cancelamento'] } },
        { send: '1', expect: { contains: ['Assinatura cancelada', 'Obrigado por ter feito parte do clube'], tags: ['Cancelou VIP'], ended: true } },
      ],
    },
    {
      name: '2ª via do PIX',
      steps: [
        { send: 'oi' },
        { send: '2', expect: { contains: ['Enviei o PIX acima'], charge: true, ended: true } },
      ],
    },
  ],
};
