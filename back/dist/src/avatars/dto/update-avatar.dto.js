"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateAvatarDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_avatar_dto_1 = require("./create-avatar.dto");
class UpdateAvatarDto extends (0, swagger_1.PartialType)(create_avatar_dto_1.CreateAvatarDto) {
}
exports.UpdateAvatarDto = UpdateAvatarDto;
//# sourceMappingURL=update-avatar.dto.js.map