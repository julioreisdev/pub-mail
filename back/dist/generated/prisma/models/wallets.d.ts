import type * as runtime from "@prisma/client/runtime/client";
import type * as $Enums from "../enums.js";
import type * as Prisma from "../internal/prismaNamespace.js";
export type walletsModel = runtime.Types.Result.DefaultSelection<Prisma.$walletsPayload>;
export type AggregateWallets = {
    _count: WalletsCountAggregateOutputType | null;
    _avg: WalletsAvgAggregateOutputType | null;
    _sum: WalletsSumAggregateOutputType | null;
    _min: WalletsMinAggregateOutputType | null;
    _max: WalletsMaxAggregateOutputType | null;
};
export type WalletsAvgAggregateOutputType = {
    balance: runtime.Decimal | null;
};
export type WalletsSumAggregateOutputType = {
    balance: runtime.Decimal | null;
};
export type WalletsMinAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    balance: runtime.Decimal | null;
    status: $Enums.wallets_status | null;
};
export type WalletsMaxAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    balance: runtime.Decimal | null;
    status: $Enums.wallets_status | null;
};
export type WalletsCountAggregateOutputType = {
    id: number;
    organization_id: number;
    balance: number;
    status: number;
    _all: number;
};
export type WalletsAvgAggregateInputType = {
    balance?: true;
};
export type WalletsSumAggregateInputType = {
    balance?: true;
};
export type WalletsMinAggregateInputType = {
    id?: true;
    organization_id?: true;
    balance?: true;
    status?: true;
};
export type WalletsMaxAggregateInputType = {
    id?: true;
    organization_id?: true;
    balance?: true;
    status?: true;
};
export type WalletsCountAggregateInputType = {
    id?: true;
    organization_id?: true;
    balance?: true;
    status?: true;
    _all?: true;
};
export type WalletsAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.walletsWhereInput;
    orderBy?: Prisma.walletsOrderByWithRelationInput | Prisma.walletsOrderByWithRelationInput[];
    cursor?: Prisma.walletsWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | WalletsCountAggregateInputType;
    _avg?: WalletsAvgAggregateInputType;
    _sum?: WalletsSumAggregateInputType;
    _min?: WalletsMinAggregateInputType;
    _max?: WalletsMaxAggregateInputType;
};
export type GetWalletsAggregateType<T extends WalletsAggregateArgs> = {
    [P in keyof T & keyof AggregateWallets]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateWallets[P]> : Prisma.GetScalarType<T[P], AggregateWallets[P]>;
};
export type walletsGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.walletsWhereInput;
    orderBy?: Prisma.walletsOrderByWithAggregationInput | Prisma.walletsOrderByWithAggregationInput[];
    by: Prisma.WalletsScalarFieldEnum[] | Prisma.WalletsScalarFieldEnum;
    having?: Prisma.walletsScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: WalletsCountAggregateInputType | true;
    _avg?: WalletsAvgAggregateInputType;
    _sum?: WalletsSumAggregateInputType;
    _min?: WalletsMinAggregateInputType;
    _max?: WalletsMaxAggregateInputType;
};
export type WalletsGroupByOutputType = {
    id: string;
    organization_id: string;
    balance: runtime.Decimal;
    status: $Enums.wallets_status;
    _count: WalletsCountAggregateOutputType | null;
    _avg: WalletsAvgAggregateOutputType | null;
    _sum: WalletsSumAggregateOutputType | null;
    _min: WalletsMinAggregateOutputType | null;
    _max: WalletsMaxAggregateOutputType | null;
};
type GetWalletsGroupByPayload<T extends walletsGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<WalletsGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof WalletsGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], WalletsGroupByOutputType[P]> : Prisma.GetScalarType<T[P], WalletsGroupByOutputType[P]>;
}>>;
export type walletsWhereInput = {
    AND?: Prisma.walletsWhereInput | Prisma.walletsWhereInput[];
    OR?: Prisma.walletsWhereInput[];
    NOT?: Prisma.walletsWhereInput | Prisma.walletsWhereInput[];
    id?: Prisma.StringFilter<"wallets"> | string;
    organization_id?: Prisma.StringFilter<"wallets"> | string;
    balance?: Prisma.DecimalFilter<"wallets"> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    status?: Prisma.Enumwallets_statusFilter<"wallets"> | $Enums.wallets_status;
    transactions?: Prisma.TransactionsListRelationFilter;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
};
export type walletsOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    balance?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    transactions?: Prisma.transactionsOrderByRelationAggregateInput;
    organizations?: Prisma.organizationsOrderByWithRelationInput;
    _relevance?: Prisma.walletsOrderByRelevanceInput;
};
export type walletsWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    id_organization_id?: Prisma.walletsIdOrganization_idCompoundUniqueInput;
    AND?: Prisma.walletsWhereInput | Prisma.walletsWhereInput[];
    OR?: Prisma.walletsWhereInput[];
    NOT?: Prisma.walletsWhereInput | Prisma.walletsWhereInput[];
    organization_id?: Prisma.StringFilter<"wallets"> | string;
    balance?: Prisma.DecimalFilter<"wallets"> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    status?: Prisma.Enumwallets_statusFilter<"wallets"> | $Enums.wallets_status;
    transactions?: Prisma.TransactionsListRelationFilter;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
}, "id" | "id_organization_id">;
export type walletsOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    balance?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    _count?: Prisma.walletsCountOrderByAggregateInput;
    _avg?: Prisma.walletsAvgOrderByAggregateInput;
    _max?: Prisma.walletsMaxOrderByAggregateInput;
    _min?: Prisma.walletsMinOrderByAggregateInput;
    _sum?: Prisma.walletsSumOrderByAggregateInput;
};
export type walletsScalarWhereWithAggregatesInput = {
    AND?: Prisma.walletsScalarWhereWithAggregatesInput | Prisma.walletsScalarWhereWithAggregatesInput[];
    OR?: Prisma.walletsScalarWhereWithAggregatesInput[];
    NOT?: Prisma.walletsScalarWhereWithAggregatesInput | Prisma.walletsScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"wallets"> | string;
    organization_id?: Prisma.StringWithAggregatesFilter<"wallets"> | string;
    balance?: Prisma.DecimalWithAggregatesFilter<"wallets"> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    status?: Prisma.Enumwallets_statusWithAggregatesFilter<"wallets"> | $Enums.wallets_status;
};
export type walletsCreateInput = {
    id?: string;
    balance?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    status?: $Enums.wallets_status;
    transactions?: Prisma.transactionsCreateNestedManyWithoutWalletsInput;
    organizations: Prisma.organizationsCreateNestedOneWithoutWalletsInput;
};
export type walletsUncheckedCreateInput = {
    id?: string;
    organization_id: string;
    balance?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    status?: $Enums.wallets_status;
    transactions?: Prisma.transactionsUncheckedCreateNestedManyWithoutWalletsInput;
};
export type walletsUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    balance?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    status?: Prisma.Enumwallets_statusFieldUpdateOperationsInput | $Enums.wallets_status;
    transactions?: Prisma.transactionsUpdateManyWithoutWalletsNestedInput;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutWalletsNestedInput;
};
export type walletsUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    balance?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    status?: Prisma.Enumwallets_statusFieldUpdateOperationsInput | $Enums.wallets_status;
    transactions?: Prisma.transactionsUncheckedUpdateManyWithoutWalletsNestedInput;
};
export type walletsCreateManyInput = {
    id?: string;
    organization_id: string;
    balance?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    status?: $Enums.wallets_status;
};
export type walletsUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    balance?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    status?: Prisma.Enumwallets_statusFieldUpdateOperationsInput | $Enums.wallets_status;
};
export type walletsUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    balance?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    status?: Prisma.Enumwallets_statusFieldUpdateOperationsInput | $Enums.wallets_status;
};
export type WalletsListRelationFilter = {
    every?: Prisma.walletsWhereInput;
    some?: Prisma.walletsWhereInput;
    none?: Prisma.walletsWhereInput;
};
export type walletsOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type WalletsScalarRelationFilter = {
    is?: Prisma.walletsWhereInput;
    isNot?: Prisma.walletsWhereInput;
};
export type walletsOrderByRelevanceInput = {
    fields: Prisma.walletsOrderByRelevanceFieldEnum | Prisma.walletsOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type walletsIdOrganization_idCompoundUniqueInput = {
    id: string;
    organization_id: string;
};
export type walletsCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    balance?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
};
export type walletsAvgOrderByAggregateInput = {
    balance?: Prisma.SortOrder;
};
export type walletsMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    balance?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
};
export type walletsMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    balance?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
};
export type walletsSumOrderByAggregateInput = {
    balance?: Prisma.SortOrder;
};
export type walletsCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.walletsCreateWithoutOrganizationsInput, Prisma.walletsUncheckedCreateWithoutOrganizationsInput> | Prisma.walletsCreateWithoutOrganizationsInput[] | Prisma.walletsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.walletsCreateOrConnectWithoutOrganizationsInput | Prisma.walletsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.walletsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.walletsWhereUniqueInput | Prisma.walletsWhereUniqueInput[];
};
export type walletsUncheckedCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.walletsCreateWithoutOrganizationsInput, Prisma.walletsUncheckedCreateWithoutOrganizationsInput> | Prisma.walletsCreateWithoutOrganizationsInput[] | Prisma.walletsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.walletsCreateOrConnectWithoutOrganizationsInput | Prisma.walletsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.walletsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.walletsWhereUniqueInput | Prisma.walletsWhereUniqueInput[];
};
export type walletsUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.walletsCreateWithoutOrganizationsInput, Prisma.walletsUncheckedCreateWithoutOrganizationsInput> | Prisma.walletsCreateWithoutOrganizationsInput[] | Prisma.walletsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.walletsCreateOrConnectWithoutOrganizationsInput | Prisma.walletsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.walletsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.walletsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.walletsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.walletsWhereUniqueInput | Prisma.walletsWhereUniqueInput[];
    disconnect?: Prisma.walletsWhereUniqueInput | Prisma.walletsWhereUniqueInput[];
    delete?: Prisma.walletsWhereUniqueInput | Prisma.walletsWhereUniqueInput[];
    connect?: Prisma.walletsWhereUniqueInput | Prisma.walletsWhereUniqueInput[];
    update?: Prisma.walletsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.walletsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.walletsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.walletsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.walletsScalarWhereInput | Prisma.walletsScalarWhereInput[];
};
export type walletsUncheckedUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.walletsCreateWithoutOrganizationsInput, Prisma.walletsUncheckedCreateWithoutOrganizationsInput> | Prisma.walletsCreateWithoutOrganizationsInput[] | Prisma.walletsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.walletsCreateOrConnectWithoutOrganizationsInput | Prisma.walletsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.walletsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.walletsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.walletsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.walletsWhereUniqueInput | Prisma.walletsWhereUniqueInput[];
    disconnect?: Prisma.walletsWhereUniqueInput | Prisma.walletsWhereUniqueInput[];
    delete?: Prisma.walletsWhereUniqueInput | Prisma.walletsWhereUniqueInput[];
    connect?: Prisma.walletsWhereUniqueInput | Prisma.walletsWhereUniqueInput[];
    update?: Prisma.walletsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.walletsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.walletsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.walletsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.walletsScalarWhereInput | Prisma.walletsScalarWhereInput[];
};
export type walletsCreateNestedOneWithoutTransactionsInput = {
    create?: Prisma.XOR<Prisma.walletsCreateWithoutTransactionsInput, Prisma.walletsUncheckedCreateWithoutTransactionsInput>;
    connectOrCreate?: Prisma.walletsCreateOrConnectWithoutTransactionsInput;
    connect?: Prisma.walletsWhereUniqueInput;
};
export type walletsUpdateOneRequiredWithoutTransactionsNestedInput = {
    create?: Prisma.XOR<Prisma.walletsCreateWithoutTransactionsInput, Prisma.walletsUncheckedCreateWithoutTransactionsInput>;
    connectOrCreate?: Prisma.walletsCreateOrConnectWithoutTransactionsInput;
    upsert?: Prisma.walletsUpsertWithoutTransactionsInput;
    connect?: Prisma.walletsWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.walletsUpdateToOneWithWhereWithoutTransactionsInput, Prisma.walletsUpdateWithoutTransactionsInput>, Prisma.walletsUncheckedUpdateWithoutTransactionsInput>;
};
export type Enumwallets_statusFieldUpdateOperationsInput = {
    set?: $Enums.wallets_status;
};
export type walletsCreateWithoutOrganizationsInput = {
    id?: string;
    balance?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    status?: $Enums.wallets_status;
    transactions?: Prisma.transactionsCreateNestedManyWithoutWalletsInput;
};
export type walletsUncheckedCreateWithoutOrganizationsInput = {
    id?: string;
    balance?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    status?: $Enums.wallets_status;
    transactions?: Prisma.transactionsUncheckedCreateNestedManyWithoutWalletsInput;
};
export type walletsCreateOrConnectWithoutOrganizationsInput = {
    where: Prisma.walletsWhereUniqueInput;
    create: Prisma.XOR<Prisma.walletsCreateWithoutOrganizationsInput, Prisma.walletsUncheckedCreateWithoutOrganizationsInput>;
};
export type walletsCreateManyOrganizationsInputEnvelope = {
    data: Prisma.walletsCreateManyOrganizationsInput | Prisma.walletsCreateManyOrganizationsInput[];
    skipDuplicates?: boolean;
};
export type walletsUpsertWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.walletsWhereUniqueInput;
    update: Prisma.XOR<Prisma.walletsUpdateWithoutOrganizationsInput, Prisma.walletsUncheckedUpdateWithoutOrganizationsInput>;
    create: Prisma.XOR<Prisma.walletsCreateWithoutOrganizationsInput, Prisma.walletsUncheckedCreateWithoutOrganizationsInput>;
};
export type walletsUpdateWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.walletsWhereUniqueInput;
    data: Prisma.XOR<Prisma.walletsUpdateWithoutOrganizationsInput, Prisma.walletsUncheckedUpdateWithoutOrganizationsInput>;
};
export type walletsUpdateManyWithWhereWithoutOrganizationsInput = {
    where: Prisma.walletsScalarWhereInput;
    data: Prisma.XOR<Prisma.walletsUpdateManyMutationInput, Prisma.walletsUncheckedUpdateManyWithoutOrganizationsInput>;
};
export type walletsScalarWhereInput = {
    AND?: Prisma.walletsScalarWhereInput | Prisma.walletsScalarWhereInput[];
    OR?: Prisma.walletsScalarWhereInput[];
    NOT?: Prisma.walletsScalarWhereInput | Prisma.walletsScalarWhereInput[];
    id?: Prisma.StringFilter<"wallets"> | string;
    organization_id?: Prisma.StringFilter<"wallets"> | string;
    balance?: Prisma.DecimalFilter<"wallets"> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    status?: Prisma.Enumwallets_statusFilter<"wallets"> | $Enums.wallets_status;
};
export type walletsCreateWithoutTransactionsInput = {
    id?: string;
    balance?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    status?: $Enums.wallets_status;
    organizations: Prisma.organizationsCreateNestedOneWithoutWalletsInput;
};
export type walletsUncheckedCreateWithoutTransactionsInput = {
    id?: string;
    organization_id: string;
    balance?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    status?: $Enums.wallets_status;
};
export type walletsCreateOrConnectWithoutTransactionsInput = {
    where: Prisma.walletsWhereUniqueInput;
    create: Prisma.XOR<Prisma.walletsCreateWithoutTransactionsInput, Prisma.walletsUncheckedCreateWithoutTransactionsInput>;
};
export type walletsUpsertWithoutTransactionsInput = {
    update: Prisma.XOR<Prisma.walletsUpdateWithoutTransactionsInput, Prisma.walletsUncheckedUpdateWithoutTransactionsInput>;
    create: Prisma.XOR<Prisma.walletsCreateWithoutTransactionsInput, Prisma.walletsUncheckedCreateWithoutTransactionsInput>;
    where?: Prisma.walletsWhereInput;
};
export type walletsUpdateToOneWithWhereWithoutTransactionsInput = {
    where?: Prisma.walletsWhereInput;
    data: Prisma.XOR<Prisma.walletsUpdateWithoutTransactionsInput, Prisma.walletsUncheckedUpdateWithoutTransactionsInput>;
};
export type walletsUpdateWithoutTransactionsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    balance?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    status?: Prisma.Enumwallets_statusFieldUpdateOperationsInput | $Enums.wallets_status;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutWalletsNestedInput;
};
export type walletsUncheckedUpdateWithoutTransactionsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    balance?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    status?: Prisma.Enumwallets_statusFieldUpdateOperationsInput | $Enums.wallets_status;
};
export type walletsCreateManyOrganizationsInput = {
    id?: string;
    balance?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    status?: $Enums.wallets_status;
};
export type walletsUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    balance?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    status?: Prisma.Enumwallets_statusFieldUpdateOperationsInput | $Enums.wallets_status;
    transactions?: Prisma.transactionsUpdateManyWithoutWalletsNestedInput;
};
export type walletsUncheckedUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    balance?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    status?: Prisma.Enumwallets_statusFieldUpdateOperationsInput | $Enums.wallets_status;
    transactions?: Prisma.transactionsUncheckedUpdateManyWithoutWalletsNestedInput;
};
export type walletsUncheckedUpdateManyWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    balance?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    status?: Prisma.Enumwallets_statusFieldUpdateOperationsInput | $Enums.wallets_status;
};
export type WalletsCountOutputType = {
    transactions: number;
};
export type WalletsCountOutputTypeSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    transactions?: boolean | WalletsCountOutputTypeCountTransactionsArgs;
};
export type WalletsCountOutputTypeDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.WalletsCountOutputTypeSelect<ExtArgs> | null;
};
export type WalletsCountOutputTypeCountTransactionsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.transactionsWhereInput;
};
export type walletsSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    organization_id?: boolean;
    balance?: boolean;
    status?: boolean;
    transactions?: boolean | Prisma.wallets$transactionsArgs<ExtArgs>;
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
    _count?: boolean | Prisma.WalletsCountOutputTypeDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["wallets"]>;
export type walletsSelectScalar = {
    id?: boolean;
    organization_id?: boolean;
    balance?: boolean;
    status?: boolean;
};
export type walletsOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "organization_id" | "balance" | "status", ExtArgs["result"]["wallets"]>;
export type walletsInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    transactions?: boolean | Prisma.wallets$transactionsArgs<ExtArgs>;
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
    _count?: boolean | Prisma.WalletsCountOutputTypeDefaultArgs<ExtArgs>;
};
export type $walletsPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "wallets";
    objects: {
        transactions: Prisma.$transactionsPayload<ExtArgs>[];
        organizations: Prisma.$organizationsPayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        organization_id: string;
        balance: runtime.Decimal;
        status: $Enums.wallets_status;
    }, ExtArgs["result"]["wallets"]>;
    composites: {};
};
export type walletsGetPayload<S extends boolean | null | undefined | walletsDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$walletsPayload, S>;
export type walletsCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<walletsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: WalletsCountAggregateInputType | true;
};
export interface walletsDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['wallets'];
        meta: {
            name: 'wallets';
        };
    };
    findUnique<T extends walletsFindUniqueArgs>(args: Prisma.SelectSubset<T, walletsFindUniqueArgs<ExtArgs>>): Prisma.Prisma__walletsClient<runtime.Types.Result.GetResult<Prisma.$walletsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends walletsFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, walletsFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__walletsClient<runtime.Types.Result.GetResult<Prisma.$walletsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends walletsFindFirstArgs>(args?: Prisma.SelectSubset<T, walletsFindFirstArgs<ExtArgs>>): Prisma.Prisma__walletsClient<runtime.Types.Result.GetResult<Prisma.$walletsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends walletsFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, walletsFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__walletsClient<runtime.Types.Result.GetResult<Prisma.$walletsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends walletsFindManyArgs>(args?: Prisma.SelectSubset<T, walletsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$walletsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends walletsCreateArgs>(args: Prisma.SelectSubset<T, walletsCreateArgs<ExtArgs>>): Prisma.Prisma__walletsClient<runtime.Types.Result.GetResult<Prisma.$walletsPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends walletsCreateManyArgs>(args?: Prisma.SelectSubset<T, walletsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends walletsDeleteArgs>(args: Prisma.SelectSubset<T, walletsDeleteArgs<ExtArgs>>): Prisma.Prisma__walletsClient<runtime.Types.Result.GetResult<Prisma.$walletsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends walletsUpdateArgs>(args: Prisma.SelectSubset<T, walletsUpdateArgs<ExtArgs>>): Prisma.Prisma__walletsClient<runtime.Types.Result.GetResult<Prisma.$walletsPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends walletsDeleteManyArgs>(args?: Prisma.SelectSubset<T, walletsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends walletsUpdateManyArgs>(args: Prisma.SelectSubset<T, walletsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends walletsUpsertArgs>(args: Prisma.SelectSubset<T, walletsUpsertArgs<ExtArgs>>): Prisma.Prisma__walletsClient<runtime.Types.Result.GetResult<Prisma.$walletsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends walletsCountArgs>(args?: Prisma.Subset<T, walletsCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], WalletsCountAggregateOutputType> : number>;
    aggregate<T extends WalletsAggregateArgs>(args: Prisma.Subset<T, WalletsAggregateArgs>): Prisma.PrismaPromise<GetWalletsAggregateType<T>>;
    groupBy<T extends walletsGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: walletsGroupByArgs['orderBy'];
    } : {
        orderBy?: walletsGroupByArgs['orderBy'];
    }, OrderFields extends Prisma.ExcludeUnderscoreKeys<Prisma.Keys<Prisma.MaybeTupleToUnion<T['orderBy']>>>, ByFields extends Prisma.MaybeTupleToUnion<T['by']>, ByValid extends Prisma.Has<ByFields, OrderFields>, HavingFields extends Prisma.GetHavingFields<T['having']>, HavingValid extends Prisma.Has<ByFields, HavingFields>, ByEmpty extends T['by'] extends never[] ? Prisma.True : Prisma.False, InputErrors extends ByEmpty extends Prisma.True ? `Error: "by" must not be empty.` : HavingValid extends Prisma.False ? {
        [P in HavingFields]: P extends ByFields ? never : P extends string ? `Error: Field "${P}" used in "having" needs to be provided in "by".` : [
            Error,
            'Field ',
            P,
            ` in "having" needs to be provided in "by"`
        ];
    }[HavingFields] : 'take' extends Prisma.Keys<T> ? 'orderBy' extends Prisma.Keys<T> ? ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields] : 'Error: If you provide "take", you also need to provide "orderBy"' : 'skip' extends Prisma.Keys<T> ? 'orderBy' extends Prisma.Keys<T> ? ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields] : 'Error: If you provide "skip", you also need to provide "orderBy"' : ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, walletsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetWalletsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: walletsFieldRefs;
}
export interface Prisma__walletsClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    transactions<T extends Prisma.wallets$transactionsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.wallets$transactionsArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$transactionsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    organizations<T extends Prisma.organizationsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.organizationsDefaultArgs<ExtArgs>>): Prisma.Prisma__organizationsClient<runtime.Types.Result.GetResult<Prisma.$organizationsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface walletsFieldRefs {
    readonly id: Prisma.FieldRef<"wallets", 'String'>;
    readonly organization_id: Prisma.FieldRef<"wallets", 'String'>;
    readonly balance: Prisma.FieldRef<"wallets", 'Decimal'>;
    readonly status: Prisma.FieldRef<"wallets", 'wallets_status'>;
}
export type walletsFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.walletsSelect<ExtArgs> | null;
    omit?: Prisma.walletsOmit<ExtArgs> | null;
    include?: Prisma.walletsInclude<ExtArgs> | null;
    where: Prisma.walletsWhereUniqueInput;
};
export type walletsFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.walletsSelect<ExtArgs> | null;
    omit?: Prisma.walletsOmit<ExtArgs> | null;
    include?: Prisma.walletsInclude<ExtArgs> | null;
    where: Prisma.walletsWhereUniqueInput;
};
export type walletsFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.walletsSelect<ExtArgs> | null;
    omit?: Prisma.walletsOmit<ExtArgs> | null;
    include?: Prisma.walletsInclude<ExtArgs> | null;
    where?: Prisma.walletsWhereInput;
    orderBy?: Prisma.walletsOrderByWithRelationInput | Prisma.walletsOrderByWithRelationInput[];
    cursor?: Prisma.walletsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.WalletsScalarFieldEnum | Prisma.WalletsScalarFieldEnum[];
};
export type walletsFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.walletsSelect<ExtArgs> | null;
    omit?: Prisma.walletsOmit<ExtArgs> | null;
    include?: Prisma.walletsInclude<ExtArgs> | null;
    where?: Prisma.walletsWhereInput;
    orderBy?: Prisma.walletsOrderByWithRelationInput | Prisma.walletsOrderByWithRelationInput[];
    cursor?: Prisma.walletsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.WalletsScalarFieldEnum | Prisma.WalletsScalarFieldEnum[];
};
export type walletsFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.walletsSelect<ExtArgs> | null;
    omit?: Prisma.walletsOmit<ExtArgs> | null;
    include?: Prisma.walletsInclude<ExtArgs> | null;
    where?: Prisma.walletsWhereInput;
    orderBy?: Prisma.walletsOrderByWithRelationInput | Prisma.walletsOrderByWithRelationInput[];
    cursor?: Prisma.walletsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.WalletsScalarFieldEnum | Prisma.WalletsScalarFieldEnum[];
};
export type walletsCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.walletsSelect<ExtArgs> | null;
    omit?: Prisma.walletsOmit<ExtArgs> | null;
    include?: Prisma.walletsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.walletsCreateInput, Prisma.walletsUncheckedCreateInput>;
};
export type walletsCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.walletsCreateManyInput | Prisma.walletsCreateManyInput[];
    skipDuplicates?: boolean;
};
export type walletsUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.walletsSelect<ExtArgs> | null;
    omit?: Prisma.walletsOmit<ExtArgs> | null;
    include?: Prisma.walletsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.walletsUpdateInput, Prisma.walletsUncheckedUpdateInput>;
    where: Prisma.walletsWhereUniqueInput;
};
export type walletsUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.walletsUpdateManyMutationInput, Prisma.walletsUncheckedUpdateManyInput>;
    where?: Prisma.walletsWhereInput;
    limit?: number;
};
export type walletsUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.walletsSelect<ExtArgs> | null;
    omit?: Prisma.walletsOmit<ExtArgs> | null;
    include?: Prisma.walletsInclude<ExtArgs> | null;
    where: Prisma.walletsWhereUniqueInput;
    create: Prisma.XOR<Prisma.walletsCreateInput, Prisma.walletsUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.walletsUpdateInput, Prisma.walletsUncheckedUpdateInput>;
};
export type walletsDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.walletsSelect<ExtArgs> | null;
    omit?: Prisma.walletsOmit<ExtArgs> | null;
    include?: Prisma.walletsInclude<ExtArgs> | null;
    where: Prisma.walletsWhereUniqueInput;
};
export type walletsDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.walletsWhereInput;
    limit?: number;
};
export type wallets$transactionsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.transactionsSelect<ExtArgs> | null;
    omit?: Prisma.transactionsOmit<ExtArgs> | null;
    include?: Prisma.transactionsInclude<ExtArgs> | null;
    where?: Prisma.transactionsWhereInput;
    orderBy?: Prisma.transactionsOrderByWithRelationInput | Prisma.transactionsOrderByWithRelationInput[];
    cursor?: Prisma.transactionsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.TransactionsScalarFieldEnum | Prisma.TransactionsScalarFieldEnum[];
};
export type walletsDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.walletsSelect<ExtArgs> | null;
    omit?: Prisma.walletsOmit<ExtArgs> | null;
    include?: Prisma.walletsInclude<ExtArgs> | null;
};
export {};
