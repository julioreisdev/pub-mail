"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingCardsModule = void 0;
const common_1 = require("@nestjs/common");
const billing_cards_controller_1 = require("./billing_cards.controller");
const billing_cards_service_1 = require("./billing-cards.service");
const prisma_service_1 = require("../prisma/prisma.service");
let BillingCardsModule = class BillingCardsModule {
};
exports.BillingCardsModule = BillingCardsModule;
exports.BillingCardsModule = BillingCardsModule = __decorate([
    (0, common_1.Module)({
        controllers: [billing_cards_controller_1.BillingCardsController],
        providers: [billing_cards_service_1.BillingCardsService, prisma_service_1.PrismaService],
    })
], BillingCardsModule);
//# sourceMappingURL=billing_cards.module.js.map