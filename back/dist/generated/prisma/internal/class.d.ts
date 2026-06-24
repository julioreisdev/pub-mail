import * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "./prismaNamespace.js";
export type LogOptions<ClientOptions extends Prisma.PrismaClientOptions> = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never;
export interface PrismaClientConstructor {
    new <Options extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions, LogOpts extends LogOptions<Options> = LogOptions<Options>, OmitOpts extends Prisma.PrismaClientOptions['omit'] = Options extends {
        omit: infer U;
    } ? U : Prisma.PrismaClientOptions['omit'], ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs>(options: Prisma.Subset<Options, Prisma.PrismaClientOptions>): PrismaClient<LogOpts, OmitOpts, ExtArgs>;
}
export interface PrismaClient<in LogOpts extends Prisma.LogLevel = never, in out OmitOpts extends Prisma.PrismaClientOptions['omit'] = undefined, in out ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['other'];
    };
    $on<V extends LogOpts>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;
    $connect(): runtime.Types.Utils.JsPromise<void>;
    $disconnect(): runtime.Types.Utils.JsPromise<void>;
    $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;
    $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;
    $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;
    $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;
    $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: {
        isolationLevel?: Prisma.TransactionIsolationLevel;
    }): runtime.Types.Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>;
    $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => runtime.Types.Utils.JsPromise<R>, options?: {
        maxWait?: number;
        timeout?: number;
        isolationLevel?: Prisma.TransactionIsolationLevel;
    }): runtime.Types.Utils.JsPromise<R>;
    $extends: runtime.Types.Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<OmitOpts>, ExtArgs, runtime.Types.Utils.Call<Prisma.TypeMapCb<OmitOpts>, {
        extArgs: ExtArgs;
    }>>;
    get billing_cards(): Prisma.billing_cardsDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get organizations(): Prisma.organizationsDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get transactions(): Prisma.transactionsDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get users(): Prisma.usersDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get wallets(): Prisma.walletsDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get email_projects(): Prisma.email_projectsDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get email_templates(): Prisma.email_templatesDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get email_leads(): Prisma.email_leadsDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get email_project_leads(): Prisma.email_project_leadsDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get email_projects_schedules(): Prisma.email_projects_schedulesDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get email_projects_schedules_sent(): Prisma.email_projects_schedules_sentDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get email_schedules_sent_opens(): Prisma.email_schedules_sent_opensDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get organization_domains(): Prisma.organization_domainsDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get agentes_ia(): Prisma.agentes_iaDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get webchats(): Prisma.webchatsDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get webchat_ads(): Prisma.webchat_adsDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get webchat_ad_events(): Prisma.webchat_ad_eventsDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get webchat_leads(): Prisma.webchat_leadsDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get webchat_sessions(): Prisma.webchat_sessionsDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get webchat_domains(): Prisma.webchat_domainsDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get posts(): Prisma.postsDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get post_media(): Prisma.post_mediaDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get social_post_schedules(): Prisma.social_post_schedulesDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get social_post_schedule_runs(): Prisma.social_post_schedule_runsDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get social_accounts(): Prisma.social_accountsDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get organization_social_app_credentials(): Prisma.organization_social_app_credentialsDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get avatars(): Prisma.avatarsDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get avatar_generations(): Prisma.avatar_generationsDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
    get system_settings(): Prisma.system_settingsDelegate<ExtArgs, {
        omit: OmitOpts;
    }>;
}
export declare function getPrismaClientClass(): PrismaClientConstructor;
