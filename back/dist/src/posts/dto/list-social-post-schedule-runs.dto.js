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
exports.ListSocialPostScheduleRunsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const social_schedule_shared_dto_1 = require("./social-schedule-shared.dto");
class ListSocialPostScheduleRunsDto {
    social_network;
    status;
    social_account_id;
    from;
    to;
}
exports.ListSocialPostScheduleRunsDto = ListSocialPostScheduleRunsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Filtrar por rede social',
        enum: social_schedule_shared_dto_1.SOCIAL_NETWORK_VALUES,
        example: 'TIKTOK',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(social_schedule_shared_dto_1.SOCIAL_NETWORK_VALUES),
    __metadata("design:type", String)
], ListSocialPostScheduleRunsDto.prototype, "social_network", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Filtrar por status do disparo',
        enum: social_schedule_shared_dto_1.SOCIAL_SCHEDULE_RUN_STATUS_VALUES,
        example: 'COMPLETED',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(social_schedule_shared_dto_1.SOCIAL_SCHEDULE_RUN_STATUS_VALUES),
    __metadata("design:type", String)
], ListSocialPostScheduleRunsDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Filtrar por conta social específica',
        example: '0f7f6b94-2a0c-11f1-854f-3ab4c9681ff2',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ListSocialPostScheduleRunsDto.prototype, "social_account_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Início do período (ISO) usando run_at',
        example: '2026-03-26T00:00:00.000Z',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], ListSocialPostScheduleRunsDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Fim do período (ISO) usando run_at',
        example: '2026-03-31T23:59:59.000Z',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], ListSocialPostScheduleRunsDto.prototype, "to", void 0);
//# sourceMappingURL=list-social-post-schedule-runs.dto.js.map