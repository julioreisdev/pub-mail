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
exports.UpdateBillingDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class UpdateBillingDto {
    holder_name;
    last_four_digits;
    brand;
    is_default;
}
exports.UpdateBillingDto = UpdateBillingDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'Maria da Silva',
        description: 'Atualiza o nome do titular do cartão',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateBillingDto.prototype, "holder_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '4242',
        description: 'Últimos 4 dígitos do cartão (opcional)',
        minLength: 4,
        maxLength: 4,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(4, 4),
    __metadata("design:type", String)
], UpdateBillingDto.prototype, "last_four_digits", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'VISA',
        description: 'Bandeira do cartão (opcional)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateBillingDto.prototype, "brand", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: false,
        description: 'Marca este cartão como padrão',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateBillingDto.prototype, "is_default", void 0);
//# sourceMappingURL=update-billing-cards.dto.js.map