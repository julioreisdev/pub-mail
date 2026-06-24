export declare class SendWebchatMessageDto {
    message: string;
    session_id?: string;
    lead_state?: Record<string, any>;
    context?: Record<string, any>;
    conversation_history?: Record<string, any>[];
}
