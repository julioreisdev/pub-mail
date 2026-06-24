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
exports.UpdateEmailTemplateDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class UpdateEmailTemplateDto {
    name;
    subject;
    body_html;
    body_text;
}
exports.UpdateEmailTemplateDto = UpdateEmailTemplateDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'Promoção (Versão 2)',
        maxLength: 255,
        description: 'Nome interno do template (opcional)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], UpdateEmailTemplateDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '🔥 Promoção liberada por tempo limitado!',
        maxLength: 255,
        description: 'Assunto do e-mail (opcional)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], UpdateEmailTemplateDto.prototype, "subject", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '<h1>Olá {{name}}</h1><p>Confira a promoção...</p>',
        description: 'HTML do e-mail (opcional)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateEmailTemplateDto.prototype, "body_html", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'Olá {{name}}, confira a promoção...',
        description: 'Versão texto do e-mail (opcional)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateEmailTemplateDto.prototype, "body_text", void 0);
//# sourceMappingURL=update-email-template.dto.js.map