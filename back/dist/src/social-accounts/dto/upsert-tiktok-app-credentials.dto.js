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
exports.UpsertTikTokAppCredentialsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class UpsertTikTokAppCredentialsDto {
    client_key;
    client_secret;
}
exports.UpsertTikTokAppCredentialsDto = UpsertTikTokAppCredentialsDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Client Key do app TikTok da organização',
        example: '<SECRET>',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], UpsertTikTokAppCredentialsDto.prototype, "client_key", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Client Secret do app TikTok da organização (armazenado criptografado)',
        example: '<SECRET>',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], UpsertTikTokAppCredentialsDto.prototype, "client_secret", void 0);
//# sourceMappingURL=upsert-tiktok-app-credentials.dto.js.map