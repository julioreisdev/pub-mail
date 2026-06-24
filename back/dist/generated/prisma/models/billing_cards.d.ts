import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type billing_cardsModel = runtime.Types.Result.DefaultSelection<Prisma.$billing_cardsPayload>;
export type AggregateBilling_cards = {
    _count: Billing_cardsCountAggregateOutputType | null;
    _min: Billing_cardsMinAggregateOutputType | null;
    _max: Billing_cardsMaxAggregateOutputType | null;
};
export type Billing_cardsMinAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    provider_token: string | null;
    last_four_digits: string | null;
    brand: string | null;
    holder_name: string | null;
    is_default: boolean | null;
};
export type Billing_cardsMaxAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    provider_token: string | null;
    last_four_digits: string | null;
    brand: string | null;
    holder_name: string | null;
    is_default: boolean | null;
};
export type Billing_cardsCountAggregateOutputType = {
    id: number;
    organization_id: number;
    provider_token: number;
    last_four_digits: number;
    brand: number;
    holder_name: number;
    is_default: number;
    _all: number;
};
export type Billing_cardsMinAggregateInputType = {
    id?: true;
    organization_id?: true;
    provider_token?: true;
    last_four_digits?: true;
    brand?: true;
    holder_name?: true;
    is_default?: true;
};
export type Billing_cardsMaxAggregateInputType = {
    id?: true;
    organization_id?: true;
    provider_token?: true;
    last_four_digits?: true;
    brand?: true;
    holder_name?: true;
    is_default?: true;
};
export type Billing_cardsCountAggregateInputType = {
    id?: true;
    organization_id?: true;
    provider_token?: true;
    last_four_digits?: true;
    brand?: true;
    holder_name?: true;
    is_default?: true;
    _all?: true;
};
export type Billing_cardsAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.billing_cardsWhereInput;
    orderBy?: Prisma.billing_cardsOrderByWithRelationInput | Prisma.billing_cardsOrderByWithRelationInput[];
    cursor?: Prisma.billing_cardsWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | Billing_cardsCountAggregateInputType;
    _min?: Billing_cardsMinAggregateInputType;
    _max?: Billing_cardsMaxAggregateInputType;
};
export type GetBilling_cardsAggregateType<T extends Billing_cardsAggregateArgs> = {
    [P in keyof T & keyof AggregateBilling_cards]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateBilling_cards[P]> : Prisma.GetScalarType<T[P], AggregateBilling_cards[P]>;
};
export type billing_cardsGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.billing_cardsWhereInput;
    orderBy?: Prisma.billing_cardsOrderByWithAggregationInput | Prisma.billing_cardsOrderByWithAggregationInput[];
    by: Prisma.Billing_cardsScalarFieldEnum[] | Prisma.Billing_cardsScalarFieldEnum;
    having?: Prisma.billing_cardsScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: Billing_cardsCountAggregateInputType | true;
    _min?: Billing_cardsMinAggregateInputType;
    _max?: Billing_cardsMaxAggregateInputType;
};
export type Billing_cardsGroupByOutputType = {
    id: string;
    organization_id: string;
    provider_token: string;
    last_four_digits: string | null;
    brand: string | null;
    holder_name: string;
    is_default: boolean;
    _count: Billing_cardsCountAggregateOutputType | null;
    _min: Billing_cardsMinAggregateOutputType | null;
    _max: Billing_cardsMaxAggregateOutputType | null;
};
type GetBilling_cardsGroupByPayload<T extends billing_cardsGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<Billing_cardsGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof Billing_cardsGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], Billing_cardsGroupByOutputType[P]> : Prisma.GetScalarType<T[P], Billing_cardsGroupByOutputType[P]>;
}>>;
export type billing_cardsWhereInput = {
    AND?: Prisma.billing_cardsWhereInput | Prisma.billing_cardsWhereInput[];
    OR?: Prisma.billing_cardsWhereInput[];
    NOT?: Prisma.billing_cardsWhereInput | Prisma.billing_cardsWhereInput[];
    id?: Prisma.StringFilter<"billing_cards"> | string;
    organization_id?: Prisma.StringFilter<"billing_cards"> | string;
    provider_token?: Prisma.StringFilter<"billing_cards"> | string;
    last_four_digits?: Prisma.StringNullableFilter<"billing_cards"> | string | null;
    brand?: Prisma.StringNullableFilter<"billing_cards"> | string | null;
    holder_name?: Prisma.StringFilter<"billing_cards"> | string;
    is_default?: Prisma.BoolFilter<"billing_cards"> | boolean;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
};
export type billing_cardsOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    provider_token?: Prisma.SortOrder;
    last_four_digits?: Prisma.SortOrderInput | Prisma.SortOrder;
    brand?: Prisma.SortOrderInput | Prisma.SortOrder;
    holder_name?: Prisma.SortOrder;
    is_default?: Prisma.SortOrder;
    organizations?: Prisma.organizationsOrderByWithRelationInput;
    _relevance?: Prisma.billing_cardsOrderByRelevanceInput;
};
export type billing_cardsWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    AND?: Prisma.billing_cardsWhereInput | Prisma.billing_cardsWhereInput[];
    OR?: Prisma.billing_cardsWhereInput[];
    NOT?: Prisma.billing_cardsWhereInput | Prisma.billing_cardsWhereInput[];
    organization_id?: Prisma.StringFilter<"billing_cards"> | string;
    provider_token?: Prisma.StringFilter<"billing_cards"> | string;
    last_four_digits?: Prisma.StringNullableFilter<"billing_cards"> | string | null;
    brand?: Prisma.StringNullableFilter<"billing_cards"> | string | null;
    holder_name?: Prisma.StringFilter<"billing_cards"> | string;
    is_default?: Prisma.BoolFilter<"billing_cards"> | boolean;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
}, "id">;
export type billing_cardsOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    provider_token?: Prisma.SortOrder;
    last_four_digits?: Prisma.SortOrderInput | Prisma.SortOrder;
    brand?: Prisma.SortOrderInput | Prisma.SortOrder;
    holder_name?: Prisma.SortOrder;
    is_default?: Prisma.SortOrder;
    _count?: Prisma.billing_cardsCountOrderByAggregateInput;
    _max?: Prisma.billing_cardsMaxOrderByAggregateInput;
    _min?: Prisma.billing_cardsMinOrderByAggregateInput;
};
export type billing_cardsScalarWhereWithAggregatesInput = {
    AND?: Prisma.billing_cardsScalarWhereWithAggregatesInput | Prisma.billing_cardsScalarWhereWithAggregatesInput[];
    OR?: Prisma.billing_cardsScalarWhereWithAggregatesInput[];
    NOT?: Prisma.billing_cardsScalarWhereWithAggregatesInput | Prisma.billing_cardsScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"billing_cards"> | string;
    organization_id?: Prisma.StringWithAggregatesFilter<"billing_cards"> | string;
    provider_token?: Prisma.StringWithAggregatesFilter<"billing_cards"> | string;
    last_four_digits?: Prisma.StringNullableWithAggregatesFilter<"billing_cards"> | string | null;
    brand?: Prisma.StringNullableWithAggregatesFilter<"billing_cards"> | string | null;
    holder_name?: Prisma.StringWithAggregatesFilter<"billing_cards"> | string;
    is_default?: Prisma.BoolWithAggregatesFilter<"billing_cards"> | boolean;
};
export type billing_cardsCreateInput = {
    id?: string;
    provider_token: string;
    last_four_digits?: string | null;
    brand?: string | null;
    holder_name: string;
    is_default: boolean;
    organizations: Prisma.organizationsCreateNestedOneWithoutBilling_cardsInput;
};
export type billing_cardsUncheckedCreateInput = {
    id?: string;
    organization_id: string;
    provider_token: string;
    last_four_digits?: string | null;
    brand?: string | null;
    holder_name: string;
    is_default: boolean;
};
export type billing_cardsUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    provider_token?: Prisma.StringFieldUpdateOperationsInput | string;
    last_four_digits?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    brand?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    holder_name?: Prisma.StringFieldUpdateOperationsInput | string;
    is_default?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutBilling_cardsNestedInput;
};
export type billing_cardsUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    provider_token?: Prisma.StringFieldUpdateOperationsInput | string;
    last_four_digits?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    brand?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    holder_name?: Prisma.StringFieldUpdateOperationsInput | string;
    is_default?: Prisma.BoolFieldUpdateOperationsInput | boolean;
};
export type billing_cardsCreateManyInput = {
    id?: string;
    organization_id: string;
    provider_token: string;
    last_four_digits?: string | null;
    brand?: string | null;
    holder_name: string;
    is_default: boolean;
};
export type billing_cardsUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    provider_token?: Prisma.StringFieldUpdateOperationsInput | string;
    last_four_digits?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    brand?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    holder_name?: Prisma.StringFieldUpdateOperationsInput | string;
    is_default?: Prisma.BoolFieldUpdateOperationsInput | boolean;
};
export type billing_cardsUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    provider_token?: Prisma.StringFieldUpdateOperationsInput | string;
    last_four_digits?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    brand?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    holder_name?: Prisma.StringFieldUpdateOperationsInput | string;
    is_default?: Prisma.BoolFieldUpdateOperationsInput | boolean;
};
export type billing_cardsOrderByRelevanceInput = {
    fields: Prisma.billing_cardsOrderByRelevanceFieldEnum | Prisma.billing_cardsOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type billing_cardsCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    provider_token?: Prisma.SortOrder;
    last_four_digits?: Prisma.SortOrder;
    brand?: Prisma.SortOrder;
    holder_name?: Prisma.SortOrder;
    is_default?: Prisma.SortOrder;
};
export type billing_cardsMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    provider_token?: Prisma.SortOrder;
    last_four_digits?: Prisma.SortOrder;
    brand?: Prisma.SortOrder;
    holder_name?: Prisma.SortOrder;
    is_default?: Prisma.SortOrder;
};
export type billing_cardsMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    provider_token?: Prisma.SortOrder;
    last_four_digits?: Prisma.SortOrder;
    brand?: Prisma.SortOrder;
    holder_name?: Prisma.SortOrder;
    is_default?: Prisma.SortOrder;
};
export type Billing_cardsListRelationFilter = {
    every?: Prisma.billing_cardsWhereInput;
    some?: Prisma.billing_cardsWhereInput;
    none?: Prisma.billing_cardsWhereInput;
};
export type billing_cardsOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type StringFieldUpdateOperationsInput = {
    set?: string;
};
export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null;
};
export type BoolFieldUpdateOperationsInput = {
    set?: boolean;
};
export type billing_cardsCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.billing_cardsCreateWithoutOrganizationsInput, Prisma.billing_cardsUncheckedCreateWithoutOrganizationsInput> | Prisma.billing_cardsCreateWithoutOrganizationsInput[] | Prisma.billing_cardsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.billing_cardsCreateOrConnectWithoutOrganizationsInput | Prisma.billing_cardsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.billing_cardsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.billing_cardsWhereUniqueInput | Prisma.billing_cardsWhereUniqueInput[];
};
export type billing_cardsUncheckedCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.billing_cardsCreateWithoutOrganizationsInput, Prisma.billing_cardsUncheckedCreateWithoutOrganizationsInput> | Prisma.billing_cardsCreateWithoutOrganizationsInput[] | Prisma.billing_cardsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.billing_cardsCreateOrConnectWithoutOrganizationsInput | Prisma.billing_cardsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.billing_cardsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.billing_cardsWhereUniqueInput | Prisma.billing_cardsWhereUniqueInput[];
};
export type billing_cardsUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.billing_cardsCreateWithoutOrganizationsInput, Prisma.billing_cardsUncheckedCreateWithoutOrganizationsInput> | Prisma.billing_cardsCreateWithoutOrganizationsInput[] | Prisma.billing_cardsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.billing_cardsCreateOrConnectWithoutOrganizationsInput | Prisma.billing_cardsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.billing_cardsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.billing_cardsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.billing_cardsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.billing_cardsWhereUniqueInput | Prisma.billing_cardsWhereUniqueInput[];
    disconnect?: Prisma.billing_cardsWhereUniqueInput | Prisma.billing_cardsWhereUniqueInput[];
    delete?: Prisma.billing_cardsWhereUniqueInput | Prisma.billing_cardsWhereUniqueInput[];
    connect?: Prisma.billing_cardsWhereUniqueInput | Prisma.billing_cardsWhereUniqueInput[];
    update?: Prisma.billing_cardsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.billing_cardsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.billing_cardsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.billing_cardsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.billing_cardsScalarWhereInput | Prisma.billing_cardsScalarWhereInput[];
};
export type billing_cardsUncheckedUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.billing_cardsCreateWithoutOrganizationsInput, Prisma.billing_cardsUncheckedCreateWithoutOrganizationsInput> | Prisma.billing_cardsCreateWithoutOrganizationsInput[] | Prisma.billing_cardsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.billing_cardsCreateOrConnectWithoutOrganizationsInput | Prisma.billing_cardsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.billing_cardsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.billing_cardsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.billing_cardsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.billing_cardsWhereUniqueInput | Prisma.billing_cardsWhereUniqueInput[];
    disconnect?: Prisma.billing_cardsWhereUniqueInput | Prisma.billing_cardsWhereUniqueInput[];
    delete?: Prisma.billing_cardsWhereUniqueInput | Prisma.billing_cardsWhereUniqueInput[];
    connect?: Prisma.billing_cardsWhereUniqueInput | Prisma.billing_cardsWhereUniqueInput[];
    update?: Prisma.billing_cardsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.billing_cardsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.billing_cardsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.billing_cardsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.billing_cardsScalarWhereInput | Prisma.billing_cardsScalarWhereInput[];
};
export type billing_cardsCreateWithoutOrganizationsInput = {
    id?: string;
    provider_token: string;
    last_four_digits?: string | null;
    brand?: string | null;
    holder_name: string;
    is_default: boolean;
};
export type billing_cardsUncheckedCreateWithoutOrganizationsInput = {
    id?: string;
    provider_token: string;
    last_four_digits?: string | null;
    brand?: string | null;
    holder_name: string;
    is_default: boolean;
};
export type billing_cardsCreateOrConnectWithoutOrganizationsInput = {
    where: Prisma.billing_cardsWhereUniqueInput;
    create: Prisma.XOR<Prisma.billing_cardsCreateWithoutOrganizationsInput, Prisma.billing_cardsUncheckedCreateWithoutOrganizationsInput>;
};
export type billing_cardsCreateManyOrganizationsInputEnvelope = {
    data: Prisma.billing_cardsCreateManyOrganizationsInput | Prisma.billing_cardsCreateManyOrganizationsInput[];
    skipDuplicates?: boolean;
};
export type billing_cardsUpsertWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.billing_cardsWhereUniqueInput;
    update: Prisma.XOR<Prisma.billing_cardsUpdateWithoutOrganizationsInput, Prisma.billing_cardsUncheckedUpdateWithoutOrganizationsInput>;
    create: Prisma.XOR<Prisma.billing_cardsCreateWithoutOrganizationsInput, Prisma.billing_cardsUncheckedCreateWithoutOrganizationsInput>;
};
export type billing_cardsUpdateWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.billing_cardsWhereUniqueInput;
    data: Prisma.XOR<Prisma.billing_cardsUpdateWithoutOrganizationsInput, Prisma.billing_cardsUncheckedUpdateWithoutOrganizationsInput>;
};
export type billing_cardsUpdateManyWithWhereWithoutOrganizationsInput = {
    where: Prisma.billing_cardsScalarWhereInput;
    data: Prisma.XOR<Prisma.billing_cardsUpdateManyMutationInput, Prisma.billing_cardsUncheckedUpdateManyWithoutOrganizationsInput>;
};
export type billing_cardsScalarWhereInput = {
    AND?: Prisma.billing_cardsScalarWhereInput | Prisma.billing_cardsScalarWhereInput[];
    OR?: Prisma.billing_cardsScalarWhereInput[];
    NOT?: Prisma.billing_cardsScalarWhereInput | Prisma.billing_cardsScalarWhereInput[];
    id?: Prisma.StringFilter<"billing_cards"> | string;
    organization_id?: Prisma.StringFilter<"billing_cards"> | string;
    provider_token?: Prisma.StringFilter<"billing_cards"> | string;
    last_four_digits?: Prisma.StringNullableFilter<"billing_cards"> | string | null;
    brand?: Prisma.StringNullableFilter<"billing_cards"> | string | null;
    holder_name?: Prisma.StringFilter<"billing_cards"> | string;
    is_default?: Prisma.BoolFilter<"billing_cards"> | boolean;
};
export type billing_cardsCreateManyOrganizationsInput = {
    id?: string;
    provider_token: string;
    last_four_digits?: string | null;
    brand?: string | null;
    holder_name: string;
    is_default: boolean;
};
export type billing_cardsUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    provider_token?: Prisma.StringFieldUpdateOperationsInput | string;
    last_four_digits?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    brand?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    holder_name?: Prisma.StringFieldUpdateOperationsInput | string;
    is_default?: Prisma.BoolFieldUpdateOperationsInput | boolean;
};
export type billing_cardsUncheckedUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    provider_token?: Prisma.StringFieldUpdateOperationsInput | string;
    last_four_digits?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    brand?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    holder_name?: Prisma.StringFieldUpdateOperationsInput | string;
    is_default?: Prisma.BoolFieldUpdateOperationsInput | boolean;
};
export type billing_cardsUncheckedUpdateManyWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    provider_token?: Prisma.StringFieldUpdateOperationsInput | string;
    last_four_digits?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    brand?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    holder_name?: Prisma.StringFieldUpdateOperationsInput | string;
    is_default?: Prisma.BoolFieldUpdateOperationsInput | boolean;
};
export type billing_cardsSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    organization_id?: boolean;
    provider_token?: boolean;
    last_four_digits?: boolean;
    brand?: boolean;
    holder_name?: boolean;
    is_default?: boolean;
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["billing_cards"]>;
export type billing_cardsSelectScalar = {
    id?: boolean;
    organization_id?: boolean;
    provider_token?: boolean;
    last_four_digits?: boolean;
    brand?: boolean;
    holder_name?: boolean;
    is_default?: boolean;
};
export type billing_cardsOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "organization_id" | "provider_token" | "last_four_digits" | "brand" | "holder_name" | "is_default", ExtArgs["result"]["billing_cards"]>;
export type billing_cardsInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
};
export type $billing_cardsPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "billing_cards";
    objects: {
        organizations: Prisma.$organizationsPayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        organization_id: string;
        provider_token: string;
        last_four_digits: string | null;
        brand: string | null;
        holder_name: string;
        is_default: boolean;
    }, ExtArgs["result"]["billing_cards"]>;
    composites: {};
};
export type billing_cardsGetPayload<S extends boolean | null | undefined | billing_cardsDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$billing_cardsPayload, S>;
export type billing_cardsCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<billing_cardsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: Billing_cardsCountAggregateInputType | true;
};
export interface billing_cardsDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['billing_cards'];
        meta: {
            name: 'billing_cards';
        };
    };
    findUnique<T extends billing_cardsFindUniqueArgs>(args: Prisma.SelectSubset<T, billing_cardsFindUniqueArgs<ExtArgs>>): Prisma.Prisma__billing_cardsClient<runtime.Types.Result.GetResult<Prisma.$billing_cardsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends billing_cardsFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, billing_cardsFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__billing_cardsClient<runtime.Types.Result.GetResult<Prisma.$billing_cardsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends billing_cardsFindFirstArgs>(args?: Prisma.SelectSubset<T, billing_cardsFindFirstArgs<ExtArgs>>): Prisma.Prisma__billing_cardsClient<runtime.Types.Result.GetResult<Prisma.$billing_cardsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends billing_cardsFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, billing_cardsFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__billing_cardsClient<runtime.Types.Result.GetResult<Prisma.$billing_cardsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends billing_cardsFindManyArgs>(args?: Prisma.SelectSubset<T, billing_cardsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$billing_cardsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends billing_cardsCreateArgs>(args: Prisma.SelectSubset<T, billing_cardsCreateArgs<ExtArgs>>): Prisma.Prisma__billing_cardsClient<runtime.Types.Result.GetResult<Prisma.$billing_cardsPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends billing_cardsCreateManyArgs>(args?: Prisma.SelectSubset<T, billing_cardsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends billing_cardsDeleteArgs>(args: Prisma.SelectSubset<T, billing_cardsDeleteArgs<ExtArgs>>): Prisma.Prisma__billing_cardsClient<runtime.Types.Result.GetResult<Prisma.$billing_cardsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends billing_cardsUpdateArgs>(args: Prisma.SelectSubset<T, billing_cardsUpdateArgs<ExtArgs>>): Prisma.Prisma__billing_cardsClient<runtime.Types.Result.GetResult<Prisma.$billing_cardsPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends billing_cardsDeleteManyArgs>(args?: Prisma.SelectSubset<T, billing_cardsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends billing_cardsUpdateManyArgs>(args: Prisma.SelectSubset<T, billing_cardsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends billing_cardsUpsertArgs>(args: Prisma.SelectSubset<T, billing_cardsUpsertArgs<ExtArgs>>): Prisma.Prisma__billing_cardsClient<runtime.Types.Result.GetResult<Prisma.$billing_cardsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends billing_cardsCountArgs>(args?: Prisma.Subset<T, billing_cardsCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], Billing_cardsCountAggregateOutputType> : number>;
    aggregate<T extends Billing_cardsAggregateArgs>(args: Prisma.Subset<T, Billing_cardsAggregateArgs>): Prisma.PrismaPromise<GetBilling_cardsAggregateType<T>>;
    groupBy<T extends billing_cardsGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: billing_cardsGroupByArgs['orderBy'];
    } : {
        orderBy?: billing_cardsGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, billing_cardsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetBilling_cardsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: billing_cardsFieldRefs;
}
export interface Prisma__billing_cardsClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    organizations<T extends Prisma.organizationsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.organizationsDefaultArgs<ExtArgs>>): Prisma.Prisma__organizationsClient<runtime.Types.Result.GetResult<Prisma.$organizationsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface billing_cardsFieldRefs {
    readonly id: Prisma.FieldRef<"billing_cards", 'String'>;
    readonly organization_id: Prisma.FieldRef<"billing_cards", 'String'>;
    readonly provider_token: Prisma.FieldRef<"billing_cards", 'String'>;
    readonly last_four_digits: Prisma.FieldRef<"billing_cards", 'String'>;
    readonly brand: Prisma.FieldRef<"billing_cards", 'String'>;
    readonly holder_name: Prisma.FieldRef<"billing_cards", 'String'>;
    readonly is_default: Prisma.FieldRef<"billing_cards", 'Boolean'>;
}
export type billing_cardsFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.billing_cardsSelect<ExtArgs> | null;
    omit?: Prisma.billing_cardsOmit<ExtArgs> | null;
    include?: Prisma.billing_cardsInclude<ExtArgs> | null;
    where: Prisma.billing_cardsWhereUniqueInput;
};
export type billing_cardsFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.billing_cardsSelect<ExtArgs> | null;
    omit?: Prisma.billing_cardsOmit<ExtArgs> | null;
    include?: Prisma.billing_cardsInclude<ExtArgs> | null;
    where: Prisma.billing_cardsWhereUniqueInput;
};
export type billing_cardsFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.billing_cardsSelect<ExtArgs> | null;
    omit?: Prisma.billing_cardsOmit<ExtArgs> | null;
    include?: Prisma.billing_cardsInclude<ExtArgs> | null;
    where?: Prisma.billing_cardsWhereInput;
    orderBy?: Prisma.billing_cardsOrderByWithRelationInput | Prisma.billing_cardsOrderByWithRelationInput[];
    cursor?: Prisma.billing_cardsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Billing_cardsScalarFieldEnum | Prisma.Billing_cardsScalarFieldEnum[];
};
export type billing_cardsFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.billing_cardsSelect<ExtArgs> | null;
    omit?: Prisma.billing_cardsOmit<ExtArgs> | null;
    include?: Prisma.billing_cardsInclude<ExtArgs> | null;
    where?: Prisma.billing_cardsWhereInput;
    orderBy?: Prisma.billing_cardsOrderByWithRelationInput | Prisma.billing_cardsOrderByWithRelationInput[];
    cursor?: Prisma.billing_cardsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Billing_cardsScalarFieldEnum | Prisma.Billing_cardsScalarFieldEnum[];
};
export type billing_cardsFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.billing_cardsSelect<ExtArgs> | null;
    omit?: Prisma.billing_cardsOmit<ExtArgs> | null;
    include?: Prisma.billing_cardsInclude<ExtArgs> | null;
    where?: Prisma.billing_cardsWhereInput;
    orderBy?: Prisma.billing_cardsOrderByWithRelationInput | Prisma.billing_cardsOrderByWithRelationInput[];
    cursor?: Prisma.billing_cardsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Billing_cardsScalarFieldEnum | Prisma.Billing_cardsScalarFieldEnum[];
};
export type billing_cardsCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.billing_cardsSelect<ExtArgs> | null;
    omit?: Prisma.billing_cardsOmit<ExtArgs> | null;
    include?: Prisma.billing_cardsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.billing_cardsCreateInput, Prisma.billing_cardsUncheckedCreateInput>;
};
export type billing_cardsCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.billing_cardsCreateManyInput | Prisma.billing_cardsCreateManyInput[];
    skipDuplicates?: boolean;
};
export type billing_cardsUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.billing_cardsSelect<ExtArgs> | null;
    omit?: Prisma.billing_cardsOmit<ExtArgs> | null;
    include?: Prisma.billing_cardsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.billing_cardsUpdateInput, Prisma.billing_cardsUncheckedUpdateInput>;
    where: Prisma.billing_cardsWhereUniqueInput;
};
export type billing_cardsUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.billing_cardsUpdateManyMutationInput, Prisma.billing_cardsUncheckedUpdateManyInput>;
    where?: Prisma.billing_cardsWhereInput;
    limit?: number;
};
export type billing_cardsUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.billing_cardsSelect<ExtArgs> | null;
    omit?: Prisma.billing_cardsOmit<ExtArgs> | null;
    include?: Prisma.billing_cardsInclude<ExtArgs> | null;
    where: Prisma.billing_cardsWhereUniqueInput;
    create: Prisma.XOR<Prisma.billing_cardsCreateInput, Prisma.billing_cardsUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.billing_cardsUpdateInput, Prisma.billing_cardsUncheckedUpdateInput>;
};
export type billing_cardsDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.billing_cardsSelect<ExtArgs> | null;
    omit?: Prisma.billing_cardsOmit<ExtArgs> | null;
    include?: Prisma.billing_cardsInclude<ExtArgs> | null;
    where: Prisma.billing_cardsWhereUniqueInput;
};
export type billing_cardsDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.billing_cardsWhereInput;
    limit?: number;
};
export type billing_cardsDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.billing_cardsSelect<ExtArgs> | null;
    omit?: Prisma.billing_cardsOmit<ExtArgs> | null;
    include?: Prisma.billing_cardsInclude<ExtArgs> | null;
};
export {};
