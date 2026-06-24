import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type email_projects_schedulesModel = runtime.Types.Result.DefaultSelection<Prisma.$email_projects_schedulesPayload>;
export type AggregateEmail_projects_schedules = {
    _count: Email_projects_schedulesCountAggregateOutputType | null;
    _avg: Email_projects_schedulesAvgAggregateOutputType | null;
    _sum: Email_projects_schedulesSumAggregateOutputType | null;
    _min: Email_projects_schedulesMinAggregateOutputType | null;
    _max: Email_projects_schedulesMaxAggregateOutputType | null;
};
export type Email_projects_schedulesAvgAggregateOutputType = {
    time: number | null;
    for_x_days: number | null;
};
export type Email_projects_schedulesSumAggregateOutputType = {
    time: number | null;
    for_x_days: number | null;
};
export type Email_projects_schedulesMinAggregateOutputType = {
    id: string | null;
    project_id: string | null;
    daily: boolean | null;
    date: Date | null;
    time: number | null;
    for_x_days: number | null;
    last_run: Date | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type Email_projects_schedulesMaxAggregateOutputType = {
    id: string | null;
    project_id: string | null;
    daily: boolean | null;
    date: Date | null;
    time: number | null;
    for_x_days: number | null;
    last_run: Date | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type Email_projects_schedulesCountAggregateOutputType = {
    id: number;
    project_id: number;
    daily: number;
    date: number;
    time: number;
    for_x_days: number;
    last_run: number;
    created_at: number;
    updated_at: number;
    _all: number;
};
export type Email_projects_schedulesAvgAggregateInputType = {
    time?: true;
    for_x_days?: true;
};
export type Email_projects_schedulesSumAggregateInputType = {
    time?: true;
    for_x_days?: true;
};
export type Email_projects_schedulesMinAggregateInputType = {
    id?: true;
    project_id?: true;
    daily?: true;
    date?: true;
    time?: true;
    for_x_days?: true;
    last_run?: true;
    created_at?: true;
    updated_at?: true;
};
export type Email_projects_schedulesMaxAggregateInputType = {
    id?: true;
    project_id?: true;
    daily?: true;
    date?: true;
    time?: true;
    for_x_days?: true;
    last_run?: true;
    created_at?: true;
    updated_at?: true;
};
export type Email_projects_schedulesCountAggregateInputType = {
    id?: true;
    project_id?: true;
    daily?: true;
    date?: true;
    time?: true;
    for_x_days?: true;
    last_run?: true;
    created_at?: true;
    updated_at?: true;
    _all?: true;
};
export type Email_projects_schedulesAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_projects_schedulesWhereInput;
    orderBy?: Prisma.email_projects_schedulesOrderByWithRelationInput | Prisma.email_projects_schedulesOrderByWithRelationInput[];
    cursor?: Prisma.email_projects_schedulesWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | Email_projects_schedulesCountAggregateInputType;
    _avg?: Email_projects_schedulesAvgAggregateInputType;
    _sum?: Email_projects_schedulesSumAggregateInputType;
    _min?: Email_projects_schedulesMinAggregateInputType;
    _max?: Email_projects_schedulesMaxAggregateInputType;
};
export type GetEmail_projects_schedulesAggregateType<T extends Email_projects_schedulesAggregateArgs> = {
    [P in keyof T & keyof AggregateEmail_projects_schedules]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateEmail_projects_schedules[P]> : Prisma.GetScalarType<T[P], AggregateEmail_projects_schedules[P]>;
};
export type email_projects_schedulesGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_projects_schedulesWhereInput;
    orderBy?: Prisma.email_projects_schedulesOrderByWithAggregationInput | Prisma.email_projects_schedulesOrderByWithAggregationInput[];
    by: Prisma.Email_projects_schedulesScalarFieldEnum[] | Prisma.Email_projects_schedulesScalarFieldEnum;
    having?: Prisma.email_projects_schedulesScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: Email_projects_schedulesCountAggregateInputType | true;
    _avg?: Email_projects_schedulesAvgAggregateInputType;
    _sum?: Email_projects_schedulesSumAggregateInputType;
    _min?: Email_projects_schedulesMinAggregateInputType;
    _max?: Email_projects_schedulesMaxAggregateInputType;
};
export type Email_projects_schedulesGroupByOutputType = {
    id: string;
    project_id: string;
    daily: boolean;
    date: Date | null;
    time: number | null;
    for_x_days: number | null;
    last_run: Date | null;
    created_at: Date;
    updated_at: Date;
    _count: Email_projects_schedulesCountAggregateOutputType | null;
    _avg: Email_projects_schedulesAvgAggregateOutputType | null;
    _sum: Email_projects_schedulesSumAggregateOutputType | null;
    _min: Email_projects_schedulesMinAggregateOutputType | null;
    _max: Email_projects_schedulesMaxAggregateOutputType | null;
};
type GetEmail_projects_schedulesGroupByPayload<T extends email_projects_schedulesGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<Email_projects_schedulesGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof Email_projects_schedulesGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], Email_projects_schedulesGroupByOutputType[P]> : Prisma.GetScalarType<T[P], Email_projects_schedulesGroupByOutputType[P]>;
}>>;
export type email_projects_schedulesWhereInput = {
    AND?: Prisma.email_projects_schedulesWhereInput | Prisma.email_projects_schedulesWhereInput[];
    OR?: Prisma.email_projects_schedulesWhereInput[];
    NOT?: Prisma.email_projects_schedulesWhereInput | Prisma.email_projects_schedulesWhereInput[];
    id?: Prisma.StringFilter<"email_projects_schedules"> | string;
    project_id?: Prisma.StringFilter<"email_projects_schedules"> | string;
    daily?: Prisma.BoolFilter<"email_projects_schedules"> | boolean;
    date?: Prisma.DateTimeNullableFilter<"email_projects_schedules"> | Date | string | null;
    time?: Prisma.IntNullableFilter<"email_projects_schedules"> | number | null;
    for_x_days?: Prisma.IntNullableFilter<"email_projects_schedules"> | number | null;
    last_run?: Prisma.DateTimeNullableFilter<"email_projects_schedules"> | Date | string | null;
    created_at?: Prisma.DateTimeFilter<"email_projects_schedules"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"email_projects_schedules"> | Date | string;
    projects?: Prisma.XOR<Prisma.Email_projectsScalarRelationFilter, Prisma.email_projectsWhereInput>;
    sents?: Prisma.Email_projects_schedules_sentListRelationFilter;
};
export type email_projects_schedulesOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    project_id?: Prisma.SortOrder;
    daily?: Prisma.SortOrder;
    date?: Prisma.SortOrderInput | Prisma.SortOrder;
    time?: Prisma.SortOrderInput | Prisma.SortOrder;
    for_x_days?: Prisma.SortOrderInput | Prisma.SortOrder;
    last_run?: Prisma.SortOrderInput | Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    projects?: Prisma.email_projectsOrderByWithRelationInput;
    sents?: Prisma.email_projects_schedules_sentOrderByRelationAggregateInput;
    _relevance?: Prisma.email_projects_schedulesOrderByRelevanceInput;
};
export type email_projects_schedulesWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    AND?: Prisma.email_projects_schedulesWhereInput | Prisma.email_projects_schedulesWhereInput[];
    OR?: Prisma.email_projects_schedulesWhereInput[];
    NOT?: Prisma.email_projects_schedulesWhereInput | Prisma.email_projects_schedulesWhereInput[];
    project_id?: Prisma.StringFilter<"email_projects_schedules"> | string;
    daily?: Prisma.BoolFilter<"email_projects_schedules"> | boolean;
    date?: Prisma.DateTimeNullableFilter<"email_projects_schedules"> | Date | string | null;
    time?: Prisma.IntNullableFilter<"email_projects_schedules"> | number | null;
    for_x_days?: Prisma.IntNullableFilter<"email_projects_schedules"> | number | null;
    last_run?: Prisma.DateTimeNullableFilter<"email_projects_schedules"> | Date | string | null;
    created_at?: Prisma.DateTimeFilter<"email_projects_schedules"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"email_projects_schedules"> | Date | string;
    projects?: Prisma.XOR<Prisma.Email_projectsScalarRelationFilter, Prisma.email_projectsWhereInput>;
    sents?: Prisma.Email_projects_schedules_sentListRelationFilter;
}, "id">;
export type email_projects_schedulesOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    project_id?: Prisma.SortOrder;
    daily?: Prisma.SortOrder;
    date?: Prisma.SortOrderInput | Prisma.SortOrder;
    time?: Prisma.SortOrderInput | Prisma.SortOrder;
    for_x_days?: Prisma.SortOrderInput | Prisma.SortOrder;
    last_run?: Prisma.SortOrderInput | Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    _count?: Prisma.email_projects_schedulesCountOrderByAggregateInput;
    _avg?: Prisma.email_projects_schedulesAvgOrderByAggregateInput;
    _max?: Prisma.email_projects_schedulesMaxOrderByAggregateInput;
    _min?: Prisma.email_projects_schedulesMinOrderByAggregateInput;
    _sum?: Prisma.email_projects_schedulesSumOrderByAggregateInput;
};
export type email_projects_schedulesScalarWhereWithAggregatesInput = {
    AND?: Prisma.email_projects_schedulesScalarWhereWithAggregatesInput | Prisma.email_projects_schedulesScalarWhereWithAggregatesInput[];
    OR?: Prisma.email_projects_schedulesScalarWhereWithAggregatesInput[];
    NOT?: Prisma.email_projects_schedulesScalarWhereWithAggregatesInput | Prisma.email_projects_schedulesScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"email_projects_schedules"> | string;
    project_id?: Prisma.StringWithAggregatesFilter<"email_projects_schedules"> | string;
    daily?: Prisma.BoolWithAggregatesFilter<"email_projects_schedules"> | boolean;
    date?: Prisma.DateTimeNullableWithAggregatesFilter<"email_projects_schedules"> | Date | string | null;
    time?: Prisma.IntNullableWithAggregatesFilter<"email_projects_schedules"> | number | null;
    for_x_days?: Prisma.IntNullableWithAggregatesFilter<"email_projects_schedules"> | number | null;
    last_run?: Prisma.DateTimeNullableWithAggregatesFilter<"email_projects_schedules"> | Date | string | null;
    created_at?: Prisma.DateTimeWithAggregatesFilter<"email_projects_schedules"> | Date | string;
    updated_at?: Prisma.DateTimeWithAggregatesFilter<"email_projects_schedules"> | Date | string;
};
export type email_projects_schedulesCreateInput = {
    id?: string;
    daily?: boolean;
    date?: Date | string | null;
    time?: number | null;
    for_x_days?: number | null;
    last_run?: Date | string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    projects: Prisma.email_projectsCreateNestedOneWithoutSchedulesInput;
    sents?: Prisma.email_projects_schedules_sentCreateNestedManyWithoutScheduleInput;
};
export type email_projects_schedulesUncheckedCreateInput = {
    id?: string;
    project_id: string;
    daily?: boolean;
    date?: Date | string | null;
    time?: number | null;
    for_x_days?: number | null;
    last_run?: Date | string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    sents?: Prisma.email_projects_schedules_sentUncheckedCreateNestedManyWithoutScheduleInput;
};
export type email_projects_schedulesUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    daily?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    date?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    time?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    for_x_days?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    last_run?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    projects?: Prisma.email_projectsUpdateOneRequiredWithoutSchedulesNestedInput;
    sents?: Prisma.email_projects_schedules_sentUpdateManyWithoutScheduleNestedInput;
};
export type email_projects_schedulesUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    project_id?: Prisma.StringFieldUpdateOperationsInput | string;
    daily?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    date?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    time?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    for_x_days?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    last_run?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    sents?: Prisma.email_projects_schedules_sentUncheckedUpdateManyWithoutScheduleNestedInput;
};
export type email_projects_schedulesCreateManyInput = {
    id?: string;
    project_id: string;
    daily?: boolean;
    date?: Date | string | null;
    time?: number | null;
    for_x_days?: number | null;
    last_run?: Date | string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type email_projects_schedulesUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    daily?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    date?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    time?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    for_x_days?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    last_run?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type email_projects_schedulesUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    project_id?: Prisma.StringFieldUpdateOperationsInput | string;
    daily?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    date?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    time?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    for_x_days?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    last_run?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type Email_projects_schedulesListRelationFilter = {
    every?: Prisma.email_projects_schedulesWhereInput;
    some?: Prisma.email_projects_schedulesWhereInput;
    none?: Prisma.email_projects_schedulesWhereInput;
};
export type email_projects_schedulesOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type email_projects_schedulesOrderByRelevanceInput = {
    fields: Prisma.email_projects_schedulesOrderByRelevanceFieldEnum | Prisma.email_projects_schedulesOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type email_projects_schedulesCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    project_id?: Prisma.SortOrder;
    daily?: Prisma.SortOrder;
    date?: Prisma.SortOrder;
    time?: Prisma.SortOrder;
    for_x_days?: Prisma.SortOrder;
    last_run?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type email_projects_schedulesAvgOrderByAggregateInput = {
    time?: Prisma.SortOrder;
    for_x_days?: Prisma.SortOrder;
};
export type email_projects_schedulesMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    project_id?: Prisma.SortOrder;
    daily?: Prisma.SortOrder;
    date?: Prisma.SortOrder;
    time?: Prisma.SortOrder;
    for_x_days?: Prisma.SortOrder;
    last_run?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type email_projects_schedulesMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    project_id?: Prisma.SortOrder;
    daily?: Prisma.SortOrder;
    date?: Prisma.SortOrder;
    time?: Prisma.SortOrder;
    for_x_days?: Prisma.SortOrder;
    last_run?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type email_projects_schedulesSumOrderByAggregateInput = {
    time?: Prisma.SortOrder;
    for_x_days?: Prisma.SortOrder;
};
export type Email_projects_schedulesNullableScalarRelationFilter = {
    is?: Prisma.email_projects_schedulesWhereInput | null;
    isNot?: Prisma.email_projects_schedulesWhereInput | null;
};
export type email_projects_schedulesCreateNestedManyWithoutProjectsInput = {
    create?: Prisma.XOR<Prisma.email_projects_schedulesCreateWithoutProjectsInput, Prisma.email_projects_schedulesUncheckedCreateWithoutProjectsInput> | Prisma.email_projects_schedulesCreateWithoutProjectsInput[] | Prisma.email_projects_schedulesUncheckedCreateWithoutProjectsInput[];
    connectOrCreate?: Prisma.email_projects_schedulesCreateOrConnectWithoutProjectsInput | Prisma.email_projects_schedulesCreateOrConnectWithoutProjectsInput[];
    createMany?: Prisma.email_projects_schedulesCreateManyProjectsInputEnvelope;
    connect?: Prisma.email_projects_schedulesWhereUniqueInput | Prisma.email_projects_schedulesWhereUniqueInput[];
};
export type email_projects_schedulesUncheckedCreateNestedManyWithoutProjectsInput = {
    create?: Prisma.XOR<Prisma.email_projects_schedulesCreateWithoutProjectsInput, Prisma.email_projects_schedulesUncheckedCreateWithoutProjectsInput> | Prisma.email_projects_schedulesCreateWithoutProjectsInput[] | Prisma.email_projects_schedulesUncheckedCreateWithoutProjectsInput[];
    connectOrCreate?: Prisma.email_projects_schedulesCreateOrConnectWithoutProjectsInput | Prisma.email_projects_schedulesCreateOrConnectWithoutProjectsInput[];
    createMany?: Prisma.email_projects_schedulesCreateManyProjectsInputEnvelope;
    connect?: Prisma.email_projects_schedulesWhereUniqueInput | Prisma.email_projects_schedulesWhereUniqueInput[];
};
export type email_projects_schedulesUpdateManyWithoutProjectsNestedInput = {
    create?: Prisma.XOR<Prisma.email_projects_schedulesCreateWithoutProjectsInput, Prisma.email_projects_schedulesUncheckedCreateWithoutProjectsInput> | Prisma.email_projects_schedulesCreateWithoutProjectsInput[] | Prisma.email_projects_schedulesUncheckedCreateWithoutProjectsInput[];
    connectOrCreate?: Prisma.email_projects_schedulesCreateOrConnectWithoutProjectsInput | Prisma.email_projects_schedulesCreateOrConnectWithoutProjectsInput[];
    upsert?: Prisma.email_projects_schedulesUpsertWithWhereUniqueWithoutProjectsInput | Prisma.email_projects_schedulesUpsertWithWhereUniqueWithoutProjectsInput[];
    createMany?: Prisma.email_projects_schedulesCreateManyProjectsInputEnvelope;
    set?: Prisma.email_projects_schedulesWhereUniqueInput | Prisma.email_projects_schedulesWhereUniqueInput[];
    disconnect?: Prisma.email_projects_schedulesWhereUniqueInput | Prisma.email_projects_schedulesWhereUniqueInput[];
    delete?: Prisma.email_projects_schedulesWhereUniqueInput | Prisma.email_projects_schedulesWhereUniqueInput[];
    connect?: Prisma.email_projects_schedulesWhereUniqueInput | Prisma.email_projects_schedulesWhereUniqueInput[];
    update?: Prisma.email_projects_schedulesUpdateWithWhereUniqueWithoutProjectsInput | Prisma.email_projects_schedulesUpdateWithWhereUniqueWithoutProjectsInput[];
    updateMany?: Prisma.email_projects_schedulesUpdateManyWithWhereWithoutProjectsInput | Prisma.email_projects_schedulesUpdateManyWithWhereWithoutProjectsInput[];
    deleteMany?: Prisma.email_projects_schedulesScalarWhereInput | Prisma.email_projects_schedulesScalarWhereInput[];
};
export type email_projects_schedulesUncheckedUpdateManyWithoutProjectsNestedInput = {
    create?: Prisma.XOR<Prisma.email_projects_schedulesCreateWithoutProjectsInput, Prisma.email_projects_schedulesUncheckedCreateWithoutProjectsInput> | Prisma.email_projects_schedulesCreateWithoutProjectsInput[] | Prisma.email_projects_schedulesUncheckedCreateWithoutProjectsInput[];
    connectOrCreate?: Prisma.email_projects_schedulesCreateOrConnectWithoutProjectsInput | Prisma.email_projects_schedulesCreateOrConnectWithoutProjectsInput[];
    upsert?: Prisma.email_projects_schedulesUpsertWithWhereUniqueWithoutProjectsInput | Prisma.email_projects_schedulesUpsertWithWhereUniqueWithoutProjectsInput[];
    createMany?: Prisma.email_projects_schedulesCreateManyProjectsInputEnvelope;
    set?: Prisma.email_projects_schedulesWhereUniqueInput | Prisma.email_projects_schedulesWhereUniqueInput[];
    disconnect?: Prisma.email_projects_schedulesWhereUniqueInput | Prisma.email_projects_schedulesWhereUniqueInput[];
    delete?: Prisma.email_projects_schedulesWhereUniqueInput | Prisma.email_projects_schedulesWhereUniqueInput[];
    connect?: Prisma.email_projects_schedulesWhereUniqueInput | Prisma.email_projects_schedulesWhereUniqueInput[];
    update?: Prisma.email_projects_schedulesUpdateWithWhereUniqueWithoutProjectsInput | Prisma.email_projects_schedulesUpdateWithWhereUniqueWithoutProjectsInput[];
    updateMany?: Prisma.email_projects_schedulesUpdateManyWithWhereWithoutProjectsInput | Prisma.email_projects_schedulesUpdateManyWithWhereWithoutProjectsInput[];
    deleteMany?: Prisma.email_projects_schedulesScalarWhereInput | Prisma.email_projects_schedulesScalarWhereInput[];
};
export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null;
};
export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null;
    increment?: number;
    decrement?: number;
    multiply?: number;
    divide?: number;
};
export type email_projects_schedulesCreateNestedOneWithoutSentsInput = {
    create?: Prisma.XOR<Prisma.email_projects_schedulesCreateWithoutSentsInput, Prisma.email_projects_schedulesUncheckedCreateWithoutSentsInput>;
    connectOrCreate?: Prisma.email_projects_schedulesCreateOrConnectWithoutSentsInput;
    connect?: Prisma.email_projects_schedulesWhereUniqueInput;
};
export type email_projects_schedulesUpdateOneWithoutSentsNestedInput = {
    create?: Prisma.XOR<Prisma.email_projects_schedulesCreateWithoutSentsInput, Prisma.email_projects_schedulesUncheckedCreateWithoutSentsInput>;
    connectOrCreate?: Prisma.email_projects_schedulesCreateOrConnectWithoutSentsInput;
    upsert?: Prisma.email_projects_schedulesUpsertWithoutSentsInput;
    disconnect?: Prisma.email_projects_schedulesWhereInput | boolean;
    delete?: Prisma.email_projects_schedulesWhereInput | boolean;
    connect?: Prisma.email_projects_schedulesWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.email_projects_schedulesUpdateToOneWithWhereWithoutSentsInput, Prisma.email_projects_schedulesUpdateWithoutSentsInput>, Prisma.email_projects_schedulesUncheckedUpdateWithoutSentsInput>;
};
export type email_projects_schedulesCreateWithoutProjectsInput = {
    id?: string;
    daily?: boolean;
    date?: Date | string | null;
    time?: number | null;
    for_x_days?: number | null;
    last_run?: Date | string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    sents?: Prisma.email_projects_schedules_sentCreateNestedManyWithoutScheduleInput;
};
export type email_projects_schedulesUncheckedCreateWithoutProjectsInput = {
    id?: string;
    daily?: boolean;
    date?: Date | string | null;
    time?: number | null;
    for_x_days?: number | null;
    last_run?: Date | string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    sents?: Prisma.email_projects_schedules_sentUncheckedCreateNestedManyWithoutScheduleInput;
};
export type email_projects_schedulesCreateOrConnectWithoutProjectsInput = {
    where: Prisma.email_projects_schedulesWhereUniqueInput;
    create: Prisma.XOR<Prisma.email_projects_schedulesCreateWithoutProjectsInput, Prisma.email_projects_schedulesUncheckedCreateWithoutProjectsInput>;
};
export type email_projects_schedulesCreateManyProjectsInputEnvelope = {
    data: Prisma.email_projects_schedulesCreateManyProjectsInput | Prisma.email_projects_schedulesCreateManyProjectsInput[];
    skipDuplicates?: boolean;
};
export type email_projects_schedulesUpsertWithWhereUniqueWithoutProjectsInput = {
    where: Prisma.email_projects_schedulesWhereUniqueInput;
    update: Prisma.XOR<Prisma.email_projects_schedulesUpdateWithoutProjectsInput, Prisma.email_projects_schedulesUncheckedUpdateWithoutProjectsInput>;
    create: Prisma.XOR<Prisma.email_projects_schedulesCreateWithoutProjectsInput, Prisma.email_projects_schedulesUncheckedCreateWithoutProjectsInput>;
};
export type email_projects_schedulesUpdateWithWhereUniqueWithoutProjectsInput = {
    where: Prisma.email_projects_schedulesWhereUniqueInput;
    data: Prisma.XOR<Prisma.email_projects_schedulesUpdateWithoutProjectsInput, Prisma.email_projects_schedulesUncheckedUpdateWithoutProjectsInput>;
};
export type email_projects_schedulesUpdateManyWithWhereWithoutProjectsInput = {
    where: Prisma.email_projects_schedulesScalarWhereInput;
    data: Prisma.XOR<Prisma.email_projects_schedulesUpdateManyMutationInput, Prisma.email_projects_schedulesUncheckedUpdateManyWithoutProjectsInput>;
};
export type email_projects_schedulesScalarWhereInput = {
    AND?: Prisma.email_projects_schedulesScalarWhereInput | Prisma.email_projects_schedulesScalarWhereInput[];
    OR?: Prisma.email_projects_schedulesScalarWhereInput[];
    NOT?: Prisma.email_projects_schedulesScalarWhereInput | Prisma.email_projects_schedulesScalarWhereInput[];
    id?: Prisma.StringFilter<"email_projects_schedules"> | string;
    project_id?: Prisma.StringFilter<"email_projects_schedules"> | string;
    daily?: Prisma.BoolFilter<"email_projects_schedules"> | boolean;
    date?: Prisma.DateTimeNullableFilter<"email_projects_schedules"> | Date | string | null;
    time?: Prisma.IntNullableFilter<"email_projects_schedules"> | number | null;
    for_x_days?: Prisma.IntNullableFilter<"email_projects_schedules"> | number | null;
    last_run?: Prisma.DateTimeNullableFilter<"email_projects_schedules"> | Date | string | null;
    created_at?: Prisma.DateTimeFilter<"email_projects_schedules"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"email_projects_schedules"> | Date | string;
};
export type email_projects_schedulesCreateWithoutSentsInput = {
    id?: string;
    daily?: boolean;
    date?: Date | string | null;
    time?: number | null;
    for_x_days?: number | null;
    last_run?: Date | string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    projects: Prisma.email_projectsCreateNestedOneWithoutSchedulesInput;
};
export type email_projects_schedulesUncheckedCreateWithoutSentsInput = {
    id?: string;
    project_id: string;
    daily?: boolean;
    date?: Date | string | null;
    time?: number | null;
    for_x_days?: number | null;
    last_run?: Date | string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type email_projects_schedulesCreateOrConnectWithoutSentsInput = {
    where: Prisma.email_projects_schedulesWhereUniqueInput;
    create: Prisma.XOR<Prisma.email_projects_schedulesCreateWithoutSentsInput, Prisma.email_projects_schedulesUncheckedCreateWithoutSentsInput>;
};
export type email_projects_schedulesUpsertWithoutSentsInput = {
    update: Prisma.XOR<Prisma.email_projects_schedulesUpdateWithoutSentsInput, Prisma.email_projects_schedulesUncheckedUpdateWithoutSentsInput>;
    create: Prisma.XOR<Prisma.email_projects_schedulesCreateWithoutSentsInput, Prisma.email_projects_schedulesUncheckedCreateWithoutSentsInput>;
    where?: Prisma.email_projects_schedulesWhereInput;
};
export type email_projects_schedulesUpdateToOneWithWhereWithoutSentsInput = {
    where?: Prisma.email_projects_schedulesWhereInput;
    data: Prisma.XOR<Prisma.email_projects_schedulesUpdateWithoutSentsInput, Prisma.email_projects_schedulesUncheckedUpdateWithoutSentsInput>;
};
export type email_projects_schedulesUpdateWithoutSentsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    daily?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    date?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    time?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    for_x_days?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    last_run?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    projects?: Prisma.email_projectsUpdateOneRequiredWithoutSchedulesNestedInput;
};
export type email_projects_schedulesUncheckedUpdateWithoutSentsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    project_id?: Prisma.StringFieldUpdateOperationsInput | string;
    daily?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    date?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    time?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    for_x_days?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    last_run?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type email_projects_schedulesCreateManyProjectsInput = {
    id?: string;
    daily?: boolean;
    date?: Date | string | null;
    time?: number | null;
    for_x_days?: number | null;
    last_run?: Date | string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type email_projects_schedulesUpdateWithoutProjectsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    daily?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    date?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    time?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    for_x_days?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    last_run?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    sents?: Prisma.email_projects_schedules_sentUpdateManyWithoutScheduleNestedInput;
};
export type email_projects_schedulesUncheckedUpdateWithoutProjectsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    daily?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    date?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    time?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    for_x_days?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    last_run?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    sents?: Prisma.email_projects_schedules_sentUncheckedUpdateManyWithoutScheduleNestedInput;
};
export type email_projects_schedulesUncheckedUpdateManyWithoutProjectsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    daily?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    date?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    time?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    for_x_days?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    last_run?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type Email_projects_schedulesCountOutputType = {
    sents: number;
};
export type Email_projects_schedulesCountOutputTypeSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    sents?: boolean | Email_projects_schedulesCountOutputTypeCountSentsArgs;
};
export type Email_projects_schedulesCountOutputTypeDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.Email_projects_schedulesCountOutputTypeSelect<ExtArgs> | null;
};
export type Email_projects_schedulesCountOutputTypeCountSentsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_projects_schedules_sentWhereInput;
};
export type email_projects_schedulesSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    project_id?: boolean;
    daily?: boolean;
    date?: boolean;
    time?: boolean;
    for_x_days?: boolean;
    last_run?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    projects?: boolean | Prisma.email_projectsDefaultArgs<ExtArgs>;
    sents?: boolean | Prisma.email_projects_schedules$sentsArgs<ExtArgs>;
    _count?: boolean | Prisma.Email_projects_schedulesCountOutputTypeDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["email_projects_schedules"]>;
export type email_projects_schedulesSelectScalar = {
    id?: boolean;
    project_id?: boolean;
    daily?: boolean;
    date?: boolean;
    time?: boolean;
    for_x_days?: boolean;
    last_run?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
};
export type email_projects_schedulesOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "project_id" | "daily" | "date" | "time" | "for_x_days" | "last_run" | "created_at" | "updated_at", ExtArgs["result"]["email_projects_schedules"]>;
export type email_projects_schedulesInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    projects?: boolean | Prisma.email_projectsDefaultArgs<ExtArgs>;
    sents?: boolean | Prisma.email_projects_schedules$sentsArgs<ExtArgs>;
    _count?: boolean | Prisma.Email_projects_schedulesCountOutputTypeDefaultArgs<ExtArgs>;
};
export type $email_projects_schedulesPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "email_projects_schedules";
    objects: {
        projects: Prisma.$email_projectsPayload<ExtArgs>;
        sents: Prisma.$email_projects_schedules_sentPayload<ExtArgs>[];
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        project_id: string;
        daily: boolean;
        date: Date | null;
        time: number | null;
        for_x_days: number | null;
        last_run: Date | null;
        created_at: Date;
        updated_at: Date;
    }, ExtArgs["result"]["email_projects_schedules"]>;
    composites: {};
};
export type email_projects_schedulesGetPayload<S extends boolean | null | undefined | email_projects_schedulesDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$email_projects_schedulesPayload, S>;
export type email_projects_schedulesCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<email_projects_schedulesFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: Email_projects_schedulesCountAggregateInputType | true;
};
export interface email_projects_schedulesDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['email_projects_schedules'];
        meta: {
            name: 'email_projects_schedules';
        };
    };
    findUnique<T extends email_projects_schedulesFindUniqueArgs>(args: Prisma.SelectSubset<T, email_projects_schedulesFindUniqueArgs<ExtArgs>>): Prisma.Prisma__email_projects_schedulesClient<runtime.Types.Result.GetResult<Prisma.$email_projects_schedulesPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends email_projects_schedulesFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, email_projects_schedulesFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__email_projects_schedulesClient<runtime.Types.Result.GetResult<Prisma.$email_projects_schedulesPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends email_projects_schedulesFindFirstArgs>(args?: Prisma.SelectSubset<T, email_projects_schedulesFindFirstArgs<ExtArgs>>): Prisma.Prisma__email_projects_schedulesClient<runtime.Types.Result.GetResult<Prisma.$email_projects_schedulesPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends email_projects_schedulesFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, email_projects_schedulesFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__email_projects_schedulesClient<runtime.Types.Result.GetResult<Prisma.$email_projects_schedulesPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends email_projects_schedulesFindManyArgs>(args?: Prisma.SelectSubset<T, email_projects_schedulesFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$email_projects_schedulesPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends email_projects_schedulesCreateArgs>(args: Prisma.SelectSubset<T, email_projects_schedulesCreateArgs<ExtArgs>>): Prisma.Prisma__email_projects_schedulesClient<runtime.Types.Result.GetResult<Prisma.$email_projects_schedulesPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends email_projects_schedulesCreateManyArgs>(args?: Prisma.SelectSubset<T, email_projects_schedulesCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends email_projects_schedulesDeleteArgs>(args: Prisma.SelectSubset<T, email_projects_schedulesDeleteArgs<ExtArgs>>): Prisma.Prisma__email_projects_schedulesClient<runtime.Types.Result.GetResult<Prisma.$email_projects_schedulesPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends email_projects_schedulesUpdateArgs>(args: Prisma.SelectSubset<T, email_projects_schedulesUpdateArgs<ExtArgs>>): Prisma.Prisma__email_projects_schedulesClient<runtime.Types.Result.GetResult<Prisma.$email_projects_schedulesPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends email_projects_schedulesDeleteManyArgs>(args?: Prisma.SelectSubset<T, email_projects_schedulesDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends email_projects_schedulesUpdateManyArgs>(args: Prisma.SelectSubset<T, email_projects_schedulesUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends email_projects_schedulesUpsertArgs>(args: Prisma.SelectSubset<T, email_projects_schedulesUpsertArgs<ExtArgs>>): Prisma.Prisma__email_projects_schedulesClient<runtime.Types.Result.GetResult<Prisma.$email_projects_schedulesPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends email_projects_schedulesCountArgs>(args?: Prisma.Subset<T, email_projects_schedulesCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], Email_projects_schedulesCountAggregateOutputType> : number>;
    aggregate<T extends Email_projects_schedulesAggregateArgs>(args: Prisma.Subset<T, Email_projects_schedulesAggregateArgs>): Prisma.PrismaPromise<GetEmail_projects_schedulesAggregateType<T>>;
    groupBy<T extends email_projects_schedulesGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: email_projects_schedulesGroupByArgs['orderBy'];
    } : {
        orderBy?: email_projects_schedulesGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, email_projects_schedulesGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetEmail_projects_schedulesGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: email_projects_schedulesFieldRefs;
}
export interface Prisma__email_projects_schedulesClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    projects<T extends Prisma.email_projectsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.email_projectsDefaultArgs<ExtArgs>>): Prisma.Prisma__email_projectsClient<runtime.Types.Result.GetResult<Prisma.$email_projectsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    sents<T extends Prisma.email_projects_schedules$sentsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.email_projects_schedules$sentsArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$email_projects_schedules_sentPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface email_projects_schedulesFieldRefs {
    readonly id: Prisma.FieldRef<"email_projects_schedules", 'String'>;
    readonly project_id: Prisma.FieldRef<"email_projects_schedules", 'String'>;
    readonly daily: Prisma.FieldRef<"email_projects_schedules", 'Boolean'>;
    readonly date: Prisma.FieldRef<"email_projects_schedules", 'DateTime'>;
    readonly time: Prisma.FieldRef<"email_projects_schedules", 'Int'>;
    readonly for_x_days: Prisma.FieldRef<"email_projects_schedules", 'Int'>;
    readonly last_run: Prisma.FieldRef<"email_projects_schedules", 'DateTime'>;
    readonly created_at: Prisma.FieldRef<"email_projects_schedules", 'DateTime'>;
    readonly updated_at: Prisma.FieldRef<"email_projects_schedules", 'DateTime'>;
}
export type email_projects_schedulesFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_projects_schedulesSelect<ExtArgs> | null;
    omit?: Prisma.email_projects_schedulesOmit<ExtArgs> | null;
    include?: Prisma.email_projects_schedulesInclude<ExtArgs> | null;
    where: Prisma.email_projects_schedulesWhereUniqueInput;
};
export type email_projects_schedulesFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_projects_schedulesSelect<ExtArgs> | null;
    omit?: Prisma.email_projects_schedulesOmit<ExtArgs> | null;
    include?: Prisma.email_projects_schedulesInclude<ExtArgs> | null;
    where: Prisma.email_projects_schedulesWhereUniqueInput;
};
export type email_projects_schedulesFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type email_projects_schedulesFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type email_projects_schedulesFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type email_projects_schedulesCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_projects_schedulesSelect<ExtArgs> | null;
    omit?: Prisma.email_projects_schedulesOmit<ExtArgs> | null;
    include?: Prisma.email_projects_schedulesInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.email_projects_schedulesCreateInput, Prisma.email_projects_schedulesUncheckedCreateInput>;
};
export type email_projects_schedulesCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.email_projects_schedulesCreateManyInput | Prisma.email_projects_schedulesCreateManyInput[];
    skipDuplicates?: boolean;
};
export type email_projects_schedulesUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_projects_schedulesSelect<ExtArgs> | null;
    omit?: Prisma.email_projects_schedulesOmit<ExtArgs> | null;
    include?: Prisma.email_projects_schedulesInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.email_projects_schedulesUpdateInput, Prisma.email_projects_schedulesUncheckedUpdateInput>;
    where: Prisma.email_projects_schedulesWhereUniqueInput;
};
export type email_projects_schedulesUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.email_projects_schedulesUpdateManyMutationInput, Prisma.email_projects_schedulesUncheckedUpdateManyInput>;
    where?: Prisma.email_projects_schedulesWhereInput;
    limit?: number;
};
export type email_projects_schedulesUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_projects_schedulesSelect<ExtArgs> | null;
    omit?: Prisma.email_projects_schedulesOmit<ExtArgs> | null;
    include?: Prisma.email_projects_schedulesInclude<ExtArgs> | null;
    where: Prisma.email_projects_schedulesWhereUniqueInput;
    create: Prisma.XOR<Prisma.email_projects_schedulesCreateInput, Prisma.email_projects_schedulesUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.email_projects_schedulesUpdateInput, Prisma.email_projects_schedulesUncheckedUpdateInput>;
};
export type email_projects_schedulesDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_projects_schedulesSelect<ExtArgs> | null;
    omit?: Prisma.email_projects_schedulesOmit<ExtArgs> | null;
    include?: Prisma.email_projects_schedulesInclude<ExtArgs> | null;
    where: Prisma.email_projects_schedulesWhereUniqueInput;
};
export type email_projects_schedulesDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_projects_schedulesWhereInput;
    limit?: number;
};
export type email_projects_schedules$sentsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_projects_schedules_sentSelect<ExtArgs> | null;
    omit?: Prisma.email_projects_schedules_sentOmit<ExtArgs> | null;
    include?: Prisma.email_projects_schedules_sentInclude<ExtArgs> | null;
    where?: Prisma.email_projects_schedules_sentWhereInput;
    orderBy?: Prisma.email_projects_schedules_sentOrderByWithRelationInput | Prisma.email_projects_schedules_sentOrderByWithRelationInput[];
    cursor?: Prisma.email_projects_schedules_sentWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Email_projects_schedules_sentScalarFieldEnum | Prisma.Email_projects_schedules_sentScalarFieldEnum[];
};
export type email_projects_schedulesDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_projects_schedulesSelect<ExtArgs> | null;
    omit?: Prisma.email_projects_schedulesOmit<ExtArgs> | null;
    include?: Prisma.email_projects_schedulesInclude<ExtArgs> | null;
};
export {};
