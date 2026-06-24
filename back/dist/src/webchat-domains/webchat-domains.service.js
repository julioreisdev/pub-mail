"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var WebchatDomainsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebchatDomainsService = void 0;
const common_1 = require("@nestjs/common");
const node_child_process_1 = require("node:child_process");
const dns = __importStar(require("node:dns/promises"));
const promises_1 = require("node:fs/promises");
const os = __importStar(require("node:os"));
const node_path_1 = require("node:path");
const node_util_1 = require("node:util");
const prisma_service_1 = require("../prisma/prisma.service");
const system_settings_service_1 = require("../system-settings/system-settings.service");
const execFile = (0, node_util_1.promisify)(node_child_process_1.execFile);
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
let WebchatDomainsService = class WebchatDomainsService {
    static { WebchatDomainsService_1 = this; }
    prisma;
    systemSettings;
    logger = new common_1.Logger(WebchatDomainsService_1.name);
    constructor(prisma, systemSettings) {
        this.prisma = prisma;
        this.systemSettings = systemSettings;
    }
    async create(organizationId, dto) {
        const normalizedDomain = this.normalizeDomain(dto.domain);
        if (!this.isValidDomain(normalizedDomain)) {
            throw new common_1.BadRequestException('Domínio inválido. Exemplo esperado: chat.suaempresa.com.br');
        }
        const exists = await this.prisma.webchat_domains.findFirst({
            where: {
                organization_id: organizationId,
                domain: normalizedDomain,
            },
            select: { id: true },
        });
        if (exists) {
            throw new common_1.ConflictException('Este domínio já está cadastrado para sua organização.');
        }
        const claimedByAnotherOrg = await this.prisma.webchat_domains.findFirst({
            where: {
                domain: normalizedDomain,
                organization_id: { not: organizationId },
            },
            select: { id: true },
        });
        if (claimedByAnotherOrg) {
            throw new common_1.ConflictException('Este domínio já está vinculado a outra organização.');
        }
        const expectedIp = await this.getExpectedARecord();
        if (!this.isValidIpv4(expectedIp)) {
            throw new common_1.InternalServerErrorException('IP do edge para webchat inválido. Verifique Conta & Domínios > Integrações.');
        }
        const domain = await this.prisma.webchat_domains.create({
            data: {
                organization_id: organizationId,
                domain: normalizedDomain,
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
    async list(organizationId) {
        const domains = await this.prisma.webchat_domains.findMany({
            where: { organization_id: organizationId },
            orderBy: { created_at: 'desc' },
        });
        return domains.map((item) => ({
            ...item,
            instructions: this.buildInstructions(item.domain, item.expected_type, item.expected_value),
        }));
    }
    async verify(organizationId, id) {
        const domain = await this.prisma.webchat_domains.findFirst({
            where: { id, organization_id: organizationId },
        });
        if (!domain) {
            throw new common_1.NotFoundException('Domínio de webchat não encontrado.');
        }
        const dnsCheck = await this.verifyDns(domain.domain, domain.expected_type, domain.expected_value);
        if (!dnsCheck.ok) {
            const updated = await this.prisma.webchat_domains.update({
                where: { id: domain.id },
                data: {
                    status: 'FAILED',
                    last_check_error: this.toDbErrorMessage(dnsCheck.reason || 'Falha ao validar DNS.'),
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
        this.provisionSslAndTrack(updated.id, updated.domain).catch((err) => {
            this.logger.error(`[ssl-provision] erro inesperado para ${updated.domain}: ${err?.message}`);
        });
        return {
            ...updated,
            verification: dnsCheck,
        };
    }
    async remove(organizationId, id) {
        const domain = await this.prisma.webchat_domains.findFirst({
            where: { id, organization_id: organizationId },
        });
        if (!domain) {
            throw new common_1.NotFoundException('Domínio de webchat não encontrado.');
        }
        this.cleanupDomainArtifactsBestEffort(domain.domain).catch((err) => {
            this.logger.warn(`[ssl-cleanup] erro inesperado removendo artefatos de ${domain.domain}: ${err?.message}`);
        });
        await this.prisma.webchat_domains.delete({ where: { id } });
        return {
            success: true,
            message: 'Domínio de webchat removido com sucesso.',
        };
    }
    static MAX_ADS_TXT_BYTES = 64 * 1024;
    async updateAdsTxt(organizationId, id, rawContent) {
        const domain = await this.prisma.webchat_domains.findFirst({
            where: { id, organization_id: organizationId },
        });
        if (!domain) {
            throw new common_1.NotFoundException('Domínio de webchat não encontrado.');
        }
        const normalized = rawContent === undefined || rawContent === null
            ? ''
            : String(rawContent);
        const cleaned = normalized.replace(/\r\n?/g, '\n').replace(/\s+$/g, '');
        const bytes = Buffer.byteLength(cleaned, 'utf8');
        if (bytes > WebchatDomainsService_1.MAX_ADS_TXT_BYTES) {
            throw new common_1.BadRequestException(`ads.txt excede o limite de ${WebchatDomainsService_1.MAX_ADS_TXT_BYTES} bytes (${bytes} enviados).`);
        }
        const updated = await this.prisma.webchat_domains.update({
            where: { id },
            data: { ads_txt: cleaned.length > 0 ? cleaned : null },
        });
        this.ensureNginxHttpBlockForDomain(updated.domain).catch((err) => {
            this.logger.warn(`[ads-txt] falha ao reaplicar nginx block para ${updated.domain}: ${err?.message}`);
        });
        return {
            id: updated.id,
            domain: updated.domain,
            ads_txt: updated.ads_txt ?? '',
            ads_txt_bytes: bytes,
            updated_at: updated.updated_at,
        };
    }
    async getAdsTxtByHost(rawHost) {
        const host = this.normalizeHost(String(rawHost || ''));
        if (!host)
            return null;
        const row = await this.prisma.webchat_domains.findFirst({
            where: { domain: host },
            select: { ads_txt: true },
        });
        if (!row)
            return null;
        return String(row.ads_txt || '');
    }
    async regenerateAllNginxBlocks(organizationId) {
        const domains = await this.prisma.webchat_domains.findMany({
            where: { organization_id: organizationId },
            select: { id: true, domain: true },
        });
        const results = [];
        for (const d of domains) {
            try {
                await this.ensureNginxHttpBlockForDomain(d.domain);
                results.push({ domain: d.domain, ok: true });
            }
            catch (err) {
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
    async cleanupDomainArtifactsBestEffort(domain) {
        const safeName = domain.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
        const sitesAvailable = String(process.env.NGINX_SITES_AVAILABLE || '/etc/nginx/sites-available').trim();
        const sitesEnabled = String(process.env.NGINX_SITES_ENABLED || '/etc/nginx/sites-enabled').trim();
        const fileName = `pubmail-domain-${safeName}`;
        const siteFilePath = (0, node_path_1.join)(sitesAvailable, fileName);
        const symlinkPath = (0, node_path_1.join)(sitesEnabled, fileName);
        let nginxChanged = false;
        try {
            await (0, promises_1.unlink)(symlinkPath);
            nginxChanged = true;
        }
        catch (err) {
            if (err?.code !== 'ENOENT') {
                this.logger.warn(`[ssl-cleanup] unlink symlink ${symlinkPath} falhou: ${err?.message}`);
            }
        }
        try {
            await (0, promises_1.unlink)(siteFilePath);
        }
        catch (err) {
            if (err?.code !== 'ENOENT') {
                this.logger.warn(`[ssl-cleanup] unlink ${siteFilePath} falhou: ${err?.message}`);
            }
        }
        if (nginxChanged) {
            try {
                await execFile('nginx', ['-t']);
                await execFile('nginx', ['-s', 'reload']);
            }
            catch (err) {
                this.logger.warn(`[ssl-cleanup] reload do nginx falhou: ${err?.stderr || err?.message}`);
            }
        }
        const certbotBin = String(process.env.CERTBOT_BIN || 'certbot').trim();
        try {
            await execFile(certbotBin, ['delete', '--cert-name', domain, '--non-interactive'], {
                timeout: 60000,
            });
            this.logger.log(`[ssl-cleanup] cert ${domain} revogado/removido`);
        }
        catch (err) {
            this.logger.warn(`[ssl-cleanup] certbot delete falhou para ${domain}: ${err?.stderr || err?.message}`);
        }
    }
    async verifyDns(domain, expectedType, expectedValue) {
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
                reason: 'Nenhum CNAME válido encontrado para o domínio. Verifique DNS e propagação.',
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
            reason: 'Nenhum registro A válido encontrado para o domínio. Verifique DNS e propagação.',
            detected_type: null,
            detected_values: [],
        };
    }
    async safeResolveCname(domain) {
        try {
            const values = await dns.resolveCname(domain);
            return {
                values: values.map((value) => this.normalizeHost(value)),
            };
        }
        catch (error) {
            if (this.isIgnorableDnsError(error)) {
                return { values: [] };
            }
            throw new common_1.BadRequestException(`Falha ao consultar CNAME de ${domain}: ${error?.message || 'erro DNS'}`);
        }
    }
    async safeResolveA(domain) {
        try {
            const values = await dns.resolve4(domain);
            return {
                values: values.map((value) => String(value).trim()),
            };
        }
        catch (error) {
            if (this.isIgnorableDnsError(error)) {
                return { values: [] };
            }
            throw new common_1.BadRequestException(`Falha ao consultar A de ${domain}: ${error?.message || 'erro DNS'}`);
        }
    }
    isIgnorableDnsError(error) {
        const code = String(error?.code || '').toUpperCase();
        return ['ENODATA', 'ENOTFOUND', 'EAI_AGAIN', 'SERVFAIL', 'REFUSED'].includes(code);
    }
    async provisionSslAndTrack(domainId, domain) {
        try {
            await this.prisma.webchat_domains.update({
                where: { id: domainId },
                data: {
                    ssl_status: 'PROVISIONING',
                    ssl_attempted_at: new Date(),
                    ssl_error: null,
                },
            });
        }
        catch (err) {
            this.logger.error(`[ssl-provision] não consegui marcar PROVISIONING (${domain}): ${err?.message}`);
            return;
        }
        try {
            const result = await this.provisionCertificate(domain);
            if (result.provider === 'SKIPPED') {
                await this.prisma.webchat_domains.update({
                    where: { id: domainId },
                    data: { ssl_status: 'SKIPPED', ssl_error: null },
                });
                this.logger.log(`[ssl-provision] ${domain}: SKIPPED (${result.details || 'sem detalhes'})`);
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
        }
        catch (err) {
            const message = String(err?.message || err || 'erro desconhecido').slice(0, 1900);
            await this.prisma.webchat_domains.update({
                where: { id: domainId },
                data: { ssl_status: 'FAILED', ssl_error: message },
            }).catch(() => undefined);
            this.logger.error(`[ssl-provision] ${domain}: FAILED — ${message}`);
        }
    }
    async provisionCertificate(domain) {
        const provider = String(process.env.WEBCHAT_DOMAIN_BIND_PROVIDER || 'CERTBOT')
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
            throw new common_1.InternalServerErrorException(`WEBCHAT_DOMAIN_BIND_PROVIDER inválido: ${provider}. Use CERTBOT, NONE, DISABLED ou MOCK.`);
        }
        return this.provisionWithCertbot(domain);
    }
    async ensureNginxHttpBlockForDomain(domain) {
        const safeName = domain.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
        const sitesAvailable = String(process.env.NGINX_SITES_AVAILABLE || '/etc/nginx/sites-available').trim();
        const sitesEnabled = String(process.env.NGINX_SITES_ENABLED || '/etc/nginx/sites-enabled').trim();
        const webchatDist = String(process.env.WEBCHAT_FRONT_DIST || '/opt/pub-mail/front/vite/dist').trim();
        const backendInternalUrl = String(process.env.WEBCHAT_BACKEND_INTERNAL_URL || 'http://127.0.0.1:3000')
            .trim()
            .replace(/\/+$/, '');
        const fileName = `pubmail-domain-${safeName}`;
        const siteFilePath = (0, node_path_1.join)(sitesAvailable, fileName);
        const symlinkPath = (0, node_path_1.join)(sitesEnabled, fileName);
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
        await (0, promises_1.writeFile)(siteFilePath, config, { mode: 0o644 });
        try {
            await (0, promises_1.unlink)(symlinkPath);
        }
        catch (err) {
            if (err?.code !== 'ENOENT')
                throw err;
        }
        await (0, promises_1.symlink)(siteFilePath, symlinkPath);
        try {
            await execFile('nginx', ['-t']);
            await execFile('nginx', ['-s', 'reload']);
        }
        catch (err) {
            this.logger.error(`[ssl-provision] nginx -t falhou para ${domain}, removendo block — ${err?.stderr || err?.message || err}`);
            await (0, promises_1.unlink)(symlinkPath).catch(() => undefined);
            await (0, promises_1.unlink)(siteFilePath).catch(() => undefined);
            await execFile('nginx', ['-s', 'reload']).catch(() => undefined);
            throw new common_1.InternalServerErrorException(`nginx -t falhou ao adicionar bloco para ${domain}: ${(err?.stderr || err?.message || '').toString().slice(0, 400)}`);
        }
        this.logger.log(`[ssl-provision] nginx HTTP block escrito: ${siteFilePath}`);
        return siteFilePath;
    }
    async provisionWithCertbot(domain) {
        const certbotBin = String(process.env.CERTBOT_BIN || 'certbot').trim();
        const certbotEmail = await this.systemSettings.getCertbotEmailOrFail();
        const certbotMode = String(process.env.CERTBOT_MODE || 'nginx')
            .trim()
            .toLowerCase();
        if (certbotMode === 'nginx') {
            await this.ensureNginxHttpBlockForDomain(domain);
        }
        const certbotStateDir = String(process.env.CERTBOT_STATE_DIR || (0, node_path_1.join)(os.tmpdir(), 'letsencrypt')).trim();
        const certbotConfigDir = String(process.env.CERTBOT_CONFIG_DIR || (0, node_path_1.join)(certbotStateDir, 'config')).trim();
        const certbotWorkDir = String(process.env.CERTBOT_WORK_DIR || (0, node_path_1.join)(certbotStateDir, 'work')).trim();
        const certbotLogsDir = String(process.env.CERTBOT_LOGS_DIR || (0, node_path_1.join)(certbotStateDir, 'logs')).trim();
        try {
            await Promise.all([certbotConfigDir, certbotWorkDir, certbotLogsDir]
                .filter(Boolean)
                .map((dir) => (0, promises_1.mkdir)(dir, { recursive: true })));
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Falha ao preparar diretórios do certbot: ${error?.message || 'erro desconhecido'}`);
        }
        const args = [];
        if (certbotMode === 'nginx') {
            args.push('--nginx');
        }
        else if (certbotMode === 'standalone') {
            args.push('certonly', '--standalone');
        }
        else if (certbotMode === 'webroot') {
            const webroot = String(process.env.CERTBOT_WEBROOT_PATH || '').trim();
            if (!webroot) {
                throw new common_1.InternalServerErrorException('CERTBOT_WEBROOT_PATH é obrigatório quando CERTBOT_MODE=webroot.');
            }
            args.push('certonly', '--webroot', '-w', webroot);
        }
        else {
            throw new common_1.InternalServerErrorException(`CERTBOT_MODE inválido: ${certbotMode}. Use nginx, standalone ou webroot.`);
        }
        args.push('-d', domain, '--non-interactive', '--agree-tos', '--email', certbotEmail, '--keep-until-expiring');
        if (certbotMode === 'nginx') {
            args.push('--redirect');
        }
        args.push('--config-dir', certbotConfigDir, '--work-dir', certbotWorkDir, '--logs-dir', certbotLogsDir);
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
        }
        catch (error) {
            const stderr = String(error?.stderr || '').trim();
            const stdout = String(error?.stdout || '').trim();
            const message = String(error?.message || 'erro desconhecido');
            const details = [stderr, stdout, message].filter(Boolean).join(' | ');
            throw new common_1.InternalServerErrorException(`Falha ao emitir SSL via certbot para ${domain}: ${details}`);
        }
    }
    buildInstructions(domain, expectedType, expectedValue) {
        return {
            domain,
            required_record: {
                type: expectedType,
                name: domain,
                value: expectedValue,
            },
            cloudflare: {
                during_validation: 'PROXIED',
                after_verified: 'Após vinculado, mantenha o proxy ativo e configure SSL/TLS em Full ou Full (strict).',
            },
        };
    }
    async getExpectedARecord() {
        return this.systemSettings.getWebchatEdgeIpOrFail();
    }
    normalizeDomain(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/\/.*$/, '')
            .replace(/\.$/, '');
    }
    normalizeHost(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\.$/, '');
    }
    isValidDomain(domain) {
        const re = /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
        return re.test(domain);
    }
    isValidIpv4(value) {
        const re = /^(?:\d{1,3}\.){3}\d{1,3}$/;
        if (!re.test(value))
            return false;
        return value.split('.').every((part) => {
            const parsed = Number.parseInt(part, 10);
            return parsed >= 0 && parsed <= 255;
        });
    }
    areCloudflareProxyIps(values) {
        const ipv4s = values
            .map((value) => String(value || '').trim())
            .filter((value) => this.isValidIpv4(value));
        if (ipv4s.length === 0)
            return false;
        return ipv4s.every((ip) => CLOUDFLARE_IPV4_CIDRS.some((cidr) => this.isIpv4InCidr(ip, cidr)));
    }
    isIpv4InCidr(ip, cidr) {
        const [network, prefixRaw] = String(cidr || '').split('/');
        const prefix = Number.parseInt(prefixRaw, 10);
        if (!this.isValidIpv4(ip) || !this.isValidIpv4(network))
            return false;
        if (!Number.isFinite(prefix) || prefix < 0 || prefix > 32)
            return false;
        const ipInt = this.ipv4ToUint32(ip);
        const networkInt = this.ipv4ToUint32(network);
        const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);
        return (ipInt & mask) === (networkInt & mask);
    }
    ipv4ToUint32(ip) {
        const parts = String(ip || '')
            .split('.')
            .map((part) => Number.parseInt(part, 10));
        return ((((parts[0] || 0) << 24) >>> 0) +
            (((parts[1] || 0) << 16) >>> 0) +
            (((parts[2] || 0) << 8) >>> 0) +
            ((parts[3] || 0) >>> 0));
    }
    readBoolean(rawValue, defaultValue) {
        if (rawValue === undefined || rawValue === null || rawValue === '') {
            return defaultValue;
        }
        const normalized = String(rawValue).trim().toLowerCase();
        if (['1', 'true', 'yes', 'on'].includes(normalized))
            return true;
        if (['0', 'false', 'no', 'off'].includes(normalized))
            return false;
        return defaultValue;
    }
    readPositiveInt(rawValue, fallback) {
        const parsed = Number.parseInt(String(rawValue || ''), 10);
        if (!Number.isFinite(parsed) || parsed <= 0)
            return fallback;
        return parsed;
    }
    readWords(rawValue) {
        return String(rawValue || '')
            .split(/\s+/)
            .map((item) => item.trim())
            .filter(Boolean);
    }
    compactOutput(stdout, stderr) {
        const pieces = [String(stdout || '').trim(), String(stderr || '').trim()]
            .filter(Boolean)
            .join(' | ')
            .trim();
        return pieces || undefined;
    }
    toDbErrorMessage(rawValue) {
        return String(rawValue || 'Falha ao verificar domínio.')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 500);
    }
};
exports.WebchatDomainsService = WebchatDomainsService;
exports.WebchatDomainsService = WebchatDomainsService = WebchatDomainsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        system_settings_service_1.SystemSettingsService])
], WebchatDomainsService);
//# sourceMappingURL=webchat-domains.service.js.map