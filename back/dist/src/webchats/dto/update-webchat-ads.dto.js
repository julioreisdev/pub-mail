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
exports.UpdateWebchatAdsDto = void 0;
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class WebchatAdPayloadDto {
    id;
    codigo_tag;
    codigo;
    gpt_slot;
    gpt_div_id;
    gpt_sizes;
    anuncio_fixed;
    html;
    ativo;
}
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], WebchatAdPayloadDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], WebchatAdPayloadDto.prototype, "codigo_tag", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], WebchatAdPayloadDto.prototype, "codigo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], WebchatAdPayloadDto.prototype, "gpt_slot", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], WebchatAdPayloadDto.prototype, "gpt_div_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], WebchatAdPayloadDto.prototype, "gpt_sizes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], WebchatAdPayloadDto.prototype, "anuncio_fixed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], WebchatAdPayloadDto.prototype, "html", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], WebchatAdPayloadDto.prototype, "ativo", void 0);
class WebchatBetweenMessagesPayloadDto extends WebchatAdPayloadDto {
    intervalo_mensagens;
    sequence_ads;
}
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Intervalo (N) para disparo de anúncios entre mensagens.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], WebchatBetweenMessagesPayloadDto.prototype, "intervalo_mensagens", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: () => [WebchatAdPayloadDto] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => WebchatAdPayloadDto),
    __metadata("design:type", Array)
], WebchatBetweenMessagesPayloadDto.prototype, "sequence_ads", void 0);
class UpdateWebchatAdsDto {
    topo;
    rodape;
    intersticial;
    entre_mensagens;
}
exports.UpdateWebchatAdsDto = UpdateWebchatAdsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Configuração de anúncios por posição. Ex.: topo, rodape, intersticial e entre_mensagens',
        type: () => WebchatAdPayloadDto,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => WebchatAdPayloadDto),
    __metadata("design:type", WebchatAdPayloadDto)
], UpdateWebchatAdsDto.prototype, "topo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => WebchatAdPayloadDto,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => WebchatAdPayloadDto),
    __metadata("design:type", WebchatAdPayloadDto)
], UpdateWebchatAdsDto.prototype, "rodape", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => WebchatAdPayloadDto,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => WebchatAdPayloadDto),
    __metadata("design:type", WebchatAdPayloadDto)
], UpdateWebchatAdsDto.prototype, "intersticial", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => WebchatBetweenMessagesPayloadDto,
        description: 'Configuração entre mensagens, com intervalo_mensagens e sequence_ads',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => WebchatBetweenMessagesPayloadDto),
    __metadata("design:type", WebchatBetweenMessagesPayloadDto)
], UpdateWebchatAdsDto.prototype, "entre_mensagens", void 0);
//# sourceMappingURL=update-webchat-ads.dto.js.map