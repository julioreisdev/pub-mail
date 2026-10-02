import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../platform-billing/access.service';
import { buildZip, ZipEntry } from './zip.util';
import { decrypt, encrypt, packageToken, publicKeyB64, sha256, signed, verifyPackageToken } from './wp-crypto.util';

// Plugin WordPress "Tradutor Invisível" vinculado à conta do Pub Mail.
//  - Uma chave ativa por organização (sites ilimitados). Girar a chave para os sites da antiga.
//  - O download embute a chave no plugin (license.php) e marca a edição "pubmail".
//  - O plugin verifica a licença de hora em hora (5 min quando parado) e só aceita resposta
//    ASSINADA (Ed25519). Acesso vencido = para na hora (sem tolerância; o Pub Mail já avisa
//    3 dias antes). Vitalício/grátis = sem data de fim.
//  - A atualização automática do WordPress baixa o pacote por um token de curta duração.

const KEY_RE = /^trinv_[A-Za-z0-9_-]{32,64}$/;
const SLUG = 'tradutor-invisivel';
const MAIN = `${SLUG}.php`;
const EDITION_FROM = "define( 'TRINV_EDITION', 'standalone' );";
const EDITION_TO = "define( 'TRINV_EDITION', 'pubmail' );";
const GOOGLE_HOSTS = /^https:\/\/(translate\.googleapis\.com|clients\d?\.google\.com|translate\.google\.com)\/translate_a\/t\?client=[a-z-]+$/;

export type LicenseState = { active: boolean; status: string; until: Date | null; lifetime: boolean };

const clean = (v: unknown, max = 20) => String(v ?? '').replace(/[^0-9A-Za-z.+-]/g, '').slice(0, max) || null;

function normSite(raw: unknown): { host: string; url: string } | null {
  try {
    const u = new URL(String(raw || ''));
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const p = u.pathname.replace(/\/+$/, '');
    return { host: (u.host + p).toLowerCase().slice(0, 190), url: (u.origin + p).slice(0, 255) };
  } catch {
    return null;
  }
}

@Injectable()
export class WpPluginService {
  private readonly logger = new Logger(WpPluginService.name);
  private versionCache: { mtime: number; version: string; tested: string; changelog: string } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  // ---------------------------------------------------------------- configuração
  sourceDir(): string {
    return process.env.WP_PLUGIN_SOURCE_DIR || path.resolve(process.cwd(), '../wordpress/tradutor-invisivel');
  }

  apiBase(): string {
    return String(process.env.PUBLIC_API_URL || process.env.BASE_API_URL || '').replace(/\/+$/, '');
  }

  panelUrl(): string {
    const explicit = String(process.env.APP_PUBLIC_URL || '').replace(/\/+$/, '');
    const base = explicit || this.apiBase().replace(/^(https?:\/\/)api\./, '$1');
    return `${base}/wordpress/tradutor`;
  }

  /** Endpoints do tradutor enviados aos plugins (troca sem nova versão, se o Google mudar). */
  private remoteCfg(): Record<string, unknown> {
    const g = String(process.env.WP_PLUGIN_GOOGLE_ENDPOINTS || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => GOOGLE_HOSTS.test(s))
      .slice(0, 8);
    return g.length ? { g } : {};
  }

  /** Versão/compatibilidade/changelog lidos do código-fonte do plugin (cache pelo mtime). */
  meta() {
    const dir = this.sourceDir();
    const main = path.join(dir, MAIN);
    let st: fs.Stats;
    try {
      st = fs.statSync(main);
    } catch {
      throw new ServiceUnavailableException('Pacote do plugin indisponível no servidor.');
    }
    if (this.versionCache && this.versionCache.mtime === st.mtimeMs) return this.versionCache;
    const head = fs.readFileSync(main, 'utf8').slice(0, 4000);
    let readme = '';
    try {
      readme = fs.readFileSync(path.join(dir, 'readme.txt'), 'utf8');
    } catch {
      /* sem readme */
    }
    const version = (/^\s*\*\s*Version:\s*([0-9][0-9A-Za-z.+-]*)/m.exec(head) || [])[1] || '0.0.0';
    const tested = (/^Tested up to:\s*([0-9.]+)/m.exec(readme) || [])[1] || '';
    const cl = readme.split(/^== Changelog ==\s*$/m)[1] || '';
    const changelog = cl.split(/^== /m)[0].trim();
    this.versionCache = { mtime: st.mtimeMs, version, tested, changelog };
    return this.versionCache;
  }

  // ---------------------------------------------------------------- chaves
  // Só o que vai para o banco: hash (busca), começo (exibição) e cópia cifrada (para os downloads).
  private newKey() {
    const key = 'trinv_' + randomBytes(27).toString('base64url').slice(0, 36);
    return { key_hash: sha256(key), key_prefix: key.slice(0, 12), key_enc: encrypt(key) };
  }

  private current(orgId: string) {
    return this.prisma.wp_plugin_licenses.findFirst({ where: { organization_id: orgId, revoked_at: null }, orderBy: { created_at: 'desc' } });
  }

  async ensure(orgId: string, userId?: string) {
    const cur = await this.current(orgId);
    if (cur) return cur;
    return this.prisma.wp_plugin_licenses.create({ data: { organization_id: orgId, created_by: userId || null, ...this.newKey() } });
  }

  async rotate(orgId: string, userId: string) {
    await this.prisma.wp_plugin_licenses.updateMany({ where: { organization_id: orgId, revoked_at: null }, data: { revoked_at: new Date() } });
    await this.prisma.wp_plugin_licenses.create({ data: { organization_id: orgId, created_by: userId || null, ...this.newKey() } });
    return this.info(orgId, userId);
  }

  // ---------------------------------------------------------------- estado da licença
  /**
   * Leitura DIRETA do banco (sem o cache de 60 s): falha do banco vira 503 e o plugin mantém
   * o último estado conhecido — nunca "libera" um acesso vencido por erro de leitura.
   */
  async licenseState(orgId: string): Promise<LicenseState> {
    const org = await this.prisma.organizations.findUnique({ where: { id: orgId }, select: { status: true } });
    if (!org) return { active: false, status: 'invalid', until: null, lifetime: false };
    const row = await this.prisma.organization_access.findUnique({ where: { organization_id: orgId } });
    const st = this.access.stateOf(row);
    const withModule = await this.prisma.users.count({
      where: { organization_id: orgId, active: true, OR: [{ role: 'SUPER_ADMIN' }, { modules: { array_contains: 'wordpress' } }] },
    });
    let status: string = st.status;
    let active = true;
    if (!org.status) {
      active = false;
      status = 'disabled';
    } else if (st.needs_payment) {
      active = false;
    } else if (!withModule) {
      active = false;
      status = 'no_module';
    }
    const until = active && st.status === 'ACTIVE' && !st.lifetime && st.access_until ? st.access_until : null;
    return { active, status, until, lifetime: active && !until };
  }

  // ---------------------------------------------------------------- painel
  async info(orgId: string, userId?: string) {
    const lic = await this.ensure(orgId, userId);
    const st = await this.licenseState(orgId);
    const lics = await this.prisma.wp_plugin_licenses.findMany({ where: { organization_id: orgId }, select: { id: true, revoked_at: true } });
    const revoked = new Set(lics.filter((l) => l.revoked_at).map((l) => l.id));
    const sites = await this.prisma.wp_plugin_sites.findMany({ where: { organization_id: orgId }, orderBy: { last_seen_at: 'desc' }, take: 300 });
    let version = '';
    try {
      version = this.meta().version;
    } catch {
      /* pacote ausente: o download avisa */
    }
    return {
      plugin: { name: 'Tradutor Invisível', version },
      license: { prefix: lic.key_prefix, created_at: lic.created_at, last_check_at: lic.last_check_at },
      access: { active: st.active, status: st.status, until: st.until ? st.until.toISOString() : null, lifetime: st.lifetime },
      sites: sites.map((s) => ({
        id: s.id,
        host: s.site_host,
        url: s.site_url,
        plugin_version: s.plugin_version,
        wp_version: s.wp_version,
        php_version: s.php_version,
        active: s.last_active && !revoked.has(s.license_id),
        old_key: revoked.has(s.license_id),
        checks: s.checks,
        first_seen_at: s.first_seen_at,
        last_seen_at: s.last_seen_at,
      })),
    };
  }

  /** Pacote .zip com a chave da conta embutida. */
  async download(orgId: string, userId?: string) {
    const lic = await this.ensure(orgId, userId);
    return { filename: `${SLUG}.zip`, buffer: this.buildPackage(decrypt(lic.key_enc)) };
  }

  buildPackage(key: string): Buffer {
    const dir = this.sourceDir();
    this.meta(); // falha clara se o código do plugin não estiver no servidor
    const api = this.apiBase();
    const panel = this.panelUrl();
    const pub = publicKeyB64();
    if (!KEY_RE.test(key) || !/^https:\/\/[A-Za-z0-9.:\-/_]+$/.test(api) || !/^https:\/\/[A-Za-z0-9.:\-/_]+$/.test(panel) || !/^[A-Za-z0-9+/=]+$/.test(pub)) {
      throw new ServiceUnavailableException('Configuração do pacote inválida (PUBLIC_API_URL precisa ser https).');
    }
    const entries: ZipEntry[] = [{ name: `${SLUG}/` }];
    let marked = false;
    const walk = (abs: string, rel: string) => {
      for (const d of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (d.name.startsWith('.') || d.name === 'node_modules' || d.name === 'license.php') continue;
        const a = path.join(abs, d.name);
        const r = `${rel}${d.name}`;
        if (d.isDirectory()) {
          entries.push({ name: `${SLUG}/${r}/` });
          walk(a, `${r}/`);
        } else if (d.isFile()) {
          let data = fs.readFileSync(a);
          if (r === MAIN) {
            const txt = data.toString('utf8');
            if (!txt.includes(EDITION_FROM)) throw new ServiceUnavailableException('Plugin sem o marcador de edição.');
            data = Buffer.from(txt.replace(EDITION_FROM, EDITION_TO), 'utf8');
            marked = true;
          }
          entries.push({ name: `${SLUG}/${r}`, data });
        }
      }
    };
    walk(dir, '');
    if (!marked) throw new ServiceUnavailableException('Arquivo principal do plugin ausente.');
    const license =
      "<?php\n/**\n * Licença do Tradutor Invisível vinculada à sua conta do Pub Mail. Gerado no download — não edite.\n *\n * @package TradutorInvisivel\n */\n\n" +
      "defined( 'ABSPATH' ) || exit;\n\n" +
      `define( 'TRINV_LICENSE_KEY', '${key}' );\n` +
      `define( 'TRINV_LICENSE_API', '${api}' );\n` +
      `define( 'TRINV_LICENSE_PANEL', '${panel}' );\n` +
      `define( 'TRINV_LICENSE_PUBKEY', '${pub}' );\n`;
    entries.push({ name: `${SLUG}/license.php`, data: Buffer.from(license, 'utf8') });
    return buildZip(entries);
  }

  // ---------------------------------------------------------------- rotas públicas (plugin)
  private async byKey(key: string) {
    if (!KEY_RE.test(key)) return null;
    return this.prisma.wp_plugin_licenses.findUnique({ where: { key_hash: sha256(key) } });
  }

  /** Verificação de licença: resposta assinada. Erro do banco = 503 (o plugin mantém o último estado). */
  async check(body: any) {
    const key = String(body?.key || '').trim();
    const site = normSite(body?.site);
    const now = Math.floor(Date.now() / 1000);
    const base = { v: 1, site: site?.host || '', iat: now };
    const stop = (status: string) => signed({ ...base, active: false, status, until: 0, next: 3600 });
    try {
      const lic = await this.byKey(key);
      if (!lic) return stop('invalid');
      if (lic.revoked_at) return stop('revoked');
      const st = await this.licenseState(lic.organization_id);
      const at = new Date();
      if (site) {
        const data = { site_url: site.url, plugin_version: clean(body?.v), wp_version: clean(body?.wp), php_version: clean(body?.php), last_active: st.active, last_seen_at: at };
        await this.prisma.wp_plugin_sites
          .upsert({
            where: { license_id_site_host: { license_id: lic.id, site_host: site.host } },
            update: { ...data, checks: { increment: 1 } },
            create: { ...data, license_id: lic.id, organization_id: lic.organization_id, site_host: site.host, checks: 1 },
          })
          .catch((e) => this.logger.warn(`wp site upsert: ${e?.message || e}`));
      }
      await this.prisma.wp_plugin_licenses.update({ where: { id: lic.id }, data: { last_check_at: at } }).catch(() => undefined);
      return signed({
        ...base,
        active: st.active,
        status: st.status,
        until: st.until ? Math.floor(st.until.getTime() / 1000) : 0,
        next: st.active ? 3600 : 300,
        cfg: this.remoteCfg(),
      });
    } catch (e: any) {
      this.logger.warn(`wp license check falhou: ${e?.message || e}`);
      throw new ServiceUnavailableException('Tente novamente em instantes.');
    }
  }

  /** Atualização automática: versão atual + link do pacote (token de 48 h). Só para licença ativa. */
  async updateInfo(body: any) {
    const lic = await this.byKey(String(body?.key || '').trim());
    if (!lic || lic.revoked_at) return { ok: false };
    const st = await this.licenseState(lic.organization_id);
    if (!st.active) return { ok: false };
    const m = this.meta();
    return {
      ok: true,
      slug: SLUG,
      version: m.version,
      package: `${this.apiBase()}/public/wp-plugin/package?t=${packageToken(lic.id)}`,
      requires: '5.8',
      requires_php: '7.4',
      tested: m.tested,
      url: this.panelUrl(),
      changelog: m.changelog.slice(0, 8000),
    };
  }

  async packageByToken(token: string) {
    const id = verifyPackageToken(token);
    const lic = id ? await this.prisma.wp_plugin_licenses.findUnique({ where: { id } }) : null;
    if (!lic || lic.revoked_at) throw new NotFoundException();
    const st = await this.licenseState(lic.organization_id);
    if (!st.active) throw new NotFoundException();
    return { filename: `${SLUG}.zip`, buffer: this.buildPackage(decrypt(lic.key_enc)) };
  }
}
