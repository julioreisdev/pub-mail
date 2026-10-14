// Teste do ritmo da fila `whatsapp_outbox` (Fase 3) sobre o `dist` compilado, com dependências FALSAS (nada sai):
//   cd back && npx nest build && cd .. && node docs/tools/wa_outbox_pacing_test.cjs
// Mede: espaçamento por número (60 s ÷ ritmo), número com fila grande não trava o outro, recuperação de
// envio preso em `sending` (preso pela 3ª vez = failed), 3 tentativas → failed, org sem acesso não envia, `sent_at` da
// cobrança não é sobrescrito por lembrete, pendente velho expira na fila (7 d; `charge_*` 10 d), payload com várias
// mensagens que falha no meio continua da que falhou (`sent_index`).
// O banco falso emula no JS a seleção "linha mais antiga de cada número" que o serviço faz por SQL (ROW_NUMBER) —
// o SQL em si só é exercitado no servidor (E2E).
const path = require('path');
const BACK = process.env.BACK_DIR || path.resolve(__dirname, '../../back');
const { WhatsAppOutboxService } = require(path.join(BACK, 'dist/src/whatsapp/whatsapp-outbox.service.js'));

let total = 0, fails = 0;
const ok = (l, c, x) => { total++; if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + l + (c || x === undefined ? '' : '  → ' + JSON.stringify(x))); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeDb() {
  const rows = []; const charges = new Map(); let seq = 0;
  // filtros do Prisma que o serviço usa: igualdade, in, not, lt/lte/gt/gte, startsWith e NOT {…}
  const cmp = (val, v) => {
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('in' in v) return v.in.includes(val);
      if ('not' in v) return val !== v.not;
      if ('lte' in v) return val <= v.lte;
      if ('lt' in v) return val < v.lt;
      if ('gte' in v) return val >= v.gte;
      if ('gt' in v) return val > v.gt;
      if ('startsWith' in v) return String(val || '').startsWith(v.startsWith);
    }
    return val === v;
  };
  const match = (r, w) => Object.entries(w).every(([k, v]) => (k === 'NOT' ? !match(r, v) : cmp(r[k], v)));
  const apply = (r, d) => { for (const [k, v] of Object.entries(d)) r[k] = v && typeof v === 'object' && !(v instanceof Date) && 'increment' in v ? (r[k] || 0) + v.increment : v; };
  return {
    rows, charges,
    // números com fila vencida, o mais antigo primeiro (o serviço faz por SQL com GROUP BY + LEFT JOIN da pausa; aqui em JS).
    // Os números já em atendimento são filtrados pelo próprio serviço (`busy`), então devolver todos é inofensivo.
    $queryRaw: async () => {
      const now = new Date();
      const due = rows.filter((r) => r.status === 'pending' && r.run_at <= now).sort((a, b) => a.run_at - b.run_at || a.created_at - b.created_at);
      const seen = new Set(); const out = [];
      for (const r of due) { if (seen.has(r.session_id)) continue; seen.add(r.session_id); out.push({ session_id: r.session_id, first_run: r.run_at }); }
      return out.slice(0, 8);
    },
    $executeRaw: async () => 0,
    whatsapp_sessions: { findFirst: async () => ({ outbox_paused_at: null, outbox_per_minute: null }), findMany: async () => [], findUnique: async () => null },
    whatsapp_appointments: { findMany: async () => [] },
    whatsapp_outbox: {
      findMany: async ({ where, take }) => rows.filter((r) => match(r, where)).sort((a, b) => a.run_at - b.run_at).slice(0, take || 999).map((r) => ({ ...r })),
      updateMany: async ({ where, data }) => { let count = 0; for (const r of rows) if (match(r, where)) { apply(r, data); count++; } return { count }; },
      create: async ({ data }) => { if (data.dedupe_key && rows.some((x) => x.organization_id === data.organization_id && x.dedupe_key === data.dedupe_key)) { const e = new Error('Unique constraint'); e.code = 'P2002'; throw e; } const r = { id: `o${++seq}`, status: 'pending', attempts: 0, run_at: new Date(), created_at: new Date(), ...data }; rows.push(r); return r; },
      groupBy: async () => [],
      count: async ({ where } = {}) => rows.filter((r) => !where || match(r, where)).length,
      findFirst: async ({ where }) => rows.find((r) => match(r, where)) || null,
      findUnique: async ({ where }) => rows.find((r) => r.id === where.id) || null,
    },
    whatsapp_crm_settings: { findUnique: async () => ({ charge: { outbox_per_minute: 60 } }) },
    whatsapp_messages: { create: async () => ({}), update: async () => ({}) },
    whatsapp_charges: { findMany: async ({ where }) => [...charges.values()].filter((c) => !where?.id?.in || where.id.in.includes(c.id)), findUnique: async ({ where }) => charges.get(where.id) || null, update: async ({ where, data }) => { const c = charges.get(where.id); Object.assign(c, data); return c; } },
  };
}

(async () => {
  const db = makeDb();
  const sent = []; // {session, at, text}
  const failText = new Set(['FALHA']);
  const sessionsById = { S1: { id: 'S1', organization_id: 'O1', openwa_session_id: 'g1', status: 'ready' }, S2: { id: 'S2', organization_id: 'O1', openwa_session_id: 'g2', status: 'ready' }, S3: { id: 'S3', organization_id: 'O2', openwa_session_id: 'g3', status: 'ready' }, S4: { id: 'S4', organization_id: 'O1', openwa_session_id: 'g4', status: 'ready' } };
  const openwa = { sendText: async (sid, jid, text) => { if (failText.has(text)) throw new Error('gateway recusou'); sent.push({ sid, at: Date.now(), text }); return { messageId: `m${sent.length}`, timestamp: Math.floor(Date.now() / 1000) }; }, sendMedia: async () => ({}) };
  const svc = new WhatsAppOutboxService(
    db, openwa, { rowById: async (_o, id) => sessionsById[id] || null, readyRows: async () => [] }, { readBase64: async () => ({}) },
    { bumpChat: async () => undefined }, { message: () => undefined },
    { canSend: async () => ({ ok: true }), noteSent: () => undefined },
    { isOrgActive: async (org) => org === 'O1' }, { emit: () => undefined },
  );
  const due = new Date(Date.now() - 1000);
  for (let i = 1; i <= 8; i++) await svc.enqueue('O1', { session_id: 'S1', chat_id: `55009999900${10 + i}@c.us`, kind: 't', payload: { text: `S1-${i}` }, run_at: due });
  for (let i = 1; i <= 3; i++) await svc.enqueue('O1', { session_id: 'S2', chat_id: `55009999900${30 + i}@c.us`, kind: 't', payload: { text: `S2-${i}` }, run_at: due });
  await svc.enqueue('O2', { session_id: 'S3', chat_id: '5500999990041@c.us', kind: 't', payload: { text: 'org-sem-acesso' }, run_at: due });
  const d1 = await svc.enqueue('O1', { session_id: 'S2', chat_id: 'x@c.us', kind: 't', payload: { text: 'a' }, dedupe_key: 'k1' });
  const d2 = await svc.enqueue('O1', { session_id: 'S2', chat_id: 'x@c.us', kind: 't', payload: { text: 'a' }, dedupe_key: 'k1' });
  ok('dedupe: mesma chave entra 1 vez (2ª devolve null, sem erro)', Boolean(d1) && d2 === null && db.rows.filter((r) => r.dedupe_key === 'k1').length === 1);
  db.rows.splice(db.rows.findIndex((r) => r.dedupe_key === 'k1'), 1);

  // rodadas como o worker faz (a cada 200 ms aqui, para medir com folga), durante 4,6 s; ritmo 60/min = 1 a cada 1 s por número
  // o worker novo (Fase 8) envia em segundo plano, um worker por número: `drain` = um tique + espera os workers terminarem
  const drain = async () => { await svc.tick(); for (let i = 0; i < 400 && svc.busy.size; i++) await sleep(25); };
  const t0 = Date.now();
  while (Date.now() - t0 < 4600) { await svc.tick(); await sleep(200); }
  const s1 = sent.filter((x) => x.sid === 'g1'); const s2 = sent.filter((x) => x.sid === 'g2');
  const gaps = s1.slice(1).map((x, i) => x.at - s1[i].at);
  ok('ritmo 60/min: número 1 enviou 4–5 em 4,6 s (não 8 de uma vez)', s1.length >= 4 && s1.length <= 5, s1.length);
  ok('espaçamento ≥ 1 s entre envios do mesmo número', gaps.every((g) => g >= 990), gaps);
  ok('número 2 não ficou travado atrás da fila do número 1 (3 de 3)', s2.length === 3, s2.length);
  ok('ordem de chegada respeitada no número 1', s1.map((x) => x.text).join(',') === ['S1-1', 'S1-2', 'S1-3', 'S1-4', 'S1-5'].slice(0, s1.length).join(','), s1.map((x) => x.text));
  ok('org sem acesso ativo: nada enviado, reagendada', !sent.some((x) => x.sid === 'g3') && db.rows.find((r) => r.session_id === 'S3').status === 'pending' && db.rows.find((r) => r.session_id === 'S3').run_at > new Date(), db.rows.find((r) => r.session_id === 'S3'));
  ok('linhas enviadas ficam sent com sent_at', db.rows.filter((r) => r.status === 'sent').length === s1.length + s2.length && db.rows.filter((r) => r.status === 'sent').every((r) => r.sent_at));
  for (let i = 0; i < 600 && svc.busy.size; i++) await sleep(25); // o resto da fila do número 1 termina em segundo plano

  // falha do gateway: 3 tentativas → failed
  const f = await svc.enqueue('O1', { session_id: 'S2', chat_id: '5500999990051@c.us', kind: 't', payload: { text: 'FALHA' }, run_at: due });
  for (let i = 0; i < 3; i++) { const r = db.rows.find((x) => x.id === f.id); r.run_at = new Date(Date.now() - 1000); await sleep(1050); await drain(); }
  const fr = db.rows.find((x) => x.id === f.id);
  ok('falha do gateway: 3 tentativas → failed com o erro', fr.status === 'failed' && fr.attempts === 3 && /recusou/.test(fr.last_error), fr);

  // envio preso em `sending` (o back caiu no meio)
  const st = await svc.enqueue('O1', { session_id: 'S2', chat_id: '5500999990052@c.us', kind: 't', payload: { text: 'preso' } });
  Object.assign(db.rows.find((x) => x.id === st.id), { status: 'sending', run_at: new Date(Date.now() - 11 * 60_000) });
  const st2 = await svc.enqueue('O1', { session_id: 'S2', chat_id: '5500999990053@c.us', kind: 't', payload: { text: 'recente' } });
  Object.assign(db.rows.find((x) => x.id === st2.id), { status: 'sending', run_at: new Date(Date.now() - 60_000) });
  const n = await svc.recoverStuck();
  ok('preso há > 10 min volta para pending (+1 tentativa); o recente continua sending', n === 1 && db.rows.find((x) => x.id === st.id).status === 'pending' && db.rows.find((x) => x.id === st.id).attempts === 1 && db.rows.find((x) => x.id === st2.id).status === 'sending');
  ok('no boot (recoverStuck(0)) todos os sending voltam', (await svc.recoverStuck(0)) === 1 && db.rows.find((x) => x.id === st2.id).status === 'pending');
  // preso pela 3ª vez (attempts ≥ 3) não volta: falha de vez
  const st3 = await svc.enqueue('O1', { session_id: 'S2', chat_id: '5500999990054@c.us', kind: 't', payload: { text: 'preso-3x' } });
  Object.assign(db.rows.find((x) => x.id === st3.id), { status: 'sending', attempts: 3, run_at: new Date(Date.now() - 11 * 60_000) });
  await svc.recoverStuck();
  ok('preso com 3 tentativas → failed (não volta para a fila)', db.rows.find((x) => x.id === st3.id).status === 'failed' && db.rows.find((x) => x.id === st3.id).attempts === 3, db.rows.find((x) => x.id === st3.id));

  // pendente velho demais expira na fila (7 dias; `charge_*` 10 dias) — conta desde a criação, reagendar não renova
  const old1 = await svc.enqueue('O1', { session_id: 'S2', chat_id: '5500999990061@c.us', kind: 'subscription_x', payload: { text: 'velho' }, run_at: new Date(Date.now() + 3600_000) });
  const old2 = await svc.enqueue('O1', { session_id: 'S2', chat_id: '5500999990062@c.us', kind: 'charge_reminder', payload: { text: 'cobrança 8 d' }, run_at: new Date(Date.now() + 3600_000) });
  const old3 = await svc.enqueue('O1', { session_id: 'S2', chat_id: '5500999990063@c.us', kind: 'charge_reminder', payload: { text: 'cobrança 11 d' }, run_at: new Date(Date.now() + 3600_000) });
  db.rows.find((x) => x.id === old1.id).created_at = new Date(Date.now() - 8 * 86400_000);
  db.rows.find((x) => x.id === old2.id).created_at = new Date(Date.now() - 8 * 86400_000);
  db.rows.find((x) => x.id === old3.id).created_at = new Date(Date.now() - 11 * 86400_000);
  const expired = await svc.expireOld();
  ok('expira na fila: aviso com 8 dias e cobrança com 11 dias → failed "expirou na fila"; cobrança com 8 dias fica', expired === 2 && db.rows.find((x) => x.id === old1.id).status === 'failed' && /expirou/.test(db.rows.find((x) => x.id === old1.id).last_error) && db.rows.find((x) => x.id === old3.id).status === 'failed' && db.rows.find((x) => x.id === old2.id).status === 'pending', db.rows.filter((x) => [old1.id, old2.id, old3.id].includes(x.id)));

  // payload com 2 mensagens: a 2ª falha → guarda sent_index=1; na nova tentativa só a 2ª sai (a 1ª não repete)
  const multi = await svc.enqueue('O1', { session_id: 'S4', chat_id: '5500999990071@c.us', kind: 't', payload: { messages: [{ text: 'parte-1' }, { text: 'FALHA' }] }, run_at: due });
  await drain();
  const m1 = db.rows.find((x) => x.id === multi.id);
  ok('falhou na 2ª mensagem: pending com attempts 1 e payload.sent_index = 1; a 1ª saiu', m1.status === 'pending' && m1.attempts === 1 && m1.payload.sent_index === 1 && sent.filter((x) => x.text === 'parte-1').length === 1, m1);
  failText.delete('FALHA');
  m1.run_at = new Date(Date.now() - 1000);
  await sleep(1050); await drain();
  ok('nova tentativa continua da 2ª mensagem: "parte-1" não repete, "FALHA" sai e a linha fica sent', db.rows.find((x) => x.id === multi.id).status === 'sent' && sent.filter((x) => x.text === 'parte-1').length === 1 && sent.filter((x) => x.text === 'FALHA').length === 1, sent.filter((x) => x.sid === 'g4').map((x) => x.text));

  // sent_at da cobrança = 1º envio (lembrete não sobrescreve)
  const first = new Date('2026-10-01T12:00:00Z');
  db.charges.set('C1', { id: 'C1', sent_at: first, reminders: [] });
  await svc.markChargeSent('C1', 'reminder_due');
  ok('lembrete pela fila não sobrescreve sent_at e entra em reminders', db.charges.get('C1').sent_at === first && db.charges.get('C1').reminders.length === 1);
  db.charges.set('C2', { id: 'C2', sent_at: null, reminders: [] });
  await svc.markChargeSent('C2', 'charge');
  ok('1º envio da cobrança grava sent_at', db.charges.get('C2').sent_at instanceof Date);

  console.log(`\n${total - fails}/${total} passaram`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
