import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmailProjectDto } from './dto/create-email-project.dto';
import { UpdateEmailProjectDto } from './dto/update-email-project.dto';
export declare class EmailProjectsService {
    private prisma;
    constructor(prisma: PrismaService);
    private readonly projectSelect;
    private validateSettingsDomain;
    create(organizationId: string, dto: CreateEmailProjectDto): Promise<{
        id: string;
        organization_id: string;
        name: string;
        created_at: Date;
        active: boolean;
        settings: import("@prisma/client/runtime/client").JsonValue;
    }>;
    findAll(organizationId: string): import("../../../generated/prisma/internal/prismaNamespace").PrismaPromise<{
        id: string;
        organization_id: string;
        name: string;
        created_at: Date;
        active: boolean;
        settings: import("@prisma/client/runtime/client").JsonValue;
    }[]>;
    findOne(organizationId: string, id: string): Promise<{
        id: string;
        organization_id: string;
        name: string;
        created_at: Date;
        active: boolean;
        settings: import("@prisma/client/runtime/client").JsonValue;
    }>;
    update(organizationId: string, id: string, dto: UpdateEmailProjectDto): Promise<{
        id: string;
        organization_id: string;
        name: string;
        created_at: Date;
        active: boolean;
        settings: import("@prisma/client/runtime/client").JsonValue;
    }>;
    remove(organizationId: string, id: string): Promise<{
        message: string;
    }>;
}
