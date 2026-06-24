export declare enum LeadEmailEvent {
    OPEN = "OPEN",
    CLICK = "CLICK"
}
export declare class UpdateLeadMetricsDto {
    projectId: string;
    leadId: string;
    event: LeadEmailEvent;
    timestamp?: string;
}
