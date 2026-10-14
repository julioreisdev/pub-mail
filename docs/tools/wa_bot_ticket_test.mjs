#!/usr/bin/env node
// Teste em Node do motor PURO do Fluxo do Bot (wa-bot.engine.ts) — blocos de CHAMADOS (Fase 6B, contrato §10.5):
// open_ticket (categoria → assunto? → descrição → fotos? → protocolo) · my_tickets (lista / protocolo → detalhes →
// enviar mais informações) · condição `source:'ticket'` (has_open / pending_customer) · variáveis {{chamado.*}}.
//
// Compilar o motor (CommonJS) antes (igual ao wa_bot_engine_test.mjs):
//   cd back && npx tsc src/whatsapp/bot/wa-bot.engine.ts src/whatsapp/wa-doc.util.ts src/whatsapp/wa-custom-fields.util.ts \
//     --outDir /tmp/wa-engine --module commonjs --target es2022 --moduleResolution node --esModuleInterop --skipLibCheck --strictNullChecks
// Rodar:
//   ENGINE_DIR=/tmp/wa-engine node docs/tools/wa_bot_ticket_test.mjs
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const dir = process.env.ENGINE_DIR || '/tmp/wa-engine';
const E = require(path.join(dir, 'bot', 'wa-bot.engine.js'));
const { startFlow, handleInput, handleEvent, validateDefinition, fillVars, emptyState } = E;

let pass = 0;
let fail = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) pass += 1;
  else {
    fail += 1;
    failures.push(name + (extra ? ` :: ${typeof extra === 'string' ? extra : JSON.stringify(extra).slice(0, 500)}` : ''));
  }
}

let seq = 0;
const nid = (p) => `${p}-${++seq}`;
const node = (type, data = {}, id) => ({ id: id || nid(type), type, data, position: { x: 0, y: 0 } });
const edge = (source, handle, target) => ({ id: nid('e'), source, sourceHandle: handle, target });
const flow = (nodes, edges) => ({ nodes, edges });
const texts = (actions) => (actions || []).filter((a) => a.type === 'send').map((a) => a.message.text || '');
const allText = (actions) => texts(actions).join('\n---\n');
const act = (actions, type) => (actions || []).find((a) => a.type === type) || null;
const hasInfo = (actions, re) => (actions || []).some((a) => a.type === 'info' && re.test(a.text));
const endedAt = (actions) => (allText(actions).match(/END:([a-z_-]+)/) || [])[1] || null;

function mkCtx(o = {}) {
  return {
    contact: { name: 'Cliente Teste', phone: '5511999999999', saved: false },
    chatTagIds: [],
    now: new Date('2026-10-13T15:00:00Z'),
    settings: { numbering: 'emoji', typing: false, max_retries: 3, restart_keywords: ['menu'], ...(o.settings || {}) },
    customer: null,
    customers: [],
    products: [],
    ...(o.tickets ? { tickets: structuredClone(o.tickets) } : {}),
  };
}
function single(type, data, ports, extraNodes = [], extraEdges = []) {
  const start = node('start', {}, 'start');
  const n = node(type, data, 'X');
  const ends = ports.map((p) => node('end', { title: p, text: `END:${p}`, close: false }, `end-${p}`));
  return flow([start, n, ...ends, ...extraNodes], [edge('start', 'out', 'X'), ...ports.map((p) => edge('X', p, `end-${p}`)), ...extraEdges]);
}
const ev = (def, state, payload, ctx = mkCtx()) => handleEvent(def, state, 'crm_result', ctx, payload);
const say = (def, state, input, media, ctx = mkCtx()) => handleInput(def, state, input, ctx, media);

const CATS = [
  { key: 'duvida', label: 'Dúvida', active: true },
  { key: 'problema', label: 'Problema / reclamação', active: true },
  { key: 'velha', label: 'Categoria desligada', active: false },
  { key: 'solicitacao', label: 'Solicitação', active: true },
];
const TK = (id, protocol, status, extra = {}) => ({
  id,
  protocol,
  status,
  status_label: { open: 'Aberto', pending: 'Aguardando você', resolved: 'Resolvido', closed: 'Encerrado' }[status],
  category: 'problema',
  category_label: 'Problema / reclamação',
  subject: 'Internet caindo',
  priority: 'high',
  priority_label: 'Alta',
  sla_label: '14/10 às 15:00',
  sla_relative: 'em 24 h',
  last_update: null,
  ...extra,
});
const NEW_TICKET = TK('t-new', '2026000042', 'open', { category: 'problema', category_label: 'Problema / reclamação', sla_label: '14/10 às 12:00' });

// ================================================================ A. Abrir chamado — caminho completo (categoria perguntada)
{
  const def = single('open_ticket', { category: 'ask', ask_photo: true }, ['out', 'cancel', 'failed']);
  let r = startFlow(def, mkCtx(), 'oi');
  check('A entra pedindo as categorias ao runtime', act(r.actions, 'ticket_categories')?.node_id === 'X' && r.state.waiting_for === 'ticket:wait' && r.state.status === 'waiting', r);
  r = ev(def, r.state, { ok: true, categories: CATS });
  check('A menu numerado só com categorias ativas', /1️⃣ Dúvida/.test(allText(r.actions)) && /3️⃣ Solicitação/.test(allText(r.actions)) && !/desligada/.test(allText(r.actions)) && r.state.waiting_for === 'ticket:category', allText(r.actions));
  check('A menu avisa "0 para cancelar"', /\*0\* para cancelar/.test(allText(r.actions)));
  r = say(def, r.state, '9');
  check('A opção inválida → texto de inválida, continua no menu', /Não entendi/.test(allText(r.actions)) && r.state.waiting_for === 'ticket:category' && r.state.retries === 1);
  r = say(def, r.state, '2');
  check('A categoria escolhida → pede a descrição (sem assunto)', /Descreva o que aconteceu/.test(allText(r.actions)) && r.state.waiting_for === 'ticket:description' && r.state.ticket.category.key === 'problema', allText(r.actions));
  r = say(def, r.state, 'oi');
  check('A descrição curta → pede mais detalhe', /pelo menos 5 caracteres/.test(allText(r.actions)) && r.state.waiting_for === 'ticket:description' && r.state.retries === 1);
  r = say(def, r.state, 'A internet cai toda noite desde segunda');
  check('A descrição ok → pede fotos', /até 3 fotos/.test(allText(r.actions)) && r.state.waiting_for === 'ticket:photo' && r.state.ticket.description === 'A internet cai toda noite desde segunda');
  r = say(def, r.state, '', { id: 'm1', kind: 'image', mime: 'image/jpeg' });
  check('A foto recebida → "(1 de 3)"', /Recebi ✅ \(1 de 3\)/.test(allText(r.actions)) && r.state.waiting_for === 'ticket:photo' && r.state.ticket.media_ids.join() === 'm1', allText(r.actions));
  r = say(def, r.state, '', { id: null, kind: 'image' });
  check('A foto sem download → avisa e continua esperando', /Não consegui receber esse arquivo/.test(allText(r.actions)) && r.state.waiting_for === 'ticket:photo' && r.state.ticket.media_ids.length === 1);
  r = say(def, r.state, '', { id: 'a1', kind: 'audio' });
  check('A áudio não é aceito na etapa das fotos', /aceito foto ou documento/.test(allText(r.actions)) && r.state.ticket.media_ids.length === 1);
  r = say(def, r.state, 'pronto');
  const cr = act(r.actions, 'ticket_create');
  check('A "pronto" → ação ticket_create completa', cr && cr.node_id === 'X' && cr.category === 'problema' && cr.priority === null && cr.subject === null && cr.media_ids.join() === 'm1' && /internet cai/.test(cr.description) && r.state.waiting_for === 'ticket:wait', cr);
  const mid = r.state;
  r = ev(def, r.state, { ok: true, ticket: NEW_TICKET });
  check('A criado → protocolo/categoria/prazo no texto + porta out', /Protocolo: \*2026000042\*/.test(allText(r.actions)) && /Problema \/ reclamação/.test(allText(r.actions)) && /14\/10 às 12:00/.test(allText(r.actions)) && endedAt(r.actions) === 'out', allText(r.actions));
  check('A criado → {{protocolo}} em set_var', act(r.actions, 'set_var')?.name === 'protocolo' && r.state.vars.protocolo === '2026000042');
  check('A variáveis do chamado ficam para os blocos seguintes', fillVars('{{chamado.protocolo}} | {{chamado.categoria}} | {{chamado.prazo}} | {{chamado.status}}', r.state, mkCtx()) === '2026000042 | Problema / reclamação | 14/10 às 12:00 | Aberto');
  const ign = ev(def, r.state, { ok: true, ticket: NEW_TICKET });
  check('A crm_result sem ação pendente → ignorado', /ignorado/.test(JSON.stringify(ign.actions)));
  // o estado antes do resultado não foi mutado (cloneState copia media_ids)
  const r2 = say(def, { ...mid, waiting_for: 'ticket:photo', status: 'waiting' }, '', { id: 'm9', kind: 'image' });
  check('A estado clonado (media_ids não compartilhado)', mid.ticket.media_ids.length === 1 && r2.state.ticket.media_ids.length === 2);
}

// ================================================================ B. Cancelar no menu de categorias / no meio
{
  const def = single('open_ticket', { category: 'ask' }, ['out', 'cancel', 'failed']);
  let r = startFlow(def, mkCtx(), 'oi');
  r = ev(def, r.state, { ok: true, categories: CATS });
  const r0 = say(def, r.state, '0');
  check('B "0" no menu de categorias → texto de desistência + porta cancel', /não abri nenhum chamado/.test(allText(r0.actions)) && endedAt(r0.actions) === 'cancel', allText(r0.actions));
  r = say(def, r.state, '1');
  const rc = say(def, r.state, 'cancelar');
  check('B "cancelar" na descrição → porta cancel', endedAt(rc.actions) === 'cancel');
  // porta cancel não ligada → texto e o fluxo termina
  const def2 = single('open_ticket', { category: 'ask' }, ['out']);
  let r2 = startFlow(def2, mkCtx(), 'oi');
  r2 = ev(def2, r2.state, { ok: true, categories: CATS });
  r2 = say(def2, r2.state, 'desistir');
  check('B cancel sem ligação → texto + fim', /não abri nenhum chamado/.test(allText(r2.actions)) && r2.state.status === 'done');
}

// ================================================================ C. Categoria fixa + assunto + sem fotos + prioridade; falhas
{
  const def = single('open_ticket', { category: 'solicitacao', ask_subject: true, ask_photo: false, priority: 'urgent' }, ['out', 'failed']);
  let r = startFlow(def, mkCtx(), 'oi');
  check('C categoria fixa → não pede categorias, pergunta o assunto', !act(r.actions, 'ticket_categories') && /qual é o assunto/.test(allText(r.actions)) && r.state.waiting_for === 'ticket:subject');
  r = say(def, r.state, 'pular');
  check('C "pular" no assunto → sem assunto, pede descrição', r.state.ticket.subject === null && r.state.waiting_for === 'ticket:description');
  r = say(def, r.state, 'Quero segunda via do contrato assinado');
  const cr = act(r.actions, 'ticket_create');
  check('C sem fotos → cria direto com prioridade fixa', cr && cr.category === 'solicitacao' && cr.priority === 'urgent' && cr.media_ids.length === 0, cr);
  const f1 = ev(def, r.state, { ok: false, error: 'Categoria inexistente ou desativada.', user_text: 'Essa categoria não está disponível.' });
  check('C falha com user_text → diz o texto + porta failed', /Essa categoria não está disponível/.test(allText(f1.actions)) && endedAt(f1.actions) === 'failed' && hasInfo(f1.actions, /Erro do chamado/), allText(f1.actions));
  const def2 = single('open_ticket', { category: 'duvida', ask_photo: false }, ['out']);
  let r2 = startFlow(def2, mkCtx(), 'oi');
  r2 = say(def2, r2.state, 'Minha dúvida é sobre o horário');
  const f2 = ev(def2, r2.state, { ok: false, error: 'boom' });
  check('C falha sem ligação → texto padrão de falha + fim', /não consegui abrir o chamado/.test(allText(f2.actions)) && f2.state.status === 'done', allText(f2.actions));
  r = startFlow(def, mkCtx(), 'oi');
  r = say(def, r.state, 'Contrato');
  check('C assunto guardado', r.state.ticket.subject === 'Contrato');
}

// ================================================================ D/E. Fotos: limite de 3, legenda, retentativas
{
  const def = single('open_ticket', { category: 'problema' }, ['out', 'failed']);
  let r = startFlow(def, mkCtx(), 'oi');
  r = say(def, r.state, 'O roteador está piscando vermelho');
  r = say(def, r.state, 'veja a luz', { id: 'p1', kind: 'image' });
  check('D legenda da foto complementa a descrição', /piscando vermelho\n\nveja a luz/.test(r.state.ticket.description), r.state.ticket.description);
  r = say(def, r.state, '', { id: 'p2', kind: 'document', filename: 'contrato.pdf' });
  r = say(def, r.state, '', { id: 'p3', kind: 'image' });
  const cr = act(r.actions, 'ticket_create');
  check('D 3º anexo → cria sozinho com os 3', cr && cr.media_ids.join() === 'p1,p2,p3', cr);
  // foto já na descrição
  let d2 = startFlow(def, mkCtx(), 'oi');
  d2 = say(def, d2.state, 'Olha isso aqui, está quebrado', { id: 'q1', kind: 'image' });
  check('D foto com legenda na descrição → descrição + anexo', d2.state.ticket.description === 'Olha isso aqui, está quebrado' && d2.state.ticket.media_ids.join() === 'q1' && d2.state.waiting_for === 'ticket:photo');
  let d3 = startFlow(def, mkCtx(), 'oi');
  d3 = say(def, d3.state, '', { id: 'q2', kind: 'image' });
  check('D foto sem legenda na descrição → guarda e pede o texto', d3.state.waiting_for === 'ticket:description' && d3.state.ticket.media_ids.join() === 'q2' && /pelo menos 5 caracteres/.test(allText(d3.actions)));
  // E: textos que não são foto nem "pronto" → depois de 3, cria assim mesmo
  let e = startFlow(def, mkCtx(), 'oi');
  e = say(def, e.state, 'Sem sinal desde ontem à noite');
  e = say(def, e.state, 'hmm');
  e = say(def, e.state, 'como assim');
  check('E texto aleatório na etapa das fotos → pede de novo', /aceito foto ou documento/.test(allText(e.actions)) && e.state.waiting_for === 'ticket:photo');
  e = say(def, e.state, 'tá');
  check('E 3ª resposta inválida → cria mesmo assim (não perde o chamado)', act(e.actions, 'ticket_create')?.media_ids.length === 0);
  let e2 = startFlow(def, mkCtx(), 'oi');
  e2 = say(def, e2.state, 'Sem sinal desde ontem à noite');
  e2 = say(def, e2.state, '0');
  check('E "0" nas fotos → pula e cria', Boolean(act(e2.actions, 'ticket_create')));
  // descrição curta 3x → failed
  let e3 = startFlow(def, mkCtx(), 'oi');
  e3 = say(def, e3.state, 'a');
  e3 = say(def, e3.state, 'b');
  e3 = say(def, e3.state, 'c');
  check('E descrição curta 3x → porta failed', endedAt(e3.actions) === 'failed', allText(e3.actions));
  // descrição longa → cortada
  let e4 = startFlow(def, mkCtx(), 'oi');
  e4 = say(def, e4.state, 'x'.repeat(2500));
  check('E descrição > 2000 → cortada em 2000', e4.state.ticket.description.length === 2000 && hasInfo(e4.actions, /cortada/));
}

// ================================================================ F/G. Uma categoria só / nenhuma
{
  const def = single('open_ticket', { category: 'ask' }, ['out', 'failed']);
  let r = startFlow(def, mkCtx(), 'oi');
  r = ev(def, r.state, { ok: true, categories: [CATS[0], CATS[2]] });
  check('F uma categoria ativa → escolhe sozinho e pede a descrição', r.state.waiting_for === 'ticket:description' && r.state.ticket.category.key === 'duvida' && !/1️⃣/.test(allText(r.actions)));
  let g = startFlow(def, mkCtx(), 'oi');
  g = ev(def, g.state, { ok: true, categories: [CATS[2]] });
  check('G nenhuma categoria ativa → porta failed', endedAt(g.actions) === 'failed' && hasInfo(g.actions, /nenhuma categoria/));
  let g2 = startFlow(def, mkCtx(), 'oi');
  g2 = ev(def, g2.state, { ok: false, error: 'Chamados indisponíveis.' });
  check('G erro ao listar categorias → porta failed', endedAt(g2.actions) === 'failed');
}

// ================================================================ H. Meus chamados — lista → detalhes → enviar mais informações
const T1 = TK('t-1', '2026000041', 'pending', { last_update: 'Pode mandar uma foto do roteador?' });
const T2 = TK('t-2', '2026000039', 'open', { category_label: 'Dúvida' });
{
  const def = single('my_tickets', { show: 'active', allow_add_info: true }, ['out', 'none', 'failed']);
  let r = startFlow(def, mkCtx(), 'oi');
  const la = act(r.actions, 'ticket_list');
  check('H entra pedindo a lista (ativos, até 5)', la && la.show === 'active' && la.limit === 5 && r.state.waiting_for === 'ticket:wait', la);
  r = ev(def, r.state, { ok: true, tickets: [T1, T2, TK('t-x', '2025000001', 'closed')] });
  check('H lista numerada (só em andamento) + "digite o protocolo"', /1️⃣ 2026000041 · Problema \/ reclamação · Aguardando você/.test(allText(r.actions)) && /2️⃣ 2026000039/.test(allText(r.actions)) && !/2025000001/.test(allText(r.actions)) && /digite o número do protocolo/.test(allText(r.actions)) && r.state.waiting_for === 'ticket:choose', allText(r.actions));
  const listState = r.state;
  r = say(def, r.state, '1');
  check('H detalhes: protocolo, situação para o cliente, prazo e última atualização', /Protocolo \*2026000041\*/.test(allText(r.actions)) && /Situação: \*Aguardando você\*/.test(allText(r.actions)) && /14\/10 às 15:00/.test(allText(r.actions)) && /foto do roteador/.test(allText(r.actions)), allText(r.actions));
  check('H detalhes com "1 Enviar mais informações · 0 Voltar"', /1️⃣ Enviar mais informações/.test(allText(r.actions)) && /0️⃣ Voltar/.test(allText(r.actions)) && r.state.waiting_for === 'ticket:action');
  r = say(def, r.state, '1');
  check('H "1" → pede a informação', /junto ao protocolo \*2026000041\*/.test(allText(r.actions)) && r.state.waiting_for === 'ticket:info');
  r = say(def, r.state, 'Segue: o roteador reiniciou às 22h');
  const ai = act(r.actions, 'ticket_add_info');
  check('H texto → ação ticket_add_info', ai && ai.id === 't-1' && /reiniciou/.test(ai.body) && ai.media_id === null && r.state.waiting_for === 'ticket:wait', ai);
  r = ev(def, r.state, { ok: true, ticket: { ...T1, status: 'open', status_label: 'Aberto' } });
  check('H informação juntada → texto + porta out', /Juntei sua mensagem ao protocolo \*2026000041\*/.test(allText(r.actions)) && endedAt(r.actions) === 'out', allText(r.actions));
  check('H {{chamado.status}} atualizado depois', fillVars('{{chamado.status}}', r.state, mkCtx()) === 'Aberto');
  // "0 Voltar" com 2 chamados → volta à lista
  let b = say(def, listState, '2');
  b = say(def, b.state, '0');
  check('H "0" nos detalhes (2 chamados) → volta à lista', /Seus chamados/.test(allText(b.actions)) && b.state.waiting_for === 'ticket:choose');
  b = say(def, b.state, 'voltar');
  check('H "voltar" na lista → porta out', endedAt(b.actions) === 'out');
  // foto como informação
  let p = say(def, listState, '1');
  p = say(def, p.state, '1');
  p = say(def, p.state, 'foto do roteador', { id: 'mm1', kind: 'image' });
  const pi = act(p.actions, 'ticket_add_info');
  check('H foto + legenda → add_info com media_id e body', pi && pi.media_id === 'mm1' && pi.body === 'foto do roteador', pi);
  let p2 = say(def, listState, '1');
  p2 = say(def, p2.state, '1');
  p2 = say(def, p2.state, '', { id: null, kind: 'image' });
  check('H foto sem download → avisa e continua esperando', /Não consegui receber/.test(allText(p2.actions)) && p2.state.waiting_for === 'ticket:info');
  // CLOSED vindo do runtime
  let c = say(def, listState, '1');
  c = say(def, c.state, '1');
  c = say(def, c.state, 'mais uma coisa');
  c = ev(def, c.state, { ok: false, code: 'CLOSED', error: 'closed' });
  check('H chamado encerrado no meio → texto "encerrado" + porta out', /já foi encerrado/.test(allText(c.actions)) && endedAt(c.actions) === 'out', allText(c.actions));
  // recusa de escrita (cliente só visto pelo código)
  let w = say(def, listState, '1');
  w = say(def, w.state, '1');
  w = say(def, w.state, 'mais uma coisa');
  w = ev(def, w.state, { ok: false, error: 'só leitura', user_text: 'Para enviar informações, confirme o seu CPF/CNPJ.' });
  check('H recusa (código) → diz o motivo + porta failed', /confirme o seu CPF/.test(allText(w.actions)) && endedAt(w.actions) === 'failed');
}

// ================================================================ I/J. Protocolo digitado
{
  const def = single('my_tickets', {}, ['out', 'none', 'failed']);
  let r = startFlow(def, mkCtx(), 'oi');
  r = ev(def, r.state, { ok: true, tickets: [T1, T2] });
  const listState = r.state;
  const loc = say(def, listState, '2026-000039');
  check('I protocolo da lista (com traço) → detalhes direto, sem consultar', /Protocolo \*2026000039\*/.test(allText(loc.actions)) && !act(loc.actions, 'ticket_lookup'));
  let q = say(def, listState, 'protocolo 2026 000777');
  const lk = act(q.actions, 'ticket_lookup');
  check('I protocolo fora da lista → ticket_lookup normalizado (sem "protocolo", traço e espaço)', lk && lk.protocol === '2026000777', lk);
  const lk2 = act(say(def, listState, 'Protocolo nº 2026-000778').actions, 'ticket_lookup');
  check('I "Protocolo nº 2026-000778" → 2026000778', lk2 && lk2.protocol === '2026000778', lk2);
  q = ev(def, q.state, { ok: true, ticket: null });
  check('I não é dele / não existe → "não encontrei" e continua na lista', /Não encontrei esse protocolo/.test(allText(q.actions)) && q.state.waiting_for === 'ticket:choose' && q.state.ticket.misses === 1);
  check('I opções preservadas após a consulta', (q.state.ticket.options || []).length === 2);
  q = say(def, q.state, '1');
  check('I depois do "não encontrei" ainda escolhe da lista', /Protocolo \*2026000041\*/.test(allText(q.actions)));
  // 3 protocolos errados → sai
  let m = listState;
  for (let i = 0; i < 3; i++) {
    m = say(def, m, `2026${String(900 + i).padStart(6, '0')}`).state;
    const res = ev(def, m, { ok: true, ticket: null });
    m = res.state;
    if (i === 2) check('I 3 protocolos não encontrados → porta out', endedAt(res.actions) === 'out', allText(res.actions));
  }
  // J: protocolo achado pela consulta
  let j = say(def, listState, '2026000777');
  j = ev(def, j.state, { ok: true, ticket: TK('t-9', '2026000777', 'resolved') });
  check('J protocolo achado → detalhes com "Resolvido"', /Protocolo \*2026000777\*/.test(allText(j.actions)) && /Resolvido/.test(allText(j.actions)) && j.state.waiting_for === 'ticket:action');
  // opção inválida
  const inv = say(def, listState, 'banana');
  check('I resposta inválida → texto de inválida', /Não entendi/.test(allText(inv.actions)) && inv.state.waiting_for === 'ticket:choose');
}

// ================================================================ K/L/M. Sem chamados · encerrado · só leitura · um chamado só
{
  const def = single('my_tickets', { show: 'all' }, ['out', 'none']);
  let k = startFlow(def, mkCtx(), 'oi');
  check('K show=all → ação pede todos', act(k.actions, 'ticket_list')?.show === 'all');
  const kn = ev(def, k.state, { ok: true, tickets: [] });
  check('K sem chamados → texto + porta none', /não tem chamados/.test(allText(kn.actions)) && endedAt(kn.actions) === 'none');
  const kl = ev(def, k.state, { ok: true, tickets: [TK('t-c', '2026000001', 'closed')] });
  check('L chamado encerrado (único) → detalhes + "encerrado", sem menu, porta out', /Encerrado/.test(allText(kl.actions)) && /já foi encerrado/.test(allText(kl.actions)) && !/Enviar mais informações/.test(allText(kl.actions)) && endedAt(kl.actions) === 'out', allText(kl.actions));
  const km = ev(def, k.state, { ok: true, tickets: [TK('t-r', '2026000002', 'open', { can_add_info: false })] });
  check('M só leitura (código) → detalhes sem "enviar mais informações"', /2026000002/.test(allText(km.actions)) && !/Enviar mais informações/.test(allText(km.actions)) && endedAt(km.actions) === 'out' && hasInfo(km.actions, /só para consulta/));
  const defNo = single('my_tickets', { allow_add_info: false }, ['out', 'none']);
  let n1 = startFlow(defNo, mkCtx(), 'oi');
  n1 = ev(defNo, n1.state, { ok: true, tickets: [T2] });
  check('M allow_add_info=false → só detalhes', !/Enviar mais informações/.test(allText(n1.actions)) && endedAt(n1.actions) === 'out');
  const kf = ev(def, k.state, { ok: false, error: 'x' });
  check('M erro ao listar sem porta failed → texto de falha + fim', /não consegui consultar/.test(allText(kf.actions)) && kf.state.status === 'done');
}

// ================================================================ Q. Condição de chamados + {{chamados.lista}}
{
  const mkCond = (rules) =>
    flow(
      [node('start', {}, 'start'), node('condition', { rules, match: 'all' }, 'C'), node('end', { text: 'END:true', close: false }, 'T'), node('end', { text: 'END:false', close: false }, 'F')],
      [edge('start', 'out', 'C'), edge('C', 'true', 'T'), edge('C', 'false', 'F')],
    );
  const run = (rules, tickets) => endedAt(startFlow(mkCond(rules), mkCtx({ tickets }), 'oi').actions);
  check('Q has_open com chamado aberto → sim', run([{ source: 'ticket', key: 'has_open', op: 'is', value: 'true' }], [T2]) === 'true');
  check('Q has_open sem chamados → não', run([{ source: 'ticket', key: 'has_open', op: 'is', value: 'true' }], []) === 'false');
  check('Q has_open = false sem chamados → sim', run([{ source: 'ticket', key: 'has_open', op: 'is', value: 'false' }], []) === 'true');
  check('Q has_open ignora resolvido/encerrado', run([{ source: 'ticket', key: 'has_open', op: 'is', value: 'true' }], [TK('a', '1', 'resolved'), TK('b', '2', 'closed')]) === 'false');
  check('Q pending_customer com chamado aguardando o cliente → sim', run([{ source: 'ticket', key: 'pending_customer', op: 'is', value: 'true' }], [T2, T1]) === 'true');
  check('Q pending_customer só com aberto → não', run([{ source: 'ticket', key: 'pending_customer', op: 'is', value: 'true' }], [T2]) === 'false');
  check('Q sem `ctx.tickets` (runtime antigo) → não', run([{ source: 'ticket', key: 'has_open', op: 'is', value: 'true' }], undefined) === 'false');
  const st = emptyState();
  check('Q {{chamados.lista}} e {{chamado.protocolo}} do mais recente', fillVars('{{chamado.protocolo}}\n{{chamados.lista}}', st, mkCtx({ tickets: [T1, T2] })) === '2026000041\n• 2026000041 · Problema / reclamação · Aguardando você\n• 2026000039 · Dúvida · Aberto');
  check('Q {{chamados.lista}} sem chamados', fillVars('{{chamados.lista}}', st, mkCtx()) === 'Nenhum chamado em andamento.');
  // chamado criado no fluxo conta para a condição seguinte
  const def = flow(
    [node('start', {}, 'start'), node('open_ticket', { category: 'duvida', ask_photo: false }, 'O'), node('condition', { rules: [{ source: 'ticket', key: 'has_open', op: 'is', value: 'true' }] }, 'C'), node('end', { text: 'END:true', close: false }, 'T'), node('end', { text: 'END:false', close: false }, 'F')],
    [edge('start', 'out', 'O'), edge('O', 'out', 'C'), edge('C', 'true', 'T'), edge('C', 'false', 'F')],
  );
  let r = startFlow(def, mkCtx(), 'oi');
  r = say(def, r.state, 'Tenho uma dúvida sobre a fatura');
  r = ev(def, r.state, { ok: true, ticket: { ...NEW_TICKET, category: 'duvida', category_label: 'Dúvida' } });
  check('Q chamado recém-criado conta em has_open', endedAt(r.actions) === 'true', allText(r.actions));
}

// ================================================================ S/T. Validação · reinício · espera do runtime
{
  check('S valid: categoria inválida', validateDefinition(single('open_ticket', { category: 'Categoria Ruim!' }, ['out'])).some((x) => /categoria válida/.test(x)));
  check('S valid: prioridade inválida', validateDefinition(single('open_ticket', { priority: 'altissima' }, ['out'])).some((x) => /prioridade inválida/.test(x)));
  check('S valid: show inválido', validateDefinition(single('my_tickets', { show: 'x' }, ['out'])).some((x) => /quais chamados/.test(x)));
  check('S valid: blocos de chamado ok', validateDefinition(single('open_ticket', { category: 'problema', priority: 'high' }, ['out'])).length === 0 && validateDefinition(single('my_tickets', { show: 'all' }, ['out'])).length === 0);
  const def = single('open_ticket', { category: 'ask' }, ['out']);
  const r = startFlow(def, mkCtx(), 'oi');
  const w = say(def, r.state, 'oi');
  check('T ticket:wait: mensagem não muda o estado', w.state.waiting_for === 'ticket:wait' && !texts(w.actions).length);
  const rs = say(def, ev(def, r.state, { ok: true, categories: CATS }).state, 'menu');
  check('T palavra de reinício limpa o chamado', rs.state.status === 'done' && rs.state.ticket === null);
  // CRM continua ignorando crm_result fora de bloco de CRM/chamado
  const msgDef = flow([node('start', {}, 'start'), node('question', { text: 'Nome?' }, 'Q')], [edge('start', 'out', 'Q')]);
  const qs = startFlow(msgDef, mkCtx(), 'oi');
  const qi = handleEvent(msgDef, qs.state, 'crm_result', mkCtx(), { ok: true });
  check('T crm_result em bloco comum → ignorado', /ignorado/.test(JSON.stringify(qi.actions)) && qi.state.waiting_for === 'question');
}

const total = pass + fail;
for (const f of failures) console.log('FAIL', f);
console.log(`${pass}/${total} ${fail ? 'FAIL' : 'PASS'}`);
process.exit(fail ? 1 : 0);
