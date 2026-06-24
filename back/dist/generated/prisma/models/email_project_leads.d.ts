import type * as runtime from "@prisma/client/runtime/client";
import type * as $Enums from "../enums.js";
import type * as Prisma from "../internal/prismaNamespace.js";
export type email_project_leadsModel = runtime.Types.Result.DefaultSelection<Prisma.$email_project_leadsPayload>;
export type AggregateEmail_project_leads = {
    _count: Email_project_leadsCountAggregateOutputType | null;
    _min: Email_project_leadsMinAggregateOutputType | null;
    _max: Email_project_leadsMaxAggregateOutputType | null;
};
export type Email_project_leadsMinAggregateOutputType = {
    project_id: string | null;
    lead_id: string | null;
    status: $Enums.email_project_leads_status | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type Email_project_leadsMaxAggregateOutputType = {
    project_id: string | null;
    lead_id: string | null;
    status: $Enums.email_project_leads_status | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type Email_project_leadsCountAggregateOutputType = {
    project_id: number;
    lead_id: number;
    status: number;
    created_at: number;
    updated_at: number;
    metrics: number;
    _all: number;
};
export type Email_project_leadsMinAggregateInputType = {
    project_id?: true;
    lead_id?: true;
    status?: true;
    created_at?: true;
    updated_at?: true;
};
export type Email_project_leadsMaxAggregateInputType = {
    project_id?: true;
    lead_id?: true;
    status?: true;
    created_at?: true;
    updated_at?: true;
};
export type Email_project_leadsCountAggregateInputType = {
    project_id?: true;
    lead_id?: true;
    status?: true;
    created_at?: true;
    updated_at?: true;
    metrics?: true;
    _all?: true;
};
export type Email_project_leadsAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_project_leadsWhereInput;
    orderBy?: Prisma.email_project_leadsOrderByWithRelationInput | Prisma.email_project_leadsOrderByWithRelationInput[];
    cursor?: Prisma.email_project_leadsWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | Email_project_leadsCountAggregateInputType;
    _min?: Email_project_leadsMinAggregateInputType;
    _max?: Email_project_leadsMaxAggregateInputType;
};
export type GetEmail_project_leadsAggregateType<T extends Email_project_leadsAggregateArgs> = {
    [P in keyof T & keyof AggregateEmail_project_leads]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateEmail_project_leads[P]> : Prisma.GetScalarType<T[P], AggregateEmail_project_leads[P]>;
};
export type email_project_leadsGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_project_leadsWhereInput;
    orderBy?: Prisma.email_project_leadsOrderByWithAggregationInput | Prisma.email_project_leadsOrderByWithAggregationInput[];
    by: Prisma.Email_project_leadsScalarFieldEnum[] | Prisma.Email_project_leadsScalarFieldEnum;
    having?: Prisma.email_project_leadsScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: Email_project_leadsCountAggregateInputType | true;
    _min?: Email_project_leadsMinAggregateInputType;
    _max?: Email_project_leadsMaxAggregateInputType;
};
export type Email_project_leadsGroupByOutputType = {
    project_id: string;
    lead_id: string;
    status: $Enums.email_project_leads_status;
    created_at: Date;
    updated_at: Date;
    metrics: runtime.JsonValue | null;
    _count: Email_project_leadsCountAggregateOutputType | null;
    _min: Email_project_leadsMinAggregateOutputType | null;
    _max: Email_project_leadsMaxAggregateOutputType | null;
};
type GetEmail_project_leadsGroupByPayload<T extends email_project_leadsGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<Email_project_leadsGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof Email_project_leadsGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], Email_project_leadsGroupByOutputType[P]> : Prisma.GetScalarType<T[P], Email_project_leadsGroupByOutputType[P]>;
}>>;
export type email_project_leadsWhereInput = {
    AND?: Prisma.email_project_leadsWhereInput | Prisma.email_project_leadsWhereInput[];
    OR?: Prisma.email_project_leadsWhereInput[];
    NOT?: Prisma.email_project_leadsWhereInput | Prisma.email_project_leadsWhereInput[];
    project_id?: Prisma.StringFilter<"email_project_leads"> | string;
    lead_id?: Prisma.StringFilter<"email_project_leads"> | string;
    status?: Prisma.Enumemail_project_leads_statusFilter<"email_project_leads"> | $Enums.email_project_leads_status;
    created_at?: Prisma.DateTimeFilter<"email_project_leads"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"email_project_leads"> | Date | string;
    metrics?: Prisma.JsonNullableFilter<"email_project_leads">;
    leads?: Prisma.XOR<Prisma.Email_leadsScalarRelationFilter, Prisma.email_leadsWhereInput>;
    projects?: Prisma.XOR<Prisma.Email_projectsScalarRelationFilter, Prisma.email_projectsWhereInput>;
};
export type email_project_leadsOrderByWithRelationInput = {
    project_id?: Prisma.SortOrder;
    lead_id?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    metrics?: Prisma.SortOrderInput | Prisma.SortOrder;
    leads?: Prisma.email_leadsOrderByWithRelationInput;
    projects?: Prisma.email_projectsOrderByWithRelationInput;
    _relevance?: Prisma.email_project_leadsOrderByRelevanceInput;
};
export type email_project_leadsWhereUniqueInput = Prisma.AtLeast<{
    project_id_lead_id?: Prisma.email_project_leadsProject_idLead_idCompoundUniqueInput;
    AND?: Prisma.email_project_leadsWhereInput | Prisma.email_project_leadsWhereInput[];
    OR?: Prisma.email_project_leadsWhereInput[];
    NOT?: Prisma.email_project_leadsWhereInput | Prisma.email_project_leadsWhereInput[];
    project_id?: Prisma.StringFilter<"email_project_leads"> | string;
    lead_id?: Prisma.StringFilter<"email_project_leads"> | string;
    status?: Prisma.Enumemail_project_leads_statusFilter<"email_project_leads"> | $Enums.email_project_leads_status;
    created_at?: Prisma.DateTimeFilter<"email_project_leads"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"email_project_leads"> | Date | string;
    metrics?: Prisma.JsonNullableFilter<"email_project_leads">;
    leads?: Prisma.XOR<Prisma.Email_leadsScalarRelationFilter, Prisma.email_leadsWhereInput>;
    projects?: Prisma.XOR<Prisma.Email_projectsScalarRelationFilter, Prisma.email_projectsWhereInput>;
}, "project_id_lead_id">;
export type email_project_leadsOrderByWithAggregationInput = {
    project_id?: Prisma.SortOrder;
    lead_id?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    metrics?: Prisma.SortOrderInput | Prisma.SortOrder;
    _count?: Prisma.email_project_leadsCountOrderByAggregateInput;
    _max?: Prisma.email_project_leadsMaxOrderByAggregateInput;
    _min?: Prisma.email_project_leadsMinOrderByAggregateInput;
};
export type email_project_leadsScalarWhereWithAggregatesInput = {
    AND?: Prisma.email_project_leadsScalarWhereWithAggregatesInput | Prisma.email_project_leadsScalarWhereWithAggregatesInput[];
    OR?: Prisma.email_project_leadsScalarWhereWithAggregatesInput[];
    NOT?: Prisma.email_project_leadsScalarWhereWithAggregatesInput | Prisma.email_project_leadsScalarWhereWithAggregatesInput[];
    project_id?: Prisma.StringWithAggregatesFilter<"email_project_leads"> | string;
    lead_id?: Prisma.StringWithAggregatesFilter<"email_project_leads"> | string;
    status?: Prisma.Enumemail_project_leads_statusWithAggregatesFilter<"email_project_leads"> | $Enums.email_project_leads_status;
    created_at?: Prisma.DateTimeWithAggregatesFilter<"email_project_leads"> | Date | string;
    updated_at?: Prisma.DateTimeWithAggregatesFilter<"email_project_leads"> | Date | string;
    metrics?: Prisma.JsonNullableWithAggregatesFilter<"email_project_leads">;
};
export type email_project_leadsCreateInput = {
    status?: $Enums.email_project_leads_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    metrics?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    leads: Prisma.email_leadsCreateNestedOneWithoutProject_linksInput;
    projects: Prisma.email_projectsCreateNestedOneWithoutProject_leadsInput;
};
export type email_project_leadsUncheckedCreateInput = {
    project_id: string;
    lead_id: string;
    status?: $Enums.email_project_leads_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    metrics?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type email_project_leadsUpdateInput = {
    status?: Prisma.Enumemail_project_leads_statusFieldUpdateOperationsInput | $Enums.email_project_leads_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    metrics?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    leads?: Prisma.email_leadsUpdateOneRequiredWithoutProject_linksNestedInput;
    projects?: Prisma.email_projectsUpdateOneRequiredWithoutProject_leadsNestedInput;
};
export type email_project_leadsUncheckedUpdateInput = {
    project_id?: Prisma.StringFieldUpdateOperationsInput | string;
    lead_id?: Prisma.StringFieldUpdateOperationsInput | string;
    status?: Prisma.Enumemail_project_leads_statusFieldUpdateOperationsInput | $Enums.email_project_leads_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    metrics?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type email_project_leadsCreateManyInput = {
    project_id: string;
    lead_id: string;
    status?: $Enums.email_project_leads_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    metrics?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type email_project_leadsUpdateManyMutationInput = {
    status?: Prisma.Enumemail_project_leads_statusFieldUpdateOperationsInput | $Enums.email_project_leads_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    metrics?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type email_project_leadsUncheckedUpdateManyInput = {
    project_id?: Prisma.StringFieldUpdateOperationsInput | string;
    lead_id?: Prisma.StringFieldUpdateOperationsInput | string;
    status?: Prisma.Enumemail_project_leads_statusFieldUpdateOperationsInput | $Enums.email_project_leads_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    metrics?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type Email_project_leadsListRelationFilter = {
    every?: Prisma.email_project_leadsWhereInput;
    some?: Prisma.email_project_leadsWhereInput;
    none?: Prisma.email_project_leadsWhereInput;
};
export type email_project_leadsOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type email_project_leadsOrderByRelevanceInput = {
    fields: Prisma.email_project_leadsOrderByRelevanceFieldEnum | Prisma.email_project_leadsOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type email_project_leadsProject_idLead_idCompoundUniqueInput = {
    project_id: string;
    lead_id: string;
};
export type email_project_leadsCountOrderByAggregateInput = {
    project_id?: Prisma.SortOrder;
    lead_id?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    metrics?: Prisma.SortOrder;
};
export type email_project_leadsMaxOrderByAggregateInput = {
    project_id?: Prisma.SortOrder;
    lead_id?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type email_project_leadsMinOrderByAggregateInput = {
    project_id?: Prisma.SortOrder;
    lead_id?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type email_project_leadsCreateNestedManyWithoutProjectsInput = {
    create?: Prisma.XOR<Prisma.email_project_leadsCreateWithoutProjectsInput, Prisma.email_project_leadsUncheckedCreateWithoutProjectsInput> | Prisma.email_project_leadsCreateWithoutProjectsInput[] | Prisma.email_project_leadsUncheckedCreateWithoutProjectsInput[];
    connectOrCreate?: Prisma.email_project_leadsCreateOrConnectWithoutProjectsInput | Prisma.email_project_leadsCreateOrConnectWithoutProjectsInput[];
    createMany?: Prisma.email_project_leadsCreateManyProjectsInputEnvelope;
    connect?: Prisma.email_project_leadsWhereUniqueInput | Prisma.email_project_leadsWhereUniqueInput[];
};
export type email_project_leadsUncheckedCreateNestedManyWithoutProjectsInput = {
    create?: Prisma.XOR<Prisma.email_project_leadsCreateWithoutProjectsInput, Prisma.email_project_leadsUncheckedCreateWithoutProjectsInput> | Prisma.email_project_leadsCreateWithoutProjectsInput[] | Prisma.email_project_leadsUncheckedCreateWithoutProjectsInput[];
    connectOrCreate?: Prisma.email_project_leadsCreateOrConnectWithoutProjectsInput | Prisma.email_project_leadsCreateOrConnectWithoutProjectsInput[];
    createMany?: Prisma.email_project_leadsCreateManyProjectsInputEnvelope;
    connect?: Prisma.email_project_leadsWhereUniqueInput | Prisma.email_project_leadsWhereUniqueInput[];
};
export type email_project_leadsUpdateManyWithoutProjectsNestedInput = {
    create?: Prisma.XOR<Prisma.email_project_leadsCreateWithoutProjectsInput, Prisma.email_project_leadsUncheckedCreateWithoutProjectsInput> | Prisma.email_project_leadsCreateWithoutProjectsInput[] | Prisma.email_project_leadsUncheckedCreateWithoutProjectsInput[];
    connectOrCreate?: Prisma.email_project_leadsCreateOrConnectWithoutProjectsInput | Prisma.email_project_leadsCreateOrConnectWithoutProjectsInput[];
    upsert?: Prisma.email_project_leadsUpsertWithWhereUniqueWithoutProjectsInput | Prisma.email_project_leadsUpsertWithWhereUniqueWithoutProjectsInput[];
    createMany?: Prisma.email_project_leadsCreateManyProjectsInputEnvelope;
    set?: Prisma.email_project_leadsWhereUniqueInput | Prisma.email_project_leadsWhereUniqueInput[];
    disconnect?: Prisma.email_project_leadsWhereUniqueInput | Prisma.email_project_leadsWhereUniqueInput[];
    delete?: Prisma.email_project_leadsWhereUniqueInput | Prisma.email_project_leadsWhereUniqueInput[];
    connect?: Prisma.email_project_leadsWhereUniqueInput | Prisma.email_project_leadsWhereUniqueInput[];
    update?: Prisma.email_project_leadsUpdateWithWhereUniqueWithoutProjectsInput | Prisma.email_project_leadsUpdateWithWhereUniqueWithoutProjectsInput[];
    updateMany?: Prisma.email_project_leadsUpdateManyWithWhereWithoutProjectsInput | Prisma.email_project_leadsUpdateManyWithWhereWithoutProjectsInput[];
    deleteMany?: Prisma.email_project_leadsScalarWhereInput | Prisma.email_project_leadsScalarWhereInput[];
};
export type email_project_leadsUncheckedUpdateManyWithoutProjectsNestedInput = {
    create?: Prisma.XOR<Prisma.email_project_leadsCreateWithoutProjectsInput, Prisma.email_project_leadsUncheckedCreateWithoutProjectsInput> | Prisma.email_project_leadsCreateWithoutProjectsInput[] | Prisma.email_project_leadsUncheckedCreateWithoutProjectsInput[];
    connectOrCreate?: Prisma.email_project_leadsCreateOrConnectWithoutProjectsInput | Prisma.email_project_leadsCreateOrConnectWithoutProjectsInput[];
    upsert?: Prisma.email_project_leadsUpsertWithWhereUniqueWithoutProjectsInput | Prisma.email_project_leadsUpsertWithWhereUniqueWithoutProjectsInput[];
    createMany?: Prisma.email_project_leadsCreateManyProjectsInputEnvelope;
    set?: Prisma.email_project_leadsWhereUniqueInput | Prisma.email_project_leadsWhereUniqueInput[];
    disconnect?: Prisma.email_project_leadsWhereUniqueInput | Prisma.email_project_leadsWhereUniqueInput[];
    delete?: Prisma.email_project_leadsWhereUniqueInput | Prisma.email_project_leadsWhereUniqueInput[];
    connect?: Prisma.email_project_leadsWhereUniqueInput | Prisma.email_project_leadsWhereUniqueInput[];
    update?: Prisma.email_project_leadsUpdateWithWhereUniqueWithoutProjectsInput | Prisma.email_project_leadsUpdateWithWhereUniqueWithoutProjectsInput[];
    updateMany?: Prisma.email_project_leadsUpdateManyWithWhereWithoutProjectsInput | Prisma.email_project_leadsUpdateManyWithWhereWithoutProjectsInput[];
    deleteMany?: Prisma.email_project_leadsScalarWhereInput | Prisma.email_project_leadsScalarWhereInput[];
};
export type email_project_leadsCreateNestedManyWithoutLeadsInput = {
    create?: Prisma.XOR<Prisma.email_project_leadsCreateWithoutLeadsInput, Prisma.email_project_leadsUncheckedCreateWithoutLeadsInput> | Prisma.email_project_leadsCreateWithoutLeadsInput[] | Prisma.email_project_leadsUncheckedCreateWithoutLeadsInput[];
    connectOrCreate?: Prisma.email_project_leadsCreateOrConnectWithoutLeadsInput | Prisma.email_project_leadsCreateOrConnectWithoutLeadsInput[];
    createMany?: Prisma.email_project_leadsCreateManyLeadsInputEnvelope;
    connect?: Prisma.email_project_leadsWhereUniqueInput | Prisma.email_project_leadsWhereUniqueInput[];
};
export type email_project_leadsUncheckedCreateNestedManyWithoutLeadsInput = {
    create?: Prisma.XOR<Prisma.email_project_leadsCreateWithoutLeadsInput, Prisma.email_project_leadsUncheckedCreateWithoutLeadsInput> | Prisma.email_project_leadsCreateWithoutLeadsInput[] | Prisma.email_project_leadsUncheckedCreateWithoutLeadsInput[];
    connectOrCreate?: Prisma.email_project_leadsCreateOrConnectWithoutLeadsInput | Prisma.email_project_leadsCreateOrConnectWithoutLeadsInput[];
    createMany?: Prisma.email_project_leadsCreateManyLeadsInputEnvelope;
    connect?: Prisma.email_project_leadsWhereUniqueInput | Prisma.email_project_leadsWhereUniqueInput[];
};
export type email_project_leadsUpdateManyWithoutLeadsNestedInput = {
    create?: Prisma.XOR<Prisma.email_project_leadsCreateWithoutLeadsInput, Prisma.email_project_leadsUncheckedCreateWithoutLeadsInput> | Prisma.email_project_leadsCreateWithoutLeadsInput[] | Prisma.email_project_leadsUncheckedCreateWithoutLeadsInput[];
    connectOrCreate?: Prisma.email_project_leadsCreateOrConnectWithoutLeadsInput | Prisma.email_project_leadsCreateOrConnectWithoutLeadsInput[];
    upsert?: Prisma.email_project_leadsUpsertWithWhereUniqueWithoutLeadsInput | Prisma.email_project_leadsUpsertWithWhereUniqueWithoutLeadsInput[];
    createMany?: Prisma.email_project_leadsCreateManyLeadsInputEnvelope;
    set?: Prisma.email_project_leadsWhereUniqueInput | Prisma.email_project_leadsWhereUniqueInput[];
    disconnect?: Prisma.email_project_leadsWhereUniqueInput | Prisma.email_project_leadsWhereUniqueInput[];
    delete?: Prisma.email_project_leadsWhereUniqueInput | Prisma.email_project_leadsWhereUniqueInput[];
    connect?: Prisma.email_project_leadsWhereUniqueInput | Prisma.email_project_leadsWhereUniqueInput[];
    update?: Prisma.email_project_leadsUpdateWithWhereUniqueWithoutLeadsInput | Prisma.email_project_leadsUpdateWithWhereUniqueWithoutLeadsInput[];
    updateMany?: Prisma.email_project_leadsUpdateManyWithWhereWithoutLeadsInput | Prisma.email_project_leadsUpdateManyWithWhereWithoutLeadsInput[];
    deleteMany?: Prisma.email_project_leadsScalarWhereInput | Prisma.email_project_leadsScalarWhereInput[];
};
export type email_project_leadsUncheckedUpdateManyWithoutLeadsNestedInput = {
    create?: Prisma.XOR<Prisma.email_project_leadsCreateWithoutLeadsInput, Prisma.email_project_leadsUncheckedCreateWithoutLeadsInput> | Prisma.email_project_leadsCreateWithoutLeadsInput[] | Prisma.email_project_leadsUncheckedCreateWithoutLeadsInput[];
    connectOrCreate?: Prisma.email_project_leadsCreateOrConnectWithoutLeadsInput | Prisma.email_project_leadsCreateOrConnectWithoutLeadsInput[];
    upsert?: Prisma.email_project_leadsUpsertWithWhereUniqueWithoutLeadsInput | Prisma.email_project_leadsUpsertWithWhereUniqueWithoutLeadsInput[];
    createMany?: Prisma.email_project_leadsCreateManyLeadsInputEnvelope;
    set?: Prisma.email_project_leadsWhereUniqueInput | Prisma.email_project_leadsWhereUniqueInput[];
    disconnect?: Prisma.email_project_leadsWhereUniqueInput | Prisma.email_project_leadsWhereUniqueInput[];
    delete?: Prisma.email_project_leadsWhereUniqueInput | Prisma.email_project_leadsWhereUniqueInput[];
    connect?: Prisma.email_project_leadsWhereUniqueInput | Prisma.email_project_leadsWhereUniqueInput[];
    update?: Prisma.email_project_leadsUpdateWithWhereUniqueWithoutLeadsInput | Prisma.email_project_leadsUpdateWithWhereUniqueWithoutLeadsInput[];
    updateMany?: Prisma.email_project_leadsUpdateManyWithWhereWithoutLeadsInput | Prisma.email_project_leadsUpdateManyWithWhereWithoutLeadsInput[];
    deleteMany?: Prisma.email_project_leadsScalarWhereInput | Prisma.email_project_leadsScalarWhereInput[];
};
export type Enumemail_project_leads_statusFieldUpdateOperationsInput = {
    set?: $Enums.email_project_leads_status;
};
export type email_project_leadsCreateWithoutProjectsInput = {
    status?: $Enums.email_project_leads_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    metrics?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    leads: Prisma.email_leadsCreateNestedOneWithoutProject_linksInput;
};
export type email_project_leadsUncheckedCreateWithoutProjectsInput = {
    lead_id: string;
    status?: $Enums.email_project_leads_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    metrics?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type email_project_leadsCreateOrConnectWithoutProjectsInput = {
    where: Prisma.email_project_leadsWhereUniqueInput;
    create: Prisma.XOR<Prisma.email_project_leadsCreateWithoutProjectsInput, Prisma.email_project_leadsUncheckedCreateWithoutProjectsInput>;
};
export type email_project_leadsCreateManyProjectsInputEnvelope = {
    data: Prisma.email_project_leadsCreateManyProjectsInput | Prisma.email_project_leadsCreateManyProjectsInput[];
    skipDuplicates?: boolean;
};
export type email_project_leadsUpsertWithWhereUniqueWithoutProjectsInput = {
    where: Prisma.email_project_leadsWhereUniqueInput;
    update: Prisma.XOR<Prisma.email_project_leadsUpdateWithoutProjectsInput, Prisma.email_project_leadsUncheckedUpdateWithoutProjectsInput>;
    create: Prisma.XOR<Prisma.email_project_leadsCreateWithoutProjectsInput, Prisma.email_project_leadsUncheckedCreateWithoutProjectsInput>;
};
export type email_project_leadsUpdateWithWhereUniqueWithoutProjectsInput = {
    where: Prisma.email_project_leadsWhereUniqueInput;
    data: Prisma.XOR<Prisma.email_project_leadsUpdateWithoutProjectsInput, Prisma.email_project_leadsUncheckedUpdateWithoutProjectsInput>;
};
export type email_project_leadsUpdateManyWithWhereWithoutProjectsInput = {
    where: Prisma.email_project_leadsScalarWhereInput;
    data: Prisma.XOR<Prisma.email_project_leadsUpdateManyMutationInput, Prisma.email_project_leadsUncheckedUpdateManyWithoutProjectsInput>;
};
export type email_project_leadsScalarWhereInput = {
    AND?: Prisma.email_project_leadsScalarWhereInput | Prisma.email_project_leadsScalarWhereInput[];
    OR?: Prisma.email_project_leadsScalarWhereInput[];
    NOT?: Prisma.email_project_leadsScalarWhereInput | Prisma.email_project_leadsScalarWhereInput[];
    project_id?: Prisma.StringFilter<"email_project_leads"> | string;
    lead_id?: Prisma.StringFilter<"email_project_leads"> | string;
    status?: Prisma.Enumemail_project_leads_statusFilter<"email_project_leads"> | $Enums.email_project_leads_status;
    created_at?: Prisma.DateTimeFilter<"email_project_leads"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"email_project_leads"> | Date | string;
    metrics?: Prisma.JsonNullableFilter<"email_project_leads">;
};
export type email_project_leadsCreateWithoutLeadsInput = {
    status?: $Enums.email_project_leads_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    metrics?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    projects: Prisma.email_projectsCreateNestedOneWithoutProject_leadsInput;
};
export type email_project_leadsUncheckedCreateWithoutLeadsInput = {
    project_id: string;
    status?: $Enums.email_project_leads_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    metrics?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type email_project_leadsCreateOrConnectWithoutLeadsInput = {
    where: Prisma.email_project_leadsWhereUniqueInput;
    create: Prisma.XOR<Prisma.email_project_leadsCreateWithoutLeadsInput, Prisma.email_project_leadsUncheckedCreateWithoutLeadsInput>;
};
export type email_project_leadsCreateManyLeadsInputEnvelope = {
    data: Prisma.email_project_leadsCreateManyLeadsInput | Prisma.email_project_leadsCreateManyLeadsInput[];
    skipDuplicates?: boolean;
};
export type email_project_leadsUpsertWithWhereUniqueWithoutLeadsInput = {
    where: Prisma.email_project_leadsWhereUniqueInput;
    update: Prisma.XOR<Prisma.email_project_leadsUpdateWithoutLeadsInput, Prisma.email_project_leadsUncheckedUpdateWithoutLeadsInput>;
    create: Prisma.XOR<Prisma.email_project_leadsCreateWithoutLeadsInput, Prisma.email_project_leadsUncheckedCreateWithoutLeadsInput>;
};
export type email_project_leadsUpdateWithWhereUniqueWithoutLeadsInput = {
    where: Prisma.email_project_leadsWhereUniqueInput;
    data: Prisma.XOR<Prisma.email_project_leadsUpdateWithoutLeadsInput, Prisma.email_project_leadsUncheckedUpdateWithoutLeadsInput>;
};
export type email_project_leadsUpdateManyWithWhereWithoutLeadsInput = {
    where: Prisma.email_project_leadsScalarWhereInput;
    data: Prisma.XOR<Prisma.email_project_leadsUpdateManyMutationInput, Prisma.email_project_leadsUncheckedUpdateManyWithoutLeadsInput>;
};
export type email_project_leadsCreateManyProjectsInput = {
    lead_id: string;
    status?: $Enums.email_project_leads_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    metrics?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type email_project_leadsUpdateWithoutProjectsInput = {
    status?: Prisma.Enumemail_project_leads_statusFieldUpdateOperationsInput | $Enums.email_project_leads_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    metrics?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    leads?: Prisma.email_leadsUpdateOneRequiredWithoutProject_linksNestedInput;
};
export type email_project_leadsUncheckedUpdateWithoutProjectsInput = {
    lead_id?: Prisma.StringFieldUpdateOperationsInput | string;
    status?: Prisma.Enumemail_project_leads_statusFieldUpdateOperationsInput | $Enums.email_project_leads_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    metrics?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type email_project_leadsUncheckedUpdateManyWithoutProjectsInput = {
    lead_id?: Prisma.StringFieldUpdateOperationsInput | string;
    status?: Prisma.Enumemail_project_leads_statusFieldUpdateOperationsInput | $Enums.email_project_leads_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    metrics?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type email_project_leadsCreateManyLeadsInput = {
    project_id: string;
    status?: $Enums.email_project_leads_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    metrics?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type email_project_leadsUpdateWithoutLeadsInput = {
    status?: Prisma.Enumemail_project_leads_statusFieldUpdateOperationsInput | $Enums.email_project_leads_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    metrics?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    projects?: Prisma.email_projectsUpdateOneRequiredWithoutProject_leadsNestedInput;
};
export type email_project_leadsUncheckedUpdateWithoutLeadsInput = {
    project_id?: Prisma.StringFieldUpdateOperationsInput | string;
    status?: Prisma.Enumemail_project_leads_statusFieldUpdateOperationsInput | $Enums.email_project_leads_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    metrics?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type email_project_leadsUncheckedUpdateManyWithoutLeadsInput = {
    project_id?: Prisma.StringFieldUpdateOperationsInput | string;
    status?: Prisma.Enumemail_project_leads_statusFieldUpdateOperationsInput | $Enums.email_project_leads_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    metrics?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type email_project_leadsSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    project_id?: boolean;
    lead_id?: boolean;
    status?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    metrics?: boolean;
    leads?: boolean | Prisma.email_leadsDefaultArgs<ExtArgs>;
    projects?: boolean | Prisma.email_projectsDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["email_project_leads"]>;
export type email_project_leadsSelectScalar = {
    project_id?: boolean;
    lead_id?: boolean;
    status?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    metrics?: boolean;
};
export type email_project_leadsOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"project_id" | "lead_id" | "status" | "created_at" | "updated_at" | "metrics", ExtArgs["result"]["email_project_leads"]>;
export type email_project_leadsInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    leads?: boolean | Prisma.email_leadsDefaultArgs<ExtArgs>;
    projects?: boolean | Prisma.email_projectsDefaultArgs<ExtArgs>;
};
export type $email_project_leadsPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "email_project_leads";
    objects: {
        leads: Prisma.$email_leadsPayload<ExtArgs>;
        projects: Prisma.$email_projectsPayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        project_id: string;
        lead_id: string;
        status: $Enums.email_project_leads_status;
        created_at: Date;
        updated_at: Date;
        metrics: runtime.JsonValue | null;
    }, ExtArgs["result"]["email_project_leads"]>;
    composites: {};
};
export type email_project_leadsGetPayload<S extends boolean | null | undefined | email_project_leadsDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$email_project_leadsPayload, S>;
export type email_project_leadsCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<email_project_leadsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: Email_project_leadsCountAggregateInputType | true;
};
export interface email_project_leadsDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['email_project_leads'];
        meta: {
            name: 'email_project_leads';
        };
    };
    findUnique<T extends email_project_leadsFindUniqueArgs>(args: Prisma.SelectSubset<T, email_project_leadsFindUniqueArgs<ExtArgs>>): Prisma.Prisma__email_project_leadsClient<runtime.Types.Result.GetResult<Prisma.$email_project_leadsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends email_project_leadsFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, email_project_leadsFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__email_project_leadsClient<runtime.Types.Result.GetResult<Prisma.$email_project_leadsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends email_project_leadsFindFirstArgs>(args?: Prisma.SelectSubset<T, email_project_leadsFindFirstArgs<ExtArgs>>): Prisma.Prisma__email_project_leadsClient<runtime.Types.Result.GetResult<Prisma.$email_project_leadsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends email_project_leadsFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, email_project_leadsFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__email_project_leadsClient<runtime.Types.Result.GetResult<Prisma.$email_project_leadsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends email_project_leadsFindManyArgs>(args?: Prisma.SelectSubset<T, email_project_leadsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$email_project_leadsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends email_project_leadsCreateArgs>(args: Prisma.SelectSubset<T, email_project_leadsCreateArgs<ExtArgs>>): Prisma.Prisma__email_project_leadsClient<runtime.Types.Result.GetResult<Prisma.$email_project_leadsPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends email_project_leadsCreateManyArgs>(args?: Prisma.SelectSubset<T, email_project_leadsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends email_project_leadsDeleteArgs>(args: Prisma.SelectSubset<T, email_project_leadsDeleteArgs<ExtArgs>>): Prisma.Prisma__email_project_leadsClient<runtime.Types.Result.GetResult<Prisma.$email_project_leadsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends email_project_leadsUpdateArgs>(args: Prisma.SelectSubset<T, email_project_leadsUpdateArgs<ExtArgs>>): Prisma.Prisma__email_project_leadsClient<runtime.Types.Result.GetResult<Prisma.$email_project_leadsPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends email_project_leadsDeleteManyArgs>(args?: Prisma.SelectSubset<T, email_project_leadsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends email_project_leadsUpdateManyArgs>(args: Prisma.SelectSubset<T, email_project_leadsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends email_project_leadsUpsertArgs>(args: Prisma.SelectSubset<T, email_project_leadsUpsertArgs<ExtArgs>>): Prisma.Prisma__email_project_leadsClient<runtime.Types.Result.GetResult<Prisma.$email_project_leadsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends email_project_leadsCountArgs>(args?: Prisma.Subset<T, email_project_leadsCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], Email_project_leadsCountAggregateOutputType> : number>;
    aggregate<T extends Email_project_leadsAggregateArgs>(args: Prisma.Subset<T, Email_project_leadsAggregateArgs>): Prisma.PrismaPromise<GetEmail_project_leadsAggregateType<T>>;
    groupBy<T extends email_project_leadsGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: email_project_leadsGroupByArgs['orderBy'];
    } : {
        orderBy?: email_project_leadsGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, email_project_leadsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetEmail_project_leadsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: email_project_leadsFieldRefs;
}
export interface Prisma__email_project_leadsClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    leads<T extends Prisma.email_leadsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.email_leadsDefaultArgs<ExtArgs>>): Prisma.Prisma__email_leadsClient<runtime.Types.Result.GetResult<Prisma.$email_leadsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    projects<T extends Prisma.email_projectsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.email_projectsDefaultArgs<ExtArgs>>): Prisma.Prisma__email_projectsClient<runtime.Types.Result.GetResult<Prisma.$email_projectsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface email_project_leadsFieldRefs {
    readonly project_id: Prisma.FieldRef<"email_project_leads", 'String'>;
    readonly lead_id: Prisma.FieldRef<"email_project_leads", 'String'>;
    readonly status: Prisma.FieldRef<"email_project_leads", 'email_project_leads_status'>;
    readonly created_at: Prisma.FieldRef<"email_project_leads", 'DateTime'>;
    readonly updated_at: Prisma.FieldRef<"email_project_leads", 'DateTime'>;
    readonly metrics: Prisma.FieldRef<"email_project_leads", 'Json'>;
}
export type email_project_leadsFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_project_leadsSelect<ExtArgs> | null;
    omit?: Prisma.email_project_leadsOmit<ExtArgs> | null;
    include?: Prisma.email_project_leadsInclude<ExtArgs> | null;
    where: Prisma.email_project_leadsWhereUniqueInput;
};
export type email_project_leadsFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_project_leadsSelect<ExtArgs> | null;
    omit?: Prisma.email_project_leadsOmit<ExtArgs> | null;
    include?: Prisma.email_project_leadsInclude<ExtArgs> | null;
    where: Prisma.email_project_leadsWhereUniqueInput;
};
export type email_project_leadsFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_project_leadsSelect<ExtArgs> | null;
    omit?: Prisma.email_project_leadsOmit<ExtArgs> | null;
    include?: Prisma.email_project_leadsInclude<ExtArgs> | null;
    where?: Prisma.email_project_leadsWhereInput;
    orderBy?: Prisma.email_project_leadsOrderByWithRelationInput | Prisma.email_project_leadsOrderByWithRelationInput[];
    cursor?: Prisma.email_project_leadsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Email_project_leadsScalarFieldEnum | Prisma.Email_project_leadsScalarFieldEnum[];
};
export type email_project_leadsFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_project_leadsSelect<ExtArgs> | null;
    omit?: Prisma.email_project_leadsOmit<ExtArgs> | null;
    include?: Prisma.email_project_leadsInclude<ExtArgs> | null;
    where?: Prisma.email_project_leadsWhereInput;
    orderBy?: Prisma.email_project_leadsOrderByWithRelationInput | Prisma.email_project_leadsOrderByWithRelationInput[];
    cursor?: Prisma.email_project_leadsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Email_project_leadsScalarFieldEnum | Prisma.Email_project_leadsScalarFieldEnum[];
};
export type email_project_leadsFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_project_leadsSelect<ExtArgs> | null;
    omit?: Prisma.email_project_leadsOmit<ExtArgs> | null;
    include?: Prisma.email_project_leadsInclude<ExtArgs> | null;
    where?: Prisma.email_project_leadsWhereInput;
    orderBy?: Prisma.email_project_leadsOrderByWithRelationInput | Prisma.email_project_leadsOrderByWithRelationInput[];
    cursor?: Prisma.email_project_leadsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Email_project_leadsScalarFieldEnum | Prisma.Email_project_leadsScalarFieldEnum[];
};
export type email_project_leadsCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_project_leadsSelect<ExtArgs> | null;
    omit?: Prisma.email_project_leadsOmit<ExtArgs> | null;
    include?: Prisma.email_project_leadsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.email_project_leadsCreateInput, Prisma.email_project_leadsUncheckedCreateInput>;
};
export type email_project_leadsCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.email_project_leadsCreateManyInput | Prisma.email_project_leadsCreateManyInput[];
    skipDuplicates?: boolean;
};
export type email_project_leadsUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_project_leadsSelect<ExtArgs> | null;
    omit?: Prisma.email_project_leadsOmit<ExtArgs> | null;
    include?: Prisma.email_project_leadsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.email_project_leadsUpdateInput, Prisma.email_project_leadsUncheckedUpdateInput>;
    where: Prisma.email_project_leadsWhereUniqueInput;
};
export type email_project_leadsUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.email_project_leadsUpdateManyMutationInput, Prisma.email_project_leadsUncheckedUpdateManyInput>;
    where?: Prisma.email_project_leadsWhereInput;
    limit?: number;
};
export type email_project_leadsUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_project_leadsSelect<ExtArgs> | null;
    omit?: Prisma.email_project_leadsOmit<ExtArgs> | null;
    include?: Prisma.email_project_leadsInclude<ExtArgs> | null;
    where: Prisma.email_project_leadsWhereUniqueInput;
    create: Prisma.XOR<Prisma.email_project_leadsCreateInput, Prisma.email_project_leadsUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.email_project_leadsUpdateInput, Prisma.email_project_leadsUncheckedUpdateInput>;
};
export type email_project_leadsDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_project_leadsSelect<ExtArgs> | null;
    omit?: Prisma.email_project_leadsOmit<ExtArgs> | null;
    include?: Prisma.email_project_leadsInclude<ExtArgs> | null;
    where: Prisma.email_project_leadsWhereUniqueInput;
};
export type email_project_leadsDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_project_leadsWhereInput;
    limit?: number;
};
export type email_project_leadsDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_project_leadsSelect<ExtArgs> | null;
    omit?: Prisma.email_project_leadsOmit<ExtArgs> | null;
    include?: Prisma.email_project_leadsInclude<ExtArgs> | null;
};
export {};
