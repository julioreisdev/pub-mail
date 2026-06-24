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
exports.UpdateScheduleSentDto = exports.ScheduleSentStatus = void 0;
const class_validator_1 = require("class-validator");
var ScheduleSentStatus;
(function (ScheduleSentStatus) {
    ScheduleSentStatus["PROCESSING"] = "PROCESSING";
    ScheduleSentStatus["COMPLETED"] = "COMPLETED";
    ScheduleSentStatus["PARTIAL"] = "PARTIAL";
    ScheduleSentStatus["FAILED"] = "FAILED";
})(ScheduleSentStatus || (exports.ScheduleSentStatus = ScheduleSentStatus = {}));
class UpdateScheduleSentDto {
    status;
    sent_for_leads;
    error_message;
}
exports.UpdateScheduleSentDto = UpdateScheduleSentDto;
__decorate([
    (0, class_validator_1.IsEnum)(ScheduleSentStatus),
    __metadata("design:type", String)
], UpdateScheduleSentDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateScheduleSentDto.prototype, "sent_for_leads", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateScheduleSentDto.prototype, "error_message", void 0);
//# sourceMappingURL=update-schedule-sent.dto.js.map