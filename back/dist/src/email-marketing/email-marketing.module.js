"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailMarketingModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../prisma/prisma.module");
const project_controller_1 = require("./project/project.controller");
const project_service_1 = require("./project/project.service");
const templates_controller_1 = require("./templates/templates.controller");
const templates_service_1 = require("./templates/templates.service");
const leads_controller_1 = require("./leads/leads.controller");
const leads_service_1 = require("./leads/leads.service");
const import_controller_1 = require("./import/import.controller");
const import_service_1 = require("./import/import.service");
let EmailMarketingModule = class EmailMarketingModule {
};
exports.EmailMarketingModule = EmailMarketingModule;
exports.EmailMarketingModule = EmailMarketingModule = __decorate([
    (0, common_1.Module)({
        controllers: [project_controller_1.EmailProjectsController, templates_controller_1.EmailTemplatesController, leads_controller_1.EmailLeadsController, import_controller_1.EmailImportController],
        providers: [project_service_1.EmailProjectsService, templates_service_1.EmailTemplatesService, leads_service_1.EmailLeadsService, import_service_1.EmailImportService],
        imports: [prisma_module_1.PrismaModule]
    })
], EmailMarketingModule);
//# sourceMappingURL=email-marketing.module.js.map