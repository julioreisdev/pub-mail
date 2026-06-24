"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebchatsModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../prisma/prisma.module");
const webchat_service_1 = require("./webchat.service");
const webchats_controller_1 = require("./webchats.controller");
const public_webchats_controller_1 = require("./public-webchats.controller");
const webchat_leads_service_1 = require("./webchat-leads.service");
const webchat_leads_controller_1 = require("./webchat-leads.controller");
let WebchatsModule = class WebchatsModule {
};
exports.WebchatsModule = WebchatsModule;
exports.WebchatsModule = WebchatsModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [webchats_controller_1.WebchatsController, public_webchats_controller_1.PublicWebchatsController, webchat_leads_controller_1.WebchatLeadsController],
        providers: [webchat_service_1.WebchatsService, webchat_leads_service_1.WebchatLeadsService],
    })
], WebchatsModule);
//# sourceMappingURL=webchats.module.js.map