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
exports.UpdateAdsTxtDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class UpdateAdsTxtDto {
    ads_txt;
}
exports.UpdateAdsTxtDto = UpdateAdsTxtDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Conteúdo do ads.txt (texto puro, formato IAB). Vazio limpa.',
        example: 'sendwebpush.com, 69af34985522c, DIRECT\ngoogle.com, pub-9597097359230576, RESELLER, f08c47fec0942fa0',
        required: false,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(65536),
    __metadata("design:type", String)
], UpdateAdsTxtDto.prototype, "ads_txt", void 0);
//# sourceMappingURL=update-ads-txt.dto.js.map