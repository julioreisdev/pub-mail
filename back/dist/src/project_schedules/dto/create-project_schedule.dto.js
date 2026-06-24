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
exports.CreateEmailProjectScheduleDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class CreateEmailProjectScheduleDto {
    daily;
    date;
    time;
    for_x_days;
}
exports.CreateEmailProjectScheduleDto = CreateEmailProjectScheduleDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: true,
        description: 'Se true: dispara diariamente no minuto do dia (time). Se false: dispara conforme date/time (one-off) OU conforme intervalo (for_x_days).',
    }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateEmailProjectScheduleDto.prototype, "daily", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '2026-02-15T10:23:00.000Z',
        description: 'Obrigatório quando daily=false e for_x_days NÃO for informado (one-off). Deve ser null quando for_x_days for informado (intervalo).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.date !== null && o.date !== undefined),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", Object)
], CreateEmailProjectScheduleDto.prototype, "date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        examples: {
            hourOnly: {
                summary: 'Hora (0..23) — compatibilidade com frontend',
                value: 17,
            },
            minutesOfDay: {
                summary: 'Minuto do dia (0..1439) — formato legado',
                value: 1020,
            },
        },
        minimum: 0,
        maximum: 1439,
        description: 'Horário do agendamento. Aceita **hora (0..23)** (ex: 17 => 17:00) OU **minuto do dia (0..1439)** (ex: 17:00 => 17*60 = 1020). ' +
            'Obrigatório para daily=true e também para interval (for_x_days).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(1439),
    __metadata("design:type", Number)
], CreateEmailProjectScheduleDto.prototype, "time", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 10,
        minimum: 1,
        description: 'Intervalo de dias. Se informado: daily deve ser false e date deve ser null. O agendamento executa e só volta a executar após N dias (controlado por last_run).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateEmailProjectScheduleDto.prototype, "for_x_days", void 0);
//# sourceMappingURL=create-project_schedule.dto.js.map