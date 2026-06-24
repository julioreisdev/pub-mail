import { OrganiztionsService } from './organiztions.service';
import { UpdateOrganiztionDto } from './dto/update-organiztion.dto';
export declare class OrganiztionsController {
    private readonly organiztionsService;
    constructor(organiztionsService: OrganiztionsService);
    me(req: any): Promise<{
        id: string;
        name: string;
        document_id: string | null;
        status: boolean;
        stripe_customer_id: string | null;
        created_at: Date;
        updated_at: Date;
    }>;
    updateMe(req: any, dto: UpdateOrganiztionDto): Promise<{
        id: string;
        name: string;
        document_id: string | null;
        status: boolean;
        stripe_customer_id: string | null;
        created_at: Date;
        updated_at: Date;
    }>;
    removeMe(req: any): Promise<{
        id: string;
        name: string;
        document_id: string | null;
        status: boolean;
        stripe_customer_id: string | null;
        created_at: Date;
        updated_at: Date;
    }>;
}
