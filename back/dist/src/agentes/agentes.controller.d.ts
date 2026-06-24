import { AgentesService } from './agentes.service';
import { CreateAgenteDto } from './dto/create-agente.dto';
import { UpdateAgenteDto } from './dto/update-agente.dto';
export declare class AgentesController {
    private readonly agentesService;
    constructor(agentesService: AgentesService);
    create(req: any, dto: CreateAgenteDto): Promise<{
        id: string;
        organization_id: string;
        name: string;
        created_at: Date;
        updated_at: Date;
        description: string | null;
        active: boolean;
        ia_config: import("@prisma/client/runtime/client").JsonValue;
    }>;
    list(req: any): Promise<{
        id: string;
        organization_id: string;
        name: string;
        created_at: Date;
        updated_at: Date;
        description: string | null;
        active: boolean;
        ia_config: import("@prisma/client/runtime/client").JsonValue;
    }[]>;
    findOne(req: any, id: string): Promise<{
        id: string;
        organization_id: string;
        name: string;
        created_at: Date;
        updated_at: Date;
        description: string | null;
        active: boolean;
        ia_config: import("@prisma/client/runtime/client").JsonValue;
    }>;
    update(req: any, id: string, dto: UpdateAgenteDto): Promise<{
        id: string;
        organization_id: string;
        name: string;
        created_at: Date;
        updated_at: Date;
        description: string | null;
        active: boolean;
        ia_config: import("@prisma/client/runtime/client").JsonValue;
    }>;
    remove(req: any, id: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
