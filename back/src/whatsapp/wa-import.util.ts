// ============================================================================
// Importação de clientes em segundo plano (Fase 8, contrato §12.3) — funções PURAS (sem Nest, sem Prisma).
// Testes: `node docs/tools/wa_import_util_test.mjs` (Node 22+ lê o .ts direto; por isso nada de enum,
// parameter properties ou import aqui dentro).
//
//  - CsvStreamParser: CSV em pedaços (streaming) com aspas, separador dentro de aspas, aspas dobradas (""),
//    quebras de linha DENTRO de campo, CRLF/LF/CR e BOM. Cada registro sai com a linha física onde começou.
//  - detectSeparator: `;` `,` ou TAB pela 1ª linha (contando só fora de aspas).
//  - normHeader / columnIndex: cabeçalho sem acento, minúsculo; `custom.<chave>` preservado.
//  - parseMoneyCents / parseDateInput / parsePaidHistory / parseBool / parseBilling / billingFromName.
//  - errorsCsv / templateCsv: arquivos de saída (BOM + `;`); csvSafe = célula sem fórmula (Excel/Sheets).
// ============================================================================

/** BOM (U+FEFF) — montado por código para não ficar invisível no fonte. */
export const BOM = String.fromCharCode(0xfeff);
const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

export type CsvRecord = { line: number; fields: string[] };

/** Separador pela 1ª linha (fora de aspas). Empate/ausente = vírgula. */
export function detectSeparator(firstLine: string): string {
  const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0 };
  let q = false;
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') q = !q;
    else if (!q && ch in counts) counts[ch]++;
  }
  let best = ',';
  let max = 0;
  for (const s of [';', '\t', ',']) if (counts[s] > max) { max = counts[s]; best = s; }
  return best;
}

/** 1ª linha física do texto (até \r ou \n), sem BOM — para detectar o separador. */
export function firstLineOf(text: string): string {
  const t = stripBom(text);
  const m = /\r|\n/.exec(t);
  return m ? t.slice(0, m.index) : t;
}

/**
 * Parser de CSV incremental. `push(chunk)` devolve os registros COMPLETOS daquele pedaço; `end()` devolve o último.
 * Registro sem nenhum valor (linha em branco ou só separadores, comum no fim de planilhas do Excel) não é devolvido; campo entre aspas conta como valor. A linha (`line`) é a física onde o registro começa (1 = cabeçalho).
 */
export class CsvStreamParser {
  sep: string;
  private field = '';
  private fields: string[] = [];
  private inQuotes = false;
  private quotePending = false; // vimos `"` dentro de aspas: pode ser o fim do campo ou o 1º de `""`
  private lastWasCR = false;
  private line = 1;
  private recordLine = 1;
  private started = false; // já tirou o BOM
  private recordHasData = false;

  constructor(sep: string) {
    this.sep = sep;
  }

  private endField() {
    this.fields.push(this.field);
    this.field = '';
  }

  private endRecord(out: CsvRecord[]) {
    this.endField();
    const empty = !this.recordHasData && this.fields.every((f) => f.trim() === '');
    if (!empty) out.push({ line: this.recordLine, fields: this.fields });
    this.fields = [];
    this.recordHasData = false;
  }

  push(chunk: string): CsvRecord[] {
    const out: CsvRecord[] = [];
    let s = chunk;
    if (!this.started) {
      if (s.length === 0) return out;
      s = stripBom(s);
      this.started = true;
    }
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (this.lastWasCR) {
        this.lastWasCR = false;
        if (ch === '\n') continue; // CRLF: o \r já fechou a linha
      }
      if (this.inQuotes) {
        if (this.quotePending) {
          this.quotePending = false;
          if (ch === '"') { this.field += '"'; continue; } // "" = aspas literal
          this.inQuotes = false; // a aspa anterior fechou o campo; trata `ch` fora de aspas abaixo
        } else if (ch === '"') { this.quotePending = true; continue; }
        else {
          if (ch === '\n' || ch === '\r') { this.line++; if (ch === '\r') this.lastWasCR = true; this.field += '\n'; continue; } // quebra dentro do campo vira \n
          this.field += ch;
          continue;
        }
      }
      // fora de aspas
      if (ch === '"') {
        if (this.field.trim() === '') { this.field = ''; this.inQuotes = true; this.recordHasData = true; }
        else this.field += ch; // aspa no meio de campo sem aspas: literal
        continue;
      }
      if (ch === this.sep) { this.endField(); continue; }
      if (ch === '\n' || ch === '\r') {
        this.endRecord(out);
        this.line++;
        this.recordLine = this.line;
        if (ch === '\r') this.lastWasCR = true;
        continue;
      }
      this.field += ch;
    }
    return out;
  }

  end(): CsvRecord[] {
    const out: CsvRecord[] = [];
    if (this.quotePending) { this.quotePending = false; this.inQuotes = false; }
    if (this.field !== '' || this.fields.length || this.recordHasData) this.endRecord(out);
    return out;
  }
}

/** Atalho: texto inteiro → registros. */
export function parseCsvText(text: string, sep?: string): { sep: string; records: CsvRecord[] } {
  const s = sep || detectSeparator(firstLineOf(text));
  const p = new CsvStreamParser(s);
  const records = [...p.push(text), ...p.end()];
  return { sep: s, records };
}

const ACCENTS: Record<string, string> = { á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a', é: 'e', è: 'e', ê: 'e', ë: 'e', í: 'i', ì: 'i', î: 'i', ï: 'i', ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o', ú: 'u', ù: 'u', û: 'u', ü: 'u', ç: 'c', ñ: 'n' };
const stripAccents = (s: string) => s.replace(/[áàâãäéèêëíìîïóòôõöúùûüçñ]/g, (c) => ACCENTS[c] || c);

/** Cabeçalho → chave: minúsculo, sem acento, espaço/hífen = `_`. `custom.<chave>` mantém o ponto (chave em [a-z0-9_]). */
export function normHeader(h: string): string {
  const s = stripAccents(String(h || '').trim().toLowerCase()).replace(/[\s-]+/g, '_');
  const m = /^(custom|campo|cf)[._:](.+)$/.exec(s);
  if (m) return `custom.${m[2].replace(/[^a-z0-9_]/g, '').slice(0, 40)}`;
  return s.replace(/[^a-z0-9_]/g, '');
}

/** Sinônimos aceitos por coluna (a 1ª é o nome oficial do modelo). */
export const COLUMN_ALIASES: Record<string, string[]> = {
  phone: ['phone', 'telefone', 'celular', 'whatsapp', 'fone'],
  name: ['name', 'nome'],
  doc: ['doc', 'cpf', 'cnpj', 'documento', 'cpf_cnpj'],
  email: ['email', 'e_mail'],
  zip: ['zip', 'cep'],
  street: ['street', 'rua', 'logradouro', 'endereco'],
  number: ['number', 'numero'],
  district: ['district', 'bairro'],
  city: ['city', 'cidade'],
  state: ['state', 'uf', 'estado'],
  notes: ['notes', 'observacoes', 'obs', 'observacao'],
  product: ['product', 'produto', 'plano'],
  price: ['price', 'valor', 'preco'],
  billing: ['billing', 'cobranca', 'periodicidade', 'ciclo', 'recorrencia', 'frequencia', 'tipo_cobranca'],
  due_day: ['due_day', 'dia_vencimento', 'vencimento'],
  next_due: ['next_due', 'proximo_vencimento', 'proximo_venc'],
  code: ['code', 'codigo', 'matricula', 'contrato'],
  kind: ['kind', 'tipo'],
  phones: ['phones', 'telefones', 'outros_telefones'],
  external_id: ['external_id', 'id_externo', 'codigo_externo'],
  unit: ['unit', 'unidade', 'filial'],
  balance: ['balance', 'saldo', 'saldo_devedor'],
  balance_due: ['balance_due', 'vencimento_saldo'],
  paid_history: ['paid_history', 'historico_pagamentos', 'pagamentos'],
};

export type ColumnMap = { idx: Record<string, number>; custom: Array<{ key: string; index: number }>; unknown: string[] };

/** Índice de cada coluna conhecida + colunas `custom.<chave>` + as que não reconhecemos (para avisar). */
export function columnIndex(header: string[]): ColumnMap {
  const norm = header.map(normHeader);
  const idx: Record<string, number> = {};
  const used = new Set<number>();
  for (const [col, names] of Object.entries(COLUMN_ALIASES)) {
    for (const n of names) {
      const i = norm.indexOf(n);
      if (i >= 0 && !used.has(i)) { idx[col] = i; used.add(i); break; }
    }
  }
  const custom: Array<{ key: string; index: number }> = [];
  norm.forEach((h, i) => { if (h.startsWith('custom.') && h.length > 7 && !used.has(i)) { custom.push({ key: h.slice(7), index: i }); used.add(i); } });
  const unknown = header.filter((h, i) => !used.has(i) && String(h || '').trim() !== '').map((h) => String(h).trim());
  return { idx, custom, unknown };
}

export const cell = (fields: string[], map: ColumnMap, col: string): string => {
  const i = map.idx[col];
  return i === undefined ? '' : String(fields[i] ?? '').trim();
};

/**
 * Valor em reais → centavos. Aceita "99,90", "1.234,56", "1234.56", "R$ 1.234", "1,234.56". Vazio = null; inválido = NaN.
 */
export function parseMoneyCents(raw: string): number | null {
  let s = String(raw ?? '').trim();
  if (!s) return null;
  s = s.replace(/^r\$\s*/i, '').replace(/\s/g, '');
  if (!/^-?[\d.,]+$/.test(s)) return NaN;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let norm: string;
  if (lastComma >= 0 && lastDot >= 0) {
    // o separador que vem por último é o decimal
    norm = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    const parts = s.split(',');
    norm = parts.length === 2 && parts[1].length <= 2 ? s.replace(',', '.') : s.replace(/,/g, ''); // "1,234" = milhar
  } else if (lastDot >= 0) {
    const parts = s.split('.');
    norm = parts.length === 2 && parts[1].length <= 2 ? s : s.replace(/\./g, ''); // "1.234" / "1.234.567" = milhar
  } else norm = s;
  const n = Number(norm);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** `AAAA-MM-DD` ou `DD/MM/AAAA` (também `DD-MM-AAAA`, `DD.MM.AAAA`) → `YYYY-MM-DD`; vazio = null; inválido = '' (string vazia). */
export function parseDateInput(raw: string): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let r = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (r) { y = +r[1]; m = +r[2]; d = +r[3]; }
  else if ((r = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s))) { d = +r[1]; m = +r[2]; y = +r[3]; }
  else return '';
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return '';
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export type PaidEntry = { date: string; cents: number };

/**
 * `paid_history` = `AAAA-MM-DD:valor|AAAA-MM-DD:valor` (também `DD/MM/AAAA:valor`). Datas no futuro (> `today`) são erro.
 * Máx. 120 pagamentos por linha.
 */
export function parsePaidHistory(raw: string, today: string): { entries: PaidEntry[]; errors: string[] } {
  const entries: PaidEntry[] = [];
  const errors: string[] = [];
  const s = String(raw ?? '').trim();
  if (!s) return { entries, errors };
  const parts = s.split('|').map((x) => x.trim()).filter(Boolean);
  if (parts.length > 120) errors.push('Máximo de 120 pagamentos por linha.');
  for (const p of parts.slice(0, 120)) {
    const i = p.indexOf(':');
    if (i < 0) { errors.push(`"${p.slice(0, 40)}": use AAAA-MM-DD:valor.`); continue; }
    const date = parseDateInput(p.slice(0, i));
    const cents = parseMoneyCents(p.slice(i + 1));
    if (!date) { errors.push(`"${p.slice(0, 40)}": data inválida.`); continue; }
    if (date > today) { errors.push(`"${p.slice(0, 40)}": data no futuro.`); continue; }
    if (cents === null || !Number.isFinite(cents) || cents < 1) { errors.push(`"${p.slice(0, 40)}": valor inválido.`); continue; }
    entries.push({ date, cents });
  }
  return { entries, errors };
}

/** "sim/true/1/x" → true; "não/false/0" → false; vazio → undefined (padrão). Para opções vindas do multipart. */
export function parseBool(raw: unknown, def: boolean): boolean {
  if (raw === undefined || raw === null || raw === '') return def;
  if (typeof raw === 'boolean') return raw;
  const s = stripAccents(String(raw).trim().toLowerCase());
  if (['1', 'true', 'sim', 's', 'yes', 'y', 'on', 'x'].includes(s)) return true;
  if (['0', 'false', 'nao', 'n', 'no', 'off'].includes(s)) return false;
  return def;
}

export const BILLING_VALUES = ['once', 'monthly', 'quarterly', 'semiannual', 'yearly'] as const;
const BILLING_WORDS: Record<string, string> = {
  once: 'once', avulso: 'once', avulsa: 'once', unico: 'once', unica: 'once', 'pagamento_unico': 'once', vitalicio: 'once', vitalicia: 'once',
  monthly: 'monthly', mensal: 'monthly', mes: 'monthly', mensalidade: 'monthly', '1': 'monthly',
  quarterly: 'quarterly', trimestral: 'quarterly', trimestre: 'quarterly', '3': 'quarterly',
  semiannual: 'semiannual', semestral: 'semiannual', semestre: 'semiannual', '6': 'semiannual',
  yearly: 'yearly', anual: 'yearly', ano: 'yearly', anuidade: 'yearly', annual: 'yearly', '12': 'yearly',
};

/**
 * Coluna `billing` → `once|monthly|quarterly|semiannual|yearly`. Aceita PT (avulso, mensal, trimestral, semestral, anual)
 * e o número de meses (1/3/6/12). Vazio = null; não reconhecido = '' (erro na linha).
 */
export function parseBilling(raw: unknown): string | null {
  const s = stripAccents(String(raw ?? '').trim().toLowerCase()).replace(/[\s-]+/g, '_').replace(/_?meses$/, '');
  if (!s) return null;
  return BILLING_WORDS[s] || '';
}

/**
 * Periodicidade pelo NOME do produto, quando a planilha não tem a coluna `billing` ("Plano Anual" → yearly). Só quando o
 * nome traz UMA palavra de periodicidade; nenhuma (ou mais de uma) → null (quem chama decide: mensal ou erro).
 */
export function billingFromName(name: string): string | null {
  const words = stripAccents(String(name || '').toLowerCase()).split(/[^a-z0-9]+/).filter(Boolean);
  const found = new Set<string>();
  for (const w of words) if (['avulso', 'avulsa', 'mensal', 'trimestral', 'semestral', 'anual', 'vitalicio', 'vitalicia', 'monthly', 'yearly', 'annual', 'quarterly'].includes(w)) found.add(BILLING_WORDS[w]);
  return found.size === 1 ? [...found][0] : null;
}

/** Célula de CSV que o Excel/Sheets leria como FÓRMULA (`= + - @`, TAB, CR) ganha um apóstrofo na frente. */
export function csvSafe(v: unknown): string {
  const s = String(v ?? '');
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

/** Campo para CSV com `;` (aspas quando precisa). */
export function csvField(v: unknown, sep = ';'): string {
  const s = String(v ?? '');
  return /["\r\n]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Relatório de erros: `linha;campo;erro` com BOM (abre certo no Excel pt-BR). */
export function errorsCsv(errors: Array<{ line: number; field?: string | null; message: string }>): string {
  const lines = ['linha;campo;erro', ...errors.map((e) => [e.line, csvSafe(e.field || ''), csvSafe(e.message)].map((x) => csvField(x)).join(';'))];
  return BOM + lines.join('\r\n') + '\r\n';
}

/** Ordem das colunas do modelo. */
export const TEMPLATE_COLUMNS = ['phone', 'name', 'doc', 'email', 'zip', 'street', 'number', 'district', 'city', 'state', 'notes', 'product', 'price', 'billing', 'due_day', 'next_due', 'code', 'kind', 'phones', 'external_id', 'unit', 'balance', 'balance_due', 'paid_history'];

/** Modelo com todas as colunas (+ `custom.<chave>` da org) e 2 linhas de exemplo. */
export function templateCsv(customKeys: Array<{ key: string; example?: string }> = []): string {
  const head = [...TEMPLATE_COLUMNS, ...customKeys.map((c) => `custom.${c.key}`)];
  const ex1: Record<string, string> = {
    phone: '5511999990001', name: 'Maria Souza', doc: '52998224725', email: 'maria@exemplo.com', zip: '01310100', street: 'Av. Paulista', number: '1000', district: 'Bela Vista', city: 'São Paulo', state: 'SP',
    notes: 'Cliente desde 2020', product: 'Plano Mensal', price: '99,90', billing: 'mensal', due_day: '10', next_due: '2026-11-10', code: 'MAT-001', kind: 'person', phones: '5511988880001',
    external_id: 'ERP-1001', unit: 'Matriz', balance: '150,00', balance_due: '2026-10-20', paid_history: '2026-08-10:99,90|2026-09-10:99,90',
  };
  const ex2: Record<string, string> = {
    phone: '5521977770002', name: 'Padaria Pão Bom LTDA', doc: '11222333000181', email: 'contato@paobom.com.br', zip: '20040002', street: 'Rua da Assembleia', number: '10', district: 'Centro', city: 'Rio de Janeiro', state: 'RJ',
    notes: '', product: 'Plano Anual', price: '1.200,00', billing: 'anual', due_day: '5', next_due: '05/03/2027', code: 'CT-0042', kind: 'company', phones: '',
    external_id: 'ERP-1002', unit: 'Filial Rio', balance: '', balance_due: '', paid_history: '05/03/2026:1.200,00',
  };
  const row = (ex: Record<string, string>) => [...TEMPLATE_COLUMNS.map((c) => ex[c] || ''), ...customKeys.map((c) => c.example || '')].map((x) => csvField(x)).join(';');
  return BOM + [head.join(';'), row(ex1), row(ex2)].join('\r\n') + '\r\n';
}
