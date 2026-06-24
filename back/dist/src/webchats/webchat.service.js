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
var WebchatsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebchatsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const system_settings_service_1 = require("../system-settings/system-settings.service");
const slug_util_1 = require("../slug/slug.util");
const ADS_POSITIONS = [
    'topo',
    'rodape',
    'intersticial',
    'entre-mensagens',
];
const AD_EVENT_NAMES = [
    'requested',
    'rendered',
    'empty',
    'viewable',
    'clicked',
    'closed',
    'error',
];
let WebchatsService = WebchatsService_1 = class WebchatsService {
    prisma;
    systemSettings;
    logger = new common_1.Logger(WebchatsService_1.name);
    webchatSessionUnavailableLogged = false;
    constructor(prisma, systemSettings) {
        this.prisma = prisma;
        this.systemSettings = systemSettings;
    }
    async create(data) {
        const normalizedDomain = this.normalizeDomain(data.domain);
        if (!normalizedDomain) {
            throw new common_1.BadRequestException('Domínio inválido para o webchat.');
        }
        await this.ensureWebchatDomainRegistered(data.organization_id, normalizedDomain);
        await this.ensureAgentBelongsToOrganization(data.organization_id, data.agent_id);
        if (data.email_project_id) {
            await this.ensureProjectBelongsToOrganization(data.organization_id, data.email_project_id);
        }
        const base = (0, slug_util_1.buildBaseSlugFromWebchatName)(data.name);
        const slug = await (0, slug_util_1.ensureUniqueSlugByDomain)(this.prisma, normalizedDomain, base);
        return this.prisma.webchats.create({
            data: {
                organization_id: data.organization_id,
                agent_id: data.agent_id,
                name: data.name,
                slug,
                domain: normalizedDomain,
                email_project_id: data.email_project_id ?? null,
                active: data.active ?? true,
                settings: data.settings,
                header_scripts: data.header_scripts ?? null,
                ads_config: data.ads_config,
            },
            include: {
                agentes_ia: true,
                email_projects: {
                    select: {
                        id: true,
                        name: true,
                        active: true,
                    },
                },
            },
        });
    }
    async list(organizationId) {
        const query = {
            where: { organization_id: organizationId },
            include: {
                agentes_ia: true,
                email_projects: {
                    select: {
                        id: true,
                        name: true,
                        active: true,
                    },
                },
            },
        };
        try {
            return await this.prisma.webchats.findMany({
                ...query,
                orderBy: { created_at: 'desc' },
            });
        }
        catch (error) {
            if (!this.isMysqlSortMemoryError(error)) {
                throw error;
            }
            this.logger.warn(`MySQL sort buffer exhausted in /webchats for organization ${organizationId}. Falling back to app-side ordering.`);
            const unsorted = await this.prisma.webchats.findMany(query);
            return unsorted.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
        }
    }
    isMysqlSortMemoryError(error) {
        const candidateCodes = [
            error?.code,
            error?.originalCode,
            error?.errno,
            error?.meta?.code,
            error?.meta?.originalCode,
            error?.cause?.code,
            error?.cause?.originalCode,
            error?.cause?.errno,
        ];
        if (candidateCodes.some((value) => String(value) === '1038')) {
            return true;
        }
        const candidateMessages = [
            error?.message,
            error?.originalMessage,
            error?.meta?.message,
            error?.meta?.originalMessage,
            error?.cause?.message,
            error?.cause?.originalMessage,
        ];
        return candidateMessages.some((value) => typeof value === 'string' &&
            value.toLowerCase().includes('out of sort memory'));
    }
    async findOne(organizationId, id) {
        const webchat = await this.prisma.webchats.findFirst({
            where: { id, organization_id: organizationId },
            include: {
                agentes_ia: true,
                email_projects: {
                    select: {
                        id: true,
                        name: true,
                        active: true,
                    },
                },
            },
        });
        if (!webchat)
            throw new common_1.NotFoundException('Webchat não encontrado.');
        return webchat;
    }
    async update(organizationId, id, data) {
        const current = await this.prisma.webchats.findFirst({
            where: { id, organization_id: organizationId },
        });
        if (!current)
            throw new common_1.NotFoundException('Webchat não encontrado');
        const nextName = data.name ?? current.name;
        const nextDomain = data.domain !== undefined
            ? this.normalizeDomain(data.domain)
            : current.domain;
        if (!nextDomain) {
            throw new common_1.BadRequestException('Domínio inválido para o webchat.');
        }
        const nameChanged = nextName !== current.name;
        const domainChanged = nextDomain !== current.domain;
        if (domainChanged) {
            await this.ensureWebchatDomainRegistered(organizationId, nextDomain);
        }
        let nextSlug = current.slug;
        if (nameChanged || domainChanged) {
            const base = (0, slug_util_1.buildBaseSlugFromWebchatName)(nextName);
            nextSlug = await (0, slug_util_1.ensureUniqueSlugByDomain)(this.prisma, nextDomain, base, current.id);
        }
        if (data.agent_id) {
            await this.ensureAgentBelongsToOrganization(organizationId, data.agent_id);
        }
        if (data.email_project_id) {
            await this.ensureProjectBelongsToOrganization(organizationId, data.email_project_id);
        }
        return this.prisma.webchats.update({
            where: { id },
            data: {
                ...(data.name !== undefined ? { name: data.name } : {}),
                ...(data.domain !== undefined ? { domain: nextDomain } : {}),
                ...(data.agent_id !== undefined ? { agent_id: data.agent_id } : {}),
                ...(data.email_project_id !== undefined
                    ? { email_project_id: data.email_project_id }
                    : {}),
                ...(data.settings !== undefined
                    ? { settings: data.settings }
                    : {}),
                ...(data.header_scripts !== undefined
                    ? { header_scripts: data.header_scripts }
                    : {}),
                ...(data.ads_config !== undefined
                    ? { ads_config: data.ads_config }
                    : {}),
                ...(data.active !== undefined ? { active: data.active } : {}),
                ...(nameChanged || domainChanged ? { slug: nextSlug } : {}),
            },
            include: {
                agentes_ia: true,
                email_projects: {
                    select: {
                        id: true,
                        name: true,
                        active: true,
                    },
                },
            },
        });
    }
    async remove(organizationId, id) {
        await this.findOne(organizationId, id);
        try {
            await this.prisma.$transaction(async (tx) => {
                await tx.webchat_leads.deleteMany({
                    where: {
                        organization_id: organizationId,
                        webchat_id: id,
                    },
                });
                await tx.webchats.delete({ where: { id } });
            });
        }
        catch (error) {
            if (error?.code === 'P2003') {
                throw new common_1.BadRequestException('Não é possível excluir este webchat porque há dados vinculados a ele.');
            }
            throw error;
        }
        return { success: true, message: 'Webchat removido com sucesso.' };
    }
    async getAdsConfig(organizationId, webchatId) {
        await this.findOne(organizationId, webchatId);
        return this.readWebchatAdsConfig(organizationId, webchatId);
    }
    async updateAdsConfig(organizationId, webchatId, payload) {
        await this.findOne(organizationId, webchatId);
        const normalized = this.normalizeWebchatAdsPayload(payload);
        await this.prisma.$transaction(async (tx) => {
            const saveSimplePosition = async (position, ad) => {
                if (!ad) {
                    await tx.webchat_ads.deleteMany({
                        where: {
                            organization_id: organizationId,
                            webchat_id: webchatId,
                            position,
                        },
                    });
                    return;
                }
                await tx.webchat_ads.upsert({
                    where: {
                        webchat_id_position: {
                            webchat_id: webchatId,
                            position,
                        },
                    },
                    create: {
                        organization_id: organizationId,
                        webchat_id: webchatId,
                        position,
                        codigo_tag: ad.codigo_tag,
                        gpt_sizes: ad.gpt_sizes,
                        gpt_slot: ad.gpt_slot ?? null,
                        gpt_div_id: ad.gpt_div_id ?? null,
                        anuncio_fixed: ad.anuncio_fixed ?? null,
                        intervalo_mensagens: null,
                        sequence_ads: null,
                        ativo: ad.ativo !== false,
                    },
                    update: {
                        organization_id: organizationId,
                        codigo_tag: ad.codigo_tag,
                        gpt_sizes: ad.gpt_sizes,
                        gpt_slot: ad.gpt_slot ?? null,
                        gpt_div_id: ad.gpt_div_id ?? null,
                        anuncio_fixed: ad.anuncio_fixed ?? null,
                        intervalo_mensagens: null,
                        sequence_ads: null,
                        ativo: ad.ativo !== false,
                    },
                });
            };
            await saveSimplePosition('topo', normalized.topo);
            await saveSimplePosition('rodape', normalized.rodape);
            await saveSimplePosition('intersticial', normalized.intersticial);
            if (!normalized.entre_mensagens) {
                await tx.webchat_ads.deleteMany({
                    where: {
                        organization_id: organizationId,
                        webchat_id: webchatId,
                        position: 'entre-mensagens',
                    },
                });
            }
            else {
                const sequenceAds = normalized.entre_mensagens.sequence_ads;
                const firstSequenceAd = sequenceAds[0] || null;
                await tx.webchat_ads.upsert({
                    where: {
                        webchat_id_position: {
                            webchat_id: webchatId,
                            position: 'entre-mensagens',
                        },
                    },
                    create: {
                        organization_id: organizationId,
                        webchat_id: webchatId,
                        position: 'entre-mensagens',
                        codigo_tag: firstSequenceAd?.codigo_tag || '',
                        gpt_sizes: firstSequenceAd?.gpt_sizes ||
                            this.defaultGptSizes('entre-mensagens'),
                        gpt_slot: firstSequenceAd?.gpt_slot ?? null,
                        gpt_div_id: firstSequenceAd?.gpt_div_id ?? null,
                        anuncio_fixed: firstSequenceAd?.anuncio_fixed ?? null,
                        intervalo_mensagens: normalized.entre_mensagens.intervalo_mensagens,
                        sequence_ads: sequenceAds,
                        ativo: normalized.entre_mensagens.ativo !== false,
                    },
                    update: {
                        organization_id: organizationId,
                        codigo_tag: firstSequenceAd?.codigo_tag || '',
                        gpt_sizes: firstSequenceAd?.gpt_sizes ||
                            this.defaultGptSizes('entre-mensagens'),
                        gpt_slot: firstSequenceAd?.gpt_slot ?? null,
                        gpt_div_id: firstSequenceAd?.gpt_div_id ?? null,
                        anuncio_fixed: firstSequenceAd?.anuncio_fixed ?? null,
                        intervalo_mensagens: normalized.entre_mensagens.intervalo_mensagens,
                        sequence_ads: sequenceAds,
                        ativo: normalized.entre_mensagens.ativo !== false,
                    },
                });
            }
        });
        return this.readWebchatAdsConfig(organizationId, webchatId);
    }
    async getPublicConfig(slug, domainHint) {
        const webchat = await this.resolvePublicWebchat(slug, domainHint);
        const settings = this.asRecord(webchat.settings);
        const adsConfig = await this.resolvePublicAdsConfig(webchat.organization_id, webchat.id, webchat.ads_config, settings);
        const personalizacao = this.resolvePublicPersonalizacao(settings);
        const headerAdsCode = webchat.header_scripts ??
            (typeof settings.header_ads_code === 'string'
                ? settings.header_ads_code
                : null);
        const agent = webchat.agentes_ia
            ? {
                id: webchat.agentes_ia.id,
                name: webchat.agentes_ia.name,
                description: webchat.agentes_ia.description,
                ia_config: webchat.agentes_ia.ia_config,
                active: webchat.agentes_ia.active,
            }
            : null;
        return {
            id: webchat.id,
            name: webchat.name,
            nome: webchat.name,
            slug: webchat.slug,
            domain: webchat.domain,
            dominio: webchat.domain,
            settings,
            header_scripts: webchat.header_scripts ?? null,
            header_ads_code: headerAdsCode,
            ads_config: adsConfig,
            anuncios: adsConfig,
            active: webchat.active,
            ativo: webchat.active,
            agent_id: webchat.agent_id,
            agente_id: webchat.agent_id,
            agent,
            agente: agent
                ? {
                    id: agent.id,
                    nome: agent.name,
                    descricao: agent.description,
                    ia_config: agent.ia_config,
                    active: agent.active,
                }
                : null,
            ia: agent?.ia_config ?? null,
            personalizacao,
            categoria_padrao: typeof settings.categoria_padrao === 'string'
                ? settings.categoria_padrao
                : null,
        };
    }
    async getPublicSessionState(slug, domainHint, sessionIdRaw) {
        const webchat = await this.resolvePublicWebchat(slug, domainHint);
        const normalizedSessionId = this.normalizeSessionId(sessionIdRaw);
        if (!normalizedSessionId) {
            throw new common_1.BadRequestException('session_id é obrigatório.');
        }
        const persistedSessionState = await this.getWebchatSessionState(webchat.organization_id, webchat.id, normalizedSessionId);
        const leadState = this.asRecord(persistedSessionState?.lead_state);
        const conversationHistory = this.normalizeConversationHistoryEntries(persistedSessionState?.conversation_history);
        return {
            success: true,
            webchat_id: webchat.id,
            session_id: normalizedSessionId,
            has_session: Boolean(persistedSessionState),
            lead_state: Object.keys(leadState).length > 0 ? leadState : null,
            conversation_history: conversationHistory,
            messages: this.toConversationPairs(conversationHistory),
        };
    }
    async captureLead(slug, domainHint, dto) {
        const webchat = await this.resolvePublicWebchat(slug, domainHint);
        return this.prisma.$transaction((tx) => this.upsertLeadForWebchat(tx, webchat, dto));
    }
    async sendMessage(slug, domainHint, dto) {
        const webchat = await this.resolvePublicWebchat(slug, domainHint);
        if (!webchat.agentes_ia) {
            throw new common_1.BadRequestException('Webchat sem agente vinculado.');
        }
        const tokenCost = this.getTokenCostPerMessage();
        await this.debitTokensForWebchatMessage(webchat.organization_id, webchat.id, tokenCost, dto.session_id);
        const normalizedSessionId = this.normalizeSessionId(dto.session_id);
        const persistedSessionState = await this.getWebchatSessionState(webchat.organization_id, webchat.id, normalizedSessionId);
        const requestLeadState = this.mergeLeadStateFromSession(persistedSessionState?.lead_state, dto.lead_state);
        const requestConversationHistory = this.mergeConversationHistoryForRequest(persistedSessionState?.conversation_history, dto.conversation_history);
        const serviceUrl = process.env.IA_SERVICE_URL;
        const serviceKey = process.env.IA_SERVICE_KEY;
        if (!serviceUrl || !serviceKey) {
            throw new common_1.InternalServerErrorException('Integração de IA não configurada no backend.');
        }
        const providerKeys = await this.systemSettings.getAiProviderKeysOrFail();
        try {
            const response = await fetch(`${serviceUrl}/api/ia-webchat/reply`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': serviceKey,
                },
                body: JSON.stringify({
                    message: dto.message,
                    session_id: normalizedSessionId ?? null,
                    organization_id: webchat.organization_id,
                    provider_keys: providerKeys,
                    webchat: {
                        id: webchat.id,
                        slug: webchat.slug,
                        domain: webchat.domain,
                    },
                    agent: {
                        id: webchat.agentes_ia.id,
                        name: webchat.agentes_ia.name,
                        description: webchat.agentes_ia.description,
                        ia_config: webchat.agentes_ia.ia_config,
                    },
                    lead_state: Object.keys(this.asRecord(requestLeadState)).length > 0
                        ? requestLeadState
                        : null,
                    conversation_history: requestConversationHistory.length > 0
                        ? requestConversationHistory
                        : null,
                }),
            });
            if (!response.ok) {
                const errorBody = await response.text().catch(() => '');
                const detail = String(errorBody || '').trim();
                const detailSuffix = detail
                    ? ` | detalhe: ${detail.slice(0, 600)}`
                    : '';
                throw new Error(`Micro-serviço retornou status ${response.status}${detailSuffix}`);
            }
            const json = await response.json();
            if (!json.success) {
                throw new Error(json.message || 'Erro desconhecido no micro-serviço de IA.');
            }
            const responseData = this.asRecord(json.data);
            const reply = (typeof responseData.reply === 'string' ? responseData.reply : '') ||
                (typeof responseData.resposta === 'string'
                    ? responseData.resposta
                    : '');
            const settings = this.asRecord(webchat.settings);
            const anuncios = await this.resolvePublicAdsConfig(webchat.organization_id, webchat.id, webchat.ads_config, settings);
            const usage = this.asRecord(responseData.usage);
            const totalTokensRaw = usage.total_tokens;
            const totalTokens = Number.isFinite(Number(totalTokensRaw))
                ? Number(totalTokensRaw)
                : null;
            const model = typeof responseData.model === 'string' ? responseData.model : null;
            const leadCapture = this.normalizeLeadCapture(responseData.lead_capture, requestLeadState);
            const leadCollected = this.asRecord(leadCapture.collected);
            const leadEmail = this.normalizeEmail(leadCollected.email);
            const leadName = this.normalizeLeadName(leadCollected.nome ?? leadCollected.name);
            let persistedLead = null;
            if (leadEmail && leadName) {
                const customFields = this.extractCustomLeadFields(leadCollected, leadCapture.required_fields);
                const context = {
                    ...this.asRecord(dto.context),
                    domain: this.normalizeDomain(domainHint) ||
                        this.normalizeDomain(webchat.domain),
                    lead_capture: leadCapture,
                };
                persistedLead = (await this.prisma.$transaction((tx) => this.upsertLeadForWebchat(tx, webchat, {
                    email: leadEmail,
                    name: leadName ?? undefined,
                    source: 'webchat',
                    session_id: normalizedSessionId ?? undefined,
                    context,
                    custom_fields: customFields,
                })));
            }
            const leadCaptureWithPersistence = {
                ...leadCapture,
                persisted: Boolean(persistedLead),
                persisted_lead_id: persistedLead?.lead_id ?? null,
                routed_to: persistedLead?.routed_to ?? null,
            };
            const nextSessionHistory = this.buildConversationHistoryForPersistence(requestConversationHistory, dto.message, reply);
            if (normalizedSessionId) {
                await this.upsertWebchatSessionState(webchat.organization_id, webchat.id, normalizedSessionId, leadCapture, nextSessionHistory);
            }
            const sessionState = normalizedSessionId
                ? {
                    session_id: normalizedSessionId,
                    lead_state: leadCapture,
                    conversation_history: nextSessionHistory,
                }
                : null;
            responseData.lead_capture = leadCaptureWithPersistence;
            responseData.session_state = sessionState;
            return {
                success: true,
                sucesso: true,
                data: responseData,
                reply,
                resposta: reply,
                modelo: model,
                tokens: totalTokens,
                anuncios,
                lead_capture: leadCaptureWithPersistence,
                session_state: sessionState,
                meta: {
                    webchat_id: webchat.id,
                    agent_id: webchat.agent_id,
                    tokens_charged: tokenCost,
                },
            };
        }
        catch (error) {
            const detail = String(error?.message || error || 'erro desconhecido');
            this.logger.error(`Falha ao processar mensagem do webchat com IA para webchat ${webchat.id}: ${detail}`);
            throw new common_1.HttpException(process.env.NODE_ENV === 'production'
                ? 'Falha ao processar mensagem do webchat com IA.'
                : `Falha ao processar mensagem do webchat com IA. Detalhe: ${detail}`, common_1.HttpStatus.BAD_GATEWAY);
        }
    }
    async trackPublicAdEvents(slug, domainHint, dto) {
        const webchat = await this.resolvePublicWebchat(slug, domainHint);
        const sourceEvents = Array.isArray(dto?.events) ? dto.events : [];
        if (sourceEvents.length === 0) {
            return {
                success: true,
                stored: 0,
            };
        }
        const normalizedSessionId = this.normalizeSessionId(dto.session_id);
        const payloadDomain = this.normalizeDomain(dto.domain) ||
            this.normalizeDomain(domainHint) ||
            this.normalizeDomain(webchat.domain);
        const rows = sourceEvents
            .slice(0, 50)
            .map((eventRaw) => {
            const event = this.asRecord(eventRaw);
            const eventName = String(event.event_name ?? '')
                .trim()
                .toLowerCase();
            const adPosition = String(event.ad_position ?? '')
                .trim()
                .toLowerCase();
            if (!AD_EVENT_NAMES.includes(eventName)) {
                return null;
            }
            if (!ADS_POSITIONS.includes(adPosition)) {
                return null;
            }
            const adKeyRaw = String(event.ad_key ?? '').trim();
            const payload = this.asRecord(event.payload);
            return {
                organization_id: webchat.organization_id,
                webchat_id: webchat.id,
                session_id: normalizedSessionId ?? null,
                domain: payloadDomain || null,
                ad_position: adPosition,
                event_name: eventName,
                ad_key: adKeyRaw || null,
                payload: Object.keys(payload).length > 0 ? payload : null,
            };
        })
            .filter(Boolean);
        if (rows.length === 0) {
            return {
                success: true,
                stored: 0,
            };
        }
        await this.prisma.webchat_ad_events.createMany({
            data: rows,
        });
        return {
            success: true,
            stored: rows.length,
        };
    }
    async upsertLeadForWebchat(tx, webchat, dto) {
        const normalizedEmail = this.normalizeEmail(dto.email);
        if (!normalizedEmail) {
            throw new common_1.BadRequestException('E-mail inválido para captura de lead.');
        }
        const normalizedName = this.normalizeLeadName(dto.name);
        if (webchat.email_project_id) {
            let emailLead = await tx.email_leads.findFirst({
                where: {
                    organization_id: webchat.organization_id,
                    email: normalizedEmail,
                },
            });
            const mergedAttributes = {
                phone: dto.phone ?? null,
                source: dto.source ?? 'webchat',
                session_id: dto.session_id ?? null,
                context: dto.context ?? null,
                custom_fields: dto.custom_fields ?? null,
                webchat_id: webchat.id,
                webchat_slug: webchat.slug,
                webchat_domain: webchat.domain,
            };
            if (!emailLead) {
                emailLead = await tx.email_leads.create({
                    data: {
                        organization_id: webchat.organization_id,
                        email: normalizedEmail,
                        name: normalizedName ?? null,
                        attributes: mergedAttributes,
                    },
                });
            }
            else {
                await tx.email_leads.update({
                    where: { id: emailLead.id },
                    data: {
                        ...(normalizedName ? { name: normalizedName } : {}),
                        attributes: {
                            ...(emailLead.attributes || {}),
                            ...mergedAttributes,
                        },
                    },
                });
            }
            const existingRelation = await tx.email_project_leads.findFirst({
                where: {
                    project_id: webchat.email_project_id,
                    lead_id: emailLead.id,
                },
            });
            if (!existingRelation) {
                await tx.email_project_leads.create({
                    data: {
                        project_id: webchat.email_project_id,
                        lead_id: emailLead.id,
                        status: 'SUBSCRIBED',
                    },
                });
            }
            return {
                success: true,
                routed_to: 'email_project',
                lead_id: emailLead.id,
                deduplicated: Boolean(existingRelation),
            };
        }
        const existingWebchatLead = await tx.webchat_leads.findFirst({
            where: {
                organization_id: webchat.organization_id,
                webchat_id: webchat.id,
                email: normalizedEmail,
            },
        });
        if (existingWebchatLead) {
            const updatedLead = await tx.webchat_leads.update({
                where: { id: existingWebchatLead.id },
                data: {
                    ...(normalizedName ? { name: normalizedName } : {}),
                    phone: dto.phone ?? existingWebchatLead.phone,
                    source: dto.source ?? existingWebchatLead.source,
                    session_id: dto.session_id ?? existingWebchatLead.session_id,
                    context: dto.context !== undefined
                        ? dto.context
                        : existingWebchatLead.context,
                    custom_fields: dto.custom_fields !== undefined
                        ? dto.custom_fields
                        : existingWebchatLead.custom_fields,
                },
            });
            return {
                success: true,
                routed_to: 'webchat',
                lead_id: updatedLead.id,
                deduplicated: true,
            };
        }
        const lead = await tx.webchat_leads.create({
            data: {
                organization_id: webchat.organization_id,
                webchat_id: webchat.id,
                email: normalizedEmail,
                name: normalizedName ?? null,
                phone: dto.phone ?? null,
                source: dto.source ?? 'webchat',
                session_id: dto.session_id ?? null,
                context: dto.context ?? null,
                custom_fields: dto.custom_fields ?? null,
            },
        });
        return {
            success: true,
            routed_to: 'webchat',
            lead_id: lead.id,
            deduplicated: false,
        };
    }
    getSessionHistoryLimit() {
        const raw = process.env.WEBCHAT_SESSION_HISTORY_LIMIT ||
            process.env.WEBCHAT_HISTORY_LIMIT ||
            '24';
        const parsed = Number.parseInt(raw, 10);
        if (!Number.isFinite(parsed) || parsed < 4)
            return 24;
        return Math.min(parsed, 100);
    }
    normalizeSessionId(value) {
        const sessionId = String(value ?? '').trim();
        if (!sessionId)
            return null;
        return sessionId.slice(0, 100);
    }
    normalizeConversationHistoryRole(rawRole) {
        const role = String(rawRole ?? '')
            .trim()
            .toLowerCase();
        if (['assistant', 'bot', 'model', 'ai'].includes(role))
            return 'assistant';
        if (['user', 'human', 'client', 'cliente'].includes(role))
            return 'user';
        return '';
    }
    normalizeConversationHistoryEntries(rawHistory) {
        const source = Array.isArray(rawHistory) ? rawHistory : [];
        const maxHistory = this.getSessionHistoryLimit();
        const normalized = source
            .map((entry) => this.asRecord(entry))
            .map((entry) => {
            const role = this.normalizeConversationHistoryRole(entry.role ?? entry.type);
            const content = String(entry.content ?? entry.message ?? entry.text ?? '').trim();
            if (!role || !content)
                return null;
            return { role, content: content.slice(0, 4000) };
        })
            .filter(Boolean);
        if (normalized.length === 0)
            return [];
        const deduped = [];
        normalized.forEach((entry) => {
            const previous = deduped[deduped.length - 1];
            if (previous &&
                previous.role === entry.role &&
                previous.content === entry.content) {
                return;
            }
            deduped.push(entry);
        });
        return deduped.slice(-maxHistory);
    }
    mergeConversationHistoryForRequest(sessionHistoryRaw, clientHistoryRaw) {
        const sessionHistory = this.normalizeConversationHistoryEntries(sessionHistoryRaw);
        const clientHistory = this.normalizeConversationHistoryEntries(clientHistoryRaw);
        if (sessionHistory.length === 0)
            return clientHistory;
        if (clientHistory.length === 0)
            return sessionHistory;
        if (clientHistory.length < sessionHistory.length) {
            return sessionHistory;
        }
        return this.normalizeConversationHistoryEntries([
            ...sessionHistory,
            ...clientHistory,
        ]);
    }
    buildConversationHistoryForPersistence(baseHistoryRaw, userMessageRaw, assistantMessageRaw) {
        const baseHistory = this.normalizeConversationHistoryEntries(baseHistoryRaw);
        const userMessage = String(userMessageRaw ?? '').trim();
        const assistantMessage = String(assistantMessageRaw ?? '').trim();
        const turnEntries = [];
        if (userMessage) {
            turnEntries.push({ role: 'user', content: userMessage.slice(0, 4000) });
        }
        if (assistantMessage) {
            turnEntries.push({
                role: 'assistant',
                content: assistantMessage.slice(0, 4000),
            });
        }
        if (turnEntries.length === 0)
            return baseHistory;
        return this.normalizeConversationHistoryEntries([
            ...baseHistory,
            ...turnEntries,
        ]);
    }
    toConversationPairs(historyRaw) {
        const history = this.normalizeConversationHistoryEntries(historyRaw);
        const pairs = [];
        history.forEach((entry) => {
            const role = String(entry.role || '')
                .trim()
                .toLowerCase();
            const content = String(entry.content || '').trim();
            if (!content)
                return;
            const current = pairs[pairs.length - 1];
            if (role === 'assistant') {
                if (current && !current.chat) {
                    current.chat = content;
                    return;
                }
                pairs.push({ chat: content, lead: '' });
                return;
            }
            if (current && !current.lead) {
                current.lead = content;
                return;
            }
            pairs.push({ chat: '', lead: content });
        });
        return pairs;
    }
    hasMeaningfulLeadState(rawState) {
        const state = this.asRecord(rawState);
        if (Object.keys(state).length === 0)
            return false;
        if (Object.keys(this.asRecord(state.collected)).length > 0)
            return true;
        if (Object.keys(this.asRecord(state.attempts)).length > 0)
            return true;
        if (Boolean(state.released) || Boolean(state.capture_completed))
            return true;
        return (typeof state.next_field === 'string' && state.next_field.trim().length > 0);
    }
    mergeLeadStateFromSession(sessionLeadStateRaw, clientLeadStateRaw) {
        const sessionLeadState = this.asRecord(sessionLeadStateRaw);
        const clientLeadState = this.asRecord(clientLeadStateRaw);
        if (Object.keys(sessionLeadState).length === 0)
            return clientLeadState;
        if (!this.hasMeaningfulLeadState(clientLeadState))
            return sessionLeadState;
        const merged = this.normalizeLeadCapture(clientLeadState, sessionLeadState);
        const sessionAttempts = this.asRecord(sessionLeadState.attempts);
        const clientAttempts = this.asRecord(clientLeadState.attempts);
        const mergedAttempts = { ...sessionAttempts };
        Object.entries(clientAttempts).forEach(([key, value]) => {
            const current = Number(mergedAttempts[key]);
            const next = Number(value);
            if (!Number.isFinite(next))
                return;
            mergedAttempts[key] = Number.isFinite(current)
                ? Math.max(current, next)
                : next;
        });
        merged.attempts = mergedAttempts;
        merged.released =
            Boolean(sessionLeadState.released) ||
                Boolean(clientLeadState.released) ||
                Boolean(merged.released);
        merged.capture_completed =
            Boolean(sessionLeadState.capture_completed) ||
                Boolean(clientLeadState.capture_completed) ||
                Boolean(merged.capture_completed);
        if (!merged.next_field && typeof sessionLeadState.next_field === 'string') {
            merged.next_field = sessionLeadState.next_field;
        }
        return merged;
    }
    isWebchatSessionPersistenceUnavailable(error) {
        if (!error)
            return false;
        if (error?.code === 'P2021' || error?.code === 'P2022')
            return true;
        const message = String(error?.message || '').toLowerCase();
        if (!message)
            return false;
        return (message.includes('webchat_sessions') ||
            (message.includes('table') && message.includes("doesn't exist")));
    }
    logWebchatSessionPersistenceUnavailable(action, error) {
        if (this.webchatSessionUnavailableLogged)
            return;
        this.webchatSessionUnavailableLogged = true;
        this.logger.warn(`Persistência de sessão de webchat indisponível (${action}). O chat seguirá sem memória de sessão até aplicar migrações. Detalhe: ${error?.code || error?.message || 'erro desconhecido'}`);
    }
    async getWebchatSessionState(organizationId, webchatId, sessionId) {
        if (!sessionId)
            return null;
        try {
            const row = await this.prisma.webchat_sessions.findUnique({
                where: {
                    webchat_id_session_id: {
                        webchat_id: webchatId,
                        session_id: sessionId,
                    },
                },
                select: {
                    organization_id: true,
                    lead_state: true,
                    conversation_history: true,
                },
            });
            if (!row || row.organization_id !== organizationId)
                return null;
            return row;
        }
        catch (error) {
            if (this.isWebchatSessionPersistenceUnavailable(error)) {
                this.logWebchatSessionPersistenceUnavailable('read', error);
                return null;
            }
            throw error;
        }
    }
    async upsertWebchatSessionState(organizationId, webchatId, sessionId, leadStateRaw, conversationHistoryRaw) {
        const leadState = this.asRecord(leadStateRaw);
        const conversationHistory = this.normalizeConversationHistoryEntries(conversationHistoryRaw);
        try {
            await this.prisma.webchat_sessions.upsert({
                where: {
                    webchat_id_session_id: {
                        webchat_id: webchatId,
                        session_id: sessionId,
                    },
                },
                create: {
                    organization_id: organizationId,
                    webchat_id: webchatId,
                    session_id: sessionId,
                    lead_state: Object.keys(leadState).length > 0 ? leadState : null,
                    conversation_history: conversationHistory.length > 0
                        ? conversationHistory
                        : null,
                },
                update: {
                    lead_state: Object.keys(leadState).length > 0 ? leadState : null,
                    conversation_history: conversationHistory.length > 0
                        ? conversationHistory
                        : null,
                },
            });
        }
        catch (error) {
            if (this.isWebchatSessionPersistenceUnavailable(error)) {
                this.logWebchatSessionPersistenceUnavailable('write', error);
                return;
            }
            throw error;
        }
    }
    normalizeLeadCapture(leadCaptureRaw, currentLeadStateRaw) {
        const fromIa = this.asRecord(leadCaptureRaw);
        const fromClient = this.asRecord(currentLeadStateRaw);
        const collected = {
            ...this.asRecord(fromClient.collected),
            ...this.asRecord(fromIa.collected),
        };
        const attempts = {
            ...this.asRecord(fromClient.attempts),
            ...this.asRecord(fromIa.attempts),
        };
        const requiredFields = Array.isArray(fromIa.required_fields)
            ? fromIa.required_fields
            : Array.isArray(fromClient.required_fields)
                ? fromClient.required_fields
                : [];
        const missingRequiredFields = Array.isArray(fromIa.missing_required_fields)
            ? fromIa.missing_required_fields
            : [];
        return {
            ...fromClient,
            ...fromIa,
            required_fields: requiredFields,
            collected,
            attempts,
            missing_required_fields: missingRequiredFields,
            captured_fields: this.asRecord(fromIa.captured_fields),
            max_attempts: Number.isFinite(Number(fromIa.max_attempts))
                ? Number(fromIa.max_attempts)
                : Number.isFinite(Number(fromClient.max_attempts))
                    ? Number(fromClient.max_attempts)
                    : 3,
            allow_continue_after_attempts: fromIa.allow_continue_after_attempts !== undefined
                ? Boolean(fromIa.allow_continue_after_attempts)
                : fromClient.allow_continue_after_attempts !== false,
            released: Boolean(fromIa.released ?? fromClient.released),
            capture_completed: Boolean(fromIa.capture_completed ?? fromClient.capture_completed),
            next_field: typeof fromIa.next_field === 'string' ? fromIa.next_field : null,
        };
    }
    normalizeEmail(value) {
        const email = String(value ?? '')
            .trim()
            .toLowerCase();
        if (!email)
            return '';
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        return isValid ? email : '';
    }
    normalizeLeadName(value) {
        const name = String(value ?? '').trim();
        if (!name)
            return null;
        if (name.length < 2)
            return null;
        if (this.normalizeEmail(name))
            return null;
        return name.slice(0, 255);
    }
    normalizeLeadFieldKey(value) {
        const key = String(value ?? '')
            .trim()
            .toLowerCase();
        if (!key)
            return '';
        if (['name', 'first_name', 'firstname'].includes(key))
            return 'nome';
        if (['e-mail', 'mail'].includes(key))
            return 'email';
        if (['phone', 'celular', 'whatsapp'].includes(key))
            return 'telefone';
        return key.replace(/[^a-z0-9_]/g, '_').slice(0, 80);
    }
    normalizeLeadRequiredFieldKeys(requiredFieldsRaw) {
        if (!Array.isArray(requiredFieldsRaw))
            return [];
        return requiredFieldsRaw
            .map((field) => this.asRecord(field))
            .filter((field) => field.required !== false && field.obrigatorio !== false)
            .map((field) => this.normalizeLeadFieldKey(field.key ?? field.name ?? field.nome))
            .filter((key) => Boolean(key));
    }
    extractCustomLeadFields(collectedRaw, requiredFieldsRaw) {
        const collected = this.asRecord(collectedRaw);
        const requiredKeys = new Set(this.normalizeLeadRequiredFieldKeys(requiredFieldsRaw));
        const ignored = new Set(['nome', 'email', 'telefone']);
        const custom = {};
        Object.entries(collected).forEach(([rawKey, value]) => {
            const key = this.normalizeLeadFieldKey(rawKey);
            if (!key || ignored.has(key) || requiredKeys.has(key))
                return;
            const text = String(value ?? '').trim();
            if (!text)
                return;
            custom[key] = text.slice(0, 255);
        });
        return custom;
    }
    async ensureAgentBelongsToOrganization(organizationId, agentId) {
        const agent = await this.prisma.agentes_ia.findFirst({
            where: { id: agentId, organization_id: organizationId, active: true },
            select: { id: true },
        });
        if (!agent) {
            throw new common_1.BadRequestException('Agente inválido ou não pertence à organização.');
        }
    }
    async ensureProjectBelongsToOrganization(organizationId, projectId) {
        const project = await this.prisma.email_projects.findFirst({
            where: { id: projectId, organization_id: organizationId, active: true },
            select: { id: true },
        });
        if (!project) {
            throw new common_1.BadRequestException('Projeto de e-mail inválido ou não pertence à organização.');
        }
    }
    async ensureWebchatDomainRegistered(organizationId, domain) {
        const normalizedDomain = this.normalizeDomain(domain);
        if (!normalizedDomain) {
            throw new common_1.BadRequestException('Domínio inválido para o webchat.');
        }
        const webchatDomain = await this.prisma.webchat_domains.findFirst({
            where: {
                organization_id: organizationId,
                domain: normalizedDomain,
            },
            select: {
                id: true,
                status: true,
            },
        });
        if (!webchatDomain) {
            throw new common_1.BadRequestException('Domínio de webchat não cadastrado para sua organização. Acesse Configurações > Conta & Domínios > Webchat.');
        }
    }
    normalizeDomain(domain) {
        if (!domain)
            return '';
        return domain
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .split('/')[0]
            .split(':')[0];
    }
    asRecord(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {};
        }
        return value;
    }
    resolvePublicPersonalizacao(settings) {
        if (settings.personalizacao &&
            typeof settings.personalizacao === 'object' &&
            !Array.isArray(settings.personalizacao)) {
            return settings.personalizacao;
        }
        const hasLegacyRootShape = settings.theme ||
            settings.header ||
            settings.welcomeScreen ||
            settings.quickReplies ||
            settings.welcomeBotMessage;
        if (hasLegacyRootShape) {
            return settings;
        }
        return null;
    }
    defaultGptSizes(position) {
        if (position === 'entre-mensagens')
            return '[300,100]';
        return '[320,100]';
    }
    normalizeGptSizes(rawValue, position) {
        if (Array.isArray(rawValue)) {
            return JSON.stringify(rawValue);
        }
        const value = String(rawValue ?? '').trim();
        if (!value)
            return this.defaultGptSizes(position);
        const compact = value.replace(/\s+/g, '');
        const match = compact.match(/^(\d{2,4})x(\d{2,4})$/i);
        if (match)
            return `[${match[1]},${match[2]}]`;
        return value;
    }
    looksLikeHtmlSnippet(rawValue) {
        const value = String(rawValue ?? '').trim();
        if (!value)
            return false;
        return (/<\/?[a-z][\s\S]*>/i.test(value) || /&lt;\/?[a-z][\s\S]*&gt;/i.test(value));
    }
    extractGptSlotFromCode(rawCode) {
        const source = String(rawCode ?? '');
        const fromDefineSlot = source.match(/defineSlot\(\s*['"]([^'"]+)['"]/i)?.[1];
        if (fromDefineSlot)
            return String(fromDefineSlot).trim();
        const compact = String(rawCode ?? '').trim();
        if (compact.startsWith('/') && !this.looksLikeHtmlSnippet(compact)) {
            return compact;
        }
        return '';
    }
    extractGptDivIdFromCode(rawCode) {
        const source = String(rawCode ?? '');
        const fromDefineSlot = source.match(/defineSlot\(\s*['"][^'"]+['"]\s*,\s*\[[^\]]+\]\s*,\s*['"]([^'"]+)['"]/i)?.[1];
        if (fromDefineSlot)
            return String(fromDefineSlot).trim();
        const fromDisplay = source.match(/display\(\s*['"]([^'"]+)['"]\s*\)/i)?.[1];
        if (fromDisplay)
            return String(fromDisplay).trim();
        return '';
    }
    normalizeAdContract(rawAd, position) {
        const code = String(rawAd.codigo_tag ?? rawAd.codigo ?? '').trim();
        const explicitSlot = String(rawAd.gpt_slot ?? '').trim();
        const explicitDivId = String(rawAd.gpt_div_id ?? '').trim();
        const explicitFixed = String(rawAd.anuncio_fixed ?? rawAd.html ?? '').trim();
        const gptSizes = this.normalizeGptSizes(rawAd.gpt_sizes, position);
        const inferredSlot = explicitSlot || this.extractGptSlotFromCode(code);
        const inferredDivId = explicitDivId || this.extractGptDivIdFromCode(code);
        const inferredFixed = explicitFixed ||
            (!inferredSlot && this.looksLikeHtmlSnippet(code) ? code : '');
        const storageCode = code || inferredSlot || inferredFixed;
        const hasLegacyCode = Boolean(code);
        const hasFixed = Boolean(inferredFixed);
        const hasGptContract = Boolean(inferredSlot && gptSizes);
        if (!hasLegacyCode && !hasFixed && !hasGptContract) {
            return null;
        }
        return {
            codigo_tag: storageCode,
            codigo: storageCode,
            gpt_slot: inferredSlot || null,
            gpt_div_id: inferredDivId || null,
            anuncio_fixed: inferredFixed || null,
            gpt_sizes: gptSizes,
            ativo: rawAd.ativo !== false,
        };
    }
    normalizeSimpleAdPayload(rawAd, position) {
        const ad = this.asRecord(rawAd);
        return this.normalizeAdContract(ad, position);
    }
    normalizeSequenceEntry(rawEntry, index = 0) {
        const entry = this.asRecord(rawEntry);
        const normalized = this.normalizeAdContract(entry, 'entre-mensagens');
        if (!normalized)
            return null;
        const idRaw = String(entry.id ?? '').trim();
        return {
            id: idRaw || `seq_${index + 1}`,
            codigo_tag: normalized.codigo_tag,
            codigo: normalized.codigo_tag,
            gpt_slot: normalized.gpt_slot,
            gpt_div_id: normalized.gpt_div_id,
            anuncio_fixed: normalized.anuncio_fixed,
            gpt_sizes: normalized.gpt_sizes,
            ativo: normalized.ativo !== false,
        };
    }
    normalizeWebchatAdsPayload(payloadRaw) {
        const payload = this.asRecord(payloadRaw);
        const topo = this.normalizeSimpleAdPayload(payload.topo, 'topo');
        const rodape = this.normalizeSimpleAdPayload(payload.rodape, 'rodape');
        const intersticial = this.normalizeSimpleAdPayload(payload.intersticial, 'intersticial');
        const betweenSource = this.asRecord(payload.entre_mensagens ?? payload['entre-mensagens']);
        const sequenceSource = Array.isArray(betweenSource.sequence_ads)
            ? betweenSource.sequence_ads
            : [];
        const sequenceAds = sequenceSource
            .map((entry, index) => this.normalizeSequenceEntry(entry, index))
            .filter(Boolean);
        const betweenCodeOnly = this.normalizeSequenceEntry(betweenSource, 0);
        if (sequenceAds.length === 0 && betweenCodeOnly) {
            sequenceAds.push(betweenCodeOnly);
        }
        const entreMensagens = sequenceAds.length > 0
            ? {
                ativo: betweenSource.ativo !== false,
                intervalo_mensagens: (() => {
                    const intervalRaw = Number(betweenSource.intervalo_mensagens);
                    if (!Number.isFinite(intervalRaw) || intervalRaw <= 0) {
                        throw new common_1.BadRequestException('intervalo_mensagens deve ser maior que zero.');
                    }
                    return Math.floor(intervalRaw);
                })(),
                sequence_ads: sequenceAds,
            }
            : null;
        return {
            topo,
            rodape,
            intersticial,
            entre_mensagens: entreMensagens,
        };
    }
    formatWebchatAdsRowsAsConfig(rowsRaw) {
        const rows = Array.isArray(rowsRaw) ? rowsRaw : [];
        const config = {};
        rows.forEach((rowRaw) => {
            const row = this.asRecord(rowRaw);
            const position = String(row.position ?? '')
                .trim()
                .toLowerCase();
            if (!ADS_POSITIONS.includes(position))
                return;
            if (position === 'entre-mensagens') {
                const sequenceSource = Array.isArray(row.sequence_ads)
                    ? row.sequence_ads
                    : [];
                const sequenceAds = sequenceSource
                    .map((entry, index) => this.normalizeSequenceEntry(entry, index))
                    .filter(Boolean);
                if (sequenceAds.length === 0 && String(row.codigo_tag ?? '').trim()) {
                    const fallback = this.normalizeSequenceEntry({
                        id: 'seq_1',
                        codigo_tag: row.codigo_tag,
                        gpt_slot: row.gpt_slot,
                        gpt_div_id: row.gpt_div_id,
                        anuncio_fixed: row.anuncio_fixed,
                        gpt_sizes: row.gpt_sizes,
                        ativo: row.ativo !== false,
                    }, 0);
                    if (fallback)
                        sequenceAds.push(fallback);
                }
                const intervalRaw = Number(row.intervalo_mensagens);
                const intervaloMensagens = Number.isFinite(intervalRaw) && intervalRaw > 0
                    ? Math.floor(intervalRaw)
                    : 1;
                const between = {
                    posicionamento: 'entre-mensagens',
                    ativo: row.ativo !== false,
                    intervalo_mensagens: intervaloMensagens,
                    sequence_ads: sequenceAds,
                    codigo_tag: sequenceAds[0]?.codigo_tag ?? '',
                    codigo: sequenceAds[0]?.codigo_tag ?? '',
                    gpt_slot: sequenceAds[0]?.gpt_slot ?? null,
                    gpt_div_id: sequenceAds[0]?.gpt_div_id ?? null,
                    anuncio_fixed: sequenceAds[0]?.anuncio_fixed ?? null,
                    gpt_sizes: sequenceAds[0]?.gpt_sizes ??
                        this.defaultGptSizes('entre-mensagens'),
                };
                config['entre-mensagens'] = between;
                config.entre_mensagens = between;
                return;
            }
            const normalized = this.normalizeAdContract(row, position);
            if (!normalized)
                return;
            config[position] = {
                posicionamento: position,
                ativo: row.ativo !== false,
                codigo_tag: normalized.codigo_tag,
                codigo: normalized.codigo_tag,
                gpt_slot: normalized.gpt_slot,
                gpt_div_id: normalized.gpt_div_id,
                anuncio_fixed: normalized.anuncio_fixed,
                gpt_sizes: normalized.gpt_sizes,
            };
        });
        return config;
    }
    async readWebchatAdsConfig(organizationId, webchatId) {
        const rows = await this.prisma.webchat_ads.findMany({
            where: {
                organization_id: organizationId,
                webchat_id: webchatId,
            },
            orderBy: { created_at: 'asc' },
        });
        return this.formatWebchatAdsRowsAsConfig(rows);
    }
    async resolvePublicAdsConfig(organizationId, webchatId, adsConfigRaw, settings) {
        const fromTable = await this.readWebchatAdsConfig(organizationId, webchatId);
        if (Object.keys(fromTable).length > 0) {
            return fromTable;
        }
        const adsConfig = this.asRecord(adsConfigRaw);
        if (Object.keys(adsConfig).length > 0) {
            return adsConfig;
        }
        const fromSettings = this.asRecord(settings.anuncios);
        if (Object.keys(fromSettings).length > 0) {
            return fromSettings;
        }
        return {};
    }
    async resolvePublicWebchat(slug, domainHint) {
        const normalizedDomain = this.normalizeDomain(domainHint);
        if (normalizedDomain) {
            const scoped = await this.prisma.webchats.findFirst({
                where: {
                    slug,
                    domain: normalizedDomain,
                    active: true,
                },
                include: {
                    agentes_ia: true,
                },
            });
            if (scoped)
                return scoped;
        }
        const webchatsBySlug = await this.prisma.webchats.findMany({
            where: { slug, active: true },
            include: {
                agentes_ia: true,
            },
            take: 2,
        });
        if (webchatsBySlug.length === 0) {
            throw new common_1.NotFoundException('Webchat não encontrado.');
        }
        if (webchatsBySlug.length > 1) {
            throw new common_1.BadRequestException('Webchat ambíguo para este slug. Informe o domínio no header x-webchat-domain.');
        }
        return webchatsBySlug[0];
    }
    getTokenCostPerMessage() {
        const raw = process.env.WEBCHAT_TOKENS_PER_MESSAGE ||
            process.env.WEBCHAT_TOKEN_COST_PER_MESSAGE ||
            '1000';
        const parsed = Number.parseInt(raw, 10);
        return parsed;
    }
    async debitTokensForWebchatMessage(organizationId, webchatId, cost, sessionId) {
        await this.prisma.$transaction(async (tx) => {
            const wallet = await tx.wallets.findFirst({
                where: {
                    organization_id: organizationId,
                    status: 'ACTIVE',
                },
                select: { id: true },
            });
            if (!wallet) {
                throw new common_1.BadRequestException('Carteira da organização não encontrada ou inativa.');
            }
            const updated = await tx.wallets.updateMany({
                where: {
                    id: wallet.id,
                    status: 'ACTIVE',
                    balance: { gte: cost },
                },
                data: {
                    balance: { decrement: cost },
                },
            });
            if (updated.count === 0) {
                throw new common_1.HttpException('Saldo de tokens insuficiente para enviar mensagem no webchat.', common_1.HttpStatus.PAYMENT_REQUIRED);
            }
            await tx.transactions.create({
                data: {
                    wallet_id: wallet.id,
                    amount: -cost,
                    type: 'WEBCHAT_MESSAGE_IA',
                    description: `Webchat ${webchatId}${sessionId ? ` | session ${sessionId}` : ''}`,
                },
            });
        });
    }
};
exports.WebchatsService = WebchatsService;
exports.WebchatsService = WebchatsService = WebchatsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        system_settings_service_1.SystemSettingsService])
], WebchatsService);
//# sourceMappingURL=webchat.service.js.map