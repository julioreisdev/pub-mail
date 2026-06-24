import type * as runtime from "@prisma/client/runtime/client";
import type * as $Enums from "../enums.js";
import type * as Prisma from "../internal/prismaNamespace.js";
export type organization_domainsModel = runtime.Types.Result.DefaultSelection<Prisma.$organization_domainsPayload>;
export type AggregateOrganization_domains = {
    _count: Organization_domainsCountAggregateOutputType | null;
    _min: Organization_domainsMinAggregateOutputType | null;
    _max: Organization_domainsMaxAggregateOutputType | null;
};
export type Organization_domainsMinAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    domain: string | null;
    status: $Enums.domain_status | null;
    created_at: Date | null;
    updated_at: Date | null;
    provider_id: string | null;
};
export type Organization_domainsMaxAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    domain: string | null;
    status: $Enums.domain_status | null;
    created_at: Date | null;
    updated_at: Date | null;
    provider_id: string | null;
};
export type Organization_domainsCountAggregateOutputType = {
    id: number;
    organization_id: number;
    domain: number;
    status: number;
    created_at: number;
    updated_at: number;
    provider_id: number;
    dns_records: number;
    _all: number;
};
export type Organization_domainsMinAggregateInputType = {
    id?: true;
    organization_id?: true;
    domain?: true;
    status?: true;
    created_at?: true;
    updated_at?: true;
    provider_id?: true;
};
export type Organization_domainsMaxAggregateInputType = {
    id?: true;
    organization_id?: true;
    domain?: true;
    status?: true;
    created_at?: true;
    updated_at?: true;
    provider_id?: true;
};
export type Organization_domainsCountAggregateInputType = {
    id?: true;
    organization_id?: true;
    domain?: true;
    status?: true;
    created_at?: true;
    updated_at?: true;
    provider_id?: true;
    dns_records?: true;
    _all?: true;
};
export type Organization_domainsAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.organization_domainsWhereInput;
    orderBy?: Prisma.organization_domainsOrderByWithRelationInput | Prisma.organization_domainsOrderByWithRelationInput[];
    cursor?: Prisma.organization_domainsWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | Organization_domainsCountAggregateInputType;
    _min?: Organization_domainsMinAggregateInputType;
    _max?: Organization_domainsMaxAggregateInputType;
};
export type GetOrganization_domainsAggregateType<T extends Organization_domainsAggregateArgs> = {
    [P in keyof T & keyof AggregateOrganization_domains]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateOrganization_domains[P]> : Prisma.GetScalarType<T[P], AggregateOrganization_domains[P]>;
};
export type organization_domainsGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.organization_domainsWhereInput;
    orderBy?: Prisma.organization_domainsOrderByWithAggregationInput | Prisma.organization_domainsOrderByWithAggregationInput[];
    by: Prisma.Organization_domainsScalarFieldEnum[] | Prisma.Organization_domainsScalarFieldEnum;
    having?: Prisma.organization_domainsScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: Organization_domainsCountAggregateInputType | true;
    _min?: Organization_domainsMinAggregateInputType;
    _max?: Organization_domainsMaxAggregateInputType;
};
export type Organization_domainsGroupByOutputType = {
    id: string;
    organization_id: string;
    domain: string;
    status: $Enums.domain_status;
    created_at: Date;
    updated_at: Date;
    provider_id: string | null;
    dns_records: runtime.JsonValue | null;
    _count: Organization_domainsCountAggregateOutputType | null;
    _min: Organization_domainsMinAggregateOutputType | null;
    _max: Organization_domainsMaxAggregateOutputType | null;
};
type GetOrganization_domainsGroupByPayload<T extends organization_domainsGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<Organization_domainsGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof Organization_domainsGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], Organization_domainsGroupByOutputType[P]> : Prisma.GetScalarType<T[P], Organization_domainsGroupByOutputType[P]>;
}>>;
export type organization_domainsWhereInput = {
    AND?: Prisma.organization_domainsWhereInput | Prisma.organization_domainsWhereInput[];
    OR?: Prisma.organization_domainsWhereInput[];
    NOT?: Prisma.organization_domainsWhereInput | Prisma.organization_domainsWhereInput[];
    id?: Prisma.StringFilter<"organization_domains"> | string;
    organization_id?: Prisma.StringFilter<"organization_domains"> | string;
    domain?: Prisma.StringFilter<"organization_domains"> | string;
    status?: Prisma.Enumdomain_statusFilter<"organization_domains"> | $Enums.domain_status;
    created_at?: Prisma.DateTimeFilter<"organization_domains"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"organization_domains"> | Date | string;
    provider_id?: Prisma.StringNullableFilter<"organization_domains"> | string | null;
    dns_records?: Prisma.JsonNullableFilter<"organization_domains">;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
};
export type organization_domainsOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    domain?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    provider_id?: Prisma.SortOrderInput | Prisma.SortOrder;
    dns_records?: Prisma.SortOrderInput | Prisma.SortOrder;
    organizations?: Prisma.organizationsOrderByWithRelationInput;
    _relevance?: Prisma.organization_domainsOrderByRelevanceInput;
};
export type organization_domainsWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    organization_id_domain?: Prisma.organization_domainsOrganization_idDomainCompoundUniqueInput;
    AND?: Prisma.organization_domainsWhereInput | Prisma.organization_domainsWhereInput[];
    OR?: Prisma.organization_domainsWhereInput[];
    NOT?: Prisma.organization_domainsWhereInput | Prisma.organization_domainsWhereInput[];
    organization_id?: Prisma.StringFilter<"organization_domains"> | string;
    domain?: Prisma.StringFilter<"organization_domains"> | string;
    status?: Prisma.Enumdomain_statusFilter<"organization_domains"> | $Enums.domain_status;
    created_at?: Prisma.DateTimeFilter<"organization_domains"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"organization_domains"> | Date | string;
    provider_id?: Prisma.StringNullableFilter<"organization_domains"> | string | null;
    dns_records?: Prisma.JsonNullableFilter<"organization_domains">;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
}, "id" | "organization_id_domain">;
export type organization_domainsOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    domain?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    provider_id?: Prisma.SortOrderInput | Prisma.SortOrder;
    dns_records?: Prisma.SortOrderInput | Prisma.SortOrder;
    _count?: Prisma.organization_domainsCountOrderByAggregateInput;
    _max?: Prisma.organization_domainsMaxOrderByAggregateInput;
    _min?: Prisma.organization_domainsMinOrderByAggregateInput;
};
export type organization_domainsScalarWhereWithAggregatesInput = {
    AND?: Prisma.organization_domainsScalarWhereWithAggregatesInput | Prisma.organization_domainsScalarWhereWithAggregatesInput[];
    OR?: Prisma.organization_domainsScalarWhereWithAggregatesInput[];
    NOT?: Prisma.organization_domainsScalarWhereWithAggregatesInput | Prisma.organization_domainsScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"organization_domains"> | string;
    organization_id?: Prisma.StringWithAggregatesFilter<"organization_domains"> | string;
    domain?: Prisma.StringWithAggregatesFilter<"organization_domains"> | string;
    status?: Prisma.Enumdomain_statusWithAggregatesFilter<"organization_domains"> | $Enums.domain_status;
    created_at?: Prisma.DateTimeWithAggregatesFilter<"organization_domains"> | Date | string;
    updated_at?: Prisma.DateTimeWithAggregatesFilter<"organization_domains"> | Date | string;
    provider_id?: Prisma.StringNullableWithAggregatesFilter<"organization_domains"> | string | null;
    dns_records?: Prisma.JsonNullableWithAggregatesFilter<"organization_domains">;
};
export type organization_domainsCreateInput = {
    id?: string;
    domain: string;
    status?: $Enums.domain_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    provider_id?: string | null;
    dns_records?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    organizations: Prisma.organizationsCreateNestedOneWithoutOrganization_domainsInput;
};
export type organization_domainsUncheckedCreateInput = {
    id?: string;
    organization_id: string;
    domain: string;
    status?: $Enums.domain_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    provider_id?: string | null;
    dns_records?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type organization_domainsUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    status?: Prisma.Enumdomain_statusFieldUpdateOperationsInput | $Enums.domain_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    provider_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    dns_records?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutOrganization_domainsNestedInput;
};
export type organization_domainsUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    status?: Prisma.Enumdomain_statusFieldUpdateOperationsInput | $Enums.domain_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    provider_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    dns_records?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type organization_domainsCreateManyInput = {
    id?: string;
    organization_id: string;
    domain: string;
    status?: $Enums.domain_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    provider_id?: string | null;
    dns_records?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type organization_domainsUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    status?: Prisma.Enumdomain_statusFieldUpdateOperationsInput | $Enums.domain_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    provider_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    dns_records?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type organization_domainsUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    status?: Prisma.Enumdomain_statusFieldUpdateOperationsInput | $Enums.domain_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    provider_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    dns_records?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type Organization_domainsListRelationFilter = {
    every?: Prisma.organization_domainsWhereInput;
    some?: Prisma.organization_domainsWhereInput;
    none?: Prisma.organization_domainsWhereInput;
};
export type organization_domainsOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type organization_domainsOrderByRelevanceInput = {
    fields: Prisma.organization_domainsOrderByRelevanceFieldEnum | Prisma.organization_domainsOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type organization_domainsOrganization_idDomainCompoundUniqueInput = {
    organization_id: string;
    domain: string;
};
export type organization_domainsCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    domain?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    provider_id?: Prisma.SortOrder;
    dns_records?: Prisma.SortOrder;
};
export type organization_domainsMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    domain?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    provider_id?: Prisma.SortOrder;
};
export type organization_domainsMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    domain?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    provider_id?: Prisma.SortOrder;
};
export type organization_domainsCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.organization_domainsCreateWithoutOrganizationsInput, Prisma.organization_domainsUncheckedCreateWithoutOrganizationsInput> | Prisma.organization_domainsCreateWithoutOrganizationsInput[] | Prisma.organization_domainsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.organization_domainsCreateOrConnectWithoutOrganizationsInput | Prisma.organization_domainsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.organization_domainsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.organization_domainsWhereUniqueInput | Prisma.organization_domainsWhereUniqueInput[];
};
export type organization_domainsUncheckedCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.organization_domainsCreateWithoutOrganizationsInput, Prisma.organization_domainsUncheckedCreateWithoutOrganizationsInput> | Prisma.organization_domainsCreateWithoutOrganizationsInput[] | Prisma.organization_domainsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.organization_domainsCreateOrConnectWithoutOrganizationsInput | Prisma.organization_domainsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.organization_domainsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.organization_domainsWhereUniqueInput | Prisma.organization_domainsWhereUniqueInput[];
};
export type organization_domainsUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.organization_domainsCreateWithoutOrganizationsInput, Prisma.organization_domainsUncheckedCreateWithoutOrganizationsInput> | Prisma.organization_domainsCreateWithoutOrganizationsInput[] | Prisma.organization_domainsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.organization_domainsCreateOrConnectWithoutOrganizationsInput | Prisma.organization_domainsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.organization_domainsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.organization_domainsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.organization_domainsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.organization_domainsWhereUniqueInput | Prisma.organization_domainsWhereUniqueInput[];
    disconnect?: Prisma.organization_domainsWhereUniqueInput | Prisma.organization_domainsWhereUniqueInput[];
    delete?: Prisma.organization_domainsWhereUniqueInput | Prisma.organization_domainsWhereUniqueInput[];
    connect?: Prisma.organization_domainsWhereUniqueInput | Prisma.organization_domainsWhereUniqueInput[];
    update?: Prisma.organization_domainsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.organization_domainsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.organization_domainsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.organization_domainsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.organization_domainsScalarWhereInput | Prisma.organization_domainsScalarWhereInput[];
};
export type organization_domainsUncheckedUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.organization_domainsCreateWithoutOrganizationsInput, Prisma.organization_domainsUncheckedCreateWithoutOrganizationsInput> | Prisma.organization_domainsCreateWithoutOrganizationsInput[] | Prisma.organization_domainsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.organization_domainsCreateOrConnectWithoutOrganizationsInput | Prisma.organization_domainsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.organization_domainsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.organization_domainsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.organization_domainsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.organization_domainsWhereUniqueInput | Prisma.organization_domainsWhereUniqueInput[];
    disconnect?: Prisma.organization_domainsWhereUniqueInput | Prisma.organization_domainsWhereUniqueInput[];
    delete?: Prisma.organization_domainsWhereUniqueInput | Prisma.organization_domainsWhereUniqueInput[];
    connect?: Prisma.organization_domainsWhereUniqueInput | Prisma.organization_domainsWhereUniqueInput[];
    update?: Prisma.organization_domainsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.organization_domainsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.organization_domainsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.organization_domainsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.organization_domainsScalarWhereInput | Prisma.organization_domainsScalarWhereInput[];
};
export type Enumdomain_statusFieldUpdateOperationsInput = {
    set?: $Enums.domain_status;
};
export type organization_domainsCreateWithoutOrganizationsInput = {
    id?: string;
    domain: string;
    status?: $Enums.domain_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    provider_id?: string | null;
    dns_records?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type organization_domainsUncheckedCreateWithoutOrganizationsInput = {
    id?: string;
    domain: string;
    status?: $Enums.domain_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    provider_id?: string | null;
    dns_records?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type organization_domainsCreateOrConnectWithoutOrganizationsInput = {
    where: Prisma.organization_domainsWhereUniqueInput;
    create: Prisma.XOR<Prisma.organization_domainsCreateWithoutOrganizationsInput, Prisma.organization_domainsUncheckedCreateWithoutOrganizationsInput>;
};
export type organization_domainsCreateManyOrganizationsInputEnvelope = {
    data: Prisma.organization_domainsCreateManyOrganizationsInput | Prisma.organization_domainsCreateManyOrganizationsInput[];
    skipDuplicates?: boolean;
};
export type organization_domainsUpsertWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.organization_domainsWhereUniqueInput;
    update: Prisma.XOR<Prisma.organization_domainsUpdateWithoutOrganizationsInput, Prisma.organization_domainsUncheckedUpdateWithoutOrganizationsInput>;
    create: Prisma.XOR<Prisma.organization_domainsCreateWithoutOrganizationsInput, Prisma.organization_domainsUncheckedCreateWithoutOrganizationsInput>;
};
export type organization_domainsUpdateWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.organization_domainsWhereUniqueInput;
    data: Prisma.XOR<Prisma.organization_domainsUpdateWithoutOrganizationsInput, Prisma.organization_domainsUncheckedUpdateWithoutOrganizationsInput>;
};
export type organization_domainsUpdateManyWithWhereWithoutOrganizationsInput = {
    where: Prisma.organization_domainsScalarWhereInput;
    data: Prisma.XOR<Prisma.organization_domainsUpdateManyMutationInput, Prisma.organization_domainsUncheckedUpdateManyWithoutOrganizationsInput>;
};
export type organization_domainsScalarWhereInput = {
    AND?: Prisma.organization_domainsScalarWhereInput | Prisma.organization_domainsScalarWhereInput[];
    OR?: Prisma.organization_domainsScalarWhereInput[];
    NOT?: Prisma.organization_domainsScalarWhereInput | Prisma.organization_domainsScalarWhereInput[];
    id?: Prisma.StringFilter<"organization_domains"> | string;
    organization_id?: Prisma.StringFilter<"organization_domains"> | string;
    domain?: Prisma.StringFilter<"organization_domains"> | string;
    status?: Prisma.Enumdomain_statusFilter<"organization_domains"> | $Enums.domain_status;
    created_at?: Prisma.DateTimeFilter<"organization_domains"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"organization_domains"> | Date | string;
    provider_id?: Prisma.StringNullableFilter<"organization_domains"> | string | null;
    dns_records?: Prisma.JsonNullableFilter<"organization_domains">;
};
export type organization_domainsCreateManyOrganizationsInput = {
    id?: string;
    domain: string;
    status?: $Enums.domain_status;
    created_at?: Date | string;
    updated_at?: Date | string;
    provider_id?: string | null;
    dns_records?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type organization_domainsUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    status?: Prisma.Enumdomain_statusFieldUpdateOperationsInput | $Enums.domain_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    provider_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    dns_records?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type organization_domainsUncheckedUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    status?: Prisma.Enumdomain_statusFieldUpdateOperationsInput | $Enums.domain_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    provider_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    dns_records?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type organization_domainsUncheckedUpdateManyWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    domain?: Prisma.StringFieldUpdateOperationsInput | string;
    status?: Prisma.Enumdomain_statusFieldUpdateOperationsInput | $Enums.domain_status;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    provider_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    dns_records?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
};
export type organization_domainsSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    organization_id?: boolean;
    domain?: boolean;
    status?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    provider_id?: boolean;
    dns_records?: boolean;
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["organization_domains"]>;
export type organization_domainsSelectScalar = {
    id?: boolean;
    organization_id?: boolean;
    domain?: boolean;
    status?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    provider_id?: boolean;
    dns_records?: boolean;
};
export type organization_domainsOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "organization_id" | "domain" | "status" | "created_at" | "updated_at" | "provider_id" | "dns_records", ExtArgs["result"]["organization_domains"]>;
export type organization_domainsInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
};
export type $organization_domainsPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "organization_domains";
    objects: {
        organizations: Prisma.$organizationsPayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        organization_id: string;
        domain: string;
        status: $Enums.domain_status;
        created_at: Date;
        updated_at: Date;
        provider_id: string | null;
        dns_records: runtime.JsonValue | null;
    }, ExtArgs["result"]["organization_domains"]>;
    composites: {};
};
export type organization_domainsGetPayload<S extends boolean | null | undefined | organization_domainsDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$organization_domainsPayload, S>;
export type organization_domainsCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<organization_domainsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: Organization_domainsCountAggregateInputType | true;
};
export interface organization_domainsDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['organization_domains'];
        meta: {
            name: 'organization_domains';
        };
    };
    findUnique<T extends organization_domainsFindUniqueArgs>(args: Prisma.SelectSubset<T, organization_domainsFindUniqueArgs<ExtArgs>>): Prisma.Prisma__organization_domainsClient<runtime.Types.Result.GetResult<Prisma.$organization_domainsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends organization_domainsFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, organization_domainsFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__organization_domainsClient<runtime.Types.Result.GetResult<Prisma.$organization_domainsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends organization_domainsFindFirstArgs>(args?: Prisma.SelectSubset<T, organization_domainsFindFirstArgs<ExtArgs>>): Prisma.Prisma__organization_domainsClient<runtime.Types.Result.GetResult<Prisma.$organization_domainsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends organization_domainsFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, organization_domainsFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__organization_domainsClient<runtime.Types.Result.GetResult<Prisma.$organization_domainsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends organization_domainsFindManyArgs>(args?: Prisma.SelectSubset<T, organization_domainsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$organization_domainsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends organization_domainsCreateArgs>(args: Prisma.SelectSubset<T, organization_domainsCreateArgs<ExtArgs>>): Prisma.Prisma__organization_domainsClient<runtime.Types.Result.GetResult<Prisma.$organization_domainsPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends organization_domainsCreateManyArgs>(args?: Prisma.SelectSubset<T, organization_domainsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends organization_domainsDeleteArgs>(args: Prisma.SelectSubset<T, organization_domainsDeleteArgs<ExtArgs>>): Prisma.Prisma__organization_domainsClient<runtime.Types.Result.GetResult<Prisma.$organization_domainsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends organization_domainsUpdateArgs>(args: Prisma.SelectSubset<T, organization_domainsUpdateArgs<ExtArgs>>): Prisma.Prisma__organization_domainsClient<runtime.Types.Result.GetResult<Prisma.$organization_domainsPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends organization_domainsDeleteManyArgs>(args?: Prisma.SelectSubset<T, organization_domainsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends organization_domainsUpdateManyArgs>(args: Prisma.SelectSubset<T, organization_domainsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends organization_domainsUpsertArgs>(args: Prisma.SelectSubset<T, organization_domainsUpsertArgs<ExtArgs>>): Prisma.Prisma__organization_domainsClient<runtime.Types.Result.GetResult<Prisma.$organization_domainsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends organization_domainsCountArgs>(args?: Prisma.Subset<T, organization_domainsCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], Organization_domainsCountAggregateOutputType> : number>;
    aggregate<T extends Organization_domainsAggregateArgs>(args: Prisma.Subset<T, Organization_domainsAggregateArgs>): Prisma.PrismaPromise<GetOrganization_domainsAggregateType<T>>;
    groupBy<T extends organization_domainsGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: organization_domainsGroupByArgs['orderBy'];
    } : {
        orderBy?: organization_domainsGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, organization_domainsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetOrganization_domainsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: organization_domainsFieldRefs;
}
export interface Prisma__organization_domainsClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    organizations<T extends Prisma.organizationsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.organizationsDefaultArgs<ExtArgs>>): Prisma.Prisma__organizationsClient<runtime.Types.Result.GetResult<Prisma.$organizationsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface organization_domainsFieldRefs {
    readonly id: Prisma.FieldRef<"organization_domains", 'String'>;
    readonly organization_id: Prisma.FieldRef<"organization_domains", 'String'>;
    readonly domain: Prisma.FieldRef<"organization_domains", 'String'>;
    readonly status: Prisma.FieldRef<"organization_domains", 'domain_status'>;
    readonly created_at: Prisma.FieldRef<"organization_domains", 'DateTime'>;
    readonly updated_at: Prisma.FieldRef<"organization_domains", 'DateTime'>;
    readonly provider_id: Prisma.FieldRef<"organization_domains", 'String'>;
    readonly dns_records: Prisma.FieldRef<"organization_domains", 'Json'>;
}
export type organization_domainsFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.organization_domainsSelect<ExtArgs> | null;
    omit?: Prisma.organization_domainsOmit<ExtArgs> | null;
    include?: Prisma.organization_domainsInclude<ExtArgs> | null;
    where: Prisma.organization_domainsWhereUniqueInput;
};
export type organization_domainsFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.organization_domainsSelect<ExtArgs> | null;
    omit?: Prisma.organization_domainsOmit<ExtArgs> | null;
    include?: Prisma.organization_domainsInclude<ExtArgs> | null;
    where: Prisma.organization_domainsWhereUniqueInput;
};
export type organization_domainsFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.organization_domainsSelect<ExtArgs> | null;
    omit?: Prisma.organization_domainsOmit<ExtArgs> | null;
    include?: Prisma.organization_domainsInclude<ExtArgs> | null;
    where?: Prisma.organization_domainsWhereInput;
    orderBy?: Prisma.organization_domainsOrderByWithRelationInput | Prisma.organization_domainsOrderByWithRelationInput[];
    cursor?: Prisma.organization_domainsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Organization_domainsScalarFieldEnum | Prisma.Organization_domainsScalarFieldEnum[];
};
export type organization_domainsFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.organization_domainsSelect<ExtArgs> | null;
    omit?: Prisma.organization_domainsOmit<ExtArgs> | null;
    include?: Prisma.organization_domainsInclude<ExtArgs> | null;
    where?: Prisma.organization_domainsWhereInput;
    orderBy?: Prisma.organization_domainsOrderByWithRelationInput | Prisma.organization_domainsOrderByWithRelationInput[];
    cursor?: Prisma.organization_domainsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Organization_domainsScalarFieldEnum | Prisma.Organization_domainsScalarFieldEnum[];
};
export type organization_domainsFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.organization_domainsSelect<ExtArgs> | null;
    omit?: Prisma.organization_domainsOmit<ExtArgs> | null;
    include?: Prisma.organization_domainsInclude<ExtArgs> | null;
    where?: Prisma.organization_domainsWhereInput;
    orderBy?: Prisma.organization_domainsOrderByWithRelationInput | Prisma.organization_domainsOrderByWithRelationInput[];
    cursor?: Prisma.organization_domainsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Organization_domainsScalarFieldEnum | Prisma.Organization_domainsScalarFieldEnum[];
};
export type organization_domainsCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.organization_domainsSelect<ExtArgs> | null;
    omit?: Prisma.organization_domainsOmit<ExtArgs> | null;
    include?: Prisma.organization_domainsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.organization_domainsCreateInput, Prisma.organization_domainsUncheckedCreateInput>;
};
export type organization_domainsCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.organization_domainsCreateManyInput | Prisma.organization_domainsCreateManyInput[];
    skipDuplicates?: boolean;
};
export type organization_domainsUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.organization_domainsSelect<ExtArgs> | null;
    omit?: Prisma.organization_domainsOmit<ExtArgs> | null;
    include?: Prisma.organization_domainsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.organization_domainsUpdateInput, Prisma.organization_domainsUncheckedUpdateInput>;
    where: Prisma.organization_domainsWhereUniqueInput;
};
export type organization_domainsUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.organization_domainsUpdateManyMutationInput, Prisma.organization_domainsUncheckedUpdateManyInput>;
    where?: Prisma.organization_domainsWhereInput;
    limit?: number;
};
export type organization_domainsUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.organization_domainsSelect<ExtArgs> | null;
    omit?: Prisma.organization_domainsOmit<ExtArgs> | null;
    include?: Prisma.organization_domainsInclude<ExtArgs> | null;
    where: Prisma.organization_domainsWhereUniqueInput;
    create: Prisma.XOR<Prisma.organization_domainsCreateInput, Prisma.organization_domainsUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.organization_domainsUpdateInput, Prisma.organization_domainsUncheckedUpdateInput>;
};
export type organization_domainsDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.organization_domainsSelect<ExtArgs> | null;
    omit?: Prisma.organization_domainsOmit<ExtArgs> | null;
    include?: Prisma.organization_domainsInclude<ExtArgs> | null;
    where: Prisma.organization_domainsWhereUniqueInput;
};
export type organization_domainsDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.organization_domainsWhereInput;
    limit?: number;
};
export type organization_domainsDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.organization_domainsSelect<ExtArgs> | null;
    omit?: Prisma.organization_domainsOmit<ExtArgs> | null;
    include?: Prisma.organization_domainsInclude<ExtArgs> | null;
};
export {};
