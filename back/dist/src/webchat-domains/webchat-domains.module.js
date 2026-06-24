"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebchatDomainsModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../prisma/prisma.module");
const webchat_domains_controller_1 = require("./webchat-domains.controller");
const webchat_domains_service_1 = require("./webchat-domains.service");
const public_ads_txt_controller_1 = require("./public-ads-txt.controller");
let WebchatDomainsModule = class WebchatDomainsModule {
};
exports.WebchatDomainsModule = WebchatDomainsModule;
exports.WebchatDomainsModule = WebchatDomainsModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [webchat_domains_controller_1.WebchatDomainsController, public_ads_txt_controller_1.PublicAdsTxtController],
        providers: [webchat_domains_service_1.WebchatDomainsService],
        exports: [webchat_domains_service_1.WebchatDomainsService],
    })
], WebchatDomainsModule);
//# sourceMappingURL=webchat-domains.module.js.map