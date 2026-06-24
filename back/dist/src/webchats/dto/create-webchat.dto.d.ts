export declare class CreateWebchatDto {
    name: string;
    domain: string;
    agent_id: string;
    email_project_id?: string | null;
    settings?: Record<string, any>;
    header_scripts?: string | null;
    ads_config?: Record<string, any>;
    active?: boolean;
}
