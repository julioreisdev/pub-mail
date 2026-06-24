export declare enum ScheduleSentStatus {
    PROCESSING = "PROCESSING",
    COMPLETED = "COMPLETED",
    PARTIAL = "PARTIAL",
    FAILED = "FAILED"
}
export declare class UpdateScheduleSentDto {
    status: ScheduleSentStatus;
    sent_for_leads: number;
    error_message?: string;
}
