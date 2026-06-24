import { PrismaService } from '../prisma/prisma.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { CreateWebchatDomainDto } from './dto/create-webchat-domain.dto';
type DnsCheckResult = {
    ok: boolean;
    reason?: string;
    detected_type?: 'CNAME' | 'A' | null;
    detected_values?: string[];
};
export declare class WebchatDomainsService {
    private readonly prisma;
    private readonly systemSettings;
    private readonly logger;
    constructor(prisma: PrismaService, systemSettings: SystemSettingsService);
    create(organizationId: string, dto: CreateWebchatDomainDto): Promise<{
        instructions: {
            domain: string;
            required_record: {
                type: string;
                name: string;
                value: string;
            };
            cloudflare: {
                during_validation: string;
                after_verified: string;
            };
        };
        id: string;
        organization_id: string;
        status: import("../../generated/prisma/enums").domain_status;
        created_at: Date;
        updated_at: Date;
        domain: string;
        expected_type: string;
        expected_value: string;
        last_check_error: string | null;
        last_checked_at: Date | null;
        traefik_file: string | null;
        ssl_status: string | null;
        ssl_error: string | null;
        ssl_issued_at: Date | null;
        ssl_attempted_at: Date | null;
        ads_txt: string | null;
    }>;
    list(organizationId: string): Promise<{
        instructions: {
            domain: string;
            required_record: {
                type: string;
                name: string;
                value: string;
            };
            cloudflare: {
                during_validation: string;
                after_verified: string;
            };
        };
        id: string;
        organization_id: string;
        status: import("../../generated/prisma/enums").domain_status;
        created_at: Date;
        updated_at: Date;
        domain: string;
        expected_type: string;
        expected_value: string;
        last_check_error: string | null;
        last_checked_at: Date | null;
        traefik_file: string | null;
        ssl_status: string | null;
        ssl_error: string | null;
        ssl_issued_at: Date | null;
        ssl_attempted_at: Date | null;
        ads_txt: string | null;
    }[]>;
    verify(organizationId: string, id: string): Promise<{
        verification: DnsCheckResult;
        id: string;
        organization_id: string;
        status: import("../../generated/prisma/enums").domain_status;
        created_at: Date;
        updated_at: Date;
        domain: string;
        expected_type: string;
        expected_value: string;
        last_check_error: string | null;
        last_checked_at: Date | null;
        traefik_file: string | null;
        ssl_status: string | null;
        ssl_error: string | null;
        ssl_issued_at: Date | null;
        ssl_attempted_at: Date | null;
        ads_txt: string | null;
    }>;
    remove(organizationId: string, id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    private static readonly MAX_ADS_TXT_BYTES;
    updateAdsTxt(organizationId: string, id: string, rawContent: string | null | undefined): Promise<{
        id: string;
        domain: string;
        ads_txt: string;
        ads_txt_bytes: number;
        updated_at: Date;
    }>;
    getAdsTxtByHost(rawHost: string | undefined): Promise<string | null>;
    regenerateAllNginxBlocks(organizationId: string): Promise<{
        total: number;
        regenerated: number;
        failed: number;
        details: {
            domain: string;
            ok: boolean;
            error?: string;
        }[];
    }>;
    private cleanupDomainArtifactsBestEffort;
    private verifyDns;
    private safeResolveCname;
    private safeResolveA;
    private isIgnorableDnsError;
    private provisionSslAndTrack;
    private provisionCertificate;
    private ensureNginxHttpBlockForDomain;
    private provisionWithCertbot;
    private buildInstructions;
    private getExpectedARecord;
    private normalizeDomain;
    private normalizeHost;
    private isValidDomain;
    private isValidIpv4;
    private areCloudflareProxyIps;
    private isIpv4InCidr;
    private ipv4ToUint32;
    private readBoolean;
    private readPositiveInt;
    private readWords;
    private compactOutput;
    private toDbErrorMessage;
}
export {};
