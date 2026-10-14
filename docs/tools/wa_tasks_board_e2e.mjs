// E2E do quadro de Tarefas (estilo Trello) — roda NO SERVIDOR contra 127.0.0.1:8000, numa ORG TEMPORÁRIA (apagada no fim):
//   scp docs/tools/wa_tasks_board_e2e.mjs pubmail-hostinger:/opt/pub-mail/back/wa_board_e2e.tmp.mjs
//   ssh pubmail-hostinger 'cd /opt/pub-mail/back && node wa_board_e2e.tmp.mjs; rm -f wa_board_e2e.tmp.mjs'
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const API = 'http://127.0.0.1:8000';
const db = await mysql.createConnection({ host: '127.0.0.1', user: env.DATABASE_USER, password: env.DATABASE_PASS, database: env.DATABASE_NAME });
const q = async (s, p) => (await db.query(s, p))[0];
const sign = (sub, org, role) => jwt.sign({ sub, org, role }, env.JWT_ACCESS_SECRET, { expiresIn: '30m' });
const call = async (tok, m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j }; };
let pass = 0; const fails = [];
const ok = (name, cond, info) => { if (cond) { pass++; console.log('PASS', name); } else { fails.push(name); console.log('FAIL', name, ' →', JSON.stringify(info ?? null).slice(0, 500)); } };

const [sa] = await q("SELECT id, organization_id FROM users WHERE email='superadmin@pubmail.com'");
const saTok = sign(sa.id, sa.organization_id, 'SUPER_ADMIN');
const stamp = Date.now().toString(36);
let orgId;
try {
  const c = await call(saTok, 'POST', '/admin/clients', { name: 'Dono Quadro', email: `board-${stamp}@teste.local`, password: 'Senha!Teste123', org_name: `E2E Quadro ${stamp}`, modules: ['whatsapp'], price_cents: 0 });
  orgId = c.j.organization.id;
  const ownerId = c.j.user.id;
  const tok = sign(ownerId, orgId, 'OWNER');
  const m = await call(saTok, 'POST', '/admin/users', { organization_id: orgId, name: 'Atendente', email: `board-m-${stamp}@teste.local`, password: 'Senha!Teste123', role: 'MEMBER', modules: ['whatsapp'] });
  const memberTok = sign(m.j?.id || m.j?.user?.id, orgId, 'MEMBER');

  // tarefas ANTIGAS (sem coluna), antes da 1ª leitura do quadro
  const oldOpen = randomUUID(), oldDone = randomUUID();
  await q(`INSERT INTO whatsapp_tasks (id, organization_id, title, created_by, created_at, updated_at) VALUES (?,?,?,?,NOW(3) - INTERVAL 2 DAY, NOW(3))`, [oldOpen, orgId, 'Antiga aberta', ownerId]);
  await q(`INSERT INTO whatsapp_tasks (id, organization_id, title, created_by, done_at, created_at, updated_at) VALUES (?,?,?,?,NOW(3) - INTERVAL 1 DAY, NOW(3) - INTERVAL 3 DAY, NOW(3))`, [oldDone, orgId, 'Antiga concluída', ownerId]);

  let r = await call(tok, 'GET', '/whatsapp/tasks/board');
  let B = r.j;
  const L = (name) => B.lists.find((l) => l.name === name);
  ok('quadro novo: 3 colunas padrão (A fazer, Fazendo, Concluído = concluídas) e 6 etiquetas', r.s === 200 && B.lists.map((l) => l.name).join('|') === 'A fazer|Fazendo|Concluído' && L('Concluído').is_done && !L('A fazer').is_done && B.labels.length === 6, B);
  ok('tarefas antigas adotadas: aberta → A fazer, concluída → Concluído', L('A fazer').tasks.some((t) => t.id === oldOpen) && L('Concluído').tasks.some((t) => t.id === oldDone && t.done), { a: L('A fazer').tasks.map((t) => t.title), d: L('Concluído').tasks.map((t) => t.title) });
  const TODO = L('A fazer').id, DOING = L('Fazendo').id, DONE = L('Concluído').id;

  r = await call(tok, 'POST', '/whatsapp/tasks', { title: 'Sem coluna informada' });
  const t1 = r.j;
  ok('criar sem coluna → 1ª coluna aberta, no fim', r.s === 201 && t1.list_id === TODO && !t1.done, t1);
  const t2 = (await call(tok, 'POST', '/whatsapp/tasks', { title: 'Card 2', list_id: DOING })).j;
  const t3 = (await call(tok, 'POST', '/whatsapp/tasks', { title: 'Card 3', list_id: DOING })).j;
  const t4 = (await call(tok, 'POST', '/whatsapp/tasks', { title: 'Direto em concluídas', list_id: DONE })).j;
  ok('criar direto na coluna de concluídas = concluída', t4.list_id === DONE && t4.done === true, t4);
  r = await call(tok, 'POST', '/whatsapp/tasks', { title: 'x', list_id: randomUUID() });
  ok('coluna inexistente → 400', r.s === 400, r);

  // mover dentro e entre colunas
  r = await call(tok, 'POST', `/whatsapp/tasks/${t3.id}/move`, { list_id: DOING, index: 0 });
  B = (await call(tok, 'GET', '/whatsapp/tasks/board')).j;
  ok('mover para o topo da mesma coluna: Card 3 antes do Card 2', r.s === 201 && L('Fazendo').tasks.map((t) => t.title).join('|') === 'Card 3|Card 2', L('Fazendo').tasks.map((t) => t.title));
  r = await call(tok, 'POST', `/whatsapp/tasks/${t1.id}/move`, { list_id: DOING, index: 1 });
  B = (await call(tok, 'GET', '/whatsapp/tasks/board')).j;
  ok('mover entre colunas no meio: Card 3 | Sem coluna | Card 2', L('Fazendo').tasks.map((t) => t.title).join('|') === 'Card 3|Sem coluna informada|Card 2', L('Fazendo').tasks.map((t) => t.title));
  r = await call(tok, 'POST', `/whatsapp/tasks/${t2.id}/move`, { list_id: DONE, index: 0 });
  ok('soltar na coluna de concluídas → concluída, com done_by', r.j.done === true && r.j.done_by?.id === ownerId, r.j);
  r = await call(tok, 'POST', `/whatsapp/tasks/${t2.id}/move`, { list_id: TODO });
  ok('tirar da coluna de concluídas → reaberta', r.j.done === false && r.j.list_id === TODO, r.j);

  // concluir/reabrir pelo checkbox mexe a coluna
  r = await call(tok, 'POST', `/whatsapp/tasks/${t3.id}/done`);
  B = (await call(tok, 'GET', '/whatsapp/tasks/board')).j;
  ok('concluir → vai para o TOPO de Concluído', r.j.list_id === DONE && L('Concluído').tasks[0]?.id === t3.id, L('Concluído').tasks.map((t) => t.title));
  r = await call(tok, 'POST', `/whatsapp/tasks/${t3.id}/reopen`);
  B = (await call(tok, 'GET', '/whatsapp/tasks/board')).j;
  ok('reabrir → volta para o FIM de A fazer', r.j.list_id === TODO && L('A fazer').tasks.at(-1)?.id === t3.id && !r.j.done, L('A fazer').tasks.map((t) => t.title));

  // etiquetas, checklist, capa
  const lab = (await call(tok, 'POST', '/whatsapp/tasks/labels', { name: 'Teste', color: '#579dff' })).j;
  r = await call(tok, 'PUT', `/whatsapp/tasks/${t1.id}`, { label_ids: [lab.id, B.labels[0].id, randomUUID()], checklist: [{ text: 'Ligar' }, { text: '  ' }, { id: 'a<b', text: 'Enviar proposta', done: true }], cover: '#F87168' });
  ok('etiquetas: ids de outra conta/inexistentes descartados', r.s === 200 && r.j.label_ids.length === 2 && r.j.label_ids.includes(lab.id), r.j.label_ids);
  ok('checklist saneado: item vazio fora, id limpo, feito preservado; capa em minúsculas', r.j.checklist.length === 2 && r.j.checklist[1].done === true && r.j.checklist[1].id === 'ab' && r.j.cover === '#f87168', r.j);
  r = await call(tok, 'PUT', `/whatsapp/tasks/${t1.id}`, { cover: 'vermelho' });
  ok('capa inválida → 400', r.s === 400, r);
  B = (await call(tok, 'GET', '/whatsapp/tasks/board', null)).j;
  r = await call(tok, 'GET', `/whatsapp/tasks/board?label_id=${lab.id}`);
  ok('filtro por etiqueta: só o cartão com ela', r.j.lists.flatMap((l) => l.tasks).map((t) => t.id).join() === t1.id, r.j.lists.flatMap((l) => l.tasks).map((t) => t.title));
  r = await call(tok, 'DELETE', `/whatsapp/tasks/labels/${lab.id}`);
  const t1b = (await call(tok, 'GET', '/whatsapp/tasks/board')).j.lists.flatMap((l) => l.tasks).find((t) => t.id === t1.id);
  ok('apagar etiqueta tira dos cartões', r.s === 200 && r.j.removed_from === 1 && !t1b.label_ids.includes(lab.id), { r: r.j, ids: t1b?.label_ids });

  // prazo
  await call(tok, 'PUT', `/whatsapp/tasks/${t2.id}`, { due_at: new Date(Date.now() - 3600_000).toISOString() });
  r = await call(tok, 'GET', '/whatsapp/tasks/board?due=overdue');
  ok('filtro atrasadas', r.j.lists.flatMap((l) => l.tasks).map((t) => t.id).join() === t2.id, r.j.lists.flatMap((l) => l.tasks).map((t) => t.title));

  // muitos movimentos no mesmo vão → renumera e a ordem continua certa
  const a = (await call(tok, 'POST', '/whatsapp/tasks', { title: 'R-A', list_id: DOING })).j;
  const b = (await call(tok, 'POST', '/whatsapp/tasks', { title: 'R-B', list_id: DOING })).j;
  const c2 = (await call(tok, 'POST', '/whatsapp/tasks', { title: 'R-C', list_id: DOING })).j;
  await call(tok, 'POST', `/whatsapp/tasks/${a.id}/move`, { list_id: DOING, index: 0 });
  let last = '';
  for (let i = 0; i < 70; i++) {
    const card = i % 2 ? b : c2;
    const rr = await call(tok, 'POST', `/whatsapp/tasks/${card.id}/move`, { list_id: DOING, index: 1 });
    if (rr.s !== 201) { last = rr; break; }
  }
  B = (await call(tok, 'GET', '/whatsapp/tasks/board')).j;
  const doing = L('Fazendo').tasks.map((t) => t.title);
  ok('70 movimentos no mesmo vão: sem erro, R-A no topo e o último movido em 2º', !last && doing[0] === 'R-A' && doing[1] === 'R-B', { last, doing });

  // colunas
  r = await call(tok, 'POST', '/whatsapp/tasks/lists', { name: 'Aguardando', color: '#f59e0b' });
  const WAIT = r.j.id;
  ok('criar coluna (vai para o fim)', r.s === 201 && r.j.position === 3, r.j);
  r = await call(tok, 'PUT', `/whatsapp/tasks/lists/${WAIT}`, { name: 'Aguardando cliente' });
  ok('renomear coluna', r.j.name === 'Aguardando cliente', r.j);
  r = await call(tok, 'PUT', '/whatsapp/tasks/lists/reorder', { ids: [WAIT, TODO] });
  ok('reordenar: a nova vira a 1ª, as não citadas mantêm a ordem', r.j.map((l) => l.name).join('|') === 'Aguardando cliente|A fazer|Fazendo|Concluído', r.j.map((l) => l.name));
  await call(tok, 'POST', `/whatsapp/tasks/${a.id}/move`, { list_id: WAIT });
  r = await call(tok, 'PUT', `/whatsapp/tasks/lists/${WAIT}`, { is_done: true });
  B = (await call(tok, 'GET', '/whatsapp/tasks/board')).j;
  ok('marcar coluna como "de concluídas" conclui os cartões dela', r.j.is_done && L('Aguardando cliente').tasks.every((t) => t.done), L('Aguardando cliente').tasks);
  await call(tok, 'PUT', `/whatsapp/tasks/lists/${WAIT}`, { is_done: false });
  r = await call(tok, 'POST', `/whatsapp/tasks/lists/${WAIT}/delete`, {});
  ok('apagar coluna com cartões sem escolher destino → 400 explicando', r.s === 400 && /cartão/.test(r.j?.message || ''), r);
  r = await call(memberTok, 'POST', `/whatsapp/tasks/lists/${WAIT}/delete`, { move_to: TODO });
  ok('MEMBER não apaga coluna (403)', r.s === 403, r);
  r = await call(tok, 'POST', `/whatsapp/tasks/lists/${WAIT}/delete`, { move_to: DONE });
  B = (await call(tok, 'GET', '/whatsapp/tasks/board')).j;
  ok('apagar movendo para Concluído: cartões chegam concluídos, coluna some', r.s === 201 && r.j.moved === 1 && !L('Aguardando cliente') && L('Concluído').tasks.some((t) => t.id === a.id && t.done), r.j);
  r = await call(memberTok, 'POST', `/whatsapp/tasks/lists/${DONE}/clear`);
  ok('MEMBER não limpa coluna (403)', r.s === 403, r);
  r = await call(memberTok, 'POST', '/whatsapp/tasks/lists', { name: 'Do atendente' });
  ok('MEMBER cria coluna (estrutura do quadro é da equipe)', r.s === 201, r);
  await call(tok, 'POST', `/whatsapp/tasks/lists/${r.j.id}/delete`, {});

  // apagar cartão concluído e limpar coluna
  r = await call(memberTok, 'DELETE', `/whatsapp/tasks/${t4.id}`);
  ok('apagar cartão CONCLUÍDO (atendente)', r.s === 200, r);
  const doneBefore = (await call(tok, 'GET', '/whatsapp/tasks/board')).j.lists.find((l) => l.id === DONE).total;
  r = await call(tok, 'POST', `/whatsapp/tasks/lists/${DONE}/clear`);
  B = (await call(tok, 'GET', '/whatsapp/tasks/board')).j;
  ok('limpar coluna de concluídas apaga todos os cartões dela', r.j.deleted === doneBefore && doneBefore > 0 && L('Concluído').total === 0, { r: r.j, doneBefore });
  r = await call(tok, 'POST', `/whatsapp/tasks/lists/${TODO}/delete`, { delete_tasks: true });
  await call(tok, 'POST', `/whatsapp/tasks/lists/${DOING}/delete`, { delete_tasks: true });
  r = await call(tok, 'POST', `/whatsapp/tasks/lists/${DONE}/delete`, {});
  ok('a última coluna não pode ser apagada', r.s === 400, r);

  // contadores e lista antiga continuam funcionando
  r = await call(tok, 'GET', '/whatsapp/tasks/counts');
  ok('contadores respondem', r.s === 200 && typeof r.j.open === 'number', r.j);
} catch (e) {
  fails.push('SCRIPT ' + (e?.stack || e));
  console.log('ERRO', e?.stack || e);
} finally {
  if (orgId) {
    await call(saTok, 'DELETE', `/admin/organizations/${orgId}`);
    const [left] = await q('SELECT (SELECT COUNT(*) FROM whatsapp_tasks WHERE organization_id=?)+(SELECT COUNT(*) FROM whatsapp_task_lists WHERE organization_id=?)+(SELECT COUNT(*) FROM whatsapp_task_labels WHERE organization_id=?) n', [orgId, orgId, orgId]);
    ok('org apagada: tarefas, colunas e etiquetas limpas', Number(left.n) === 0, left);
  }
  await db.end();
  console.log(`\n${pass}/${pass + fails.length} passaram${fails.length ? ` — ${fails.length} FALHAS` : ''}`);
}
