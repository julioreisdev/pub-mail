import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type avatar_generationsModel = runtime.Types.Result.DefaultSelection<Prisma.$avatar_generationsPayload>;
export type AggregateAvatar_generations = {
    _count: Avatar_generationsCountAggregateOutputType | null;
    _avg: Avatar_generationsAvgAggregateOutputType | null;
    _sum: Avatar_generationsSumAggregateOutputType | null;
    _min: Avatar_generationsMinAggregateOutputType | null;
    _max: Avatar_generationsMaxAggregateOutputType | null;
};
export type Avatar_generationsAvgAggregateOutputType = {
    tokens_cost: number | null;
};
export type Avatar_generationsSumAggregateOutputType = {
    tokens_cost: number | null;
};
export type Avatar_generationsMinAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    user_prompt: string | null;
    system_prompt: string | null;
    is_realistic: boolean | null;
    inspiration_image_url: string | null;
    result_image_url: string | null;
    tokens_cost: number | null;
    created_at: Date | null;
};
export type Avatar_generationsMaxAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    user_prompt: string | null;
    system_prompt: string | null;
    is_realistic: boolean | null;
    inspiration_image_url: string | null;
    result_image_url: string | null;
    tokens_cost: number | null;
    created_at: Date | null;
};
export type Avatar_generationsCountAggregateOutputType = {
    id: number;
    organization_id: number;
    user_prompt: number;
    system_prompt: number;
    is_realistic: number;
    inspiration_image_url: number;
    result_image_url: number;
    technical_metadata: number;
    tokens_cost: number;
    created_at: number;
    _all: number;
};
export type Avatar_generationsAvgAggregateInputType = {
    tokens_cost?: true;
};
export type Avatar_generationsSumAggregateInputType = {
    tokens_cost?: true;
};
export type Avatar_generationsMinAggregateInputType = {
    id?: true;
    organization_id?: true;
    user_prompt?: true;
    system_prompt?: true;
    is_realistic?: true;
    inspiration_image_url?: true;
    result_image_url?: true;
    tokens_cost?: true;
    created_at?: true;
};
export type Avatar_generationsMaxAggregateInputType = {
    id?: true;
    organization_id?: true;
    user_prompt?: true;
    system_prompt?: true;
    is_realistic?: true;
    inspiration_image_url?: true;
    result_image_url?: true;
    tokens_cost?: true;
    created_at?: true;
};
export type Avatar_generationsCountAggregateInputType = {
    id?: true;
    organization_id?: true;
    user_prompt?: true;
    system_prompt?: true;
    is_realistic?: true;
    inspiration_image_url?: true;
    result_image_url?: true;
    technical_metadata?: true;
    tokens_cost?: true;
    created_at?: true;
    _all?: true;
};
export type Avatar_generationsAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.avatar_generationsWhereInput;
    orderBy?: Prisma.avatar_generationsOrderByWithRelationInput | Prisma.avatar_generationsOrderByWithRelationInput[];
    cursor?: Prisma.avatar_generationsWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | Avatar_generationsCountAggregateInputType;
    _avg?: Avatar_generationsAvgAggregateInputType;
    _sum?: Avatar_generationsSumAggregateInputType;
    _min?: Avatar_generationsMinAggregateInputType;
    _max?: Avatar_generationsMaxAggregateInputType;
};
export type GetAvatar_generationsAggregateType<T extends Avatar_generationsAggregateArgs> = {
    [P in keyof T & keyof AggregateAvatar_generations]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateAvatar_generations[P]> : Prisma.GetScalarType<T[P], AggregateAvatar_generations[P]>;
};
export type avatar_generationsGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.avatar_generationsWhereInput;
    orderBy?: Prisma.avatar_generationsOrderByWithAggregationInput | Prisma.avatar_generationsOrderByWithAggregationInput[];
    by: Prisma.Avatar_generationsScalarFieldEnum[] | Prisma.Avatar_generationsScalarFieldEnum;
    having?: Prisma.avatar_generationsScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: Avatar_generationsCountAggregateInputType | true;
    _avg?: Avatar_generationsAvgAggregateInputType;
    _sum?: Avatar_generationsSumAggregateInputType;
    _min?: Avatar_generationsMinAggregateInputType;
    _max?: Avatar_generationsMaxAggregateInputType;
};
export type Avatar_generationsGroupByOutputType = {
    id: string;
    organization_id: string;
    user_prompt: string | null;
    system_prompt: string | null;
    is_realistic: boolean;
    inspiration_image_url: string | null;
    result_image_url: string;
    technical_metadata: runtime.JsonValue | null;
    tokens_cost: number;
    created_at: Date;
    _count: Avatar_generationsCountAggregateOutputType | null;
    _avg: Avatar_generationsAvgAggregateOutputType | null;
    _sum: Avatar_generationsSumAggregateOutputType | null;
    _min: Avatar_generationsMinAggregateOutputType | null;
    _max: Avatar_generationsMaxAggregateOutputType | null;
};
type GetAvatar_generationsGroupByPayload<T extends avatar_generationsGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<Avatar_generationsGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof Avatar_generationsGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], Avatar_generationsGroupByOutputType[P]> : Prisma.GetScalarType<T[P], Avatar_generationsGroupByOutputType[P]>;
}>>;
export type avatar_generationsWhereInput = {
    AND?: Prisma.avatar_generationsWhereInput | Prisma.avatar_generationsWhereInput[];
    OR?: Prisma.avatar_generationsWhereInput[];
    NOT?: Prisma.avatar_generationsWhereInput | Prisma.avatar_generationsWhereInput[];
    id?: Prisma.StringFilter<"avatar_generations"> | string;
    organization_id?: Prisma.StringFilter<"avatar_generations"> | string;
    user_prompt?: Prisma.StringNullableFilter<"avatar_generations"> | string | null;
    system_prompt?: Prisma.StringNullableFilter<"avatar_generations"> | string | null;
    is_realistic?: Prisma.BoolFilter<"avatar_generations"> | boolean;
    inspiration_image_url?: Prisma.StringNullableFilter<"avatar_generations"> | string | null;
    result_image_url?: Prisma.StringFilter<"avatar_generations"> | string;
    technical_metadata?: Prisma.JsonNullableFilter<"avatar_generations">;
    tokens_cost?: Prisma.IntFilter<"avatar_generations"> | number;
    created_at?: Prisma.DateTimeFilter<"avatar_generations"> | Date | string;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
};
export type avatar_generationsOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    user_prompt?: Prisma.SortOrderInput | Prisma.SortOrder;
    system_prompt?: Prisma.SortOrderInput | Prisma.SortOrder;
    is_realistic?: Prisma.SortOrder;
    inspiration_image_url?: Prisma.SortOrderInput | Prisma.SortOrder;
    result_image_url?: Prisma.SortOrder;
    technical_metadata?: Prisma.SortOrderInput | Prisma.SortOrder;
    tokens_cost?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    organizations?: Prisma.organizationsOrderByWithRelationInput;
    _relevance?: Prisma.avatar_generationsOrderByRelevanceInput;
};
export type avatar_generationsWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    AND?: Prisma.avatar_generationsWhereInput | Prisma.avatar_generationsWhereInput[];
    OR?: Prisma.avatar_generationsWhereInput[];
    NOT?: Prisma.avatar_generationsWhereInput | Prisma.avatar_generationsWhereInput[];
    organization_id?: Prisma.StringFilter<"avatar_generations"> | string;
    user_prompt?: Prisma.StringNullableFilter<"avatar_generations"> | string | null;
    system_prompt?: Prisma.StringNullableFilter<"avatar_generations"> | string | null;
    is_realistic?: Prisma.BoolFilter<"avatar_generations"> | boolean;
    inspiration_image_url?: Prisma.StringNullableFilter<"avatar_generations"> | string | null;
    result_image_url?: Prisma.StringFilter<"avatar_generations"> | string;
    technical_metadata?: Prisma.JsonNullableFilter<"avatar_generations">;
    tokens_cost?: Prisma.IntFilter<"avatar_generations"> | number;
    created_at?: Prisma.DateTimeFilter<"avatar_generations"> | Date | string;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
}, "id">;
export type avatar_generationsOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    user_prompt?: Prisma.SortOrderInput | Prisma.SortOrder;
    system_prompt?: Prisma.SortOrderInput | Prisma.SortOrder;
    is_realistic?: Prisma.SortOrder;
    inspiration_image_url?: Prisma.SortOrderInput | Prisma.SortOrder;
    result_image_url?: Prisma.SortOrder;
    technical_metadata?: Prisma.SortOrderInput | Prisma.SortOrder;
    tokens_cost?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    _count?: Prisma.avatar_generationsCountOrderByAggregateInput;
    _avg?: Prisma.avatar_generationsAvgOrderByAggregateInput;
    _max?: Prisma.avatar_generationsMaxOrderByAggregateInput;
    _min?: Prisma.avatar_generationsMinOrderByAggregateInput;
    _sum?: Prisma.avatar_generationsSumOrderByAggregateInput;
};
export type avatar_generationsScalarWhereWithAggregatesInput = {
    AND?: Prisma.avatar_generationsScalarWhereWithAggregatesInput | Prisma.avatar_generationsScalarWhereWithAggregatesInput[];
    OR?: Prisma.avatar_generationsScalarWhereWithAggregatesInput[];
    NOT?: Prisma.avatar_generationsScalarWhereWithAggregatesInput | Prisma.avatar_generationsScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"avatar_generations"> | string;
    organization_id?: Prisma.StringWithAggregatesFilter<"avatar_generations"> | string;
    user_prompt?: Prisma.StringNullableWithAggregatesFilter<"avatar_generations"> | string | null;
    system_prompt?: Prisma.StringNullableWithAggregatesFilter<"avatar_generations"> | string | null;
    is_realistic?: Prisma.BoolWithAggregatesFilter<"avatar_generations"> | boolean;
    inspiration_image_url?: Prisma.StringNullableWithAggregatesFilter<"avatar_generations"> | string | null;
    result_image_url?: Prisma.StringWithAggregatesFilter<"avatar_generations"> | string;
    technical_metadata?: Prisma.JsonNullableWithAggregatesFilter<"avatar_generations">;
    tokens_cost?: Prisma.IntWithAggregatesFilter<"avatar_generations"> | number;
    created_at?: Prisma.DateTimeWithAggregatesFilter<"avatar_generations"> | Date | string;
};
export type avatar_generationsCreateInput = {
    id?: string;
    user_prompt?: string | null;
    system_prompt?: string | null;
    is_realistic: boolean;
    inspiration_image_url?: string | null;
    result_image_url: string;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    tokens_cost?: number;
    created_at?: Date | string;
    organizations: Prisma.organizationsCreateNestedOneWithoutAvatar_generationsInput;
};
export type avatar_generationsUncheckedCreateInput = {
    id?: string;
    organization_id: string;
    user_prompt?: string | null;
    system_prompt?: string | null;
    is_realistic: boolean;
    inspiration_image_url?: string | null;
    result_image_url: string;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    tokens_cost?: number;
    created_at?: Date | string;
};
export type avatar_generationsUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    system_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    is_realistic?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    inspiration_image_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    result_image_url?: Prisma.StringFieldUpdateOperationsInput | string;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    tokens_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutAvatar_generationsNestedInput;
};
export type avatar_generationsUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    system_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    is_realistic?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    inspiration_image_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    result_image_url?: Prisma.StringFieldUpdateOperationsInput | string;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    tokens_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type avatar_generationsCreateManyInput = {
    id?: string;
    organization_id: string;
    user_prompt?: string | null;
    system_prompt?: string | null;
    is_realistic: boolean;
    inspiration_image_url?: string | null;
    result_image_url: string;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    tokens_cost?: number;
    created_at?: Date | string;
};
export type avatar_generationsUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    system_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    is_realistic?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    inspiration_image_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    result_image_url?: Prisma.StringFieldUpdateOperationsInput | string;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    tokens_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type avatar_generationsUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    system_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    is_realistic?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    inspiration_image_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    result_image_url?: Prisma.StringFieldUpdateOperationsInput | string;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    tokens_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type Avatar_generationsListRelationFilter = {
    every?: Prisma.avatar_generationsWhereInput;
    some?: Prisma.avatar_generationsWhereInput;
    none?: Prisma.avatar_generationsWhereInput;
};
export type avatar_generationsOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type avatar_generationsOrderByRelevanceInput = {
    fields: Prisma.avatar_generationsOrderByRelevanceFieldEnum | Prisma.avatar_generationsOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type avatar_generationsCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    user_prompt?: Prisma.SortOrder;
    system_prompt?: Prisma.SortOrder;
    is_realistic?: Prisma.SortOrder;
    inspiration_image_url?: Prisma.SortOrder;
    result_image_url?: Prisma.SortOrder;
    technical_metadata?: Prisma.SortOrder;
    tokens_cost?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
};
export type avatar_generationsAvgOrderByAggregateInput = {
    tokens_cost?: Prisma.SortOrder;
};
export type avatar_generationsMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    user_prompt?: Prisma.SortOrder;
    system_prompt?: Prisma.SortOrder;
    is_realistic?: Prisma.SortOrder;
    inspiration_image_url?: Prisma.SortOrder;
    result_image_url?: Prisma.SortOrder;
    tokens_cost?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
};
export type avatar_generationsMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    user_prompt?: Prisma.SortOrder;
    system_prompt?: Prisma.SortOrder;
    is_realistic?: Prisma.SortOrder;
    inspiration_image_url?: Prisma.SortOrder;
    result_image_url?: Prisma.SortOrder;
    tokens_cost?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
};
export type avatar_generationsSumOrderByAggregateInput = {
    tokens_cost?: Prisma.SortOrder;
};
export type avatar_generationsCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.avatar_generationsCreateWithoutOrganizationsInput, Prisma.avatar_generationsUncheckedCreateWithoutOrganizationsInput> | Prisma.avatar_generationsCreateWithoutOrganizationsInput[] | Prisma.avatar_generationsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.avatar_generationsCreateOrConnectWithoutOrganizationsInput | Prisma.avatar_generationsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.avatar_generationsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.avatar_generationsWhereUniqueInput | Prisma.avatar_generationsWhereUniqueInput[];
};
export type avatar_generationsUncheckedCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.avatar_generationsCreateWithoutOrganizationsInput, Prisma.avatar_generationsUncheckedCreateWithoutOrganizationsInput> | Prisma.avatar_generationsCreateWithoutOrganizationsInput[] | Prisma.avatar_generationsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.avatar_generationsCreateOrConnectWithoutOrganizationsInput | Prisma.avatar_generationsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.avatar_generationsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.avatar_generationsWhereUniqueInput | Prisma.avatar_generationsWhereUniqueInput[];
};
export type avatar_generationsUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.avatar_generationsCreateWithoutOrganizationsInput, Prisma.avatar_generationsUncheckedCreateWithoutOrganizationsInput> | Prisma.avatar_generationsCreateWithoutOrganizationsInput[] | Prisma.avatar_generationsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.avatar_generationsCreateOrConnectWithoutOrganizationsInput | Prisma.avatar_generationsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.avatar_generationsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.avatar_generationsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.avatar_generationsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.avatar_generationsWhereUniqueInput | Prisma.avatar_generationsWhereUniqueInput[];
    disconnect?: Prisma.avatar_generationsWhereUniqueInput | Prisma.avatar_generationsWhereUniqueInput[];
    delete?: Prisma.avatar_generationsWhereUniqueInput | Prisma.avatar_generationsWhereUniqueInput[];
    connect?: Prisma.avatar_generationsWhereUniqueInput | Prisma.avatar_generationsWhereUniqueInput[];
    update?: Prisma.avatar_generationsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.avatar_generationsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.avatar_generationsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.avatar_generationsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.avatar_generationsScalarWhereInput | Prisma.avatar_generationsScalarWhereInput[];
};
export type avatar_generationsUncheckedUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.avatar_generationsCreateWithoutOrganizationsInput, Prisma.avatar_generationsUncheckedCreateWithoutOrganizationsInput> | Prisma.avatar_generationsCreateWithoutOrganizationsInput[] | Prisma.avatar_generationsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.avatar_generationsCreateOrConnectWithoutOrganizationsInput | Prisma.avatar_generationsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.avatar_generationsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.avatar_generationsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.avatar_generationsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.avatar_generationsWhereUniqueInput | Prisma.avatar_generationsWhereUniqueInput[];
    disconnect?: Prisma.avatar_generationsWhereUniqueInput | Prisma.avatar_generationsWhereUniqueInput[];
    delete?: Prisma.avatar_generationsWhereUniqueInput | Prisma.avatar_generationsWhereUniqueInput[];
    connect?: Prisma.avatar_generationsWhereUniqueInput | Prisma.avatar_generationsWhereUniqueInput[];
    update?: Prisma.avatar_generationsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.avatar_generationsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.avatar_generationsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.avatar_generationsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.avatar_generationsScalarWhereInput | Prisma.avatar_generationsScalarWhereInput[];
};
export type avatar_generationsCreateWithoutOrganizationsInput = {
    id?: string;
    user_prompt?: string | null;
    system_prompt?: string | null;
    is_realistic: boolean;
    inspiration_image_url?: string | null;
    result_image_url: string;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    tokens_cost?: number;
    created_at?: Date | string;
};
export type avatar_generationsUncheckedCreateWithoutOrganizationsInput = {
    id?: string;
    user_prompt?: string | null;
    system_prompt?: string | null;
    is_realistic: boolean;
    inspiration_image_url?: string | null;
    result_image_url: string;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    tokens_cost?: number;
    created_at?: Date | string;
};
export type avatar_generationsCreateOrConnectWithoutOrganizationsInput = {
    where: Prisma.avatar_generationsWhereUniqueInput;
    create: Prisma.XOR<Prisma.avatar_generationsCreateWithoutOrganizationsInput, Prisma.avatar_generationsUncheckedCreateWithoutOrganizationsInput>;
};
export type avatar_generationsCreateManyOrganizationsInputEnvelope = {
    data: Prisma.avatar_generationsCreateManyOrganizationsInput | Prisma.avatar_generationsCreateManyOrganizationsInput[];
    skipDuplicates?: boolean;
};
export type avatar_generationsUpsertWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.avatar_generationsWhereUniqueInput;
    update: Prisma.XOR<Prisma.avatar_generationsUpdateWithoutOrganizationsInput, Prisma.avatar_generationsUncheckedUpdateWithoutOrganizationsInput>;
    create: Prisma.XOR<Prisma.avatar_generationsCreateWithoutOrganizationsInput, Prisma.avatar_generationsUncheckedCreateWithoutOrganizationsInput>;
};
export type avatar_generationsUpdateWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.avatar_generationsWhereUniqueInput;
    data: Prisma.XOR<Prisma.avatar_generationsUpdateWithoutOrganizationsInput, Prisma.avatar_generationsUncheckedUpdateWithoutOrganizationsInput>;
};
export type avatar_generationsUpdateManyWithWhereWithoutOrganizationsInput = {
    where: Prisma.avatar_generationsScalarWhereInput;
    data: Prisma.XOR<Prisma.avatar_generationsUpdateManyMutationInput, Prisma.avatar_generationsUncheckedUpdateManyWithoutOrganizationsInput>;
};
export type avatar_generationsScalarWhereInput = {
    AND?: Prisma.avatar_generationsScalarWhereInput | Prisma.avatar_generationsScalarWhereInput[];
    OR?: Prisma.avatar_generationsScalarWhereInput[];
    NOT?: Prisma.avatar_generationsScalarWhereInput | Prisma.avatar_generationsScalarWhereInput[];
    id?: Prisma.StringFilter<"avatar_generations"> | string;
    organization_id?: Prisma.StringFilter<"avatar_generations"> | string;
    user_prompt?: Prisma.StringNullableFilter<"avatar_generations"> | string | null;
    system_prompt?: Prisma.StringNullableFilter<"avatar_generations"> | string | null;
    is_realistic?: Prisma.BoolFilter<"avatar_generations"> | boolean;
    inspiration_image_url?: Prisma.StringNullableFilter<"avatar_generations"> | string | null;
    result_image_url?: Prisma.StringFilter<"avatar_generations"> | string;
    technical_metadata?: Prisma.JsonNullableFilter<"avatar_generations">;
    tokens_cost?: Prisma.IntFilter<"avatar_generations"> | number;
    created_at?: Prisma.DateTimeFilter<"avatar_generations"> | Date | string;
};
export type avatar_generationsCreateManyOrganizationsInput = {
    id?: string;
    user_prompt?: string | null;
    system_prompt?: string | null;
    is_realistic: boolean;
    inspiration_image_url?: string | null;
    result_image_url: string;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    tokens_cost?: number;
    created_at?: Date | string;
};
export type avatar_generationsUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    system_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    is_realistic?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    inspiration_image_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    result_image_url?: Prisma.StringFieldUpdateOperationsInput | string;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    tokens_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type avatar_generationsUncheckedUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    system_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    is_realistic?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    inspiration_image_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    result_image_url?: Prisma.StringFieldUpdateOperationsInput | string;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    tokens_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type avatar_generationsUncheckedUpdateManyWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    system_prompt?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    is_realistic?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    inspiration_image_url?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    result_image_url?: Prisma.StringFieldUpdateOperationsInput | string;
    technical_metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    tokens_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type avatar_generationsSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    organization_id?: boolean;
    user_prompt?: boolean;
    system_prompt?: boolean;
    is_realistic?: boolean;
    inspiration_image_url?: boolean;
    result_image_url?: boolean;
    technical_metadata?: boolean;
    tokens_cost?: boolean;
    created_at?: boolean;
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["avatar_generations"]>;
export type avatar_generationsSelectScalar = {
    id?: boolean;
    organization_id?: boolean;
    user_prompt?: boolean;
    system_prompt?: boolean;
    is_realistic?: boolean;
    inspiration_image_url?: boolean;
    result_image_url?: boolean;
    technical_metadata?: boolean;
    tokens_cost?: boolean;
    created_at?: boolean;
};
export type avatar_generationsOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "organization_id" | "user_prompt" | "system_prompt" | "is_realistic" | "inspiration_image_url" | "result_image_url" | "technical_metadata" | "tokens_cost" | "created_at", ExtArgs["result"]["avatar_generations"]>;
export type avatar_generationsInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
};
export type $avatar_generationsPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "avatar_generations";
    objects: {
        organizations: Prisma.$organizationsPayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        organization_id: string;
        user_prompt: string | null;
        system_prompt: string | null;
        is_realistic: boolean;
        inspiration_image_url: string | null;
        result_image_url: string;
        technical_metadata: runtime.JsonValue | null;
        tokens_cost: number;
        created_at: Date;
    }, ExtArgs["result"]["avatar_generations"]>;
    composites: {};
};
export type avatar_generationsGetPayload<S extends boolean | null | undefined | avatar_generationsDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$avatar_generationsPayload, S>;
export type avatar_generationsCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<avatar_generationsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: Avatar_generationsCountAggregateInputType | true;
};
export interface avatar_generationsDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['avatar_generations'];
        meta: {
            name: 'avatar_generations';
        };
    };
    findUnique<T extends avatar_generationsFindUniqueArgs>(args: Prisma.SelectSubset<T, avatar_generationsFindUniqueArgs<ExtArgs>>): Prisma.Prisma__avatar_generationsClient<runtime.Types.Result.GetResult<Prisma.$avatar_generationsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends avatar_generationsFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, avatar_generationsFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__avatar_generationsClient<runtime.Types.Result.GetResult<Prisma.$avatar_generationsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends avatar_generationsFindFirstArgs>(args?: Prisma.SelectSubset<T, avatar_generationsFindFirstArgs<ExtArgs>>): Prisma.Prisma__avatar_generationsClient<runtime.Types.Result.GetResult<Prisma.$avatar_generationsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends avatar_generationsFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, avatar_generationsFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__avatar_generationsClient<runtime.Types.Result.GetResult<Prisma.$avatar_generationsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends avatar_generationsFindManyArgs>(args?: Prisma.SelectSubset<T, avatar_generationsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$avatar_generationsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends avatar_generationsCreateArgs>(args: Prisma.SelectSubset<T, avatar_generationsCreateArgs<ExtArgs>>): Prisma.Prisma__avatar_generationsClient<runtime.Types.Result.GetResult<Prisma.$avatar_generationsPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends avatar_generationsCreateManyArgs>(args?: Prisma.SelectSubset<T, avatar_generationsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends avatar_generationsDeleteArgs>(args: Prisma.SelectSubset<T, avatar_generationsDeleteArgs<ExtArgs>>): Prisma.Prisma__avatar_generationsClient<runtime.Types.Result.GetResult<Prisma.$avatar_generationsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends avatar_generationsUpdateArgs>(args: Prisma.SelectSubset<T, avatar_generationsUpdateArgs<ExtArgs>>): Prisma.Prisma__avatar_generationsClient<runtime.Types.Result.GetResult<Prisma.$avatar_generationsPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends avatar_generationsDeleteManyArgs>(args?: Prisma.SelectSubset<T, avatar_generationsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends avatar_generationsUpdateManyArgs>(args: Prisma.SelectSubset<T, avatar_generationsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends avatar_generationsUpsertArgs>(args: Prisma.SelectSubset<T, avatar_generationsUpsertArgs<ExtArgs>>): Prisma.Prisma__avatar_generationsClient<runtime.Types.Result.GetResult<Prisma.$avatar_generationsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends avatar_generationsCountArgs>(args?: Prisma.Subset<T, avatar_generationsCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], Avatar_generationsCountAggregateOutputType> : number>;
    aggregate<T extends Avatar_generationsAggregateArgs>(args: Prisma.Subset<T, Avatar_generationsAggregateArgs>): Prisma.PrismaPromise<GetAvatar_generationsAggregateType<T>>;
    groupBy<T extends avatar_generationsGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: avatar_generationsGroupByArgs['orderBy'];
    } : {
        orderBy?: avatar_generationsGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, avatar_generationsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAvatar_generationsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: avatar_generationsFieldRefs;
}
export interface Prisma__avatar_generationsClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    organizations<T extends Prisma.organizationsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.organizationsDefaultArgs<ExtArgs>>): Prisma.Prisma__organizationsClient<runtime.Types.Result.GetResult<Prisma.$organizationsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface avatar_generationsFieldRefs {
    readonly id: Prisma.FieldRef<"avatar_generations", 'String'>;
    readonly organization_id: Prisma.FieldRef<"avatar_generations", 'String'>;
    readonly user_prompt: Prisma.FieldRef<"avatar_generations", 'String'>;
    readonly system_prompt: Prisma.FieldRef<"avatar_generations", 'String'>;
    readonly is_realistic: Prisma.FieldRef<"avatar_generations", 'Boolean'>;
    readonly inspiration_image_url: Prisma.FieldRef<"avatar_generations", 'String'>;
    readonly result_image_url: Prisma.FieldRef<"avatar_generations", 'String'>;
    readonly technical_metadata: Prisma.FieldRef<"avatar_generations", 'Json'>;
    readonly tokens_cost: Prisma.FieldRef<"avatar_generations", 'Int'>;
    readonly created_at: Prisma.FieldRef<"avatar_generations", 'DateTime'>;
}
export type avatar_generationsFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.avatar_generationsSelect<ExtArgs> | null;
    omit?: Prisma.avatar_generationsOmit<ExtArgs> | null;
    include?: Prisma.avatar_generationsInclude<ExtArgs> | null;
    where: Prisma.avatar_generationsWhereUniqueInput;
};
export type avatar_generationsFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.avatar_generationsSelect<ExtArgs> | null;
    omit?: Prisma.avatar_generationsOmit<ExtArgs> | null;
    include?: Prisma.avatar_generationsInclude<ExtArgs> | null;
    where: Prisma.avatar_generationsWhereUniqueInput;
};
export type avatar_generationsFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.avatar_generationsSelect<ExtArgs> | null;
    omit?: Prisma.avatar_generationsOmit<ExtArgs> | null;
    include?: Prisma.avatar_generationsInclude<ExtArgs> | null;
    where?: Prisma.avatar_generationsWhereInput;
    orderBy?: Prisma.avatar_generationsOrderByWithRelationInput | Prisma.avatar_generationsOrderByWithRelationInput[];
    cursor?: Prisma.avatar_generationsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Avatar_generationsScalarFieldEnum | Prisma.Avatar_generationsScalarFieldEnum[];
};
export type avatar_generationsFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.avatar_generationsSelect<ExtArgs> | null;
    omit?: Prisma.avatar_generationsOmit<ExtArgs> | null;
    include?: Prisma.avatar_generationsInclude<ExtArgs> | null;
    where?: Prisma.avatar_generationsWhereInput;
    orderBy?: Prisma.avatar_generationsOrderByWithRelationInput | Prisma.avatar_generationsOrderByWithRelationInput[];
    cursor?: Prisma.avatar_generationsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Avatar_generationsScalarFieldEnum | Prisma.Avatar_generationsScalarFieldEnum[];
};
export type avatar_generationsFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.avatar_generationsSelect<ExtArgs> | null;
    omit?: Prisma.avatar_generationsOmit<ExtArgs> | null;
    include?: Prisma.avatar_generationsInclude<ExtArgs> | null;
    where?: Prisma.avatar_generationsWhereInput;
    orderBy?: Prisma.avatar_generationsOrderByWithRelationInput | Prisma.avatar_generationsOrderByWithRelationInput[];
    cursor?: Prisma.avatar_generationsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Avatar_generationsScalarFieldEnum | Prisma.Avatar_generationsScalarFieldEnum[];
};
export type avatar_generationsCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.avatar_generationsSelect<ExtArgs> | null;
    omit?: Prisma.avatar_generationsOmit<ExtArgs> | null;
    include?: Prisma.avatar_generationsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.avatar_generationsCreateInput, Prisma.avatar_generationsUncheckedCreateInput>;
};
export type avatar_generationsCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.avatar_generationsCreateManyInput | Prisma.avatar_generationsCreateManyInput[];
    skipDuplicates?: boolean;
};
export type avatar_generationsUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.avatar_generationsSelect<ExtArgs> | null;
    omit?: Prisma.avatar_generationsOmit<ExtArgs> | null;
    include?: Prisma.avatar_generationsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.avatar_generationsUpdateInput, Prisma.avatar_generationsUncheckedUpdateInput>;
    where: Prisma.avatar_generationsWhereUniqueInput;
};
export type avatar_generationsUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.avatar_generationsUpdateManyMutationInput, Prisma.avatar_generationsUncheckedUpdateManyInput>;
    where?: Prisma.avatar_generationsWhereInput;
    limit?: number;
};
export type avatar_generationsUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.avatar_generationsSelect<ExtArgs> | null;
    omit?: Prisma.avatar_generationsOmit<ExtArgs> | null;
    include?: Prisma.avatar_generationsInclude<ExtArgs> | null;
    where: Prisma.avatar_generationsWhereUniqueInput;
    create: Prisma.XOR<Prisma.avatar_generationsCreateInput, Prisma.avatar_generationsUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.avatar_generationsUpdateInput, Prisma.avatar_generationsUncheckedUpdateInput>;
};
export type avatar_generationsDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.avatar_generationsSelect<ExtArgs> | null;
    omit?: Prisma.avatar_generationsOmit<ExtArgs> | null;
    include?: Prisma.avatar_generationsInclude<ExtArgs> | null;
    where: Prisma.avatar_generationsWhereUniqueInput;
};
export type avatar_generationsDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.avatar_generationsWhereInput;
    limit?: number;
};
export type avatar_generationsDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.avatar_generationsSelect<ExtArgs> | null;
    omit?: Prisma.avatar_generationsOmit<ExtArgs> | null;
    include?: Prisma.avatar_generationsInclude<ExtArgs> | null;
};
export {};
