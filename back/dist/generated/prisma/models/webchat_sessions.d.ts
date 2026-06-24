import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type webchat_sessionsModel = runtime.Types.Result.DefaultSelection<Prisma.$webchat_sessionsPayload>;
export type AggregateWebchat_sessions = {
    _count: Webchat_sessionsCountAggregateOutputType | null;
    _min: Webchat_sessionsMinAggregateOutputType | null;
    _max: Webchat_sessionsMaxAggregateOutputType | null;
};
export type Webchat_sessionsMinAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    webchat_id: string | null;
    session_id: string | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type Webchat_sessionsMaxAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    webchat_id: string | null;
    session_id: string | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type Webchat_sessionsCountAggregateOutputType = {
    id: number;
    organization_id: number;
    webchat_id: number;
    session_id: number;
    lead_state: number;
    conversation_history: number;
    created_at: number;
    updated_at: number;
    _all: number;
};
export type Webchat_sessionsMinAggregateInputType = {
    id?: true;
    organization_id?: true;
    webchat_id?: true;
    session_id?: true;
    created_at?: true;
    updated_at?: true;
};
export type Webchat_sessionsMaxAggregateInputType = {
    id?: true;
    organization_id?: true;
    webchat_id?: true;
    session_id?: true;
    created_at?: true;
    updated_at?: true;
};
export type Webchat_sessionsCountAggregateInputType = {
    id?: true;
    organization_id?: true;
    webchat_id?: true;
    session_id?: true;
    lead_state?: true;
    conversation_history?: true;
    created_at?: true;
    updated_at?: true;
    _all?: true;
};
export type Webchat_sessionsAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.webchat_sessionsWhereInput;
    orderBy?: Prisma.webchat_sessionsOrderByWithRelationInput | Prisma.webchat_sessionsOrderByWithRelationInput[];
    cursor?: Prisma.webchat_sessionsWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | Webchat_sessionsCountAggregateInputType;
    _min?: Webchat_sessionsMinAggregateInputType;
    _max?: Webchat_sessionsMaxAggregateInputType;
};
export type GetWebchat_sessionsAggregateType<T extends Webchat_sessionsAggregateArgs> = {
    [P in keyof T & keyof AggregateWebchat_sessions]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateWebchat_sessions[P]> : Prisma.GetScalarType<T[P], AggregateWebchat_sessions[P]>;
};
export type webchat_sessionsGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.webchat_sessionsWhereInput;
    orderBy?: Prisma.webchat_sessionsOrderByWithAggregationInput | Prisma.webchat_sessionsOrderByWithAggregationInput[];
    by: Prisma.Webchat_sessionsScalarFieldEnum[] | Prisma.Webchat_sessionsScalarFieldEnum;
    having?: Prisma.webchat_sessionsScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: Webchat_sessionsCountAggregateInputType | true;
    _min?: Webchat_sessionsMinAggregateInputType;
    _max?: Webchat_sessionsMaxAggregateInputType;
};
export type Webchat_sessionsGroupByOutputType = {
    id: string;
    organization_id: string;
    webchat_id: string;
    session_id: string;
    lead_state: runtime.JsonValue | null;
    conversation_history: runtime.JsonValue | null;
    created_at: Date;
    updated_at: Date;
    _count: Webchat_sessionsCountAggregateOutputType | null;
    _min: Webchat_sessionsMinAggregateOutputType | null;
    _max: Webchat_sessionsMaxAggregateOutputType | null;
};
type GetWebchat_sessionsGroupByPayload<T extends webchat_sessionsGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<Webchat_sessionsGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof Webchat_sessionsGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], Webchat_sessionsGroupByOutputType[P]> : Prisma.GetScalarType<T[P], Webchat_sessionsGroupByOutputType[P]>;
}>>;
export type webchat_sessionsWhereInput = {
    AND?: Prisma.webchat_sessionsWhereInput | Prisma.webchat_sessionsWhereInput[];
    OR?: Prisma.webchat_sessionsWhereInput[];
    NOT?: Prisma.webchat_sessionsWhereInput | Prisma.webchat_sessionsWhereInput[];
    id?: Prisma.StringFilter<"webchat_sessions"> | string;
    organization_id?: Prisma.StringFilter<"webchat_sessions"> | string;
    webchat_id?: Prisma.StringFilter<"webchat_sessions"> | string;
    session_id?: Prisma.StringFilter<"webchat_sessions"> | string;
    lead_state?: Prisma.JsonNullableFilter<"webchat_sessions">;
    conversation_history?: Prisma.JsonNullableFilter<"webchat_sessions">;
    created_at?: Prisma.DateTimeFilter<"webchat_sessions"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"webchat_sessions"> | Date | string;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
    webchats?: Prisma.XOR<Prisma.WebchatsScalarRelationFilter, Prisma.webchatsWhereInput>;
};
export type webchat_sessionsOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    webchat_id?: Prisma.SortOrder;
    session_id?: Prisma.SortOrder;
    lead_state?: Prisma.SortOrderInput | Prisma.SortOrder;
    conversation_history?: Prisma.SortOrderInput | Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    organizations?: Prisma.organizationsOrderByWithRelationInput;
    webchats?: Prisma.webchatsOrderByWithRelationInput;
    _relevance?: Prisma.webchat_sessionsOrderByRelevanceInput;
};
export type webchat_sessionsWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    webchat_id_session_id?: Prisma.webchat_sessionsWebchat_idSession_idCompoundUniqueInput;
    AND?: Prisma.webchat_sessionsWhereInput | Prisma.webchat_sessionsWhereInput[];
    OR?: Prisma.webchat_sessionsWhereInput[];
    NOT?: Prisma.webchat_sessionsWhereInput | Prisma.webchat_sessionsWhereInput[];
    organization_id?: Prisma.StringFilter<"webchat_sessions"> | string;
    webchat_id?: Prisma.StringFilter<"webchat_sessions"> | string;
    session_id?: Prisma.StringFilter<"webchat_sessions"> | string;
    lead_state?: Prisma.JsonNullableFilter<"webchat_sessions">;
    conversation_history?: Prisma.JsonNullableFilter<"webchat_sessions">;
    created_at?: Prisma.DateTimeFilter<"webchat_sessions"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"webchat_sessions"> | Date | string;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
    webchats?: Prisma.XOR<Prisma.WebchatsScalarRelationFilter, Prisma.webchatsWhereInput>;
}, "id" | "webchat_id_session_id">;
export type webchat_sessionsOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    webchat_id?: Prisma.SortOrder;
    session_id?: Prisma.SortOrder;
    lead_state?: Prisma.SortOrderInput | Prisma.SortOrder;
    conversation_history?: Prisma.SortOrderInput | Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    _count?: Prisma.webchat_sessionsCountOrderByAggregateInput;
    _max?: Prisma.webchat_sessionsMaxOrderByAggregateInput;
    _min?: Prisma.webchat_sessionsMinOrderByAggregateInput;
};
export type webchat_sessionsScalarWhereWithAggregatesInput = {
    AND?: Prisma.webchat_sessionsScalarWhereWithAggregatesInput | Prisma.webchat_sessionsScalarWhereWithAggregatesInput[];
    OR?: Prisma.webchat_sessionsScalarWhereWithAggregatesInput[];
    NOT?: Prisma.webchat_sessionsScalarWhereWithAggregatesInput | Prisma.webchat_sessionsScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"webchat_sessions"> | string;
    organization_id?: Prisma.StringWithAggregatesFilter<"webchat_sessions"> | string;
    webchat_id?: Prisma.StringWithAggregatesFilter<"webchat_sessions"> | string;
    session_id?: Prisma.StringWithAggregatesFilter<"webchat_sessions"> | string;
    lead_state?: Prisma.JsonNullableWithAggregatesFilter<"webchat_sessions">;
    conversation_history?: Prisma.JsonNullableWithAggregatesFilter<"webchat_sessions">;
    created_at?: Prisma.DateTimeWithAggregatesFilter<"webchat_sessions"> | Date | string;
    updated_at?: Prisma.DateTimeWithAggregatesFilter<"webchat_sessions"> | Date | string;
};
export type webchat_sessionsCreateInput = {
    id?: string;
    session_id: string;
    lead_state?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    conversation_history?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
    organizations: Prisma.organizationsCreateNestedOneWithoutWebchat_sessionsInput;
    webchats: Prisma.webchatsCreateNestedOneWithoutWebchat_sessionsInput;
};
export type webchat_sessionsUncheckedCreateInput = {
    id?: string;
    organization_id: string;
    webchat_id: string;
    session_id: string;
    lead_state?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    conversation_history?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type webchat_sessionsUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    session_id?: Prisma.StringFieldUpdateOperationsInput | string;
    lead_state?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    conversation_history?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutWebchat_sessionsNestedInput;
    webchats?: Prisma.webchatsUpdateOneRequiredWithoutWebchat_sessionsNestedInput;
};
export type webchat_sessionsUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    webchat_id?: Prisma.StringFieldUpdateOperationsInput | string;
    session_id?: Prisma.StringFieldUpdateOperationsInput | string;
    lead_state?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    conversation_history?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_sessionsCreateManyInput = {
    id?: string;
    organization_id: string;
    webchat_id: string;
    session_id: string;
    lead_state?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    conversation_history?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type webchat_sessionsUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    session_id?: Prisma.StringFieldUpdateOperationsInput | string;
    lead_state?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    conversation_history?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_sessionsUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    webchat_id?: Prisma.StringFieldUpdateOperationsInput | string;
    session_id?: Prisma.StringFieldUpdateOperationsInput | string;
    lead_state?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    conversation_history?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type Webchat_sessionsListRelationFilter = {
    every?: Prisma.webchat_sessionsWhereInput;
    some?: Prisma.webchat_sessionsWhereInput;
    none?: Prisma.webchat_sessionsWhereInput;
};
export type webchat_sessionsOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type webchat_sessionsOrderByRelevanceInput = {
    fields: Prisma.webchat_sessionsOrderByRelevanceFieldEnum | Prisma.webchat_sessionsOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type webchat_sessionsWebchat_idSession_idCompoundUniqueInput = {
    webchat_id: string;
    session_id: string;
};
export type webchat_sessionsCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    webchat_id?: Prisma.SortOrder;
    session_id?: Prisma.SortOrder;
    lead_state?: Prisma.SortOrder;
    conversation_history?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type webchat_sessionsMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    webchat_id?: Prisma.SortOrder;
    session_id?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type webchat_sessionsMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    webchat_id?: Prisma.SortOrder;
    session_id?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type webchat_sessionsCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.webchat_sessionsCreateWithoutOrganizationsInput, Prisma.webchat_sessionsUncheckedCreateWithoutOrganizationsInput> | Prisma.webchat_sessionsCreateWithoutOrganizationsInput[] | Prisma.webchat_sessionsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.webchat_sessionsCreateOrConnectWithoutOrganizationsInput | Prisma.webchat_sessionsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.webchat_sessionsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.webchat_sessionsWhereUniqueInput | Prisma.webchat_sessionsWhereUniqueInput[];
};
export type webchat_sessionsUncheckedCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.webchat_sessionsCreateWithoutOrganizationsInput, Prisma.webchat_sessionsUncheckedCreateWithoutOrganizationsInput> | Prisma.webchat_sessionsCreateWithoutOrganizationsInput[] | Prisma.webchat_sessionsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.webchat_sessionsCreateOrConnectWithoutOrganizationsInput | Prisma.webchat_sessionsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.webchat_sessionsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.webchat_sessionsWhereUniqueInput | Prisma.webchat_sessionsWhereUniqueInput[];
};
export type webchat_sessionsUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.webchat_sessionsCreateWithoutOrganizationsInput, Prisma.webchat_sessionsUncheckedCreateWithoutOrganizationsInput> | Prisma.webchat_sessionsCreateWithoutOrganizationsInput[] | Prisma.webchat_sessionsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.webchat_sessionsCreateOrConnectWithoutOrganizationsInput | Prisma.webchat_sessionsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.webchat_sessionsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.webchat_sessionsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.webchat_sessionsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.webchat_sessionsWhereUniqueInput | Prisma.webchat_sessionsWhereUniqueInput[];
    disconnect?: Prisma.webchat_sessionsWhereUniqueInput | Prisma.webchat_sessionsWhereUniqueInput[];
    delete?: Prisma.webchat_sessionsWhereUniqueInput | Prisma.webchat_sessionsWhereUniqueInput[];
    connect?: Prisma.webchat_sessionsWhereUniqueInput | Prisma.webchat_sessionsWhereUniqueInput[];
    update?: Prisma.webchat_sessionsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.webchat_sessionsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.webchat_sessionsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.webchat_sessionsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.webchat_sessionsScalarWhereInput | Prisma.webchat_sessionsScalarWhereInput[];
};
export type webchat_sessionsUncheckedUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.webchat_sessionsCreateWithoutOrganizationsInput, Prisma.webchat_sessionsUncheckedCreateWithoutOrganizationsInput> | Prisma.webchat_sessionsCreateWithoutOrganizationsInput[] | Prisma.webchat_sessionsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.webchat_sessionsCreateOrConnectWithoutOrganizationsInput | Prisma.webchat_sessionsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.webchat_sessionsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.webchat_sessionsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.webchat_sessionsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.webchat_sessionsWhereUniqueInput | Prisma.webchat_sessionsWhereUniqueInput[];
    disconnect?: Prisma.webchat_sessionsWhereUniqueInput | Prisma.webchat_sessionsWhereUniqueInput[];
    delete?: Prisma.webchat_sessionsWhereUniqueInput | Prisma.webchat_sessionsWhereUniqueInput[];
    connect?: Prisma.webchat_sessionsWhereUniqueInput | Prisma.webchat_sessionsWhereUniqueInput[];
    update?: Prisma.webchat_sessionsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.webchat_sessionsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.webchat_sessionsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.webchat_sessionsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.webchat_sessionsScalarWhereInput | Prisma.webchat_sessionsScalarWhereInput[];
};
export type webchat_sessionsCreateNestedManyWithoutWebchatsInput = {
    create?: Prisma.XOR<Prisma.webchat_sessionsCreateWithoutWebchatsInput, Prisma.webchat_sessionsUncheckedCreateWithoutWebchatsInput> | Prisma.webchat_sessionsCreateWithoutWebchatsInput[] | Prisma.webchat_sessionsUncheckedCreateWithoutWebchatsInput[];
    connectOrCreate?: Prisma.webchat_sessionsCreateOrConnectWithoutWebchatsInput | Prisma.webchat_sessionsCreateOrConnectWithoutWebchatsInput[];
    createMany?: Prisma.webchat_sessionsCreateManyWebchatsInputEnvelope;
    connect?: Prisma.webchat_sessionsWhereUniqueInput | Prisma.webchat_sessionsWhereUniqueInput[];
};
export type webchat_sessionsUncheckedCreateNestedManyWithoutWebchatsInput = {
    create?: Prisma.XOR<Prisma.webchat_sessionsCreateWithoutWebchatsInput, Prisma.webchat_sessionsUncheckedCreateWithoutWebchatsInput> | Prisma.webchat_sessionsCreateWithoutWebchatsInput[] | Prisma.webchat_sessionsUncheckedCreateWithoutWebchatsInput[];
    connectOrCreate?: Prisma.webchat_sessionsCreateOrConnectWithoutWebchatsInput | Prisma.webchat_sessionsCreateOrConnectWithoutWebchatsInput[];
    createMany?: Prisma.webchat_sessionsCreateManyWebchatsInputEnvelope;
    connect?: Prisma.webchat_sessionsWhereUniqueInput | Prisma.webchat_sessionsWhereUniqueInput[];
};
export type webchat_sessionsUpdateManyWithoutWebchatsNestedInput = {
    create?: Prisma.XOR<Prisma.webchat_sessionsCreateWithoutWebchatsInput, Prisma.webchat_sessionsUncheckedCreateWithoutWebchatsInput> | Prisma.webchat_sessionsCreateWithoutWebchatsInput[] | Prisma.webchat_sessionsUncheckedCreateWithoutWebchatsInput[];
    connectOrCreate?: Prisma.webchat_sessionsCreateOrConnectWithoutWebchatsInput | Prisma.webchat_sessionsCreateOrConnectWithoutWebchatsInput[];
    upsert?: Prisma.webchat_sessionsUpsertWithWhereUniqueWithoutWebchatsInput | Prisma.webchat_sessionsUpsertWithWhereUniqueWithoutWebchatsInput[];
    createMany?: Prisma.webchat_sessionsCreateManyWebchatsInputEnvelope;
    set?: Prisma.webchat_sessionsWhereUniqueInput | Prisma.webchat_sessionsWhereUniqueInput[];
    disconnect?: Prisma.webchat_sessionsWhereUniqueInput | Prisma.webchat_sessionsWhereUniqueInput[];
    delete?: Prisma.webchat_sessionsWhereUniqueInput | Prisma.webchat_sessionsWhereUniqueInput[];
    connect?: Prisma.webchat_sessionsWhereUniqueInput | Prisma.webchat_sessionsWhereUniqueInput[];
    update?: Prisma.webchat_sessionsUpdateWithWhereUniqueWithoutWebchatsInput | Prisma.webchat_sessionsUpdateWithWhereUniqueWithoutWebchatsInput[];
    updateMany?: Prisma.webchat_sessionsUpdateManyWithWhereWithoutWebchatsInput | Prisma.webchat_sessionsUpdateManyWithWhereWithoutWebchatsInput[];
    deleteMany?: Prisma.webchat_sessionsScalarWhereInput | Prisma.webchat_sessionsScalarWhereInput[];
};
export type webchat_sessionsUncheckedUpdateManyWithoutWebchatsNestedInput = {
    create?: Prisma.XOR<Prisma.webchat_sessionsCreateWithoutWebchatsInput, Prisma.webchat_sessionsUncheckedCreateWithoutWebchatsInput> | Prisma.webchat_sessionsCreateWithoutWebchatsInput[] | Prisma.webchat_sessionsUncheckedCreateWithoutWebchatsInput[];
    connectOrCreate?: Prisma.webchat_sessionsCreateOrConnectWithoutWebchatsInput | Prisma.webchat_sessionsCreateOrConnectWithoutWebchatsInput[];
    upsert?: Prisma.webchat_sessionsUpsertWithWhereUniqueWithoutWebchatsInput | Prisma.webchat_sessionsUpsertWithWhereUniqueWithoutWebchatsInput[];
    createMany?: Prisma.webchat_sessionsCreateManyWebchatsInputEnvelope;
    set?: Prisma.webchat_sessionsWhereUniqueInput | Prisma.webchat_sessionsWhereUniqueInput[];
    disconnect?: Prisma.webchat_sessionsWhereUniqueInput | Prisma.webchat_sessionsWhereUniqueInput[];
    delete?: Prisma.webchat_sessionsWhereUniqueInput | Prisma.webchat_sessionsWhereUniqueInput[];
    connect?: Prisma.webchat_sessionsWhereUniqueInput | Prisma.webchat_sessionsWhereUniqueInput[];
    update?: Prisma.webchat_sessionsUpdateWithWhereUniqueWithoutWebchatsInput | Prisma.webchat_sessionsUpdateWithWhereUniqueWithoutWebchatsInput[];
    updateMany?: Prisma.webchat_sessionsUpdateManyWithWhereWithoutWebchatsInput | Prisma.webchat_sessionsUpdateManyWithWhereWithoutWebchatsInput[];
    deleteMany?: Prisma.webchat_sessionsScalarWhereInput | Prisma.webchat_sessionsScalarWhereInput[];
};
export type webchat_sessionsCreateWithoutOrganizationsInput = {
    id?: string;
    session_id: string;
    lead_state?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    conversation_history?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
    webchats: Prisma.webchatsCreateNestedOneWithoutWebchat_sessionsInput;
};
export type webchat_sessionsUncheckedCreateWithoutOrganizationsInput = {
    id?: string;
    webchat_id: string;
    session_id: string;
    lead_state?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    conversation_history?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type webchat_sessionsCreateOrConnectWithoutOrganizationsInput = {
    where: Prisma.webchat_sessionsWhereUniqueInput;
    create: Prisma.XOR<Prisma.webchat_sessionsCreateWithoutOrganizationsInput, Prisma.webchat_sessionsUncheckedCreateWithoutOrganizationsInput>;
};
export type webchat_sessionsCreateManyOrganizationsInputEnvelope = {
    data: Prisma.webchat_sessionsCreateManyOrganizationsInput | Prisma.webchat_sessionsCreateManyOrganizationsInput[];
    skipDuplicates?: boolean;
};
export type webchat_sessionsUpsertWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.webchat_sessionsWhereUniqueInput;
    update: Prisma.XOR<Prisma.webchat_sessionsUpdateWithoutOrganizationsInput, Prisma.webchat_sessionsUncheckedUpdateWithoutOrganizationsInput>;
    create: Prisma.XOR<Prisma.webchat_sessionsCreateWithoutOrganizationsInput, Prisma.webchat_sessionsUncheckedCreateWithoutOrganizationsInput>;
};
export type webchat_sessionsUpdateWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.webchat_sessionsWhereUniqueInput;
    data: Prisma.XOR<Prisma.webchat_sessionsUpdateWithoutOrganizationsInput, Prisma.webchat_sessionsUncheckedUpdateWithoutOrganizationsInput>;
};
export type webchat_sessionsUpdateManyWithWhereWithoutOrganizationsInput = {
    where: Prisma.webchat_sessionsScalarWhereInput;
    data: Prisma.XOR<Prisma.webchat_sessionsUpdateManyMutationInput, Prisma.webchat_sessionsUncheckedUpdateManyWithoutOrganizationsInput>;
};
export type webchat_sessionsScalarWhereInput = {
    AND?: Prisma.webchat_sessionsScalarWhereInput | Prisma.webchat_sessionsScalarWhereInput[];
    OR?: Prisma.webchat_sessionsScalarWhereInput[];
    NOT?: Prisma.webchat_sessionsScalarWhereInput | Prisma.webchat_sessionsScalarWhereInput[];
    id?: Prisma.StringFilter<"webchat_sessions"> | string;
    organization_id?: Prisma.StringFilter<"webchat_sessions"> | string;
    webchat_id?: Prisma.StringFilter<"webchat_sessions"> | string;
    session_id?: Prisma.StringFilter<"webchat_sessions"> | string;
    lead_state?: Prisma.JsonNullableFilter<"webchat_sessions">;
    conversation_history?: Prisma.JsonNullableFilter<"webchat_sessions">;
    created_at?: Prisma.DateTimeFilter<"webchat_sessions"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"webchat_sessions"> | Date | string;
};
export type webchat_sessionsCreateWithoutWebchatsInput = {
    id?: string;
    session_id: string;
    lead_state?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    conversation_history?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
    organizations: Prisma.organizationsCreateNestedOneWithoutWebchat_sessionsInput;
};
export type webchat_sessionsUncheckedCreateWithoutWebchatsInput = {
    id?: string;
    organization_id: string;
    session_id: string;
    lead_state?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    conversation_history?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type webchat_sessionsCreateOrConnectWithoutWebchatsInput = {
    where: Prisma.webchat_sessionsWhereUniqueInput;
    create: Prisma.XOR<Prisma.webchat_sessionsCreateWithoutWebchatsInput, Prisma.webchat_sessionsUncheckedCreateWithoutWebchatsInput>;
};
export type webchat_sessionsCreateManyWebchatsInputEnvelope = {
    data: Prisma.webchat_sessionsCreateManyWebchatsInput | Prisma.webchat_sessionsCreateManyWebchatsInput[];
    skipDuplicates?: boolean;
};
export type webchat_sessionsUpsertWithWhereUniqueWithoutWebchatsInput = {
    where: Prisma.webchat_sessionsWhereUniqueInput;
    update: Prisma.XOR<Prisma.webchat_sessionsUpdateWithoutWebchatsInput, Prisma.webchat_sessionsUncheckedUpdateWithoutWebchatsInput>;
    create: Prisma.XOR<Prisma.webchat_sessionsCreateWithoutWebchatsInput, Prisma.webchat_sessionsUncheckedCreateWithoutWebchatsInput>;
};
export type webchat_sessionsUpdateWithWhereUniqueWithoutWebchatsInput = {
    where: Prisma.webchat_sessionsWhereUniqueInput;
    data: Prisma.XOR<Prisma.webchat_sessionsUpdateWithoutWebchatsInput, Prisma.webchat_sessionsUncheckedUpdateWithoutWebchatsInput>;
};
export type webchat_sessionsUpdateManyWithWhereWithoutWebchatsInput = {
    where: Prisma.webchat_sessionsScalarWhereInput;
    data: Prisma.XOR<Prisma.webchat_sessionsUpdateManyMutationInput, Prisma.webchat_sessionsUncheckedUpdateManyWithoutWebchatsInput>;
};
export type webchat_sessionsCreateManyOrganizationsInput = {
    id?: string;
    webchat_id: string;
    session_id: string;
    lead_state?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    conversation_history?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type webchat_sessionsUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    session_id?: Prisma.StringFieldUpdateOperationsInput | string;
    lead_state?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    conversation_history?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    webchats?: Prisma.webchatsUpdateOneRequiredWithoutWebchat_sessionsNestedInput;
};
export type webchat_sessionsUncheckedUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    webchat_id?: Prisma.StringFieldUpdateOperationsInput | string;
    session_id?: Prisma.StringFieldUpdateOperationsInput | string;
    lead_state?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    conversation_history?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_sessionsUncheckedUpdateManyWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    webchat_id?: Prisma.StringFieldUpdateOperationsInput | string;
    session_id?: Prisma.StringFieldUpdateOperationsInput | string;
    lead_state?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    conversation_history?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_sessionsCreateManyWebchatsInput = {
    id?: string;
    organization_id: string;
    session_id: string;
    lead_state?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    conversation_history?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type webchat_sessionsUpdateWithoutWebchatsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    session_id?: Prisma.StringFieldUpdateOperationsInput | string;
    lead_state?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    conversation_history?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutWebchat_sessionsNestedInput;
};
export type webchat_sessionsUncheckedUpdateWithoutWebchatsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    session_id?: Prisma.StringFieldUpdateOperationsInput | string;
    lead_state?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    conversation_history?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_sessionsUncheckedUpdateManyWithoutWebchatsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    session_id?: Prisma.StringFieldUpdateOperationsInput | string;
    lead_state?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    conversation_history?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchat_sessionsSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    organization_id?: boolean;
    webchat_id?: boolean;
    session_id?: boolean;
    lead_state?: boolean;
    conversation_history?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
    webchats?: boolean | Prisma.webchatsDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["webchat_sessions"]>;
export type webchat_sessionsSelectScalar = {
    id?: boolean;
    organization_id?: boolean;
    webchat_id?: boolean;
    session_id?: boolean;
    lead_state?: boolean;
    conversation_history?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
};
export type webchat_sessionsOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "organization_id" | "webchat_id" | "session_id" | "lead_state" | "conversation_history" | "created_at" | "updated_at", ExtArgs["result"]["webchat_sessions"]>;
export type webchat_sessionsInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
    webchats?: boolean | Prisma.webchatsDefaultArgs<ExtArgs>;
};
export type $webchat_sessionsPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "webchat_sessions";
    objects: {
        organizations: Prisma.$organizationsPayload<ExtArgs>;
        webchats: Prisma.$webchatsPayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        organization_id: string;
        webchat_id: string;
        session_id: string;
        lead_state: runtime.JsonValue | null;
        conversation_history: runtime.JsonValue | null;
        created_at: Date;
        updated_at: Date;
    }, ExtArgs["result"]["webchat_sessions"]>;
    composites: {};
};
export type webchat_sessionsGetPayload<S extends boolean | null | undefined | webchat_sessionsDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$webchat_sessionsPayload, S>;
export type webchat_sessionsCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<webchat_sessionsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: Webchat_sessionsCountAggregateInputType | true;
};
export interface webchat_sessionsDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['webchat_sessions'];
        meta: {
            name: 'webchat_sessions';
        };
    };
    findUnique<T extends webchat_sessionsFindUniqueArgs>(args: Prisma.SelectSubset<T, webchat_sessionsFindUniqueArgs<ExtArgs>>): Prisma.Prisma__webchat_sessionsClient<runtime.Types.Result.GetResult<Prisma.$webchat_sessionsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends webchat_sessionsFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, webchat_sessionsFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__webchat_sessionsClient<runtime.Types.Result.GetResult<Prisma.$webchat_sessionsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends webchat_sessionsFindFirstArgs>(args?: Prisma.SelectSubset<T, webchat_sessionsFindFirstArgs<ExtArgs>>): Prisma.Prisma__webchat_sessionsClient<runtime.Types.Result.GetResult<Prisma.$webchat_sessionsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends webchat_sessionsFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, webchat_sessionsFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__webchat_sessionsClient<runtime.Types.Result.GetResult<Prisma.$webchat_sessionsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends webchat_sessionsFindManyArgs>(args?: Prisma.SelectSubset<T, webchat_sessionsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$webchat_sessionsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends webchat_sessionsCreateArgs>(args: Prisma.SelectSubset<T, webchat_sessionsCreateArgs<ExtArgs>>): Prisma.Prisma__webchat_sessionsClient<runtime.Types.Result.GetResult<Prisma.$webchat_sessionsPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends webchat_sessionsCreateManyArgs>(args?: Prisma.SelectSubset<T, webchat_sessionsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends webchat_sessionsDeleteArgs>(args: Prisma.SelectSubset<T, webchat_sessionsDeleteArgs<ExtArgs>>): Prisma.Prisma__webchat_sessionsClient<runtime.Types.Result.GetResult<Prisma.$webchat_sessionsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends webchat_sessionsUpdateArgs>(args: Prisma.SelectSubset<T, webchat_sessionsUpdateArgs<ExtArgs>>): Prisma.Prisma__webchat_sessionsClient<runtime.Types.Result.GetResult<Prisma.$webchat_sessionsPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends webchat_sessionsDeleteManyArgs>(args?: Prisma.SelectSubset<T, webchat_sessionsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends webchat_sessionsUpdateManyArgs>(args: Prisma.SelectSubset<T, webchat_sessionsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends webchat_sessionsUpsertArgs>(args: Prisma.SelectSubset<T, webchat_sessionsUpsertArgs<ExtArgs>>): Prisma.Prisma__webchat_sessionsClient<runtime.Types.Result.GetResult<Prisma.$webchat_sessionsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends webchat_sessionsCountArgs>(args?: Prisma.Subset<T, webchat_sessionsCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], Webchat_sessionsCountAggregateOutputType> : number>;
    aggregate<T extends Webchat_sessionsAggregateArgs>(args: Prisma.Subset<T, Webchat_sessionsAggregateArgs>): Prisma.PrismaPromise<GetWebchat_sessionsAggregateType<T>>;
    groupBy<T extends webchat_sessionsGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: webchat_sessionsGroupByArgs['orderBy'];
    } : {
        orderBy?: webchat_sessionsGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, webchat_sessionsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetWebchat_sessionsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: webchat_sessionsFieldRefs;
}
export interface Prisma__webchat_sessionsClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    organizations<T extends Prisma.organizationsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.organizationsDefaultArgs<ExtArgs>>): Prisma.Prisma__organizationsClient<runtime.Types.Result.GetResult<Prisma.$organizationsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    webchats<T extends Prisma.webchatsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.webchatsDefaultArgs<ExtArgs>>): Prisma.Prisma__webchatsClient<runtime.Types.Result.GetResult<Prisma.$webchatsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface webchat_sessionsFieldRefs {
    readonly id: Prisma.FieldRef<"webchat_sessions", 'String'>;
    readonly organization_id: Prisma.FieldRef<"webchat_sessions", 'String'>;
    readonly webchat_id: Prisma.FieldRef<"webchat_sessions", 'String'>;
    readonly session_id: Prisma.FieldRef<"webchat_sessions", 'String'>;
    readonly lead_state: Prisma.FieldRef<"webchat_sessions", 'Json'>;
    readonly conversation_history: Prisma.FieldRef<"webchat_sessions", 'Json'>;
    readonly created_at: Prisma.FieldRef<"webchat_sessions", 'DateTime'>;
    readonly updated_at: Prisma.FieldRef<"webchat_sessions", 'DateTime'>;
}
export type webchat_sessionsFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_sessionsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_sessionsOmit<ExtArgs> | null;
    include?: Prisma.webchat_sessionsInclude<ExtArgs> | null;
    where: Prisma.webchat_sessionsWhereUniqueInput;
};
export type webchat_sessionsFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_sessionsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_sessionsOmit<ExtArgs> | null;
    include?: Prisma.webchat_sessionsInclude<ExtArgs> | null;
    where: Prisma.webchat_sessionsWhereUniqueInput;
};
export type webchat_sessionsFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_sessionsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_sessionsOmit<ExtArgs> | null;
    include?: Prisma.webchat_sessionsInclude<ExtArgs> | null;
    where?: Prisma.webchat_sessionsWhereInput;
    orderBy?: Prisma.webchat_sessionsOrderByWithRelationInput | Prisma.webchat_sessionsOrderByWithRelationInput[];
    cursor?: Prisma.webchat_sessionsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Webchat_sessionsScalarFieldEnum | Prisma.Webchat_sessionsScalarFieldEnum[];
};
export type webchat_sessionsFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_sessionsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_sessionsOmit<ExtArgs> | null;
    include?: Prisma.webchat_sessionsInclude<ExtArgs> | null;
    where?: Prisma.webchat_sessionsWhereInput;
    orderBy?: Prisma.webchat_sessionsOrderByWithRelationInput | Prisma.webchat_sessionsOrderByWithRelationInput[];
    cursor?: Prisma.webchat_sessionsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Webchat_sessionsScalarFieldEnum | Prisma.Webchat_sessionsScalarFieldEnum[];
};
export type webchat_sessionsFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_sessionsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_sessionsOmit<ExtArgs> | null;
    include?: Prisma.webchat_sessionsInclude<ExtArgs> | null;
    where?: Prisma.webchat_sessionsWhereInput;
    orderBy?: Prisma.webchat_sessionsOrderByWithRelationInput | Prisma.webchat_sessionsOrderByWithRelationInput[];
    cursor?: Prisma.webchat_sessionsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Webchat_sessionsScalarFieldEnum | Prisma.Webchat_sessionsScalarFieldEnum[];
};
export type webchat_sessionsCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_sessionsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_sessionsOmit<ExtArgs> | null;
    include?: Prisma.webchat_sessionsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.webchat_sessionsCreateInput, Prisma.webchat_sessionsUncheckedCreateInput>;
};
export type webchat_sessionsCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.webchat_sessionsCreateManyInput | Prisma.webchat_sessionsCreateManyInput[];
    skipDuplicates?: boolean;
};
export type webchat_sessionsUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_sessionsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_sessionsOmit<ExtArgs> | null;
    include?: Prisma.webchat_sessionsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.webchat_sessionsUpdateInput, Prisma.webchat_sessionsUncheckedUpdateInput>;
    where: Prisma.webchat_sessionsWhereUniqueInput;
};
export type webchat_sessionsUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.webchat_sessionsUpdateManyMutationInput, Prisma.webchat_sessionsUncheckedUpdateManyInput>;
    where?: Prisma.webchat_sessionsWhereInput;
    limit?: number;
};
export type webchat_sessionsUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_sessionsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_sessionsOmit<ExtArgs> | null;
    include?: Prisma.webchat_sessionsInclude<ExtArgs> | null;
    where: Prisma.webchat_sessionsWhereUniqueInput;
    create: Prisma.XOR<Prisma.webchat_sessionsCreateInput, Prisma.webchat_sessionsUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.webchat_sessionsUpdateInput, Prisma.webchat_sessionsUncheckedUpdateInput>;
};
export type webchat_sessionsDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_sessionsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_sessionsOmit<ExtArgs> | null;
    include?: Prisma.webchat_sessionsInclude<ExtArgs> | null;
    where: Prisma.webchat_sessionsWhereUniqueInput;
};
export type webchat_sessionsDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.webchat_sessionsWhereInput;
    limit?: number;
};
export type webchat_sessionsDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchat_sessionsSelect<ExtArgs> | null;
    omit?: Prisma.webchat_sessionsOmit<ExtArgs> | null;
    include?: Prisma.webchat_sessionsInclude<ExtArgs> | null;
};
export {};
