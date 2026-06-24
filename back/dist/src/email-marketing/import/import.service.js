"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailImportService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const XLSX = __importStar(require("xlsx"));
const stream_1 = require("stream");
const csvParser = require('csv-parser');
let EmailImportService = class EmailImportService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async importLeads(organizationId, projectId, file) {
        const project = await this.prisma.email_projects.findFirst({
            where: { id: projectId, organization_id: organizationId },
            select: { id: true },
        });
        if (!project)
            throw new common_1.NotFoundException('Project not found');
        const rows = await this.parseFile(file);
        if (!rows.length) {
            return {
                totalRows: 0,
                processed: 0,
                created: 0,
                updated: 0,
                linked: 0,
                skippedAlreadyLinked: 0,
                skippedUnsubscribed: 0,
                invalidRows: 0,
            };
        }
        const normalized = rows.map((r) => this.normalizeRow(r));
        let created = 0, updated = 0, linked = 0;
        let skippedAlreadyLinked = 0, skippedUnsubscribed = 0, invalidRows = 0;
        const chunkSize = 300;
        for (let i = 0; i < normalized.length; i += chunkSize) {
            const chunk = normalized.slice(i, i + chunkSize);
            await this.prisma.$transaction(async (tx) => {
                for (const r of chunk) {
                    if (!r.email) {
                        invalidRows++;
                        continue;
                    }
                    const email = r.email;
                    const name = r.name ?? null;
                    const incomingAttrs = r.attributes ?? null;
                    const existing = await tx.email_leads.findFirst({
                        where: { organization_id: organizationId, email },
                        select: { id: true, name: true, attributes: true },
                    });
                    let leadId;
                    if (!existing) {
                        const lead = await tx.email_leads.create({
                            data: {
                                organization_id: organizationId,
                                email,
                                name,
                                attributes: incomingAttrs,
                                global_status: 'ACTIVE',
                            },
                            select: { id: true },
                        });
                        leadId = lead.id;
                        created++;
                    }
                    else {
                        const merged = this.mergeJson(existing.attributes, incomingAttrs);
                        await tx.email_leads.update({
                            where: { id: existing.id },
                            data: {
                                name: name ?? existing.name,
                                attributes: merged,
                            },
                        });
                        leadId = existing.id;
                        updated++;
                    }
                    const pivot = await tx.email_project_leads.findUnique({
                        where: {
                            project_id_lead_id: { project_id: projectId, lead_id: leadId },
                        },
                        select: { status: true },
                    });
                    if (!pivot) {
                        await tx.email_project_leads.create({
                            data: {
                                project_id: projectId,
                                lead_id: leadId,
                                status: 'SUBSCRIBED',
                            },
                        });
                        linked++;
                    }
                    else if (pivot.status === 'UNSUBSCRIBED') {
                        skippedUnsubscribed++;
                    }
                    else {
                        skippedAlreadyLinked++;
                    }
                }
            });
        }
        return {
            totalRows: normalized.length,
            processed: normalized.length - invalidRows,
            created,
            updated,
            linked,
            skippedAlreadyLinked,
            skippedUnsubscribed,
            invalidRows,
        };
    }
    async exportAllLeads(organizationId) {
        const leads = await this.prisma.email_leads.findMany({
            where: { organization_id: organizationId },
            select: { name: true, email: true, attributes: true },
        });
        const formattedData = leads.map((lead) => this.formatLeadForExport(lead));
        return this.generateXlsxBuffer(formattedData);
    }
    async exportProjectLeads(organizationId, projectId) {
        const project = await this.prisma.email_projects.findFirst({
            where: { id: projectId, organization_id: organizationId },
            select: { id: true },
        });
        if (!project)
            throw new common_1.NotFoundException('Project not found');
        const pivotData = await this.prisma.email_project_leads.findMany({
            where: { project_id: projectId },
            select: {
                leads: { select: { name: true, email: true, attributes: true } },
            },
        });
        const formattedData = pivotData.map((pivot) => this.formatLeadForExport(pivot.leads));
        return this.generateXlsxBuffer(formattedData);
    }
    async shareLeads(organizationId, fromProjectId, toProjectId) {
        const projects = await this.prisma.email_projects.findMany({
            where: {
                id: { in: [fromProjectId, toProjectId] },
                organization_id: organizationId,
            },
            select: { id: true },
        });
        if (projects.length !== 2) {
            throw new common_1.NotFoundException('One or both projects not found within this organization');
        }
        const sourceLeads = await this.prisma.email_project_leads.findMany({
            where: { project_id: fromProjectId },
            select: { lead_id: true },
        });
        if (!sourceLeads.length) {
            return { shared: 0, message: 'No leads found in the source project' };
        }
        const destLeads = await this.prisma.email_project_leads.findMany({
            where: { project_id: toProjectId },
            select: { lead_id: true },
        });
        const destLeadIds = new Set(destLeads.map((l) => l.lead_id));
        const leadsToInsert = sourceLeads
            .filter((l) => !destLeadIds.has(l.lead_id))
            .map((l) => ({
            project_id: toProjectId,
            lead_id: l.lead_id,
            status: 'SUBSCRIBED',
        }));
        if (!leadsToInsert.length) {
            return {
                shared: 0,
                message: 'All leads from the source project are already in the destination project',
            };
        }
        await this.prisma.email_project_leads.createMany({
            data: leadsToInsert,
            skipDuplicates: true,
        });
        return {
            shared: leadsToInsert.length,
            message: `Successfully shared ${leadsToInsert.length} leads to the new project.`,
        };
    }
    normalizeRow(row) {
        const rawEmail = row.email ??
            row.Email ??
            row.EMAIL ??
            row['e-mail'] ??
            row['E-mail'] ??
            row['E-mail Address'];
        const email = (rawEmail ?? '').toString().trim().toLowerCase();
        const rawName = row.name ?? row.Name ?? row.NOME ?? row.nome;
        const name = (rawName ?? '').toString().trim() || undefined;
        const attributes = {};
        for (const [k, v] of Object.entries(row)) {
            const key = k.toString().trim().toLowerCase();
            if (key === 'email' || key === 'e-mail')
                continue;
            if (key === 'name' || key === 'nome')
                continue;
            if (v === undefined || v === null)
                continue;
            const s = String(v).trim();
            if (!s)
                continue;
            attributes[k] = v;
        }
        const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        return {
            email: looksLikeEmail ? email : undefined,
            name,
            attributes: Object.keys(attributes).length ? attributes : null,
        };
    }
    mergeJson(oldJson, newJson) {
        if (!oldJson && !newJson)
            return null;
        if (!oldJson)
            return newJson;
        if (!newJson)
            return oldJson;
        if (typeof oldJson !== 'object' || typeof newJson !== 'object')
            return newJson;
        return { ...oldJson, ...newJson };
    }
    async parseFile(file) {
        const filename = (file.originalname || '').toLowerCase();
        if (filename.endsWith('.xlsx')) {
            const wb = XLSX.read(file.buffer, { type: 'buffer' });
            const sheetName = wb.SheetNames[0];
            if (!sheetName)
                return [];
            const sheet = wb.Sheets[sheetName];
            return XLSX.utils.sheet_to_json(sheet, { defval: '' });
        }
        if (filename.endsWith('.csv')) {
            return await new Promise((resolve, reject) => {
                const results = [];
                stream_1.Readable.from(file.buffer)
                    .pipe(csvParser())
                    .on('data', (data) => results.push(data))
                    .on('end', () => resolve(results))
                    .on('error', (err) => reject(err));
            });
        }
        throw new common_1.BadRequestException('Only .csv or .xlsx files are supported');
    }
    formatLeadForExport(lead) {
        return {
            name: lead.name || '',
            email: lead.email,
            attributes: lead.attributes ? JSON.stringify(lead.attributes) : '',
        };
    }
    generateXlsxBuffer(data) {
        const sheetData = data.length > 0 ? data : [{ name: '', email: '', attributes: '' }];
        const ws = XLSX.utils.json_to_sheet(sheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Leads');
        return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }
};
exports.EmailImportService = EmailImportService;
exports.EmailImportService = EmailImportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], EmailImportService);
//# sourceMappingURL=import.service.js.map