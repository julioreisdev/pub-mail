import { CreateWebchatDto } from './dto/create-webchat.dto';
import { UpdateWebchatAdsDto } from './dto/update-webchat-ads.dto';
import { UpdateWebchatDto } from './dto/update-webchat.dto';
import { WebchatsService } from './webchat.service';
export declare class WebchatsController {
    private readonly webchatsService;
    constructor(webchatsService: WebchatsService);
    create(req: any, dto: CreateWebchatDto): Promise<{
        email_projects: {
            id: string;
            name: string;
            active: boolean;
        } | null;
        agentes_ia: {
            id: string;
            organization_id: string;
            name: string;
            created_at: Date;
            updated_at: Date;
            description: string | null;
            active: boolean;
            ia_config: import("@prisma/client/runtime/client").JsonValue;
        };
    } & {
        id: string;
        organization_id: string;
        name: string;
        created_at: Date;
        updated_at: Date;
        active: boolean;
        settings: import("@prisma/client/runtime/client").JsonValue | null;
        domain: string;
        agent_id: string;
        slug: string;
        email_project_id: string | null;
        header_scripts: string | null;
        ads_config: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    list(req: any): Promise<({
        email_projects: {
            id: string;
            name: string;
            active: boolean;
        } | null;
        agentes_ia: {
            id: string;
            organization_id: string;
            name: string;
            created_at: Date;
            updated_at: Date;
            description: string | null;
            active: boolean;
            ia_config: import("@prisma/client/runtime/client").JsonValue;
        };
    } & {
        id: string;
        organization_id: string;
        name: string;
        created_at: Date;
        updated_at: Date;
        active: boolean;
        settings: import("@prisma/client/runtime/client").JsonValue | null;
        domain: string;
        agent_id: string;
        slug: string;
        email_project_id: string | null;
        header_scripts: string | null;
        ads_config: import("@prisma/client/runtime/client").JsonValue | null;
    })[]>;
    findOne(req: any, id: string): Promise<{
        email_projects: {
            id: string;
            name: string;
            active: boolean;
        } | null;
        agentes_ia: {
            id: string;
            organization_id: string;
            name: string;
            created_at: Date;
            updated_at: Date;
            description: string | null;
            active: boolean;
            ia_config: import("@prisma/client/runtime/client").JsonValue;
        };
    } & {
        id: string;
        organization_id: string;
        name: string;
        created_at: Date;
        updated_at: Date;
        active: boolean;
        settings: import("@prisma/client/runtime/client").JsonValue | null;
        domain: string;
        agent_id: string;
        slug: string;
        email_project_id: string | null;
        header_scripts: string | null;
        ads_config: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    update(req: any, id: string, dto: UpdateWebchatDto): Promise<{
        email_projects: {
            id: string;
            name: string;
            active: boolean;
        } | null;
        agentes_ia: {
            id: string;
            organization_id: string;
            name: string;
            created_at: Date;
            updated_at: Date;
            description: string | null;
            active: boolean;
            ia_config: import("@prisma/client/runtime/client").JsonValue;
        };
    } & {
        id: string;
        organization_id: string;
        name: string;
        created_at: Date;
        updated_at: Date;
        active: boolean;
        settings: import("@prisma/client/runtime/client").JsonValue | null;
        domain: string;
        agent_id: string;
        slug: string;
        email_project_id: string | null;
        header_scripts: string | null;
        ads_config: import("@prisma/client/runtime/client").JsonValue | null;
    }>;
    listAds(req: any, id: string): Promise<Record<string, any>>;
    saveAds(req: any, id: string, dto: UpdateWebchatAdsDto): Promise<Record<string, any>>;
    remove(req: any, id: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
