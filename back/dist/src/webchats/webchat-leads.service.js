"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebchatLeadsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;
const EXPORT_HARD_CAP = 50000;
let WebchatLeadsService = class WebchatLeadsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    buildWhere(params) {
        const where = {
            organization_id: params.organizationId,
        };
        if (params.webchatId)
            where.webchat_id = params.webchatId;
        const search = String(params.search || '').trim();
        if (search) {
            where.OR = [
                { email: { contains: search } },
                { name: { contains: search } },
                { phone: { contains: search } },
            ];
        }
        return where;
    }
    toRow(record) {
        const webchat = record?.webchats || {};
        return {
            id: record.id,
            webchat_id: record.webchat_id,
            webchat_name: webchat.name || '',
            webchat_slug: webchat.slug || '',
            webchat_domain: webchat.domain || '',
            email: record.email,
            name: record.name,
            phone: record.phone,
            source: record.source,
            session_id: record.session_id,
            context: record.context ?? null,
            custom_fields: record.custom_fields ?? null,
            created_at: record.created_at,
            updated_at: record.updated_at,
        };
    }
    async list(params) {
        const page = Math.max(1, Math.floor(Number(params.page) || 1));
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(params.pageSize) || DEFAULT_PAGE_SIZE)));
        const where = this.buildWhere(params);
        const [total, rows] = await Promise.all([
            this.prisma.webchat_leads.count({ where }),
            this.prisma.webchat_leads.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    webchats: {
                        select: { id: true, name: true, slug: true, domain: true },
                    },
                },
            }),
        ]);
        return {
            items: rows.map((r) => this.toRow(r)),
            total,
            page,
            page_size: pageSize,
            total_pages: pageSize > 0 ? Math.ceil(total / pageSize) : 1,
        };
    }
    async listAllForExport(params) {
        const where = this.buildWhere(params);
        const total = await this.prisma.webchat_leads.count({ where });
        if (total > EXPORT_HARD_CAP) {
            throw new common_1.BadRequestException(`Exportação excede o limite de ${EXPORT_HARD_CAP.toLocaleString('pt-BR')} leads. Refine o filtro (ex.: filtre por webchat).`);
        }
        const rows = await this.prisma.webchat_leads.findMany({
            where,
            orderBy: { created_at: 'desc' },
            include: {
                webchats: {
                    select: { id: true, name: true, slug: true, domain: true },
                },
            },
        });
        return {
            items: rows.map((r) => this.toRow(r)),
            total: rows.length,
        };
    }
};
exports.WebchatLeadsService = WebchatLeadsService;
exports.WebchatLeadsService = WebchatLeadsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WebchatLeadsService);
//# sourceMappingURL=webchat-leads.service.js.map