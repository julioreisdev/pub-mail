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
exports.GenerateAvatarDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class GenerateAvatarDto {
    prompt;
    colors;
    personality;
    userReferenceImage;
    lastGeneratedImage;
    is_realistic;
}
exports.GenerateAvatarDto = GenerateAvatarDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Um guerreiro cibernético com armadura neon' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], GenerateAvatarDto.prototype, "prompt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: ['neon pink', 'electric blue'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], GenerateAvatarDto.prototype, "colors", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'corajoso e misterioso' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateAvatarDto.prototype, "personality", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'URL da foto original do usuário' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], GenerateAvatarDto.prototype, "userReferenceImage", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'URL da última imagem gerada (para modo edição)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], GenerateAvatarDto.prototype, "lastGeneratedImage", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: true,
        description: 'Define se o estilo é realista',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GenerateAvatarDto.prototype, "is_realistic", void 0);
//# sourceMappingURL=generate-avatar.dto.js.map