import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type webchat_leadsModel = runtime.Types.Result.DefaultSelection<Prisma.$webchat_leadsPayload>;
export type AggregateWebchat_leads = {
    _count: Webchat_leadsCountAggregateOutputType | null;
    _min: Webchat_leadsMinAggregateOutputType | null;
    _max: Webchat_leadsMaxAggregateOutputType | null;
};
export type Webchat_leadsMinAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    webchat_id: string | null;
    email: string | null;
    name: string | null;
    phone: string | null;
    source: string | null;
    session_id: string | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type Webchat_leadsMaxAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    webchat_id: string | null;
    email: string | null;
    name: string | null;
    phone: string | null;
    source: string | null;
    session_id: string | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type Webchat_leadsCountAggregateOutputType = {
    id: number;
    organization_id: number;
    webchat_id: number;
    email: number;
    name: number;
    phone: number;
    source: number;
    session_id: number;
    context: number;
    custom_fields: number;
    created_at: number;
    updated_at: number;
    _all: number;
};
export type Webchat_leadsMinAggregateInputType = {
    id?: true;
    organization_id?: true;
    webchat_id?: true;
    email?: true;
    name?: true;
    phone?: true;
    source?: true;
    session_id?: true;
    created_at?: true;
    updated_at?: true;
};
export type Webchat_leadsMaxAggregateInputType = {
    id?: true;
    organization_id?: true;
    webchat_id?: true;
    email?: true;
    name?: true;
    phone?: true;
    source?: true;
    session_id?: true;
    created_at?: true;
    updated_at?: true;
};
export type Webchat_leadsCountAggregateInputType = {
    id?: true;
    organization_id?: true;
    webchat_id?: true;
    email?: true;
    name?: true;
    phone?: true;
    source?: true;
    session_id?: true;
    context?: true;
    custom_fields?: true;
    created_at?: true;
    updated_at?: true;
    _all?: true;
};
export type Webchat_leadsAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.webchat_leadsWhereInput;
    orderBy?: Prisma.webchat_leadsOrderByWithRelationInput | Prisma.webchat_leadsOrderByWithRelationInput[];
    cursor?: Prisma.webchat_leadsWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | Webchat_leadsCountAggregateInputType;
    _min?: Webchat_leadsMinAggregateInputType;
    _max?: Webchat_leadsMaxAggregateInputType;
};
export type GetWebchat_leadsAggregateType<T extends Webchat_leadsAggregateArgs> = {
    [P in keyof T & keyof AggregateWebchat_leads]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateWebchat_leads[P]> : Prisma.GetScalarType<T[P], AggregateWebchat_leads[P]>;
};
export type webchat_leadsGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.webchat_leadsWhereInput;
    orderBy?: Prisma.webchat_leadsOrderByWithAggregationInput | Prisma.webchat_leadsOrderByWithAggregationInput[];
    by: Prisma.Webchat_leadsScalarFieldEnum[] | Prisma.Webchat_leadsScalarFieldEnum;
    having?: Prisma.webchat_leadsScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: Webchat_leadsCountAggregateInputType | true;
    _min?: Webchat_leadsMinAggregateInputType;
    _max?: Webchat_leadsMaxAggregateInputType;
};
export type Webchat_leadsGroupByOutputType = {
    id: string;
    organization_id: string;
    webchat_id: string;
    email: string;
    name: string | null;
    phone: string | null;
    source: string | null;
    session_id: string | null;
    context: runtime.JsonValue | null;
    custom_fields: runtime.JsonValue | null;
    created_at: Date;
    updated_at: Date;
    _count: Webchat_leadsCountAggregateOutputType | null;
    _min: Webchat_leadsMinAggregateOutputType | null;
    _max: Webchat_leadsMaxAggregateOutputType | null;
};
type GetWebchat_leadsGroupByPayload<T extends webchat_leadsGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<Webchat_leadsGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof Webchat_leadsGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], Webchat_leadsGroupByOutputType[P]> : Prisma.GetScalarType<T[P], Webchat_leadsGroupByOutputType[P]>;
}>>;
export type webchat_leadsWhereInput = {
    AND?: Prisma.webchat_leadsWhereInput | Prisma.webchat_leadsWhereInput[];
    OR?: Prisma.webchat_leadsWhereInput[];
    NOT?: Prisma.webchat_leadsWhereInput | Prisma.webchat_leadsWhereInput[];
    id?: Prisma.StringFilter<"webchat_leads"> | string;
    organization_id?: Prisma.StringFilter<"webchat_leads"> | string;
    webchat_id?: Prisma.StringFilter<"webchat_leads"> | string;
    email?: Prisma.StringFilter<"webchat_leads"> | string;
    name?: Prisma.StringNullableFilter<"webchat_leads"> | string | null;
    phone?: Prisma.StringNullableFilter<"webchat_leads"> | string | null;
    source?: Prisma.StringNullableFilter<"webchat_leads"> | string | null;
    session_id?: Prisma.StringNullableFilter<"webchat_leads"> | string | null;
    context?: Prisma.JsonNullableFilter<"webchat_leads">;
    custom_fields?: Prisma.JsonNullableFilter<"webchat_leads">;
    created_at?: Prisma.DateTimeFilter<"webchat_leads"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"webchat_leads"> | Date | string;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
    webchats?: Prisma.XOR<Prisma.WebchatsScalarRelationFilter, Prisma.webchatsWhereInput>;
};
export type webchat_leadsOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    webchat_id?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    name?: Prisma.SortOrderInput | Prisma.SortOrder;
    phone?: Prisma.SortOrderInput | Prisma.SortOrder;
    source?: Prisma.SortOrderInput | Prisma.SortOrder;
    session_id?: Prisma.SortOrderInput | Prisma.SortOrder;
    context?: Prisma.SortOrderInput | Prisma.SortOrder;
    custom_fields?: Prisma.SortOrderInput | Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    organizations?: Prisma.organizationsOrderByWithRelationInput;
    webchats?: Prisma.webchatsOrderByWithRelationInput;
    _relevance?: Prisma.webchat_leadsOrderByRelevanceInput;
};
export type webchat_leadsWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    AND?: Prisma.webchat_leadsWhereInput | Prisma.webchat_leadsWhereInput[];
    OR?: Prisma.webchat_leadsWhereInput[];
    NOT?: Prisma.webchat_leadsWhereInput | Prisma.webchat_leadsWhereInput[];
    organization_id?: Prisma.StringFilter<"webchat_leads"> | string;
    webchat_id?: Prisma.StringFilter<"webchat_leads"> | string;
    email?: Prisma.StringFilter<"webchat_leads"> | string;
    name?: Prisma.StringNullableFilter<"webchat_leads"> | string | null;
    phone?: Prisma.StringNullableFilter<"webchat_leads"> | string | null;
    source?: Prisma.StringNullableFilter<"webchat_leads"> | string | null;
    session_id?: Prisma.StringNullableFilter<"webchat_leads"> | string | null;
    context?: Prisma.JsonNullableFilter<"webchat_leads">;
    custom_fields?: Prisma.JsonNullableFilter<"webchat_leads">;
    created_at?: Prisma.DateTimeFilter<"webchat_leads"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"webchat_leads"> | Date | string;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
    webchats?: Prisma.XOR<Prisma.WebchatsScalarRelationFilter, Prisma.webchatsWhereInput>;
}, "id">;
export type webchat_leadsOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    webchat_id?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    name?: Prisma.SortOrderInput | Prisma.SortOrder;
    phone?: Prisma.SortOrderInput | Prisma.SortOrder;
    source?: Prisma.SortOrderInput | Prisma.SortOrder;
    session_id?: Prisma.SortOrderInput | Prisma.SortOrder;
    context?: Prisma.SortOrderInput | Prisma.SortOrder;
    custom_fields?: Prisma.SortOrderInput | Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    _count?: Prisma.webchat_leadsCountOrderByAggregateInput;
    _max?: Prisma.webchat_leadsMaxOrderByAggregateInput;
    _min?: Prisma.webchat_leadsMinOrderByAggregateInput;
};
export type webchat_leadsScalarWhereWithAggregatesInput = {
    AND?: Prisma.webchat_leadsScalarWhereWithAggregatesInput | Prisma.webchat_leadsScalarWhereWithAggregatesInput[];
    OR?: Prisma.webchat_leadsScalarWhereWithAggregatesInput[];
    NOT?: Prisma.webchat_leadsScalarWhereWithAggregatesInput | Prisma.webchat_leadsScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"webchat_leads"> | string;
    organization_id?: Prisma.StringWithAggregatesFilter<"webchat_leads"> | string;
    webchat_id?: Prisma.StringWithAggregatesFilter<"webchat_leads"> | string;
    email?: Prisma.StringWithAggregatesFilter<"webchat_leads"> | string;
    name?: Prisma.StringNullableWithAggregatesFilter<"webchat_leads"> | string | null;
    phone?: Prisma.StringNullableWithAggregatesFilter<"webchat_leads"> | string | null;
    source?: Prisma.StringNullableWithAggregatesFilter<"webchat_leads"> | string | null;
    session_id?: Prisma.StringNullableWithAggregatesFilter<"webchat_leads"> | string | null;
    context?: Prisma.JsonNullableWithAggregatesFilter<"webchat_leads">;
    custom_fields?: Prisma.JsonNullableWithAggregatesFilter<"webchat_leads">;
    created_at?: Prisma.DateTimeWithAggregatesFilter<"webchat_leads"> | Date | string;
    updated_at?: Prisma.DateTimeWithAggregatesFilter<"webchat_leads"> | Date | string;
};
export type webchat_leadsCreateInput = {
    id?: string;
    email: string;
    name?: string | null;
    phone?: string | null;
    source?: string | null;
    session_id?: string | null;
    context?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    custom_fields?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
    organizations: Prisma.organizationsCreateNestedOneWithoutWebchat_leadsInput;
    webchats: Prisma.webchatsCreateNestedOneWithoutWebchat_leadsInput;
};
export type webchat_leadsUncheckedCreateInput = {
    id?: string;
    organization_id: string;
    webchat_id: string;
    email: string;
    name?: string | null;
    phone?: string | null;
    source?: string | null;
    session_id?: string | null;
    context?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    custom_fields?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type webchat_leadsUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    phone?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    source?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    session_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    context?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    custom_fields?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutWebchat_leadsNestedInput;
    webchats?: Prisma.webchatsUpdateOneRequiredWithoutWebchat_leadsNestedInput;
};
export type webchat_leadsUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    webchat_id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    phone?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    source?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    session_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    context?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    custom_fields?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_leadsCreateManyInput = {
    id?: string;
    organization_id: string;
    webchat_id: string;
    email: string;
    name?: string | null;
    phone?: string | null;
    source?: string | null;
    session_id?: string | null;
    context?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    custom_fields?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type webchat_leadsUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    phone?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    source?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    session_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    context?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    custom_fields?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_leadsUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    webchat_id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    phone?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    source?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    session_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    context?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    custom_fields?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type Webchat_leadsListRelationFilter = {
    every?: Prisma.webchat_leadsWhereInput;
    some?: Prisma.webchat_leadsWhereInput;
    none?: Prisma.webchat_leadsWhereInput;
};
export type webchat_leadsOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type webchat_leadsOrderByRelevanceInput = {
    fields: Prisma.webchat_leadsOrderByRelevanceFieldEnum | Prisma.webchat_leadsOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type webchat_leadsCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    webchat_id?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    phone?: Prisma.SortOrder;
    source?: Prisma.SortOrder;
    session_id?: Prisma.SortOrder;
    context?: Prisma.SortOrder;
    custom_fields?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type webchat_leadsMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    webchat_id?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    phone?: Prisma.SortOrder;
    source?: Prisma.SortOrder;
    session_id?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type webchat_leadsMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    webchat_id?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    phone?: Prisma.SortOrder;
    source?: Prisma.SortOrder;
    session_id?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type webchat_leadsCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.webchat_leadsCreateWithoutOrganizationsInput, Prisma.webchat_leadsUncheckedCreateWithoutOrganizationsInput> | Prisma.webchat_leadsCreateWithoutOrganizationsInput[] | Prisma.webchat_leadsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.webchat_leadsCreateOrConnectWithoutOrganizationsInput | Prisma.webchat_leadsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.webchat_leadsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.webchat_leadsWhereUniqueInput | Prisma.webchat_leadsWhereUniqueInput[];
};
export type webchat_leadsUncheckedCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.webchat_leadsCreateWithoutOrganizationsInput, Prisma.webchat_leadsUncheckedCreateWithoutOrganizationsInput> | Prisma.webchat_leadsCreateWithoutOrganizationsInput[] | Prisma.webchat_leadsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.webchat_leadsCreateOrConnectWithoutOrganizationsInput | Prisma.webchat_leadsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.webchat_leadsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.webchat_leadsWhereUniqueInput | Prisma.webchat_leadsWhereUniqueInput[];
};
export type webchat_leadsUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.webchat_leadsCreateWithoutOrganizationsInput, Prisma.webchat_leadsUncheckedCreateWithoutOrganizationsInput> | Prisma.webchat_leadsCreateWithoutOrganizationsInput[] | Prisma.webchat_leadsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.webchat_leadsCreateOrConnectWithoutOrganizationsInput | Prisma.webchat_leadsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.webchat_leadsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.webchat_leadsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.webchat_leadsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.webchat_leadsWhereUniqueInput | Prisma.webchat_leadsWhereUniqueInput[];
    disconnect?: Prisma.webchat_leadsWhereUniqueInput | Prisma.webchat_leadsWhereUniqueInput[];
    delete?: Prisma.webchat_leadsWhereUniqueInput | Prisma.webchat_leadsWhereUniqueInput[];
    connect?: Prisma.webchat_leadsWhereUniqueInput | Prisma.webchat_leadsWhereUniqueInput[];
    update?: Prisma.webchat_leadsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.webchat_leadsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.webchat_leadsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.webchat_leadsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.webchat_leadsScalarWhereInput | Prisma.webchat_leadsScalarWhereInput[];
};
export type webchat_leadsUncheckedUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.webchat_leadsCreateWithoutOrganizationsInput, Prisma.webchat_leadsUncheckedCreateWithoutOrganizationsInput> | Prisma.webchat_leadsCreateWithoutOrganizationsInput[] | Prisma.webchat_leadsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.webchat_leadsCreateOrConnectWithoutOrganizationsInput | Prisma.webchat_leadsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.webchat_leadsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.webchat_leadsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.webchat_leadsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.webchat_leadsWhereUniqueInput | Prisma.webchat_leadsWhereUniqueInput[];
    disconnect?: Prisma.webchat_leadsWhereUniqueInput | Prisma.webchat_leadsWhereUniqueInput[];
    delete?: Prisma.webchat_leadsWhereUniqueInput | Prisma.webchat_leadsWhereUniqueInput[];
    connect?: Prisma.webchat_leadsWhereUniqueInput | Prisma.webchat_leadsWhereUniqueInput[];
    update?: Prisma.webchat_leadsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.webchat_leadsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.webchat_leadsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.webchat_leadsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.webchat_leadsScalarWhereInput | Prisma.webchat_leadsScalarWhereInput[];
};
export type webchat_leadsCreateNestedManyWithoutWebchatsInput = {
    create?: Prisma.XOR<Prisma.webchat_leadsCreateWithoutWebchatsInput, Prisma.webchat_leadsUncheckedCreateWithoutWebchatsInput> | Prisma.webchat_leadsCreateWithoutWebchatsInput[] | Prisma.webchat_leadsUncheckedCreateWithoutWebchatsInput[];
    connectOrCreate?: Prisma.webchat_leadsCreateOrConnectWithoutWebchatsInput | Prisma.webchat_leadsCreateOrConnectWithoutWebchatsInput[];
    createMany?: Prisma.webchat_leadsCreateManyWebchatsInputEnvelope;
    connect?: Prisma.webchat_leadsWhereUniqueInput | Prisma.webchat_leadsWhereUniqueInput[];
};
export type webchat_leadsUncheckedCreateNestedManyWithoutWebchatsInput = {
    create?: Prisma.XOR<Prisma.webchat_leadsCreateWithoutWebchatsInput, Prisma.webchat_leadsUncheckedCreateWithoutWebchatsInput> | Prisma.webchat_leadsCreateWithoutWebchatsInput[] | Prisma.webchat_leadsUncheckedCreateWithoutWebchatsInput[];
    connectOrCreate?: Prisma.webchat_leadsCreateOrConnectWithoutWebchatsInput | Prisma.webchat_leadsCreateOrConnectWithoutWebchatsInput[];
    createMany?: Prisma.webchat_leadsCreateManyWebchatsInputEnvelope;
    connect?: Prisma.webchat_leadsWhereUniqueInput | Prisma.webchat_leadsWhereUniqueInput[];
};
export type webchat_leadsUpdateManyWithoutWebchatsNestedInput = {
    create?: Prisma.XOR<Prisma.webchat_leadsCreateWithoutWebchatsInput, Prisma.webchat_leadsUncheckedCreateWithoutWebchatsInput> | Prisma.webchat_leadsCreateWithoutWebchatsInput[] | Prisma.webchat_leadsUncheckedCreateWithoutWebchatsInput[];
    connectOrCreate?: Prisma.webchat_leadsCreateOrConnectWithoutWebchatsInput | Prisma.webchat_leadsCreateOrConnectWithoutWebchatsInput[];
    upsert?: Prisma.webchat_leadsUpsertWithWhereUniqueWithoutWebchatsInput | Prisma.webchat_leadsUpsertWithWhereUniqueWithoutWebchatsInput[];
    createMany?: Prisma.webchat_leadsCreateManyWebchatsInputEnvelope;
    set?: Prisma.webchat_leadsWhereUniqueInput | Prisma.webchat_leadsWhereUniqueInput[];
    disconnect?: Prisma.webchat_leadsWhereUniqueInput | Prisma.webchat_leadsWhereUniqueInput[];
    delete?: Prisma.webchat_leadsWhereUniqueInput | Prisma.webchat_leadsWhereUniqueInput[];
    connect?: Prisma.webchat_leadsWhereUniqueInput | Prisma.webchat_leadsWhereUniqueInput[];
    update?: Prisma.webchat_leadsUpdateWithWhereUniqueWithoutWebchatsInput | Prisma.webchat_leadsUpdateWithWhereUniqueWithoutWebchatsInput[];
    updateMany?: Prisma.webchat_leadsUpdateManyWithWhereWithoutWebchatsInput | Prisma.webchat_leadsUpdateManyWithWhereWithoutWebchatsInput[];
    deleteMany?: Prisma.webchat_leadsScalarWhereInput | Prisma.webchat_leadsScalarWhereInput[];
};
export type webchat_leadsUncheckedUpdateManyWithoutWebchatsNestedInput = {
    create?: Prisma.XOR<Prisma.webchat_leadsCreateWithoutWebchatsInput, Prisma.webchat_leadsUncheckedCreateWithoutWebchatsInput> | Prisma.webchat_leadsCreateWithoutWebchatsInput[] | Prisma.webchat_leadsUncheckedCreateWithoutWebchatsInput[];
    connectOrCreate?: Prisma.webchat_leadsCreateOrConnectWithoutWebchatsInput | Prisma.webchat_leadsCreateOrConnectWithoutWebchatsInput[];
    upsert?: Prisma.webchat_leadsUpsertWithWhereUniqueWithoutWebchatsInput | Prisma.webchat_leadsUpsertWithWhereUniqueWithoutWebchatsInput[];
    createMany?: Prisma.webchat_leadsCreateManyWebchatsInputEnvelope;
    set?: Prisma.webchat_leadsWhereUniqueInput | Prisma.webchat_leadsWhereUniqueInput[];
    disconnect?: Prisma.webchat_leadsWhereUniqueInput | Prisma.webchat_leadsWhereUniqueInput[];
    delete?: Prisma.webchat_leadsWhereUniqueInput | Prisma.webchat_leadsWhereUniqueInput[];
    connect?: Prisma.webchat_leadsWhereUniqueInput | Prisma.webchat_leadsWhereUniqueInput[];
    update?: Prisma.webchat_leadsUpdateWithWhereUniqueWithoutWebchatsInput | Prisma.webchat_leadsUpdateWithWhereUniqueWithoutWebchatsInput[];
    updateMany?: Prisma.webchat_leadsUpdateManyWithWhereWithoutWebchatsInput | Prisma.webchat_leadsUpdateManyWithWhereWithoutWebchatsInput[];
    deleteMany?: Prisma.webchat_leadsScalarWhereInput | Prisma.webchat_leadsScalarWhereInput[];
};
export type webchat_leadsCreateWithoutOrganizationsInput = {
    id?: string;
    email: string;
    name?: string | null;
    phone?: string | null;
    source?: string | null;
    session_id?: string | null;
    context?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    custom_fields?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
    webchats: Prisma.webchatsCreateNestedOneWithoutWebchat_leadsInput;
};
export type webchat_leadsUncheckedCreateWithoutOrganizationsInput = {
    id?: string;
    webchat_id: string;
    email: string;
    name?: string | null;
    phone?: string | null;
    source?: string | null;
    session_id?: string | null;
    context?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    custom_fields?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type webchat_leadsCreateOrConnectWithoutOrganizationsInput = {
    where: Prisma.webchat_leadsWhereUniqueInput;
    create: Prisma.XOR<Prisma.webchat_leadsCreateWithoutOrganizationsInput, Prisma.webchat_leadsUncheckedCreateWithoutOrganizationsInput>;
};
export type webchat_leadsCreateManyOrganizationsInputEnvelope = {
    data: Prisma.webchat_leadsCreateManyOrganizationsInput | Prisma.webchat_leadsCreateManyOrganizationsInput[];
    skipDuplicates?: boolean;
};
export type webchat_leadsUpsertWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.webchat_leadsWhereUniqueInput;
    update: Prisma.XOR<Prisma.webchat_leadsUpdateWithoutOrganizationsInput, Prisma.webchat_leadsUncheckedUpdateWithoutOrganizationsInput>;
    create: Prisma.XOR<Prisma.webchat_leadsCreateWithoutOrganizationsInput, Prisma.webchat_leadsUncheckedCreateWithoutOrganizationsInput>;
};
export type webchat_leadsUpdateWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.webchat_leadsWhereUniqueInput;
    data: Prisma.XOR<Prisma.webchat_leadsUpdateWithoutOrganizationsInput, Prisma.webchat_leadsUncheckedUpdateWithoutOrganizationsInput>;
};
export type webchat_leadsUpdateManyWithWhereWithoutOrganizationsInput = {
    where: Prisma.webchat_leadsScalarWhereInput;
    data: Prisma.XOR<Prisma.webchat_leadsUpdateManyMutationInput, Prisma.webchat_leadsUncheckedUpdateManyWithoutOrganizationsInput>;
};
export type webchat_leadsScalarWhereInput = {
    AND?: Prisma.webchat_leadsScalarWhereInput | Prisma.webchat_leadsScalarWhereInput[];
    OR?: Prisma.webchat_leadsScalarWhereInput[];
    NOT?: Prisma.webchat_leadsScalarWhereInput | Prisma.webchat_leadsScalarWhereInput[];
    id?: Prisma.StringFilter<"webchat_leads"> | string;
    organization_id?: Prisma.StringFilter<"webchat_leads"> | string;
    webchat_id?: Prisma.StringFilter<"webchat_leads"> | string;
    email?: Prisma.StringFilter<"webchat_leads"> | string;
    name?: Prisma.StringNullableFilter<"webchat_leads"> | string | null;
    phone?: Prisma.StringNullableFilter<"webchat_leads"> | string | null;
    source?: Prisma.StringNullableFilter<"webchat_leads"> | string | null;
    session_id?: Prisma.StringNullableFilter<"webchat_leads"> | string | null;
    context?: Prisma.JsonNullableFilter<"webchat_leads">;
    custom_fields?: Prisma.JsonNullableFilter<"webchat_leads">;
    created_at?: Prisma.DateTimeFilter<"webchat_leads"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"webchat_leads"> | Date | string;
};
export type webchat_leadsCreateWithoutWebchatsInput = {
    id?: string;
    email: string;
    name?: string | null;
    phone?: string | null;
    source?: string | null;
    session_id?: string | null;
    context?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    custom_fields?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
    organizations: Prisma.organizationsCreateNestedOneWithoutWebchat_leadsInput;
};
export type webchat_leadsUncheckedCreateWithoutWebchatsInput = {
    id?: string;
    organization_id: string;
    email: string;
    name?: string | null;
    phone?: string | null;
    source?: string | null;
    session_id?: string | null;
    context?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    custom_fields?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type webchat_leadsCreateOrConnectWithoutWebchatsInput = {
    where: Prisma.webchat_leadsWhereUniqueInput;
    create: Prisma.XOR<Prisma.webchat_leadsCreateWithoutWebchatsInput, Prisma.webchat_leadsUncheckedCreateWithoutWebchatsInput>;
};
export type webchat_leadsCreateManyWebchatsInputEnvelope = {
    data: Prisma.webchat_leadsCreateManyWebchatsInput | Prisma.webchat_leadsCreateManyWebchatsInput[];
    skipDuplicates?: boolean;
};
export type webchat_leadsUpsertWithWhereUniqueWithoutWebchatsInput = {
    where: Prisma.webchat_leadsWhereUniqueInput;
    update: Prisma.XOR<Prisma.webchat_leadsUpdateWithoutWebchatsInput, Prisma.webchat_leadsUncheckedUpdateWithoutWebchatsInput>;
    create: Prisma.XOR<Prisma.webchat_leadsCreateWithoutWebchatsInput, Prisma.webchat_leadsUncheckedCreateWithoutWebchatsInput>;
};
export type webchat_leadsUpdateWithWhereUniqueWithoutWebchatsInput = {
    where: Prisma.webchat_leadsWhereUniqueInput;
    data: Prisma.XOR<Prisma.webchat_leadsUpdateWithoutWebchatsInput, Prisma.webchat_leadsUncheckedUpdateWithoutWebchatsInput>;
};
export type webchat_leadsUpdateManyWithWhereWithoutWebchatsInput = {
    where: Prisma.webchat_leadsScalarWhereInput;
    data: Prisma.XOR<Prisma.webchat_leadsUpdateManyMutationInput, Prisma.webchat_leadsUncheckedUpdateManyWithoutWebchatsInput>;
};
export type webchat_leadsCreateManyOrganizationsInput = {
    id?: string;
    webchat_id: string;
    email: string;
    name?: string | null;
    phone?: string | null;
    source?: string | null;
    session_id?: string | null;
    context?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    custom_fields?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type webchat_leadsUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    phone?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    source?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    session_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    context?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    custom_fields?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    webchats?: Prisma.webchatsUpdateOneRequiredWithoutWebchat_leadsNestedInput;
};
export type webchat_leadsUncheckedUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    webchat_id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    phone?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    source?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    session_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    context?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    custom_fields?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_leadsUncheckedUpdateManyWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    webchat_id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    phone?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    source?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    session_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    context?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    custom_fields?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_leadsCreateManyWebchatsInput = {
    id?: string;
    organization_id: string;
    email: string;
    name?: string | null;
    phone?: string | null;
    source?: string | null;
    session_id?: string | null;
    context?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    custom_fields?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type webchat_leadsUpdateWithoutWebchatsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    phone?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    source?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    session_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    context?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    custom_fields?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutWebchat_leadsNestedInput;
};
export type webchat_leadsUncheckedUpdateWithoutWebchatsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    phone?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    source?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    session_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    context?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    custom_fields?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_leadsUncheckedUpdateManyWithoutWebchatsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    phone?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    source?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    session_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    context?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    custom_fields?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_leadsSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    organization_id?: boolean;
    webchat_id?: boolean;
    email?: boolean;
    name?: boolean;
    phone?: boolean;
    source?: boolean;
    session_id?: boolean;
    context?: boolean;
    custom_fields?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
    webchats?: boolean | Prisma.webchatsDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["webchat_leads"]>;
export type webchat_leadsSelectScalar = {
    id?: boolean;
    organization_id?: boolean;
    webchat_id?: boolean;
    email?: boolean;
    name?: boolean;
    phone?: boolean;
    source?: boolean;
    session_id?: boolean;
    context?: boolean;
    custom_fields?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
};
export type webchat_leadsOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "organization_id" | "webchat_id" | "email" | "name" | "phone" | "source" | "session_id" | "context" | "custom_fields" | "created_at" | "updated_at", ExtArgs["result"]["webchat_leads"]>;
export type webchat_leadsInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
    webchats?: boolean | Prisma.webchatsDefaultArgs<ExtArgs>;
};
export type $webchat_leadsPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "webchat_leads";
    objects: {
        organizations: Prisma.$organizationsPayload<ExtArgs>;
        webchats: Prisma.$webchatsPayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        organization_id: string;
        webchat_id: string;
        email: string;
        name: string | null;
        phone: string | null;
        source: string | null;
        session_id: string | null;
        context: runtime.JsonValue | null;
        custom_fields: runtime.JsonValue | null;
        created_at: Date;
        updated_at: Date;
    }, ExtArgs["result"]["webchat_leads"]>;
    composites: {};
};
export type webchat_leadsGetPayload<S extends boolean | null | undefined | webchat_leadsDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$webchat_leadsPayload, S>;
export type webchat_leadsCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<webchat_leadsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: Webchat_leadsCountAggregateInputType | true;
};
export interface webchat_leadsDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['webchat_leads'];
        meta: {
            name: 'webchat_leads';
        };
    };
    findUnique<T extends webchat_leadsFindUniqueArgs>(args: Prisma.SelectSubset<T, webchat_leadsFindUniqueArgs<ExtArgs>>): Prisma.Prisma__webchat_leadsClient<runtime.Types.Result.GetResult<Prisma.$webchat_leadsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends webchat_leadsFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, webchat_leadsFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__webchat_leadsClient<runtime.Types.Result.GetResult<Prisma.$webchat_leadsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends webchat_leadsFindFirstArgs>(args?: Prisma.SelectSubset<T, webchat_leadsFindFirstArgs<ExtArgs>>): Prisma.Prisma__webchat_leadsClient<runtime.Types.Result.GetResult<Prisma.$webchat_leadsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends webchat_leadsFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, webchat_leadsFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__webchat_leadsClient<runtime.Types.Result.GetResult<Prisma.$webchat_leadsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends webchat_leadsFindManyArgs>(args?: Prisma.SelectSubset<T, webchat_leadsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$webchat_leadsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends webchat_leadsCreateArgs>(args: Prisma.SelectSubset<T, webchat_leadsCreateArgs<ExtArgs>>): Prisma.Prisma__webchat_leadsClient<runtime.Types.Result.GetResult<Prisma.$webchat_leadsPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends webchat_leadsCreateManyArgs>(args?: Prisma.SelectSubset<T, webchat_leadsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends webchat_leadsDeleteArgs>(args: Prisma.SelectSubset<T, webchat_leadsDeleteArgs<ExtArgs>>): Prisma.Prisma__webchat_leadsClient<runtime.Types.Result.GetResult<Prisma.$webchat_leadsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends webchat_leadsUpdateArgs>(args: Prisma.SelectSubset<T, webchat_leadsUpdateArgs<ExtArgs>>): Prisma.Prisma__webchat_leadsClient<runtime.Types.Result.GetResult<Prisma.$webchat_leadsPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends webchat_leadsDeleteManyArgs>(args?: Prisma.SelectSubset<T, webchat_leadsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends webchat_leadsUpdateManyArgs>(args: Prisma.SelectSubset<T, webchat_leadsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends webchat_leadsUpsertArgs>(args: Prisma.SelectSubset<T, webchat_leadsUpsertArgs<ExtArgs>>): Prisma.Prisma__webchat_leadsClient<runtime.Types.Result.GetResult<Prisma.$webchat_leadsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends webchat_leadsCountArgs>(args?: Prisma.Subset<T, webchat_leadsCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], Webchat_leadsCountAggregateOutputType> : number>;
    aggregate<T extends Webchat_leadsAggregateArgs>(args: Prisma.Subset<T, Webchat_leadsAggregateArgs>): Prisma.PrismaPromise<GetWebchat_leadsAggregateType<T>>;
    groupBy<T extends webchat_leadsGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: webchat_leadsGroupByArgs['orderBy'];
    } : {
        orderBy?: webchat_leadsGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, webchat_leadsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetWebchat_leadsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: webchat_leadsFieldRefs;
}
export interface Prisma__webchat_leadsClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    organizations<T extends Prisma.organizationsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.organizationsDefaultArgs<ExtArgs>>): Prisma.Prisma__organizationsClient<runtime.Types.Result.GetResult<Prisma.$organizationsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    webchats<T extends Prisma.webchatsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.webchatsDefaultArgs<ExtArgs>>): Prisma.Prisma__webchatsClient<runtime.Types.Result.GetResult<Prisma.$webchatsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface webchat_leadsFieldRefs {
    readonly id: Prisma.FieldRef<"webchat_leads", 'String'>;
    readonly organization_id: Prisma.FieldRef<"webchat_leads", 'String'>;
    readonly webchat_id: Prisma.FieldRef<"webchat_leads", 'String'>;
    readonly email: Prisma.FieldRef<"webchat_leads", 'String'>;
    readonly name: Prisma.FieldRef<"webchat_leads", 'String'>;
    readonly phone: Prisma.FieldRef<"webchat_leads", 'String'>;
    readonly source: Prisma.FieldRef<"webchat_leads", 'String'>;
    readonly session_id: Prisma.FieldRef<"webchat_leads", 'String'>;
    readonly context: Prisma.FieldRef<"webchat_leads", 'Json'>;
    readonly custom_fields: Prisma.FieldRef<"webchat_leads", 'Json'>;
    readonly created_at: Prisma.FieldRef<"webchat_leads", 'DateTime'>;
    readonly updated_at: Prisma.FieldRef<"webchat_leads", 'DateTime'>;
}
export type webchat_leadsFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_leadsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_leadsOmit<ExtArgs> | null;
    include?: Prisma.webchat_leadsInclude<ExtArgs> | null;
    where: Prisma.webchat_leadsWhereUniqueInput;
};
export type webchat_leadsFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_leadsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_leadsOmit<ExtArgs> | null;
    include?: Prisma.webchat_leadsInclude<ExtArgs> | null;
    where: Prisma.webchat_leadsWhereUniqueInput;
};
export type webchat_leadsFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_leadsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_leadsOmit<ExtArgs> | null;
    include?: Prisma.webchat_leadsInclude<ExtArgs> | null;
    where?: Prisma.webchat_leadsWhereInput;
    orderBy?: Prisma.webchat_leadsOrderByWithRelationInput | Prisma.webchat_leadsOrderByWithRelationInput[];
    cursor?: Prisma.webchat_leadsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Webchat_leadsScalarFieldEnum | Prisma.Webchat_leadsScalarFieldEnum[];
};
export type webchat_leadsFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_leadsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_leadsOmit<ExtArgs> | null;
    include?: Prisma.webchat_leadsInclude<ExtArgs> | null;
    where?: Prisma.webchat_leadsWhereInput;
    orderBy?: Prisma.webchat_leadsOrderByWithRelationInput | Prisma.webchat_leadsOrderByWithRelationInput[];
    cursor?: Prisma.webchat_leadsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Webchat_leadsScalarFieldEnum | Prisma.Webchat_leadsScalarFieldEnum[];
};
export type webchat_leadsFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_leadsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_leadsOmit<ExtArgs> | null;
    include?: Prisma.webchat_leadsInclude<ExtArgs> | null;
    where?: Prisma.webchat_leadsWhereInput;
    orderBy?: Prisma.webchat_leadsOrderByWithRelationInput | Prisma.webchat_leadsOrderByWithRelationInput[];
    cursor?: Prisma.webchat_leadsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Webchat_leadsScalarFieldEnum | Prisma.Webchat_leadsScalarFieldEnum[];
};
export type webchat_leadsCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_leadsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_leadsOmit<ExtArgs> | null;
    include?: Prisma.webchat_leadsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.webchat_leadsCreateInput, Prisma.webchat_leadsUncheckedCreateInput>;
};
export type webchat_leadsCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.webchat_leadsCreateManyInput | Prisma.webchat_leadsCreateManyInput[];
    skipDuplicates?: boolean;
};
export type webchat_leadsUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_leadsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_leadsOmit<ExtArgs> | null;
    include?: Prisma.webchat_leadsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.webchat_leadsUpdateInput, Prisma.webchat_leadsUncheckedUpdateInput>;
    where: Prisma.webchat_leadsWhereUniqueInput;
};
export type webchat_leadsUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.webchat_leadsUpdateManyMutationInput, Prisma.webchat_leadsUncheckedUpdateManyInput>;
    where?: Prisma.webchat_leadsWhereInput;
    limit?: number;
};
export type webchat_leadsUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_leadsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_leadsOmit<ExtArgs> | null;
    include?: Prisma.webchat_leadsInclude<ExtArgs> | null;
    where: Prisma.webchat_leadsWhereUniqueInput;
    create: Prisma.XOR<Prisma.webchat_leadsCreateInput, Prisma.webchat_leadsUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.webchat_leadsUpdateInput, Prisma.webchat_leadsUncheckedUpdateInput>;
};
export type webchat_leadsDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_leadsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_leadsOmit<ExtArgs> | null;
    include?: Prisma.webchat_leadsInclude<ExtArgs> | null;
    where: Prisma.webchat_leadsWhereUniqueInput;
};
export type webchat_leadsDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.webchat_leadsWhereInput;
    limit?: number;
};
export type webchat_leadsDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_leadsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_leadsOmit<ExtArgs> | null;
    include?: Prisma.webchat_leadsInclude<ExtArgs> | null;
};
export {};
