import { CreateWebchatDomainDto } from './dto/create-webchat-domain.dto';
import { UpdateAdsTxtDto } from './dto/update-ads-txt.dto';
import { WebchatDomainsService } from './webchat-domains.service';
export declare class WebchatDomainsController {
    private readonly webchatDomainsService;
    constructor(webchatDomainsService: WebchatDomainsService);
    create(req: any, dto: CreateWebchatDomainDto): Promise<{
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
    list(req: any): Promise<{
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
    verify(req: any, id: string): Promise<{
        verification: {
            ok: boolean;
            reason?: string;
            detected_type?: "CNAME" | "A" | null;
            detected_values?: string[];
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
    updateAdsTxt(req: any, id: string, dto: UpdateAdsTxtDto): Promise<{
        id: string;
        domain: string;
        ads_txt: string;
        ads_txt_bytes: number;
        updated_at: Date;
    }>;
    regenerateNginx(req: any): Promise<{
        total: number;
        regenerated: number;
        failed: number;
        details: {
            domain: string;
            ok: boolean;
            error?: string;
        }[];
    }>;
    remove(req: any, id: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
