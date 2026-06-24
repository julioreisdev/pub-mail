import * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../models.js";
import { type PrismaClient } from "./class.js";
export type * from '../models.js';
export type DMMF = typeof runtime.DMMF;
export type PrismaPromise<T> = runtime.Types.Public.PrismaPromise<T>;
export declare const PrismaClientKnownRequestError: typeof runtime.PrismaClientKnownRequestError;
export type PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError;
export declare const PrismaClientUnknownRequestError: typeof runtime.PrismaClientUnknownRequestError;
export type PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError;
export declare const PrismaClientRustPanicError: typeof runtime.PrismaClientRustPanicError;
export type PrismaClientRustPanicError = runtime.PrismaClientRustPanicError;
export declare const PrismaClientInitializationError: typeof runtime.PrismaClientInitializationError;
export type PrismaClientInitializationError = runtime.PrismaClientInitializationError;
export declare const PrismaClientValidationError: typeof runtime.PrismaClientValidationError;
export type PrismaClientValidationError = runtime.PrismaClientValidationError;
export declare const sql: typeof runtime.sqltag;
export declare const empty: runtime.Sql;
export declare const join: typeof runtime.join;
export declare const raw: typeof runtime.raw;
export declare const Sql: typeof runtime.Sql;
export type Sql = runtime.Sql;
export declare const Decimal: typeof runtime.Decimal;
export type Decimal = runtime.Decimal;
export type DecimalJsLike = runtime.DecimalJsLike;
export type Extension = runtime.Types.Extensions.UserArgs;
export declare const getExtensionContext: typeof runtime.Extensions.getExtensionContext;
export type Args<T, F extends runtime.Operation> = runtime.Types.Public.Args<T, F>;
export type Payload<T, F extends runtime.Operation = never> = runtime.Types.Public.Payload<T, F>;
export type Result<T, A, F extends runtime.Operation> = runtime.Types.Public.Result<T, A, F>;
export type Exact<A, W> = runtime.Types.Public.Exact<A, W>;
export type PrismaVersion = {
    client: string;
    engine: string;
};
export declare const prismaVersion: PrismaVersion;
export type Bytes = runtime.Bytes;
export type JsonObject = runtime.JsonObject;
export type JsonArray = runtime.JsonArray;
export type JsonValue = runtime.JsonValue;
export type InputJsonObject = runtime.InputJsonObject;
export type InputJsonArray = runtime.InputJsonArray;
export type InputJsonValue = runtime.InputJsonValue;
export declare const NullTypes: {
    DbNull: (new (secret: never) => typeof runtime.DbNull);
    JsonNull: (new (secret: never) => typeof runtime.JsonNull);
    AnyNull: (new (secret: never) => typeof runtime.AnyNull);
};
export declare const DbNull: runtime.DbNullClass;
export declare const JsonNull: runtime.JsonNullClass;
export declare const AnyNull: runtime.AnyNullClass;
type SelectAndInclude = {
    select: any;
    include: any;
};
type SelectAndOmit = {
    select: any;
    omit: any;
};
type Prisma__Pick<T, K extends keyof T> = {
    [P in K]: T[P];
};
export type Enumerable<T> = T | Array<T>;
export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
};
export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
} & (T extends SelectAndInclude ? 'Please either choose `select` or `include`.' : T extends SelectAndOmit ? 'Please either choose `select` or `omit`.' : {});
export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
} & K;
type Without<T, U> = {
    [P in Exclude<keyof T, keyof U>]?: never;
};
export type XOR<T, U> = T extends object ? U extends object ? (Without<T, U> & U) | (Without<U, T> & T) : U : T;
type IsObject<T extends any> = T extends Array<any> ? False : T extends Date ? False : T extends Uint8Array ? False : T extends BigInt ? False : T extends object ? True : False;
export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T;
type __Either<O extends object, K extends Key> = Omit<O, K> & {
    [P in K]: Prisma__Pick<O, P & keyof O>;
}[K];
type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>;
type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>;
type _Either<O extends object, K extends Key, strict extends Boolean> = {
    1: EitherStrict<O, K>;
    0: EitherLoose<O, K>;
}[strict];
export type Either<O extends object, K extends Key, strict extends Boolean = 1> = O extends unknown ? _Either<O, K, strict> : never;
export type Union = any;
export type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K];
} & {};
export type IntersectOf<U extends Union> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
export type Overwrite<O extends object, O1 extends object> = {
    [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
} & {};
type _Merge<U extends object> = IntersectOf<Overwrite<U, {
    [K in keyof U]-?: At<U, K>;
}>>;
type Key = string | number | symbol;
type AtStrict<O extends object, K extends Key> = O[K & keyof O];
type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
    1: AtStrict<O, K>;
    0: AtLoose<O, K>;
}[strict];
export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
} & {};
export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
} & {};
type _Record<K extends keyof any, T> = {
    [P in K]: T;
};
type NoExpand<T> = T extends unknown ? T : never;
export type AtLeast<O extends object, K extends string> = NoExpand<O extends unknown ? (K extends keyof O ? {
    [P in K]: O[P];
} & O : O) | {
    [P in keyof O as P extends K ? P : never]-?: O[P];
} & O : never>;
type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;
export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;
export type Boolean = True | False;
export type True = 1;
export type False = 0;
export type Not<B extends Boolean> = {
    0: 1;
    1: 0;
}[B];
export type Extends<A1 extends any, A2 extends any> = [A1] extends [never] ? 0 : A1 extends A2 ? 1 : 0;
export type Has<U extends Union, U1 extends Union> = Not<Extends<Exclude<U1, U>, U1>>;
export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
        0: 0;
        1: 1;
    };
    1: {
        0: 1;
        1: 1;
    };
}[B1][B2];
export type Keys<U extends Union> = U extends unknown ? keyof U : never;
export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O ? O[P] : never;
} : never;
type FieldPaths<T, U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>> = IsObject<T> extends True ? U : T;
export type GetHavingFields<T> = {
    [K in keyof T]: Or<Or<Extends<'OR', K>, Extends<'AND', K>>, Extends<'NOT', K>> extends True ? T[K] extends infer TK ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never> : never : {} extends FieldPaths<T[K]> ? never : K;
}[keyof T];
type _TupleToUnion<T> = T extends (infer E)[] ? E : never;
type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>;
export type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T;
export type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>;
export type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T;
export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>;
type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>;
export declare const ModelName: {
    readonly billing_cards: "billing_cards";
    readonly organizations: "organizations";
    readonly transactions: "transactions";
    readonly users: "users";
    readonly wallets: "wallets";
    readonly email_projects: "email_projects";
    readonly email_templates: "email_templates";
    readonly email_leads: "email_leads";
    readonly email_project_leads: "email_project_leads";
    readonly email_projects_schedules: "email_projects_schedules";
    readonly email_projects_schedules_sent: "email_projects_schedules_sent";
    readonly email_schedules_sent_opens: "email_schedules_sent_opens";
    readonly organization_domains: "organization_domains";
    readonly agentes_ia: "agentes_ia";
    readonly webchats: "webchats";
    readonly webchat_ads: "webchat_ads";
    readonly webchat_ad_events: "webchat_ad_events";
    readonly webchat_leads: "webchat_leads";
    readonly webchat_sessions: "webchat_sessions";
    readonly webchat_domains: "webchat_domains";
    readonly posts: "posts";
    readonly post_media: "post_media";
    readonly social_post_schedules: "social_post_schedules";
    readonly social_post_schedule_runs: "social_post_schedule_runs";
    readonly social_accounts: "social_accounts";
    readonly organization_social_app_credentials: "organization_social_app_credentials";
    readonly avatars: "avatars";
    readonly avatar_generations: "avatar_generations";
    readonly system_settings: "system_settings";
};
export type ModelName = (typeof ModelName)[keyof typeof ModelName];
export interface TypeMapCb<GlobalOmitOptions = {}> extends runtime.Types.Utils.Fn<{
    extArgs: runtime.Types.Extensions.InternalArgs;
}, runtime.Types.Utils.Record<string, any>> {
    returns: TypeMap<this['params']['extArgs'], GlobalOmitOptions>;
}
export type TypeMap<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
        omit: GlobalOmitOptions;
    };
    meta: {
        modelProps: "billing_cards" | "organizations" | "transactions" | "users" | "wallets" | "email_projects" | "email_templates" | "email_leads" | "email_project_leads" | "email_projects_schedules" | "email_projects_schedules_sent" | "email_schedules_sent_opens" | "organization_domains" | "agentes_ia" | "webchats" | "webchat_ads" | "webchat_ad_events" | "webchat_leads" | "webchat_sessions" | "webchat_domains" | "posts" | "post_media" | "social_post_schedules" | "social_post_schedule_runs" | "social_accounts" | "organization_social_app_credentials" | "avatars" | "avatar_generations" | "system_settings";
        txIsolationLevel: TransactionIsolationLevel;
    };
    model: {
        billing_cards: {
            payload: Prisma.$billing_cardsPayload<ExtArgs>;
            fields: Prisma.billing_cardsFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.billing_cardsFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$billing_cardsPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.billing_cardsFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$billing_cardsPayload>;
                };
                findFirst: {
                    args: Prisma.billing_cardsFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$billing_cardsPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.billing_cardsFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$billing_cardsPayload>;
                };
                findMany: {
                    args: Prisma.billing_cardsFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$billing_cardsPayload>[];
                };
                create: {
                    args: Prisma.billing_cardsCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$billing_cardsPayload>;
                };
                createMany: {
                    args: Prisma.billing_cardsCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.billing_cardsDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$billing_cardsPayload>;
                };
                update: {
                    args: Prisma.billing_cardsUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$billing_cardsPayload>;
                };
                deleteMany: {
                    args: Prisma.billing_cardsDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.billing_cardsUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.billing_cardsUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$billing_cardsPayload>;
                };
                aggregate: {
                    args: Prisma.Billing_cardsAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateBilling_cards>;
                };
                groupBy: {
                    args: Prisma.billing_cardsGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Billing_cardsGroupByOutputType>[];
                };
                count: {
                    args: Prisma.billing_cardsCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Billing_cardsCountAggregateOutputType> | number;
                };
            };
        };
        organizations: {
            payload: Prisma.$organizationsPayload<ExtArgs>;
            fields: Prisma.organizationsFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.organizationsFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organizationsPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.organizationsFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organizationsPayload>;
                };
                findFirst: {
                    args: Prisma.organizationsFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organizationsPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.organizationsFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organizationsPayload>;
                };
                findMany: {
                    args: Prisma.organizationsFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organizationsPayload>[];
                };
                create: {
                    args: Prisma.organizationsCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organizationsPayload>;
                };
                createMany: {
                    args: Prisma.organizationsCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.organizationsDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organizationsPayload>;
                };
                update: {
                    args: Prisma.organizationsUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organizationsPayload>;
                };
                deleteMany: {
                    args: Prisma.organizationsDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.organizationsUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.organizationsUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organizationsPayload>;
                };
                aggregate: {
                    args: Prisma.OrganizationsAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateOrganizations>;
                };
                groupBy: {
                    args: Prisma.organizationsGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.OrganizationsGroupByOutputType>[];
                };
                count: {
                    args: Prisma.organizationsCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.OrganizationsCountAggregateOutputType> | number;
                };
            };
        };
        transactions: {
            payload: Prisma.$transactionsPayload<ExtArgs>;
            fields: Prisma.transactionsFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.transactionsFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$transactionsPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.transactionsFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$transactionsPayload>;
                };
                findFirst: {
                    args: Prisma.transactionsFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$transactionsPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.transactionsFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$transactionsPayload>;
                };
                findMany: {
                    args: Prisma.transactionsFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$transactionsPayload>[];
                };
                create: {
                    args: Prisma.transactionsCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$transactionsPayload>;
                };
                createMany: {
                    args: Prisma.transactionsCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.transactionsDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$transactionsPayload>;
                };
                update: {
                    args: Prisma.transactionsUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$transactionsPayload>;
                };
                deleteMany: {
                    args: Prisma.transactionsDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.transactionsUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.transactionsUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$transactionsPayload>;
                };
                aggregate: {
                    args: Prisma.TransactionsAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateTransactions>;
                };
                groupBy: {
                    args: Prisma.transactionsGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.TransactionsGroupByOutputType>[];
                };
                count: {
                    args: Prisma.transactionsCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.TransactionsCountAggregateOutputType> | number;
                };
            };
        };
        users: {
            payload: Prisma.$usersPayload<ExtArgs>;
            fields: Prisma.usersFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.usersFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$usersPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.usersFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$usersPayload>;
                };
                findFirst: {
                    args: Prisma.usersFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$usersPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.usersFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$usersPayload>;
                };
                findMany: {
                    args: Prisma.usersFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$usersPayload>[];
                };
                create: {
                    args: Prisma.usersCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$usersPayload>;
                };
                createMany: {
                    args: Prisma.usersCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.usersDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$usersPayload>;
                };
                update: {
                    args: Prisma.usersUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$usersPayload>;
                };
                deleteMany: {
                    args: Prisma.usersDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.usersUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.usersUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$usersPayload>;
                };
                aggregate: {
                    args: Prisma.UsersAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateUsers>;
                };
                groupBy: {
                    args: Prisma.usersGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.UsersGroupByOutputType>[];
                };
                count: {
                    args: Prisma.usersCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.UsersCountAggregateOutputType> | number;
                };
            };
        };
        wallets: {
            payload: Prisma.$walletsPayload<ExtArgs>;
            fields: Prisma.walletsFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.walletsFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$walletsPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.walletsFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$walletsPayload>;
                };
                findFirst: {
                    args: Prisma.walletsFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$walletsPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.walletsFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$walletsPayload>;
                };
                findMany: {
                    args: Prisma.walletsFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$walletsPayload>[];
                };
                create: {
                    args: Prisma.walletsCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$walletsPayload>;
                };
                createMany: {
                    args: Prisma.walletsCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.walletsDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$walletsPayload>;
                };
                update: {
                    args: Prisma.walletsUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$walletsPayload>;
                };
                deleteMany: {
                    args: Prisma.walletsDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.walletsUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.walletsUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$walletsPayload>;
                };
                aggregate: {
                    args: Prisma.WalletsAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateWallets>;
                };
                groupBy: {
                    args: Prisma.walletsGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.WalletsGroupByOutputType>[];
                };
                count: {
                    args: Prisma.walletsCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.WalletsCountAggregateOutputType> | number;
                };
            };
        };
        email_projects: {
            payload: Prisma.$email_projectsPayload<ExtArgs>;
            fields: Prisma.email_projectsFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.email_projectsFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projectsPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.email_projectsFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projectsPayload>;
                };
                findFirst: {
                    args: Prisma.email_projectsFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projectsPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.email_projectsFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projectsPayload>;
                };
                findMany: {
                    args: Prisma.email_projectsFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projectsPayload>[];
                };
                create: {
                    args: Prisma.email_projectsCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projectsPayload>;
                };
                createMany: {
                    args: Prisma.email_projectsCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.email_projectsDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projectsPayload>;
                };
                update: {
                    args: Prisma.email_projectsUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projectsPayload>;
                };
                deleteMany: {
                    args: Prisma.email_projectsDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.email_projectsUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.email_projectsUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projectsPayload>;
                };
                aggregate: {
                    args: Prisma.Email_projectsAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateEmail_projects>;
                };
                groupBy: {
                    args: Prisma.email_projectsGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Email_projectsGroupByOutputType>[];
                };
                count: {
                    args: Prisma.email_projectsCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Email_projectsCountAggregateOutputType> | number;
                };
            };
        };
        email_templates: {
            payload: Prisma.$email_templatesPayload<ExtArgs>;
            fields: Prisma.email_templatesFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.email_templatesFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_templatesPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.email_templatesFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_templatesPayload>;
                };
                findFirst: {
                    args: Prisma.email_templatesFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_templatesPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.email_templatesFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_templatesPayload>;
                };
                findMany: {
                    args: Prisma.email_templatesFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_templatesPayload>[];
                };
                create: {
                    args: Prisma.email_templatesCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_templatesPayload>;
                };
                createMany: {
                    args: Prisma.email_templatesCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.email_templatesDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_templatesPayload>;
                };
                update: {
                    args: Prisma.email_templatesUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_templatesPayload>;
                };
                deleteMany: {
                    args: Prisma.email_templatesDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.email_templatesUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.email_templatesUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_templatesPayload>;
                };
                aggregate: {
                    args: Prisma.Email_templatesAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateEmail_templates>;
                };
                groupBy: {
                    args: Prisma.email_templatesGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Email_templatesGroupByOutputType>[];
                };
                count: {
                    args: Prisma.email_templatesCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Email_templatesCountAggregateOutputType> | number;
                };
            };
        };
        email_leads: {
            payload: Prisma.$email_leadsPayload<ExtArgs>;
            fields: Prisma.email_leadsFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.email_leadsFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_leadsPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.email_leadsFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_leadsPayload>;
                };
                findFirst: {
                    args: Prisma.email_leadsFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_leadsPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.email_leadsFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_leadsPayload>;
                };
                findMany: {
                    args: Prisma.email_leadsFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_leadsPayload>[];
                };
                create: {
                    args: Prisma.email_leadsCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_leadsPayload>;
                };
                createMany: {
                    args: Prisma.email_leadsCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.email_leadsDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_leadsPayload>;
                };
                update: {
                    args: Prisma.email_leadsUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_leadsPayload>;
                };
                deleteMany: {
                    args: Prisma.email_leadsDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.email_leadsUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.email_leadsUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_leadsPayload>;
                };
                aggregate: {
                    args: Prisma.Email_leadsAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateEmail_leads>;
                };
                groupBy: {
                    args: Prisma.email_leadsGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Email_leadsGroupByOutputType>[];
                };
                count: {
                    args: Prisma.email_leadsCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Email_leadsCountAggregateOutputType> | number;
                };
            };
        };
        email_project_leads: {
            payload: Prisma.$email_project_leadsPayload<ExtArgs>;
            fields: Prisma.email_project_leadsFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.email_project_leadsFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_project_leadsPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.email_project_leadsFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_project_leadsPayload>;
                };
                findFirst: {
                    args: Prisma.email_project_leadsFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_project_leadsPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.email_project_leadsFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_project_leadsPayload>;
                };
                findMany: {
                    args: Prisma.email_project_leadsFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_project_leadsPayload>[];
                };
                create: {
                    args: Prisma.email_project_leadsCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_project_leadsPayload>;
                };
                createMany: {
                    args: Prisma.email_project_leadsCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.email_project_leadsDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_project_leadsPayload>;
                };
                update: {
                    args: Prisma.email_project_leadsUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_project_leadsPayload>;
                };
                deleteMany: {
                    args: Prisma.email_project_leadsDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.email_project_leadsUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.email_project_leadsUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_project_leadsPayload>;
                };
                aggregate: {
                    args: Prisma.Email_project_leadsAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateEmail_project_leads>;
                };
                groupBy: {
                    args: Prisma.email_project_leadsGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Email_project_leadsGroupByOutputType>[];
                };
                count: {
                    args: Prisma.email_project_leadsCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Email_project_leadsCountAggregateOutputType> | number;
                };
            };
        };
        email_projects_schedules: {
            payload: Prisma.$email_projects_schedulesPayload<ExtArgs>;
            fields: Prisma.email_projects_schedulesFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.email_projects_schedulesFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projects_schedulesPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.email_projects_schedulesFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projects_schedulesPayload>;
                };
                findFirst: {
                    args: Prisma.email_projects_schedulesFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projects_schedulesPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.email_projects_schedulesFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projects_schedulesPayload>;
                };
                findMany: {
                    args: Prisma.email_projects_schedulesFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projects_schedulesPayload>[];
                };
                create: {
                    args: Prisma.email_projects_schedulesCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projects_schedulesPayload>;
                };
                createMany: {
                    args: Prisma.email_projects_schedulesCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.email_projects_schedulesDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projects_schedulesPayload>;
                };
                update: {
                    args: Prisma.email_projects_schedulesUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projects_schedulesPayload>;
                };
                deleteMany: {
                    args: Prisma.email_projects_schedulesDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.email_projects_schedulesUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.email_projects_schedulesUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projects_schedulesPayload>;
                };
                aggregate: {
                    args: Prisma.Email_projects_schedulesAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateEmail_projects_schedules>;
                };
                groupBy: {
                    args: Prisma.email_projects_schedulesGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Email_projects_schedulesGroupByOutputType>[];
                };
                count: {
                    args: Prisma.email_projects_schedulesCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Email_projects_schedulesCountAggregateOutputType> | number;
                };
            };
        };
        email_projects_schedules_sent: {
            payload: Prisma.$email_projects_schedules_sentPayload<ExtArgs>;
            fields: Prisma.email_projects_schedules_sentFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.email_projects_schedules_sentFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projects_schedules_sentPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.email_projects_schedules_sentFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projects_schedules_sentPayload>;
                };
                findFirst: {
                    args: Prisma.email_projects_schedules_sentFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projects_schedules_sentPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.email_projects_schedules_sentFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projects_schedules_sentPayload>;
                };
                findMany: {
                    args: Prisma.email_projects_schedules_sentFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projects_schedules_sentPayload>[];
                };
                create: {
                    args: Prisma.email_projects_schedules_sentCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projects_schedules_sentPayload>;
                };
                createMany: {
                    args: Prisma.email_projects_schedules_sentCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.email_projects_schedules_sentDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projects_schedules_sentPayload>;
                };
                update: {
                    args: Prisma.email_projects_schedules_sentUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projects_schedules_sentPayload>;
                };
                deleteMany: {
                    args: Prisma.email_projects_schedules_sentDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.email_projects_schedules_sentUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.email_projects_schedules_sentUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_projects_schedules_sentPayload>;
                };
                aggregate: {
                    args: Prisma.Email_projects_schedules_sentAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateEmail_projects_schedules_sent>;
                };
                groupBy: {
                    args: Prisma.email_projects_schedules_sentGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Email_projects_schedules_sentGroupByOutputType>[];
                };
                count: {
                    args: Prisma.email_projects_schedules_sentCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Email_projects_schedules_sentCountAggregateOutputType> | number;
                };
            };
        };
        email_schedules_sent_opens: {
            payload: Prisma.$email_schedules_sent_opensPayload<ExtArgs>;
            fields: Prisma.email_schedules_sent_opensFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.email_schedules_sent_opensFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_schedules_sent_opensPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.email_schedules_sent_opensFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_schedules_sent_opensPayload>;
                };
                findFirst: {
                    args: Prisma.email_schedules_sent_opensFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_schedules_sent_opensPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.email_schedules_sent_opensFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_schedules_sent_opensPayload>;
                };
                findMany: {
                    args: Prisma.email_schedules_sent_opensFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_schedules_sent_opensPayload>[];
                };
                create: {
                    args: Prisma.email_schedules_sent_opensCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_schedules_sent_opensPayload>;
                };
                createMany: {
                    args: Prisma.email_schedules_sent_opensCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.email_schedules_sent_opensDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_schedules_sent_opensPayload>;
                };
                update: {
                    args: Prisma.email_schedules_sent_opensUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_schedules_sent_opensPayload>;
                };
                deleteMany: {
                    args: Prisma.email_schedules_sent_opensDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.email_schedules_sent_opensUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.email_schedules_sent_opensUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$email_schedules_sent_opensPayload>;
                };
                aggregate: {
                    args: Prisma.Email_schedules_sent_opensAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateEmail_schedules_sent_opens>;
                };
                groupBy: {
                    args: Prisma.email_schedules_sent_opensGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Email_schedules_sent_opensGroupByOutputType>[];
                };
                count: {
                    args: Prisma.email_schedules_sent_opensCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Email_schedules_sent_opensCountAggregateOutputType> | number;
                };
            };
        };
        organization_domains: {
            payload: Prisma.$organization_domainsPayload<ExtArgs>;
            fields: Prisma.organization_domainsFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.organization_domainsFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organization_domainsPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.organization_domainsFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organization_domainsPayload>;
                };
                findFirst: {
                    args: Prisma.organization_domainsFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organization_domainsPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.organization_domainsFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organization_domainsPayload>;
                };
                findMany: {
                    args: Prisma.organization_domainsFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organization_domainsPayload>[];
                };
                create: {
                    args: Prisma.organization_domainsCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organization_domainsPayload>;
                };
                createMany: {
                    args: Prisma.organization_domainsCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.organization_domainsDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organization_domainsPayload>;
                };
                update: {
                    args: Prisma.organization_domainsUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organization_domainsPayload>;
                };
                deleteMany: {
                    args: Prisma.organization_domainsDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.organization_domainsUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.organization_domainsUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organization_domainsPayload>;
                };
                aggregate: {
                    args: Prisma.Organization_domainsAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateOrganization_domains>;
                };
                groupBy: {
                    args: Prisma.organization_domainsGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Organization_domainsGroupByOutputType>[];
                };
                count: {
                    args: Prisma.organization_domainsCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Organization_domainsCountAggregateOutputType> | number;
                };
            };
        };
        agentes_ia: {
            payload: Prisma.$agentes_iaPayload<ExtArgs>;
            fields: Prisma.agentes_iaFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.agentes_iaFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$agentes_iaPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.agentes_iaFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$agentes_iaPayload>;
                };
                findFirst: {
                    args: Prisma.agentes_iaFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$agentes_iaPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.agentes_iaFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$agentes_iaPayload>;
                };
                findMany: {
                    args: Prisma.agentes_iaFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$agentes_iaPayload>[];
                };
                create: {
                    args: Prisma.agentes_iaCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$agentes_iaPayload>;
                };
                createMany: {
                    args: Prisma.agentes_iaCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.agentes_iaDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$agentes_iaPayload>;
                };
                update: {
                    args: Prisma.agentes_iaUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$agentes_iaPayload>;
                };
                deleteMany: {
                    args: Prisma.agentes_iaDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.agentes_iaUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.agentes_iaUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$agentes_iaPayload>;
                };
                aggregate: {
                    args: Prisma.Agentes_iaAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateAgentes_ia>;
                };
                groupBy: {
                    args: Prisma.agentes_iaGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Agentes_iaGroupByOutputType>[];
                };
                count: {
                    args: Prisma.agentes_iaCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Agentes_iaCountAggregateOutputType> | number;
                };
            };
        };
        webchats: {
            payload: Prisma.$webchatsPayload<ExtArgs>;
            fields: Prisma.webchatsFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.webchatsFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchatsPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.webchatsFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchatsPayload>;
                };
                findFirst: {
                    args: Prisma.webchatsFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchatsPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.webchatsFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchatsPayload>;
                };
                findMany: {
                    args: Prisma.webchatsFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchatsPayload>[];
                };
                create: {
                    args: Prisma.webchatsCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchatsPayload>;
                };
                createMany: {
                    args: Prisma.webchatsCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.webchatsDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchatsPayload>;
                };
                update: {
                    args: Prisma.webchatsUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchatsPayload>;
                };
                deleteMany: {
                    args: Prisma.webchatsDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.webchatsUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.webchatsUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchatsPayload>;
                };
                aggregate: {
                    args: Prisma.WebchatsAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateWebchats>;
                };
                groupBy: {
                    args: Prisma.webchatsGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.WebchatsGroupByOutputType>[];
                };
                count: {
                    args: Prisma.webchatsCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.WebchatsCountAggregateOutputType> | number;
                };
            };
        };
        webchat_ads: {
            payload: Prisma.$webchat_adsPayload<ExtArgs>;
            fields: Prisma.webchat_adsFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.webchat_adsFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_adsPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.webchat_adsFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_adsPayload>;
                };
                findFirst: {
                    args: Prisma.webchat_adsFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_adsPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.webchat_adsFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_adsPayload>;
                };
                findMany: {
                    args: Prisma.webchat_adsFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_adsPayload>[];
                };
                create: {
                    args: Prisma.webchat_adsCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_adsPayload>;
                };
                createMany: {
                    args: Prisma.webchat_adsCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.webchat_adsDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_adsPayload>;
                };
                update: {
                    args: Prisma.webchat_adsUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_adsPayload>;
                };
                deleteMany: {
                    args: Prisma.webchat_adsDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.webchat_adsUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.webchat_adsUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_adsPayload>;
                };
                aggregate: {
                    args: Prisma.Webchat_adsAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateWebchat_ads>;
                };
                groupBy: {
                    args: Prisma.webchat_adsGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Webchat_adsGroupByOutputType>[];
                };
                count: {
                    args: Prisma.webchat_adsCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Webchat_adsCountAggregateOutputType> | number;
                };
            };
        };
        webchat_ad_events: {
            payload: Prisma.$webchat_ad_eventsPayload<ExtArgs>;
            fields: Prisma.webchat_ad_eventsFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.webchat_ad_eventsFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_ad_eventsPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.webchat_ad_eventsFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_ad_eventsPayload>;
                };
                findFirst: {
                    args: Prisma.webchat_ad_eventsFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_ad_eventsPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.webchat_ad_eventsFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_ad_eventsPayload>;
                };
                findMany: {
                    args: Prisma.webchat_ad_eventsFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_ad_eventsPayload>[];
                };
                create: {
                    args: Prisma.webchat_ad_eventsCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_ad_eventsPayload>;
                };
                createMany: {
                    args: Prisma.webchat_ad_eventsCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.webchat_ad_eventsDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_ad_eventsPayload>;
                };
                update: {
                    args: Prisma.webchat_ad_eventsUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_ad_eventsPayload>;
                };
                deleteMany: {
                    args: Prisma.webchat_ad_eventsDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.webchat_ad_eventsUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.webchat_ad_eventsUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_ad_eventsPayload>;
                };
                aggregate: {
                    args: Prisma.Webchat_ad_eventsAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateWebchat_ad_events>;
                };
                groupBy: {
                    args: Prisma.webchat_ad_eventsGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Webchat_ad_eventsGroupByOutputType>[];
                };
                count: {
                    args: Prisma.webchat_ad_eventsCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Webchat_ad_eventsCountAggregateOutputType> | number;
                };
            };
        };
        webchat_leads: {
            payload: Prisma.$webchat_leadsPayload<ExtArgs>;
            fields: Prisma.webchat_leadsFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.webchat_leadsFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_leadsPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.webchat_leadsFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_leadsPayload>;
                };
                findFirst: {
                    args: Prisma.webchat_leadsFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_leadsPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.webchat_leadsFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_leadsPayload>;
                };
                findMany: {
                    args: Prisma.webchat_leadsFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_leadsPayload>[];
                };
                create: {
                    args: Prisma.webchat_leadsCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_leadsPayload>;
                };
                createMany: {
                    args: Prisma.webchat_leadsCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.webchat_leadsDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_leadsPayload>;
                };
                update: {
                    args: Prisma.webchat_leadsUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_leadsPayload>;
                };
                deleteMany: {
                    args: Prisma.webchat_leadsDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.webchat_leadsUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.webchat_leadsUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_leadsPayload>;
                };
                aggregate: {
                    args: Prisma.Webchat_leadsAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateWebchat_leads>;
                };
                groupBy: {
                    args: Prisma.webchat_leadsGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Webchat_leadsGroupByOutputType>[];
                };
                count: {
                    args: Prisma.webchat_leadsCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Webchat_leadsCountAggregateOutputType> | number;
                };
            };
        };
        webchat_sessions: {
            payload: Prisma.$webchat_sessionsPayload<ExtArgs>;
            fields: Prisma.webchat_sessionsFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.webchat_sessionsFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_sessionsPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.webchat_sessionsFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_sessionsPayload>;
                };
                findFirst: {
                    args: Prisma.webchat_sessionsFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_sessionsPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.webchat_sessionsFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_sessionsPayload>;
                };
                findMany: {
                    args: Prisma.webchat_sessionsFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_sessionsPayload>[];
                };
                create: {
                    args: Prisma.webchat_sessionsCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_sessionsPayload>;
                };
                createMany: {
                    args: Prisma.webchat_sessionsCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.webchat_sessionsDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_sessionsPayload>;
                };
                update: {
                    args: Prisma.webchat_sessionsUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_sessionsPayload>;
                };
                deleteMany: {
                    args: Prisma.webchat_sessionsDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.webchat_sessionsUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.webchat_sessionsUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_sessionsPayload>;
                };
                aggregate: {
                    args: Prisma.Webchat_sessionsAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateWebchat_sessions>;
                };
                groupBy: {
                    args: Prisma.webchat_sessionsGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Webchat_sessionsGroupByOutputType>[];
                };
                count: {
                    args: Prisma.webchat_sessionsCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Webchat_sessionsCountAggregateOutputType> | number;
                };
            };
        };
        webchat_domains: {
            payload: Prisma.$webchat_domainsPayload<ExtArgs>;
            fields: Prisma.webchat_domainsFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.webchat_domainsFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_domainsPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.webchat_domainsFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_domainsPayload>;
                };
                findFirst: {
                    args: Prisma.webchat_domainsFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_domainsPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.webchat_domainsFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_domainsPayload>;
                };
                findMany: {
                    args: Prisma.webchat_domainsFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_domainsPayload>[];
                };
                create: {
                    args: Prisma.webchat_domainsCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_domainsPayload>;
                };
                createMany: {
                    args: Prisma.webchat_domainsCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.webchat_domainsDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_domainsPayload>;
                };
                update: {
                    args: Prisma.webchat_domainsUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_domainsPayload>;
                };
                deleteMany: {
                    args: Prisma.webchat_domainsDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.webchat_domainsUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.webchat_domainsUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$webchat_domainsPayload>;
                };
                aggregate: {
                    args: Prisma.Webchat_domainsAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateWebchat_domains>;
                };
                groupBy: {
                    args: Prisma.webchat_domainsGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Webchat_domainsGroupByOutputType>[];
                };
                count: {
                    args: Prisma.webchat_domainsCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Webchat_domainsCountAggregateOutputType> | number;
                };
            };
        };
        posts: {
            payload: Prisma.$postsPayload<ExtArgs>;
            fields: Prisma.postsFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.postsFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$postsPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.postsFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$postsPayload>;
                };
                findFirst: {
                    args: Prisma.postsFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$postsPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.postsFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$postsPayload>;
                };
                findMany: {
                    args: Prisma.postsFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$postsPayload>[];
                };
                create: {
                    args: Prisma.postsCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$postsPayload>;
                };
                createMany: {
                    args: Prisma.postsCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.postsDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$postsPayload>;
                };
                update: {
                    args: Prisma.postsUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$postsPayload>;
                };
                deleteMany: {
                    args: Prisma.postsDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.postsUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.postsUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$postsPayload>;
                };
                aggregate: {
                    args: Prisma.PostsAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregatePosts>;
                };
                groupBy: {
                    args: Prisma.postsGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.PostsGroupByOutputType>[];
                };
                count: {
                    args: Prisma.postsCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.PostsCountAggregateOutputType> | number;
                };
            };
        };
        post_media: {
            payload: Prisma.$post_mediaPayload<ExtArgs>;
            fields: Prisma.post_mediaFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.post_mediaFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$post_mediaPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.post_mediaFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$post_mediaPayload>;
                };
                findFirst: {
                    args: Prisma.post_mediaFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$post_mediaPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.post_mediaFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$post_mediaPayload>;
                };
                findMany: {
                    args: Prisma.post_mediaFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$post_mediaPayload>[];
                };
                create: {
                    args: Prisma.post_mediaCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$post_mediaPayload>;
                };
                createMany: {
                    args: Prisma.post_mediaCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.post_mediaDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$post_mediaPayload>;
                };
                update: {
                    args: Prisma.post_mediaUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$post_mediaPayload>;
                };
                deleteMany: {
                    args: Prisma.post_mediaDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.post_mediaUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.post_mediaUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$post_mediaPayload>;
                };
                aggregate: {
                    args: Prisma.Post_mediaAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregatePost_media>;
                };
                groupBy: {
                    args: Prisma.post_mediaGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Post_mediaGroupByOutputType>[];
                };
                count: {
                    args: Prisma.post_mediaCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Post_mediaCountAggregateOutputType> | number;
                };
            };
        };
        social_post_schedules: {
            payload: Prisma.$social_post_schedulesPayload<ExtArgs>;
            fields: Prisma.social_post_schedulesFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.social_post_schedulesFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_post_schedulesPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.social_post_schedulesFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_post_schedulesPayload>;
                };
                findFirst: {
                    args: Prisma.social_post_schedulesFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_post_schedulesPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.social_post_schedulesFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_post_schedulesPayload>;
                };
                findMany: {
                    args: Prisma.social_post_schedulesFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_post_schedulesPayload>[];
                };
                create: {
                    args: Prisma.social_post_schedulesCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_post_schedulesPayload>;
                };
                createMany: {
                    args: Prisma.social_post_schedulesCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.social_post_schedulesDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_post_schedulesPayload>;
                };
                update: {
                    args: Prisma.social_post_schedulesUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_post_schedulesPayload>;
                };
                deleteMany: {
                    args: Prisma.social_post_schedulesDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.social_post_schedulesUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.social_post_schedulesUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_post_schedulesPayload>;
                };
                aggregate: {
                    args: Prisma.Social_post_schedulesAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateSocial_post_schedules>;
                };
                groupBy: {
                    args: Prisma.social_post_schedulesGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Social_post_schedulesGroupByOutputType>[];
                };
                count: {
                    args: Prisma.social_post_schedulesCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Social_post_schedulesCountAggregateOutputType> | number;
                };
            };
        };
        social_post_schedule_runs: {
            payload: Prisma.$social_post_schedule_runsPayload<ExtArgs>;
            fields: Prisma.social_post_schedule_runsFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.social_post_schedule_runsFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_post_schedule_runsPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.social_post_schedule_runsFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_post_schedule_runsPayload>;
                };
                findFirst: {
                    args: Prisma.social_post_schedule_runsFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_post_schedule_runsPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.social_post_schedule_runsFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_post_schedule_runsPayload>;
                };
                findMany: {
                    args: Prisma.social_post_schedule_runsFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_post_schedule_runsPayload>[];
                };
                create: {
                    args: Prisma.social_post_schedule_runsCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_post_schedule_runsPayload>;
                };
                createMany: {
                    args: Prisma.social_post_schedule_runsCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.social_post_schedule_runsDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_post_schedule_runsPayload>;
                };
                update: {
                    args: Prisma.social_post_schedule_runsUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_post_schedule_runsPayload>;
                };
                deleteMany: {
                    args: Prisma.social_post_schedule_runsDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.social_post_schedule_runsUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.social_post_schedule_runsUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_post_schedule_runsPayload>;
                };
                aggregate: {
                    args: Prisma.Social_post_schedule_runsAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateSocial_post_schedule_runs>;
                };
                groupBy: {
                    args: Prisma.social_post_schedule_runsGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Social_post_schedule_runsGroupByOutputType>[];
                };
                count: {
                    args: Prisma.social_post_schedule_runsCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Social_post_schedule_runsCountAggregateOutputType> | number;
                };
            };
        };
        social_accounts: {
            payload: Prisma.$social_accountsPayload<ExtArgs>;
            fields: Prisma.social_accountsFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.social_accountsFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_accountsPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.social_accountsFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_accountsPayload>;
                };
                findFirst: {
                    args: Prisma.social_accountsFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_accountsPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.social_accountsFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_accountsPayload>;
                };
                findMany: {
                    args: Prisma.social_accountsFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_accountsPayload>[];
                };
                create: {
                    args: Prisma.social_accountsCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_accountsPayload>;
                };
                createMany: {
                    args: Prisma.social_accountsCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.social_accountsDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_accountsPayload>;
                };
                update: {
                    args: Prisma.social_accountsUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_accountsPayload>;
                };
                deleteMany: {
                    args: Prisma.social_accountsDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.social_accountsUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.social_accountsUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$social_accountsPayload>;
                };
                aggregate: {
                    args: Prisma.Social_accountsAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateSocial_accounts>;
                };
                groupBy: {
                    args: Prisma.social_accountsGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Social_accountsGroupByOutputType>[];
                };
                count: {
                    args: Prisma.social_accountsCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Social_accountsCountAggregateOutputType> | number;
                };
            };
        };
        organization_social_app_credentials: {
            payload: Prisma.$organization_social_app_credentialsPayload<ExtArgs>;
            fields: Prisma.organization_social_app_credentialsFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.organization_social_app_credentialsFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organization_social_app_credentialsPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.organization_social_app_credentialsFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organization_social_app_credentialsPayload>;
                };
                findFirst: {
                    args: Prisma.organization_social_app_credentialsFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organization_social_app_credentialsPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.organization_social_app_credentialsFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organization_social_app_credentialsPayload>;
                };
                findMany: {
                    args: Prisma.organization_social_app_credentialsFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organization_social_app_credentialsPayload>[];
                };
                create: {
                    args: Prisma.organization_social_app_credentialsCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organization_social_app_credentialsPayload>;
                };
                createMany: {
                    args: Prisma.organization_social_app_credentialsCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.organization_social_app_credentialsDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organization_social_app_credentialsPayload>;
                };
                update: {
                    args: Prisma.organization_social_app_credentialsUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organization_social_app_credentialsPayload>;
                };
                deleteMany: {
                    args: Prisma.organization_social_app_credentialsDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.organization_social_app_credentialsUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.organization_social_app_credentialsUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$organization_social_app_credentialsPayload>;
                };
                aggregate: {
                    args: Prisma.Organization_social_app_credentialsAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateOrganization_social_app_credentials>;
                };
                groupBy: {
                    args: Prisma.organization_social_app_credentialsGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Organization_social_app_credentialsGroupByOutputType>[];
                };
                count: {
                    args: Prisma.organization_social_app_credentialsCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Organization_social_app_credentialsCountAggregateOutputType> | number;
                };
            };
        };
        avatars: {
            payload: Prisma.$avatarsPayload<ExtArgs>;
            fields: Prisma.avatarsFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.avatarsFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$avatarsPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.avatarsFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$avatarsPayload>;
                };
                findFirst: {
                    args: Prisma.avatarsFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$avatarsPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.avatarsFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$avatarsPayload>;
                };
                findMany: {
                    args: Prisma.avatarsFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$avatarsPayload>[];
                };
                create: {
                    args: Prisma.avatarsCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$avatarsPayload>;
                };
                createMany: {
                    args: Prisma.avatarsCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.avatarsDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$avatarsPayload>;
                };
                update: {
                    args: Prisma.avatarsUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$avatarsPayload>;
                };
                deleteMany: {
                    args: Prisma.avatarsDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.avatarsUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.avatarsUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$avatarsPayload>;
                };
                aggregate: {
                    args: Prisma.AvatarsAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateAvatars>;
                };
                groupBy: {
                    args: Prisma.avatarsGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AvatarsGroupByOutputType>[];
                };
                count: {
                    args: Prisma.avatarsCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AvatarsCountAggregateOutputType> | number;
                };
            };
        };
        avatar_generations: {
            payload: Prisma.$avatar_generationsPayload<ExtArgs>;
            fields: Prisma.avatar_generationsFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.avatar_generationsFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$avatar_generationsPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.avatar_generationsFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$avatar_generationsPayload>;
                };
                findFirst: {
                    args: Prisma.avatar_generationsFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$avatar_generationsPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.avatar_generationsFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$avatar_generationsPayload>;
                };
                findMany: {
                    args: Prisma.avatar_generationsFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$avatar_generationsPayload>[];
                };
                create: {
                    args: Prisma.avatar_generationsCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$avatar_generationsPayload>;
                };
                createMany: {
                    args: Prisma.avatar_generationsCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.avatar_generationsDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$avatar_generationsPayload>;
                };
                update: {
                    args: Prisma.avatar_generationsUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$avatar_generationsPayload>;
                };
                deleteMany: {
                    args: Prisma.avatar_generationsDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.avatar_generationsUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.avatar_generationsUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$avatar_generationsPayload>;
                };
                aggregate: {
                    args: Prisma.Avatar_generationsAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateAvatar_generations>;
                };
                groupBy: {
                    args: Prisma.avatar_generationsGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Avatar_generationsGroupByOutputType>[];
                };
                count: {
                    args: Prisma.avatar_generationsCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.Avatar_generationsCountAggregateOutputType> | number;
                };
            };
        };
        system_settings: {
            payload: Prisma.$system_settingsPayload<ExtArgs>;
            fields: Prisma.system_settingsFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.system_settingsFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$system_settingsPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.system_settingsFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$system_settingsPayload>;
                };
                findFirst: {
                    args: Prisma.system_settingsFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$system_settingsPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.system_settingsFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$system_settingsPayload>;
                };
                findMany: {
                    args: Prisma.system_settingsFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$system_settingsPayload>[];
                };
                create: {
                    args: Prisma.system_settingsCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$system_settingsPayload>;
                };
                createMany: {
                    args: Prisma.system_settingsCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.system_settingsDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$system_settingsPayload>;
                };
                update: {
                    args: Prisma.system_settingsUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$system_settingsPayload>;
                };
                deleteMany: {
                    args: Prisma.system_settingsDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.system_settingsUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.system_settingsUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$system_settingsPayload>;
                };
                aggregate: {
                    args: Prisma.System_settingsAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateSystem_settings>;
                };
                groupBy: {
                    args: Prisma.system_settingsGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.System_settingsGroupByOutputType>[];
                };
                count: {
                    args: Prisma.system_settingsCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.System_settingsCountAggregateOutputType> | number;
                };
            };
        };
    };
} & {
    other: {
        payload: any;
        operations: {
            $executeRaw: {
                args: [query: TemplateStringsArray | Sql, ...values: any[]];
                result: any;
            };
            $executeRawUnsafe: {
                args: [query: string, ...values: any[]];
                result: any;
            };
            $queryRaw: {
                args: [query: TemplateStringsArray | Sql, ...values: any[]];
                result: any;
            };
            $queryRawUnsafe: {
                args: [query: string, ...values: any[]];
                result: any;
            };
        };
    };
};
export declare const TransactionIsolationLevel: {
    readonly ReadUncommitted: "ReadUncommitted";
    readonly ReadCommitted: "ReadCommitted";
    readonly RepeatableRead: "RepeatableRead";
    readonly Serializable: "Serializable";
};
export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel];
export declare const Billing_cardsScalarFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly provider_token: "provider_token";
    readonly last_four_digits: "last_four_digits";
    readonly brand: "brand";
    readonly holder_name: "holder_name";
    readonly is_default: "is_default";
};
export type Billing_cardsScalarFieldEnum = (typeof Billing_cardsScalarFieldEnum)[keyof typeof Billing_cardsScalarFieldEnum];
export declare const OrganizationsScalarFieldEnum: {
    readonly id: "id";
    readonly name: "name";
    readonly document_id: "document_id";
    readonly status: "status";
    readonly stripe_customer_id: "stripe_customer_id";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type OrganizationsScalarFieldEnum = (typeof OrganizationsScalarFieldEnum)[keyof typeof OrganizationsScalarFieldEnum];
export declare const TransactionsScalarFieldEnum: {
    readonly id: "id";
    readonly wallet_id: "wallet_id";
    readonly amount: "amount";
    readonly type: "type";
    readonly description: "description";
    readonly provider_transaction_id: "provider_transaction_id";
    readonly created_at: "created_at";
};
export type TransactionsScalarFieldEnum = (typeof TransactionsScalarFieldEnum)[keyof typeof TransactionsScalarFieldEnum];
export declare const UsersScalarFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly name: "name";
    readonly email: "email";
    readonly password_hash: "password_hash";
    readonly role: "role";
    readonly refresh_token: "refresh_token";
    readonly active: "active";
};
export type UsersScalarFieldEnum = (typeof UsersScalarFieldEnum)[keyof typeof UsersScalarFieldEnum];
export declare const WalletsScalarFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly balance: "balance";
    readonly status: "status";
};
export type WalletsScalarFieldEnum = (typeof WalletsScalarFieldEnum)[keyof typeof WalletsScalarFieldEnum];
export declare const Email_projectsScalarFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly name: "name";
    readonly settings: "settings";
    readonly created_at: "created_at";
    readonly active: "active";
};
export type Email_projectsScalarFieldEnum = (typeof Email_projectsScalarFieldEnum)[keyof typeof Email_projectsScalarFieldEnum];
export declare const Email_templatesScalarFieldEnum: {
    readonly id: "id";
    readonly project_id: "project_id";
    readonly name: "name";
    readonly subject: "subject";
    readonly body_html: "body_html";
    readonly body_text: "body_text";
};
export type Email_templatesScalarFieldEnum = (typeof Email_templatesScalarFieldEnum)[keyof typeof Email_templatesScalarFieldEnum];
export declare const Email_leadsScalarFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly email: "email";
    readonly name: "name";
    readonly attributes: "attributes";
    readonly global_status: "global_status";
};
export type Email_leadsScalarFieldEnum = (typeof Email_leadsScalarFieldEnum)[keyof typeof Email_leadsScalarFieldEnum];
export declare const Email_project_leadsScalarFieldEnum: {
    readonly project_id: "project_id";
    readonly lead_id: "lead_id";
    readonly status: "status";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
    readonly metrics: "metrics";
};
export type Email_project_leadsScalarFieldEnum = (typeof Email_project_leadsScalarFieldEnum)[keyof typeof Email_project_leadsScalarFieldEnum];
export declare const Email_projects_schedulesScalarFieldEnum: {
    readonly id: "id";
    readonly project_id: "project_id";
    readonly daily: "daily";
    readonly date: "date";
    readonly time: "time";
    readonly for_x_days: "for_x_days";
    readonly last_run: "last_run";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type Email_projects_schedulesScalarFieldEnum = (typeof Email_projects_schedulesScalarFieldEnum)[keyof typeof Email_projects_schedulesScalarFieldEnum];
export declare const Email_projects_schedules_sentScalarFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly project_id: "project_id";
    readonly schedule_id: "schedule_id";
    readonly open_count: "open_count";
    readonly click_cta_count: "click_cta_count";
    readonly schedule_time: "schedule_time";
    readonly schedule_date: "schedule_date";
    readonly schedule_daily: "schedule_daily";
    readonly run_at: "run_at";
    readonly sent: "sent";
    readonly status: "status";
    readonly subject: "subject";
    readonly body_html: "body_html";
    readonly body_text: "body_text";
    readonly total_leads: "total_leads";
    readonly sent_for_leads: "sent_for_leads";
    readonly error_message: "error_message";
    readonly created_at: "created_at";
    readonly tokens_unit_cost: "tokens_unit_cost";
    readonly tokens_cost: "tokens_cost";
};
export type Email_projects_schedules_sentScalarFieldEnum = (typeof Email_projects_schedules_sentScalarFieldEnum)[keyof typeof Email_projects_schedules_sentScalarFieldEnum];
export declare const Email_schedules_sent_opensScalarFieldEnum: {
    readonly id: "id";
    readonly schedule_sent_id: "schedule_sent_id";
    readonly email: "email";
    readonly created_at: "created_at";
};
export type Email_schedules_sent_opensScalarFieldEnum = (typeof Email_schedules_sent_opensScalarFieldEnum)[keyof typeof Email_schedules_sent_opensScalarFieldEnum];
export declare const Organization_domainsScalarFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly domain: "domain";
    readonly status: "status";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
    readonly provider_id: "provider_id";
    readonly dns_records: "dns_records";
};
export type Organization_domainsScalarFieldEnum = (typeof Organization_domainsScalarFieldEnum)[keyof typeof Organization_domainsScalarFieldEnum];
export declare const Agentes_iaScalarFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly name: "name";
    readonly description: "description";
    readonly ia_config: "ia_config";
    readonly active: "active";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type Agentes_iaScalarFieldEnum = (typeof Agentes_iaScalarFieldEnum)[keyof typeof Agentes_iaScalarFieldEnum];
export declare const WebchatsScalarFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly agent_id: "agent_id";
    readonly name: "name";
    readonly slug: "slug";
    readonly domain: "domain";
    readonly email_project_id: "email_project_id";
    readonly active: "active";
    readonly settings: "settings";
    readonly header_scripts: "header_scripts";
    readonly ads_config: "ads_config";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type WebchatsScalarFieldEnum = (typeof WebchatsScalarFieldEnum)[keyof typeof WebchatsScalarFieldEnum];
export declare const Webchat_adsScalarFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly webchat_id: "webchat_id";
    readonly position: "position";
    readonly codigo_tag: "codigo_tag";
    readonly gpt_sizes: "gpt_sizes";
    readonly gpt_slot: "gpt_slot";
    readonly gpt_div_id: "gpt_div_id";
    readonly anuncio_fixed: "anuncio_fixed";
    readonly intervalo_mensagens: "intervalo_mensagens";
    readonly sequence_ads: "sequence_ads";
    readonly ativo: "ativo";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type Webchat_adsScalarFieldEnum = (typeof Webchat_adsScalarFieldEnum)[keyof typeof Webchat_adsScalarFieldEnum];
export declare const Webchat_ad_eventsScalarFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly webchat_id: "webchat_id";
    readonly session_id: "session_id";
    readonly domain: "domain";
    readonly ad_position: "ad_position";
    readonly event_name: "event_name";
    readonly ad_key: "ad_key";
    readonly payload: "payload";
    readonly created_at: "created_at";
};
export type Webchat_ad_eventsScalarFieldEnum = (typeof Webchat_ad_eventsScalarFieldEnum)[keyof typeof Webchat_ad_eventsScalarFieldEnum];
export declare const Webchat_leadsScalarFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly webchat_id: "webchat_id";
    readonly email: "email";
    readonly name: "name";
    readonly phone: "phone";
    readonly source: "source";
    readonly session_id: "session_id";
    readonly context: "context";
    readonly custom_fields: "custom_fields";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type Webchat_leadsScalarFieldEnum = (typeof Webchat_leadsScalarFieldEnum)[keyof typeof Webchat_leadsScalarFieldEnum];
export declare const Webchat_sessionsScalarFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly webchat_id: "webchat_id";
    readonly session_id: "session_id";
    readonly lead_state: "lead_state";
    readonly conversation_history: "conversation_history";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type Webchat_sessionsScalarFieldEnum = (typeof Webchat_sessionsScalarFieldEnum)[keyof typeof Webchat_sessionsScalarFieldEnum];
export declare const Webchat_domainsScalarFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly domain: "domain";
    readonly status: "status";
    readonly expected_type: "expected_type";
    readonly expected_value: "expected_value";
    readonly last_check_error: "last_check_error";
    readonly last_checked_at: "last_checked_at";
    readonly traefik_file: "traefik_file";
    readonly ssl_status: "ssl_status";
    readonly ssl_error: "ssl_error";
    readonly ssl_issued_at: "ssl_issued_at";
    readonly ssl_attempted_at: "ssl_attempted_at";
    readonly ads_txt: "ads_txt";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type Webchat_domainsScalarFieldEnum = (typeof Webchat_domainsScalarFieldEnum)[keyof typeof Webchat_domainsScalarFieldEnum];
export declare const PostsScalarFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly internal_name: "internal_name";
    readonly post_type: "post_type";
    readonly default_title: "default_title";
    readonly default_caption: "default_caption";
    readonly tags: "tags";
    readonly status: "status";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type PostsScalarFieldEnum = (typeof PostsScalarFieldEnum)[keyof typeof PostsScalarFieldEnum];
export declare const Post_mediaScalarFieldEnum: {
    readonly id: "id";
    readonly post_id: "post_id";
    readonly sort_order: "sort_order";
    readonly media_type: "media_type";
    readonly mime_type: "mime_type";
    readonly file_size_bytes: "file_size_bytes";
    readonly original_name: "original_name";
    readonly storage_key: "storage_key";
    readonly storage_provider: "storage_provider";
    readonly width: "width";
    readonly height: "height";
    readonly duration_sec: "duration_sec";
    readonly thumbnail_key: "thumbnail_key";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type Post_mediaScalarFieldEnum = (typeof Post_mediaScalarFieldEnum)[keyof typeof Post_mediaScalarFieldEnum];
export declare const Social_post_schedulesScalarFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly post_id: "post_id";
    readonly social_account_id: "social_account_id";
    readonly social_network: "social_network";
    readonly status: "status";
    readonly ai_content: "ai_content";
    readonly scheduled_at: "scheduled_at";
    readonly platform_payload: "platform_payload";
    readonly post_snapshot: "post_snapshot";
    readonly tokens_unit_cost: "tokens_unit_cost";
    readonly tokens_cost: "tokens_cost";
    readonly error_message: "error_message";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type Social_post_schedulesScalarFieldEnum = (typeof Social_post_schedulesScalarFieldEnum)[keyof typeof Social_post_schedulesScalarFieldEnum];
export declare const Social_post_schedule_runsScalarFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly schedule_id: "schedule_id";
    readonly post_id: "post_id";
    readonly social_account_id: "social_account_id";
    readonly social_network: "social_network";
    readonly status: "status";
    readonly ai_content: "ai_content";
    readonly run_at: "run_at";
    readonly sent_at: "sent_at";
    readonly external_post_id: "external_post_id";
    readonly platform_payload: "platform_payload";
    readonly post_snapshot: "post_snapshot";
    readonly tokens_unit_cost: "tokens_unit_cost";
    readonly tokens_cost: "tokens_cost";
    readonly error_message: "error_message";
    readonly created_at: "created_at";
};
export type Social_post_schedule_runsScalarFieldEnum = (typeof Social_post_schedule_runsScalarFieldEnum)[keyof typeof Social_post_schedule_runsScalarFieldEnum];
export declare const Social_accountsScalarFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly social_network: "social_network";
    readonly provider_user_id: "provider_user_id";
    readonly username: "username";
    readonly display_name: "display_name";
    readonly profile_image_url: "profile_image_url";
    readonly status: "status";
    readonly is_default: "is_default";
    readonly access_token_encrypted: "access_token_encrypted";
    readonly refresh_token_encrypted: "refresh_token_encrypted";
    readonly token_expires_at: "token_expires_at";
    readonly scope: "scope";
    readonly extra: "extra";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type Social_accountsScalarFieldEnum = (typeof Social_accountsScalarFieldEnum)[keyof typeof Social_accountsScalarFieldEnum];
export declare const Organization_social_app_credentialsScalarFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly social_network: "social_network";
    readonly client_key: "client_key";
    readonly client_secret_encrypted: "client_secret_encrypted";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type Organization_social_app_credentialsScalarFieldEnum = (typeof Organization_social_app_credentialsScalarFieldEnum)[keyof typeof Organization_social_app_credentialsScalarFieldEnum];
export declare const AvatarsScalarFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly name: "name";
    readonly is_realistic: "is_realistic";
    readonly default_colors: "default_colors";
    readonly inspiration_image_url: "inspiration_image_url";
    readonly avatar_image_url: "avatar_image_url";
    readonly user_prompt: "user_prompt";
    readonly system_prompt: "system_prompt";
    readonly personality: "personality";
    readonly technical_metadata: "technical_metadata";
    readonly status: "status";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type AvatarsScalarFieldEnum = (typeof AvatarsScalarFieldEnum)[keyof typeof AvatarsScalarFieldEnum];
export declare const Avatar_generationsScalarFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly user_prompt: "user_prompt";
    readonly system_prompt: "system_prompt";
    readonly is_realistic: "is_realistic";
    readonly inspiration_image_url: "inspiration_image_url";
    readonly result_image_url: "result_image_url";
    readonly technical_metadata: "technical_metadata";
    readonly tokens_cost: "tokens_cost";
    readonly created_at: "created_at";
};
export type Avatar_generationsScalarFieldEnum = (typeof Avatar_generationsScalarFieldEnum)[keyof typeof Avatar_generationsScalarFieldEnum];
export declare const System_settingsScalarFieldEnum: {
    readonly id: "id";
    readonly groq_api_keys: "groq_api_keys";
    readonly cerebras_api_keys: "cerebras_api_keys";
    readonly gemini_api_keys: "gemini_api_keys";
    readonly mistral_api_keys: "mistral_api_keys";
    readonly openrouter_api_keys: "openrouter_api_keys";
    readonly sambanova_api_keys: "sambanova_api_keys";
    readonly resend_api_key: "resend_api_key";
    readonly webchat_edge_ip: "webchat_edge_ip";
    readonly certbot_email: "certbot_email";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type System_settingsScalarFieldEnum = (typeof System_settingsScalarFieldEnum)[keyof typeof System_settingsScalarFieldEnum];
export declare const SortOrder: {
    readonly asc: "asc";
    readonly desc: "desc";
};
export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];
export declare const NullableJsonNullValueInput: {
    readonly DbNull: runtime.DbNullClass;
    readonly JsonNull: runtime.JsonNullClass;
};
export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput];
export declare const JsonNullValueInput: {
    readonly JsonNull: runtime.JsonNullClass;
};
export type JsonNullValueInput = (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput];
export declare const NullsOrder: {
    readonly first: "first";
    readonly last: "last";
};
export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder];
export declare const billing_cardsOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly provider_token: "provider_token";
    readonly last_four_digits: "last_four_digits";
    readonly brand: "brand";
    readonly holder_name: "holder_name";
};
export type billing_cardsOrderByRelevanceFieldEnum = (typeof billing_cardsOrderByRelevanceFieldEnum)[keyof typeof billing_cardsOrderByRelevanceFieldEnum];
export declare const organizationsOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly name: "name";
    readonly document_id: "document_id";
    readonly stripe_customer_id: "stripe_customer_id";
};
export type organizationsOrderByRelevanceFieldEnum = (typeof organizationsOrderByRelevanceFieldEnum)[keyof typeof organizationsOrderByRelevanceFieldEnum];
export declare const transactionsOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly wallet_id: "wallet_id";
    readonly type: "type";
    readonly description: "description";
    readonly provider_transaction_id: "provider_transaction_id";
};
export type transactionsOrderByRelevanceFieldEnum = (typeof transactionsOrderByRelevanceFieldEnum)[keyof typeof transactionsOrderByRelevanceFieldEnum];
export declare const usersOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly name: "name";
    readonly email: "email";
    readonly password_hash: "password_hash";
    readonly refresh_token: "refresh_token";
};
export type usersOrderByRelevanceFieldEnum = (typeof usersOrderByRelevanceFieldEnum)[keyof typeof usersOrderByRelevanceFieldEnum];
export declare const walletsOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
};
export type walletsOrderByRelevanceFieldEnum = (typeof walletsOrderByRelevanceFieldEnum)[keyof typeof walletsOrderByRelevanceFieldEnum];
export declare const JsonNullValueFilter: {
    readonly DbNull: runtime.DbNullClass;
    readonly JsonNull: runtime.JsonNullClass;
    readonly AnyNull: runtime.AnyNullClass;
};
export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter];
export declare const QueryMode: {
    readonly default: "default";
    readonly insensitive: "insensitive";
};
export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode];
export declare const email_projectsOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly name: "name";
};
export type email_projectsOrderByRelevanceFieldEnum = (typeof email_projectsOrderByRelevanceFieldEnum)[keyof typeof email_projectsOrderByRelevanceFieldEnum];
export declare const email_templatesOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly project_id: "project_id";
    readonly name: "name";
    readonly subject: "subject";
    readonly body_html: "body_html";
    readonly body_text: "body_text";
};
export type email_templatesOrderByRelevanceFieldEnum = (typeof email_templatesOrderByRelevanceFieldEnum)[keyof typeof email_templatesOrderByRelevanceFieldEnum];
export declare const email_leadsOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly email: "email";
    readonly name: "name";
};
export type email_leadsOrderByRelevanceFieldEnum = (typeof email_leadsOrderByRelevanceFieldEnum)[keyof typeof email_leadsOrderByRelevanceFieldEnum];
export declare const email_project_leadsOrderByRelevanceFieldEnum: {
    readonly project_id: "project_id";
    readonly lead_id: "lead_id";
};
export type email_project_leadsOrderByRelevanceFieldEnum = (typeof email_project_leadsOrderByRelevanceFieldEnum)[keyof typeof email_project_leadsOrderByRelevanceFieldEnum];
export declare const email_projects_schedulesOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly project_id: "project_id";
};
export type email_projects_schedulesOrderByRelevanceFieldEnum = (typeof email_projects_schedulesOrderByRelevanceFieldEnum)[keyof typeof email_projects_schedulesOrderByRelevanceFieldEnum];
export declare const email_projects_schedules_sentOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly project_id: "project_id";
    readonly schedule_id: "schedule_id";
    readonly subject: "subject";
    readonly body_html: "body_html";
    readonly body_text: "body_text";
    readonly error_message: "error_message";
};
export type email_projects_schedules_sentOrderByRelevanceFieldEnum = (typeof email_projects_schedules_sentOrderByRelevanceFieldEnum)[keyof typeof email_projects_schedules_sentOrderByRelevanceFieldEnum];
export declare const email_schedules_sent_opensOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly schedule_sent_id: "schedule_sent_id";
    readonly email: "email";
};
export type email_schedules_sent_opensOrderByRelevanceFieldEnum = (typeof email_schedules_sent_opensOrderByRelevanceFieldEnum)[keyof typeof email_schedules_sent_opensOrderByRelevanceFieldEnum];
export declare const organization_domainsOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly domain: "domain";
    readonly provider_id: "provider_id";
};
export type organization_domainsOrderByRelevanceFieldEnum = (typeof organization_domainsOrderByRelevanceFieldEnum)[keyof typeof organization_domainsOrderByRelevanceFieldEnum];
export declare const agentes_iaOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly name: "name";
    readonly description: "description";
};
export type agentes_iaOrderByRelevanceFieldEnum = (typeof agentes_iaOrderByRelevanceFieldEnum)[keyof typeof agentes_iaOrderByRelevanceFieldEnum];
export declare const webchatsOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly agent_id: "agent_id";
    readonly name: "name";
    readonly slug: "slug";
    readonly domain: "domain";
    readonly email_project_id: "email_project_id";
    readonly header_scripts: "header_scripts";
};
export type webchatsOrderByRelevanceFieldEnum = (typeof webchatsOrderByRelevanceFieldEnum)[keyof typeof webchatsOrderByRelevanceFieldEnum];
export declare const webchat_adsOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly webchat_id: "webchat_id";
    readonly position: "position";
    readonly codigo_tag: "codigo_tag";
    readonly gpt_sizes: "gpt_sizes";
    readonly gpt_slot: "gpt_slot";
    readonly gpt_div_id: "gpt_div_id";
    readonly anuncio_fixed: "anuncio_fixed";
};
export type webchat_adsOrderByRelevanceFieldEnum = (typeof webchat_adsOrderByRelevanceFieldEnum)[keyof typeof webchat_adsOrderByRelevanceFieldEnum];
export declare const webchat_ad_eventsOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly webchat_id: "webchat_id";
    readonly session_id: "session_id";
    readonly domain: "domain";
    readonly ad_position: "ad_position";
    readonly event_name: "event_name";
    readonly ad_key: "ad_key";
};
export type webchat_ad_eventsOrderByRelevanceFieldEnum = (typeof webchat_ad_eventsOrderByRelevanceFieldEnum)[keyof typeof webchat_ad_eventsOrderByRelevanceFieldEnum];
export declare const webchat_leadsOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly webchat_id: "webchat_id";
    readonly email: "email";
    readonly name: "name";
    readonly phone: "phone";
    readonly source: "source";
    readonly session_id: "session_id";
};
export type webchat_leadsOrderByRelevanceFieldEnum = (typeof webchat_leadsOrderByRelevanceFieldEnum)[keyof typeof webchat_leadsOrderByRelevanceFieldEnum];
export declare const webchat_sessionsOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly webchat_id: "webchat_id";
    readonly session_id: "session_id";
};
export type webchat_sessionsOrderByRelevanceFieldEnum = (typeof webchat_sessionsOrderByRelevanceFieldEnum)[keyof typeof webchat_sessionsOrderByRelevanceFieldEnum];
export declare const webchat_domainsOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly domain: "domain";
    readonly expected_type: "expected_type";
    readonly expected_value: "expected_value";
    readonly last_check_error: "last_check_error";
    readonly traefik_file: "traefik_file";
    readonly ssl_status: "ssl_status";
    readonly ssl_error: "ssl_error";
    readonly ads_txt: "ads_txt";
};
export type webchat_domainsOrderByRelevanceFieldEnum = (typeof webchat_domainsOrderByRelevanceFieldEnum)[keyof typeof webchat_domainsOrderByRelevanceFieldEnum];
export declare const postsOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly internal_name: "internal_name";
    readonly default_title: "default_title";
    readonly default_caption: "default_caption";
};
export type postsOrderByRelevanceFieldEnum = (typeof postsOrderByRelevanceFieldEnum)[keyof typeof postsOrderByRelevanceFieldEnum];
export declare const post_mediaOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly post_id: "post_id";
    readonly mime_type: "mime_type";
    readonly original_name: "original_name";
    readonly storage_key: "storage_key";
    readonly storage_provider: "storage_provider";
    readonly thumbnail_key: "thumbnail_key";
};
export type post_mediaOrderByRelevanceFieldEnum = (typeof post_mediaOrderByRelevanceFieldEnum)[keyof typeof post_mediaOrderByRelevanceFieldEnum];
export declare const social_post_schedulesOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly post_id: "post_id";
    readonly social_account_id: "social_account_id";
    readonly error_message: "error_message";
};
export type social_post_schedulesOrderByRelevanceFieldEnum = (typeof social_post_schedulesOrderByRelevanceFieldEnum)[keyof typeof social_post_schedulesOrderByRelevanceFieldEnum];
export declare const social_post_schedule_runsOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly schedule_id: "schedule_id";
    readonly post_id: "post_id";
    readonly social_account_id: "social_account_id";
    readonly external_post_id: "external_post_id";
    readonly error_message: "error_message";
};
export type social_post_schedule_runsOrderByRelevanceFieldEnum = (typeof social_post_schedule_runsOrderByRelevanceFieldEnum)[keyof typeof social_post_schedule_runsOrderByRelevanceFieldEnum];
export declare const social_accountsOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly provider_user_id: "provider_user_id";
    readonly username: "username";
    readonly display_name: "display_name";
    readonly profile_image_url: "profile_image_url";
    readonly access_token_encrypted: "access_token_encrypted";
    readonly refresh_token_encrypted: "refresh_token_encrypted";
};
export type social_accountsOrderByRelevanceFieldEnum = (typeof social_accountsOrderByRelevanceFieldEnum)[keyof typeof social_accountsOrderByRelevanceFieldEnum];
export declare const organization_social_app_credentialsOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly client_key: "client_key";
    readonly client_secret_encrypted: "client_secret_encrypted";
};
export type organization_social_app_credentialsOrderByRelevanceFieldEnum = (typeof organization_social_app_credentialsOrderByRelevanceFieldEnum)[keyof typeof organization_social_app_credentialsOrderByRelevanceFieldEnum];
export declare const avatarsOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly name: "name";
    readonly inspiration_image_url: "inspiration_image_url";
    readonly avatar_image_url: "avatar_image_url";
    readonly user_prompt: "user_prompt";
    readonly system_prompt: "system_prompt";
    readonly personality: "personality";
};
export type avatarsOrderByRelevanceFieldEnum = (typeof avatarsOrderByRelevanceFieldEnum)[keyof typeof avatarsOrderByRelevanceFieldEnum];
export declare const avatar_generationsOrderByRelevanceFieldEnum: {
    readonly id: "id";
    readonly organization_id: "organization_id";
    readonly user_prompt: "user_prompt";
    readonly system_prompt: "system_prompt";
    readonly inspiration_image_url: "inspiration_image_url";
    readonly result_image_url: "result_image_url";
};
export type avatar_generationsOrderByRelevanceFieldEnum = (typeof avatar_generationsOrderByRelevanceFieldEnum)[keyof typeof avatar_generationsOrderByRelevanceFieldEnum];
export declare const system_settingsOrderByRelevanceFieldEnum: {
    readonly groq_api_keys: "groq_api_keys";
    readonly cerebras_api_keys: "cerebras_api_keys";
    readonly gemini_api_keys: "gemini_api_keys";
    readonly mistral_api_keys: "mistral_api_keys";
    readonly openrouter_api_keys: "openrouter_api_keys";
    readonly sambanova_api_keys: "sambanova_api_keys";
    readonly resend_api_key: "resend_api_key";
    readonly webchat_edge_ip: "webchat_edge_ip";
    readonly certbot_email: "certbot_email";
};
export type system_settingsOrderByRelevanceFieldEnum = (typeof system_settingsOrderByRelevanceFieldEnum)[keyof typeof system_settingsOrderByRelevanceFieldEnum];
export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>;
export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>;
export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>;
export type DecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal'>;
export type Enumusers_roleFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'users_role'>;
export type Enumwallets_statusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'wallets_status'>;
export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>;
export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QueryMode'>;
export type Enumemail_leads_global_statusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'email_leads_global_status'>;
export type Enumemail_project_leads_statusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'email_project_leads_status'>;
export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>;
export type Enumschedule_sent_statusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'schedule_sent_status'>;
export type Enumdomain_statusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'domain_status'>;
export type Enumpost_typeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'post_type'>;
export type Enumpost_statusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'post_status'>;
export type Enummedia_typeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'media_type'>;
export type Enumsocial_networkFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'social_network'>;
export type Enumsocial_schedule_statusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'social_schedule_status'>;
export type Enumsocial_schedule_run_statusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'social_schedule_run_status'>;
export type Enumsocial_account_statusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'social_account_status'>;
export type Enumavatar_statusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'avatar_status'>;
export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>;
export type BatchPayload = {
    count: number;
};
export declare const defineExtension: runtime.Types.Extensions.ExtendsHook<"define", TypeMapCb, runtime.Types.Extensions.DefaultArgs>;
export type DefaultPrismaClient = PrismaClient;
export type ErrorFormat = 'pretty' | 'colorless' | 'minimal';
export type PrismaClientOptions = ({
    adapter: runtime.SqlDriverAdapterFactory;
    accelerateUrl?: never;
} | {
    accelerateUrl: string;
    adapter?: never;
}) & {
    errorFormat?: ErrorFormat;
    log?: (LogLevel | LogDefinition)[];
    transactionOptions?: {
        maxWait?: number;
        timeout?: number;
        isolationLevel?: TransactionIsolationLevel;
    };
    omit?: GlobalOmitConfig;
    comments?: runtime.SqlCommenterPlugin[];
};
export type GlobalOmitConfig = {
    billing_cards?: Prisma.billing_cardsOmit;
    organizations?: Prisma.organizationsOmit;
    transactions?: Prisma.transactionsOmit;
    users?: Prisma.usersOmit;
    wallets?: Prisma.walletsOmit;
    email_projects?: Prisma.email_projectsOmit;
    email_templates?: Prisma.email_templatesOmit;
    email_leads?: Prisma.email_leadsOmit;
    email_project_leads?: Prisma.email_project_leadsOmit;
    email_projects_schedules?: Prisma.email_projects_schedulesOmit;
    email_projects_schedules_sent?: Prisma.email_projects_schedules_sentOmit;
    email_schedules_sent_opens?: Prisma.email_schedules_sent_opensOmit;
    organization_domains?: Prisma.organization_domainsOmit;
    agentes_ia?: Prisma.agentes_iaOmit;
    webchats?: Prisma.webchatsOmit;
    webchat_ads?: Prisma.webchat_adsOmit;
    webchat_ad_events?: Prisma.webchat_ad_eventsOmit;
    webchat_leads?: Prisma.webchat_leadsOmit;
    webchat_sessions?: Prisma.webchat_sessionsOmit;
    webchat_domains?: Prisma.webchat_domainsOmit;
    posts?: Prisma.postsOmit;
    post_media?: Prisma.post_mediaOmit;
    social_post_schedules?: Prisma.social_post_schedulesOmit;
    social_post_schedule_runs?: Prisma.social_post_schedule_runsOmit;
    social_accounts?: Prisma.social_accountsOmit;
    organization_social_app_credentials?: Prisma.organization_social_app_credentialsOmit;
    avatars?: Prisma.avatarsOmit;
    avatar_generations?: Prisma.avatar_generationsOmit;
    system_settings?: Prisma.system_settingsOmit;
};
export type LogLevel = 'info' | 'query' | 'warn' | 'error';
export type LogDefinition = {
    level: LogLevel;
    emit: 'stdout' | 'event';
};
export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;
export type GetLogType<T> = CheckIsLogLevel<T extends LogDefinition ? T['level'] : T>;
export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition> ? GetLogType<T[number]> : never;
export type QueryEvent = {
    timestamp: Date;
    query: string;
    params: string;
    duration: number;
    target: string;
};
export type LogEvent = {
    timestamp: Date;
    message: string;
    target: string;
};
export type PrismaAction = 'findUnique' | 'findUniqueOrThrow' | 'findMany' | 'findFirst' | 'findFirstOrThrow' | 'create' | 'createMany' | 'createManyAndReturn' | 'update' | 'updateMany' | 'updateManyAndReturn' | 'upsert' | 'delete' | 'deleteMany' | 'executeRaw' | 'queryRaw' | 'aggregate' | 'count' | 'runCommandRaw' | 'findRaw' | 'groupBy';
export type TransactionClient = Omit<DefaultPrismaClient, runtime.ITXClientDenyList>;
