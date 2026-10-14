// Testes do util puro da importação em segundo plano (Fase 8, §12.3).
// Rodar: node docs/tools/wa_import_util_test.mjs   (Node 22.6+ lê o .ts direto — em 22 use --experimental-strip-types)
import * as u from '../../back/src/whatsapp/wa-import.util.ts';

let ok = 0, fail = 0;
const eq = (name, got, exp) => {
  const g = JSON.stringify(got), e = JSON.stringify(exp);
  if (g === e) ok++;
  else { fail++; console.log(`FALHOU ${name}\n  esperado ${e}\n  veio     ${g}`); }
};
const BOM = String.fromCharCode(0xfeff);

// separador
eq('sep ;', u.detectSeparator('phone;name;doc'), ';');
eq('sep ,', u.detectSeparator('phone,name,doc'), ',');
eq('sep tab', u.detectSeparator('phone\tname\tdoc'), '\t');
eq('sep ignora dentro de aspas', u.detectSeparator('"a;b;c",x,y'), ',');
eq('sep vazio', u.detectSeparator('phone'), ',');
eq('firstLine com BOM', u.firstLineOf(BOM + 'a;b\r\nc;d'), 'a;b');

// parser
const recs = (t, sep) => u.parseCsvText(t, sep).records;
eq('simples', recs('a,b\n1,2\n'), [{ line: 1, fields: ['a', 'b'] }, { line: 2, fields: ['1', '2'] }]);
eq('BOM + CRLF', recs(BOM + 'a;b\r\n1;2\r\n'), [{ line: 1, fields: ['a', 'b'] }, { line: 2, fields: ['1', '2'] }]);
eq('aspas com separador', recs('a;b\n"x;y";2'), [{ line: 1, fields: ['a', 'b'] }, { line: 2, fields: ['x;y', '2'] }]);
eq('aspas dobradas', recs('a,b\n"diz ""oi""",2'), [{ line: 1, fields: ['a', 'b'] }, { line: 2, fields: ['diz "oi"', '2'] }]);
eq('quebra dentro de campo + linha', recs('a,b\n"linha1\nlinha2",2\n3,4'), [{ line: 1, fields: ['a', 'b'] }, { line: 2, fields: ['linha1\nlinha2', '2'] }, { line: 4, fields: ['3', '4'] }]);
eq('CRLF dentro de campo vira LF', recs('a,b\r\n"x\r\ny",2\r\n'), [{ line: 1, fields: ['a', 'b'] }, { line: 2, fields: ['x\ny', '2'] }]);
eq('linhas em branco puladas', recs('a,b\n\n1,2\n\n\n3,4'), [{ line: 1, fields: ['a', 'b'] }, { line: 3, fields: ['1', '2'] }, { line: 6, fields: ['3', '4'] }]);
eq('só separadores = linha vazia (Excel)', recs('a;b\n;\n1;2\n;;;\n').length, 2);
eq('aspas vazias contam', recs('a;b\n"";\n').length, 2);
eq('sem quebra no fim', recs('a,b\n1,2'), [{ line: 1, fields: ['a', 'b'] }, { line: 2, fields: ['1', '2'] }]);
eq('campo vazio no fim', recs('a,b,c\n1,,\n'), [{ line: 1, fields: ['a', 'b', 'c'] }, { line: 2, fields: ['1', '', ''] }]);
eq('aspa literal no meio', recs('a\n12"3'), [{ line: 1, fields: ['a'] }, { line: 2, fields: ['12"3'] }]);
eq('CR sozinho (Mac antigo)', recs('a,b\r1,2\r'), [{ line: 1, fields: ['a', 'b'] }, { line: 2, fields: ['1', '2'] }]);

// streaming: o mesmo texto partido em pedaços de 1 a 7 caracteres dá o mesmo resultado
const big = BOM + 'phone;name;notes\r\n5511999990001;"Maria; Souza";"obs ""x""\r\ncom quebra"\r\n\r\n5511999990002;João;\n"5511999990003";"Ana";fim';
const whole = u.parseCsvText(big).records;
for (const size of [1, 2, 3, 5, 7]) {
  const p = new u.CsvStreamParser(';');
  const out = [];
  for (let i = 0; i < big.length; i += size) out.push(...p.push(big.slice(i, i + size)));
  out.push(...p.end());
  eq(`streaming pedaço ${size}`, out, whole);
}
eq('streaming conteúdo', whole.map((r) => r.fields), [['phone', 'name', 'notes'], ['5511999990001', 'Maria; Souza', 'obs "x"\ncom quebra'], ['5511999990002', 'João', ''], ['5511999990003', 'Ana', 'fim']]);
eq('streaming linhas', whole.map((r) => r.line), [1, 2, 5, 6]);

// cabeçalho
eq('normHeader acento', u.normHeader(' Município '), 'municipio');
eq('normHeader custom', u.normHeader('custom.Data_Nasc'), 'custom.data_nasc');
eq('normHeader campo:', u.normHeader('campo:plano'), 'custom.plano');
const map = u.columnIndex(['Telefone', 'Nome', 'CPF', 'custom.convenio', 'Coluna X', 'Saldo', 'Histórico Pagamentos']);
eq('columnIndex', [map.idx.phone, map.idx.name, map.idx.doc, map.idx.balance, map.idx.paid_history], [0, 1, 2, 5, 6]);
eq('columnIndex custom', map.custom, [{ key: 'convenio', index: 3 }]);
eq('columnIndex desconhecida', map.unknown, ['Coluna X']);
eq('cell', u.cell([' 55 ', 'x'], map, 'phone'), '55');
eq('cell ausente', u.cell(['1'], map, 'unit'), '');

// dinheiro
eq('money 99,90', u.parseMoneyCents('99,90'), 9990);
eq('money 1.234,56', u.parseMoneyCents('1.234,56'), 123456);
eq('money 1234.56', u.parseMoneyCents('1234.56'), 123456);
eq('money 1,234.56', u.parseMoneyCents('1,234.56'), 123456);
eq('money R$ 1.200', u.parseMoneyCents('R$ 1.200'), 120000);
eq('money 1.234.567', u.parseMoneyCents('1.234.567'), 123456700);
eq('money 50', u.parseMoneyCents('50'), 5000);
eq('money vazio', u.parseMoneyCents(''), null);
eq('money inválido', Number.isNaN(u.parseMoneyCents('abc')), true);

// datas
eq('data iso', u.parseDateInput('2026-11-10'), '2026-11-10');
eq('data br', u.parseDateInput('05/03/2027'), '2027-03-05');
eq('data br 1 dígito', u.parseDateInput('5/3/2027'), '2027-03-05');
eq('data inválida 31/02', u.parseDateInput('31/02/2026'), '');
eq('data lixo', u.parseDateInput('amanhã'), '');
eq('data vazia', u.parseDateInput(''), null);

// histórico
const h = u.parsePaidHistory('2026-08-10:99,90| 10/09/2026:99,90 |2026-09-30:1.200,00', '2026-10-14');
eq('histórico ok', h, { entries: [{ date: '2026-08-10', cents: 9990 }, { date: '2026-09-10', cents: 9990 }, { date: '2026-09-30', cents: 120000 }], errors: [] });
const h2 = u.parsePaidHistory('2026-08-10|2027-01-01:10|2026-02-30:5|2026-01-01:x', '2026-10-14');
eq('histórico erros', [h2.entries.length, h2.errors.length], [0, 4]);
eq('histórico vazio', u.parsePaidHistory('', '2026-10-14'), { entries: [], errors: [] });

// bool
eq('bool sim', u.parseBool('sim', false), true);
eq('bool false', u.parseBool('false', true), false);
eq('bool vazio', u.parseBool(undefined, true), true);

// saídas
const ec = u.errorsCsv([{ line: 3, field: 'doc', message: 'CPF/CNPJ inválido.' }, { line: 4, message: 'texto; com "aspas"' }]);
eq('errorsCsv BOM', ec.charCodeAt(0), 0xfeff);
eq('errorsCsv conteúdo', ec.slice(1), 'linha;campo;erro\r\n3;doc;CPF/CNPJ inválido.\r\n4;;"texto; com ""aspas"""\r\n');
const t = u.templateCsv([{ key: 'convenio', example: 'Unimed' }]);
const tr = u.parseCsvText(t).records;
eq('template 3 linhas', tr.length, 3);
eq('template sep ;', u.parseCsvText(t).sep, ';');
const tmap = u.columnIndex(tr[0].fields);
eq('template colunas reconhecidas', Object.keys(tmap.idx).length, u.TEMPLATE_COLUMNS.length);
eq('template custom', tmap.custom, [{ key: 'convenio', index: u.TEMPLATE_COLUMNS.length }]);
eq('template sem desconhecidas', tmap.unknown, []);
eq('template histórico de exemplo válido', u.parsePaidHistory(u.cell(tr[1].fields, tmap, 'paid_history'), '2026-10-14').errors, []);
eq('template preço ex2', u.parseMoneyCents(u.cell(tr[2].fields, tmap, 'price')), 120000);

// periodicidade (C-H2, revisão 14/10/2026)
eq('billing mensal', u.parseBilling('Mensal'), 'monthly');
eq('billing anual', u.parseBilling('ANUAL'), 'yearly');
eq('billing semestral', u.parseBilling('semestral'), 'semiannual');
eq('billing trimestral', u.parseBilling('trimestral'), 'quarterly');
eq('billing avulso', u.parseBilling('avulso'), 'once');
eq('billing único com acento', u.parseBilling('Único'), 'once');
eq('billing inglês', u.parseBilling('yearly'), 'yearly');
eq('billing 12 meses', u.parseBilling('12 meses'), 'yearly');
eq('billing 3', u.parseBilling('3'), 'quarterly');
eq('billing vazio', u.parseBilling(''), null);
eq('billing inválido', u.parseBilling('quinzenal'), '');
eq('nome Plano Anual', u.billingFromName('Plano Anual'), 'yearly');
eq('nome Plano Mensal', u.billingFromName('Plano Mensal'), 'monthly');
eq('nome sem palavra', u.billingFromName('Plano Ouro'), null);
eq('nome ambíguo', u.billingFromName('Mensal ou Anual'), null);
eq('nome Semestral acento', u.billingFromName('Pacote SEMESTRAL'), 'semiannual');
eq('columnIndex billing', u.columnIndex(['telefone', 'Periodicidade']).idx.billing, 1);
eq('template billing ex1', u.parseBilling(u.cell(tr[1].fields, tmap, 'billing')), 'monthly');
eq('template billing ex2 (Plano Anual)', u.parseBilling(u.cell(tr[2].fields, tmap, 'billing')), 'yearly');

// CSV sem fórmula (P7-12)
eq('csvSafe =', u.csvSafe('=HYPERLINK("x")'), `'=HYPERLINK("x")`);
eq('csvSafe +', u.csvSafe('+5511'), `'+5511`);
eq('csvSafe -', u.csvSafe('-1'), `'-1`);
eq('csvSafe @', u.csvSafe('@SUM(1)'), `'@SUM(1)`);
eq('csvSafe tab', u.csvSafe('\tx'), `'\tx`);
eq('csvSafe normal', u.csvSafe('Maria'), 'Maria');
eq('csvSafe vazio', u.csvSafe(null), '');
eq('errorsCsv neutraliza', u.errorsCsv([{ line: 2, field: 'name', message: '=1+1' }]).slice(1), "linha;campo;erro\r\n2;name;'=1+1\r\n");

console.log(`\n${ok}/${ok + fail} ok`);
process.exit(fail ? 1 : 0);
