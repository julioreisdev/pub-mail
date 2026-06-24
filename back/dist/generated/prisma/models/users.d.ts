import type * as runtime from "@prisma/client/runtime/client";
import type * as $Enums from "../enums.js";
import type * as Prisma from "../internal/prismaNamespace.js";
export type usersModel = runtime.Types.Result.DefaultSelection<Prisma.$usersPayload>;
export type AggregateUsers = {
    _count: UsersCountAggregateOutputType | null;
    _min: UsersMinAggregateOutputType | null;
    _max: UsersMaxAggregateOutputType | null;
};
export type UsersMinAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    name: string | null;
    email: string | null;
    password_hash: string | null;
    role: $Enums.users_role | null;
    refresh_token: string | null;
    active: boolean | null;
};
export type UsersMaxAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    name: string | null;
    email: string | null;
    password_hash: string | null;
    role: $Enums.users_role | null;
    refresh_token: string | null;
    active: boolean | null;
};
export type UsersCountAggregateOutputType = {
    id: number;
    organization_id: number;
    name: number;
    email: number;
    password_hash: number;
    role: number;
    refresh_token: number;
    active: number;
    _all: number;
};
export type UsersMinAggregateInputType = {
    id?: true;
    organization_id?: true;
    name?: true;
    email?: true;
    password_hash?: true;
    role?: true;
    refresh_token?: true;
    active?: true;
};
export type UsersMaxAggregateInputType = {
    id?: true;
    organization_id?: true;
    name?: true;
    email?: true;
    password_hash?: true;
    role?: true;
    refresh_token?: true;
    active?: true;
};
export type UsersCountAggregateInputType = {
    id?: true;
    organization_id?: true;
    name?: true;
    email?: true;
    password_hash?: true;
    role?: true;
    refresh_token?: true;
    active?: true;
    _all?: true;
};
export type UsersAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.usersWhereInput;
    orderBy?: Prisma.usersOrderByWithRelationInput | Prisma.usersOrderByWithRelationInput[];
    cursor?: Prisma.usersWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | UsersCountAggregateInputType;
    _min?: UsersMinAggregateInputType;
    _max?: UsersMaxAggregateInputType;
};
export type GetUsersAggregateType<T extends UsersAggregateArgs> = {
    [P in keyof T & keyof AggregateUsers]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateUsers[P]> : Prisma.GetScalarType<T[P], AggregateUsers[P]>;
};
export type usersGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.usersWhereInput;
    orderBy?: Prisma.usersOrderByWithAggregationInput | Prisma.usersOrderByWithAggregationInput[];
    by: Prisma.UsersScalarFieldEnum[] | Prisma.UsersScalarFieldEnum;
    having?: Prisma.usersScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: UsersCountAggregateInputType | true;
    _min?: UsersMinAggregateInputType;
    _max?: UsersMaxAggregateInputType;
};
export type UsersGroupByOutputType = {
    id: string;
    organization_id: string;
    name: string;
    email: string;
    password_hash: string;
    role: $Enums.users_role;
    refresh_token: string | null;
    active: boolean;
    _count: UsersCountAggregateOutputType | null;
    _min: UsersMinAggregateOutputType | null;
    _max: UsersMaxAggregateOutputType | null;
};
type GetUsersGroupByPayload<T extends usersGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<UsersGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof UsersGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], UsersGroupByOutputType[P]> : Prisma.GetScalarType<T[P], UsersGroupByOutputType[P]>;
}>>;
export type usersWhereInput = {
    AND?: Prisma.usersWhereInput | Prisma.usersWhereInput[];
    OR?: Prisma.usersWhereInput[];
    NOT?: Prisma.usersWhereInput | Prisma.usersWhereInput[];
    id?: Prisma.StringFilter<"users"> | string;
    organization_id?: Prisma.StringFilter<"users"> | string;
    name?: Prisma.StringFilter<"users"> | string;
    email?: Prisma.StringFilter<"users"> | string;
    password_hash?: Prisma.StringFilter<"users"> | string;
    role?: Prisma.Enumusers_roleFilter<"users"> | $Enums.users_role;
    refresh_token?: Prisma.StringNullableFilter<"users"> | string | null;
    active?: Prisma.BoolFilter<"users"> | boolean;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
};
export type usersOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    password_hash?: Prisma.SortOrder;
    role?: Prisma.SortOrder;
    refresh_token?: Prisma.SortOrderInput | Prisma.SortOrder;
    active?: Prisma.SortOrder;
    organizations?: Prisma.organizationsOrderByWithRelationInput;
    _relevance?: Prisma.usersOrderByRelevanceInput;
};
export type usersWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    email?: string;
    AND?: Prisma.usersWhereInput | Prisma.usersWhereInput[];
    OR?: Prisma.usersWhereInput[];
    NOT?: Prisma.usersWhereInput | Prisma.usersWhereInput[];
    organization_id?: Prisma.StringFilter<"users"> | string;
    name?: Prisma.StringFilter<"users"> | string;
    password_hash?: Prisma.StringFilter<"users"> | string;
    role?: Prisma.Enumusers_roleFilter<"users"> | $Enums.users_role;
    refresh_token?: Prisma.StringNullableFilter<"users"> | string | null;
    active?: Prisma.BoolFilter<"users"> | boolean;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
}, "id" | "email">;
export type usersOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    password_hash?: Prisma.SortOrder;
    role?: Prisma.SortOrder;
    refresh_token?: Prisma.SortOrderInput | Prisma.SortOrder;
    active?: Prisma.SortOrder;
    _count?: Prisma.usersCountOrderByAggregateInput;
    _max?: Prisma.usersMaxOrderByAggregateInput;
    _min?: Prisma.usersMinOrderByAggregateInput;
};
export type usersScalarWhereWithAggregatesInput = {
    AND?: Prisma.usersScalarWhereWithAggregatesInput | Prisma.usersScalarWhereWithAggregatesInput[];
    OR?: Prisma.usersScalarWhereWithAggregatesInput[];
    NOT?: Prisma.usersScalarWhereWithAggregatesInput | Prisma.usersScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"users"> | string;
    organization_id?: Prisma.StringWithAggregatesFilter<"users"> | string;
    name?: Prisma.StringWithAggregatesFilter<"users"> | string;
    email?: Prisma.StringWithAggregatesFilter<"users"> | string;
    password_hash?: Prisma.StringWithAggregatesFilter<"users"> | string;
    role?: Prisma.Enumusers_roleWithAggregatesFilter<"users"> | $Enums.users_role;
    refresh_token?: Prisma.StringNullableWithAggregatesFilter<"users"> | string | null;
    active?: Prisma.BoolWithAggregatesFilter<"users"> | boolean;
};
export type usersCreateInput = {
    id?: string;
    name: string;
    email: string;
    password_hash: string;
    role?: $Enums.users_role;
    refresh_token?: string | null;
    active?: boolean;
    organizations: Prisma.organizationsCreateNestedOneWithoutUsersInput;
};
export type usersUncheckedCreateInput = {
    id?: string;
    organization_id: string;
    name: string;
    email: string;
    password_hash: string;
    role?: $Enums.users_role;
    refresh_token?: string | null;
    active?: boolean;
};
export type usersUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    password_hash?: Prisma.StringFieldUpdateOperationsInput | string;
    role?: Prisma.Enumusers_roleFieldUpdateOperationsInput | $Enums.users_role;
    refresh_token?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutUsersNestedInput;
};
export type usersUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    password_hash?: Prisma.StringFieldUpdateOperationsInput | string;
    role?: Prisma.Enumusers_roleFieldUpdateOperationsInput | $Enums.users_role;
    refresh_token?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
};
export type usersCreateManyInput = {
    id?: string;
    organization_id: string;
    name: string;
    email: string;
    password_hash: string;
    role?: $Enums.users_role;
    refresh_token?: string | null;
    active?: boolean;
};
export type usersUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    password_hash?: Prisma.StringFieldUpdateOperationsInput | string;
    role?: Prisma.Enumusers_roleFieldUpdateOperationsInput | $Enums.users_role;
    refresh_token?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
};
export type usersUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    password_hash?: Prisma.StringFieldUpdateOperationsInput | string;
    role?: Prisma.Enumusers_roleFieldUpdateOperationsInput | $Enums.users_role;
    refresh_token?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
};
export type UsersListRelationFilter = {
    every?: Prisma.usersWhereInput;
    some?: Prisma.usersWhereInput;
    none?: Prisma.usersWhereInput;
};
export type usersOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type usersOrderByRelevanceInput = {
    fields: Prisma.usersOrderByRelevanceFieldEnum | Prisma.usersOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type usersCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    password_hash?: Prisma.SortOrder;
    role?: Prisma.SortOrder;
    refresh_token?: Prisma.SortOrder;
    active?: Prisma.SortOrder;
};
export type usersMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    password_hash?: Prisma.SortOrder;
    role?: Prisma.SortOrder;
    refresh_token?: Prisma.SortOrder;
    active?: Prisma.SortOrder;
};
export type usersMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    password_hash?: Prisma.SortOrder;
    role?: Prisma.SortOrder;
    refresh_token?: Prisma.SortOrder;
    active?: Prisma.SortOrder;
};
export type usersCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.usersCreateWithoutOrganizationsInput, Prisma.usersUncheckedCreateWithoutOrganizationsInput> | Prisma.usersCreateWithoutOrganizationsInput[] | Prisma.usersUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.usersCreateOrConnectWithoutOrganizationsInput | Prisma.usersCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.usersCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.usersWhereUniqueInput | Prisma.usersWhereUniqueInput[];
};
export type usersUncheckedCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.usersCreateWithoutOrganizationsInput, Prisma.usersUncheckedCreateWithoutOrganizationsInput> | Prisma.usersCreateWithoutOrganizationsInput[] | Prisma.usersUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.usersCreateOrConnectWithoutOrganizationsInput | Prisma.usersCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.usersCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.usersWhereUniqueInput | Prisma.usersWhereUniqueInput[];
};
export type usersUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.usersCreateWithoutOrganizationsInput, Prisma.usersUncheckedCreateWithoutOrganizationsInput> | Prisma.usersCreateWithoutOrganizationsInput[] | Prisma.usersUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.usersCreateOrConnectWithoutOrganizationsInput | Prisma.usersCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.usersUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.usersUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.usersCreateManyOrganizationsInputEnvelope;
    set?: Prisma.usersWhereUniqueInput | Prisma.usersWhereUniqueInput[];
    disconnect?: Prisma.usersWhereUniqueInput | Prisma.usersWhereUniqueInput[];
    delete?: Prisma.usersWhereUniqueInput | Prisma.usersWhereUniqueInput[];
    connect?: Prisma.usersWhereUniqueInput | Prisma.usersWhereUniqueInput[];
    update?: Prisma.usersUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.usersUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.usersUpdateManyWithWhereWithoutOrganizationsInput | Prisma.usersUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.usersScalarWhereInput | Prisma.usersScalarWhereInput[];
};
export type usersUncheckedUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.usersCreateWithoutOrganizationsInput, Prisma.usersUncheckedCreateWithoutOrganizationsInput> | Prisma.usersCreateWithoutOrganizationsInput[] | Prisma.usersUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.usersCreateOrConnectWithoutOrganizationsInput | Prisma.usersCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.usersUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.usersUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.usersCreateManyOrganizationsInputEnvelope;
    set?: Prisma.usersWhereUniqueInput | Prisma.usersWhereUniqueInput[];
    disconnect?: Prisma.usersWhereUniqueInput | Prisma.usersWhereUniqueInput[];
    delete?: Prisma.usersWhereUniqueInput | Prisma.usersWhereUniqueInput[];
    connect?: Prisma.usersWhereUniqueInput | Prisma.usersWhereUniqueInput[];
    update?: Prisma.usersUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.usersUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.usersUpdateManyWithWhereWithoutOrganizationsInput | Prisma.usersUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.usersScalarWhereInput | Prisma.usersScalarWhereInput[];
};
export type Enumusers_roleFieldUpdateOperationsInput = {
    set?: $Enums.users_role;
};
export type usersCreateWithoutOrganizationsInput = {
    id?: string;
    name: string;
    email: string;
    password_hash: string;
    role?: $Enums.users_role;
    refresh_token?: string | null;
    active?: boolean;
};
export type usersUncheckedCreateWithoutOrganizationsInput = {
    id?: string;
    name: string;
    email: string;
    password_hash: string;
    role?: $Enums.users_role;
    refresh_token?: string | null;
    active?: boolean;
};
export type usersCreateOrConnectWithoutOrganizationsInput = {
    where: Prisma.usersWhereUniqueInput;
    create: Prisma.XOR<Prisma.usersCreateWithoutOrganizationsInput, Prisma.usersUncheckedCreateWithoutOrganizationsInput>;
};
export type usersCreateManyOrganizationsInputEnvelope = {
    data: Prisma.usersCreateManyOrganizationsInput | Prisma.usersCreateManyOrganizationsInput[];
    skipDuplicates?: boolean;
};
export type usersUpsertWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.usersWhereUniqueInput;
    update: Prisma.XOR<Prisma.usersUpdateWithoutOrganizationsInput, Prisma.usersUncheckedUpdateWithoutOrganizationsInput>;
    create: Prisma.XOR<Prisma.usersCreateWithoutOrganizationsInput, Prisma.usersUncheckedCreateWithoutOrganizationsInput>;
};
export type usersUpdateWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.usersWhereUniqueInput;
    data: Prisma.XOR<Prisma.usersUpdateWithoutOrganizationsInput, Prisma.usersUncheckedUpdateWithoutOrganizationsInput>;
};
export type usersUpdateManyWithWhereWithoutOrganizationsInput = {
    where: Prisma.usersScalarWhereInput;
    data: Prisma.XOR<Prisma.usersUpdateManyMutationInput, Prisma.usersUncheckedUpdateManyWithoutOrganizationsInput>;
};
export type usersScalarWhereInput = {
    AND?: Prisma.usersScalarWhereInput | Prisma.usersScalarWhereInput[];
    OR?: Prisma.usersScalarWhereInput[];
    NOT?: Prisma.usersScalarWhereInput | Prisma.usersScalarWhereInput[];
    id?: Prisma.StringFilter<"users"> | string;
    organization_id?: Prisma.StringFilter<"users"> | string;
    name?: Prisma.StringFilter<"users"> | string;
    email?: Prisma.StringFilter<"users"> | string;
    password_hash?: Prisma.StringFilter<"users"> | string;
    role?: Prisma.Enumusers_roleFilter<"users"> | $Enums.users_role;
    refresh_token?: Prisma.StringNullableFilter<"users"> | string | null;
    active?: Prisma.BoolFilter<"users"> | boolean;
};
export type usersCreateManyOrganizationsInput = {
    id?: string;
    name: string;
    email: string;
    password_hash: string;
    role?: $Enums.users_role;
    refresh_token?: string | null;
    active?: boolean;
};
export type usersUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    password_hash?: Prisma.StringFieldUpdateOperationsInput | string;
    role?: Prisma.Enumusers_roleFieldUpdateOperationsInput | $Enums.users_role;
    refresh_token?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
};
export type usersUncheckedUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    password_hash?: Prisma.StringFieldUpdateOperationsInput | string;
    role?: Prisma.Enumusers_roleFieldUpdateOperationsInput | $Enums.users_role;
    refresh_token?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
};
export type usersUncheckedUpdateManyWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    password_hash?: Prisma.StringFieldUpdateOperationsInput | string;
    role?: Prisma.Enumusers_roleFieldUpdateOperationsInput | $Enums.users_role;
    refresh_token?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
};
export type usersSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    organization_id?: boolean;
    name?: boolean;
    email?: boolean;
    password_hash?: boolean;
    role?: boolean;
    refresh_token?: boolean;
    active?: boolean;
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["users"]>;
export type usersSelectScalar = {
    id?: boolean;
    organization_id?: boolean;
    name?: boolean;
    email?: boolean;
    password_hash?: boolean;
    role?: boolean;
    refresh_token?: boolean;
    active?: boolean;
};
export type usersOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "organization_id" | "name" | "email" | "password_hash" | "role" | "refresh_token" | "active", ExtArgs["result"]["users"]>;
export type usersInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
};
export type $usersPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "users";
    objects: {
        organizations: Prisma.$organizationsPayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        organization_id: string;
        name: string;
        email: string;
        password_hash: string;
        role: $Enums.users_role;
        refresh_token: string | null;
        active: boolean;
    }, ExtArgs["result"]["users"]>;
    composites: {};
};
export type usersGetPayload<S extends boolean | null | undefined | usersDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$usersPayload, S>;
export type usersCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<usersFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: UsersCountAggregateInputType | true;
};
export interface usersDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['users'];
        meta: {
            name: 'users';
        };
    };
    findUnique<T extends usersFindUniqueArgs>(args: Prisma.SelectSubset<T, usersFindUniqueArgs<ExtArgs>>): Prisma.Prisma__usersClient<runtime.Types.Result.GetResult<Prisma.$usersPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends usersFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, usersFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__usersClient<runtime.Types.Result.GetResult<Prisma.$usersPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends usersFindFirstArgs>(args?: Prisma.SelectSubset<T, usersFindFirstArgs<ExtArgs>>): Prisma.Prisma__usersClient<runtime.Types.Result.GetResult<Prisma.$usersPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends usersFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, usersFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__usersClient<runtime.Types.Result.GetResult<Prisma.$usersPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends usersFindManyArgs>(args?: Prisma.SelectSubset<T, usersFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$usersPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends usersCreateArgs>(args: Prisma.SelectSubset<T, usersCreateArgs<ExtArgs>>): Prisma.Prisma__usersClient<runtime.Types.Result.GetResult<Prisma.$usersPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends usersCreateManyArgs>(args?: Prisma.SelectSubset<T, usersCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends usersDeleteArgs>(args: Prisma.SelectSubset<T, usersDeleteArgs<ExtArgs>>): Prisma.Prisma__usersClient<runtime.Types.Result.GetResult<Prisma.$usersPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends usersUpdateArgs>(args: Prisma.SelectSubset<T, usersUpdateArgs<ExtArgs>>): Prisma.Prisma__usersClient<runtime.Types.Result.GetResult<Prisma.$usersPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends usersDeleteManyArgs>(args?: Prisma.SelectSubset<T, usersDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends usersUpdateManyArgs>(args: Prisma.SelectSubset<T, usersUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends usersUpsertArgs>(args: Prisma.SelectSubset<T, usersUpsertArgs<ExtArgs>>): Prisma.Prisma__usersClient<runtime.Types.Result.GetResult<Prisma.$usersPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends usersCountArgs>(args?: Prisma.Subset<T, usersCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], UsersCountAggregateOutputType> : number>;
    aggregate<T extends UsersAggregateArgs>(args: Prisma.Subset<T, UsersAggregateArgs>): Prisma.PrismaPromise<GetUsersAggregateType<T>>;
    groupBy<T extends usersGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: usersGroupByArgs['orderBy'];
    } : {
        orderBy?: usersGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, usersGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUsersGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: usersFieldRefs;
}
export interface Prisma__usersClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    organizations<T extends Prisma.organizationsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.organizationsDefaultArgs<ExtArgs>>): Prisma.Prisma__organizationsClient<runtime.Types.Result.GetResult<Prisma.$organizationsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface usersFieldRefs {
    readonly id: Prisma.FieldRef<"users", 'String'>;
    readonly organization_id: Prisma.FieldRef<"users", 'String'>;
    readonly name: Prisma.FieldRef<"users", 'String'>;
    readonly email: Prisma.FieldRef<"users", 'String'>;
    readonly password_hash: Prisma.FieldRef<"users", 'String'>;
    readonly role: Prisma.FieldRef<"users", 'users_role'>;
    readonly refresh_token: Prisma.FieldRef<"users", 'String'>;
    readonly active: Prisma.FieldRef<"users", 'Boolean'>;
}
export type usersFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.usersSelect<ExtArgs> | null;
    omit?: Prisma.usersOmit<ExtArgs> | null;
    include?: Prisma.usersInclude<ExtArgs> | null;
    where: Prisma.usersWhereUniqueInput;
};
export type usersFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.usersSelect<ExtArgs> | null;
    omit?: Prisma.usersOmit<ExtArgs> | null;
    include?: Prisma.usersInclude<ExtArgs> | null;
    where: Prisma.usersWhereUniqueInput;
};
export type usersFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.usersSelect<ExtArgs> | null;
    omit?: Prisma.usersOmit<ExtArgs> | null;
    include?: Prisma.usersInclude<ExtArgs> | null;
    where?: Prisma.usersWhereInput;
    orderBy?: Prisma.usersOrderByWithRelationInput | Prisma.usersOrderByWithRelationInput[];
    cursor?: Prisma.usersWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.UsersScalarFieldEnum | Prisma.UsersScalarFieldEnum[];
};
export type usersFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.usersSelect<ExtArgs> | null;
    omit?: Prisma.usersOmit<ExtArgs> | null;
    include?: Prisma.usersInclude<ExtArgs> | null;
    where?: Prisma.usersWhereInput;
    orderBy?: Prisma.usersOrderByWithRelationInput | Prisma.usersOrderByWithRelationInput[];
    cursor?: Prisma.usersWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.UsersScalarFieldEnum | Prisma.UsersScalarFieldEnum[];
};
export type usersFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.usersSelect<ExtArgs> | null;
    omit?: Prisma.usersOmit<ExtArgs> | null;
    include?: Prisma.usersInclude<ExtArgs> | null;
    where?: Prisma.usersWhereInput;
    orderBy?: Prisma.usersOrderByWithRelationInput | Prisma.usersOrderByWithRelationInput[];
    cursor?: Prisma.usersWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.UsersScalarFieldEnum | Prisma.UsersScalarFieldEnum[];
};
export type usersCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.usersSelect<ExtArgs> | null;
    omit?: Prisma.usersOmit<ExtArgs> | null;
    include?: Prisma.usersInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.usersCreateInput, Prisma.usersUncheckedCreateInput>;
};
export type usersCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.usersCreateManyInput | Prisma.usersCreateManyInput[];
    skipDuplicates?: boolean;
};
export type usersUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.usersSelect<ExtArgs> | null;
    omit?: Prisma.usersOmit<ExtArgs> | null;
    include?: Prisma.usersInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.usersUpdateInput, Prisma.usersUncheckedUpdateInput>;
    where: Prisma.usersWhereUniqueInput;
};
export type usersUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.usersUpdateManyMutationInput, Prisma.usersUncheckedUpdateManyInput>;
    where?: Prisma.usersWhereInput;
    limit?: number;
};
export type usersUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.usersSelect<ExtArgs> | null;
    omit?: Prisma.usersOmit<ExtArgs> | null;
    include?: Prisma.usersInclude<ExtArgs> | null;
    where: Prisma.usersWhereUniqueInput;
    create: Prisma.XOR<Prisma.usersCreateInput, Prisma.usersUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.usersUpdateInput, Prisma.usersUncheckedUpdateInput>;
};
export type usersDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.usersSelect<ExtArgs> | null;
    omit?: Prisma.usersOmit<ExtArgs> | null;
    include?: Prisma.usersInclude<ExtArgs> | null;
    where: Prisma.usersWhereUniqueInput;
};
export type usersDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.usersWhereInput;
    limit?: number;
};
export type usersDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.usersSelect<ExtArgs> | null;
    omit?: Prisma.usersOmit<ExtArgs> | null;
    include?: Prisma.usersInclude<ExtArgs> | null;
};
export {};
