import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type transactionsModel = runtime.Types.Result.DefaultSelection<Prisma.$transactionsPayload>;
export type AggregateTransactions = {
    _count: TransactionsCountAggregateOutputType | null;
    _avg: TransactionsAvgAggregateOutputType | null;
    _sum: TransactionsSumAggregateOutputType | null;
    _min: TransactionsMinAggregateOutputType | null;
    _max: TransactionsMaxAggregateOutputType | null;
};
export type TransactionsAvgAggregateOutputType = {
    amount: runtime.Decimal | null;
};
export type TransactionsSumAggregateOutputType = {
    amount: runtime.Decimal | null;
};
export type TransactionsMinAggregateOutputType = {
    id: string | null;
    wallet_id: string | null;
    amount: runtime.Decimal | null;
    type: string | null;
    description: string | null;
    provider_transaction_id: string | null;
    created_at: Date | null;
};
export type TransactionsMaxAggregateOutputType = {
    id: string | null;
    wallet_id: string | null;
    amount: runtime.Decimal | null;
    type: string | null;
    description: string | null;
    provider_transaction_id: string | null;
    created_at: Date | null;
};
export type TransactionsCountAggregateOutputType = {
    id: number;
    wallet_id: number;
    amount: number;
    type: number;
    description: number;
    provider_transaction_id: number;
    created_at: number;
    _all: number;
};
export type TransactionsAvgAggregateInputType = {
    amount?: true;
};
export type TransactionsSumAggregateInputType = {
    amount?: true;
};
export type TransactionsMinAggregateInputType = {
    id?: true;
    wallet_id?: true;
    amount?: true;
    type?: true;
    description?: true;
    provider_transaction_id?: true;
    created_at?: true;
};
export type TransactionsMaxAggregateInputType = {
    id?: true;
    wallet_id?: true;
    amount?: true;
    type?: true;
    description?: true;
    provider_transaction_id?: true;
    created_at?: true;
};
export type TransactionsCountAggregateInputType = {
    id?: true;
    wallet_id?: true;
    amount?: true;
    type?: true;
    description?: true;
    provider_transaction_id?: true;
    created_at?: true;
    _all?: true;
};
export type TransactionsAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.transactionsWhereInput;
    orderBy?: Prisma.transactionsOrderByWithRelationInput | Prisma.transactionsOrderByWithRelationInput[];
    cursor?: Prisma.transactionsWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | TransactionsCountAggregateInputType;
    _avg?: TransactionsAvgAggregateInputType;
    _sum?: TransactionsSumAggregateInputType;
    _min?: TransactionsMinAggregateInputType;
    _max?: TransactionsMaxAggregateInputType;
};
export type GetTransactionsAggregateType<T extends TransactionsAggregateArgs> = {
    [P in keyof T & keyof AggregateTransactions]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateTransactions[P]> : Prisma.GetScalarType<T[P], AggregateTransactions[P]>;
};
export type transactionsGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.transactionsWhereInput;
    orderBy?: Prisma.transactionsOrderByWithAggregationInput | Prisma.transactionsOrderByWithAggregationInput[];
    by: Prisma.TransactionsScalarFieldEnum[] | Prisma.TransactionsScalarFieldEnum;
    having?: Prisma.transactionsScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: TransactionsCountAggregateInputType | true;
    _avg?: TransactionsAvgAggregateInputType;
    _sum?: TransactionsSumAggregateInputType;
    _min?: TransactionsMinAggregateInputType;
    _max?: TransactionsMaxAggregateInputType;
};
export type TransactionsGroupByOutputType = {
    id: string;
    wallet_id: string;
    amount: runtime.Decimal;
    type: string;
    description: string;
    provider_transaction_id: string | null;
    created_at: Date;
    _count: TransactionsCountAggregateOutputType | null;
    _avg: TransactionsAvgAggregateOutputType | null;
    _sum: TransactionsSumAggregateOutputType | null;
    _min: TransactionsMinAggregateOutputType | null;
    _max: TransactionsMaxAggregateOutputType | null;
};
type GetTransactionsGroupByPayload<T extends transactionsGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<TransactionsGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof TransactionsGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], TransactionsGroupByOutputType[P]> : Prisma.GetScalarType<T[P], TransactionsGroupByOutputType[P]>;
}>>;
export type transactionsWhereInput = {
    AND?: Prisma.transactionsWhereInput | Prisma.transactionsWhereInput[];
    OR?: Prisma.transactionsWhereInput[];
    NOT?: Prisma.transactionsWhereInput | Prisma.transactionsWhereInput[];
    id?: Prisma.StringFilter<"transactions"> | string;
    wallet_id?: Prisma.StringFilter<"transactions"> | string;
    amount?: Prisma.DecimalFilter<"transactions"> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    type?: Prisma.StringFilter<"transactions"> | string;
    description?: Prisma.StringFilter<"transactions"> | string;
    provider_transaction_id?: Prisma.StringNullableFilter<"transactions"> | string | null;
    created_at?: Prisma.DateTimeFilter<"transactions"> | Date | string;
    wallets?: Prisma.XOR<Prisma.WalletsScalarRelationFilter, Prisma.walletsWhereInput>;
};
export type transactionsOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    wallet_id?: Prisma.SortOrder;
    amount?: Prisma.SortOrder;
    type?: Prisma.SortOrder;
    description?: Prisma.SortOrder;
    provider_transaction_id?: Prisma.SortOrderInput | Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    wallets?: Prisma.walletsOrderByWithRelationInput;
    _relevance?: Prisma.transactionsOrderByRelevanceInput;
};
export type transactionsWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    AND?: Prisma.transactionsWhereInput | Prisma.transactionsWhereInput[];
    OR?: Prisma.transactionsWhereInput[];
    NOT?: Prisma.transactionsWhereInput | Prisma.transactionsWhereInput[];
    wallet_id?: Prisma.StringFilter<"transactions"> | string;
    amount?: Prisma.DecimalFilter<"transactions"> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    type?: Prisma.StringFilter<"transactions"> | string;
    description?: Prisma.StringFilter<"transactions"> | string;
    provider_transaction_id?: Prisma.StringNullableFilter<"transactions"> | string | null;
    created_at?: Prisma.DateTimeFilter<"transactions"> | Date | string;
    wallets?: Prisma.XOR<Prisma.WalletsScalarRelationFilter, Prisma.walletsWhereInput>;
}, "id">;
export type transactionsOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    wallet_id?: Prisma.SortOrder;
    amount?: Prisma.SortOrder;
    type?: Prisma.SortOrder;
    description?: Prisma.SortOrder;
    provider_transaction_id?: Prisma.SortOrderInput | Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    _count?: Prisma.transactionsCountOrderByAggregateInput;
    _avg?: Prisma.transactionsAvgOrderByAggregateInput;
    _max?: Prisma.transactionsMaxOrderByAggregateInput;
    _min?: Prisma.transactionsMinOrderByAggregateInput;
    _sum?: Prisma.transactionsSumOrderByAggregateInput;
};
export type transactionsScalarWhereWithAggregatesInput = {
    AND?: Prisma.transactionsScalarWhereWithAggregatesInput | Prisma.transactionsScalarWhereWithAggregatesInput[];
    OR?: Prisma.transactionsScalarWhereWithAggregatesInput[];
    NOT?: Prisma.transactionsScalarWhereWithAggregatesInput | Prisma.transactionsScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"transactions"> | string;
    wallet_id?: Prisma.StringWithAggregatesFilter<"transactions"> | string;
    amount?: Prisma.DecimalWithAggregatesFilter<"transactions"> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    type?: Prisma.StringWithAggregatesFilter<"transactions"> | string;
    description?: Prisma.StringWithAggregatesFilter<"transactions"> | string;
    provider_transaction_id?: Prisma.StringNullableWithAggregatesFilter<"transactions"> | string | null;
    created_at?: Prisma.DateTimeWithAggregatesFilter<"transactions"> | Date | string;
};
export type transactionsCreateInput = {
    id?: string;
    amount: runtime.Decimal | runtime.DecimalJsLike | number | string;
    type: string;
    description: string;
    provider_transaction_id?: string | null;
    created_at?: Date | string;
    wallets: Prisma.walletsCreateNestedOneWithoutTransactionsInput;
};
export type transactionsUncheckedCreateInput = {
    id?: string;
    wallet_id: string;
    amount: runtime.Decimal | runtime.DecimalJsLike | number | string;
    type: string;
    description: string;
    provider_transaction_id?: string | null;
    created_at?: Date | string;
};
export type transactionsUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    amount?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    type?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.StringFieldUpdateOperationsInput | string;
    provider_transaction_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    wallets?: Prisma.walletsUpdateOneRequiredWithoutTransactionsNestedInput;
};
export type transactionsUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    wallet_id?: Prisma.StringFieldUpdateOperationsInput | string;
    amount?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    type?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.StringFieldUpdateOperationsInput | string;
    provider_transaction_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type transactionsCreateManyInput = {
    id?: string;
    wallet_id: string;
    amount: runtime.Decimal | runtime.DecimalJsLike | number | string;
    type: string;
    description: string;
    provider_transaction_id?: string | null;
    created_at?: Date | string;
};
export type transactionsUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    amount?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    type?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.StringFieldUpdateOperationsInput | string;
    provider_transaction_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type transactionsUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    wallet_id?: Prisma.StringFieldUpdateOperationsInput | string;
    amount?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    type?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.StringFieldUpdateOperationsInput | string;
    provider_transaction_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type transactionsOrderByRelevanceInput = {
    fields: Prisma.transactionsOrderByRelevanceFieldEnum | Prisma.transactionsOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type transactionsCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    wallet_id?: Prisma.SortOrder;
    amount?: Prisma.SortOrder;
    type?: Prisma.SortOrder;
    description?: Prisma.SortOrder;
    provider_transaction_id?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
};
export type transactionsAvgOrderByAggregateInput = {
    amount?: Prisma.SortOrder;
};
export type transactionsMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    wallet_id?: Prisma.SortOrder;
    amount?: Prisma.SortOrder;
    type?: Prisma.SortOrder;
    description?: Prisma.SortOrder;
    provider_transaction_id?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
};
export type transactionsMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    wallet_id?: Prisma.SortOrder;
    amount?: Prisma.SortOrder;
    type?: Prisma.SortOrder;
    description?: Prisma.SortOrder;
    provider_transaction_id?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
};
export type transactionsSumOrderByAggregateInput = {
    amount?: Prisma.SortOrder;
};
export type TransactionsListRelationFilter = {
    every?: Prisma.transactionsWhereInput;
    some?: Prisma.transactionsWhereInput;
    none?: Prisma.transactionsWhereInput;
};
export type transactionsOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type DecimalFieldUpdateOperationsInput = {
    set?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    increment?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    decrement?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    multiply?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    divide?: runtime.Decimal | runtime.DecimalJsLike | number | string;
};
export type transactionsCreateNestedManyWithoutWalletsInput = {
    create?: Prisma.XOR<Prisma.transactionsCreateWithoutWalletsInput, Prisma.transactionsUncheckedCreateWithoutWalletsInput> | Prisma.transactionsCreateWithoutWalletsInput[] | Prisma.transactionsUncheckedCreateWithoutWalletsInput[];
    connectOrCreate?: Prisma.transactionsCreateOrConnectWithoutWalletsInput | Prisma.transactionsCreateOrConnectWithoutWalletsInput[];
    createMany?: Prisma.transactionsCreateManyWalletsInputEnvelope;
    connect?: Prisma.transactionsWhereUniqueInput | Prisma.transactionsWhereUniqueInput[];
};
export type transactionsUncheckedCreateNestedManyWithoutWalletsInput = {
    create?: Prisma.XOR<Prisma.transactionsCreateWithoutWalletsInput, Prisma.transactionsUncheckedCreateWithoutWalletsInput> | Prisma.transactionsCreateWithoutWalletsInput[] | Prisma.transactionsUncheckedCreateWithoutWalletsInput[];
    connectOrCreate?: Prisma.transactionsCreateOrConnectWithoutWalletsInput | Prisma.transactionsCreateOrConnectWithoutWalletsInput[];
    createMany?: Prisma.transactionsCreateManyWalletsInputEnvelope;
    connect?: Prisma.transactionsWhereUniqueInput | Prisma.transactionsWhereUniqueInput[];
};
export type transactionsUpdateManyWithoutWalletsNestedInput = {
    create?: Prisma.XOR<Prisma.transactionsCreateWithoutWalletsInput, Prisma.transactionsUncheckedCreateWithoutWalletsInput> | Prisma.transactionsCreateWithoutWalletsInput[] | Prisma.transactionsUncheckedCreateWithoutWalletsInput[];
    connectOrCreate?: Prisma.transactionsCreateOrConnectWithoutWalletsInput | Prisma.transactionsCreateOrConnectWithoutWalletsInput[];
    upsert?: Prisma.transactionsUpsertWithWhereUniqueWithoutWalletsInput | Prisma.transactionsUpsertWithWhereUniqueWithoutWalletsInput[];
    createMany?: Prisma.transactionsCreateManyWalletsInputEnvelope;
    set?: Prisma.transactionsWhereUniqueInput | Prisma.transactionsWhereUniqueInput[];
    disconnect?: Prisma.transactionsWhereUniqueInput | Prisma.transactionsWhereUniqueInput[];
    delete?: Prisma.transactionsWhereUniqueInput | Prisma.transactionsWhereUniqueInput[];
    connect?: Prisma.transactionsWhereUniqueInput | Prisma.transactionsWhereUniqueInput[];
    update?: Prisma.transactionsUpdateWithWhereUniqueWithoutWalletsInput | Prisma.transactionsUpdateWithWhereUniqueWithoutWalletsInput[];
    updateMany?: Prisma.transactionsUpdateManyWithWhereWithoutWalletsInput | Prisma.transactionsUpdateManyWithWhereWithoutWalletsInput[];
    deleteMany?: Prisma.transactionsScalarWhereInput | Prisma.transactionsScalarWhereInput[];
};
export type transactionsUncheckedUpdateManyWithoutWalletsNestedInput = {
    create?: Prisma.XOR<Prisma.transactionsCreateWithoutWalletsInput, Prisma.transactionsUncheckedCreateWithoutWalletsInput> | Prisma.transactionsCreateWithoutWalletsInput[] | Prisma.transactionsUncheckedCreateWithoutWalletsInput[];
    connectOrCreate?: Prisma.transactionsCreateOrConnectWithoutWalletsInput | Prisma.transactionsCreateOrConnectWithoutWalletsInput[];
    upsert?: Prisma.transactionsUpsertWithWhereUniqueWithoutWalletsInput | Prisma.transactionsUpsertWithWhereUniqueWithoutWalletsInput[];
    createMany?: Prisma.transactionsCreateManyWalletsInputEnvelope;
    set?: Prisma.transactionsWhereUniqueInput | Prisma.transactionsWhereUniqueInput[];
    disconnect?: Prisma.transactionsWhereUniqueInput | Prisma.transactionsWhereUniqueInput[];
    delete?: Prisma.transactionsWhereUniqueInput | Prisma.transactionsWhereUniqueInput[];
    connect?: Prisma.transactionsWhereUniqueInput | Prisma.transactionsWhereUniqueInput[];
    update?: Prisma.transactionsUpdateWithWhereUniqueWithoutWalletsInput | Prisma.transactionsUpdateWithWhereUniqueWithoutWalletsInput[];
    updateMany?: Prisma.transactionsUpdateManyWithWhereWithoutWalletsInput | Prisma.transactionsUpdateManyWithWhereWithoutWalletsInput[];
    deleteMany?: Prisma.transactionsScalarWhereInput | Prisma.transactionsScalarWhereInput[];
};
export type transactionsCreateWithoutWalletsInput = {
    id?: string;
    amount: runtime.Decimal | runtime.DecimalJsLike | number | string;
    type: string;
    description: string;
    provider_transaction_id?: string | null;
    created_at?: Date | string;
};
export type transactionsUncheckedCreateWithoutWalletsInput = {
    id?: string;
    amount: runtime.Decimal | runtime.DecimalJsLike | number | string;
    type: string;
    description: string;
    provider_transaction_id?: string | null;
    created_at?: Date | string;
};
export type transactionsCreateOrConnectWithoutWalletsInput = {
    where: Prisma.transactionsWhereUniqueInput;
    create: Prisma.XOR<Prisma.transactionsCreateWithoutWalletsInput, Prisma.transactionsUncheckedCreateWithoutWalletsInput>;
};
export type transactionsCreateManyWalletsInputEnvelope = {
    data: Prisma.transactionsCreateManyWalletsInput | Prisma.transactionsCreateManyWalletsInput[];
    skipDuplicates?: boolean;
};
export type transactionsUpsertWithWhereUniqueWithoutWalletsInput = {
    where: Prisma.transactionsWhereUniqueInput;
    update: Prisma.XOR<Prisma.transactionsUpdateWithoutWalletsInput, Prisma.transactionsUncheckedUpdateWithoutWalletsInput>;
    create: Prisma.XOR<Prisma.transactionsCreateWithoutWalletsInput, Prisma.transactionsUncheckedCreateWithoutWalletsInput>;
};
export type transactionsUpdateWithWhereUniqueWithoutWalletsInput = {
    where: Prisma.transactionsWhereUniqueInput;
    data: Prisma.XOR<Prisma.transactionsUpdateWithoutWalletsInput, Prisma.transactionsUncheckedUpdateWithoutWalletsInput>;
};
export type transactionsUpdateManyWithWhereWithoutWalletsInput = {
    where: Prisma.transactionsScalarWhereInput;
    data: Prisma.XOR<Prisma.transactionsUpdateManyMutationInput, Prisma.transactionsUncheckedUpdateManyWithoutWalletsInput>;
};
export type transactionsScalarWhereInput = {
    AND?: Prisma.transactionsScalarWhereInput | Prisma.transactionsScalarWhereInput[];
    OR?: Prisma.transactionsScalarWhereInput[];
    NOT?: Prisma.transactionsScalarWhereInput | Prisma.transactionsScalarWhereInput[];
    id?: Prisma.StringFilter<"transactions"> | string;
    wallet_id?: Prisma.StringFilter<"transactions"> | string;
    amount?: Prisma.DecimalFilter<"transactions"> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    type?: Prisma.StringFilter<"transactions"> | string;
    description?: Prisma.StringFilter<"transactions"> | string;
    provider_transaction_id?: Prisma.StringNullableFilter<"transactions"> | string | null;
    created_at?: Prisma.DateTimeFilter<"transactions"> | Date | string;
};
export type transactionsCreateManyWalletsInput = {
    id?: string;
    amount: runtime.Decimal | runtime.DecimalJsLike | number | string;
    type: string;
    description: string;
    provider_transaction_id?: string | null;
    created_at?: Date | string;
};
export type transactionsUpdateWithoutWalletsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    amount?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    type?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.StringFieldUpdateOperationsInput | string;
    provider_transaction_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type transactionsUncheckedUpdateWithoutWalletsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    amount?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    type?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.StringFieldUpdateOperationsInput | string;
    provider_transaction_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type transactionsUncheckedUpdateManyWithoutWalletsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    amount?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    type?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.StringFieldUpdateOperationsInput | string;
    provider_transaction_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type transactionsSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    wallet_id?: boolean;
    amount?: boolean;
    type?: boolean;
    description?: boolean;
    provider_transaction_id?: boolean;
    created_at?: boolean;
    wallets?: boolean | Prisma.walletsDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["transactions"]>;
export type transactionsSelectScalar = {
    id?: boolean;
    wallet_id?: boolean;
    amount?: boolean;
    type?: boolean;
    description?: boolean;
    provider_transaction_id?: boolean;
    created_at?: boolean;
};
export type transactionsOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "wallet_id" | "amount" | "type" | "description" | "provider_transaction_id" | "created_at", ExtArgs["result"]["transactions"]>;
export type transactionsInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    wallets?: boolean | Prisma.walletsDefaultArgs<ExtArgs>;
};
export type $transactionsPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "transactions";
    objects: {
        wallets: Prisma.$walletsPayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        wallet_id: string;
        amount: runtime.Decimal;
        type: string;
        description: string;
        provider_transaction_id: string | null;
        created_at: Date;
    }, ExtArgs["result"]["transactions"]>;
    composites: {};
};
export type transactionsGetPayload<S extends boolean | null | undefined | transactionsDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$transactionsPayload, S>;
export type transactionsCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<transactionsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: TransactionsCountAggregateInputType | true;
};
export interface transactionsDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['transactions'];
        meta: {
            name: 'transactions';
        };
    };
    findUnique<T extends transactionsFindUniqueArgs>(args: Prisma.SelectSubset<T, transactionsFindUniqueArgs<ExtArgs>>): Prisma.Prisma__transactionsClient<runtime.Types.Result.GetResult<Prisma.$transactionsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends transactionsFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, transactionsFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__transactionsClient<runtime.Types.Result.GetResult<Prisma.$transactionsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends transactionsFindFirstArgs>(args?: Prisma.SelectSubset<T, transactionsFindFirstArgs<ExtArgs>>): Prisma.Prisma__transactionsClient<runtime.Types.Result.GetResult<Prisma.$transactionsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends transactionsFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, transactionsFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__transactionsClient<runtime.Types.Result.GetResult<Prisma.$transactionsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends transactionsFindManyArgs>(args?: Prisma.SelectSubset<T, transactionsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$transactionsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends transactionsCreateArgs>(args: Prisma.SelectSubset<T, transactionsCreateArgs<ExtArgs>>): Prisma.Prisma__transactionsClient<runtime.Types.Result.GetResult<Prisma.$transactionsPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends transactionsCreateManyArgs>(args?: Prisma.SelectSubset<T, transactionsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends transactionsDeleteArgs>(args: Prisma.SelectSubset<T, transactionsDeleteArgs<ExtArgs>>): Prisma.Prisma__transactionsClient<runtime.Types.Result.GetResult<Prisma.$transactionsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends transactionsUpdateArgs>(args: Prisma.SelectSubset<T, transactionsUpdateArgs<ExtArgs>>): Prisma.Prisma__transactionsClient<runtime.Types.Result.GetResult<Prisma.$transactionsPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends transactionsDeleteManyArgs>(args?: Prisma.SelectSubset<T, transactionsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends transactionsUpdateManyArgs>(args: Prisma.SelectSubset<T, transactionsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends transactionsUpsertArgs>(args: Prisma.SelectSubset<T, transactionsUpsertArgs<ExtArgs>>): Prisma.Prisma__transactionsClient<runtime.Types.Result.GetResult<Prisma.$transactionsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends transactionsCountArgs>(args?: Prisma.Subset<T, transactionsCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], TransactionsCountAggregateOutputType> : number>;
    aggregate<T extends TransactionsAggregateArgs>(args: Prisma.Subset<T, TransactionsAggregateArgs>): Prisma.PrismaPromise<GetTransactionsAggregateType<T>>;
    groupBy<T extends transactionsGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: transactionsGroupByArgs['orderBy'];
    } : {
        orderBy?: transactionsGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, transactionsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTransactionsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: transactionsFieldRefs;
}
export interface Prisma__transactionsClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    wallets<T extends Prisma.walletsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.walletsDefaultArgs<ExtArgs>>): Prisma.Prisma__walletsClient<runtime.Types.Result.GetResult<Prisma.$walletsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface transactionsFieldRefs {
    readonly id: Prisma.FieldRef<"transactions", 'String'>;
    readonly wallet_id: Prisma.FieldRef<"transactions", 'String'>;
    readonly amount: Prisma.FieldRef<"transactions", 'Decimal'>;
    readonly type: Prisma.FieldRef<"transactions", 'String'>;
    readonly description: Prisma.FieldRef<"transactions", 'String'>;
    readonly provider_transaction_id: Prisma.FieldRef<"transactions", 'String'>;
    readonly created_at: Prisma.FieldRef<"transactions", 'DateTime'>;
}
export type transactionsFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.transactionsSelect<ExtArgs> | null;
    omit?: Prisma.transactionsOmit<ExtArgs> | null;
    include?: Prisma.transactionsInclude<ExtArgs> | null;
    where: Prisma.transactionsWhereUniqueInput;
};
export type transactionsFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.transactionsSelect<ExtArgs> | null;
    omit?: Prisma.transactionsOmit<ExtArgs> | null;
    include?: Prisma.transactionsInclude<ExtArgs> | null;
    where: Prisma.transactionsWhereUniqueInput;
};
export type transactionsFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type transactionsFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type transactionsFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type transactionsCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.transactionsSelect<ExtArgs> | null;
    omit?: Prisma.transactionsOmit<ExtArgs> | null;
    include?: Prisma.transactionsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.transactionsCreateInput, Prisma.transactionsUncheckedCreateInput>;
};
export type transactionsCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.transactionsCreateManyInput | Prisma.transactionsCreateManyInput[];
    skipDuplicates?: boolean;
};
export type transactionsUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.transactionsSelect<ExtArgs> | null;
    omit?: Prisma.transactionsOmit<ExtArgs> | null;
    include?: Prisma.transactionsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.transactionsUpdateInput, Prisma.transactionsUncheckedUpdateInput>;
    where: Prisma.transactionsWhereUniqueInput;
};
export type transactionsUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.transactionsUpdateManyMutationInput, Prisma.transactionsUncheckedUpdateManyInput>;
    where?: Prisma.transactionsWhereInput;
    limit?: number;
};
export type transactionsUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.transactionsSelect<ExtArgs> | null;
    omit?: Prisma.transactionsOmit<ExtArgs> | null;
    include?: Prisma.transactionsInclude<ExtArgs> | null;
    where: Prisma.transactionsWhereUniqueInput;
    create: Prisma.XOR<Prisma.transactionsCreateInput, Prisma.transactionsUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.transactionsUpdateInput, Prisma.transactionsUncheckedUpdateInput>;
};
export type transactionsDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.transactionsSelect<ExtArgs> | null;
    omit?: Prisma.transactionsOmit<ExtArgs> | null;
    include?: Prisma.transactionsInclude<ExtArgs> | null;
    where: Prisma.transactionsWhereUniqueInput;
};
export type transactionsDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.transactionsWhereInput;
    limit?: number;
};
export type transactionsDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.transactionsSelect<ExtArgs> | null;
    omit?: Prisma.transactionsOmit<ExtArgs> | null;
    include?: Prisma.transactionsInclude<ExtArgs> | null;
};
export {};
