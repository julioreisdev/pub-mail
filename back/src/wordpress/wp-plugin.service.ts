import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { Prisma } from 'generated/prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../platform-billing/access.service';
import { buildZip, ZipEntry } from './zip.util';
import {
  decrypt,
  encrypt,
  packageToken,
  publicKeyB64,
  sha256,
  signed,
  verifyPackageToken,
} from './wp-crypto.util';
import { postJson, SafeHttpError } from './safe-http.util';

// Plugins WordPress vinculados à conta do Pub Mail (Tradutor Invisível e Push In Play).
//  - UMA chave ativa por organização, a mesma para todos os plugins (sites ilimitados). Girar a
//    chave para os sites da antiga, nos dois plugins.
//  - O download embute a chave no plugin (license.php) e marca a edição "pubmail".
//  - O plugin verifica a licença de hora em hora (5 min quando parado) e só aceita resposta
//    ASSINADA (Ed25519). Acesso vencido = para na hora (sem tolerância; o Pub Mail já avisa
//    3 dias antes). Vitalício/grátis = sem data de fim.
//  - A atualização automática do WordPress baixa o pacote por um token de curta duração.

export const TRANSLATOR = 'tradutor-invisivel';
export const PUSH = 'push-in-play';
export type PluginSlug = typeof TRANSLATOR | typeof PUSH;

type PluginDef = {
  slug: PluginSlug;
  name: string;
  prefix: string; // prefixo das constantes do license.php (TRINV_ / PIP_)
  pkg: string; // @package do cabeçalho do license.php
  editionFrom: string;
  editionTo: string;
  panelPath: string;
  sourceEnv: string;
  sourceDefault: string;
};

const PLUGINS: Record<PluginSlug, PluginDef> = {
  [TRANSLATOR]: {
    slug: TRANSLATOR,
    name: 'Tradutor Invisível',
    prefix: 'TRINV',
    pkg: 'TradutorInvisivel',
    editionFrom: "define( 'TRINV_EDITION', 'standalone' );",
    editionTo: "define( 'TRINV_EDITION', 'pubmail' );",
    panelPath: '/wordpress/tradutor',
    sourceEnv: 'WP_PLUGIN_SOURCE_DIR',
    sourceDefault: '../wordpress/tradutor-invisivel',
  },
  [PUSH]: {
    slug: PUSH,
    name: 'Push In Play',
    prefix: 'PIP',
    pkg: 'PushInPlay',
    editionFrom: "define( 'PIP_EDITION', 'standalone' );",
    editionTo: "define( 'PIP_EDITION', 'pubmail' );",
    panelPath: '/wordpress/push-in-play',
    sourceEnv: 'WP_PIP_SOURCE_DIR',
    sourceDefault: '../wordpress/push-in-play',
  },
};

const KEY_RE = /^trinv_[A-Za-z0-9_-]{32,64}$/;
// Um site só aparece na lista enquanto o plugin está instalado e ativo nele: o próprio plugin avisa ao
// ser desativado/apagado (`removed_at`) e, se sumiu sem avisar (pasta apagada por FTP, site fora do
// ar), cai da lista depois deste tempo sem verificar a licença (o plugin verifica de hora em hora).
const SITE_STALE_MS = 3 * 24 * 60 * 60 * 1000;
const GOOGLE_HOSTS =
  /^https:\/\/(translate\.googleapis\.com|clients\d?\.google\.com|translate\.google\.com)\/translate_a\/t\?client=[a-z-]+$/;

export type LicenseState = {
  active: boolean;
  status: string;
  until: Date | null;
  lifetime: boolean;
};

const clean = (v: unknown, max = 20) =>
  String(v ?? '')
    .replace(/[^0-9A-Za-z.+-]/g, '')
    .slice(0, max) || null;

export function pluginOf(raw: unknown): PluginDef {
  const s = String(raw || TRANSLATOR);
  return (PLUGINS as Record<string, PluginDef>)[s] || PLUGINS[TRANSLATOR];
}

function normSite(raw: unknown): { host: string; url: string } | null {
  try {
    const u = new URL(String(raw || ''));
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const p = u.pathname.replace(/\/+$/, '');
    return {
      host: (u.host + p).toLowerCase().slice(0, 190),
      url: (u.origin + p).slice(0, 255),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- métricas do Push In Play
// O plugin (edição do Pub Mail) manda um resumo a cada 15 min e logo após cada disparo — ou devolve o
// mesmo resumo quando o painel pede ("Sincronizar agora"). Tudo é saneado aqui: só números, títulos e
// datas; listas com teto. O último resumo fica em `wp_plugin_sites.stats`; os dias vão para
// `wp_plugin_site_stats` (somam todos os sites da organização no painel).
const SYNC_INTERVAL = 900; // o que o plugin deve esperar até o próximo envio (s)
const SYNC_WINDOW = 300; // janela do token do "Sincronizar agora" (s) — igual no plugin
const STAT_COLS = [
  'impressions',
  'clicks',
  'granted',
  'denied',
  'dismissed',
  'installed',
  'sent',
  'failed',
  'clicked',
  'sent_flow',
  'sent_broadcast',
] as const;
type StatCol = (typeof STAT_COLS)[number];
type StatRow = Record<StatCol, number>;
type DayRow = {
  d: string;
  imp: number;
  clk: number;
  grt: number;
  den: number;
  dis: number;
  ins: number;
  sent: number;
  failed: number;
  clicked: number;
  sent_flow: number;
  sent_bc: number;
};
export type PipSnapshot = {
  v: number;
  at: number;
  site: { name: string; tz: string };
  plugin: Record<string, number | string>;
  subscribers: {
    active: number;
    expired: number;
    total: number;
    by_platform: Record<string, number>;
  };
  totals: Record<string, number>;
  days: DayRow[];
  health: Record<string, number>;
  blasts: Array<Record<string, number | string>>;
  copies_top: Array<Record<string, number | string>>;
  steps: Array<Record<string, number | string>>;
};
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TS = 4_102_444_800; // 2100
const DAY_MS = 86_400_000;
// 'YYYY-MM-DD' real (sem 2026-13-45, que derrubaria o INSERT no modo estrito) e entre 400 dias atrás e amanhã
function dayOk(d: string): boolean {
  if (!DAY_RE.test(d)) return false;
  const t = Date.parse(`${d}T00:00:00Z`);
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== d)
    return false;
  return t >= Date.now() - 400 * DAY_MS && t <= Date.now() + 2 * DAY_MS;
}
const SUM_COLS = {
  impressions: true,
  clicks: true,
  granted: true,
  denied: true,
  dismissed: true,
  installed: true,
  sent: true,
  failed: true,
  clicked: true,
  sent_flow: true,
  sent_broadcast: true,
} as const;
const num = (v: unknown, max = 2_000_000_000) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
};
const str = (v: unknown, max = 160) =>
  String(v ?? '')
    .replace(/\p{Cc}/gu, ' ')
    .trim()
    .slice(0, max);
const zeroRow = (): StatRow =>
  Object.fromEntries(STAT_COLS.map((k) => [k, 0])) as StatRow;

function cleanSnapshot(raw: any): PipSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const numMap = (o: any, keys: string[]) =>
    Object.fromEntries(keys.map((k) => [k, num(o?.[k])])) as Record<
      string,
      number
    >;
  const list = <T>(arr: any, max: number, map: (x: any) => T): T[] =>
    Array.isArray(arr) ? arr.slice(0, max).map(map) : [];
  const plat: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw.subscribers?.by_platform || {}).slice(
    0,
    12,
  )) {
    const kk = str(k, 20)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');
    if (kk) plat[kk] = num(v);
  }
  const days: DayRow[] = list(raw.days, 45, (d: any) => ({
    d: str(d?.d, 10),
    imp: num(d?.imp),
    clk: num(d?.clk),
    grt: num(d?.grt),
    den: num(d?.den),
    dis: num(d?.dis),
    ins: num(d?.ins),
    sent: num(d?.sent),
    failed: num(d?.failed),
    clicked: num(d?.clicked),
    sent_flow: num(d?.sent_flow),
    sent_bc: num(d?.sent_bc),
  })).filter((d) => dayOk(d.d));
  const sub = numMap(raw.subscribers, ['active', 'expired', 'total']);
  return {
    v: num(raw.v),
    at: num(raw.at, MAX_TS),
    site: { name: str(raw.site?.name, 120), tz: str(raw.site?.tz, 64) },
    plugin: {
      version: str(raw.plugin?.version, 20),
      ...numMap(raw.plugin, [
        'flow_enabled',
        'layouts',
        'layouts_on',
        'copies',
        'copies_free',
        'copies_used',
        'broadcasts',
        'broadcasts_on',
        'steps',
        'steps_on',
        'push_ok',
        'vapid',
        'license',
        'license_ok',
      ]),
    },
    subscribers: {
      active: sub.active,
      expired: sub.expired,
      total: sub.total,
      by_platform: plat,
    },
    totals: numMap(raw.totals, [
      'imp',
      'clk',
      'grt',
      'den',
      'dis',
      'ins',
      'sent',
      'failed',
      'clicked',
    ]),
    days,
    health: numMap(raw.health, [
      'pending',
      'sending',
      'failed_24h',
      'last_send',
      'cron_last',
      'cron_ok',
      'cron_off',
      'parallel',
    ]),
    blasts: list(raw.blasts, 10, (b: any) => ({
      id: num(b?.id),
      title: str(b?.title, 160),
      kind: str(b?.kind, 20),
      broadcast: str(b?.broadcast, 120),
      copy_id: num(b?.copy_id),
      total: num(b?.total),
      sent: num(b?.sent),
      failed: num(b?.failed),
      clicked: num(b?.clicked),
      status: str(b?.status, 20),
      at: num(b?.at, MAX_TS),
    })),
    copies_top: list(raw.copies_top, 8, (c: any) => ({
      id: num(c?.id),
      title: str(c?.title, 160),
      sent: num(c?.sent),
      clicked: num(c?.clicked),
      used: num(c?.used),
    })),
    steps: list(raw.steps, 20, (x: any) => ({
      id: num(x?.id),
      title: str(x?.title, 160),
      delay: num(x?.delay),
      enabled: num(x?.enabled),
      sent: num(x?.sent),
      clicked: num(x?.clicked),
    })),
  };
}

function syncError(e: any): string {
  if (e instanceof SafeHttpError) {
    if (e.code === 'EHTTP' && e.status === 403)
      return 'o site está com outra chave — baixe o plugin de novo e instale nele';
    if (e.code === 'EHTTP' && e.status === 404)
      return 'plugin antigo no site (precisa da versão 0.10 ou mais nova)';
    if (e.code === 'EHTTP' && e.status === 429)
      return 'o site pediu para esperar — tente de novo em 1 minuto';
    if (e.code === 'ETIMEOUT') return 'o site não respondeu a tempo';
    if (e.code === 'EBLOCKED') return 'endereço do site não permitido';
    return e.message;
  }
  return String(e?.message || 'falha de rede').slice(0, 120);
}

// Telas do Push In Play, mostradas na página do Pub Mail (o que já existe e o que vem).
const PIP_SCREENS = [
  {
    key: 'popup-layout',
    title: 'Popup Layout',
    text: 'Vários convites de permissão ao mesmo tempo (modal, barras, cantos) como teste A/B, com impressões, cliques e ativações por layout e por plataforma, prévia real e CSS próprio. Convite para adicionar o site à tela inicial (obrigatório no iPhone).',
    ready: true,
  },
  {
    key: 'automation',
    title: 'Automação',
    text: 'Sequência que cada novo inscrito recebe: logo após ativar, 30 minutos depois, no dia seguinte… Título, texto, ícone, imagem e link por passo; cliques por passo; teste no aparelho da equipe e diagnóstico de cada navegador.',
    ready: true,
  },
  {
    key: 'settings',
    title: 'Configurações básicas',
    text: 'Som e vibração padrão (com os limites de cada sistema), manter na tela, avisar de novo, e "Enviar agora": uma notificação para todos os inscritos, com histórico.',
    ready: true,
  },
  {
    key: 'copys',
    title: 'Copys',
    text: 'Biblioteca de notificações prontas (título, texto, emoji ou imagem, imagem grande, link), uma a uma ou importadas de uma planilha .xlsx/.csv com modelo para baixar. Filtros (disponíveis/usadas), ações em massa, "Enviar agora", teste no aparelho e métricas por copy.',
    ready: true,
  },
  {
    key: 'broadcasts',
    title: 'Broadcasts',
    text: 'Horários do dia (12:00, 12:30…) e dias da semana em que o site sorteia uma copy e dispara para todos os inscritos; o que fazer com a copy depois (apagar, marcar como usada ou manter), "Disparar agora", status de cada horário e histórico com métricas por disparo e por copy.',
    ready: true,
  },
];

@Injectable()
export class WpPluginService {
  private readonly logger = new Logger(WpPluginService.name);
  private versionCache: Partial<
    Record<
      PluginSlug,
      { mtime: number; version: string; tested: string; changelog: string }
    >
  > = {};

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  // ---------------------------------------------------------------- configuração
  sourceDir(slug: PluginSlug = TRANSLATOR): string {
    const def = PLUGINS[slug];
    return (
      process.env[def.sourceEnv] ||
      path.resolve(process.cwd(), def.sourceDefault)
    );
  }

  apiBase(): string {
    return String(
      process.env.PUBLIC_API_URL || process.env.BASE_API_URL || '',
    ).replace(/\/+$/, '');
  }

  panelUrl(slug: PluginSlug = TRANSLATOR): string {
    const explicit = String(process.env.APP_PUBLIC_URL || '').replace(
      /\/+$/,
      '',
    );
    const base =
      explicit || this.apiBase().replace(/^(https?:\/\/)api\./, '$1');
    return `${base}${PLUGINS[slug].panelPath}`;
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
  meta(slug: PluginSlug = TRANSLATOR) {
    const dir = this.sourceDir(slug);
    const main = path.join(dir, `${slug}.php`);
    let st: fs.Stats;
    try {
      st = fs.statSync(main);
    } catch {
      throw new ServiceUnavailableException(
        `Pacote do ${PLUGINS[slug].name} indisponível no servidor.`,
      );
    }
    const cached = this.versionCache[slug];
    if (cached && cached.mtime === st.mtimeMs) return cached;
    const head = fs.readFileSync(main, 'utf8').slice(0, 4000);
    let readme = '';
    try {
      readme = fs.readFileSync(path.join(dir, 'readme.txt'), 'utf8');
    } catch {
      /* sem readme */
    }
    const version =
      (/^\s*\*\s*Version:\s*([0-9][0-9A-Za-z.+-]*)/m.exec(head) || [])[1] ||
      '0.0.0';
    const tested = (/^Tested up to:\s*([0-9.]+)/m.exec(readme) || [])[1] || '';
    const cl = readme.split(/^== Changelog ==\s*$/m)[1] || '';
    const changelog = cl.split(/^== /m)[0].trim();
    const entry = { mtime: st.mtimeMs, version, tested, changelog };
    this.versionCache[slug] = entry;
    return entry;
  }

  // ---------------------------------------------------------------- chaves
  // Só o que vai para o banco: hash (busca), começo (exibição) e cópia cifrada (para os downloads).
  private newKey() {
    const key = 'trinv_' + randomBytes(27).toString('base64url').slice(0, 36);
    return {
      key_hash: sha256(key),
      key_prefix: key.slice(0, 12),
      key_enc: encrypt(key),
    };
  }

  private current(orgId: string) {
    return this.prisma.wp_plugin_licenses.findFirst({
      where: { organization_id: orgId, revoked_at: null },
      orderBy: { created_at: 'desc' },
    });
  }

  async ensure(orgId: string, userId?: string) {
    const cur = await this.current(orgId);
    if (cur) return cur;
    return this.prisma.wp_plugin_licenses.create({
      data: {
        organization_id: orgId,
        created_by: userId || null,
        ...this.newKey(),
      },
    });
  }

  /** Troca a chave da conta — vale para TODOS os plugins (os sites com a antiga param até receberem o download novo). */
  async rotate(orgId: string, userId: string, slug: PluginSlug = TRANSLATOR) {
    await this.prisma.wp_plugin_licenses.updateMany({
      where: { organization_id: orgId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
    await this.prisma.wp_plugin_licenses.create({
      data: {
        organization_id: orgId,
        created_by: userId || null,
        ...this.newKey(),
      },
    });
    return this.info(orgId, userId, slug);
  }

  // ---------------------------------------------------------------- estado da licença
  /**
   * Leitura DIRETA do banco (sem o cache de 60 s): falha do banco vira 503 e o plugin mantém
   * o último estado conhecido — nunca "libera" um acesso vencido por erro de leitura.
   */
  async licenseState(orgId: string): Promise<LicenseState> {
    const org = await this.prisma.organizations.findUnique({
      where: { id: orgId },
      select: { status: true },
    });
    if (!org)
      return { active: false, status: 'invalid', until: null, lifetime: false };
    const row = await this.prisma.organization_access.findUnique({
      where: { organization_id: orgId },
    });
    const st = this.access.stateOf(row);
    const withModule = await this.prisma.users.count({
      where: {
        organization_id: orgId,
        active: true,
        OR: [
          { role: 'SUPER_ADMIN' },
          { modules: { array_contains: 'wordpress' } },
        ],
      },
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
    const until =
      active && st.status === 'ACTIVE' && !st.lifetime && st.access_until
        ? st.access_until
        : null;
    return { active, status, until, lifetime: active && !until };
  }

  // ---------------------------------------------------------------- painel
  async info(orgId: string, userId?: string, slug: PluginSlug = TRANSLATOR) {
    const def = PLUGINS[slug];
    const lic = await this.ensure(orgId, userId);
    const st = await this.licenseState(orgId);
    const lics = await this.prisma.wp_plugin_licenses.findMany({
      where: { organization_id: orgId },
      select: { id: true, revoked_at: true },
    });
    const revoked = new Set(lics.filter((l) => l.revoked_at).map((l) => l.id));
    const sites = await this.prisma.wp_plugin_sites.findMany({
      where: this.installedWhere(orgId, slug),
      orderBy: { last_seen_at: 'desc' },
      take: 300,
    });
    let version = '';
    let tested = '';
    try {
      ({ version, tested } = this.meta(slug));
    } catch {
      /* pacote ausente: o download avisa */
    }
    return {
      plugin: { slug, name: def.name, version, tested },
      license: {
        prefix: lic.key_prefix,
        created_at: lic.created_at,
        last_check_at: lic.last_check_at,
        shared: true,
      },
      access: {
        active: st.active,
        status: st.status,
        until: st.until ? st.until.toISOString() : null,
        lifetime: st.lifetime,
      },
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
        name: s.site_name,
        stats_at: s.stats_at,
      })),
      ...(slug === PUSH ? { screens: PIP_SCREENS } : {}),
    };
  }

  /** Pacote .zip com a chave da conta embutida. */
  async download(
    orgId: string,
    userId?: string,
    slug: PluginSlug = TRANSLATOR,
  ) {
    const lic = await this.ensure(orgId, userId);
    return {
      filename: `${slug}.zip`,
      buffer: this.buildPackage(decrypt(lic.key_enc), slug),
    };
  }

  buildPackage(key: string, slug: PluginSlug = TRANSLATOR): Buffer {
    const def = PLUGINS[slug];
    const dir = this.sourceDir(slug);
    this.meta(slug); // falha clara se o código do plugin não estiver no servidor
    const api = this.apiBase();
    const panel = this.panelUrl(slug);
    const pub = publicKeyB64();
    if (
      !KEY_RE.test(key) ||
      !/^https:\/\/[A-Za-z0-9.:\-/_]+$/.test(api) ||
      !/^https:\/\/[A-Za-z0-9.:\-/_]+$/.test(panel) ||
      !/^[A-Za-z0-9+/=]+$/.test(pub)
    ) {
      throw new ServiceUnavailableException(
        'Configuração do pacote inválida (PUBLIC_API_URL precisa ser https).',
      );
    }
    const main = `${slug}.php`;
    const entries: ZipEntry[] = [{ name: `${slug}/` }];
    let marked = false;
    const walk = (abs: string, rel: string) => {
      for (const d of fs
        .readdirSync(abs, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name))) {
        if (
          d.name.startsWith('.') ||
          d.name === 'node_modules' ||
          d.name === 'license.php'
        )
          continue;
        const a = path.join(abs, d.name);
        const r = `${rel}${d.name}`;
        if (d.isDirectory()) {
          entries.push({ name: `${slug}/${r}/` });
          walk(a, `${r}/`);
        } else if (d.isFile()) {
          let data = fs.readFileSync(a);
          if (r === main) {
            const txt = data.toString('utf8');
            if (!txt.includes(def.editionFrom))
              throw new ServiceUnavailableException(
                'Plugin sem o marcador de edição.',
              );
            data = Buffer.from(
              txt.replace(def.editionFrom, def.editionTo),
              'utf8',
            );
            marked = true;
          }
          entries.push({ name: `${slug}/${r}`, data });
        }
      }
    };
    walk(dir, '');
    if (!marked)
      throw new ServiceUnavailableException(
        'Arquivo principal do plugin ausente.',
      );
    const P = def.prefix;
    const license =
      `<?php\n/**\n * Licença do ${def.name} vinculada à sua conta do Pub Mail. Gerado no download — não edite.\n *\n * @package ${def.pkg}\n */\n\n` +
      "defined( 'ABSPATH' ) || exit;\n\n" +
      `define( '${P}_LICENSE_KEY', '${key}' );\n` +
      `define( '${P}_LICENSE_API', '${api}' );\n` +
      `define( '${P}_LICENSE_PANEL', '${panel}' );\n` +
      `define( '${P}_LICENSE_PUBKEY', '${pub}' );\n`;
    entries.push({
      name: `${slug}/license.php`,
      data: Buffer.from(license, 'utf8'),
    });
    return buildZip(entries);
  }

  // ---------------------------------------------------------------- rotas públicas (plugin)
  /** Sites em que o plugin está instalado e ativo agora (ver SITE_STALE_MS). */
  private installedWhere(orgId: string, slug: PluginSlug): Prisma.wp_plugin_sitesWhereInput {
    return {
      organization_id: orgId,
      plugin: slug,
      removed_at: null,
      last_seen_at: { gte: new Date(Date.now() - SITE_STALE_MS) },
    };
  }

  /**
   * O plugin foi desativado ou apagado num site (gancho de desativação / uninstall.php): o site sai da
   * lista na hora. Vale para todas as linhas daquele endereço na conta (chave atual e antigas); a
   * próxima verificação de licença (reativar/reinstalar) zera o `removed_at`.
   */
  async remove(body: any) {
    const key = String(body?.key || '').trim();
    const site = normSite(body?.site);
    const def = pluginOf(body?.plugin);
    const lic = await this.byKey(key).catch(() => null);
    if (!lic || !site) return { ok: false };
    const r = await this.prisma.wp_plugin_sites
      .updateMany({
        where: {
          organization_id: lic.organization_id,
          site_host: site.host,
          plugin: def.slug,
          removed_at: null,
        },
        data: { removed_at: new Date() },
      })
      .catch((e) => {
        this.logger.warn(`wp site remove: ${e?.message || e}`);
        return { count: 0 };
      });
    this.logger.log(
      `plugin ${def.slug} ${clean(body?.reason, 16) || 'removido'} em ${site.host} (${r.count} linha(s))`,
    );
    return { ok: true, removed: r.count };
  }

  private async byKey(key: string) {
    if (!KEY_RE.test(key)) return null;
    return this.prisma.wp_plugin_licenses.findUnique({
      where: { key_hash: sha256(key) },
    });
  }

  /** Verificação de licença: resposta assinada. Erro do banco = 503 (o plugin mantém o último estado). */
  async check(body: any) {
    const key = String(body?.key || '').trim();
    const site = normSite(body?.site);
    const def = pluginOf(body?.plugin);
    const now = Math.floor(Date.now() / 1000);
    const base = { v: 1, site: site?.host || '', iat: now };
    const stop = (status: string) =>
      signed({ ...base, active: false, status, until: 0, next: 3600 });
    try {
      const lic = await this.byKey(key);
      if (!lic) return stop('invalid');
      if (lic.revoked_at) return stop('revoked');
      const st = await this.licenseState(lic.organization_id);
      const at = new Date();
      if (site) {
        const data = {
          site_url: site.url,
          plugin_version: clean(body?.v),
          wp_version: clean(body?.wp),
          php_version: clean(body?.php),
          last_active: st.active,
          last_seen_at: at,
          removed_at: null, // reinstalou/reativou: volta à lista
        };
        await this.prisma.wp_plugin_sites
          .upsert({
            where: {
              license_id_site_host_plugin: {
                license_id: lic.id,
                site_host: site.host,
                plugin: def.slug,
              },
            },
            update: { ...data, checks: { increment: 1 } },
            create: {
              ...data,
              license_id: lic.id,
              organization_id: lic.organization_id,
              site_host: site.host,
              plugin: def.slug,
              checks: 1,
            },
          })
          .catch((e) => this.logger.warn(`wp site upsert: ${e?.message || e}`));
      }
      await this.prisma.wp_plugin_licenses
        .update({ where: { id: lic.id }, data: { last_check_at: at } })
        .catch(() => undefined);
      return signed({
        ...base,
        active: st.active,
        status: st.status,
        until: st.until ? Math.floor(st.until.getTime() / 1000) : 0,
        next: st.active ? 3600 : 300,
        cfg: def.slug === TRANSLATOR ? this.remoteCfg() : {},
      });
    } catch (e: any) {
      this.logger.warn(`wp license check falhou: ${e?.message || e}`);
      throw new ServiceUnavailableException('Tente novamente em instantes.');
    }
  }

  /** Atualização automática: versão atual + link do pacote (token de 48 h). Só para licença ativa. */
  async updateInfo(body: any) {
    const def = pluginOf(body?.plugin);
    const lic = await this.byKey(String(body?.key || '').trim());
    if (!lic || lic.revoked_at) return { ok: false };
    const st = await this.licenseState(lic.organization_id);
    if (!st.active) return { ok: false };
    const m = this.meta(def.slug);
    const p = def.slug === TRANSLATOR ? '' : `&p=${def.slug}`;
    return {
      ok: true,
      slug: def.slug,
      version: m.version,
      package: `${this.apiBase()}/public/wp-plugin/package?t=${packageToken(lic.id, def.slug)}${p}`,
      requires: '5.8',
      requires_php: '7.4',
      tested: m.tested,
      url: this.panelUrl(def.slug),
      changelog: m.changelog.slice(0, 8000),
    };
  }

  // ---------------------------------------------------------------- métricas (Push In Play)
  /** O site manda o resumo (15 min / fim de disparo / "Verificar agora"). Resposta: {ok, next}. */
  async stats(body: any) {
    const def = pluginOf(body?.plugin);
    if (def.slug !== PUSH) return { ok: false, status: 'plugin' };
    const site = normSite(body?.site);
    const lic = await this.byKey(String(body?.key || '').trim());
    if (!lic || lic.revoked_at)
      return { ok: false, status: lic ? 'revoked' : 'invalid' };
    if (!site) return { ok: false, status: 'site' };
    const snap = cleanSnapshot(body?.stats);
    if (!snap) return { ok: false, status: 'stats' };
    try {
      const row = await this.prisma.wp_plugin_sites.upsert({
        where: {
          license_id_site_host_plugin: {
            license_id: lic.id,
            site_host: site.host,
            plugin: PUSH,
          },
        },
        update: {
          site_url: site.url,
          plugin_version: clean(body?.v) || undefined,
          last_seen_at: new Date(),
          removed_at: null,
          ...this.snapData(snap),
        },
        create: {
          license_id: lic.id,
          organization_id: lic.organization_id,
          site_host: site.host,
          site_url: site.url,
          plugin: PUSH,
          plugin_version: clean(body?.v),
          checks: 0,
          ...this.snapData(snap),
        },
      });
      await this.storeDays(row.id, lic.organization_id, snap.days);
      return { ok: true, next: SYNC_INTERVAL };
    } catch (e: any) {
      this.logger.warn(`wp stats falhou: ${e?.message || e}`);
      throw new ServiceUnavailableException('Tente novamente em instantes.');
    }
  }

  private snapData(snap: PipSnapshot) {
    return {
      site_name: snap.site.name || null,
      stats: snap as unknown as Prisma.InputJsonValue,
      stats_at: new Date(),
    };
  }

  /** Dias do resumo → tabela diária (uma instrução; repetir o mesmo dia só atualiza). */
  private async storeDays(siteId: string, orgId: string, days: DayRow[]) {
    if (!days.length) return;
    const rows = days.map(
      (d) =>
        Prisma.sql`(${siteId}, ${orgId}, ${d.d}, ${d.imp}, ${d.clk}, ${d.grt}, ${d.den}, ${d.dis}, ${d.ins}, ${d.sent}, ${d.failed}, ${d.clicked}, ${d.sent_flow}, ${d.sent_bc})`,
    );
    await this.prisma
      .$executeRaw`INSERT INTO wp_plugin_site_stats (site_id, organization_id, day, impressions, clicks, granted, denied, dismissed, installed, sent, failed, clicked, sent_flow, sent_broadcast) VALUES ${Prisma.join(rows)} ON DUPLICATE KEY UPDATE impressions = VALUES(impressions), clicks = VALUES(clicks), granted = VALUES(granted), denied = VALUES(denied), dismissed = VALUES(dismissed), installed = VALUES(installed), sent = VALUES(sent), failed = VALUES(failed), clicked = VALUES(clicked), sent_flow = VALUES(sent_flow), sent_broadcast = VALUES(sent_broadcast), updated_at = CURRENT_TIMESTAMP(3)`;
  }

  private todayBrt() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private shiftDay(iso: string, n: number) {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  /** Sites do Push In Play da org, um por endereço (chave atual vence a antiga; entre iguais, o contato mais recente). */
  private async pushSites(orgId: string) {
    const [sites, lics] = await Promise.all([
      this.prisma.wp_plugin_sites.findMany({
        where: this.installedWhere(orgId, PUSH),
        orderBy: { last_seen_at: 'desc' },
        take: 300,
      }),
      this.prisma.wp_plugin_licenses.findMany({
        where: { organization_id: orgId },
        select: { id: true, revoked_at: true, key_enc: true },
      }),
    ]);
    const revoked = new Set(lics.filter((l) => l.revoked_at).map((l) => l.id));
    const byHost = new Map<string, (typeof sites)[number]>();
    for (const s of sites) {
      const cur = byHost.get(s.site_host);
      const old = revoked.has(s.license_id);
      const curOld = cur ? revoked.has(cur.license_id) : true;
      if (
        !cur ||
        (curOld && !old) ||
        (curOld === old && s.last_seen_at > cur.last_seen_at)
      )
        byHost.set(s.site_host, s);
    }
    return { sites: [...byHost.values()], revoked, lics };
  }

  /** Painel: totais do período (todos os sites ou um), série por dia, por site, últimos disparos e copys. */
  async analytics(orgId: string, daysRaw: unknown, siteId?: string) {
    const days = [7, 30, 90].includes(Number(daysRaw)) ? Number(daysRaw) : 30;
    const { sites: all, revoked } = await this.pushSites(orgId);
    const sites = siteId ? all.filter((s) => s.id === siteId) : all;
    const ids = sites.map((s) => s.id);
    const today = this.todayBrt();
    const from = this.shiftDay(today, -(days - 1));
    const prevFrom = this.shiftDay(from, -days);
    // somas no banco (4 consultas leves pelo índice org+dia), não as linhas: 300 sites × 180 dias não passam pelo Node
    const fromDate = new Date(`${from}T00:00:00Z`);
    const prevFromDate = new Date(`${prevFrom}T00:00:00Z`);
    const todayDate = new Date(`${today}T00:00:00Z`);
    const current = {
      organization_id: orgId,
      site_id: { in: ids },
      day: { gte: fromDate, lte: todayDate },
    };
    const earlier = {
      organization_id: orgId,
      site_id: { in: ids },
      day: { gte: prevFromDate, lt: fromDate },
    };
    const fromSum = (
      r: { _sum?: Partial<Record<StatCol, number | null>> } | null,
    ): StatRow => {
      const out = zeroRow();
      for (const k of STAT_COLS) out[k] = Number(r?._sum?.[k] || 0);
      return out;
    };
    const [curAgg, prevAgg, dayRows, siteRows] = ids.length
      ? await Promise.all([
          this.prisma.wp_plugin_site_stats.aggregate({
            where: current,
            _sum: SUM_COLS,
          }),
          this.prisma.wp_plugin_site_stats.aggregate({
            where: earlier,
            _sum: SUM_COLS,
          }),
          this.prisma.wp_plugin_site_stats.groupBy({
            by: ['day'],
            where: current,
            _sum: SUM_COLS,
          }),
          this.prisma.wp_plugin_site_stats.groupBy({
            by: ['site_id'],
            where: current,
            _sum: SUM_COLS,
          }),
        ])
      : [null, null, [], []];
    const totals = fromSum(curAgg);
    const previous = fromSum(prevAgg);
    const byDay = new Map<string, StatRow>(
      dayRows.map((r): [string, StatRow] => [
        r.day.toISOString().slice(0, 10),
        fromSum(r),
      ]),
    );
    const bySite = new Map<string, StatRow>(
      siteRows.map((r): [string, StatRow] => [r.site_id, fromSum(r)]),
    );
    const series: Array<{ date: string } & StatRow> = [];
    for (let i = 0; i < days; i++) {
      const d = this.shiftDay(from, i);
      series.push({ date: d, ...(byDay.get(d) || zeroRow()) });
    }
    const subscribers = {
      active: 0,
      expired: 0,
      by_platform: {} as Record<string, number>,
    };
    const blasts: Array<Record<string, unknown>> = [];
    const copies: Array<Record<string, unknown>> = [];
    let syncedAt: Date | null = null;
    const out = sites.map((s) => {
      const snap = (s.stats as unknown as PipSnapshot | null) || null;
      if (snap) {
        subscribers.active += snap.subscribers?.active || 0;
        subscribers.expired += snap.subscribers?.expired || 0;
        for (const [k, v] of Object.entries(
          snap.subscribers?.by_platform || {},
        ))
          subscribers.by_platform[k] =
            (subscribers.by_platform[k] || 0) + Number(v || 0);
        for (const b of snap.blasts || [])
          blasts.push({ ...b, site_id: s.id, host: s.site_host });
        for (const c of snap.copies_top || [])
          copies.push({ ...c, site_id: s.id, host: s.site_host });
      }
      if (s.stats_at && (!syncedAt || s.stats_at > syncedAt))
        syncedAt = s.stats_at;
      return {
        id: s.id,
        host: s.site_host,
        url: s.site_url,
        name: s.site_name,
        plugin_version: s.plugin_version,
        wp_version: s.wp_version,
        active: s.last_active && !revoked.has(s.license_id),
        old_key: revoked.has(s.license_id),
        last_seen_at: s.last_seen_at,
        stats_at: s.stats_at,
        subscribers: snap?.subscribers || null,
        plugin: snap?.plugin || null,
        health: snap?.health || null,
        all: snap?.totals || null,
        steps: snap?.steps || [],
        period: bySite.get(s.id) || zeroRow(),
      };
    });
    blasts.sort((a, b) => Number(b.at) - Number(a.at));
    copies.sort(
      (a, b) =>
        Number(b.clicked) - Number(a.clicked) ||
        Number(b.sent) - Number(a.sent),
    );
    out.sort(
      (a, b) =>
        b.period.sent - a.period.sent ||
        (b.subscribers?.active || 0) - (a.subscribers?.active || 0) ||
        a.host.localeCompare(b.host),
    );
    return {
      days,
      from,
      to: today,
      synced_at: syncedAt,
      interval: SYNC_INTERVAL,
      sites: out,
      totals,
      previous,
      series,
      subscribers,
      blasts: blasts.slice(0, 12),
      copies_top: copies.slice(0, 8),
    };
  }

  private syncAt = new Map<string, number>();

  /** "Sincronizar agora": pede o resumo a cada site (token da chave da conta; só https; nunca IP interno). */
  async syncNow(orgId: string) {
    const last = this.syncAt.get(orgId) || 0;
    if (Date.now() - last < 20_000)
      throw new BadRequestException(
        'Aguarde alguns segundos antes de sincronizar de novo.',
      );
    this.syncAt.set(orgId, Date.now());
    const { sites, revoked, lics } = await this.pushSites(orgId);
    const keys = new Map(
      lics.filter((l) => !l.revoked_at).map((l) => [l.id, decrypt(l.key_enc)]),
    );
    const targets = sites
      .filter((s) => s.last_seen_at.getTime() > Date.now() - 30 * 86_400_000)
      .slice(0, 40);
    const results: Array<{
      id: string;
      host: string;
      ok: boolean;
      error?: string;
    }> = [];
    const one = async (s: (typeof targets)[number]) => {
      const key = keys.get(s.license_id);
      if (!key || revoked.has(s.license_id)) {
        results.push({
          id: s.id,
          host: s.site_host,
          ok: false,
          error:
            'o site está com a chave antiga — baixe o plugin de novo e instale nele',
        });
        return;
      }
      const t = createHmac('sha256', key)
        .update(`pip-sync|${Math.floor(Date.now() / 1000 / SYNC_WINDOW)}`)
        .digest('hex');
      try {
        const j: any = await postJson(
          `${s.site_url}/?rest_route=/pip/v1/sync`,
          { t },
          { timeoutMs: 8_000, maxBytes: 512 * 1024 },
        );
        const snap = j?.ok ? cleanSnapshot(j.stats) : null;
        if (!snap) {
          results.push({
            id: s.id,
            host: s.site_host,
            ok: false,
            error: 'o site não devolveu as métricas',
          });
          return;
        }
        await this.prisma.wp_plugin_sites.update({
          where: { id: s.id },
          data: {
            last_seen_at: new Date(),
            plugin_version: clean(snap.plugin.version) || undefined,
            ...this.snapData(snap),
          },
        });
        await this.storeDays(s.id, orgId, snap.days);
        results.push({ id: s.id, host: s.site_host, ok: true });
      } catch (e: any) {
        results.push({
          id: s.id,
          host: s.site_host,
          ok: false,
          error: syncError(e),
        });
      }
    };
    const queue = [...targets];
    await Promise.all(
      Array.from({ length: Math.min(4, queue.length) }, async () => {
        while (queue.length) await one(queue.shift()!);
      }),
    );
    return {
      at: new Date(),
      total: targets.length,
      synced: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok),
    };
  }

  async packageByToken(token: string, plugin?: string) {
    const def = pluginOf(plugin);
    const id = verifyPackageToken(token, def.slug);
    const lic = id
      ? await this.prisma.wp_plugin_licenses.findUnique({ where: { id } })
      : null;
    if (!lic || lic.revoked_at) throw new NotFoundException();
    const st = await this.licenseState(lic.organization_id);
    if (!st.active) throw new NotFoundException();
    return {
      filename: `${def.slug}.zip`,
      buffer: this.buildPackage(decrypt(lic.key_enc), def.slug),
    };
  }
}
