import type * as runtime from "@prisma/client/runtime/client";
import type * as $Enums from "../enums.js";
import type * as Prisma from "../internal/prismaNamespace.js";
export type email_leadsModel = runtime.Types.Result.DefaultSelection<Prisma.$email_leadsPayload>;
export type AggregateEmail_leads = {
    _count: Email_leadsCountAggregateOutputType | null;
    _min: Email_leadsMinAggregateOutputType | null;
    _max: Email_leadsMaxAggregateOutputType | null;
};
export type Email_leadsMinAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    email: string | null;
    name: string | null;
    global_status: $Enums.email_leads_global_status | null;
};
export type Email_leadsMaxAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    email: string | null;
    name: string | null;
    global_status: $Enums.email_leads_global_status | null;
};
export type Email_leadsCountAggregateOutputType = {
    id: number;
    organization_id: number;
    email: number;
    name: number;
    attributes: number;
    global_status: number;
    _all: number;
};
export type Email_leadsMinAggregateInputType = {
    id?: true;
    organization_id?: true;
    email?: true;
    name?: true;
    global_status?: true;
};
export type Email_leadsMaxAggregateInputType = {
    id?: true;
    organization_id?: true;
    email?: true;
    name?: true;
    global_status?: true;
};
export type Email_leadsCountAggregateInputType = {
    id?: true;
    organization_id?: true;
    email?: true;
    name?: true;
    attributes?: true;
    global_status?: true;
    _all?: true;
};
export type Email_leadsAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_leadsWhereInput;
    orderBy?: Prisma.email_leadsOrderByWithRelationInput | Prisma.email_leadsOrderByWithRelationInput[];
    cursor?: Prisma.email_leadsWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | Email_leadsCountAggregateInputType;
    _min?: Email_leadsMinAggregateInputType;
    _max?: Email_leadsMaxAggregateInputType;
};
export type GetEmail_leadsAggregateType<T extends Email_leadsAggregateArgs> = {
    [P in keyof T & keyof AggregateEmail_leads]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateEmail_leads[P]> : Prisma.GetScalarType<T[P], AggregateEmail_leads[P]>;
};
export type email_leadsGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_leadsWhereInput;
    orderBy?: Prisma.email_leadsOrderByWithAggregationInput | Prisma.email_leadsOrderByWithAggregationInput[];
    by: Prisma.Email_leadsScalarFieldEnum[] | Prisma.Email_leadsScalarFieldEnum;
    having?: Prisma.email_leadsScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: Email_leadsCountAggregateInputType | true;
    _min?: Email_leadsMinAggregateInputType;
    _max?: Email_leadsMaxAggregateInputType;
};
export type Email_leadsGroupByOutputType = {
    id: string;
    organization_id: string;
    email: string;
    name: string | null;
    attributes: runtime.JsonValue | null;
    global_status: $Enums.email_leads_global_status;
    _count: Email_leadsCountAggregateOutputType | null;
    _min: Email_leadsMinAggregateOutputType | null;
    _max: Email_leadsMaxAggregateOutputType | null;
};
type GetEmail_leadsGroupByPayload<T extends email_leadsGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<Email_leadsGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof Email_leadsGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], Email_leadsGroupByOutputType[P]> : Prisma.GetScalarType<T[P], Email_leadsGroupByOutputType[P]>;
}>>;
export type email_leadsWhereInput = {
    AND?: Prisma.email_leadsWhereInput | Prisma.email_leadsWhereInput[];
    OR?: Prisma.email_leadsWhereInput[];
    NOT?: Prisma.email_leadsWhereInput | Prisma.email_leadsWhereInput[];
    id?: Prisma.StringFilter<"email_leads"> | string;
    organization_id?: Prisma.StringFilter<"email_leads"> | string;
    email?: Prisma.StringFilter<"email_leads"> | string;
    name?: Prisma.StringNullableFilter<"email_leads"> | string | null;
    attributes?: Prisma.JsonNullableFilter<"email_leads">;
    global_status?: Prisma.Enumemail_leads_global_statusFilter<"email_leads"> | $Enums.email_leads_global_status;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
    project_links?: Prisma.Email_project_leadsListRelationFilter;
};
export type email_leadsOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    name?: Prisma.SortOrderInput | Prisma.SortOrder;
    attributes?: Prisma.SortOrderInput | Prisma.SortOrder;
    global_status?: Prisma.SortOrder;
    organizations?: Prisma.organizationsOrderByWithRelationInput;
    project_links?: Prisma.email_project_leadsOrderByRelationAggregateInput;
    _relevance?: Prisma.email_leadsOrderByRelevanceInput;
};
export type email_leadsWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    organization_id_email?: Prisma.email_leadsOrganization_idEmailCompoundUniqueInput;
    AND?: Prisma.email_leadsWhereInput | Prisma.email_leadsWhereInput[];
    OR?: Prisma.email_leadsWhereInput[];
    NOT?: Prisma.email_leadsWhereInput | Prisma.email_leadsWhereInput[];
    organization_id?: Prisma.StringFilter<"email_leads"> | string;
    email?: Prisma.StringFilter<"email_leads"> | string;
    name?: Prisma.StringNullableFilter<"email_leads"> | string | null;
    attributes?: Prisma.JsonNullableFilter<"email_leads">;
    global_status?: Prisma.Enumemail_leads_global_statusFilter<"email_leads"> | $Enums.email_leads_global_status;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
    project_links?: Prisma.Email_project_leadsListRelationFilter;
}, "id" | "organization_id_email">;
export type email_leadsOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    name?: Prisma.SortOrderInput | Prisma.SortOrder;
    attributes?: Prisma.SortOrderInput | Prisma.SortOrder;
    global_status?: Prisma.SortOrder;
    _count?: Prisma.email_leadsCountOrderByAggregateInput;
    _max?: Prisma.email_leadsMaxOrderByAggregateInput;
    _min?: Prisma.email_leadsMinOrderByAggregateInput;
};
export type email_leadsScalarWhereWithAggregatesInput = {
    AND?: Prisma.email_leadsScalarWhereWithAggregatesInput | Prisma.email_leadsScalarWhereWithAggregatesInput[];
    OR?: Prisma.email_leadsScalarWhereWithAggregatesInput[];
    NOT?: Prisma.email_leadsScalarWhereWithAggregatesInput | Prisma.email_leadsScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"email_leads"> | string;
    organization_id?: Prisma.StringWithAggregatesFilter<"email_leads"> | string;
    email?: Prisma.StringWithAggregatesFilter<"email_leads"> | string;
    name?: Prisma.StringNullableWithAggregatesFilter<"email_leads"> | string | null;
    attributes?: Prisma.JsonNullableWithAggregatesFilter<"email_leads">;
    global_status?: Prisma.Enumemail_leads_global_statusWithAggregatesFilter<"email_leads"> | $Enums.email_leads_global_status;
};
export type email_leadsCreateInput = {
    id?: string;
    email: string;
    name?: string | null;
    attributes?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    global_status?: $Enums.email_leads_global_status;
    organizations: Prisma.organizationsCreateNestedOneWithoutEmail_leadsInput;
    project_links?: Prisma.email_project_leadsCreateNestedManyWithoutLeadsInput;
};
export type email_leadsUncheckedCreateInput = {
    id?: string;
    organization_id: string;
    email: string;
    name?: string | null;
    attributes?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    global_status?: $Enums.email_leads_global_status;
    project_links?: Prisma.email_project_leadsUncheckedCreateNestedManyWithoutLeadsInput;
};
export type email_leadsUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    attributes?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    global_status?: Prisma.Enumemail_leads_global_statusFieldUpdateOperationsInput | $Enums.email_leads_global_status;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutEmail_leadsNestedInput;
    project_links?: Prisma.email_project_leadsUpdateManyWithoutLeadsNestedInput;
};
export type email_leadsUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    attributes?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    global_status?: Prisma.Enumemail_leads_global_statusFieldUpdateOperationsInput | $Enums.email_leads_global_status;
    project_links?: Prisma.email_project_leadsUncheckedUpdateManyWithoutLeadsNestedInput;
};
export type email_leadsCreateManyInput = {
    id?: string;
    organization_id: string;
    email: string;
    name?: string | null;
    attributes?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    global_status?: $Enums.email_leads_global_status;
};
export type email_leadsUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    attributes?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    global_status?: Prisma.Enumemail_leads_global_statusFieldUpdateOperationsInput | $Enums.email_leads_global_status;
};
export type email_leadsUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    attributes?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    global_status?: Prisma.Enumemail_leads_global_statusFieldUpdateOperationsInput | $Enums.email_leads_global_status;
};
export type Email_leadsListRelationFilter = {
    every?: Prisma.email_leadsWhereInput;
    some?: Prisma.email_leadsWhereInput;
    none?: Prisma.email_leadsWhereInput;
};
export type email_leadsOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type email_leadsOrderByRelevanceInput = {
    fields: Prisma.email_leadsOrderByRelevanceFieldEnum | Prisma.email_leadsOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type email_leadsOrganization_idEmailCompoundUniqueInput = {
    organization_id: string;
    email: string;
};
export type email_leadsCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    attributes?: Prisma.SortOrder;
    global_status?: Prisma.SortOrder;
};
export type email_leadsMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    global_status?: Prisma.SortOrder;
};
export type email_leadsMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    global_status?: Prisma.SortOrder;
};
export type Email_leadsScalarRelationFilter = {
    is?: Prisma.email_leadsWhereInput;
    isNot?: Prisma.email_leadsWhereInput;
};
export type email_leadsCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.email_leadsCreateWithoutOrganizationsInput, Prisma.email_leadsUncheckedCreateWithoutOrganizationsInput> | Prisma.email_leadsCreateWithoutOrganizationsInput[] | Prisma.email_leadsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.email_leadsCreateOrConnectWithoutOrganizationsInput | Prisma.email_leadsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.email_leadsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.email_leadsWhereUniqueInput | Prisma.email_leadsWhereUniqueInput[];
};
export type email_leadsUncheckedCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.email_leadsCreateWithoutOrganizationsInput, Prisma.email_leadsUncheckedCreateWithoutOrganizationsInput> | Prisma.email_leadsCreateWithoutOrganizationsInput[] | Prisma.email_leadsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.email_leadsCreateOrConnectWithoutOrganizationsInput | Prisma.email_leadsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.email_leadsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.email_leadsWhereUniqueInput | Prisma.email_leadsWhereUniqueInput[];
};
export type email_leadsUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.email_leadsCreateWithoutOrganizationsInput, Prisma.email_leadsUncheckedCreateWithoutOrganizationsInput> | Prisma.email_leadsCreateWithoutOrganizationsInput[] | Prisma.email_leadsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.email_leadsCreateOrConnectWithoutOrganizationsInput | Prisma.email_leadsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.email_leadsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.email_leadsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.email_leadsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.email_leadsWhereUniqueInput | Prisma.email_leadsWhereUniqueInput[];
    disconnect?: Prisma.email_leadsWhereUniqueInput | Prisma.email_leadsWhereUniqueInput[];
    delete?: Prisma.email_leadsWhereUniqueInput | Prisma.email_leadsWhereUniqueInput[];
    connect?: Prisma.email_leadsWhereUniqueInput | Prisma.email_leadsWhereUniqueInput[];
    update?: Prisma.email_leadsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.email_leadsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.email_leadsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.email_leadsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.email_leadsScalarWhereInput | Prisma.email_leadsScalarWhereInput[];
};
export type email_leadsUncheckedUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.email_leadsCreateWithoutOrganizationsInput, Prisma.email_leadsUncheckedCreateWithoutOrganizationsInput> | Prisma.email_leadsCreateWithoutOrganizationsInput[] | Prisma.email_leadsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.email_leadsCreateOrConnectWithoutOrganizationsInput | Prisma.email_leadsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.email_leadsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.email_leadsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.email_leadsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.email_leadsWhereUniqueInput | Prisma.email_leadsWhereUniqueInput[];
    disconnect?: Prisma.email_leadsWhereUniqueInput | Prisma.email_leadsWhereUniqueInput[];
    delete?: Prisma.email_leadsWhereUniqueInput | Prisma.email_leadsWhereUniqueInput[];
    connect?: Prisma.email_leadsWhereUniqueInput | Prisma.email_leadsWhereUniqueInput[];
    update?: Prisma.email_leadsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.email_leadsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.email_leadsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.email_leadsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.email_leadsScalarWhereInput | Prisma.email_leadsScalarWhereInput[];
};
export type Enumemail_leads_global_statusFieldUpdateOperationsInput = {
    set?: $Enums.email_leads_global_status;
};
export type email_leadsCreateNestedOneWithoutProject_linksInput = {
    create?: Prisma.XOR<Prisma.email_leadsCreateWithoutProject_linksInput, Prisma.email_leadsUncheckedCreateWithoutProject_linksInput>;
    connectOrCreate?: Prisma.email_leadsCreateOrConnectWithoutProject_linksInput;
    connect?: Prisma.email_leadsWhereUniqueInput;
};
export type email_leadsUpdateOneRequiredWithoutProject_linksNestedInput = {
    create?: Prisma.XOR<Prisma.email_leadsCreateWithoutProject_linksInput, Prisma.email_leadsUncheckedCreateWithoutProject_linksInput>;
    connectOrCreate?: Prisma.email_leadsCreateOrConnectWithoutProject_linksInput;
    upsert?: Prisma.email_leadsUpsertWithoutProject_linksInput;
    connect?: Prisma.email_leadsWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.email_leadsUpdateToOneWithWhereWithoutProject_linksInput, Prisma.email_leadsUpdateWithoutProject_linksInput>, Prisma.email_leadsUncheckedUpdateWithoutProject_linksInput>;
};
export type email_leadsCreateWithoutOrganizationsInput = {
    id?: string;
    email: string;
    name?: string | null;
    attributes?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    global_status?: $Enums.email_leads_global_status;
    project_links?: Prisma.email_project_leadsCreateNestedManyWithoutLeadsInput;
};
export type email_leadsUncheckedCreateWithoutOrganizationsInput = {
    id?: string;
    email: string;
    name?: string | null;
    attributes?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    global_status?: $Enums.email_leads_global_status;
    project_links?: Prisma.email_project_leadsUncheckedCreateNestedManyWithoutLeadsInput;
};
export type email_leadsCreateOrConnectWithoutOrganizationsInput = {
    where: Prisma.email_leadsWhereUniqueInput;
    create: Prisma.XOR<Prisma.email_leadsCreateWithoutOrganizationsInput, Prisma.email_leadsUncheckedCreateWithoutOrganizationsInput>;
};
export type email_leadsCreateManyOrganizationsInputEnvelope = {
    data: Prisma.email_leadsCreateManyOrganizationsInput | Prisma.email_leadsCreateManyOrganizationsInput[];
    skipDuplicates?: boolean;
};
export type email_leadsUpsertWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.email_leadsWhereUniqueInput;
    update: Prisma.XOR<Prisma.email_leadsUpdateWithoutOrganizationsInput, Prisma.email_leadsUncheckedUpdateWithoutOrganizationsInput>;
    create: Prisma.XOR<Prisma.email_leadsCreateWithoutOrganizationsInput, Prisma.email_leadsUncheckedCreateWithoutOrganizationsInput>;
};
export type email_leadsUpdateWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.email_leadsWhereUniqueInput;
    data: Prisma.XOR<Prisma.email_leadsUpdateWithoutOrganizationsInput, Prisma.email_leadsUncheckedUpdateWithoutOrganizationsInput>;
};
export type email_leadsUpdateManyWithWhereWithoutOrganizationsInput = {
    where: Prisma.email_leadsScalarWhereInput;
    data: Prisma.XOR<Prisma.email_leadsUpdateManyMutationInput, Prisma.email_leadsUncheckedUpdateManyWithoutOrganizationsInput>;
};
export type email_leadsScalarWhereInput = {
    AND?: Prisma.email_leadsScalarWhereInput | Prisma.email_leadsScalarWhereInput[];
    OR?: Prisma.email_leadsScalarWhereInput[];
    NOT?: Prisma.email_leadsScalarWhereInput | Prisma.email_leadsScalarWhereInput[];
    id?: Prisma.StringFilter<"email_leads"> | string;
    organization_id?: Prisma.StringFilter<"email_leads"> | string;
    email?: Prisma.StringFilter<"email_leads"> | string;
    name?: Prisma.StringNullableFilter<"email_leads"> | string | null;
    attributes?: Prisma.JsonNullableFilter<"email_leads">;
    global_status?: Prisma.Enumemail_leads_global_statusFilter<"email_leads"> | $Enums.email_leads_global_status;
};
export type email_leadsCreateWithoutProject_linksInput = {
    id?: string;
    email: string;
    name?: string | null;
    attributes?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    global_status?: $Enums.email_leads_global_status;
    organizations: Prisma.organizationsCreateNestedOneWithoutEmail_leadsInput;
};
export type email_leadsUncheckedCreateWithoutProject_linksInput = {
    id?: string;
    organization_id: string;
    email: string;
    name?: string | null;
    attributes?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    global_status?: $Enums.email_leads_global_status;
};
export type email_leadsCreateOrConnectWithoutProject_linksInput = {
    where: Prisma.email_leadsWhereUniqueInput;
    create: Prisma.XOR<Prisma.email_leadsCreateWithoutProject_linksInput, Prisma.email_leadsUncheckedCreateWithoutProject_linksInput>;
};
export type email_leadsUpsertWithoutProject_linksInput = {
    update: Prisma.XOR<Prisma.email_leadsUpdateWithoutProject_linksInput, Prisma.email_leadsUncheckedUpdateWithoutProject_linksInput>;
    create: Prisma.XOR<Prisma.email_leadsCreateWithoutProject_linksInput, Prisma.email_leadsUncheckedCreateWithoutProject_linksInput>;
    where?: Prisma.email_leadsWhereInput;
};
export type email_leadsUpdateToOneWithWhereWithoutProject_linksInput = {
    where?: Prisma.email_leadsWhereInput;
    data: Prisma.XOR<Prisma.email_leadsUpdateWithoutProject_linksInput, Prisma.email_leadsUncheckedUpdateWithoutProject_linksInput>;
};
export type email_leadsUpdateWithoutProject_linksInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    attributes?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    global_status?: Prisma.Enumemail_leads_global_statusFieldUpdateOperationsInput | $Enums.email_leads_global_status;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutEmail_leadsNestedInput;
};
export type email_leadsUncheckedUpdateWithoutProject_linksInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    attributes?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    global_status?: Prisma.Enumemail_leads_global_statusFieldUpdateOperationsInput | $Enums.email_leads_global_status;
};
export type email_leadsCreateManyOrganizationsInput = {
    id?: string;
    email: string;
    name?: string | null;
    attributes?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    global_status?: $Enums.email_leads_global_status;
};
export type email_leadsUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    attributes?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    global_status?: Prisma.Enumemail_leads_global_statusFieldUpdateOperationsInput | $Enums.email_leads_global_status;
    project_links?: Prisma.email_project_leadsUpdateManyWithoutLeadsNestedInput;
};
export type email_leadsUncheckedUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    attributes?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    global_status?: Prisma.Enumemail_leads_global_statusFieldUpdateOperationsInput | $Enums.email_leads_global_status;
    project_links?: Prisma.email_project_leadsUncheckedUpdateManyWithoutLeadsNestedInput;
};
export type email_leadsUncheckedUpdateManyWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    attributes?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    global_status?: Prisma.Enumemail_leads_global_statusFieldUpdateOperationsInput | $Enums.email_leads_global_status;
};
export type Email_leadsCountOutputType = {
    project_links: number;
};
export type Email_leadsCountOutputTypeSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    project_links?: boolean | Email_leadsCountOutputTypeCountProject_linksArgs;
};
export type Email_leadsCountOutputTypeDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.Email_leadsCountOutputTypeSelect<ExtArgs> | null;
};
export type Email_leadsCountOutputTypeCountProject_linksArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_project_leadsWhereInput;
};
export type email_leadsSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    organization_id?: boolean;
    email?: boolean;
    name?: boolean;
    attributes?: boolean;
    global_status?: boolean;
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
    project_links?: boolean | Prisma.email_leads$project_linksArgs<ExtArgs>;
    _count?: boolean | Prisma.Email_leadsCountOutputTypeDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["email_leads"]>;
export type email_leadsSelectScalar = {
    id?: boolean;
    organization_id?: boolean;
    email?: boolean;
    name?: boolean;
    attributes?: boolean;
    global_status?: boolean;
};
export type email_leadsOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "organization_id" | "email" | "name" | "attributes" | "global_status", ExtArgs["result"]["email_leads"]>;
export type email_leadsInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
    project_links?: boolean | Prisma.email_leads$project_linksArgs<ExtArgs>;
    _count?: boolean | Prisma.Email_leadsCountOutputTypeDefaultArgs<ExtArgs>;
};
export type $email_leadsPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "email_leads";
    objects: {
        organizations: Prisma.$organizationsPayload<ExtArgs>;
        project_links: Prisma.$email_project_leadsPayload<ExtArgs>[];
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        organization_id: string;
        email: string;
        name: string | null;
        attributes: runtime.JsonValue | null;
        global_status: $Enums.email_leads_global_status;
    }, ExtArgs["result"]["email_leads"]>;
    composites: {};
};
export type email_leadsGetPayload<S extends boolean | null | undefined | email_leadsDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$email_leadsPayload, S>;
export type email_leadsCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<email_leadsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: Email_leadsCountAggregateInputType | true;
};
export interface email_leadsDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['email_leads'];
        meta: {
            name: 'email_leads';
        };
    };
    findUnique<T extends email_leadsFindUniqueArgs>(args: Prisma.SelectSubset<T, email_leadsFindUniqueArgs<ExtArgs>>): Prisma.Prisma__email_leadsClient<runtime.Types.Result.GetResult<Prisma.$email_leadsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends email_leadsFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, email_leadsFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__email_leadsClient<runtime.Types.Result.GetResult<Prisma.$email_leadsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends email_leadsFindFirstArgs>(args?: Prisma.SelectSubset<T, email_leadsFindFirstArgs<ExtArgs>>): Prisma.Prisma__email_leadsClient<runtime.Types.Result.GetResult<Prisma.$email_leadsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends email_leadsFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, email_leadsFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__email_leadsClient<runtime.Types.Result.GetResult<Prisma.$email_leadsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends email_leadsFindManyArgs>(args?: Prisma.SelectSubset<T, email_leadsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$email_leadsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends email_leadsCreateArgs>(args: Prisma.SelectSubset<T, email_leadsCreateArgs<ExtArgs>>): Prisma.Prisma__email_leadsClient<runtime.Types.Result.GetResult<Prisma.$email_leadsPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends email_leadsCreateManyArgs>(args?: Prisma.SelectSubset<T, email_leadsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends email_leadsDeleteArgs>(args: Prisma.SelectSubset<T, email_leadsDeleteArgs<ExtArgs>>): Prisma.Prisma__email_leadsClient<runtime.Types.Result.GetResult<Prisma.$email_leadsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends email_leadsUpdateArgs>(args: Prisma.SelectSubset<T, email_leadsUpdateArgs<ExtArgs>>): Prisma.Prisma__email_leadsClient<runtime.Types.Result.GetResult<Prisma.$email_leadsPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends email_leadsDeleteManyArgs>(args?: Prisma.SelectSubset<T, email_leadsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends email_leadsUpdateManyArgs>(args: Prisma.SelectSubset<T, email_leadsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends email_leadsUpsertArgs>(args: Prisma.SelectSubset<T, email_leadsUpsertArgs<ExtArgs>>): Prisma.Prisma__email_leadsClient<runtime.Types.Result.GetResult<Prisma.$email_leadsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends email_leadsCountArgs>(args?: Prisma.Subset<T, email_leadsCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], Email_leadsCountAggregateOutputType> : number>;
    aggregate<T extends Email_leadsAggregateArgs>(args: Prisma.Subset<T, Email_leadsAggregateArgs>): Prisma.PrismaPromise<GetEmail_leadsAggregateType<T>>;
    groupBy<T extends email_leadsGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: email_leadsGroupByArgs['orderBy'];
    } : {
        orderBy?: email_leadsGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, email_leadsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetEmail_leadsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: email_leadsFieldRefs;
}
export interface Prisma__email_leadsClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    organizations<T extends Prisma.organizationsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.organizationsDefaultArgs<ExtArgs>>): Prisma.Prisma__organizationsClient<runtime.Types.Result.GetResult<Prisma.$organizationsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    project_links<T extends Prisma.email_leads$project_linksArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.email_leads$project_linksArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$email_project_leadsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface email_leadsFieldRefs {
    readonly id: Prisma.FieldRef<"email_leads", 'String'>;
    readonly organization_id: Prisma.FieldRef<"email_leads", 'String'>;
    readonly email: Prisma.FieldRef<"email_leads", 'String'>;
    readonly name: Prisma.FieldRef<"email_leads", 'String'>;
    readonly attributes: Prisma.FieldRef<"email_leads", 'Json'>;
    readonly global_status: Prisma.FieldRef<"email_leads", 'email_leads_global_status'>;
}
export type email_leadsFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_leadsSelect<ExtArgs> | null;
    omit?: Prisma.email_leadsOmit<ExtArgs> | null;
    include?: Prisma.email_leadsInclude<ExtArgs> | null;
    where: Prisma.email_leadsWhereUniqueInput;
};
export type email_leadsFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_leadsSelect<ExtArgs> | null;
    omit?: Prisma.email_leadsOmit<ExtArgs> | null;
    include?: Prisma.email_leadsInclude<ExtArgs> | null;
    where: Prisma.email_leadsWhereUniqueInput;
};
export type email_leadsFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_leadsSelect<ExtArgs> | null;
    omit?: Prisma.email_leadsOmit<ExtArgs> | null;
    include?: Prisma.email_leadsInclude<ExtArgs> | null;
    where?: Prisma.email_leadsWhereInput;
    orderBy?: Prisma.email_leadsOrderByWithRelationInput | Prisma.email_leadsOrderByWithRelationInput[];
    cursor?: Prisma.email_leadsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Email_leadsScalarFieldEnum | Prisma.Email_leadsScalarFieldEnum[];
};
export type email_leadsFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_leadsSelect<ExtArgs> | null;
    omit?: Prisma.email_leadsOmit<ExtArgs> | null;
    include?: Prisma.email_leadsInclude<ExtArgs> | null;
    where?: Prisma.email_leadsWhereInput;
    orderBy?: Prisma.email_leadsOrderByWithRelationInput | Prisma.email_leadsOrderByWithRelationInput[];
    cursor?: Prisma.email_leadsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Email_leadsScalarFieldEnum | Prisma.Email_leadsScalarFieldEnum[];
};
export type email_leadsFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_leadsSelect<ExtArgs> | null;
    omit?: Prisma.email_leadsOmit<ExtArgs> | null;
    include?: Prisma.email_leadsInclude<ExtArgs> | null;
    where?: Prisma.email_leadsWhereInput;
    orderBy?: Prisma.email_leadsOrderByWithRelationInput | Prisma.email_leadsOrderByWithRelationInput[];
    cursor?: Prisma.email_leadsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Email_leadsScalarFieldEnum | Prisma.Email_leadsScalarFieldEnum[];
};
export type email_leadsCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_leadsSelect<ExtArgs> | null;
    omit?: Prisma.email_leadsOmit<ExtArgs> | null;
    include?: Prisma.email_leadsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.email_leadsCreateInput, Prisma.email_leadsUncheckedCreateInput>;
};
export type email_leadsCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.email_leadsCreateManyInput | Prisma.email_leadsCreateManyInput[];
    skipDuplicates?: boolean;
};
export type email_leadsUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_leadsSelect<ExtArgs> | null;
    omit?: Prisma.email_leadsOmit<ExtArgs> | null;
    include?: Prisma.email_leadsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.email_leadsUpdateInput, Prisma.email_leadsUncheckedUpdateInput>;
    where: Prisma.email_leadsWhereUniqueInput;
};
export type email_leadsUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.email_leadsUpdateManyMutationInput, Prisma.email_leadsUncheckedUpdateManyInput>;
    where?: Prisma.email_leadsWhereInput;
    limit?: number;
};
export type email_leadsUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_leadsSelect<ExtArgs> | null;
    omit?: Prisma.email_leadsOmit<ExtArgs> | null;
    include?: Prisma.email_leadsInclude<ExtArgs> | null;
    where: Prisma.email_leadsWhereUniqueInput;
    create: Prisma.XOR<Prisma.email_leadsCreateInput, Prisma.email_leadsUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.email_leadsUpdateInput, Prisma.email_leadsUncheckedUpdateInput>;
};
export type email_leadsDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_leadsSelect<ExtArgs> | null;
    omit?: Prisma.email_leadsOmit<ExtArgs> | null;
    include?: Prisma.email_leadsInclude<ExtArgs> | null;
    where: Prisma.email_leadsWhereUniqueInput;
};
export type email_leadsDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_leadsWhereInput;
    limit?: number;
};
export type email_leads$project_linksArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type email_leadsDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_leadsSelect<ExtArgs> | null;
    omit?: Prisma.email_leadsOmit<ExtArgs> | null;
    include?: Prisma.email_leadsInclude<ExtArgs> | null;
};
export {};
