import { PrismaService } from '../prisma/prisma.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { CreateWebchatDto } from './dto/create-webchat.dto';
import { UpdateWebchatAdsDto } from './dto/update-webchat-ads.dto';
import { UpdateWebchatDto } from './dto/update-webchat.dto';
import { CaptureWebchatLeadDto } from './dto/capture-webchat-lead.dto';
import { SendWebchatMessageDto } from './dto/send-webchat-message.dto';
import { TrackWebchatAdEventsDto } from './dto/track-webchat-ad-events.dto';
export declare class WebchatsService {
    private readonly prisma;
    private readonly systemSettings;
    private readonly logger;
    private webchatSessionUnavailableLogged;
    constructor(prisma: PrismaService, systemSettings: SystemSettingsService);
    create(data: CreateWebchatDto & {
        organization_id: string;
    }): Promise<{
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
    list(organizationId: string): Promise<({
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
    private isMysqlSortMemoryError;
    findOne(organizationId: string, id: string): Promise<{
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
    update(organizationId: string, id: string, data: UpdateWebchatDto): Promise<{
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
    remove(organizationId: string, id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getAdsConfig(organizationId: string, webchatId: string): Promise<Record<string, any>>;
    updateAdsConfig(organizationId: string, webchatId: string, payload: UpdateWebchatAdsDto): Promise<Record<string, any>>;
    getPublicConfig(slug: string, domainHint?: string): Promise<{
        id: string;
        name: string;
        nome: string;
        slug: string;
        domain: string;
        dominio: string;
        settings: Record<string, any>;
        header_scripts: string | null;
        header_ads_code: string | null;
        ads_config: Record<string, any>;
        anuncios: Record<string, any>;
        active: boolean;
        ativo: boolean;
        agent_id: string;
        agente_id: string;
        agent: {
            id: string;
            name: string;
            description: string | null;
            ia_config: import("@prisma/client/runtime/client").JsonValue;
            active: boolean;
        } | null;
        agente: {
            id: string;
            nome: string;
            descricao: string | null;
            ia_config: import("@prisma/client/runtime/client").JsonValue;
            active: boolean;
        } | null;
        ia: string | number | boolean | import("@prisma/client/runtime/client").JsonObject | import("@prisma/client/runtime/client").JsonArray | null;
        personalizacao: Record<string, any> | null;
        categoria_padrao: string | null;
    }>;
    getPublicSessionState(slug: string, domainHint: string | undefined, sessionIdRaw: string | undefined): Promise<{
        success: boolean;
        webchat_id: string;
        session_id: string;
        has_session: boolean;
        lead_state: Record<string, any> | null;
        conversation_history: {
            role: string;
            content: string;
        }[];
        messages: {
            chat: string;
            lead: string;
        }[];
    }>;
    captureLead(slug: string, domainHint: string | undefined, dto: CaptureWebchatLeadDto): Promise<{
        success: boolean;
        routed_to: string;
        lead_id: any;
        deduplicated: boolean;
    }>;
    sendMessage(slug: string, domainHint: string | undefined, dto: SendWebchatMessageDto): Promise<{
        success: boolean;
        sucesso: boolean;
        data: Record<string, any>;
        reply: string;
        resposta: string;
        modelo: string | null;
        tokens: number | null;
        anuncios: Record<string, any>;
        lead_capture: {
            persisted: boolean;
            persisted_lead_id: any;
            routed_to: any;
            required_fields: any[];
            collected: {
                [x: string]: any;
            };
            attempts: {
                [x: string]: any;
            };
            missing_required_fields: any[];
            captured_fields: Record<string, any>;
            max_attempts: number;
            allow_continue_after_attempts: boolean;
            released: boolean;
            capture_completed: boolean;
            next_field: string | null;
        };
        session_state: {
            session_id: string;
            lead_state: {
                required_fields: any[];
                collected: {
                    [x: string]: any;
                };
                attempts: {
                    [x: string]: any;
                };
                missing_required_fields: any[];
                captured_fields: Record<string, any>;
                max_attempts: number;
                allow_continue_after_attempts: boolean;
                released: boolean;
                capture_completed: boolean;
                next_field: string | null;
            };
            conversation_history: {
                role: string;
                content: string;
            }[];
        } | null;
        meta: {
            webchat_id: string;
            agent_id: string;
            tokens_charged: number;
        };
    }>;
    trackPublicAdEvents(slug: string, domainHint: string | undefined, dto: TrackWebchatAdEventsDto): Promise<{
        success: boolean;
        stored: number;
    }>;
    private upsertLeadForWebchat;
    private getSessionHistoryLimit;
    private normalizeSessionId;
    private normalizeConversationHistoryRole;
    private normalizeConversationHistoryEntries;
    private mergeConversationHistoryForRequest;
    private buildConversationHistoryForPersistence;
    private toConversationPairs;
    private hasMeaningfulLeadState;
    private mergeLeadStateFromSession;
    private isWebchatSessionPersistenceUnavailable;
    private logWebchatSessionPersistenceUnavailable;
    private getWebchatSessionState;
    private upsertWebchatSessionState;
    private normalizeLeadCapture;
    private normalizeEmail;
    private normalizeLeadName;
    private normalizeLeadFieldKey;
    private normalizeLeadRequiredFieldKeys;
    private extractCustomLeadFields;
    private ensureAgentBelongsToOrganization;
    private ensureProjectBelongsToOrganization;
    private ensureWebchatDomainRegistered;
    private normalizeDomain;
    private asRecord;
    private resolvePublicPersonalizacao;
    private defaultGptSizes;
    private normalizeGptSizes;
    private looksLikeHtmlSnippet;
    private extractGptSlotFromCode;
    private extractGptDivIdFromCode;
    private normalizeAdContract;
    private normalizeSimpleAdPayload;
    private normalizeSequenceEntry;
    private normalizeWebchatAdsPayload;
    private formatWebchatAdsRowsAsConfig;
    private readWebchatAdsConfig;
    private resolvePublicAdsConfig;
    private resolvePublicWebchat;
    private getTokenCostPerMessage;
    private debitTokensForWebchatMessage;
}
