import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type webchat_ad_eventsModel = runtime.Types.Result.DefaultSelection<Prisma.$webchat_ad_eventsPayload>;
export type AggregateWebchat_ad_events = {
    _count: Webchat_ad_eventsCountAggregateOutputType | null;
    _min: Webchat_ad_eventsMinAggregateOutputType | null;
    _max: Webchat_ad_eventsMaxAggregateOutputType | null;
};
export type Webchat_ad_eventsMinAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    webchat_id: string | null;
    session_id: string | null;
    domain: string | null;
    ad_position: string | null;
    event_name: string | null;
    ad_key: string | null;
    created_at: Date | null;
};
export type Webchat_ad_eventsMaxAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    webchat_id: string | null;
    session_id: string | null;
    domain: string | null;
    ad_position: string | null;
    event_name: string | null;
    ad_key: string | null;
    created_at: Date | null;
};
export type Webchat_ad_eventsCountAggregateOutputType = {
    id: number;
    organization_id: number;
    webchat_id: number;
    session_id: number;
    domain: number;
    ad_position: number;
    event_name: number;
    ad_key: number;
    payload: number;
    created_at: number;
    _all: number;
};
export type Webchat_ad_eventsMinAggregateInputType = {
    id?: true;
    organization_id?: true;
    webchat_id?: true;
    session_id?: true;
    domain?: true;
    ad_position?: true;
    event_name?: true;
    ad_key?: true;
    created_at?: true;
};
export type Webchat_ad_eventsMaxAggregateInputType = {
    id?: true;
    organization_id?: true;
    webchat_id?: true;
    session_id?: true;
    domain?: true;
    ad_position?: true;
    event_name?: true;
    ad_key?: true;
    created_at?: true;
};
export type Webchat_ad_eventsCountAggregateInputType = {
    id?: true;
    organization_id?: true;
    webchat_id?: true;
    session_id?: true;
    domain?: true;
    ad_position?: true;
    event_name?: true;
    ad_key?: true;
    payload?: true;
    created_at?: true;
    _all?: true;
};
export type Webchat_ad_eventsAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.webchat_ad_eventsWhereInput;
    orderBy?: Prisma.webchat_ad_eventsOrderByWithRelationInput | Prisma.webchat_ad_eventsOrderByWithRelationInput[];
    cursor?: Prisma.webchat_ad_eventsWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | Webchat_ad_eventsCountAggregateInputType;
    _min?: Webchat_ad_eventsMinAggregateInputType;
    _max?: Webchat_ad_eventsMaxAggregateInputType;
};
export type GetWebchat_ad_eventsAggregateType<T extends Webchat_ad_eventsAggregateArgs> = {
    [P in keyof T & keyof AggregateWebchat_ad_events]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateWebchat_ad_events[P]> : Prisma.GetScalarType<T[P], AggregateWebchat_ad_events[P]>;
};
export type webchat_ad_eventsGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.webchat_ad_eventsWhereInput;
    orderBy?: Prisma.webchat_ad_eventsOrderByWithAggregationInput | Prisma.webchat_ad_eventsOrderByWithAggregationInput[];
    by: Prisma.Webchat_ad_eventsScalarFieldEnum[] | Prisma.Webchat_ad_eventsScalarFieldEnum;
    having?: Prisma.webchat_ad_eventsScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: Webchat_ad_eventsCountAggregateInputType | true;
    _min?: Webchat_ad_eventsMinAggregateInputType;
    _max?: Webchat_ad_eventsMaxAggregateInputType;
};
export type Webchat_ad_eventsGroupByOutputType = {
    id: string;
    organization_id: string;
    webchat_id: string;
    session_id: string | null;
    domain: string | null;
    ad_position: string;
    event_name: string;
    ad_key: string | null;
    payload: runtime.JsonValue | null;
    created_at: Date;
    _count: Webchat_ad_eventsCountAggregateOutputType | null;
    _min: Webchat_ad_eventsMinAggregateOutputType | null;
    _max: Webchat_ad_eventsMaxAggregateOutputType | null;
};
type GetWebchat_ad_eventsGroupByPayload<T extends webchat_ad_eventsGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<Webchat_ad_eventsGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof Webchat_ad_eventsGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], Webchat_ad_eventsGroupByOutputType[P]> : Prisma.GetScalarType<T[P], Webchat_ad_eventsGroupByOutputType[P]>;
}>>;
export type webchat_ad_eventsWhereInput = {
    AND?: Prisma.webchat_ad_eventsWhereInput | Prisma.webchat_ad_eventsWhereInput[];
    OR?: Prisma.webchat_ad_eventsWhereInput[];
    NOT?: Prisma.webchat_ad_eventsWhereInput | Prisma.webchat_ad_eventsWhereInput[];
    id?: Prisma.StringFilter<"webchat_ad_events"> | string;
    organization_id?: Prisma.StringFilter<"webchat_ad_events"> | string;
    webchat_id?: Prisma.StringFilter<"webchat_ad_events"> | string;
    session_id?: Prisma.StringNullableFilter<"webchat_ad_events"> | string | null;
    domain?: Prisma.StringNullableFilter<"webchat_ad_events"> | string | null;
    ad_position?: Prisma.StringFilter<"webchat_ad_events"> | string;
    event_name?: Prisma.StringFilter<"webchat_ad_events"> | string;
    ad_key?: Prisma.StringNullableFilter<"webchat_ad_events"> | string | null;
    payload?: Prisma.JsonNullableFilter<"webchat_ad_events">;
    created_at?: Prisma.DateTimeFilter<"webchat_ad_events"> | Date | string;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
    webchats?: Prisma.XOR<Prisma.WebchatsScalarRelationFilter, Prisma.webchatsWhereInput>;
};
export type webchat_ad_eventsOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    webchat_id?: Prisma.SortOrder;
    session_id?: Prisma.SortOrderInput | Prisma.SortOrder;
    domain?: Prisma.SortOrderInput | Prisma.SortOrder;
    ad_position?: Prisma.SortOrder;
    event_name?: Prisma.SortOrder;
    ad_key?: Prisma.SortOrderInput | Prisma.SortOrder;
    payload?: Prisma.SortOrderInput | Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    organizations?: Prisma.organizationsOrderByWithRelationInput;
    webchats?: Prisma.webchatsOrderByWithRelationInput;
    _relevance?: Prisma.webchat_ad_eventsOrderByRelevanceInput;
};
export type webchat_ad_eventsWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    AND?: Prisma.webchat_ad_eventsWhereInput | Prisma.webchat_ad_eventsWhereInput[];
    OR?: Prisma.webchat_ad_eventsWhereInput[];
    NOT?: Prisma.webchat_ad_eventsWhereInput | Prisma.webchat_ad_eventsWhereInput[];
    organization_id?: Prisma.StringFilter<"webchat_ad_events"> | string;
    webchat_id?: Prisma.StringFilter<"webchat_ad_events"> | string;
    session_id?: Prisma.StringNullableFilter<"webchat_ad_events"> | string | null;
    domain?: Prisma.StringNullableFilter<"webchat_ad_events"> | string | null;
    ad_position?: Prisma.StringFilter<"webchat_ad_events"> | string;
    event_name?: Prisma.StringFilter<"webchat_ad_events"> | string;
    ad_key?: Prisma.StringNullableFilter<"webchat_ad_events"> | string | null;
    payload?: Prisma.JsonNullableFilter<"webchat_ad_events">;
    created_at?: Prisma.DateTimeFilter<"webchat_ad_events"> | Date | string;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
    webchats?: Prisma.XOR<Prisma.WebchatsScalarRelationFilter, Prisma.webchatsWhereInput>;
}, "id">;
export type webchat_ad_eventsOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    webchat_id?: Prisma.SortOrder;
    session_id?: Prisma.SortOrderInput | Prisma.SortOrder;
    domain?: Prisma.SortOrderInput | Prisma.SortOrder;
    ad_position?: Prisma.SortOrder;
    event_name?: Prisma.SortOrder;
    ad_key?: Prisma.SortOrderInput | Prisma.SortOrder;
    payload?: Prisma.SortOrderInput | Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    _count?: Prisma.webchat_ad_eventsCountOrderByAggregateInput;
    _max?: Prisma.webchat_ad_eventsMaxOrderByAggregateInput;
    _min?: Prisma.webchat_ad_eventsMinOrderByAggregateInput;
};
export type webchat_ad_eventsScalarWhereWithAggregatesInput = {
    AND?: Prisma.webchat_ad_eventsScalarWhereWithAggregatesInput | Prisma.webchat_ad_eventsScalarWhereWithAggregatesInput[];
    OR?: Prisma.webchat_ad_eventsScalarWhereWithAggregatesInput[];
    NOT?: Prisma.webchat_ad_eventsScalarWhereWithAggregatesInput | Prisma.webchat_ad_eventsScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"webchat_ad_events"> | string;
    organization_id?: Prisma.StringWithAggregatesFilter<"webchat_ad_events"> | string;
    webchat_id?: Prisma.StringWithAggregatesFilter<"webchat_ad_events"> | string;
    session_id?: Prisma.StringNullableWithAggregatesFilter<"webchat_ad_events"> | string | null;
    domain?: Prisma.StringNullableWithAggregatesFilter<"webchat_ad_events"> | string | null;
    ad_position?: Prisma.StringWithAggregatesFilter<"webchat_ad_events"> | string;
    event_name?: Prisma.StringWithAggregatesFilter<"webchat_ad_events"> | string;
    ad_key?: Prisma.StringNullableWithAggregatesFilter<"webchat_ad_events"> | string | null;
    payload?: Prisma.JsonNullableWithAggregatesFilter<"webchat_ad_events">;
    created_at?: Prisma.DateTimeWithAggregatesFilter<"webchat_ad_events"> | Date | string;
};
export type webchat_ad_eventsCreateInput = {
    id?: string;
    session_id?: string | null;
    domain?: string | null;
    ad_position: string;
    event_name: string;
    ad_key?: string | null;
    payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    organizations: Prisma.organizationsCreateNestedOneWithoutWebchat_ad_eventsInput;
    webchats: Prisma.webchatsCreateNestedOneWithoutWebchat_ad_eventsInput;
};
export type webchat_ad_eventsUncheckedCreateInput = {
    id?: string;
    organization_id: string;
    webchat_id: string;
    session_id?: string | null;
    domain?: string | null;
    ad_position: string;
    event_name: string;
    ad_key?: string | null;
    payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
};
export type webchat_ad_eventsUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    session_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    domain?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ad_position?: Prisma.StringFieldUpdateOperationsInput | string;
    event_name?: Prisma.StringFieldUpdateOperationsInput | string;
    ad_key?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutWebchat_ad_eventsNestedInput;
    webchats?: Prisma.webchatsUpdateOneRequiredWithoutWebchat_ad_eventsNestedInput;
};
export type webchat_ad_eventsUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    webchat_id?: Prisma.StringFieldUpdateOperationsInput | string;
    session_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    domain?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ad_position?: Prisma.StringFieldUpdateOperationsInput | string;
    event_name?: Prisma.StringFieldUpdateOperationsInput | string;
    ad_key?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_ad_eventsCreateManyInput = {
    id?: string;
    organization_id: string;
    webchat_id: string;
    session_id?: string | null;
    domain?: string | null;
    ad_position: string;
    event_name: string;
    ad_key?: string | null;
    payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
};
export type webchat_ad_eventsUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    session_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    domain?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ad_position?: Prisma.StringFieldUpdateOperationsInput | string;
    event_name?: Prisma.StringFieldUpdateOperationsInput | string;
    ad_key?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_ad_eventsUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    webchat_id?: Prisma.StringFieldUpdateOperationsInput | string;
    session_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    domain?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ad_position?: Prisma.StringFieldUpdateOperationsInput | string;
    event_name?: Prisma.StringFieldUpdateOperationsInput | string;
    ad_key?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type Webchat_ad_eventsListRelationFilter = {
    every?: Prisma.webchat_ad_eventsWhereInput;
    some?: Prisma.webchat_ad_eventsWhereInput;
    none?: Prisma.webchat_ad_eventsWhereInput;
};
export type webchat_ad_eventsOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type webchat_ad_eventsOrderByRelevanceInput = {
    fields: Prisma.webchat_ad_eventsOrderByRelevanceFieldEnum | Prisma.webchat_ad_eventsOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type webchat_ad_eventsCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    webchat_id?: Prisma.SortOrder;
    session_id?: Prisma.SortOrder;
    domain?: Prisma.SortOrder;
    ad_position?: Prisma.SortOrder;
    event_name?: Prisma.SortOrder;
    ad_key?: Prisma.SortOrder;
    payload?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
};
export type webchat_ad_eventsMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    webchat_id?: Prisma.SortOrder;
    session_id?: Prisma.SortOrder;
    domain?: Prisma.SortOrder;
    ad_position?: Prisma.SortOrder;
    event_name?: Prisma.SortOrder;
    ad_key?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
};
export type webchat_ad_eventsMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    webchat_id?: Prisma.SortOrder;
    session_id?: Prisma.SortOrder;
    domain?: Prisma.SortOrder;
    ad_position?: Prisma.SortOrder;
    event_name?: Prisma.SortOrder;
    ad_key?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
};
export type webchat_ad_eventsCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.webchat_ad_eventsCreateWithoutOrganizationsInput, Prisma.webchat_ad_eventsUncheckedCreateWithoutOrganizationsInput> | Prisma.webchat_ad_eventsCreateWithoutOrganizationsInput[] | Prisma.webchat_ad_eventsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.webchat_ad_eventsCreateOrConnectWithoutOrganizationsInput | Prisma.webchat_ad_eventsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.webchat_ad_eventsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.webchat_ad_eventsWhereUniqueInput | Prisma.webchat_ad_eventsWhereUniqueInput[];
};
export type webchat_ad_eventsUncheckedCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.webchat_ad_eventsCreateWithoutOrganizationsInput, Prisma.webchat_ad_eventsUncheckedCreateWithoutOrganizationsInput> | Prisma.webchat_ad_eventsCreateWithoutOrganizationsInput[] | Prisma.webchat_ad_eventsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.webchat_ad_eventsCreateOrConnectWithoutOrganizationsInput | Prisma.webchat_ad_eventsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.webchat_ad_eventsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.webchat_ad_eventsWhereUniqueInput | Prisma.webchat_ad_eventsWhereUniqueInput[];
};
export type webchat_ad_eventsUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.webchat_ad_eventsCreateWithoutOrganizationsInput, Prisma.webchat_ad_eventsUncheckedCreateWithoutOrganizationsInput> | Prisma.webchat_ad_eventsCreateWithoutOrganizationsInput[] | Prisma.webchat_ad_eventsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.webchat_ad_eventsCreateOrConnectWithoutOrganizationsInput | Prisma.webchat_ad_eventsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.webchat_ad_eventsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.webchat_ad_eventsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.webchat_ad_eventsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.webchat_ad_eventsWhereUniqueInput | Prisma.webchat_ad_eventsWhereUniqueInput[];
    disconnect?: Prisma.webchat_ad_eventsWhereUniqueInput | Prisma.webchat_ad_eventsWhereUniqueInput[];
    delete?: Prisma.webchat_ad_eventsWhereUniqueInput | Prisma.webchat_ad_eventsWhereUniqueInput[];
    connect?: Prisma.webchat_ad_eventsWhereUniqueInput | Prisma.webchat_ad_eventsWhereUniqueInput[];
    update?: Prisma.webchat_ad_eventsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.webchat_ad_eventsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.webchat_ad_eventsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.webchat_ad_eventsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.webchat_ad_eventsScalarWhereInput | Prisma.webchat_ad_eventsScalarWhereInput[];
};
export type webchat_ad_eventsUncheckedUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.webchat_ad_eventsCreateWithoutOrganizationsInput, Prisma.webchat_ad_eventsUncheckedCreateWithoutOrganizationsInput> | Prisma.webchat_ad_eventsCreateWithoutOrganizationsInput[] | Prisma.webchat_ad_eventsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.webchat_ad_eventsCreateOrConnectWithoutOrganizationsInput | Prisma.webchat_ad_eventsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.webchat_ad_eventsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.webchat_ad_eventsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.webchat_ad_eventsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.webchat_ad_eventsWhereUniqueInput | Prisma.webchat_ad_eventsWhereUniqueInput[];
    disconnect?: Prisma.webchat_ad_eventsWhereUniqueInput | Prisma.webchat_ad_eventsWhereUniqueInput[];
    delete?: Prisma.webchat_ad_eventsWhereUniqueInput | Prisma.webchat_ad_eventsWhereUniqueInput[];
    connect?: Prisma.webchat_ad_eventsWhereUniqueInput | Prisma.webchat_ad_eventsWhereUniqueInput[];
    update?: Prisma.webchat_ad_eventsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.webchat_ad_eventsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.webchat_ad_eventsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.webchat_ad_eventsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.webchat_ad_eventsScalarWhereInput | Prisma.webchat_ad_eventsScalarWhereInput[];
};
export type webchat_ad_eventsCreateNestedManyWithoutWebchatsInput = {
    create?: Prisma.XOR<Prisma.webchat_ad_eventsCreateWithoutWebchatsInput, Prisma.webchat_ad_eventsUncheckedCreateWithoutWebchatsInput> | Prisma.webchat_ad_eventsCreateWithoutWebchatsInput[] | Prisma.webchat_ad_eventsUncheckedCreateWithoutWebchatsInput[];
    connectOrCreate?: Prisma.webchat_ad_eventsCreateOrConnectWithoutWebchatsInput | Prisma.webchat_ad_eventsCreateOrConnectWithoutWebchatsInput[];
    createMany?: Prisma.webchat_ad_eventsCreateManyWebchatsInputEnvelope;
    connect?: Prisma.webchat_ad_eventsWhereUniqueInput | Prisma.webchat_ad_eventsWhereUniqueInput[];
};
export type webchat_ad_eventsUncheckedCreateNestedManyWithoutWebchatsInput = {
    create?: Prisma.XOR<Prisma.webchat_ad_eventsCreateWithoutWebchatsInput, Prisma.webchat_ad_eventsUncheckedCreateWithoutWebchatsInput> | Prisma.webchat_ad_eventsCreateWithoutWebchatsInput[] | Prisma.webchat_ad_eventsUncheckedCreateWithoutWebchatsInput[];
    connectOrCreate?: Prisma.webchat_ad_eventsCreateOrConnectWithoutWebchatsInput | Prisma.webchat_ad_eventsCreateOrConnectWithoutWebchatsInput[];
    createMany?: Prisma.webchat_ad_eventsCreateManyWebchatsInputEnvelope;
    connect?: Prisma.webchat_ad_eventsWhereUniqueInput | Prisma.webchat_ad_eventsWhereUniqueInput[];
};
export type webchat_ad_eventsUpdateManyWithoutWebchatsNestedInput = {
    create?: Prisma.XOR<Prisma.webchat_ad_eventsCreateWithoutWebchatsInput, Prisma.webchat_ad_eventsUncheckedCreateWithoutWebchatsInput> | Prisma.webchat_ad_eventsCreateWithoutWebchatsInput[] | Prisma.webchat_ad_eventsUncheckedCreateWithoutWebchatsInput[];
    connectOrCreate?: Prisma.webchat_ad_eventsCreateOrConnectWithoutWebchatsInput | Prisma.webchat_ad_eventsCreateOrConnectWithoutWebchatsInput[];
    upsert?: Prisma.webchat_ad_eventsUpsertWithWhereUniqueWithoutWebchatsInput | Prisma.webchat_ad_eventsUpsertWithWhereUniqueWithoutWebchatsInput[];
    createMany?: Prisma.webchat_ad_eventsCreateManyWebchatsInputEnvelope;
    set?: Prisma.webchat_ad_eventsWhereUniqueInput | Prisma.webchat_ad_eventsWhereUniqueInput[];
    disconnect?: Prisma.webchat_ad_eventsWhereUniqueInput | Prisma.webchat_ad_eventsWhereUniqueInput[];
    delete?: Prisma.webchat_ad_eventsWhereUniqueInput | Prisma.webchat_ad_eventsWhereUniqueInput[];
    connect?: Prisma.webchat_ad_eventsWhereUniqueInput | Prisma.webchat_ad_eventsWhereUniqueInput[];
    update?: Prisma.webchat_ad_eventsUpdateWithWhereUniqueWithoutWebchatsInput | Prisma.webchat_ad_eventsUpdateWithWhereUniqueWithoutWebchatsInput[];
    updateMany?: Prisma.webchat_ad_eventsUpdateManyWithWhereWithoutWebchatsInput | Prisma.webchat_ad_eventsUpdateManyWithWhereWithoutWebchatsInput[];
    deleteMany?: Prisma.webchat_ad_eventsScalarWhereInput | Prisma.webchat_ad_eventsScalarWhereInput[];
};
export type webchat_ad_eventsUncheckedUpdateManyWithoutWebchatsNestedInput = {
    create?: Prisma.XOR<Prisma.webchat_ad_eventsCreateWithoutWebchatsInput, Prisma.webchat_ad_eventsUncheckedCreateWithoutWebchatsInput> | Prisma.webchat_ad_eventsCreateWithoutWebchatsInput[] | Prisma.webchat_ad_eventsUncheckedCreateWithoutWebchatsInput[];
    connectOrCreate?: Prisma.webchat_ad_eventsCreateOrConnectWithoutWebchatsInput | Prisma.webchat_ad_eventsCreateOrConnectWithoutWebchatsInput[];
    upsert?: Prisma.webchat_ad_eventsUpsertWithWhereUniqueWithoutWebchatsInput | Prisma.webchat_ad_eventsUpsertWithWhereUniqueWithoutWebchatsInput[];
    createMany?: Prisma.webchat_ad_eventsCreateManyWebchatsInputEnvelope;
    set?: Prisma.webchat_ad_eventsWhereUniqueInput | Prisma.webchat_ad_eventsWhereUniqueInput[];
    disconnect?: Prisma.webchat_ad_eventsWhereUniqueInput | Prisma.webchat_ad_eventsWhereUniqueInput[];
    delete?: Prisma.webchat_ad_eventsWhereUniqueInput | Prisma.webchat_ad_eventsWhereUniqueInput[];
    connect?: Prisma.webchat_ad_eventsWhereUniqueInput | Prisma.webchat_ad_eventsWhereUniqueInput[];
    update?: Prisma.webchat_ad_eventsUpdateWithWhereUniqueWithoutWebchatsInput | Prisma.webchat_ad_eventsUpdateWithWhereUniqueWithoutWebchatsInput[];
    updateMany?: Prisma.webchat_ad_eventsUpdateManyWithWhereWithoutWebchatsInput | Prisma.webchat_ad_eventsUpdateManyWithWhereWithoutWebchatsInput[];
    deleteMany?: Prisma.webchat_ad_eventsScalarWhereInput | Prisma.webchat_ad_eventsScalarWhereInput[];
};
export type webchat_ad_eventsCreateWithoutOrganizationsInput = {
    id?: string;
    session_id?: string | null;
    domain?: string | null;
    ad_position: string;
    event_name: string;
    ad_key?: string | null;
    payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    webchats: Prisma.webchatsCreateNestedOneWithoutWebchat_ad_eventsInput;
};
export type webchat_ad_eventsUncheckedCreateWithoutOrganizationsInput = {
    id?: string;
    webchat_id: string;
    session_id?: string | null;
    domain?: string | null;
    ad_position: string;
    event_name: string;
    ad_key?: string | null;
    payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
};
export type webchat_ad_eventsCreateOrConnectWithoutOrganizationsInput = {
    where: Prisma.webchat_ad_eventsWhereUniqueInput;
    create: Prisma.XOR<Prisma.webchat_ad_eventsCreateWithoutOrganizationsInput, Prisma.webchat_ad_eventsUncheckedCreateWithoutOrganizationsInput>;
};
export type webchat_ad_eventsCreateManyOrganizationsInputEnvelope = {
    data: Prisma.webchat_ad_eventsCreateManyOrganizationsInput | Prisma.webchat_ad_eventsCreateManyOrganizationsInput[];
    skipDuplicates?: boolean;
};
export type webchat_ad_eventsUpsertWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.webchat_ad_eventsWhereUniqueInput;
    update: Prisma.XOR<Prisma.webchat_ad_eventsUpdateWithoutOrganizationsInput, Prisma.webchat_ad_eventsUncheckedUpdateWithoutOrganizationsInput>;
    create: Prisma.XOR<Prisma.webchat_ad_eventsCreateWithoutOrganizationsInput, Prisma.webchat_ad_eventsUncheckedCreateWithoutOrganizationsInput>;
};
export type webchat_ad_eventsUpdateWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.webchat_ad_eventsWhereUniqueInput;
    data: Prisma.XOR<Prisma.webchat_ad_eventsUpdateWithoutOrganizationsInput, Prisma.webchat_ad_eventsUncheckedUpdateWithoutOrganizationsInput>;
};
export type webchat_ad_eventsUpdateManyWithWhereWithoutOrganizationsInput = {
    where: Prisma.webchat_ad_eventsScalarWhereInput;
    data: Prisma.XOR<Prisma.webchat_ad_eventsUpdateManyMutationInput, Prisma.webchat_ad_eventsUncheckedUpdateManyWithoutOrganizationsInput>;
};
export type webchat_ad_eventsScalarWhereInput = {
    AND?: Prisma.webchat_ad_eventsScalarWhereInput | Prisma.webchat_ad_eventsScalarWhereInput[];
    OR?: Prisma.webchat_ad_eventsScalarWhereInput[];
    NOT?: Prisma.webchat_ad_eventsScalarWhereInput | Prisma.webchat_ad_eventsScalarWhereInput[];
    id?: Prisma.StringFilter<"webchat_ad_events"> | string;
    organization_id?: Prisma.StringFilter<"webchat_ad_events"> | string;
    webchat_id?: Prisma.StringFilter<"webchat_ad_events"> | string;
    session_id?: Prisma.StringNullableFilter<"webchat_ad_events"> | string | null;
    domain?: Prisma.StringNullableFilter<"webchat_ad_events"> | string | null;
    ad_position?: Prisma.StringFilter<"webchat_ad_events"> | string;
    event_name?: Prisma.StringFilter<"webchat_ad_events"> | string;
    ad_key?: Prisma.StringNullableFilter<"webchat_ad_events"> | string | null;
    payload?: Prisma.JsonNullableFilter<"webchat_ad_events">;
    created_at?: Prisma.DateTimeFilter<"webchat_ad_events"> | Date | string;
};
export type webchat_ad_eventsCreateWithoutWebchatsInput = {
    id?: string;
    session_id?: string | null;
    domain?: string | null;
    ad_position: string;
    event_name: string;
    ad_key?: string | null;
    payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    organizations: Prisma.organizationsCreateNestedOneWithoutWebchat_ad_eventsInput;
};
export type webchat_ad_eventsUncheckedCreateWithoutWebchatsInput = {
    id?: string;
    organization_id: string;
    session_id?: string | null;
    domain?: string | null;
    ad_position: string;
    event_name: string;
    ad_key?: string | null;
    payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
};
export type webchat_ad_eventsCreateOrConnectWithoutWebchatsInput = {
    where: Prisma.webchat_ad_eventsWhereUniqueInput;
    create: Prisma.XOR<Prisma.webchat_ad_eventsCreateWithoutWebchatsInput, Prisma.webchat_ad_eventsUncheckedCreateWithoutWebchatsInput>;
};
export type webchat_ad_eventsCreateManyWebchatsInputEnvelope = {
    data: Prisma.webchat_ad_eventsCreateManyWebchatsInput | Prisma.webchat_ad_eventsCreateManyWebchatsInput[];
    skipDuplicates?: boolean;
};
export type webchat_ad_eventsUpsertWithWhereUniqueWithoutWebchatsInput = {
    where: Prisma.webchat_ad_eventsWhereUniqueInput;
    update: Prisma.XOR<Prisma.webchat_ad_eventsUpdateWithoutWebchatsInput, Prisma.webchat_ad_eventsUncheckedUpdateWithoutWebchatsInput>;
    create: Prisma.XOR<Prisma.webchat_ad_eventsCreateWithoutWebchatsInput, Prisma.webchat_ad_eventsUncheckedCreateWithoutWebchatsInput>;
};
export type webchat_ad_eventsUpdateWithWhereUniqueWithoutWebchatsInput = {
    where: Prisma.webchat_ad_eventsWhereUniqueInput;
    data: Prisma.XOR<Prisma.webchat_ad_eventsUpdateWithoutWebchatsInput, Prisma.webchat_ad_eventsUncheckedUpdateWithoutWebchatsInput>;
};
export type webchat_ad_eventsUpdateManyWithWhereWithoutWebchatsInput = {
    where: Prisma.webchat_ad_eventsScalarWhereInput;
    data: Prisma.XOR<Prisma.webchat_ad_eventsUpdateManyMutationInput, Prisma.webchat_ad_eventsUncheckedUpdateManyWithoutWebchatsInput>;
};
export type webchat_ad_eventsCreateManyOrganizationsInput = {
    id?: string;
    webchat_id: string;
    session_id?: string | null;
    domain?: string | null;
    ad_position: string;
    event_name: string;
    ad_key?: string | null;
    payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
};
export type webchat_ad_eventsUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    session_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    domain?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ad_position?: Prisma.StringFieldUpdateOperationsInput | string;
    event_name?: Prisma.StringFieldUpdateOperationsInput | string;
    ad_key?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    webchats?: Prisma.webchatsUpdateOneRequiredWithoutWebchat_ad_eventsNestedInput;
};
export type webchat_ad_eventsUncheckedUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    webchat_id?: Prisma.StringFieldUpdateOperationsInput | string;
    session_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    domain?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ad_position?: Prisma.StringFieldUpdateOperationsInput | string;
    event_name?: Prisma.StringFieldUpdateOperationsInput | string;
    ad_key?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_ad_eventsUncheckedUpdateManyWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    webchat_id?: Prisma.StringFieldUpdateOperationsInput | string;
    session_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    domain?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ad_position?: Prisma.StringFieldUpdateOperationsInput | string;
    event_name?: Prisma.StringFieldUpdateOperationsInput | string;
    ad_key?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_ad_eventsCreateManyWebchatsInput = {
    id?: string;
    organization_id: string;
    session_id?: string | null;
    domain?: string | null;
    ad_position: string;
    event_name: string;
    ad_key?: string | null;
    payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
};
export type webchat_ad_eventsUpdateWithoutWebchatsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    session_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    domain?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ad_position?: Prisma.StringFieldUpdateOperationsInput | string;
    event_name?: Prisma.StringFieldUpdateOperationsInput | string;
    ad_key?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutWebchat_ad_eventsNestedInput;
};
export type webchat_ad_eventsUncheckedUpdateWithoutWebchatsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    session_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    domain?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ad_position?: Prisma.StringFieldUpdateOperationsInput | string;
    event_name?: Prisma.StringFieldUpdateOperationsInput | string;
    ad_key?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_ad_eventsUncheckedUpdateManyWithoutWebchatsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    session_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    domain?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ad_position?: Prisma.StringFieldUpdateOperationsInput | string;
    event_name?: Prisma.StringFieldUpdateOperationsInput | string;
    ad_key?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_ad_eventsSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    organization_id?: boolean;
    webchat_id?: boolean;
    session_id?: boolean;
    domain?: boolean;
    ad_position?: boolean;
    event_name?: boolean;
    ad_key?: boolean;
    payload?: boolean;
    created_at?: boolean;
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
    webchats?: boolean | Prisma.webchatsDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["webchat_ad_events"]>;
export type webchat_ad_eventsSelectScalar = {
    id?: boolean;
    organization_id?: boolean;
    webchat_id?: boolean;
    session_id?: boolean;
    domain?: boolean;
    ad_position?: boolean;
    event_name?: boolean;
    ad_key?: boolean;
    payload?: boolean;
    created_at?: boolean;
};
export type webchat_ad_eventsOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "organization_id" | "webchat_id" | "session_id" | "domain" | "ad_position" | "event_name" | "ad_key" | "payload" | "created_at", ExtArgs["result"]["webchat_ad_events"]>;
export type webchat_ad_eventsInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
    webchats?: boolean | Prisma.webchatsDefaultArgs<ExtArgs>;
};
export type $webchat_ad_eventsPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "webchat_ad_events";
    objects: {
        organizations: Prisma.$organizationsPayload<ExtArgs>;
        webchats: Prisma.$webchatsPayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        organization_id: string;
        webchat_id: string;
        session_id: string | null;
        domain: string | null;
        ad_position: string;
        event_name: string;
        ad_key: string | null;
        payload: runtime.JsonValue | null;
        created_at: Date;
    }, ExtArgs["result"]["webchat_ad_events"]>;
    composites: {};
};
export type webchat_ad_eventsGetPayload<S extends boolean | null | undefined | webchat_ad_eventsDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$webchat_ad_eventsPayload, S>;
export type webchat_ad_eventsCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<webchat_ad_eventsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: Webchat_ad_eventsCountAggregateInputType | true;
};
export interface webchat_ad_eventsDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['webchat_ad_events'];
        meta: {
            name: 'webchat_ad_events';
        };
    };
    findUnique<T extends webchat_ad_eventsFindUniqueArgs>(args: Prisma.SelectSubset<T, webchat_ad_eventsFindUniqueArgs<ExtArgs>>): Prisma.Prisma__webchat_ad_eventsClient<runtime.Types.Result.GetResult<Prisma.$webchat_ad_eventsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends webchat_ad_eventsFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, webchat_ad_eventsFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__webchat_ad_eventsClient<runtime.Types.Result.GetResult<Prisma.$webchat_ad_eventsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends webchat_ad_eventsFindFirstArgs>(args?: Prisma.SelectSubset<T, webchat_ad_eventsFindFirstArgs<ExtArgs>>): Prisma.Prisma__webchat_ad_eventsClient<runtime.Types.Result.GetResult<Prisma.$webchat_ad_eventsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends webchat_ad_eventsFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, webchat_ad_eventsFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__webchat_ad_eventsClient<runtime.Types.Result.GetResult<Prisma.$webchat_ad_eventsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends webchat_ad_eventsFindManyArgs>(args?: Prisma.SelectSubset<T, webchat_ad_eventsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$webchat_ad_eventsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends webchat_ad_eventsCreateArgs>(args: Prisma.SelectSubset<T, webchat_ad_eventsCreateArgs<ExtArgs>>): Prisma.Prisma__webchat_ad_eventsClient<runtime.Types.Result.GetResult<Prisma.$webchat_ad_eventsPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends webchat_ad_eventsCreateManyArgs>(args?: Prisma.SelectSubset<T, webchat_ad_eventsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends webchat_ad_eventsDeleteArgs>(args: Prisma.SelectSubset<T, webchat_ad_eventsDeleteArgs<ExtArgs>>): Prisma.Prisma__webchat_ad_eventsClient<runtime.Types.Result.GetResult<Prisma.$webchat_ad_eventsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends webchat_ad_eventsUpdateArgs>(args: Prisma.SelectSubset<T, webchat_ad_eventsUpdateArgs<ExtArgs>>): Prisma.Prisma__webchat_ad_eventsClient<runtime.Types.Result.GetResult<Prisma.$webchat_ad_eventsPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends webchat_ad_eventsDeleteManyArgs>(args?: Prisma.SelectSubset<T, webchat_ad_eventsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends webchat_ad_eventsUpdateManyArgs>(args: Prisma.SelectSubset<T, webchat_ad_eventsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends webchat_ad_eventsUpsertArgs>(args: Prisma.SelectSubset<T, webchat_ad_eventsUpsertArgs<ExtArgs>>): Prisma.Prisma__webchat_ad_eventsClient<runtime.Types.Result.GetResult<Prisma.$webchat_ad_eventsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends webchat_ad_eventsCountArgs>(args?: Prisma.Subset<T, webchat_ad_eventsCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], Webchat_ad_eventsCountAggregateOutputType> : number>;
    aggregate<T extends Webchat_ad_eventsAggregateArgs>(args: Prisma.Subset<T, Webchat_ad_eventsAggregateArgs>): Prisma.PrismaPromise<GetWebchat_ad_eventsAggregateType<T>>;
    groupBy<T extends webchat_ad_eventsGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: webchat_ad_eventsGroupByArgs['orderBy'];
    } : {
        orderBy?: webchat_ad_eventsGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, webchat_ad_eventsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetWebchat_ad_eventsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: webchat_ad_eventsFieldRefs;
}
export interface Prisma__webchat_ad_eventsClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    organizations<T extends Prisma.organizationsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.organizationsDefaultArgs<ExtArgs>>): Prisma.Prisma__organizationsClient<runtime.Types.Result.GetResult<Prisma.$organizationsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    webchats<T extends Prisma.webchatsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.webchatsDefaultArgs<ExtArgs>>): Prisma.Prisma__webchatsClient<runtime.Types.Result.GetResult<Prisma.$webchatsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface webchat_ad_eventsFieldRefs {
    readonly id: Prisma.FieldRef<"webchat_ad_events", 'String'>;
    readonly organization_id: Prisma.FieldRef<"webchat_ad_events", 'String'>;
    readonly webchat_id: Prisma.FieldRef<"webchat_ad_events", 'String'>;
    readonly session_id: Prisma.FieldRef<"webchat_ad_events", 'String'>;
    readonly domain: Prisma.FieldRef<"webchat_ad_events", 'String'>;
    readonly ad_position: Prisma.FieldRef<"webchat_ad_events", 'String'>;
    readonly event_name: Prisma.FieldRef<"webchat_ad_events", 'String'>;
    readonly ad_key: Prisma.FieldRef<"webchat_ad_events", 'String'>;
    readonly payload: Prisma.FieldRef<"webchat_ad_events", 'Json'>;
    readonly created_at: Prisma.FieldRef<"webchat_ad_events", 'DateTime'>;
}
export type webchat_ad_eventsFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_ad_eventsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_ad_eventsOmit<ExtArgs> | null;
    include?: Prisma.webchat_ad_eventsInclude<ExtArgs> | null;
    where: Prisma.webchat_ad_eventsWhereUniqueInput;
};
export type webchat_ad_eventsFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_ad_eventsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_ad_eventsOmit<ExtArgs> | null;
    include?: Prisma.webchat_ad_eventsInclude<ExtArgs> | null;
    where: Prisma.webchat_ad_eventsWhereUniqueInput;
};
export type webchat_ad_eventsFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_ad_eventsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_ad_eventsOmit<ExtArgs> | null;
    include?: Prisma.webchat_ad_eventsInclude<ExtArgs> | null;
    where?: Prisma.webchat_ad_eventsWhereInput;
    orderBy?: Prisma.webchat_ad_eventsOrderByWithRelationInput | Prisma.webchat_ad_eventsOrderByWithRelationInput[];
    cursor?: Prisma.webchat_ad_eventsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Webchat_ad_eventsScalarFieldEnum | Prisma.Webchat_ad_eventsScalarFieldEnum[];
};
export type webchat_ad_eventsFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_ad_eventsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_ad_eventsOmit<ExtArgs> | null;
    include?: Prisma.webchat_ad_eventsInclude<ExtArgs> | null;
    where?: Prisma.webchat_ad_eventsWhereInput;
    orderBy?: Prisma.webchat_ad_eventsOrderByWithRelationInput | Prisma.webchat_ad_eventsOrderByWithRelationInput[];
    cursor?: Prisma.webchat_ad_eventsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Webchat_ad_eventsScalarFieldEnum | Prisma.Webchat_ad_eventsScalarFieldEnum[];
};
export type webchat_ad_eventsFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_ad_eventsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_ad_eventsOmit<ExtArgs> | null;
    include?: Prisma.webchat_ad_eventsInclude<ExtArgs> | null;
    where?: Prisma.webchat_ad_eventsWhereInput;
    orderBy?: Prisma.webchat_ad_eventsOrderByWithRelationInput | Prisma.webchat_ad_eventsOrderByWithRelationInput[];
    cursor?: Prisma.webchat_ad_eventsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Webchat_ad_eventsScalarFieldEnum | Prisma.Webchat_ad_eventsScalarFieldEnum[];
};
export type webchat_ad_eventsCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_ad_eventsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_ad_eventsOmit<ExtArgs> | null;
    include?: Prisma.webchat_ad_eventsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.webchat_ad_eventsCreateInput, Prisma.webchat_ad_eventsUncheckedCreateInput>;
};
export type webchat_ad_eventsCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.webchat_ad_eventsCreateManyInput | Prisma.webchat_ad_eventsCreateManyInput[];
    skipDuplicates?: boolean;
};
export type webchat_ad_eventsUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_ad_eventsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_ad_eventsOmit<ExtArgs> | null;
    include?: Prisma.webchat_ad_eventsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.webchat_ad_eventsUpdateInput, Prisma.webchat_ad_eventsUncheckedUpdateInput>;
    where: Prisma.webchat_ad_eventsWhereUniqueInput;
};
export type webchat_ad_eventsUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.webchat_ad_eventsUpdateManyMutationInput, Prisma.webchat_ad_eventsUncheckedUpdateManyInput>;
    where?: Prisma.webchat_ad_eventsWhereInput;
    limit?: number;
};
export type webchat_ad_eventsUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_ad_eventsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_ad_eventsOmit<ExtArgs> | null;
    include?: Prisma.webchat_ad_eventsInclude<ExtArgs> | null;
    where: Prisma.webchat_ad_eventsWhereUniqueInput;
    create: Prisma.XOR<Prisma.webchat_ad_eventsCreateInput, Prisma.webchat_ad_eventsUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.webchat_ad_eventsUpdateInput, Prisma.webchat_ad_eventsUncheckedUpdateInput>;
};
export type webchat_ad_eventsDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_ad_eventsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_ad_eventsOmit<ExtArgs> | null;
    include?: Prisma.webchat_ad_eventsInclude<ExtArgs> | null;
    where: Prisma.webchat_ad_eventsWhereUniqueInput;
};
export type webchat_ad_eventsDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.webchat_ad_eventsWhereInput;
    limit?: number;
};
export type webchat_ad_eventsDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_ad_eventsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_ad_eventsOmit<ExtArgs> | null;
    include?: Prisma.webchat_ad_eventsInclude<ExtArgs> | null;
};
export {};
