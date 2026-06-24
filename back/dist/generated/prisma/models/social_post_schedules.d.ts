import type * as runtime from "@prisma/client/runtime/client";
import type * as $Enums from "../enums.js";
import type * as Prisma from "../internal/prismaNamespace.js";
export type social_post_schedulesModel = runtime.Types.Result.DefaultSelection<Prisma.$social_post_schedulesPayload>;
export type AggregateSocial_post_schedules = {
    _count: Social_post_schedulesCountAggregateOutputType | null;
    _avg: Social_post_schedulesAvgAggregateOutputType | null;
    _sum: Social_post_schedulesSumAggregateOutputType | null;
    _min: Social_post_schedulesMinAggregateOutputType | null;
    _max: Social_post_schedulesMaxAggregateOutputType | null;
};
export type Social_post_schedulesAvgAggregateOutputType = {
    tokens_unit_cost: number | null;
    tokens_cost: number | null;
};
export type Social_post_schedulesSumAggregateOutputType = {
    tokens_unit_cost: number | null;
    tokens_cost: number | null;
};
export type Social_post_schedulesMinAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    post_id: string | null;
    social_account_id: string | null;
    social_network: $Enums.social_network | null;
    status: $Enums.social_schedule_status | null;
    ai_content: boolean | null;
    scheduled_at: Date | null;
    tokens_unit_cost: number | null;
    tokens_cost: number | null;
    error_message: string | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type Social_post_schedulesMaxAggregateOutputType = {
    id: string | null;
    organization_id: string | null;
    post_id: string | null;
    social_account_id: string | null;
    social_network: $Enums.social_network | null;
    status: $Enums.social_schedule_status | null;
    ai_content: boolean | null;
    scheduled_at: Date | null;
    tokens_unit_cost: number | null;
    tokens_cost: number | null;
    error_message: string | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type Social_post_schedulesCountAggregateOutputType = {
    id: number;
    organization_id: number;
    post_id: number;
    social_account_id: number;
    social_network: number;
    status: number;
    ai_content: number;
    scheduled_at: number;
    platform_payload: number;
    post_snapshot: number;
    tokens_unit_cost: number;
    tokens_cost: number;
    error_message: number;
    created_at: number;
    updated_at: number;
    _all: number;
};
export type Social_post_schedulesAvgAggregateInputType = {
    tokens_unit_cost?: true;
    tokens_cost?: true;
};
export type Social_post_schedulesSumAggregateInputType = {
    tokens_unit_cost?: true;
    tokens_cost?: true;
};
export type Social_post_schedulesMinAggregateInputType = {
    id?: true;
    organization_id?: true;
    post_id?: true;
    social_account_id?: true;
    social_network?: true;
    status?: true;
    ai_content?: true;
    scheduled_at?: true;
    tokens_unit_cost?: true;
    tokens_cost?: true;
    error_message?: true;
    created_at?: true;
    updated_at?: true;
};
export type Social_post_schedulesMaxAggregateInputType = {
    id?: true;
    organization_id?: true;
    post_id?: true;
    social_account_id?: true;
    social_network?: true;
    status?: true;
    ai_content?: true;
    scheduled_at?: true;
    tokens_unit_cost?: true;
    tokens_cost?: true;
    error_message?: true;
    created_at?: true;
    updated_at?: true;
};
export type Social_post_schedulesCountAggregateInputType = {
    id?: true;
    organization_id?: true;
    post_id?: true;
    social_account_id?: true;
    social_network?: true;
    status?: true;
    ai_content?: true;
    scheduled_at?: true;
    platform_payload?: true;
    post_snapshot?: true;
    tokens_unit_cost?: true;
    tokens_cost?: true;
    error_message?: true;
    created_at?: true;
    updated_at?: true;
    _all?: true;
};
export type Social_post_schedulesAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.social_post_schedulesWhereInput;
    orderBy?: Prisma.social_post_schedulesOrderByWithRelationInput | Prisma.social_post_schedulesOrderByWithRelationInput[];
    cursor?: Prisma.social_post_schedulesWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | Social_post_schedulesCountAggregateInputType;
    _avg?: Social_post_schedulesAvgAggregateInputType;
    _sum?: Social_post_schedulesSumAggregateInputType;
    _min?: Social_post_schedulesMinAggregateInputType;
    _max?: Social_post_schedulesMaxAggregateInputType;
};
export type GetSocial_post_schedulesAggregateType<T extends Social_post_schedulesAggregateArgs> = {
    [P in keyof T & keyof AggregateSocial_post_schedules]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateSocial_post_schedules[P]> : Prisma.GetScalarType<T[P], AggregateSocial_post_schedules[P]>;
};
export type social_post_schedulesGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.social_post_schedulesWhereInput;
    orderBy?: Prisma.social_post_schedulesOrderByWithAggregationInput | Prisma.social_post_schedulesOrderByWithAggregationInput[];
    by: Prisma.Social_post_schedulesScalarFieldEnum[] | Prisma.Social_post_schedulesScalarFieldEnum;
    having?: Prisma.social_post_schedulesScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: Social_post_schedulesCountAggregateInputType | true;
    _avg?: Social_post_schedulesAvgAggregateInputType;
    _sum?: Social_post_schedulesSumAggregateInputType;
    _min?: Social_post_schedulesMinAggregateInputType;
    _max?: Social_post_schedulesMaxAggregateInputType;
};
export type Social_post_schedulesGroupByOutputType = {
    id: string;
    organization_id: string;
    post_id: string;
    social_account_id: string | null;
    social_network: $Enums.social_network;
    status: $Enums.social_schedule_status;
    ai_content: boolean;
    scheduled_at: Date;
    platform_payload: runtime.JsonValue | null;
    post_snapshot: runtime.JsonValue;
    tokens_unit_cost: number;
    tokens_cost: number;
    error_message: string | null;
    created_at: Date;
    updated_at: Date;
    _count: Social_post_schedulesCountAggregateOutputType | null;
    _avg: Social_post_schedulesAvgAggregateOutputType | null;
    _sum: Social_post_schedulesSumAggregateOutputType | null;
    _min: Social_post_schedulesMinAggregateOutputType | null;
    _max: Social_post_schedulesMaxAggregateOutputType | null;
};
type GetSocial_post_schedulesGroupByPayload<T extends social_post_schedulesGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<Social_post_schedulesGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof Social_post_schedulesGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], Social_post_schedulesGroupByOutputType[P]> : Prisma.GetScalarType<T[P], Social_post_schedulesGroupByOutputType[P]>;
}>>;
export type social_post_schedulesWhereInput = {
    AND?: Prisma.social_post_schedulesWhereInput | Prisma.social_post_schedulesWhereInput[];
    OR?: Prisma.social_post_schedulesWhereInput[];
    NOT?: Prisma.social_post_schedulesWhereInput | Prisma.social_post_schedulesWhereInput[];
    id?: Prisma.StringFilter<"social_post_schedules"> | string;
    organization_id?: Prisma.StringFilter<"social_post_schedules"> | string;
    post_id?: Prisma.StringFilter<"social_post_schedules"> | string;
    social_account_id?: Prisma.StringNullableFilter<"social_post_schedules"> | string | null;
    social_network?: Prisma.Enumsocial_networkFilter<"social_post_schedules"> | $Enums.social_network;
    status?: Prisma.Enumsocial_schedule_statusFilter<"social_post_schedules"> | $Enums.social_schedule_status;
    ai_content?: Prisma.BoolFilter<"social_post_schedules"> | boolean;
    scheduled_at?: Prisma.DateTimeFilter<"social_post_schedules"> | Date | string;
    platform_payload?: Prisma.JsonNullableFilter<"social_post_schedules">;
    post_snapshot?: Prisma.JsonFilter<"social_post_schedules">;
    tokens_unit_cost?: Prisma.IntFilter<"social_post_schedules"> | number;
    tokens_cost?: Prisma.IntFilter<"social_post_schedules"> | number;
    error_message?: Prisma.StringNullableFilter<"social_post_schedules"> | string | null;
    created_at?: Prisma.DateTimeFilter<"social_post_schedules"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"social_post_schedules"> | Date | string;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
    post?: Prisma.XOR<Prisma.PostsScalarRelationFilter, Prisma.postsWhereInput>;
    social_account?: Prisma.XOR<Prisma.Social_accountsNullableScalarRelationFilter, Prisma.social_accountsWhereInput> | null;
    runs?: Prisma.Social_post_schedule_runsListRelationFilter;
};
export type social_post_schedulesOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    post_id?: Prisma.SortOrder;
    social_account_id?: Prisma.SortOrderInput | Prisma.SortOrder;
    social_network?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    ai_content?: Prisma.SortOrder;
    scheduled_at?: Prisma.SortOrder;
    platform_payload?: Prisma.SortOrderInput | Prisma.SortOrder;
    post_snapshot?: Prisma.SortOrder;
    tokens_unit_cost?: Prisma.SortOrder;
    tokens_cost?: Prisma.SortOrder;
    error_message?: Prisma.SortOrderInput | Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    organizations?: Prisma.organizationsOrderByWithRelationInput;
    post?: Prisma.postsOrderByWithRelationInput;
    social_account?: Prisma.social_accountsOrderByWithRelationInput;
    runs?: Prisma.social_post_schedule_runsOrderByRelationAggregateInput;
    _relevance?: Prisma.social_post_schedulesOrderByRelevanceInput;
};
export type social_post_schedulesWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    AND?: Prisma.social_post_schedulesWhereInput | Prisma.social_post_schedulesWhereInput[];
    OR?: Prisma.social_post_schedulesWhereInput[];
    NOT?: Prisma.social_post_schedulesWhereInput | Prisma.social_post_schedulesWhereInput[];
    organization_id?: Prisma.StringFilter<"social_post_schedules"> | string;
    post_id?: Prisma.StringFilter<"social_post_schedules"> | string;
    social_account_id?: Prisma.StringNullableFilter<"social_post_schedules"> | string | null;
    social_network?: Prisma.Enumsocial_networkFilter<"social_post_schedules"> | $Enums.social_network;
    status?: Prisma.Enumsocial_schedule_statusFilter<"social_post_schedules"> | $Enums.social_schedule_status;
    ai_content?: Prisma.BoolFilter<"social_post_schedules"> | boolean;
    scheduled_at?: Prisma.DateTimeFilter<"social_post_schedules"> | Date | string;
    platform_payload?: Prisma.JsonNullableFilter<"social_post_schedules">;
    post_snapshot?: Prisma.JsonFilter<"social_post_schedules">;
    tokens_unit_cost?: Prisma.IntFilter<"social_post_schedules"> | number;
    tokens_cost?: Prisma.IntFilter<"social_post_schedules"> | number;
    error_message?: Prisma.StringNullableFilter<"social_post_schedules"> | string | null;
    created_at?: Prisma.DateTimeFilter<"social_post_schedules"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"social_post_schedules"> | Date | string;
    organizations?: Prisma.XOR<Prisma.OrganizationsScalarRelationFilter, Prisma.organizationsWhereInput>;
    post?: Prisma.XOR<Prisma.PostsScalarRelationFilter, Prisma.postsWhereInput>;
    social_account?: Prisma.XOR<Prisma.Social_accountsNullableScalarRelationFilter, Prisma.social_accountsWhereInput> | null;
    runs?: Prisma.Social_post_schedule_runsListRelationFilter;
}, "id">;
export type social_post_schedulesOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    post_id?: Prisma.SortOrder;
    social_account_id?: Prisma.SortOrderInput | Prisma.SortOrder;
    social_network?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    ai_content?: Prisma.SortOrder;
    scheduled_at?: Prisma.SortOrder;
    platform_payload?: Prisma.SortOrderInput | Prisma.SortOrder;
    post_snapshot?: Prisma.SortOrder;
    tokens_unit_cost?: Prisma.SortOrder;
    tokens_cost?: Prisma.SortOrder;
    error_message?: Prisma.SortOrderInput | Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    _count?: Prisma.social_post_schedulesCountOrderByAggregateInput;
    _avg?: Prisma.social_post_schedulesAvgOrderByAggregateInput;
    _max?: Prisma.social_post_schedulesMaxOrderByAggregateInput;
    _min?: Prisma.social_post_schedulesMinOrderByAggregateInput;
    _sum?: Prisma.social_post_schedulesSumOrderByAggregateInput;
};
export type social_post_schedulesScalarWhereWithAggregatesInput = {
    AND?: Prisma.social_post_schedulesScalarWhereWithAggregatesInput | Prisma.social_post_schedulesScalarWhereWithAggregatesInput[];
    OR?: Prisma.social_post_schedulesScalarWhereWithAggregatesInput[];
    NOT?: Prisma.social_post_schedulesScalarWhereWithAggregatesInput | Prisma.social_post_schedulesScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"social_post_schedules"> | string;
    organization_id?: Prisma.StringWithAggregatesFilter<"social_post_schedules"> | string;
    post_id?: Prisma.StringWithAggregatesFilter<"social_post_schedules"> | string;
    social_account_id?: Prisma.StringNullableWithAggregatesFilter<"social_post_schedules"> | string | null;
    social_network?: Prisma.Enumsocial_networkWithAggregatesFilter<"social_post_schedules"> | $Enums.social_network;
    status?: Prisma.Enumsocial_schedule_statusWithAggregatesFilter<"social_post_schedules"> | $Enums.social_schedule_status;
    ai_content?: Prisma.BoolWithAggregatesFilter<"social_post_schedules"> | boolean;
    scheduled_at?: Prisma.DateTimeWithAggregatesFilter<"social_post_schedules"> | Date | string;
    platform_payload?: Prisma.JsonNullableWithAggregatesFilter<"social_post_schedules">;
    post_snapshot?: Prisma.JsonWithAggregatesFilter<"social_post_schedules">;
    tokens_unit_cost?: Prisma.IntWithAggregatesFilter<"social_post_schedules"> | number;
    tokens_cost?: Prisma.IntWithAggregatesFilter<"social_post_schedules"> | number;
    error_message?: Prisma.StringNullableWithAggregatesFilter<"social_post_schedules"> | string | null;
    created_at?: Prisma.DateTimeWithAggregatesFilter<"social_post_schedules"> | Date | string;
    updated_at?: Prisma.DateTimeWithAggregatesFilter<"social_post_schedules"> | Date | string;
};
export type social_post_schedulesCreateInput = {
    id?: string;
    social_network: $Enums.social_network;
    status?: $Enums.social_schedule_status;
    ai_content?: boolean;
    scheduled_at: Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: number;
    tokens_cost?: number;
    error_message?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    organizations: Prisma.organizationsCreateNestedOneWithoutSocial_post_schedulesInput;
    post: Prisma.postsCreateNestedOneWithoutSchedulesInput;
    social_account?: Prisma.social_accountsCreateNestedOneWithoutSchedulesInput;
    runs?: Prisma.social_post_schedule_runsCreateNestedManyWithoutScheduleInput;
};
export type social_post_schedulesUncheckedCreateInput = {
    id?: string;
    organization_id: string;
    post_id: string;
    social_account_id?: string | null;
    social_network: $Enums.social_network;
    status?: $Enums.social_schedule_status;
    ai_content?: boolean;
    scheduled_at: Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: number;
    tokens_cost?: number;
    error_message?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    runs?: Prisma.social_post_schedule_runsUncheckedCreateNestedManyWithoutScheduleInput;
};
export type social_post_schedulesUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    social_network?: Prisma.Enumsocial_networkFieldUpdateOperationsInput | $Enums.social_network;
    status?: Prisma.Enumsocial_schedule_statusFieldUpdateOperationsInput | $Enums.social_schedule_status;
    ai_content?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    scheduled_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    tokens_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    error_message?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutSocial_post_schedulesNestedInput;
    post?: Prisma.postsUpdateOneRequiredWithoutSchedulesNestedInput;
    social_account?: Prisma.social_accountsUpdateOneWithoutSchedulesNestedInput;
    runs?: Prisma.social_post_schedule_runsUpdateManyWithoutScheduleNestedInput;
};
export type social_post_schedulesUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    post_id?: Prisma.StringFieldUpdateOperationsInput | string;
    social_account_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    social_network?: Prisma.Enumsocial_networkFieldUpdateOperationsInput | $Enums.social_network;
    status?: Prisma.Enumsocial_schedule_statusFieldUpdateOperationsInput | $Enums.social_schedule_status;
    ai_content?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    scheduled_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    tokens_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    error_message?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    runs?: Prisma.social_post_schedule_runsUncheckedUpdateManyWithoutScheduleNestedInput;
};
export type social_post_schedulesCreateManyInput = {
    id?: string;
    organization_id: string;
    post_id: string;
    social_account_id?: string | null;
    social_network: $Enums.social_network;
    status?: $Enums.social_schedule_status;
    ai_content?: boolean;
    scheduled_at: Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: number;
    tokens_cost?: number;
    error_message?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type social_post_schedulesUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    social_network?: Prisma.Enumsocial_networkFieldUpdateOperationsInput | $Enums.social_network;
    status?: Prisma.Enumsocial_schedule_statusFieldUpdateOperationsInput | $Enums.social_schedule_status;
    ai_content?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    scheduled_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    tokens_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    error_message?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type social_post_schedulesUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    post_id?: Prisma.StringFieldUpdateOperationsInput | string;
    social_account_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    social_network?: Prisma.Enumsocial_networkFieldUpdateOperationsInput | $Enums.social_network;
    status?: Prisma.Enumsocial_schedule_statusFieldUpdateOperationsInput | $Enums.social_schedule_status;
    ai_content?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    scheduled_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    tokens_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    error_message?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type Social_post_schedulesListRelationFilter = {
    every?: Prisma.social_post_schedulesWhereInput;
    some?: Prisma.social_post_schedulesWhereInput;
    none?: Prisma.social_post_schedulesWhereInput;
};
export type social_post_schedulesOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type social_post_schedulesOrderByRelevanceInput = {
    fields: Prisma.social_post_schedulesOrderByRelevanceFieldEnum | Prisma.social_post_schedulesOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type social_post_schedulesCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    post_id?: Prisma.SortOrder;
    social_account_id?: Prisma.SortOrder;
    social_network?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    ai_content?: Prisma.SortOrder;
    scheduled_at?: Prisma.SortOrder;
    platform_payload?: Prisma.SortOrder;
    post_snapshot?: Prisma.SortOrder;
    tokens_unit_cost?: Prisma.SortOrder;
    tokens_cost?: Prisma.SortOrder;
    error_message?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type social_post_schedulesAvgOrderByAggregateInput = {
    tokens_unit_cost?: Prisma.SortOrder;
    tokens_cost?: Prisma.SortOrder;
};
export type social_post_schedulesMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    post_id?: Prisma.SortOrder;
    social_account_id?: Prisma.SortOrder;
    social_network?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    ai_content?: Prisma.SortOrder;
    scheduled_at?: Prisma.SortOrder;
    tokens_unit_cost?: Prisma.SortOrder;
    tokens_cost?: Prisma.SortOrder;
    error_message?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type social_post_schedulesMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    organization_id?: Prisma.SortOrder;
    post_id?: Prisma.SortOrder;
    social_account_id?: Prisma.SortOrder;
    social_network?: Prisma.SortOrder;
    status?: Prisma.SortOrder;
    ai_content?: Prisma.SortOrder;
    scheduled_at?: Prisma.SortOrder;
    tokens_unit_cost?: Prisma.SortOrder;
    tokens_cost?: Prisma.SortOrder;
    error_message?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type social_post_schedulesSumOrderByAggregateInput = {
    tokens_unit_cost?: Prisma.SortOrder;
    tokens_cost?: Prisma.SortOrder;
};
export type Social_post_schedulesNullableScalarRelationFilter = {
    is?: Prisma.social_post_schedulesWhereInput | null;
    isNot?: Prisma.social_post_schedulesWhereInput | null;
};
export type social_post_schedulesCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.social_post_schedulesCreateWithoutOrganizationsInput, Prisma.social_post_schedulesUncheckedCreateWithoutOrganizationsInput> | Prisma.social_post_schedulesCreateWithoutOrganizationsInput[] | Prisma.social_post_schedulesUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.social_post_schedulesCreateOrConnectWithoutOrganizationsInput | Prisma.social_post_schedulesCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.social_post_schedulesCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
};
export type social_post_schedulesUncheckedCreateNestedManyWithoutOrganizationsInput = {
    create?: Prisma.XOR<Prisma.social_post_schedulesCreateWithoutOrganizationsInput, Prisma.social_post_schedulesUncheckedCreateWithoutOrganizationsInput> | Prisma.social_post_schedulesCreateWithoutOrganizationsInput[] | Prisma.social_post_schedulesUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.social_post_schedulesCreateOrConnectWithoutOrganizationsInput | Prisma.social_post_schedulesCreateOrConnectWithoutOrganizationsInput[];
    createMany?: Prisma.social_post_schedulesCreateManyOrganizationsInputEnvelope;
    connect?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
};
export type social_post_schedulesUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.social_post_schedulesCreateWithoutOrganizationsInput, Prisma.social_post_schedulesUncheckedCreateWithoutOrganizationsInput> | Prisma.social_post_schedulesCreateWithoutOrganizationsInput[] | Prisma.social_post_schedulesUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.social_post_schedulesCreateOrConnectWithoutOrganizationsInput | Prisma.social_post_schedulesCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.social_post_schedulesUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.social_post_schedulesUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.social_post_schedulesCreateManyOrganizationsInputEnvelope;
    set?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    disconnect?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    delete?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    connect?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    update?: Prisma.social_post_schedulesUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.social_post_schedulesUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.social_post_schedulesUpdateManyWithWhereWithoutOrganizationsInput | Prisma.social_post_schedulesUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.social_post_schedulesScalarWhereInput | Prisma.social_post_schedulesScalarWhereInput[];
};
export type social_post_schedulesUncheckedUpdateManyWithoutOrganizationsNestedInput = {
    create?: Prisma.XOR<Prisma.social_post_schedulesCreateWithoutOrganizationsInput, Prisma.social_post_schedulesUncheckedCreateWithoutOrganizationsInput> | Prisma.social_post_schedulesCreateWithoutOrganizationsInput[] | Prisma.social_post_schedulesUncheckedCreateWithoutOrganizationsInput[];
    connectOrCreate?: Prisma.social_post_schedulesCreateOrConnectWithoutOrganizationsInput | Prisma.social_post_schedulesCreateOrConnectWithoutOrganizationsInput[];
    upsert?: Prisma.social_post_schedulesUpsertWithWhereUniqueWithoutOrganizationsInput | Prisma.social_post_schedulesUpsertWithWhereUniqueWithoutOrganizationsInput[];
    createMany?: Prisma.social_post_schedulesCreateManyOrganizationsInputEnvelope;
    set?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    disconnect?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    delete?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    connect?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    update?: Prisma.social_post_schedulesUpdateWithWhereUniqueWithoutOrganizationsInput | Prisma.social_post_schedulesUpdateWithWhereUniqueWithoutOrganizationsInput[];
    updateMany?: Prisma.social_post_schedulesUpdateManyWithWhereWithoutOrganizationsInput | Prisma.social_post_schedulesUpdateManyWithWhereWithoutOrganizationsInput[];
    deleteMany?: Prisma.social_post_schedulesScalarWhereInput | Prisma.social_post_schedulesScalarWhereInput[];
};
export type social_post_schedulesCreateNestedManyWithoutPostInput = {
    create?: Prisma.XOR<Prisma.social_post_schedulesCreateWithoutPostInput, Prisma.social_post_schedulesUncheckedCreateWithoutPostInput> | Prisma.social_post_schedulesCreateWithoutPostInput[] | Prisma.social_post_schedulesUncheckedCreateWithoutPostInput[];
    connectOrCreate?: Prisma.social_post_schedulesCreateOrConnectWithoutPostInput | Prisma.social_post_schedulesCreateOrConnectWithoutPostInput[];
    createMany?: Prisma.social_post_schedulesCreateManyPostInputEnvelope;
    connect?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
};
export type social_post_schedulesUncheckedCreateNestedManyWithoutPostInput = {
    create?: Prisma.XOR<Prisma.social_post_schedulesCreateWithoutPostInput, Prisma.social_post_schedulesUncheckedCreateWithoutPostInput> | Prisma.social_post_schedulesCreateWithoutPostInput[] | Prisma.social_post_schedulesUncheckedCreateWithoutPostInput[];
    connectOrCreate?: Prisma.social_post_schedulesCreateOrConnectWithoutPostInput | Prisma.social_post_schedulesCreateOrConnectWithoutPostInput[];
    createMany?: Prisma.social_post_schedulesCreateManyPostInputEnvelope;
    connect?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
};
export type social_post_schedulesUpdateManyWithoutPostNestedInput = {
    create?: Prisma.XOR<Prisma.social_post_schedulesCreateWithoutPostInput, Prisma.social_post_schedulesUncheckedCreateWithoutPostInput> | Prisma.social_post_schedulesCreateWithoutPostInput[] | Prisma.social_post_schedulesUncheckedCreateWithoutPostInput[];
    connectOrCreate?: Prisma.social_post_schedulesCreateOrConnectWithoutPostInput | Prisma.social_post_schedulesCreateOrConnectWithoutPostInput[];
    upsert?: Prisma.social_post_schedulesUpsertWithWhereUniqueWithoutPostInput | Prisma.social_post_schedulesUpsertWithWhereUniqueWithoutPostInput[];
    createMany?: Prisma.social_post_schedulesCreateManyPostInputEnvelope;
    set?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    disconnect?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    delete?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    connect?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    update?: Prisma.social_post_schedulesUpdateWithWhereUniqueWithoutPostInput | Prisma.social_post_schedulesUpdateWithWhereUniqueWithoutPostInput[];
    updateMany?: Prisma.social_post_schedulesUpdateManyWithWhereWithoutPostInput | Prisma.social_post_schedulesUpdateManyWithWhereWithoutPostInput[];
    deleteMany?: Prisma.social_post_schedulesScalarWhereInput | Prisma.social_post_schedulesScalarWhereInput[];
};
export type social_post_schedulesUncheckedUpdateManyWithoutPostNestedInput = {
    create?: Prisma.XOR<Prisma.social_post_schedulesCreateWithoutPostInput, Prisma.social_post_schedulesUncheckedCreateWithoutPostInput> | Prisma.social_post_schedulesCreateWithoutPostInput[] | Prisma.social_post_schedulesUncheckedCreateWithoutPostInput[];
    connectOrCreate?: Prisma.social_post_schedulesCreateOrConnectWithoutPostInput | Prisma.social_post_schedulesCreateOrConnectWithoutPostInput[];
    upsert?: Prisma.social_post_schedulesUpsertWithWhereUniqueWithoutPostInput | Prisma.social_post_schedulesUpsertWithWhereUniqueWithoutPostInput[];
    createMany?: Prisma.social_post_schedulesCreateManyPostInputEnvelope;
    set?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    disconnect?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    delete?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    connect?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    update?: Prisma.social_post_schedulesUpdateWithWhereUniqueWithoutPostInput | Prisma.social_post_schedulesUpdateWithWhereUniqueWithoutPostInput[];
    updateMany?: Prisma.social_post_schedulesUpdateManyWithWhereWithoutPostInput | Prisma.social_post_schedulesUpdateManyWithWhereWithoutPostInput[];
    deleteMany?: Prisma.social_post_schedulesScalarWhereInput | Prisma.social_post_schedulesScalarWhereInput[];
};
export type Enumsocial_networkFieldUpdateOperationsInput = {
    set?: $Enums.social_network;
};
export type Enumsocial_schedule_statusFieldUpdateOperationsInput = {
    set?: $Enums.social_schedule_status;
};
export type social_post_schedulesCreateNestedOneWithoutRunsInput = {
    create?: Prisma.XOR<Prisma.social_post_schedulesCreateWithoutRunsInput, Prisma.social_post_schedulesUncheckedCreateWithoutRunsInput>;
    connectOrCreate?: Prisma.social_post_schedulesCreateOrConnectWithoutRunsInput;
    connect?: Prisma.social_post_schedulesWhereUniqueInput;
};
export type social_post_schedulesUpdateOneWithoutRunsNestedInput = {
    create?: Prisma.XOR<Prisma.social_post_schedulesCreateWithoutRunsInput, Prisma.social_post_schedulesUncheckedCreateWithoutRunsInput>;
    connectOrCreate?: Prisma.social_post_schedulesCreateOrConnectWithoutRunsInput;
    upsert?: Prisma.social_post_schedulesUpsertWithoutRunsInput;
    disconnect?: Prisma.social_post_schedulesWhereInput | boolean;
    delete?: Prisma.social_post_schedulesWhereInput | boolean;
    connect?: Prisma.social_post_schedulesWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.social_post_schedulesUpdateToOneWithWhereWithoutRunsInput, Prisma.social_post_schedulesUpdateWithoutRunsInput>, Prisma.social_post_schedulesUncheckedUpdateWithoutRunsInput>;
};
export type social_post_schedulesCreateNestedManyWithoutSocial_accountInput = {
    create?: Prisma.XOR<Prisma.social_post_schedulesCreateWithoutSocial_accountInput, Prisma.social_post_schedulesUncheckedCreateWithoutSocial_accountInput> | Prisma.social_post_schedulesCreateWithoutSocial_accountInput[] | Prisma.social_post_schedulesUncheckedCreateWithoutSocial_accountInput[];
    connectOrCreate?: Prisma.social_post_schedulesCreateOrConnectWithoutSocial_accountInput | Prisma.social_post_schedulesCreateOrConnectWithoutSocial_accountInput[];
    createMany?: Prisma.social_post_schedulesCreateManySocial_accountInputEnvelope;
    connect?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
};
export type social_post_schedulesUncheckedCreateNestedManyWithoutSocial_accountInput = {
    create?: Prisma.XOR<Prisma.social_post_schedulesCreateWithoutSocial_accountInput, Prisma.social_post_schedulesUncheckedCreateWithoutSocial_accountInput> | Prisma.social_post_schedulesCreateWithoutSocial_accountInput[] | Prisma.social_post_schedulesUncheckedCreateWithoutSocial_accountInput[];
    connectOrCreate?: Prisma.social_post_schedulesCreateOrConnectWithoutSocial_accountInput | Prisma.social_post_schedulesCreateOrConnectWithoutSocial_accountInput[];
    createMany?: Prisma.social_post_schedulesCreateManySocial_accountInputEnvelope;
    connect?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
};
export type social_post_schedulesUpdateManyWithoutSocial_accountNestedInput = {
    create?: Prisma.XOR<Prisma.social_post_schedulesCreateWithoutSocial_accountInput, Prisma.social_post_schedulesUncheckedCreateWithoutSocial_accountInput> | Prisma.social_post_schedulesCreateWithoutSocial_accountInput[] | Prisma.social_post_schedulesUncheckedCreateWithoutSocial_accountInput[];
    connectOrCreate?: Prisma.social_post_schedulesCreateOrConnectWithoutSocial_accountInput | Prisma.social_post_schedulesCreateOrConnectWithoutSocial_accountInput[];
    upsert?: Prisma.social_post_schedulesUpsertWithWhereUniqueWithoutSocial_accountInput | Prisma.social_post_schedulesUpsertWithWhereUniqueWithoutSocial_accountInput[];
    createMany?: Prisma.social_post_schedulesCreateManySocial_accountInputEnvelope;
    set?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    disconnect?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    delete?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    connect?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    update?: Prisma.social_post_schedulesUpdateWithWhereUniqueWithoutSocial_accountInput | Prisma.social_post_schedulesUpdateWithWhereUniqueWithoutSocial_accountInput[];
    updateMany?: Prisma.social_post_schedulesUpdateManyWithWhereWithoutSocial_accountInput | Prisma.social_post_schedulesUpdateManyWithWhereWithoutSocial_accountInput[];
    deleteMany?: Prisma.social_post_schedulesScalarWhereInput | Prisma.social_post_schedulesScalarWhereInput[];
};
export type social_post_schedulesUncheckedUpdateManyWithoutSocial_accountNestedInput = {
    create?: Prisma.XOR<Prisma.social_post_schedulesCreateWithoutSocial_accountInput, Prisma.social_post_schedulesUncheckedCreateWithoutSocial_accountInput> | Prisma.social_post_schedulesCreateWithoutSocial_accountInput[] | Prisma.social_post_schedulesUncheckedCreateWithoutSocial_accountInput[];
    connectOrCreate?: Prisma.social_post_schedulesCreateOrConnectWithoutSocial_accountInput | Prisma.social_post_schedulesCreateOrConnectWithoutSocial_accountInput[];
    upsert?: Prisma.social_post_schedulesUpsertWithWhereUniqueWithoutSocial_accountInput | Prisma.social_post_schedulesUpsertWithWhereUniqueWithoutSocial_accountInput[];
    createMany?: Prisma.social_post_schedulesCreateManySocial_accountInputEnvelope;
    set?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    disconnect?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    delete?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    connect?: Prisma.social_post_schedulesWhereUniqueInput | Prisma.social_post_schedulesWhereUniqueInput[];
    update?: Prisma.social_post_schedulesUpdateWithWhereUniqueWithoutSocial_accountInput | Prisma.social_post_schedulesUpdateWithWhereUniqueWithoutSocial_accountInput[];
    updateMany?: Prisma.social_post_schedulesUpdateManyWithWhereWithoutSocial_accountInput | Prisma.social_post_schedulesUpdateManyWithWhereWithoutSocial_accountInput[];
    deleteMany?: Prisma.social_post_schedulesScalarWhereInput | Prisma.social_post_schedulesScalarWhereInput[];
};
export type social_post_schedulesCreateWithoutOrganizationsInput = {
    id?: string;
    social_network: $Enums.social_network;
    status?: $Enums.social_schedule_status;
    ai_content?: boolean;
    scheduled_at: Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: number;
    tokens_cost?: number;
    error_message?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    post: Prisma.postsCreateNestedOneWithoutSchedulesInput;
    social_account?: Prisma.social_accountsCreateNestedOneWithoutSchedulesInput;
    runs?: Prisma.social_post_schedule_runsCreateNestedManyWithoutScheduleInput;
};
export type social_post_schedulesUncheckedCreateWithoutOrganizationsInput = {
    id?: string;
    post_id: string;
    social_account_id?: string | null;
    social_network: $Enums.social_network;
    status?: $Enums.social_schedule_status;
    ai_content?: boolean;
    scheduled_at: Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: number;
    tokens_cost?: number;
    error_message?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    runs?: Prisma.social_post_schedule_runsUncheckedCreateNestedManyWithoutScheduleInput;
};
export type social_post_schedulesCreateOrConnectWithoutOrganizationsInput = {
    where: Prisma.social_post_schedulesWhereUniqueInput;
    create: Prisma.XOR<Prisma.social_post_schedulesCreateWithoutOrganizationsInput, Prisma.social_post_schedulesUncheckedCreateWithoutOrganizationsInput>;
};
export type social_post_schedulesCreateManyOrganizationsInputEnvelope = {
    data: Prisma.social_post_schedulesCreateManyOrganizationsInput | Prisma.social_post_schedulesCreateManyOrganizationsInput[];
    skipDuplicates?: boolean;
};
export type social_post_schedulesUpsertWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.social_post_schedulesWhereUniqueInput;
    update: Prisma.XOR<Prisma.social_post_schedulesUpdateWithoutOrganizationsInput, Prisma.social_post_schedulesUncheckedUpdateWithoutOrganizationsInput>;
    create: Prisma.XOR<Prisma.social_post_schedulesCreateWithoutOrganizationsInput, Prisma.social_post_schedulesUncheckedCreateWithoutOrganizationsInput>;
};
export type social_post_schedulesUpdateWithWhereUniqueWithoutOrganizationsInput = {
    where: Prisma.social_post_schedulesWhereUniqueInput;
    data: Prisma.XOR<Prisma.social_post_schedulesUpdateWithoutOrganizationsInput, Prisma.social_post_schedulesUncheckedUpdateWithoutOrganizationsInput>;
};
export type social_post_schedulesUpdateManyWithWhereWithoutOrganizationsInput = {
    where: Prisma.social_post_schedulesScalarWhereInput;
    data: Prisma.XOR<Prisma.social_post_schedulesUpdateManyMutationInput, Prisma.social_post_schedulesUncheckedUpdateManyWithoutOrganizationsInput>;
};
export type social_post_schedulesScalarWhereInput = {
    AND?: Prisma.social_post_schedulesScalarWhereInput | Prisma.social_post_schedulesScalarWhereInput[];
    OR?: Prisma.social_post_schedulesScalarWhereInput[];
    NOT?: Prisma.social_post_schedulesScalarWhereInput | Prisma.social_post_schedulesScalarWhereInput[];
    id?: Prisma.StringFilter<"social_post_schedules"> | string;
    organization_id?: Prisma.StringFilter<"social_post_schedules"> | string;
    post_id?: Prisma.StringFilter<"social_post_schedules"> | string;
    social_account_id?: Prisma.StringNullableFilter<"social_post_schedules"> | string | null;
    social_network?: Prisma.Enumsocial_networkFilter<"social_post_schedules"> | $Enums.social_network;
    status?: Prisma.Enumsocial_schedule_statusFilter<"social_post_schedules"> | $Enums.social_schedule_status;
    ai_content?: Prisma.BoolFilter<"social_post_schedules"> | boolean;
    scheduled_at?: Prisma.DateTimeFilter<"social_post_schedules"> | Date | string;
    platform_payload?: Prisma.JsonNullableFilter<"social_post_schedules">;
    post_snapshot?: Prisma.JsonFilter<"social_post_schedules">;
    tokens_unit_cost?: Prisma.IntFilter<"social_post_schedules"> | number;
    tokens_cost?: Prisma.IntFilter<"social_post_schedules"> | number;
    error_message?: Prisma.StringNullableFilter<"social_post_schedules"> | string | null;
    created_at?: Prisma.DateTimeFilter<"social_post_schedules"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"social_post_schedules"> | Date | string;
};
export type social_post_schedulesCreateWithoutPostInput = {
    id?: string;
    social_network: $Enums.social_network;
    status?: $Enums.social_schedule_status;
    ai_content?: boolean;
    scheduled_at: Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: number;
    tokens_cost?: number;
    error_message?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    organizations: Prisma.organizationsCreateNestedOneWithoutSocial_post_schedulesInput;
    social_account?: Prisma.social_accountsCreateNestedOneWithoutSchedulesInput;
    runs?: Prisma.social_post_schedule_runsCreateNestedManyWithoutScheduleInput;
};
export type social_post_schedulesUncheckedCreateWithoutPostInput = {
    id?: string;
    organization_id: string;
    social_account_id?: string | null;
    social_network: $Enums.social_network;
    status?: $Enums.social_schedule_status;
    ai_content?: boolean;
    scheduled_at: Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: number;
    tokens_cost?: number;
    error_message?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    runs?: Prisma.social_post_schedule_runsUncheckedCreateNestedManyWithoutScheduleInput;
};
export type social_post_schedulesCreateOrConnectWithoutPostInput = {
    where: Prisma.social_post_schedulesWhereUniqueInput;
    create: Prisma.XOR<Prisma.social_post_schedulesCreateWithoutPostInput, Prisma.social_post_schedulesUncheckedCreateWithoutPostInput>;
};
export type social_post_schedulesCreateManyPostInputEnvelope = {
    data: Prisma.social_post_schedulesCreateManyPostInput | Prisma.social_post_schedulesCreateManyPostInput[];
    skipDuplicates?: boolean;
};
export type social_post_schedulesUpsertWithWhereUniqueWithoutPostInput = {
    where: Prisma.social_post_schedulesWhereUniqueInput;
    update: Prisma.XOR<Prisma.social_post_schedulesUpdateWithoutPostInput, Prisma.social_post_schedulesUncheckedUpdateWithoutPostInput>;
    create: Prisma.XOR<Prisma.social_post_schedulesCreateWithoutPostInput, Prisma.social_post_schedulesUncheckedCreateWithoutPostInput>;
};
export type social_post_schedulesUpdateWithWhereUniqueWithoutPostInput = {
    where: Prisma.social_post_schedulesWhereUniqueInput;
    data: Prisma.XOR<Prisma.social_post_schedulesUpdateWithoutPostInput, Prisma.social_post_schedulesUncheckedUpdateWithoutPostInput>;
};
export type social_post_schedulesUpdateManyWithWhereWithoutPostInput = {
    where: Prisma.social_post_schedulesScalarWhereInput;
    data: Prisma.XOR<Prisma.social_post_schedulesUpdateManyMutationInput, Prisma.social_post_schedulesUncheckedUpdateManyWithoutPostInput>;
};
export type social_post_schedulesCreateWithoutRunsInput = {
    id?: string;
    social_network: $Enums.social_network;
    status?: $Enums.social_schedule_status;
    ai_content?: boolean;
    scheduled_at: Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: number;
    tokens_cost?: number;
    error_message?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    organizations: Prisma.organizationsCreateNestedOneWithoutSocial_post_schedulesInput;
    post: Prisma.postsCreateNestedOneWithoutSchedulesInput;
    social_account?: Prisma.social_accountsCreateNestedOneWithoutSchedulesInput;
};
export type social_post_schedulesUncheckedCreateWithoutRunsInput = {
    id?: string;
    organization_id: string;
    post_id: string;
    social_account_id?: string | null;
    social_network: $Enums.social_network;
    status?: $Enums.social_schedule_status;
    ai_content?: boolean;
    scheduled_at: Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: number;
    tokens_cost?: number;
    error_message?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type social_post_schedulesCreateOrConnectWithoutRunsInput = {
    where: Prisma.social_post_schedulesWhereUniqueInput;
    create: Prisma.XOR<Prisma.social_post_schedulesCreateWithoutRunsInput, Prisma.social_post_schedulesUncheckedCreateWithoutRunsInput>;
};
export type social_post_schedulesUpsertWithoutRunsInput = {
    update: Prisma.XOR<Prisma.social_post_schedulesUpdateWithoutRunsInput, Prisma.social_post_schedulesUncheckedUpdateWithoutRunsInput>;
    create: Prisma.XOR<Prisma.social_post_schedulesCreateWithoutRunsInput, Prisma.social_post_schedulesUncheckedCreateWithoutRunsInput>;
    where?: Prisma.social_post_schedulesWhereInput;
};
export type social_post_schedulesUpdateToOneWithWhereWithoutRunsInput = {
    where?: Prisma.social_post_schedulesWhereInput;
    data: Prisma.XOR<Prisma.social_post_schedulesUpdateWithoutRunsInput, Prisma.social_post_schedulesUncheckedUpdateWithoutRunsInput>;
};
export type social_post_schedulesUpdateWithoutRunsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    social_network?: Prisma.Enumsocial_networkFieldUpdateOperationsInput | $Enums.social_network;
    status?: Prisma.Enumsocial_schedule_statusFieldUpdateOperationsInput | $Enums.social_schedule_status;
    ai_content?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    scheduled_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    tokens_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    error_message?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutSocial_post_schedulesNestedInput;
    post?: Prisma.postsUpdateOneRequiredWithoutSchedulesNestedInput;
    social_account?: Prisma.social_accountsUpdateOneWithoutSchedulesNestedInput;
};
export type social_post_schedulesUncheckedUpdateWithoutRunsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    post_id?: Prisma.StringFieldUpdateOperationsInput | string;
    social_account_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    social_network?: Prisma.Enumsocial_networkFieldUpdateOperationsInput | $Enums.social_network;
    status?: Prisma.Enumsocial_schedule_statusFieldUpdateOperationsInput | $Enums.social_schedule_status;
    ai_content?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    scheduled_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    tokens_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    error_message?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type social_post_schedulesCreateWithoutSocial_accountInput = {
    id?: string;
    social_network: $Enums.social_network;
    status?: $Enums.social_schedule_status;
    ai_content?: boolean;
    scheduled_at: Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: number;
    tokens_cost?: number;
    error_message?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    organizations: Prisma.organizationsCreateNestedOneWithoutSocial_post_schedulesInput;
    post: Prisma.postsCreateNestedOneWithoutSchedulesInput;
    runs?: Prisma.social_post_schedule_runsCreateNestedManyWithoutScheduleInput;
};
export type social_post_schedulesUncheckedCreateWithoutSocial_accountInput = {
    id?: string;
    organization_id: string;
    post_id: string;
    social_network: $Enums.social_network;
    status?: $Enums.social_schedule_status;
    ai_content?: boolean;
    scheduled_at: Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: number;
    tokens_cost?: number;
    error_message?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    runs?: Prisma.social_post_schedule_runsUncheckedCreateNestedManyWithoutScheduleInput;
};
export type social_post_schedulesCreateOrConnectWithoutSocial_accountInput = {
    where: Prisma.social_post_schedulesWhereUniqueInput;
    create: Prisma.XOR<Prisma.social_post_schedulesCreateWithoutSocial_accountInput, Prisma.social_post_schedulesUncheckedCreateWithoutSocial_accountInput>;
};
export type social_post_schedulesCreateManySocial_accountInputEnvelope = {
    data: Prisma.social_post_schedulesCreateManySocial_accountInput | Prisma.social_post_schedulesCreateManySocial_accountInput[];
    skipDuplicates?: boolean;
};
export type social_post_schedulesUpsertWithWhereUniqueWithoutSocial_accountInput = {
    where: Prisma.social_post_schedulesWhereUniqueInput;
    update: Prisma.XOR<Prisma.social_post_schedulesUpdateWithoutSocial_accountInput, Prisma.social_post_schedulesUncheckedUpdateWithoutSocial_accountInput>;
    create: Prisma.XOR<Prisma.social_post_schedulesCreateWithoutSocial_accountInput, Prisma.social_post_schedulesUncheckedCreateWithoutSocial_accountInput>;
};
export type social_post_schedulesUpdateWithWhereUniqueWithoutSocial_accountInput = {
    where: Prisma.social_post_schedulesWhereUniqueInput;
    data: Prisma.XOR<Prisma.social_post_schedulesUpdateWithoutSocial_accountInput, Prisma.social_post_schedulesUncheckedUpdateWithoutSocial_accountInput>;
};
export type social_post_schedulesUpdateManyWithWhereWithoutSocial_accountInput = {
    where: Prisma.social_post_schedulesScalarWhereInput;
    data: Prisma.XOR<Prisma.social_post_schedulesUpdateManyMutationInput, Prisma.social_post_schedulesUncheckedUpdateManyWithoutSocial_accountInput>;
};
export type social_post_schedulesCreateManyOrganizationsInput = {
    id?: string;
    post_id: string;
    social_account_id?: string | null;
    social_network: $Enums.social_network;
    status?: $Enums.social_schedule_status;
    ai_content?: boolean;
    scheduled_at: Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: number;
    tokens_cost?: number;
    error_message?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type social_post_schedulesUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    social_network?: Prisma.Enumsocial_networkFieldUpdateOperationsInput | $Enums.social_network;
    status?: Prisma.Enumsocial_schedule_statusFieldUpdateOperationsInput | $Enums.social_schedule_status;
    ai_content?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    scheduled_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    tokens_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    error_message?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    post?: Prisma.postsUpdateOneRequiredWithoutSchedulesNestedInput;
    social_account?: Prisma.social_accountsUpdateOneWithoutSchedulesNestedInput;
    runs?: Prisma.social_post_schedule_runsUpdateManyWithoutScheduleNestedInput;
};
export type social_post_schedulesUncheckedUpdateWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    post_id?: Prisma.StringFieldUpdateOperationsInput | string;
    social_account_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    social_network?: Prisma.Enumsocial_networkFieldUpdateOperationsInput | $Enums.social_network;
    status?: Prisma.Enumsocial_schedule_statusFieldUpdateOperationsInput | $Enums.social_schedule_status;
    ai_content?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    scheduled_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    tokens_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    error_message?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    runs?: Prisma.social_post_schedule_runsUncheckedUpdateManyWithoutScheduleNestedInput;
};
export type social_post_schedulesUncheckedUpdateManyWithoutOrganizationsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    post_id?: Prisma.StringFieldUpdateOperationsInput | string;
    social_account_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    social_network?: Prisma.Enumsocial_networkFieldUpdateOperationsInput | $Enums.social_network;
    status?: Prisma.Enumsocial_schedule_statusFieldUpdateOperationsInput | $Enums.social_schedule_status;
    ai_content?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    scheduled_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    tokens_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    error_message?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type social_post_schedulesCreateManyPostInput = {
    id?: string;
    organization_id: string;
    social_account_id?: string | null;
    social_network: $Enums.social_network;
    status?: $Enums.social_schedule_status;
    ai_content?: boolean;
    scheduled_at: Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: number;
    tokens_cost?: number;
    error_message?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type social_post_schedulesUpdateWithoutPostInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    social_network?: Prisma.Enumsocial_networkFieldUpdateOperationsInput | $Enums.social_network;
    status?: Prisma.Enumsocial_schedule_statusFieldUpdateOperationsInput | $Enums.social_schedule_status;
    ai_content?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    scheduled_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    tokens_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    error_message?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutSocial_post_schedulesNestedInput;
    social_account?: Prisma.social_accountsUpdateOneWithoutSchedulesNestedInput;
    runs?: Prisma.social_post_schedule_runsUpdateManyWithoutScheduleNestedInput;
};
export type social_post_schedulesUncheckedUpdateWithoutPostInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    social_account_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    social_network?: Prisma.Enumsocial_networkFieldUpdateOperationsInput | $Enums.social_network;
    status?: Prisma.Enumsocial_schedule_statusFieldUpdateOperationsInput | $Enums.social_schedule_status;
    ai_content?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    scheduled_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    tokens_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    error_message?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    runs?: Prisma.social_post_schedule_runsUncheckedUpdateManyWithoutScheduleNestedInput;
};
export type social_post_schedulesUncheckedUpdateManyWithoutPostInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    social_account_id?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    social_network?: Prisma.Enumsocial_networkFieldUpdateOperationsInput | $Enums.social_network;
    status?: Prisma.Enumsocial_schedule_statusFieldUpdateOperationsInput | $Enums.social_schedule_status;
    ai_content?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    scheduled_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    tokens_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    error_message?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type social_post_schedulesCreateManySocial_accountInput = {
    id?: string;
    organization_id: string;
    post_id: string;
    social_network: $Enums.social_network;
    status?: $Enums.social_schedule_status;
    ai_content?: boolean;
    scheduled_at: Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: number;
    tokens_cost?: number;
    error_message?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type social_post_schedulesUpdateWithoutSocial_accountInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    social_network?: Prisma.Enumsocial_networkFieldUpdateOperationsInput | $Enums.social_network;
    status?: Prisma.Enumsocial_schedule_statusFieldUpdateOperationsInput | $Enums.social_schedule_status;
    ai_content?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    scheduled_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    tokens_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    error_message?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    organizations?: Prisma.organizationsUpdateOneRequiredWithoutSocial_post_schedulesNestedInput;
    post?: Prisma.postsUpdateOneRequiredWithoutSchedulesNestedInput;
    runs?: Prisma.social_post_schedule_runsUpdateManyWithoutScheduleNestedInput;
};
export type social_post_schedulesUncheckedUpdateWithoutSocial_accountInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    post_id?: Prisma.StringFieldUpdateOperationsInput | string;
    social_network?: Prisma.Enumsocial_networkFieldUpdateOperationsInput | $Enums.social_network;
    status?: Prisma.Enumsocial_schedule_statusFieldUpdateOperationsInput | $Enums.social_schedule_status;
    ai_content?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    scheduled_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    tokens_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    error_message?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    runs?: Prisma.social_post_schedule_runsUncheckedUpdateManyWithoutScheduleNestedInput;
};
export type social_post_schedulesUncheckedUpdateManyWithoutSocial_accountInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    organization_id?: Prisma.StringFieldUpdateOperationsInput | string;
    post_id?: Prisma.StringFieldUpdateOperationsInput | string;
    social_network?: Prisma.Enumsocial_networkFieldUpdateOperationsInput | $Enums.social_network;
    status?: Prisma.Enumsocial_schedule_statusFieldUpdateOperationsInput | $Enums.social_schedule_status;
    ai_content?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    scheduled_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    platform_payload?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    post_snapshot?: Prisma.JsonNullValueInput | runtime.InputJsonValue;
    tokens_unit_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    tokens_cost?: Prisma.IntFieldUpdateOperationsInput | number;
    error_message?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type Social_post_schedulesCountOutputType = {
    runs: number;
};
export type Social_post_schedulesCountOutputTypeSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    runs?: boolean | Social_post_schedulesCountOutputTypeCountRunsArgs;
};
export type Social_post_schedulesCountOutputTypeDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.Social_post_schedulesCountOutputTypeSelect<ExtArgs> | null;
};
export type Social_post_schedulesCountOutputTypeCountRunsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.social_post_schedule_runsWhereInput;
};
export type social_post_schedulesSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    organization_id?: boolean;
    post_id?: boolean;
    social_account_id?: boolean;
    social_network?: boolean;
    status?: boolean;
    ai_content?: boolean;
    scheduled_at?: boolean;
    platform_payload?: boolean;
    post_snapshot?: boolean;
    tokens_unit_cost?: boolean;
    tokens_cost?: boolean;
    error_message?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
    post?: boolean | Prisma.postsDefaultArgs<ExtArgs>;
    social_account?: boolean | Prisma.social_post_schedules$social_accountArgs<ExtArgs>;
    runs?: boolean | Prisma.social_post_schedules$runsArgs<ExtArgs>;
    _count?: boolean | Prisma.Social_post_schedulesCountOutputTypeDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["social_post_schedules"]>;
export type social_post_schedulesSelectScalar = {
    id?: boolean;
    organization_id?: boolean;
    post_id?: boolean;
    social_account_id?: boolean;
    social_network?: boolean;
    status?: boolean;
    ai_content?: boolean;
    scheduled_at?: boolean;
    platform_payload?: boolean;
    post_snapshot?: boolean;
    tokens_unit_cost?: boolean;
    tokens_cost?: boolean;
    error_message?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
};
export type social_post_schedulesOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "organization_id" | "post_id" | "social_account_id" | "social_network" | "status" | "ai_content" | "scheduled_at" | "platform_payload" | "post_snapshot" | "tokens_unit_cost" | "tokens_cost" | "error_message" | "created_at" | "updated_at", ExtArgs["result"]["social_post_schedules"]>;
export type social_post_schedulesInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    organizations?: boolean | Prisma.organizationsDefaultArgs<ExtArgs>;
    post?: boolean | Prisma.postsDefaultArgs<ExtArgs>;
    social_account?: boolean | Prisma.social_post_schedules$social_accountArgs<ExtArgs>;
    runs?: boolean | Prisma.social_post_schedules$runsArgs<ExtArgs>;
    _count?: boolean | Prisma.Social_post_schedulesCountOutputTypeDefaultArgs<ExtArgs>;
};
export type $social_post_schedulesPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "social_post_schedules";
    objects: {
        organizations: Prisma.$organizationsPayload<ExtArgs>;
        post: Prisma.$postsPayload<ExtArgs>;
        social_account: Prisma.$social_accountsPayload<ExtArgs> | null;
        runs: Prisma.$social_post_schedule_runsPayload<ExtArgs>[];
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        organization_id: string;
        post_id: string;
        social_account_id: string | null;
        social_network: $Enums.social_network;
        status: $Enums.social_schedule_status;
        ai_content: boolean;
        scheduled_at: Date;
        platform_payload: runtime.JsonValue | null;
        post_snapshot: runtime.JsonValue;
        tokens_unit_cost: number;
        tokens_cost: number;
        error_message: string | null;
        created_at: Date;
        updated_at: Date;
    }, ExtArgs["result"]["social_post_schedules"]>;
    composites: {};
};
export type social_post_schedulesGetPayload<S extends boolean | null | undefined | social_post_schedulesDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$social_post_schedulesPayload, S>;
export type social_post_schedulesCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<social_post_schedulesFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: Social_post_schedulesCountAggregateInputType | true;
};
export interface social_post_schedulesDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['social_post_schedules'];
        meta: {
            name: 'social_post_schedules';
        };
    };
    findUnique<T extends social_post_schedulesFindUniqueArgs>(args: Prisma.SelectSubset<T, social_post_schedulesFindUniqueArgs<ExtArgs>>): Prisma.Prisma__social_post_schedulesClient<runtime.Types.Result.GetResult<Prisma.$social_post_schedulesPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends social_post_schedulesFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, social_post_schedulesFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__social_post_schedulesClient<runtime.Types.Result.GetResult<Prisma.$social_post_schedulesPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends social_post_schedulesFindFirstArgs>(args?: Prisma.SelectSubset<T, social_post_schedulesFindFirstArgs<ExtArgs>>): Prisma.Prisma__social_post_schedulesClient<runtime.Types.Result.GetResult<Prisma.$social_post_schedulesPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends social_post_schedulesFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, social_post_schedulesFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__social_post_schedulesClient<runtime.Types.Result.GetResult<Prisma.$social_post_schedulesPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends social_post_schedulesFindManyArgs>(args?: Prisma.SelectSubset<T, social_post_schedulesFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$social_post_schedulesPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends social_post_schedulesCreateArgs>(args: Prisma.SelectSubset<T, social_post_schedulesCreateArgs<ExtArgs>>): Prisma.Prisma__social_post_schedulesClient<runtime.Types.Result.GetResult<Prisma.$social_post_schedulesPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends social_post_schedulesCreateManyArgs>(args?: Prisma.SelectSubset<T, social_post_schedulesCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends social_post_schedulesDeleteArgs>(args: Prisma.SelectSubset<T, social_post_schedulesDeleteArgs<ExtArgs>>): Prisma.Prisma__social_post_schedulesClient<runtime.Types.Result.GetResult<Prisma.$social_post_schedulesPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends social_post_schedulesUpdateArgs>(args: Prisma.SelectSubset<T, social_post_schedulesUpdateArgs<ExtArgs>>): Prisma.Prisma__social_post_schedulesClient<runtime.Types.Result.GetResult<Prisma.$social_post_schedulesPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends social_post_schedulesDeleteManyArgs>(args?: Prisma.SelectSubset<T, social_post_schedulesDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends social_post_schedulesUpdateManyArgs>(args: Prisma.SelectSubset<T, social_post_schedulesUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends social_post_schedulesUpsertArgs>(args: Prisma.SelectSubset<T, social_post_schedulesUpsertArgs<ExtArgs>>): Prisma.Prisma__social_post_schedulesClient<runtime.Types.Result.GetResult<Prisma.$social_post_schedulesPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends social_post_schedulesCountArgs>(args?: Prisma.Subset<T, social_post_schedulesCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], Social_post_schedulesCountAggregateOutputType> : number>;
    aggregate<T extends Social_post_schedulesAggregateArgs>(args: Prisma.Subset<T, Social_post_schedulesAggregateArgs>): Prisma.PrismaPromise<GetSocial_post_schedulesAggregateType<T>>;
    groupBy<T extends social_post_schedulesGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: social_post_schedulesGroupByArgs['orderBy'];
    } : {
        orderBy?: social_post_schedulesGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, social_post_schedulesGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSocial_post_schedulesGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: social_post_schedulesFieldRefs;
}
export interface Prisma__social_post_schedulesClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    organizations<T extends Prisma.organizationsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.organizationsDefaultArgs<ExtArgs>>): Prisma.Prisma__organizationsClient<runtime.Types.Result.GetResult<Prisma.$organizationsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    post<T extends Prisma.postsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.postsDefaultArgs<ExtArgs>>): Prisma.Prisma__postsClient<runtime.Types.Result.GetResult<Prisma.$postsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    social_account<T extends Prisma.social_post_schedules$social_accountArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.social_post_schedules$social_accountArgs<ExtArgs>>): Prisma.Prisma__social_accountsClient<runtime.Types.Result.GetResult<Prisma.$social_accountsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    runs<T extends Prisma.social_post_schedules$runsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.social_post_schedules$runsArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$social_post_schedule_runsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface social_post_schedulesFieldRefs {
    readonly id: Prisma.FieldRef<"social_post_schedules", 'String'>;
    readonly organization_id: Prisma.FieldRef<"social_post_schedules", 'String'>;
    readonly post_id: Prisma.FieldRef<"social_post_schedules", 'String'>;
    readonly social_account_id: Prisma.FieldRef<"social_post_schedules", 'String'>;
    readonly social_network: Prisma.FieldRef<"social_post_schedules", 'social_network'>;
    readonly status: Prisma.FieldRef<"social_post_schedules", 'social_schedule_status'>;
    readonly ai_content: Prisma.FieldRef<"social_post_schedules", 'Boolean'>;
    readonly scheduled_at: Prisma.FieldRef<"social_post_schedules", 'DateTime'>;
    readonly platform_payload: Prisma.FieldRef<"social_post_schedules", 'Json'>;
    readonly post_snapshot: Prisma.FieldRef<"social_post_schedules", 'Json'>;
    readonly tokens_unit_cost: Prisma.FieldRef<"social_post_schedules", 'Int'>;
    readonly tokens_cost: Prisma.FieldRef<"social_post_schedules", 'Int'>;
    readonly error_message: Prisma.FieldRef<"social_post_schedules", 'String'>;
    readonly created_at: Prisma.FieldRef<"social_post_schedules", 'DateTime'>;
    readonly updated_at: Prisma.FieldRef<"social_post_schedules", 'DateTime'>;
}
export type social_post_schedulesFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.social_post_schedulesSelect<ExtArgs> | null;
    omit?: Prisma.social_post_schedulesOmit<ExtArgs> | null;
    include?: Prisma.social_post_schedulesInclude<ExtArgs> | null;
    where: Prisma.social_post_schedulesWhereUniqueInput;
};
export type social_post_schedulesFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.social_post_schedulesSelect<ExtArgs> | null;
    omit?: Prisma.social_post_schedulesOmit<ExtArgs> | null;
    include?: Prisma.social_post_schedulesInclude<ExtArgs> | null;
    where: Prisma.social_post_schedulesWhereUniqueInput;
};
export type social_post_schedulesFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.social_post_schedulesSelect<ExtArgs> | null;
    omit?: Prisma.social_post_schedulesOmit<ExtArgs> | null;
    include?: Prisma.social_post_schedulesInclude<ExtArgs> | null;
    where?: Prisma.social_post_schedulesWhereInput;
    orderBy?: Prisma.social_post_schedulesOrderByWithRelationInput | Prisma.social_post_schedulesOrderByWithRelationInput[];
    cursor?: Prisma.social_post_schedulesWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Social_post_schedulesScalarFieldEnum | Prisma.Social_post_schedulesScalarFieldEnum[];
};
export type social_post_schedulesFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.social_post_schedulesSelect<ExtArgs> | null;
    omit?: Prisma.social_post_schedulesOmit<ExtArgs> | null;
    include?: Prisma.social_post_schedulesInclude<ExtArgs> | null;
    where?: Prisma.social_post_schedulesWhereInput;
    orderBy?: Prisma.social_post_schedulesOrderByWithRelationInput | Prisma.social_post_schedulesOrderByWithRelationInput[];
    cursor?: Prisma.social_post_schedulesWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Social_post_schedulesScalarFieldEnum | Prisma.Social_post_schedulesScalarFieldEnum[];
};
export type social_post_schedulesFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.social_post_schedulesSelect<ExtArgs> | null;
    omit?: Prisma.social_post_schedulesOmit<ExtArgs> | null;
    include?: Prisma.social_post_schedulesInclude<ExtArgs> | null;
    where?: Prisma.social_post_schedulesWhereInput;
    orderBy?: Prisma.social_post_schedulesOrderByWithRelationInput | Prisma.social_post_schedulesOrderByWithRelationInput[];
    cursor?: Prisma.social_post_schedulesWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Social_post_schedulesScalarFieldEnum | Prisma.Social_post_schedulesScalarFieldEnum[];
};
export type social_post_schedulesCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.social_post_schedulesSelect<ExtArgs> | null;
    omit?: Prisma.social_post_schedulesOmit<ExtArgs> | null;
    include?: Prisma.social_post_schedulesInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.social_post_schedulesCreateInput, Prisma.social_post_schedulesUncheckedCreateInput>;
};
export type social_post_schedulesCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.social_post_schedulesCreateManyInput | Prisma.social_post_schedulesCreateManyInput[];
    skipDuplicates?: boolean;
};
export type social_post_schedulesUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.social_post_schedulesSelect<ExtArgs> | null;
    omit?: Prisma.social_post_schedulesOmit<ExtArgs> | null;
    include?: Prisma.social_post_schedulesInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.social_post_schedulesUpdateInput, Prisma.social_post_schedulesUncheckedUpdateInput>;
    where: Prisma.social_post_schedulesWhereUniqueInput;
};
export type social_post_schedulesUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.social_post_schedulesUpdateManyMutationInput, Prisma.social_post_schedulesUncheckedUpdateManyInput>;
    where?: Prisma.social_post_schedulesWhereInput;
    limit?: number;
};
export type social_post_schedulesUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.social_post_schedulesSelect<ExtArgs> | null;
    omit?: Prisma.social_post_schedulesOmit<ExtArgs> | null;
    include?: Prisma.social_post_schedulesInclude<ExtArgs> | null;
    where: Prisma.social_post_schedulesWhereUniqueInput;
    create: Prisma.XOR<Prisma.social_post_schedulesCreateInput, Prisma.social_post_schedulesUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.social_post_schedulesUpdateInput, Prisma.social_post_schedulesUncheckedUpdateInput>;
};
export type social_post_schedulesDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.social_post_schedulesSelect<ExtArgs> | null;
    omit?: Prisma.social_post_schedulesOmit<ExtArgs> | null;
    include?: Prisma.social_post_schedulesInclude<ExtArgs> | null;
    where: Prisma.social_post_schedulesWhereUniqueInput;
};
export type social_post_schedulesDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.social_post_schedulesWhereInput;
    limit?: number;
};
export type social_post_schedules$social_accountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.social_accountsSelect<ExtArgs> | null;
    omit?: Prisma.social_accountsOmit<ExtArgs> | null;
    include?: Prisma.social_accountsInclude<ExtArgs> | null;
    where?: Prisma.social_accountsWhereInput;
};
export type social_post_schedules$runsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.social_post_schedule_runsSelect<ExtArgs> | null;
    omit?: Prisma.social_post_schedule_runsOmit<ExtArgs> | null;
    include?: Prisma.social_post_schedule_runsInclude<ExtArgs> | null;
    where?: Prisma.social_post_schedule_runsWhereInput;
    orderBy?: Prisma.social_post_schedule_runsOrderByWithRelationInput | Prisma.social_post_schedule_runsOrderByWithRelationInput[];
    cursor?: Prisma.social_post_schedule_runsWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Social_post_schedule_runsScalarFieldEnum | Prisma.Social_post_schedule_runsScalarFieldEnum[];
};
export type social_post_schedulesDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.social_post_schedulesSelect<ExtArgs> | null;
    omit?: Prisma.social_post_schedulesOmit<ExtArgs> | null;
    include?: Prisma.social_post_schedulesInclude<ExtArgs> | null;
};
export {};
