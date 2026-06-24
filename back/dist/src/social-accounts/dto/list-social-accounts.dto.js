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
exports.ListSocialAccountsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const social_account_shared_dto_1 = require("./social-account-shared.dto");
class ListSocialAccountsDto {
    social_network;
}
exports.ListSocialAccountsDto = ListSocialAccountsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Filtrar por rede social',
        enum: social_account_shared_dto_1.SOCIAL_NETWORK_VALUES,
        example: 'TIKTOK',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(social_account_shared_dto_1.SOCIAL_NETWORK_VALUES),
    __metadata("design:type", String)
], ListSocialAccountsDto.prototype, "social_network", void 0);
//# sourceMappingURL=list-social-accounts.dto.js.map