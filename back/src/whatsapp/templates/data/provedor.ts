import type { WaTemplate } from '../wa-template.types';
import { flow, TEMPLATE_BOT_SETTINGS } from './_flow';

// Provedor de internet: planos mensais (velocidade como campo do produto), endereço de instalação, chamados técnicos
// com prazo (SLA) por categoria. Fluxo: contratar · 2ª via · sem internet (checa atraso → 2ª via, senão roteiro
// rápido e abre chamado) · meus chamados · meu plano · atendente.

const CUSTOM_FIELDS = {
  product: [
    { key: 'velocidade', label: 'Velocidade', type: 'text', required: false, visible_to_customer: true, ask_in_bot: false, help: 'Ex.: 300 Mega' },
    { key: 'wifi_incluso', label: 'Roteador Wi-Fi incluso', type: 'bool', required: false, visible_to_customer: true, ask_in_bot: false },
  ],
  customer: [
    { key: 'ponto_referencia', label: 'Ponto de referência', type: 'text', required: false, visible_to_customer: true, ask_in_bot: true, help: 'Ajuda o técnico a achar o endereço de instalação' },
    { key: 'tipo_imovel', label: 'Tipo de imóvel', type: 'select', options: ['Casa', 'Apartamento', 'Comércio', 'Zona rural'], required: false, visible_to_customer: true, ask_in_bot: false },
  ],
  subscription: [
    { key: 'login_pppoe', label: 'Login PPPoE', type: 'text', required: false, visible_to_customer: false, ask_in_bot: false },
    { key: 'serial_onu', label: 'Serial da ONU', type: 'text', required: false, visible_to_customer: false, ask_in_bot: false },
  ],
  ticket: [
    { key: 'luz_onu', label: 'Luz vermelha (LOS) acesa no aparelho', type: 'select', options: ['Sim', 'Não', 'Não sei'], required: false, visible_to_customer: true, ask_in_bot: true },
  ],
};

const CATEGORIES = [
  { key: 'sem-conexao', label: 'Estou sem internet', sla_hours: 8, first_response_hours: 1, default_priority: 'high', description: 'Sem sinal / sem navegação' },
  { key: 'lentidao', label: 'Internet lenta ou caindo', sla_hours: 24, first_response_hours: 4, default_priority: 'normal' },
  { key: 'wifi', label: 'Problema no Wi-Fi / roteador', sla_hours: 48, first_response_hours: 8, default_priority: 'normal' },
  { key: 'mudanca-endereco', label: 'Mudança de endereço', sla_hours: 120, first_response_hours: 24, default_priority: 'low' },
  { key: 'financeiro', label: 'Fatura / financeiro', sla_hours: 48, first_response_hours: 8, default_priority: 'normal' },
];

const f = flow('isp');
const oContratar = f.opt('Contratar internet', ['contratar', 'assinar', 'planos', 'plano', 'instalar']);
const o2via = f.opt('2ª via da fatura', ['segunda via', '2 via', 'boleto', 'fatura', 'pix']);
const oSemNet = f.opt('Estou sem internet / suporte', ['sem internet', 'suporte', 'lenta', 'caiu', 'nao funciona', 'tecnico']);
const oChamados = f.opt('Acompanhar meus chamados', ['protocolo', 'chamado', 'chamados']);
const oPlano = f.opt('Meu plano e situação', ['meu plano', 'situacao', 'vencimento']);
const oAtend = f.opt('Falar com atendente', ['atendente', 'humano', 'pessoa']);
const menu = f.menu('Menu principal', 'Olá, {{primeiro_nome}}! 👋 Aqui é a *Conecta Fibra* 🌐\nEscolha uma opção:', [oContratar, o2via, oSemNet, oChamados, oPlano, oAtend], 1, 2);
const atend = f.handoff('Atendente', 'Certo! Já vou te passar para um atendente. Só um instante 🙂', 2, 9);
const fim = f.end('Encerrar', 'Precisando, é só mandar *menu* 😉 Obrigado por ser Conecta Fibra!', 6, 4);
f.link('start', 'out', menu);
f.link(menu, 'invalid', atend);
f.links(menu, [[oAtend, atend]]);

// 1 — contratar (cadastra se preciso; assinatura começa sem cobrar — a 1ª fatura vem depois da instalação)
const idC = f.node('crm_identify', { title: 'Identificar (contratar)', mode: 'phone', retries: 3 }, 2, 0);
const cad = f.node('crm_register', {
  title: 'Cadastro do assinante',
  intro_text: 'Vamos fazer o seu cadastro para a instalação 📝',
  fields: [
    { key: 'name', label: 'Nome completo', question: 'Qual é o nome completo do titular?', required: true },
    { key: 'doc', label: 'CPF/CNPJ', question: 'Qual é o CPF ou CNPJ do titular? (só números)', required: true },
    { key: 'address.zip', label: 'CEP', question: 'Qual é o CEP do endereço de instalação?', required: true },
    { key: 'address.street', label: 'Rua', question: 'Qual é a rua?', required: true },
    { key: 'address.number', label: 'Número', question: 'Qual é o número?', required: true },
    { key: 'address.district', label: 'Bairro', question: 'Qual é o bairro?', required: true },
    { key: 'email', label: 'E-mail', question: 'Qual é o seu e-mail? (para receber a fatura)', required: false },
  ],
  confirm: true,
  done_text: 'Cadastro feito ✅',
}, 3, 1);
const assinar = f.node('crm_subscribe', {
  title: 'Escolher plano',
  product_id: 'choose',
  product_ids: ['@product:Fibra 300 Mega', '@product:Fibra 600 Mega', '@product:Fibra 1 Giga'],
  choose_text: 'Qual plano combina com você? 🚀 (todos com Wi-Fi incluso e sem franquia)',
  method: 'pix',
  charge_now: false,
  confirm: true,
  confirm_text: 'Você escolheu *{{produto.nome}}* por *{{produto.valor}}*{{produto.periodo}}.\nA 1ª fatura só vem depois da instalação.\n\n1️⃣ Confirmar\n2️⃣ Agora não',
  subscribed_text: 'Pedido de instalação registrado ✅ Plano *{{produto.nome}}*.',
}, 4, 0);
const tagLead = f.tags('Etiqueta instalação', ['@tag:Instalação pendente'], 5, 0);
const agendaInst = f.handoff('Agendar instalação', 'Nossa equipe vai confirmar a viabilidade no seu endereço e combinar o melhor dia para a instalação 🛠️ Já te passo para um atendente.', 6, 0);
f.links(menu, [[oContratar, idC]]);
f.link(idC, 'found', assinar);
f.link(idC, 'not_found', cad);
f.link(cad, 'done', assinar);
f.link(cad, 'cancel', fim);
f.link(cad, 'failed', atend);
f.link(assinar, 'subscribed', tagLead);
f.link(assinar, 'paid', tagLead);
f.link(tagLead, 'out', agendaInst);
f.link(assinar, 'declined', fim);
f.link(assinar, 'expired', fim);
f.link(assinar, 'failed', atend);

// 2 — 2ª via
const id2 = f.node('crm_identify', { title: 'Identificar (2ª via)', mode: 'org', retries: 3 }, 2, 2);
const via = f.node('crm_invoice', {
  title: '2ª via',
  which: 'open',
  method: 'same',
  sent_text: 'Enviei a sua fatura acima 👆 Pagando pelo PIX, a liberação é automática em poucos minutos.',
  nothing_open_text: 'Você não tem fatura em aberto 🙂 Tudo em dia!',
}, 3, 2);
const naoAchou = f.handoff('Não encontrado', 'Não encontrei o seu cadastro 🤔 Vou te passar para um atendente conferir.', 3, 3);
f.links(menu, [[o2via, id2]]);
f.link(id2, 'found', via);
f.link(id2, 'not_found', naoAchou);
f.link(id2, 'invalid', naoAchou);
f.link(via, 'sent', fim);
f.link(via, 'nothing_open', fim);
f.link(via, 'failed', atend);

// 3 — sem internet: em atraso → 2ª via; senão roteiro rápido → chamado
const id3 = f.node('crm_identify', { title: 'Identificar (suporte)', mode: 'phone', retries: 3 }, 2, 4);
const atraso = f.node('condition', { title: 'Está em atraso?', match: 'all', rules: [{ id: 'isp-r1', source: 'customer', key: 'status', op: 'is', value: 'overdue' }] }, 3, 4);
const msgAtraso = f.msg('Aviso de atraso', ['Identifiquei uma fatura em atraso no seu cadastro, {{cliente.primeiro_nome}} — por isso a conexão pode estar bloqueada 🔒 Vou te enviar a 2ª via: pagando pelo PIX, a internet volta em poucos minutos.'], 4, 3);
const roteiro = f.msg('Roteiro rápido', ['Vamos tentar resolver juntos 🔧\n\n1. Tire o roteador e a ONU (o aparelho da fibra) da tomada\n2. Espere 30 segundos\n3. Ligue de novo e aguarde 2 minutos até as luzes estabilizarem'], 4, 5);
const oSim = f.opt('Sim, voltou 🎉', ['sim', 'voltou', 'resolveu', 'funcionou']);
const oNao = f.opt('Não, quero abrir um chamado', ['nao', 'chamado', 'abrir']);
const resolveu = f.menu('Resolveu?', 'Funcionou?', [oSim, oNao], 5, 5);
const chamado = f.node('open_ticket', {
  title: 'Abrir chamado técnico',
  category: 'ask',
  ask_subject: false,
  ask_photo: true,
  priority: 'default',
  texts: {
    choose_category: 'Certo, vou abrir um chamado técnico 🛠️ Qual é o problema? (ou *0* para cancelar)',
    ask_description: 'Me conte o que está acontecendo (desde quando, se é em todos os aparelhos…) 📝',
    ask_photo: 'Se puder, mande uma foto do aparelho da fibra com as luzes acesas 📸 Quando terminar, digite *pronto*. Para pular, digite *0*.',
  },
}, 6, 5);
const fimChamado = f.end('Chamado aberto', 'Você pode acompanhar pelo *menu*, opção 4 🙂 Obrigado pela paciência!', 7, 5);
const voltou = f.end('Voltou', 'Que bom que voltou! 🎉 Qualquer coisa, é só mandar *menu*.', 6, 6);
f.links(menu, [[oSemNet, id3]]);
f.link(id3, 'found', atraso);
f.link(id3, 'not_found', roteiro);
f.link(atraso, 'true', msgAtraso);
f.link(atraso, 'false', roteiro);
f.link(msgAtraso, 'out', via);
f.link(roteiro, 'out', resolveu);
f.links(resolveu, [[oSim, voltou], [oNao, chamado]]);
f.link(resolveu, 'invalid', chamado);
f.link(chamado, 'out', fimChamado);
f.link(chamado, 'cancel', fim);
f.link(chamado, 'failed', atend);

// 4 — meus chamados
const meus = f.node('my_tickets', { title: 'Meus chamados', show: 'active', allow_add_info: true }, 2, 7);
f.links(menu, [[oChamados, meus]]);
f.link(meus, 'out', fim);
f.link(meus, 'none', menu);
f.link(meus, 'failed', atend);

// 5 — meu plano
const id5 = f.node('crm_identify', { title: 'Identificar (meu plano)', mode: 'phone', retries: 3 }, 2, 8);
const info = f.node('crm_info', {
  title: 'Situação do plano',
  what: 'status',
  template: 'Olá, {{cliente.primeiro_nome}}! 👋\n\n🌐 *Plano:* {{cliente.produto}}\n💰 *Valor:* {{cliente.valor}}\n📅 *Próximo vencimento:* {{cliente.vencimento}}\n📌 *Situação:* {{cliente.status}}',
}, 3, 8);
f.links(menu, [[oPlano, id5]]);
f.link(id5, 'found', info);
f.link(id5, 'not_found', naoAchou);
f.link(info, 'out', fim);

const PLAN = (name: string, mega: string, cents: number) => ({
  name, description: `${mega} de download, Wi-Fi incluso, sem franquia de dados.`, price_cents: cents, billing: 'monthly', kind: 'plan', category: 'Planos',
  grace_days: 10, cancel_policy: 'end_of_cycle', custom: { velocidade: mega, wifi_incluso: true },
});
const P300 = '@product:Fibra 300 Mega';
const P600 = '@product:Fibra 600 Mega';
const P1G = '@product:Fibra 1 Giga';
const sub300 = { id: 'fx-sub-1', product_id: P300, product_name: 'Fibra 300 Mega', price_cents: 8990, billing: 'monthly', status: 'active', next_due_at: '2026-11-10', next_due_label: '10/11/2026', days_overdue: 0, due_day: 10, cancel_at: null, paused_until: null };
const CARLOS = {
  id: 'fx-carlos', name: 'Carlos Andrade', doc_masked: '***.982.247-**', email: 'carlos@exemplo.com', status: 'ok', verified: true, custom: { ponto_referencia: 'Ao lado da padaria' },
  subscriptions: [sub300],
  open_charges: [{ id: 'fx-chg-1', amount_cents: 8990, description: 'Fibra 300 Mega — novembro', due_at: '2026-11-10', due_label: '10/11/2026', days_overdue: 0, kind: 'pix', pix_code: null, boleto_url: null, status: 'PENDING' }],
};
const CARLOS_ATRASO = {
  ...CARLOS, status: 'overdue',
  subscriptions: [{ ...sub300, status: 'overdue', days_overdue: 12 }],
  open_charges: [{ id: 'fx-chg-0', amount_cents: 8990, description: 'Fibra 300 Mega — setembro', due_at: '2026-10-01', due_label: '01/10/2026', days_overdue: 12, kind: 'pix', pix_code: null, boleto_url: null, status: 'OVERDUE' }],
};

export const provedor: WaTemplate = {
  key: 'provedor',
  name: 'Provedor de internet',
  description: 'Planos de fibra com velocidade no cadastro do produto, endereço de instalação, chamados técnicos com prazo por categoria e um bot que manda a 2ª via, faz o roteiro de suporte e abre o chamado.',
  icon: 'wifi',
  highlights: [
    '3 planos mensais de fibra (velocidade e Wi-Fi como campos do produto)',
    'Chamados técnicos com protocolo NET e prazo por categoria',
    'Cadastro com endereço de instalação e ponto de referência',
    'Bot: contratar, 2ª via, sem internet (checa atraso), meus chamados e meu plano',
  ],
  products: [
    PLAN('Fibra 300 Mega', '300 Mega', 8990),
    PLAN('Fibra 600 Mega', '600 Mega', 10990),
    PLAN('Fibra 1 Giga', '1 Giga', 14990),
    { name: 'Visita técnica avulsa', description: 'Visita fora da garantia (ex.: cabeamento interno, troca de cômodo).', price_cents: 6000, billing: 'once', kind: 'product', category: 'Serviços' },
    { name: 'Mudança de endereço', description: 'Retirada e reinstalação no novo endereço (sujeito à viabilidade).', price_cents: 8000, billing: 'once', kind: 'product', category: 'Serviços' },
  ],
  custom_fields: CUSTOM_FIELDS,
  tags: [
    { name: 'Instalação pendente', color: '#f59e0b' },
    { name: 'Cliente ativo', color: '#16a34a' },
    { name: 'Em atraso', color: '#dc2626' },
    { name: 'Suporte técnico', color: '#0ea5e9' },
    { name: 'Visita agendada', color: '#8b5cf6' },
  ],
  pipeline_stages: [
    { name: 'Lead', color: '#38bdf8', kind: 'open' },
    { name: 'Viabilidade', color: '#6366f1', kind: 'open' },
    { name: 'Instalação agendada', color: '#f59e0b', kind: 'open' },
    { name: 'Instalado', color: '#16a34a', kind: 'won' },
    { name: 'Sem viabilidade', color: '#ef4444', kind: 'lost' },
  ],
  tickets: {
    categories: CATEGORIES,
    settings: { prefix: 'NET', reset_yearly: true, sla_hours: { low: 120, normal: 48, high: 8, urgent: 4 }, warn_before_minutes: 60, auto_close_days: 5, reopen_days: 7 },
  },
  bot: { name: 'Provedor — atendimento', definition: f.build(), settings: TEMPLATE_BOT_SETTINGS },
  fixture: {
    identity: { require_doc: false },
    customer: CARLOS,
    products: [
      { id: P300, name: 'Fibra 300 Mega', price_cents: 8990, billing: 'monthly' },
      { id: P600, name: 'Fibra 600 Mega', price_cents: 10990, billing: 'monthly' },
      { id: P1G, name: 'Fibra 1 Giga', price_cents: 14990, billing: 'monthly' },
    ],
    custom_fields: CUSTOM_FIELDS,
    tickets: {
      categories: CATEGORIES,
      tickets: [{ id: 'fx-tk-1', protocol: 'NET2026000031', status: 'pending', category: 'lentidao', category_label: 'Internet lenta ou caindo', subject: 'Internet cai à noite', sla_label: '15/10 às 18:00', last_update: 'Pode mandar uma foto das luzes do aparelho?' }],
    },
  },
  scenarios: [
    {
      name: 'Sem internet → roteiro → chamado com foto',
      steps: [
        { send: 'oi', expect: { contains: ['Conecta Fibra'], waiting_for: 'menu' } },
        { send: '3', expect: { contains: ['Tire o roteador', 'Funcionou?'], not_contains: ['fatura em atraso'] } },
        { send: '2', expect: { contains: ['Qual é o problema?', 'Estou sem internet'] } },
        { send: '1', expect: { contains: ['Me conte o que está acontecendo'] } },
        { send: 'Desde ontem à noite nenhum aparelho conecta, a luz do aparelho está vermelha' },
        { media: 'image', expect: { contains: ['Recebi ✅'] } },
        { send: 'pronto', expect: { contains: ['Luz vermelha'] } },
        { send: '1', expect: { contains: ['Chamado aberto ✅', 'Protocolo', 'Estou sem internet', 'menu*, opção 4'], ended: true } },
      ],
    },
    {
      name: 'Cliente em atraso sem internet → 2ª via',
      fixture: { customer: CARLOS_ATRASO },
      steps: [
        { send: 'bom dia' },
        { send: 'sem internet', expect: { contains: ['fatura em atraso', 'Enviei a sua fatura acima'], charge: true, ended: true } },
      ],
    },
    {
      name: 'Contratar plano sem cadastro (instalação pendente)',
      fixture: { customer: null },
      steps: [
        { send: 'oi' },
        { send: '1', expect: { contains: ['nome completo do titular'] } },
        { send: 'Fernanda Lopes' },
        { send: '52998224725' },
        { send: '01310-100' },
        { send: 'Av. Paulista' },
        { send: '1000' },
        { send: 'Bela Vista' },
        { send: 'pular' },
        { send: 'Prédio azul, portaria 24h' },
        { send: '1', expect: { contains: ['Cadastro feito ✅', 'Qual plano combina com você?', 'Fibra 600 Mega'] } },
        { send: '2', expect: { contains: ['1ª fatura só vem depois da instalação'] } },
        { send: '1', expect: { contains: ['Pedido de instalação registrado ✅', 'viabilidade'], tags: ['Instalação pendente'], handoff: true } },
      ],
      expect: { charge: false },
    },
    {
      name: 'Acompanhar chamado e mandar mais informações',
      steps: [
        { send: 'oi' },
        { send: '4', expect: { contains: ['NET2026000031', 'Aguardando você', 'Enviar mais informações'] } },
        { send: '1', expect: { contains: ['Pode mandar a informação'] } },
        { send: 'Agora a luz do aparelho está verde, mas a internet continua caindo à noite', expect: { contains: ['Juntei sua mensagem ao protocolo *NET2026000031*'], ended: true } },
      ],
    },
  ],
};
