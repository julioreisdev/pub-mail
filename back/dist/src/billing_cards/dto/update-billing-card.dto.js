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
exports.UpdateBillingCardDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class UpdateBillingCardDto {
    holder_name;
    last_four_digits;
    brand;
    is_default;
}
exports.UpdateBillingCardDto = UpdateBillingCardDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'Mateus Pereira',
        maxLength: 255,
        description: 'Atualiza o nome do titular do cartão (opcional).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], UpdateBillingCardDto.prototype, "holder_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '4242',
        minLength: 4,
        maxLength: 4,
        description: 'Atualiza os últimos 4 dígitos do cartão (opcional).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(4, 4),
    __metadata("design:type", String)
], UpdateBillingCardDto.prototype, "last_four_digits", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'VISA',
        maxLength: 50,
        description: 'Atualiza a bandeira do cartão (opcional).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], UpdateBillingCardDto.prototype, "brand", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: true,
        description: 'Define/remover como cartão padrão da organização (opcional).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateBillingCardDto.prototype, "is_default", void 0);
//# sourceMappingURL=update-billing-card.dto.js.map