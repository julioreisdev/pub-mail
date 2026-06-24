import { ProjectSchedulesService } from './project_schedules.service';
import { CreateEmailProjectScheduleDto } from './dto/create-project_schedule.dto';
import { UpdateEmailProjectScheduleDto } from './dto/update-project_schedule.dto';
import { EmailSchedulesRunner } from 'src/cron-jobs/schedules.service';
export declare class ProjectSchedulesController {
    private readonly service;
    private readonly emailSchedulesRunner;
    constructor(service: ProjectSchedulesService, emailSchedulesRunner: EmailSchedulesRunner);
    dispatchNow(req: any, projectId: string): Promise<{
        success: boolean;
        message: string;
        dispatchId: string;
    }>;
    create(req: any, projectId: string, dto: CreateEmailProjectScheduleDto): Promise<{
        id: string;
        created_at: Date;
        updated_at: Date;
        project_id: string;
        daily: boolean;
        date: Date | null;
        time: number | null;
        for_x_days: number | null;
        last_run: Date | null;
    }>;
    getOne(req: any, projectId: string, scheduleId: string): Promise<{
        id: string;
        created_at: Date;
        updated_at: Date;
        project_id: string;
        daily: boolean;
        date: Date | null;
        time: number | null;
        for_x_days: number | null;
        last_run: Date | null;
    }>;
    list(req: any, projectId: string): Promise<{
        id: string;
        created_at: Date;
        updated_at: Date;
        project_id: string;
        daily: boolean;
        date: Date | null;
        time: number | null;
        for_x_days: number | null;
        last_run: Date | null;
    }[]>;
    update(req: any, projectId: string, scheduleId: string, dto: UpdateEmailProjectScheduleDto): Promise<{
        id: string;
        created_at: Date;
        updated_at: Date;
        project_id: string;
        daily: boolean;
        date: Date | null;
        time: number | null;
        for_x_days: number | null;
        last_run: Date | null;
    } | null>;
    remove(req: any, projectId: string, scheduleId: string): Promise<{
        message: string;
    }>;
}
