// Teste PURO dos campos personalizados (Fase 7). Node ≥ 23.6 (type stripping):
//   node docs/tools/wa_custom_fields_test.mjs
import assert from 'node:assert/strict';
import * as U from '../../back/src/whatsapp/wa-custom-fields.util.ts';

let ok = 0, fail = 0;
const t = (name, fn) => { try { fn(); ok++; } catch (e) { fail++; console.log(`✗ ${name}\n   ${e.message}`); } };
const throwsCode = (fn, code) => { try { fn(); } catch (e) { assert.equal(e.code, code); return e; } assert.fail('não lançou'); };

const legacy = U.normalizeCustomFieldMap([{ label: 'Plano Odonto', type: 'select', options: ['Sim', 'Não'] }, { label: 'Matrícula' }]);
t('array antigo vira clientes', () => { assert.equal(legacy.customer.length, 2); assert.equal(legacy.product.length, 0); });
t('chave sem acento', () => assert.equal(legacy.customer[0].key, 'plano_odonto'));
t('todas as entidades presentes', () => assert.deepEqual(Object.keys(legacy).sort(), [...U.CF_ENTITIES].sort()));
const m = U.normalizeCustomFieldMap({
  customer: [
    { label: 'Data de nascimento', type: 'date', required: true, ask_in_bot: true },
    { label: 'CPF do responsável', type: 'cpf' },
    { label: 'Aceita WhatsApp', type: 'bool', visible_to_customer: true },
    { label: 'Velocidade', type: 'select', options: ['100 Mb', '300 Mb', '300 Mb', ''] },
    { label: 'Vazia', type: 'select', options: [] },
    { label: 'usage_cycle' },
    { label: 'Velocidade' },
  ],
  order: [{ label: 'Troco para', type: 'number' }],
  lixo: [{ label: 'x' }],
});
t('select sem opções descartado', () => assert.ok(!m.customer.some((d) => d.key === 'vazia')));
t('chave reservada descartada', () => assert.ok(!m.customer.some((d) => d.key === 'usage_cycle')));
t('duplicada descartada', () => assert.equal(m.customer.filter((d) => d.key === 'velocidade').length, 1));
t('opções deduplicadas', () => assert.deepEqual(m.customer.find((d) => d.key === 'velocidade').options, ['100 Mb', '300 Mb']));
t('entidade desconhecida ignorada', () => assert.equal(m.lixo, undefined));
t('nunca lança com lixo', () => { U.normalizeCustomFieldMap('x'); U.normalizeCustomFieldMap(null); U.normalizeCustomFieldMap({ customer: 'x' }); });

const defs = m.customer;
t('criação sem obrigatório → CUSTOM_REQUIRED', () => { const e = throwsCode(() => U.validateCustomValues(defs, {}, { mode: 'create' }), 'CUSTOM_REQUIRED'); assert.equal(e.fields[0].key, 'data_de_nascimento'); });
t('data DD/MM/AAAA aceita', () => assert.equal(U.validateCustomValues(defs, { data_de_nascimento: '05/03/1990' }, { mode: 'create' }).data_de_nascimento, '1990-03-05'));
t('data impossível → CUSTOM_INVALID', () => throwsCode(() => U.validateCustomValues(defs, { data_de_nascimento: '31/02/1990' }, { mode: 'create' }), 'CUSTOM_INVALID'));
t('CPF inválido → CUSTOM_INVALID', () => throwsCode(() => U.validateCustomValues(defs, { data_de_nascimento: '1990-01-01', cpf_do_responsavel: '111.111.111-11' }, { mode: 'create' }), 'CUSTOM_INVALID'));
t('CPF válido guardado só dígitos', () => assert.equal(U.validateCustomValues(defs, { data_de_nascimento: '1990-01-01', cpf_do_responsavel: '529.982.247-25' }, { mode: 'create' }).cpf_do_responsavel, '52998224725'));
t('bool "sim"', () => assert.equal(U.validateCustomValues(defs, { data_de_nascimento: '1990-01-01', aceita_whatsapp: 'Sim' }, { mode: 'create' }).aceita_whatsapp, true));
t('select ignora maiúsculas e devolve a opção', () => assert.equal(U.validateCustomValues(defs, { data_de_nascimento: '1990-01-01', velocidade: '300 mb' }, { mode: 'create' }).velocidade, '300 Mb'));
t('select fora da lista', () => throwsCode(() => U.validateCustomValues(defs, { data_de_nascimento: '1990-01-01', velocidade: '1 Gb' }, { mode: 'create' }), 'CUSTOM_INVALID'));
t('edição sem tocar no obrigatório passa', () => assert.equal(U.validateCustomValues(defs, { velocidade: '100 Mb' }, { mode: 'update', current: { data_de_nascimento: '1990-01-01' } }).velocidade, '100 Mb'));
t('edição apagando obrigatório → CUSTOM_REQUIRED', () => throwsCode(() => U.validateCustomValues(defs, { data_de_nascimento: '' }, { mode: 'update', current: { data_de_nascimento: '1990-01-01' } }), 'CUSTOM_REQUIRED'));
t('chave interna do registro preservada e não sobrescrita', () => { const r = U.validateCustomValues(defs, { usage_cycle: 'x', data_de_nascimento: '1990-01-01' }, { mode: 'update', current: { usage_cycle: '2026-10-01' } }); assert.equal(r.usage_cycle, '2026-10-01'); });
t('chave livre (integração) guardada', () => assert.equal(U.validateCustomValues(defs, { data_de_nascimento: '1990-01-01', erp_id: 'A-12' }, { mode: 'create' }).erp_id, 'A-12'));
t('número pt-BR "1.234,50"', () => assert.equal(U.validateCustomValues(m.order, { troco_para: '1.234,50' }, { mode: 'create' }).troco_para, 1234.5));
t('número "50"', () => assert.equal(U.validateCustomValues(m.order, { troco_para: 50 }, { mode: 'create' }).troco_para, 50));
t('skipRequired', () => assert.deepEqual(U.validateCustomValues(defs, {}, { mode: 'create', skipRequired: true }), {}));
t('displayCustomValue', () => { assert.equal(U.displayCustomValue(defs[0], '1990-03-05'), '05/03/1990'); assert.equal(U.displayCustomValue(defs[2], true), 'Sim'); });
t('customVars com legado', () => { const v = U.customVars('cliente', defs, { velocidade: '300 Mb' }, true); assert.equal(v['cliente.custom.velocidade'], '300 Mb'); assert.equal(v['cliente.velocidade'], '300 Mb'); assert.equal(v['cliente.custom.data_de_nascimento'], ''); });
t('customList só visíveis', () => assert.deepEqual(U.customList(defs, { aceita_whatsapp: false }, { onlyVisible: true }).map((x) => [x.key, x.display]), [['aceita_whatsapp', 'Não']]));
t('livre: objeto grande descartado, pequeno fica', () => {
  const big = { x: 'a'.repeat(3000) };
  const r = U.validateCustomValues([], { erp: { id: 7 }, blob: big, txt: 'b'.repeat(900), n: 5, f: () => 1 }, { mode: 'create' });
  assert.deepEqual(r.erp, { id: 7 }); assert.equal('blob' in r, false); assert.equal(r.txt.length, 500); assert.equal(r.n, 5); assert.equal('f' in r, false);
});
t('capFreeValue', () => { assert.equal(U.capFreeValue(Infinity), undefined); assert.deepEqual(U.capFreeValue([1, 2]), [1, 2]); assert.equal(U.capFreeValue(['x'.repeat(2100)]), undefined); });

console.log(`\n${ok}/${ok + fail} passaram${fail ? ` — ${fail} FALHAS` : ''}`);
process.exit(fail ? 1 : 0);
