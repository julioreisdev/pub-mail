import { BadRequestException, HttpException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../platform-billing/access.service';
import { API_KEY_RE, ApiScope, DEFAULT_API_SCOPES, MAX_API_KEYS_PER_ORG, hashApiKey, newApiKey, normalizeScopes } from './api-scopes';

// Chaves de API da organização (Fase 5, contrato §8.4).
//  - Painel: listar (sem hash), criar (a chave inteira só volta na criação), renomear/trocar escopos, revogar.
//  - `authenticate` (usado pelo guard da API v1): acha pelo sha256, recusa revogada, org desativada (401) ou sem
//    acesso pago (402 PAYMENT_REQUIRED); limite de 600 req/min por chave (janela deslizante em memória → 429);
//    `last_used_at`/`last_ip` gravados no máx. 1×/min por chave.
//  - Chave que não existe: cache PRÓPRIO e curto (não expulsa as chaves boas do cache) + freio por IP: 30 falhas
//    de autenticação em 10 min bloqueiam o IP por 10 min (429), sem tocar no banco.
//  - `OrgApiKeysService.forgetOrganization(orgId)` (estático) limpa os caches da org — chamado ao apagar a org.
export type ApiKeyCtx = { id: string; orgId: string; scopes: ApiScope[]; name: string };

const CACHE_MS = 60_000;
const RATE_LIMIT = 600;
const RATE_WINDOW_MS = 60_000;
const TOUCH_MS = 60_000;
const MISSING_MS = 30_000;
const MISSING_MAX = 2_000;
const FAIL_WINDOW_MS = 10 * 60_000;
const FAIL_LIMIT = 30;
const FAIL_BLOCK_MS = 10 * 60_000;
const FAIL_IPS_MAX = 10_000;

@Injectable()
export class OrgApiKeysService {
  private readonly logger = new Logger(OrgApiKeysService.name);
  private readonly byHash = new Map<string, { at: number; key: (ApiKeyCtx & { revoked: boolean }) | null }>();
  private readonly orgOk = new Map<string, { at: number; enabled: boolean }>();
  private readonly hits = new Map<string, number[]>();
  private readonly touched = new Map<string, number>();
  private readonly missing = new Map<string, number>(); // hash → até quando "não existe" vale
  private readonly fails = new Map<string, { n: number; first: number; blockedUntil: number }>(); // por IP

  private static readonly instances = new Set<OrgApiKeysService>();
  /** Limpa os caches de uma org apagada (a chave deixa de valer na hora, não em até 60 s). */
  static forgetOrganization(orgId: string) {
    for (const inst of OrgApiKeysService.instances) inst.forgetOrg(orgId);
  }

  constructor(private readonly prisma: PrismaService, private readonly access: AccessService) {
    OrgApiKeysService.instances.add(this);
  }

  forgetOrg(orgId: string) {
    if (!orgId) return;
    for (const [hash, c] of this.byHash) {
      if (c.key?.orgId !== orgId) continue;
      this.byHash.delete(hash);
      this.hits.delete(c.key.id);
      this.touched.delete(c.key.id);
    }
    this.orgOk.delete(orgId);
  }

  // ---------------------------------------------------------------- painel
  private shape(k: any) {
    return {
      id: k.id, name: k.name, key_prefix: k.key_prefix, key_hint: `${k.key_prefix}_••••`, scopes: normalizeScopes(k.scopes),
      active: !k.revoked_at, revoked_at: k.revoked_at || null, created_by: k.created_by || null, created_at: k.created_at, last_used_at: k.last_used_at || null, last_ip: k.last_ip || null,
    };
  }

  async list(orgId: string) {
    const rows = await this.prisma.org_api_keys.findMany({ where: { organization_id: orgId }, orderBy: [{ revoked_at: 'asc' }, { created_at: 'desc' }] });
    return rows.map((r) => this.shape(r));
  }

  async create(orgId: string, userId: string | null, dto: { name: string; scopes?: string[] }) {
    const name = String(dto.name || '').trim().slice(0, 80);
    if (!name) throw new BadRequestException('Dê um nome à chave (ex.: "Sistema da clínica").');
    const n = await this.prisma.org_api_keys.count({ where: { organization_id: orgId, revoked_at: null } });
    if (n >= MAX_API_KEYS_PER_ORG) throw new BadRequestException(`Limite de ${MAX_API_KEYS_PER_ORG} chaves ativas. Revogue uma antes de criar outra.`);
    const scopes = dto.scopes === undefined ? DEFAULT_API_SCOPES : normalizeScopes(dto.scopes);
    if (!scopes.length) throw new BadRequestException('Escolha ao menos um escopo.');
    const { key, prefix, hash } = newApiKey();
    const row = await this.prisma.org_api_keys.create({ data: { organization_id: orgId, name, key_prefix: prefix, key_hash: hash, scopes: scopes as any, created_by: userId } });
    this.missing.delete(hash);
    return { ...this.shape(row), key }; // a chave inteira SÓ nesta resposta
  }

  private async own(orgId: string, id: string) {
    const k = await this.prisma.org_api_keys.findFirst({ where: { id, organization_id: orgId } });
    if (!k) throw new NotFoundException('Chave não encontrada.');
    return k;
  }

  async update(orgId: string, id: string, dto: { name?: string; scopes?: string[] }) {
    const cur = await this.own(orgId, id);
    if (cur.revoked_at) throw new BadRequestException('Chave revogada não pode ser alterada.');
    const data: any = {};
    if (dto.name !== undefined) { const name = String(dto.name || '').trim().slice(0, 80); if (!name) throw new BadRequestException('Dê um nome à chave.'); data.name = name; }
    if (dto.scopes !== undefined) { const scopes = normalizeScopes(dto.scopes); if (!scopes.length) throw new BadRequestException('Escolha ao menos um escopo.'); data.scopes = scopes; }
    const row = Object.keys(data).length ? await this.prisma.org_api_keys.update({ where: { id }, data }) : cur;
    this.byHash.delete(cur.key_hash);
    return this.shape(row);
  }

  async revoke(orgId: string, id: string) {
    const cur = await this.own(orgId, id);
    const row = cur.revoked_at ? cur : await this.prisma.org_api_keys.update({ where: { id }, data: { revoked_at: new Date() } });
    this.byHash.delete(cur.key_hash);
    this.hits.delete(cur.id);
    this.missing.delete(cur.key_hash);
    return this.shape(row);
  }

  // ---------------------------------------------------------------- autenticação (guard)
  /** Chave do cabeçalho → contexto. Lança 401/402/429. */
  async authenticate(raw: string, ip: string | null): Promise<ApiKeyCtx> {
    const ipKey = String(ip || '').replace(/^::ffff:/, '') || '-';
    this.checkFailBrake(ipKey);
    const key = String(raw || '').trim();
    if (!API_KEY_RE.test(key)) this.authFail(ipKey, new UnauthorizedException({ statusCode: 401, code: 'INVALID_API_KEY', message: 'Chave de API ausente ou inválida. Use "Authorization: Bearer pm_…".' }));
    const hash = hashApiKey(key);
    const invalid = () => new UnauthorizedException({ statusCode: 401, code: 'INVALID_API_KEY', message: 'Chave de API inválida.' });
    if ((this.missing.get(hash) || 0) > Date.now()) this.authFail(ipKey, invalid());
    let c = this.byHash.get(hash);
    if (!c || Date.now() - c.at > CACHE_MS) {
      const row = await this.prisma.org_api_keys.findUnique({ where: { key_hash: hash } });
      if (!row) {
        // "não existe" num cache separado e curto: chaves inventadas não expulsam as boas do cache
        this.byHash.delete(hash);
        this.missing.set(hash, Date.now() + MISSING_MS);
        if (this.missing.size > MISSING_MAX) for (const [h, until] of this.missing) { if (until <= Date.now() || this.missing.size > MISSING_MAX) this.missing.delete(h); if (this.missing.size <= MISSING_MAX / 2) break; }
        this.authFail(ipKey, invalid());
      }
      c = { at: Date.now(), key: { id: row!.id, orgId: row!.organization_id, scopes: normalizeScopes(row!.scopes), name: row!.name, revoked: Boolean(row!.revoked_at) } };
      this.byHash.set(hash, c);
      if (this.byHash.size > 5000) this.byHash.delete(this.byHash.keys().next().value as string);
    }
    const k = c.key;
    if (!k) this.authFail(ipKey, invalid());
    if (k!.revoked) this.authFail(ipKey, new UnauthorizedException({ statusCode: 401, code: 'API_KEY_REVOKED', message: 'Esta chave de API foi revogada.' }));
    if (!(await this.orgEnabled(k!.orgId))) throw new UnauthorizedException({ statusCode: 401, code: 'ORGANIZATION_DISABLED', message: 'Organização desativada.' });
    const st = await this.access.getOrgState(k!.orgId).catch(() => null);
    if (st?.needs_payment) throw new HttpException({ statusCode: 402, code: 'PAYMENT_REQUIRED', message: 'O acesso da organização está pendente de pagamento.' }, 402);
    this.rateLimit(k!.id);
    this.touch(k!.id, ip);
    return { id: k!.id, orgId: k!.orgId, scopes: k!.scopes, name: k!.name };
  }

  /** IP com muitas falhas de autenticação seguidas: 429 até o bloqueio passar (sem tocar no banco). */
  private checkFailBrake(ipKey: string) {
    const f = this.fails.get(ipKey);
    if (!f) return;
    const now = Date.now();
    if (f.blockedUntil > now) {
      const retry = Math.max(1, Math.ceil((f.blockedUntil - now) / 1000));
      throw new HttpException({ statusCode: 429, code: 'TOO_MANY_AUTH_FAILURES', retry_after: retry, message: `Muitas tentativas com chave inválida deste endereço. Tente de novo em ${retry} s.` }, 429);
    }
    if (now - f.first > FAIL_WINDOW_MS) this.fails.delete(ipKey);
  }

  private authFail(ipKey: string, err: HttpException): never {
    const now = Date.now();
    let f = this.fails.get(ipKey);
    if (!f || now - f.first > FAIL_WINDOW_MS) f = { n: 0, first: now, blockedUntil: 0 };
    f.n++;
    if (f.n >= FAIL_LIMIT) { f.blockedUntil = now + FAIL_BLOCK_MS; this.logger.warn(`API v1: IP ${ipKey} bloqueado por ${FAIL_BLOCK_MS / 60_000} min (${f.n} falhas de autenticação)`); }
    this.fails.delete(ipKey);
    this.fails.set(ipKey, f);
    if (this.fails.size > FAIL_IPS_MAX) for (const [k, v] of this.fails) { if (v.blockedUntil <= now) this.fails.delete(k); if (this.fails.size <= FAIL_IPS_MAX / 2) break; }
    throw err;
  }

  private async orgEnabled(orgId: string) {
    const c = this.orgOk.get(orgId);
    if (c && Date.now() - c.at < CACHE_MS) return c.enabled;
    const o = await this.prisma.organizations.findUnique({ where: { id: orgId }, select: { status: true } }).catch(() => undefined);
    const enabled = o === undefined ? (c?.enabled ?? true) : Boolean(o) && o!.status !== false; // erro de leitura não derruba
    this.orgOk.set(orgId, { at: Date.now(), enabled });
    return enabled;
  }

  /** 600 req/min por chave (janela deslizante). */
  private rateLimit(keyId: string) {
    const now = Date.now();
    const list = (this.hits.get(keyId) || []).filter((t) => now - t < RATE_WINDOW_MS);
    if (list.length >= RATE_LIMIT) {
      this.hits.set(keyId, list);
      const retry = Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - list[0])) / 1000));
      throw new HttpException({ statusCode: 429, code: 'RATE_LIMITED', retry_after: retry, message: `Limite de ${RATE_LIMIT} requisições por minuto por chave. Tente de novo em ${retry} s.` }, 429);
    }
    list.push(now);
    this.hits.set(keyId, list);
  }

  remaining(keyId: string) {
    const now = Date.now();
    return Math.max(0, RATE_LIMIT - (this.hits.get(keyId) || []).filter((t) => now - t < RATE_WINDOW_MS).length);
  }

  private touch(keyId: string, ip: string | null) {
    const last = this.touched.get(keyId) || 0;
    if (Date.now() - last < TOUCH_MS) return;
    this.touched.set(keyId, Date.now());
    void this.prisma.org_api_keys.updateMany({ where: { id: keyId }, data: { last_used_at: new Date(), last_ip: ip ? String(ip).slice(0, 64) : null } }).catch((e) => this.logger.debug(`touch ${keyId}: ${e?.message || e}`));
  }
}
