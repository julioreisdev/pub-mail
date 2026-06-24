import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { execFile as execFileCallback } from 'node:child_process';
import * as dns from 'node:dns/promises';
import { mkdir, readdir, readFile, symlink, unlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { PrismaService } from '../prisma/prisma.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { CreateWebchatDomainDto } from './dto/create-webchat-domain.dto';

const execFile = promisify(execFileCallback);

const CLOUDFLARE_IPV4_CIDRS = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
];

type DnsCheckResult = {
  ok: boolean;
  reason?: string;
  detected_type?: 'CNAME' | 'A' | null;
  detected_values?: string[];
};

type CertificateProvisionResult = {
  provider: 'CERTBOT' | 'SKIPPED';
  artifact?: string | null;
  details?: string;
};

@Injectable()
export class WebchatDomainsService {
  private readonly logger = new Logger(WebchatDomainsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettings: SystemSettingsService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateWebchatDomainDto,
    kind: 'webchat' | 'quiz' = 'webchat',
  ) {
    const normalizedDomain = this.normalizeDomain(dto.domain);
    if (!this.isValidDomain(normalizedDomain)) {
      throw new BadRequestException(
        'Domínio inválido. Exemplo esperado: chat.suaempresa.com.br',
      );
    }

    const exists = await this.prisma.webchat_domains.findFirst({
      where: {
        organization_id: organizationId,
        domain: normalizedDomain,
      },
      select: { id: true },
    });

    if (exists) {
      throw new ConflictException(
        'Este domínio já está cadastrado para sua organização.',
      );
    }

    const claimedByAnotherOrg = await this.prisma.webchat_domains.findFirst({
      where: {
        domain: normalizedDomain,
        organization_id: { not: organizationId },
      },
      select: { id: true },
    });
    if (claimedByAnotherOrg) {
      throw new ConflictException(
        'Este domínio já está vinculado a outra organização.',
      );
    }

    const expectedIp = await this.getExpectedARecord();
    if (!this.isValidIpv4(expectedIp)) {
      throw new InternalServerErrorException(
        'IP do edge para webchat inválido. Verifique Conta & Domínios > Integrações.',
      );
    }

    const domain = await this.prisma.webchat_domains.create({
      data: {
        organization_id: organizationId,
        domain: normalizedDomain,
        kind,
        status: 'PENDING',
        expected_type: 'A',
        expected_value: expectedIp,
      },
    });

    return {
      ...domain,
      instructions: this.buildInstructions(normalizedDomain, 'A', expectedIp),
    };
  }

  async list(organizationId: string, kind: 'webchat' | 'quiz' = 'webchat') {
    const domains = await this.prisma.webchat_domains.findMany({
      where: { organization_id: organizationId, kind },
      orderBy: { created_at: 'desc' },
    });

    return domains.map((item) => ({
      ...item,
      instructions: this.buildInstructions(
        item.domain,
        item.expected_type,
        item.expected_value,
      ),
    }));
  }

  async verify(organizationId: string, id: string) {
    const domain = await this.prisma.webchat_domains.findFirst({
      where: { id, organization_id: organizationId },
    });

    if (!domain) {
      throw new NotFoundException('Domínio de webchat não encontrado.');
    }

    const dnsCheck = await this.verifyDns(
      domain.domain,
      domain.expected_type,
      domain.expected_value,
    );

    if (!dnsCheck.ok) {
      const updated = await this.prisma.webchat_domains.update({
        where: { id: domain.id },
        data: {
          status: 'FAILED',
          last_check_error: this.toDbErrorMessage(
            dnsCheck.reason || 'Falha ao validar DNS.',
          ),
          last_checked_at: new Date(),
        },
      });

      return {
        ...updated,
        verification: dnsCheck,
      };
    }

    const updated = await this.prisma.webchat_domains.update({
      where: { id: domain.id },
      data: {
        status: 'VERIFIED',
        last_check_error: null,
        last_checked_at: new Date(),
      },
    });

    // Dispara provisionamento de SSL em background (não bloqueia a resposta).
    // O front pode acompanhar via list endpoint olhando ssl_status.
    this.provisionSslAndTrack(updated.id, updated.domain).catch((err) => {
      this.logger.error(
        `[ssl-provision] erro inesperado para ${updated.domain}: ${err?.message}`,
      );
    });

    return {
      ...updated,
      verification: dnsCheck,
    };
  }

  async remove(organizationId: string, id: string) {
    const domain = await this.prisma.webchat_domains.findFirst({
      where: { id, organization_id: organizationId },
    });

    if (!domain) {
      throw new NotFoundException('Domínio de webchat não encontrado.');
    }

    // Cleanup best-effort: remove nginx block + revoga cert. Não falha o delete
    // se algum passo der errado (apenas loga).
    this.cleanupDomainArtifactsBestEffort(domain.domain).catch((err) => {
      this.logger.warn(
        `[ssl-cleanup] erro inesperado removendo artefatos de ${domain.domain}: ${err?.message}`,
      );
    });

    await this.prisma.webchat_domains.delete({ where: { id } });

    return {
      success: true,
      message: 'Domínio de webchat removido com sucesso.',
    };
  }

  // === ads.txt =============================================================

  // Limite conservador: ads.txt real fica em poucos KB. Cap em 64KB protege
  // o TEXT/coluna e evita payload absurdo na UI.
  private static readonly MAX_ADS_TXT_BYTES = 64 * 1024;

  async updateAdsTxt(
    organizationId: string,
    id: string,
    rawContent: string | null | undefined,
  ) {
    const domain = await this.prisma.webchat_domains.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (!domain) {
      throw new NotFoundException('Domínio de webchat não encontrado.');
    }

    const normalized =
      rawContent === undefined || rawContent === null
        ? ''
        : String(rawContent);
    // Normaliza CRLF → LF e trim final do arquivo (mas preserva indentação interna).
    const cleaned = normalized.replace(/\r\n?/g, '\n').replace(/\s+$/g, '');
    const bytes = Buffer.byteLength(cleaned, 'utf8');
    if (bytes > WebchatDomainsService.MAX_ADS_TXT_BYTES) {
      throw new BadRequestException(
        `ads.txt excede o limite de ${WebchatDomainsService.MAX_ADS_TXT_BYTES} bytes (${bytes} enviados).`,
      );
    }

    const updated = await this.prisma.webchat_domains.update({
      where: { id },
      data: { ads_txt: cleaned.length > 0 ? cleaned : null },
    });

    // NÃO regeneramos o nginx block aqui. O conteúdo do ads.txt é resolvido em
    // runtime via Host header lendo a coluna `ads_txt` do DB; não precisa estar
    // no nginx. Regenerar o block aqui APAGAVA a configuração SSL que o certbot
    // patchou (listen 443 ssl + ssl_certificate), deixando o domínio servindo
    // só HTTP — Cloudflare retorna 520. Pra cobrir domínios cadastrados antes
    // do template ganhar `location = /ads.txt`, use POST /webchat-domains/regenerate-nginx
    // (admin), que reaplica o template e logo em seguida você reroda
    // `certbot --nginx -d <dominio>` pra restaurar SSL.

    return {
      id: updated.id,
      domain: updated.domain,
      ads_txt: updated.ads_txt ?? '',
      ads_txt_bytes: bytes,
      updated_at: updated.updated_at,
    };
  }

  // Resolve o conteúdo do ads.txt pelo host bruto da requisição. Usado pela
  // rota pública GET /ads.txt. Aceita Host com ou sem :porta. Retorna `null`
  // (404) quando o domínio não existe; retorna string (possivelmente vazia)
  // quando existe mas ainda não tem ads.txt configurado.
  async getAdsTxtByHost(rawHost: string | undefined): Promise<string | null> {
    const host = this.normalizeHost(String(rawHost || ''));
    if (!host) return null;

    const row = await this.prisma.webchat_domains.findFirst({
      where: { domain: host },
      select: { ads_txt: true },
    });
    if (!row) return null;
    return String(row.ads_txt || '');
  }

  // Re-aplica o template nginx para todos os domínios da organização. Útil
  // após deploy (quando o template ganha um location novo, ex.: /ads.txt) para
  // cobrir domínios já cadastrados que foram escritos com o template antigo.
  async regenerateAllNginxBlocks(organizationId: string) {
    const domains = await this.prisma.webchat_domains.findMany({
      where: { organization_id: organizationId },
      select: { id: true, domain: true },
    });

    const results: Array<{ domain: string; ok: boolean; error?: string }> = [];
    for (const d of domains) {
      try {
        await this.ensureNginxHttpBlockForDomain(d.domain);
        results.push({ domain: d.domain, ok: true });
      } catch (err: any) {
        results.push({
          domain: d.domain,
          ok: false,
          error: String(err?.message || err),
        });
      }
    }

    return {
      total: domains.length,
      regenerated: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      details: results,
    };
  }

  private async cleanupDomainArtifactsBestEffort(domain: string) {
    const safeName = domain.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
    const sitesAvailable = String(
      process.env.NGINX_SITES_AVAILABLE || '/etc/nginx/sites-available',
    ).trim();
    const sitesEnabled = String(
      process.env.NGINX_SITES_ENABLED || '/etc/nginx/sites-enabled',
    ).trim();
    const fileName = `pubmail-domain-${safeName}`;
    const siteFilePath = join(sitesAvailable, fileName);
    const symlinkPath = join(sitesEnabled, fileName);

    let nginxChanged = false;
    try {
      await unlink(symlinkPath);
      nginxChanged = true;
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        this.logger.warn(`[ssl-cleanup] unlink symlink ${symlinkPath} falhou: ${err?.message}`);
      }
    }
    try {
      await unlink(siteFilePath);
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        this.logger.warn(`[ssl-cleanup] unlink ${siteFilePath} falhou: ${err?.message}`);
      }
    }

    if (nginxChanged) {
      try {
        await execFile('nginx', ['-t']);
        await execFile('nginx', ['-s', 'reload']);
      } catch (err: any) {
        this.logger.warn(
          `[ssl-cleanup] reload do nginx falhou: ${err?.stderr || err?.message}`,
        );
      }
    }

    // Revoga + apaga cert via certbot (best-effort).
    const certbotBin = String(process.env.CERTBOT_BIN || 'certbot').trim();
    try {
      await execFile(certbotBin, ['delete', '--cert-name', domain, '--non-interactive'], {
        timeout: 60000,
      });
      this.logger.log(`[ssl-cleanup] cert ${domain} revogado/removido`);
    } catch (err: any) {
      this.logger.warn(
        `[ssl-cleanup] certbot delete falhou para ${domain}: ${err?.stderr || err?.message}`,
      );
    }
  }

  private async verifyDns(
    domain: string,
    expectedType: string,
    expectedValue: string,
  ): Promise<DnsCheckResult> {
    const expected = String(expectedValue || '').trim();
    if (!expected) {
      return {
        ok: false,
        reason: 'Valor esperado de DNS não configurado para este domínio.',
        detected_type: null,
        detected_values: [],
      };
    }

    const type = String(expectedType || 'A').trim().toUpperCase();

    if (type === 'CNAME') {
      const expectedHost = this.normalizeHost(expected);
      const cname = await this.safeResolveCname(domain);

      if (cname.values.length > 0) {
        if (cname.values.includes(expectedHost)) {
          return {
            ok: true,
            detected_type: 'CNAME',
            detected_values: cname.values,
          };
        }

        return {
          ok: false,
          reason: `CNAME encontrado, mas não aponta para ${expectedHost}.`,
          detected_type: 'CNAME',
          detected_values: cname.values,
        };
      }

      return {
        ok: false,
        reason:
          'Nenhum CNAME válido encontrado para o domínio. Verifique DNS e propagação.',
        detected_type: null,
        detected_values: [],
      };
    }

    const expectedIp = expected;
    const aRecords = await this.safeResolveA(domain);
    if (aRecords.values.length > 0) {
      if (aRecords.values.includes(expectedIp)) {
        return {
          ok: true,
          detected_type: 'A',
          detected_values: aRecords.values,
        };
      }

      if (this.areCloudflareProxyIps(aRecords.values)) {
        return {
          ok: true,
          detected_type: 'A',
          detected_values: aRecords.values,
        };
      }

      return {
        ok: false,
        reason: `Registro A encontrado, mas não aponta para ${expectedIp} nem para IPs de proxy da Cloudflare.`,
        detected_type: 'A',
        detected_values: aRecords.values,
      };
    }

    const cname = await this.safeResolveCname(domain);
    if (cname.values.length > 0) {
      return {
        ok: false,
        reason: `CNAME detectado. Para este fluxo, o domínio precisa apontar por A para ${expectedIp}.`,
        detected_type: 'CNAME',
        detected_values: cname.values,
      };
    }

    return {
      ok: false,
      reason:
        'Nenhum registro A válido encontrado para o domínio. Verifique DNS e propagação.',
      detected_type: null,
      detected_values: [],
    };
  }

  private async safeResolveCname(domain: string) {
    try {
      const values = await dns.resolveCname(domain);
      return {
        values: values.map((value) => this.normalizeHost(value)),
      };
    } catch (error: any) {
      if (this.isIgnorableDnsError(error)) {
        return { values: [] as string[] };
      }
      throw new BadRequestException(
        `Falha ao consultar CNAME de ${domain}: ${error?.message || 'erro DNS'}`,
      );
    }
  }

  private async safeResolveA(domain: string) {
    try {
      const values = await dns.resolve4(domain);
      return {
        values: values.map((value) => String(value).trim()),
      };
    } catch (error: any) {
      if (this.isIgnorableDnsError(error)) {
        return { values: [] as string[] };
      }
      throw new BadRequestException(
        `Falha ao consultar A de ${domain}: ${error?.message || 'erro DNS'}`,
      );
    }
  }

  private isIgnorableDnsError(error: any) {
    const code = String(error?.code || '').toUpperCase();
    return ['ENODATA', 'ENOTFOUND', 'EAI_AGAIN', 'SERVFAIL', 'REFUSED'].includes(
      code,
    );
  }

  // Provisão SSL "fire and forget", grava resultado em ssl_status/ssl_error.
  // Idempotente: chamadas repetidas atualizam o estado sem efeitos colaterais.
  private async provisionSslAndTrack(domainId: string, domain: string) {
    try {
      await this.prisma.webchat_domains.update({
        where: { id: domainId },
        data: {
          ssl_status: 'PROVISIONING',
          ssl_attempted_at: new Date(),
          ssl_error: null,
        },
      });
    } catch (err: any) {
      this.logger.error(
        `[ssl-provision] não consegui marcar PROVISIONING (${domain}): ${err?.message}`,
      );
      return;
    }

    try {
      const result = await this.provisionCertificate(domain);

      if (result.provider === 'SKIPPED') {
        await this.prisma.webchat_domains.update({
          where: { id: domainId },
          data: { ssl_status: 'SKIPPED', ssl_error: null },
        });
        this.logger.log(
          `[ssl-provision] ${domain}: SKIPPED (${result.details || 'sem detalhes'})`,
        );
        return;
      }

      await this.prisma.webchat_domains.update({
        where: { id: domainId },
        data: {
          ssl_status: 'ISSUED',
          ssl_error: null,
          ssl_issued_at: new Date(),
        },
      });
      this.logger.log(`[ssl-provision] ${domain}: ISSUED`);
    } catch (err: any) {
      const message = String(err?.message || err || 'erro desconhecido').slice(0, 1900);
      await this.prisma.webchat_domains.update({
        where: { id: domainId },
        data: { ssl_status: 'FAILED', ssl_error: message },
      }).catch(() => undefined);
      this.logger.error(`[ssl-provision] ${domain}: FAILED — ${message}`);
    }
  }

  private async provisionCertificate(
    domain: string,
  ): Promise<CertificateProvisionResult> {
    const provider = String(
      process.env.WEBCHAT_DOMAIN_BIND_PROVIDER || 'CERTBOT',
    )
      .trim()
      .toUpperCase();

    if (['NONE', 'DISABLED', 'MOCK'].includes(provider)) {
      return {
        provider: 'SKIPPED',
        artifact: null,
        details: 'Provisionamento SSL ignorado por configuração de ambiente.',
      };
    }

    if (provider !== 'CERTBOT') {
      throw new InternalServerErrorException(
        `WEBCHAT_DOMAIN_BIND_PROVIDER inválido: ${provider}. Use CERTBOT, NONE, DISABLED ou MOCK.`,
      );
    }

    return this.provisionWithCertbot(domain);
  }

  // Escreve um server block HTTP em /etc/nginx/sites-available/ apontando o
  // domínio para o SPA (mesma raiz do catch-all). Recarrega o nginx para que
  // o `certbot --nginx` consiga encontrar o server_name e patchar com SSL.
  // Idempotente: sobrescreve o arquivo se já existir.
  private async ensureNginxHttpBlockForDomain(domain: string): Promise<string> {
    const safeName = domain.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
    const sitesAvailable = String(
      process.env.NGINX_SITES_AVAILABLE || '/etc/nginx/sites-available',
    ).trim();
    const sitesEnabled = String(
      process.env.NGINX_SITES_ENABLED || '/etc/nginx/sites-enabled',
    ).trim();
    const webchatDist = String(
      process.env.WEBCHAT_FRONT_DIST || '/opt/pub-mail/front/vite/dist',
    ).trim();
    // Backend Nest (interno). Usado pra proxiar /ads.txt → /ads.txt do back, que
    // resolve por Host header e devolve text/plain.
    const backendInternalUrl = String(
      process.env.WEBCHAT_BACKEND_INTERNAL_URL || 'http://127.0.0.1:3000',
    )
      .trim()
      .replace(/\/+$/, '');

    const fileName = `pubmail-domain-${safeName}`;
    const siteFilePath = join(sitesAvailable, fileName);
    const symlinkPath = join(sitesEnabled, fileName);

    const config = `# Pub Mail — domínio customizado: ${domain}
# Gerado automaticamente por WebchatDomainsService em ${new Date().toISOString()}
server {
    listen 80;
    listen [::]:80;
    server_name ${domain};

    root ${webchatDist};
    index index.html;
    client_max_body_size 64M;

    # ads.txt (IAB): proxia pro backend que resolve por Host e devolve text/plain.
    # Precisa vir ANTES do try_files do SPA pra não cair no fallback /index.html.
    location = /ads.txt {
        proxy_pass ${backendInternalUrl};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~* \\.(?:css|js|woff2?|ttf|eot|otf|png|jpg|jpeg|gif|svg|ico|webp|avif|map)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
`;

    await writeFile(siteFilePath, config, { mode: 0o644 });

    // Symlink idempotente
    try {
      await unlink(symlinkPath);
    } catch (err: any) {
      if (err?.code !== 'ENOENT') throw err;
    }
    await symlink(siteFilePath, symlinkPath);

    // Auto-heal: vhosts antigos podem ter referências a paths SSL stale
    // (ex: `include /tmp/letsencrypt/config/options-ssl-nginx.conf` quando
    // o tmpfs foi limpo num reboot, ou paths customizados de uma config
    // anterior). Antes de validar nginx -t, fazemos sweep removendo essas
    // referências e apontando pros paths persistentes default. Sem isso,
    // UM vhost quebrado bloqueia a criação de TODOS os novos.
    await this.healStaleVhostPaths(sitesEnabled, sitesAvailable);

    // Valida e recarrega nginx — se nginx -t falhar, removemos o link/site e
    // propagamos o erro para que o caller marque ssl_status=FAILED.
    try {
      await execFile('nginx', ['-t']);
      await execFile('nginx', ['-s', 'reload']);
    } catch (err: any) {
      this.logger.error(
        `[ssl-provision] nginx -t falhou para ${domain}, removendo block — ${err?.stderr || err?.message || err}`,
      );
      await unlink(symlinkPath).catch(() => undefined);
      await unlink(siteFilePath).catch(() => undefined);
      await execFile('nginx', ['-s', 'reload']).catch(() => undefined);
      throw new InternalServerErrorException(
        `nginx -t falhou ao adicionar bloco para ${domain}: ${
          (err?.stderr || err?.message || '').toString().slice(0, 400)
        }`,
      );
    }

    this.logger.log(`[ssl-provision] nginx HTTP block escrito: ${siteFilePath}`);
    return siteFilePath;
  }

  // Sweep nos vhosts gerenciados (pubmail-domain-*) substituindo referências
  // a paths SSL stale por paths persistentes default. Cobre o caso onde o
  // certbot foi rodado historicamente com --config-dir customizado (ex:
  // /tmp/letsencrypt/config/) e os arquivos referenciados desapareceram
  // depois (limpeza do tmpfs no reboot). Sem isso, UM vhost com path stale
  // faz nginx -t falhar e bloqueia a criação de qualquer vhost novo.
  //
  // Idempotente — só reescreve se houver mudança, e mantém sites-available
  // em sync com sites-enabled.
  private async healStaleVhostPaths(
    sitesEnabled: string,
    sitesAvailable: string,
  ): Promise<void> {
    const STALE_PREFIXES = [
      '/tmp/letsencrypt/config/',
      '/tmp/letsencrypt/',
    ];
    const HEALTHY_PREFIX = '/etc/letsencrypt/';

    let entries: string[] = [];
    try {
      entries = await readdir(sitesEnabled);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.startsWith('pubmail-domain-')) continue;
      const filePath = join(sitesEnabled, entry);
      let content: string;
      try {
        content = await readFile(filePath, 'utf8');
      } catch {
        continue;
      }

      let changed = false;
      let healed = content;
      for (const stale of STALE_PREFIXES) {
        if (healed.includes(stale)) {
          healed = healed.split(stale).join(HEALTHY_PREFIX);
          changed = true;
        }
      }

      if (!changed) continue;

      try {
        await writeFile(filePath, healed, { mode: 0o644 });
        // Mantém sites-available em sync (caso seja arquivo separado, não symlink).
        const availPath = join(sitesAvailable, entry);
        await writeFile(availPath, healed, { mode: 0o644 }).catch(() => undefined);
        this.logger.warn(
          `[heal-vhost] paths SSL stale corrigidos em ${entry}`,
        );
      } catch (err: any) {
        this.logger.warn(
          `[heal-vhost] falha ao reescrever ${entry}: ${err?.message || err}`,
        );
      }
    }
  }

  private async provisionWithCertbot(
    domain: string,
  ): Promise<CertificateProvisionResult> {
    const certbotBin = String(process.env.CERTBOT_BIN || 'certbot').trim();
    const certbotEmail = await this.systemSettings.getCertbotEmailOrFail();
    const certbotMode = String(process.env.CERTBOT_MODE || 'nginx')
      .trim()
      .toLowerCase();

    // Para que o `certbot --nginx` consiga encontrar um server block com este
    // domain como server_name, criamos primeiro o bloco HTTP. O catch-all
    // continua atuando como fallback para domínios não verificados.
    if (certbotMode === 'nginx') {
      await this.ensureNginxHttpBlockForDomain(domain);
    }
    // IMPORTANTE: por padrão usamos os diretórios oficiais do certbot
    // (`/etc/letsencrypt`, `/var/lib/letsencrypt`, `/var/log/letsencrypt`).
    // Esses paths são PERSISTENTES e são monitorados pelo `certbot.timer` do
    // apt (renovação automática 2x/dia, sem código nosso).
    //
    // Só usamos paths customizados quando CERTBOT_STATE_DIR está explicitamente
    // setado (útil em dev/test onde não temos /etc/letsencrypt). Ali os flags
    // `--config-dir/--work-dir/--logs-dir` são adicionados ao certbot.
    const certbotStateDirEnv = String(process.env.CERTBOT_STATE_DIR || '').trim();
    const useCustomDirs = certbotStateDirEnv.length > 0;

    let certbotConfigDir = '';
    let certbotWorkDir = '';
    let certbotLogsDir = '';

    if (useCustomDirs) {
      certbotConfigDir = String(
        process.env.CERTBOT_CONFIG_DIR || join(certbotStateDirEnv, 'config'),
      ).trim();
      certbotWorkDir = String(
        process.env.CERTBOT_WORK_DIR || join(certbotStateDirEnv, 'work'),
      ).trim();
      certbotLogsDir = String(
        process.env.CERTBOT_LOGS_DIR || join(certbotStateDirEnv, 'logs'),
      ).trim();

      try {
        await Promise.all(
          [certbotConfigDir, certbotWorkDir, certbotLogsDir]
            .filter(Boolean)
            .map((dir) => mkdir(dir, { recursive: true })),
        );
      } catch (error: any) {
        throw new InternalServerErrorException(
          `Falha ao preparar diretórios do certbot: ${error?.message || 'erro desconhecido'}`,
        );
      }
    }

    const args: string[] = [];
    if (certbotMode === 'nginx') {
      args.push('--nginx');
    } else if (certbotMode === 'standalone') {
      args.push('certonly', '--standalone');
    } else if (certbotMode === 'webroot') {
      const webroot = String(process.env.CERTBOT_WEBROOT_PATH || '').trim();
      if (!webroot) {
        throw new InternalServerErrorException(
          'CERTBOT_WEBROOT_PATH é obrigatório quando CERTBOT_MODE=webroot.',
        );
      }
      args.push('certonly', '--webroot', '-w', webroot);
    } else {
      throw new InternalServerErrorException(
        `CERTBOT_MODE inválido: ${certbotMode}. Use nginx, standalone ou webroot.`,
      );
    }

    args.push(
      '-d',
      domain,
      '--non-interactive',
      '--agree-tos',
      '--email',
      certbotEmail,
      '--keep-until-expiring',
    );
    // --redirect: o plugin --nginx adiciona 301 HTTP→HTTPS no bloco do domínio.
    if (certbotMode === 'nginx') {
      args.push('--redirect');
    }
    // Só passa os 3 flags quando explicitamente setamos paths customizados.
    // Em prod (sem env var) usamos os defaults oficiais persistentes.
    if (useCustomDirs) {
      args.push(
        '--config-dir',
        certbotConfigDir,
        '--work-dir',
        certbotWorkDir,
        '--logs-dir',
        certbotLogsDir,
      );
    }

    if (this.readBoolean(process.env.CERTBOT_STAGING, false)) {
      args.push('--test-cert');
    }

    const extraArgs = this.readWords(process.env.CERTBOT_EXTRA_ARGS);
    if (extraArgs.length > 0) {
      args.push(...extraArgs);
    }

    const timeoutMs = this.readPositiveInt(process.env.CERTBOT_TIMEOUT_MS, 180000);

    try {
      const result = await execFile(certbotBin, args, {
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024,
      });

      return {
        provider: 'CERTBOT',
        artifact: `/etc/letsencrypt/live/${domain}`,
        details: this.compactOutput(result.stdout, result.stderr),
      };
    } catch (error: any) {
      const stderr = String(error?.stderr || '').trim();
      const stdout = String(error?.stdout || '').trim();
      const message = String(error?.message || 'erro desconhecido');
      const details = [stderr, stdout, message].filter(Boolean).join(' | ');

      throw new InternalServerErrorException(
        `Falha ao emitir SSL via certbot para ${domain}: ${details}`,
      );
    }
  }

  private buildInstructions(
    domain: string,
    expectedType: string,
    expectedValue: string,
  ) {
    return {
      domain,
      required_record: {
        type: expectedType,
        name: domain,
        value: expectedValue,
      },
      cloudflare: {
        during_validation: 'PROXIED',
        after_verified:
          'Após vinculado, mantenha o proxy ativo e configure SSL/TLS em Full ou Full (strict).',
      },
    };
  }

  private async getExpectedARecord(): Promise<string> {
    return this.systemSettings.getWebchatEdgeIpOrFail();
  }

  private normalizeDomain(value: string) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/\.$/, '');
  }

  private normalizeHost(value: string) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\.$/, '');
  }

  private isValidDomain(domain: string) {
    const re =
      /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
    return re.test(domain);
  }

  private isValidIpv4(value: string) {
    const re = /^(?:\d{1,3}\.){3}\d{1,3}$/;
    if (!re.test(value)) return false;
    return value.split('.').every((part) => {
      const parsed = Number.parseInt(part, 10);
      return parsed >= 0 && parsed <= 255;
    });
  }

  private areCloudflareProxyIps(values: string[]) {
    const ipv4s = values
      .map((value) => String(value || '').trim())
      .filter((value) => this.isValidIpv4(value));
    if (ipv4s.length === 0) return false;

    return ipv4s.every((ip) =>
      CLOUDFLARE_IPV4_CIDRS.some((cidr) => this.isIpv4InCidr(ip, cidr)),
    );
  }

  private isIpv4InCidr(ip: string, cidr: string) {
    const [network, prefixRaw] = String(cidr || '').split('/');
    const prefix = Number.parseInt(prefixRaw, 10);
    if (!this.isValidIpv4(ip) || !this.isValidIpv4(network)) return false;
    if (!Number.isFinite(prefix) || prefix < 0 || prefix > 32) return false;

    const ipInt = this.ipv4ToUint32(ip);
    const networkInt = this.ipv4ToUint32(network);
    const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);

    return (ipInt & mask) === (networkInt & mask);
  }

  private ipv4ToUint32(ip: string) {
    const parts = String(ip || '')
      .split('.')
      .map((part) => Number.parseInt(part, 10));

    return (
      (((parts[0] || 0) << 24) >>> 0) +
      (((parts[1] || 0) << 16) >>> 0) +
      (((parts[2] || 0) << 8) >>> 0) +
      ((parts[3] || 0) >>> 0)
    );
  }

  private readBoolean(rawValue: string | undefined, defaultValue: boolean) {
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return defaultValue;
    }

    const normalized = String(rawValue).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return defaultValue;
  }

  private readPositiveInt(rawValue: string | undefined, fallback: number) {
    const parsed = Number.parseInt(String(rawValue || ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
  }

  private readWords(rawValue: string | undefined) {
    return String(rawValue || '')
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private compactOutput(stdout?: string, stderr?: string) {
    const pieces = [String(stdout || '').trim(), String(stderr || '').trim()]
      .filter(Boolean)
      .join(' | ')
      .trim();
    return pieces || undefined;
  }

  private toDbErrorMessage(rawValue: string) {
    return String(rawValue || 'Falha ao verificar domínio.')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
  }
}
