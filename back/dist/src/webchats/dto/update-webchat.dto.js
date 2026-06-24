"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateWebchatDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_webchat_dto_1 = require("./create-webchat.dto");
class UpdateWebchatDto extends (0, mapped_types_1.PartialType)(create_webchat_dto_1.CreateWebchatDto) {
}
exports.UpdateWebchatDto = UpdateWebchatDto;
//# sourceMappingURL=update-webchat.dto.js.map