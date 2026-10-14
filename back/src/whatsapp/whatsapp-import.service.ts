import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createReadStream, existsSync, mkdirSync, promises as fsp } from 'fs';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../platform-billing/access.service';
import { WhatsAppCrmService } from './whatsapp-crm.service';
import { WhatsAppContactsService } from './whatsapp-contacts.service';
import { WhatsAppIdentityService } from './whatsapp-identity.service';
import { WhatsAppUnitsService } from './whatsapp-units.service';
import { WhatsAppCustomFieldsService } from './whatsapp-custom-fields.service';
import { CfDef, CustomFieldsError, validateCustomValues } from './wa-custom-fields.util';
import { digitsOf, jidFromPhone } from './wa-jid.util';
import { docHash, isValidDoc, normalizeDoc } from './wa-doc.util';
import { brtDateStr, dateOnlyUTC } from './whatsapp-subscriptions.service';
import { addMonths, cycleMonthsOf } from './wa-subscription-math.util';
import { ColumnMap, CsvRecord, CsvStreamParser, PaidEntry, billingFromName, cell, columnIndex, detectSeparator, errorsCsv, firstLineOf, parseBilling, parseBool, parseDateInput, parseMoneyCents, parsePaidHistory, templateCsv } from './wa-import.util';

// ============================================================================
// Importação de clientes EM SEGUNDO PLANO (Fase 8, contrato §12.3).
//
//  POST /whatsapp/imports  → arquivo em <cwd>/protected/imports/<org>/<job>.csv (UTF-8, sem BOM) + job `queued`.
//  Worker (1 job por vez neste processo, a cada 3 s): pega um `queued` (claim atômico → `running`), lê o CSV em
//  streaming, processa em lotes de 200 linhas e grava contadores + `heartbeat_at` a cada lote. `running` sem
//  heartbeat há 5 min volta a `queued` e recomeça de `processed` (as linhas do lote interrompido são refeitas —
//  cliente vira "atualizado" e as cobranças importadas têm dedupe, então nada duplica). Org sem acesso ativo espera.
//
//  Cada linha: valida TUDO antes de gravar (linha com erro não grava nada) → contato (createManual) → cliente
//  (createCustomer / updateCustomer com `source:'import'`, que pula os campos obrigatórios) → assinatura
//  (addSubscription, sem teste grátis e SEM cobrança na hora) → saldo e histórico.
//
//  DECISÃO (saldo e histórico): `charges.create` sempre emite no gateway e exige número conectado, então as
//  cobranças importadas são gravadas DIRETO em `whatsapp_charges` (mesmo formato da linha do serviço):
//   - `balance`      → 1 cobrança PENDING, `origin:'import'`, kind `pix`, sem provider/PIX, `sent_at` null (o runner
//                      diário só lembra cobranças já enviadas → nenhuma mensagem sai sozinha; o atendente usa
//                      "Reenviar", que gera o PIX na hora), sem `pay_link_token` (o serviço cria quando precisar).
//   - `paid_history` → cobranças PAID, `paid_via:'import'`, `paid_at` = 12:00 BRT do dia, `due_at` = o dia, ligadas
//                      à assinatura da linha quando houver. NÃO chama `settle`/`markPaid`: não avança assinatura,
//                      não manda recibo, não dispara hooks/webhooks.
//   Dedupe (reimportar o mesmo arquivo ou retomar um lote): mesma cliente + origin import + mesmo valor + mesmo dia
//   (+ PENDING para saldo / PAID+paid_via import para histórico) → pula e conta em `summary.charges_duplicated`.
//  Nada importado manda mensagem nem fala com o gateway.
//
//  Revisão geral (14/10/2026):
//   - C-H2 periodicidade: coluna `billing` (avulso/mensal/trimestral/semestral/anual, ou 1/3/6/12); sem a coluna, o
//     NOME do produto decide quando traz uma só palavra de periodicidade ("Plano Anual"); senão mensal. Produto que já
//     existe com outra periodicidade = erro na linha.
//   - C-M2/C-M3 vencimento: `next_due` no passado anda ciclo a ciclo até ≥ hoje (contado em `summary.next_due_rolled`);
//     sem `next_due`, o 1º vencimento ≥ hoje (o motor não pula ciclo na importação).
//   - C-M4 número compartilhado: linha com documento casa pelo `doc_hash` (na org e entre os clientes do número);
//     documento diferente de todos os clientes do número = cliente novo (`another:true`), nunca sobrescreve o outro.
//   - C-M5 saldo sem `balance_due`: dedupe por cliente + saldo importado em aberto + valor (reimportar outro dia não duplica).
//   - C-L1 pagamento do histórico no PRÓPRIO próximo vencimento é recusado (contaria o ciclo como pago sem avançar).
//   - C-L4 erros gravados no fim (e a cada 10 lotes se mudaram), não o JSON inteiro a cada lote.
//   - C-L5 `custom.<chave>` sem campo definido é descartado (só listado em `summary.unknown_custom`).
//   - A-8 cliente com dados apagados (LGPD) não é atualizado (erro na linha).
// ============================================================================

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_ROWS = 50_000;
const BATCH = 200;
const TICK_MS = 3_000;
const STALE_MS = 5 * 60_000;
const MAX_STORED_ERRORS = 5_000;
const MAX_RESUMES = 5;
const MAX_OPEN_JOBS_PER_ORG = 3;
const PHONE_COLS = ['phone', 'telefone', 'celular', 'whatsapp', 'fone'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OPEN = ['queued', 'running'];

export type ImportOptions = { update_existing: boolean; create_products: boolean; dry_run: boolean; resumes?: number };
type RowError = { line: number; field?: string | null; message: string };
type Summary = {
  dry_run: boolean; customers_created: number; customers_updated: number; skipped_existing: number; subscriptions: number; subscriptions_updated: number;
  charges_balance: number; charges_history: number; charges_duplicated: number; units_created: number; products_created: number;
  next_due_rolled: number; unknown_columns: string[]; unknown_custom: string[];
};
type ProductRef = { id: string; name: string; kind: string; price_cents: number; billing: string; billing_interval_months: number | null };
type RowPlan = {
  line: number; phone: string; name: string; dto: Record<string, any>; extraPhones: string[]; unitName: string; externalId: string;
  custom: Record<string, string> | undefined; product: { name: string; key: string; priceCents: number | null; dueDay: number | null; nextDue: string | null; billing: string | null } | null;
  balance: { cents: number; due: string; explicit: boolean } | null; history: PaidEntry[];
};
type PlanResult = { plan: RowPlan; errors: Array<{ field?: string; message: string }> };
type JobCtx = {
  orgId: string; userId: string | null; jobId: string; opts: ImportOptions; map: ColumnMap; cfDefs: CfDef[]; today: string;
  products: Map<string, ProductRef>; productsCount: number; cfKeys: Set<string>;
  units: Map<string, string>; // nome minúsculo → id ('' = será criada, só no dry run)
  seenPhones: Set<string>; seenExternal: Set<string>; summary: Summary; errors: RowError[];
  counts: { created: number; updated: number; skipped: number; errorCount: number };
};

const emptySummary = (dry: boolean): Summary => ({
  dry_run: dry, customers_created: 0, customers_updated: 0, skipped_existing: 0, subscriptions: 0, subscriptions_updated: 0,
  charges_balance: 0, charges_history: 0, charges_duplicated: 0, units_created: 0, products_created: 0, next_due_rolled: 0, unknown_columns: [], unknown_custom: [],
});
const lower = (s: string) => s.trim().toLowerCase();
const addDays = (ymd: string, n: number) => new Date(dateOnlyUTC(ymd).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const safeId = (s: string) => String(s || '').replace(/[^0-9a-zA-Z-]/g, '').slice(0, 64);
const BILLING_PT: Record<string, string> = { once: 'avulso', monthly: 'mensal', quarterly: 'trimestral', semiannual: 'semestral', yearly: 'anual' };
const fmtBR = (ymd: string) => ymd.split('-').reverse().join('/');
const ERRORS_EVERY = 10; // grava a lista de erros a cada N lotes (se mudou) e no fim (C-L4)

/** Mensagens de erro do serviço → `[{field?, message}]` (campos personalizados viram `custom.<chave>`). */
function errInfo(e: any): Array<{ field?: string; message: string }> {
  if (e instanceof CustomFieldsError) return e.fields.map((f) => ({ field: `custom.${f.key}`, message: `${f.label}: ${e.code === 'CUSTOM_REQUIRED' ? 'obrigatório' : f.error}.` }));
  const r: any = typeof e?.getResponse === 'function' ? e.getResponse() : null;
  if (r && typeof r === 'object' && Array.isArray(r.fields) && /^CUSTOM_/.test(String(r.code || ''))) {
    return r.fields.map((f: any) => ({ field: `custom.${f.key}`, message: `${f.label}: ${r.code === 'CUSTOM_REQUIRED' ? 'obrigatório' : f.error}.` }));
  }
  const msg = r && typeof r === 'object' ? (Array.isArray(r.message) ? r.message.join('; ') : r.message) : e?.message;
  return [{ message: String(msg || 'Erro ao gravar a linha.').replace(/\s+/g, ' ').slice(0, 300) }];
}

/** Bytes → texto. UTF-8 válido; senão Windows-1252 (CSV salvo pelo Excel em pt-BR). */
function decodeCsv(buf: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    try { return new TextDecoder('windows-1252').decode(buf); } catch { return buf.toString('latin1'); }
  }
}

@Injectable()
export class WhatsAppImportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppImportService.name);
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly crm: WhatsAppCrmService,
    private readonly contacts: WhatsAppContactsService,
    private readonly identity: WhatsAppIdentityService,
    private readonly units: WhatsAppUnitsService,
    private readonly cf: WhatsAppCustomFieldsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref?.();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // ---------------------------------------------------------------- arquivos
  private relPath(orgId: string, jobId: string) { return path.join('protected', 'imports', safeId(orgId), `${safeId(jobId)}.csv`); }
  private absPath(rel: string) { return path.join(process.cwd(), rel); }
  private async removeFile(rel: string | null | undefined) {
    if (!rel) return;
    await fsp.unlink(this.absPath(rel)).catch(() => undefined);
  }

  // ---------------------------------------------------------------- formato
  private shape(j: any, opts: { errors?: number } = {}) {
    const total = j.total_rows || 0;
    const processed = Math.min(j.processed || 0, total || j.processed || 0);
    let eta: number | null = null;
    if (j.status === 'running' && j.started_at && processed > 0 && total > processed) {
      const elapsed = Date.now() - new Date(j.started_at).getTime();
      eta = Math.max(1, Math.round(((elapsed / processed) * (total - processed)) / 1000));
    }
    const o: any = j.options && typeof j.options === 'object' ? j.options : {};
    const errs: RowError[] = Array.isArray(j.errors) ? j.errors : [];
    return {
      id: j.id, kind: j.kind, status: j.status, file_name: j.file_name,
      options: { update_existing: o.update_existing !== false, create_products: o.create_products !== false, dry_run: o.dry_run === true },
      total_rows: total, processed, progress: total ? Math.min(100, Math.round((processed / total) * 100)) : j.status === 'done' ? 100 : 0, eta_seconds: eta,
      created_count: j.created_count, updated_count: j.updated_count, skipped_count: j.skipped_count, error_count: j.error_count,
      errors_stored: errs.length, errors_preview: opts.errors ? errs.slice(0, opts.errors) : undefined,
      summary: j.summary && typeof j.summary === 'object' ? j.summary : null, last_error: j.last_error || null,
      started_at: j.started_at, finished_at: j.finished_at, heartbeat_at: j.heartbeat_at, created_at: j.created_at, updated_at: j.updated_at,
    };
  }

  // ---------------------------------------------------------------- API
  async create(orgId: string, userId: string | null, file: { buffer?: Buffer; originalname?: string; size?: number } | undefined, body: any = {}) {
    const buf = file?.buffer;
    if (!buf || !buf.length) throw new BadRequestException('Escolha um arquivo CSV.');
    if (buf.length > MAX_BYTES) throw new BadRequestException('O arquivo passa de 25 MB. Divida em partes menores.');
    const name = String(file?.originalname || 'clientes.csv');
    // latin1 → utf8 (o multer decodifica o nome do arquivo como latin1)
    const fileName = (() => { try { const n = Buffer.from(name, 'latin1').toString('utf8'); return n.includes(String.fromCharCode(0xfffd)) ? name : n; } catch { return name; } })().slice(0, 255);
    if (/\.(xlsx?|ods|numbers)$/i.test(fileName)) throw new BadRequestException('Envie em CSV: no Excel, use "Salvar como" → "CSV UTF-8 (separado por vírgulas)".');
    const open = await this.prisma.whatsapp_import_jobs.count({ where: { organization_id: orgId, status: { in: OPEN } } });
    if (open >= MAX_OPEN_JOBS_PER_ORG) throw new BadRequestException(`Já há ${open} importações na fila. Aguarde terminar ou cancele uma.`);

    const text = decodeCsv(buf);
    const sep = detectSeparator(firstLineOf(text));
    const parser = new CsvStreamParser(sep);
    const st: { header: string[] | null; rows: number } = { header: null, rows: 0 };
    const CH = 1 << 16;
    const count = (recs: CsvRecord[]) => { for (const r of recs) { if (!st.header) st.header = r.fields; else st.rows++; } };
    for (let i = 0; i < text.length; i += CH) {
      count(parser.push(text.slice(i, i + CH)));
      if (st.rows > MAX_ROWS) break;
    }
    if (st.rows <= MAX_ROWS) count(parser.end());
    const header = st.header;
    const rows = st.rows;
    if (!header) throw new BadRequestException('Arquivo vazio.');
    const map = columnIndex(header);
    if (map.idx.phone === undefined) throw new BadRequestException(`O cabeçalho (1ª linha) precisa ter a coluna "phone" (ou ${PHONE_COLS.slice(1).map((c) => `"${c}"`).join(', ')}). Baixe o modelo para ver as colunas.`);
    if (!rows) throw new BadRequestException('O arquivo não tem linhas de dados (só o cabeçalho).');
    if (rows > MAX_ROWS) throw new BadRequestException(`O arquivo tem mais de ${MAX_ROWS.toLocaleString('pt-BR')} linhas. Divida em partes de até ${MAX_ROWS.toLocaleString('pt-BR')}.`);

    const options: ImportOptions = {
      update_existing: parseBool(body?.update_existing, true),
      create_products: parseBool(body?.create_products, true),
      dry_run: parseBool(body?.dry_run, false),
      resumes: 0,
    };
    const id = randomUUID();
    const rel = this.relPath(orgId, id);
    const abs = this.absPath(rel);
    const dir = path.dirname(abs);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o750 });
    await fsp.chmod(dir, 0o750).catch(() => undefined);
    await fsp.writeFile(abs, text.charCodeAt(0) === 0xfeff ? text.slice(1) : text, { encoding: 'utf8', mode: 0o640 });
    await fsp.chmod(abs, 0o640).catch(() => undefined);
    try {
      const job = await this.prisma.whatsapp_import_jobs.create({
        data: { id, organization_id: orgId, user_id: userId, kind: 'customers', status: 'queued', file_name: fileName, storage_path: rel, options: options as any, total_rows: rows, errors: [] as any, summary: emptySummary(options.dry_run) as any },
      });
      setTimeout(() => void this.tick(), 200).unref?.(); // começa já, sem esperar o próximo tique
      return this.shape(job);
    } catch (e) {
      await this.removeFile(rel);
      throw e;
    }
  }

  async list(orgId: string) {
    const rows = await this.prisma.whatsapp_import_jobs.findMany({
      where: { organization_id: orgId }, orderBy: { created_at: 'desc' }, take: 20,
      select: { id: true, kind: true, status: true, file_name: true, options: true, total_rows: true, processed: true, created_count: true, updated_count: true, skipped_count: true, error_count: true, summary: true, last_error: true, started_at: true, finished_at: true, heartbeat_at: true, created_at: true, updated_at: true },
    });
    return { items: rows.map((r) => this.shape(r)) };
  }

  async get(orgId: string, id: string) {
    const j = await this.prisma.whatsapp_import_jobs.findFirst({ where: { id, organization_id: orgId } });
    if (!j) throw new NotFoundException('Importação não encontrada.');
    return this.shape(j, { errors: 100 });
  }

  async errorsReport(orgId: string, id: string) {
    const j = await this.prisma.whatsapp_import_jobs.findFirst({ where: { id, organization_id: orgId }, select: { id: true, errors: true, error_count: true } });
    if (!j) throw new NotFoundException('Importação não encontrada.');
    const errs: RowError[] = Array.isArray(j.errors) ? (j.errors as any) : [];
    const list = [...errs];
    if ((j.error_count || 0) > errs.length) list.push({ line: 0, field: null, message: `… e mais ${(j.error_count - errs.length).toLocaleString('pt-BR')} erros não guardados (o relatório guarda os ${MAX_STORED_ERRORS.toLocaleString('pt-BR')} primeiros).` });
    return { csv: errorsCsv(list), filename: `importacao-${j.id.slice(0, 8)}-erros.csv` };
  }

  async cancel(orgId: string, id: string) {
    const j = await this.prisma.whatsapp_import_jobs.findFirst({ where: { id, organization_id: orgId } });
    if (!j) throw new NotFoundException('Importação não encontrada.');
    if (!OPEN.includes(j.status)) throw new BadRequestException('Esta importação já terminou.');
    const u = await this.prisma.whatsapp_import_jobs.updateMany({ where: { id, organization_id: orgId, status: { in: OPEN } }, data: { status: 'canceled', finished_at: new Date(), last_error: 'Cancelada pelo usuário.' } });
    if (u.count && j.status === 'queued') await this.removeFile(j.storage_path); // `running`: o worker apaga ao perceber
    return this.get(orgId, id);
  }

  /** Modelo com todas as colunas (+ os campos personalizados de cliente da org) e 2 linhas de exemplo. */
  async template(orgId: string) {
    const defs = await this.cf.defs(orgId, 'customer').catch(() => [] as CfDef[]);
    const ex = (d: CfDef) => (d.type === 'date' ? '1990-05-20' : d.type === 'number' ? '10' : d.type === 'bool' ? 'sim' : d.type === 'select' ? (d.options?.[0] ?? '') : d.type === 'email' ? 'exemplo@email.com' : d.type === 'phone' ? '5511999990000' : d.type === 'cpf' ? '52998224725' : '');
    return templateCsv(defs.map((d) => ({ key: d.key, example: ex(d) })));
  }

  /** Apaga jobs + arquivos da org (chamar em `admin.removeOrganization`). */
  async purgeOrg(orgId: string) {
    await this.prisma.whatsapp_import_jobs.deleteMany({ where: { organization_id: orgId } }).catch((e) => this.logger.warn(`purge imports ${orgId}: ${e?.message || e}`));
    const dir = path.join(process.cwd(), 'protected', 'imports', safeId(orgId));
    if (safeId(orgId)) await fsp.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }

  // ---------------------------------------------------------------- worker
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.requeueStale();
      const queued = await this.prisma.whatsapp_import_jobs.findMany({ where: { status: 'queued' }, orderBy: { created_at: 'asc' }, take: 20, select: { id: true, organization_id: true } });
      for (const q of queued) {
        if (!(await this.access.isOrgActive(q.organization_id))) continue; // conta sem acesso: o job espera
        const now = new Date();
        const claim = await this.prisma.whatsapp_import_jobs.updateMany({ where: { id: q.id, status: 'queued' }, data: { status: 'running', heartbeat_at: now } });
        if (!claim.count) continue;
        await this.prisma.whatsapp_import_jobs.updateMany({ where: { id: q.id, started_at: null }, data: { started_at: now } });
        const job = await this.prisma.whatsapp_import_jobs.findUnique({ where: { id: q.id } });
        if (job) await this.run(job);
        break; // um job por tique (o próximo tique pega o seguinte)
      }
    } catch (e: any) {
      this.logger.warn(`imports tick: ${e?.message || e}`);
    } finally {
      this.busy = false;
    }
  }

  /** `running` sem heartbeat há 5 min (processo caiu) → volta para a fila; depois de 5 retomadas, falha. */
  private async requeueStale() {
    const limit = new Date(Date.now() - STALE_MS);
    const stale = await this.prisma.whatsapp_import_jobs.findMany({ where: { status: 'running', OR: [{ heartbeat_at: { lt: limit } }, { heartbeat_at: null }] }, select: { id: true, options: true, storage_path: true } });
    for (const s of stale) {
      const o: any = s.options && typeof s.options === 'object' ? { ...(s.options as any) } : {};
      o.resumes = (Number(o.resumes) || 0) + 1;
      if (o.resumes > MAX_RESUMES) {
        const u = await this.prisma.whatsapp_import_jobs.updateMany({ where: { id: s.id, status: 'running' }, data: { status: 'failed', finished_at: new Date(), options: o, last_error: 'A importação parou várias vezes sem terminar. Divida o arquivo em partes menores e tente de novo.' } });
        if (u.count) await this.removeFile(s.storage_path);
      } else {
        await this.prisma.whatsapp_import_jobs.updateMany({ where: { id: s.id, status: 'running' }, data: { status: 'queued', options: o } });
        this.logger.warn(`importação ${s.id}: sem heartbeat há 5 min — volta para a fila (retomada ${o.resumes})`);
      }
    }
  }

  private async finish(job: any, status: 'done' | 'failed' | 'canceled', lastError?: string | null) {
    await this.prisma.whatsapp_import_jobs.updateMany({ where: { id: job.id, status: 'running' }, data: { status, finished_at: new Date(), heartbeat_at: new Date(), ...(lastError !== undefined ? { last_error: lastError ? lastError.slice(0, 500) : null } : {}) } });
    await this.removeFile(job.storage_path);
  }

  private async run(job: any) {
    const orgId: string = job.organization_id;
    const o: any = job.options && typeof job.options === 'object' ? job.options : {};
    const opts: ImportOptions = { update_existing: o.update_existing !== false, create_products: o.create_products !== false, dry_run: o.dry_run === true };
    const rel: string | null = job.storage_path;
    if (!rel || !existsSync(this.absPath(rel))) return this.finish(job, 'failed', 'O arquivo da importação não foi encontrado no servidor. Envie de novo.');
    const prevErrors: RowError[] = Array.isArray(job.errors) ? job.errors : [];
    const prevSummary: any = job.summary && typeof job.summary === 'object' ? job.summary : {};
    const ctx: JobCtx = {
      orgId, userId: job.user_id || null, jobId: job.id, opts, map: { idx: {}, custom: [], unknown: [] }, cfDefs: [], today: brtDateStr(),
      products: new Map(), productsCount: 0, cfKeys: new Set(), units: new Map(), seenPhones: new Set(), seenExternal: new Set(),
      summary: { ...emptySummary(opts.dry_run), ...prevSummary, dry_run: opts.dry_run }, errors: prevErrors.slice(0, MAX_STORED_ERRORS),
      counts: { created: job.created_count || 0, updated: job.updated_count || 0, skipped: job.skipped_count || 0, errorCount: job.error_count || 0 },
    };
    try {
      ctx.cfDefs = await this.cf.defs(orgId, 'customer');
      ctx.cfKeys = new Set(ctx.cfDefs.map((d) => d.key));
      const prods = await this.prisma.whatsapp_products.findMany({ where: { organization_id: orgId }, select: { id: true, name: true, kind: true, price_cents: true, billing: true, billing_interval_months: true } });
      ctx.productsCount = prods.length;
      for (const p of prods) if (!ctx.products.has(lower(p.name))) ctx.products.set(lower(p.name), p);
      const units = await this.prisma.whatsapp_units.findMany({ where: { organization_id: orgId }, select: { id: true, name: true } });
      for (const u of units) if (!ctx.units.has(lower(u.name))) ctx.units.set(lower(u.name), u.id);
    } catch (e: any) {
      return this.finish(job, 'failed', `Não foi possível preparar a importação: ${e?.message || e}`);
    }

    let processed: number = job.processed || 0;
    let dataIndex = 0;
    let header: string[] | null = null;
    let batch: CsvRecord[] = [];
    let stopped: 'canceled' | null = null;
    let flushes = 0;
    let errorsWritten = ctx.errors.length;
    const flush = async (final = false) => {
      if (!batch.length && !final) return true;
      for (const rec of batch) await this.processRow(ctx, rec);
      processed += batch.length;
      batch = [];
      flushes++;
      // a lista de erros (até 5.000) é um JSON grande: grava no fim e, no meio, só a cada 10 lotes se mudou (C-L4)
      const writeErrors = ctx.errors.length !== errorsWritten && (final || flushes % ERRORS_EVERY === 0);
      if (writeErrors) errorsWritten = ctx.errors.length;
      const u = await this.prisma.whatsapp_import_jobs.updateMany({
        where: { id: job.id, status: 'running' },
        data: { processed, created_count: ctx.counts.created, updated_count: ctx.counts.updated, skipped_count: ctx.counts.skipped, error_count: ctx.counts.errorCount, ...(writeErrors ? { errors: ctx.errors as any } : {}), summary: ctx.summary as any, heartbeat_at: new Date() },
      });
      if (!u.count) { stopped = 'canceled'; return false; } // cancelada (ou tomada por outro processo)
      return true;
    };
    const take = async (recs: CsvRecord[]) => {
      for (const rec of recs) {
        if (!header) {
          header = rec.fields;
          ctx.map = columnIndex(header);
          ctx.summary.unknown_columns = ctx.map.unknown.slice(0, 30);
          const known = new Set(ctx.cfDefs.map((d) => d.key));
          ctx.summary.unknown_custom = ctx.map.custom.filter((c) => !known.has(c.key)).map((c) => c.key).slice(0, 30);
          if (ctx.map.idx.phone === undefined) throw new Error('O cabeçalho não tem a coluna "phone".');
          continue;
        }
        const i = dataIndex++;
        if (i < processed) continue; // retomada: já processadas
        batch.push(rec);
        if (batch.length >= BATCH && !(await flush())) return false;
      }
      return true;
    };
    try {
      const stream = createReadStream(this.absPath(rel), { encoding: 'utf8', highWaterMark: 1 << 16 });
      let parser: CsvStreamParser | null = null;
      let ok = true;
      try {
        for await (const chunk of stream as AsyncIterable<string>) {
          if (!parser) parser = new CsvStreamParser(detectSeparator(firstLineOf(chunk)));
          if (!(await take(parser.push(chunk)))) { ok = false; break; }
        }
      } finally {
        stream.destroy();
      }
      if (ok && parser) ok = await take(parser.end());
      if (ok) ok = await flush(true);
      if (stopped || !ok) { await this.removeFile(rel); this.logger.log(`importação ${job.id}: cancelada em ${processed} linhas`); return; }
      await this.finish(job, 'done', null);
      this.logger.log(`importação ${job.id} (${orgId}) concluída: ${processed} linhas · ${ctx.counts.created} novos · ${ctx.counts.updated} atualizados · ${ctx.counts.skipped} pulados · ${ctx.counts.errorCount} erros${opts.dry_run ? ' (simulação)' : ''}`);
    } catch (e: any) {
      this.logger.warn(`importação ${job.id}: ${e?.stack || e}`);
      // grava o que já andou antes de falhar
      await this.prisma.whatsapp_import_jobs.updateMany({ where: { id: job.id, status: 'running' }, data: { processed, created_count: ctx.counts.created, updated_count: ctx.counts.updated, skipped_count: ctx.counts.skipped, error_count: ctx.counts.errorCount, errors: ctx.errors as any, summary: ctx.summary as any } }).catch(() => undefined);
      await this.finish(job, 'failed', `A importação parou: ${String(e?.message || e).slice(0, 300)}`);
    }
  }

  private addError(ctx: JobCtx, line: number, field: string | null | undefined, message: string) {
    ctx.counts.errorCount++;
    if (ctx.errors.length < MAX_STORED_ERRORS) ctx.errors.push({ line, field: field || null, message: message.slice(0, 300) });
  }

  // ---------------------------------------------------------------- linha
  /** Lê e valida a linha inteira (sem gravar nada). Erros → a linha é pulada. */
  private plan(ctx: JobCtx, rec: CsvRecord): PlanResult {
    const f = rec.fields;
    const m = ctx.map;
    const c = (col: string) => cell(f, m, col);
    const errors: Array<{ field?: string; message: string }> = [];
    const phone = digitsOf(c('phone'));
    if (phone.length < 10 || phone.length > 15) errors.push({ field: 'phone', message: c('phone') ? 'Telefone inválido: use DDI + DDD + número (ex.: 5511999999999).' : 'Telefone vazio.' });
    const name = c('name').slice(0, 255);
    const dto: Record<string, any> = {};
    if (name) dto.name = name;
    const docRaw = c('doc');
    if (docRaw) { const d = normalizeDoc(docRaw); if (!d || !isValidDoc(d)) errors.push({ field: 'doc', message: 'CPF/CNPJ inválido.' }); else dto.doc = d; }
    const email = c('email').toLowerCase();
    if (email) { if (!EMAIL_RE.test(email)) errors.push({ field: 'email', message: 'E-mail inválido.' }); else dto.email = email.slice(0, 255); }
    const notes = c('notes');
    if (notes) dto.notes = notes;
    const code = c('code');
    if (code) dto.code = code.slice(0, 32);
    const kind = c('kind');
    if (/^(company|empresa|pj|cnpj|juridica)$/i.test(kind)) dto.kind = 'company';
    else if (/^(person|pessoa|pf|cpf|fisica)$/i.test(kind)) dto.kind = 'person';
    const addr = { zip: c('zip'), street: c('street'), number: c('number'), district: c('district'), city: c('city'), state: c('state') };
    if (Object.values(addr).some(Boolean)) dto.address = addr;
    const extraPhones = c('phones').split(/[|;,\s]+/).map((x) => digitsOf(x)).filter((x) => x.length >= 10 && x.length <= 15 && x !== phone).slice(0, 20);
    const externalId = c('external_id').slice(0, 64);
    const unitName = c('unit').slice(0, 120);

    // campos personalizados: só os preenchidos (célula vazia não apaga o valor de quem já existe)
    let custom: Record<string, string> | undefined;
    for (const col of m.custom) {
      if (!ctx.cfKeys.has(col.key)) continue; // C-L5: chave sem campo definido não é gravada (aparece em `summary.unknown_custom`)
      const v = String(f[col.index] ?? '').trim();
      if (v) (custom ||= {})[col.key] = v;
    }
    if (custom) {
      try { validateCustomValues(ctx.cfDefs, custom, { mode: 'update', skipRequired: true }); }
      catch (e: any) { if (e instanceof CustomFieldsError) errors.push(...errInfo(e)); else throw e; }
    }

    // produto / assinatura
    let product: RowPlan['product'] = null;
    const prodName = c('product').slice(0, 120);
    const priceRaw = c('price');
    const priceCents = parseMoneyCents(priceRaw);
    if (priceRaw && (priceCents === null || !Number.isFinite(priceCents) || priceCents < 0)) errors.push({ field: 'price', message: 'Valor inválido (ex.: 99,90).' });
    const dueRaw = c('due_day');
    let dueDay: number | null = null;
    if (dueRaw) { const n = parseInt(dueRaw, 10); if (!Number.isFinite(n) || n < 1 || n > 31 || !/^\d{1,2}$/.test(dueRaw)) errors.push({ field: 'due_day', message: 'Dia do vencimento: de 1 a 28.' }); else dueDay = Math.min(28, n); }
    const nextRaw = c('next_due');
    const nextDue = parseDateInput(nextRaw);
    if (nextDue === '') errors.push({ field: 'next_due', message: 'Próximo vencimento inválido: use AAAA-MM-DD ou DD/MM/AAAA.' });
    // C-H2: periodicidade (coluna `billing`; sem ela, o nome do produto quando não deixa dúvida; senão mensal)
    const billRaw = c('billing');
    const billing = parseBilling(billRaw);
    if (billing === '') errors.push({ field: 'billing', message: `Periodicidade "${billRaw.slice(0, 30)}" inválida: use avulso, mensal, trimestral, semestral ou anual.` });
    if (prodName) {
      const p = ctx.products.get(lower(prodName));
      const price = priceCents !== null && Number.isFinite(priceCents) && priceCents > 0 ? priceCents : null;
      if (p && p.kind === 'service') errors.push({ field: 'product', message: `"${prodName}" é um serviço (agenda), não um plano.` });
      else if (!p && !price) errors.push({ field: 'product', message: `Produto "${prodName}" não existe. Preencha "price" para criá-lo.` });
      else if (!p && !ctx.opts.create_products) errors.push({ field: 'product', message: `Produto "${prodName}" não existe (a criação de produtos está desligada).` });
      if (p && billing && p.billing && p.billing !== billing) errors.push({ field: 'billing', message: `"${p.name}" está cadastrado como ${BILLING_PT[p.billing] || p.billing}, mas a planilha diz ${BILLING_PT[billing] || billing}.` });
      if (dueDay === null && nextDue) dueDay = Math.min(28, Number(nextDue.slice(8, 10)));
      product = { name: prodName, key: lower(prodName), priceCents: price, dueDay, nextDue: nextDue || null, billing: billing || null };
    } else {
      if (nextDue) errors.push({ field: 'next_due', message: 'Próximo vencimento precisa da coluna "product".' });
      if (billing) errors.push({ field: 'billing', message: 'Periodicidade precisa da coluna "product".' });
    }

    // saldo devedor
    let balance: RowPlan['balance'] = null;
    const balRaw = c('balance');
    if (balRaw) {
      const cents = parseMoneyCents(balRaw);
      const dueB = parseDateInput(c('balance_due'));
      if (cents === null || !Number.isFinite(cents) || cents < 100) errors.push({ field: 'balance', message: 'Saldo inválido (mínimo R$ 1,00; ex.: 150,00).' });
      if (dueB === '') errors.push({ field: 'balance_due', message: 'Vencimento do saldo inválido: use AAAA-MM-DD ou DD/MM/AAAA.' });
      if (cents !== null && Number.isFinite(cents) && cents >= 100 && dueB !== '') balance = { cents, due: dueB || addDays(ctx.today, 3), explicit: Boolean(dueB) };
    }
    // histórico de pagamentos
    const hist = parsePaidHistory(c('paid_history'), ctx.today);
    for (const er of hist.errors) errors.push({ field: 'paid_history', message: er });
    // C-L1: pagamento no próprio próximo vencimento contaria o ciclo como pago sem a assinatura avançar
    if (nextDue && hist.entries.some((h) => h.date === nextDue)) errors.push({ field: 'paid_history', message: `Pagamento em ${fmtBR(nextDue)} é o próprio próximo vencimento: informe o vencimento SEGUINTE em "next_due" (o ciclo pago já passou).` });

    return { plan: { line: rec.line, phone, name, dto, extraPhones, unitName, externalId, custom, product, balance, history: hist.entries }, errors };
  }

  private async processRow(ctx: JobCtx, rec: CsvRecord) {
    let p: PlanResult;
    try { p = this.plan(ctx, rec); }
    catch (e: any) { ctx.counts.skipped++; for (const x of errInfo(e)) this.addError(ctx, rec.line, x.field, x.message); return; }
    if (p.errors.length) {
      ctx.counts.skipped++;
      for (const x of p.errors) this.addError(ctx, rec.line, x.field, x.message);
      return;
    }
    try {
      if (ctx.opts.dry_run) await this.simulateRow(ctx, p.plan);
      else await this.writeRow(ctx, p.plan);
    } catch (e: any) {
      ctx.counts.skipped++;
      for (const x of errInfo(e)) this.addError(ctx, rec.line, x.field, x.message);
    }
  }

  /**
   * Cliente que já existe: pelo código externo → pelo documento (na org, se único) → entre os clientes do número da linha.
   * C-M4: com documento, só casa com cliente do número que tem o MESMO documento (ou nenhum); documento diferente de todos os
   * clientes do número = cliente novo (`another`). `linkPhone` = achado por código/documento: o telefone da linha vira mais um
   * número dele. A-8: cliente apagado (LGPD) nunca é escolhido entre os do número.
   */
  private async findExisting(ctx: JobCtx, r: RowPlan, contactId: string | null): Promise<{ customer: any; another: boolean; linkPhone: boolean }> {
    if (r.externalId) {
      const byExt = await this.prisma.whatsapp_customers.findFirst({ where: { organization_id: ctx.orgId, external_id: r.externalId } });
      if (byExt) return { customer: byExt, another: false, linkPhone: true };
    }
    const hash = r.dto.doc ? docHash(ctx.orgId, r.dto.doc) : null;
    const list = contactId ? (await this.identity.customersOfContact(ctx.orgId, contactId)).filter((x) => !x.customer.erased_at) : [];
    if (hash) {
      const mine = list.find((x) => x.customer.doc_hash === hash);
      if (mine) return { customer: mine.customer, another: false, linkPhone: false };
      const byDoc = await this.prisma.whatsapp_customers.findMany({ where: { organization_id: ctx.orgId, doc_hash: hash, erased_at: null }, take: 2 });
      if (byDoc.length === 1) return { customer: byDoc[0], another: false, linkPhone: true };
    }
    if (!list.length) return { customer: null, another: false, linkPhone: false };
    // compatível = não contradiz a linha (outro código externo ou outro documento = outra pessoa no mesmo número)
    const ok = (x: { customer: any }) => (!r.externalId || !x.customer.external_id || x.customer.external_id === r.externalId) && (!hash || !x.customer.doc_hash);
    const match = list.find(ok);
    if (!match) return { customer: null, another: true, linkPhone: false };
    return { customer: match.customer, another: false, linkPhone: false };
  }

  /** Simulação: só leitura; conta o que SERIA criado/atualizado. */
  private async simulateRow(ctx: JobCtx, r: RowPlan) {
    const s = ctx.summary;
    if (r.unitName && !ctx.units.has(lower(r.unitName))) { ctx.units.set(lower(r.unitName), ''); s.units_created++; }
    const contact = await this.prisma.whatsapp_contacts.findUnique({ where: { organization_id_wa_id: { organization_id: ctx.orgId, wa_id: jidFromPhone(r.phone) } }, select: { id: true } });
    let ex = await this.findExisting(ctx, r, contact?.id || null);
    const inFile = ctx.seenPhones.has(r.phone) || (r.externalId && ctx.seenExternal.has(r.externalId));
    ctx.seenPhones.add(r.phone);
    if (r.externalId) ctx.seenExternal.add(r.externalId);
    if (!ex.customer && inFile && !ex.another) ex = { customer: { id: '' } as any, another: false, linkPhone: false }; // repetido no arquivo: a 2ª vez atualiza
    if (ex.customer?.erased_at) throw new BadRequestException('Os dados deste cliente foram apagados (LGPD).');
    if (ex.customer && !ctx.opts.update_existing) { ctx.counts.skipped++; s.skipped_existing++; return; }
    // código único por org
    if (r.dto.code) {
      const other = await this.prisma.whatsapp_customers.findFirst({ where: { organization_id: ctx.orgId, code: r.dto.code, ...(ex.customer?.id ? { id: { not: ex.customer.id } } : {}) }, select: { id: true } });
      if (other) throw new BadRequestException('Já existe um cliente com esse código.');
    }
    if (ex.customer) { ctx.counts.updated++; s.customers_updated++; } else { ctx.counts.created++; s.customers_created++; }
    if (r.product) {
      const prod = ctx.products.get(r.product.key);
      if (!prod) { const bill = this.billingFor(r.product); ctx.products.set(r.product.key, { id: '', name: r.product.name, kind: bill === 'once' ? 'product' : 'plan', price_cents: r.product.priceCents || 0, billing: bill, billing_interval_months: cycleMonthsOf(bill) || null }); s.products_created++; }
      const cycle = prod ? cycleMonthsOf(prod.billing, prod.billing_interval_months) : cycleMonthsOf(this.billingFor(r.product));
      if (r.product.nextDue && r.product.nextDue < ctx.today && cycle) s.next_due_rolled++;
      const has = prod?.id && ex.customer?.id ? await this.prisma.whatsapp_subscriptions.findFirst({ where: { organization_id: ctx.orgId, customer_id: ex.customer.id, product_id: prod.id, status: { not: 'canceled' } }, select: { id: true } }) : null;
      if (has) { if (r.product.nextDue) s.subscriptions_updated++; } else s.subscriptions++;
    }
    if (r.balance) s.charges_balance++;
    s.charges_history += r.history.length;
  }

  private async resolveUnit(ctx: JobCtx, name: string): Promise<string | null> {
    if (!name) return null;
    const k = lower(name);
    const id = ctx.units.get(k);
    if (id) return id;
    const u = await this.units.create(ctx.orgId, { name });
    ctx.units.set(k, u.id);
    ctx.summary.units_created++;
    return u.id;
  }

  /** Periodicidade de um produto NOVO: a coluna `billing`; senão o nome ("Plano Anual"); senão mensal (C-H2). */
  private billingFor(r: NonNullable<RowPlan['product']>) {
    return r.billing || billingFromName(r.name) || 'monthly';
  }

  private async resolveProduct(ctx: JobCtx, r: NonNullable<RowPlan['product']>): Promise<ProductRef> {
    const cur = ctx.products.get(r.key);
    if (cur?.id) {
      if (r.billing && cur.billing && cur.billing !== r.billing) throw new BadRequestException(`"${cur.name}" está cadastrado como ${BILLING_PT[cur.billing] || cur.billing}, mas a planilha diz ${BILLING_PT[r.billing] || r.billing}.`);
      return cur;
    }
    if (!r.priceCents || !ctx.opts.create_products) throw new BadRequestException(`Produto "${r.name}" não existe.`);
    const billing = this.billingFor(r);
    const months = cycleMonthsOf(billing) || null;
    const p = await this.prisma.whatsapp_products.create({ data: { organization_id: ctx.orgId, name: r.name.slice(0, 120), price_cents: r.priceCents, billing, billing_interval_months: months, kind: months ? 'plan' : 'product', position: ctx.productsCount++ } });
    const row: ProductRef = { id: p.id, name: p.name, kind: (p as any).kind || 'product', price_cents: p.price_cents, billing: p.billing, billing_interval_months: p.billing_interval_months ?? null };
    ctx.products.set(r.key, row);
    ctx.summary.products_created++;
    return row;
  }

  /** Gravação real de uma linha já validada. Erros DEPOIS do cliente salvo viram erro da linha (o cliente fica). */
  private async writeRow(ctx: JobCtx, r: RowPlan) {
    const s = ctx.summary;
    // contato que já existe não é tocado aqui (o nome dele só muda se o cliente for atualizado); novo = createManual
    const known = await this.prisma.whatsapp_contacts.findUnique({ where: { organization_id_wa_id: { organization_id: ctx.orgId, wa_id: jidFromPhone(r.phone) } }, select: { id: true } });
    const ex0 = await this.findExisting(ctx, r, known?.id || null);
    if (ex0.customer && !ctx.opts.update_existing) { ctx.counts.skipped++; s.skipped_existing++; return; }
    const shaped = known || (await this.contacts.createManual(ctx.orgId, { phone: r.phone, name: r.name || undefined }));
    const ex = ex0; // contato novo não tem cliente: a busca acima (código externo/telefone) já vale
    const unitId = await this.resolveUnit(ctx, r.unitName);
    const extra: Record<string, any> = {};
    if (unitId) extra.unit_id = unitId;
    if (r.externalId) extra.external_id = r.externalId;
    if (r.custom) extra.custom = r.custom;
    let customerId: string;
    if (ex.customer) {
      await this.crm.updateCustomer(ctx.orgId, ex.customer.id, { ...r.dto, ...extra });
      customerId = ex.customer.id;
      // achado pelo código externo/documento com outro telefone: o telefone da linha vira mais um número do cliente
      const phones = [...(ex.linkPhone ? [r.phone] : []), ...r.extraPhones];
      for (const ph of phones) await this.identity.linkContact(ctx.orgId, customerId, { phone: ph }, 'user', 'import').catch(() => undefined);
      ctx.counts.updated++; s.customers_updated++;
    } else {
      const c = await this.crm.createCustomer(ctx.orgId, ctx.userId, { ...r.dto, ...extra, contact_id: shaped.id, source: 'import', ...(ex.another ? { another: true } : {}), ...(r.extraPhones.length ? { phones: r.extraPhones } : {}) });
      customerId = c.id;
      ctx.counts.created++; s.customers_created++;
    }

    // a partir daqui o cliente já está salvo: problema vira erro da linha, sem desfazer
    let subId: string | null = null;
    let productId: string | null = null;
    let productName: string | null = null;
    let subNext: string | null = null; // próximo vencimento da assinatura da linha (C-L1)
    if (r.product) {
      try {
        const prod = await this.resolveProduct(ctx, r.product);
        productId = prod.id; productName = prod.name;
        // C-M2: `next_due` no passado anda ciclo a ciclo (pelo dia de vencimento) até ≥ hoje — nunca cobra para trás
        const cycle = cycleMonthsOf(prod.billing, prod.billing_interval_months);
        let nextDue = r.product.nextDue;
        if (nextDue && !cycle) { this.addError(ctx, r.line, 'next_due', `"${prod.name}" é avulso: "next_due" foi ignorado.`); nextDue = null; }
        if (nextDue && nextDue < ctx.today) {
          const dd = r.product.dueDay || Math.min(28, Number(nextDue.slice(8, 10)));
          let x = nextDue, guard = 0;
          while (x < ctx.today && guard++ < 1200) x = addMonths(x, cycle, dd);
          nextDue = x;
          s.next_due_rolled++;
        }
        const has = await this.prisma.whatsapp_subscriptions.findFirst({ where: { organization_id: ctx.orgId, customer_id: customerId, product_id: prod.id, status: { not: 'canceled' } }, select: { id: true, next_due_at: true } });
        if (!has) {
          const res: any = await this.crm.addSubscription(ctx.orgId, customerId, {
            product_id: prod.id, trial: false,
            ...(r.product.priceCents ? { price_cents: r.product.priceCents } : {}),
            ...(r.product.dueDay ? { due_day: r.product.dueDay } : {}),
            ...(nextDue ? { next_due_at: nextDue } : {}),
          }, { source: 'import', user_id: ctx.userId });
          subId = res?.subscription?.id || null;
          subNext = res?.subscription?.next_due_at ? String(res.subscription.next_due_at).slice(0, 10) : nextDue;
          s.subscriptions++;
        } else {
          subId = has.id;
          const curNext = has.next_due_at ? new Date(has.next_due_at).toISOString().slice(0, 10) : null;
          subNext = curNext;
          if (nextDue && curNext !== nextDue) {
            await this.crm.updateSubscription(ctx.orgId, customerId, has.id, { next_due_at: nextDue, ...(r.product.dueDay ? { due_day: r.product.dueDay } : {}) }, { source: 'import', user_id: ctx.userId });
            subNext = nextDue;
            s.subscriptions_updated++;
          }
        }
      } catch (e: any) {
        for (const x of errInfo(e)) this.addError(ctx, r.line, x.field || 'product', x.message);
      }
    }

    if (r.balance || r.history.length) {
      const cust = await this.prisma.whatsapp_customers.findUnique({ where: { id: customerId }, select: { contact_id: true } });
      const contact = cust ? await this.prisma.whatsapp_contacts.findUnique({ where: { id: cust.contact_id }, select: { wa_id: true } }) : null;
      const chatId = (contact?.wa_id || jidFromPhone(r.phone)).slice(0, 64);
      if (r.balance) {
        try { await this.importBalance(ctx, customerId, chatId, r.balance); }
        catch (e: any) { for (const x of errInfo(e)) this.addError(ctx, r.line, 'balance', x.message); }
      }
      for (const h of r.history) {
        // C-L1: pago no próprio próximo vencimento da assinatura = o ciclo ainda não passou (não grava; avisa)
        if (subId && subNext && h.date === subNext) { this.addError(ctx, r.line, 'paid_history', `${h.date}: é o próximo vencimento da assinatura (${fmtBR(subNext)}); não importado. Informe em "next_due" o vencimento seguinte.`); continue; }
        try { await this.importPaid(ctx, customerId, chatId, h, subId, productId, productName); }
        catch (e: any) { for (const x of errInfo(e)) this.addError(ctx, r.line, 'paid_history', `${h.date}: ${x.message}`); }
      }
    }
  }

  /** Saldo devedor inicial → 1 cobrança PENDING sem gateway e sem mensagem (ver DECISÃO no topo). */
  private async importBalance(ctx: JobCtx, customerId: string, chatId: string, b: { cents: number; due: string; explicit: boolean }) {
    const due = dateOnlyUTC(b.due);
    // C-M5: sem `balance_due` o vencimento é "hoje + 3" (muda a cada dia) → o dedupe ignora a data: mesmo cliente + saldo
    // importado em aberto + mesmo valor = já importado
    const dup = await this.prisma.whatsapp_charges.findFirst({ where: { organization_id: ctx.orgId, customer_id: customerId, origin: 'import', status: 'PENDING', amount_cents: b.cents, ...(b.explicit ? { due_at: due } : {}) }, select: { id: true } });
    if (dup) { ctx.summary.charges_duplicated++; return; }
    await this.prisma.whatsapp_charges.create({
      data: {
        organization_id: ctx.orgId, session_id: null, customer_id: customerId, subscription_id: null, product_id: null, chat_id: chatId,
        kind: 'pix', amount_cents: b.cents, base_amount_cents: b.cents, description: 'Saldo anterior (importação)', due_at: due,
        status: 'PENDING', origin: 'import', provider: null, created_by: ctx.userId, reminders: [] as any,
      },
    });
    ctx.summary.charges_balance++;
  }

  /** Pagamento antigo → cobrança PAID (`paid_via:'import'`), sem settle/markPaid/hooks (ver DECISÃO no topo). */
  private async importPaid(ctx: JobCtx, customerId: string, chatId: string, h: PaidEntry, subId: string | null, productId: string | null, productName: string | null) {
    const due = dateOnlyUTC(h.date);
    const dup = await this.prisma.whatsapp_charges.findFirst({ where: { organization_id: ctx.orgId, customer_id: customerId, status: 'PAID', paid_via: 'import', amount_cents: h.cents, due_at: due }, select: { id: true } });
    if (dup) { ctx.summary.charges_duplicated++; return; }
    await this.prisma.whatsapp_charges.create({
      data: {
        organization_id: ctx.orgId, session_id: null, customer_id: customerId, subscription_id: subId, product_id: productId, chat_id: chatId,
        kind: 'pix', amount_cents: h.cents, base_amount_cents: h.cents, description: `${productName || 'Pagamento anterior'} (importação)`.slice(0, 255), due_at: due,
        status: 'PAID', origin: 'import', provider: null, paid_via: 'import', paid_at: new Date(`${h.date}T12:00:00-03:00`), created_by: ctx.userId, reminders: [] as any,
      },
    });
    ctx.summary.charges_history++;
  }
}
