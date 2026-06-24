import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type email_projectsModel = runtime.Types.Result.DefaultSelection<Prisma.$email_projectsPayload>;
export type AggregateEmail_projects = {
    _count: Email_projectsCountAggregateOutputType | null;
    _min: Email_projectsMinAggregateOutputType | null;
    _max: Email_projectsMaxAggregateOutputType | null;
};
export type Email_projectsMinAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    name: string | null;
    created_at: Date | null;
    active: boolean | null;
};
export type Email_projectsMaxAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    name: string | null;
    created_at: Date | null;
    active: boolean | null;
};
export type Email_projectsCountAggregateOutputType = {
    id: number;
    organization_id: number;
    name: number;
    settings: number;
    created_at: number;
    active: number;
    _all: number;
};
export type Email_projectsMinAggregateInputType = {
    id?: true;
    organization_id?: true;
    name?: true;
    created_at?: true;
    active?: true;
};
export type Email_projectsMaxAggregateInputType = {
    id?: true;
    organization_id?: true;
    name?: true;
    created_at?: true;
    active?: true;
};
export type Email_projectsCountAggregateInputType = {
    id?: true;
    organization_id?: true;
    name?: true;
    settings?: true;
    created_at?: true;
    active?: true;
    _all?: true;
};
export type Email_projectsAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_projectsWhereInput;
    orderBy?: Prisma.email_projectsOrderByWithRelationInput | Prisma.email_projectsOrderByWithRelationInput[];
    cursor?: Prisma.email_projectsWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | Email_projectsCountAggregateInputType;
    _min?: Email_projectsMinAggregateInputType;
    _max?: Email_projectsMaxAggregateInputType;
};
export type GetEmail_projectsAggregateType<T extends Email_projectsAggregateArgs> = {
    [P in keyof T & keyof AggregateEmail_projects]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateEmail_projects[P]> : Prisma.GetScalarType<T[P], AggregateEmail_projects[P]>;
};
export type email_projectsGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_projectsWhereInput;
    orderBy?: Prisma.email_projectsOrderByWithAggregationInput | Prisma.email_projectsOrderByWithAggregationInput[];
    by: Prisma.Email_projectsScalarFieldEnum[] | Prisma.Email_projectsScalarFieldEnum;
    having?: Prisma.email_projectsScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: Email_projectsCountAggregateInputType | true;
    _min?: Email_projectsMinAggregateInputType;
    _max?: Email_projectsMaxAggregateInputType;
};
export type Email_projectsGroupByOutputType = {
    id: string;
    organization_id: string;
    name: string;
    settings: runtime.JsonValue | null;
    created_at: Date;
    active: boolean;
    _count: Email_projectsCountAggregateOutputType | null;
    _min: Email_projectsMinAggregateOutputType | null;
    _max: Email_projectsMaxAggregateOutputType | null;
};
type GetEmail_projectsGroupByPayload<T extends email_projectsGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<Email_projectsGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof Email_projectsGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], Email_projectsGroupByOutputType[P]> : Prisma.GetScalarType<T[P], Email_projectsGroupByOutputType[P]>;
}>>;
export type email_projectsWhereInput = {
    AND?: Prisma.email_projectsWhereInput | Prisma.email_projectsWhereInput[];
    OR?: Prisma.email_projectsWhereInput[];
    NOT?: Prisma.email_projectsWhereInput | Prisma.email_projectsWhereInput[];
    id?: Prisma.StringFilter<"email_projects"> | string;
    organization_id?: Prisma.StringFilter<"email_projects"> | string;
    name?: Prisma.StringFilter<"email_projects"> | string;
    settings?: Prisma.JsonNullableFilter<"email_projects">;
    created_at?: Prisma.DateTimeFilter<"email_projects"> | Date | string;
    active?: Prisma.BoolFilter<"email_projects"> | boolean;
    project_leads?: Prisma.Email_project_leadsListRelationFilter;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
    schedules?: Prisma.Email_projects_schedulesListRelationFilter;
    templates?: Prisma.Email_templatesListRelationFilter;
    webchats?: Prisma.WebchatsListRelationFilter;
};
export type email_projectsOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    settings?: Prisma.SortOrderInput | Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    active?: Prisma.SortOrder;
    project_leads?: Prisma.email_project_leadsOrderByRelationAggregateInput;
    organizations?: Prisma.organizationsOrderByWithRelationInput;
    schedules?: Prisma.email_projects_schedulesOrderByRelationAggregateInput;
    templates?: Prisma.email_templatesOrderByRelationAggregateInput;
    webchats?: Prisma.webchatsOrderByRelationAggregateInput;
    _relevance?: Prisma.email_projectsOrderByRelevanceInput;
};
export type email_projectsWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    AND?: Prisma.email_projectsWhereInput | Prisma.email_projectsWhereInput[];
    OR?: Prisma.email_projectsWhereInput[];
    NOT?: Prisma.email_projectsWhereInput | Prisma.email_projectsWhereInput[];
    organization_id?: Prisma.StringFilter<"email_projects"> | string;
    name?: Prisma.StringFilter<"email_projects"> | string;
    settings?: Prisma.JsonNullableFilter<"email_projects">;
    created_at?: Prisma.DateTimeFilter<"email_projects"> | Date | string;
    active?: Prisma.BoolFilter<"email_projects"> | boolean;
    project_leads?: Prisma.Email_project_leadsListRelationFilter;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
    schedules?: Prisma.Email_projects_schedulesListRelationFilter;
    templates?: Prisma.Email_templatesListRelationFilter;
    webchats?: Prisma.WebchatsListRelationFilter;
}, "id">;
export type email_projectsOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    settings?: Prisma.SortOrderInput | Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    active?: Prisma.SortOrder;
    _count?: Prisma.email_projectsCountOrderByAggregateInput;
    _max?: Prisma.email_projectsMaxOrderByAggregateInput;
    _min?: Prisma.email_projectsMinOrderByAggregateInput;
};
export type email_projectsScalarWhereWithAggregatesInput = {
    AND?: Prisma.email_projectsScalarWhereWithAggregatesInput | Prisma.email_projectsScalarWhereWithAggregatesInput[];
    OR?: Prisma.email_projectsScalarWhereWithAggregatesInput[];
    NOT?: Prisma.email_projectsScalarWhereWithAggregatesInput | Prisma.email_projectsScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"email_projects"> | string;
    organization_id?: Prisma.StringWithAggregatesFilter<"email_projects"> | string;
    name?: Prisma.StringWithAggregatesFilter<"email_projects"> | string;
    settings?: Prisma.JsonNullableWithAggregatesFilter<"email_projects">;
    created_at?: Prisma.DateTimeWithAggregatesFilter<"email_projects"> | Date | string;
    active?: Prisma.BoolWithAggregatesFilter<"email_projects"> | boolean;
};
export type email_projectsCreateInput = {
    id?: string;
    name: string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    active?: boolean;
    project_leads?: Prisma.email_project_leadsCreateNestedManyWithoutProjectsInput;
    organizations: Prisma.organizationsCreateNestedOneWithoutEmail_projectsInput;
    schedules?: Prisma.email_projects_schedulesCreateNestedManyWithoutProjectsInput;
    templates?: Prisma.email_templatesCreateNestedManyWithoutProjectsInput;
    webchats?: Prisma.webchatsCreateNestedManyWithoutEmail_projectsInput;
};
export type email_projectsUncheckedCreateInput = {
    id?: string;
    organization_id: string;
    name: string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    active?: boolean;
    project_leads?: Prisma.email_project_leadsUncheckedCreateNestedManyWithoutProjectsInput;
    schedules?: Prisma.email_projects_schedulesUncheckedCreateNestedManyWithoutProjectsInput;
    templates?: Prisma.email_templatesUncheckedCreateNestedManyWithoutProjectsInput;
    webchats?: Prisma.webchatsUncheckedCreateNestedManyWithoutEmail_projectsInput;
};
export type email_projectsUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    project_leads?: Prisma.email_project_leadsUpdateManyWithoutProjectsNestedInput;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutEmail_projectsNestedInput;
    schedules?: Prisma.email_projects_schedulesUpdateManyWithoutProjectsNestedInput;
    templates?: Prisma.email_templatesUpdateManyWithoutProjectsNestedInput;
    webchats?: Prisma.webchatsUpdateManyWithoutEmail_projectsNestedInput;
};
export type email_projectsUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    project_leads?: Prisma.email_project_leadsUncheckedUpdateManyWithoutProjectsNestedInput;
    schedules?: Prisma.email_projects_schedulesUncheckedUpdateManyWithoutProjectsNestedInput;
    templates?: Prisma.email_templatesUncheckedUpdateManyWithoutProjectsNestedInput;
    webchats?: Prisma.webchatsUncheckedUpdateManyWithoutEmail_projectsNestedInput;
};
export type email_projectsCreateManyInput = {
    id?: string;
    organization_id: string;
    name: string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    active?: boolean;
};
export type email_projectsUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
};
export type email_projectsUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
};
export type Email_projectsListRelationFilter = {
    every?: Prisma.email_projectsWhereInput;
    some?: Prisma.email_projectsWhereInput;
    none?: Prisma.email_projectsWhereInput;
};
export type email_projectsOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type email_projectsOrderByRelevanceInput = {
    fields: Prisma.email_projectsOrderByRelevanceFieldEnum | Prisma.email_projectsOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type email_projectsCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    settings?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    active?: Prisma.SortOrder;
};
export type email_projectsMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    active?: Prisma.SortOrder;
};
export type email_projectsMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    active?: Prisma.SortOrder;
};
export type Email_projectsScalarRelationFilter = {
    is?: Prisma.email_projectsWhereInput;
    isNot?: Prisma.email_projectsWhereInput;
};
export type Email_projectsNullableScalarRelationFilter = {
    is?: Prisma.email_projectsWhereInput | null;
    isNot?: Prisma.email_projectsWhereInput | null;
};
export type email_projectsCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.email_projectsCreateWithoutOrganizationsInput, Prisma.email_projectsUncheckedCreateWithoutOrganizationsInput> | Prisma.email_projectsCreateWithoutOrganizationsInput[] | Prisma.email_projectsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.email_projectsCreateOrConnectWithoutOrganizationsInput | Prisma.email_projectsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.email_projectsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.email_projectsWhereUniqueInput | Prisma.email_projectsWhereUniqueInput[];
};
export type email_projectsUncheckedCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.email_projectsCreateWithoutOrganizationsInput, Prisma.email_projectsUncheckedCreateWithoutOrganizationsInput> | Prisma.email_projectsCreateWithoutOrganizationsInput[] | Prisma.email_projectsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.email_projectsCreateOrConnectWithoutOrganizationsInput | Prisma.email_projectsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.email_projectsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.email_projectsWhereUniqueInput | Prisma.email_projectsWhereUniqueInput[];
};
export type email_projectsUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.email_projectsCreateWithoutOrganizationsInput, Prisma.email_projectsUncheckedCreateWithoutOrganizationsInput> | Prisma.email_projectsCreateWithoutOrganizationsInput[] | Prisma.email_projectsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.email_projectsCreateOrConnectWithoutOrganizationsInput | Prisma.email_projectsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.email_projectsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.email_projectsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.email_projectsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.email_projectsWhereUniqueInput | Prisma.email_projectsWhereUniqueInput[];
    disconnect?: Prisma.email_projectsWhereUniqueInput | Prisma.email_projectsWhereUniqueInput[];
    delete?: Prisma.email_projectsWhereUniqueInput | Prisma.email_projectsWhereUniqueInput[];
    connect?: Prisma.email_projectsWhereUniqueInput | Prisma.email_projectsWhereUniqueInput[];
    update?: Prisma.email_projectsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.email_projectsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.email_projectsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.email_projectsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.email_projectsScalarWhereInput | Prisma.email_projectsScalarWhereInput[];
};
export type email_projectsUncheckedUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.email_projectsCreateWithoutOrganizationsInput, Prisma.email_projectsUncheckedCreateWithoutOrganizationsInput> | Prisma.email_projectsCreateWithoutOrganizationsInput[] | Prisma.email_projectsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.email_projectsCreateOrConnectWithoutOrganizationsInput | Prisma.email_projectsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.email_projectsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.email_projectsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.email_projectsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.email_projectsWhereUniqueInput | Prisma.email_projectsWhereUniqueInput[];
    disconnect?: Prisma.email_projectsWhereUniqueInput | Prisma.email_projectsWhereUniqueInput[];
    delete?: Prisma.email_projectsWhereUniqueInput | Prisma.email_projectsWhereUniqueInput[];
    connect?: Prisma.email_projectsWhereUniqueInput | Prisma.email_projectsWhereUniqueInput[];
    update?: Prisma.email_projectsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.email_projectsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.email_projectsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.email_projectsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.email_projectsScalarWhereInput | Prisma.email_projectsScalarWhereInput[];
};
export type email_projectsCreateNestedOneWithoutTemplatesInput = {
    create?: Prisma.XOR<Prisma.email_projectsCreateWithoutTemplatesInput, Prisma.email_projectsUncheckedCreateWithoutTemplatesInput>;
    connectOrCreate?: Prisma.email_projectsCreateOrConnectWithoutTemplatesInput;
    connect?: Prisma.email_projectsWhereUniqueInput;
};
export type email_projectsUpdateOneRequiredWithoutTemplatesNestedInput = {
    create?: Prisma.XOR<Prisma.email_projectsCreateWithoutTemplatesInput, Prisma.email_projectsUncheckedCreateWithoutTemplatesInput>;
    connectOrCreate?: Prisma.email_projectsCreateOrConnectWithoutTemplatesInput;
    upsert?: Prisma.email_projectsUpsertWithoutTemplatesInput;
    connect?: Prisma.email_projectsWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.email_projectsUpdateToOneWithWhereWithoutTemplatesInput, Prisma.email_projectsUpdateWithoutTemplatesInput>, Prisma.email_projectsUncheckedUpdateWithoutTemplatesInput>;
};
export type email_projectsCreateNestedOneWithoutProject_leadsInput = {
    create?: Prisma.XOR<Prisma.email_projectsCreateWithoutProject_leadsInput, Prisma.email_projectsUncheckedCreateWithoutProject_leadsInput>;
    connectOrCreate?: Prisma.email_projectsCreateOrConnectWithoutProject_leadsInput;
    connect?: Prisma.email_projectsWhereUniqueInput;
};
export type email_projectsUpdateOneRequiredWithoutProject_leadsNestedInput = {
    create?: Prisma.XOR<Prisma.email_projectsCreateWithoutProject_leadsInput, Prisma.email_projectsUncheckedCreateWithoutProject_leadsInput>;
    connectOrCreate?: Prisma.email_projectsCreateOrConnectWithoutProject_leadsInput;
    upsert?: Prisma.email_projectsUpsertWithoutProject_leadsInput;
    connect?: Prisma.email_projectsWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.email_projectsUpdateToOneWithWhereWithoutProject_leadsInput, Prisma.email_projectsUpdateWithoutProject_leadsInput>, Prisma.email_projectsUncheckedUpdateWithoutProject_leadsInput>;
};
export type email_projectsCreateNestedOneWithoutSchedulesInput = {
    create?: Prisma.XOR<Prisma.email_projectsCreateWithoutSchedulesInput, Prisma.email_projectsUncheckedCreateWithoutSchedulesInput>;
    connectOrCreate?: Prisma.email_projectsCreateOrConnectWithoutSchedulesInput;
    connect?: Prisma.email_projectsWhereUniqueInput;
};
export type email_projectsUpdateOneRequiredWithoutSchedulesNestedInput = {
    create?: Prisma.XOR<Prisma.email_projectsCreateWithoutSchedulesInput, Prisma.email_projectsUncheckedCreateWithoutSchedulesInput>;
    connectOrCreate?: Prisma.email_projectsCreateOrConnectWithoutSchedulesInput;
    upsert?: Prisma.email_projectsUpsertWithoutSchedulesInput;
    connect?: Prisma.email_projectsWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.email_projectsUpdateToOneWithWhereWithoutSchedulesInput, Prisma.email_projectsUpdateWithoutSchedulesInput>, Prisma.email_projectsUncheckedUpdateWithoutSchedulesInput>;
};
export type email_projectsCreateNestedOneWithoutWebchatsInput = {
    create?: Prisma.XOR<Prisma.email_projectsCreateWithoutWebchatsInput, Prisma.email_projectsUncheckedCreateWithoutWebchatsInput>;
    connectOrCreate?: Prisma.email_projectsCreateOrConnectWithoutWebchatsInput;
    connect?: Prisma.email_projectsWhereUniqueInput;
};
export type email_projectsUpdateOneWithoutWebchatsNestedInput = {
    create?: Prisma.XOR<Prisma.email_projectsCreateWithoutWebchatsInput, Prisma.email_projectsUncheckedCreateWithoutWebchatsInput>;
    connectOrCreate?: Prisma.email_projectsCreateOrConnectWithoutWebchatsInput;
    upsert?: Prisma.email_projectsUpsertWithoutWebchatsInput;
    disconnect?: Prisma.email_projectsWhereInput | boolean;
    delete?: Prisma.email_projectsWhereInput | boolean;
    connect?: Prisma.email_projectsWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.email_projectsUpdateToOneWithWhereWithoutWebchatsInput, Prisma.email_projectsUpdateWithoutWebchatsInput>, Prisma.email_projectsUncheckedUpdateWithoutWebchatsInput>;
};
export type email_projectsCreateWithoutOrganizationsInput = {
    id?: string;
    name: string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    active?: boolean;
    project_leads?: Prisma.email_project_leadsCreateNestedManyWithoutProjectsInput;
    schedules?: Prisma.email_projects_schedulesCreateNestedManyWithoutProjectsInput;
    templates?: Prisma.email_templatesCreateNestedManyWithoutProjectsInput;
    webchats?: Prisma.webchatsCreateNestedManyWithoutEmail_projectsInput;
};
export type email_projectsUncheckedCreateWithoutOrganizationsInput = {
    id?: string;
    name: string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    active?: boolean;
    project_leads?: Prisma.email_project_leadsUncheckedCreateNestedManyWithoutProjectsInput;
    schedules?: Prisma.email_projects_schedulesUncheckedCreateNestedManyWithoutProjectsInput;
    templates?: Prisma.email_templatesUncheckedCreateNestedManyWithoutProjectsInput;
    webchats?: Prisma.webchatsUncheckedCreateNestedManyWithoutEmail_projectsInput;
};
export type email_projectsCreateOrConnectWithoutOrganizationsInput = {
    where: Prisma.email_projectsWhereUniqueInput;
    create: Prisma.XOR<Prisma.email_projectsCreateWithoutOrganizationsInput, Prisma.email_projectsUncheckedCreateWithoutOrganizationsInput>;
};
export type email_projectsCreateManyOrganizationsInputEnvelope = {
    data: Prisma.email_projectsCreateManyOrganizationsInput | Prisma.email_projectsCreateManyOrganizationsInput[];
    skipDuplicates?: boolean;
};
export type email_projectsUpsertWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.email_projectsWhereUniqueInput;
    update: Prisma.XOR<Prisma.email_projectsUpdateWithoutOrganizationsInput, Prisma.email_projectsUncheckedUpdateWithoutOrganizationsInput>;
    create: Prisma.XOR<Prisma.email_projectsCreateWithoutOrganizationsInput, Prisma.email_projectsUncheckedCreateWithoutOrganizationsInput>;
};
export type email_projectsUpdateWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.email_projectsWhereUniqueInput;
    data: Prisma.XOR<Prisma.email_projectsUpdateWithoutOrganizationsInput, Prisma.email_projectsUncheckedUpdateWithoutOrganizationsInput>;
};
export type email_projectsUpdateManyWithWhereWithoutOrganizationsInput = {
    where: Prisma.email_projectsScalarWhereInput;
    data: Prisma.XOR<Prisma.email_projectsUpdateManyMutationInput, Prisma.email_projectsUncheckedUpdateManyWithoutOrganizationsInput>;
};
export type email_projectsScalarWhereInput = {
    AND?: Prisma.email_projectsScalarWhereInput | Prisma.email_projectsScalarWhereInput[];
    OR?: Prisma.email_projectsScalarWhereInput[];
    NOT?: Prisma.email_projectsScalarWhereInput | Prisma.email_projectsScalarWhereInput[];
    id?: Prisma.StringFilter<"email_projects"> | string;
    organization_id?: Prisma.StringFilter<"email_projects"> | string;
    name?: Prisma.StringFilter<"email_projects"> | string;
    settings?: Prisma.JsonNullableFilter<"email_projects">;
    created_at?: Prisma.DateTimeFilter<"email_projects"> | Date | string;
    active?: Prisma.BoolFilter<"email_projects"> | boolean;
};
export type email_projectsCreateWithoutTemplatesInput = {
    id?: string;
    name: string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    active?: boolean;
    project_leads?: Prisma.email_project_leadsCreateNestedManyWithoutProjectsInput;
    organizations: Prisma.organizationsCreateNestedOneWithoutEmail_projectsInput;
    schedules?: Prisma.email_projects_schedulesCreateNestedManyWithoutProjectsInput;
    webchats?: Prisma.webchatsCreateNestedManyWithoutEmail_projectsInput;
};
export type email_projectsUncheckedCreateWithoutTemplatesInput = {
    id?: string;
    organization_id: string;
    name: string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    active?: boolean;
    project_leads?: Prisma.email_project_leadsUncheckedCreateNestedManyWithoutProjectsInput;
    schedules?: Prisma.email_projects_schedulesUncheckedCreateNestedManyWithoutProjectsInput;
    webchats?: Prisma.webchatsUncheckedCreateNestedManyWithoutEmail_projectsInput;
};
export type email_projectsCreateOrConnectWithoutTemplatesInput = {
    where: Prisma.email_projectsWhereUniqueInput;
    create: Prisma.XOR<Prisma.email_projectsCreateWithoutTemplatesInput, Prisma.email_projectsUncheckedCreateWithoutTemplatesInput>;
};
export type email_projectsUpsertWithoutTemplatesInput = {
    update: Prisma.XOR<Prisma.email_projectsUpdateWithoutTemplatesInput, Prisma.email_projectsUncheckedUpdateWithoutTemplatesInput>;
    create: Prisma.XOR<Prisma.email_projectsCreateWithoutTemplatesInput, Prisma.email_projectsUncheckedCreateWithoutTemplatesInput>;
    where?: Prisma.email_projectsWhereInput;
};
export type email_projectsUpdateToOneWithWhereWithoutTemplatesInput = {
    where?: Prisma.email_projectsWhereInput;
    data: Prisma.XOR<Prisma.email_projectsUpdateWithoutTemplatesInput, Prisma.email_projectsUncheckedUpdateWithoutTemplatesInput>;
};
export type email_projectsUpdateWithoutTemplatesInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    project_leads?: Prisma.email_project_leadsUpdateManyWithoutProjectsNestedInput;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutEmail_projectsNestedInput;
    schedules?: Prisma.email_projects_schedulesUpdateManyWithoutProjectsNestedInput;
    webchats?: Prisma.webchatsUpdateManyWithoutEmail_projectsNestedInput;
};
export type email_projectsUncheckedUpdateWithoutTemplatesInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    project_leads?: Prisma.email_project_leadsUncheckedUpdateManyWithoutProjectsNestedInput;
    schedules?: Prisma.email_projects_schedulesUncheckedUpdateManyWithoutProjectsNestedInput;
    webchats?: Prisma.webchatsUncheckedUpdateManyWithoutEmail_projectsNestedInput;
};
export type email_projectsCreateWithoutProject_leadsInput = {
    id?: string;
    name: string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    active?: boolean;
    organizations: Prisma.organizationsCreateNestedOneWithoutEmail_projectsInput;
    schedules?: Prisma.email_projects_schedulesCreateNestedManyWithoutProjectsInput;
    templates?: Prisma.email_templatesCreateNestedManyWithoutProjectsInput;
    webchats?: Prisma.webchatsCreateNestedManyWithoutEmail_projectsInput;
};
export type email_projectsUncheckedCreateWithoutProject_leadsInput = {
    id?: string;
    organization_id: string;
    name: string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    active?: boolean;
    schedules?: Prisma.email_projects_schedulesUncheckedCreateNestedManyWithoutProjectsInput;
    templates?: Prisma.email_templatesUncheckedCreateNestedManyWithoutProjectsInput;
    webchats?: Prisma.webchatsUncheckedCreateNestedManyWithoutEmail_projectsInput;
};
export type email_projectsCreateOrConnectWithoutProject_leadsInput = {
    where: Prisma.email_projectsWhereUniqueInput;
    create: Prisma.XOR<Prisma.email_projectsCreateWithoutProject_leadsInput, Prisma.email_projectsUncheckedCreateWithoutProject_leadsInput>;
};
export type email_projectsUpsertWithoutProject_leadsInput = {
    update: Prisma.XOR<Prisma.email_projectsUpdateWithoutProject_leadsInput, Prisma.email_projectsUncheckedUpdateWithoutProject_leadsInput>;
    create: Prisma.XOR<Prisma.email_projectsCreateWithoutProject_leadsInput, Prisma.email_projectsUncheckedCreateWithoutProject_leadsInput>;
    where?: Prisma.email_projectsWhereInput;
};
export type email_projectsUpdateToOneWithWhereWithoutProject_leadsInput = {
    where?: Prisma.email_projectsWhereInput;
    data: Prisma.XOR<Prisma.email_projectsUpdateWithoutProject_leadsInput, Prisma.email_projectsUncheckedUpdateWithoutProject_leadsInput>;
};
export type email_projectsUpdateWithoutProject_leadsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutEmail_projectsNestedInput;
    schedules?: Prisma.email_projects_schedulesUpdateManyWithoutProjectsNestedInput;
    templates?: Prisma.email_templatesUpdateManyWithoutProjectsNestedInput;
    webchats?: Prisma.webchatsUpdateManyWithoutEmail_projectsNestedInput;
};
export type email_projectsUncheckedUpdateWithoutProject_leadsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    schedules?: Prisma.email_projects_schedulesUncheckedUpdateManyWithoutProjectsNestedInput;
    templates?: Prisma.email_templatesUncheckedUpdateManyWithoutProjectsNestedInput;
    webchats?: Prisma.webchatsUncheckedUpdateManyWithoutEmail_projectsNestedInput;
};
export type email_projectsCreateWithoutSchedulesInput = {
    id?: string;
    name: string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    active?: boolean;
    project_leads?: Prisma.email_project_leadsCreateNestedManyWithoutProjectsInput;
    organizations: Prisma.organizationsCreateNestedOneWithoutEmail_projectsInput;
    templates?: Prisma.email_templatesCreateNestedManyWithoutProjectsInput;
    webchats?: Prisma.webchatsCreateNestedManyWithoutEmail_projectsInput;
};
export type email_projectsUncheckedCreateWithoutSchedulesInput = {
    id?: string;
    organization_id: string;
    name: string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    active?: boolean;
    project_leads?: Prisma.email_project_leadsUncheckedCreateNestedManyWithoutProjectsInput;
    templates?: Prisma.email_templatesUncheckedCreateNestedManyWithoutProjectsInput;
    webchats?: Prisma.webchatsUncheckedCreateNestedManyWithoutEmail_projectsInput;
};
export type email_projectsCreateOrConnectWithoutSchedulesInput = {
    where: Prisma.email_projectsWhereUniqueInput;
    create: Prisma.XOR<Prisma.email_projectsCreateWithoutSchedulesInput, Prisma.email_projectsUncheckedCreateWithoutSchedulesInput>;
};
export type email_projectsUpsertWithoutSchedulesInput = {
    update: Prisma.XOR<Prisma.email_projectsUpdateWithoutSchedulesInput, Prisma.email_projectsUncheckedUpdateWithoutSchedulesInput>;
    create: Prisma.XOR<Prisma.email_projectsCreateWithoutSchedulesInput, Prisma.email_projectsUncheckedCreateWithoutSchedulesInput>;
    where?: Prisma.email_projectsWhereInput;
};
export type email_projectsUpdateToOneWithWhereWithoutSchedulesInput = {
    where?: Prisma.email_projectsWhereInput;
    data: Prisma.XOR<Prisma.email_projectsUpdateWithoutSchedulesInput, Prisma.email_projectsUncheckedUpdateWithoutSchedulesInput>;
};
export type email_projectsUpdateWithoutSchedulesInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    project_leads?: Prisma.email_project_leadsUpdateManyWithoutProjectsNestedInput;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutEmail_projectsNestedInput;
    templates?: Prisma.email_templatesUpdateManyWithoutProjectsNestedInput;
    webchats?: Prisma.webchatsUpdateManyWithoutEmail_projectsNestedInput;
};
export type email_projectsUncheckedUpdateWithoutSchedulesInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    project_leads?: Prisma.email_project_leadsUncheckedUpdateManyWithoutProjectsNestedInput;
    templates?: Prisma.email_templatesUncheckedUpdateManyWithoutProjectsNestedInput;
    webchats?: Prisma.webchatsUncheckedUpdateManyWithoutEmail_projectsNestedInput;
};
export type email_projectsCreateWithoutWebchatsInput = {
    id?: string;
    name: string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    active?: boolean;
    project_leads?: Prisma.email_project_leadsCreateNestedManyWithoutProjectsInput;
    organizations: Prisma.organizationsCreateNestedOneWithoutEmail_projectsInput;
    schedules?: Prisma.email_projects_schedulesCreateNestedManyWithoutProjectsInput;
    templates?: Prisma.email_templatesCreateNestedManyWithoutProjectsInput;
};
export type email_projectsUncheckedCreateWithoutWebchatsInput = {
    id?: string;
    organization_id: string;
    name: string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    active?: boolean;
    project_leads?: Prisma.email_project_leadsUncheckedCreateNestedManyWithoutProjectsInput;
    schedules?: Prisma.email_projects_schedulesUncheckedCreateNestedManyWithoutProjectsInput;
    templates?: Prisma.email_templatesUncheckedCreateNestedManyWithoutProjectsInput;
};
export type email_projectsCreateOrConnectWithoutWebchatsInput = {
    where: Prisma.email_projectsWhereUniqueInput;
    create: Prisma.XOR<Prisma.email_projectsCreateWithoutWebchatsInput, Prisma.email_projectsUncheckedCreateWithoutWebchatsInput>;
};
export type email_projectsUpsertWithoutWebchatsInput = {
    update: Prisma.XOR<Prisma.email_projectsUpdateWithoutWebchatsInput, Prisma.email_projectsUncheckedUpdateWithoutWebchatsInput>;
    create: Prisma.XOR<Prisma.email_projectsCreateWithoutWebchatsInput, Prisma.email_projectsUncheckedCreateWithoutWebchatsInput>;
    where?: Prisma.email_projectsWhereInput;
};
export type email_projectsUpdateToOneWithWhereWithoutWebchatsInput = {
    where?: Prisma.email_projectsWhereInput;
    data: Prisma.XOR<Prisma.email_projectsUpdateWithoutWebchatsInput, Prisma.email_projectsUncheckedUpdateWithoutWebchatsInput>;
};
export type email_projectsUpdateWithoutWebchatsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    project_leads?: Prisma.email_project_leadsUpdateManyWithoutProjectsNestedInput;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutEmail_projectsNestedInput;
    schedules?: Prisma.email_projects_schedulesUpdateManyWithoutProjectsNestedInput;
    templates?: Prisma.email_templatesUpdateManyWithoutProjectsNestedInput;
};
export type email_projectsUncheckedUpdateWithoutWebchatsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    project_leads?: Prisma.email_project_leadsUncheckedUpdateManyWithoutProjectsNestedInput;
    schedules?: Prisma.email_projects_schedulesUncheckedUpdateManyWithoutProjectsNestedInput;
    templates?: Prisma.email_templatesUncheckedUpdateManyWithoutProjectsNestedInput;
};
export type email_projectsCreateManyOrganizationsInput = {
    id?: string;
    name: string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    active?: boolean;
};
export type email_projectsUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    project_leads?: Prisma.email_project_leadsUpdateManyWithoutProjectsNestedInput;
    schedules?: Prisma.email_projects_schedulesUpdateManyWithoutProjectsNestedInput;
    templates?: Prisma.email_templatesUpdateManyWithoutProjectsNestedInput;
    webchats?: Prisma.webchatsUpdateManyWithoutEmail_projectsNestedInput;
};
export type email_projectsUncheckedUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    project_leads?: Prisma.email_project_leadsUncheckedUpdateManyWithoutProjectsNestedInput;
    schedules?: Prisma.email_projects_schedulesUncheckedUpdateManyWithoutProjectsNestedInput;
    templates?: Prisma.email_templatesUncheckedUpdateManyWithoutProjectsNestedInput;
    webchats?: Prisma.webchatsUncheckedUpdateManyWithoutEmail_projectsNestedInput;
};
export type email_projectsUncheckedUpdateManyWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
};
export type Email_projectsCountOutputType = {
    project_leads: number;
    schedules: number;
    templates: number;
    webchats: number;
};
export type Email_projectsCountOutputTypeSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    project_leads?: boolean | Email_projectsCountOutputTypeCountProject_leadsArgs;
    schedules?: boolean | Email_projectsCountOutputTypeCountSchedulesArgs;
    templates?: boolean | Email_projectsCountOutputTypeCountTemplatesArgs;
    webchats?: boolean | Email_projectsCountOutputTypeCountWebchatsArgs;
};
export type Email_projectsCountOutputTypeDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.Email_projectsCountOutputTypeSelect<ExtArgs> | null;
};
export type Email_projectsCountOutputTypeCountProject_leadsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_project_leadsWhereInput;
};
export type Email_projectsCountOutputTypeCountSchedulesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_projects_schedulesWhereInput;
};
export type Email_projectsCountOutputTypeCountTemplatesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_templatesWhereInput;
};
export type Email_projectsCountOutputTypeCountWebchatsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.webchatsWhereInput;
};
export type email_projectsSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    organization_id?: boolean;
    name?: boolean;
    settings?: boolean;
    created_at?: boolean;
    active?: boolean;
    project_leads?: boolean | Prisma.email_projects$project_leadsArgs<ExtArgs>;
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
    schedules?: boolean | Prisma.email_projects$schedulesArgs<ExtArgs>;
    templates?: boolean | Prisma.email_projects$templatesArgs<ExtArgs>;
    webchats?: boolean | Prisma.email_projects$webchatsArgs<ExtArgs>;
    _count?: boolean | Prisma.Email_projectsCountOutputTypeDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["email_projects"]>;
export type email_projectsSelectScalar = {
    id?: boolean;
    organization_id?: boolean;
    name?: boolean;
    settings?: boolean;
    created_at?: boolean;
    active?: boolean;
};
export type email_projectsOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "organization_id" | "name" | "settings" | "created_at" | "active", ExtArgs["result"]["email_projects"]>;
export type email_projectsInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    project_leads?: boolean | Prisma.email_projects$project_leadsArgs<ExtArgs>;
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
    schedules?: boolean | Prisma.email_projects$schedulesArgs<ExtArgs>;
    templates?: boolean | Prisma.email_projects$templatesArgs<ExtArgs>;
    webchats?: boolean | Prisma.email_projects$webchatsArgs<ExtArgs>;
    _count?: boolean | Prisma.Email_projectsCountOutputTypeDefaultArgs<ExtArgs>;
};
export type $email_projectsPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "email_projects";
    objects: {
        project_leads: Prisma.$email_project_leadsPayload<ExtArgs>[];
        organizations: Prisma.$organizationsPayload<ExtArgs>;
        schedules: Prisma.$email_projects_schedulesPayload<ExtArgs>[];
        templates: Prisma.$email_templatesPayload<ExtArgs>[];
        webchats: Prisma.$webchatsPayload<ExtArgs>[];
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        organization_id: string;
        name: string;
        settings: runtime.JsonValue | null;
        created_at: Date;
        active: boolean;
    }, ExtArgs["result"]["email_projects"]>;
    composites: {};
};
export type email_projectsGetPayload<S extends boolean | null | undefined | email_projectsDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$email_projectsPayload, S>;
export type email_projectsCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<email_projectsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: Email_projectsCountAggregateInputType | true;
};
export interface email_projectsDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['email_projects'];
        meta: {
            name: 'email_projects';
        };
    };
    findUnique<T extends email_projectsFindUniqueArgs>(args: Prisma.SelectSubset<T, email_projectsFindUniqueArgs<ExtArgs>>): Prisma.Prisma__email_projectsClient<runtime.Types.Result.GetResult<Prisma.$email_projectsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends email_projectsFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, email_projectsFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__email_projectsClient<runtime.Types.Result.GetResult<Prisma.$email_projectsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends email_projectsFindFirstArgs>(args?: Prisma.SelectSubset<T, email_projectsFindFirstArgs<ExtArgs>>): Prisma.Prisma__email_projectsClient<runtime.Types.Result.GetResult<Prisma.$email_projectsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends email_projectsFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, email_projectsFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__email_projectsClient<runtime.Types.Result.GetResult<Prisma.$email_projectsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends email_projectsFindManyArgs>(args?: Prisma.SelectSubset<T, email_projectsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$email_projectsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends email_projectsCreateArgs>(args: Prisma.SelectSubset<T, email_projectsCreateArgs<ExtArgs>>): Prisma.Prisma__email_projectsClient<runtime.Types.Result.GetResult<Prisma.$email_projectsPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends email_projectsCreateManyArgs>(args?: Prisma.SelectSubset<T, email_projectsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends email_projectsDeleteArgs>(args: Prisma.SelectSubset<T, email_projectsDeleteArgs<ExtArgs>>): Prisma.Prisma__email_projectsClient<runtime.Types.Result.GetResult<Prisma.$email_projectsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends email_projectsUpdateArgs>(args: Prisma.SelectSubset<T, email_projectsUpdateArgs<ExtArgs>>): Prisma.Prisma__email_projectsClient<runtime.Types.Result.GetResult<Prisma.$email_projectsPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends email_projectsDeleteManyArgs>(args?: Prisma.SelectSubset<T, email_projectsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends email_projectsUpdateManyArgs>(args: Prisma.SelectSubset<T, email_projectsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends email_projectsUpsertArgs>(args: Prisma.SelectSubset<T, email_projectsUpsertArgs<ExtArgs>>): Prisma.Prisma__email_projectsClient<runtime.Types.Result.GetResult<Prisma.$email_projectsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends email_projectsCountArgs>(args?: Prisma.Subset<T, email_projectsCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], Email_projectsCountAggregateOutputType> : number>;
    aggregate<T extends Email_projectsAggregateArgs>(args: Prisma.Subset<T, Email_projectsAggregateArgs>): Prisma.PrismaPromise<GetEmail_projectsAggregateType<T>>;
    groupBy<T extends email_projectsGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: email_projectsGroupByArgs['orderBy'];
    } : {
        orderBy?: email_projectsGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, email_projectsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetEmail_projectsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: email_projectsFieldRefs;
}
export interface Prisma__email_projectsClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    project_leads<T extends Prisma.email_projects$project_leadsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.email_projects$project_leadsArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$email_project_leadsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    organizations<T extends Prisma.organizationsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.organizationsDefaultArgs<ExtArgs>>): Prisma.Prisma__organizationsClient<runtime.Types.Result.GetResult<Prisma.$organizationsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    schedules<T extends Prisma.email_projects$schedulesArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.email_projects$schedulesArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$email_projects_schedulesPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    templates<T extends Prisma.email_projects$templatesArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.email_projects$templatesArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$email_templatesPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    webchats<T extends Prisma.email_projects$webchatsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.email_projects$webchatsArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$webchatsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface email_projectsFieldRefs {
    readonly id: Prisma.FieldRef<"email_projects", 'String'>;
    readonly organization_id: Prisma.FieldRef<"email_projects", 'String'>;
    readonly name: Prisma.FieldRef<"email_projects", 'String'>;
    readonly settings: Prisma.FieldRef<"email_projects", 'Json'>;
    readonly created_at: Prisma.FieldRef<"email_projects", 'DateTime'>;
    readonly active: Prisma.FieldRef<"email_projects", 'Boolean'>;
}
export type email_projectsFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_projectsSelect<ExtArgs> | null;
    omit?: Prisma.email_projectsOmit<ExtArgs> | null;
    include?: Prisma.email_projectsInclude<ExtArgs> | null;
    where: Prisma.email_projectsWhereUniqueInput;
};
export type email_projectsFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_projectsSelect<ExtArgs> | null;
    omit?: Prisma.email_projectsOmit<ExtArgs> | null;
    include?: Prisma.email_projectsInclude<ExtArgs> | null;
    where: Prisma.email_projectsWhereUniqueInput;
};
export type email_projectsFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_projectsSelect<ExtArgs> | null;
    omit?: Prisma.email_projectsOmit<ExtArgs> | null;
    include?: Prisma.email_projectsInclude<ExtArgs> | null;
    where?: Prisma.email_projectsWhereInput;
    orderBy?: Prisma.email_projectsOrderByWithRelationInput | Prisma.email_projectsOrderByWithRelationInput[];
    cursor?: Prisma.email_projectsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Email_projectsScalarFieldEnum | Prisma.Email_projectsScalarFieldEnum[];
};
export type email_projectsFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_projectsSelect<ExtArgs> | null;
    omit?: Prisma.email_projectsOmit<ExtArgs> | null;
    include?: Prisma.email_projectsInclude<ExtArgs> | null;
    where?: Prisma.email_projectsWhereInput;
    orderBy?: Prisma.email_projectsOrderByWithRelationInput | Prisma.email_projectsOrderByWithRelationInput[];
    cursor?: Prisma.email_projectsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Email_projectsScalarFieldEnum | Prisma.Email_projectsScalarFieldEnum[];
};
export type email_projectsFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_projectsSelect<ExtArgs> | null;
    omit?: Prisma.email_projectsOmit<ExtArgs> | null;
    include?: Prisma.email_projectsInclude<ExtArgs> | null;
    where?: Prisma.email_projectsWhereInput;
    orderBy?: Prisma.email_projectsOrderByWithRelationInput | Prisma.email_projectsOrderByWithRelationInput[];
    cursor?: Prisma.email_projectsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Email_projectsScalarFieldEnum | Prisma.Email_projectsScalarFieldEnum[];
};
export type email_projectsCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_projectsSelect<ExtArgs> | null;
    omit?: Prisma.email_projectsOmit<ExtArgs> | null;
    include?: Prisma.email_projectsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.email_projectsCreateInput, Prisma.email_projectsUncheckedCreateInput>;
};
export type email_projectsCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.email_projectsCreateManyInput | Prisma.email_projectsCreateManyInput[];
    skipDuplicates?: boolean;
};
export type email_projectsUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_projectsSelect<ExtArgs> | null;
    omit?: Prisma.email_projectsOmit<ExtArgs> | null;
    include?: Prisma.email_projectsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.email_projectsUpdateInput, Prisma.email_projectsUncheckedUpdateInput>;
    where: Prisma.email_projectsWhereUniqueInput;
};
export type email_projectsUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.email_projectsUpdateManyMutationInput, Prisma.email_projectsUncheckedUpdateManyInput>;
    where?: Prisma.email_projectsWhereInput;
    limit?: number;
};
export type email_projectsUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_projectsSelect<ExtArgs> | null;
    omit?: Prisma.email_projectsOmit<ExtArgs> | null;
    include?: Prisma.email_projectsInclude<ExtArgs> | null;
    where: Prisma.email_projectsWhereUniqueInput;
    create: Prisma.XOR<Prisma.email_projectsCreateInput, Prisma.email_projectsUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.email_projectsUpdateInput, Prisma.email_projectsUncheckedUpdateInput>;
};
export type email_projectsDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_projectsSelect<ExtArgs> | null;
    omit?: Prisma.email_projectsOmit<ExtArgs> | null;
    include?: Prisma.email_projectsInclude<ExtArgs> | null;
    where: Prisma.email_projectsWhereUniqueInput;
};
export type email_projectsDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_projectsWhereInput;
    limit?: number;
};
export type email_projects$project_leadsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type email_projects$schedulesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_projects_schedulesSelect<ExtArgs> | null;
    omit?: Prisma.email_projects_schedulesOmit<ExtArgs> | null;
    include?: Prisma.email_projects_schedulesInclude<ExtArgs> | null;
    where?: Prisma.email_projects_schedulesWhereInput;
    orderBy?: Prisma.email_projects_schedulesOrderByWithRelationInput | Prisma.email_projects_schedulesOrderByWithRelationInput[];
    cursor?: Prisma.email_projects_schedulesWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Email_projects_schedulesScalarFieldEnum | Prisma.Email_projects_schedulesScalarFieldEnum[];
};
export type email_projects$templatesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_templatesSelect<ExtArgs> | null;
    omit?: Prisma.email_templatesOmit<ExtArgs> | null;
    include?: Prisma.email_templatesInclude<ExtArgs> | null;
    where?: Prisma.email_templatesWhereInput;
    orderBy?: Prisma.email_templatesOrderByWithRelationInput | Prisma.email_templatesOrderByWithRelationInput[];
    cursor?: Prisma.email_templatesWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Email_templatesScalarFieldEnum | Prisma.Email_templatesScalarFieldEnum[];
};
export type email_projects$webchatsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchatsSelect<ExtArgs> | null;
    omit?: Prisma.webchatsOmit<ExtArgs> | null;
    include?: Prisma.webchatsInclude<ExtArgs> | null;
    where?: Prisma.webchatsWhereInput;
    orderBy?: Prisma.webchatsOrderByWithRelationInput | Prisma.webchatsOrderByWithRelationInput[];
    cursor?: Prisma.webchatsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.WebchatsScalarFieldEnum | Prisma.WebchatsScalarFieldEnum[];
};
export type email_projectsDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_projectsSelect<ExtArgs> | null;
    omit?: Prisma.email_projectsOmit<ExtArgs> | null;
    include?: Prisma.email_projectsInclude<ExtArgs> | null;
};
export {};
