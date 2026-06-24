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
exports.CreatePostDto = exports.PostTypeEnum = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
var PostTypeEnum;
(function (PostTypeEnum) {
    PostTypeEnum["SINGLE_IMAGE"] = "SINGLE_IMAGE";
    PostTypeEnum["SINGLE_VIDEO"] = "SINGLE_VIDEO";
    PostTypeEnum["CAROUSEL"] = "CAROUSEL";
})(PostTypeEnum || (exports.PostTypeEnum = PostTypeEnum = {}));
class CreatePostDto {
    internal_name;
    post_type;
    default_title;
    default_caption;
    tags;
}
exports.CreatePostDto = CreatePostDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Nome interno do post para o painel',
        example: 'Promoção de Inverno',
    }),
    (0, class_validator_1.IsNotEmpty)({ message: 'O nome interno é obrigatório.' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePostDto.prototype, "internal_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        enum: PostTypeEnum,
        description: 'Tipo do post: SINGLE_VIDEO, SINGLE_IMAGE, CAROUSEL',
    }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsEnum)(PostTypeEnum),
    __metadata("design:type", String)
], CreatePostDto.prototype, "post_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Título padrão, obrigatório para YouTube Shorts',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePostDto.prototype, "default_title", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Legenda padrão para Instagram e TikTok',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePostDto.prototype, "default_caption", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Hashtags em formato string JSON',
        example: '["#saas", "#vendas"]',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePostDto.prototype, "tags", void 0);
//# sourceMappingURL=create-post.dto.js.map