"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateAgenteDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_agente_dto_1 = require("./create-agente.dto");
class UpdateAgenteDto extends (0, mapped_types_1.PartialType)(create_agente_dto_1.CreateAgenteDto) {
}
exports.UpdateAgenteDto = UpdateAgenteDto;
//# sourceMappingURL=update-agente.dto.js.map