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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialAccountsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const public_decorator_1 = require("../auth/public.decorator");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const create_social_account_dto_1 = require("./dto/create-social-account.dto");
const list_social_accounts_dto_1 = require("./dto/list-social-accounts.dto");
const upsert_tiktok_app_credentials_dto_1 = require("./dto/upsert-tiktok-app-credentials.dto");
const update_social_account_dto_1 = require("./dto/update-social-account.dto");
const social_accounts_service_1 = require("./social-accounts.service");
let SocialAccountsController = class SocialAccountsController {
    socialAccountsService;
    constructor(socialAccountsService) {
        this.socialAccountsService = socialAccountsService;
    }
    getMeta() {
        return this.socialAccountsService.getMeta();
    }
    async getOAuthUrl(req, network, returnTo) {
        const requestOrigin = req?.headers?.origin ||
            req?.headers?.referer ||
            req?.headers?.referrer;
        return this.socialAccountsService.getOAuthAuthorizationUrl(req.user.organizationId, req.user.userId, network, returnTo, requestOrigin);
    }
    getTikTokAppCredentials(req) {
        return this.socialAccountsService.getTikTokAppCredentialsSettings(req.user.organizationId);
    }
    upsertTikTokAppCredentials(req, dto) {
        return this.socialAccountsService.upsertTikTokAppCredentials(req.user.organizationId, dto);
    }
    async oauthCallback(network, code, state, error, errorDescription, res) {
        const redirectUrl = await this.socialAccountsService.handleOAuthCallback({
            network,
            code,
            state,
            error,
            errorDescription,
        });
        return res.redirect(redirectUrl);
    }
    list(req, query) {
        return this.socialAccountsService.list(req.user.organizationId, query);
    }
    create(req, dto) {
        return this.socialAccountsService.create(req.user.organizationId, dto);
    }
    update(req, id, dto) {
        return this.socialAccountsService.update(req.user.organizationId, id, dto);
    }
    syncProfile(req, id) {
        return this.socialAccountsService.syncTikTokProfile(req.user.organizationId, id);
    }
    remove(req, id) {
        return this.socialAccountsService.remove(req.user.organizationId, id);
    }
};
exports.SocialAccountsController = SocialAccountsController;
__decorate([
    (0, common_1.Get)('meta'),
    (0, swagger_1.ApiOperation)({
        summary: 'Metadados do gerenciamento de logins (redes e status suportados)',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SocialAccountsController.prototype, "getMeta", null);
__decorate([
    (0, common_1.Get)('oauth/:network/url'),
    (0, swagger_1.ApiOperation)({
        summary: 'Gerar URL OAuth para conectar conta social (abre em nova aba no frontend)',
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('network')),
    __param(2, (0, common_1.Query)('return_to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], SocialAccountsController.prototype, "getOAuthUrl", null);
__decorate([
    (0, common_1.Get)('app-credentials/tiktok'),
    (0, swagger_1.ApiOperation)({
        summary: 'Consultar configuração de Keys e APIs do TikTok para a organização',
    }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SocialAccountsController.prototype, "getTikTokAppCredentials", null);
__decorate([
    (0, common_1.Put)('app-credentials/tiktok'),
    (0, swagger_1.ApiOperation)({
        summary: 'Salvar/atualizar Keys e APIs do TikTok da organização',
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, upsert_tiktok_app_credentials_dto_1.UpsertTikTokAppCredentialsDto]),
    __metadata("design:returntype", void 0)
], SocialAccountsController.prototype, "upsertTikTokAppCredentials", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('oauth/:network/callback'),
    (0, swagger_1.ApiOperation)({
        summary: 'Callback público do OAuth da rede social',
    }),
    __param(0, (0, common_1.Param)('network')),
    __param(1, (0, common_1.Query)('code')),
    __param(2, (0, common_1.Query)('state')),
    __param(3, (0, common_1.Query)('error')),
    __param(4, (0, common_1.Query)('error_description')),
    __param(5, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], SocialAccountsController.prototype, "oauthCallback", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Listar contas sociais conectadas da organização com filtros opcionais',
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_social_accounts_dto_1.ListSocialAccountsDto]),
    __metadata("design:returntype", void 0)
], SocialAccountsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Cadastrar uma conta social para a organização',
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_social_account_dto_1.CreateSocialAccountDto]),
    __metadata("design:returntype", void 0)
], SocialAccountsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Atualizar dados de uma conta social da organização',
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_social_account_dto_1.UpdateSocialAccountDto]),
    __metadata("design:returntype", void 0)
], SocialAccountsController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/sync-profile'),
    (0, swagger_1.ApiOperation)({
        summary: 'Sincronizar nome/username/avatar da conta social via API oficial',
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SocialAccountsController.prototype, "syncProfile", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Remover uma conta social da organização',
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SocialAccountsController.prototype, "remove", null);
exports.SocialAccountsController = SocialAccountsController = __decorate([
    (0, swagger_1.ApiTags)('Organization - Social Accounts'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('social-accounts'),
    __metadata("design:paramtypes", [social_accounts_service_1.SocialAccountsService])
], SocialAccountsController);
//# sourceMappingURL=social-accounts.controller.js.map