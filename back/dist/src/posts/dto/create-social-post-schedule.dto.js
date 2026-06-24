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
exports.CreateSocialPostScheduleDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const social_schedule_shared_dto_1 = require("./social-schedule-shared.dto");
class CreateSocialPostScheduleDto {
    social_account_id;
    post_id;
    social_network;
    ai_content;
    scheduled_at;
    platform_payload;
}
exports.CreateSocialPostScheduleDto = CreateSocialPostScheduleDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID da conta social conectada que será usada no disparo do agendamento',
        example: 'd8fe859c-58d8-4a4d-b4be-7fe8d915fa7c',
        format: 'uuid',
    }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateSocialPostScheduleDto.prototype, "social_account_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID do post salvo na Galeria',
        example: '0f87c84f-c56d-42f8-8a8e-1f9466fe71cb',
        format: 'uuid',
    }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateSocialPostScheduleDto.prototype, "post_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Rede social alvo do agendamento',
        enum: social_schedule_shared_dto_1.SOCIAL_NETWORK_VALUES,
        example: 'TIKTOK',
    }),
    (0, class_validator_1.IsIn)(social_schedule_shared_dto_1.SOCIAL_NETWORK_VALUES),
    __metadata("design:type", String)
], CreateSocialPostScheduleDto.prototype, "social_network", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Indica se o conteúdo foi gerado/alterado por IA',
        example: true,
    }),
    (0, class_transformer_1.Type)(() => Boolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateSocialPostScheduleDto.prototype, "ai_content", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data/hora do agendamento em ISO (deve ser sempre horário cheio: mm=00, ss=00)',
        example: '2026-03-30T20:00:00.000Z',
    }),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], CreateSocialPostScheduleDto.prototype, "scheduled_at", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Payload específico da rede social (ex.: privacidade, legenda, título, etc.)',
        example: {
            privacy_level: 'PUBLIC_TO_EVERYONE',
            caption: 'Meu post agendado #tiktok',
            allow_comment: true,
            allow_duet: false,
            allow_stitch: false,
            commercial_content_enabled: true,
            brand_organic_toggle: true,
            brand_content_toggle: false,
        },
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateSocialPostScheduleDto.prototype, "platform_payload", void 0);
//# sourceMappingURL=create-social-post-schedule.dto.js.map