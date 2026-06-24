import type * as runtime from "@prisma/client/runtime/client";
import type * as $Enums from "../enums.js";
import type * as Prisma from "../internal/prismaNamespace.js";
export type postsModel = runtime.Types.Result.DefaultSelection<Prisma.$postsPayload>;
export type AggregatePosts = {
    _count: PostsCountAggregateOutputType | null;
    _min: PostsMinAggregateOutputType | null;
    _max: PostsMaxAggregateOutputType | null;
};
export type PostsMinAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    internal_name: string | null;
    post_type: $Enums.post_type | null;
    default_title: string | null;
    default_caption: string | null;
    status: $Enums.post_status | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type PostsMaxAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    internal_name: string | null;
    post_type: $Enums.post_type | null;
    default_title: string | null;
    default_caption: string | null;
    status: $Enums.post_status | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type PostsCountAggregateOutputType = {
    id: number;
    organization_id: number;
    internal_name: number;
    post_type: number;
    default_title: number;
    default_caption: number;
    tags: number;
    status: number;
    created_at: number;
    updated_at: number;
    _all: number;
};
export type PostsMinAggregateInputType = {
    id?: true;
    organization_id?: true;
    internal_name?: true;
    post_type?: true;
    default_title?: true;
    default_caption?: true;
    status?: true;
    created_at?: true;
    updated_at?: true;
};
export type PostsMaxAggregateInputType = {
    id?: true;
    organization_id?: true;
    internal_name?: true;
    post_type?: true;
    default_title?: true;
    default_caption?: true;
    status?: true;
    created_at?: true;
    updated_at?: true;
};
export type PostsCountAggregateInputType = {
    id?: true;
    organization_id?: true;
    internal_name?: true;
    post_type?: true;
    default_title?: true;
    default_caption?: true;
    tags?: true;
    status?: true;
    created_at?: true;
    updated_at?: true;
    _all?: true;
};
export type PostsAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.postsWhereInput;
    orderBy?: Prisma.postsOrderByWithRelationInput | Prisma.postsOrderByWithRelationInput[];
    cursor?: Prisma.postsWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | PostsCountAggregateInputType;
    _min?: PostsMinAggregateInputType;
    _max?: PostsMaxAggregateInputType;
};
export type GetPostsAggregateType<T extends PostsAggregateArgs> = {
    [P in keyof T & keyof AggregatePosts]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregatePosts[P]> : Prisma.GetScalarType<T[P], AggregatePosts[P]>;
};
export type postsGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.postsWhereInput;
    orderBy?: Prisma.postsOrderByWithAggregationInput | Prisma.postsOrderByWithAggregationInput[];
    by: Prisma.PostsScalarFieldEnum[] | Prisma.PostsScalarFieldEnum;
    having?: Prisma.postsScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: PostsCountAggregateInputType | true;
    _min?: PostsMinAggregateInputType;
    _max?: PostsMaxAggregateInputType;
};
export type PostsGroupByOutputType = {
    id: string;
    organization_id: string;
    internal_name: string;
    post_type: $Enums.post_type;
    default_title: string | null;
    default_caption: string | null;
    tags: runtime.JsonValue | null;
    status: $Enums.post_status;
    created_at: Date;
    updated_at: Date;
    _count: PostsCountAggregateOutputType | null;
    _min: PostsMinAggregateOutputType | null;
    _max: PostsMaxAggregateOutputType | null;
};
type GetPostsGroupByPayload<T extends postsGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<PostsGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof PostsGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], PostsGroupByOutputType[P]> : Prisma.GetScalarType<T[P], PostsGroupByOutputType[P]>;
}>>;
export type postsWhereInput = {
    AND?: Prisma.postsWhereInput | Prisma.postsWhereInput[];
    OR?: Prisma.postsWhereInput[];
    NOT?: Prisma.postsWhereInput | Prisma.postsWhereInput[];
    id?: Prisma.StringFilter<"posts"> | string;
    organization_id?: Prisma.StringFilter<"posts"> | string;
    internal_name?: Prisma.StringFilter<"posts"> | string;
    post_type?: Prisma.Enumpost_typeFilter<"posts"> | $Enums.post_type;
    default_title?: Prisma.StringNullableFilter<"posts"> | string | null;
    default_caption?: Prisma.StringNullableFilter<"posts"> | string | null;
    tags?: Prisma.JsonNullableFilter<"posts">;
    status?: Prisma.Enumpost_statusFilter<"posts"> | $Enums.post_status;
    created_at?: Prisma.DateTimeFilter<"posts"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"posts"> | Date | string;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
    media?: Prisma.Post_mediaListRelationFilter;
    schedules?: Prisma.Social_post_schedulesListRelationFilter;
};
export type postsOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    internal_name?: Prisma.SortOrder;
    post_type?: Prisma.SortOrder;
    default_title?: Prisma.SortOrderInput | Prisma.SortOrder;
    default_caption?: Prisma.SortOrderInput | Prisma.SortOrder;
    tags?: Prisma.SortOrderInput | Prisma.SortOrder;
    status?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    organizations?: Prisma.organizationsOrderByWithRelationInput;
    media?: Prisma.post_mediaOrderByRelationAggregateInput;
    schedules?: Prisma.social_post_schedulesOrderByRelationAggregateInput;
    _relevance?: Prisma.postsOrderByRelevanceInput;
};
export type postsWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    AND?: Prisma.postsWhereInput | Prisma.postsWhereInput[];
    OR?: Prisma.postsWhereInput[];
    NOT?: Prisma.postsWhereInput | Prisma.postsWhereInput[];
    organization_id?: Prisma.StringFilter<"posts"> | string;
    internal_name?: Prisma.StringFilter<"posts"> | string;
    post_type?: Prisma.Enumpost_typeFilter<"posts"> | $Enums.post_type;
    default_title?: Prisma.StringNullableFilter<"posts"> | string | null;
    default_caption?: Prisma.StringNullableFilter<"posts"> | string | null;
    tags?: Prisma.JsonNullableFilter<"posts">;
    status?: Prisma.Enumpost_statusFilter<"posts"> | $Enums.post_status;
    created_at?: Prisma.DateTimeFilter<"posts"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"posts"> | Date | string;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
    media?: Prisma.Post_mediaListRelationFilter;
    schedules?: Prisma.Social_post_schedulesListRelationFilter;
}, "id">;
export type postsOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    internal_name?: Prisma.SortOrder;
    post_type?: Prisma.SortOrder;
    default_title?: Prisma.SortOrderInput | Prisma.SortOrder;
    default_caption?: Prisma.SortOrderInput | Prisma.SortOrder;
    tags?: Prisma.SortOrderInput | Prisma.SortOrder;
    status?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    _count?: Prisma.postsCountOrderByAggregateInput;
    _max?: Prisma.postsMaxOrderByAggregateInput;
    _min?: Prisma.postsMinOrderByAggregateInput;
};
export type postsScalarWhereWithAggregatesInput = {
    AND?: Prisma.postsScalarWhereWithAggregatesInput | Prisma.postsScalarWhereWithAggregatesInput[];
    OR?: Prisma.postsScalarWhereWithAggregatesInput[];
    NOT?: Prisma.postsScalarWhereWithAggregatesInput | Prisma.postsScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"posts"> | string;
    organization_id?: Prisma.StringWithAggregatesFilter<"posts"> | string;
    internal_name?: Prisma.StringWithAggregatesFilter<"posts"> | string;
    post_type?: Prisma.Enumpost_typeWithAggregatesFilter<"posts"> | $Enums.post_type;
    default_title?: Prisma.StringNullableWithAggregatesFilter<"posts"> | string | null;
    default_caption?: Prisma.StringNullableWithAggregatesFilter<"posts"> | string | null;
    tags?: Prisma.JsonNullableWithAggregatesFilter<"posts">;
    status?: Prisma.Enumpost_statusWithAggregatesFilter<"posts"> | $Enums.post_status;
    created_at?: Prisma.DateTimeWithAggregatesFilter<"posts"> | Date | string;
    updated_at?: Prisma.DateTimeWithAggregatesFilter<"posts"> | Date | string;
};
export type postsCreateInput = {
    id?: string;
    internal_name: string;
    post_type?: $Enums.post_type;
    default_title?: string | null;
    default_caption?: string | null;
    tags?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: $Enums.post_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    organizations: Prisma.organizationsCreateNestedOneWithoutPostsInput;
    media?: Prisma.post_mediaCreateNestedManyWithoutPostInput;
    schedules?: Prisma.social_post_schedulesCreateNestedManyWithoutPostInput;
};
export type postsUncheckedCreateInput = {
    id?: string;
    organization_id: string;
    internal_name: string;
    post_type?: $Enums.post_type;
    default_title?: string | null;
    default_caption?: string | null;
    tags?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: $Enums.post_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    media?: Prisma.post_mediaUncheckedCreateNestedManyWithoutPostInput;
    schedules?: Prisma.social_post_schedulesUncheckedCreateNestedManyWithoutPostInput;
};
export type postsUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    internal_name?: Prisma.StringFieldUpdateOperationsInput | string;
    post_type?: Prisma.Enumpost_typeFieldUpdateOperationsInput | $Enums.post_type;
    default_title?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    default_caption?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    tags?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: Prisma.Enumpost_statusFieldUpdateOperationsInput | $Enums.post_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutPostsNestedInput;
    media?: Prisma.post_mediaUpdateManyWithoutPostNestedInput;
    schedules?: Prisma.social_post_schedulesUpdateManyWithoutPostNestedInput;
};
export type postsUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    internal_name?: Prisma.StringFieldUpdateOperationsInput | string;
    post_type?: Prisma.Enumpost_typeFieldUpdateOperationsInput | $Enums.post_type;
    default_title?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    default_caption?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    tags?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: Prisma.Enumpost_statusFieldUpdateOperationsInput | $Enums.post_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    media?: Prisma.post_mediaUncheckedUpdateManyWithoutPostNestedInput;
    schedules?: Prisma.social_post_schedulesUncheckedUpdateManyWithoutPostNestedInput;
};
export type postsCreateManyInput = {
    id?: string;
    organization_id: string;
    internal_name: string;
    post_type?: $Enums.post_type;
    default_title?: string | null;
    default_caption?: string | null;
    tags?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: $Enums.post_status;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type postsUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    internal_name?: Prisma.StringFieldUpdateOperationsInput | string;
    post_type?: Prisma.Enumpost_typeFieldUpdateOperationsInput | $Enums.post_type;
    default_title?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    default_caption?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    tags?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: Prisma.Enumpost_statusFieldUpdateOperationsInput | $Enums.post_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type postsUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    internal_name?: Prisma.StringFieldUpdateOperationsInput | string;
    post_type?: Prisma.Enumpost_typeFieldUpdateOperationsInput | $Enums.post_type;
    default_title?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    default_caption?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    tags?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: Prisma.Enumpost_statusFieldUpdateOperationsInput | $Enums.post_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type PostsListRelationFilter = {
    every?: Prisma.postsWhereInput;
    some?: Prisma.postsWhereInput;
    none?: Prisma.postsWhereInput;
};
export type postsOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type postsOrderByRelevanceInput = {
    fields: Prisma.postsOrderByRelevanceFieldEnum | Prisma.postsOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type postsCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    internal_name?: Prisma.SortOrder;
    post_type?: Prisma.SortOrder;
    default_title?: Prisma.SortOrder;
    default_caption?: Prisma.SortOrder;
    tags?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type postsMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    internal_name?: Prisma.SortOrder;
    post_type?: Prisma.SortOrder;
    default_title?: Prisma.SortOrder;
    default_caption?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type postsMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    internal_name?: Prisma.SortOrder;
    post_type?: Prisma.SortOrder;
    default_title?: Prisma.SortOrder;
    default_caption?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type PostsScalarRelationFilter = {
    is?: Prisma.postsWhereInput;
    isNot?: Prisma.postsWhereInput;
};
export type postsCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.postsCreateWithoutOrganizationsInput, Prisma.postsUncheckedCreateWithoutOrganizationsInput> | Prisma.postsCreateWithoutOrganizationsInput[] | Prisma.postsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.postsCreateOrConnectWithoutOrganizationsInput | Prisma.postsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.postsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.postsWhereUniqueInput | Prisma.postsWhereUniqueInput[];
};
export type postsUncheckedCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.postsCreateWithoutOrganizationsInput, Prisma.postsUncheckedCreateWithoutOrganizationsInput> | Prisma.postsCreateWithoutOrganizationsInput[] | Prisma.postsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.postsCreateOrConnectWithoutOrganizationsInput | Prisma.postsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.postsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.postsWhereUniqueInput | Prisma.postsWhereUniqueInput[];
};
export type postsUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.postsCreateWithoutOrganizationsInput, Prisma.postsUncheckedCreateWithoutOrganizationsInput> | Prisma.postsCreateWithoutOrganizationsInput[] | Prisma.postsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.postsCreateOrConnectWithoutOrganizationsInput | Prisma.postsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.postsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.postsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.postsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.postsWhereUniqueInput | Prisma.postsWhereUniqueInput[];
    disconnect?: Prisma.postsWhereUniqueInput | Prisma.postsWhereUniqueInput[];
    delete?: Prisma.postsWhereUniqueInput | Prisma.postsWhereUniqueInput[];
    connect?: Prisma.postsWhereUniqueInput | Prisma.postsWhereUniqueInput[];
    update?: Prisma.postsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.postsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.postsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.postsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.postsScalarWhereInput | Prisma.postsScalarWhereInput[];
};
export type postsUncheckedUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.postsCreateWithoutOrganizationsInput, Prisma.postsUncheckedCreateWithoutOrganizationsInput> | Prisma.postsCreateWithoutOrganizationsInput[] | Prisma.postsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.postsCreateOrConnectWithoutOrganizationsInput | Prisma.postsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.postsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.postsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.postsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.postsWhereUniqueInput | Prisma.postsWhereUniqueInput[];
    disconnect?: Prisma.postsWhereUniqueInput | Prisma.postsWhereUniqueInput[];
    delete?: Prisma.postsWhereUniqueInput | Prisma.postsWhereUniqueInput[];
    connect?: Prisma.postsWhereUniqueInput | Prisma.postsWhereUniqueInput[];
    update?: Prisma.postsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.postsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.postsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.postsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.postsScalarWhereInput | Prisma.postsScalarWhereInput[];
};
export type Enumpost_typeFieldUpdateOperationsInput = {
    set?: $Enums.post_type;
};
export type Enumpost_statusFieldUpdateOperationsInput = {
    set?: $Enums.post_status;
};
export type postsCreateNestedOneWithoutMediaInput = {
    create?: Prisma.XOR<Prisma.postsCreateWithoutMediaInput, Prisma.postsUncheckedCreateWithoutMediaInput>;
    connectOrCreate?: Prisma.postsCreateOrConnectWithoutMediaInput;
    connect?: Prisma.postsWhereUniqueInput;
};
export type postsUpdateOneRequiredWithoutMediaNestedInput = {
    create?: Prisma.XOR<Prisma.postsCreateWithoutMediaInput, Prisma.postsUncheckedCreateWithoutMediaInput>;
    connectOrCreate?: Prisma.postsCreateOrConnectWithoutMediaInput;
    upsert?: Prisma.postsUpsertWithoutMediaInput;
    connect?: Prisma.postsWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.postsUpdateToOneWithWhereWithoutMediaInput, Prisma.postsUpdateWithoutMediaInput>, Prisma.postsUncheckedUpdateWithoutMediaInput>;
};
export type postsCreateNestedOneWithoutSchedulesInput = {
    create?: Prisma.XOR<Prisma.postsCreateWithoutSchedulesInput, Prisma.postsUncheckedCreateWithoutSchedulesInput>;
    connectOrCreate?: Prisma.postsCreateOrConnectWithoutSchedulesInput;
    connect?: Prisma.postsWhereUniqueInput;
};
export type postsUpdateOneRequiredWithoutSchedulesNestedInput = {
    create?: Prisma.XOR<Prisma.postsCreateWithoutSchedulesInput, Prisma.postsUncheckedCreateWithoutSchedulesInput>;
    connectOrCreate?: Prisma.postsCreateOrConnectWithoutSchedulesInput;
    upsert?: Prisma.postsUpsertWithoutSchedulesInput;
    connect?: Prisma.postsWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.postsUpdateToOneWithWhereWithoutSchedulesInput, Prisma.postsUpdateWithoutSchedulesInput>, Prisma.postsUncheckedUpdateWithoutSchedulesInput>;
};
export type postsCreateWithoutOrganizationsInput = {
    id?: string;
    internal_name: string;
    post_type?: $Enums.post_type;
    default_title?: string | null;
    default_caption?: string | null;
    tags?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: $Enums.post_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    media?: Prisma.post_mediaCreateNestedManyWithoutPostInput;
    schedules?: Prisma.social_post_schedulesCreateNestedManyWithoutPostInput;
};
export type postsUncheckedCreateWithoutOrganizationsInput = {
    id?: string;
    internal_name: string;
    post_type?: $Enums.post_type;
    default_title?: string | null;
    default_caption?: string | null;
    tags?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: $Enums.post_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    media?: Prisma.post_mediaUncheckedCreateNestedManyWithoutPostInput;
    schedules?: Prisma.social_post_schedulesUncheckedCreateNestedManyWithoutPostInput;
};
export type postsCreateOrConnectWithoutOrganizationsInput = {
    where: Prisma.postsWhereUniqueInput;
    create: Prisma.XOR<Prisma.postsCreateWithoutOrganizationsInput, Prisma.postsUncheckedCreateWithoutOrganizationsInput>;
};
export type postsCreateManyOrganizationsInputEnvelope = {
    data: Prisma.postsCreateManyOrganizationsInput | Prisma.postsCreateManyOrganizationsInput[];
    skipDuplicates?: boolean;
};
export type postsUpsertWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.postsWhereUniqueInput;
    update: Prisma.XOR<Prisma.postsUpdateWithoutOrganizationsInput, Prisma.postsUncheckedUpdateWithoutOrganizationsInput>;
    create: Prisma.XOR<Prisma.postsCreateWithoutOrganizationsInput, Prisma.postsUncheckedCreateWithoutOrganizationsInput>;
};
export type postsUpdateWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.postsWhereUniqueInput;
    data: Prisma.XOR<Prisma.postsUpdateWithoutOrganizationsInput, Prisma.postsUncheckedUpdateWithoutOrganizationsInput>;
};
export type postsUpdateManyWithWhereWithoutOrganizationsInput = {
    where: Prisma.postsScalarWhereInput;
    data: Prisma.XOR<Prisma.postsUpdateManyMutationInput, Prisma.postsUncheckedUpdateManyWithoutOrganizationsInput>;
};
export type postsScalarWhereInput = {
    AND?: Prisma.postsScalarWhereInput | Prisma.postsScalarWhereInput[];
    OR?: Prisma.postsScalarWhereInput[];
    NOT?: Prisma.postsScalarWhereInput | Prisma.postsScalarWhereInput[];
    id?: Prisma.StringFilter<"posts"> | string;
    organization_id?: Prisma.StringFilter<"posts"> | string;
    internal_name?: Prisma.StringFilter<"posts"> | string;
    post_type?: Prisma.Enumpost_typeFilter<"posts"> | $Enums.post_type;
    default_title?: Prisma.StringNullableFilter<"posts"> | string | null;
    default_caption?: Prisma.StringNullableFilter<"posts"> | string | null;
    tags?: Prisma.JsonNullableFilter<"posts">;
    status?: Prisma.Enumpost_statusFilter<"posts"> | $Enums.post_status;
    created_at?: Prisma.DateTimeFilter<"posts"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"posts"> | Date | string;
};
export type postsCreateWithoutMediaInput = {
    id?: string;
    internal_name: string;
    post_type?: $Enums.post_type;
    default_title?: string | null;
    default_caption?: string | null;
    tags?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: $Enums.post_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    organizations: Prisma.organizationsCreateNestedOneWithoutPostsInput;
    schedules?: Prisma.social_post_schedulesCreateNestedManyWithoutPostInput;
};
export type postsUncheckedCreateWithoutMediaInput = {
    id?: string;
    organization_id: string;
    internal_name: string;
    post_type?: $Enums.post_type;
    default_title?: string | null;
    default_caption?: string | null;
    tags?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: $Enums.post_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    schedules?: Prisma.social_post_schedulesUncheckedCreateNestedManyWithoutPostInput;
};
export type postsCreateOrConnectWithoutMediaInput = {
    where: Prisma.postsWhereUniqueInput;
    create: Prisma.XOR<Prisma.postsCreateWithoutMediaInput, Prisma.postsUncheckedCreateWithoutMediaInput>;
};
export type postsUpsertWithoutMediaInput = {
    update: Prisma.XOR<Prisma.postsUpdateWithoutMediaInput, Prisma.postsUncheckedUpdateWithoutMediaInput>;
    create: Prisma.XOR<Prisma.postsCreateWithoutMediaInput, Prisma.postsUncheckedCreateWithoutMediaInput>;
    where?: Prisma.postsWhereInput;
};
export type postsUpdateToOneWithWhereWithoutMediaInput = {
    where?: Prisma.postsWhereInput;
    data: Prisma.XOR<Prisma.postsUpdateWithoutMediaInput, Prisma.postsUncheckedUpdateWithoutMediaInput>;
};
export type postsUpdateWithoutMediaInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    internal_name?: Prisma.StringFieldUpdateOperationsInput | string;
    post_type?: Prisma.Enumpost_typeFieldUpdateOperationsInput | $Enums.post_type;
    default_title?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    default_caption?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    tags?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: Prisma.Enumpost_statusFieldUpdateOperationsInput | $Enums.post_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutPostsNestedInput;
    schedules?: Prisma.social_post_schedulesUpdateManyWithoutPostNestedInput;
};
export type postsUncheckedUpdateWithoutMediaInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    internal_name?: Prisma.StringFieldUpdateOperationsInput | string;
    post_type?: Prisma.Enumpost_typeFieldUpdateOperationsInput | $Enums.post_type;
    default_title?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    default_caption?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    tags?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: Prisma.Enumpost_statusFieldUpdateOperationsInput | $Enums.post_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    schedules?: Prisma.social_post_schedulesUncheckedUpdateManyWithoutPostNestedInput;
};
export type postsCreateWithoutSchedulesInput = {
    id?: string;
    internal_name: string;
    post_type?: $Enums.post_type;
    default_title?: string | null;
    default_caption?: string | null;
    tags?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: $Enums.post_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    organizations: Prisma.organizationsCreateNestedOneWithoutPostsInput;
    media?: Prisma.post_mediaCreateNestedManyWithoutPostInput;
};
export type postsUncheckedCreateWithoutSchedulesInput = {
    id?: string;
    organization_id: string;
    internal_name: string;
    post_type?: $Enums.post_type;
    default_title?: string | null;
    default_caption?: string | null;
    tags?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: $Enums.post_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    media?: Prisma.post_mediaUncheckedCreateNestedManyWithoutPostInput;
};
export type postsCreateOrConnectWithoutSchedulesInput = {
    where: Prisma.postsWhereUniqueInput;
    create: Prisma.XOR<Prisma.postsCreateWithoutSchedulesInput, Prisma.postsUncheckedCreateWithoutSchedulesInput>;
};
export type postsUpsertWithoutSchedulesInput = {
    update: Prisma.XOR<Prisma.postsUpdateWithoutSchedulesInput, Prisma.postsUncheckedUpdateWithoutSchedulesInput>;
    create: Prisma.XOR<Prisma.postsCreateWithoutSchedulesInput, Prisma.postsUncheckedCreateWithoutSchedulesInput>;
    where?: Prisma.postsWhereInput;
};
export type postsUpdateToOneWithWhereWithoutSchedulesInput = {
    where?: Prisma.postsWhereInput;
    data: Prisma.XOR<Prisma.postsUpdateWithoutSchedulesInput, Prisma.postsUncheckedUpdateWithoutSchedulesInput>;
};
export type postsUpdateWithoutSchedulesInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    internal_name?: Prisma.StringFieldUpdateOperationsInput | string;
    post_type?: Prisma.Enumpost_typeFieldUpdateOperationsInput | $Enums.post_type;
    default_title?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    default_caption?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    tags?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: Prisma.Enumpost_statusFieldUpdateOperationsInput | $Enums.post_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutPostsNestedInput;
    media?: Prisma.post_mediaUpdateManyWithoutPostNestedInput;
};
export type postsUncheckedUpdateWithoutSchedulesInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    internal_name?: Prisma.StringFieldUpdateOperationsInput | string;
    post_type?: Prisma.Enumpost_typeFieldUpdateOperationsInput | $Enums.post_type;
    default_title?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    default_caption?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    tags?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: Prisma.Enumpost_statusFieldUpdateOperationsInput | $Enums.post_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    media?: Prisma.post_mediaUncheckedUpdateManyWithoutPostNestedInput;
};
export type postsCreateManyOrganizationsInput = {
    id?: string;
    internal_name: string;
    post_type?: $Enums.post_type;
    default_title?: string | null;
    default_caption?: string | null;
    tags?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: $Enums.post_status;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type postsUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    internal_name?: Prisma.StringFieldUpdateOperationsInput | string;
    post_type?: Prisma.Enumpost_typeFieldUpdateOperationsInput | $Enums.post_type;
    default_title?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    default_caption?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    tags?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: Prisma.Enumpost_statusFieldUpdateOperationsInput | $Enums.post_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    media?: Prisma.post_mediaUpdateManyWithoutPostNestedInput;
    schedules?: Prisma.social_post_schedulesUpdateManyWithoutPostNestedInput;
};
export type postsUncheckedUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    internal_name?: Prisma.StringFieldUpdateOperationsInput | string;
    post_type?: Prisma.Enumpost_typeFieldUpdateOperationsInput | $Enums.post_type;
    default_title?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    default_caption?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    tags?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: Prisma.Enumpost_statusFieldUpdateOperationsInput | $Enums.post_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    media?: Prisma.post_mediaUncheckedUpdateManyWithoutPostNestedInput;
    schedules?: Prisma.social_post_schedulesUncheckedUpdateManyWithoutPostNestedInput;
};
export type postsUncheckedUpdateManyWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    internal_name?: Prisma.StringFieldUpdateOperationsInput | string;
    post_type?: Prisma.Enumpost_typeFieldUpdateOperationsInput | $Enums.post_type;
    default_title?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    default_caption?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    tags?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    status?: Prisma.Enumpost_statusFieldUpdateOperationsInput | $Enums.post_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type PostsCountOutputType = {
    media: number;
    schedules: number;
};
export type PostsCountOutputTypeSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    media?: boolean | PostsCountOutputTypeCountMediaArgs;
    schedules?: boolean | PostsCountOutputTypeCountSchedulesArgs;
};
export type PostsCountOutputTypeDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.PostsCountOutputTypeSelect<ExtArgs> | null;
};
export type PostsCountOutputTypeCountMediaArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.post_mediaWhereInput;
};
export type PostsCountOutputTypeCountSchedulesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.social_post_schedulesWhereInput;
};
export type postsSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    organization_id?: boolean;
    internal_name?: boolean;
    post_type?: boolean;
    default_title?: boolean;
    default_caption?: boolean;
    tags?: boolean;
    status?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
    media?: boolean | Prisma.posts$mediaArgs<ExtArgs>;
    schedules?: boolean | Prisma.posts$schedulesArgs<ExtArgs>;
    _count?: boolean | Prisma.PostsCountOutputTypeDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["posts"]>;
export type postsSelectScalar = {
    id?: boolean;
    organization_id?: boolean;
    internal_name?: boolean;
    post_type?: boolean;
    default_title?: boolean;
    default_caption?: boolean;
    tags?: boolean;
    status?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
};
export type postsOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "organization_id" | "internal_name" | "post_type" | "default_title" | "default_caption" | "tags" | "status" | "created_at" | "updated_at", ExtArgs["result"]["posts"]>;
export type postsInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
    media?: boolean | Prisma.posts$mediaArgs<ExtArgs>;
    schedules?: boolean | Prisma.posts$schedulesArgs<ExtArgs>;
    _count?: boolean | Prisma.PostsCountOutputTypeDefaultArgs<ExtArgs>;
};
export type $postsPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "posts";
    objects: {
        organizations: Prisma.$organizationsPayload<ExtArgs>;
        media: Prisma.$post_mediaPayload<ExtArgs>[];
        schedules: Prisma.$social_post_schedulesPayload<ExtArgs>[];
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        organization_id: string;
        internal_name: string;
        post_type: $Enums.post_type;
        default_title: string | null;
        default_caption: string | null;
        tags: runtime.JsonValue | null;
        status: $Enums.post_status;
        created_at: Date;
        updated_at: Date;
    }, ExtArgs["result"]["posts"]>;
    composites: {};
};
export type postsGetPayload<S extends boolean | null | undefined | postsDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$postsPayload, S>;
export type postsCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<postsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: PostsCountAggregateInputType | true;
};
export interface postsDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['posts'];
        meta: {
            name: 'posts';
        };
    };
    findUnique<T extends postsFindUniqueArgs>(args: Prisma.SelectSubset<T, postsFindUniqueArgs<ExtArgs>>): Prisma.Prisma__postsClient<runtime.Types.Result.GetResult<Prisma.$postsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends postsFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, postsFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__postsClient<runtime.Types.Result.GetResult<Prisma.$postsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends postsFindFirstArgs>(args?: Prisma.SelectSubset<T, postsFindFirstArgs<ExtArgs>>): Prisma.Prisma__postsClient<runtime.Types.Result.GetResult<Prisma.$postsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends postsFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, postsFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__postsClient<runtime.Types.Result.GetResult<Prisma.$postsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends postsFindManyArgs>(args?: Prisma.SelectSubset<T, postsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$postsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends postsCreateArgs>(args: Prisma.SelectSubset<T, postsCreateArgs<ExtArgs>>): Prisma.Prisma__postsClient<runtime.Types.Result.GetResult<Prisma.$postsPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends postsCreateManyArgs>(args?: Prisma.SelectSubset<T, postsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends postsDeleteArgs>(args: Prisma.SelectSubset<T, postsDeleteArgs<ExtArgs>>): Prisma.Prisma__postsClient<runtime.Types.Result.GetResult<Prisma.$postsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends postsUpdateArgs>(args: Prisma.SelectSubset<T, postsUpdateArgs<ExtArgs>>): Prisma.Prisma__postsClient<runtime.Types.Result.GetResult<Prisma.$postsPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends postsDeleteManyArgs>(args?: Prisma.SelectSubset<T, postsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends postsUpdateManyArgs>(args: Prisma.SelectSubset<T, postsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends postsUpsertArgs>(args: Prisma.SelectSubset<T, postsUpsertArgs<ExtArgs>>): Prisma.Prisma__postsClient<runtime.Types.Result.GetResult<Prisma.$postsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends postsCountArgs>(args?: Prisma.Subset<T, postsCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], PostsCountAggregateOutputType> : number>;
    aggregate<T extends PostsAggregateArgs>(args: Prisma.Subset<T, PostsAggregateArgs>): Prisma.PrismaPromise<GetPostsAggregateType<T>>;
    groupBy<T extends postsGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: postsGroupByArgs['orderBy'];
    } : {
        orderBy?: postsGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, postsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPostsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: postsFieldRefs;
}
export interface Prisma__postsClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    organizations<T extends Prisma.organizationsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.organizationsDefaultArgs<ExtArgs>>): Prisma.Prisma__organizationsClient<runtime.Types.Result.GetResult<Prisma.$organizationsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    media<T extends Prisma.posts$mediaArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.posts$mediaArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$post_mediaPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    schedules<T extends Prisma.posts$schedulesArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.posts$schedulesArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$social_post_schedulesPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface postsFieldRefs {
    readonly id: Prisma.FieldRef<"posts", 'String'>;
    readonly organization_id: Prisma.FieldRef<"posts", 'String'>;
    readonly internal_name: Prisma.FieldRef<"posts", 'String'>;
    readonly post_type: Prisma.FieldRef<"posts", 'post_type'>;
    readonly default_title: Prisma.FieldRef<"posts", 'String'>;
    readonly default_caption: Prisma.FieldRef<"posts", 'String'>;
    readonly tags: Prisma.FieldRef<"posts", 'Json'>;
    readonly status: Prisma.FieldRef<"posts", 'post_status'>;
    readonly created_at: Prisma.FieldRef<"posts", 'DateTime'>;
    readonly updated_at: Prisma.FieldRef<"posts", 'DateTime'>;
}
export type postsFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.postsSelect<ExtArgs> | null;
    omit?: Prisma.postsOmit<ExtArgs> | null;
    include?: Prisma.postsInclude<ExtArgs> | null;
    where: Prisma.postsWhereUniqueInput;
};
export type postsFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.postsSelect<ExtArgs> | null;
    omit?: Prisma.postsOmit<ExtArgs> | null;
    include?: Prisma.postsInclude<ExtArgs> | null;
    where: Prisma.postsWhereUniqueInput;
};
export type postsFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.postsSelect<ExtArgs> | null;
    omit?: Prisma.postsOmit<ExtArgs> | null;
    include?: Prisma.postsInclude<ExtArgs> | null;
    where?: Prisma.postsWhereInput;
    orderBy?: Prisma.postsOrderByWithRelationInput | Prisma.postsOrderByWithRelationInput[];
    cursor?: Prisma.postsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.PostsScalarFieldEnum | Prisma.PostsScalarFieldEnum[];
};
export type postsFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.postsSelect<ExtArgs> | null;
    omit?: Prisma.postsOmit<ExtArgs> | null;
    include?: Prisma.postsInclude<ExtArgs> | null;
    where?: Prisma.postsWhereInput;
    orderBy?: Prisma.postsOrderByWithRelationInput | Prisma.postsOrderByWithRelationInput[];
    cursor?: Prisma.postsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.PostsScalarFieldEnum | Prisma.PostsScalarFieldEnum[];
};
export type postsFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.postsSelect<ExtArgs> | null;
    omit?: Prisma.postsOmit<ExtArgs> | null;
    include?: Prisma.postsInclude<ExtArgs> | null;
    where?: Prisma.postsWhereInput;
    orderBy?: Prisma.postsOrderByWithRelationInput | Prisma.postsOrderByWithRelationInput[];
    cursor?: Prisma.postsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.PostsScalarFieldEnum | Prisma.PostsScalarFieldEnum[];
};
export type postsCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.postsSelect<ExtArgs> | null;
    omit?: Prisma.postsOmit<ExtArgs> | null;
    include?: Prisma.postsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.postsCreateInput, Prisma.postsUncheckedCreateInput>;
};
export type postsCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.postsCreateManyInput | Prisma.postsCreateManyInput[];
    skipDuplicates?: boolean;
};
export type postsUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.postsSelect<ExtArgs> | null;
    omit?: Prisma.postsOmit<ExtArgs> | null;
    include?: Prisma.postsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.postsUpdateInput, Prisma.postsUncheckedUpdateInput>;
    where: Prisma.postsWhereUniqueInput;
};
export type postsUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.postsUpdateManyMutationInput, Prisma.postsUncheckedUpdateManyInput>;
    where?: Prisma.postsWhereInput;
    limit?: number;
};
export type postsUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.postsSelect<ExtArgs> | null;
    omit?: Prisma.postsOmit<ExtArgs> | null;
    include?: Prisma.postsInclude<ExtArgs> | null;
    where: Prisma.postsWhereUniqueInput;
    create: Prisma.XOR<Prisma.postsCreateInput, Prisma.postsUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.postsUpdateInput, Prisma.postsUncheckedUpdateInput>;
};
export type postsDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.postsSelect<ExtArgs> | null;
    omit?: Prisma.postsOmit<ExtArgs> | null;
    include?: Prisma.postsInclude<ExtArgs> | null;
    where: Prisma.postsWhereUniqueInput;
};
export type postsDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.postsWhereInput;
    limit?: number;
};
export type posts$mediaArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.post_mediaSelect<ExtArgs> | null;
    omit?: Prisma.post_mediaOmit<ExtArgs> | null;
    include?: Prisma.post_mediaInclude<ExtArgs> | null;
    where?: Prisma.post_mediaWhereInput;
    orderBy?: Prisma.post_mediaOrderByWithRelationInput | Prisma.post_mediaOrderByWithRelationInput[];
    cursor?: Prisma.post_mediaWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Post_mediaScalarFieldEnum | Prisma.Post_mediaScalarFieldEnum[];
};
export type posts$schedulesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.social_post_schedulesSelect<ExtArgs> | null;
    omit?: Prisma.social_post_schedulesOmit<ExtArgs> | null;
    include?: Prisma.social_post_schedulesInclude<ExtArgs> | null;
    where?: Prisma.social_post_schedulesWhereInput;
    orderBy?: Prisma.social_post_schedulesOrderByWithRelationInput | Prisma.social_post_schedulesOrderByWithRelationInput[];
    cursor?: Prisma.social_post_schedulesWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Social_post_schedulesScalarFieldEnum | Prisma.Social_post_schedulesScalarFieldEnum[];
};
export type postsDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.postsSelect<ExtArgs> | null;
    omit?: Prisma.postsOmit<ExtArgs> | null;
    include?: Prisma.postsInclude<ExtArgs> | null;
};
export {};
