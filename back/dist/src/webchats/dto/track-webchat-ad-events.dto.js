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
exports.TrackWebchatAdEventsDto = exports.TrackWebchatAdEventDto = void 0;
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const AD_EVENT_NAMES = [
    'requested',
    'rendered',
    'empty',
    'viewable',
    'clicked',
    'closed',
    'error',
];
const AD_POSITIONS = [
    'topo',
    'rodape',
    'intersticial',
    'entre-mensagens',
];
class TrackWebchatAdEventDto {
    event_name;
    ad_position;
    ad_key;
    payload;
}
exports.TrackWebchatAdEventDto = TrackWebchatAdEventDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: AD_EVENT_NAMES }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(AD_EVENT_NAMES),
    __metadata("design:type", Object)
], TrackWebchatAdEventDto.prototype, "event_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: AD_POSITIONS }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(AD_POSITIONS),
    __metadata("design:type", Object)
], TrackWebchatAdEventDto.prototype, "ad_position", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], TrackWebchatAdEventDto.prototype, "ad_key", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Object }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], TrackWebchatAdEventDto.prototype, "payload", void 0);
class TrackWebchatAdEventsDto {
    session_id;
    domain;
    events;
}
exports.TrackWebchatAdEventsDto = TrackWebchatAdEventsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], TrackWebchatAdEventsDto.prototype, "session_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], TrackWebchatAdEventsDto.prototype, "domain", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => [TrackWebchatAdEventDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TrackWebchatAdEventDto),
    __metadata("design:type", Array)
], TrackWebchatAdEventsDto.prototype, "events", void 0);
//# sourceMappingURL=track-webchat-ad-events.dto.js.map