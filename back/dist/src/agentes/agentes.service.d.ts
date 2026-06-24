import { PrismaService } from '../prisma/prisma.service';
import { CreateAgenteDto } from './dto/create-agente.dto';
import { UpdateAgenteDto } from './dto/update-agente.dto';
export declare class AgentesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(organizationId: string, dto: CreateAgenteDto): Promise<{
        id: string;
        organization_id: string;
        name: string;
        created_at: Date;
        updated_at: Date;
        description: string | null;
        active: boolean;
        ia_config: import("@prisma/client/runtime/client").JsonValue;
    }>;
    list(organizationId: string): Promise<{
        id: string;
        organization_id: string;
        name: string;
        created_at: Date;
        updated_at: Date;
        description: string | null;
        active: boolean;
        ia_config: import("@prisma/client/runtime/client").JsonValue;
    }[]>;
    findOne(organizationId: string, id: string): Promise<{
        id: string;
        organization_id: string;
        name: string;
        created_at: Date;
        updated_at: Date;
        description: string | null;
        active: boolean;
        ia_config: import("@prisma/client/runtime/client").JsonValue;
    }>;
    update(organizationId: string, id: string, dto: UpdateAgenteDto): Promise<{
        id: string;
        organization_id: string;
        name: string;
        created_at: Date;
        updated_at: Date;
        description: string | null;
        active: boolean;
        ia_config: import("@prisma/client/runtime/client").JsonValue;
    }>;
    remove(organizationId: string, id: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
