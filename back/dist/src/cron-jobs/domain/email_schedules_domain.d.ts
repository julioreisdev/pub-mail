export type EmailScheduleProps = {
    id: string;
    projectId: string;
    daily: boolean;
    date: Date | null;
    time: number | null;
    forXDays: number | null;
    lastRun: Date | null;
};
export type ScheduleRunDecision = {
    shouldRun: boolean;
    reason?: string;
};
export type ScheduleAfterRunEffect = {
    type: 'KEEP';
    update: {
        lastRun?: Date;
    };
} | {
    type: 'DELETE';
};
export declare class EmailSchedule {
    private readonly props;
    private constructor();
    static fromPersistence(raw: {
        id: string;
        project_id: string;
        daily: boolean;
        time: number | null;
        date: Date | null;
        for_x_days?: number | null;
        last_run?: Date | null;
    }): EmailSchedule;
    get id(): string;
    get projectId(): string;
    decide(now: Date): ScheduleRunDecision;
    afterSuccessfulRun(now: Date): ScheduleAfterRunEffect;
    toHistorySnapshot(): {
        schedule_daily: boolean;
        schedule_time: number | null;
        schedule_date: Date | null;
    };
    private isInterval;
    private decideDaily;
    private decideOneOff;
    private decideInterval;
    private hourFromLegacyTime;
    private localDateOnlyKey;
    private assertInvariants;
}
