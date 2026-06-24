"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateProfileDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const mapped_types_1 = require("@nestjs/mapped-types");
const create_profile_dto_1 = require("./create-profile.dto");
let UpdateProfileDto = class UpdateProfileDto extends (0, mapped_types_1.PartialType)(create_profile_dto_1.CreateProfileDto) {
};
exports.UpdateProfileDto = UpdateProfileDto;
exports.UpdateProfileDto = UpdateProfileDto = __decorate([
    (0, swagger_1.ApiExtraModels)(create_profile_dto_1.CreateProfileDto)
], UpdateProfileDto);
//# sourceMappingURL=update-profile.dto.js.map