import { CaptureWebchatLeadDto } from './dto/capture-webchat-lead.dto';
import { SendWebchatMessageDto } from './dto/send-webchat-message.dto';
import { TrackWebchatAdEventsDto } from './dto/track-webchat-ad-events.dto';
import { WebchatsService } from './webchat.service';
export declare class PublicWebchatsController {
    private readonly webchatsService;
    constructor(webchatsService: WebchatsService);
    getConfig(slug: string, domainQuery: string | undefined, req: any): Promise<{
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
    getSession(slug: string, sessionId: string | undefined, domainQuery: string | undefined, req: any): Promise<{
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
    captureLead(slug: string, domainQuery: string | undefined, dto: CaptureWebchatLeadDto, req: any): Promise<{
        success: boolean;
        routed_to: string;
        lead_id: any;
        deduplicated: boolean;
    }>;
    sendMessage(slug: string, domainQuery: string | undefined, dto: SendWebchatMessageDto, req: any): Promise<{
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
    trackAdEvents(slug: string, domainQuery: string | undefined, dto: TrackWebchatAdEventsDto, req: any): Promise<{
        success: boolean;
        stored: number;
    }>;
    private resolveDomainHint;
}
