import type * as runtime from "@prisma/client/runtime/client";
import type * as $Enums from "../enums.js";
import type * as Prisma from "../internal/prismaNamespace.js";
export type avatarsModel = runtime.Types.Result.DefaultSelection<Prisma.$avatarsPayload>;
export type AggregateAvatars = {
    _count: AvatarsCountAggregateOutputType | null;
    _min: AvatarsMinAggregateOutputType | null;
    _max: AvatarsMaxAggregateOutputType | null;
};
export type AvatarsMinAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    name: string | null;
    is_realistic: boolean | null;
    inspiration_image_url: string | null;
    avatar_image_url: string | null;
    user_prompt: string | null;
    system_prompt: string | null;
    personality: string | null;
    status: $Enums.avatar_status | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type AvatarsMaxAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    name: string | null;
    is_realistic: boolean | null;
    inspiration_image_url: string | null;
    avatar_image_url: string | null;
    user_prompt: string | null;
    system_prompt: string | null;
    personality: string | null;
    status: $Enums.avatar_status | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type AvatarsCountAggregateOutputType = {
    id: number;
    organization_id: number;
    name: number;
    is_realistic: number;
    default_colors: number;
    inspiration_image_url: number;
    avatar_image_url: number;
    user_prompt: number;
    system_prompt: number;
    personality: number;
    technical_metadata: number;
    status: number;
    created_at: number;
    updated_at: number;
    _all: number;
};
export type AvatarsMinAggregateInputType = {
    id?: true;
    organization_id?: true;
    name?: true;
    is_realistic?: true;
    inspiration_image_url?: true;
    avatar_image_url?: true;
    user_prompt?: true;
    system_prompt?: true;
    personality?: true;
    status?: true;
    created_at?: true;
    updated_at?: true;
};
export type AvatarsMaxAggregateInputType = {
    id?: true;
    organization_id?: true;
    name?: true;
    is_realistic?: true;
    inspiration_image_url?: true;
    avatar_image_url?: true;
    user_prompt?: true;
    system_prompt?: true;
    personality?: true;
    status?: true;
    created_at?: true;
    updated_at?: true;
};
export type AvatarsCountAggregateInputType = {
    id?: true;
    organization_id?: true;
    name?: true;
    is_realistic?: true;
    default_colors?: true;
    inspiration_image_url?: true;
    avatar_image_url?: true;
    user_prompt?: true;
    system_prompt?: true;
    personality?: true;
    technical_metadata?: true;
    status?: true;
    created_at?: true;
    updated_at?: true;
    _all?: true;
};
export type AvatarsAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.avatarsWhereInput;
    orderBy?: Prisma.avatarsOrderByWithRelationInput | Prisma.avatarsOrderByWithRelationInput[];
    cursor?: Prisma.avatarsWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | AvatarsCountAggregateInputType;
    _min?: AvatarsMinAggregateInputType;
    _max?: AvatarsMaxAggregateInputType;
};
export type GetAvatarsAggregateType<T extends AvatarsAggregateArgs> = {
    [P in keyof T & keyof AggregateAvatars]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateAvatars[P]> : Prisma.GetScalarType<T[P], AggregateAvatars[P]>;
};
export type avatarsGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.avatarsWhereInput;
    orderBy?: Prisma.avatarsOrderByWithAggregationInput | Prisma.avatarsOrderByWithAggregationInput[];
    by: Prisma.AvatarsScalarFieldEnum[] | Prisma.AvatarsScalarFieldEnum;
    having?: Prisma.avatarsScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: AvatarsCountAggregateInputType | true;
    _min?: AvatarsMinAggregateInputType;
    _max?: AvatarsMaxAggregateInputType;
};
export type AvatarsGroupByOutputType = {
    id: string;
    organization_id: string;
    name: string;
    is_realistic: boolean;
    default_colors: runtime.JsonValue | null;
    inspiration_image_url: string | null;
    avatar_image_url: string;
    user_prompt: string | null;
    system_prompt: string | null;
    personality: string | null;
    technical_metadata: runtime.JsonValue | null;
    status: $Enums.avatar_status;
    created_at: Date;
    updated_at: Date;
    _count: AvatarsCountAggregateOutputType | null;
    _min: AvatarsMinAggregateOutputType | null;
    _max: AvatarsMaxAggregateOutputType | null;
};
type GetAvatarsGroupByPayload<T extends avatarsGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<AvatarsGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof AvatarsGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], AvatarsGroupByOutputType[P]> : Prisma.GetScalarType<T[P], AvatarsGroupByOutputType[P]>;
}>>;
export type avatarsWhereInput = {
    AND?: Prisma.avatarsWhereInput | Prisma.avatarsWhereInput[];
    OR?: Prisma.avatarsWhereInput[];
    NOT?: Prisma.avatarsWhereInput | Prisma.avatarsWhereInput[];
    id?: Prisma.StringFilter<"avatars"> | string;
    organization_id?: Prisma.StringFilter<"avatars"> | string;
    name?: Prisma.StringFilter<"avatars"> | string;
    is_realistic?: Prisma.BoolFilter<"avatars"> | boolean;
    default_colors?: Prisma.JsonNullableFilter<"avatars">;
    inspiration_image_url?: Prisma.StringNullableFilter<"avatars"> | string | null;
    avatar_image_url?: Prisma.StringFilter<"avatars"> | string;
    user_prompt?: Prisma.StringNullableFilter<"avatars"> | string | null;
    system_prompt?: Prisma.StringNullableFilter<"avatars"> | string | null;
    personality?: Prisma.StringNullableFilter<"avatars"> | string | null;
    technical_metadata?: Prisma.JsonNullableFilter<"avatars">;
    status?: Prisma.Enumavatar_statusFilter<"avatars"> | $Enums.avatar_status;
    created_at?: Prisma.DateTimeFilter<"avatars"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"avatars"> | Date | string;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
};
export type avatarsOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    is_realistic?: Prisma.SortOrder;
    default_colors?: Prisma.SortOrderInput | Prisma.SortOrder;
    inspiration_image_url?: Prisma.SortOrderInput | Prisma.SortOrder;
    avatar_image_url?: Prisma.SortOrder;
    user_prompt?: Prisma.SortOrderInput | Prisma.SortOrder;
    system_prompt?: Prisma.SortOrderInput | Prisma.SortOrder;
    personality?: Prisma.SortOrderInput | Prisma.SortOrder;
    technical_metadata?: Prisma.SortOrderInput | Prisma.SortOrder;
    status?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    organizations?: Prisma.organizationsOrderByWithRelationInput;
    _relevance?: Prisma.avatarsOrderByRelevanceInput;
};
export type avatarsWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    AND?: Prisma.avatarsWhereInput | Prisma.avatarsWhereInput[];
    OR?: Prisma.avatarsWhereInput[];
    NOT?: Prisma.avatarsWhereInput | Prisma.avatarsWhereInput[];
    organization_id?: Prisma.StringFilter<"avatars"> | string;
    name?: Prisma.StringFilter<"avatars"> | string;
    is_realistic?: Prisma.BoolFilter<"avatars"> | boolean;
    default_colors?: Prisma.JsonNullableFilter<"avatars">;
    inspiration_image_url?: Prisma.StringNullableFilter<"avatars"> | string | null;
    avatar_image_url?: Prisma.StringFilter<"avatars"> | string;
    user_prompt?: Prisma.StringNullableFilter<"avatars"> | string | null;
    system_prompt?: Prisma.StringNullableFilter<"avatars"> | string | null;
    personality?: Prisma.StringNullableFilter<"avatars"> | string | null;
    technical_metadata?: Prisma.JsonNullableFilter<"avatars">;
    status?: Prisma.Enumavatar_statusFilter<"avatars"> | $Enums.avatar_status;
    created_at?: Prisma.DateTimeFilter<"avatars"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"avatars"> | Date | string;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
}, "id">;
export type avatarsOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    is_realistic?: Prisma.SortOrder;
    default_colors?: Prisma.SortOrderInput | Prisma.SortOrder;
    inspiration_image_url?: Prisma.SortOrderInput | Prisma.SortOrder;
    avatar_image_url?: Prisma.SortOrder;
    user_prompt?: Prisma.SortOrderInput | Prisma.SortOrder;
    system_prompt?: Prisma.SortOrderInput | Prisma.SortOrder;
    personality?: Prisma.SortOrderInput | Prisma.SortOrder;
    technical_metadata?: Prisma.SortOrderInput | Prisma.SortOrder;
    status?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    _count?: Prisma.avatarsCountOrderByAggregateInput;
    _max?: Prisma.avatarsMaxOrderByAggregateInput;
    _min?: Prisma.avatarsMinOrderByAggregateInput;
};
export type avatarsScalarWhereWithAggregatesInput = {
    AND?: Prisma.avatarsScalarWhereWithAggregatesInput | Prisma.avatarsScalarWhereWithAggregatesInput[];
    OR?: Prisma.avatarsScalarWhereWithAggregatesInput[];
    NOT?: Prisma.avatarsScalarWhereWithAggregatesInput | Prisma.avatarsScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"avatars"> | string;
    organization_id?: Prisma.StringWithAggregatesFilter<"avatars"> | string;
    name?: Prisma.StringWithAggregatesFilter<"avatars"> | string;
    is_realistic?: Prisma.BoolWithAggregatesFilter<"avatars"> | boolean;
    default_colors?: Prisma.JsonNullableWithAggregatesFilter<"avatars">;
    inspiration_image_url?: Prisma.StringNullableWithAggregatesFilter<"avatars"> | string | null;
    avatar_image_url?: Prisma.StringWithAggregatesFilter<"avatars"> | string;
    user_prompt?: Prisma.StringNullableWithAggregatesFilter<"avatars"> | string | null;
    system_prompt?: Prisma.StringNullableWithAggregatesFilter<"avatars"> | string | null;
    personality?: Prisma.StringNullableWithAggregatesFilter<"avatars"> | string | null;
    technical_metadata?: Prisma.JsonNullableWithAggregatesFilter<"avatars">;
    status?: Prisma.Enumavatar_statusWithAggregatesFilter<"avatars"> | $Enums.avatar_status;
    created_at?: Prisma.DateTimeWithAggregatesFilter<"avatars"> | Date | string;
    updated_at?: Prisma.DateTimeWithAggregatesFilter<"avatars"> | Date | string;
};
export type avatarsCreateInput = {
    id?: string;
    name: string;
    is_realistic?: boolean;
    default_colors?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    inspiration_image_url?: string | null;
    avatar_image_url: string;
    user_prompt?: string | null;
    system_prompt?: string | null;
    personality?: string | null;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: $Enums.avatar_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    organizations: Prisma.organizationsCreateNestedOneWithoutAvatarsInput;
};
export type avatarsUncheckedCreateInput = {
    id?: string;
    organization_id: string;
    name: string;
    is_realistic?: boolean;
    default_colors?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    inspiration_image_url?: string | null;
    avatar_image_url: string;
    user_prompt?: string | null;
    system_prompt?: string | null;
    personality?: string | null;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: $Enums.avatar_status;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type avatarsUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    is_realistic?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    default_colors?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    inspiration_image_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatar_image_url?: Prisma.StringFieldUpdateOperationsInput | string;
    user_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    system_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    personality?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: Prisma.Enumavatar_statusFieldUpdateOperationsInput | $Enums.avatar_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutAvatarsNestedInput;
};
export type avatarsUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    is_realistic?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    default_colors?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    inspiration_image_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatar_image_url?: Prisma.StringFieldUpdateOperationsInput | string;
    user_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    system_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    personality?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: Prisma.Enumavatar_statusFieldUpdateOperationsInput | $Enums.avatar_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type avatarsCreateManyInput = {
    id?: string;
    organization_id: string;
    name: string;
    is_realistic?: boolean;
    default_colors?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    inspiration_image_url?: string | null;
    avatar_image_url: string;
    user_prompt?: string | null;
    system_prompt?: string | null;
    personality?: string | null;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: $Enums.avatar_status;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type avatarsUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    is_realistic?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    default_colors?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    inspiration_image_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatar_image_url?: Prisma.StringFieldUpdateOperationsInput | string;
    user_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    system_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    personality?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: Prisma.Enumavatar_statusFieldUpdateOperationsInput | $Enums.avatar_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type avatarsUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    is_realistic?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    default_colors?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    inspiration_image_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatar_image_url?: Prisma.StringFieldUpdateOperationsInput | string;
    user_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    system_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    personality?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: Prisma.Enumavatar_statusFieldUpdateOperationsInput | $Enums.avatar_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type AvatarsListRelationFilter = {
    every?: Prisma.avatarsWhereInput;
    some?: Prisma.avatarsWhereInput;
    none?: Prisma.avatarsWhereInput;
};
export type avatarsOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type avatarsOrderByRelevanceInput = {
    fields: Prisma.avatarsOrderByRelevanceFieldEnum | Prisma.avatarsOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type avatarsCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    is_realistic?: Prisma.SortOrder;
    default_colors?: Prisma.SortOrder;
    inspiration_image_url?: Prisma.SortOrder;
    avatar_image_url?: Prisma.SortOrder;
    user_prompt?: Prisma.SortOrder;
    system_prompt?: Prisma.SortOrder;
    personality?: Prisma.SortOrder;
    technical_metadata?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type avatarsMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    is_realistic?: Prisma.SortOrder;
    inspiration_image_url?: Prisma.SortOrder;
    avatar_image_url?: Prisma.SortOrder;
    user_prompt?: Prisma.SortOrder;
    system_prompt?: Prisma.SortOrder;
    personality?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type avatarsMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    is_realistic?: Prisma.SortOrder;
    inspiration_image_url?: Prisma.SortOrder;
    avatar_image_url?: Prisma.SortOrder;
    user_prompt?: Prisma.SortOrder;
    system_prompt?: Prisma.SortOrder;
    personality?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type avatarsCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.avatarsCreateWithoutOrganizationsInput, Prisma.avatarsUncheckedCreateWithoutOrganizationsInput> | Prisma.avatarsCreateWithoutOrganizationsInput[] | Prisma.avatarsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.avatarsCreateOrConnectWithoutOrganizationsInput | Prisma.avatarsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.avatarsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.avatarsWhereUniqueInput | Prisma.avatarsWhereUniqueInput[];
};
export type avatarsUncheckedCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.avatarsCreateWithoutOrganizationsInput, Prisma.avatarsUncheckedCreateWithoutOrganizationsInput> | Prisma.avatarsCreateWithoutOrganizationsInput[] | Prisma.avatarsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.avatarsCreateOrConnectWithoutOrganizationsInput | Prisma.avatarsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.avatarsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.avatarsWhereUniqueInput | Prisma.avatarsWhereUniqueInput[];
};
export type avatarsUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.avatarsCreateWithoutOrganizationsInput, Prisma.avatarsUncheckedCreateWithoutOrganizationsInput> | Prisma.avatarsCreateWithoutOrganizationsInput[] | Prisma.avatarsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.avatarsCreateOrConnectWithoutOrganizationsInput | Prisma.avatarsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.avatarsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.avatarsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.avatarsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.avatarsWhereUniqueInput | Prisma.avatarsWhereUniqueInput[];
    disconnect?: Prisma.avatarsWhereUniqueInput | Prisma.avatarsWhereUniqueInput[];
    delete?: Prisma.avatarsWhereUniqueInput | Prisma.avatarsWhereUniqueInput[];
    connect?: Prisma.avatarsWhereUniqueInput | Prisma.avatarsWhereUniqueInput[];
    update?: Prisma.avatarsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.avatarsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.avatarsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.avatarsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.avatarsScalarWhereInput | Prisma.avatarsScalarWhereInput[];
};
export type avatarsUncheckedUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.avatarsCreateWithoutOrganizationsInput, Prisma.avatarsUncheckedCreateWithoutOrganizationsInput> | Prisma.avatarsCreateWithoutOrganizationsInput[] | Prisma.avatarsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.avatarsCreateOrConnectWithoutOrganizationsInput | Prisma.avatarsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.avatarsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.avatarsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.avatarsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.avatarsWhereUniqueInput | Prisma.avatarsWhereUniqueInput[];
    disconnect?: Prisma.avatarsWhereUniqueInput | Prisma.avatarsWhereUniqueInput[];
    delete?: Prisma.avatarsWhereUniqueInput | Prisma.avatarsWhereUniqueInput[];
    connect?: Prisma.avatarsWhereUniqueInput | Prisma.avatarsWhereUniqueInput[];
    update?: Prisma.avatarsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.avatarsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.avatarsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.avatarsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.avatarsScalarWhereInput | Prisma.avatarsScalarWhereInput[];
};
export type Enumavatar_statusFieldUpdateOperationsInput = {
    set?: $Enums.avatar_status;
};
export type avatarsCreateWithoutOrganizationsInput = {
    id?: string;
    name: string;
    is_realistic?: boolean;
    default_colors?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    inspiration_image_url?: string | null;
    avatar_image_url: string;
    user_prompt?: string | null;
    system_prompt?: string | null;
    personality?: string | null;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: $Enums.avatar_status;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type avatarsUncheckedCreateWithoutOrganizationsInput = {
    id?: string;
    name: string;
    is_realistic?: boolean;
    default_colors?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    inspiration_image_url?: string | null;
    avatar_image_url: string;
    user_prompt?: string | null;
    system_prompt?: string | null;
    personality?: string | null;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: $Enums.avatar_status;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type avatarsCreateOrConnectWithoutOrganizationsInput = {
    where: Prisma.avatarsWhereUniqueInput;
    create: Prisma.XOR<Prisma.avatarsCreateWithoutOrganizationsInput, Prisma.avatarsUncheckedCreateWithoutOrganizationsInput>;
};
export type avatarsCreateManyOrganizationsInputEnvelope = {
    data: Prisma.avatarsCreateManyOrganizationsInput | Prisma.avatarsCreateManyOrganizationsInput[];
    skipDuplicates?: boolean;
};
export type avatarsUpsertWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.avatarsWhereUniqueInput;
    update: Prisma.XOR<Prisma.avatarsUpdateWithoutOrganizationsInput, Prisma.avatarsUncheckedUpdateWithoutOrganizationsInput>;
    create: Prisma.XOR<Prisma.avatarsCreateWithoutOrganizationsInput, Prisma.avatarsUncheckedCreateWithoutOrganizationsInput>;
};
export type avatarsUpdateWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.avatarsWhereUniqueInput;
    data: Prisma.XOR<Prisma.avatarsUpdateWithoutOrganizationsInput, Prisma.avatarsUncheckedUpdateWithoutOrganizationsInput>;
};
export type avatarsUpdateManyWithWhereWithoutOrganizationsInput = {
    where: Prisma.avatarsScalarWhereInput;
    data: Prisma.XOR<Prisma.avatarsUpdateManyMutationInput, Prisma.avatarsUncheckedUpdateManyWithoutOrganizationsInput>;
};
export type avatarsScalarWhereInput = {
    AND?: Prisma.avatarsScalarWhereInput | Prisma.avatarsScalarWhereInput[];
    OR?: Prisma.avatarsScalarWhereInput[];
    NOT?: Prisma.avatarsScalarWhereInput | Prisma.avatarsScalarWhereInput[];
    id?: Prisma.StringFilter<"avatars"> | string;
    organization_id?: Prisma.StringFilter<"avatars"> | string;
    name?: Prisma.StringFilter<"avatars"> | string;
    is_realistic?: Prisma.BoolFilter<"avatars"> | boolean;
    default_colors?: Prisma.JsonNullableFilter<"avatars">;
    inspiration_image_url?: Prisma.StringNullableFilter<"avatars"> | string | null;
    avatar_image_url?: Prisma.StringFilter<"avatars"> | string;
    user_prompt?: Prisma.StringNullableFilter<"avatars"> | string | null;
    system_prompt?: Prisma.StringNullableFilter<"avatars"> | string | null;
    personality?: Prisma.StringNullableFilter<"avatars"> | string | null;
    technical_metadata?: Prisma.JsonNullableFilter<"avatars">;
    status?: Prisma.Enumavatar_statusFilter<"avatars"> | $Enums.avatar_status;
    created_at?: Prisma.DateTimeFilter<"avatars"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"avatars"> | Date | string;
};
export type avatarsCreateManyOrganizationsInput = {
    id?: string;
    name: string;
    is_realistic?: boolean;
    default_colors?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    inspiration_image_url?: string | null;
    avatar_image_url: string;
    user_prompt?: string | null;
    system_prompt?: string | null;
    personality?: string | null;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: $Enums.avatar_status;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type avatarsUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    is_realistic?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    default_colors?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    inspiration_image_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatar_image_url?: Prisma.StringFieldUpdateOperationsInput | string;
    user_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    system_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    personality?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: Prisma.Enumavatar_statusFieldUpdateOperationsInput | $Enums.avatar_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type avatarsUncheckedUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    is_realistic?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    default_colors?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    inspiration_image_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatar_image_url?: Prisma.StringFieldUpdateOperationsInput | string;
    user_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    system_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    personality?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: Prisma.Enumavatar_statusFieldUpdateOperationsInput | $Enums.avatar_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type avatarsUncheckedUpdateManyWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    is_realistic?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    default_colors?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    inspiration_image_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    avatar_image_url?: Prisma.StringFieldUpdateOperationsInput | string;
    user_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    system_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    personality?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: Prisma.Enumavatar_statusFieldUpdateOperationsInput | $Enums.avatar_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type avatarsSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    organization_id?: boolean;
    name?: boolean;
    is_realistic?: boolean;
    default_colors?: boolean;
    inspiration_image_url?: boolean;
    avatar_image_url?: boolean;
    user_prompt?: boolean;
    system_prompt?: boolean;
    personality?: boolean;
    technical_metadata?: boolean;
    status?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["avatars"]>;
export type avatarsSelectScalar = {
    id?: boolean;
    organization_id?: boolean;
    name?: boolean;
    is_realistic?: boolean;
    default_colors?: boolean;
    inspiration_image_url?: boolean;
    avatar_image_url?: boolean;
    user_prompt?: boolean;
    system_prompt?: boolean;
    personality?: boolean;
    technical_metadata?: boolean;
    status?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
};
export type avatarsOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "organization_id" | "name" | "is_realistic" | "default_colors" | "inspiration_image_url" | "avatar_image_url" | "user_prompt" | "system_prompt" | "personality" | "technical_metadata" | "status" | "created_at" | "updated_at", ExtArgs["result"]["avatars"]>;
export type avatarsInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
};
export type $avatarsPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "avatars";
    objects: {
        organizations: Prisma.$organizationsPayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        organization_id: string;
        name: string;
        is_realistic: boolean;
        default_colors: runtime.JsonValue | null;
        inspiration_image_url: string | null;
        avatar_image_url: string;
        user_prompt: string | null;
        system_prompt: string | null;
        personality: string | null;
        technical_metadata: runtime.JsonValue | null;
        status: $Enums.avatar_status;
        created_at: Date;
        updated_at: Date;
    }, ExtArgs["result"]["avatars"]>;
    composites: {};
};
export type avatarsGetPayload<S extends boolean | null | undefined | avatarsDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$avatarsPayload, S>;
export type avatarsCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<avatarsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: AvatarsCountAggregateInputType | true;
};
export interface avatarsDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['avatars'];
        meta: {
            name: 'avatars';
        };
    };
    findUnique<T extends avatarsFindUniqueArgs>(args: Prisma.SelectSubset<T, avatarsFindUniqueArgs<ExtArgs>>): Prisma.Prisma__avatarsClient<runtime.Types.Result.GetResult<Prisma.$avatarsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends avatarsFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, avatarsFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__avatarsClient<runtime.Types.Result.GetResult<Prisma.$avatarsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends avatarsFindFirstArgs>(args?: Prisma.SelectSubset<T, avatarsFindFirstArgs<ExtArgs>>): Prisma.Prisma__avatarsClient<runtime.Types.Result.GetResult<Prisma.$avatarsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends avatarsFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, avatarsFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__avatarsClient<runtime.Types.Result.GetResult<Prisma.$avatarsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends avatarsFindManyArgs>(args?: Prisma.SelectSubset<T, avatarsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$avatarsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends avatarsCreateArgs>(args: Prisma.SelectSubset<T, avatarsCreateArgs<ExtArgs>>): Prisma.Prisma__avatarsClient<runtime.Types.Result.GetResult<Prisma.$avatarsPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends avatarsCreateManyArgs>(args?: Prisma.SelectSubset<T, avatarsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends avatarsDeleteArgs>(args: Prisma.SelectSubset<T, avatarsDeleteArgs<ExtArgs>>): Prisma.Prisma__avatarsClient<runtime.Types.Result.GetResult<Prisma.$avatarsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends avatarsUpdateArgs>(args: Prisma.SelectSubset<T, avatarsUpdateArgs<ExtArgs>>): Prisma.Prisma__avatarsClient<runtime.Types.Result.GetResult<Prisma.$avatarsPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends avatarsDeleteManyArgs>(args?: Prisma.SelectSubset<T, avatarsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends avatarsUpdateManyArgs>(args: Prisma.SelectSubset<T, avatarsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends avatarsUpsertArgs>(args: Prisma.SelectSubset<T, avatarsUpsertArgs<ExtArgs>>): Prisma.Prisma__avatarsClient<runtime.Types.Result.GetResult<Prisma.$avatarsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends avatarsCountArgs>(args?: Prisma.Subset<T, avatarsCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], AvatarsCountAggregateOutputType> : number>;
    aggregate<T extends AvatarsAggregateArgs>(args: Prisma.Subset<T, AvatarsAggregateArgs>): Prisma.PrismaPromise<GetAvatarsAggregateType<T>>;
    groupBy<T extends avatarsGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: avatarsGroupByArgs['orderBy'];
    } : {
        orderBy?: avatarsGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, avatarsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAvatarsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: avatarsFieldRefs;
}
export interface Prisma__avatarsClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    organizations<T extends Prisma.organizationsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.organizationsDefaultArgs<ExtArgs>>): Prisma.Prisma__organizationsClient<runtime.Types.Result.GetResult<Prisma.$organizationsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface avatarsFieldRefs {
    readonly id: Prisma.FieldRef<"avatars", 'String'>;
    readonly organization_id: Prisma.FieldRef<"avatars", 'String'>;
    readonly name: Prisma.FieldRef<"avatars", 'String'>;
    readonly is_realistic: Prisma.FieldRef<"avatars", 'Boolean'>;
    readonly default_colors: Prisma.FieldRef<"avatars", 'Json'>;
    readonly inspiration_image_url: Prisma.FieldRef<"avatars", 'String'>;
    readonly avatar_image_url: Prisma.FieldRef<"avatars", 'String'>;
    readonly user_prompt: Prisma.FieldRef<"avatars", 'String'>;
    readonly system_prompt: Prisma.FieldRef<"avatars", 'String'>;
    readonly personality: Prisma.FieldRef<"avatars", 'String'>;
    readonly technical_metadata: Prisma.FieldRef<"avatars", 'Json'>;
    readonly status: Prisma.FieldRef<"avatars", 'avatar_status'>;
    readonly created_at: Prisma.FieldRef<"avatars", 'DateTime'>;
    readonly updated_at: Prisma.FieldRef<"avatars", 'DateTime'>;
}
export type avatarsFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.avatarsSelect<ExtArgs> | null;
    omit?: Prisma.avatarsOmit<ExtArgs> | null;
    include?: Prisma.avatarsInclude<ExtArgs> | null;
    where: Prisma.avatarsWhereUniqueInput;
};
export type avatarsFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.avatarsSelect<ExtArgs> | null;
    omit?: Prisma.avatarsOmit<ExtArgs> | null;
    include?: Prisma.avatarsInclude<ExtArgs> | null;
    where: Prisma.avatarsWhereUniqueInput;
};
export type avatarsFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.avatarsSelect<ExtArgs> | null;
    omit?: Prisma.avatarsOmit<ExtArgs> | null;
    include?: Prisma.avatarsInclude<ExtArgs> | null;
    where?: Prisma.avatarsWhereInput;
    orderBy?: Prisma.avatarsOrderByWithRelationInput | Prisma.avatarsOrderByWithRelationInput[];
    cursor?: Prisma.avatarsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.AvatarsScalarFieldEnum | Prisma.AvatarsScalarFieldEnum[];
};
export type avatarsFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.avatarsSelect<ExtArgs> | null;
    omit?: Prisma.avatarsOmit<ExtArgs> | null;
    include?: Prisma.avatarsInclude<ExtArgs> | null;
    where?: Prisma.avatarsWhereInput;
    orderBy?: Prisma.avatarsOrderByWithRelationInput | Prisma.avatarsOrderByWithRelationInput[];
    cursor?: Prisma.avatarsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.AvatarsScalarFieldEnum | Prisma.AvatarsScalarFieldEnum[];
};
export type avatarsFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.avatarsSelect<ExtArgs> | null;
    omit?: Prisma.avatarsOmit<ExtArgs> | null;
    include?: Prisma.avatarsInclude<ExtArgs> | null;
    where?: Prisma.avatarsWhereInput;
    orderBy?: Prisma.avatarsOrderByWithRelationInput | Prisma.avatarsOrderByWithRelationInput[];
    cursor?: Prisma.avatarsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.AvatarsScalarFieldEnum | Prisma.AvatarsScalarFieldEnum[];
};
export type avatarsCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.avatarsSelect<ExtArgs> | null;
    omit?: Prisma.avatarsOmit<ExtArgs> | null;
    include?: Prisma.avatarsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.avatarsCreateInput, Prisma.avatarsUncheckedCreateInput>;
};
export type avatarsCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.avatarsCreateManyInput | Prisma.avatarsCreateManyInput[];
    skipDuplicates?: boolean;
};
export type avatarsUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.avatarsSelect<ExtArgs> | null;
    omit?: Prisma.avatarsOmit<ExtArgs> | null;
    include?: Prisma.avatarsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.avatarsUpdateInput, Prisma.avatarsUncheckedUpdateInput>;
    where: Prisma.avatarsWhereUniqueInput;
};
export type avatarsUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.avatarsUpdateManyMutationInput, Prisma.avatarsUncheckedUpdateManyInput>;
    where?: Prisma.avatarsWhereInput;
    limit?: number;
};
export type avatarsUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.avatarsSelect<ExtArgs> | null;
    omit?: Prisma.avatarsOmit<ExtArgs> | null;
    include?: Prisma.avatarsInclude<ExtArgs> | null;
    where: Prisma.avatarsWhereUniqueInput;
    create: Prisma.XOR<Prisma.avatarsCreateInput, Prisma.avatarsUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.avatarsUpdateInput, Prisma.avatarsUncheckedUpdateInput>;
};
export type avatarsDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.avatarsSelect<ExtArgs> | null;
    omit?: Prisma.avatarsOmit<ExtArgs> | null;
    include?: Prisma.avatarsInclude<ExtArgs> | null;
    where: Prisma.avatarsWhereUniqueInput;
};
export type avatarsDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.avatarsWhereInput;
    limit?: number;
};
export type avatarsDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.avatarsSelect<ExtArgs> | null;
    omit?: Prisma.avatarsOmit<ExtArgs> | null;
    include?: Prisma.avatarsInclude<ExtArgs> | null;
};
export {};
