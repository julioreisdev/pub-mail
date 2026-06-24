import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type webchat_adsModel = runtime.Types.Result.DefaultSelection<Prisma.$webchat_adsPayload>;
export type AggregateWebchat_ads = {
    _count: Webchat_adsCountAggregateOutputType | null;
    _avg: Webchat_adsAvgAggregateOutputType | null;
    _sum: Webchat_adsSumAggregateOutputType | null;
    _min: Webchat_adsMinAggregateOutputType | null;
    _max: Webchat_adsMaxAggregateOutputType | null;
};
export type Webchat_adsAvgAggregateOutputType = {
    intervalo_mensagens: number | null;
};
export type Webchat_adsSumAggregateOutputType = {
    intervalo_mensagens: number | null;
};
export type Webchat_adsMinAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    webchat_id: string | null;
    position: string | null;
    codigo_tag: string | null;
    gpt_sizes: string | null;
    gpt_slot: string | null;
    gpt_div_id: string | null;
    anuncio_fixed: string | null;
    intervalo_mensagens: number | null;
    ativo: boolean | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type Webchat_adsMaxAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    webchat_id: string | null;
    position: string | null;
    codigo_tag: string | null;
    gpt_sizes: string | null;
    gpt_slot: string | null;
    gpt_div_id: string | null;
    anuncio_fixed: string | null;
    intervalo_mensagens: number | null;
    ativo: boolean | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type Webchat_adsCountAggregateOutputType = {
    id: number;
    organization_id: number;
    webchat_id: number;
    position: number;
    codigo_tag: number;
    gpt_sizes: number;
    gpt_slot: number;
    gpt_div_id: number;
    anuncio_fixed: number;
    intervalo_mensagens: number;
    sequence_ads: number;
    ativo: number;
    created_at: number;
    updated_at: number;
    _all: number;
};
export type Webchat_adsAvgAggregateInputType = {
    intervalo_mensagens?: true;
};
export type Webchat_adsSumAggregateInputType = {
    intervalo_mensagens?: true;
};
export type Webchat_adsMinAggregateInputType = {
    id?: true;
    organization_id?: true;
    webchat_id?: true;
    position?: true;
    codigo_tag?: true;
    gpt_sizes?: true;
    gpt_slot?: true;
    gpt_div_id?: true;
    anuncio_fixed?: true;
    intervalo_mensagens?: true;
    ativo?: true;
    created_at?: true;
    updated_at?: true;
};
export type Webchat_adsMaxAggregateInputType = {
    id?: true;
    organization_id?: true;
    webchat_id?: true;
    position?: true;
    codigo_tag?: true;
    gpt_sizes?: true;
    gpt_slot?: true;
    gpt_div_id?: true;
    anuncio_fixed?: true;
    intervalo_mensagens?: true;
    ativo?: true;
    created_at?: true;
    updated_at?: true;
};
export type Webchat_adsCountAggregateInputType = {
    id?: true;
    organization_id?: true;
    webchat_id?: true;
    position?: true;
    codigo_tag?: true;
    gpt_sizes?: true;
    gpt_slot?: true;
    gpt_div_id?: true;
    anuncio_fixed?: true;
    intervalo_mensagens?: true;
    sequence_ads?: true;
    ativo?: true;
    created_at?: true;
    updated_at?: true;
    _all?: true;
};
export type Webchat_adsAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.webchat_adsWhereInput;
    orderBy?: Prisma.webchat_adsOrderByWithRelationInput | Prisma.webchat_adsOrderByWithRelationInput[];
    cursor?: Prisma.webchat_adsWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | Webchat_adsCountAggregateInputType;
    _avg?: Webchat_adsAvgAggregateInputType;
    _sum?: Webchat_adsSumAggregateInputType;
    _min?: Webchat_adsMinAggregateInputType;
    _max?: Webchat_adsMaxAggregateInputType;
};
export type GetWebchat_adsAggregateType<T extends Webchat_adsAggregateArgs> = {
    [P in keyof T & keyof AggregateWebchat_ads]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateWebchat_ads[P]> : Prisma.GetScalarType<T[P], AggregateWebchat_ads[P]>;
};
export type webchat_adsGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.webchat_adsWhereInput;
    orderBy?: Prisma.webchat_adsOrderByWithAggregationInput | Prisma.webchat_adsOrderByWithAggregationInput[];
    by: Prisma.Webchat_adsScalarFieldEnum[] | Prisma.Webchat_adsScalarFieldEnum;
    having?: Prisma.webchat_adsScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: Webchat_adsCountAggregateInputType | true;
    _avg?: Webchat_adsAvgAggregateInputType;
    _sum?: Webchat_adsSumAggregateInputType;
    _min?: Webchat_adsMinAggregateInputType;
    _max?: Webchat_adsMaxAggregateInputType;
};
export type Webchat_adsGroupByOutputType = {
    id: string;
    organization_id: string;
    webchat_id: string;
    position: string;
    codigo_tag: string;
    gpt_sizes: string | null;
    gpt_slot: string | null;
    gpt_div_id: string | null;
    anuncio_fixed: string | null;
    intervalo_mensagens: number | null;
    sequence_ads: runtime.JsonValue | null;
    ativo: boolean;
    created_at: Date;
    updated_at: Date;
    _count: Webchat_adsCountAggregateOutputType | null;
    _avg: Webchat_adsAvgAggregateOutputType | null;
    _sum: Webchat_adsSumAggregateOutputType | null;
    _min: Webchat_adsMinAggregateOutputType | null;
    _max: Webchat_adsMaxAggregateOutputType | null;
};
type GetWebchat_adsGroupByPayload<T extends webchat_adsGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<Webchat_adsGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof Webchat_adsGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], Webchat_adsGroupByOutputType[P]> : Prisma.GetScalarType<T[P], Webchat_adsGroupByOutputType[P]>;
}>>;
export type webchat_adsWhereInput = {
    AND?: Prisma.webchat_adsWhereInput | Prisma.webchat_adsWhereInput[];
    OR?: Prisma.webchat_adsWhereInput[];
    NOT?: Prisma.webchat_adsWhereInput | Prisma.webchat_adsWhereInput[];
    id?: Prisma.StringFilter<"webchat_ads"> | string;
    organization_id?: Prisma.StringFilter<"webchat_ads"> | string;
    webchat_id?: Prisma.StringFilter<"webchat_ads"> | string;
    position?: Prisma.StringFilter<"webchat_ads"> | string;
    codigo_tag?: Prisma.StringFilter<"webchat_ads"> | string;
    gpt_sizes?: Prisma.StringNullableFilter<"webchat_ads"> | string | null;
    gpt_slot?: Prisma.StringNullableFilter<"webchat_ads"> | string | null;
    gpt_div_id?: Prisma.StringNullableFilter<"webchat_ads"> | string | null;
    anuncio_fixed?: Prisma.StringNullableFilter<"webchat_ads"> | string | null;
    intervalo_mensagens?: Prisma.IntNullableFilter<"webchat_ads"> | number | null;
    sequence_ads?: Prisma.JsonNullableFilter<"webchat_ads">;
    ativo?: Prisma.BoolFilter<"webchat_ads"> | boolean;
    created_at?: Prisma.DateTimeFilter<"webchat_ads"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"webchat_ads"> | Date | string;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
    webchats?: Prisma.XOR<Prisma.WebchatsScalarRelationFilter, Prisma.webchatsWhereInput>;
};
export type webchat_adsOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    webchat_id?: Prisma.SortOrder;
    position?: Prisma.SortOrder;
    codigo_tag?: Prisma.SortOrder;
    gpt_sizes?: Prisma.SortOrderInput | Prisma.SortOrder;
    gpt_slot?: Prisma.SortOrderInput | Prisma.SortOrder;
    gpt_div_id?: Prisma.SortOrderInput | Prisma.SortOrder;
    anuncio_fixed?: Prisma.SortOrderInput | Prisma.SortOrder;
    intervalo_mensagens?: Prisma.SortOrderInput | Prisma.SortOrder;
    sequence_ads?: Prisma.SortOrderInput | Prisma.SortOrder;
    ativo?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    organizations?: Prisma.organizationsOrderByWithRelationInput;
    webchats?: Prisma.webchatsOrderByWithRelationInput;
    _relevance?: Prisma.webchat_adsOrderByRelevanceInput;
};
export type webchat_adsWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    webchat_id_position?: Prisma.webchat_adsWebchat_idPositionCompoundUniqueInput;
    AND?: Prisma.webchat_adsWhereInput | Prisma.webchat_adsWhereInput[];
    OR?: Prisma.webchat_adsWhereInput[];
    NOT?: Prisma.webchat_adsWhereInput | Prisma.webchat_adsWhereInput[];
    organization_id?: Prisma.StringFilter<"webchat_ads"> | string;
    webchat_id?: Prisma.StringFilter<"webchat_ads"> | string;
    position?: Prisma.StringFilter<"webchat_ads"> | string;
    codigo_tag?: Prisma.StringFilter<"webchat_ads"> | string;
    gpt_sizes?: Prisma.StringNullableFilter<"webchat_ads"> | string | null;
    gpt_slot?: Prisma.StringNullableFilter<"webchat_ads"> | string | null;
    gpt_div_id?: Prisma.StringNullableFilter<"webchat_ads"> | string | null;
    anuncio_fixed?: Prisma.StringNullableFilter<"webchat_ads"> | string | null;
    intervalo_mensagens?: Prisma.IntNullableFilter<"webchat_ads"> | number | null;
    sequence_ads?: Prisma.JsonNullableFilter<"webchat_ads">;
    ativo?: Prisma.BoolFilter<"webchat_ads"> | boolean;
    created_at?: Prisma.DateTimeFilter<"webchat_ads"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"webchat_ads"> | Date | string;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
    webchats?: Prisma.XOR<Prisma.WebchatsScalarRelationFilter, Prisma.webchatsWhereInput>;
}, "id" | "webchat_id_position">;
export type webchat_adsOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    webchat_id?: Prisma.SortOrder;
    position?: Prisma.SortOrder;
    codigo_tag?: Prisma.SortOrder;
    gpt_sizes?: Prisma.SortOrderInput | Prisma.SortOrder;
    gpt_slot?: Prisma.SortOrderInput | Prisma.SortOrder;
    gpt_div_id?: Prisma.SortOrderInput | Prisma.SortOrder;
    anuncio_fixed?: Prisma.SortOrderInput | Prisma.SortOrder;
    intervalo_mensagens?: Prisma.SortOrderInput | Prisma.SortOrder;
    sequence_ads?: Prisma.SortOrderInput | Prisma.SortOrder;
    ativo?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    _count?: Prisma.webchat_adsCountOrderByAggregateInput;
    _avg?: Prisma.webchat_adsAvgOrderByAggregateInput;
    _max?: Prisma.webchat_adsMaxOrderByAggregateInput;
    _min?: Prisma.webchat_adsMinOrderByAggregateInput;
    _sum?: Prisma.webchat_adsSumOrderByAggregateInput;
};
export type webchat_adsScalarWhereWithAggregatesInput = {
    AND?: Prisma.webchat_adsScalarWhereWithAggregatesInput | Prisma.webchat_adsScalarWhereWithAggregatesInput[];
    OR?: Prisma.webchat_adsScalarWhereWithAggregatesInput[];
    NOT?: Prisma.webchat_adsScalarWhereWithAggregatesInput | Prisma.webchat_adsScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"webchat_ads"> | string;
    organization_id?: Prisma.StringWithAggregatesFilter<"webchat_ads"> | string;
    webchat_id?: Prisma.StringWithAggregatesFilter<"webchat_ads"> | string;
    position?: Prisma.StringWithAggregatesFilter<"webchat_ads"> | string;
    codigo_tag?: Prisma.StringWithAggregatesFilter<"webchat_ads"> | string;
    gpt_sizes?: Prisma.StringNullableWithAggregatesFilter<"webchat_ads"> | string | null;
    gpt_slot?: Prisma.StringNullableWithAggregatesFilter<"webchat_ads"> | string | null;
    gpt_div_id?: Prisma.StringNullableWithAggregatesFilter<"webchat_ads"> | string | null;
    anuncio_fixed?: Prisma.StringNullableWithAggregatesFilter<"webchat_ads"> | string | null;
    intervalo_mensagens?: Prisma.IntNullableWithAggregatesFilter<"webchat_ads"> | number | null;
    sequence_ads?: Prisma.JsonNullableWithAggregatesFilter<"webchat_ads">;
    ativo?: Prisma.BoolWithAggregatesFilter<"webchat_ads"> | boolean;
    created_at?: Prisma.DateTimeWithAggregatesFilter<"webchat_ads"> | Date | string;
    updated_at?: Prisma.DateTimeWithAggregatesFilter<"webchat_ads"> | Date | string;
};
export type webchat_adsCreateInput = {
    id?: string;
    position: string;
    codigo_tag: string;
    gpt_sizes?: string | null;
    gpt_slot?: string | null;
    gpt_div_id?: string | null;
    anuncio_fixed?: string | null;
    intervalo_mensagens?: number | null;
    sequence_ads?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    ativo?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
    organizations: Prisma.organizationsCreateNestedOneWithoutWebchat_adsInput;
    webchats: Prisma.webchatsCreateNestedOneWithoutWebchat_adsInput;
};
export type webchat_adsUncheckedCreateInput = {
    id?: string;
    organization_id: string;
    webchat_id: string;
    position: string;
    codigo_tag: string;
    gpt_sizes?: string | null;
    gpt_slot?: string | null;
    gpt_div_id?: string | null;
    anuncio_fixed?: string | null;
    intervalo_mensagens?: number | null;
    sequence_ads?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    ativo?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type webchat_adsUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    position?: Prisma.StringFieldUpdateOperationsInput | string;
    codigo_tag?: Prisma.StringFieldUpdateOperationsInput | string;
    gpt_sizes?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gpt_slot?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gpt_div_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    anuncio_fixed?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    intervalo_mensagens?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    sequence_ads?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    ativo?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutWebchat_adsNestedInput;
    webchats?: Prisma.webchatsUpdateOneRequiredWithoutWebchat_adsNestedInput;
};
export type webchat_adsUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    webchat_id?: Prisma.StringFieldUpdateOperationsInput | string;
    position?: Prisma.StringFieldUpdateOperationsInput | string;
    codigo_tag?: Prisma.StringFieldUpdateOperationsInput | string;
    gpt_sizes?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gpt_slot?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gpt_div_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    anuncio_fixed?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    intervalo_mensagens?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    sequence_ads?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    ativo?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_adsCreateManyInput = {
    id?: string;
    organization_id: string;
    webchat_id: string;
    position: string;
    codigo_tag: string;
    gpt_sizes?: string | null;
    gpt_slot?: string | null;
    gpt_div_id?: string | null;
    anuncio_fixed?: string | null;
    intervalo_mensagens?: number | null;
    sequence_ads?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    ativo?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type webchat_adsUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    position?: Prisma.StringFieldUpdateOperationsInput | string;
    codigo_tag?: Prisma.StringFieldUpdateOperationsInput | string;
    gpt_sizes?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gpt_slot?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gpt_div_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    anuncio_fixed?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    intervalo_mensagens?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    sequence_ads?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    ativo?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_adsUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    webchat_id?: Prisma.StringFieldUpdateOperationsInput | string;
    position?: Prisma.StringFieldUpdateOperationsInput | string;
    codigo_tag?: Prisma.StringFieldUpdateOperationsInput | string;
    gpt_sizes?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gpt_slot?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gpt_div_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    anuncio_fixed?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    intervalo_mensagens?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    sequence_ads?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    ativo?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type Webchat_adsListRelationFilter = {
    every?: Prisma.webchat_adsWhereInput;
    some?: Prisma.webchat_adsWhereInput;
    none?: Prisma.webchat_adsWhereInput;
};
export type webchat_adsOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type webchat_adsOrderByRelevanceInput = {
    fields: Prisma.webchat_adsOrderByRelevanceFieldEnum | Prisma.webchat_adsOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type webchat_adsWebchat_idPositionCompoundUniqueInput = {
    webchat_id: string;
    position: string;
};
export type webchat_adsCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    webchat_id?: Prisma.SortOrder;
    position?: Prisma.SortOrder;
    codigo_tag?: Prisma.SortOrder;
    gpt_sizes?: Prisma.SortOrder;
    gpt_slot?: Prisma.SortOrder;
    gpt_div_id?: Prisma.SortOrder;
    anuncio_fixed?: Prisma.SortOrder;
    intervalo_mensagens?: Prisma.SortOrder;
    sequence_ads?: Prisma.SortOrder;
    ativo?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type webchat_adsAvgOrderByAggregateInput = {
    intervalo_mensagens?: Prisma.SortOrder;
};
export type webchat_adsMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    webchat_id?: Prisma.SortOrder;
    position?: Prisma.SortOrder;
    codigo_tag?: Prisma.SortOrder;
    gpt_sizes?: Prisma.SortOrder;
    gpt_slot?: Prisma.SortOrder;
    gpt_div_id?: Prisma.SortOrder;
    anuncio_fixed?: Prisma.SortOrder;
    intervalo_mensagens?: Prisma.SortOrder;
    ativo?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type webchat_adsMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    webchat_id?: Prisma.SortOrder;
    position?: Prisma.SortOrder;
    codigo_tag?: Prisma.SortOrder;
    gpt_sizes?: Prisma.SortOrder;
    gpt_slot?: Prisma.SortOrder;
    gpt_div_id?: Prisma.SortOrder;
    anuncio_fixed?: Prisma.SortOrder;
    intervalo_mensagens?: Prisma.SortOrder;
    ativo?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type webchat_adsSumOrderByAggregateInput = {
    intervalo_mensagens?: Prisma.SortOrder;
};
export type webchat_adsCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.webchat_adsCreateWithoutOrganizationsInput, Prisma.webchat_adsUncheckedCreateWithoutOrganizationsInput> | Prisma.webchat_adsCreateWithoutOrganizationsInput[] | Prisma.webchat_adsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.webchat_adsCreateOrConnectWithoutOrganizationsInput | Prisma.webchat_adsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.webchat_adsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.webchat_adsWhereUniqueInput | Prisma.webchat_adsWhereUniqueInput[];
};
export type webchat_adsUncheckedCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.webchat_adsCreateWithoutOrganizationsInput, Prisma.webchat_adsUncheckedCreateWithoutOrganizationsInput> | Prisma.webchat_adsCreateWithoutOrganizationsInput[] | Prisma.webchat_adsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.webchat_adsCreateOrConnectWithoutOrganizationsInput | Prisma.webchat_adsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.webchat_adsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.webchat_adsWhereUniqueInput | Prisma.webchat_adsWhereUniqueInput[];
};
export type webchat_adsUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.webchat_adsCreateWithoutOrganizationsInput, Prisma.webchat_adsUncheckedCreateWithoutOrganizationsInput> | Prisma.webchat_adsCreateWithoutOrganizationsInput[] | Prisma.webchat_adsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.webchat_adsCreateOrConnectWithoutOrganizationsInput | Prisma.webchat_adsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.webchat_adsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.webchat_adsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.webchat_adsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.webchat_adsWhereUniqueInput | Prisma.webchat_adsWhereUniqueInput[];
    disconnect?: Prisma.webchat_adsWhereUniqueInput | Prisma.webchat_adsWhereUniqueInput[];
    delete?: Prisma.webchat_adsWhereUniqueInput | Prisma.webchat_adsWhereUniqueInput[];
    connect?: Prisma.webchat_adsWhereUniqueInput | Prisma.webchat_adsWhereUniqueInput[];
    update?: Prisma.webchat_adsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.webchat_adsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.webchat_adsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.webchat_adsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.webchat_adsScalarWhereInput | Prisma.webchat_adsScalarWhereInput[];
};
export type webchat_adsUncheckedUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.webchat_adsCreateWithoutOrganizationsInput, Prisma.webchat_adsUncheckedCreateWithoutOrganizationsInput> | Prisma.webchat_adsCreateWithoutOrganizationsInput[] | Prisma.webchat_adsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.webchat_adsCreateOrConnectWithoutOrganizationsInput | Prisma.webchat_adsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.webchat_adsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.webchat_adsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.webchat_adsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.webchat_adsWhereUniqueInput | Prisma.webchat_adsWhereUniqueInput[];
    disconnect?: Prisma.webchat_adsWhereUniqueInput | Prisma.webchat_adsWhereUniqueInput[];
    delete?: Prisma.webchat_adsWhereUniqueInput | Prisma.webchat_adsWhereUniqueInput[];
    connect?: Prisma.webchat_adsWhereUniqueInput | Prisma.webchat_adsWhereUniqueInput[];
    update?: Prisma.webchat_adsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.webchat_adsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.webchat_adsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.webchat_adsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.webchat_adsScalarWhereInput | Prisma.webchat_adsScalarWhereInput[];
};
export type webchat_adsCreateNestedManyWithoutWebchatsInput = {
    create?: Prisma.XOR<Prisma.webchat_adsCreateWithoutWebchatsInput, Prisma.webchat_adsUncheckedCreateWithoutWebchatsInput> | Prisma.webchat_adsCreateWithoutWebchatsInput[] | Prisma.webchat_adsUncheckedCreateWithoutWebchatsInput[];
    connectOrCreate?: Prisma.webchat_adsCreateOrConnectWithoutWebchatsInput | Prisma.webchat_adsCreateOrConnectWithoutWebchatsInput[];
    createMany?: Prisma.webchat_adsCreateManyWebchatsInputEnvelope;
    connect?: Prisma.webchat_adsWhereUniqueInput | Prisma.webchat_adsWhereUniqueInput[];
};
export type webchat_adsUncheckedCreateNestedManyWithoutWebchatsInput = {
    create?: Prisma.XOR<Prisma.webchat_adsCreateWithoutWebchatsInput, Prisma.webchat_adsUncheckedCreateWithoutWebchatsInput> | Prisma.webchat_adsCreateWithoutWebchatsInput[] | Prisma.webchat_adsUncheckedCreateWithoutWebchatsInput[];
    connectOrCreate?: Prisma.webchat_adsCreateOrConnectWithoutWebchatsInput | Prisma.webchat_adsCreateOrConnectWithoutWebchatsInput[];
    createMany?: Prisma.webchat_adsCreateManyWebchatsInputEnvelope;
    connect?: Prisma.webchat_adsWhereUniqueInput | Prisma.webchat_adsWhereUniqueInput[];
};
export type webchat_adsUpdateManyWithoutWebchatsNestedInput = {
    create?: Prisma.XOR<Prisma.webchat_adsCreateWithoutWebchatsInput, Prisma.webchat_adsUncheckedCreateWithoutWebchatsInput> | Prisma.webchat_adsCreateWithoutWebchatsInput[] | Prisma.webchat_adsUncheckedCreateWithoutWebchatsInput[];
    connectOrCreate?: Prisma.webchat_adsCreateOrConnectWithoutWebchatsInput | Prisma.webchat_adsCreateOrConnectWithoutWebchatsInput[];
    upsert?: Prisma.webchat_adsUpsertWithWhereUniqueWithoutWebchatsInput | Prisma.webchat_adsUpsertWithWhereUniqueWithoutWebchatsInput[];
    createMany?: Prisma.webchat_adsCreateManyWebchatsInputEnvelope;
    set?: Prisma.webchat_adsWhereUniqueInput | Prisma.webchat_adsWhereUniqueInput[];
    disconnect?: Prisma.webchat_adsWhereUniqueInput | Prisma.webchat_adsWhereUniqueInput[];
    delete?: Prisma.webchat_adsWhereUniqueInput | Prisma.webchat_adsWhereUniqueInput[];
    connect?: Prisma.webchat_adsWhereUniqueInput | Prisma.webchat_adsWhereUniqueInput[];
    update?: Prisma.webchat_adsUpdateWithWhereUniqueWithoutWebchatsInput | Prisma.webchat_adsUpdateWithWhereUniqueWithoutWebchatsInput[];
    updateMany?: Prisma.webchat_adsUpdateManyWithWhereWithoutWebchatsInput | Prisma.webchat_adsUpdateManyWithWhereWithoutWebchatsInput[];
    deleteMany?: Prisma.webchat_adsScalarWhereInput | Prisma.webchat_adsScalarWhereInput[];
};
export type webchat_adsUncheckedUpdateManyWithoutWebchatsNestedInput = {
    create?: Prisma.XOR<Prisma.webchat_adsCreateWithoutWebchatsInput, Prisma.webchat_adsUncheckedCreateWithoutWebchatsInput> | Prisma.webchat_adsCreateWithoutWebchatsInput[] | Prisma.webchat_adsUncheckedCreateWithoutWebchatsInput[];
    connectOrCreate?: Prisma.webchat_adsCreateOrConnectWithoutWebchatsInput | Prisma.webchat_adsCreateOrConnectWithoutWebchatsInput[];
    upsert?: Prisma.webchat_adsUpsertWithWhereUniqueWithoutWebchatsInput | Prisma.webchat_adsUpsertWithWhereUniqueWithoutWebchatsInput[];
    createMany?: Prisma.webchat_adsCreateManyWebchatsInputEnvelope;
    set?: Prisma.webchat_adsWhereUniqueInput | Prisma.webchat_adsWhereUniqueInput[];
    disconnect?: Prisma.webchat_adsWhereUniqueInput | Prisma.webchat_adsWhereUniqueInput[];
    delete?: Prisma.webchat_adsWhereUniqueInput | Prisma.webchat_adsWhereUniqueInput[];
    connect?: Prisma.webchat_adsWhereUniqueInput | Prisma.webchat_adsWhereUniqueInput[];
    update?: Prisma.webchat_adsUpdateWithWhereUniqueWithoutWebchatsInput | Prisma.webchat_adsUpdateWithWhereUniqueWithoutWebchatsInput[];
    updateMany?: Prisma.webchat_adsUpdateManyWithWhereWithoutWebchatsInput | Prisma.webchat_adsUpdateManyWithWhereWithoutWebchatsInput[];
    deleteMany?: Prisma.webchat_adsScalarWhereInput | Prisma.webchat_adsScalarWhereInput[];
};
export type webchat_adsCreateWithoutOrganizationsInput = {
    id?: string;
    position: string;
    codigo_tag: string;
    gpt_sizes?: string | null;
    gpt_slot?: string | null;
    gpt_div_id?: string | null;
    anuncio_fixed?: string | null;
    intervalo_mensagens?: number | null;
    sequence_ads?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    ativo?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
    webchats: Prisma.webchatsCreateNestedOneWithoutWebchat_adsInput;
};
export type webchat_adsUncheckedCreateWithoutOrganizationsInput = {
    id?: string;
    webchat_id: string;
    position: string;
    codigo_tag: string;
    gpt_sizes?: string | null;
    gpt_slot?: string | null;
    gpt_div_id?: string | null;
    anuncio_fixed?: string | null;
    intervalo_mensagens?: number | null;
    sequence_ads?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    ativo?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type webchat_adsCreateOrConnectWithoutOrganizationsInput = {
    where: Prisma.webchat_adsWhereUniqueInput;
    create: Prisma.XOR<Prisma.webchat_adsCreateWithoutOrganizationsInput, Prisma.webchat_adsUncheckedCreateWithoutOrganizationsInput>;
};
export type webchat_adsCreateManyOrganizationsInputEnvelope = {
    data: Prisma.webchat_adsCreateManyOrganizationsInput | Prisma.webchat_adsCreateManyOrganizationsInput[];
    skipDuplicates?: boolean;
};
export type webchat_adsUpsertWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.webchat_adsWhereUniqueInput;
    update: Prisma.XOR<Prisma.webchat_adsUpdateWithoutOrganizationsInput, Prisma.webchat_adsUncheckedUpdateWithoutOrganizationsInput>;
    create: Prisma.XOR<Prisma.webchat_adsCreateWithoutOrganizationsInput, Prisma.webchat_adsUncheckedCreateWithoutOrganizationsInput>;
};
export type webchat_adsUpdateWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.webchat_adsWhereUniqueInput;
    data: Prisma.XOR<Prisma.webchat_adsUpdateWithoutOrganizationsInput, Prisma.webchat_adsUncheckedUpdateWithoutOrganizationsInput>;
};
export type webchat_adsUpdateManyWithWhereWithoutOrganizationsInput = {
    where: Prisma.webchat_adsScalarWhereInput;
    data: Prisma.XOR<Prisma.webchat_adsUpdateManyMutationInput, Prisma.webchat_adsUncheckedUpdateManyWithoutOrganizationsInput>;
};
export type webchat_adsScalarWhereInput = {
    AND?: Prisma.webchat_adsScalarWhereInput | Prisma.webchat_adsScalarWhereInput[];
    OR?: Prisma.webchat_adsScalarWhereInput[];
    NOT?: Prisma.webchat_adsScalarWhereInput | Prisma.webchat_adsScalarWhereInput[];
    id?: Prisma.StringFilter<"webchat_ads"> | string;
    organization_id?: Prisma.StringFilter<"webchat_ads"> | string;
    webchat_id?: Prisma.StringFilter<"webchat_ads"> | string;
    position?: Prisma.StringFilter<"webchat_ads"> | string;
    codigo_tag?: Prisma.StringFilter<"webchat_ads"> | string;
    gpt_sizes?: Prisma.StringNullableFilter<"webchat_ads"> | string | null;
    gpt_slot?: Prisma.StringNullableFilter<"webchat_ads"> | string | null;
    gpt_div_id?: Prisma.StringNullableFilter<"webchat_ads"> | string | null;
    anuncio_fixed?: Prisma.StringNullableFilter<"webchat_ads"> | string | null;
    intervalo_mensagens?: Prisma.IntNullableFilter<"webchat_ads"> | number | null;
    sequence_ads?: Prisma.JsonNullableFilter<"webchat_ads">;
    ativo?: Prisma.BoolFilter<"webchat_ads"> | boolean;
    created_at?: Prisma.DateTimeFilter<"webchat_ads"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"webchat_ads"> | Date | string;
};
export type webchat_adsCreateWithoutWebchatsInput = {
    id?: string;
    position: string;
    codigo_tag: string;
    gpt_sizes?: string | null;
    gpt_slot?: string | null;
    gpt_div_id?: string | null;
    anuncio_fixed?: string | null;
    intervalo_mensagens?: number | null;
    sequence_ads?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    ativo?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
    organizations: Prisma.organizationsCreateNestedOneWithoutWebchat_adsInput;
};
export type webchat_adsUncheckedCreateWithoutWebchatsInput = {
    id?: string;
    organization_id: string;
    position: string;
    codigo_tag: string;
    gpt_sizes?: string | null;
    gpt_slot?: string | null;
    gpt_div_id?: string | null;
    anuncio_fixed?: string | null;
    intervalo_mensagens?: number | null;
    sequence_ads?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    ativo?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type webchat_adsCreateOrConnectWithoutWebchatsInput = {
    where: Prisma.webchat_adsWhereUniqueInput;
    create: Prisma.XOR<Prisma.webchat_adsCreateWithoutWebchatsInput, Prisma.webchat_adsUncheckedCreateWithoutWebchatsInput>;
};
export type webchat_adsCreateManyWebchatsInputEnvelope = {
    data: Prisma.webchat_adsCreateManyWebchatsInput | Prisma.webchat_adsCreateManyWebchatsInput[];
    skipDuplicates?: boolean;
};
export type webchat_adsUpsertWithWhereUniqueWithoutWebchatsInput = {
    where: Prisma.webchat_adsWhereUniqueInput;
    update: Prisma.XOR<Prisma.webchat_adsUpdateWithoutWebchatsInput, Prisma.webchat_adsUncheckedUpdateWithoutWebchatsInput>;
    create: Prisma.XOR<Prisma.webchat_adsCreateWithoutWebchatsInput, Prisma.webchat_adsUncheckedCreateWithoutWebchatsInput>;
};
export type webchat_adsUpdateWithWhereUniqueWithoutWebchatsInput = {
    where: Prisma.webchat_adsWhereUniqueInput;
    data: Prisma.XOR<Prisma.webchat_adsUpdateWithoutWebchatsInput, Prisma.webchat_adsUncheckedUpdateWithoutWebchatsInput>;
};
export type webchat_adsUpdateManyWithWhereWithoutWebchatsInput = {
    where: Prisma.webchat_adsScalarWhereInput;
    data: Prisma.XOR<Prisma.webchat_adsUpdateManyMutationInput, Prisma.webchat_adsUncheckedUpdateManyWithoutWebchatsInput>;
};
export type webchat_adsCreateManyOrganizationsInput = {
    id?: string;
    webchat_id: string;
    position: string;
    codigo_tag: string;
    gpt_sizes?: string | null;
    gpt_slot?: string | null;
    gpt_div_id?: string | null;
    anuncio_fixed?: string | null;
    intervalo_mensagens?: number | null;
    sequence_ads?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    ativo?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type webchat_adsUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    position?: Prisma.StringFieldUpdateOperationsInput | string;
    codigo_tag?: Prisma.StringFieldUpdateOperationsInput | string;
    gpt_sizes?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gpt_slot?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gpt_div_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    anuncio_fixed?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    intervalo_mensagens?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    sequence_ads?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    ativo?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    webchats?: Prisma.webchatsUpdateOneRequiredWithoutWebchat_adsNestedInput;
};
export type webchat_adsUncheckedUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    webchat_id?: Prisma.StringFieldUpdateOperationsInput | string;
    position?: Prisma.StringFieldUpdateOperationsInput | string;
    codigo_tag?: Prisma.StringFieldUpdateOperationsInput | string;
    gpt_sizes?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gpt_slot?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gpt_div_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    anuncio_fixed?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    intervalo_mensagens?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    sequence_ads?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    ativo?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_adsUncheckedUpdateManyWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    webchat_id?: Prisma.StringFieldUpdateOperationsInput | string;
    position?: Prisma.StringFieldUpdateOperationsInput | string;
    codigo_tag?: Prisma.StringFieldUpdateOperationsInput | string;
    gpt_sizes?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gpt_slot?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gpt_div_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    anuncio_fixed?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    intervalo_mensagens?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    sequence_ads?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    ativo?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_adsCreateManyWebchatsInput = {
    id?: string;
    organization_id: string;
    position: string;
    codigo_tag: string;
    gpt_sizes?: string | null;
    gpt_slot?: string | null;
    gpt_div_id?: string | null;
    anuncio_fixed?: string | null;
    intervalo_mensagens?: number | null;
    sequence_ads?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    ativo?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type webchat_adsUpdateWithoutWebchatsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    position?: Prisma.StringFieldUpdateOperationsInput | string;
    codigo_tag?: Prisma.StringFieldUpdateOperationsInput | string;
    gpt_sizes?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gpt_slot?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gpt_div_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    anuncio_fixed?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    intervalo_mensagens?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    sequence_ads?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    ativo?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutWebchat_adsNestedInput;
};
export type webchat_adsUncheckedUpdateWithoutWebchatsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    position?: Prisma.StringFieldUpdateOperationsInput | string;
    codigo_tag?: Prisma.StringFieldUpdateOperationsInput | string;
    gpt_sizes?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gpt_slot?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gpt_div_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    anuncio_fixed?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    intervalo_mensagens?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    sequence_ads?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    ativo?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_adsUncheckedUpdateManyWithoutWebchatsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    position?: Prisma.StringFieldUpdateOperationsInput | string;
    codigo_tag?: Prisma.StringFieldUpdateOperationsInput | string;
    gpt_sizes?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gpt_slot?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gpt_div_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    anuncio_fixed?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    intervalo_mensagens?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    sequence_ads?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    ativo?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_adsSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    organization_id?: boolean;
    webchat_id?: boolean;
    position?: boolean;
    codigo_tag?: boolean;
    gpt_sizes?: boolean;
    gpt_slot?: boolean;
    gpt_div_id?: boolean;
    anuncio_fixed?: boolean;
    intervalo_mensagens?: boolean;
    sequence_ads?: boolean;
    ativo?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
    webchats?: boolean | Prisma.webchatsDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["webchat_ads"]>;
export type webchat_adsSelectScalar = {
    id?: boolean;
    organization_id?: boolean;
    webchat_id?: boolean;
    position?: boolean;
    codigo_tag?: boolean;
    gpt_sizes?: boolean;
    gpt_slot?: boolean;
    gpt_div_id?: boolean;
    anuncio_fixed?: boolean;
    intervalo_mensagens?: boolean;
    sequence_ads?: boolean;
    ativo?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
};
export type webchat_adsOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "organization_id" | "webchat_id" | "position" | "codigo_tag" | "gpt_sizes" | "gpt_slot" | "gpt_div_id" | "anuncio_fixed" | "intervalo_mensagens" | "sequence_ads" | "ativo" | "created_at" | "updated_at", ExtArgs["result"]["webchat_ads"]>;
export type webchat_adsInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
    webchats?: boolean | Prisma.webchatsDefaultArgs<ExtArgs>;
};
export type $webchat_adsPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "webchat_ads";
    objects: {
        organizations: Prisma.$organizationsPayload<ExtArgs>;
        webchats: Prisma.$webchatsPayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        organization_id: string;
        webchat_id: string;
        position: string;
        codigo_tag: string;
        gpt_sizes: string | null;
        gpt_slot: string | null;
        gpt_div_id: string | null;
        anuncio_fixed: string | null;
        intervalo_mensagens: number | null;
        sequence_ads: runtime.JsonValue | null;
        ativo: boolean;
        created_at: Date;
        updated_at: Date;
    }, ExtArgs["result"]["webchat_ads"]>;
    composites: {};
};
export type webchat_adsGetPayload<S extends boolean | null | undefined | webchat_adsDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$webchat_adsPayload, S>;
export type webchat_adsCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<webchat_adsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: Webchat_adsCountAggregateInputType | true;
};
export interface webchat_adsDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['webchat_ads'];
        meta: {
            name: 'webchat_ads';
        };
    };
    findUnique<T extends webchat_adsFindUniqueArgs>(args: Prisma.SelectSubset<T, webchat_adsFindUniqueArgs<ExtArgs>>): Prisma.Prisma__webchat_adsClient<runtime.Types.Result.GetResult<Prisma.$webchat_adsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends webchat_adsFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, webchat_adsFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__webchat_adsClient<runtime.Types.Result.GetResult<Prisma.$webchat_adsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends webchat_adsFindFirstArgs>(args?: Prisma.SelectSubset<T, webchat_adsFindFirstArgs<ExtArgs>>): Prisma.Prisma__webchat_adsClient<runtime.Types.Result.GetResult<Prisma.$webchat_adsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends webchat_adsFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, webchat_adsFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__webchat_adsClient<runtime.Types.Result.GetResult<Prisma.$webchat_adsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends webchat_adsFindManyArgs>(args?: Prisma.SelectSubset<T, webchat_adsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$webchat_adsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends webchat_adsCreateArgs>(args: Prisma.SelectSubset<T, webchat_adsCreateArgs<ExtArgs>>): Prisma.Prisma__webchat_adsClient<runtime.Types.Result.GetResult<Prisma.$webchat_adsPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends webchat_adsCreateManyArgs>(args?: Prisma.SelectSubset<T, webchat_adsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends webchat_adsDeleteArgs>(args: Prisma.SelectSubset<T, webchat_adsDeleteArgs<ExtArgs>>): Prisma.Prisma__webchat_adsClient<runtime.Types.Result.GetResult<Prisma.$webchat_adsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends webchat_adsUpdateArgs>(args: Prisma.SelectSubset<T, webchat_adsUpdateArgs<ExtArgs>>): Prisma.Prisma__webchat_adsClient<runtime.Types.Result.GetResult<Prisma.$webchat_adsPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends webchat_adsDeleteManyArgs>(args?: Prisma.SelectSubset<T, webchat_adsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends webchat_adsUpdateManyArgs>(args: Prisma.SelectSubset<T, webchat_adsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends webchat_adsUpsertArgs>(args: Prisma.SelectSubset<T, webchat_adsUpsertArgs<ExtArgs>>): Prisma.Prisma__webchat_adsClient<runtime.Types.Result.GetResult<Prisma.$webchat_adsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends webchat_adsCountArgs>(args?: Prisma.Subset<T, webchat_adsCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], Webchat_adsCountAggregateOutputType> : number>;
    aggregate<T extends Webchat_adsAggregateArgs>(args: Prisma.Subset<T, Webchat_adsAggregateArgs>): Prisma.PrismaPromise<GetWebchat_adsAggregateType<T>>;
    groupBy<T extends webchat_adsGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: webchat_adsGroupByArgs['orderBy'];
    } : {
        orderBy?: webchat_adsGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, webchat_adsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetWebchat_adsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: webchat_adsFieldRefs;
}
export interface Prisma__webchat_adsClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    organizations<T extends Prisma.organizationsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.organizationsDefaultArgs<ExtArgs>>): Prisma.Prisma__organizationsClient<runtime.Types.Result.GetResult<Prisma.$organizationsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    webchats<T extends Prisma.webchatsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.webchatsDefaultArgs<ExtArgs>>): Prisma.Prisma__webchatsClient<runtime.Types.Result.GetResult<Prisma.$webchatsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface webchat_adsFieldRefs {
    readonly id: Prisma.FieldRef<"webchat_ads", 'String'>;
    readonly organization_id: Prisma.FieldRef<"webchat_ads", 'String'>;
    readonly webchat_id: Prisma.FieldRef<"webchat_ads", 'String'>;
    readonly position: Prisma.FieldRef<"webchat_ads", 'String'>;
    readonly codigo_tag: Prisma.FieldRef<"webchat_ads", 'String'>;
    readonly gpt_sizes: Prisma.FieldRef<"webchat_ads", 'String'>;
    readonly gpt_slot: Prisma.FieldRef<"webchat_ads", 'String'>;
    readonly gpt_div_id: Prisma.FieldRef<"webchat_ads", 'String'>;
    readonly anuncio_fixed: Prisma.FieldRef<"webchat_ads", 'String'>;
    readonly intervalo_mensagens: Prisma.FieldRef<"webchat_ads", 'Int'>;
    readonly sequence_ads: Prisma.FieldRef<"webchat_ads", 'Json'>;
    readonly ativo: Prisma.FieldRef<"webchat_ads", 'Boolean'>;
    readonly created_at: Prisma.FieldRef<"webchat_ads", 'DateTime'>;
    readonly updated_at: Prisma.FieldRef<"webchat_ads", 'DateTime'>;
}
export type webchat_adsFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_adsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_adsOmit<ExtArgs> | null;
    include?: Prisma.webchat_adsInclude<ExtArgs> | null;
    where: Prisma.webchat_adsWhereUniqueInput;
};
export type webchat_adsFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_adsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_adsOmit<ExtArgs> | null;
    include?: Prisma.webchat_adsInclude<ExtArgs> | null;
    where: Prisma.webchat_adsWhereUniqueInput;
};
export type webchat_adsFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_adsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_adsOmit<ExtArgs> | null;
    include?: Prisma.webchat_adsInclude<ExtArgs> | null;
    where?: Prisma.webchat_adsWhereInput;
    orderBy?: Prisma.webchat_adsOrderByWithRelationInput | Prisma.webchat_adsOrderByWithRelationInput[];
    cursor?: Prisma.webchat_adsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Webchat_adsScalarFieldEnum | Prisma.Webchat_adsScalarFieldEnum[];
};
export type webchat_adsFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_adsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_adsOmit<ExtArgs> | null;
    include?: Prisma.webchat_adsInclude<ExtArgs> | null;
    where?: Prisma.webchat_adsWhereInput;
    orderBy?: Prisma.webchat_adsOrderByWithRelationInput | Prisma.webchat_adsOrderByWithRelationInput[];
    cursor?: Prisma.webchat_adsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Webchat_adsScalarFieldEnum | Prisma.Webchat_adsScalarFieldEnum[];
};
export type webchat_adsFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_adsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_adsOmit<ExtArgs> | null;
    include?: Prisma.webchat_adsInclude<ExtArgs> | null;
    where?: Prisma.webchat_adsWhereInput;
    orderBy?: Prisma.webchat_adsOrderByWithRelationInput | Prisma.webchat_adsOrderByWithRelationInput[];
    cursor?: Prisma.webchat_adsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Webchat_adsScalarFieldEnum | Prisma.Webchat_adsScalarFieldEnum[];
};
export type webchat_adsCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_adsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_adsOmit<ExtArgs> | null;
    include?: Prisma.webchat_adsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.webchat_adsCreateInput, Prisma.webchat_adsUncheckedCreateInput>;
};
export type webchat_adsCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.webchat_adsCreateManyInput | Prisma.webchat_adsCreateManyInput[];
    skipDuplicates?: boolean;
};
export type webchat_adsUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_adsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_adsOmit<ExtArgs> | null;
    include?: Prisma.webchat_adsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.webchat_adsUpdateInput, Prisma.webchat_adsUncheckedUpdateInput>;
    where: Prisma.webchat_adsWhereUniqueInput;
};
export type webchat_adsUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.webchat_adsUpdateManyMutationInput, Prisma.webchat_adsUncheckedUpdateManyInput>;
    where?: Prisma.webchat_adsWhereInput;
    limit?: number;
};
export type webchat_adsUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_adsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_adsOmit<ExtArgs> | null;
    include?: Prisma.webchat_adsInclude<ExtArgs> | null;
    where: Prisma.webchat_adsWhereUniqueInput;
    create: Prisma.XOR<Prisma.webchat_adsCreateInput, Prisma.webchat_adsUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.webchat_adsUpdateInput, Prisma.webchat_adsUncheckedUpdateInput>;
};
export type webchat_adsDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_adsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_adsOmit<ExtArgs> | null;
    include?: Prisma.webchat_adsInclude<ExtArgs> | null;
    where: Prisma.webchat_adsWhereUniqueInput;
};
export type webchat_adsDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.webchat_adsWhereInput;
    limit?: number;
};
export type webchat_adsDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_adsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_adsOmit<ExtArgs> | null;
    include?: Prisma.webchat_adsInclude<ExtArgs> | null;
};
export {};
