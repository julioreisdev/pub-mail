import { EmailProjectsService } from './project.service';
import { CreateEmailProjectDto } from './dto/create-email-project.dto';
import { UpdateEmailProjectDto } from './dto/update-email-project.dto';
export declare class EmailProjectsController {
    private readonly service;
    constructor(service: EmailProjectsService);
    create(req: any, dto: CreateEmailProjectDto): Promise<{
        id: string;
        organization_id: string;
        name: string;
        created_at: Date;
        active: boolean;
        settings: import("@prisma/client/runtime/client").JsonValue;
    }>;
    list(req: any): import("../../../generated/prisma/internal/prismaNamespace").PrismaPromise<{
        id: string;
        organization_id: string;
        name: string;
        created_at: Date;
        active: boolean;
        settings: import("@prisma/client/runtime/client").JsonValue;
    }[]>;
    get(req: any, id: string): Promise<{
        id: string;
        organization_id: string;
        name: string;
        created_at: Date;
        active: boolean;
        settings: import("@prisma/client/runtime/client").JsonValue;
    }>;
    update(req: any, id: string, dto: UpdateEmailProjectDto): Promise<{
        id: string;
        organization_id: string;
        name: string;
        created_at: Date;
        active: boolean;
        settings: import("@prisma/client/runtime/client").JsonValue;
    }>;
    remove(req: any, id: string): Promise<{
        message: string;
    }>;
}
