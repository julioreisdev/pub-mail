"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.NullableJsonNullValueInput = exports.SortOrder = exports.System_settingsScalarFieldEnum = exports.Avatar_generationsScalarFieldEnum = exports.AvatarsScalarFieldEnum = exports.Organization_social_app_credentialsScalarFieldEnum = exports.Social_accountsScalarFieldEnum = exports.Social_post_schedule_runsScalarFieldEnum = exports.Social_post_schedulesScalarFieldEnum = exports.Post_mediaScalarFieldEnum = exports.PostsScalarFieldEnum = exports.Webchat_domainsScalarFieldEnum = exports.Webchat_sessionsScalarFieldEnum = exports.Webchat_leadsScalarFieldEnum = exports.Webchat_ad_eventsScalarFieldEnum = exports.Webchat_adsScalarFieldEnum = exports.WebchatsScalarFieldEnum = exports.Agentes_iaScalarFieldEnum = exports.Organization_domainsScalarFieldEnum = exports.Email_schedules_sent_opensScalarFieldEnum = exports.Email_projects_schedules_sentScalarFieldEnum = exports.Email_projects_schedulesScalarFieldEnum = exports.Email_project_leadsScalarFieldEnum = exports.Email_leadsScalarFieldEnum = exports.Email_templatesScalarFieldEnum = exports.Email_projectsScalarFieldEnum = exports.WalletsScalarFieldEnum = exports.UsersScalarFieldEnum = exports.TransactionsScalarFieldEnum = exports.OrganizationsScalarFieldEnum = exports.Billing_cardsScalarFieldEnum = exports.TransactionIsolationLevel = exports.ModelName = exports.AnyNull = exports.JsonNull = exports.DbNull = exports.NullTypes = exports.prismaVersion = exports.getExtensionContext = exports.Decimal = exports.Sql = exports.raw = exports.join = exports.empty = exports.sql = exports.PrismaClientValidationError = exports.PrismaClientInitializationError = exports.PrismaClientRustPanicError = exports.PrismaClientUnknownRequestError = exports.PrismaClientKnownRequestError = void 0;
exports.defineExtension = exports.system_settingsOrderByRelevanceFieldEnum = exports.avatar_generationsOrderByRelevanceFieldEnum = exports.avatarsOrderByRelevanceFieldEnum = exports.organization_social_app_credentialsOrderByRelevanceFieldEnum = exports.social_accountsOrderByRelevanceFieldEnum = exports.social_post_schedule_runsOrderByRelevanceFieldEnum = exports.social_post_schedulesOrderByRelevanceFieldEnum = exports.post_mediaOrderByRelevanceFieldEnum = exports.postsOrderByRelevanceFieldEnum = exports.webchat_domainsOrderByRelevanceFieldEnum = exports.webchat_sessionsOrderByRelevanceFieldEnum = exports.webchat_leadsOrderByRelevanceFieldEnum = exports.webchat_ad_eventsOrderByRelevanceFieldEnum = exports.webchat_adsOrderByRelevanceFieldEnum = exports.webchatsOrderByRelevanceFieldEnum = exports.agentes_iaOrderByRelevanceFieldEnum = exports.organization_domainsOrderByRelevanceFieldEnum = exports.email_schedules_sent_opensOrderByRelevanceFieldEnum = exports.email_projects_schedules_sentOrderByRelevanceFieldEnum = exports.email_projects_schedulesOrderByRelevanceFieldEnum = exports.email_project_leadsOrderByRelevanceFieldEnum = exports.email_leadsOrderByRelevanceFieldEnum = exports.email_templatesOrderByRelevanceFieldEnum = exports.email_projectsOrderByRelevanceFieldEnum = exports.QueryMode = exports.JsonNullValueFilter = exports.walletsOrderByRelevanceFieldEnum = exports.usersOrderByRelevanceFieldEnum = exports.transactionsOrderByRelevanceFieldEnum = exports.organizationsOrderByRelevanceFieldEnum = exports.billing_cardsOrderByRelevanceFieldEnum = exports.NullsOrder = exports.JsonNullValueInput = void 0;
const runtime = __importStar(require("@prisma/client/runtime/client"));
exports.PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError;
exports.PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError;
exports.PrismaClientRustPanicError = runtime.PrismaClientRustPanicError;
exports.PrismaClientInitializationError = runtime.PrismaClientInitializationError;
exports.PrismaClientValidationError = runtime.PrismaClientValidationError;
exports.sql = runtime.sqltag;
exports.empty = runtime.empty;
exports.join = runtime.join;
exports.raw = runtime.raw;
exports.Sql = runtime.Sql;
exports.Decimal = runtime.Decimal;
exports.getExtensionContext = runtime.Extensions.getExtensionContext;
exports.prismaVersion = {
    client: "7.3.0",
    engine: "9d6ad21cbbceab97458517b147a6a09ff43aa735"
};
exports.NullTypes = {
    DbNull: runtime.NullTypes.DbNull,
    JsonNull: runtime.NullTypes.JsonNull,
    AnyNull: runtime.NullTypes.AnyNull,
};
exports.DbNull = runtime.DbNull;
exports.JsonNull = runtime.JsonNull;
exports.AnyNull = runtime.AnyNull;
exports.ModelName = {
    billing_cards: 'billing_cards',
    organizations: 'organizations',
    transactions: 'transactions',
    users: 'users',
    wallets: 'wallets',
    email_projects: 'email_projects',
    email_templates: 'email_templates',
    email_leads: 'email_leads',
    email_project_leads: 'email_project_leads',
    email_projects_schedules: 'email_projects_schedules',
    email_projects_schedules_sent: 'email_projects_schedules_sent',
    email_schedules_sent_opens: 'email_schedules_sent_opens',
    organization_domains: 'organization_domains',
    agentes_ia: 'agentes_ia',
    webchats: 'webchats',
    webchat_ads: 'webchat_ads',
    webchat_ad_events: 'webchat_ad_events',
    webchat_leads: 'webchat_leads',
    webchat_sessions: 'webchat_sessions',
    webchat_domains: 'webchat_domains',
    posts: 'posts',
    post_media: 'post_media',
    social_post_schedules: 'social_post_schedules',
    social_post_schedule_runs: 'social_post_schedule_runs',
    social_accounts: 'social_accounts',
    organization_social_app_credentials: 'organization_social_app_credentials',
    avatars: 'avatars',
    avatar_generations: 'avatar_generations',
    system_settings: 'system_settings'
};
exports.TransactionIsolationLevel = runtime.makeStrictEnum({
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
});
exports.Billing_cardsScalarFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    provider_token: 'provider_token',
    last_four_digits: 'last_four_digits',
    brand: 'brand',
    holder_name: 'holder_name',
    is_default: 'is_default'
};
exports.OrganizationsScalarFieldEnum = {
    id: 'id',
    name: 'name',
    document_id: 'document_id',
    status: 'status',
    stripe_customer_id: 'stripe_customer_id',
    created_at: 'created_at',
    updated_at: 'updated_at'
};
exports.TransactionsScalarFieldEnum = {
    id: 'id',
    wallet_id: 'wallet_id',
    amount: 'amount',
    type: 'type',
    description: 'description',
    provider_transaction_id: 'provider_transaction_id',
    created_at: 'created_at'
};
exports.UsersScalarFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    name: 'name',
    email: 'email',
    password_hash: 'password_hash',
    role: 'role',
    refresh_token: 'refresh_token',
    active: 'active'
};
exports.WalletsScalarFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    balance: 'balance',
    status: 'status'
};
exports.Email_projectsScalarFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    name: 'name',
    settings: 'settings',
    created_at: 'created_at',
    active: 'active'
};
exports.Email_templatesScalarFieldEnum = {
    id: 'id',
    project_id: 'project_id',
    name: 'name',
    subject: 'subject',
    body_html: 'body_html',
    body_text: 'body_text'
};
exports.Email_leadsScalarFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    email: 'email',
    name: 'name',
    attributes: 'attributes',
    global_status: 'global_status'
};
exports.Email_project_leadsScalarFieldEnum = {
    project_id: 'project_id',
    lead_id: 'lead_id',
    status: 'status',
    created_at: 'created_at',
    updated_at: 'updated_at',
    metrics: 'metrics'
};
exports.Email_projects_schedulesScalarFieldEnum = {
    id: 'id',
    project_id: 'project_id',
    daily: 'daily',
    date: 'date',
    time: 'time',
    for_x_days: 'for_x_days',
    last_run: 'last_run',
    created_at: 'created_at',
    updated_at: 'updated_at'
};
exports.Email_projects_schedules_sentScalarFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    project_id: 'project_id',
    schedule_id: 'schedule_id',
    open_count: 'open_count',
    click_cta_count: 'click_cta_count',
    schedule_time: 'schedule_time',
    schedule_date: 'schedule_date',
    schedule_daily: 'schedule_daily',
    run_at: 'run_at',
    sent: 'sent',
    status: 'status',
    subject: 'subject',
    body_html: 'body_html',
    body_text: 'body_text',
    total_leads: 'total_leads',
    sent_for_leads: 'sent_for_leads',
    error_message: 'error_message',
    created_at: 'created_at',
    tokens_unit_cost: 'tokens_unit_cost',
    tokens_cost: 'tokens_cost'
};
exports.Email_schedules_sent_opensScalarFieldEnum = {
    id: 'id',
    schedule_sent_id: 'schedule_sent_id',
    email: 'email',
    created_at: 'created_at'
};
exports.Organization_domainsScalarFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    domain: 'domain',
    status: 'status',
    created_at: 'created_at',
    updated_at: 'updated_at',
    provider_id: 'provider_id',
    dns_records: 'dns_records'
};
exports.Agentes_iaScalarFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    name: 'name',
    description: 'description',
    ia_config: 'ia_config',
    active: 'active',
    created_at: 'created_at',
    updated_at: 'updated_at'
};
exports.WebchatsScalarFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    agent_id: 'agent_id',
    name: 'name',
    slug: 'slug',
    domain: 'domain',
    email_project_id: 'email_project_id',
    active: 'active',
    settings: 'settings',
    header_scripts: 'header_scripts',
    ads_config: 'ads_config',
    created_at: 'created_at',
    updated_at: 'updated_at'
};
exports.Webchat_adsScalarFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    webchat_id: 'webchat_id',
    position: 'position',
    codigo_tag: 'codigo_tag',
    gpt_sizes: 'gpt_sizes',
    gpt_slot: 'gpt_slot',
    gpt_div_id: 'gpt_div_id',
    anuncio_fixed: 'anuncio_fixed',
    intervalo_mensagens: 'intervalo_mensagens',
    sequence_ads: 'sequence_ads',
    ativo: 'ativo',
    created_at: 'created_at',
    updated_at: 'updated_at'
};
exports.Webchat_ad_eventsScalarFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    webchat_id: 'webchat_id',
    session_id: 'session_id',
    domain: 'domain',
    ad_position: 'ad_position',
    event_name: 'event_name',
    ad_key: 'ad_key',
    payload: 'payload',
    created_at: 'created_at'
};
exports.Webchat_leadsScalarFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    webchat_id: 'webchat_id',
    email: 'email',
    name: 'name',
    phone: 'phone',
    source: 'source',
    session_id: 'session_id',
    context: 'context',
    custom_fields: 'custom_fields',
    created_at: 'created_at',
    updated_at: 'updated_at'
};
exports.Webchat_sessionsScalarFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    webchat_id: 'webchat_id',
    session_id: 'session_id',
    lead_state: 'lead_state',
    conversation_history: 'conversation_history',
    created_at: 'created_at',
    updated_at: 'updated_at'
};
exports.Webchat_domainsScalarFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    domain: 'domain',
    status: 'status',
    expected_type: 'expected_type',
    expected_value: 'expected_value',
    last_check_error: 'last_check_error',
    last_checked_at: 'last_checked_at',
    traefik_file: 'traefik_file',
    ssl_status: 'ssl_status',
    ssl_error: 'ssl_error',
    ssl_issued_at: 'ssl_issued_at',
    ssl_attempted_at: 'ssl_attempted_at',
    ads_txt: 'ads_txt',
    created_at: 'created_at',
    updated_at: 'updated_at'
};
exports.PostsScalarFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    internal_name: 'internal_name',
    post_type: 'post_type',
    default_title: 'default_title',
    default_caption: 'default_caption',
    tags: 'tags',
    status: 'status',
    created_at: 'created_at',
    updated_at: 'updated_at'
};
exports.Post_mediaScalarFieldEnum = {
    id: 'id',
    post_id: 'post_id',
    sort_order: 'sort_order',
    media_type: 'media_type',
    mime_type: 'mime_type',
    file_size_bytes: 'file_size_bytes',
    original_name: 'original_name',
    storage_key: 'storage_key',
    storage_provider: 'storage_provider',
    width: 'width',
    height: 'height',
    duration_sec: 'duration_sec',
    thumbnail_key: 'thumbnail_key',
    created_at: 'created_at',
    updated_at: 'updated_at'
};
exports.Social_post_schedulesScalarFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    post_id: 'post_id',
    social_account_id: 'social_account_id',
    social_network: 'social_network',
    status: 'status',
    ai_content: 'ai_content',
    scheduled_at: 'scheduled_at',
    platform_payload: 'platform_payload',
    post_snapshot: 'post_snapshot',
    tokens_unit_cost: 'tokens_unit_cost',
    tokens_cost: 'tokens_cost',
    error_message: 'error_message',
    created_at: 'created_at',
    updated_at: 'updated_at'
};
exports.Social_post_schedule_runsScalarFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    schedule_id: 'schedule_id',
    post_id: 'post_id',
    social_account_id: 'social_account_id',
    social_network: 'social_network',
    status: 'status',
    ai_content: 'ai_content',
    run_at: 'run_at',
    sent_at: 'sent_at',
    external_post_id: 'external_post_id',
    platform_payload: 'platform_payload',
    post_snapshot: 'post_snapshot',
    tokens_unit_cost: 'tokens_unit_cost',
    tokens_cost: 'tokens_cost',
    error_message: 'error_message',
    created_at: 'created_at'
};
exports.Social_accountsScalarFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    social_network: 'social_network',
    provider_user_id: 'provider_user_id',
    username: 'username',
    display_name: 'display_name',
    profile_image_url: 'profile_image_url',
    status: 'status',
    is_default: 'is_default',
    access_token_encrypted: 'access_token_encrypted',
    refresh_token_encrypted: 'refresh_token_encrypted',
    token_expires_at: 'token_expires_at',
    scope: 'scope',
    extra: 'extra',
    created_at: 'created_at',
    updated_at: 'updated_at'
};
exports.Organization_social_app_credentialsScalarFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    social_network: 'social_network',
    client_key: 'client_key',
    client_secret_encrypted: 'client_secret_encrypted',
    created_at: 'created_at',
    updated_at: 'updated_at'
};
exports.AvatarsScalarFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    name: 'name',
    is_realistic: 'is_realistic',
    default_colors: 'default_colors',
    inspiration_image_url: 'inspiration_image_url',
    avatar_image_url: 'avatar_image_url',
    user_prompt: 'user_prompt',
    system_prompt: 'system_prompt',
    personality: 'personality',
    technical_metadata: 'technical_metadata',
    status: 'status',
    created_at: 'created_at',
    updated_at: 'updated_at'
};
exports.Avatar_generationsScalarFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    user_prompt: 'user_prompt',
    system_prompt: 'system_prompt',
    is_realistic: 'is_realistic',
    inspiration_image_url: 'inspiration_image_url',
    result_image_url: 'result_image_url',
    technical_metadata: 'technical_metadata',
    tokens_cost: 'tokens_cost',
    created_at: 'created_at'
};
exports.System_settingsScalarFieldEnum = {
    id: 'id',
    groq_api_keys: 'groq_api_keys',
    cerebras_api_keys: 'cerebras_api_keys',
    gemini_api_keys: 'gemini_api_keys',
    mistral_api_keys: 'mistral_api_keys',
    openrouter_api_keys: 'openrouter_api_keys',
    sambanova_api_keys: 'sambanova_api_keys',
    resend_api_key: 'resend_api_key',
    webchat_edge_ip: 'webchat_edge_ip',
    certbot_email: 'certbot_email',
    created_at: 'created_at',
    updated_at: 'updated_at'
};
exports.SortOrder = {
    asc: 'asc',
    desc: 'desc'
};
exports.NullableJsonNullValueInput = {
    DbNull: exports.DbNull,
    JsonNull: exports.JsonNull
};
exports.JsonNullValueInput = {
    JsonNull: exports.JsonNull
};
exports.NullsOrder = {
    first: 'first',
    last: 'last'
};
exports.billing_cardsOrderByRelevanceFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    provider_token: 'provider_token',
    last_four_digits: 'last_four_digits',
    brand: 'brand',
    holder_name: 'holder_name'
};
exports.organizationsOrderByRelevanceFieldEnum = {
    id: 'id',
    name: 'name',
    document_id: 'document_id',
    stripe_customer_id: 'stripe_customer_id'
};
exports.transactionsOrderByRelevanceFieldEnum = {
    id: 'id',
    wallet_id: 'wallet_id',
    type: 'type',
    description: 'description',
    provider_transaction_id: 'provider_transaction_id'
};
exports.usersOrderByRelevanceFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    name: 'name',
    email: 'email',
    password_hash: 'password_hash',
    refresh_token: 'refresh_token'
};
exports.walletsOrderByRelevanceFieldEnum = {
    id: 'id',
    organization_id: 'organization_id'
};
exports.JsonNullValueFilter = {
    DbNull: exports.DbNull,
    JsonNull: exports.JsonNull,
    AnyNull: exports.AnyNull
};
exports.QueryMode = {
    default: 'default',
    insensitive: 'insensitive'
};
exports.email_projectsOrderByRelevanceFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    name: 'name'
};
exports.email_templatesOrderByRelevanceFieldEnum = {
    id: 'id',
    project_id: 'project_id',
    name: 'name',
    subject: 'subject',
    body_html: 'body_html',
    body_text: 'body_text'
};
exports.email_leadsOrderByRelevanceFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    email: 'email',
    name: 'name'
};
exports.email_project_leadsOrderByRelevanceFieldEnum = {
    project_id: 'project_id',
    lead_id: 'lead_id'
};
exports.email_projects_schedulesOrderByRelevanceFieldEnum = {
    id: 'id',
    project_id: 'project_id'
};
exports.email_projects_schedules_sentOrderByRelevanceFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    project_id: 'project_id',
    schedule_id: 'schedule_id',
    subject: 'subject',
    body_html: 'body_html',
    body_text: 'body_text',
    error_message: 'error_message'
};
exports.email_schedules_sent_opensOrderByRelevanceFieldEnum = {
    id: 'id',
    schedule_sent_id: 'schedule_sent_id',
    email: 'email'
};
exports.organization_domainsOrderByRelevanceFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    domain: 'domain',
    provider_id: 'provider_id'
};
exports.agentes_iaOrderByRelevanceFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    name: 'name',
    description: 'description'
};
exports.webchatsOrderByRelevanceFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    agent_id: 'agent_id',
    name: 'name',
    slug: 'slug',
    domain: 'domain',
    email_project_id: 'email_project_id',
    header_scripts: 'header_scripts'
};
exports.webchat_adsOrderByRelevanceFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    webchat_id: 'webchat_id',
    position: 'position',
    codigo_tag: 'codigo_tag',
    gpt_sizes: 'gpt_sizes',
    gpt_slot: 'gpt_slot',
    gpt_div_id: 'gpt_div_id',
    anuncio_fixed: 'anuncio_fixed'
};
exports.webchat_ad_eventsOrderByRelevanceFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    webchat_id: 'webchat_id',
    session_id: 'session_id',
    domain: 'domain',
    ad_position: 'ad_position',
    event_name: 'event_name',
    ad_key: 'ad_key'
};
exports.webchat_leadsOrderByRelevanceFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    webchat_id: 'webchat_id',
    email: 'email',
    name: 'name',
    phone: 'phone',
    source: 'source',
    session_id: 'session_id'
};
exports.webchat_sessionsOrderByRelevanceFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    webchat_id: 'webchat_id',
    session_id: 'session_id'
};
exports.webchat_domainsOrderByRelevanceFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    domain: 'domain',
    expected_type: 'expected_type',
    expected_value: 'expected_value',
    last_check_error: 'last_check_error',
    traefik_file: 'traefik_file',
    ssl_status: 'ssl_status',
    ssl_error: 'ssl_error',
    ads_txt: 'ads_txt'
};
exports.postsOrderByRelevanceFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    internal_name: 'internal_name',
    default_title: 'default_title',
    default_caption: 'default_caption'
};
exports.post_mediaOrderByRelevanceFieldEnum = {
    id: 'id',
    post_id: 'post_id',
    mime_type: 'mime_type',
    original_name: 'original_name',
    storage_key: 'storage_key',
    storage_provider: 'storage_provider',
    thumbnail_key: 'thumbnail_key'
};
exports.social_post_schedulesOrderByRelevanceFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    post_id: 'post_id',
    social_account_id: 'social_account_id',
    error_message: 'error_message'
};
exports.social_post_schedule_runsOrderByRelevanceFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    schedule_id: 'schedule_id',
    post_id: 'post_id',
    social_account_id: 'social_account_id',
    external_post_id: 'external_post_id',
    error_message: 'error_message'
};
exports.social_accountsOrderByRelevanceFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    provider_user_id: 'provider_user_id',
    username: 'username',
    display_name: 'display_name',
    profile_image_url: 'profile_image_url',
    access_token_encrypted: 'access_token_encrypted',
    refresh_token_encrypted: 'refresh_token_encrypted'
};
exports.organization_social_app_credentialsOrderByRelevanceFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    client_key: 'client_key',
    client_secret_encrypted: 'client_secret_encrypted'
};
exports.avatarsOrderByRelevanceFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    name: 'name',
    inspiration_image_url: 'inspiration_image_url',
    avatar_image_url: 'avatar_image_url',
    user_prompt: 'user_prompt',
    system_prompt: 'system_prompt',
    personality: 'personality'
};
exports.avatar_generationsOrderByRelevanceFieldEnum = {
    id: 'id',
    organization_id: 'organization_id',
    user_prompt: 'user_prompt',
    system_prompt: 'system_prompt',
    inspiration_image_url: 'inspiration_image_url',
    result_image_url: 'result_image_url'
};
exports.system_settingsOrderByRelevanceFieldEnum = {
    groq_api_keys: 'groq_api_keys',
    cerebras_api_keys: 'cerebras_api_keys',
    gemini_api_keys: 'gemini_api_keys',
    mistral_api_keys: 'mistral_api_keys',
    openrouter_api_keys: 'openrouter_api_keys',
    sambanova_api_keys: 'sambanova_api_keys',
    resend_api_key: 'resend_api_key',
    webchat_edge_ip: 'webchat_edge_ip',
    certbot_email: 'certbot_email'
};
exports.defineExtension = runtime.Extensions.defineExtension;
//# sourceMappingURL=prismaNamespace.js.map