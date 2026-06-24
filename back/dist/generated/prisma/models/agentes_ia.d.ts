import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type agentes_iaModel = runtime.Types.Result.DefaultSelection<Prisma.$agentes_iaPayload>;
export type AggregateAgentes_ia = {
    _count: Agentes_iaCountAggregateOutputType | null;
    _min: Agentes_iaMinAggregateOutputType | null;
    _max: Agentes_iaMaxAggregateOutputType | null;
};
export type Agentes_iaMinAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    name: string | null;
    description: string | null;
    active: boolean | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type Agentes_iaMaxAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    name: string | null;
    description: string | null;
    active: boolean | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type Agentes_iaCountAggregateOutputType = {
    id: number;
    organization_id: number;
    name: number;
    description: number;
    ia_config: number;
    active: number;
    created_at: number;
    updated_at: number;
    _all: number;
};
export type Agentes_iaMinAggregateInputType = {
    id?: true;
    organization_id?: true;
    name?: true;
    description?: true;
    active?: true;
    created_at?: true;
    updated_at?: true;
};
export type Agentes_iaMaxAggregateInputType = {
    id?: true;
    organization_id?: true;
    name?: true;
    description?: true;
    active?: true;
    created_at?: true;
    updated_at?: true;
};
export type Agentes_iaCountAggregateInputType = {
    id?: true;
    organization_id?: true;
    name?: true;
    description?: true;
    ia_config?: true;
    active?: true;
    created_at?: true;
    updated_at?: true;
    _all?: true;
};
export type Agentes_iaAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.agentes_iaWhereInput;
    orderBy?: Prisma.agentes_iaOrderByWithRelationInput | Prisma.agentes_iaOrderByWithRelationInput[];
    cursor?: Prisma.agentes_iaWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | Agentes_iaCountAggregateInputType;
    _min?: Agentes_iaMinAggregateInputType;
    _max?: Agentes_iaMaxAggregateInputType;
};
export type GetAgentes_iaAggregateType<T extends Agentes_iaAggregateArgs> = {
    [P in keyof T & keyof AggregateAgentes_ia]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateAgentes_ia[P]> : Prisma.GetScalarType<T[P], AggregateAgentes_ia[P]>;
};
export type agentes_iaGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.agentes_iaWhereInput;
    orderBy?: Prisma.agentes_iaOrderByWithAggregationInput | Prisma.agentes_iaOrderByWithAggregationInput[];
    by: Prisma.Agentes_iaScalarFieldEnum[] | Prisma.Agentes_iaScalarFieldEnum;
    having?: Prisma.agentes_iaScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: Agentes_iaCountAggregateInputType | true;
    _min?: Agentes_iaMinAggregateInputType;
    _max?: Agentes_iaMaxAggregateInputType;
};
export type Agentes_iaGroupByOutputType = {
    id: string;
    organization_id: string;
    name: string;
    description: string | null;
    ia_config: runtime.JsonValue;
    active: boolean;
    created_at: Date;
    updated_at: Date;
    _count: Agentes_iaCountAggregateOutputType | null;
    _min: Agentes_iaMinAggregateOutputType | null;
    _max: Agentes_iaMaxAggregateOutputType | null;
};
type GetAgentes_iaGroupByPayload<T extends agentes_iaGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<Agentes_iaGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof Agentes_iaGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], Agentes_iaGroupByOutputType[P]> : Prisma.GetScalarType<T[P], Agentes_iaGroupByOutputType[P]>;
}>>;
export type agentes_iaWhereInput = {
    AND?: Prisma.agentes_iaWhereInput | Prisma.agentes_iaWhereInput[];
    OR?: Prisma.agentes_iaWhereInput[];
    NOT?: Prisma.agentes_iaWhereInput | Prisma.agentes_iaWhereInput[];
    id?: Prisma.StringFilter<"agentes_ia"> | string;
    organization_id?: Prisma.StringFilter<"agentes_ia"> | string;
    name?: Prisma.StringFilter<"agentes_ia"> | string;
    description?: Prisma.StringNullableFilter<"agentes_ia"> | string | null;
    ia_config?: Prisma.JsonFilter<"agentes_ia">;
    active?: Prisma.BoolFilter<"agentes_ia"> | boolean;
    created_at?: Prisma.DateTimeFilter<"agentes_ia"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"agentes_ia"> | Date | string;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
    webchats?: Prisma.WebchatsListRelationFilter;
};
export type agentes_iaOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    description?: Prisma.SortOrderInput | Prisma.SortOrder;
    ia_config?: Prisma.SortOrder;
    active?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    organizations?: Prisma.organizationsOrderByWithRelationInput;
    webchats?: Prisma.webchatsOrderByRelationAggregateInput;
    _relevance?: Prisma.agentes_iaOrderByRelevanceInput;
};
export type agentes_iaWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    AND?: Prisma.agentes_iaWhereInput | Prisma.agentes_iaWhereInput[];
    OR?: Prisma.agentes_iaWhereInput[];
    NOT?: Prisma.agentes_iaWhereInput | Prisma.agentes_iaWhereInput[];
    organization_id?: Prisma.StringFilter<"agentes_ia"> | string;
    name?: Prisma.StringFilter<"agentes_ia"> | string;
    description?: Prisma.StringNullableFilter<"agentes_ia"> | string | null;
    ia_config?: Prisma.JsonFilter<"agentes_ia">;
    active?: Prisma.BoolFilter<"agentes_ia"> | boolean;
    created_at?: Prisma.DateTimeFilter<"agentes_ia"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"agentes_ia"> | Date | string;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
    webchats?: Prisma.WebchatsListRelationFilter;
}, "id">;
export type agentes_iaOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    description?: Prisma.SortOrderInput | Prisma.SortOrder;
    ia_config?: Prisma.SortOrder;
    active?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    _count?: Prisma.agentes_iaCountOrderByAggregateInput;
    _max?: Prisma.agentes_iaMaxOrderByAggregateInput;
    _min?: Prisma.agentes_iaMinOrderByAggregateInput;
};
export type agentes_iaScalarWhereWithAggregatesInput = {
    AND?: Prisma.agentes_iaScalarWhereWithAggregatesInput | Prisma.agentes_iaScalarWhereWithAggregatesInput[];
    OR?: Prisma.agentes_iaScalarWhereWithAggregatesInput[];
    NOT?: Prisma.agentes_iaScalarWhereWithAggregatesInput | Prisma.agentes_iaScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"agentes_ia"> | string;
    organization_id?: Prisma.StringWithAggregatesFilter<"agentes_ia"> | string;
    name?: Prisma.StringWithAggregatesFilter<"agentes_ia"> | string;
    description?: Prisma.StringNullableWithAggregatesFilter<"agentes_ia"> | string | null;
    ia_config?: Prisma.JsonWithAggregatesFilter<"agentes_ia">;
    active?: Prisma.BoolWithAggregatesFilter<"agentes_ia"> | boolean;
    created_at?: Prisma.DateTimeWithAggregatesFilter<"agentes_ia"> | Date | string;
    updated_at?: Prisma.DateTimeWithAggregatesFilter<"agentes_ia"> | Date | string;
};
export type agentes_iaCreateInput = {
    id?: string;
    name: string;
    description?: string | null;
    ia_config: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    active?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
    organizations: Prisma.organizationsCreateNestedOneWithoutAgentes_iaInput;
    webchats?: Prisma.webchatsCreateNestedManyWithoutAgentes_iaInput;
};
export type agentes_iaUncheckedCreateInput = {
    id?: string;
    organization_id: string;
    name: string;
    description?: string | null;
    ia_config: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    active?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
    webchats?: Prisma.webchatsUncheckedCreateNestedManyWithoutAgentes_iaInput;
};
export type agentes_iaUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ia_config?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutAgentes_iaNestedInput;
    webchats?: Prisma.webchatsUpdateManyWithoutAgentes_iaNestedInput;
};
export type agentes_iaUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ia_config?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    webchats?: Prisma.webchatsUncheckedUpdateManyWithoutAgentes_iaNestedInput;
};
export type agentes_iaCreateManyInput = {
    id?: string;
    organization_id: string;
    name: string;
    description?: string | null;
    ia_config: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    active?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type agentes_iaUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ia_config?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type agentes_iaUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ia_config?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type Agentes_iaListRelationFilter = {
    every?: Prisma.agentes_iaWhereInput;
    some?: Prisma.agentes_iaWhereInput;
    none?: Prisma.agentes_iaWhereInput;
};
export type agentes_iaOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type agentes_iaOrderByRelevanceInput = {
    fields: Prisma.agentes_iaOrderByRelevanceFieldEnum | Prisma.agentes_iaOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type agentes_iaCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    description?: Prisma.SortOrder;
    ia_config?: Prisma.SortOrder;
    active?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type agentes_iaMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    description?: Prisma.SortOrder;
    active?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type agentes_iaMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    description?: Prisma.SortOrder;
    active?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type Agentes_iaScalarRelationFilter = {
    is?: Prisma.agentes_iaWhereInput;
    isNot?: Prisma.agentes_iaWhereInput;
};
export type agentes_iaCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.agentes_iaCreateWithoutOrganizationsInput, Prisma.agentes_iaUncheckedCreateWithoutOrganizationsInput> | Prisma.agentes_iaCreateWithoutOrganizationsInput[] | Prisma.agentes_iaUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.agentes_iaCreateOrConnectWithoutOrganizationsInput | Prisma.agentes_iaCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.agentes_iaCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.agentes_iaWhereUniqueInput | Prisma.agentes_iaWhereUniqueInput[];
};
export type agentes_iaUncheckedCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.agentes_iaCreateWithoutOrganizationsInput, Prisma.agentes_iaUncheckedCreateWithoutOrganizationsInput> | Prisma.agentes_iaCreateWithoutOrganizationsInput[] | Prisma.agentes_iaUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.agentes_iaCreateOrConnectWithoutOrganizationsInput | Prisma.agentes_iaCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.agentes_iaCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.agentes_iaWhereUniqueInput | Prisma.agentes_iaWhereUniqueInput[];
};
export type agentes_iaUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.agentes_iaCreateWithoutOrganizationsInput, Prisma.agentes_iaUncheckedCreateWithoutOrganizationsInput> | Prisma.agentes_iaCreateWithoutOrganizationsInput[] | Prisma.agentes_iaUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.agentes_iaCreateOrConnectWithoutOrganizationsInput | Prisma.agentes_iaCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.agentes_iaUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.agentes_iaUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.agentes_iaCreateManyOrganizationsInputEnvelope;
    set?: Prisma.agentes_iaWhereUniqueInput | Prisma.agentes_iaWhereUniqueInput[];
    disconnect?: Prisma.agentes_iaWhereUniqueInput | Prisma.agentes_iaWhereUniqueInput[];
    delete?: Prisma.agentes_iaWhereUniqueInput | Prisma.agentes_iaWhereUniqueInput[];
    connect?: Prisma.agentes_iaWhereUniqueInput | Prisma.agentes_iaWhereUniqueInput[];
    update?: Prisma.agentes_iaUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.agentes_iaUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.agentes_iaUpdateManyWithWhereWithoutOrganizationsInput | Prisma.agentes_iaUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.agentes_iaScalarWhereInput | Prisma.agentes_iaScalarWhereInput[];
};
export type agentes_iaUncheckedUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.agentes_iaCreateWithoutOrganizationsInput, Prisma.agentes_iaUncheckedCreateWithoutOrganizationsInput> | Prisma.agentes_iaCreateWithoutOrganizationsInput[] | Prisma.agentes_iaUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.agentes_iaCreateOrConnectWithoutOrganizationsInput | Prisma.agentes_iaCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.agentes_iaUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.agentes_iaUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.agentes_iaCreateManyOrganizationsInputEnvelope;
    set?: Prisma.agentes_iaWhereUniqueInput | Prisma.agentes_iaWhereUniqueInput[];
    disconnect?: Prisma.agentes_iaWhereUniqueInput | Prisma.agentes_iaWhereUniqueInput[];
    delete?: Prisma.agentes_iaWhereUniqueInput | Prisma.agentes_iaWhereUniqueInput[];
    connect?: Prisma.agentes_iaWhereUniqueInput | Prisma.agentes_iaWhereUniqueInput[];
    update?: Prisma.agentes_iaUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.agentes_iaUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.agentes_iaUpdateManyWithWhereWithoutOrganizationsInput | Prisma.agentes_iaUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.agentes_iaScalarWhereInput | Prisma.agentes_iaScalarWhereInput[];
};
export type agentes_iaCreateNestedOneWithoutWebchatsInput = {
    create?: Prisma.XOR<Prisma.agentes_iaCreateWithoutWebchatsInput, Prisma.agentes_iaUncheckedCreateWithoutWebchatsInput>;
    connectOrCreate?: Prisma.agentes_iaCreateOrConnectWithoutWebchatsInput;
    connect?: Prisma.agentes_iaWhereUniqueInput;
};
export type agentes_iaUpdateOneRequiredWithoutWebchatsNestedInput = {
    create?: Prisma.XOR<Prisma.agentes_iaCreateWithoutWebchatsInput, Prisma.agentes_iaUncheckedCreateWithoutWebchatsInput>;
    connectOrCreate?: Prisma.agentes_iaCreateOrConnectWithoutWebchatsInput;
    upsert?: Prisma.agentes_iaUpsertWithoutWebchatsInput;
    connect?: Prisma.agentes_iaWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.agentes_iaUpdateToOneWithWhereWithoutWebchatsInput, Prisma.agentes_iaUpdateWithoutWebchatsInput>, Prisma.agentes_iaUncheckedUpdateWithoutWebchatsInput>;
};
export type agentes_iaCreateWithoutOrganizationsInput = {
    id?: string;
    name: string;
    description?: string | null;
    ia_config: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    active?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
    webchats?: Prisma.webchatsCreateNestedManyWithoutAgentes_iaInput;
};
export type agentes_iaUncheckedCreateWithoutOrganizationsInput = {
    id?: string;
    name: string;
    description?: string | null;
    ia_config: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    active?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
    webchats?: Prisma.webchatsUncheckedCreateNestedManyWithoutAgentes_iaInput;
};
export type agentes_iaCreateOrConnectWithoutOrganizationsInput = {
    where: Prisma.agentes_iaWhereUniqueInput;
    create: Prisma.XOR<Prisma.agentes_iaCreateWithoutOrganizationsInput, Prisma.agentes_iaUncheckedCreateWithoutOrganizationsInput>;
};
export type agentes_iaCreateManyOrganizationsInputEnvelope = {
    data: Prisma.agentes_iaCreateManyOrganizationsInput | Prisma.agentes_iaCreateManyOrganizationsInput[];
    skipDuplicates?: boolean;
};
export type agentes_iaUpsertWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.agentes_iaWhereUniqueInput;
    update: Prisma.XOR<Prisma.agentes_iaUpdateWithoutOrganizationsInput, Prisma.agentes_iaUncheckedUpdateWithoutOrganizationsInput>;
    create: Prisma.XOR<Prisma.agentes_iaCreateWithoutOrganizationsInput, Prisma.agentes_iaUncheckedCreateWithoutOrganizationsInput>;
};
export type agentes_iaUpdateWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.agentes_iaWhereUniqueInput;
    data: Prisma.XOR<Prisma.agentes_iaUpdateWithoutOrganizationsInput, Prisma.agentes_iaUncheckedUpdateWithoutOrganizationsInput>;
};
export type agentes_iaUpdateManyWithWhereWithoutOrganizationsInput = {
    where: Prisma.agentes_iaScalarWhereInput;
    data: Prisma.XOR<Prisma.agentes_iaUpdateManyMutationInput, Prisma.agentes_iaUncheckedUpdateManyWithoutOrganizationsInput>;
};
export type agentes_iaScalarWhereInput = {
    AND?: Prisma.agentes_iaScalarWhereInput | Prisma.agentes_iaScalarWhereInput[];
    OR?: Prisma.agentes_iaScalarWhereInput[];
    NOT?: Prisma.agentes_iaScalarWhereInput | Prisma.agentes_iaScalarWhereInput[];
    id?: Prisma.StringFilter<"agentes_ia"> | string;
    organization_id?: Prisma.StringFilter<"agentes_ia"> | string;
    name?: Prisma.StringFilter<"agentes_ia"> | string;
    description?: Prisma.StringNullableFilter<"agentes_ia"> | string | null;
    ia_config?: Prisma.JsonFilter<"agentes_ia">;
    active?: Prisma.BoolFilter<"agentes_ia"> | boolean;
    created_at?: Prisma.DateTimeFilter<"agentes_ia"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"agentes_ia"> | Date | string;
};
export type agentes_iaCreateWithoutWebchatsInput = {
    id?: string;
    name: string;
    description?: string | null;
    ia_config: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    active?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
    organizations: Prisma.organizationsCreateNestedOneWithoutAgentes_iaInput;
};
export type agentes_iaUncheckedCreateWithoutWebchatsInput = {
    id?: string;
    organization_id: string;
    name: string;
    description?: string | null;
    ia_config: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    active?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type agentes_iaCreateOrConnectWithoutWebchatsInput = {
    where: Prisma.agentes_iaWhereUniqueInput;
    create: Prisma.XOR<Prisma.agentes_iaCreateWithoutWebchatsInput, Prisma.agentes_iaUncheckedCreateWithoutWebchatsInput>;
};
export type agentes_iaUpsertWithoutWebchatsInput = {
    update: Prisma.XOR<Prisma.agentes_iaUpdateWithoutWebchatsInput, Prisma.agentes_iaUncheckedUpdateWithoutWebchatsInput>;
    create: Prisma.XOR<Prisma.agentes_iaCreateWithoutWebchatsInput, Prisma.agentes_iaUncheckedCreateWithoutWebchatsInput>;
    where?: Prisma.agentes_iaWhereInput;
};
export type agentes_iaUpdateToOneWithWhereWithoutWebchatsInput = {
    where?: Prisma.agentes_iaWhereInput;
    data: Prisma.XOR<Prisma.agentes_iaUpdateWithoutWebchatsInput, Prisma.agentes_iaUncheckedUpdateWithoutWebchatsInput>;
};
export type agentes_iaUpdateWithoutWebchatsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ia_config?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutAgentes_iaNestedInput;
};
export type agentes_iaUncheckedUpdateWithoutWebchatsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ia_config?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type agentes_iaCreateManyOrganizationsInput = {
    id?: string;
    name: string;
    description?: string | null;
    ia_config: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    active?: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type agentes_iaUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ia_config?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    webchats?: Prisma.webchatsUpdateManyWithoutAgentes_iaNestedInput;
};
export type agentes_iaUncheckedUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ia_config?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    webchats?: Prisma.webchatsUncheckedUpdateManyWithoutAgentes_iaNestedInput;
};
export type agentes_iaUncheckedUpdateManyWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    ia_config?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type Agentes_iaCountOutputType = {
    webchats: number;
};
export type Agentes_iaCountOutputTypeSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    webchats?: boolean | Agentes_iaCountOutputTypeCountWebchatsArgs;
};
export type Agentes_iaCountOutputTypeDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.Agentes_iaCountOutputTypeSelect<ExtArgs> | null;
};
export type Agentes_iaCountOutputTypeCountWebchatsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.webchatsWhereInput;
};
export type agentes_iaSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    organization_id?: boolean;
    name?: boolean;
    description?: boolean;
    ia_config?: boolean;
    active?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
    webchats?: boolean | Prisma.agentes_ia$webchatsArgs<ExtArgs>;
    _count?: boolean | Prisma.Agentes_iaCountOutputTypeDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["agentes_ia"]>;
export type agentes_iaSelectScalar = {
    id?: boolean;
    organization_id?: boolean;
    name?: boolean;
    description?: boolean;
    ia_config?: boolean;
    active?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
};
export type agentes_iaOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "organization_id" | "name" | "description" | "ia_config" | "active" | "created_at" | "updated_at", ExtArgs["result"]["agentes_ia"]>;
export type agentes_iaInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
    webchats?: boolean | Prisma.agentes_ia$webchatsArgs<ExtArgs>;
    _count?: boolean | Prisma.Agentes_iaCountOutputTypeDefaultArgs<ExtArgs>;
};
export type $agentes_iaPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "agentes_ia";
    objects: {
        organizations: Prisma.$organizationsPayload<ExtArgs>;
        webchats: Prisma.$webchatsPayload<ExtArgs>[];
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        organization_id: string;
        name: string;
        description: string | null;
        ia_config: runtime.JsonValue;
        active: boolean;
        created_at: Date;
        updated_at: Date;
    }, ExtArgs["result"]["agentes_ia"]>;
    composites: {};
};
export type agentes_iaGetPayload<S extends boolean | null | undefined | agentes_iaDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$agentes_iaPayload, S>;
export type agentes_iaCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<agentes_iaFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: Agentes_iaCountAggregateInputType | true;
};
export interface agentes_iaDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['agentes_ia'];
        meta: {
            name: 'agentes_ia';
        };
    };
    findUnique<T extends agentes_iaFindUniqueArgs>(args: Prisma.SelectSubset<T, agentes_iaFindUniqueArgs<ExtArgs>>): Prisma.Prisma__agentes_iaClient<runtime.Types.Result.GetResult<Prisma.$agentes_iaPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends agentes_iaFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, agentes_iaFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__agentes_iaClient<runtime.Types.Result.GetResult<Prisma.$agentes_iaPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends agentes_iaFindFirstArgs>(args?: Prisma.SelectSubset<T, agentes_iaFindFirstArgs<ExtArgs>>): Prisma.Prisma__agentes_iaClient<runtime.Types.Result.GetResult<Prisma.$agentes_iaPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends agentes_iaFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, agentes_iaFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__agentes_iaClient<runtime.Types.Result.GetResult<Prisma.$agentes_iaPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends agentes_iaFindManyArgs>(args?: Prisma.SelectSubset<T, agentes_iaFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$agentes_iaPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends agentes_iaCreateArgs>(args: Prisma.SelectSubset<T, agentes_iaCreateArgs<ExtArgs>>): Prisma.Prisma__agentes_iaClient<runtime.Types.Result.GetResult<Prisma.$agentes_iaPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends agentes_iaCreateManyArgs>(args?: Prisma.SelectSubset<T, agentes_iaCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends agentes_iaDeleteArgs>(args: Prisma.SelectSubset<T, agentes_iaDeleteArgs<ExtArgs>>): Prisma.Prisma__agentes_iaClient<runtime.Types.Result.GetResult<Prisma.$agentes_iaPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends agentes_iaUpdateArgs>(args: Prisma.SelectSubset<T, agentes_iaUpdateArgs<ExtArgs>>): Prisma.Prisma__agentes_iaClient<runtime.Types.Result.GetResult<Prisma.$agentes_iaPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends agentes_iaDeleteManyArgs>(args?: Prisma.SelectSubset<T, agentes_iaDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends agentes_iaUpdateManyArgs>(args: Prisma.SelectSubset<T, agentes_iaUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends agentes_iaUpsertArgs>(args: Prisma.SelectSubset<T, agentes_iaUpsertArgs<ExtArgs>>): Prisma.Prisma__agentes_iaClient<runtime.Types.Result.GetResult<Prisma.$agentes_iaPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends agentes_iaCountArgs>(args?: Prisma.Subset<T, agentes_iaCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], Agentes_iaCountAggregateOutputType> : number>;
    aggregate<T extends Agentes_iaAggregateArgs>(args: Prisma.Subset<T, Agentes_iaAggregateArgs>): Prisma.PrismaPromise<GetAgentes_iaAggregateType<T>>;
    groupBy<T extends agentes_iaGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: agentes_iaGroupByArgs['orderBy'];
    } : {
        orderBy?: agentes_iaGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, agentes_iaGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAgentes_iaGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: agentes_iaFieldRefs;
}
export interface Prisma__agentes_iaClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    organizations<T extends Prisma.organizationsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.organizationsDefaultArgs<ExtArgs>>): Prisma.Prisma__organizationsClient<runtime.Types.Result.GetResult<Prisma.$organizationsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    webchats<T extends Prisma.agentes_ia$webchatsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.agentes_ia$webchatsArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$webchatsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface agentes_iaFieldRefs {
    readonly id: Prisma.FieldRef<"agentes_ia", 'String'>;
    readonly organization_id: Prisma.FieldRef<"agentes_ia", 'String'>;
    readonly name: Prisma.FieldRef<"agentes_ia", 'String'>;
    readonly description: Prisma.FieldRef<"agentes_ia", 'String'>;
    readonly ia_config: Prisma.FieldRef<"agentes_ia", 'Json'>;
    readonly active: Prisma.FieldRef<"agentes_ia", 'Boolean'>;
    readonly created_at: Prisma.FieldRef<"agentes_ia", 'DateTime'>;
    readonly updated_at: Prisma.FieldRef<"agentes_ia", 'DateTime'>;
}
export type agentes_iaFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.agentes_iaSelect<ExtArgs> | null;
    omit?: Prisma.agentes_iaOmit<ExtArgs> | null;
    include?: Prisma.agentes_iaInclude<ExtArgs> | null;
    where: Prisma.agentes_iaWhereUniqueInput;
};
export type agentes_iaFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.agentes_iaSelect<ExtArgs> | null;
    omit?: Prisma.agentes_iaOmit<ExtArgs> | null;
    include?: Prisma.agentes_iaInclude<ExtArgs> | null;
    where: Prisma.agentes_iaWhereUniqueInput;
};
export type agentes_iaFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.agentes_iaSelect<ExtArgs> | null;
    omit?: Prisma.agentes_iaOmit<ExtArgs> | null;
    include?: Prisma.agentes_iaInclude<ExtArgs> | null;
    where?: Prisma.agentes_iaWhereInput;
    orderBy?: Prisma.agentes_iaOrderByWithRelationInput | Prisma.agentes_iaOrderByWithRelationInput[];
    cursor?: Prisma.agentes_iaWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Agentes_iaScalarFieldEnum | Prisma.Agentes_iaScalarFieldEnum[];
};
export type agentes_iaFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.agentes_iaSelect<ExtArgs> | null;
    omit?: Prisma.agentes_iaOmit<ExtArgs> | null;
    include?: Prisma.agentes_iaInclude<ExtArgs> | null;
    where?: Prisma.agentes_iaWhereInput;
    orderBy?: Prisma.agentes_iaOrderByWithRelationInput | Prisma.agentes_iaOrderByWithRelationInput[];
    cursor?: Prisma.agentes_iaWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Agentes_iaScalarFieldEnum | Prisma.Agentes_iaScalarFieldEnum[];
};
export type agentes_iaFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.agentes_iaSelect<ExtArgs> | null;
    omit?: Prisma.agentes_iaOmit<ExtArgs> | null;
    include?: Prisma.agentes_iaInclude<ExtArgs> | null;
    where?: Prisma.agentes_iaWhereInput;
    orderBy?: Prisma.agentes_iaOrderByWithRelationInput | Prisma.agentes_iaOrderByWithRelationInput[];
    cursor?: Prisma.agentes_iaWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Agentes_iaScalarFieldEnum | Prisma.Agentes_iaScalarFieldEnum[];
};
export type agentes_iaCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.agentes_iaSelect<ExtArgs> | null;
    omit?: Prisma.agentes_iaOmit<ExtArgs> | null;
    include?: Prisma.agentes_iaInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.agentes_iaCreateInput, Prisma.agentes_iaUncheckedCreateInput>;
};
export type agentes_iaCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.agentes_iaCreateManyInput | Prisma.agentes_iaCreateManyInput[];
    skipDuplicates?: boolean;
};
export type agentes_iaUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.agentes_iaSelect<ExtArgs> | null;
    omit?: Prisma.agentes_iaOmit<ExtArgs> | null;
    include?: Prisma.agentes_iaInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.agentes_iaUpdateInput, Prisma.agentes_iaUncheckedUpdateInput>;
    where: Prisma.agentes_iaWhereUniqueInput;
};
export type agentes_iaUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.agentes_iaUpdateManyMutationInput, Prisma.agentes_iaUncheckedUpdateManyInput>;
    where?: Prisma.agentes_iaWhereInput;
    limit?: number;
};
export type agentes_iaUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.agentes_iaSelect<ExtArgs> | null;
    omit?: Prisma.agentes_iaOmit<ExtArgs> | null;
    include?: Prisma.agentes_iaInclude<ExtArgs> | null;
    where: Prisma.agentes_iaWhereUniqueInput;
    create: Prisma.XOR<Prisma.agentes_iaCreateInput, Prisma.agentes_iaUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.agentes_iaUpdateInput, Prisma.agentes_iaUncheckedUpdateInput>;
};
export type agentes_iaDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.agentes_iaSelect<ExtArgs> | null;
    omit?: Prisma.agentes_iaOmit<ExtArgs> | null;
    include?: Prisma.agentes_iaInclude<ExtArgs> | null;
    where: Prisma.agentes_iaWhereUniqueInput;
};
export type agentes_iaDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.agentes_iaWhereInput;
    limit?: number;
};
export type agentes_ia$webchatsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type agentes_iaDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.agentes_iaSelect<ExtArgs> | null;
    omit?: Prisma.agentes_iaOmit<ExtArgs> | null;
    include?: Prisma.agentes_iaInclude<ExtArgs> | null;
};
export {};
