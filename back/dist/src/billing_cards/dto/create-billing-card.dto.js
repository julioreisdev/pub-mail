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
exports.CreateBillingCardDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateBillingCardDto {
    provider_token;
    last_four_digits;
    brand;
    holder_name;
    is_default;
}
exports.CreateBillingCardDto = CreateBillingCardDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'pm_1PabcDEFghIJkLmNoPqRstUv',
        maxLength: 255,
        description: 'Token do provedor (ex: Stripe PaymentMethod). Salvo no banco, não deve ser retornado na API.',
    }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], CreateBillingCardDto.prototype, "provider_token", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '4242',
        minLength: 4,
        maxLength: 4,
        description: 'Últimos 4 dígitos do cartão (opcional).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(4, 4),
    __metadata("design:type", String)
], CreateBillingCardDto.prototype, "last_four_digits", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'VISA',
        maxLength: 50,
        description: 'Bandeira do cartão (opcional). Ex: VISA, MASTERCARD, AMEX.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], CreateBillingCardDto.prototype, "brand", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'Mateus Pereira',
        maxLength: 255,
        description: 'Nome do titular do cartão.',
    }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], CreateBillingCardDto.prototype, "holder_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: true,
        description: 'Define se este cartão será o padrão da organização. Se omitido, o service decide (ex: primeiro cartão vira padrão).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateBillingCardDto.prototype, "is_default", void 0);
//# sourceMappingURL=create-billing-card.dto.js.map