import type { WaTemplate } from '../wa-template.types';
import { flow, TEMPLATE_BOT_SETTINGS } from './_flow';

// Clínica / consultório: serviços com agenda e profissionais, planos com consultas inclusas, ficha do paciente.
// Fluxo: menu → agendar (escolhe serviço/profissional/dia/hora) · meus agendamentos · 2ª via · planos · recepção.

const SEG_SEX = (ivs: { start: string; end: string }[]) => ({ '1': ivs, '2': ivs, '3': ivs, '4': ivs, '5': ivs });

const CUSTOM_FIELDS = {
  customer: [
    { key: 'data_nascimento', label: 'Data de nascimento', type: 'date', required: false, visible_to_customer: true, ask_in_bot: false },
    { key: 'convenio', label: 'Convênio', type: 'select', options: ['Particular', 'Unimed', 'Bradesco Saúde', 'SulAmérica', 'Amil', 'Outro'], required: false, visible_to_customer: true, ask_in_bot: true },
    { key: 'alergias', label: 'Alergias', type: 'text', required: false, visible_to_customer: false, ask_in_bot: false, help: 'Medicamentos ou alimentos que o paciente não pode receber' },
    { key: 'contato_emergencia', label: 'Contato de emergência', type: 'phone', required: false, visible_to_customer: false, ask_in_bot: false },
  ],
  appointment: [{ key: 'primeira_consulta', label: 'Primeira consulta', type: 'bool', required: false, visible_to_customer: false, ask_in_bot: false }],
};

const f = flow('cli');
const optAgendar = f.opt('Agendar consulta', ['agendar', 'consulta', 'marcar', 'horario']);
const optMeus = f.opt('Meus agendamentos', ['meus agendamentos', 'remarcar', 'desmarcar', 'confirmar']);
const opt2via = f.opt('2ª via de pagamento', ['segunda via', '2 via', 'boleto', 'pix', 'pagamento']);
const optPlanos = f.opt('Planos da clínica', ['plano', 'planos', 'assinatura']);
const optRecepcao = f.opt('Falar com a recepção', ['recepcao', 'atendente', 'humano', 'pessoa']);
const menu = f.menu(
  'Menu principal',
  'Olá, {{primeiro_nome}}! 👋 Aqui é a *Clínica Vida & Saúde* 🩺\nComo posso te ajudar hoje?',
  [optAgendar, optMeus, opt2via, optPlanos, optRecepcao],
  1,
  1,
);
const recepcao = f.handoff('Recepção', 'Certo! Já chamo alguém da recepção para falar com você. Só um instante 🙂', 2, 6);
f.link('start', 'out', menu);
f.link(menu, 'invalid', recepcao);

// 1 — agendar
const tagPaciente = f.tags('Etiqueta Paciente', ['@tag:Paciente'], 2, 0);
const agendar = f.node('book_service', {
  title: 'Agendar consulta',
  services: [],
  resource: 'ask',
  days_ahead: 30,
  confirm: true,
  texts: {
    choose_service: 'Qual atendimento você quer agendar? 🩺',
    choose_resource: 'Com qual profissional você prefere?',
    booked: 'Agendado ✅ *{{agendamento.servico}}* em {{agendamento.data}} às {{agendamento.hora}} com {{agendamento.profissional}}.',
    no_slots: 'Não encontrei horários livres para *{{agendamento.servico}}* nos próximos dias 😕',
  },
}, 3, 0);
const agendado = f.end('Agendado', 'Chegue 10 minutos antes com um documento com foto 🪪 Se precisar remarcar, é só mandar *menu*. Até lá! 💙', 4, 0);
const espera = f.node('waitlist_join', { title: 'Lista de espera', product_id: 'current', period: 'ask', days_ahead: 14 }, 4, 1);
const fimAgenda = f.end('Fim agenda', 'Combinado! Se precisar de algo, é só mandar *menu* 🙂', 5, 1);
f.links(menu, [[optAgendar, tagPaciente]]);
f.link(tagPaciente, 'out', agendar);
f.link(agendar, 'booked', agendado);
f.link(agendar, 'no_slots', espera);
f.link(espera, 'out', fimAgenda);
f.link(agendar, 'expired', fimAgenda);
f.link(agendar, 'cancel', fimAgenda);
f.link(agendar, 'failed', recepcao);

// 2 — meus agendamentos
const meus = f.node('my_appointments', { title: 'Meus agendamentos', allow_confirm: true, allow_reschedule: true, allow_cancel: true, days_ahead: 30 }, 2, 2);
f.links(menu, [[optMeus, meus]]);
f.link(meus, 'out', fimAgenda);
f.link(meus, 'none', menu);
f.link(meus, 'failed', recepcao);

// 3 — 2ª via
const ident = f.node('crm_identify', { title: 'Identificar paciente', mode: 'phone', retries: 3 }, 2, 3);
const via = f.node('crm_invoice', {
  title: '2ª via',
  which: 'open',
  method: 'same',
  sent_text: 'Pronto! Enviei a 2ª via acima 👆 Assim que o pagamento cair, a baixa é automática.',
  nothing_open_text: 'Você não tem pagamentos em aberto com a clínica 🙂',
}, 3, 3);
const naoAchou = f.handoff('Cadastro não encontrado', 'Não encontrei o seu cadastro por este número 🤔 Vou te passar para a recepção conferir.', 3, 4);
f.links(menu, [[opt2via, ident]]);
f.link(ident, 'found', via);
f.link(ident, 'not_found', naoAchou);
f.link(via, 'sent', fimAgenda);
f.link(via, 'nothing_open', fimAgenda);
f.link(via, 'failed', recepcao);

// 4 — planos (identifica; sem cadastro, cadastra; depois assina com PIX)
const identPlano = f.node('crm_identify', { title: 'Identificar para o plano', mode: 'phone', retries: 3 }, 2, 5);
const cadastro = f.node('crm_register', {
  title: 'Cadastro do paciente',
  intro_text: 'Vamos fazer o seu cadastro rapidinho 📝',
  fields: [
    { key: 'name', label: 'Nome completo', question: 'Qual é o seu nome completo?', required: true },
    { key: 'doc', label: 'CPF', question: 'Qual é o seu CPF? (só números)', required: true },
    { key: 'email', label: 'E-mail', question: 'Qual é o seu e-mail?', required: false },
  ],
  confirm: true,
  done_text: 'Cadastro concluído ✅',
}, 3, 6);
const assinar = f.node('crm_subscribe', {
  title: 'Assinar plano',
  product_id: 'choose',
  product_ids: ['@product:Plano Essencial', '@product:Plano Família'],
  choose_text: 'Nossos planos incluem consultas todo mês 💙 Qual você quer?',
  method: 'pix',
  charge_now: true,
  confirm: true,
  paid_text: 'Pagamento confirmado ✅ Seu *{{produto.nome}}* está ativo! As consultas inclusas já podem ser agendadas pelo menu.',
}, 4, 5);
const tagAssinante = f.tags('Etiqueta Assinante', ['@tag:Assinante de plano'], 5, 4);
const bemVindo = f.end('Plano ativo', 'Seja bem-vindo(a) ao plano da Clínica Vida & Saúde! 💙 Para agendar, mande *menu* e escolha a opção 1.', 6, 4);
f.links(menu, [[optPlanos, identPlano]]);
f.link(identPlano, 'found', assinar);
f.link(identPlano, 'not_found', cadastro);
f.link(cadastro, 'done', assinar);
f.link(cadastro, 'cancel', fimAgenda);
f.link(cadastro, 'failed', recepcao);
f.link(assinar, 'paid', tagAssinante);
f.link(assinar, 'subscribed', tagAssinante);
f.link(tagAssinante, 'out', bemVindo);
f.link(assinar, 'expired', fimAgenda);
f.link(assinar, 'declined', fimAgenda);
f.link(assinar, 'failed', recepcao);

// 5 — recepção
f.links(menu, [[optRecepcao, recepcao]]);

const P_ESSENCIAL = '@product:Plano Essencial';
const P_FAMILIA = '@product:Plano Família';
const S_CLINICA = '@product:Consulta clínica geral';
const S_PEDIATRIA = '@product:Consulta pediátrica';
const S_NUTRI = '@product:Avaliação nutricional';
const R_ANA = { id: '@resource:Dra. Ana Ribeiro', name: 'Dra. Ana Ribeiro' };
const R_PAULO = { id: '@resource:Dr. Paulo Mendes', name: 'Dr. Paulo Mendes' };
const R_CARLA = { id: '@resource:Nutricionista Carla Souza', name: 'Nutricionista Carla Souza' };
const ADDRESS = 'Rua das Acácias, 250 — sala 12, Centro';

export const clinica: WaTemplate = {
  key: 'clinica',
  name: 'Clínica / consultório',
  description: 'Agenda com profissionais e serviços, planos mensais com consultas inclusas, ficha do paciente e um bot que agenda, remarca e envia a 2ª via sozinho.',
  icon: 'stethoscope',
  highlights: [
    '4 serviços com duração e pagamento (no local ou PIX na reserva)',
    '3 profissionais com horários de atendimento',
    '2 planos mensais com consultas inclusas',
    'Ficha do paciente: nascimento, convênio, alergias',
    'Bot: agendar, meus agendamentos, 2ª via, planos e recepção',
  ],
  products: [
    { name: 'Plano Essencial', description: '1 consulta de clínica geral por mês + descontos em exames.', price_cents: 8990, billing: 'monthly', kind: 'plan', category: 'Planos', trial_days: 0, grace_days: 5, cancel_policy: 'end_of_cycle' },
    { name: 'Plano Família', description: 'Até 4 consultas por mês para a família (clínica geral ou pediatria).', price_cents: 21990, billing: 'monthly', kind: 'plan', category: 'Planos', trial_days: 0, grace_days: 5, cancel_policy: 'end_of_cycle' },
    {
      name: 'Consulta clínica geral', description: 'Consulta com clínico geral.', price_cents: 18000, kind: 'service', category: 'Consultas',
      duration_minutes: 30, buffer_after_minutes: 10, capacity: 1,
      booking: { payment: 'on_site', min_notice_hours: 2, max_days_ahead: 60, cancel_free_hours: 24, cancel_policy: 'credit', reschedule_limit: 2, confirm: 'ask_d1', address: ADDRESS },
      included_in_plans: [{ plan_id: P_ESSENCIAL, uses_per_cycle: 1 }, { plan_id: P_FAMILIA, uses_per_cycle: 4 }],
    },
    {
      name: 'Consulta pediátrica', description: 'Consulta com pediatra (até 12 anos).', price_cents: 20000, kind: 'service', category: 'Consultas',
      duration_minutes: 30, buffer_after_minutes: 10, capacity: 1,
      booking: { payment: 'on_site', min_notice_hours: 2, max_days_ahead: 60, cancel_free_hours: 24, cancel_policy: 'credit', reschedule_limit: 2, confirm: 'ask_d1', address: ADDRESS },
      included_in_plans: [{ plan_id: P_FAMILIA, uses_per_cycle: 4 }],
    },
    {
      name: 'Avaliação nutricional', description: 'Avaliação completa com bioimpedância e plano alimentar.', price_cents: 22000, kind: 'service', category: 'Avaliações',
      duration_minutes: 50, buffer_after_minutes: 10, capacity: 1,
      booking: { payment: 'on_booking', pay_within_minutes: 60, min_notice_hours: 12, max_days_ahead: 45, cancel_free_hours: 24, cancel_policy: 'credit', reschedule_limit: 1, confirm: 'ask_d1', address: ADDRESS },
    },
    {
      name: 'Retorno', description: 'Retorno de consulta (até 30 dias).', price_cents: 0, kind: 'service', category: 'Consultas',
      duration_minutes: 20, buffer_after_minutes: 5, capacity: 1,
      booking: { payment: 'on_site', min_notice_hours: 2, max_days_ahead: 30, cancel_free_hours: 12, cancel_policy: 'keep', reschedule_limit: 2, confirm: 'ask_d1', address: ADDRESS },
    },
  ],
  custom_fields: CUSTOM_FIELDS,
  tags: [
    { name: 'Paciente', color: '#0ea5e9' },
    { name: 'Assinante de plano', color: '#16a34a' },
    { name: 'Primeira consulta', color: '#8b5cf6' },
    { name: 'Retorno pendente', color: '#f59e0b' },
    { name: 'Convênio', color: '#64748b' },
  ],
  pipeline_stages: [
    { name: 'Interessado', color: '#38bdf8', kind: 'open' },
    { name: 'Consulta agendada', color: '#6366f1', kind: 'open' },
    { name: 'Em tratamento', color: '#f59e0b', kind: 'open' },
    { name: 'Paciente fidelizado', color: '#16a34a', kind: 'won' },
  ],
  scheduling: {
    settings: { reminder_d1_hour: '18:00', reminder_h2: true, no_show_after_minutes: 20, auto_complete: true, waitlist_offer_minutes: 30, staff_notify: true },
    resources: [
      { name: 'Dra. Ana Ribeiro', kind: 'person', color: '#0ea5e9', services: ['Consulta clínica geral', 'Retorno'], availability: { weekly: SEG_SEX([{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }]), slot_minutes: 30 } },
      { name: 'Dr. Paulo Mendes', kind: 'person', color: '#8b5cf6', services: ['Consulta pediátrica', 'Retorno'], availability: { weekly: { '1': [{ start: '13:00', end: '19:00' }], '3': [{ start: '13:00', end: '19:00' }], '5': [{ start: '13:00', end: '19:00' }] }, slot_minutes: 30 } },
      { name: 'Nutricionista Carla Souza', kind: 'person', color: '#16a34a', services: ['Avaliação nutricional'], availability: { weekly: { '2': [{ start: '08:00', end: '17:00' }], '4': [{ start: '08:00', end: '17:00' }], '6': [{ start: '08:00', end: '12:00' }] }, slot_minutes: 30 } },
    ],
  },
  bot: { name: 'Clínica — atendimento', definition: f.build(), settings: TEMPLATE_BOT_SETTINGS },
  fixture: {
    identity: { require_doc: false },
    customer: {
      id: 'fx-maria', name: 'Maria Oliveira', doc_masked: '***.482.***-35', email: 'maria@exemplo.com', status: 'ok', verified: true,
      custom: { convenio: 'Particular' },
      subscriptions: [{ id: 'fx-sub-1', product_id: P_ESSENCIAL, product_name: 'Plano Essencial', price_cents: 8990, billing: 'monthly', status: 'active', next_due_at: '2026-11-10', next_due_label: '10/11/2026', days_overdue: 0, due_day: 10, cancel_at: null, paused_until: null }],
      open_charges: [{ id: 'fx-chg-1', amount_cents: 8990, description: 'Plano Essencial — novembro', due_at: '2026-11-10', due_label: '10/11/2026', days_overdue: 0, kind: 'pix', pix_code: null, boleto_url: null, status: 'PENDING' }],
    },
    products: [
      { id: P_ESSENCIAL, name: 'Plano Essencial', price_cents: 8990, billing: 'monthly', cancel_policy: 'end_of_cycle' },
      { id: P_FAMILIA, name: 'Plano Família', price_cents: 21990, billing: 'monthly', cancel_policy: 'end_of_cycle' },
    ],
    custom_fields: CUSTOM_FIELDS,
    scheduling: {
      services: [
        { id: S_CLINICA, name: 'Consulta clínica geral', price_cents: 18000, duration_minutes: 30, duration_label: '30 min', booking: { payment: 'on_site', address: ADDRESS }, resources: [R_ANA] },
        { id: S_PEDIATRIA, name: 'Consulta pediátrica', price_cents: 20000, duration_minutes: 30, duration_label: '30 min', booking: { payment: 'on_site', address: ADDRESS }, resources: [R_PAULO] },
        { id: S_NUTRI, name: 'Avaliação nutricional', price_cents: 22000, duration_minutes: 50, duration_label: '50 min', booking: { payment: 'on_booking', address: ADDRESS }, resources: [R_CARLA] },
      ],
    },
  },
  scenarios: [
    {
      name: 'Agendar consulta (pagamento no local)',
      steps: [
        { send: 'oi', expect: { contains: ['Clínica Vida & Saúde', 'Agendar consulta'], waiting_for: 'menu' } },
        { send: '1', expect: { contains: ['Qual atendimento você quer agendar?', 'Consulta clínica geral'], tags: ['Paciente'] } },
        { send: '1' },
        { send: '1' },
        { send: '1', expect: { contains: ['Dra. Ana Ribeiro'] } },
        { send: '1', expect: { contains: ['Agendado ✅', 'Consulta clínica geral', 'documento com foto'], ended: true } },
      ],
      expect: { charge: false },
    },
    {
      name: 'Avaliação nutricional com PIX na reserva',
      steps: [
        { send: 'olá' },
        { send: 'agendar' },
        { send: '3' },
        { send: '1' },
        { send: '1' },
        { send: '1', expect: { charge: true, waiting_for: 'charge' } },
        { event: 'charge_paid', expect: { contains: ['Pagamento confirmado', 'Avaliação nutricional'], ended: true } },
      ],
    },
    {
      name: '2ª via para paciente com cobrança em aberto',
      steps: [
        { send: 'bom dia' },
        { send: '3', expect: { charge: true, contains: ['Enviei a 2ª via acima'], ended: true } },
      ],
    },
    {
      name: 'Assinar plano sem cadastro (cadastra e paga por PIX)',
      fixture: { customer: null },
      steps: [
        { send: 'oi' },
        { send: '4', expect: { contains: ['Vamos fazer o seu cadastro', 'nome completo'] } },
        { send: 'João Pereira Lima' },
        { send: '529.982.247-25' },
        { send: 'pular' },
        { send: 'Unimed' },
        { send: '1', expect: { contains: ['Cadastro concluído', 'Qual você quer?', 'Plano Família'] } },
        { send: '2', expect: { contains: ['Plano Família'] } },
        { send: '1', expect: { charge: true, waiting_for: 'charge' } },
        { event: 'charge_paid', expect: { contains: ['Pagamento confirmado', 'bem-vindo(a) ao plano'], tags: ['Assinante de plano'], ended: true } },
      ],
    },
  ],
};
