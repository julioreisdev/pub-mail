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
exports.UpdateSocialAccountDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const social_account_shared_dto_1 = require("./social-account-shared.dto");
class UpdateSocialAccountDto {
    username;
    display_name;
    profile_image_url;
    status;
    is_default;
    token_expires_at;
    scope;
    extra;
    access_token;
    refresh_token;
}
exports.UpdateSocialAccountDto = UpdateSocialAccountDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Username da conta (ex: @minha_marca)',
        example: 'minha_marca',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], UpdateSocialAccountDto.prototype, "username", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Nome de exibição da conta',
        example: 'Minha Marca Oficial',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], UpdateSocialAccountDto.prototype, "display_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'URL da imagem de perfil da conta',
        example: 'https://example.com/avatar.jpg',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], UpdateSocialAccountDto.prototype, "profile_image_url", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Status atual da conexão',
        enum: social_account_shared_dto_1.SOCIAL_ACCOUNT_STATUS_VALUES,
        example: 'DISCONNECTED',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(social_account_shared_dto_1.SOCIAL_ACCOUNT_STATUS_VALUES),
    __metadata("design:type", String)
], UpdateSocialAccountDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Define como conta padrão para a rede social',
        example: true,
    }),
    (0, class_transformer_1.Type)(() => Boolean),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateSocialAccountDto.prototype, "is_default", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Data/hora de expiração do token (ISO)',
        example: '2026-03-30T20:00:00.000Z',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], UpdateSocialAccountDto.prototype, "token_expires_at", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Escopos aprovados pela conta',
        type: [String],
        example: ['user.info.basic', 'video.publish'],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateSocialAccountDto.prototype, "scope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Metadados livres da integração',
        example: { oauth_state: 'READY' },
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateSocialAccountDto.prototype, "extra", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Token de acesso (será armazenado criptografado e nunca retornado)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateSocialAccountDto.prototype, "access_token", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Token de renovação (será armazenado criptografado e nunca retornado)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateSocialAccountDto.prototype, "refresh_token", void 0);
//# sourceMappingURL=update-social-account.dto.js.map