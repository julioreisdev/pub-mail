import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSocialAccountDto } from './dto/create-social-account.dto';
import { ListSocialAccountsDto } from './dto/list-social-accounts.dto';
import { UpsertTikTokAppCredentialsDto } from './dto/upsert-tiktok-app-credentials.dto';
import { UpdateSocialAccountDto } from './dto/update-social-account.dto';
import { SocialAccountsCryptoService } from './social-accounts-crypto.service';
import {
  SOCIAL_ACCOUNT_STATUS_VALUES,
  SOCIAL_NETWORK_VALUES,
} from './dto/social-account-shared.dto';

function isPrismaUniqueError(e: any) {
  return e?.code === 'P2002';
}

function normalizeOptionalString(value?: string | null) {
  if (value === undefined || value === null) return value;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveSocialAccountUsername(input: {
  username?: string | null;
}) {
  return normalizeOptionalString(input.username) || null;
}

function resolveSocialAccountDisplayName(input: {
  username?: string | null;
  displayName?: string | null;
}) {
  return (
    normalizeOptionalString(input.displayName) ||
    normalizeOptionalString(input.username) ||
    null
  );
}

function clearProviderIdLikeName(
  value?: string | null,
  providerUserId?: string | null,
) {
  const normalizedValue = normalizeOptionalString(value);
  const normalizedProviderUserId = normalizeOptionalString(providerUserId);
  if (
    normalizedValue &&
    normalizedProviderUserId &&
    normalizedValue === normalizedProviderUserId
  ) {
    return null;
  }

  return normalizedValue;
}

type OAuthStatePayload = {
  organizationId: string;
  userId: string;
  network: string;
  returnTo: string;
  nonce: string;
  exp: number;
};

type OAuthCallbackInput = {
  network: string;
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
};

type TikTokOAuthConfig = {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  disableAutoAuth: '0' | '1';
  authorizeEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
};

type TikTokClientCredentials = {
  source: 'ORGANIZATION' | 'ENV' | 'NONE';
  clientKey: string | null;
  clientSecret: string | null;
};

type SanitizeReturnToOptions = {
  requestOriginRaw?: string;
  skipOriginAllowlist?: boolean;
};

@Injectable()
export class SocialAccountsService {
  private readonly logger = new Logger(SocialAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: SocialAccountsCryptoService,
  ) {}

  private readonly selectSafeFields = {
    id: true,
    organization_id: true,
    social_network: true,
    provider_user_id: true,
    username: true,
    display_name: true,
    profile_image_url: true,
    status: true,
    is_default: true,
    token_expires_at: true,
    scope: true,
    extra: true,
    created_at: true,
    updated_at: true,
  };

  getMeta() {
    return {
      allowed_networks: [...SOCIAL_NETWORK_VALUES],
      allowed_status: [...SOCIAL_ACCOUNT_STATUS_VALUES],
    };
  }

  private normalizeNetworkOrThrow(networkRaw: string) {
    const network = String(networkRaw || '').trim().toUpperCase();
    if (!SOCIAL_NETWORK_VALUES.includes(network as any)) {
      throw new BadRequestException('Rede social inválida para OAuth.');
    }

    return network as (typeof SOCIAL_NETWORK_VALUES)[number];
  }

  private normalizeOrigin(value?: string | null) {
    const input = normalizeOptionalString(value);
    if (!input) return null;

    try {
      const parsed = new URL(input);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return null;
      }

      return parsed.origin;
    } catch {
      return null;
    }
  }

  private sanitizeReturnTo(
    returnToRaw?: string,
    options: SanitizeReturnToOptions = {},
  ) {
    const fallback =
      process.env.SOCIAL_OAUTH_RETURN_TO_DEFAULT ||
      'http://localhost:3000/settings/account-settings?tab=logins';

    const fallbackOrigin = this.normalizeOrigin(fallback);
    const requestOrigin = this.normalizeOrigin(options.requestOriginRaw);

    const configuredAllowedOrigins = String(
      process.env.SOCIAL_OAUTH_ALLOWED_RETURN_TO_ORIGINS || '',
    )
      .split(',')
      .map((item) => this.normalizeOrigin(item))
      .filter((item): item is string => Boolean(item));

    const allowedOrigins = Array.from(
      new Set(
        [
          ...configuredAllowedOrigins,
          ...(requestOrigin ? [requestOrigin] : []),
          ...(fallbackOrigin ? [fallbackOrigin] : []),
        ].filter(Boolean),
      ),
    );

    const input = normalizeOptionalString(returnToRaw);
    if (!input) return fallback;

    try {
      const parsed = new URL(input);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return fallback;
      }

      const shouldEnforceAllowedOrigins =
        !options.skipOriginAllowlist &&
        (configuredAllowedOrigins.length > 0 || Boolean(requestOrigin));

      if (shouldEnforceAllowedOrigins && !allowedOrigins.includes(parsed.origin)) {
        return fallback;
      }

      return parsed.toString();
    } catch {
      return fallback;
    }
  }

  private getOAuthStateSecret() {
    const secret =
      process.env.SOCIAL_OAUTH_STATE_SECRET || process.env.JWT_ACCESS_SECRET;

    if (!secret) {
      throw new Error(
        'SOCIAL_OAUTH_STATE_SECRET (ou JWT_ACCESS_SECRET) não está configurado.',
      );
    }

    return secret;
  }

  private signOAuthState(payload: OAuthStatePayload) {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );
    const signature = crypto
      .createHmac('sha256', this.getOAuthStateSecret())
      .update(encodedPayload)
      .digest('base64url');

    return `${encodedPayload}.${signature}`;
  }

  private verifyOAuthState(state: string): OAuthStatePayload {
    const [encodedPayload, signature] = String(state || '').split('.');
    if (!encodedPayload || !signature) {
      throw new Error('State OAuth inválido.');
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.getOAuthStateSecret())
      .update(encodedPayload)
      .digest('base64url');

    const valid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );

    if (!valid) {
      throw new Error('State OAuth inválido (assinatura).');
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as OAuthStatePayload;

    if (!payload?.organizationId || !payload?.network || !payload?.exp) {
      throw new Error('State OAuth incompleto.');
    }

    return payload;
  }

  private buildReturnToUrl(
    returnTo: string,
    input: { oauth: 'success' | 'error'; network: string; message?: string },
    options: SanitizeReturnToOptions = {},
  ) {
    const redirect = new URL(this.sanitizeReturnTo(returnTo, options));
    redirect.searchParams.set('oauth', input.oauth);
    redirect.searchParams.set('network', input.network);

    const msg = normalizeOptionalString(input.message);
    if (msg) {
      redirect.searchParams.set('message', msg);
    }

    return redirect.toString();
  }

  private getMaskedSecret(secretRaw?: string | null) {
    const secret = normalizeOptionalString(secretRaw);
    if (!secret) return null;
    const suffix = secret.slice(-4);
    return `••••••••${suffix ? suffix : ''}`;
  }

  async resolveTikTokClientCredentialsForOrganization(
    organizationId: string,
  ): Promise<TikTokClientCredentials> {
    const custom = await this.prisma.organization_social_app_credentials.findFirst(
      {
        where: {
          organization_id: organizationId,
          social_network: 'TIKTOK',
        },
        select: {
          client_key: true,
          client_secret_encrypted: true,
        },
      },
    );

    const customClientKey = normalizeOptionalString(custom?.client_key);
    const customClientSecretEncrypted = normalizeOptionalString(
      custom?.client_secret_encrypted,
    );

    if (customClientKey && customClientSecretEncrypted) {
      try {
        const decryptedSecret = normalizeOptionalString(
          this.crypto.decrypt(customClientSecretEncrypted),
        );
        if (decryptedSecret) {
          return {
            source: 'ORGANIZATION',
            clientKey: customClientKey,
            clientSecret: decryptedSecret,
          };
        }
      } catch (error: any) {
        this.logger.warn(
          `[oauth-tiktok] falha ao ler credencial customizada da organização ${organizationId}: ${String(
            error?.message || error,
          )}`,
        );
      }
    }

    const envClientKey = normalizeOptionalString(process.env.TIKTOK_CLIENT_KEY);
    const envClientSecret = normalizeOptionalString(
      process.env.TIKTOK_CLIENT_SECRET,
    );

    if (envClientKey && envClientSecret) {
      return {
        source: 'ENV',
        clientKey: envClientKey,
        clientSecret: envClientSecret,
      };
    }

    return {
      source: 'NONE',
      clientKey: null,
      clientSecret: null,
    };
  }

  private async getTikTokOAuthConfig(
    organizationId: string,
  ): Promise<TikTokOAuthConfig> {
    const credentials = await this.resolveTikTokClientCredentialsForOrganization(
      organizationId,
    );

    if (!credentials.clientKey || !credentials.clientSecret) {
      throw new BadRequestException(
        'Configure TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET (ou salve Keys e APIs da organização) para iniciar o OAuth do TikTok.',
      );
    }

    const redirectUri =
      normalizeOptionalString(process.env.TIKTOK_REDIRECT_URI) ||
      `${normalizeOptionalString(process.env.BASE_API_URL) || 'http://localhost:3000'}/social-accounts/oauth/tiktok/callback`;

    const scopes =
      normalizeOptionalString(process.env.TIKTOK_OAUTH_SCOPES) ||
      'user.info.basic,video.upload,video.publish';

    const disableAutoAuth =
      normalizeOptionalString(process.env.TIKTOK_OAUTH_DISABLE_AUTO_AUTH) ===
      '0'
        ? '0'
        : '1';

    const authorizeEndpoint =
      normalizeOptionalString(process.env.TIKTOK_OAUTH_AUTHORIZE_ENDPOINT) ||
      'https://www.tiktok.com/v2/auth/authorize/';

    const tokenEndpoint =
      normalizeOptionalString(process.env.TIKTOK_OAUTH_TOKEN_ENDPOINT) ||
      'https://open.tiktokapis.com/v2/oauth/token/';

    const userInfoEndpoint =
      normalizeOptionalString(process.env.TIKTOK_USER_INFO_ENDPOINT) ||
      'https://open.tiktokapis.com/v2/user/info/';

    return {
      clientKey: credentials.clientKey,
      clientSecret: credentials.clientSecret,
      redirectUri,
      scopes,
      disableAutoAuth,
      authorizeEndpoint,
      tokenEndpoint,
      userInfoEndpoint,
    };
  }

  async getTikTokAppCredentialsSettings(organizationId: string) {
    const existing = await this.prisma.organization_social_app_credentials.findFirst(
      {
        where: {
          organization_id: organizationId,
          social_network: 'TIKTOK',
        },
        select: {
          client_key: true,
          client_secret_encrypted: true,
          updated_at: true,
        },
      },
    );

    const customClientKey = normalizeOptionalString(existing?.client_key) || '';
    const encryptedSecret = normalizeOptionalString(
      existing?.client_secret_encrypted,
    );

    let decryptedSecret: string | null = null;
    if (encryptedSecret) {
      try {
        decryptedSecret =
          normalizeOptionalString(this.crypto.decrypt(encryptedSecret)) || null;
      } catch (error: any) {
        this.logger.warn(
          `[oauth-tiktok] falha ao descriptografar secret salvo da organização ${organizationId}: ${String(
            error?.message || error,
          )}`,
        );
      }
    }

    const hasCustomCredentials = Boolean(customClientKey && decryptedSecret);

    return {
      social_network: 'TIKTOK',
      has_custom_credentials: hasCustomCredentials,
      using_fallback: !hasCustomCredentials,
      client_key: customClientKey,
      has_client_secret: Boolean(encryptedSecret),
      client_secret_masked: this.getMaskedSecret(decryptedSecret || null),
      updated_at: existing?.updated_at || null,
    };
  }

  async upsertTikTokAppCredentials(
    organizationId: string,
    dto: UpsertTikTokAppCredentialsDto,
  ) {
    const clientKey = normalizeOptionalString(dto.client_key);
    const clientSecret = normalizeOptionalString(dto.client_secret);

    if (!clientKey || !clientSecret) {
      throw new BadRequestException(
        'Client Key e Client Secret são obrigatórios para salvar a configuração do TikTok.',
      );
    }

    const encryptedSecret = this.crypto.encrypt(clientSecret);

    const existing = await this.prisma.organization_social_app_credentials.findFirst(
      {
        where: {
          organization_id: organizationId,
          social_network: 'TIKTOK',
        },
        select: { id: true },
      },
    );

    if (existing?.id) {
      await this.prisma.organization_social_app_credentials.update({
        where: { id: existing.id },
        data: {
          client_key: clientKey,
          client_secret_encrypted: encryptedSecret,
        },
      });
    } else {
      await this.prisma.organization_social_app_credentials.create({
        data: {
          organization_id: organizationId,
          social_network: 'TIKTOK',
          client_key: clientKey,
          client_secret_encrypted: encryptedSecret,
        },
      });
    }

    return this.getTikTokAppCredentialsSettings(organizationId);
  }

  async getOAuthAuthorizationUrl(
    organizationId: string,
    userId: string,
    networkRaw: string,
    returnToRaw?: string,
    requestOriginRaw?: string,
  ) {
    const network = this.normalizeNetworkOrThrow(networkRaw);

    if (network !== 'TIKTOK') {
      throw new BadRequestException(
        `OAuth da rede ${network} ainda não está disponível.`,
      );
    }

    const config = await this.getTikTokOAuthConfig(organizationId);
    const returnTo = this.sanitizeReturnTo(returnToRaw, { requestOriginRaw });

    const state = this.signOAuthState({
      organizationId,
      userId,
      network,
      returnTo,
      nonce: crypto.randomBytes(16).toString('hex'),
      exp: Date.now() + 10 * 60 * 1000,
    });

    const authorizationUrl = new URL(config.authorizeEndpoint);
    authorizationUrl.searchParams.set('client_key', config.clientKey);
    authorizationUrl.searchParams.set('scope', config.scopes);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('redirect_uri', config.redirectUri);
    authorizationUrl.searchParams.set(
      'disable_auto_auth',
      config.disableAutoAuth,
    );
    authorizationUrl.searchParams.set('state', state);

    return {
      network,
      authorization_url: authorizationUrl.toString(),
      callback_url: config.redirectUri,
    };
  }

  async handleOAuthCallback(input: OAuthCallbackInput) {
    const network = this.normalizeNetworkOrThrow(input.network);
    const fallbackReturnTo = this.sanitizeReturnTo();

    if (!input.state) {
      this.logger.warn(`[OAuth ${network}] Callback recebido sem parâmetro state.`);
      return this.buildReturnToUrl(fallbackReturnTo, {
        oauth: 'error',
        network,
        message: 'State OAuth ausente.',
      });
    }

    let statePayload: OAuthStatePayload;
    try {
      statePayload = this.verifyOAuthState(input.state);
    } catch (error: any) {
      this.logger.warn(
        `[OAuth ${network}] State inválido no callback: ${String(
          error?.message || 'erro desconhecido',
        )}`,
      );
      return this.buildReturnToUrl(fallbackReturnTo, {
        oauth: 'error',
        network,
        message: String(error?.message || 'State OAuth inválido.').slice(0, 180),
      });
    }

    const returnTo = this.sanitizeReturnTo(statePayload.returnTo, {
      skipOriginAllowlist: true,
    });

    if (statePayload.network !== network) {
      this.logger.warn(
        `[OAuth ${network}] State incompatível com a rede (state=${statePayload.network}).`,
      );
      return this.buildReturnToUrl(returnTo, {
        oauth: 'error',
        network,
        message: 'State OAuth incompatível com a rede informada.',
      }, { skipOriginAllowlist: true });
    }

    if (Date.now() > Number(statePayload.exp || 0)) {
      this.logger.warn(
        `[OAuth ${network}] State expirado (org=${statePayload.organizationId}).`,
      );
      return this.buildReturnToUrl(returnTo, {
        oauth: 'error',
        network,
        message: 'State OAuth expirado. Tente conectar novamente.',
      }, { skipOriginAllowlist: true });
    }

    if (input.error) {
      this.logger.warn(
        `[OAuth ${network}] Provedor retornou erro de autorização: ${String(
          input.errorDescription || input.error,
        )}`,
      );
      return this.buildReturnToUrl(returnTo, {
        oauth: 'error',
        network,
        message: String(input.errorDescription || input.error).slice(0, 180),
      }, { skipOriginAllowlist: true });
    }

    if (!input.code) {
      this.logger.warn(
        `[OAuth ${network}] Callback sem code (org=${statePayload.organizationId}).`,
      );
      return this.buildReturnToUrl(returnTo, {
        oauth: 'error',
        network,
        message: 'Código OAuth não foi recebido no callback.',
      }, { skipOriginAllowlist: true });
    }

    try {
      if (network === 'TIKTOK') {
        await this.completeTikTokOAuth({
          organizationId: statePayload.organizationId,
          code: input.code,
        });
      } else {
        throw new Error(`OAuth da rede ${network} ainda não está disponível.`);
      }

      return this.buildReturnToUrl(returnTo, {
        oauth: 'success',
        network,
      }, { skipOriginAllowlist: true });
    } catch (error: any) {
      this.logger.error(
        `[OAuth ${network}] Falha ao concluir conexão (org=${statePayload.organizationId}): ${String(
          error?.message || 'erro desconhecido',
        )}`,
        error?.stack,
      );
      return this.buildReturnToUrl(returnTo, {
        oauth: 'error',
        network,
        message: String(error?.message || 'Falha ao concluir OAuth.').slice(
          0,
          180,
        ),
      }, { skipOriginAllowlist: true });
    }
  }

  private extractTikTokPayload(raw: any) {
    if (raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object') {
      return raw.data;
    }

    return raw ?? {};
  }

  private extractTikTokErrorMessage(raw: any, fallback: string) {
    const errorNode = raw?.error;
    const candidates = [
      raw?.error_description,
      raw?.description,
      raw?.message,
      typeof errorNode === 'string' ? errorNode : undefined,
      typeof errorNode === 'object' ? errorNode?.message : undefined,
      typeof errorNode === 'object' ? errorNode?.description : undefined,
      typeof errorNode === 'object' ? errorNode?.error_description : undefined,
      typeof errorNode === 'object' ? errorNode?.code : undefined,
    ];

    for (const candidate of candidates) {
      const normalized = normalizeOptionalString(
        typeof candidate === 'string' || typeof candidate === 'number'
          ? String(candidate)
          : null,
      );
      if (normalized) return normalized;
    }

    try {
      const serialized = JSON.stringify(raw);
      return normalizeOptionalString(serialized) || fallback;
    } catch {
      return fallback;
    }
  }

  private extractTikTokErrorCode(raw: any) {
    return normalizeOptionalString(
      raw?.error?.code || raw?.code || raw?.error_code,
    );
  }

  private extractTikTokErrorLogId(raw: any) {
    return normalizeOptionalString(raw?.error?.log_id || raw?.log_id);
  }

  private buildTikTokErrorLogContext(
    error: any,
    extra: Record<string, any> = {},
  ) {
    const raw = error?.tiktokRaw ?? {};
    const context = {
      status: Number(error?.tiktokHttpStatus || 0) || undefined,
      code: this.extractTikTokErrorCode(raw),
      log_id: this.extractTikTokErrorLogId(raw),
      stage: normalizeOptionalString(error?.tiktokStage),
      endpoint: normalizeOptionalString(error?.tiktokEndpoint),
      fields: normalizeOptionalString(error?.tiktokFields),
      message: normalizeOptionalString(error?.message),
      ...extra,
    };

    return JSON.stringify(context);
  }

  private normalizeScope(rawScope: any) {
    if (Array.isArray(rawScope)) {
      return rawScope.map((item) => String(item)).filter(Boolean);
    }

    const normalized = String(rawScope || '').trim();
    if (!normalized) return [];

    return normalized
      .split(/[,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private hasTikTokUserInfoScope(scope: string[]) {
    return scope.map((item) => String(item).toLowerCase()).includes(
      'user.info.basic',
    );
  }

  private buildTikTokProfileExtra(input: {
    existingExtra?: any;
    unionId?: string | null;
    profileIncomplete: boolean;
    profileSyncError?: string | null;
    scope?: string[];
  }) {
    const base =
      input.existingExtra &&
      typeof input.existingExtra === 'object' &&
      !Array.isArray(input.existingExtra)
        ? { ...input.existingExtra }
        : {};

    const next: Record<string, any> = {
      ...base,
      oauth_provider: 'TIKTOK',
      profile_incomplete: Boolean(input.profileIncomplete),
      profile_last_sync_at: new Date().toISOString(),
    };

    if (input.unionId !== undefined) {
      next.union_id = input.unionId;
    }

    if (Array.isArray(input.scope) && input.scope.length > 0) {
      next.profile_scope = input.scope;
    }

    const normalizedError = normalizeOptionalString(input.profileSyncError);
    if (normalizedError) {
      next.profile_sync_error = normalizedError.slice(0, 180);
    } else {
      delete next.profile_sync_error;
    }

    return next;
  }

  private async exchangeTikTokRefreshToken(
    config: TikTokOAuthConfig,
    refreshTokenRaw: string,
  ) {
    const refreshToken = normalizeOptionalString(refreshTokenRaw);
    if (!refreshToken) {
      throw new Error('Refresh token do TikTok indisponível para renovação.');
    }

    const body = new URLSearchParams();
    body.set('client_key', config.clientKey);
    body.set('client_secret', config.clientSecret);
    body.set('grant_type', 'refresh_token');
    body.set('refresh_token', refreshToken);

    const response = await fetch(config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const raw = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error: any = new Error(
        `TikTok token refresh (${response.status}): ${this.extractTikTokErrorMessage(
          raw,
          'Falha ao renovar token no TikTok.',
        )}`,
      );
      error.tiktokHttpStatus = response.status;
      error.tiktokRaw = raw;
      error.tiktokStage = 'refresh_token';
      error.tiktokEndpoint = config.tokenEndpoint;
      throw error;
    }

    const data = this.extractTikTokPayload(raw);
    const accessToken = normalizeOptionalString(data?.access_token);
    if (!accessToken) {
      throw new Error(
        'TikTok não retornou access_token na renovação do token.',
      );
    }

    const nextRefreshToken =
      normalizeOptionalString(data?.refresh_token) || refreshToken;
    const expiresIn = Number(data?.expires_in || data?.expiresIn || 0);
    const scope = this.normalizeScope(data?.scope || data?.scopes);

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      expiresIn,
      scope,
    };
  }

  private async fetchTikTokProfile(
    userInfoEndpoint: string,
    accessToken: string,
  ) {
    const executeRequest = async (fields: string) => {
      const endpoint = new URL(userInfoEndpoint);
      endpoint.searchParams.set('fields', fields);

      const response = await fetch(endpoint.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const rawBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error: any = new Error(
          `TikTok user info (${response.status}): ${this.extractTikTokErrorMessage(
            rawBody,
            'Falha ao consultar perfil do TikTok.',
          )}`,
        );
        error.tiktokHttpStatus = response.status;
        error.tiktokRaw = rawBody;
        error.tiktokStage = 'user_info';
        error.tiktokFields = fields;
        error.tiktokEndpoint = `${endpoint.origin}${endpoint.pathname}`;
        throw error;
      }

      const payload = this.extractTikTokPayload(rawBody);
      if (payload?.user && typeof payload.user === 'object') {
        return payload.user;
      }

      return payload;
    };

    const minimalFields = 'open_id,avatar_url,display_name';
    const configuredFields = normalizeOptionalString(
      new URL(userInfoEndpoint).searchParams.get('fields'),
    );
    const firstFields = configuredFields || minimalFields;

    try {
      return await executeRequest(firstFields);
    } catch (error: any) {
      const isUnauthorized = Number(error?.tiktokHttpStatus) === 401;
      const canFallbackToMinimal =
        Boolean(isUnauthorized) &&
        Boolean(configuredFields) &&
        configuredFields !== minimalFields;

      if (!canFallbackToMinimal) {
        throw error;
      }

      this.logger.warn(
        `[OAuth TIKTOK] user info com fields customizados falhou por escopo; retry com fields mínimos (${minimalFields}).`,
      );

      return executeRequest(minimalFields);
    }
  }

  private async completeTikTokOAuth(input: {
    organizationId: string;
    code: string;
  }) {
    const config = await this.getTikTokOAuthConfig(input.organizationId);

    const body = new URLSearchParams();
    body.set('client_key', config.clientKey);
    body.set('client_secret', config.clientSecret);
    body.set('code', input.code);
    body.set('grant_type', 'authorization_code');
    body.set('redirect_uri', config.redirectUri);

    const tokenResponse = await fetch(config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const tokenRaw = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok) {
      throw new Error(
        `TikTok token exchange (${tokenResponse.status}): ${this.extractTikTokErrorMessage(
          tokenRaw,
          'Falha ao trocar código OAuth por token no TikTok.',
        )}`,
      );
    }

    const tokenData = this.extractTikTokPayload(tokenRaw);
    let accessToken = normalizeOptionalString(tokenData?.access_token);
    if (!accessToken) {
      throw new Error('TikTok não retornou access_token.');
    }

    let refreshToken = normalizeOptionalString(tokenData?.refresh_token);
    const openIdFromToken = normalizeOptionalString(
      tokenData?.open_id || tokenData?.openid,
    );
    let expiresIn = Number(tokenData?.expires_in || tokenData?.expiresIn || 0);
    let scope = this.normalizeScope(tokenData?.scope || tokenData?.scopes);

    let profile: any = {};
    let profileSyncError: string | null = null;
    let usedOpenIdFallback = false;
    try {
      profile = await this.fetchTikTokProfile(config.userInfoEndpoint, accessToken);
    } catch (error: any) {
      this.logger.warn(
        `[OAuth TIKTOK] primeira tentativa user info falhou: ${this.buildTikTokErrorLogContext(
          error,
          {
            organization_id: input.organizationId,
            token_scope: scope,
            has_user_info_basic: this.hasTikTokUserInfoScope(scope),
          },
        )}`,
      );

      const isUnauthorizedUserInfo = Number(error?.tiktokHttpStatus) === 401;
      const canRefresh = Boolean(isUnauthorizedUserInfo && refreshToken);

      if (canRefresh) {
        try {
          const refreshed = await this.exchangeTikTokRefreshToken(
            config,
            refreshToken!,
          );

          accessToken = refreshed.accessToken;
          refreshToken = refreshed.refreshToken;
          expiresIn = refreshed.expiresIn;
          if (Array.isArray(refreshed.scope) && refreshed.scope.length > 0) {
            scope = refreshed.scope;
          }

          profile = await this.fetchTikTokProfile(
            config.userInfoEndpoint,
            accessToken,
          );
        } catch (refreshError: any) {
          this.logger.warn(
            `[OAuth TIKTOK] falha ao recuperar perfil via refresh: ${this.buildTikTokErrorLogContext(
              refreshError,
              {
                organization_id: input.organizationId,
                token_scope: scope,
                has_user_info_basic: this.hasTikTokUserInfoScope(scope),
              },
            )}`,
          );
          error = refreshError;
        }
      }

      if (profile?.open_id || profile?.openId || profile?.username) {
        // Perfil recuperado após refresh.
      } else if (!openIdFromToken) {
        throw error;
      } else {
        profileSyncError = String(error?.message || 'Falha ao consultar perfil.');
        usedOpenIdFallback = true;

        this.logger.warn(
          `[OAuth TIKTOK] perfil indisponível após tentativas (org=${input.organizationId}); fallback via open_id.`,
        );

        profile = {
          open_id: openIdFromToken,
          union_id: normalizeOptionalString(tokenData?.union_id || tokenData?.unionId),
        };
      }
    }

    const providerUserId = normalizeOptionalString(
      profile?.open_id || profile?.openId || openIdFromToken,
    );

    if (!providerUserId) {
      throw new Error(
        'Não foi possível identificar a conta do TikTok (open_id ausente).',
      );
    }

    const username = resolveSocialAccountUsername({
      username: profile?.username,
    });
    const displayName = resolveSocialAccountDisplayName({
      username,
      displayName: profile?.display_name || profile?.displayName,
    });
    const profileImageUrl = normalizeOptionalString(
      profile?.avatar_url || profile?.avatarUrl,
    );
    const profileIncomplete = !displayName && !username;
    const missingScopeMessage = !this.hasTikTokUserInfoScope(scope)
      ? 'Escopo user.info.basic ausente no token retornado.'
      : null;
    const resolvedProfileSyncError =
      profileSyncError ||
      missingScopeMessage ||
      (usedOpenIdFallback || profileIncomplete
        ? 'TikTok não retornou nome de exibição para esta conta.'
        : null);

    const tokenExpiresAt =
      Number.isFinite(expiresIn) && expiresIn > 0
        ? new Date(Date.now() + expiresIn * 1000)
        : null;

    const existingByProvider = await this.prisma.social_accounts.findFirst({
      where: {
        organization_id: input.organizationId,
        social_network: 'TIKTOK',
        provider_user_id: providerUserId,
      },
      select: {
        id: true,
        username: true,
        display_name: true,
        extra: true,
      },
    });

    let existingId = existingByProvider?.id || null;
    let existingAccountRef = existingByProvider;

    const dedupIdentifier = username || displayName;
    if (!existingId && dedupIdentifier) {
      const existingByUsername = await this.prisma.social_accounts.findFirst({
        where: {
          organization_id: input.organizationId,
          social_network: 'TIKTOK',
          OR: [
            { username: dedupIdentifier },
            { display_name: dedupIdentifier },
          ],
        },
        select: {
          id: true,
          username: true,
          display_name: true,
          extra: true,
        },
      });

      if (existingByUsername?.id) {
        existingId = existingByUsername.id;
        this.logger.log(
          `[OAuth TIKTOK] deduplicação aplicada por nome (org=${input.organizationId}, id=${existingByUsername.id}).`,
        );
        existingAccountRef = existingByUsername;
      }
    }

    if (existingId) {
      const existingUsernameSanitized = clearProviderIdLikeName(
        existingAccountRef?.username,
        providerUserId,
      );
      const existingDisplayNameSanitized = clearProviderIdLikeName(
        existingAccountRef?.display_name,
        providerUserId,
      );
      const nextUsername = username || existingUsernameSanitized || null;
      const nextDisplayName =
        displayName || existingDisplayNameSanitized || nextUsername || null;

      await this.prisma.social_accounts.update({
        where: { id: existingId },
        data: {
          provider_user_id: providerUserId,
          username: nextUsername,
          display_name: nextDisplayName,
          profile_image_url: profileImageUrl,
          status: 'ACTIVE',
          access_token_encrypted: this.crypto.encrypt(accessToken),
          refresh_token_encrypted: refreshToken
            ? this.crypto.encrypt(refreshToken)
            : null,
          token_expires_at: tokenExpiresAt,
          scope,
          extra: this.buildTikTokProfileExtra({
            existingExtra: existingAccountRef?.extra,
            unionId: normalizeOptionalString(
              profile?.union_id || profile?.unionId,
            ),
            profileIncomplete: !nextDisplayName && !nextUsername,
            profileSyncError: resolvedProfileSyncError,
            scope,
          }),
        },
      });

      return;
    }

    const hasDefault = await this.prisma.social_accounts.findFirst({
      where: {
        organization_id: input.organizationId,
        social_network: 'TIKTOK',
        is_default: true,
      },
      select: { id: true },
    });

    await this.prisma.social_accounts.create({
      data: {
        organization_id: input.organizationId,
        social_network: 'TIKTOK',
        provider_user_id: providerUserId,
        username,
        display_name: displayName || null,
        profile_image_url: profileImageUrl,
        status: 'ACTIVE',
        is_default: !hasDefault,
        access_token_encrypted: this.crypto.encrypt(accessToken),
        refresh_token_encrypted: refreshToken
          ? this.crypto.encrypt(refreshToken)
          : null,
        token_expires_at: tokenExpiresAt,
        scope,
        extra: this.buildTikTokProfileExtra({
          unionId: normalizeOptionalString(profile?.union_id || profile?.unionId),
          profileIncomplete,
          profileSyncError: resolvedProfileSyncError,
          scope,
        }),
      },
    });
  }

  async syncTikTokProfile(organizationId: string, socialAccountId: string) {
    const account = await this.prisma.social_accounts.findFirst({
      where: {
        id: socialAccountId,
        organization_id: organizationId,
        social_network: 'TIKTOK',
      },
      select: {
        id: true,
        provider_user_id: true,
        username: true,
        display_name: true,
        profile_image_url: true,
        access_token_encrypted: true,
        refresh_token_encrypted: true,
        token_expires_at: true,
        scope: true,
        extra: true,
      },
    });

    if (!account?.id) {
      throw new NotFoundException('Conta social do TikTok não encontrada.');
    }

    const config = await this.getTikTokOAuthConfig(organizationId);
    const currentScope = this.normalizeScope(account.scope);
    const encryptedAccessToken = normalizeOptionalString(
      account.access_token_encrypted,
    );
    const encryptedRefreshToken = normalizeOptionalString(
      account.refresh_token_encrypted,
    );

    let accessToken: string | null = null;
    let refreshToken: string | null = null;

    if (encryptedAccessToken) {
      try {
        accessToken = normalizeOptionalString(
          this.crypto.decrypt(encryptedAccessToken),
        ) || null;
      } catch (error: any) {
        this.logger.warn(
          `[sync-profile] falha ao descriptografar access token da conta ${socialAccountId}: ${String(
            error?.message || error,
          )}`,
        );
      }
    }

    if (encryptedRefreshToken) {
      try {
        refreshToken = normalizeOptionalString(
          this.crypto.decrypt(encryptedRefreshToken),
        ) || null;
      } catch (error: any) {
        this.logger.warn(
          `[sync-profile] falha ao descriptografar refresh token da conta ${socialAccountId}: ${String(
            error?.message || error,
          )}`,
        );
      }
    }
    let scope = currentScope;
    let expiresIn: number | null = null;

    if (!accessToken && refreshToken) {
      const refreshed = await this.exchangeTikTokRefreshToken(
        config,
        refreshToken,
      );
      accessToken = refreshed.accessToken;
      refreshToken = refreshed.refreshToken;
      expiresIn = refreshed.expiresIn;
      if (refreshed.scope.length > 0) {
        scope = refreshed.scope;
      }
    }

    if (!accessToken) {
      throw new BadRequestException(
        'Conta sem access token para sincronizar perfil. Reconecte a conta do TikTok.',
      );
    }

    let profile: any = {};
    let profileSyncError: string | null = null;
    try {
      profile = await this.fetchTikTokProfile(config.userInfoEndpoint, accessToken);
    } catch (error: any) {
      this.logger.warn(
        `[sync-profile] primeira tentativa user info falhou: ${this.buildTikTokErrorLogContext(
          error,
          {
            organization_id: organizationId,
            social_account_id: socialAccountId,
            token_scope: scope,
            has_user_info_basic: this.hasTikTokUserInfoScope(scope),
          },
        )}`,
      );

      const isUnauthorized = Number(error?.tiktokHttpStatus) === 401;
      if (isUnauthorized && refreshToken) {
        try {
          const refreshed = await this.exchangeTikTokRefreshToken(
            config,
            refreshToken,
          );
          accessToken = refreshed.accessToken;
          refreshToken = refreshed.refreshToken;
          expiresIn = refreshed.expiresIn;
          if (refreshed.scope.length > 0) {
            scope = refreshed.scope;
          }

          profile = await this.fetchTikTokProfile(
            config.userInfoEndpoint,
            accessToken,
          );
        } catch (retryError: any) {
          this.logger.warn(
            `[sync-profile] retry de user info após refresh falhou: ${this.buildTikTokErrorLogContext(
              retryError,
              {
                organization_id: organizationId,
                social_account_id: socialAccountId,
                token_scope: scope,
                has_user_info_basic: this.hasTikTokUserInfoScope(scope),
              },
            )}`,
          );
          profileSyncError = String(
            retryError?.message || 'falha ao sincronizar perfil via retry',
          );
        }
      } else {
        profileSyncError = String(
          error?.message || 'falha ao consultar user info',
        );
      }
    }

    const username = resolveSocialAccountUsername({
      username: profile?.username,
    });
    const displayName = resolveSocialAccountDisplayName({
      username,
      displayName: profile?.display_name || profile?.displayName,
    });
    const profileImageUrl = normalizeOptionalString(
      profile?.avatar_url || profile?.avatarUrl,
    );

    const existingUsernameSanitized = clearProviderIdLikeName(
      account.username,
      account.provider_user_id,
    );
    const existingDisplayNameSanitized = clearProviderIdLikeName(
      account.display_name,
      account.provider_user_id,
    );
    const nextUsername = username || existingUsernameSanitized || null;
    const nextDisplayName =
      displayName || existingDisplayNameSanitized || nextUsername || null;
    const profileIncomplete = !nextDisplayName && !nextUsername;
    const resolvedProfileSyncError =
      normalizeOptionalString(profileSyncError) ||
      (profileIncomplete
        ? 'TikTok não retornou nome de exibição para esta conta.'
        : null);
    const tokenExpiresAt =
      Number.isFinite(expiresIn || 0) && Number(expiresIn) > 0
        ? new Date(Date.now() + Number(expiresIn) * 1000)
        : undefined;

    const updated = await this.prisma.social_accounts.update({
      where: { id: account.id },
      data: {
        username: nextUsername,
        display_name: nextDisplayName,
        profile_image_url: profileImageUrl || account.profile_image_url,
        status: 'ACTIVE',
        access_token_encrypted: this.crypto.encrypt(accessToken),
        refresh_token_encrypted: refreshToken
          ? this.crypto.encrypt(refreshToken)
          : encryptedRefreshToken,
        token_expires_at:
          tokenExpiresAt === undefined ? account.token_expires_at : tokenExpiresAt,
        scope: scope.length > 0 ? scope : undefined,
        extra: this.buildTikTokProfileExtra({
          existingExtra: account.extra,
          unionId: normalizeOptionalString(profile?.union_id || profile?.unionId),
          profileIncomplete,
          profileSyncError: resolvedProfileSyncError,
          scope,
        }),
      },
      select: this.selectSafeFields,
    });

    return {
      ...updated,
      profile_sync_ok: !profileIncomplete && !resolvedProfileSyncError,
      profile_sync_error: resolvedProfileSyncError,
    };
  }

  async list(organizationId: string, query: ListSocialAccountsDto) {
    const rawItems = await this.prisma.social_accounts.findMany({
      where: {
        organization_id: organizationId,
        ...(query.social_network ? { social_network: query.social_network as any } : {}),
      },
      orderBy: [{ created_at: 'desc' }],
      select: this.selectSafeFields,
    });

    const items = rawItems.map((item) => {
      const username = clearProviderIdLikeName(
        resolveSocialAccountUsername({
          username: item.username,
        }),
        item.provider_user_id,
      );

      const displayName =
        clearProviderIdLikeName(
          resolveSocialAccountDisplayName({
            username,
            displayName: item.display_name,
          }),
          item.provider_user_id,
        ) || username;

      return {
        ...item,
        username,
        display_name: displayName,
      };
    });

    return {
      items,
      meta: this.getMeta(),
    };
  }

  async create(organizationId: string, dto: CreateSocialAccountDto) {
    const data: any = {
      organization_id: organizationId,
      social_network: dto.social_network as any,
      provider_user_id: String(dto.provider_user_id).trim(),
      username: normalizeOptionalString(dto.username),
      display_name: normalizeOptionalString(dto.display_name),
      profile_image_url: normalizeOptionalString(dto.profile_image_url),
      status: dto.status ? (dto.status as any) : ('ACTIVE' as any),
      is_default: Boolean(dto.is_default),
      token_expires_at: dto.token_expires_at
        ? new Date(dto.token_expires_at)
        : undefined,
      scope: Array.isArray(dto.scope) ? dto.scope : undefined,
      extra:
        dto.extra && typeof dto.extra === 'object'
          ? (dto.extra as Record<string, any>)
          : undefined,
    };

    if (dto.access_token !== undefined) {
      data.access_token_encrypted = dto.access_token
        ? this.crypto.encrypt(dto.access_token)
        : null;
    }
    if (dto.refresh_token !== undefined) {
      data.refresh_token_encrypted = dto.refresh_token
        ? this.crypto.encrypt(dto.refresh_token)
        : null;
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        if (data.is_default) {
          await tx.social_accounts.updateMany({
            where: {
              organization_id: organizationId,
              social_network: data.social_network,
              is_default: true,
            },
            data: { is_default: false },
          });
        }

        return tx.social_accounts.create({
          data,
          select: this.selectSafeFields,
        });
      });

      return created;
    } catch (e: any) {
      if (isPrismaUniqueError(e)) {
        throw new BadRequestException(
          'Essa conta social já está cadastrada nesta organização.',
        );
      }
      throw e;
    }
  }

  async update(
    organizationId: string,
    socialAccountId: string,
    dto: UpdateSocialAccountDto,
  ) {
    const existing = await this.prisma.social_accounts.findFirst({
      where: { id: socialAccountId, organization_id: organizationId },
      select: {
        id: true,
        social_network: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Conta social não encontrada.');
    }

    const data: any = {
      username:
        dto.username !== undefined ? normalizeOptionalString(dto.username) : undefined,
      display_name:
        dto.display_name !== undefined
          ? normalizeOptionalString(dto.display_name)
          : undefined,
      profile_image_url:
        dto.profile_image_url !== undefined
          ? normalizeOptionalString(dto.profile_image_url)
          : undefined,
      status: dto.status ? (dto.status as any) : undefined,
      is_default:
        dto.is_default !== undefined ? Boolean(dto.is_default) : undefined,
      token_expires_at:
        dto.token_expires_at !== undefined
          ? dto.token_expires_at
            ? new Date(dto.token_expires_at)
            : null
          : undefined,
      scope: dto.scope !== undefined ? dto.scope : undefined,
      extra: dto.extra !== undefined ? dto.extra : undefined,
    };

    if (dto.access_token !== undefined) {
      data.access_token_encrypted = dto.access_token
        ? this.crypto.encrypt(dto.access_token)
        : null;
    }
    if (dto.refresh_token !== undefined) {
      data.refresh_token_encrypted = dto.refresh_token
        ? this.crypto.encrypt(dto.refresh_token)
        : null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (data.is_default === true) {
        await tx.social_accounts.updateMany({
          where: {
            organization_id: organizationId,
            social_network: existing.social_network as any,
            is_default: true,
            id: { not: socialAccountId },
          },
          data: { is_default: false },
        });
      }

      return tx.social_accounts.update({
        where: { id: socialAccountId },
        data,
        select: this.selectSafeFields,
      });
    });

    return updated;
  }

  async remove(organizationId: string, socialAccountId: string) {
    const existing = await this.prisma.social_accounts.findFirst({
      where: { id: socialAccountId, organization_id: organizationId },
      select: {
        id: true,
        social_network: true,
        is_default: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Conta social não encontrada.');
    }

    const pendingSchedules = await this.prisma.social_post_schedules.count({
      where: {
        organization_id: organizationId,
        social_account_id: existing.id,
        status: { in: ['SCHEDULED', 'PROCESSING'] as any },
      },
    });

    if (pendingSchedules > 0) {
      throw new BadRequestException(
        'Não é possível remover a conta social com agendamentos pendentes.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.social_accounts.delete({
        where: { id: socialAccountId },
      });

      if (existing.is_default) {
        const fallback = await tx.social_accounts.findFirst({
          where: {
            organization_id: organizationId,
            social_network: existing.social_network as any,
          },
          orderBy: [{ updated_at: 'desc' }],
          select: { id: true },
        });

        if (fallback?.id) {
          await tx.social_accounts.update({
            where: { id: fallback.id },
            data: { is_default: true },
          });
        }
      }
    });

    return { message: 'Conta social removida com sucesso.' };
  }
}
