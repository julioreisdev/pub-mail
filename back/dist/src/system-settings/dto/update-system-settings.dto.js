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
exports.UpdateSystemSettingsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class UpdateSystemSettingsDto {
    groq_api_keys;
    cerebras_api_keys;
    gemini_api_keys;
    mistral_api_keys;
    openrouter_api_keys;
    sambanova_api_keys;
    resend_api_key;
    webchat_edge_ip;
    certbot_email;
}
exports.UpdateSystemSettingsDto = UpdateSystemSettingsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Chaves da Groq separadas por vírgula ou quebra de linha. String vazia limpa o campo.',
        example: 'gsk_xxx1,gsk_xxx2',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateSystemSettingsDto.prototype, "groq_api_keys", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Chaves da Cerebras (CSV ou linhas). Modelo: llama-3.3-70b.',
        example: 'csk-xxx1,csk-xxx2',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateSystemSettingsDto.prototype, "cerebras_api_keys", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Chaves do Google Gemini (AI Studio). Modelo: gemini-2.0-flash.',
        example: 'AIzaSy...',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateSystemSettingsDto.prototype, "gemini_api_keys", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Chaves da Mistral La Plateforme. Modelo: mistral-small-latest.',
        example: 'mst_xxx1,mst_xxx2',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateSystemSettingsDto.prototype, "mistral_api_keys", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Chaves do OpenRouter. Roteia para Llama 3.3 70B (free).',
        example: 'sk-or-v1-xxx',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateSystemSettingsDto.prototype, "openrouter_api_keys", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Chaves do SambaNova Cloud. Modelo: Llama-3.3-70B-Instruct.',
        example: 'sn_xxx1,sn_xxx2',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateSystemSettingsDto.prototype, "sambanova_api_keys", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Chave de API do Resend. String vazia limpa o campo.',
        example: 're_AbCdEf123...',
        maxLength: 500,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], UpdateSystemSettingsDto.prototype, "resend_api_key", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'IPv4 público do edge para o qual os domínios de webchat devem apontar (registro A). String vazia limpa o campo.',
        example: '203.0.113.10',
        maxLength: 45,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(45),
    __metadata("design:type", String)
], UpdateSystemSettingsDto.prototype, "webchat_edge_ip", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'E-mail registrado junto ao Let’s Encrypt (certbot). String vazia limpa o campo.',
        example: 'admin@suaempresa.com',
        maxLength: 255,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], UpdateSystemSettingsDto.prototype, "certbot_email", void 0);
//# sourceMappingURL=update-system-settings.dto.js.map