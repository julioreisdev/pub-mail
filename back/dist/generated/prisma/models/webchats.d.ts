import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type webchatsModel = runtime.Types.Result.DefaultSelection<Prisma.$webchatsPayload>;
export type AggregateWebchats = {
    _count: WebchatsCountAggregateOutputType | null;
    _min: WebchatsMinAggregateOutputType | null;
    _max: WebchatsMaxAggregateOutputType | null;
};
export type WebchatsMinAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    agent_id: string | null;
    name: string | null;
    slug: string | null;
    domain: string | null;
    email_project_id: string | null;
    active: boolean | null;
    header_scripts: string | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type WebchatsMaxAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    agent_id: string | null;
    name: string | null;
    slug: string | null;
    domain: string | null;
    email_project_id: string | null;
    active: boolean | null;
    header_scripts: string | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type WebchatsCountAggregateOutputType = {
    id: number;
    organization_id: number;
    agent_id: number;
    name: number;
    slug: number;
    domain: number;
    email_project_id: number;
    active: number;
    settings: number;
    header_scripts: number;
    ads_config: number;
    created_at: number;
    updated_at: number;
    _all: number;
};
export type WebchatsMinAggregateInputType = {
    id?: true;
    organization_id?: true;
    agent_id?: true;
    name?: true;
    slug?: true;
    domain?: true;
    email_project_id?: true;
    active?: true;
    header_scripts?: true;
    created_at?: true;
    updated_at?: true;
};
export type WebchatsMaxAggregateInputType = {
    id?: true;
    organization_id?: true;
    agent_id?: true;
    name?: true;
    slug?: true;
    domain?: true;
    email_project_id?: true;
    active?: true;
    header_scripts?: true;
    created_at?: true;
    updated_at?: true;
};
export type WebchatsCountAggregateInputType = {
    id?: true;
    organization_id?: true;
    agent_id?: true;
    name?: true;
    slug?: true;
    domain?: true;
    email_project_id?: true;
    active?: true;
    settings?: true;
    header_scripts?: true;
    ads_config?: true;
    created_at?: true;
    updated_at?: true;
    _all?: true;
};
export type WebchatsAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.webchatsWhereInput;
    orderBy?: Prisma.webchatsOrderByWithRelationInput | Prisma.webchatsOrderByWithRelationInput[];
    cursor?: Prisma.webchatsWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | WebchatsCountAggregateInputType;
    _min?: WebchatsMinAggregateInputType;
    _max?: WebchatsMaxAggregateInputType;
};
export type GetWebchatsAggregateType<T extends WebchatsAggregateArgs> = {
    [P in keyof T & keyof AggregateWebchats]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateWebchats[P]> : Prisma.GetScalarType<T[P], AggregateWebchats[P]>;
};
export type webchatsGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.webchatsWhereInput;
    orderBy?: Prisma.webchatsOrderByWithAggregationInput | Prisma.webchatsOrderByWithAggregationInput[];
    by: Prisma.WebchatsScalarFieldEnum[] | Prisma.WebchatsScalarFieldEnum;
    having?: Prisma.webchatsScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: WebchatsCountAggregateInputType | true;
    _min?: WebchatsMinAggregateInputType;
    _max?: WebchatsMaxAggregateInputType;
};
export type WebchatsGroupByOutputType = {
    id: string;
    organization_id: string;
    agent_id: string;
    name: string;
    slug: string;
    domain: string;
    email_project_id: string | null;
    active: boolean;
    settings: runtime.JsonValue | null;
    header_scripts: string | null;
    ads_config: runtime.JsonValue | null;
    created_at: Date;
    updated_at: Date;
    _count: WebchatsCountAggregateOutputType | null;
    _min: WebchatsMinAggregateOutputType | null;
    _max: WebchatsMaxAggregateOutputType | null;
};
type GetWebchatsGroupByPayload<T extends webchatsGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<WebchatsGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof WebchatsGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], WebchatsGroupByOutputType[P]> : Prisma.GetScalarType<T[P], WebchatsGroupByOutputType[P]>;
}>>;
export type webchatsWhereInput = {
    AND?: Prisma.webchatsWhereInput | Prisma.webchatsWhereInput[];
    OR?: Prisma.webchatsWhereInput[];
    NOT?: Prisma.webchatsWhereInput | Prisma.webchatsWhereInput[];
    id?: Prisma.StringFilter<"webchats"> | string;
    organization_id?: Prisma.StringFilter<"webchats"> | string;
    agent_id?: Prisma.StringFilter<"webchats"> | string;
    name?: Prisma.StringFilter<"webchats"> | string;
    slug?: Prisma.StringFilter<"webchats"> | string;
    domain?: Prisma.StringFilter<"webchats"> | string;
    email_project_id?: Prisma.StringNullableFilter<"webchats"> | string | null;
    active?: Prisma.BoolFilter<"webchats"> | boolean;
    settings?: Prisma.JsonNullableFilter<"webchats">;
    header_scripts?: Prisma.StringNullableFilter<"webchats"> | string | null;
    ads_config?: Prisma.JsonNullableFilter<"webchats">;
    created_at?: Prisma.DateTimeFilter<"webchats"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"webchats"> | Date | string;
    agentes_ia?: Prisma.XOR<Prisma.Agentes_iaScalarRelationFilter, Prisma.agentes_iaWhereInput>;
    email_projects?: Prisma.XOR<Prisma.Email_projectsNullableScalarRelationFilter, Prisma.email_projectsWhereInput> | null;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
    webchat_ads?: Prisma.Webchat_adsListRelationFilter;
    webchat_ad_events?: Prisma.Webchat_ad_eventsListRelationFilter;
    webchat_leads?: Prisma.Webchat_leadsListRelationFilter;
    webchat_sessions?: Prisma.Webchat_sessionsListRelationFilter;
};
export type webchatsOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    agent_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    slug?: Prisma.SortOrder;
    domain?: Prisma.SortOrder;
    email_project_id?: Prisma.SortOrderInput | Prisma.SortOrder;
    active?: Prisma.SortOrder;
    settings?: Prisma.SortOrderInput | Prisma.SortOrder;
    header_scripts?: Prisma.SortOrderInput | Prisma.SortOrder;
    ads_config?: Prisma.SortOrderInput | Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    agentes_ia?: Prisma.agentes_iaOrderByWithRelationInput;
    email_projects?: Prisma.email_projectsOrderByWithRelationInput;
    organizations?: Prisma.organizationsOrderByWithRelationInput;
    webchat_ads?: Prisma.webchat_adsOrderByRelationAggregateInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsOrderByRelationAggregateInput;
    webchat_leads?: Prisma.webchat_leadsOrderByRelationAggregateInput;
    webchat_sessions?: Prisma.webchat_sessionsOrderByRelationAggregateInput;
    _relevance?: Prisma.webchatsOrderByRelevanceInput;
};
export type webchatsWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    domain_slug?: Prisma.webchatsDomainSlugCompoundUniqueInput;
    AND?: Prisma.webchatsWhereInput | Prisma.webchatsWhereInput[];
    OR?: Prisma.webchatsWhereInput[];
    NOT?: Prisma.webchatsWhereInput | Prisma.webchatsWhereInput[];
    organization_id?: Prisma.StringFilter<"webchats"> | string;
    agent_id?: Prisma.StringFilter<"webchats"> | string;
    name?: Prisma.StringFilter<"webchats"> | string;
    slug?: Prisma.StringFilter<"webchats"> | string;
    domain?: Prisma.StringFilter<"webchats"> | string;
    email_project_id?: Prisma.StringNullableFilter<"webchats"> | string | null;
    active?: Prisma.BoolFilter<"webchats"> | boolean;
    settings?: Prisma.JsonNullableFilter<"webchats">;
    header_scripts?: Prisma.StringNullableFilter<"webchats"> | string | null;
    ads_config?: Prisma.JsonNullableFilter<"webchats">;
    created_at?: Prisma.DateTimeFilter<"webchats"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"webchats"> | Date | string;
    agentes_ia?: Prisma.XOR<Prisma.Agentes_iaScalarRelationFilter, Prisma.agentes_iaWhereInput>;
    email_projects?: Prisma.XOR<Prisma.Email_projectsNullableScalarRelationFilter, Prisma.email_projectsWhereInput> | null;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
    webchat_ads?: Prisma.Webchat_adsListRelationFilter;
    webchat_ad_events?: Prisma.Webchat_ad_eventsListRelationFilter;
    webchat_leads?: Prisma.Webchat_leadsListRelationFilter;
    webchat_sessions?: Prisma.Webchat_sessionsListRelationFilter;
}, "id" | "domain_slug">;
export type webchatsOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    agent_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    slug?: Prisma.SortOrder;
    domain?: Prisma.SortOrder;
    email_project_id?: Prisma.SortOrderInput | Prisma.SortOrder;
    active?: Prisma.SortOrder;
    settings?: Prisma.SortOrderInput | Prisma.SortOrder;
    header_scripts?: Prisma.SortOrderInput | Prisma.SortOrder;
    ads_config?: Prisma.SortOrderInput | Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    _count?: Prisma.webchatsCountOrderByAggregateInput;
    _max?: Prisma.webchatsMaxOrderByAggregateInput;
    _min?: Prisma.webchatsMinOrderByAggregateInput;
};
export type webchatsScalarWhereWithAggregatesInput = {
    AND?: Prisma.webchatsScalarWhereWithAggregatesInput | Prisma.webchatsScalarWhereWithAggregatesInput[];
    OR?: Prisma.webchatsScalarWhereWithAggregatesInput[];
    NOT?: Prisma.webchatsScalarWhereWithAggregatesInput | Prisma.webchatsScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"webchats"> | string;
    organization_id?: Prisma.StringWithAggregatesFilter<"webchats"> | string;
    agent_id?: Prisma.StringWithAggregatesFilter<"webchats"> | string;
    name?: Prisma.StringWithAggregatesFilter<"webchats"> | string;
    slug?: Prisma.StringWithAggregatesFilter<"webchats"> | string;
    domain?: Prisma.StringWithAggregatesFilter<"webchats"> | string;
    email_project_id?: Prisma.StringNullableWithAggregatesFilter<"webchats"> | string | null;
    active?: Prisma.BoolWithAggregatesFilter<"webchats"> | boolean;
    settings?: Prisma.JsonNullableWithAggregatesFilter<"webchats">;
    header_scripts?: Prisma.StringNullableWithAggregatesFilter<"webchats"> | string | null;
    ads_config?: Prisma.JsonNullableWithAggregatesFilter<"webchats">;
    created_at?: Prisma.DateTimeWithAggregatesFilter<"webchats"> | Date | string;
    updated_at?: Prisma.DateTimeWithAggregatesFilter<"webchats"> | Date | string;
};
export type webchatsCreateInput = {
    id?: string;
    name: string;
    slug: string;
    domain: string;
    active?: boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
    agentes_ia: Prisma.agentes_iaCreateNestedOneWithoutWebchatsInput;
    email_projects?: Prisma.email_projectsCreateNestedOneWithoutWebchatsInput;
    organizations: Prisma.organizationsCreateNestedOneWithoutWebchatsInput;
    webchat_ads?: Prisma.webchat_adsCreateNestedManyWithoutWebchatsInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsCreateNestedManyWithoutWebchatsInput;
    webchat_leads?: Prisma.webchat_leadsCreateNestedManyWithoutWebchatsInput;
    webchat_sessions?: Prisma.webchat_sessionsCreateNestedManyWithoutWebchatsInput;
};
export type webchatsUncheckedCreateInput = {
    id?: string;
    organization_id: string;
    agent_id: string;
    name: string;
    slug: string;
    domain: string;
    email_project_id?: string | null;
    active?: boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
    webchat_ads?: Prisma.webchat_adsUncheckedCreateNestedManyWithoutWebchatsInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsUncheckedCreateNestedManyWithoutWebchatsInput;
    webchat_leads?: Prisma.webchat_leadsUncheckedCreateNestedManyWithoutWebchatsInput;
    webchat_sessions?: Prisma.webchat_sessionsUncheckedCreateNestedManyWithoutWebchatsInput;
};
export type webchatsUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    slug?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    agentes_ia?: Prisma.agentes_iaUpdateOneRequiredWithoutWebchatsNestedInput;
    email_projects?: Prisma.email_projectsUpdateOneWithoutWebchatsNestedInput;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutWebchatsNestedInput;
    webchat_ads?: Prisma.webchat_adsUpdateManyWithoutWebchatsNestedInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsUpdateManyWithoutWebchatsNestedInput;
    webchat_leads?: Prisma.webchat_leadsUpdateManyWithoutWebchatsNestedInput;
    webchat_sessions?: Prisma.webchat_sessionsUpdateManyWithoutWebchatsNestedInput;
};
export type webchatsUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    agent_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    slug?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    email_project_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    webchat_ads?: Prisma.webchat_adsUncheckedUpdateManyWithoutWebchatsNestedInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsUncheckedUpdateManyWithoutWebchatsNestedInput;
    webchat_leads?: Prisma.webchat_leadsUncheckedUpdateManyWithoutWebchatsNestedInput;
    webchat_sessions?: Prisma.webchat_sessionsUncheckedUpdateManyWithoutWebchatsNestedInput;
};
export type webchatsCreateManyInput = {
    id?: string;
    organization_id: string;
    agent_id: string;
    name: string;
    slug: string;
    domain: string;
    email_project_id?: string | null;
    active?: boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type webchatsUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    slug?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchatsUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    agent_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    slug?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    email_project_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type WebchatsListRelationFilter = {
    every?: Prisma.webchatsWhereInput;
    some?: Prisma.webchatsWhereInput;
    none?: Prisma.webchatsWhereInput;
};
export type webchatsOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type webchatsOrderByRelevanceInput = {
    fields: Prisma.webchatsOrderByRelevanceFieldEnum | Prisma.webchatsOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type webchatsDomainSlugCompoundUniqueInput = {
    domain: string;
    slug: string;
};
export type webchatsCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    agent_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    slug?: Prisma.SortOrder;
    domain?: Prisma.SortOrder;
    email_project_id?: Prisma.SortOrder;
    active?: Prisma.SortOrder;
    settings?: Prisma.SortOrder;
    header_scripts?: Prisma.SortOrder;
    ads_config?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type webchatsMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    agent_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    slug?: Prisma.SortOrder;
    domain?: Prisma.SortOrder;
    email_project_id?: Prisma.SortOrder;
    active?: Prisma.SortOrder;
    header_scripts?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type webchatsMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    agent_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    slug?: Prisma.SortOrder;
    domain?: Prisma.SortOrder;
    email_project_id?: Prisma.SortOrder;
    active?: Prisma.SortOrder;
    header_scripts?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type WebchatsScalarRelationFilter = {
    is?: Prisma.webchatsWhereInput;
    isNot?: Prisma.webchatsWhereInput;
};
export type webchatsCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.webchatsCreateWithoutOrganizationsInput, Prisma.webchatsUncheckedCreateWithoutOrganizationsInput> | Prisma.webchatsCreateWithoutOrganizationsInput[] | Prisma.webchatsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.webchatsCreateOrConnectWithoutOrganizationsInput | Prisma.webchatsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.webchatsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
};
export type webchatsUncheckedCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.webchatsCreateWithoutOrganizationsInput, Prisma.webchatsUncheckedCreateWithoutOrganizationsInput> | Prisma.webchatsCreateWithoutOrganizationsInput[] | Prisma.webchatsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.webchatsCreateOrConnectWithoutOrganizationsInput | Prisma.webchatsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.webchatsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
};
export type webchatsUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.webchatsCreateWithoutOrganizationsInput, Prisma.webchatsUncheckedCreateWithoutOrganizationsInput> | Prisma.webchatsCreateWithoutOrganizationsInput[] | Prisma.webchatsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.webchatsCreateOrConnectWithoutOrganizationsInput | Prisma.webchatsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.webchatsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.webchatsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.webchatsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    disconnect?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    delete?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    connect?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    update?: Prisma.webchatsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.webchatsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.webchatsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.webchatsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.webchatsScalarWhereInput | Prisma.webchatsScalarWhereInput[];
};
export type webchatsUncheckedUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.webchatsCreateWithoutOrganizationsInput, Prisma.webchatsUncheckedCreateWithoutOrganizationsInput> | Prisma.webchatsCreateWithoutOrganizationsInput[] | Prisma.webchatsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.webchatsCreateOrConnectWithoutOrganizationsInput | Prisma.webchatsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.webchatsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.webchatsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.webchatsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    disconnect?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    delete?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    connect?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    update?: Prisma.webchatsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.webchatsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.webchatsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.webchatsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.webchatsScalarWhereInput | Prisma.webchatsScalarWhereInput[];
};
export type webchatsCreateNestedManyWithoutEmail_projectsInput = {
    create?: Prisma.XOR<Prisma.webchatsCreateWithoutEmail_projectsInput, Prisma.webchatsUncheckedCreateWithoutEmail_projectsInput> | Prisma.webchatsCreateWithoutEmail_projectsInput[] | Prisma.webchatsUncheckedCreateWithoutEmail_projectsInput[];
    connectOrCreate?: Prisma.webchatsCreateOrConnectWithoutEmail_projectsInput | Prisma.webchatsCreateOrConnectWithoutEmail_projectsInput[];
    createMany?: Prisma.webchatsCreateManyEmail_projectsInputEnvelope;
    connect?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
};
export type webchatsUncheckedCreateNestedManyWithoutEmail_projectsInput = {
    create?: Prisma.XOR<Prisma.webchatsCreateWithoutEmail_projectsInput, Prisma.webchatsUncheckedCreateWithoutEmail_projectsInput> | Prisma.webchatsCreateWithoutEmail_projectsInput[] | Prisma.webchatsUncheckedCreateWithoutEmail_projectsInput[];
    connectOrCreate?: Prisma.webchatsCreateOrConnectWithoutEmail_projectsInput | Prisma.webchatsCreateOrConnectWithoutEmail_projectsInput[];
    createMany?: Prisma.webchatsCreateManyEmail_projectsInputEnvelope;
    connect?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
};
export type webchatsUpdateManyWithoutEmail_projectsNestedInput = {
    create?: Prisma.XOR<Prisma.webchatsCreateWithoutEmail_projectsInput, Prisma.webchatsUncheckedCreateWithoutEmail_projectsInput> | Prisma.webchatsCreateWithoutEmail_projectsInput[] | Prisma.webchatsUncheckedCreateWithoutEmail_projectsInput[];
    connectOrCreate?: Prisma.webchatsCreateOrConnectWithoutEmail_projectsInput | Prisma.webchatsCreateOrConnectWithoutEmail_projectsInput[];
    upsert?: Prisma.webchatsUpsertWithWhereUniqueWithoutEmail_projectsInput | Prisma.webchatsUpsertWithWhereUniqueWithoutEmail_projectsInput[];
    createMany?: Prisma.webchatsCreateManyEmail_projectsInputEnvelope;
    set?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    disconnect?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    delete?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    connect?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    update?: Prisma.webchatsUpdateWithWhereUniqueWithoutEmail_projectsInput | Prisma.webchatsUpdateWithWhereUniqueWithoutEmail_projectsInput[];
    updateMany?: Prisma.webchatsUpdateManyWithWhereWithoutEmail_projectsInput | Prisma.webchatsUpdateManyWithWhereWithoutEmail_projectsInput[];
    deleteMany?: Prisma.webchatsScalarWhereInput | Prisma.webchatsScalarWhereInput[];
};
export type webchatsUncheckedUpdateManyWithoutEmail_projectsNestedInput = {
    create?: Prisma.XOR<Prisma.webchatsCreateWithoutEmail_projectsInput, Prisma.webchatsUncheckedCreateWithoutEmail_projectsInput> | Prisma.webchatsCreateWithoutEmail_projectsInput[] | Prisma.webchatsUncheckedCreateWithoutEmail_projectsInput[];
    connectOrCreate?: Prisma.webchatsCreateOrConnectWithoutEmail_projectsInput | Prisma.webchatsCreateOrConnectWithoutEmail_projectsInput[];
    upsert?: Prisma.webchatsUpsertWithWhereUniqueWithoutEmail_projectsInput | Prisma.webchatsUpsertWithWhereUniqueWithoutEmail_projectsInput[];
    createMany?: Prisma.webchatsCreateManyEmail_projectsInputEnvelope;
    set?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    disconnect?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    delete?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    connect?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    update?: Prisma.webchatsUpdateWithWhereUniqueWithoutEmail_projectsInput | Prisma.webchatsUpdateWithWhereUniqueWithoutEmail_projectsInput[];
    updateMany?: Prisma.webchatsUpdateManyWithWhereWithoutEmail_projectsInput | Prisma.webchatsUpdateManyWithWhereWithoutEmail_projectsInput[];
    deleteMany?: Prisma.webchatsScalarWhereInput | Prisma.webchatsScalarWhereInput[];
};
export type webchatsCreateNestedManyWithoutAgentes_iaInput = {
    create?: Prisma.XOR<Prisma.webchatsCreateWithoutAgentes_iaInput, Prisma.webchatsUncheckedCreateWithoutAgentes_iaInput> | Prisma.webchatsCreateWithoutAgentes_iaInput[] | Prisma.webchatsUncheckedCreateWithoutAgentes_iaInput[];
    connectOrCreate?: Prisma.webchatsCreateOrConnectWithoutAgentes_iaInput | Prisma.webchatsCreateOrConnectWithoutAgentes_iaInput[];
    createMany?: Prisma.webchatsCreateManyAgentes_iaInputEnvelope;
    connect?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
};
export type webchatsUncheckedCreateNestedManyWithoutAgentes_iaInput = {
    create?: Prisma.XOR<Prisma.webchatsCreateWithoutAgentes_iaInput, Prisma.webchatsUncheckedCreateWithoutAgentes_iaInput> | Prisma.webchatsCreateWithoutAgentes_iaInput[] | Prisma.webchatsUncheckedCreateWithoutAgentes_iaInput[];
    connectOrCreate?: Prisma.webchatsCreateOrConnectWithoutAgentes_iaInput | Prisma.webchatsCreateOrConnectWithoutAgentes_iaInput[];
    createMany?: Prisma.webchatsCreateManyAgentes_iaInputEnvelope;
    connect?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
};
export type webchatsUpdateManyWithoutAgentes_iaNestedInput = {
    create?: Prisma.XOR<Prisma.webchatsCreateWithoutAgentes_iaInput, Prisma.webchatsUncheckedCreateWithoutAgentes_iaInput> | Prisma.webchatsCreateWithoutAgentes_iaInput[] | Prisma.webchatsUncheckedCreateWithoutAgentes_iaInput[];
    connectOrCreate?: Prisma.webchatsCreateOrConnectWithoutAgentes_iaInput | Prisma.webchatsCreateOrConnectWithoutAgentes_iaInput[];
    upsert?: Prisma.webchatsUpsertWithWhereUniqueWithoutAgentes_iaInput | Prisma.webchatsUpsertWithWhereUniqueWithoutAgentes_iaInput[];
    createMany?: Prisma.webchatsCreateManyAgentes_iaInputEnvelope;
    set?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    disconnect?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    delete?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    connect?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    update?: Prisma.webchatsUpdateWithWhereUniqueWithoutAgentes_iaInput | Prisma.webchatsUpdateWithWhereUniqueWithoutAgentes_iaInput[];
    updateMany?: Prisma.webchatsUpdateManyWithWhereWithoutAgentes_iaInput | Prisma.webchatsUpdateManyWithWhereWithoutAgentes_iaInput[];
    deleteMany?: Prisma.webchatsScalarWhereInput | Prisma.webchatsScalarWhereInput[];
};
export type webchatsUncheckedUpdateManyWithoutAgentes_iaNestedInput = {
    create?: Prisma.XOR<Prisma.webchatsCreateWithoutAgentes_iaInput, Prisma.webchatsUncheckedCreateWithoutAgentes_iaInput> | Prisma.webchatsCreateWithoutAgentes_iaInput[] | Prisma.webchatsUncheckedCreateWithoutAgentes_iaInput[];
    connectOrCreate?: Prisma.webchatsCreateOrConnectWithoutAgentes_iaInput | Prisma.webchatsCreateOrConnectWithoutAgentes_iaInput[];
    upsert?: Prisma.webchatsUpsertWithWhereUniqueWithoutAgentes_iaInput | Prisma.webchatsUpsertWithWhereUniqueWithoutAgentes_iaInput[];
    createMany?: Prisma.webchatsCreateManyAgentes_iaInputEnvelope;
    set?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    disconnect?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    delete?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    connect?: Prisma.webchatsWhereUniqueInput | Prisma.webchatsWhereUniqueInput[];
    update?: Prisma.webchatsUpdateWithWhereUniqueWithoutAgentes_iaInput | Prisma.webchatsUpdateWithWhereUniqueWithoutAgentes_iaInput[];
    updateMany?: Prisma.webchatsUpdateManyWithWhereWithoutAgentes_iaInput | Prisma.webchatsUpdateManyWithWhereWithoutAgentes_iaInput[];
    deleteMany?: Prisma.webchatsScalarWhereInput | Prisma.webchatsScalarWhereInput[];
};
export type webchatsCreateNestedOneWithoutWebchat_adsInput = {
    create?: Prisma.XOR<Prisma.webchatsCreateWithoutWebchat_adsInput, Prisma.webchatsUncheckedCreateWithoutWebchat_adsInput>;
    connectOrCreate?: Prisma.webchatsCreateOrConnectWithoutWebchat_adsInput;
    connect?: Prisma.webchatsWhereUniqueInput;
};
export type webchatsUpdateOneRequiredWithoutWebchat_adsNestedInput = {
    create?: Prisma.XOR<Prisma.webchatsCreateWithoutWebchat_adsInput, Prisma.webchatsUncheckedCreateWithoutWebchat_adsInput>;
    connectOrCreate?: Prisma.webchatsCreateOrConnectWithoutWebchat_adsInput;
    upsert?: Prisma.webchatsUpsertWithoutWebchat_adsInput;
    connect?: Prisma.webchatsWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.webchatsUpdateToOneWithWhereWithoutWebchat_adsInput, Prisma.webchatsUpdateWithoutWebchat_adsInput>, Prisma.webchatsUncheckedUpdateWithoutWebchat_adsInput>;
};
export type webchatsCreateNestedOneWithoutWebchat_ad_eventsInput = {
    create?: Prisma.XOR<Prisma.webchatsCreateWithoutWebchat_ad_eventsInput, Prisma.webchatsUncheckedCreateWithoutWebchat_ad_eventsInput>;
    connectOrCreate?: Prisma.webchatsCreateOrConnectWithoutWebchat_ad_eventsInput;
    connect?: Prisma.webchatsWhereUniqueInput;
};
export type webchatsUpdateOneRequiredWithoutWebchat_ad_eventsNestedInput = {
    create?: Prisma.XOR<Prisma.webchatsCreateWithoutWebchat_ad_eventsInput, Prisma.webchatsUncheckedCreateWithoutWebchat_ad_eventsInput>;
    connectOrCreate?: Prisma.webchatsCreateOrConnectWithoutWebchat_ad_eventsInput;
    upsert?: Prisma.webchatsUpsertWithoutWebchat_ad_eventsInput;
    connect?: Prisma.webchatsWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.webchatsUpdateToOneWithWhereWithoutWebchat_ad_eventsInput, Prisma.webchatsUpdateWithoutWebchat_ad_eventsInput>, Prisma.webchatsUncheckedUpdateWithoutWebchat_ad_eventsInput>;
};
export type webchatsCreateNestedOneWithoutWebchat_leadsInput = {
    create?: Prisma.XOR<Prisma.webchatsCreateWithoutWebchat_leadsInput, Prisma.webchatsUncheckedCreateWithoutWebchat_leadsInput>;
    connectOrCreate?: Prisma.webchatsCreateOrConnectWithoutWebchat_leadsInput;
    connect?: Prisma.webchatsWhereUniqueInput;
};
export type webchatsUpdateOneRequiredWithoutWebchat_leadsNestedInput = {
    create?: Prisma.XOR<Prisma.webchatsCreateWithoutWebchat_leadsInput, Prisma.webchatsUncheckedCreateWithoutWebchat_leadsInput>;
    connectOrCreate?: Prisma.webchatsCreateOrConnectWithoutWebchat_leadsInput;
    upsert?: Prisma.webchatsUpsertWithoutWebchat_leadsInput;
    connect?: Prisma.webchatsWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.webchatsUpdateToOneWithWhereWithoutWebchat_leadsInput, Prisma.webchatsUpdateWithoutWebchat_leadsInput>, Prisma.webchatsUncheckedUpdateWithoutWebchat_leadsInput>;
};
export type webchatsCreateNestedOneWithoutWebchat_sessionsInput = {
    create?: Prisma.XOR<Prisma.webchatsCreateWithoutWebchat_sessionsInput, Prisma.webchatsUncheckedCreateWithoutWebchat_sessionsInput>;
    connectOrCreate?: Prisma.webchatsCreateOrConnectWithoutWebchat_sessionsInput;
    connect?: Prisma.webchatsWhereUniqueInput;
};
export type webchatsUpdateOneRequiredWithoutWebchat_sessionsNestedInput = {
    create?: Prisma.XOR<Prisma.webchatsCreateWithoutWebchat_sessionsInput, Prisma.webchatsUncheckedCreateWithoutWebchat_sessionsInput>;
    connectOrCreate?: Prisma.webchatsCreateOrConnectWithoutWebchat_sessionsInput;
    upsert?: Prisma.webchatsUpsertWithoutWebchat_sessionsInput;
    connect?: Prisma.webchatsWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.webchatsUpdateToOneWithWhereWithoutWebchat_sessionsInput, Prisma.webchatsUpdateWithoutWebchat_sessionsInput>, Prisma.webchatsUncheckedUpdateWithoutWebchat_sessionsInput>;
};
export type webchatsCreateWithoutOrganizationsInput = {
    id?: string;
    name: string;
    slug: string;
    domain: string;
    active?: boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
    agentes_ia: Prisma.agentes_iaCreateNestedOneWithoutWebchatsInput;
    email_projects?: Prisma.email_projectsCreateNestedOneWithoutWebchatsInput;
    webchat_ads?: Prisma.webchat_adsCreateNestedManyWithoutWebchatsInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsCreateNestedManyWithoutWebchatsInput;
    webchat_leads?: Prisma.webchat_leadsCreateNestedManyWithoutWebchatsInput;
    webchat_sessions?: Prisma.webchat_sessionsCreateNestedManyWithoutWebchatsInput;
};
export type webchatsUncheckedCreateWithoutOrganizationsInput = {
    id?: string;
    agent_id: string;
    name: string;
    slug: string;
    domain: string;
    email_project_id?: string | null;
    active?: boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
    webchat_ads?: Prisma.webchat_adsUncheckedCreateNestedManyWithoutWebchatsInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsUncheckedCreateNestedManyWithoutWebchatsInput;
    webchat_leads?: Prisma.webchat_leadsUncheckedCreateNestedManyWithoutWebchatsInput;
    webchat_sessions?: Prisma.webchat_sessionsUncheckedCreateNestedManyWithoutWebchatsInput;
};
export type webchatsCreateOrConnectWithoutOrganizationsInput = {
    where: Prisma.webchatsWhereUniqueInput;
    create: Prisma.XOR<Prisma.webchatsCreateWithoutOrganizationsInput, Prisma.webchatsUncheckedCreateWithoutOrganizationsInput>;
};
export type webchatsCreateManyOrganizationsInputEnvelope = {
    data: Prisma.webchatsCreateManyOrganizationsInput | Prisma.webchatsCreateManyOrganizationsInput[];
    skipDuplicates?: boolean;
};
export type webchatsUpsertWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.webchatsWhereUniqueInput;
    update: Prisma.XOR<Prisma.webchatsUpdateWithoutOrganizationsInput, Prisma.webchatsUncheckedUpdateWithoutOrganizationsInput>;
    create: Prisma.XOR<Prisma.webchatsCreateWithoutOrganizationsInput, Prisma.webchatsUncheckedCreateWithoutOrganizationsInput>;
};
export type webchatsUpdateWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.webchatsWhereUniqueInput;
    data: Prisma.XOR<Prisma.webchatsUpdateWithoutOrganizationsInput, Prisma.webchatsUncheckedUpdateWithoutOrganizationsInput>;
};
export type webchatsUpdateManyWithWhereWithoutOrganizationsInput = {
    where: Prisma.webchatsScalarWhereInput;
    data: Prisma.XOR<Prisma.webchatsUpdateManyMutationInput, Prisma.webchatsUncheckedUpdateManyWithoutOrganizationsInput>;
};
export type webchatsScalarWhereInput = {
    AND?: Prisma.webchatsScalarWhereInput | Prisma.webchatsScalarWhereInput[];
    OR?: Prisma.webchatsScalarWhereInput[];
    NOT?: Prisma.webchatsScalarWhereInput | Prisma.webchatsScalarWhereInput[];
    id?: Prisma.StringFilter<"webchats"> | string;
    organization_id?: Prisma.StringFilter<"webchats"> | string;
    agent_id?: Prisma.StringFilter<"webchats"> | string;
    name?: Prisma.StringFilter<"webchats"> | string;
    slug?: Prisma.StringFilter<"webchats"> | string;
    domain?: Prisma.StringFilter<"webchats"> | string;
    email_project_id?: Prisma.StringNullableFilter<"webchats"> | string | null;
    active?: Prisma.BoolFilter<"webchats"> | boolean;
    settings?: Prisma.JsonNullableFilter<"webchats">;
    header_scripts?: Prisma.StringNullableFilter<"webchats"> | string | null;
    ads_config?: Prisma.JsonNullableFilter<"webchats">;
    created_at?: Prisma.DateTimeFilter<"webchats"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"webchats"> | Date | string;
};
export type webchatsCreateWithoutEmail_projectsInput = {
    id?: string;
    name: string;
    slug: string;
    domain: string;
    active?: boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
    agentes_ia: Prisma.agentes_iaCreateNestedOneWithoutWebchatsInput;
    organizations: Prisma.organizationsCreateNestedOneWithoutWebchatsInput;
    webchat_ads?: Prisma.webchat_adsCreateNestedManyWithoutWebchatsInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsCreateNestedManyWithoutWebchatsInput;
    webchat_leads?: Prisma.webchat_leadsCreateNestedManyWithoutWebchatsInput;
    webchat_sessions?: Prisma.webchat_sessionsCreateNestedManyWithoutWebchatsInput;
};
export type webchatsUncheckedCreateWithoutEmail_projectsInput = {
    id?: string;
    organization_id: string;
    agent_id: string;
    name: string;
    slug: string;
    domain: string;
    active?: boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
    webchat_ads?: Prisma.webchat_adsUncheckedCreateNestedManyWithoutWebchatsInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsUncheckedCreateNestedManyWithoutWebchatsInput;
    webchat_leads?: Prisma.webchat_leadsUncheckedCreateNestedManyWithoutWebchatsInput;
    webchat_sessions?: Prisma.webchat_sessionsUncheckedCreateNestedManyWithoutWebchatsInput;
};
export type webchatsCreateOrConnectWithoutEmail_projectsInput = {
    where: Prisma.webchatsWhereUniqueInput;
    create: Prisma.XOR<Prisma.webchatsCreateWithoutEmail_projectsInput, Prisma.webchatsUncheckedCreateWithoutEmail_projectsInput>;
};
export type webchatsCreateManyEmail_projectsInputEnvelope = {
    data: Prisma.webchatsCreateManyEmail_projectsInput | Prisma.webchatsCreateManyEmail_projectsInput[];
    skipDuplicates?: boolean;
};
export type webchatsUpsertWithWhereUniqueWithoutEmail_projectsInput = {
    where: Prisma.webchatsWhereUniqueInput;
    update: Prisma.XOR<Prisma.webchatsUpdateWithoutEmail_projectsInput, Prisma.webchatsUncheckedUpdateWithoutEmail_projectsInput>;
    create: Prisma.XOR<Prisma.webchatsCreateWithoutEmail_projectsInput, Prisma.webchatsUncheckedCreateWithoutEmail_projectsInput>;
};
export type webchatsUpdateWithWhereUniqueWithoutEmail_projectsInput = {
    where: Prisma.webchatsWhereUniqueInput;
    data: Prisma.XOR<Prisma.webchatsUpdateWithoutEmail_projectsInput, Prisma.webchatsUncheckedUpdateWithoutEmail_projectsInput>;
};
export type webchatsUpdateManyWithWhereWithoutEmail_projectsInput = {
    where: Prisma.webchatsScalarWhereInput;
    data: Prisma.XOR<Prisma.webchatsUpdateManyMutationInput, Prisma.webchatsUncheckedUpdateManyWithoutEmail_projectsInput>;
};
export type webchatsCreateWithoutAgentes_iaInput = {
    id?: string;
    name: string;
    slug: string;
    domain: string;
    active?: boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
    email_projects?: Prisma.email_projectsCreateNestedOneWithoutWebchatsInput;
    organizations: Prisma.organizationsCreateNestedOneWithoutWebchatsInput;
    webchat_ads?: Prisma.webchat_adsCreateNestedManyWithoutWebchatsInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsCreateNestedManyWithoutWebchatsInput;
    webchat_leads?: Prisma.webchat_leadsCreateNestedManyWithoutWebchatsInput;
    webchat_sessions?: Prisma.webchat_sessionsCreateNestedManyWithoutWebchatsInput;
};
export type webchatsUncheckedCreateWithoutAgentes_iaInput = {
    id?: string;
    organization_id: string;
    name: string;
    slug: string;
    domain: string;
    email_project_id?: string | null;
    active?: boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
    webchat_ads?: Prisma.webchat_adsUncheckedCreateNestedManyWithoutWebchatsInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsUncheckedCreateNestedManyWithoutWebchatsInput;
    webchat_leads?: Prisma.webchat_leadsUncheckedCreateNestedManyWithoutWebchatsInput;
    webchat_sessions?: Prisma.webchat_sessionsUncheckedCreateNestedManyWithoutWebchatsInput;
};
export type webchatsCreateOrConnectWithoutAgentes_iaInput = {
    where: Prisma.webchatsWhereUniqueInput;
    create: Prisma.XOR<Prisma.webchatsCreateWithoutAgentes_iaInput, Prisma.webchatsUncheckedCreateWithoutAgentes_iaInput>;
};
export type webchatsCreateManyAgentes_iaInputEnvelope = {
    data: Prisma.webchatsCreateManyAgentes_iaInput | Prisma.webchatsCreateManyAgentes_iaInput[];
    skipDuplicates?: boolean;
};
export type webchatsUpsertWithWhereUniqueWithoutAgentes_iaInput = {
    where: Prisma.webchatsWhereUniqueInput;
    update: Prisma.XOR<Prisma.webchatsUpdateWithoutAgentes_iaInput, Prisma.webchatsUncheckedUpdateWithoutAgentes_iaInput>;
    create: Prisma.XOR<Prisma.webchatsCreateWithoutAgentes_iaInput, Prisma.webchatsUncheckedCreateWithoutAgentes_iaInput>;
};
export type webchatsUpdateWithWhereUniqueWithoutAgentes_iaInput = {
    where: Prisma.webchatsWhereUniqueInput;
    data: Prisma.XOR<Prisma.webchatsUpdateWithoutAgentes_iaInput, Prisma.webchatsUncheckedUpdateWithoutAgentes_iaInput>;
};
export type webchatsUpdateManyWithWhereWithoutAgentes_iaInput = {
    where: Prisma.webchatsScalarWhereInput;
    data: Prisma.XOR<Prisma.webchatsUpdateManyMutationInput, Prisma.webchatsUncheckedUpdateManyWithoutAgentes_iaInput>;
};
export type webchatsCreateWithoutWebchat_adsInput = {
    id?: string;
    name: string;
    slug: string;
    domain: string;
    active?: boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
    agentes_ia: Prisma.agentes_iaCreateNestedOneWithoutWebchatsInput;
    email_projects?: Prisma.email_projectsCreateNestedOneWithoutWebchatsInput;
    organizations: Prisma.organizationsCreateNestedOneWithoutWebchatsInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsCreateNestedManyWithoutWebchatsInput;
    webchat_leads?: Prisma.webchat_leadsCreateNestedManyWithoutWebchatsInput;
    webchat_sessions?: Prisma.webchat_sessionsCreateNestedManyWithoutWebchatsInput;
};
export type webchatsUncheckedCreateWithoutWebchat_adsInput = {
    id?: string;
    organization_id: string;
    agent_id: string;
    name: string;
    slug: string;
    domain: string;
    email_project_id?: string | null;
    active?: boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
    webchat_ad_events?: Prisma.webchat_ad_eventsUncheckedCreateNestedManyWithoutWebchatsInput;
    webchat_leads?: Prisma.webchat_leadsUncheckedCreateNestedManyWithoutWebchatsInput;
    webchat_sessions?: Prisma.webchat_sessionsUncheckedCreateNestedManyWithoutWebchatsInput;
};
export type webchatsCreateOrConnectWithoutWebchat_adsInput = {
    where: Prisma.webchatsWhereUniqueInput;
    create: Prisma.XOR<Prisma.webchatsCreateWithoutWebchat_adsInput, Prisma.webchatsUncheckedCreateWithoutWebchat_adsInput>;
};
export type webchatsUpsertWithoutWebchat_adsInput = {
    update: Prisma.XOR<Prisma.webchatsUpdateWithoutWebchat_adsInput, Prisma.webchatsUncheckedUpdateWithoutWebchat_adsInput>;
    create: Prisma.XOR<Prisma.webchatsCreateWithoutWebchat_adsInput, Prisma.webchatsUncheckedCreateWithoutWebchat_adsInput>;
    where?: Prisma.webchatsWhereInput;
};
export type webchatsUpdateToOneWithWhereWithoutWebchat_adsInput = {
    where?: Prisma.webchatsWhereInput;
    data: Prisma.XOR<Prisma.webchatsUpdateWithoutWebchat_adsInput, Prisma.webchatsUncheckedUpdateWithoutWebchat_adsInput>;
};
export type webchatsUpdateWithoutWebchat_adsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    slug?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    agentes_ia?: Prisma.agentes_iaUpdateOneRequiredWithoutWebchatsNestedInput;
    email_projects?: Prisma.email_projectsUpdateOneWithoutWebchatsNestedInput;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutWebchatsNestedInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsUpdateManyWithoutWebchatsNestedInput;
    webchat_leads?: Prisma.webchat_leadsUpdateManyWithoutWebchatsNestedInput;
    webchat_sessions?: Prisma.webchat_sessionsUpdateManyWithoutWebchatsNestedInput;
};
export type webchatsUncheckedUpdateWithoutWebchat_adsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    agent_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    slug?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    email_project_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    webchat_ad_events?: Prisma.webchat_ad_eventsUncheckedUpdateManyWithoutWebchatsNestedInput;
    webchat_leads?: Prisma.webchat_leadsUncheckedUpdateManyWithoutWebchatsNestedInput;
    webchat_sessions?: Prisma.webchat_sessionsUncheckedUpdateManyWithoutWebchatsNestedInput;
};
export type webchatsCreateWithoutWebchat_ad_eventsInput = {
    id?: string;
    name: string;
    slug: string;
    domain: string;
    active?: boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
    agentes_ia: Prisma.agentes_iaCreateNestedOneWithoutWebchatsInput;
    email_projects?: Prisma.email_projectsCreateNestedOneWithoutWebchatsInput;
    organizations: Prisma.organizationsCreateNestedOneWithoutWebchatsInput;
    webchat_ads?: Prisma.webchat_adsCreateNestedManyWithoutWebchatsInput;
    webchat_leads?: Prisma.webchat_leadsCreateNestedManyWithoutWebchatsInput;
    webchat_sessions?: Prisma.webchat_sessionsCreateNestedManyWithoutWebchatsInput;
};
export type webchatsUncheckedCreateWithoutWebchat_ad_eventsInput = {
    id?: string;
    organization_id: string;
    agent_id: string;
    name: string;
    slug: string;
    domain: string;
    email_project_id?: string | null;
    active?: boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
    webchat_ads?: Prisma.webchat_adsUncheckedCreateNestedManyWithoutWebchatsInput;
    webchat_leads?: Prisma.webchat_leadsUncheckedCreateNestedManyWithoutWebchatsInput;
    webchat_sessions?: Prisma.webchat_sessionsUncheckedCreateNestedManyWithoutWebchatsInput;
};
export type webchatsCreateOrConnectWithoutWebchat_ad_eventsInput = {
    where: Prisma.webchatsWhereUniqueInput;
    create: Prisma.XOR<Prisma.webchatsCreateWithoutWebchat_ad_eventsInput, Prisma.webchatsUncheckedCreateWithoutWebchat_ad_eventsInput>;
};
export type webchatsUpsertWithoutWebchat_ad_eventsInput = {
    update: Prisma.XOR<Prisma.webchatsUpdateWithoutWebchat_ad_eventsInput, Prisma.webchatsUncheckedUpdateWithoutWebchat_ad_eventsInput>;
    create: Prisma.XOR<Prisma.webchatsCreateWithoutWebchat_ad_eventsInput, Prisma.webchatsUncheckedCreateWithoutWebchat_ad_eventsInput>;
    where?: Prisma.webchatsWhereInput;
};
export type webchatsUpdateToOneWithWhereWithoutWebchat_ad_eventsInput = {
    where?: Prisma.webchatsWhereInput;
    data: Prisma.XOR<Prisma.webchatsUpdateWithoutWebchat_ad_eventsInput, Prisma.webchatsUncheckedUpdateWithoutWebchat_ad_eventsInput>;
};
export type webchatsUpdateWithoutWebchat_ad_eventsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    slug?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    agentes_ia?: Prisma.agentes_iaUpdateOneRequiredWithoutWebchatsNestedInput;
    email_projects?: Prisma.email_projectsUpdateOneWithoutWebchatsNestedInput;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutWebchatsNestedInput;
    webchat_ads?: Prisma.webchat_adsUpdateManyWithoutWebchatsNestedInput;
    webchat_leads?: Prisma.webchat_leadsUpdateManyWithoutWebchatsNestedInput;
    webchat_sessions?: Prisma.webchat_sessionsUpdateManyWithoutWebchatsNestedInput;
};
export type webchatsUncheckedUpdateWithoutWebchat_ad_eventsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    agent_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    slug?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    email_project_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    webchat_ads?: Prisma.webchat_adsUncheckedUpdateManyWithoutWebchatsNestedInput;
    webchat_leads?: Prisma.webchat_leadsUncheckedUpdateManyWithoutWebchatsNestedInput;
    webchat_sessions?: Prisma.webchat_sessionsUncheckedUpdateManyWithoutWebchatsNestedInput;
};
export type webchatsCreateWithoutWebchat_leadsInput = {
    id?: string;
    name: string;
    slug: string;
    domain: string;
    active?: boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
    agentes_ia: Prisma.agentes_iaCreateNestedOneWithoutWebchatsInput;
    email_projects?: Prisma.email_projectsCreateNestedOneWithoutWebchatsInput;
    organizations: Prisma.organizationsCreateNestedOneWithoutWebchatsInput;
    webchat_ads?: Prisma.webchat_adsCreateNestedManyWithoutWebchatsInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsCreateNestedManyWithoutWebchatsInput;
    webchat_sessions?: Prisma.webchat_sessionsCreateNestedManyWithoutWebchatsInput;
};
export type webchatsUncheckedCreateWithoutWebchat_leadsInput = {
    id?: string;
    organization_id: string;
    agent_id: string;
    name: string;
    slug: string;
    domain: string;
    email_project_id?: string | null;
    active?: boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
    webchat_ads?: Prisma.webchat_adsUncheckedCreateNestedManyWithoutWebchatsInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsUncheckedCreateNestedManyWithoutWebchatsInput;
    webchat_sessions?: Prisma.webchat_sessionsUncheckedCreateNestedManyWithoutWebchatsInput;
};
export type webchatsCreateOrConnectWithoutWebchat_leadsInput = {
    where: Prisma.webchatsWhereUniqueInput;
    create: Prisma.XOR<Prisma.webchatsCreateWithoutWebchat_leadsInput, Prisma.webchatsUncheckedCreateWithoutWebchat_leadsInput>;
};
export type webchatsUpsertWithoutWebchat_leadsInput = {
    update: Prisma.XOR<Prisma.webchatsUpdateWithoutWebchat_leadsInput, Prisma.webchatsUncheckedUpdateWithoutWebchat_leadsInput>;
    create: Prisma.XOR<Prisma.webchatsCreateWithoutWebchat_leadsInput, Prisma.webchatsUncheckedCreateWithoutWebchat_leadsInput>;
    where?: Prisma.webchatsWhereInput;
};
export type webchatsUpdateToOneWithWhereWithoutWebchat_leadsInput = {
    where?: Prisma.webchatsWhereInput;
    data: Prisma.XOR<Prisma.webchatsUpdateWithoutWebchat_leadsInput, Prisma.webchatsUncheckedUpdateWithoutWebchat_leadsInput>;
};
export type webchatsUpdateWithoutWebchat_leadsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    slug?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    agentes_ia?: Prisma.agentes_iaUpdateOneRequiredWithoutWebchatsNestedInput;
    email_projects?: Prisma.email_projectsUpdateOneWithoutWebchatsNestedInput;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutWebchatsNestedInput;
    webchat_ads?: Prisma.webchat_adsUpdateManyWithoutWebchatsNestedInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsUpdateManyWithoutWebchatsNestedInput;
    webchat_sessions?: Prisma.webchat_sessionsUpdateManyWithoutWebchatsNestedInput;
};
export type webchatsUncheckedUpdateWithoutWebchat_leadsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    agent_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    slug?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    email_project_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    webchat_ads?: Prisma.webchat_adsUncheckedUpdateManyWithoutWebchatsNestedInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsUncheckedUpdateManyWithoutWebchatsNestedInput;
    webchat_sessions?: Prisma.webchat_sessionsUncheckedUpdateManyWithoutWebchatsNestedInput;
};
export type webchatsCreateWithoutWebchat_sessionsInput = {
    id?: string;
    name: string;
    slug: string;
    domain: string;
    active?: boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
    agentes_ia: Prisma.agentes_iaCreateNestedOneWithoutWebchatsInput;
    email_projects?: Prisma.email_projectsCreateNestedOneWithoutWebchatsInput;
    organizations: Prisma.organizationsCreateNestedOneWithoutWebchatsInput;
    webchat_ads?: Prisma.webchat_adsCreateNestedManyWithoutWebchatsInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsCreateNestedManyWithoutWebchatsInput;
    webchat_leads?: Prisma.webchat_leadsCreateNestedManyWithoutWebchatsInput;
};
export type webchatsUncheckedCreateWithoutWebchat_sessionsInput = {
    id?: string;
    organization_id: string;
    agent_id: string;
    name: string;
    slug: string;
    domain: string;
    email_project_id?: string | null;
    active?: boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
    webchat_ads?: Prisma.webchat_adsUncheckedCreateNestedManyWithoutWebchatsInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsUncheckedCreateNestedManyWithoutWebchatsInput;
    webchat_leads?: Prisma.webchat_leadsUncheckedCreateNestedManyWithoutWebchatsInput;
};
export type webchatsCreateOrConnectWithoutWebchat_sessionsInput = {
    where: Prisma.webchatsWhereUniqueInput;
    create: Prisma.XOR<Prisma.webchatsCreateWithoutWebchat_sessionsInput, Prisma.webchatsUncheckedCreateWithoutWebchat_sessionsInput>;
};
export type webchatsUpsertWithoutWebchat_sessionsInput = {
    update: Prisma.XOR<Prisma.webchatsUpdateWithoutWebchat_sessionsInput, Prisma.webchatsUncheckedUpdateWithoutWebchat_sessionsInput>;
    create: Prisma.XOR<Prisma.webchatsCreateWithoutWebchat_sessionsInput, Prisma.webchatsUncheckedCreateWithoutWebchat_sessionsInput>;
    where?: Prisma.webchatsWhereInput;
};
export type webchatsUpdateToOneWithWhereWithoutWebchat_sessionsInput = {
    where?: Prisma.webchatsWhereInput;
    data: Prisma.XOR<Prisma.webchatsUpdateWithoutWebchat_sessionsInput, Prisma.webchatsUncheckedUpdateWithoutWebchat_sessionsInput>;
};
export type webchatsUpdateWithoutWebchat_sessionsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    slug?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    agentes_ia?: Prisma.agentes_iaUpdateOneRequiredWithoutWebchatsNestedInput;
    email_projects?: Prisma.email_projectsUpdateOneWithoutWebchatsNestedInput;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutWebchatsNestedInput;
    webchat_ads?: Prisma.webchat_adsUpdateManyWithoutWebchatsNestedInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsUpdateManyWithoutWebchatsNestedInput;
    webchat_leads?: Prisma.webchat_leadsUpdateManyWithoutWebchatsNestedInput;
};
export type webchatsUncheckedUpdateWithoutWebchat_sessionsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    agent_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    slug?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    email_project_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    webchat_ads?: Prisma.webchat_adsUncheckedUpdateManyWithoutWebchatsNestedInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsUncheckedUpdateManyWithoutWebchatsNestedInput;
    webchat_leads?: Prisma.webchat_leadsUncheckedUpdateManyWithoutWebchatsNestedInput;
};
export type webchatsCreateManyOrganizationsInput = {
    id?: string;
    agent_id: string;
    name: string;
    slug: string;
    domain: string;
    email_project_id?: string | null;
    active?: boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type webchatsUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    slug?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    agentes_ia?: Prisma.agentes_iaUpdateOneRequiredWithoutWebchatsNestedInput;
    email_projects?: Prisma.email_projectsUpdateOneWithoutWebchatsNestedInput;
    webchat_ads?: Prisma.webchat_adsUpdateManyWithoutWebchatsNestedInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsUpdateManyWithoutWebchatsNestedInput;
    webchat_leads?: Prisma.webchat_leadsUpdateManyWithoutWebchatsNestedInput;
    webchat_sessions?: Prisma.webchat_sessionsUpdateManyWithoutWebchatsNestedInput;
};
export type webchatsUncheckedUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    agent_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    slug?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    email_project_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    webchat_ads?: Prisma.webchat_adsUncheckedUpdateManyWithoutWebchatsNestedInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsUncheckedUpdateManyWithoutWebchatsNestedInput;
    webchat_leads?: Prisma.webchat_leadsUncheckedUpdateManyWithoutWebchatsNestedInput;
    webchat_sessions?: Prisma.webchat_sessionsUncheckedUpdateManyWithoutWebchatsNestedInput;
};
export type webchatsUncheckedUpdateManyWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    agent_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    slug?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    email_project_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchatsCreateManyEmail_projectsInput = {
    id?: string;
    organization_id: string;
    agent_id: string;
    name: string;
    slug: string;
    domain: string;
    active?: boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type webchatsUpdateWithoutEmail_projectsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    slug?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    agentes_ia?: Prisma.agentes_iaUpdateOneRequiredWithoutWebchatsNestedInput;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutWebchatsNestedInput;
    webchat_ads?: Prisma.webchat_adsUpdateManyWithoutWebchatsNestedInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsUpdateManyWithoutWebchatsNestedInput;
    webchat_leads?: Prisma.webchat_leadsUpdateManyWithoutWebchatsNestedInput;
    webchat_sessions?: Prisma.webchat_sessionsUpdateManyWithoutWebchatsNestedInput;
};
export type webchatsUncheckedUpdateWithoutEmail_projectsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    agent_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    slug?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    webchat_ads?: Prisma.webchat_adsUncheckedUpdateManyWithoutWebchatsNestedInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsUncheckedUpdateManyWithoutWebchatsNestedInput;
    webchat_leads?: Prisma.webchat_leadsUncheckedUpdateManyWithoutWebchatsNestedInput;
    webchat_sessions?: Prisma.webchat_sessionsUncheckedUpdateManyWithoutWebchatsNestedInput;
};
export type webchatsUncheckedUpdateManyWithoutEmail_projectsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    agent_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    slug?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type webchatsCreateManyAgentes_iaInput = {
    id?: string;
    organization_id: string;
    name: string;
    slug: string;
    domain: string;
    email_project_id?: string | null;
    active?: boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type webchatsUpdateWithoutAgentes_iaInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    slug?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    email_projects?: Prisma.email_projectsUpdateOneWithoutWebchatsNestedInput;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutWebchatsNestedInput;
    webchat_ads?: Prisma.webchat_adsUpdateManyWithoutWebchatsNestedInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsUpdateManyWithoutWebchatsNestedInput;
    webchat_leads?: Prisma.webchat_leadsUpdateManyWithoutWebchatsNestedInput;
    webchat_sessions?: Prisma.webchat_sessionsUpdateManyWithoutWebchatsNestedInput;
};
export type webchatsUncheckedUpdateWithoutAgentes_iaInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    slug?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    email_project_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    webchat_ads?: Prisma.webchat_adsUncheckedUpdateManyWithoutWebchatsNestedInput;
    webchat_ad_events?: Prisma.webchat_ad_eventsUncheckedUpdateManyWithoutWebchatsNestedInput;
    webchat_leads?: Prisma.webchat_leadsUncheckedUpdateManyWithoutWebchatsNestedInput;
    webchat_sessions?: Prisma.webchat_sessionsUncheckedUpdateManyWithoutWebchatsNestedInput;
};
export type webchatsUncheckedUpdateManyWithoutAgentes_iaInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    slug?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    email_project_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    settings?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    header_scripts?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ads_config?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type WebchatsCountOutputType = {
    webchat_ads: number;
    webchat_ad_events: number;
    webchat_leads: number;
    webchat_sessions: number;
};
export type WebchatsCountOutputTypeSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    webchat_ads?: boolean | WebchatsCountOutputTypeCountWebchat_adsArgs;
    webchat_ad_events?: boolean | WebchatsCountOutputTypeCountWebchat_ad_eventsArgs;
    webchat_leads?: boolean | WebchatsCountOutputTypeCountWebchat_leadsArgs;
    webchat_sessions?: boolean | WebchatsCountOutputTypeCountWebchat_sessionsArgs;
};
export type WebchatsCountOutputTypeDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.WebchatsCountOutputTypeSelect<ExtArgs> | null;
};
export type WebchatsCountOutputTypeCountWebchat_adsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.webchat_adsWhereInput;
};
export type WebchatsCountOutputTypeCountWebchat_ad_eventsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.webchat_ad_eventsWhereInput;
};
export type WebchatsCountOutputTypeCountWebchat_leadsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.webchat_leadsWhereInput;
};
export type WebchatsCountOutputTypeCountWebchat_sessionsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.webchat_sessionsWhereInput;
};
export type webchatsSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    organization_id?: boolean;
    agent_id?: boolean;
    name?: boolean;
    slug?: boolean;
    domain?: boolean;
    email_project_id?: boolean;
    active?: boolean;
    settings?: boolean;
    header_scripts?: boolean;
    ads_config?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    agentes_ia?: boolean | Prisma.agentes_iaDefaultArgs<ExtArgs>;
    email_projects?: boolean | Prisma.webchats$email_projectsArgs<ExtArgs>;
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
    webchat_ads?: boolean | Prisma.webchats$webchat_adsArgs<ExtArgs>;
    webchat_ad_events?: boolean | Prisma.webchats$webchat_ad_eventsArgs<ExtArgs>;
    webchat_leads?: boolean | Prisma.webchats$webchat_leadsArgs<ExtArgs>;
    webchat_sessions?: boolean | Prisma.webchats$webchat_sessionsArgs<ExtArgs>;
    _count?: boolean | Prisma.WebchatsCountOutputTypeDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["webchats"]>;
export type webchatsSelectScalar = {
    id?: boolean;
    organization_id?: boolean;
    agent_id?: boolean;
    name?: boolean;
    slug?: boolean;
    domain?: boolean;
    email_project_id?: boolean;
    active?: boolean;
    settings?: boolean;
    header_scripts?: boolean;
    ads_config?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
};
export type webchatsOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "organization_id" | "agent_id" | "name" | "slug" | "domain" | "email_project_id" | "active" | "settings" | "header_scripts" | "ads_config" | "created_at" | "updated_at", ExtArgs["result"]["webchats"]>;
export type webchatsInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    agentes_ia?: boolean | Prisma.agentes_iaDefaultArgs<ExtArgs>;
    email_projects?: boolean | Prisma.webchats$email_projectsArgs<ExtArgs>;
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
    webchat_ads?: boolean | Prisma.webchats$webchat_adsArgs<ExtArgs>;
    webchat_ad_events?: boolean | Prisma.webchats$webchat_ad_eventsArgs<ExtArgs>;
    webchat_leads?: boolean | Prisma.webchats$webchat_leadsArgs<ExtArgs>;
    webchat_sessions?: boolean | Prisma.webchats$webchat_sessionsArgs<ExtArgs>;
    _count?: boolean | Prisma.WebchatsCountOutputTypeDefaultArgs<ExtArgs>;
};
export type $webchatsPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "webchats";
    objects: {
        agentes_ia: Prisma.$agentes_iaPayload<ExtArgs>;
        email_projects: Prisma.$email_projectsPayload<ExtArgs> | null;
        organizations: Prisma.$organizationsPayload<ExtArgs>;
        webchat_ads: Prisma.$webchat_adsPayload<ExtArgs>[];
        webchat_ad_events: Prisma.$webchat_ad_eventsPayload<ExtArgs>[];
        webchat_leads: Prisma.$webchat_leadsPayload<ExtArgs>[];
        webchat_sessions: Prisma.$webchat_sessionsPayload<ExtArgs>[];
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        organization_id: string;
        agent_id: string;
        name: string;
        slug: string;
        domain: string;
        email_project_id: string | null;
        active: boolean;
        settings: runtime.JsonValue | null;
        header_scripts: string | null;
        ads_config: runtime.JsonValue | null;
        created_at: Date;
        updated_at: Date;
    }, ExtArgs["result"]["webchats"]>;
    composites: {};
};
export type webchatsGetPayload<S extends boolean | null | undefined | webchatsDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$webchatsPayload, S>;
export type webchatsCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<webchatsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: WebchatsCountAggregateInputType | true;
};
export interface webchatsDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['webchats'];
        meta: {
            name: 'webchats';
        };
    };
    findUnique<T extends webchatsFindUniqueArgs>(args: Prisma.SelectSubset<T, webchatsFindUniqueArgs<ExtArgs>>): Prisma.Prisma__webchatsClient<runtime.Types.Result.GetResult<Prisma.$webchatsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends webchatsFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, webchatsFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__webchatsClient<runtime.Types.Result.GetResult<Prisma.$webchatsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends webchatsFindFirstArgs>(args?: Prisma.SelectSubset<T, webchatsFindFirstArgs<ExtArgs>>): Prisma.Prisma__webchatsClient<runtime.Types.Result.GetResult<Prisma.$webchatsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends webchatsFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, webchatsFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__webchatsClient<runtime.Types.Result.GetResult<Prisma.$webchatsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends webchatsFindManyArgs>(args?: Prisma.SelectSubset<T, webchatsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$webchatsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends webchatsCreateArgs>(args: Prisma.SelectSubset<T, webchatsCreateArgs<ExtArgs>>): Prisma.Prisma__webchatsClient<runtime.Types.Result.GetResult<Prisma.$webchatsPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends webchatsCreateManyArgs>(args?: Prisma.SelectSubset<T, webchatsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends webchatsDeleteArgs>(args: Prisma.SelectSubset<T, webchatsDeleteArgs<ExtArgs>>): Prisma.Prisma__webchatsClient<runtime.Types.Result.GetResult<Prisma.$webchatsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends webchatsUpdateArgs>(args: Prisma.SelectSubset<T, webchatsUpdateArgs<ExtArgs>>): Prisma.Prisma__webchatsClient<runtime.Types.Result.GetResult<Prisma.$webchatsPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends webchatsDeleteManyArgs>(args?: Prisma.SelectSubset<T, webchatsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends webchatsUpdateManyArgs>(args: Prisma.SelectSubset<T, webchatsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends webchatsUpsertArgs>(args: Prisma.SelectSubset<T, webchatsUpsertArgs<ExtArgs>>): Prisma.Prisma__webchatsClient<runtime.Types.Result.GetResult<Prisma.$webchatsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends webchatsCountArgs>(args?: Prisma.Subset<T, webchatsCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], WebchatsCountAggregateOutputType> : number>;
    aggregate<T extends WebchatsAggregateArgs>(args: Prisma.Subset<T, WebchatsAggregateArgs>): Prisma.PrismaPromise<GetWebchatsAggregateType<T>>;
    groupBy<T extends webchatsGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: webchatsGroupByArgs['orderBy'];
    } : {
        orderBy?: webchatsGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, webchatsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetWebchatsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: webchatsFieldRefs;
}
export interface Prisma__webchatsClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    agentes_ia<T extends Prisma.agentes_iaDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.agentes_iaDefaultArgs<ExtArgs>>): Prisma.Prisma__agentes_iaClient<runtime.Types.Result.GetResult<Prisma.$agentes_iaPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    email_projects<T extends Prisma.webchats$email_projectsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.webchats$email_projectsArgs<ExtArgs>>): Prisma.Prisma__email_projectsClient<runtime.Types.Result.GetResult<Prisma.$email_projectsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    organizations<T extends Prisma.organizationsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.organizationsDefaultArgs<ExtArgs>>): Prisma.Prisma__organizationsClient<runtime.Types.Result.GetResult<Prisma.$organizationsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    webchat_ads<T extends Prisma.webchats$webchat_adsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.webchats$webchat_adsArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$webchat_adsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    webchat_ad_events<T extends Prisma.webchats$webchat_ad_eventsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.webchats$webchat_ad_eventsArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$webchat_ad_eventsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    webchat_leads<T extends Prisma.webchats$webchat_leadsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.webchats$webchat_leadsArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$webchat_leadsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    webchat_sessions<T extends Prisma.webchats$webchat_sessionsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.webchats$webchat_sessionsArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$webchat_sessionsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface webchatsFieldRefs {
    readonly id: Prisma.FieldRef<"webchats", 'String'>;
    readonly organization_id: Prisma.FieldRef<"webchats", 'String'>;
    readonly agent_id: Prisma.FieldRef<"webchats", 'String'>;
    readonly name: Prisma.FieldRef<"webchats", 'String'>;
    readonly slug: Prisma.FieldRef<"webchats", 'String'>;
    readonly domain: Prisma.FieldRef<"webchats", 'String'>;
    readonly email_project_id: Prisma.FieldRef<"webchats", 'String'>;
    readonly active: Prisma.FieldRef<"webchats", 'Boolean'>;
    readonly settings: Prisma.FieldRef<"webchats", 'Json'>;
    readonly header_scripts: Prisma.FieldRef<"webchats", 'String'>;
    readonly ads_config: Prisma.FieldRef<"webchats", 'Json'>;
    readonly created_at: Prisma.FieldRef<"webchats", 'DateTime'>;
    readonly updated_at: Prisma.FieldRef<"webchats", 'DateTime'>;
}
export type webchatsFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchatsSelect<ExtArgs> | null;
    omit?: Prisma.webchatsOmit<ExtArgs> | null;
    include?: Prisma.webchatsInclude<ExtArgs> | null;
    where: Prisma.webchatsWhereUniqueInput;
};
export type webchatsFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchatsSelect<ExtArgs> | null;
    omit?: Prisma.webchatsOmit<ExtArgs> | null;
    include?: Prisma.webchatsInclude<ExtArgs> | null;
    where: Prisma.webchatsWhereUniqueInput;
};
export type webchatsFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type webchatsFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type webchatsFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type webchatsCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchatsSelect<ExtArgs> | null;
    omit?: Prisma.webchatsOmit<ExtArgs> | null;
    include?: Prisma.webchatsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.webchatsCreateInput, Prisma.webchatsUncheckedCreateInput>;
};
export type webchatsCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.webchatsCreateManyInput | Prisma.webchatsCreateManyInput[];
    skipDuplicates?: boolean;
};
export type webchatsUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchatsSelect<ExtArgs> | null;
    omit?: Prisma.webchatsOmit<ExtArgs> | null;
    include?: Prisma.webchatsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.webchatsUpdateInput, Prisma.webchatsUncheckedUpdateInput>;
    where: Prisma.webchatsWhereUniqueInput;
};
export type webchatsUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.webchatsUpdateManyMutationInput, Prisma.webchatsUncheckedUpdateManyInput>;
    where?: Prisma.webchatsWhereInput;
    limit?: number;
};
export type webchatsUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchatsSelect<ExtArgs> | null;
    omit?: Prisma.webchatsOmit<ExtArgs> | null;
    include?: Prisma.webchatsInclude<ExtArgs> | null;
    where: Prisma.webchatsWhereUniqueInput;
    create: Prisma.XOR<Prisma.webchatsCreateInput, Prisma.webchatsUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.webchatsUpdateInput, Prisma.webchatsUncheckedUpdateInput>;
};
export type webchatsDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchatsSelect<ExtArgs> | null;
    omit?: Prisma.webchatsOmit<ExtArgs> | null;
    include?: Prisma.webchatsInclude<ExtArgs> | null;
    where: Prisma.webchatsWhereUniqueInput;
};
export type webchatsDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.webchatsWhereInput;
    limit?: number;
};
export type webchats$email_projectsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_projectsSelect<ExtArgs> | null;
    omit?: Prisma.email_projectsOmit<ExtArgs> | null;
    include?: Prisma.email_projectsInclude<ExtArgs> | null;
    where?: Prisma.email_projectsWhereInput;
};
export type webchats$webchat_adsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type webchats$webchat_ad_eventsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type webchats$webchat_leadsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type webchats$webchat_sessionsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type webchatsDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.webchatsSelect<ExtArgs> | null;
    omit?: Prisma.webchatsOmit<ExtArgs> | null;
    include?: Prisma.webchatsInclude<ExtArgs> | null;
};
export {};
