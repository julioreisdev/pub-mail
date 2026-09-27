import {
  ServiceUnavailableException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { cleanEmailOrNull } from '../common/email.util';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { AccessService } from '../platform-billing/access.service';
import {
  buildBaseSlugFromWebchatName,
  ensureUniqueSlugByDomain,
} from '../slug/slug.util';
import { WebchatSplitsService } from '../webchat-splits/webchat-splits.service';
import { CreateWebchatDto } from './dto/create-webchat.dto';
import { UpdateWebchatAdsDto } from './dto/update-webchat-ads.dto';
import { UpdateWebchatDto } from './dto/update-webchat.dto';
import { CaptureWebchatLeadDto } from './dto/capture-webchat-lead.dto';
import { SendWebchatMessageDto } from './dto/send-webchat-message.dto';
import { TrackWebchatAdEventsDto } from './dto/track-webchat-ad-events.dto';

const ADS_POSITIONS = [
  'topo',
  'rodape',
  'intersticial',
  'entre-mensagens',
] as const;
type AdsPosition = (typeof ADS_POSITIONS)[number];
const AD_EVENT_NAMES = [
  'requested',
  'rendered',
  'empty',
  'viewable',
  'clicked',
  'closed',
  'error',
] as const;

@Injectable()
export class WebchatsService {
  private readonly logger = new Logger(WebchatsService.name);
  private webchatSessionUnavailableLogged = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettings: SystemSettingsService,
    private readonly splits: WebchatSplitsService,
    private readonly access: AccessService,
  ) { }

  async create(data: CreateWebchatDto & { organization_id: string }) {
    const normalizedDomain = this.normalizeDomain(data.domain);
    if (!normalizedDomain) {
      throw new BadRequestException('Domínio inválido para o webchat.');
    }
    await this.ensureWebchatDomainRegistered(
      data.organization_id,
      normalizedDomain,
    );

    await this.ensureAgentBelongsToOrganization(
      data.organization_id,
      data.agent_id,
    );

    if (data.email_project_id) {
      await this.ensureProjectBelongsToOrganization(
        data.organization_id,
        data.email_project_id,
      );
    }

    const base = buildBaseSlugFromWebchatName(data.name);
    const slug = await ensureUniqueSlugByDomain(
      this.prisma,
      normalizedDomain,
      base,
    );

    const splitId = await this.splits.resolveSplitIdForOrg(
      data.organization_id,
      data.split_id ?? null,
    );

    return this.prisma.webchats.create({
      data: {
        organization_id: data.organization_id,
        agent_id: data.agent_id,
        name: data.name,
        slug,
        domain: normalizedDomain,
        email_project_id: data.email_project_id ?? null,
        active: data.active ?? true,
        settings: data.settings as any,
        header_scripts: data.header_scripts ?? null,
        footer_scripts: data.footer_scripts ?? null,
        ads_config: data.ads_config as any,
        split_id: splitId,
        split_weight:
          typeof data.split_weight === 'number' ? data.split_weight : 100,
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

  async list(organizationId: string) {
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
    } catch (error: any) {
      if (!this.isMysqlSortMemoryError(error)) {
        throw error;
      }

      this.logger.warn(
        `MySQL sort buffer exhausted in /webchats for organization ${organizationId}. Falling back to app-side ordering.`,
      );

      const unsorted = await this.prisma.webchats.findMany(query);
      return unsorted.sort(
        (a, b) => b.created_at.getTime() - a.created_at.getTime(),
      );
    }
  }

  private isMysqlSortMemoryError(error: any): boolean {
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

    return candidateMessages.some(
      (value) =>
        typeof value === 'string' &&
        value.toLowerCase().includes('out of sort memory'),
    );
  }

  async findOne(organizationId: string, id: string) {
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

    if (!webchat) throw new NotFoundException('Webchat não encontrado.');
    return webchat;
  }

  async update(organizationId: string, id: string, data: UpdateWebchatDto) {
    const current = await this.prisma.webchats.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (!current) throw new NotFoundException('Webchat não encontrado');

    const nextName = data.name ?? current.name;
    const nextDomain =
      data.domain !== undefined
        ? this.normalizeDomain(data.domain)
        : current.domain;
    if (!nextDomain) {
      throw new BadRequestException('Domínio inválido para o webchat.');
    }

    const nameChanged = nextName !== current.name;
    const domainChanged = nextDomain !== current.domain;
    if (domainChanged) {
      await this.ensureWebchatDomainRegistered(organizationId, nextDomain);
    }

    // A-66: renomear NÃO troca o slug (links publicados e polling de pagamento
    // em andamento continuam válidos). Slug só muda se vier explícito no DTO;
    // ao trocar de domínio, mantém o atual se ainda for único lá.
    const explicitSlug =
      data.slug !== undefined
        ? buildBaseSlugFromWebchatName(String(data.slug))
        : null;
    let nextSlug = current.slug;
    if (explicitSlug && explicitSlug !== current.slug) {
      nextSlug = await ensureUniqueSlugByDomain(
        this.prisma,
        nextDomain,
        explicitSlug,
        current.id,
      );
    } else if (domainChanged) {
      nextSlug = await ensureUniqueSlugByDomain(
        this.prisma,
        nextDomain,
        current.slug,
        current.id,
      );
    }
    const slugChanged = nextSlug !== current.slug;
    void nameChanged;

    if (data.agent_id) {
      await this.ensureAgentBelongsToOrganization(
        organizationId,
        data.agent_id,
      );
    }

    if (data.email_project_id) {
      await this.ensureProjectBelongsToOrganization(
        organizationId,
        data.email_project_id,
      );
    }

    let nextSplitId: string | undefined;
    if (data.split_id !== undefined) {
      nextSplitId = await this.splits.resolveSplitIdForOrg(
        organizationId,
        data.split_id ?? null,
      );
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
          ? { settings: data.settings as any }
          : {}),
        ...(data.header_scripts !== undefined
          ? { header_scripts: data.header_scripts }
          : {}),
        ...(data.footer_scripts !== undefined
          ? { footer_scripts: data.footer_scripts }
          : {}),
        ...(data.ads_config !== undefined
          ? { ads_config: data.ads_config as any }
          : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(nextSplitId !== undefined ? { split_id: nextSplitId } : {}),
        ...(data.split_weight !== undefined
          ? { split_weight: data.split_weight }
          : {}),
        ...(slugChanged ? { slug: nextSlug } : {}),
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

  async remove(organizationId: string, id: string) {
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
    } catch (error: any) {
      if (error?.code === 'P2003') {
        throw new BadRequestException(
          'Não é possível excluir este webchat porque há dados vinculados a ele.',
        );
      }
      throw error;
    }
    return { success: true, message: 'Webchat removido com sucesso.' };
  }

  async getAdsConfig(organizationId: string, webchatId: string) {
    await this.findOne(organizationId, webchatId);
    return this.readWebchatAdsConfig(organizationId, webchatId);
  }

  async updateAdsConfig(
    organizationId: string,
    webchatId: string,
    payload: UpdateWebchatAdsDto,
  ) {
    await this.findOne(organizationId, webchatId);
    const normalized = this.normalizeWebchatAdsPayload(payload);

    await this.prisma.$transaction(async (tx) => {
      const saveSimplePosition = async (
        position: Exclude<AdsPosition, 'entre-mensagens'>,
        ad: Record<string, any> | null,
      ) => {
        if (!ad) {
          await (tx as any).webchat_ads.deleteMany({
            where: {
              organization_id: organizationId,
              webchat_id: webchatId,
              position,
            },
          });
          return;
        }

        await (tx as any).webchat_ads.upsert({
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
            rotulo: ad.rotulo ?? 'PUBLICIDADE',
            rotulo_ativo: ad.rotuloAtivo !== false,
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
            rotulo: ad.rotulo ?? 'PUBLICIDADE',
            rotulo_ativo: ad.rotuloAtivo !== false,
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
        await (tx as any).webchat_ads.deleteMany({
          where: {
            organization_id: organizationId,
            webchat_id: webchatId,
            position: 'entre-mensagens',
          },
        });
      } else {
        const sequenceAds = normalized.entre_mensagens.sequence_ads;
        const firstSequenceAd = sequenceAds[0] || null;
        await (tx as any).webchat_ads.upsert({
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
            gpt_sizes:
              firstSequenceAd?.gpt_sizes ||
              this.defaultGptSizes('entre-mensagens'),
            gpt_slot: firstSequenceAd?.gpt_slot ?? null,
            gpt_div_id: firstSequenceAd?.gpt_div_id ?? null,
            anuncio_fixed: firstSequenceAd?.anuncio_fixed ?? null,
            rotulo: firstSequenceAd?.rotulo ?? 'PUBLICIDADE',
            rotulo_ativo: firstSequenceAd?.rotuloAtivo !== false,
            intervalo_mensagens: normalized.entre_mensagens.intervalo_mensagens,
            sequence_ads: sequenceAds as any,
            ativo: normalized.entre_mensagens.ativo !== false,
          },
          update: {
            organization_id: organizationId,
            codigo_tag: firstSequenceAd?.codigo_tag || '',
            gpt_sizes:
              firstSequenceAd?.gpt_sizes ||
              this.defaultGptSizes('entre-mensagens'),
            gpt_slot: firstSequenceAd?.gpt_slot ?? null,
            gpt_div_id: firstSequenceAd?.gpt_div_id ?? null,
            anuncio_fixed: firstSequenceAd?.anuncio_fixed ?? null,
            rotulo: firstSequenceAd?.rotulo ?? 'PUBLICIDADE',
            rotulo_ativo: firstSequenceAd?.rotuloAtivo !== false,
            intervalo_mensagens: normalized.entre_mensagens.intervalo_mensagens,
            sequence_ads: sequenceAds as any,
            ativo: normalized.entre_mensagens.ativo !== false,
          },
        });
      }
    });

    return this.readWebchatAdsConfig(organizationId, webchatId);
  }

  async getPublicConfig(slug: string, domainHint?: string) {
    const webchat = await this.resolvePublicWebchat(slug, domainHint);
    const settings = this.asRecord(webchat.settings);
    // Cópia do settings SEM o conteúdo pago (funil de entrega/assets) — o `settings`
    // cru vai inteiro pro browser, então precisa da mesma proteção da personalizacao.
    const publicSettings = this.protectSettingsForPublic(settings);
    const adsConfig = await this.resolvePublicAdsConfig(
      webchat.organization_id,
      webchat.id,
      webchat.ads_config,
      settings,
    );
    const personalizacao = this.protectFunilForPublic(this.resolvePublicPersonalizacao(settings));
    const headerAdsCode =
      webchat.header_scripts ??
      (typeof settings.header_ads_code === 'string'
        ? settings.header_ads_code
        : null);
    const footerAdsCode =
      webchat.footer_scripts ??
      (typeof settings.footer_ads_code === 'string'
        ? settings.footer_ads_code
        : null);

    // A-39: o config público NUNCA leva o prompt_mestre (nem nada de prompt/
    // system) — só o que o chat público usa (campos de captação e toggles).
    const agent = webchat.agentes_ia
      ? {
        id: webchat.agentes_ia.id,
        name: webchat.agentes_ia.name,
        description: webchat.agentes_ia.description,
        ia_config: this.publicIaConfig(webchat.agentes_ia.ia_config),
        active: webchat.agentes_ia.active,
      }
      : null;

    const split = await this.buildPublicSplit(webchat);

    return {
      id: webchat.id,
      name: webchat.name,
      nome: webchat.name,
      slug: webchat.slug,
      domain: webchat.domain,
      dominio: webchat.domain,
      settings: publicSettings,
      header_scripts: webchat.header_scripts ?? null,
      header_ads_code: headerAdsCode,
      footer_scripts: webchat.footer_scripts ?? null,
      footer_ads_code: footerAdsCode,
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
      split,
      categoria_padrao:
        typeof settings.categoria_padrao === 'string'
          ? settings.categoria_padrao
          : null,
    };
  }

  // Monta o split do webchat para o config público: slug do split + membros
  // ativos (domínio/slug/peso) para o front sortear e redirecionar.
  private async buildPublicSplit(webchat: any) {
    const splitId = webchat?.split_id;
    if (!splitId) return null;
    const sp = await this.prisma.webchat_splits.findUnique({
      where: { id: splitId },
      select: { slug: true },
    });
    if (!sp) return null;
    const members = await this.prisma.webchats.findMany({
      where: { split_id: splitId, active: true },
      select: { name: true, slug: true, domain: true, split_weight: true },
    });
    return {
      slug: sp.slug,
      members: members.map((m) => ({
        name: m.name,
        slug: m.slug,
        domain: m.domain,
        weight: m.split_weight ?? 0,
      })),
    };
  }

  async getPublicSessionState(
    slug: string,
    domainHint: string | undefined,
    sessionIdRaw: string | undefined,
  ) {
    const webchat = await this.resolvePublicWebchat(slug, domainHint);
    const normalizedSessionId = this.normalizeSessionId(sessionIdRaw);

    if (!normalizedSessionId) {
      throw new BadRequestException('session_id é obrigatório.');
    }

    const persistedSessionState = await this.getWebchatSessionState(
      webchat.organization_id,
      webchat.id,
      normalizedSessionId,
    );
    const leadState = this.asRecord(persistedSessionState?.lead_state);
    const conversationHistory = this.normalizeConversationHistoryEntries(
      persistedSessionState?.conversation_history,
    );

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

  async captureLead(
    slug: string,
    domainHint: string | undefined,
    dto: CaptureWebchatLeadDto,
  ) {
    const webchat = await this.resolvePublicWebchat(slug, domainHint);

    return this.prisma.$transaction(
      (tx) => this.upsertLeadForWebchat(tx, webchat, dto),
      { maxWait: 30_000, timeout: 30_000 },
    );
  }

  async sendMessage(
    slug: string,
    domainHint: string | undefined,
    dto: SendWebchatMessageDto,
  ) {
    const webchat = await this.resolvePublicWebchat(slug, domainHint);

    if (!webchat.agentes_ia) {
      throw new BadRequestException('Webchat sem agente vinculado.');
    }
    // A-95: agente desativado não responde (erro claro 4xx, não 502).
    if (webchat.agentes_ia.active === false) {
      throw new BadRequestException('O agente de IA deste webchat está inativo.');
    }

    // Sistema é single-tenant agora — não desconta mais tokens por mensagem.
    // A função debitTokensForWebchatMessage segue existindo no fim do arquivo
    // pra eventual reativação, mas sai do hot path. Isso elimina o gargalo
    // de lock contention na row única de wallets sob carga concorrente.
    const tokenCost = 0;
    const normalizedSessionId = this.normalizeSessionId(dto.session_id);
    const persistedSessionState = await this.getWebchatSessionState(
      webchat.organization_id,
      webchat.id,
      normalizedSessionId,
    );
    const requestLeadState = this.mergeLeadStateFromSession(
      persistedSessionState?.lead_state,
      dto.lead_state,
      Boolean(persistedSessionState),
    );
    const requestConversationHistory = this.mergeConversationHistoryForRequest(
      persistedSessionState?.conversation_history,
      dto.conversation_history,
    );

    const serviceUrl = process.env.IA_SERVICE_URL;
    const serviceKey = process.env.IA_SERVICE_KEY;

    if (!serviceUrl || !serviceKey) {
      throw new InternalServerErrorException(
        'Integração de IA não configurada no backend.',
      );
    }

    const providerKeys = await this.systemSettings.getAiProviderKeysOrFail(webchat.organization_id);

    // Timeout duro pro fetch back→ai-micro. Sem isso, se o ai-micro travar,
    // o socket fica pendurado e empilha conexões abertas no back. 90s cobre
    // até retries lentos (3 tentativas × ~15s cada com cycling de providers).
    const aiCallController = new AbortController();
    const aiCallTimeout = setTimeout(
      () => aiCallController.abort(),
      Number(process.env.AI_CALL_TIMEOUT_MS) || 90_000,
    );
    try {
      const response = await fetch(`${serviceUrl}/api/ia-webchat/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': serviceKey,
        },
        signal: aiCallController.signal,
        body: JSON.stringify({
          message: dto.message,
          session_id: normalizedSessionId ?? null,
          organization_id: webchat.organization_id,
          provider_keys: providerKeys,
          // Prazo total das tentativas no micro (< AI_CALL_TIMEOUT_MS do back).
          deadline_ms: Math.max(
            10_000,
            (Number(process.env.AI_CALL_TIMEOUT_MS) || 90_000) - 5_000,
          ),
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
          lead_state:
            Object.keys(this.asRecord(requestLeadState)).length > 0
              ? requestLeadState
              : null,
          conversation_history:
            requestConversationHistory.length > 0
              ? requestConversationHistory
              : null,
        }),
      });

      clearTimeout(aiCallTimeout);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        const detail = String(errorBody || '').trim();
        const detailSuffix = detail
          ? ` | detalhe: ${detail.slice(0, 600)}`
          : '';
        throw new Error(
          `Micro-serviço retornou status ${response.status}${detailSuffix}`,
        );
      }

      const json = await response.json();
      if (!json.success) {
        throw new Error(
          json.message || 'Erro desconhecido no micro-serviço de IA.',
        );
      }

      const responseData = this.asRecord(json.data);
      const reply =
        (typeof responseData.reply === 'string' ? responseData.reply : '') ||
        (typeof responseData.resposta === 'string'
          ? responseData.resposta
          : '');
      const settings = this.asRecord(webchat.settings);
      const anuncios = await this.resolvePublicAdsConfig(
        webchat.organization_id,
        webchat.id,
        webchat.ads_config,
        settings,
      );
      const usage = this.asRecord(responseData.usage);
      const totalTokensRaw = usage.total_tokens;
      const totalTokens = Number.isFinite(Number(totalTokensRaw))
        ? Number(totalTokensRaw)
        : null;
      const model =
        typeof responseData.model === 'string' ? responseData.model : null;
      const leadCapture = this.normalizeLeadCapture(
        responseData.lead_capture,
        requestLeadState,
      );
      const leadCollected = this.asRecord(leadCapture.collected);
      const leadEmail = this.normalizeEmail(leadCollected.email);
      const leadName = this.normalizeLeadName(
        leadCollected.nome ?? leadCollected.name,
      );
      const leadPhone = this.normalizeLeadPhone(
        leadCollected.telefone ??
          leadCollected.phone ??
          leadCollected.celular ??
          leadCollected.whatsapp,
      );
      let persistedLead: Record<string, any> | null = null;

      // Persistir quando temos NOME + ao menos um identificador (email OU
      // phone). Antes era "leadEmail && leadName", o que ignorava agentes
      // configurados pra captar só nome+telefone (toggle "Captar E-mail" off).
      if (leadName && (leadEmail || leadPhone)) {
        const customFields = this.extractCustomLeadFields(
          leadCollected,
          leadCapture.required_fields,
        );
        const context = {
          ...this.asRecord(dto.context),
          domain:
            this.normalizeDomain(domainHint) ||
            this.normalizeDomain(webchat.domain),
          lead_capture: leadCapture,
        };

        // Hot path sob carga: maxWait alto pra que a request espere conn
        // ao invés de morrer com "Unable to start a transaction in the
        // given time" sob pico (default Prisma é 2s, apertado quando
        // várias outras transactions estão segurando conn aguardando IA).
        // A-67: falha ao gravar o lead (duplicata, banco) NÃO pode engolir a
        // resposta da IA — loga e segue; o lead tenta de novo na próxima mensagem.
        try {
          persistedLead = (await this.prisma.$transaction(
            (tx) =>
              this.upsertLeadForWebchat(tx, webchat, {
                email: leadEmail ?? undefined,
                name: leadName ?? undefined,
                phone: leadPhone ?? undefined,
                source: 'webchat',
                session_id: normalizedSessionId ?? undefined,
                context,
                custom_fields: customFields,
              }),
            { maxWait: 30_000, timeout: 30_000 },
          )) as Record<string, any>;
        } catch (leadError: any) {
          persistedLead = null;
          this.logger.warn(
            `Falha ao persistir lead do webchat ${webchat.id} (sessão ${normalizedSessionId ?? '-'}): ${leadError?.message || leadError}`,
          );
        }
      }

      const leadCaptureWithPersistence = {
        ...leadCapture,
        persisted: Boolean(persistedLead),
        persisted_lead_id: persistedLead?.lead_id ?? null,
        routed_to: persistedLead?.routed_to ?? null,
      };
      const nextSessionHistory = this.buildConversationHistoryForPersistence(
        requestConversationHistory,
        dto.message,
        reply,
      );
      if (normalizedSessionId) {
        await this.upsertWebchatSessionState(
          webchat.organization_id,
          webchat.id,
          normalizedSessionId,
          leadCapture,
          nextSessionHistory,
        );
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
    } catch (error: any) {
      clearTimeout(aiCallTimeout);
      const detail = String(error?.message || error || 'erro desconhecido');
      this.logger.error(
        `Falha ao processar mensagem do webchat com IA para webchat ${webchat.id}: ${detail}`,
      );

      throw new HttpException(
        process.env.NODE_ENV === 'production'
          ? 'Falha ao processar mensagem do webchat com IA.'
          : `Falha ao processar mensagem do webchat com IA. Detalhe: ${detail}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async trackPublicAdEvents(
    slug: string,
    domainHint: string | undefined,
    dto: TrackWebchatAdEventsDto,
  ) {
    const webchat = await this.resolvePublicWebchat(slug, domainHint);
    const sourceEvents = Array.isArray(dto?.events) ? dto.events : [];
    if (sourceEvents.length === 0) {
      return {
        success: true,
        stored: 0,
      };
    }

    const normalizedSessionId = this.normalizeSessionId(dto.session_id);
    const payloadDomain =
      this.normalizeDomain(dto.domain) ||
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
        if (
          !AD_EVENT_NAMES.includes(eventName as (typeof AD_EVENT_NAMES)[number])
        ) {
          return null;
        }
        if (!ADS_POSITIONS.includes(adPosition as AdsPosition)) {
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
      .filter(Boolean) as Array<Record<string, any>>;

    if (rows.length === 0) {
      return {
        success: true,
        stored: 0,
      };
    }

    await (this.prisma as any).webchat_ad_events.createMany({
      data: rows,
    });

    return {
      success: true,
      stored: rows.length,
    };
  }

  private async upsertLeadForWebchat(
    tx: any,
    webchat: Record<string, any>,
    dto: CaptureWebchatLeadDto,
  ) {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const normalizedPhone = this.normalizeLeadPhone(dto.phone);

    // Pelo menos um identificador (email ou telefone) é necessário pra
    // persistir o lead. Os toggles do agente podem desativar ambos os
    // canais de captura — nesse caso, o caller (generateWebchatReply)
    // já não chega aqui.
    if (!normalizedEmail && !normalizedPhone) {
      throw new BadRequestException(
        'É necessário ao menos um identificador de lead (e-mail ou telefone).',
      );
    }

    const normalizedName = this.normalizeLeadName(dto.name);

    // Roteamento pra email_project requer email (email_leads.email é NOT NULL
    // e UNIQUE). Sem email, caímos pra webchat_leads diretamente — o webchat
    // pode ter email_project_id setado mas o agente não capturar email.
    if (webchat.email_project_id && normalizedEmail) {
      let emailLead = await tx.email_leads.findFirst({
        where: {
          organization_id: webchat.organization_id,
          email: normalizedEmail,
        },
      });

      const mergedAttributes = {
        phone: normalizedPhone,
        source: dto.source ?? 'webchat',
        session_id: dto.session_id ?? null,
        context: dto.context ?? null,
        custom_fields: dto.custom_fields ?? null,
        webchat_id: webchat.id,
        webchat_slug: webchat.slug,
        webchat_domain: webchat.domain,
      };

      if (!emailLead) {
        try {
          emailLead = await tx.email_leads.create({
            data: {
              organization_id: webchat.organization_id,
              email: normalizedEmail,
              name: normalizedName ?? null,
              attributes: mergedAttributes as any,
            },
          });
        } catch (e: any) {
          // Corrida (P2002 no unique org+email): rebusca em vez de 500 (A-67).
          if (e?.code !== 'P2002') throw e;
          emailLead = await tx.email_leads.findFirst({
            where: {
              organization_id: webchat.organization_id,
              email: normalizedEmail,
            },
          });
          if (!emailLead) throw e;
        }
      } else {
        // Lead já existe: rota pública só PREENCHE o que está vazio — nunca
        // sobrescreve nome/atributos já gravados (A-67).
        await tx.email_leads.update({
          where: { id: emailLead.id },
          data: {
            ...(!emailLead.name && normalizedName ? { name: normalizedName } : {}),
            attributes: this.fillEmptyAttributes(
              emailLead.attributes,
              mergedAttributes,
            ) as any,
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
        try {
          await tx.email_project_leads.create({
            data: {
              project_id: webchat.email_project_id,
              lead_id: emailLead.id,
              status: 'SUBSCRIBED',
            } as any,
          });
        } catch (e: any) {
          if (e?.code !== 'P2002') throw e; // corrida: vínculo já existe
        }
      }

      return {
        success: true,
        routed_to: 'email_project',
        lead_id: emailLead.id,
        deduplicated: Boolean(existingRelation),
      };
    }

    // Dedup em webchat_leads: prioriza email quando disponível; se só temos
    // telefone, dedup por phone. Mantém compatibilidade com leads antigos
    // (que sempre tinham email).
    const existingWebchatLead = normalizedEmail
      ? await tx.webchat_leads.findFirst({
          where: {
            organization_id: webchat.organization_id,
            webchat_id: webchat.id,
            email: normalizedEmail,
          },
        })
      : await tx.webchat_leads.findFirst({
          where: {
            organization_id: webchat.organization_id,
            webchat_id: webchat.id,
            phone: normalizedPhone,
          },
        });

    if (existingWebchatLead) {
      // Lead já existe: só preenche o que está vazio (A-67). A sessão atual é
      // atualizada (é o ponteiro pra conversa mais recente).
      const updatedLead = await tx.webchat_leads.update({
        where: { id: existingWebchatLead.id },
        data: {
          ...(!existingWebchatLead.name && normalizedName ? { name: normalizedName } : {}),
          ...(!existingWebchatLead.email && normalizedEmail ? { email: normalizedEmail } : {}),
          phone: existingWebchatLead.phone ?? normalizedPhone,
          source: existingWebchatLead.source ?? dto.source ?? 'webchat',
          session_id: dto.session_id ?? existingWebchatLead.session_id,
          context:
            existingWebchatLead.context ?? ((dto.context as any) ?? null),
          custom_fields: this.fillEmptyAttributes(
            existingWebchatLead.custom_fields,
            this.asRecord(dto.custom_fields),
          ) as any,
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
        email: normalizedEmail ?? null,
        name: normalizedName ?? null,
        phone: normalizedPhone,
        source: dto.source ?? 'webchat',
        session_id: dto.session_id ?? null,
        context: (dto.context as any) ?? null,
        custom_fields: (dto.custom_fields as any) ?? null,
      },
    });

    return {
      success: true,
      routed_to: 'webchat',
      lead_id: lead.id,
      deduplicated: false,
    };
  }

  // Mescla atributos preenchendo SÓ chaves vazias do existente (rota pública
  // nunca sobrescreve o que já foi gravado) — A-67.
  private fillEmptyAttributes(
    existingRaw: unknown,
    incomingRaw: Record<string, any>,
  ): Record<string, any> {
    const out: Record<string, any> = { ...this.asRecord(existingRaw) };
    Object.entries(this.asRecord(incomingRaw)).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      const current = out[key];
      if (current === undefined || current === null || current === '') {
        out[key] = value;
      }
    });
    return out;
  }

  private getSessionHistoryLimit() {
    const raw =
      process.env.WEBCHAT_SESSION_HISTORY_LIMIT ||
      process.env.WEBCHAT_HISTORY_LIMIT ||
      '24';
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 4) return 24;
    return Math.min(parsed, 100);
  }

  private normalizeSessionId(value: unknown) {
    const sessionId = String(value ?? '').trim();
    if (!sessionId) return null;
    return sessionId.slice(0, 100);
  }

  private normalizeConversationHistoryRole(rawRole: unknown) {
    const role = String(rawRole ?? '')
      .trim()
      .toLowerCase();
    if (['assistant', 'bot', 'model', 'ai'].includes(role)) return 'assistant';
    if (['user', 'human', 'client', 'cliente'].includes(role)) return 'user';
    return '';
  }

  private normalizeConversationHistoryEntries(rawHistory: unknown) {
    const source = Array.isArray(rawHistory) ? rawHistory : [];
    const maxHistory = this.getSessionHistoryLimit();
    const normalized = source
      .map((entry) => this.asRecord(entry))
      .map((entry) => {
        const role = this.normalizeConversationHistoryRole(
          entry.role ?? entry.type,
        );
        const content = String(
          entry.content ?? entry.message ?? entry.text ?? '',
        ).trim();
        if (!role || !content) return null;
        return { role, content: content.slice(0, 4000) };
      })
      .filter(Boolean) as Array<{ role: string; content: string }>;

    if (normalized.length === 0) return [];

    const deduped: Array<{ role: string; content: string }> = [];
    normalized.forEach((entry) => {
      const previous = deduped[deduped.length - 1];
      if (
        previous &&
        previous.role === entry.role &&
        previous.content === entry.content
      ) {
        return;
      }
      deduped.push(entry);
    });

    return deduped.slice(-maxHistory);
  }

  private mergeConversationHistoryForRequest(
    sessionHistoryRaw: unknown,
    clientHistoryRaw: unknown,
  ) {
    const sessionHistory =
      this.normalizeConversationHistoryEntries(sessionHistoryRaw);
    const clientHistory =
      this.normalizeConversationHistoryEntries(clientHistoryRaw);

    if (sessionHistory.length === 0) return clientHistory;
    if (clientHistory.length === 0) return sessionHistory;

    // A-68: a sessão do servidor é a fonte de verdade; do cliente só entram as
    // entradas que ainda não existem (mesmo role+conteúdo). Antes era concat +
    // dedupe só de consecutivos → após um reload o histórico duplicava.
    const keyOf = (e: { role: string; content: string }) => `${e.role}\n${e.content}`;
    const seen = new Set(sessionHistory.map(keyOf));
    const extra = clientHistory.filter((e) => !seen.has(keyOf(e)));
    if (extra.length === 0) return sessionHistory;

    return this.normalizeConversationHistoryEntries([
      ...sessionHistory,
      ...extra,
    ]);
  }

  private buildConversationHistoryForPersistence(
    baseHistoryRaw: unknown,
    userMessageRaw: unknown,
    assistantMessageRaw: unknown,
  ) {
    const baseHistory =
      this.normalizeConversationHistoryEntries(baseHistoryRaw);
    const userMessage = String(userMessageRaw ?? '').trim();
    const assistantMessage = String(assistantMessageRaw ?? '').trim();
    const turnEntries: Array<{ role: string; content: string }> = [];

    if (userMessage) {
      turnEntries.push({ role: 'user', content: userMessage.slice(0, 4000) });
    }
    if (assistantMessage) {
      turnEntries.push({
        role: 'assistant',
        content: assistantMessage.slice(0, 4000),
      });
    }
    if (turnEntries.length === 0) return baseHistory;

    return this.normalizeConversationHistoryEntries([
      ...baseHistory,
      ...turnEntries,
    ]);
  }

  private toConversationPairs(
    historyRaw: unknown,
  ): Array<{ chat: string; lead: string }> {
    const history = this.normalizeConversationHistoryEntries(historyRaw);
    const pairs: Array<{ chat: string; lead: string }> = [];

    history.forEach((entry) => {
      const role = String(entry.role || '')
        .trim()
        .toLowerCase();
      const content = String(entry.content || '').trim();
      if (!content) return;

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

  private hasMeaningfulLeadState(rawState: unknown) {
    const state = this.asRecord(rawState);
    if (Object.keys(state).length === 0) return false;
    if (Object.keys(this.asRecord(state.collected)).length > 0) return true;
    if (Object.keys(this.asRecord(state.attempts)).length > 0) return true;
    if (Boolean(state.released) || Boolean(state.capture_completed))
      return true;
    return (
      typeof state.next_field === 'string' && state.next_field.trim().length > 0
    );
  }

  // `sessionExists`: há linha de sessão no servidor → o que o cliente manda em
  // `released`/`collected`/`capture_completed` é IGNORADO (senão o body podia
  // "liberar" a captação ou inventar dados coletados) — A-67. Histórico de
  // tentativas e configs (required_fields etc.) continuam mescláveis.
  private mergeLeadStateFromSession(
    sessionLeadStateRaw: unknown,
    clientLeadStateRaw: unknown,
    sessionExists = false,
  ) {
    const sessionLeadState = this.asRecord(sessionLeadStateRaw);
    const clientLeadState = this.asRecord(clientLeadStateRaw);

    if (sessionExists) {
      const trusted: Record<string, any> = {
        ...clientLeadState,
        ...sessionLeadState,
        collected: { ...this.asRecord(sessionLeadState.collected) },
        released: Boolean(sessionLeadState.released),
        capture_completed: Boolean(sessionLeadState.capture_completed),
      };
      // Tentativas: maior valor entre sessão e cliente (nunca "zera" pra burlar).
      const attempts: Record<string, any> = { ...this.asRecord(sessionLeadState.attempts) };
      Object.entries(this.asRecord(clientLeadState.attempts)).forEach(([key, value]) => {
        const current = Number(attempts[key]);
        const next = Number(value);
        if (!Number.isFinite(next)) return;
        attempts[key] = Number.isFinite(current) ? Math.max(current, next) : next;
      });
      trusted.attempts = attempts;
      return trusted;
    }

    if (Object.keys(sessionLeadState).length === 0) return clientLeadState;
    if (!this.hasMeaningfulLeadState(clientLeadState)) return sessionLeadState;

    const merged = this.normalizeLeadCapture(clientLeadState, sessionLeadState);
    const sessionAttempts = this.asRecord(sessionLeadState.attempts);
    const clientAttempts = this.asRecord(clientLeadState.attempts);
    const mergedAttempts: Record<string, any> = { ...sessionAttempts };

    Object.entries(clientAttempts).forEach(([key, value]) => {
      const current = Number(mergedAttempts[key]);
      const next = Number(value);
      if (!Number.isFinite(next)) return;
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

  private isWebchatSessionPersistenceUnavailable(error: any) {
    if (!error) return false;
    if (error?.code === 'P2021' || error?.code === 'P2022') return true;

    const message = String(error?.message || '').toLowerCase();
    if (!message) return false;

    return (
      message.includes('webchat_sessions') ||
      (message.includes('table') && message.includes("doesn't exist"))
    );
  }

  private logWebchatSessionPersistenceUnavailable(action: string, error: any) {
    if (this.webchatSessionUnavailableLogged) return;

    this.webchatSessionUnavailableLogged = true;
    this.logger.warn(
      `Persistência de sessão de webchat indisponível (${action}). O chat seguirá sem memória de sessão até aplicar migrações. Detalhe: ${error?.code || error?.message || 'erro desconhecido'}`,
    );
  }

  private async getWebchatSessionState(
    organizationId: string,
    webchatId: string,
    sessionId: string | null,
  ) {
    if (!sessionId) return null;

    try {
      const row = await (this.prisma as any).webchat_sessions.findUnique({
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

      if (!row || row.organization_id !== organizationId) return null;
      return row;
    } catch (error: any) {
      if (this.isWebchatSessionPersistenceUnavailable(error)) {
        this.logWebchatSessionPersistenceUnavailable('read', error);
        return null;
      }
      throw error;
    }
  }

  private async upsertWebchatSessionState(
    organizationId: string,
    webchatId: string,
    sessionId: string,
    leadStateRaw: unknown,
    conversationHistoryRaw: unknown,
  ) {
    const leadState = this.asRecord(leadStateRaw);
    const conversationHistory = this.normalizeConversationHistoryEntries(
      conversationHistoryRaw,
    );

    try {
      await (this.prisma as any).webchat_sessions.upsert({
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
          lead_state:
            Object.keys(leadState).length > 0 ? (leadState as any) : null,
          conversation_history:
            conversationHistory.length > 0
              ? (conversationHistory as any)
              : null,
        },
        update: {
          lead_state:
            Object.keys(leadState).length > 0 ? (leadState as any) : null,
          conversation_history:
            conversationHistory.length > 0
              ? (conversationHistory as any)
              : null,
        },
      });
    } catch (error: any) {
      if (this.isWebchatSessionPersistenceUnavailable(error)) {
        this.logWebchatSessionPersistenceUnavailable('write', error);
        return;
      }
      throw error;
    }
  }

  private normalizeLeadCapture(
    leadCaptureRaw: unknown,
    currentLeadStateRaw: unknown,
  ) {
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
      allow_continue_after_attempts:
        fromIa.allow_continue_after_attempts !== undefined
          ? Boolean(fromIa.allow_continue_after_attempts)
          : fromClient.allow_continue_after_attempts !== false,
      released: Boolean(fromIa.released ?? fromClient.released),
      capture_completed: Boolean(
        fromIa.capture_completed ?? fromClient.capture_completed,
      ),
      next_field:
        typeof fromIa.next_field === 'string' ? fromIa.next_field : null,
    };
  }

  // Sanitiza (conserta ponto duplo etc.) + valida estrito via common/email.util.
  // Inválido/insanável -> '' (não roteia pro email marketing).
  private normalizeEmail(value: unknown) {
    return cleanEmailOrNull(value as any) ?? '';
  }

  private normalizeLeadName(value: unknown) {
    const name = String(value ?? '').trim();
    if (!name) return null;
    if (name.length < 2) return null;
    if (this.normalizeEmail(name)) return null;
    return name.slice(0, 255);
  }

  // Normaliza telefone preservando o formato original (com +, DDD, separadores)
  // mas exigindo no mínimo 8 dígitos pra considerar válido. Trunca em 30 chars
  // pra caber na coluna phone VARCHAR(30) do webchat_leads.
  private normalizeLeadPhone(value: unknown) {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const digits = raw.replace(/\D+/g, '');
    if (digits.length < 8) return null;
    return raw.slice(0, 30);
  }

  private normalizeLeadFieldKey(value: unknown) {
    const key = String(value ?? '')
      .trim()
      .toLowerCase();
    if (!key) return '';
    if (['name', 'first_name', 'firstname'].includes(key)) return 'nome';
    if (['e-mail', 'mail'].includes(key)) return 'email';
    if (['phone', 'celular', 'whatsapp'].includes(key)) return 'telefone';
    return key.replace(/[^a-z0-9_]/g, '_').slice(0, 80);
  }

  private normalizeLeadRequiredFieldKeys(requiredFieldsRaw: unknown) {
    if (!Array.isArray(requiredFieldsRaw)) return [];

    return requiredFieldsRaw
      .map((field) => this.asRecord(field))
      .filter(
        (field) => field.required !== false && field.obrigatorio !== false,
      )
      .map((field) =>
        this.normalizeLeadFieldKey(field.key ?? field.name ?? field.nome),
      )
      .filter((key) => Boolean(key));
  }

  private extractCustomLeadFields(
    collectedRaw: Record<string, any>,
    requiredFieldsRaw: unknown,
  ) {
    const collected = this.asRecord(collectedRaw);
    const requiredKeys = new Set(
      this.normalizeLeadRequiredFieldKeys(requiredFieldsRaw),
    );
    const ignored = new Set(['nome', 'email', 'telefone']);
    const custom: Record<string, any> = {};

    Object.entries(collected).forEach(([rawKey, value]) => {
      const key = this.normalizeLeadFieldKey(rawKey);
      if (!key || ignored.has(key) || requiredKeys.has(key)) return;

      const text = String(value ?? '').trim();
      if (!text) return;

      custom[key] = text.slice(0, 255);
    });

    return custom;
  }

  private async ensureAgentBelongsToOrganization(
    organizationId: string,
    agentId: string,
  ) {
    const agent = await this.prisma.agentes_ia.findFirst({
      where: { id: agentId, organization_id: organizationId, active: true },
      select: { id: true },
    });

    if (!agent) {
      throw new BadRequestException(
        'Agente inválido ou não pertence à organização.',
      );
    }
  }

  private async ensureProjectBelongsToOrganization(
    organizationId: string,
    projectId: string,
  ) {
    const project = await this.prisma.email_projects.findFirst({
      where: { id: projectId, organization_id: organizationId, active: true },
      select: { id: true },
    });

    if (!project) {
      throw new BadRequestException(
        'Projeto de e-mail inválido ou não pertence à organização.',
      );
    }
  }

  private async ensureWebchatDomainRegistered(
    organizationId: string,
    domain: string,
  ) {
    const normalizedDomain = this.normalizeDomain(domain);
    if (!normalizedDomain) {
      throw new BadRequestException('Domínio inválido para o webchat.');
    }

    const webchatDomain = await this.prisma.webchat_domains.findFirst({
      where: {
        organization_id: organizationId,
        domain: normalizedDomain,
      },
      select: {
        id: true,
        status: true,
        kind: true,
      },
    });

    if (!webchatDomain) {
      throw new BadRequestException(
        'Domínio de webchat não cadastrado para sua organização. Acesse Configurações > Conta & Domínios > Webchat.',
      );
    }
    // A-95: domínio de quiz não serve pra webchat, e PENDING/FAILED não publica.
    if (webchatDomain.kind !== 'webchat') {
      throw new BadRequestException(
        'Este domínio está cadastrado para quizzes, não para webchats.',
      );
    }
    if (webchatDomain.status !== 'VERIFIED') {
      throw new BadRequestException(
        'Domínio de webchat ainda não verificado. Verifique o DNS antes de publicar o webchat.',
      );
    }
  }

  private normalizeDomain(domain?: string) {
    if (!domain) return '';
    return domain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .split('/')[0]
      .split(':')[0];
  }

  private asRecord(value: unknown): Record<string, any> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, any>;
  }

  // Subconjunto NÃO sensível do ia_config pro config público (A-39). O front
  // público lê só `campos_lead` (PublicWebchat.jsx); mantemos também modelo/
  // temperatura/max_tokens e os toggles `captar_*` por compatibilidade. Tudo que
  // tenha "prompt", "system", "instru" ou "persona" no nome fica de fora.
  private publicIaConfig(raw: unknown): Record<string, any> {
    const cfg = this.asRecord(raw);
    const allowed = new Set(['modelo', 'model', 'temperatura', 'temperature', 'max_tokens', 'campos_lead']);
    const out: Record<string, any> = {};
    Object.entries(cfg).forEach(([key, value]) => {
      const k = String(key).toLowerCase();
      if (/prompt|system|instru|persona|regra|contexto/.test(k)) return;
      if (allowed.has(k) || k.startsWith('captar_')) out[key] = value;
    });
    return out;
  }

  private protectSettingsForPublic(settings: Record<string, any>) {
    const out: Record<string, any> = { ...settings };
    if (out.personalizacao && typeof out.personalizacao === 'object' && !Array.isArray(out.personalizacao)) {
      out.personalizacao = this.protectFunilForPublic(out.personalizacao);
    } else if (out.funil) {
      // shape legado (personalizacao na raiz do settings)
      Object.assign(out, this.protectFunilForPublic(out));
    }
    return out;
  }

  // Funil no config PÚBLICO: as mensagens das sequências de ENTREGA (alvo de
  // `charge.onPaidSequenceId`) são removidas (o chat só as recebe via
  // /payments/:id quando status=PAID) e mensagens file/video perdem o assetId.
  // Sem isso, qualquer um leria o produto pago direto no JSON do config.
  private protectFunilForPublic(personalizacao: Record<string, any> | null) {
    const funil = personalizacao?.funil;
    if (!funil || typeof funil !== 'object' || !funil.sequences || typeof funil.sequences !== 'object') return personalizacao;
    const protectedIds = new Set<string>();
    Object.values(funil.sequences as Record<string, any>).forEach((seq: any) => {
      if (seq?.ending?.type === 'charge' && seq.ending.charge?.onPaidSequenceId) {
        protectedIds.add(String(seq.ending.charge.onPaidSequenceId));
      }
    });
    const sequences: Record<string, any> = {};
    Object.entries(funil.sequences as Record<string, any>).forEach(([id, seq]: [string, any]) => {
      if (!seq || typeof seq !== 'object') return;
      const messages = Array.isArray(seq.messages) ? seq.messages : [];
      if (protectedIds.has(id)) {
        sequences[id] = { ...seq, messages: [], protected: true };
        return;
      }
      sequences[id] = {
        ...seq,
        messages: messages.map((m: any) =>
          m && (m.type === 'file' || m.type === 'video')
            ? { id: m.id, type: m.type, name: m.name, caption: m.caption, typingDurationMs: m.typingDurationMs, locked: true }
            : m,
        ),
      };
    });
    return { ...personalizacao, funil: { ...funil, sequences } };
  }

  private resolvePublicPersonalizacao(settings: Record<string, any>) {
    if (
      settings.personalizacao &&
      typeof settings.personalizacao === 'object' &&
      !Array.isArray(settings.personalizacao)
    ) {
      return settings.personalizacao as Record<string, any>;
    }

    const hasLegacyRootShape =
      settings.theme ||
      settings.header ||
      settings.welcomeScreen ||
      settings.quickReplies ||
      settings.welcomeBotMessage;

    if (hasLegacyRootShape) {
      return settings;
    }

    return null;
  }

  private defaultGptSizes(position: string) {
    if (position === 'entre-mensagens') return '[300,100]';
    return '[320,100]';
  }

  private normalizeGptSizes(rawValue: unknown, position: string) {
    if (Array.isArray(rawValue)) {
      return JSON.stringify(rawValue);
    }

    const value = String(rawValue ?? '').trim();
    if (!value) return this.defaultGptSizes(position);

    const compact = value.replace(/\s+/g, '');
    const match = compact.match(/^(\d{2,4})x(\d{2,4})$/i);
    if (match) return `[${match[1]},${match[2]}]`;

    return value;
  }

  private looksLikeHtmlSnippet(rawValue: unknown) {
    const value = String(rawValue ?? '').trim();
    if (!value) return false;
    return (
      /<\/?[a-z][\s\S]*>/i.test(value) || /&lt;\/?[a-z][\s\S]*&gt;/i.test(value)
    );
  }

  private extractGptSlotFromCode(rawCode: unknown) {
    const source = String(rawCode ?? '');
    const fromDefineSlot = source.match(
      /defineSlot\(\s*['"]([^'"]+)['"]/i,
    )?.[1];
    if (fromDefineSlot) return String(fromDefineSlot).trim();

    const compact = String(rawCode ?? '').trim();
    if (compact.startsWith('/') && !this.looksLikeHtmlSnippet(compact)) {
      return compact;
    }

    return '';
  }

  private extractGptDivIdFromCode(rawCode: unknown) {
    const source = String(rawCode ?? '');
    const fromDefineSlot = source.match(
      /defineSlot\(\s*['"][^'"]+['"]\s*,\s*\[[^\]]+\]\s*,\s*['"]([^'"]+)['"]/i,
    )?.[1];
    if (fromDefineSlot) return String(fromDefineSlot).trim();

    const fromDisplay = source.match(/display\(\s*['"]([^'"]+)['"]\s*\)/i)?.[1];
    if (fromDisplay) return String(fromDisplay).trim();

    return '';
  }

  private normalizeAdContract(rawAd: Record<string, any>, position: string) {
    const code = String(rawAd.codigo_tag ?? rawAd.codigo ?? '').trim();
    const explicitSlot = String(rawAd.gpt_slot ?? '').trim();
    const explicitDivId = String(rawAd.gpt_div_id ?? '').trim();
    const explicitFixed = String(
      rawAd.anuncio_fixed ?? rawAd.html ?? '',
    ).trim();
    const gptSizes = this.normalizeGptSizes(rawAd.gpt_sizes, position);
    const rotulo = (() => {
      const raw = String(rawAd.rotulo ?? '').trim();
      return raw.slice(0, 100) || 'PUBLICIDADE';
    })();

    const inferredSlot = explicitSlot || this.extractGptSlotFromCode(code);
    const inferredDivId = explicitDivId || this.extractGptDivIdFromCode(code);
    const inferredFixed =
      explicitFixed ||
      (!inferredSlot && this.looksLikeHtmlSnippet(code) ? code : '');
    const storageCode = code || inferredSlot || inferredFixed;

    const hasLegacyCode = Boolean(code);
    const hasFixed = Boolean(inferredFixed);
    const hasGptContract = Boolean(inferredSlot && gptSizes);

    if (!hasLegacyCode && !hasFixed && !hasGptContract) {
      return null;
    }

    // Aceita tanto rotuloAtivo (camel, vindo do front/JSON) quanto
    // rotulo_ativo (snake, vindo da linha do banco).
    const rotuloAtivo = (rawAd.rotuloAtivo ?? rawAd.rotulo_ativo) !== false;

    return {
      codigo_tag: storageCode,
      codigo: storageCode,
      gpt_slot: inferredSlot || null,
      gpt_div_id: inferredDivId || null,
      anuncio_fixed: inferredFixed || null,
      gpt_sizes: gptSizes,
      rotulo,
      rotuloAtivo,
      ativo: rawAd.ativo !== false,
    };
  }

  private normalizeSimpleAdPayload(rawAd: unknown, position: string) {
    const ad = this.asRecord(rawAd);
    return this.normalizeAdContract(ad, position);
  }

  private normalizeSequenceEntry(rawEntry: unknown, index = 0) {
    const entry = this.asRecord(rawEntry);
    const normalized = this.normalizeAdContract(entry, 'entre-mensagens');
    if (!normalized) return null;
    const idRaw = String(entry.id ?? '').trim();

    return {
      id: idRaw || `seq_${index + 1}`,
      codigo_tag: normalized.codigo_tag,
      codigo: normalized.codigo_tag,
      gpt_slot: normalized.gpt_slot,
      gpt_div_id: normalized.gpt_div_id,
      anuncio_fixed: normalized.anuncio_fixed,
      gpt_sizes: normalized.gpt_sizes,
      rotulo: normalized.rotulo,
      rotuloAtivo: normalized.rotuloAtivo !== false,
      ativo: normalized.ativo !== false,
    };
  }

  private normalizeWebchatAdsPayload(payloadRaw: unknown) {
    const payload = this.asRecord(payloadRaw);

    const topo = this.normalizeSimpleAdPayload(payload.topo, 'topo');
    const rodape = this.normalizeSimpleAdPayload(payload.rodape, 'rodape');
    const intersticial = this.normalizeSimpleAdPayload(
      payload.intersticial,
      'intersticial',
    );

    const betweenSource = this.asRecord(
      payload.entre_mensagens ?? payload['entre-mensagens'],
    );
    const sequenceSource = Array.isArray(betweenSource.sequence_ads)
      ? betweenSource.sequence_ads
      : [];
    const sequenceAds = sequenceSource
      .map((entry, index) => this.normalizeSequenceEntry(entry, index))
      .filter(Boolean) as Array<Record<string, any>>;
    const betweenCodeOnly = this.normalizeSequenceEntry(betweenSource, 0);
    if (sequenceAds.length === 0 && betweenCodeOnly) {
      sequenceAds.push(betweenCodeOnly);
    }

    const entreMensagens =
      sequenceAds.length > 0
        ? {
          ativo: betweenSource.ativo !== false,
          intervalo_mensagens: (() => {
            const intervalRaw = Number(betweenSource.intervalo_mensagens);
            if (!Number.isFinite(intervalRaw) || intervalRaw <= 0) {
              throw new BadRequestException(
                'intervalo_mensagens deve ser maior que zero.',
              );
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

  private formatWebchatAdsRowsAsConfig(rowsRaw: unknown) {
    const rows = Array.isArray(rowsRaw) ? rowsRaw : [];
    const config: Record<string, any> = {};

    rows.forEach((rowRaw) => {
      const row = this.asRecord(rowRaw);
      const position = String(row.position ?? '')
        .trim()
        .toLowerCase();
      if (!ADS_POSITIONS.includes(position as AdsPosition)) return;

      if (position === 'entre-mensagens') {
        const sequenceSource = Array.isArray(row.sequence_ads)
          ? row.sequence_ads
          : [];
        const sequenceAds = sequenceSource
          .map((entry, index) => this.normalizeSequenceEntry(entry, index))
          .filter(Boolean) as Array<Record<string, any>>;

        if (sequenceAds.length === 0 && String(row.codigo_tag ?? '').trim()) {
          const fallback = this.normalizeSequenceEntry(
            {
              id: 'seq_1',
              codigo_tag: row.codigo_tag,
              gpt_slot: row.gpt_slot,
              gpt_div_id: row.gpt_div_id,
              anuncio_fixed: row.anuncio_fixed,
              gpt_sizes: row.gpt_sizes,
              rotulo: row.rotulo,
              rotuloAtivo: row.rotulo_ativo,
              ativo: row.ativo !== false,
            },
            0,
          );
          if (fallback) sequenceAds.push(fallback);
        }

        const intervalRaw = Number(row.intervalo_mensagens);
        const intervaloMensagens =
          Number.isFinite(intervalRaw) && intervalRaw > 0
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
          gpt_sizes:
            sequenceAds[0]?.gpt_sizes ??
            this.defaultGptSizes('entre-mensagens'),
          rotulo: sequenceAds[0]?.rotulo ?? 'PUBLICIDADE',
          rotuloAtivo: sequenceAds[0]?.rotuloAtivo !== false,
        };
        config['entre-mensagens'] = between;
        config.entre_mensagens = between;
        return;
      }

      const normalized = this.normalizeAdContract(row, position);
      if (!normalized) return;

      config[position] = {
        posicionamento: position,
        ativo: row.ativo !== false,
        codigo_tag: normalized.codigo_tag,
        codigo: normalized.codigo_tag,
        gpt_slot: normalized.gpt_slot,
        gpt_div_id: normalized.gpt_div_id,
        anuncio_fixed: normalized.anuncio_fixed,
        gpt_sizes: normalized.gpt_sizes,
        rotulo: normalized.rotulo,
        rotuloAtivo: normalized.rotuloAtivo !== false,
      };
    });

    return config;
  }

  private async readWebchatAdsConfig(
    organizationId: string,
    webchatId: string,
  ) {
    const rows = await (this.prisma as any).webchat_ads.findMany({
      where: {
        organization_id: organizationId,
        webchat_id: webchatId,
      },
      orderBy: { created_at: 'asc' },
    });

    return this.formatWebchatAdsRowsAsConfig(rows);
  }

  private async resolvePublicAdsConfig(
    organizationId: string,
    webchatId: string,
    adsConfigRaw: unknown,
    settings: Record<string, any>,
  ) {
    const fromTable = await this.readWebchatAdsConfig(
      organizationId,
      webchatId,
    );
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

  // Conta da org sem acesso ativo (assinatura vencida/pendente/bloqueada) → webchat
  // público fica indisponível (D4: "vencido = tudo para"). 503 com mensagem amigável.
  async resolvePublicWebchat(slug: string, domainHint?: string) {
    const webchat = await this.resolvePublicWebchatRaw(slug, domainHint);
    if (!(await this.access.isOrgActive(webchat.organization_id))) {
      throw new ServiceUnavailableException('Este webchat está temporariamente indisponível.');
    }
    return webchat;
  }

  private async resolvePublicWebchatRaw(slug: string, domainHint?: string) {
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

      if (scoped) return scoped;
    }

    const webchatsBySlug = await this.prisma.webchats.findMany({
      where: { slug, active: true },
      include: {
        agentes_ia: true,
      },
      take: 2,
    });

    if (webchatsBySlug.length === 0) {
      throw new NotFoundException('Webchat não encontrado.');
    }

    if (webchatsBySlug.length > 1) {
      throw new BadRequestException(
        'Webchat ambíguo para este slug. Informe o domínio no header x-webchat-domain.',
      );
    }

    return webchatsBySlug[0];
  }

  private getTokenCostPerMessage() {
    const raw =
      process.env.WEBCHAT_TOKENS_PER_MESSAGE ||
      process.env.WEBCHAT_TOKEN_COST_PER_MESSAGE ||
      '1000';
    const parsed = Number.parseInt(raw, 10);

    // if (!Number.isFinite(parsed) || parsed <= 0) {
    //   throw new InternalServerErrorException(
    //     'WEBCHAT_TOKENS_PER_MESSAGE inválido.',
    //   );
    // }

    return parsed;
  }

  private async debitTokensForWebchatMessage(
    organizationId: string,
    webchatId: string,
    cost: number,
    sessionId?: string,
  ) {
    // tx options altos: sob pico (1000+ leads simultâneos da mesma org),
    // todos disputam UPDATE na mesma row de wallet → lock contention.
    // 30s de timeout absorve fila razoável; em produção real (várias orgs
    // distintas, leads distribuídos) o lock contention basicamente não
    // existe.
    await this.prisma.$transaction(
      async (tx) => {
        const wallet = await tx.wallets.findFirst({
          where: {
            organization_id: organizationId,
            status: 'ACTIVE',
          },
          select: { id: true },
        });

        if (!wallet) {
          throw new BadRequestException(
            'Carteira da organização não encontrada ou inativa.',
          );
        }

        const updated = await tx.wallets.updateMany({
          where: {
            id: wallet.id,
            status: 'ACTIVE',
            balance: { gte: cost as any },
          },
          data: {
            balance: { decrement: cost as any },
          },
        });

        if (updated.count === 0) {
          throw new HttpException(
            'Saldo de tokens insuficiente para enviar mensagem no webchat.',
            HttpStatus.PAYMENT_REQUIRED,
          );
        }

        await tx.transactions.create({
          data: {
            wallet_id: wallet.id,
            amount: -cost,
            type: 'WEBCHAT_MESSAGE_IA',
            description: `Webchat ${webchatId}${sessionId ? ` | session ${sessionId}` : ''
              }`,
          },
        });
      },
      { maxWait: 30_000, timeout: 30_000 },
    );
  }
}
