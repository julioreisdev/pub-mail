import type { WaTemplate } from '../wa-template.types';
import { flow, TEMPLATE_BOT_SETTINGS } from './_flow';

// Prefeitura / serviço público: o cidadão abre um PROTOCOLO pelo WhatsApp (iluminação, buraco, coleta de lixo,
// ouvidoria…), recebe o número com prefixo, acompanha e manda mais informações; prazo por categoria. Fluxo:
// abrir protocolo · consultar protocolos · horário e endereços · telefones de emergência · atendente.

const BAIRROS = ['Centro', 'Jardim das Flores', 'Vila Nova', 'São José', 'Parque Industrial', 'Zona rural', 'Outro'];

const CUSTOM_FIELDS = {
  customer: [{ key: 'bairro', label: 'Bairro', type: 'select', options: BAIRROS, required: false, visible_to_customer: true, ask_in_bot: false }],
  ticket: [
    { key: 'bairro', label: 'Bairro da ocorrência', type: 'select', options: BAIRROS, required: true, visible_to_customer: true, ask_in_bot: true },
    { key: 'ponto_referencia', label: 'Ponto de referência', type: 'text', required: false, visible_to_customer: true, ask_in_bot: true, help: 'Ex.: em frente à escola municipal' },
  ],
};

const CATEGORIES = [
  { key: 'iluminacao', label: 'Iluminação pública', description: 'Poste apagado, piscando ou aceso de dia', sla_hours: 72, first_response_hours: 24, default_priority: 'normal' },
  { key: 'buraco', label: 'Buraco / pavimentação', description: 'Buraco na rua, calçada ou asfalto danificado', sla_hours: 240, first_response_hours: 48, default_priority: 'normal' },
  { key: 'coleta-lixo', label: 'Coleta de lixo e entulho', description: 'Coleta não passou, entulho, descarte irregular', sla_hours: 48, first_response_hours: 24, default_priority: 'normal' },
  { key: 'agua-esgoto', label: 'Vazamento de água / esgoto', sla_hours: 24, first_response_hours: 4, default_priority: 'high' },
  { key: 'poda-arvore', label: 'Poda ou queda de árvore', sla_hours: 120, first_response_hours: 24, default_priority: 'normal' },
  { key: 'ouvidoria', label: 'Ouvidoria (reclamação, sugestão, elogio)', sla_hours: 240, first_response_hours: 72, default_priority: 'low' },
];

const f = flow('pref');
const oAbrir = f.opt('Abrir um protocolo', ['abrir', 'protocolo novo', 'solicitar', 'reclamar', 'denuncia']);
const oConsultar = f.opt('Consultar meus protocolos', ['consultar', 'acompanhar', 'meus protocolos', 'andamento']);
const oHorario = f.opt('Horário e endereços de atendimento', ['horario', 'endereco', 'onde fica', 'funcionamento']);
const oTelefones = f.opt('Telefones de emergência', ['telefone', 'emergencia', 'samu', 'bombeiros', 'policia']);
const oAtend = f.opt('Falar com um atendente', ['atendente', 'humano', 'pessoa']);
const menu = f.menu('Menu principal', 'Olá, {{primeiro_nome}}! 🏛️ *Prefeitura de Santa Aurora* — Atendimento ao Cidadão.\nEscolha uma opção:', [oAbrir, oConsultar, oHorario, oTelefones, oAtend], 1, 2);
const atend = f.handoff('Atendente', 'Certo! Um atendente da Prefeitura vai falar com você em horário de expediente (seg a sex, 8h às 17h) 🙂', 2, 7);
const fim = f.end('Encerrar', 'A Prefeitura de Santa Aurora agradece o contato 🏛️ Para voltar, mande *menu*.', 5, 3);
f.link('start', 'out', menu);
f.link(menu, 'invalid', atend);
f.links(menu, [[oAtend, atend]]);

// 1 — abrir protocolo
const abrir = f.node('open_ticket', {
  title: 'Abrir protocolo',
  category: 'ask',
  ask_subject: false,
  ask_photo: true,
  priority: 'default',
  texts: {
    choose_category: 'Qual é o tipo da sua solicitação? (ou *0* para cancelar)',
    ask_description: 'Descreva o problema com o endereço completo (rua e número aproximado) 📝',
    ask_photo: 'Se puder, mande até 3 fotos do local 📸 Ajuda muito a equipe. Quando terminar, digite *pronto*. Para pular, digite *0*.',
    created: 'Protocolo registrado ✅\n\n📄 Número: *{{chamado.protocolo}}*\n📂 {{chamado.categoria}}\n⏱️ Prazo de atendimento: {{chamado.prazo}}\n\nGuarde este número para acompanhar.',
    cancel: 'Tudo bem, nenhum protocolo foi aberto. Quando precisar, é só mandar *menu* 🙂',
  },
}, 2, 0);
const tagProt = f.tags('Etiqueta protocolo', ['@tag:Protocolo aberto'], 3, 0);
const fimProt = f.end('Protocolo aberto', 'Você vai receber por aqui cada atualização do protocolo 🔔 Para consultar, mande *menu* e escolha a opção 2.', 4, 0);
f.links(menu, [[oAbrir, abrir]]);
f.link(abrir, 'out', tagProt);
f.link(tagProt, 'out', fimProt);
// porta "desistiu" sem ligação: o bloco manda o texto de cancelamento e termina (sem 2ª mensagem de despedida)
f.link(abrir, 'failed', atend);

// 2 — consultar (todos, inclusive encerrados) ou digitar o número
const consultar = f.node('my_tickets', { title: 'Consultar protocolos', show: 'all', allow_add_info: true, texts: { list: 'Seus protocolos 📄 Qual deles você quer ver?', ask_protocol: 'Ou digite o número do protocolo.', none: 'Você ainda não tem protocolos neste número 🙂' } }, 2, 2);
f.links(menu, [[oConsultar, consultar]]);
f.link(consultar, 'out', fim);
f.link(consultar, 'none', menu);
f.link(consultar, 'failed', atend);

// 3/4 — informações + "algo mais?"
const oMenu = f.opt('Voltar ao menu', ['voltar', 'menu', 'sim']);
const oSair = f.opt('Encerrar', ['encerrar', 'sair', 'nao', 'obrigado', 'obrigada']);
const maisAlgo = f.menu('Algo mais?', 'Posso ajudar em algo mais?', [oMenu, oSair], 4, 4);
f.links(maisAlgo, [[oMenu, menu], [oSair, fim]]);
f.link(maisAlgo, 'invalid', fim);
const horario = f.msg('Horário e endereços', [
  '🕗 *Atendimento presencial*\nSegunda a sexta, das 8h às 17h\n\n🏛️ *Paço Municipal* — Praça da Matriz, 100, Centro\n🧾 *Tributos e IPTU* — Rua Sete de Setembro, 45, Centro\n🩺 *Secretaria de Saúde* — Av. Brasil, 1.200, Vila Nova\n\nMuitos serviços também podem ser pedidos por aqui, na opção *Abrir um protocolo*.',
], 3, 4);
const telefones = f.msg('Telefones de emergência', [
  '📞 *Telefones de emergência*\n\n🚑 SAMU — *192*\n🚒 Bombeiros — *193*\n🚓 Polícia Militar — *190*\n🌧️ Defesa Civil — *199*\n🛡️ Guarda Municipal — *153*\n\nEm caso de risco à vida, ligue agora.',
], 3, 5);
f.links(menu, [[oHorario, horario], [oTelefones, telefones]]);
f.link(horario, 'out', maisAlgo);
f.link(telefones, 'out', maisAlgo);

const TICKETS = [
  { id: 'fx-tk-1', protocol: 'PSA2026000118', status: 'open', category: 'buraco', category_label: 'Buraco / pavimentação', subject: 'Buraco grande na Rua das Acácias', sla_label: '20/10 às 17:00', last_update: 'Equipe de tapa-buraco programada para esta semana.' },
  { id: 'fx-tk-2', protocol: 'PSA2026000097', status: 'resolved', category: 'iluminacao', category_label: 'Iluminação pública', subject: 'Poste apagado na praça', sla_label: '02/10 às 17:00', last_update: 'Lâmpada trocada em 01/10.' },
];

export const prefeitura: WaTemplate = {
  key: 'prefeitura',
  name: 'Prefeitura / serviço público',
  description: 'Atendimento ao cidadão pelo WhatsApp: protocolos por tipo de solicitação com prazo e prefixo próprio, bairro da ocorrência, acompanhamento pelo número e informações de horário e emergência.',
  icon: 'building-bank',
  highlights: [
    '6 tipos de protocolo (iluminação, buraco, coleta, água, poda, ouvidoria)',
    'Prazo de atendimento por tipo e protocolo com prefixo PSA',
    'Bairro e ponto de referência perguntados no próprio protocolo',
    'Bot: abrir protocolo com fotos, consultar, horários e telefones de emergência',
  ],
  products: [],
  custom_fields: CUSTOM_FIELDS,
  tags: [
    { name: 'Protocolo aberto', color: '#0ea5e9' },
    { name: 'Ouvidoria', color: '#8b5cf6' },
    { name: 'Demanda urgente', color: '#dc2626' },
    { name: 'Morador da zona rural', color: '#16a34a' },
  ],
  tickets: {
    categories: CATEGORIES,
    settings: { prefix: 'PSA', reset_yearly: true, sla_hours: { low: 240, normal: 72, high: 24, urgent: 4 }, first_response_hours: { low: 72, normal: 24, high: 4, urgent: 1 }, warn_before_minutes: 240, auto_close_days: 10, reopen_days: 15 },
  },
  bot: { name: 'Prefeitura — atendimento ao cidadão', definition: f.build(), settings: TEMPLATE_BOT_SETTINGS },
  fixture: {
    identity: { require_doc: false },
    customer: null,
    custom_fields: CUSTOM_FIELDS,
    tickets: { categories: CATEGORIES, tickets: TICKETS },
  },
  scenarios: [
    {
      name: 'Abrir protocolo de iluminação com bairro e foto',
      steps: [
        { send: 'bom dia', expect: { contains: ['Prefeitura de Santa Aurora'], waiting_for: 'menu' } },
        { send: '1', expect: { contains: ['Qual é o tipo da sua solicitação?', 'Iluminação pública', 'Ouvidoria'] } },
        { send: '1', expect: { contains: ['endereço completo'] } },
        { send: 'Poste apagado na Rua das Palmeiras, perto do número 300' },
        { media: 'image' },
        { send: 'pronto', expect: { contains: ['Bairro da ocorrência', 'Jardim das Flores'] } },
        { send: '2' },
        { send: 'em frente ao mercadinho', expect: { contains: ['Protocolo registrado ✅', 'Iluminação pública', 'Prazo de atendimento'], tags: ['Protocolo aberto'], ended: true } },
      ],
    },
    {
      name: 'Consultar protocolo e mandar mais informações',
      steps: [
        { send: 'oi' },
        { send: '2', expect: { contains: ['Seus protocolos', 'PSA2026000118', 'PSA2026000097'] } },
        { send: '1', expect: { contains: ['Buraco / pavimentação', 'tapa-buraco', 'Enviar mais informações'] } },
        { send: '1' },
        { send: 'O buraco aumentou depois da chuva de ontem', expect: { contains: ['Juntei sua mensagem ao protocolo *PSA2026000118*'], ended: true } },
      ],
    },
    {
      name: 'Horário de atendimento e telefones de emergência',
      steps: [
        { send: 'oi' },
        { send: '3', expect: { contains: ['Segunda a sexta, das 8h às 17h', 'Posso ajudar em algo mais?'] } },
        { send: '1', expect: { contains: ['Atendimento ao Cidadão'], waiting_for: 'menu' } },
        { send: '4', expect: { contains: ['SAMU — *192*', 'Defesa Civil'] } },
        { send: '2', expect: { contains: ['agradece o contato'], ended: true } },
      ],
    },
    {
      name: 'Desistir de abrir o protocolo',
      steps: [
        { send: 'oi' },
        { send: '1' },
        { send: '0', expect: { contains: ['nenhum protocolo foi aberto'], ended: true } },
      ],
    },
  ],
};
