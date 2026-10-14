// Teste do provedor Asaas (Fase 4) direto contra o SANDBOX — roda no servidor (a chave fica em /root/pubmail.secrets):
//   cd back && npx tsc src/payments/pix-providers.ts --outDir /tmp/prov --module commonjs --target es2022 --moduleResolution node --esModuleInterop --skipLibCheck
//   tar -C /tmp -czf - prov | ssh pubmail-hostinger 'rm -rf /root/prov && tar -xzf - -C /root' && scp docs/tools/asaas_provider_test.mjs pubmail-hostinger:/root/
//   ssh pubmail-hostinger 'cd /root && PROV=/root/prov node asaas_provider_test.mjs; rm -rf /root/prov /root/asaas_provider_test.mjs'
// Cria e apaga no sandbox: cliente, PIX, boleto, cartão (página + token + recusa), parcelado. Nunca imprime a chave.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = process.env.PROV || '/root/prov';
const F = require(`${P}/pix-providers.js`);
const A = require(`${P}/providers/asaas.js`);
const KEY = readFileSync('/root/pubmail.secrets', 'utf8').split('\n').find((l) => l.startsWith('ASAAS_SANDBOX_API_KEY='))?.split('=').slice(1).join('=').trim();
let total = 0, fails = 0;
const ok = (l, c, x) => { total++; if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + l + (c || x === undefined ? '' : '  → ' + JSON.stringify(x).slice(0, 300))); };
const ref = `pm-test-${Date.now().toString(36)}`;
const payer = { ref, name: 'Teste Provedor', doc: '52998224725', email: 'teste.provedor@exemplo.com', phone: '5511999999999' };
const card = { holderName: 'TESTE', number: '4444444444444444', expiryMonth: '12', expiryYear: '2030', ccv: '123' };
const holder = { name: 'Teste Provedor', email: 'teste.provedor@exemplo.com', cpfCnpj: '52998224725', postalCode: '01310100', addressNumber: '100', phone: '11999999999' };
const created = []; let customerId;
try {
  ok('chave de sandbox detectada', A.isAsaasSandbox(KEY) && A.asaasBase(KEY).includes('sandbox'));
  let t = await F.testProvider('asaas', KEY);
  ok('testProvider: conta válida (sandbox)', t.ok && /Sandbox/.test(t.detail), t);
  ok('suporte: asaas pix/boleto/cartão/parcelado; MP sem cartão', F.providerSupports('asaas').card && F.providerSupports('asaas').boleto && !F.providerSupports('mercadopago').card && F.providerSupportsBoleto('asaas'));
  // sem documento → erro claro
  let r = await F.createPixCharge('asaas', KEY, 500, 'sem doc', { payer: { ref: `${ref}-x`, name: 'Sem Doc' } });
  ok('cliente sem CPF/CNPJ → erro claro, nada criado', !r.ok && /CPF\/CNPJ/.test(r.error), r);
  // PIX
  r = await F.createPixCharge('asaas', KEY, 500, 'PIX teste', { payer, dueAt: new Date() });
  if (r.chargeId) created.push(r.chargeId); customerId = r.customerId;
  ok('PIX: cria com copia e cola + QR e devolve o cliente do Asaas', r.ok && r.pixCode?.length > 50 && r.qrBase64?.length > 100 && /^cus_/.test(r.customerId || ''), { ok: r.ok, err: r.error });
  let st = await F.getChargeStatus('asaas', KEY, r.chargeId);
  ok('PIX: status PENDING', st.ok && st.status === 'PENDING', st);
  const r2 = await F.createPixCharge('asaas', KEY, 700, 'PIX 2', { payer: { ...payer, customerId } });
  if (r2.chargeId) created.push(r2.chargeId);
  ok('PIX com customerId já conhecido (não cria cliente de novo)', r2.ok && r2.customerId === customerId, r2.error);
  const again = await A.asaasEnsureCustomer(KEY, payer);
  ok('cliente achado pelo externalReference (sem duplicar)', again.ok && again.customerId === customerId, again);
  let c = await F.cancelCharge('asaas', KEY, r2.chargeId);
  st = await F.getChargeStatus('asaas', KEY, r2.chargeId);
  ok('cancelar PIX → EXPIRED no status', c.ok && st.ok && st.status === 'EXPIRED', { c, st });
  // boleto
  r = await F.createBoletoCharge('asaas', KEY, 1990, 'Boleto teste', {}, { payer: { ...payer, customerId }, dueAt: new Date(Date.now() + 3 * 86400000) });
  if (r.chargeId) created.push(r.chargeId);
  ok('boleto: link + linha digitável', r.ok && /^https:/.test(r.url || '') && (r.digitable || '').length >= 40, { ok: r.ok, err: r.error });
  // cartão sem token → página segura
  r = await F.createCardCharge('asaas', KEY, 1250, 'Cartão 1ª', { payer: { ...payer, customerId } });
  if (r.chargeId) created.push(r.chargeId);
  ok('cartão sem token → PENDING com página segura do Asaas (invoiceUrl)', r.ok && r.status === 'PENDING' && /^https:\/\/.*asaas\.com\//.test(r.invoiceUrl || '') && !r.card, r);
  const paid = await A.asaasSandboxPayWithCard(KEY, r.chargeId, card, holder);
  const d = await A.asaasDetails(KEY, r.chargeId);
  ok('cliente paga na página (simulado) → PAID com token, bandeira e final 4444', paid.ok && d.ok && d.status === 'PAID' && d.card?.token && d.card.last4 === '4444' && d.card.brand, { paid: paid.error, st: d.status, last4: d.card?.last4, brand: d.card?.brand });
  const tok = d.card?.token;
  // ciclo seguinte com o token
  r = await F.createCardCharge('asaas', KEY, 1250, 'Cartão 2º ciclo', { payer: { ...payer, customerId }, cardToken: tok, remoteIp: '179.197.225.107' });
  if (r.chargeId) created.push(r.chargeId);
  ok('2º ciclo com o token → aprovado na hora (PAID) com o mesmo final', r.ok && r.status === 'PAID' && r.card?.last4 === '4444', r);
  // recusa
  const bad = await A.asaasCreateCard(KEY, 1250, 'Cartão recusado', { payer: { ...payer, customerId }, cardToken: 'tok_invalido_pubmail_teste', remoteIp: '179.197.225.107' });
  ok('token inválido → falha sem cobrar (ok:false)', !bad.ok && bad.error, bad);
  // parcelado (página)
  r = await F.createCardCharge('asaas', KEY, 3000, 'Parcelado 3x', { payer: { ...payer, customerId }, installments: 3 });
  if (r.chargeId) created.push(r.chargeId);
  ok('parcelado 3x → página segura', r.ok && r.invoiceUrl, r);
  // MP continua sem cartão
  r = await F.createCardCharge('mercadopago', 'x', 100, 'x', { payer });
  ok('cartão no Mercado Pago → recusa clara', !r.ok && /Asaas/.test(r.error));
  // webhook id
  ok('webhook: id da cobrança em payment.id', F.extractWebhookChargeId('asaas', {}, { event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_123' } }) === 'pay_123');
  const wt = A.asaasWebhookToken();
  ok('token do webhook: 40 letras, sem números', wt.length === 40 && /^[a-zA-Z]+$/.test(wt));
  // listagem (conciliação)
  const today = new Date().toISOString().slice(0, 10);
  const l = await A.asaasList(KEY, today, today);
  ok('listagem (criadas hoje) traz as cobranças do teste com o status certo (2 cartões pagos, 1 PIX cancelado)', l.ok && created.slice(0, 1).every((id) => l.items.some((x) => x.id === id)) && l.items.filter((x) => created.includes(x.id) && x.status === 'PAID').length >= 2, { n: l.items.length, err: l.error, mine: l.items.filter((x) => created.includes(x.id)).map((x) => x.raw) });
} catch (e) { fails++; console.log('ERRO', e?.stack || e); }
finally {
  for (const id of created) await F.cancelCharge('asaas', KEY, id).catch(() => {});
  if (customerId) await fetch(`${A.asaasBase(KEY)}/customers/${customerId}`, { method: 'DELETE', headers: { access_token: KEY, 'User-Agent': 'PubMail' } }).catch(() => {});
  console.log(`\n${total - fails}/${total} passaram`);
  process.exit(fails ? 1 : 0);
}
