import type { WaTemplate } from '../wa-template.types';
import { flow, TEMPLATE_BOT_SETTINGS } from './_flow';

// Segurança / monitoramento: planos mensais de monitoramento, ocorrências URGENTES (prazo de 1 h, vai direto
// para a central), chamados de equipamento, dados do imóvel monitorado. Fluxo: ocorrência · 2ª via · problema no
// equipamento · meus chamados · contratar · central.

const CUSTOM_FIELDS = {
  customer: [
    { key: 'tipo_imovel', label: 'Tipo de imóvel', type: 'select', options: ['Casa', 'Apartamento', 'Comércio', 'Galpão / indústria', 'Condomínio'], required: false, visible_to_customer: true, ask_in_bot: true },
    { key: 'palavra_senha', label: 'Palavra-senha de verificação', type: 'text', required: false, visible_to_customer: false, ask_in_bot: false, help: 'A central pergunta por telefone para confirmar que é o titular' },
    { key: 'contatos_emergencia', label: 'Contatos de emergência', type: 'text', required: false, visible_to_customer: true, ask_in_bot: false, help: 'Nome e telefone de quem a central deve ligar' },
  ],
  subscription: [
    { key: 'conta_central', label: 'Conta na central de monitoramento', type: 'text', required: false, visible_to_customer: false, ask_in_bot: false },
  ],
  ticket: [
    { key: 'zona_sensor', label: 'Zona ou sensor (se souber)', type: 'text', required: false, visible_to_customer: true, ask_in_bot: true, help: 'Ex.: zona 3 — porta da cozinha' },
  ],
};

const CATEGORIES = [
  { key: 'ocorrencia', label: 'Ocorrência urgente (disparo / invasão)', sla_hours: 1, first_response_hours: 1, default_priority: 'urgent' },
  { key: 'falha-equipamento', label: 'Falha no alarme ou sensor', sla_hours: 24, first_response_hours: 4, default_priority: 'high' },
  { key: 'camera-offline', label: 'Câmera sem imagem', sla_hours: 48, first_response_hours: 8, default_priority: 'normal' },
  { key: 'manutencao', label: 'Manutenção / mudança de layout', sla_hours: 120, first_response_hours: 24, default_priority: 'low' },
  { key: 'financeiro', label: 'Financeiro / boleto', sla_hours: 48, first_response_hours: 8, default_priority: 'normal' },
];

const f = flow('seg');
const oOcorr = f.opt('🚨 Registrar ocorrência urgente', ['urgente', 'ocorrencia', 'disparo', 'invasao', 'emergencia', 'socorro']);
const o2via = f.opt('2ª via do boleto', ['segunda via', '2 via', 'boleto', 'fatura', 'pix']);
const oEquip = f.opt('Problema no alarme ou câmera', ['problema', 'alarme', 'sensor', 'camera', 'defeito']);
const oChamados = f.opt('Acompanhar meus chamados', ['protocolo', 'chamado', 'chamados']);
const oContratar = f.opt('Contratar monitoramento', ['contratar', 'orcamento', 'planos', 'instalar']);
const oCentral = f.opt('Falar com a central', ['central', 'atendente', 'humano']);
const menu = f.menu('Menu principal', 'Olá, {{primeiro_nome}}! 🛡️ Aqui é a *Guardião Monitoramento 24h*.\nEscolha uma opção:', [oOcorr, o2via, oEquip, oChamados, oContratar, oCentral], 1, 2);
const central = f.handoff('Central', 'Certo! Já vou te passar para a central. Só um instante 🛡️', 2, 9);
const fim = f.end('Encerrar', 'Qualquer coisa, é só mandar *menu*. Estamos de olho 24h 🛡️', 6, 4);
f.link('start', 'out', menu);
f.link(menu, 'invalid', central);
f.links(menu, [[oCentral, central]]);

// 1 — ocorrência urgente: categoria fixa, prioridade urgente, sem pedir foto; depois vai direto para a central
const aviso = f.msg('Aviso de emergência', ['⚠️ Se houver *risco à vida* ou invasão em andamento, ligue *190* agora. A central também vai te ligar.'], 2, 0);
const ocorr = f.node('open_ticket', {
  title: 'Registrar ocorrência',
  category: '@category:ocorrencia',
  ask_subject: false,
  ask_photo: false,
  priority: 'urgent',
  texts: {
    ask_description: 'Descreva rapidamente o que está acontecendo e o endereço do imóvel 📝',
    created: '🚨 Ocorrência registrada\n\n📄 Protocolo: *{{chamado.protocolo}}*\n⏱️ Atendimento: imediato',
  },
}, 3, 0);
const tagUrg = f.tags('Etiqueta ocorrência', ['@tag:Ocorrência em andamento'], 4, 0);
const centralUrg = f.handoff('Central (urgente)', 'A central já foi avisada e está acompanhando o seu imóvel agora 🛡️ Fique em local seguro.', 5, 0);
f.links(menu, [[oOcorr, aviso]]);
f.link(aviso, 'out', ocorr);
f.link(ocorr, 'out', tagUrg);
f.link(tagUrg, 'out', centralUrg);
f.link(ocorr, 'cancel', fim);
f.link(ocorr, 'failed', central);

// 2 — 2ª via
const id2 = f.node('crm_identify', { title: 'Identificar (2ª via)', mode: 'org', retries: 3 }, 2, 2);
const via = f.node('crm_invoice', {
  title: '2ª via',
  which: 'open',
  method: 'same',
  sent_text: 'Enviei o boleto acima 👆 Se preferir PIX, é só falar com a central.',
  nothing_open_text: 'Você não tem boleto em aberto 🙂',
}, 3, 2);
const naoAchou = f.handoff('Não encontrado', 'Não encontrei o seu cadastro 🤔 Vou te passar para a central conferir.', 3, 3);
f.links(menu, [[o2via, id2]]);
f.link(id2, 'found', via);
f.link(id2, 'not_found', naoAchou);
f.link(id2, 'invalid', naoAchou);
f.link(via, 'sent', fim);
f.link(via, 'nothing_open', fim);
f.link(via, 'failed', central);

// 3 — problema no equipamento (escolhe a categoria, pode mandar foto)
const equip = f.node('open_ticket', {
  title: 'Chamado de equipamento',
  category: 'ask',
  ask_subject: false,
  ask_photo: true,
  priority: 'default',
  texts: { choose_category: 'Qual é o problema? (ou *0* para cancelar)' },
}, 2, 4);
const fimEquip = f.end('Chamado aberto', 'Um técnico vai entrar em contato dentro do prazo 🔧 Acompanhe pelo *menu*, opção 4.', 3, 5);
f.links(menu, [[oEquip, equip]]);
f.link(equip, 'out', fimEquip);
f.link(equip, 'cancel', fim);
f.link(equip, 'failed', central);

// 4 — meus chamados
const meus = f.node('my_tickets', { title: 'Meus chamados', show: 'active', allow_add_info: true }, 2, 6);
f.links(menu, [[oChamados, meus]]);
f.link(meus, 'out', fim);
f.link(meus, 'none', menu);
f.link(meus, 'failed', central);

// 5 — contratar (proposta sem cobrança imediata: vistoria antes)
const idC = f.node('crm_identify', { title: 'Identificar (contratar)', mode: 'phone', retries: 3 }, 2, 7);
const cad = f.node('crm_register', {
  title: 'Cadastro',
  intro_text: 'Vamos fazer o seu cadastro para a vistoria 📝',
  fields: [
    { key: 'name', label: 'Nome completo', question: 'Qual é o seu nome completo?', required: true },
    { key: 'doc', label: 'CPF/CNPJ', question: 'Qual é o CPF ou CNPJ? (só números)', required: true },
    { key: 'address.street', label: 'Endereço do imóvel', question: 'Qual é o endereço do imóvel (rua e número)?', required: true },
    { key: 'address.district', label: 'Bairro', question: 'Qual é o bairro?', required: true },
  ],
  confirm: true,
}, 3, 8);
const contratar = f.node('crm_subscribe', {
  title: 'Escolher plano',
  product_id: 'choose',
  product_ids: ['@product:Monitoramento Residencial', '@product:Monitoramento + Câmeras', '@product:Monitoramento Empresarial'],
  choose_text: 'Qual monitoramento você quer? 🛡️',
  method: 'pix',
  charge_now: false,
  confirm: true,
  confirm_text: 'Você escolheu *{{produto.nome}}* por *{{produto.valor}}*{{produto.periodo}}.\nA cobrança começa depois da vistoria e instalação.\n\n1️⃣ Confirmar\n2️⃣ Agora não',
  subscribed_text: 'Proposta registrada ✅ *{{produto.nome}}*.',
}, 4, 7);
const tagProp = f.tags('Etiqueta proposta', ['@tag:Vistoria pendente'], 5, 7);
const vistoria = f.handoff('Agendar vistoria', 'Um consultor vai agendar a vistoria gratuita no imóvel para montar o projeto 📋 Já te passo para ele.', 6, 7);
f.links(menu, [[oContratar, idC]]);
f.link(idC, 'found', contratar);
f.link(idC, 'not_found', cad);
f.link(cad, 'done', contratar);
f.link(cad, 'cancel', fim);
f.link(cad, 'failed', central);
f.link(contratar, 'subscribed', tagProp);
f.link(contratar, 'paid', tagProp);
f.link(tagProp, 'out', vistoria);
f.link(contratar, 'declined', fim);
f.link(contratar, 'expired', fim);
f.link(contratar, 'failed', central);

const PRES = '@product:Monitoramento Residencial';
const PCAM = '@product:Monitoramento + Câmeras';
const PEMP = '@product:Monitoramento Empresarial';
const ANA = {
  id: 'fx-ana', name: 'Ana Cristina Souza', doc_masked: '***.982.247-**', email: 'ana@exemplo.com', status: 'ok', verified: true, custom: { tipo_imovel: 'Casa' },
  subscriptions: [{ id: 'fx-sub-1', product_id: PRES, product_name: 'Monitoramento Residencial', price_cents: 12990, billing: 'monthly', status: 'active', next_due_at: '2026-11-05', next_due_label: '05/11/2026', days_overdue: 0, due_day: 5, cancel_at: null, paused_until: null }],
  open_charges: [{ id: 'fx-chg-1', amount_cents: 12990, description: 'Monitoramento Residencial — novembro', due_at: '2026-11-05', due_label: '05/11/2026', days_overdue: 0, kind: 'boleto', pix_code: null, boleto_url: 'https://boleto.exemplo.com/fx-chg-1', status: 'PENDING' }],
};

export const seguranca: WaTemplate = {
  key: 'seguranca',
  name: 'Segurança e monitoramento',
  description: 'Planos de monitoramento 24h, ocorrências urgentes que vão direto para a central, chamados de equipamento com prazo e os dados do imóvel monitorado.',
  icon: 'shield-lock',
  highlights: [
    '3 planos mensais de monitoramento + kit e câmera avulsos',
    'Ocorrência urgente com prazo de 1 h e passagem direta para a central',
    'Chamados de equipamento com protocolo OCR e foto',
    'Dados do imóvel: tipo, palavra-senha, contatos de emergência',
    'Bot: ocorrência, 2ª via, equipamento, meus chamados, contratar',
  ],
  products: [
    { name: 'Monitoramento Residencial', description: 'Alarme monitorado 24h com envio de equipe tática.', price_cents: 12990, billing: 'monthly', kind: 'plan', category: 'Monitoramento', grace_days: 10, cancel_policy: 'end_of_cycle' },
    { name: 'Monitoramento + Câmeras', description: 'Alarme monitorado + até 4 câmeras com acesso pelo celular.', price_cents: 18990, billing: 'monthly', kind: 'plan', category: 'Monitoramento', grace_days: 10, cancel_policy: 'end_of_cycle' },
    { name: 'Monitoramento Empresarial', description: 'Monitoramento 24h com relatório de abertura e fechamento.', price_cents: 24990, billing: 'monthly', kind: 'plan', category: 'Monitoramento', grace_days: 10, cancel_policy: 'end_of_cycle' },
    { name: 'Kit alarme com instalação', description: 'Central, teclado, 4 sensores, sirene e instalação.', price_cents: 89000, billing: 'once', kind: 'product', category: 'Equipamentos' },
    { name: 'Câmera adicional instalada', description: 'Câmera Full HD com visão noturna, instalada.', price_cents: 39000, billing: 'once', kind: 'product', category: 'Equipamentos' },
  ],
  custom_fields: CUSTOM_FIELDS,
  tags: [
    { name: 'Ocorrência em andamento', color: '#dc2626' },
    { name: 'Vistoria pendente', color: '#f59e0b' },
    { name: 'Cliente monitorado', color: '#16a34a' },
    { name: 'Equipamento com defeito', color: '#0ea5e9' },
  ],
  pipeline_stages: [
    { name: 'Lead', color: '#38bdf8', kind: 'open' },
    { name: 'Vistoria agendada', color: '#6366f1', kind: 'open' },
    { name: 'Proposta enviada', color: '#f59e0b', kind: 'open' },
    { name: 'Monitorado', color: '#16a34a', kind: 'won' },
    { name: 'Não fechou', color: '#ef4444', kind: 'lost' },
  ],
  tickets: {
    categories: CATEGORIES,
    settings: { prefix: 'OCR', reset_yearly: true, sla_hours: { low: 120, normal: 48, high: 24, urgent: 1 }, first_response_hours: { low: 24, normal: 8, high: 4, urgent: 1 }, warn_before_minutes: 15, auto_close_days: 3 },
  },
  bot: { name: 'Segurança — central', definition: f.build(), settings: TEMPLATE_BOT_SETTINGS },
  fixture: {
    identity: { require_doc: false },
    customer: ANA,
    products: [
      { id: PRES, name: 'Monitoramento Residencial', price_cents: 12990, billing: 'monthly' },
      { id: PCAM, name: 'Monitoramento + Câmeras', price_cents: 18990, billing: 'monthly' },
      { id: PEMP, name: 'Monitoramento Empresarial', price_cents: 24990, billing: 'monthly' },
    ],
    custom_fields: CUSTOM_FIELDS,
    tickets: { categories: CATEGORIES, tickets: [] },
  },
  scenarios: [
    {
      name: 'Ocorrência urgente vai direto para a central',
      steps: [
        { send: 'socorro', expect: { contains: ['Guardião Monitoramento 24h'], waiting_for: 'menu' } },
        { send: '1', expect: { contains: ['ligue *190*', 'Descreva rapidamente'] } },
        { send: 'O alarme disparou e tem barulho no quintal. Rua das Flores, 120' },
        { send: 'zona 2 — fundos', expect: { contains: ['Ocorrência registrada', 'Protocolo', 'central já foi avisada'], tags: ['Ocorrência em andamento'], handoff: true } },
      ],
    },
    {
      name: 'Problema no equipamento com foto',
      steps: [
        { send: 'oi' },
        { send: '3', expect: { contains: ['Qual é o problema?', 'Câmera sem imagem'] } },
        { send: '3' },
        { send: 'A câmera da garagem está sem imagem desde ontem' },
        { media: 'image' },
        { send: 'pronto' },
        { send: 'pular', expect: { contains: ['Chamado aberto ✅', 'Câmera sem imagem', 'técnico vai entrar em contato'], ended: true } },
      ],
    },
    {
      name: '2ª via do boleto',
      steps: [
        { send: 'oi' },
        { send: 'boleto', expect: { contains: ['Enviei o boleto acima'], charge: true, ended: true } },
      ],
    },
    {
      name: 'Cliente contrata câmeras (vistoria antes de cobrar)',
      steps: [
        { send: 'oi' },
        { send: '5', expect: { contains: ['Qual monitoramento você quer?', 'Monitoramento + Câmeras'], not_contains: ['Monitoramento Residencial'] } },
        { send: '1', expect: { contains: ['*Monitoramento + Câmeras*', 'A cobrança começa depois da vistoria'], not_contains: ['Monitoramento Residencial ·'] } },
        { send: '1', expect: { contains: ['Proposta registrada ✅', 'vistoria gratuita'], tags: ['Vistoria pendente'], handoff: true } },
      ],
      expect: { charge: false },
    },
  ],
};
