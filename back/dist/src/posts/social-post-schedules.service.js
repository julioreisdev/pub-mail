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
var SocialPostSchedulesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialPostSchedulesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const posts_service_1 = require("./posts.service");
const social_accounts_crypto_service_1 = require("../social-accounts/social-accounts-crypto.service");
const social_accounts_service_1 = require("../social-accounts/social-accounts.service");
const social_schedule_shared_dto_1 = require("./dto/social-schedule-shared.dto");
const social_schedule_config_1 = require("./social-schedule-config");
function parseIsoDateOrThrow(value, fieldName) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new common_1.BadRequestException(`${fieldName} deve ser um ISO datetime válido.`);
    }
    return parsed;
}
function normalizeOptionalString(value) {
    if (value === undefined || value === null)
        return null;
    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : null;
}
const TIKTOK_DAILY_POST_LIMIT = 15;
const TIKTOK_DAILY_RESET_TIMEZONE = 'UTC';
function getUtcDayRange(baseDate) {
    const start = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
    const nextResetAt = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end, nextResetAt };
}
let SocialPostSchedulesService = SocialPostSchedulesService_1 = class SocialPostSchedulesService {
    prisma;
    postsService;
    socialAccountsCrypto;
    socialAccountsService;
    logger = new common_1.Logger(SocialPostSchedulesService_1.name);
    constructor(prisma, postsService, socialAccountsCrypto, socialAccountsService) {
        this.prisma = prisma;
        this.postsService = postsService;
        this.socialAccountsCrypto = socialAccountsCrypto;
        this.socialAccountsService = socialAccountsService;
    }
    scheduleSelect = {
        id: true,
        organization_id: true,
        post_id: true,
        social_account_id: true,
        social_network: true,
        status: true,
        ai_content: true,
        scheduled_at: true,
        platform_payload: true,
        post_snapshot: true,
        tokens_unit_cost: true,
        tokens_cost: true,
        error_message: true,
        created_at: true,
        updated_at: true,
        social_account: {
            select: {
                id: true,
                social_network: true,
                provider_user_id: true,
                username: true,
                display_name: true,
                profile_image_url: true,
                status: true,
            },
        },
    };
    runSelect = {
        id: true,
        organization_id: true,
        schedule_id: true,
        post_id: true,
        social_account_id: true,
        social_network: true,
        status: true,
        ai_content: true,
        run_at: true,
        sent_at: true,
        external_post_id: true,
        platform_payload: true,
        post_snapshot: true,
        tokens_unit_cost: true,
        tokens_cost: true,
        error_message: true,
        created_at: true,
        social_account: {
            select: {
                id: true,
                social_network: true,
                provider_user_id: true,
                username: true,
                display_name: true,
                profile_image_url: true,
                status: true,
            },
        },
    };
    getMeta() {
        return {
            timezone: social_schedule_config_1.SOCIAL_POST_SCHEDULES_TIMEZONE,
            tokens_cost_per_dispatch: (0, social_schedule_config_1.getSocialPostScheduleTokensCost)(),
            allowed_networks: [...social_schedule_shared_dto_1.SOCIAL_NETWORK_VALUES],
            allowed_schedule_status: [...social_schedule_shared_dto_1.SOCIAL_SCHEDULE_STATUS_VALUES],
            allowed_run_status: [...social_schedule_shared_dto_1.SOCIAL_SCHEDULE_RUN_STATUS_VALUES],
            full_hour_only: true,
            tiktok_daily_post_limit: TIKTOK_DAILY_POST_LIMIT,
            tiktok_daily_reset_timezone: TIKTOK_DAILY_RESET_TIMEZONE,
        };
    }
    normalizeNetworkOrThrow(networkRaw) {
        const normalized = String(networkRaw || '')
            .trim()
            .toUpperCase();
        if (!normalized || !social_schedule_shared_dto_1.SOCIAL_NETWORK_VALUES.includes(normalized)) {
            throw new common_1.BadRequestException('Rede social inválida.');
        }
        return normalized;
    }
    buildTikTokDailyLimitError(nextResetAt) {
        return `Limite de posts diário atingido. Tente novamente mais tarde. Próximo reset: ${nextResetAt.toISOString()} (UTC).`;
    }
    async getTikTokDailyUsageForAccount(input) {
        const { start, end, nextResetAt } = getUtcDayRange(input.referenceAt);
        const [scheduledCount, consumedRunsCount] = await Promise.all([
            this.prisma.social_post_schedules.count({
                where: {
                    organization_id: input.organizationId,
                    social_network: 'TIKTOK',
                    social_account_id: input.socialAccountId,
                    status: 'SCHEDULED',
                    scheduled_at: { gte: start, lte: end },
                    ...(input.excludeScheduleId
                        ? { id: { not: input.excludeScheduleId } }
                        : {}),
                },
            }),
            this.prisma.social_post_schedule_runs.count({
                where: {
                    organization_id: input.organizationId,
                    social_network: 'TIKTOK',
                    social_account_id: input.socialAccountId,
                    status: { in: ['PROCESSING', 'COMPLETED'] },
                    run_at: { gte: start, lte: end },
                },
            }),
        ]);
        const used = scheduledCount + consumedRunsCount;
        const remaining = Math.max(0, TIKTOK_DAILY_POST_LIMIT - used);
        return {
            used,
            remaining,
            limit: TIKTOK_DAILY_POST_LIMIT,
            windowStartUtc: start,
            windowEndUtc: end,
            nextResetAtUtc: nextResetAt,
        };
    }
    async assertTikTokDailyLimitOnSchedule(input) {
        const usage = await this.getTikTokDailyUsageForAccount({
            organizationId: input.organizationId,
            socialAccountId: input.socialAccountId,
            referenceAt: input.scheduledAt,
            excludeScheduleId: input.excludeScheduleId,
        });
        if (usage.used >= usage.limit) {
            throw new common_1.BadRequestException(this.buildTikTokDailyLimitError(usage.nextResetAtUtc));
        }
        return usage;
    }
    async getDailyAccountLimits(organizationId, socialNetworkRaw) {
        const resolvedNetwork = socialNetworkRaw
            ? this.normalizeNetworkOrThrow(socialNetworkRaw)
            : 'TIKTOK';
        if (resolvedNetwork !== 'TIKTOK') {
            return {
                social_network: resolvedNetwork,
                daily_limit: null,
                reset_timezone: TIKTOK_DAILY_RESET_TIMEZONE,
                items: [],
            };
        }
        const now = new Date();
        const { start, end, nextResetAt } = getUtcDayRange(now);
        const [accounts, scheduledGroups, runGroups] = await Promise.all([
            this.prisma.social_accounts.findMany({
                where: {
                    organization_id: organizationId,
                    social_network: 'TIKTOK',
                },
                select: {
                    id: true,
                    social_network: true,
                    status: true,
                    is_default: true,
                    username: true,
                    display_name: true,
                    created_at: true,
                },
                orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
            }),
            this.prisma.social_post_schedules.groupBy({
                by: ['social_account_id'],
                where: {
                    organization_id: organizationId,
                    social_network: 'TIKTOK',
                    status: 'SCHEDULED',
                    social_account_id: { not: null },
                    scheduled_at: { gte: start, lte: end },
                },
                _count: { _all: true },
            }),
            this.prisma.social_post_schedule_runs.groupBy({
                by: ['social_account_id'],
                where: {
                    organization_id: organizationId,
                    social_network: 'TIKTOK',
                    status: { in: ['PROCESSING', 'COMPLETED'] },
                    social_account_id: { not: null },
                    run_at: { gte: start, lte: end },
                },
                _count: { _all: true },
            }),
        ]);
        const scheduledMap = new Map(scheduledGroups
            .filter((item) => Boolean(item.social_account_id))
            .map((item) => [String(item.social_account_id), item._count._all || 0]));
        const runMap = new Map(runGroups
            .filter((item) => Boolean(item.social_account_id))
            .map((item) => [String(item.social_account_id), item._count._all || 0]));
        const items = accounts.map((account) => {
            const reserved = scheduledMap.get(account.id) || 0;
            const consumed = runMap.get(account.id) || 0;
            const used = reserved + consumed;
            return {
                social_account_id: account.id,
                social_network: account.social_network,
                status: account.status,
                is_default: Boolean(account.is_default),
                display_name: account.display_name || null,
                username: account.username || null,
                used,
                remaining: Math.max(0, TIKTOK_DAILY_POST_LIMIT - used),
                is_limited: used >= TIKTOK_DAILY_POST_LIMIT,
            };
        });
        return {
            social_network: 'TIKTOK',
            daily_limit: TIKTOK_DAILY_POST_LIMIT,
            reset_timezone: TIKTOK_DAILY_RESET_TIMEZONE,
            window_start_utc: start.toISOString(),
            window_end_utc: end.toISOString(),
            next_reset_at_utc: nextResetAt.toISOString(),
            items,
        };
    }
    async prepareCreateSchedulePayload(organizationId, dto, options) {
        const scheduledAt = parseIsoDateOrThrow(dto.scheduled_at, 'scheduled_at');
        this.assertWholeHour(scheduledAt);
        if (scheduledAt.getTime() < Date.now()) {
            throw new common_1.BadRequestException('Erro: Horário inválido. Escolha um horário válido.');
        }
        const socialAccount = await this.prisma.social_accounts.findFirst({
            where: {
                id: dto.social_account_id,
                organization_id: organizationId,
                social_network: dto.social_network,
                status: 'ACTIVE',
            },
            select: {
                id: true,
                access_token_encrypted: true,
                refresh_token_encrypted: true,
                token_expires_at: true,
            },
        });
        if (!socialAccount?.id) {
            throw new common_1.BadRequestException('Conta social ativa não encontrada para a rede selecionada.');
        }
        const post = await this.prisma.posts.findFirst({
            where: { id: dto.post_id, organization_id: organizationId },
            include: { media: { orderBy: { sort_order: 'asc' } } },
        });
        if (!post) {
            throw new common_1.NotFoundException('Post da Galeria não encontrado.');
        }
        const normalizedPayload = this.normalizePlatformPayload(dto.social_network, dto.platform_payload ?? {});
        const tokensCost = (0, social_schedule_config_1.getSocialPostScheduleTokensCost)();
        const postSnapshot = this.buildPostSnapshot(post);
        if (dto.social_network === 'TIKTOK') {
            await this.assertTikTokDailyLimitOnSchedule({
                organizationId,
                socialAccountId: socialAccount.id,
                scheduledAt,
                excludeScheduleId: options?.excludeScheduleId,
            });
            const creatorInfo = await this.fetchTikTokCreatorInfoForAccount({
                organizationId,
                socialAccountId: socialAccount.id,
                socialAccount,
            });
            this.assertTikTokSchedulePayloadRules(normalizedPayload, creatorInfo, postSnapshot);
        }
        return {
            data: {
                organization_id: organizationId,
                post_id: dto.post_id,
                social_account_id: socialAccount.id,
                social_network: dto.social_network,
                status: 'SCHEDULED',
                ai_content: dto.ai_content,
                scheduled_at: scheduledAt,
                platform_payload: normalizedPayload,
                post_snapshot: postSnapshot,
                tokens_unit_cost: tokensCost,
                tokens_cost: tokensCost,
            },
        };
    }
    async create(organizationId, dto) {
        const prepared = await this.prepareCreateSchedulePayload(organizationId, dto);
        return this.prisma.social_post_schedules.create({
            data: prepared.data,
            select: this.scheduleSelect,
        });
    }
    async replace(organizationId, scheduleId, dto) {
        const existing = await this.prisma.social_post_schedules.findFirst({
            where: { id: scheduleId, organization_id: organizationId },
            select: { id: true, status: true },
        });
        if (!existing) {
            throw new common_1.NotFoundException('Agendamento não encontrado.');
        }
        if (existing.status === 'PROCESSING') {
            throw new common_1.BadRequestException('Agendamento em processamento não pode ser editado.');
        }
        const prepared = await this.prepareCreateSchedulePayload(organizationId, dto, {
            excludeScheduleId: existing.id,
        });
        const schedule = await this.prisma.$transaction(async (tx) => {
            const created = await tx.social_post_schedules.create({
                data: prepared.data,
                select: this.scheduleSelect,
            });
            await tx.social_post_schedules.delete({
                where: { id: existing.id },
            });
            return created;
        });
        return {
            message: 'Agendamento atualizado com sucesso.',
            replaced_schedule_id: existing.id,
            schedule,
        };
    }
    async remove(organizationId, scheduleId) {
        const existing = await this.prisma.social_post_schedules.findFirst({
            where: { id: scheduleId, organization_id: organizationId },
            select: { id: true, status: true },
        });
        if (!existing) {
            throw new common_1.NotFoundException('Agendamento não encontrado.');
        }
        if (existing.status === 'PROCESSING') {
            throw new common_1.BadRequestException('Agendamento em processamento não pode ser excluído.');
        }
        await this.prisma.social_post_schedules.delete({
            where: { id: existing.id },
        });
        return { message: 'Agendamento excluído com sucesso.' };
    }
    async dispatchNow(organizationId, scheduleId) {
        const schedule = await this.prisma.social_post_schedules.findFirst({
            where: { id: scheduleId, organization_id: organizationId },
            select: this.scheduleSelect,
        });
        if (!schedule) {
            throw new common_1.NotFoundException('Agendamento não encontrado.');
        }
        if (schedule.status === 'PROCESSING') {
            throw new common_1.BadRequestException('Agendamento em processamento não pode ser disparado agora.');
        }
        if (!['SCHEDULED', 'FAILED'].includes(String(schedule.status))) {
            throw new common_1.BadRequestException('Somente agendamentos com status Agendado ou Falhou podem ser disparados agora.');
        }
        if (String(schedule.social_network) === 'TIKTOK' &&
            schedule.social_account_id) {
            const now = new Date();
            const { start: dayStartUtc, end: dayEndUtc } = getUtcDayRange(now);
            const scheduleAt = schedule?.scheduled_at
                ? new Date(schedule.scheduled_at)
                : null;
            const shouldExcludeReservedSchedule = String(schedule.status) === 'SCHEDULED' &&
                scheduleAt &&
                scheduleAt.getTime() >= dayStartUtc.getTime() &&
                scheduleAt.getTime() <= dayEndUtc.getTime();
            const usage = await this.getTikTokDailyUsageForAccount({
                organizationId,
                socialAccountId: schedule.social_account_id,
                referenceAt: now,
                excludeScheduleId: shouldExcludeReservedSchedule ? schedule.id : undefined,
            });
            if (usage.used >= usage.limit) {
                throw new common_1.BadRequestException(this.buildTikTokDailyLimitError(usage.nextResetAtUtc));
            }
        }
        let scheduleToProcess = schedule;
        if (schedule.status === 'FAILED') {
            await this.prisma.social_post_schedules.update({
                where: { id: schedule.id },
                data: {
                    status: 'SCHEDULED',
                    error_message: null,
                },
            });
            scheduleToProcess = {
                ...schedule,
                status: 'SCHEDULED',
                error_message: null,
            };
        }
        try {
            await this.processSingleSchedule(scheduleToProcess, new Date());
        }
        catch (error) {
            this.logger.error(`[dispatch-now] erro inesperado ao disparar agendamento ${scheduleId} (org=${organizationId}): ${String(error?.message || error)}`, error?.stack);
            throw error;
        }
        const lastRun = await this.prisma.social_post_schedule_runs.findFirst({
            where: {
                organization_id: organizationId,
                schedule_id: scheduleId,
            },
            orderBy: [{ created_at: 'desc' }],
            select: this.runSelect,
        });
        if (!lastRun) {
            return {
                message: 'Disparo executado.',
            };
        }
        return {
            message: lastRun.status === 'COMPLETED'
                ? 'Disparo executado com sucesso.'
                : lastRun.status === 'PROCESSING'
                    ? 'Disparo enviado para o TikTok e está em processamento.'
                    : 'Disparo executado com falha.',
            run: lastRun,
        };
    }
    async list(organizationId, query) {
        return {
            items: await this.prisma.social_post_schedules.findMany({
                where: {
                    organization_id: organizationId,
                    ...(query.social_network
                        ? { social_network: query.social_network }
                        : {}),
                    ...(query.social_account_id
                        ? { social_account_id: query.social_account_id }
                        : {}),
                    ...(query.status ? { status: query.status } : {}),
                    ...this.buildDateRangeFilter('scheduled_at', query.from, query.to),
                },
                orderBy: [{ scheduled_at: 'asc' }, { created_at: 'desc' }],
                select: this.scheduleSelect,
            }),
            meta: this.getMeta(),
        };
    }
    async listRuns(organizationId, query) {
        return {
            items: await this.prisma.social_post_schedule_runs.findMany({
                where: {
                    organization_id: organizationId,
                    ...(query.social_network
                        ? { social_network: query.social_network }
                        : {}),
                    ...(query.social_account_id
                        ? { social_account_id: query.social_account_id }
                        : {}),
                    ...(query.status ? { status: query.status } : {}),
                    ...this.buildDateRangeFilter('run_at', query.from, query.to),
                },
                orderBy: [{ run_at: 'desc' }, { created_at: 'desc' }],
                select: this.runSelect,
            }),
            meta: this.getMeta(),
        };
    }
    async processDueSchedules(runAtHour) {
        this.logger.debug(`[tick-social] processing due schedules at ${runAtHour.toISOString()}`);
        const due = await this.prisma.social_post_schedules.findMany({
            where: {
                status: 'SCHEDULED',
                scheduled_at: { lte: runAtHour },
            },
            orderBy: [{ scheduled_at: 'asc' }, { created_at: 'asc' }],
            select: this.scheduleSelect,
        });
        this.logger.debug(`[tick-social] found ${due.length} schedule(s) due`);
        for (const schedule of due) {
            await this.processSingleSchedule(schedule, runAtHour);
        }
    }
    async processTikTokPendingRunsStatus() {
        const pendingRuns = await this.prisma.social_post_schedule_runs.findMany({
            where: {
                social_network: 'TIKTOK',
                status: 'PROCESSING',
                social_account_id: { not: null },
                external_post_id: { not: null },
            },
            orderBy: [{ run_at: 'asc' }, { created_at: 'asc' }],
            take: 50,
            select: {
                id: true,
                organization_id: true,
                post_id: true,
                social_account_id: true,
                external_post_id: true,
                run_at: true,
                post_snapshot: true,
            },
        });
        if (!pendingRuns.length)
            return;
        this.logger.debug(`[poll-tiktok] checking ${pendingRuns.length} pending run(s)`);
        for (const run of pendingRuns) {
            await this.processSingleTikTokPendingRun(run);
        }
    }
    async processSingleTikTokPendingRun(run) {
        const socialAccountId = normalizeOptionalString(run.social_account_id);
        const publishId = normalizeOptionalString(run.external_post_id);
        if (!socialAccountId || !publishId)
            return;
        const socialAccount = await this.prisma.social_accounts.findFirst({
            where: {
                id: socialAccountId,
                organization_id: run.organization_id,
                social_network: 'TIKTOK',
            },
            select: {
                id: true,
                status: true,
                access_token_encrypted: true,
                refresh_token_encrypted: true,
                token_expires_at: true,
            },
        });
        if (!socialAccount?.id || socialAccount.status !== 'ACTIVE') {
            await this.markRunAsFailed(run.id, 'Conta social indisponível para acompanhar status da publicação no TikTok.');
            await this.cleanupPostIfNoMoreSchedules(run.organization_id, run.post_id);
            return;
        }
        try {
            const polled = await this.fetchTikTokPublishStatusForRun({
                organizationId: run.organization_id,
                socialAccountId,
                publishId,
                socialAccount,
            });
            if (polled.finalStatus === 'COMPLETED') {
                await this.prisma.social_post_schedule_runs.update({
                    where: { id: run.id },
                    data: {
                        status: 'COMPLETED',
                        error_message: null,
                    },
                });
                await this.cleanupPostIfNoMoreSchedules(run.organization_id, run.post_id);
                return;
            }
            if (polled.finalStatus === 'FAILED') {
                this.logger.error(`[poll-tiktok] publish failed run=${run.id} publish_id=${publishId} | reason=${String(polled.message || 'unknown')}`);
                await this.logTikTokMediaDebugOnPublishFailure({
                    organizationId: run.organization_id,
                    runId: run.id,
                    publishId,
                    failMessage: polled.message,
                    postSnapshot: run.post_snapshot,
                });
                await this.markRunAsFailed(run.id, polled.message ||
                    'TikTok retornou falha ao consultar status da publicação.');
                await this.cleanupPostIfNoMoreSchedules(run.organization_id, run.post_id);
                return;
            }
        }
        catch (error) {
            const code = String(error?.tiktokCode || '').toLowerCase();
            const message = String(error?.message || error);
            if (code === 'invalid_publish_id' ||
                code === 'token_not_authorized_for_specified_publish_id' ||
                code === 'scope_not_authorized') {
                await this.markRunAsFailed(run.id, `Falha no polling do TikTok: ${message}`.slice(0, 255));
                await this.cleanupPostIfNoMoreSchedules(run.organization_id, run.post_id);
                return;
            }
            this.logger.warn(`[poll-tiktok] run=${run.id} publish_id=${publishId} erro temporário: ${message}`);
        }
    }
    async processSingleSchedule(schedule, runAtHour) {
        const claim = await this.prisma.social_post_schedules.updateMany({
            where: { id: schedule.id, status: 'SCHEDULED' },
            data: { status: 'PROCESSING', error_message: null },
        });
        if (claim.count === 0)
            return;
        const tokensCost = (0, social_schedule_config_1.getSocialPostScheduleTokensCost)();
        const run = await this.prisma.social_post_schedule_runs.create({
            data: {
                organization_id: schedule.organization_id,
                schedule_id: schedule.id,
                post_id: schedule.post_id,
                social_account_id: schedule.social_account_id || null,
                social_network: schedule.social_network,
                status: 'PROCESSING',
                ai_content: schedule.ai_content,
                run_at: runAtHour,
                platform_payload: schedule.platform_payload ?? {},
                post_snapshot: schedule.post_snapshot,
                tokens_unit_cost: tokensCost,
                tokens_cost: tokensCost,
            },
            select: { id: true },
        });
        if (!schedule.social_account_id) {
            await this.markRunAsFailed(run.id, 'Agendamento sem conta social vinculada.');
            await this.markScheduleAsFailed(schedule.id, 'Agendamento sem conta social vinculada.');
            return;
        }
        const socialAccount = await this.prisma.social_accounts.findFirst({
            where: {
                id: schedule.social_account_id,
                organization_id: schedule.organization_id,
                social_network: schedule.social_network,
            },
            select: {
                id: true,
                status: true,
                access_token_encrypted: true,
                refresh_token_encrypted: true,
                token_expires_at: true,
            },
        });
        if (!socialAccount?.id || socialAccount.status !== 'ACTIVE') {
            await this.markRunAsFailed(run.id, 'Conta social indisponível para o disparo (desconectada ou removida).');
            await this.markScheduleAsFailed(schedule.id, 'Conta social indisponível para o disparo (desconectada ou removida).');
            return;
        }
        if (String(schedule.social_network).toUpperCase() === 'TIKTOK' &&
            !normalizeOptionalString(socialAccount.access_token_encrypted)) {
            await this.markRunAsFailed(run.id, 'Conta TikTok desconectada ou sem sessão válida. Reconecte a conta para voltar a disparar.');
            await this.markScheduleAsFailed(schedule.id, 'Conta TikTok desconectada ou sem sessão válida. Reconecte a conta para voltar a disparar.');
            return;
        }
        const wallet = await this.prisma.wallets.findFirst({
            where: {
                organization_id: schedule.organization_id,
                status: 'ACTIVE',
            },
        });
        if (!wallet || Number(wallet.balance) < tokensCost) {
            await this.markRunAsFailed(run.id, 'Saldo insuficiente para executar o disparo agendado.');
            await this.markScheduleAsFailed(schedule.id, 'Saldo insuficiente para executar o disparo agendado.');
            return;
        }
        try {
            await this.prisma.wallets.update({
                where: { id: wallet.id },
                data: { balance: { decrement: tokensCost } },
            });
            await this.prisma.transactions.create({
                data: {
                    wallet_id: wallet.id,
                    amount: -tokensCost,
                    type: 'TOKEN_DEBIT',
                    description: `AGENDAMENTO SOCIAL (${schedule.social_network}) | Post: ${schedule.post_id}`,
                },
            });
            const dispatch = await this.dispatchToSocialNetwork({
                socialNetwork: String(schedule.social_network),
                runId: run.id,
                organizationId: schedule.organization_id,
                socialAccountId: schedule.social_account_id,
                socialAccount,
                platformPayload: schedule.platform_payload ?? {},
                postSnapshot: schedule.post_snapshot ?? {},
                aiContent: Boolean(schedule.ai_content),
            });
            await this.prisma.social_post_schedule_runs.update({
                where: { id: run.id },
                data: {
                    status: String(schedule.social_network).toUpperCase() === 'TIKTOK'
                        ? 'PROCESSING'
                        : 'COMPLETED',
                    sent_at: new Date(),
                    external_post_id: dispatch.externalPostId,
                    error_message: null,
                },
            });
            await this.prisma.social_post_schedules.delete({
                where: { id: schedule.id },
            });
            if (String(schedule.social_network).toUpperCase() !== 'TIKTOK') {
                await this.cleanupPostIfNoMoreSchedules(schedule.organization_id, schedule.post_id);
            }
        }
        catch (error) {
            const fallbackMessage = String(error?.message ?? error).slice(0, 255);
            const message = this.normalizeDispatchFailureMessage(String(schedule.social_network), error, fallbackMessage).slice(0, 255);
            const debugContext = {
                schedule_id: schedule.id,
                run_id: run.id,
                organization_id: schedule.organization_id,
                social_network: schedule.social_network,
                post_id: schedule.post_id,
                social_account_id: schedule.social_account_id,
                media_summary: this.buildTikTokMediaSummary(schedule.post_snapshot),
                tiktok_http_status: error?.tiktokHttpStatus,
                tiktok_code: error?.tiktokCode,
                tiktok_log_id: error?.tiktokLogId,
            };
            this.logger.error(`[dispatch-social] falha no disparo: ${JSON.stringify(debugContext)} | message=${message}`, error?.stack);
            if (String(schedule.social_network).toUpperCase() === 'TIKTOK' &&
                this.isTikTokAuthDisconnectedError(error) &&
                schedule.social_account_id) {
                await this.prisma.social_accounts.updateMany({
                    where: {
                        id: schedule.social_account_id,
                        organization_id: schedule.organization_id,
                        social_network: 'TIKTOK',
                    },
                    data: { status: 'DISCONNECTED' },
                });
            }
            await this.markRunAsFailed(run.id, message);
            await this.markScheduleAsFailed(schedule.id, message);
        }
    }
    async cleanupPostIfNoMoreSchedules(organizationId, postId) {
        const [pendingSchedulesCount, totalRunsCount, nonCompletedRunsCount] = await Promise.all([
            this.prisma.social_post_schedules.count({
                where: { organization_id: organizationId, post_id: postId },
            }),
            this.prisma.social_post_schedule_runs.count({
                where: {
                    organization_id: organizationId,
                    post_id: postId,
                },
            }),
            this.prisma.social_post_schedule_runs.count({
                where: {
                    organization_id: organizationId,
                    post_id: postId,
                    status: { not: 'COMPLETED' },
                },
            }),
        ]);
        if (pendingSchedulesCount > 0)
            return;
        if (totalRunsCount === 0)
            return;
        if (nonCompletedRunsCount > 0)
            return;
        try {
            await this.postsService.remove(organizationId, postId);
        }
        catch (error) {
            const msg = String(error?.message ?? error);
            this.logger.warn(`[cleanup-post] não foi possível apagar post ${postId}: ${msg}`);
        }
    }
    async markRunAsFailed(runId, message) {
        await this.prisma.social_post_schedule_runs.update({
            where: { id: runId },
            data: {
                status: 'FAILED',
                error_message: message.slice(0, 255),
            },
        });
    }
    async markScheduleAsFailed(scheduleId, message) {
        await this.prisma.social_post_schedules.update({
            where: { id: scheduleId },
            data: {
                status: 'FAILED',
                error_message: message.slice(0, 255),
            },
        });
    }
    async dispatchToSocialNetwork(input) {
        if (input.socialNetwork !== 'TIKTOK') {
            throw new Error(`Disparo real da rede ${input.socialNetwork} ainda não está implementado.`);
        }
        return this.dispatchTikTokDirectPost(input);
    }
    async getTikTokDispatchConfig(organizationId) {
        const credentials = await this.socialAccountsService.resolveTikTokClientCredentialsForOrganization(organizationId);
        return {
            clientKey: credentials.clientKey,
            clientSecret: credentials.clientSecret,
            tokenEndpoint: normalizeOptionalString(process.env.TIKTOK_OAUTH_TOKEN_ENDPOINT) ||
                'https://open.tiktokapis.com/v2/oauth/token/',
            creatorInfoEndpoint: normalizeOptionalString(process.env.TIKTOK_CREATOR_INFO_ENDPOINT) ||
                'https://open.tiktokapis.com/v2/post/publish/creator_info/query/',
            directPostEndpoint: normalizeOptionalString(process.env.TIKTOK_DIRECT_POST_ENDPOINT) ||
                'https://open.tiktokapis.com/v2/post/publish/video/init/',
            photoPostEndpoint: normalizeOptionalString(process.env.TIKTOK_PHOTO_POST_ENDPOINT) ||
                'https://open.tiktokapis.com/v2/post/publish/content/init/',
            statusFetchEndpoint: normalizeOptionalString(process.env.TIKTOK_STATUS_FETCH_ENDPOINT) ||
                'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
            mediaBaseUrl: normalizeOptionalString(process.env.SOCIAL_POST_MEDIA_BASE_URL) ||
                normalizeOptionalString(process.env.BASE_API_URL),
        };
    }
    async readJsonSafe(response) {
        const text = await response.text();
        if (!text)
            return {};
        try {
            return JSON.parse(text);
        }
        catch {
            return { message: text };
        }
    }
    normalizeTikTokScope(rawScope) {
        if (Array.isArray(rawScope)) {
            return rawScope.map((item) => String(item)).filter(Boolean);
        }
        const normalized = String(rawScope || '').trim();
        if (!normalized)
            return [];
        return normalized
            .split(/[,\s]+/)
            .map((item) => item.trim())
            .filter(Boolean);
    }
    parseTikTokApiErrorMessage(raw, fallback) {
        return String(raw?.error?.message ||
            raw?.error_description ||
            raw?.error ||
            raw?.message ||
            fallback);
    }
    parseTikTokApiCode(raw) {
        return normalizeOptionalString(raw?.error?.code || raw?.code || raw?.error_code);
    }
    buildTikTokApiError(raw, status, fallback) {
        const code = this.parseTikTokApiCode(raw);
        const message = this.parseTikTokApiErrorMessage(raw, fallback);
        const logId = normalizeOptionalString(raw?.error?.log_id || raw?.log_id);
        const error = new Error(`TikTok API (${status})${code ? ` [${code}]` : ''}: ${message}${logId ? ` (log_id=${logId})` : ''}`);
        error.tiktokCode = code;
        error.tiktokLogId = logId;
        error.tiktokHttpStatus = status;
        return error;
    }
    isTikTokAuthDisconnectedError(error) {
        const code = String(error?.tiktokCode || '')
            .trim()
            .toLowerCase();
        const status = Number(error?.tiktokHttpStatus || 0);
        const message = String(error?.message || '')
            .trim()
            .toLowerCase();
        if (code === 'access_token_invalid' ||
            code === 'scope_not_authorized' ||
            code === 'token_not_authorized_for_specified_publish_id' ||
            code === 'invalid_grant') {
            return true;
        }
        if (status === 401)
            return true;
        return (message.includes('access token tiktok inválido') ||
            message.includes('refresh token do tiktok indisponível') ||
            message.includes('conta tiktok sem access token') ||
            message.includes('oauth'));
    }
    normalizeDispatchFailureMessage(socialNetwork, error, fallback) {
        const normalizedNetwork = String(socialNetwork || '')
            .trim()
            .toUpperCase();
        if (normalizedNetwork === 'TIKTOK' &&
            this.isTikTokAuthDisconnectedError(error)) {
            return 'Conta TikTok desconectada ou sem permissão válida. Reconecte a conta para voltar a disparar.';
        }
        return fallback;
    }
    async postTikTokApi(endpoint, accessToken, body) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
            },
            body: JSON.stringify(body ?? {}),
        });
        const raw = await this.readJsonSafe(response);
        const code = this.parseTikTokApiCode(raw);
        const codeOk = !code || code.toLowerCase() === 'ok';
        if (!response.ok || !codeOk) {
            throw this.buildTikTokApiError(raw, response.status, 'Falha na API TikTok.');
        }
        const data = raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object'
            ? raw.data
            : raw ?? {};
        return { raw, data };
    }
    normalizeTikTokCreatorInfo(creatorInfoRaw) {
        const privacyLevelOptions = Array.isArray(creatorInfoRaw?.privacy_level_options)
            ? creatorInfoRaw.privacy_level_options
                .map((item) => String(item || '').trim().toUpperCase())
                .filter(Boolean)
            : [];
        const maxVideoDurationSecRaw = Number(creatorInfoRaw?.max_video_post_duration_sec);
        return {
            privacy_level_options: privacyLevelOptions,
            comment_disabled: Boolean(creatorInfoRaw?.comment_disabled),
            duet_disabled: Boolean(creatorInfoRaw?.duet_disabled),
            stitch_disabled: Boolean(creatorInfoRaw?.stitch_disabled),
            max_video_post_duration_sec: Number.isFinite(maxVideoDurationSecRaw) && maxVideoDurationSecRaw > 0
                ? Math.floor(maxVideoDurationSecRaw)
                : null,
        };
    }
    async fetchTikTokCreatorInfoForAccount(input) {
        const config = await this.getTikTokDispatchConfig(input.organizationId);
        const encryptedAccessToken = normalizeOptionalString(input.socialAccount?.access_token_encrypted);
        if (!encryptedAccessToken) {
            throw new common_1.BadRequestException('Conta TikTok sem access token. Reconecte a conta antes de agendar.');
        }
        let accessToken = normalizeOptionalString(this.socialAccountsCrypto.decrypt(encryptedAccessToken));
        if (!accessToken) {
            throw new common_1.BadRequestException('Access token TikTok inválido. Reconecte a conta antes de agendar.');
        }
        const refreshTokenEncrypted = normalizeOptionalString(input.socialAccount?.refresh_token_encrypted);
        const refreshAccessToken = async () => {
            if (!refreshTokenEncrypted) {
                throw new common_1.BadRequestException('Conta TikTok sem refresh token para renovação automática. Reconecte a conta.');
            }
            if (!config.clientKey || !config.clientSecret) {
                throw new common_1.BadRequestException('Configure TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET (ou salve Keys e APIs da organização) para renovar token do TikTok.');
            }
            accessToken = await this.refreshTikTokAccessToken({
                socialAccountId: input.socialAccountId,
                refreshTokenEncrypted,
                currentRefreshTokenEncrypted: refreshTokenEncrypted,
                tokenEndpoint: config.tokenEndpoint,
                clientKey: config.clientKey,
                clientSecret: config.clientSecret,
            });
        };
        const shouldRefreshBeforeFetch = Boolean(refreshTokenEncrypted) &&
            input.socialAccount?.token_expires_at &&
            new Date(input.socialAccount.token_expires_at).getTime() <=
                Date.now() + 60_000;
        if (shouldRefreshBeforeFetch) {
            await refreshAccessToken();
        }
        try {
            const response = await this.postTikTokApi(config.creatorInfoEndpoint, String(accessToken));
            return this.normalizeTikTokCreatorInfo(response.data ?? {});
        }
        catch (error) {
            const errorCode = String(error?.tiktokCode || '').toLowerCase();
            if (errorCode === 'access_token_invalid' && refreshTokenEncrypted) {
                await refreshAccessToken();
                const retryResponse = await this.postTikTokApi(config.creatorInfoEndpoint, String(accessToken));
                return this.normalizeTikTokCreatorInfo(retryResponse.data ?? {});
            }
            throw error;
        }
    }
    async getTikTokCreatorInfoForSchedule(organizationId, socialAccountId) {
        const account = await this.prisma.social_accounts.findFirst({
            where: {
                id: socialAccountId,
                organization_id: organizationId,
                social_network: 'TIKTOK',
                status: 'ACTIVE',
            },
            select: {
                id: true,
                access_token_encrypted: true,
                refresh_token_encrypted: true,
                token_expires_at: true,
            },
        });
        if (!account?.id) {
            throw new common_1.NotFoundException('Conta TikTok ativa não encontrada.');
        }
        const creatorInfo = await this.fetchTikTokCreatorInfoForAccount({
            organizationId,
            socialAccountId: account.id,
            socialAccount: account,
        });
        return {
            social_account_id: account.id,
            social_network: 'TIKTOK',
            ...creatorInfo,
        };
    }
    normalizeTikTokPublishStatus(statusRaw, failReasonRaw) {
        const status = String(statusRaw || '')
            .trim()
            .toUpperCase();
        const failReason = normalizeOptionalString(failReasonRaw);
        if (status === 'PUBLISH_COMPLETE') {
            return {
                finalStatus: 'COMPLETED',
                status,
                message: null,
            };
        }
        if (status === 'FAILED') {
            return {
                finalStatus: 'FAILED',
                status,
                message: failReason
                    ? `TikTok retornou falha no publish: ${failReason}.`
                    : 'TikTok retornou status FAILED ao consultar publicação.',
            };
        }
        return {
            finalStatus: null,
            status,
            message: null,
        };
    }
    async fetchTikTokPublishStatusForRun(input) {
        const config = await this.getTikTokDispatchConfig(input.organizationId);
        const encryptedAccessToken = normalizeOptionalString(input.socialAccount?.access_token_encrypted);
        if (!encryptedAccessToken) {
            throw new Error('Conta TikTok sem access token para consultar status da publicação.');
        }
        let accessToken = normalizeOptionalString(this.socialAccountsCrypto.decrypt(encryptedAccessToken));
        if (!accessToken) {
            throw new Error('Access token TikTok inválido para consultar status da publicação.');
        }
        const refreshTokenEncrypted = normalizeOptionalString(input.socialAccount?.refresh_token_encrypted);
        const refreshAccessToken = async () => {
            if (!refreshTokenEncrypted) {
                throw new Error('Conta TikTok sem refresh token para renovação automática.');
            }
            if (!config.clientKey || !config.clientSecret) {
                throw new Error('Configure credenciais do TikTok para renovação automática do access token.');
            }
            accessToken = await this.refreshTikTokAccessToken({
                socialAccountId: input.socialAccountId,
                refreshTokenEncrypted,
                currentRefreshTokenEncrypted: refreshTokenEncrypted,
                tokenEndpoint: config.tokenEndpoint,
                clientKey: config.clientKey,
                clientSecret: config.clientSecret,
            });
        };
        const shouldRefreshBeforeFetch = Boolean(refreshTokenEncrypted) &&
            input.socialAccount?.token_expires_at &&
            new Date(input.socialAccount.token_expires_at).getTime() <=
                Date.now() + 60_000;
        if (shouldRefreshBeforeFetch) {
            await refreshAccessToken();
        }
        const requestBody = { publish_id: input.publishId };
        try {
            const response = await this.postTikTokApi(config.statusFetchEndpoint, String(accessToken), requestBody);
            return this.normalizeTikTokPublishStatus(response?.data?.status, response?.data?.fail_reason);
        }
        catch (error) {
            const errorCode = String(error?.tiktokCode || '').toLowerCase();
            if (errorCode === 'access_token_invalid' && refreshTokenEncrypted) {
                await refreshAccessToken();
                const retryResponse = await this.postTikTokApi(config.statusFetchEndpoint, String(accessToken), requestBody);
                return this.normalizeTikTokPublishStatus(retryResponse?.data?.status, retryResponse?.data?.fail_reason);
            }
            throw error;
        }
    }
    resolveTikTokVideoDurationSec(postSnapshot) {
        const media = Array.isArray(postSnapshot?.media)
            ? [...postSnapshot.media].sort((a, b) => (a?.sort_order ?? 0) - (b?.sort_order ?? 0))
            : [];
        const firstVideo = media.find((item) => String(item?.media_type || '').toUpperCase() === 'VIDEO' &&
            normalizeOptionalString(item?.storage_key));
        if (!firstVideo)
            return null;
        const duration = Number(firstVideo?.duration_sec);
        if (!Number.isFinite(duration) || duration <= 0)
            return null;
        return Math.floor(duration);
    }
    assertTikTokSchedulePayloadRules(payload, creatorInfo, postSnapshot) {
        const privacyLevel = normalizeOptionalString(payload?.privacy_level);
        if (!privacyLevel) {
            throw new common_1.BadRequestException('Selecione manualmente a privacidade do post no TikTok.');
        }
        const requestedPrivacy = this.mapTikTokPrivacyLevel(privacyLevel);
        const allowedPrivacyOptions = Array.isArray(creatorInfo?.privacy_level_options)
            ? creatorInfo.privacy_level_options
            : [];
        if (allowedPrivacyOptions.length > 0 &&
            !allowedPrivacyOptions.includes(requestedPrivacy)) {
            throw new common_1.BadRequestException('A privacidade selecionada não está disponível para esta conta TikTok.');
        }
        const commercialDisclosure = this.normalizeTikTokCommercialDisclosure(payload, {
            throwWhenEnabledWithoutSelection: true,
        });
        if (commercialDisclosure.brandContentToggle &&
            requestedPrivacy === 'SELF_ONLY') {
            throw new common_1.BadRequestException('Conteúdo de marca não pode ser publicado com privacidade "Somente eu".');
        }
        const mediaInput = this.buildTikTokDispatchMediaInput(postSnapshot, 'http://localhost');
        const videoDurationSec = mediaInput.kind === 'VIDEO'
            ? this.resolveTikTokVideoDurationSec(postSnapshot)
            : null;
        if (mediaInput.kind === 'VIDEO') {
            if (!videoDurationSec) {
                throw new common_1.BadRequestException('Vídeo sem duração disponível na galeria. Reenvie o vídeo para atualizar os metadados.');
            }
            const maxVideoDurationSec = Number(creatorInfo?.max_video_post_duration_sec);
            if (!Number.isFinite(maxVideoDurationSec) || maxVideoDurationSec <= 0) {
                throw new common_1.BadRequestException('Não foi possível validar a duração máxima permitida pelo TikTok para esta conta.');
            }
            if (videoDurationSec > maxVideoDurationSec) {
                throw new common_1.BadRequestException(`Vídeo com ${videoDurationSec}s excede o limite permitido pelo TikTok para esta conta (${Math.floor(maxVideoDurationSec)}s).`);
            }
        }
        const allowComment = Boolean(payload?.allow_comment);
        const allowDuet = Boolean(payload?.allow_duet);
        const allowStitch = Boolean(payload?.allow_stitch);
        payload.privacy_level = requestedPrivacy;
        payload.allow_comment = allowComment && !Boolean(creatorInfo.comment_disabled);
        if (mediaInput.kind === 'PHOTO') {
            payload.allow_duet = false;
            payload.allow_stitch = false;
            return;
        }
        payload.allow_duet = allowDuet && !Boolean(creatorInfo.duet_disabled);
        payload.allow_stitch = allowStitch && !Boolean(creatorInfo.stitch_disabled);
    }
    normalizeTikTokCommercialDisclosure(payload, options) {
        const requestedBrandOrganic = Boolean(payload?.brand_organic_toggle);
        const requestedBrandContent = Boolean(payload?.brand_content_toggle);
        const explicitEnabled = typeof payload?.commercial_content_enabled === 'boolean'
            ? payload.commercial_content_enabled
            : null;
        const disclosureEnabled = explicitEnabled === null
            ? requestedBrandOrganic || requestedBrandContent
            : Boolean(explicitEnabled);
        if (!disclosureEnabled) {
            payload.commercial_content_enabled = false;
            payload.brand_organic_toggle = false;
            payload.brand_content_toggle = false;
            return {
                commercialContentEnabled: false,
                brandOrganicToggle: false,
                brandContentToggle: false,
            };
        }
        if (!requestedBrandOrganic && !requestedBrandContent) {
            if (options?.throwWhenEnabledWithoutSelection) {
                throw new common_1.BadRequestException('Você precisa indicar se o conteúdo promove sua marca, terceiros ou ambos.');
            }
        }
        payload.commercial_content_enabled = true;
        payload.brand_organic_toggle = requestedBrandOrganic;
        payload.brand_content_toggle = requestedBrandContent;
        return {
            commercialContentEnabled: true,
            brandOrganicToggle: requestedBrandOrganic,
            brandContentToggle: requestedBrandContent,
        };
    }
    mapTikTokPrivacyLevel(value) {
        const raw = String(value || '')
            .trim()
            .toUpperCase();
        if (!raw)
            return 'PUBLIC_TO_EVERYONE';
        if (raw === 'PUBLIC')
            return 'PUBLIC_TO_EVERYONE';
        if (raw === 'FRIENDS')
            return 'MUTUAL_FOLLOW_FRIENDS';
        if (raw === 'FOLLOWERS')
            return 'FOLLOWER_OF_CREATOR';
        if (raw === 'PRIVATE')
            return 'SELF_ONLY';
        return raw;
    }
    resolveTikTokPrivacyLevel(requestedValue, creatorOptionsRaw) {
        const creatorOptions = Array.isArray(creatorOptionsRaw)
            ? creatorOptionsRaw
                .map((item) => String(item || '').trim().toUpperCase())
                .filter(Boolean)
            : [];
        const requested = this.mapTikTokPrivacyLevel(requestedValue);
        if (creatorOptions.length === 0)
            return requested || 'SELF_ONLY';
        if (creatorOptions.includes(requested))
            return requested;
        if (creatorOptions.includes('SELF_ONLY'))
            return 'SELF_ONLY';
        return creatorOptions[0];
    }
    buildTikTokCaption(platformPayload, postSnapshot) {
        const title = normalizeOptionalString(platformPayload?.title);
        const caption = normalizeOptionalString(platformPayload?.caption);
        const fallbackCaption = normalizeOptionalString(postSnapshot?.default_caption);
        const fallbackTitle = normalizeOptionalString(postSnapshot?.default_title);
        const merged = [title, caption, fallbackCaption, fallbackTitle]
            .filter(Boolean)
            .join('\n\n')
            .trim() || 'Post agendado via API';
        return merged.slice(0, 2200);
    }
    buildTikTokMediaSummary(postSnapshot) {
        return Array.isArray(postSnapshot?.media) && postSnapshot.media.length > 0
            ? postSnapshot.media
                .map((item) => `${String(item?.media_type || '').toUpperCase() || 'UNKNOWN'}:${String(item?.storage_key ? 'ok' : 'missing')}`)
                .join(', ')
            : 'sem mídias';
    }
    buildPublicMediaUrl(storageKey, mediaBaseUrl) {
        const baseUrl = mediaBaseUrl.endsWith('/')
            ? mediaBaseUrl
            : `${mediaBaseUrl}/`;
        const encodedStorageKey = storageKey
            .split('/')
            .filter(Boolean)
            .map((part) => encodeURIComponent(part))
            .join('/');
        return new URL(`uploads/${encodedStorageKey}`, baseUrl).toString();
    }
    async probePublicMediaUrl(url) {
        const probe = {
            url,
            method: 'HEAD',
            status: null,
            contentType: null,
            contentLength: null,
            finalUrl: null,
            error: null,
        };
        try {
            const head = await fetch(url, {
                method: 'HEAD',
                redirect: 'follow',
            });
            probe.status = head.status;
            probe.contentType = normalizeOptionalString(head.headers.get('content-type'));
            probe.contentLength = normalizeOptionalString(head.headers.get('content-length'));
            probe.finalUrl = normalizeOptionalString(head.url) || url;
            if (head.status !== 405)
                return probe;
        }
        catch (error) {
            probe.error = String(error?.message || error);
        }
        try {
            probe.method = 'GET';
            const get = await fetch(url, {
                method: 'GET',
                redirect: 'follow',
                headers: {
                    Range: 'bytes=0-0',
                },
            });
            probe.status = get.status;
            probe.contentType = normalizeOptionalString(get.headers.get('content-type'));
            probe.contentLength = normalizeOptionalString(get.headers.get('content-length'));
            probe.finalUrl = normalizeOptionalString(get.url) || url;
            return probe;
        }
        catch (error) {
            probe.error = String(error?.message || error);
            return probe;
        }
    }
    async logTikTokMediaDebugOnPublishFailure(input) {
        const reason = String(input.failMessage || '')
            .trim()
            .toLowerCase();
        if (!reason.includes('video_pull_failed') &&
            !reason.includes('file_format_check_failed')) {
            return;
        }
        const config = await this.getTikTokDispatchConfig(input.organizationId);
        if (!config.mediaBaseUrl) {
            this.logger.error(`[poll-tiktok] run=${input.runId} publish_id=${input.publishId} sem mediaBaseUrl para depurar mídia`);
            return;
        }
        let mediaInput;
        try {
            mediaInput = this.buildTikTokDispatchMediaInput(input.postSnapshot, config.mediaBaseUrl);
        }
        catch (error) {
            this.logger.error(`[poll-tiktok] run=${input.runId} publish_id=${input.publishId} falha ao reconstruir mídia para debug: ${String(error?.message || error)}`);
            return;
        }
        const targetUrl = mediaInput.kind === 'VIDEO'
            ? mediaInput.videoUrl
            : String(mediaInput.photoImages?.[0] || '');
        if (!targetUrl) {
            this.logger.error(`[poll-tiktok] run=${input.runId} publish_id=${input.publishId} sem URL de mídia para debug`);
            return;
        }
        const probe = await this.probePublicMediaUrl(targetUrl);
        this.logger.error(`[poll-tiktok] media debug run=${input.runId} publish_id=${input.publishId} reason=${reason} probe=${JSON.stringify(probe)}`);
    }
    buildTikTokDispatchMediaInput(postSnapshot, mediaBaseUrl) {
        const mediaSummary = this.buildTikTokMediaSummary(postSnapshot);
        const orderedMedia = Array.isArray(postSnapshot?.media)
            ? [...postSnapshot.media]
                .sort((a, b) => (a?.sort_order ?? 0) - (b?.sort_order ?? 0))
                .map((item) => ({
                mediaType: String(item?.media_type || '').toUpperCase(),
                storageKey: normalizeOptionalString(item?.storage_key),
            }))
                .filter((item) => item.storageKey)
            : [];
        const videos = orderedMedia.filter((item) => item.mediaType === 'VIDEO');
        const images = orderedMedia.filter((item) => item.mediaType === 'IMAGE');
        if (videos.length > 0 && images.length > 0) {
            throw new Error(`Post da galeria com mídias mistas (vídeo + imagem), formato não suportado para disparo TikTok. Mídias encontradas: ${mediaSummary}`);
        }
        if (videos.length > 0) {
            return {
                kind: 'VIDEO',
                videoUrl: this.buildPublicMediaUrl(String(videos[0].storageKey), mediaBaseUrl),
            };
        }
        if (images.length > 0) {
            if (images.length > 35) {
                throw new Error(`Post da galeria com ${images.length} imagens. O TikTok permite no máximo 35 imagens por publicação.`);
            }
            return {
                kind: 'PHOTO',
                photoImages: images.map((item) => this.buildPublicMediaUrl(String(item.storageKey), mediaBaseUrl)),
                photoCoverIndex: 0,
            };
        }
        throw new Error(`Post da galeria sem mídia disponível para publicação no TikTok. Mídias encontradas: ${mediaSummary}`);
    }
    async refreshTikTokAccessToken(input) {
        const refreshToken = normalizeOptionalString(this.socialAccountsCrypto.decrypt(input.refreshTokenEncrypted));
        if (!refreshToken) {
            throw new Error('Refresh token do TikTok indisponível para renovar o access token.');
        }
        const body = new URLSearchParams();
        body.set('client_key', input.clientKey);
        body.set('client_secret', input.clientSecret);
        body.set('grant_type', 'refresh_token');
        body.set('refresh_token', refreshToken);
        const response = await fetch(input.tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        });
        const raw = await this.readJsonSafe(response);
        const code = this.parseTikTokApiCode(raw);
        const codeOk = !code || code.toLowerCase() === 'ok';
        if (!response.ok || !codeOk) {
            throw this.buildTikTokApiError(raw, response.status, 'Falha ao renovar access token no TikTok.');
        }
        const data = raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object'
            ? raw.data
            : raw ?? {};
        const accessToken = normalizeOptionalString(data?.access_token);
        if (!accessToken) {
            throw new Error('TikTok não retornou access_token na renovação do token.');
        }
        const nextRefreshToken = normalizeOptionalString(data?.refresh_token) || refreshToken;
        const expiresIn = Number(data?.expires_in || data?.expiresIn || 0);
        const scope = this.normalizeTikTokScope(data?.scope || data?.scopes);
        const tokenExpiresAt = Number.isFinite(expiresIn) && expiresIn > 0
            ? new Date(Date.now() + expiresIn * 1000)
            : null;
        await this.prisma.social_accounts.update({
            where: { id: input.socialAccountId },
            data: {
                status: 'ACTIVE',
                access_token_encrypted: this.socialAccountsCrypto.encrypt(accessToken),
                refresh_token_encrypted: nextRefreshToken
                    ? this.socialAccountsCrypto.encrypt(nextRefreshToken)
                    : input.currentRefreshTokenEncrypted ?? null,
                token_expires_at: tokenExpiresAt,
                scope: scope.length > 0 ? scope : undefined,
            },
        });
        return accessToken;
    }
    async dispatchTikTokDirectPost(input) {
        const config = await this.getTikTokDispatchConfig(input.organizationId);
        if (!config.mediaBaseUrl) {
            throw new Error('Configure SOCIAL_POST_MEDIA_BASE_URL (ou BASE_API_URL) para publicar no TikTok por URL.');
        }
        const encryptedAccessToken = normalizeOptionalString(input.socialAccount?.access_token_encrypted);
        if (!encryptedAccessToken) {
            throw new Error('Conta TikTok sem access token para publicação.');
        }
        let accessToken = normalizeOptionalString(this.socialAccountsCrypto.decrypt(encryptedAccessToken));
        if (!accessToken) {
            throw new Error('Access token TikTok inválido ou indisponível.');
        }
        const refreshTokenEncrypted = normalizeOptionalString(input.socialAccount?.refresh_token_encrypted);
        const shouldRefreshBeforeDispatch = Boolean(refreshTokenEncrypted) &&
            input.socialAccount?.token_expires_at &&
            new Date(input.socialAccount.token_expires_at).getTime() <=
                Date.now() + 60_000;
        if (shouldRefreshBeforeDispatch) {
            if (!config.clientKey || !config.clientSecret) {
                throw new Error('Configure TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET (ou salve Keys e APIs da organização) para renovar token do TikTok.');
            }
            accessToken = await this.refreshTikTokAccessToken({
                socialAccountId: input.socialAccountId,
                refreshTokenEncrypted: refreshTokenEncrypted,
                currentRefreshTokenEncrypted: refreshTokenEncrypted,
                tokenEndpoint: config.tokenEndpoint,
                clientKey: config.clientKey,
                clientSecret: config.clientSecret,
            });
        }
        const mediaInput = this.buildTikTokDispatchMediaInput(input.postSnapshot, config.mediaBaseUrl);
        const tryPublish = async (token, forcePrivate) => {
            const creatorInfoResponse = await this.postTikTokApi(config.creatorInfoEndpoint, token);
            const creatorInfo = creatorInfoResponse.data ?? {};
            const requestedPrivacy = forcePrivate
                ? 'PRIVATE'
                : normalizeOptionalString(input.platformPayload?.privacy_level);
            const privacyLevel = this.resolveTikTokPrivacyLevel(requestedPrivacy, creatorInfo?.privacy_level_options);
            const commercialDisclosure = this.normalizeTikTokCommercialDisclosure(input.platformPayload ?? {}, {
                throwWhenEnabledWithoutSelection: true,
            });
            if (commercialDisclosure.brandContentToggle &&
                privacyLevel === 'SELF_ONLY') {
                throw new Error('Conteúdo de marca não pode ser publicado com privacidade "Somente eu".');
            }
            const allowCommentRequested = Boolean(input.platformPayload?.allow_comment);
            const allowDuetRequested = Boolean(input.platformPayload?.allow_duet);
            const allowStitchRequested = Boolean(input.platformPayload?.allow_stitch);
            const disableComment = Boolean(creatorInfo?.comment_disabled) || !allowCommentRequested;
            const disableDuet = Boolean(creatorInfo?.duet_disabled) || !allowDuetRequested;
            const disableStitch = Boolean(creatorInfo?.stitch_disabled) || !allowStitchRequested;
            const caption = this.buildTikTokCaption(input.platformPayload, input.postSnapshot);
            const titleForPhoto = normalizeOptionalString(input.platformPayload?.title) ||
                normalizeOptionalString(input.postSnapshot?.default_title) ||
                caption;
            if (mediaInput.kind === 'VIDEO') {
                const videoDurationSec = this.resolveTikTokVideoDurationSec(input.postSnapshot);
                if (!videoDurationSec) {
                    throw new Error('Vídeo sem duração disponível na galeria. Reenvie o vídeo para atualizar os metadados.');
                }
                const maxVideoDurationSec = Number(creatorInfo?.max_video_post_duration_sec);
                if (!Number.isFinite(maxVideoDurationSec) || maxVideoDurationSec <= 0) {
                    throw new Error('TikTok não retornou max_video_post_duration_sec para validar a duração do vídeo.');
                }
                if (videoDurationSec > maxVideoDurationSec) {
                    throw new Error(`Vídeo com ${videoDurationSec}s excede o limite permitido pelo TikTok para esta conta (${Math.floor(maxVideoDurationSec)}s).`);
                }
            }
            const postBody = mediaInput.kind === 'VIDEO'
                ? {
                    post_info: {
                        title: caption,
                        privacy_level: privacyLevel,
                        disable_comment: disableComment,
                        disable_duet: disableDuet,
                        disable_stitch: disableStitch,
                        brand_content_toggle: commercialDisclosure.brandContentToggle,
                        brand_organic_toggle: commercialDisclosure.brandOrganicToggle,
                        is_aigc: Boolean(input.aiContent),
                    },
                    source_info: {
                        source: 'PULL_FROM_URL',
                        video_url: mediaInput.videoUrl,
                    },
                }
                : {
                    post_info: {
                        title: titleForPhoto.slice(0, 150),
                        description: caption,
                        privacy_level: privacyLevel,
                        disable_comment: disableComment,
                        auto_add_music: true,
                        brand_content_toggle: commercialDisclosure.brandContentToggle,
                        brand_organic_toggle: commercialDisclosure.brandOrganicToggle,
                    },
                    source_info: {
                        source: 'PULL_FROM_URL',
                        photo_images: mediaInput.photoImages,
                        photo_cover_index: mediaInput.photoCoverIndex,
                    },
                    post_mode: 'DIRECT_POST',
                    media_type: 'PHOTO',
                };
            const directPostEndpoint = mediaInput.kind === 'VIDEO'
                ? config.directPostEndpoint
                : config.photoPostEndpoint;
            const directPostResponse = await this.postTikTokApi(directPostEndpoint, token, postBody);
            const publishId = normalizeOptionalString(directPostResponse.data?.publish_id || directPostResponse.raw?.publish_id);
            if (!publishId) {
                throw new Error('TikTok não retornou publish_id após iniciar o direct post.');
            }
            return publishId;
        };
        try {
            const publishId = await tryPublish(accessToken, false);
            return { externalPostId: publishId };
        }
        catch (error) {
            const errorCode = String(error?.tiktokCode || '').toLowerCase();
            if (errorCode === 'unaudited_client_can_only_post_to_private_accounts') {
                this.logger.warn(`[dispatch-tiktok] app não auditado, reprocessando run=${input.runId} com privacidade privada`);
                const publishId = await tryPublish(accessToken, true);
                return { externalPostId: publishId };
            }
            if (errorCode === 'access_token_invalid' && refreshTokenEncrypted) {
                if (!config.clientKey || !config.clientSecret) {
                    throw new Error('Configure TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET (ou salve Keys e APIs da organização) para renovar token do TikTok.');
                }
                this.logger.warn(`[dispatch-tiktok] access token inválido, renovando token e tentando novamente (run=${input.runId})`);
                accessToken = await this.refreshTikTokAccessToken({
                    socialAccountId: input.socialAccountId,
                    refreshTokenEncrypted,
                    currentRefreshTokenEncrypted: refreshTokenEncrypted,
                    tokenEndpoint: config.tokenEndpoint,
                    clientKey: config.clientKey,
                    clientSecret: config.clientSecret,
                });
                const refreshedAccessToken = String(accessToken);
                const publishId = await tryPublish(refreshedAccessToken, false).catch(async (retryError) => {
                    const retryCode = String(retryError?.tiktokCode || '').toLowerCase();
                    if (retryCode ===
                        'unaudited_client_can_only_post_to_private_accounts') {
                        this.logger.warn(`[dispatch-tiktok] retry pós-refresh exigiu privacidade privada (run=${input.runId})`);
                        return tryPublish(refreshedAccessToken, true);
                    }
                    throw retryError;
                });
                return { externalPostId: publishId };
            }
            throw error;
        }
    }
    normalizePlatformPayload(socialNetwork, payload) {
        if (!payload || typeof payload !== 'object')
            return {};
        if (socialNetwork === 'TIKTOK') {
            return {
                title: payload.title ? String(payload.title) : '',
                caption: payload.caption ? String(payload.caption) : '',
                privacy_level: payload.privacy_level
                    ? String(payload.privacy_level).toUpperCase()
                    : '',
                allow_comment: Boolean(payload.allow_comment),
                allow_duet: Boolean(payload.allow_duet),
                allow_stitch: Boolean(payload.allow_stitch),
                commercial_content_enabled: Boolean(payload.commercial_content_enabled),
                brand_organic_toggle: Boolean(payload.brand_organic_toggle),
                brand_content_toggle: Boolean(payload.brand_content_toggle),
            };
        }
        if (socialNetwork === 'YOUTUBE') {
            return {
                title: payload.title ? String(payload.title) : '',
                description: payload.description ? String(payload.description) : '',
                is_shorts: Boolean(payload.is_shorts),
            };
        }
        if (socialNetwork === 'INSTAGRAM') {
            return {
                caption: payload.caption ? String(payload.caption) : '',
                publish_mode: payload.publish_mode
                    ? String(payload.publish_mode).toUpperCase()
                    : 'FEED',
            };
        }
        return payload;
    }
    buildDateRangeFilter(field, from, to) {
        if (!from && !to)
            return {};
        const range = {};
        if (from)
            range.gte = parseIsoDateOrThrow(from, 'from');
        if (to)
            range.lte = parseIsoDateOrThrow(to, 'to');
        return { [field]: range };
    }
    assertWholeHour(value) {
        const valid = value.getMinutes() === 0 &&
            value.getSeconds() === 0 &&
            value.getMilliseconds() === 0;
        if (!valid) {
            throw new common_1.BadRequestException('Somente horários cheios são permitidos (ex.: 17:00, 00:00).');
        }
    }
    buildPostSnapshot(post) {
        const media = Array.isArray(post?.media)
            ? [...post.media]
                .sort((a, b) => (a?.sort_order ?? 0) - (b?.sort_order ?? 0))
                .map((item) => ({
                id: item.id,
                sort_order: item.sort_order,
                media_type: item.media_type,
                mime_type: item.mime_type,
                original_name: item.original_name,
                storage_key: item.storage_key,
                file_size_bytes: item.file_size_bytes,
                width: item.width,
                height: item.height,
                duration_sec: item.duration_sec,
            }))
            : [];
        return {
            id: post.id,
            internal_name: post.internal_name,
            post_type: post.post_type,
            default_title: post.default_title ?? null,
            default_caption: post.default_caption ?? null,
            tags: post.tags ?? null,
            status: post.status ?? null,
            media,
        };
    }
};
exports.SocialPostSchedulesService = SocialPostSchedulesService;
exports.SocialPostSchedulesService = SocialPostSchedulesService = SocialPostSchedulesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        posts_service_1.PostsService,
        social_accounts_crypto_service_1.SocialAccountsCryptoService,
        social_accounts_service_1.SocialAccountsService])
], SocialPostSchedulesService);
//# sourceMappingURL=social-post-schedules.service.js.map