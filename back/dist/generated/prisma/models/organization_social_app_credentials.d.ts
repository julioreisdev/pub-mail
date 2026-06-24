import type * as runtime from "@prisma/client/runtime/client";
import type * as $Enums from "../enums.js";
import type * as Prisma from "../internal/prismaNamespace.js";
export type organization_social_app_credentialsModel = runtime.Types.Result.DefaultSelection<Prisma.$organization_social_app_credentialsPayload>;
export type AggregateOrganization_social_app_credentials = {
    _count: Organization_social_app_credentialsCountAggregateOutputType | null;
    _min: Organization_social_app_credentialsMinAggregateOutputType | null;
    _max: Organization_social_app_credentialsMaxAggregateOutputType | null;
};
export type Organization_social_app_credentialsMinAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    social_network: $Enums.social_network | null;
    client_key: string | null;
    client_secret_encrypted: string | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type Organization_social_app_credentialsMaxAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    social_network: $Enums.social_network | null;
    client_key: string | null;
    client_secret_encrypted: string | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type Organization_social_app_credentialsCountAggregateOutputType = {
    id: number;
    organization_id: number;
    social_network: number;
    client_key: number;
    client_secret_encrypted: number;
    created_at: number;
    updated_at: number;
    _all: number;
};
export type Organization_social_app_credentialsMinAggregateInputType = {
    id?: true;
    organization_id?: true;
    social_network?: true;
    client_key?: true;
    client_secret_encrypted?: true;
    created_at?: true;
    updated_at?: true;
};
export type Organization_social_app_credentialsMaxAggregateInputType = {
    id?: true;
    organization_id?: true;
    social_network?: true;
    client_key?: true;
    client_secret_encrypted?: true;
    created_at?: true;
    updated_at?: true;
};
export type Organization_social_app_credentialsCountAggregateInputType = {
    id?: true;
    organization_id?: true;
    social_network?: true;
    client_key?: true;
    client_secret_encrypted?: true;
    created_at?: true;
    updated_at?: true;
    _all?: true;
};
export type Organization_social_app_credentialsAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.organization_social_app_credentialsWhereInput;
    orderBy?: Prisma.organization_social_app_credentialsOrderByWithRelationInput | Prisma.organization_social_app_credentialsOrderByWithRelationInput[];
    cursor?: Prisma.organization_social_app_credentialsWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | Organization_social_app_credentialsCountAggregateInputType;
    _min?: Organization_social_app_credentialsMinAggregateInputType;
    _max?: Organization_social_app_credentialsMaxAggregateInputType;
};
export type GetOrganization_social_app_credentialsAggregateType<T extends Organization_social_app_credentialsAggregateArgs> = {
    [P in keyof T & keyof AggregateOrganization_social_app_credentials]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateOrganization_social_app_credentials[P]> : Prisma.GetScalarType<T[P], AggregateOrganization_social_app_credentials[P]>;
};
export type organization_social_app_credentialsGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.organization_social_app_credentialsWhereInput;
    orderBy?: Prisma.organization_social_app_credentialsOrderByWithAggregationInput | Prisma.organization_social_app_credentialsOrderByWithAggregationInput[];
    by: Prisma.Organization_social_app_credentialsScalarFieldEnum[] | Prisma.Organization_social_app_credentialsScalarFieldEnum;
    having?: Prisma.organization_social_app_credentialsScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: Organization_social_app_credentialsCountAggregateInputType | true;
    _min?: Organization_social_app_credentialsMinAggregateInputType;
    _max?: Organization_social_app_credentialsMaxAggregateInputType;
};
export type Organization_social_app_credentialsGroupByOutputType = {
    id: string;
    organization_id: string;
    social_network: $Enums.social_network;
    client_key: string;
    client_secret_encrypted: string;
    created_at: Date;
    updated_at: Date;
    _count: Organization_social_app_credentialsCountAggregateOutputType | null;
    _min: Organization_social_app_credentialsMinAggregateOutputType | null;
    _max: Organization_social_app_credentialsMaxAggregateOutputType | null;
};
type GetOrganization_social_app_credentialsGroupByPayload<T extends organization_social_app_credentialsGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<Organization_social_app_credentialsGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof Organization_social_app_credentialsGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], Organization_social_app_credentialsGroupByOutputType[P]> : Prisma.GetScalarType<T[P], Organization_social_app_credentialsGroupByOutputType[P]>;
}>>;
export type organization_social_app_credentialsWhereInput = {
    AND?: Prisma.organization_social_app_credentialsWhereInput | Prisma.organization_social_app_credentialsWhereInput[];
    OR?: Prisma.organization_social_app_credentialsWhereInput[];
    NOT?: Prisma.organization_social_app_credentialsWhereInput | Prisma.organization_social_app_credentialsWhereInput[];
    id?: Prisma.StringFilter<"organization_social_app_credentials"> | string;
    organization_id?: Prisma.StringFilter<"organization_social_app_credentials"> | string;
    social_network?: Prisma.Enumsocial_networkFilter<"organization_social_app_credentials"> | $Enums.social_network;
    client_key?: Prisma.StringFilter<"organization_social_app_credentials"> | string;
    client_secret_encrypted?: Prisma.StringFilter<"organization_social_app_credentials"> | string;
    created_at?: Prisma.DateTimeFilter<"organization_social_app_credentials"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"organization_social_app_credentials"> | Date | string;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
};
export type organization_social_app_credentialsOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    social_network?: Prisma.SortOrder;
    client_key?: Prisma.SortOrder;
    client_secret_encrypted?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    organizations?: Prisma.organizationsOrderByWithRelationInput;
    _relevance?: Prisma.organization_social_app_credentialsOrderByRelevanceInput;
};
export type organization_social_app_credentialsWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    organization_id_social_network?: Prisma.organization_social_app_credentialsOrganization_idSocial_networkCompoundUniqueInput;
    AND?: Prisma.organization_social_app_credentialsWhereInput | Prisma.organization_social_app_credentialsWhereInput[];
    OR?: Prisma.organization_social_app_credentialsWhereInput[];
    NOT?: Prisma.organization_social_app_credentialsWhereInput | Prisma.organization_social_app_credentialsWhereInput[];
    organization_id?: Prisma.StringFilter<"organization_social_app_credentials"> | string;
    social_network?: Prisma.Enumsocial_networkFilter<"organization_social_app_credentials"> | $Enums.social_network;
    client_key?: Prisma.StringFilter<"organization_social_app_credentials"> | string;
    client_secret_encrypted?: Prisma.StringFilter<"organization_social_app_credentials"> | string;
    created_at?: Prisma.DateTimeFilter<"organization_social_app_credentials"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"organization_social_app_credentials"> | Date | string;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
}, "id" | "organization_id_social_network">;
export type organization_social_app_credentialsOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    social_network?: Prisma.SortOrder;
    client_key?: Prisma.SortOrder;
    client_secret_encrypted?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    _count?: Prisma.organization_social_app_credentialsCountOrderByAggregateInput;
    _max?: Prisma.organization_social_app_credentialsMaxOrderByAggregateInput;
    _min?: Prisma.organization_social_app_credentialsMinOrderByAggregateInput;
};
export type organization_social_app_credentialsScalarWhereWithAggregatesInput = {
    AND?: Prisma.organization_social_app_credentialsScalarWhereWithAggregatesInput | Prisma.organization_social_app_credentialsScalarWhereWithAggregatesInput[];
    OR?: Prisma.organization_social_app_credentialsScalarWhereWithAggregatesInput[];
    NOT?: Prisma.organization_social_app_credentialsScalarWhereWithAggregatesInput | Prisma.organization_social_app_credentialsScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"organization_social_app_credentials"> | string;
    organization_id?: Prisma.StringWithAggregatesFilter<"organization_social_app_credentials"> | string;
    social_network?: Prisma.Enumsocial_networkWithAggregatesFilter<"organization_social_app_credentials"> | $Enums.social_network;
    client_key?: Prisma.StringWithAggregatesFilter<"organization_social_app_credentials"> | string;
    client_secret_encrypted?: Prisma.StringWithAggregatesFilter<"organization_social_app_credentials"> | string;
    created_at?: Prisma.DateTimeWithAggregatesFilter<"organization_social_app_credentials"> | Date | string;
    updated_at?: Prisma.DateTimeWithAggregatesFilter<"organization_social_app_credentials"> | Date | string;
};
export type organization_social_app_credentialsCreateInput = {
    id?: string;
    social_network: $Enums.social_network;
    client_key: string;
    client_secret_encrypted: string;
    created_at?: Date | string;
    updated_at?: Date | string;
    organizations: Prisma.organizationsCreateNestedOneWithoutSocial_app_credentialsInput;
};
export type organization_social_app_credentialsUncheckedCreateInput = {
    id?: string;
    organization_id: string;
    social_network: $Enums.social_network;
    client_key: string;
    client_secret_encrypted: string;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type organization_social_app_credentialsUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    social_network?: Prisma.Enumsocial_networkFieldUpdateOperationsInput | $Enums.social_network;
    client_key?: Prisma.StringFieldUpdateOperationsInput | string;
    client_secret_encrypted?: Prisma.StringFieldUpdateOperationsInput | string;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutSocial_app_credentialsNestedInput;
};
export type organization_social_app_credentialsUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    social_network?: Prisma.Enumsocial_networkFieldUpdateOperationsInput | $Enums.social_network;
    client_key?: Prisma.StringFieldUpdateOperationsInput | string;
    client_secret_encrypted?: Prisma.StringFieldUpdateOperationsInput | string;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type organization_social_app_credentialsCreateManyInput = {
    id?: string;
    organization_id: string;
    social_network: $Enums.social_network;
    client_key: string;
    client_secret_encrypted: string;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type organization_social_app_credentialsUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    social_network?: Prisma.Enumsocial_networkFieldUpdateOperationsInput | $Enums.social_network;
    client_key?: Prisma.StringFieldUpdateOperationsInput | string;
    client_secret_encrypted?: Prisma.StringFieldUpdateOperationsInput | string;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type organization_social_app_credentialsUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    social_network?: Prisma.Enumsocial_networkFieldUpdateOperationsInput | $Enums.social_network;
    client_key?: Prisma.StringFieldUpdateOperationsInput | string;
    client_secret_encrypted?: Prisma.StringFieldUpdateOperationsInput | string;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type Organization_social_app_credentialsListRelationFilter = {
    every?: Prisma.organization_social_app_credentialsWhereInput;
    some?: Prisma.organization_social_app_credentialsWhereInput;
    none?: Prisma.organization_social_app_credentialsWhereInput;
};
export type organization_social_app_credentialsOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type organization_social_app_credentialsOrderByRelevanceInput = {
    fields: Prisma.organization_social_app_credentialsOrderByRelevanceFieldEnum | Prisma.organization_social_app_credentialsOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type organization_social_app_credentialsOrganization_idSocial_networkCompoundUniqueInput = {
    organization_id: string;
    social_network: $Enums.social_network;
};
export type organization_social_app_credentialsCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    social_network?: Prisma.SortOrder;
    client_key?: Prisma.SortOrder;
    client_secret_encrypted?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type organization_social_app_credentialsMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    social_network?: Prisma.SortOrder;
    client_key?: Prisma.SortOrder;
    client_secret_encrypted?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type organization_social_app_credentialsMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    social_network?: Prisma.SortOrder;
    client_key?: Prisma.SortOrder;
    client_secret_encrypted?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type organization_social_app_credentialsCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.organization_social_app_credentialsCreateWithoutOrganizationsInput, Prisma.organization_social_app_credentialsUncheckedCreateWithoutOrganizationsInput> | Prisma.organization_social_app_credentialsCreateWithoutOrganizationsInput[] | Prisma.organization_social_app_credentialsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.organization_social_app_credentialsCreateOrConnectWithoutOrganizationsInput | Prisma.organization_social_app_credentialsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.organization_social_app_credentialsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.organization_social_app_credentialsWhereUniqueInput | Prisma.organization_social_app_credentialsWhereUniqueInput[];
};
export type organization_social_app_credentialsUncheckedCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.organization_social_app_credentialsCreateWithoutOrganizationsInput, Prisma.organization_social_app_credentialsUncheckedCreateWithoutOrganizationsInput> | Prisma.organization_social_app_credentialsCreateWithoutOrganizationsInput[] | Prisma.organization_social_app_credentialsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.organization_social_app_credentialsCreateOrConnectWithoutOrganizationsInput | Prisma.organization_social_app_credentialsCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.organization_social_app_credentialsCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.organization_social_app_credentialsWhereUniqueInput | Prisma.organization_social_app_credentialsWhereUniqueInput[];
};
export type organization_social_app_credentialsUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.organization_social_app_credentialsCreateWithoutOrganizationsInput, Prisma.organization_social_app_credentialsUncheckedCreateWithoutOrganizationsInput> | Prisma.organization_social_app_credentialsCreateWithoutOrganizationsInput[] | Prisma.organization_social_app_credentialsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.organization_social_app_credentialsCreateOrConnectWithoutOrganizationsInput | Prisma.organization_social_app_credentialsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.organization_social_app_credentialsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.organization_social_app_credentialsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.organization_social_app_credentialsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.organization_social_app_credentialsWhereUniqueInput | Prisma.organization_social_app_credentialsWhereUniqueInput[];
    disconnect?: Prisma.organization_social_app_credentialsWhereUniqueInput | Prisma.organization_social_app_credentialsWhereUniqueInput[];
    delete?: Prisma.organization_social_app_credentialsWhereUniqueInput | Prisma.organization_social_app_credentialsWhereUniqueInput[];
    connect?: Prisma.organization_social_app_credentialsWhereUniqueInput | Prisma.organization_social_app_credentialsWhereUniqueInput[];
    update?: Prisma.organization_social_app_credentialsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.organization_social_app_credentialsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.organization_social_app_credentialsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.organization_social_app_credentialsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.organization_social_app_credentialsScalarWhereInput | Prisma.organization_social_app_credentialsScalarWhereInput[];
};
export type organization_social_app_credentialsUncheckedUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.organization_social_app_credentialsCreateWithoutOrganizationsInput, Prisma.organization_social_app_credentialsUncheckedCreateWithoutOrganizationsInput> | Prisma.organization_social_app_credentialsCreateWithoutOrganizationsInput[] | Prisma.organization_social_app_credentialsUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.organization_social_app_credentialsCreateOrConnectWithoutOrganizationsInput | Prisma.organization_social_app_credentialsCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.organization_social_app_credentialsUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.organization_social_app_credentialsUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.organization_social_app_credentialsCreateManyOrganizationsInputEnvelope;
    set?: Prisma.organization_social_app_credentialsWhereUniqueInput | Prisma.organization_social_app_credentialsWhereUniqueInput[];
    disconnect?: Prisma.organization_social_app_credentialsWhereUniqueInput | Prisma.organization_social_app_credentialsWhereUniqueInput[];
    delete?: Prisma.organization_social_app_credentialsWhereUniqueInput | Prisma.organization_social_app_credentialsWhereUniqueInput[];
    connect?: Prisma.organization_social_app_credentialsWhereUniqueInput | Prisma.organization_social_app_credentialsWhereUniqueInput[];
    update?: Prisma.organization_social_app_credentialsUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.organization_social_app_credentialsUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.organization_social_app_credentialsUpdateManyWithWhereWithoutOrganizationsInput | Prisma.organization_social_app_credentialsUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.organization_social_app_credentialsScalarWhereInput | Prisma.organization_social_app_credentialsScalarWhereInput[];
};
export type organization_social_app_credentialsCreateWithoutOrganizationsInput = {
    id?: string;
    social_network: $Enums.social_network;
    client_key: string;
    client_secret_encrypted: string;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type organization_social_app_credentialsUncheckedCreateWithoutOrganizationsInput = {
    id?: string;
    social_network: $Enums.social_network;
    client_key: string;
    client_secret_encrypted: string;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type organization_social_app_credentialsCreateOrConnectWithoutOrganizationsInput = {
    where: Prisma.organization_social_app_credentialsWhereUniqueInput;
    create: Prisma.XOR<Prisma.organization_social_app_credentialsCreateWithoutOrganizationsInput, Prisma.organization_social_app_credentialsUncheckedCreateWithoutOrganizationsInput>;
};
export type organization_social_app_credentialsCreateManyOrganizationsInputEnvelope = {
    data: Prisma.organization_social_app_credentialsCreateManyOrganizationsInput | Prisma.organization_social_app_credentialsCreateManyOrganizationsInput[];
    skipDuplicates?: boolean;
};
export type organization_social_app_credentialsUpsertWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.organization_social_app_credentialsWhereUniqueInput;
    update: Prisma.XOR<Prisma.organization_social_app_credentialsUpdateWithoutOrganizationsInput, Prisma.organization_social_app_credentialsUncheckedUpdateWithoutOrganizationsInput>;
    create: Prisma.XOR<Prisma.organization_social_app_credentialsCreateWithoutOrganizationsInput, Prisma.organization_social_app_credentialsUncheckedCreateWithoutOrganizationsInput>;
};
export type organization_social_app_credentialsUpdateWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.organization_social_app_credentialsWhereUniqueInput;
    data: Prisma.XOR<Prisma.organization_social_app_credentialsUpdateWithoutOrganizationsInput, Prisma.organization_social_app_credentialsUncheckedUpdateWithoutOrganizationsInput>;
};
export type organization_social_app_credentialsUpdateManyWithWhereWithoutOrganizationsInput = {
    where: Prisma.organization_social_app_credentialsScalarWhereInput;
    data: Prisma.XOR<Prisma.organization_social_app_credentialsUpdateManyMutationInput, Prisma.organization_social_app_credentialsUncheckedUpdateManyWithoutOrganizationsInput>;
};
export type organization_social_app_credentialsScalarWhereInput = {
    AND?: Prisma.organization_social_app_credentialsScalarWhereInput | Prisma.organization_social_app_credentialsScalarWhereInput[];
    OR?: Prisma.organization_social_app_credentialsScalarWhereInput[];
    NOT?: Prisma.organization_social_app_credentialsScalarWhereInput | Prisma.organization_social_app_credentialsScalarWhereInput[];
    id?: Prisma.StringFilter<"organization_social_app_credentials"> | string;
    organization_id?: Prisma.StringFilter<"organization_social_app_credentials"> | string;
    social_network?: Prisma.Enumsocial_networkFilter<"organization_social_app_credentials"> | $Enums.social_network;
    client_key?: Prisma.StringFilter<"organization_social_app_credentials"> | string;
    client_secret_encrypted?: Prisma.StringFilter<"organization_social_app_credentials"> | string;
    created_at?: Prisma.DateTimeFilter<"organization_social_app_credentials"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"organization_social_app_credentials"> | Date | string;
};
export type organization_social_app_credentialsCreateManyOrganizationsInput = {
    id?: string;
    social_network: $Enums.social_network;
    client_key: string;
    client_secret_encrypted: string;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type organization_social_app_credentialsUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    social_network?: Prisma.Enumsocial_networkFieldUpdateOperationsInput | $Enums.social_network;
    client_key?: Prisma.StringFieldUpdateOperationsInput | string;
    client_secret_encrypted?: Prisma.StringFieldUpdateOperationsInput | string;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type organization_social_app_credentialsUncheckedUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    social_network?: Prisma.Enumsocial_networkFieldUpdateOperationsInput | $Enums.social_network;
    client_key?: Prisma.StringFieldUpdateOperationsInput | string;
    client_secret_encrypted?: Prisma.StringFieldUpdateOperationsInput | string;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type organization_social_app_credentialsUncheckedUpdateManyWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    social_network?: Prisma.Enumsocial_networkFieldUpdateOperationsInput | $Enums.social_network;
    client_key?: Prisma.StringFieldUpdateOperationsInput | string;
    client_secret_encrypted?: Prisma.StringFieldUpdateOperationsInput | string;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type organization_social_app_credentialsSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    organization_id?: boolean;
    social_network?: boolean;
    client_key?: boolean;
    client_secret_encrypted?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["organization_social_app_credentials"]>;
export type organization_social_app_credentialsSelectScalar = {
    id?: boolean;
    organization_id?: boolean;
    social_network?: boolean;
    client_key?: boolean;
    client_secret_encrypted?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
};
export type organization_social_app_credentialsOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "organization_id" | "social_network" | "client_key" | "client_secret_encrypted" | "created_at" | "updated_at", ExtArgs["result"]["organization_social_app_credentials"]>;
export type organization_social_app_credentialsInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
};
export type $organization_social_app_credentialsPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "organization_social_app_credentials";
    objects: {
        organizations: Prisma.$organizationsPayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        organization_id: string;
        social_network: $Enums.social_network;
        client_key: string;
        client_secret_encrypted: string;
        created_at: Date;
        updated_at: Date;
    }, ExtArgs["result"]["organization_social_app_credentials"]>;
    composites: {};
};
export type organization_social_app_credentialsGetPayload<S extends boolean | null | undefined | organization_social_app_credentialsDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$organization_social_app_credentialsPayload, S>;
export type organization_social_app_credentialsCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<organization_social_app_credentialsFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: Organization_social_app_credentialsCountAggregateInputType | true;
};
export interface organization_social_app_credentialsDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['organization_social_app_credentials'];
        meta: {
            name: 'organization_social_app_credentials';
        };
    };
    findUnique<T extends organization_social_app_credentialsFindUniqueArgs>(args: Prisma.SelectSubset<T, organization_social_app_credentialsFindUniqueArgs<ExtArgs>>): Prisma.Prisma__organization_social_app_credentialsClient<runtime.Types.Result.GetResult<Prisma.$organization_social_app_credentialsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends organization_social_app_credentialsFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, organization_social_app_credentialsFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__organization_social_app_credentialsClient<runtime.Types.Result.GetResult<Prisma.$organization_social_app_credentialsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends organization_social_app_credentialsFindFirstArgs>(args?: Prisma.SelectSubset<T, organization_social_app_credentialsFindFirstArgs<ExtArgs>>): Prisma.Prisma__organization_social_app_credentialsClient<runtime.Types.Result.GetResult<Prisma.$organization_social_app_credentialsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends organization_social_app_credentialsFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, organization_social_app_credentialsFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__organization_social_app_credentialsClient<runtime.Types.Result.GetResult<Prisma.$organization_social_app_credentialsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends organization_social_app_credentialsFindManyArgs>(args?: Prisma.SelectSubset<T, organization_social_app_credentialsFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$organization_social_app_credentialsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends organization_social_app_credentialsCreateArgs>(args: Prisma.SelectSubset<T, organization_social_app_credentialsCreateArgs<ExtArgs>>): Prisma.Prisma__organization_social_app_credentialsClient<runtime.Types.Result.GetResult<Prisma.$organization_social_app_credentialsPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends organization_social_app_credentialsCreateManyArgs>(args?: Prisma.SelectSubset<T, organization_social_app_credentialsCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends organization_social_app_credentialsDeleteArgs>(args: Prisma.SelectSubset<T, organization_social_app_credentialsDeleteArgs<ExtArgs>>): Prisma.Prisma__organization_social_app_credentialsClient<runtime.Types.Result.GetResult<Prisma.$organization_social_app_credentialsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends organization_social_app_credentialsUpdateArgs>(args: Prisma.SelectSubset<T, organization_social_app_credentialsUpdateArgs<ExtArgs>>): Prisma.Prisma__organization_social_app_credentialsClient<runtime.Types.Result.GetResult<Prisma.$organization_social_app_credentialsPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends organization_social_app_credentialsDeleteManyArgs>(args?: Prisma.SelectSubset<T, organization_social_app_credentialsDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends organization_social_app_credentialsUpdateManyArgs>(args: Prisma.SelectSubset<T, organization_social_app_credentialsUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends organization_social_app_credentialsUpsertArgs>(args: Prisma.SelectSubset<T, organization_social_app_credentialsUpsertArgs<ExtArgs>>): Prisma.Prisma__organization_social_app_credentialsClient<runtime.Types.Result.GetResult<Prisma.$organization_social_app_credentialsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends organization_social_app_credentialsCountArgs>(args?: Prisma.Subset<T, organization_social_app_credentialsCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], Organization_social_app_credentialsCountAggregateOutputType> : number>;
    aggregate<T extends Organization_social_app_credentialsAggregateArgs>(args: Prisma.Subset<T, Organization_social_app_credentialsAggregateArgs>): Prisma.PrismaPromise<GetOrganization_social_app_credentialsAggregateType<T>>;
    groupBy<T extends organization_social_app_credentialsGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: organization_social_app_credentialsGroupByArgs['orderBy'];
    } : {
        orderBy?: organization_social_app_credentialsGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, organization_social_app_credentialsGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetOrganization_social_app_credentialsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: organization_social_app_credentialsFieldRefs;
}
export interface Prisma__organization_social_app_credentialsClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    organizations<T extends Prisma.organizationsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.organizationsDefaultArgs<ExtArgs>>): Prisma.Prisma__organizationsClient<runtime.Types.Result.GetResult<Prisma.$organizationsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface organization_social_app_credentialsFieldRefs {
    readonly id: Prisma.FieldRef<"organization_social_app_credentials", 'String'>;
    readonly organization_id: Prisma.FieldRef<"organization_social_app_credentials", 'String'>;
    readonly social_network: Prisma.FieldRef<"organization_social_app_credentials", 'social_network'>;
    readonly client_key: Prisma.FieldRef<"organization_social_app_credentials", 'String'>;
    readonly client_secret_encrypted: Prisma.FieldRef<"organization_social_app_credentials", 'String'>;
    readonly created_at: Prisma.FieldRef<"organization_social_app_credentials", 'DateTime'>;
    readonly updated_at: Prisma.FieldRef<"organization_social_app_credentials", 'DateTime'>;
}
export type organization_social_app_credentialsFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.organization_social_app_credentialsSelect<ExtArgs> | null;
    omit?: Prisma.organization_social_app_credentialsOmit<ExtArgs> | null;
    include?: Prisma.organization_social_app_credentialsInclude<ExtArgs> | null;
    where: Prisma.organization_social_app_credentialsWhereUniqueInput;
};
export type organization_social_app_credentialsFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.organization_social_app_credentialsSelect<ExtArgs> | null;
    omit?: Prisma.organization_social_app_credentialsOmit<ExtArgs> | null;
    include?: Prisma.organization_social_app_credentialsInclude<ExtArgs> | null;
    where: Prisma.organization_social_app_credentialsWhereUniqueInput;
};
export type organization_social_app_credentialsFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.organization_social_app_credentialsSelect<ExtArgs> | null;
    omit?: Prisma.organization_social_app_credentialsOmit<ExtArgs> | null;
    include?: Prisma.organization_social_app_credentialsInclude<ExtArgs> | null;
    where?: Prisma.organization_social_app_credentialsWhereInput;
    orderBy?: Prisma.organization_social_app_credentialsOrderByWithRelationInput | Prisma.organization_social_app_credentialsOrderByWithRelationInput[];
    cursor?: Prisma.organization_social_app_credentialsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Organization_social_app_credentialsScalarFieldEnum | Prisma.Organization_social_app_credentialsScalarFieldEnum[];
};
export type organization_social_app_credentialsFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.organization_social_app_credentialsSelect<ExtArgs> | null;
    omit?: Prisma.organization_social_app_credentialsOmit<ExtArgs> | null;
    include?: Prisma.organization_social_app_credentialsInclude<ExtArgs> | null;
    where?: Prisma.organization_social_app_credentialsWhereInput;
    orderBy?: Prisma.organization_social_app_credentialsOrderByWithRelationInput | Prisma.organization_social_app_credentialsOrderByWithRelationInput[];
    cursor?: Prisma.organization_social_app_credentialsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Organization_social_app_credentialsScalarFieldEnum | Prisma.Organization_social_app_credentialsScalarFieldEnum[];
};
export type organization_social_app_credentialsFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.organization_social_app_credentialsSelect<ExtArgs> | null;
    omit?: Prisma.organization_social_app_credentialsOmit<ExtArgs> | null;
    include?: Prisma.organization_social_app_credentialsInclude<ExtArgs> | null;
    where?: Prisma.organization_social_app_credentialsWhereInput;
    orderBy?: Prisma.organization_social_app_credentialsOrderByWithRelationInput | Prisma.organization_social_app_credentialsOrderByWithRelationInput[];
    cursor?: Prisma.organization_social_app_credentialsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Organization_social_app_credentialsScalarFieldEnum | Prisma.Organization_social_app_credentialsScalarFieldEnum[];
};
export type organization_social_app_credentialsCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.organization_social_app_credentialsSelect<ExtArgs> | null;
    omit?: Prisma.organization_social_app_credentialsOmit<ExtArgs> | null;
    include?: Prisma.organization_social_app_credentialsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.organization_social_app_credentialsCreateInput, Prisma.organization_social_app_credentialsUncheckedCreateInput>;
};
export type organization_social_app_credentialsCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.organization_social_app_credentialsCreateManyInput | Prisma.organization_social_app_credentialsCreateManyInput[];
    skipDuplicates?: boolean;
};
export type organization_social_app_credentialsUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.organization_social_app_credentialsSelect<ExtArgs> | null;
    omit?: Prisma.organization_social_app_credentialsOmit<ExtArgs> | null;
    include?: Prisma.organization_social_app_credentialsInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.organization_social_app_credentialsUpdateInput, Prisma.organization_social_app_credentialsUncheckedUpdateInput>;
    where: Prisma.organization_social_app_credentialsWhereUniqueInput;
};
export type organization_social_app_credentialsUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.organization_social_app_credentialsUpdateManyMutationInput, Prisma.organization_social_app_credentialsUncheckedUpdateManyInput>;
    where?: Prisma.organization_social_app_credentialsWhereInput;
    limit?: number;
};
export type organization_social_app_credentialsUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.organization_social_app_credentialsSelect<ExtArgs> | null;
    omit?: Prisma.organization_social_app_credentialsOmit<ExtArgs> | null;
    include?: Prisma.organization_social_app_credentialsInclude<ExtArgs> | null;
    where: Prisma.organization_social_app_credentialsWhereUniqueInput;
    create: Prisma.XOR<Prisma.organization_social_app_credentialsCreateInput, Prisma.organization_social_app_credentialsUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.organization_social_app_credentialsUpdateInput, Prisma.organization_social_app_credentialsUncheckedUpdateInput>;
};
export type organization_social_app_credentialsDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.organization_social_app_credentialsSelect<ExtArgs> | null;
    omit?: Prisma.organization_social_app_credentialsOmit<ExtArgs> | null;
    include?: Prisma.organization_social_app_credentialsInclude<ExtArgs> | null;
    where: Prisma.organization_social_app_credentialsWhereUniqueInput;
};
export type organization_social_app_credentialsDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.organization_social_app_credentialsWhereInput;
    limit?: number;
};
export type organization_social_app_credentialsDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.organization_social_app_credentialsSelect<ExtArgs> | null;
    omit?: Prisma.organization_social_app_credentialsOmit<ExtArgs> | null;
    include?: Prisma.organization_social_app_credentialsInclude<ExtArgs> | null;
};
export {};
