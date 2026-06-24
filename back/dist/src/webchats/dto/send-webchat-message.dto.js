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
exports.SendWebchatMessageDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class SendWebchatMessageDto {
    message;
    session_id;
    lead_state;
    context;
    conversation_history;
}
exports.SendWebchatMessageDto = SendWebchatMessageDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Quero entender como funciona o plano premium.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SendWebchatMessageDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'session-abc-123' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], SendWebchatMessageDto.prototype, "session_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'object',
        additionalProperties: true,
        description: 'Estado dinâmico de captura de lead no front',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SendWebchatMessageDto.prototype, "lead_state", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'object',
        additionalProperties: true,
        description: 'Contexto da mensagem pública (URL, user-agent, etc.)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SendWebchatMessageDto.prototype, "context", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'array',
        description: 'Histórico recente da conversa para manter contexto no micro-serviço de IA',
        example: [
            { role: 'assistant', content: 'Olá! Seja bem-vindo(a).' },
            { role: 'user', content: 'Oi' },
        ],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], SendWebchatMessageDto.prototype, "conversation_history", void 0);
//# sourceMappingURL=send-webchat-message.dto.js.map