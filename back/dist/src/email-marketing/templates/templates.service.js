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
exports.EmailTemplatesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let EmailTemplatesService = class EmailTemplatesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    templateSelect = {
        id: true,
        project_id: true,
        name: true,
        subject: true,
        body_html: true,
        body_text: true,
    };
    encodeWebhookUrls(html) {
        if (!html)
            return html;
        const regex = /(href=['"]\{\{base_webhook_cta_click\}\}\?redirectUrl=)([^'"]+)(['"])/g;
        return html.replace(regex, (match, prefix, urlOriginal, suffix) => {
            let encodedUrl = urlOriginal;
            try {
                const decoded = decodeURIComponent(urlOriginal);
                encodedUrl = encodeURIComponent(decoded);
            }
            catch (e) {
                encodedUrl = encodeURIComponent(urlOriginal);
            }
            return `${prefix}${encodedUrl}${suffix}`;
        });
    }
    async create(organizationId, projectId, dto) {
        const project = await this.prisma.email_projects.findFirst({
            where: { id: projectId, organization_id: organizationId },
            select: { id: true },
        });
        if (!project)
            throw new common_1.NotFoundException('Project not found');
        const hasHtml = !!dto.body_html?.trim();
        const hasText = !!dto.body_text?.trim();
        if (!hasHtml && !hasText) {
            throw new common_1.BadRequestException('body_html or body_text is required');
        }
        const processedHtml = hasHtml
            ? this.encodeWebhookUrls(dto.body_html.trim())
            : '';
        return this.prisma.email_templates.create({
            data: {
                project_id: projectId,
                name: dto.name.trim(),
                subject: dto.subject.trim(),
                body_html: processedHtml,
                body_text: hasText ? dto.body_text.trim() : '',
            },
            select: this.templateSelect,
        });
    }
    async list(organizationId, projectId) {
        const project = await this.prisma.email_projects.findFirst({
            where: { id: projectId, organization_id: organizationId },
            select: { id: true },
        });
        if (!project)
            throw new common_1.NotFoundException('Project not found');
        return this.prisma.email_templates.findMany({
            where: { project_id: projectId },
            orderBy: { name: 'asc' },
            select: this.templateSelect,
        });
    }
    async update(organizationId, id, dto) {
        const template = await this.prisma.email_templates.findFirst({
            where: { id, projects: { organization_id: organizationId } },
            select: {
                id: true,
                body_html: true,
                body_text: true,
            },
        });
        if (!template)
            throw new common_1.NotFoundException('Template not found');
        const nextHtml = dto.body_html !== undefined
            ? dto.body_html?.trim()
                ? this.encodeWebhookUrls(dto.body_html.trim())
                : ''
            : undefined;
        const nextText = dto.body_text !== undefined
            ? dto.body_text?.trim()
                ? dto.body_text.trim()
                : ''
            : undefined;
        const finalHtml = nextHtml !== undefined ? nextHtml : (template.body_html ?? '');
        const finalText = nextText !== undefined ? nextText : (template.body_text ?? '');
        const hasFinalHtml = !!finalHtml.trim();
        const hasFinalText = !!finalText.trim();
        if (!hasFinalHtml && !hasFinalText) {
            throw new common_1.BadRequestException('body_html or body_text is required');
        }
        return this.prisma.email_templates.update({
            where: { id },
            data: {
                ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
                ...(dto.subject !== undefined ? { subject: dto.subject.trim() } : {}),
                ...(nextHtml !== undefined ? { body_html: nextHtml } : {}),
                ...(nextText !== undefined ? { body_text: nextText } : {}),
            },
            select: this.templateSelect,
        });
    }
    async remove(organizationId, id) {
        const template = await this.prisma.email_templates.findFirst({
            where: { id, projects: { organization_id: organizationId } },
            select: { id: true },
        });
        if (!template)
            throw new common_1.NotFoundException('Template not found');
        await this.prisma.email_templates.delete({ where: { id } });
        return { message: 'Template removed' };
    }
};
exports.EmailTemplatesService = EmailTemplatesService;
exports.EmailTemplatesService = EmailTemplatesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], EmailTemplatesService);
//# sourceMappingURL=templates.service.js.map