"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectSchedulesSentModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../prisma/prisma.module");
const project_schedules_sent_controller_1 = require("./project-schedules-sent.controller");
const project_schedules_sent_service_1 = require("./project-schedules-sent.service");
let ProjectSchedulesSentModule = class ProjectSchedulesSentModule {
};
exports.ProjectSchedulesSentModule = ProjectSchedulesSentModule;
exports.ProjectSchedulesSentModule = ProjectSchedulesSentModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [project_schedules_sent_controller_1.ProjectSchedulesSentController],
        providers: [project_schedules_sent_service_1.ProjectSchedulesSentService],
    })
], ProjectSchedulesSentModule);
//# sourceMappingURL=project-schedules-sent.module.js.map