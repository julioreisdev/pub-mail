export type ProjectScheduleMode = 'DAILY' | 'ONE_OFF' | 'INTERVAL';
export type ProjectScheduleProps = {
    id?: string;
    projectId: string;
    daily: boolean;
    date: Date | null;
    time: number | null;
    forXDays: number | null;
    lastRun: Date | null;
};
export declare class ProjectSchedule {
    private props;
    private constructor();
    static create(input: {
        projectId: string;
        daily: boolean;
        date?: string | Date | null;
        time?: number | null;
        forXDays?: number | null;
    }): ProjectSchedule;
    static rehydrate(raw: {
        id: string;
        project_id: string;
        daily: boolean;
        date: Date | null;
        time: number | null;
        for_x_days: number | null;
        last_run: Date | null;
    }): ProjectSchedule;
    update(input: {
        daily?: boolean;
        date?: string | Date | null;
        time?: number | null;
        forXDays?: number | null;
    }): ProjectSchedule;
    mode(): ProjectScheduleMode;
    private isInterval;
    private assertInvariants;
    private assertLegacyTimeRange;
    toPersistenceForCreate(): {
        project_id: string;
        daily: boolean;
        date: Date | null;
        time: number | null;
        for_x_days: number | null;
        last_run: null;
    };
    toPersistenceForUpdate(): {
        daily: boolean;
        date: Date | null;
        time: number | null;
        for_x_days: number | null;
    };
    private static normalizeDateOnly;
    private static parseAndNormalizeDateOnly;
}
