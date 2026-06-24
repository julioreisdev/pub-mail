import { PrismaService } from '../prisma/prisma.service';
import { CreateEmailProjectScheduleDto } from './dto/create-project_schedule.dto';
import { UpdateEmailProjectScheduleDto } from './dto/update-project_schedule.dto';
export declare class ProjectSchedulesService {
    private prisma;
    constructor(prisma: PrismaService);
    private readonly scheduleSelect;
    private assertProjectFromOrg;
    create(organizationId: string, projectId: string, dto: CreateEmailProjectScheduleDto): Promise<{
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
    list(organizationId: string, projectId: string): Promise<{
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
    update(organizationId: string, projectId: string, scheduleId: string, dto: UpdateEmailProjectScheduleDto): Promise<{
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
    remove(organizationId: string, projectId: string, scheduleId: string): Promise<{
        message: string;
    }>;
    getOne(organizationId: string, projectId: string, scheduleId: string): Promise<{
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
}
