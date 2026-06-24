import type * as runtime from "@prisma/client/runtime/client";
import type * as $Enums from "../enums.js";
import type * as Prisma from "../internal/prismaNamespace.js";
export type post_mediaModel = runtime.Types.Result.DefaultSelection<Prisma.$post_mediaPayload>;
export type AggregatePost_media = {
    _count: Post_mediaCountAggregateOutputType | null;
    _avg: Post_mediaAvgAggregateOutputType | null;
    _sum: Post_mediaSumAggregateOutputType | null;
    _min: Post_mediaMinAggregateOutputType | null;
    _max: Post_mediaMaxAggregateOutputType | null;
};
export type Post_mediaAvgAggregateOutputType = {
    sort_order: number | null;
    file_size_bytes: number | null;
    width: number | null;
    height: number | null;
    duration_sec: number | null;
};
export type Post_mediaSumAggregateOutputType = {
    sort_order: number | null;
    file_size_bytes: number | null;
    width: number | null;
    height: number | null;
    duration_sec: number | null;
};
export type Post_mediaMinAggregateOutputType = {
    id: string | null;
    post_id: string | null;
    sort_order: number | null;
    media_type: $Enums.media_type | null;
    mime_type: string | null;
    file_size_bytes: number | null;
    original_name: string | null;
    storage_key: string | null;
    storage_provider: string | null;
    width: number | null;
    height: number | null;
    duration_sec: number | null;
    thumbnail_key: string | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type Post_mediaMaxAggregateOutputType = {
    id: string | null;
    post_id: string | null;
    sort_order: number | null;
    media_type: $Enums.media_type | null;
    mime_type: string | null;
    file_size_bytes: number | null;
    original_name: string | null;
    storage_key: string | null;
    storage_provider: string | null;
    width: number | null;
    height: number | null;
    duration_sec: number | null;
    thumbnail_key: string | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type Post_mediaCountAggregateOutputType = {
    id: number;
    post_id: number;
    sort_order: number;
    media_type: number;
    mime_type: number;
    file_size_bytes: number;
    original_name: number;
    storage_key: number;
    storage_provider: number;
    width: number;
    height: number;
    duration_sec: number;
    thumbnail_key: number;
    created_at: number;
    updated_at: number;
    _all: number;
};
export type Post_mediaAvgAggregateInputType = {
    sort_order?: true;
    file_size_bytes?: true;
    width?: true;
    height?: true;
    duration_sec?: true;
};
export type Post_mediaSumAggregateInputType = {
    sort_order?: true;
    file_size_bytes?: true;
    width?: true;
    height?: true;
    duration_sec?: true;
};
export type Post_mediaMinAggregateInputType = {
    id?: true;
    post_id?: true;
    sort_order?: true;
    media_type?: true;
    mime_type?: true;
    file_size_bytes?: true;
    original_name?: true;
    storage_key?: true;
    storage_provider?: true;
    width?: true;
    height?: true;
    duration_sec?: true;
    thumbnail_key?: true;
    created_at?: true;
    updated_at?: true;
};
export type Post_mediaMaxAggregateInputType = {
    id?: true;
    post_id?: true;
    sort_order?: true;
    media_type?: true;
    mime_type?: true;
    file_size_bytes?: true;
    original_name?: true;
    storage_key?: true;
    storage_provider?: true;
    width?: true;
    height?: true;
    duration_sec?: true;
    thumbnail_key?: true;
    created_at?: true;
    updated_at?: true;
};
export type Post_mediaCountAggregateInputType = {
    id?: true;
    post_id?: true;
    sort_order?: true;
    media_type?: true;
    mime_type?: true;
    file_size_bytes?: true;
    original_name?: true;
    storage_key?: true;
    storage_provider?: true;
    width?: true;
    height?: true;
    duration_sec?: true;
    thumbnail_key?: true;
    created_at?: true;
    updated_at?: true;
    _all?: true;
};
export type Post_mediaAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.post_mediaWhereInput;
    orderBy?: Prisma.post_mediaOrderByWithRelationInput | Prisma.post_mediaOrderByWithRelationInput[];
    cursor?: Prisma.post_mediaWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | Post_mediaCountAggregateInputType;
    _avg?: Post_mediaAvgAggregateInputType;
    _sum?: Post_mediaSumAggregateInputType;
    _min?: Post_mediaMinAggregateInputType;
    _max?: Post_mediaMaxAggregateInputType;
};
export type GetPost_mediaAggregateType<T extends Post_mediaAggregateArgs> = {
    [P in keyof T & keyof AggregatePost_media]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregatePost_media[P]> : Prisma.GetScalarType<T[P], AggregatePost_media[P]>;
};
export type post_mediaGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.post_mediaWhereInput;
    orderBy?: Prisma.post_mediaOrderByWithAggregationInput | Prisma.post_mediaOrderByWithAggregationInput[];
    by: Prisma.Post_mediaScalarFieldEnum[] | Prisma.Post_mediaScalarFieldEnum;
    having?: Prisma.post_mediaScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: Post_mediaCountAggregateInputType | true;
    _avg?: Post_mediaAvgAggregateInputType;
    _sum?: Post_mediaSumAggregateInputType;
    _min?: Post_mediaMinAggregateInputType;
    _max?: Post_mediaMaxAggregateInputType;
};
export type Post_mediaGroupByOutputType = {
    id: string;
    post_id: string;
    sort_order: number;
    media_type: $Enums.media_type;
    mime_type: string;
    file_size_bytes: number;
    original_name: string;
    storage_key: string;
    storage_provider: string;
    width: number | null;
    height: number | null;
    duration_sec: number | null;
    thumbnail_key: string | null;
    created_at: Date;
    updated_at: Date;
    _count: Post_mediaCountAggregateOutputType | null;
    _avg: Post_mediaAvgAggregateOutputType | null;
    _sum: Post_mediaSumAggregateOutputType | null;
    _min: Post_mediaMinAggregateOutputType | null;
    _max: Post_mediaMaxAggregateOutputType | null;
};
type GetPost_mediaGroupByPayload<T extends post_mediaGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<Post_mediaGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof Post_mediaGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], Post_mediaGroupByOutputType[P]> : Prisma.GetScalarType<T[P], Post_mediaGroupByOutputType[P]>;
}>>;
export type post_mediaWhereInput = {
    AND?: Prisma.post_mediaWhereInput | Prisma.post_mediaWhereInput[];
    OR?: Prisma.post_mediaWhereInput[];
    NOT?: Prisma.post_mediaWhereInput | Prisma.post_mediaWhereInput[];
    id?: Prisma.StringFilter<"post_media"> | string;
    post_id?: Prisma.StringFilter<"post_media"> | string;
    sort_order?: Prisma.IntFilter<"post_media"> | number;
    media_type?: Prisma.Enummedia_typeFilter<"post_media"> | $Enums.media_type;
    mime_type?: Prisma.StringFilter<"post_media"> | string;
    file_size_bytes?: Prisma.IntFilter<"post_media"> | number;
    original_name?: Prisma.StringFilter<"post_media"> | string;
    storage_key?: Prisma.StringFilter<"post_media"> | string;
    storage_provider?: Prisma.StringFilter<"post_media"> | string;
    width?: Prisma.IntNullableFilter<"post_media"> | number | null;
    height?: Prisma.IntNullableFilter<"post_media"> | number | null;
    duration_sec?: Prisma.IntNullableFilter<"post_media"> | number | null;
    thumbnail_key?: Prisma.StringNullableFilter<"post_media"> | string | null;
    created_at?: Prisma.DateTimeFilter<"post_media"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"post_media"> | Date | string;
    post?: Prisma.XOR<Prisma.PostsScalarRelationFilter, Prisma.postsWhereInput>;
};
export type post_mediaOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    post_id?: Prisma.SortOrder;
    sort_order?: Prisma.SortOrder;
    media_type?: Prisma.SortOrder;
    mime_type?: Prisma.SortOrder;
    file_size_bytes?: Prisma.SortOrder;
    original_name?: Prisma.SortOrder;
    storage_key?: Prisma.SortOrder;
    storage_provider?: Prisma.SortOrder;
    width?: Prisma.SortOrderInput | Prisma.SortOrder;
    height?: Prisma.SortOrderInput | Prisma.SortOrder;
    duration_sec?: Prisma.SortOrderInput | Prisma.SortOrder;
    thumbnail_key?: Prisma.SortOrderInput | Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    post?: Prisma.postsOrderByWithRelationInput;
    _relevance?: Prisma.post_mediaOrderByRelevanceInput;
};
export type post_mediaWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    AND?: Prisma.post_mediaWhereInput | Prisma.post_mediaWhereInput[];
    OR?: Prisma.post_mediaWhereInput[];
    NOT?: Prisma.post_mediaWhereInput | Prisma.post_mediaWhereInput[];
    post_id?: Prisma.StringFilter<"post_media"> | string;
    sort_order?: Prisma.IntFilter<"post_media"> | number;
    media_type?: Prisma.Enummedia_typeFilter<"post_media"> | $Enums.media_type;
    mime_type?: Prisma.StringFilter<"post_media"> | string;
    file_size_bytes?: Prisma.IntFilter<"post_media"> | number;
    original_name?: Prisma.StringFilter<"post_media"> | string;
    storage_key?: Prisma.StringFilter<"post_media"> | string;
    storage_provider?: Prisma.StringFilter<"post_media"> | string;
    width?: Prisma.IntNullableFilter<"post_media"> | number | null;
    height?: Prisma.IntNullableFilter<"post_media"> | number | null;
    duration_sec?: Prisma.IntNullableFilter<"post_media"> | number | null;
    thumbnail_key?: Prisma.StringNullableFilter<"post_media"> | string | null;
    created_at?: Prisma.DateTimeFilter<"post_media"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"post_media"> | Date | string;
    post?: Prisma.XOR<Prisma.PostsScalarRelationFilter, Prisma.postsWhereInput>;
}, "id">;
export type post_mediaOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    post_id?: Prisma.SortOrder;
    sort_order?: Prisma.SortOrder;
    media_type?: Prisma.SortOrder;
    mime_type?: Prisma.SortOrder;
    file_size_bytes?: Prisma.SortOrder;
    original_name?: Prisma.SortOrder;
    storage_key?: Prisma.SortOrder;
    storage_provider?: Prisma.SortOrder;
    width?: Prisma.SortOrderInput | Prisma.SortOrder;
    height?: Prisma.SortOrderInput | Prisma.SortOrder;
    duration_sec?: Prisma.SortOrderInput | Prisma.SortOrder;
    thumbnail_key?: Prisma.SortOrderInput | Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    _count?: Prisma.post_mediaCountOrderByAggregateInput;
    _avg?: Prisma.post_mediaAvgOrderByAggregateInput;
    _max?: Prisma.post_mediaMaxOrderByAggregateInput;
    _min?: Prisma.post_mediaMinOrderByAggregateInput;
    _sum?: Prisma.post_mediaSumOrderByAggregateInput;
};
export type post_mediaScalarWhereWithAggregatesInput = {
    AND?: Prisma.post_mediaScalarWhereWithAggregatesInput | Prisma.post_mediaScalarWhereWithAggregatesInput[];
    OR?: Prisma.post_mediaScalarWhereWithAggregatesInput[];
    NOT?: Prisma.post_mediaScalarWhereWithAggregatesInput | Prisma.post_mediaScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"post_media"> | string;
    post_id?: Prisma.StringWithAggregatesFilter<"post_media"> | string;
    sort_order?: Prisma.IntWithAggregatesFilter<"post_media"> | number;
    media_type?: Prisma.Enummedia_typeWithAggregatesFilter<"post_media"> | $Enums.media_type;
    mime_type?: Prisma.StringWithAggregatesFilter<"post_media"> | string;
    file_size_bytes?: Prisma.IntWithAggregatesFilter<"post_media"> | number;
    original_name?: Prisma.StringWithAggregatesFilter<"post_media"> | string;
    storage_key?: Prisma.StringWithAggregatesFilter<"post_media"> | string;
    storage_provider?: Prisma.StringWithAggregatesFilter<"post_media"> | string;
    width?: Prisma.IntNullableWithAggregatesFilter<"post_media"> | number | null;
    height?: Prisma.IntNullableWithAggregatesFilter<"post_media"> | number | null;
    duration_sec?: Prisma.IntNullableWithAggregatesFilter<"post_media"> | number | null;
    thumbnail_key?: Prisma.StringNullableWithAggregatesFilter<"post_media"> | string | null;
    created_at?: Prisma.DateTimeWithAggregatesFilter<"post_media"> | Date | string;
    updated_at?: Prisma.DateTimeWithAggregatesFilter<"post_media"> | Date | string;
};
export type post_mediaCreateInput = {
    id?: string;
    sort_order?: number;
    media_type: $Enums.media_type;
    mime_type: string;
    file_size_bytes: number;
    original_name: string;
    storage_key: string;
    storage_provider?: string;
    width?: number | null;
    height?: number | null;
    duration_sec?: number | null;
    thumbnail_key?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    post: Prisma.postsCreateNestedOneWithoutMediaInput;
};
export type post_mediaUncheckedCreateInput = {
    id?: string;
    post_id: string;
    sort_order?: number;
    media_type: $Enums.media_type;
    mime_type: string;
    file_size_bytes: number;
    original_name: string;
    storage_key: string;
    storage_provider?: string;
    width?: number | null;
    height?: number | null;
    duration_sec?: number | null;
    thumbnail_key?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type post_mediaUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    sort_order?: Prisma.IntFieldUpdateOperationsInput | number;
    media_type?: Prisma.Enummedia_typeFieldUpdateOperationsInput | $Enums.media_type;
    mime_type?: Prisma.StringFieldUpdateOperationsInput | string;
    file_size_bytes?: Prisma.IntFieldUpdateOperationsInput | number;
    original_name?: Prisma.StringFieldUpdateOperationsInput | string;
    storage_key?: Prisma.StringFieldUpdateOperationsInput | string;
    storage_provider?: Prisma.StringFieldUpdateOperationsInput | string;
    width?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    height?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    duration_sec?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    thumbnail_key?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    post?: Prisma.postsUpdateOneRequiredWithoutMediaNestedInput;
};
export type post_mediaUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    post_id?: Prisma.StringFieldUpdateOperationsInput | string;
    sort_order?: Prisma.IntFieldUpdateOperationsInput | number;
    media_type?: Prisma.Enummedia_typeFieldUpdateOperationsInput | $Enums.media_type;
    mime_type?: Prisma.StringFieldUpdateOperationsInput | string;
    file_size_bytes?: Prisma.IntFieldUpdateOperationsInput | number;
    original_name?: Prisma.StringFieldUpdateOperationsInput | string;
    storage_key?: Prisma.StringFieldUpdateOperationsInput | string;
    storage_provider?: Prisma.StringFieldUpdateOperationsInput | string;
    width?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    height?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    duration_sec?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    thumbnail_key?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type post_mediaCreateManyInput = {
    id?: string;
    post_id: string;
    sort_order?: number;
    media_type: $Enums.media_type;
    mime_type: string;
    file_size_bytes: number;
    original_name: string;
    storage_key: string;
    storage_provider?: string;
    width?: number | null;
    height?: number | null;
    duration_sec?: number | null;
    thumbnail_key?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type post_mediaUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    sort_order?: Prisma.IntFieldUpdateOperationsInput | number;
    media_type?: Prisma.Enummedia_typeFieldUpdateOperationsInput | $Enums.media_type;
    mime_type?: Prisma.StringFieldUpdateOperationsInput | string;
    file_size_bytes?: Prisma.IntFieldUpdateOperationsInput | number;
    original_name?: Prisma.StringFieldUpdateOperationsInput | string;
    storage_key?: Prisma.StringFieldUpdateOperationsInput | string;
    storage_provider?: Prisma.StringFieldUpdateOperationsInput | string;
    width?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    height?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    duration_sec?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    thumbnail_key?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type post_mediaUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    post_id?: Prisma.StringFieldUpdateOperationsInput | string;
    sort_order?: Prisma.IntFieldUpdateOperationsInput | number;
    media_type?: Prisma.Enummedia_typeFieldUpdateOperationsInput | $Enums.media_type;
    mime_type?: Prisma.StringFieldUpdateOperationsInput | string;
    file_size_bytes?: Prisma.IntFieldUpdateOperationsInput | number;
    original_name?: Prisma.StringFieldUpdateOperationsInput | string;
    storage_key?: Prisma.StringFieldUpdateOperationsInput | string;
    storage_provider?: Prisma.StringFieldUpdateOperationsInput | string;
    width?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    height?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    duration_sec?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    thumbnail_key?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type Post_mediaListRelationFilter = {
    every?: Prisma.post_mediaWhereInput;
    some?: Prisma.post_mediaWhereInput;
    none?: Prisma.post_mediaWhereInput;
};
export type post_mediaOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type post_mediaOrderByRelevanceInput = {
    fields: Prisma.post_mediaOrderByRelevanceFieldEnum | Prisma.post_mediaOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type post_mediaCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    post_id?: Prisma.SortOrder;
    sort_order?: Prisma.SortOrder;
    media_type?: Prisma.SortOrder;
    mime_type?: Prisma.SortOrder;
    file_size_bytes?: Prisma.SortOrder;
    original_name?: Prisma.SortOrder;
    storage_key?: Prisma.SortOrder;
    storage_provider?: Prisma.SortOrder;
    width?: Prisma.SortOrder;
    height?: Prisma.SortOrder;
    duration_sec?: Prisma.SortOrder;
    thumbnail_key?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type post_mediaAvgOrderByAggregateInput = {
    sort_order?: Prisma.SortOrder;
    file_size_bytes?: Prisma.SortOrder;
    width?: Prisma.SortOrder;
    height?: Prisma.SortOrder;
    duration_sec?: Prisma.SortOrder;
};
export type post_mediaMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    post_id?: Prisma.SortOrder;
    sort_order?: Prisma.SortOrder;
    media_type?: Prisma.SortOrder;
    mime_type?: Prisma.SortOrder;
    file_size_bytes?: Prisma.SortOrder;
    original_name?: Prisma.SortOrder;
    storage_key?: Prisma.SortOrder;
    storage_provider?: Prisma.SortOrder;
    width?: Prisma.SortOrder;
    height?: Prisma.SortOrder;
    duration_sec?: Prisma.SortOrder;
    thumbnail_key?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type post_mediaMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    post_id?: Prisma.SortOrder;
    sort_order?: Prisma.SortOrder;
    media_type?: Prisma.SortOrder;
    mime_type?: Prisma.SortOrder;
    file_size_bytes?: Prisma.SortOrder;
    original_name?: Prisma.SortOrder;
    storage_key?: Prisma.SortOrder;
    storage_provider?: Prisma.SortOrder;
    width?: Prisma.SortOrder;
    height?: Prisma.SortOrder;
    duration_sec?: Prisma.SortOrder;
    thumbnail_key?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type post_mediaSumOrderByAggregateInput = {
    sort_order?: Prisma.SortOrder;
    file_size_bytes?: Prisma.SortOrder;
    width?: Prisma.SortOrder;
    height?: Prisma.SortOrder;
    duration_sec?: Prisma.SortOrder;
};
export type post_mediaCreateNestedManyWithoutPostInput = {
    create?: Prisma.XOR<Prisma.post_mediaCreateWithoutPostInput, Prisma.post_mediaUncheckedCreateWithoutPostInput> | Prisma.post_mediaCreateWithoutPostInput[] | Prisma.post_mediaUncheckedCreateWithoutPostInput[];
    connectOrCreate?: Prisma.post_mediaCreateOrConnectWithoutPostInput | Prisma.post_mediaCreateOrConnectWithoutPostInput[];
    createMany?: Prisma.post_mediaCreateManyPostInputEnvelope;
    connect?: Prisma.post_mediaWhereUniqueInput | Prisma.post_mediaWhereUniqueInput[];
};
export type post_mediaUncheckedCreateNestedManyWithoutPostInput = {
    create?: Prisma.XOR<Prisma.post_mediaCreateWithoutPostInput, Prisma.post_mediaUncheckedCreateWithoutPostInput> | Prisma.post_mediaCreateWithoutPostInput[] | Prisma.post_mediaUncheckedCreateWithoutPostInput[];
    connectOrCreate?: Prisma.post_mediaCreateOrConnectWithoutPostInput | Prisma.post_mediaCreateOrConnectWithoutPostInput[];
    createMany?: Prisma.post_mediaCreateManyPostInputEnvelope;
    connect?: Prisma.post_mediaWhereUniqueInput | Prisma.post_mediaWhereUniqueInput[];
};
export type post_mediaUpdateManyWithoutPostNestedInput = {
    create?: Prisma.XOR<Prisma.post_mediaCreateWithoutPostInput, Prisma.post_mediaUncheckedCreateWithoutPostInput> | Prisma.post_mediaCreateWithoutPostInput[] | Prisma.post_mediaUncheckedCreateWithoutPostInput[];
    connectOrCreate?: Prisma.post_mediaCreateOrConnectWithoutPostInput | Prisma.post_mediaCreateOrConnectWithoutPostInput[];
    upsert?: Prisma.post_mediaUpsertWithWhereUniqueWithoutPostInput | Prisma.post_mediaUpsertWithWhereUniqueWithoutPostInput[];
    createMany?: Prisma.post_mediaCreateManyPostInputEnvelope;
    set?: Prisma.post_mediaWhereUniqueInput | Prisma.post_mediaWhereUniqueInput[];
    disconnect?: Prisma.post_mediaWhereUniqueInput | Prisma.post_mediaWhereUniqueInput[];
    delete?: Prisma.post_mediaWhereUniqueInput | Prisma.post_mediaWhereUniqueInput[];
    connect?: Prisma.post_mediaWhereUniqueInput | Prisma.post_mediaWhereUniqueInput[];
    update?: Prisma.post_mediaUpdateWithWhereUniqueWithoutPostInput | Prisma.post_mediaUpdateWithWhereUniqueWithoutPostInput[];
    updateMany?: Prisma.post_mediaUpdateManyWithWhereWithoutPostInput | Prisma.post_mediaUpdateManyWithWhereWithoutPostInput[];
    deleteMany?: Prisma.post_mediaScalarWhereInput | Prisma.post_mediaScalarWhereInput[];
};
export type post_mediaUncheckedUpdateManyWithoutPostNestedInput = {
    create?: Prisma.XOR<Prisma.post_mediaCreateWithoutPostInput, Prisma.post_mediaUncheckedCreateWithoutPostInput> | Prisma.post_mediaCreateWithoutPostInput[] | Prisma.post_mediaUncheckedCreateWithoutPostInput[];
    connectOrCreate?: Prisma.post_mediaCreateOrConnectWithoutPostInput | Prisma.post_mediaCreateOrConnectWithoutPostInput[];
    upsert?: Prisma.post_mediaUpsertWithWhereUniqueWithoutPostInput | Prisma.post_mediaUpsertWithWhereUniqueWithoutPostInput[];
    createMany?: Prisma.post_mediaCreateManyPostInputEnvelope;
    set?: Prisma.post_mediaWhereUniqueInput | Prisma.post_mediaWhereUniqueInput[];
    disconnect?: Prisma.post_mediaWhereUniqueInput | Prisma.post_mediaWhereUniqueInput[];
    delete?: Prisma.post_mediaWhereUniqueInput | Prisma.post_mediaWhereUniqueInput[];
    connect?: Prisma.post_mediaWhereUniqueInput | Prisma.post_mediaWhereUniqueInput[];
    update?: Prisma.post_mediaUpdateWithWhereUniqueWithoutPostInput | Prisma.post_mediaUpdateWithWhereUniqueWithoutPostInput[];
    updateMany?: Prisma.post_mediaUpdateManyWithWhereWithoutPostInput | Prisma.post_mediaUpdateManyWithWhereWithoutPostInput[];
    deleteMany?: Prisma.post_mediaScalarWhereInput | Prisma.post_mediaScalarWhereInput[];
};
export type Enummedia_typeFieldUpdateOperationsInput = {
    set?: $Enums.media_type;
};
export type post_mediaCreateWithoutPostInput = {
    id?: string;
    sort_order?: number;
    media_type: $Enums.media_type;
    mime_type: string;
    file_size_bytes: number;
    original_name: string;
    storage_key: string;
    storage_provider?: string;
    width?: number | null;
    height?: number | null;
    duration_sec?: number | null;
    thumbnail_key?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type post_mediaUncheckedCreateWithoutPostInput = {
    id?: string;
    sort_order?: number;
    media_type: $Enums.media_type;
    mime_type: string;
    file_size_bytes: number;
    original_name: string;
    storage_key: string;
    storage_provider?: string;
    width?: number | null;
    height?: number | null;
    duration_sec?: number | null;
    thumbnail_key?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type post_mediaCreateOrConnectWithoutPostInput = {
    where: Prisma.post_mediaWhereUniqueInput;
    create: Prisma.XOR<Prisma.post_mediaCreateWithoutPostInput, Prisma.post_mediaUncheckedCreateWithoutPostInput>;
};
export type post_mediaCreateManyPostInputEnvelope = {
    data: Prisma.post_mediaCreateManyPostInput | Prisma.post_mediaCreateManyPostInput[];
    skipDuplicates?: boolean;
};
export type post_mediaUpsertWithWhereUniqueWithoutPostInput = {
    where: Prisma.post_mediaWhereUniqueInput;
    update: Prisma.XOR<Prisma.post_mediaUpdateWithoutPostInput, Prisma.post_mediaUncheckedUpdateWithoutPostInput>;
    create: Prisma.XOR<Prisma.post_mediaCreateWithoutPostInput, Prisma.post_mediaUncheckedCreateWithoutPostInput>;
};
export type post_mediaUpdateWithWhereUniqueWithoutPostInput = {
    where: Prisma.post_mediaWhereUniqueInput;
    data: Prisma.XOR<Prisma.post_mediaUpdateWithoutPostInput, Prisma.post_mediaUncheckedUpdateWithoutPostInput>;
};
export type post_mediaUpdateManyWithWhereWithoutPostInput = {
    where: Prisma.post_mediaScalarWhereInput;
    data: Prisma.XOR<Prisma.post_mediaUpdateManyMutationInput, Prisma.post_mediaUncheckedUpdateManyWithoutPostInput>;
};
export type post_mediaScalarWhereInput = {
    AND?: Prisma.post_mediaScalarWhereInput | Prisma.post_mediaScalarWhereInput[];
    OR?: Prisma.post_mediaScalarWhereInput[];
    NOT?: Prisma.post_mediaScalarWhereInput | Prisma.post_mediaScalarWhereInput[];
    id?: Prisma.StringFilter<"post_media"> | string;
    post_id?: Prisma.StringFilter<"post_media"> | string;
    sort_order?: Prisma.IntFilter<"post_media"> | number;
    media_type?: Prisma.Enummedia_typeFilter<"post_media"> | $Enums.media_type;
    mime_type?: Prisma.StringFilter<"post_media"> | string;
    file_size_bytes?: Prisma.IntFilter<"post_media"> | number;
    original_name?: Prisma.StringFilter<"post_media"> | string;
    storage_key?: Prisma.StringFilter<"post_media"> | string;
    storage_provider?: Prisma.StringFilter<"post_media"> | string;
    width?: Prisma.IntNullableFilter<"post_media"> | number | null;
    height?: Prisma.IntNullableFilter<"post_media"> | number | null;
    duration_sec?: Prisma.IntNullableFilter<"post_media"> | number | null;
    thumbnail_key?: Prisma.StringNullableFilter<"post_media"> | string | null;
    created_at?: Prisma.DateTimeFilter<"post_media"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"post_media"> | Date | string;
};
export type post_mediaCreateManyPostInput = {
    id?: string;
    sort_order?: number;
    media_type: $Enums.media_type;
    mime_type: string;
    file_size_bytes: number;
    original_name: string;
    storage_key: string;
    storage_provider?: string;
    width?: number | null;
    height?: number | null;
    duration_sec?: number | null;
    thumbnail_key?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type post_mediaUpdateWithoutPostInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    sort_order?: Prisma.IntFieldUpdateOperationsInput | number;
    media_type?: Prisma.Enummedia_typeFieldUpdateOperationsInput | $Enums.media_type;
    mime_type?: Prisma.StringFieldUpdateOperationsInput | string;
    file_size_bytes?: Prisma.IntFieldUpdateOperationsInput | number;
    original_name?: Prisma.StringFieldUpdateOperationsInput | string;
    storage_key?: Prisma.StringFieldUpdateOperationsInput | string;
    storage_provider?: Prisma.StringFieldUpdateOperationsInput | string;
    width?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    height?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    duration_sec?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    thumbnail_key?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type post_mediaUncheckedUpdateWithoutPostInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    sort_order?: Prisma.IntFieldUpdateOperationsInput | number;
    media_type?: Prisma.Enummedia_typeFieldUpdateOperationsInput | $Enums.media_type;
    mime_type?: Prisma.StringFieldUpdateOperationsInput | string;
    file_size_bytes?: Prisma.IntFieldUpdateOperationsInput | number;
    original_name?: Prisma.StringFieldUpdateOperationsInput | string;
    storage_key?: Prisma.StringFieldUpdateOperationsInput | string;
    storage_provider?: Prisma.StringFieldUpdateOperationsInput | string;
    width?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    height?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    duration_sec?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    thumbnail_key?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type post_mediaUncheckedUpdateManyWithoutPostInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    sort_order?: Prisma.IntFieldUpdateOperationsInput | number;
    media_type?: Prisma.Enummedia_typeFieldUpdateOperationsInput | $Enums.media_type;
    mime_type?: Prisma.StringFieldUpdateOperationsInput | string;
    file_size_bytes?: Prisma.IntFieldUpdateOperationsInput | number;
    original_name?: Prisma.StringFieldUpdateOperationsInput | string;
    storage_key?: Prisma.StringFieldUpdateOperationsInput | string;
    storage_provider?: Prisma.StringFieldUpdateOperationsInput | string;
    width?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    height?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    duration_sec?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    thumbnail_key?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type post_mediaSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    post_id?: boolean;
    sort_order?: boolean;
    media_type?: boolean;
    mime_type?: boolean;
    file_size_bytes?: boolean;
    original_name?: boolean;
    storage_key?: boolean;
    storage_provider?: boolean;
    width?: boolean;
    height?: boolean;
    duration_sec?: boolean;
    thumbnail_key?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    post?: boolean | Prisma.postsDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["post_media"]>;
export type post_mediaSelectScalar = {
    id?: boolean;
    post_id?: boolean;
    sort_order?: boolean;
    media_type?: boolean;
    mime_type?: boolean;
    file_size_bytes?: boolean;
    original_name?: boolean;
    storage_key?: boolean;
    storage_provider?: boolean;
    width?: boolean;
    height?: boolean;
    duration_sec?: boolean;
    thumbnail_key?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
};
export type post_mediaOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "post_id" | "sort_order" | "media_type" | "mime_type" | "file_size_bytes" | "original_name" | "storage_key" | "storage_provider" | "width" | "height" | "duration_sec" | "thumbnail_key" | "created_at" | "updated_at", ExtArgs["result"]["post_media"]>;
export type post_mediaInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    post?: boolean | Prisma.postsDefaultArgs<ExtArgs>;
};
export type $post_mediaPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "post_media";
    objects: {
        post: Prisma.$postsPayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        post_id: string;
        sort_order: number;
        media_type: $Enums.media_type;
        mime_type: string;
        file_size_bytes: number;
        original_name: string;
        storage_key: string;
        storage_provider: string;
        width: number | null;
        height: number | null;
        duration_sec: number | null;
        thumbnail_key: string | null;
        created_at: Date;
        updated_at: Date;
    }, ExtArgs["result"]["post_media"]>;
    composites: {};
};
export type post_mediaGetPayload<S extends boolean | null | undefined | post_mediaDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$post_mediaPayload, S>;
export type post_mediaCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<post_mediaFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: Post_mediaCountAggregateInputType | true;
};
export interface post_mediaDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['post_media'];
        meta: {
            name: 'post_media';
        };
    };
    findUnique<T extends post_mediaFindUniqueArgs>(args: Prisma.SelectSubset<T, post_mediaFindUniqueArgs<ExtArgs>>): Prisma.Prisma__post_mediaClient<runtime.Types.Result.GetResult<Prisma.$post_mediaPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends post_mediaFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, post_mediaFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__post_mediaClient<runtime.Types.Result.GetResult<Prisma.$post_mediaPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends post_mediaFindFirstArgs>(args?: Prisma.SelectSubset<T, post_mediaFindFirstArgs<ExtArgs>>): Prisma.Prisma__post_mediaClient<runtime.Types.Result.GetResult<Prisma.$post_mediaPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends post_mediaFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, post_mediaFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__post_mediaClient<runtime.Types.Result.GetResult<Prisma.$post_mediaPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends post_mediaFindManyArgs>(args?: Prisma.SelectSubset<T, post_mediaFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$post_mediaPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends post_mediaCreateArgs>(args: Prisma.SelectSubset<T, post_mediaCreateArgs<ExtArgs>>): Prisma.Prisma__post_mediaClient<runtime.Types.Result.GetResult<Prisma.$post_mediaPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends post_mediaCreateManyArgs>(args?: Prisma.SelectSubset<T, post_mediaCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends post_mediaDeleteArgs>(args: Prisma.SelectSubset<T, post_mediaDeleteArgs<ExtArgs>>): Prisma.Prisma__post_mediaClient<runtime.Types.Result.GetResult<Prisma.$post_mediaPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends post_mediaUpdateArgs>(args: Prisma.SelectSubset<T, post_mediaUpdateArgs<ExtArgs>>): Prisma.Prisma__post_mediaClient<runtime.Types.Result.GetResult<Prisma.$post_mediaPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends post_mediaDeleteManyArgs>(args?: Prisma.SelectSubset<T, post_mediaDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends post_mediaUpdateManyArgs>(args: Prisma.SelectSubset<T, post_mediaUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends post_mediaUpsertArgs>(args: Prisma.SelectSubset<T, post_mediaUpsertArgs<ExtArgs>>): Prisma.Prisma__post_mediaClient<runtime.Types.Result.GetResult<Prisma.$post_mediaPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends post_mediaCountArgs>(args?: Prisma.Subset<T, post_mediaCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], Post_mediaCountAggregateOutputType> : number>;
    aggregate<T extends Post_mediaAggregateArgs>(args: Prisma.Subset<T, Post_mediaAggregateArgs>): Prisma.PrismaPromise<GetPost_mediaAggregateType<T>>;
    groupBy<T extends post_mediaGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: post_mediaGroupByArgs['orderBy'];
    } : {
        orderBy?: post_mediaGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, post_mediaGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPost_mediaGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: post_mediaFieldRefs;
}
export interface Prisma__post_mediaClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    post<T extends Prisma.postsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.postsDefaultArgs<ExtArgs>>): Prisma.Prisma__postsClient<runtime.Types.Result.GetResult<Prisma.$postsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface post_mediaFieldRefs {
    readonly id: Prisma.FieldRef<"post_media", 'String'>;
    readonly post_id: Prisma.FieldRef<"post_media", 'String'>;
    readonly sort_order: Prisma.FieldRef<"post_media", 'Int'>;
    readonly media_type: Prisma.FieldRef<"post_media", 'media_type'>;
    readonly mime_type: Prisma.FieldRef<"post_media", 'String'>;
    readonly file_size_bytes: Prisma.FieldRef<"post_media", 'Int'>;
    readonly original_name: Prisma.FieldRef<"post_media", 'String'>;
    readonly storage_key: Prisma.FieldRef<"post_media", 'String'>;
    readonly storage_provider: Prisma.FieldRef<"post_media", 'String'>;
    readonly width: Prisma.FieldRef<"post_media", 'Int'>;
    readonly height: Prisma.FieldRef<"post_media", 'Int'>;
    readonly duration_sec: Prisma.FieldRef<"post_media", 'Int'>;
    readonly thumbnail_key: Prisma.FieldRef<"post_media", 'String'>;
    readonly created_at: Prisma.FieldRef<"post_media", 'DateTime'>;
    readonly updated_at: Prisma.FieldRef<"post_media", 'DateTime'>;
}
export type post_mediaFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.post_mediaSelect<ExtArgs> | null;
    omit?: Prisma.post_mediaOmit<ExtArgs> | null;
    include?: Prisma.post_mediaInclude<ExtArgs> | null;
    where: Prisma.post_mediaWhereUniqueInput;
};
export type post_mediaFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.post_mediaSelect<ExtArgs> | null;
    omit?: Prisma.post_mediaOmit<ExtArgs> | null;
    include?: Prisma.post_mediaInclude<ExtArgs> | null;
    where: Prisma.post_mediaWhereUniqueInput;
};
export type post_mediaFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type post_mediaFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type post_mediaFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type post_mediaCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.post_mediaSelect<ExtArgs> | null;
    omit?: Prisma.post_mediaOmit<ExtArgs> | null;
    include?: Prisma.post_mediaInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.post_mediaCreateInput, Prisma.post_mediaUncheckedCreateInput>;
};
export type post_mediaCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.post_mediaCreateManyInput | Prisma.post_mediaCreateManyInput[];
    skipDuplicates?: boolean;
};
export type post_mediaUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.post_mediaSelect<ExtArgs> | null;
    omit?: Prisma.post_mediaOmit<ExtArgs> | null;
    include?: Prisma.post_mediaInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.post_mediaUpdateInput, Prisma.post_mediaUncheckedUpdateInput>;
    where: Prisma.post_mediaWhereUniqueInput;
};
export type post_mediaUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.post_mediaUpdateManyMutationInput, Prisma.post_mediaUncheckedUpdateManyInput>;
    where?: Prisma.post_mediaWhereInput;
    limit?: number;
};
export type post_mediaUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.post_mediaSelect<ExtArgs> | null;
    omit?: Prisma.post_mediaOmit<ExtArgs> | null;
    include?: Prisma.post_mediaInclude<ExtArgs> | null;
    where: Prisma.post_mediaWhereUniqueInput;
    create: Prisma.XOR<Prisma.post_mediaCreateInput, Prisma.post_mediaUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.post_mediaUpdateInput, Prisma.post_mediaUncheckedUpdateInput>;
};
export type post_mediaDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.post_mediaSelect<ExtArgs> | null;
    omit?: Prisma.post_mediaOmit<ExtArgs> | null;
    include?: Prisma.post_mediaInclude<ExtArgs> | null;
    where: Prisma.post_mediaWhereUniqueInput;
};
export type post_mediaDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.post_mediaWhereInput;
    limit?: number;
};
export type post_mediaDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.post_mediaSelect<ExtArgs> | null;
    omit?: Prisma.post_mediaOmit<ExtArgs> | null;
    include?: Prisma.post_mediaInclude<ExtArgs> | null;
};
export {};
