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
exports.CreateBillingDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateBillingDto {
    holder_name;
    provider_token;
    is_default;
}
exports.CreateBillingDto = CreateBillingDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'João da Silva',
        description: 'Nome do titular do cartão',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBillingDto.prototype, "holder_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'pm_1Pxxxxxxx',
        description: 'Token do provedor (ex: Stripe PaymentMethod token)',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBillingDto.prototype, "provider_token", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: true,
        description: 'Define este cartão como padrão (se omitido, segue regra do serviço)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateBillingDto.prototype, "is_default", void 0);
//# sourceMappingURL=create-billing-cards.dto.js.map