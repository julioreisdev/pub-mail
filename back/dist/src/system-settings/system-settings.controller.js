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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemSettingsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const update_system_settings_dto_1 = require("./dto/update-system-settings.dto");
const system_settings_service_1 = require("./system-settings.service");
let SystemSettingsController = class SystemSettingsController {
    service;
    constructor(service) {
        this.service = service;
    }
    async read() {
        const row = await this.service.get();
        return this.toResponse(row);
    }
    async update(dto) {
        const row = await this.service.update(dto);
        return this.toResponse(row);
    }
    async aiKeysStatus() {
        return this.service.getAiKeysStatus();
    }
    toResponse(row) {
        const groq = this.service.parseKeys(row.groq_api_keys);
        const cerebras = this.service.parseKeys(row.cerebras_api_keys);
        const gemini = this.service.parseKeys(row.gemini_api_keys);
        const mistral = this.service.parseKeys(row.mistral_api_keys);
        const openrouter = this.service.parseKeys(row.openrouter_api_keys);
        const sambanova = this.service.parseKeys(row.sambanova_api_keys);
        return {
            groq_api_keys: row.groq_api_keys || '',
            groq_api_keys_count: groq.length,
            cerebras_api_keys: row.cerebras_api_keys || '',
            cerebras_api_keys_count: cerebras.length,
            gemini_api_keys: row.gemini_api_keys || '',
            gemini_api_keys_count: gemini.length,
            mistral_api_keys: row.mistral_api_keys || '',
            mistral_api_keys_count: mistral.length,
            openrouter_api_keys: row.openrouter_api_keys || '',
            openrouter_api_keys_count: openrouter.length,
            sambanova_api_keys: row.sambanova_api_keys || '',
            sambanova_api_keys_count: sambanova.length,
            resend_api_key: row.resend_api_key || '',
            webchat_edge_ip: row.webchat_edge_ip || '',
            certbot_email: row.certbot_email || '',
            updated_at: row.updated_at,
        };
    }
};
exports.SystemSettingsController = SystemSettingsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Lê as configurações do sistema (singleton).',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'Configurações lidas com sucesso.' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido.' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SystemSettingsController.prototype, "read", null);
__decorate([
    (0, common_1.Patch)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Atualiza configurações do sistema. Campos omitidos não mudam; campos com string vazia são limpos.',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'Configurações atualizadas.' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_system_settings_dto_1.UpdateSystemSettingsDto]),
    __metadata("design:returntype", Promise)
], SystemSettingsController.prototype, "update", null);
__decorate([
    (0, common_1.Get)('ai-keys-status'),
    (0, swagger_1.ApiOperation)({
        summary: 'Status runtime das chaves de IA (cooldown, uso diário, último erro etc).',
    }),
    (0, swagger_1.ApiOkResponse)({ description: 'Status das chaves consultado com sucesso.' }),
    (0, swagger_1.ApiUnauthorizedResponse)({ description: 'Sem token ou token inválido.' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SystemSettingsController.prototype, "aiKeysStatus", null);
exports.SystemSettingsController = SystemSettingsController = __decorate([
    (0, swagger_1.ApiTags)('System Settings'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('system-settings'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [system_settings_service_1.SystemSettingsService])
], SystemSettingsController);
//# sourceMappingURL=system-settings.controller.js.map