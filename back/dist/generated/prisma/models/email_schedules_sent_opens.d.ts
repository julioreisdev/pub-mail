import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type email_schedules_sent_opensModel = runtime.Types.Result.DefaultSelection<Prisma.$email_schedules_sent_opensPayload>;
export type AggregateEmail_schedules_sent_opens = {
    _count: Email_schedules_sent_opensCountAggregateOutputType | null;
    _min: Email_schedules_sent_opensMinAggregateOutputType | null;
    _max: Email_schedules_sent_opensMaxAggregateOutputType | null;
};
export type Email_schedules_sent_opensMinAggregateOutputType = {
    id: string | null;
    schedule_sent_id: string | null;
    email: string | null;
    created_at: Date | null;
};
export type Email_schedules_sent_opensMaxAggregateOutputType = {
    id: string | null;
    schedule_sent_id: string | null;
    email: string | null;
    created_at: Date | null;
};
export type Email_schedules_sent_opensCountAggregateOutputType = {
    id: number;
    schedule_sent_id: number;
    email: number;
    created_at: number;
    _all: number;
};
export type Email_schedules_sent_opensMinAggregateInputType = {
    id?: true;
    schedule_sent_id?: true;
    email?: true;
    created_at?: true;
};
export type Email_schedules_sent_opensMaxAggregateInputType = {
    id?: true;
    schedule_sent_id?: true;
    email?: true;
    created_at?: true;
};
export type Email_schedules_sent_opensCountAggregateInputType = {
    id?: true;
    schedule_sent_id?: true;
    email?: true;
    created_at?: true;
    _all?: true;
};
export type Email_schedules_sent_opensAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_schedules_sent_opensWhereInput;
    orderBy?: Prisma.email_schedules_sent_opensOrderByWithRelationInput | Prisma.email_schedules_sent_opensOrderByWithRelationInput[];
    cursor?: Prisma.email_schedules_sent_opensWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | Email_schedules_sent_opensCountAggregateInputType;
    _min?: Email_schedules_sent_opensMinAggregateInputType;
    _max?: Email_schedules_sent_opensMaxAggregateInputType;
};
export type GetEmail_schedules_sent_opensAggregateType<T extends Email_schedules_sent_opensAggregateArgs> = {
    [P in keyof T & keyof AggregateEmail_schedules_sent_opens]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateEmail_schedules_sent_opens[P]> : Prisma.GetScalarType<T[P], AggregateEmail_schedules_sent_opens[P]>;
};
export type email_schedules_sent_opensGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_schedules_sent_opensWhereInput;
    orderBy?: Prisma.email_schedules_sent_opensOrderByWithAggregationInput | Prisma.email_schedules_sent_opensOrderByWithAggregationInput[];
    by: Prisma.Email_schedules_sent_opensScalarFieldEnum[] | Prisma.Email_schedules_sent_opensScalarFieldEnum;
    having?: Prisma.email_schedules_sent_opensScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: Email_schedules_sent_opensCountAggregateInputType | true;
    _min?: Email_schedules_sent_opensMinAggregateInputType;
    _max?: Email_schedules_sent_opensMaxAggregateInputType;
};
export type Email_schedules_sent_opensGroupByOutputType = {
    id: string;
    schedule_sent_id: string;
    email: string;
    created_at: Date;
    _count: Email_schedules_sent_opensCountAggregateOutputType | null;
    _min: Email_schedules_sent_opensMinAggregateOutputType | null;
    _max: Email_schedules_sent_opensMaxAggregateOutputType | null;
};
type GetEmail_schedules_sent_opensGroupByPayload<T extends email_schedules_sent_opensGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<Email_schedules_sent_opensGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof Email_schedules_sent_opensGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], Email_schedules_sent_opensGroupByOutputType[P]> : Prisma.GetScalarType<T[P], Email_schedules_sent_opensGroupByOutputType[P]>;
}>>;
export type email_schedules_sent_opensWhereInput = {
    AND?: Prisma.email_schedules_sent_opensWhereInput | Prisma.email_schedules_sent_opensWhereInput[];
    OR?: Prisma.email_schedules_sent_opensWhereInput[];
    NOT?: Prisma.email_schedules_sent_opensWhereInput | Prisma.email_schedules_sent_opensWhereInput[];
    id?: Prisma.StringFilter<"email_schedules_sent_opens"> | string;
    schedule_sent_id?: Prisma.StringFilter<"email_schedules_sent_opens"> | string;
    email?: Prisma.StringFilter<"email_schedules_sent_opens"> | string;
    created_at?: Prisma.DateTimeFilter<"email_schedules_sent_opens"> | Date | string;
    sent_campaign?: Prisma.XOR<Prisma.Email_projects_schedules_sentScalarRelationFilter, Prisma.email_projects_schedules_sentWhereInput>;
};
export type email_schedules_sent_opensOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    schedule_sent_id?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    sent_campaign?: Prisma.email_projects_schedules_sentOrderByWithRelationInput;
    _relevance?: Prisma.email_schedules_sent_opensOrderByRelevanceInput;
};
export type email_schedules_sent_opensWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    schedule_sent_id_email?: Prisma.email_schedules_sent_opensSchedule_sent_idEmailCompoundUniqueInput;
    AND?: Prisma.email_schedules_sent_opensWhereInput | Prisma.email_schedules_sent_opensWhereInput[];
    OR?: Prisma.email_schedules_sent_opensWhereInput[];
    NOT?: Prisma.email_schedules_sent_opensWhereInput | Prisma.email_schedules_sent_opensWhereInput[];
    schedule_sent_id?: Prisma.StringFilter<"email_schedules_sent_opens"> | string;
    email?: Prisma.StringFilter<"email_schedules_sent_opens"> | string;
    created_at?: Prisma.DateTimeFilter<"email_schedules_sent_opens"> | Date | string;
    sent_campaign?: Prisma.XOR<Prisma.Email_projects_schedules_sentScalarRelationFilter, Prisma.email_projects_schedules_sentWhereInput>;
}, "id" | "schedule_sent_id_email">;
export type email_schedules_sent_opensOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    schedule_sent_id?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    _count?: Prisma.email_schedules_sent_opensCountOrderByAggregateInput;
    _max?: Prisma.email_schedules_sent_opensMaxOrderByAggregateInput;
    _min?: Prisma.email_schedules_sent_opensMinOrderByAggregateInput;
};
export type email_schedules_sent_opensScalarWhereWithAggregatesInput = {
    AND?: Prisma.email_schedules_sent_opensScalarWhereWithAggregatesInput | Prisma.email_schedules_sent_opensScalarWhereWithAggregatesInput[];
    OR?: Prisma.email_schedules_sent_opensScalarWhereWithAggregatesInput[];
    NOT?: Prisma.email_schedules_sent_opensScalarWhereWithAggregatesInput | Prisma.email_schedules_sent_opensScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"email_schedules_sent_opens"> | string;
    schedule_sent_id?: Prisma.StringWithAggregatesFilter<"email_schedules_sent_opens"> | string;
    email?: Prisma.StringWithAggregatesFilter<"email_schedules_sent_opens"> | string;
    created_at?: Prisma.DateTimeWithAggregatesFilter<"email_schedules_sent_opens"> | Date | string;
};
export type email_schedules_sent_opensCreateInput = {
    id?: string;
    email: string;
    created_at?: Date | string;
    sent_campaign: Prisma.email_projects_schedules_sentCreateNestedOneWithoutOpensInput;
};
export type email_schedules_sent_opensUncheckedCreateInput = {
    id?: string;
    schedule_sent_id: string;
    email: string;
    created_at?: Date | string;
};
export type email_schedules_sent_opensUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    sent_campaign?: Prisma.email_projects_schedules_sentUpdateOneRequiredWithoutOpensNestedInput;
};
export type email_schedules_sent_opensUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    schedule_sent_id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type email_schedules_sent_opensCreateManyInput = {
    id?: string;
    schedule_sent_id: string;
    email: string;
    created_at?: Date | string;
};
export type email_schedules_sent_opensUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type email_schedules_sent_opensUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    schedule_sent_id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type Email_schedules_sent_opensListRelationFilter = {
    every?: Prisma.email_schedules_sent_opensWhereInput;
    some?: Prisma.email_schedules_sent_opensWhereInput;
    none?: Prisma.email_schedules_sent_opensWhereInput;
};
export type email_schedules_sent_opensOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type email_schedules_sent_opensOrderByRelevanceInput = {
    fields: Prisma.email_schedules_sent_opensOrderByRelevanceFieldEnum | Prisma.email_schedules_sent_opensOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type email_schedules_sent_opensSchedule_sent_idEmailCompoundUniqueInput = {
    schedule_sent_id: string;
    email: string;
};
export type email_schedules_sent_opensCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    schedule_sent_id?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
};
export type email_schedules_sent_opensMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    schedule_sent_id?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
};
export type email_schedules_sent_opensMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    schedule_sent_id?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
};
export type email_schedules_sent_opensCreateNestedManyWithoutSent_campaignInput = {
    create?: Prisma.XOR<Prisma.email_schedules_sent_opensCreateWithoutSent_campaignInput, Prisma.email_schedules_sent_opensUncheckedCreateWithoutSent_campaignInput> | Prisma.email_schedules_sent_opensCreateWithoutSent_campaignInput[] | Prisma.email_schedules_sent_opensUncheckedCreateWithoutSent_campaignInput[];
    connectOrCreate?: Prisma.email_schedules_sent_opensCreateOrConnectWithoutSent_campaignInput | Prisma.email_schedules_sent_opensCreateOrConnectWithoutSent_campaignInput[];
    createMany?: Prisma.email_schedules_sent_opensCreateManySent_campaignInputEnvelope;
    connect?: Prisma.email_schedules_sent_opensWhereUniqueInput | Prisma.email_schedules_sent_opensWhereUniqueInput[];
};
export type email_schedules_sent_opensUncheckedCreateNestedManyWithoutSent_campaignInput = {
    create?: Prisma.XOR<Prisma.email_schedules_sent_opensCreateWithoutSent_campaignInput, Prisma.email_schedules_sent_opensUncheckedCreateWithoutSent_campaignInput> | Prisma.email_schedules_sent_opensCreateWithoutSent_campaignInput[] | Prisma.email_schedules_sent_opensUncheckedCreateWithoutSent_campaignInput[];
    connectOrCreate?: Prisma.email_schedules_sent_opensCreateOrConnectWithoutSent_campaignInput | Prisma.email_schedules_sent_opensCreateOrConnectWithoutSent_campaignInput[];
    createMany?: Prisma.email_schedules_sent_opensCreateManySent_campaignInputEnvelope;
    connect?: Prisma.email_schedules_sent_opensWhereUniqueInput | Prisma.email_schedules_sent_opensWhereUniqueInput[];
};
export type email_schedules_sent_opensUpdateManyWithoutSent_campaignNestedInput = {
    create?: Prisma.XOR<Prisma.email_schedules_sent_opensCreateWithoutSent_campaignInput, Prisma.email_schedules_sent_opensUncheckedCreateWithoutSent_campaignInput> | Prisma.email_schedules_sent_opensCreateWithoutSent_campaignInput[] | Prisma.email_schedules_sent_opensUncheckedCreateWithoutSent_campaignInput[];
    connectOrCreate?: Prisma.email_schedules_sent_opensCreateOrConnectWithoutSent_campaignInput | Prisma.email_schedules_sent_opensCreateOrConnectWithoutSent_campaignInput[];
    upsert?: Prisma.email_schedules_sent_opensUpsertWithWhereUniqueWithoutSent_campaignInput | Prisma.email_schedules_sent_opensUpsertWithWhereUniqueWithoutSent_campaignInput[];
    createMany?: Prisma.email_schedules_sent_opensCreateManySent_campaignInputEnvelope;
    set?: Prisma.email_schedules_sent_opensWhereUniqueInput | Prisma.email_schedules_sent_opensWhereUniqueInput[];
    disconnect?: Prisma.email_schedules_sent_opensWhereUniqueInput | Prisma.email_schedules_sent_opensWhereUniqueInput[];
    delete?: Prisma.email_schedules_sent_opensWhereUniqueInput | Prisma.email_schedules_sent_opensWhereUniqueInput[];
    connect?: Prisma.email_schedules_sent_opensWhereUniqueInput | Prisma.email_schedules_sent_opensWhereUniqueInput[];
    update?: Prisma.email_schedules_sent_opensUpdateWithWhereUniqueWithoutSent_campaignInput | Prisma.email_schedules_sent_opensUpdateWithWhereUniqueWithoutSent_campaignInput[];
    updateMany?: Prisma.email_schedules_sent_opensUpdateManyWithWhereWithoutSent_campaignInput | Prisma.email_schedules_sent_opensUpdateManyWithWhereWithoutSent_campaignInput[];
    deleteMany?: Prisma.email_schedules_sent_opensScalarWhereInput | Prisma.email_schedules_sent_opensScalarWhereInput[];
};
export type email_schedules_sent_opensUncheckedUpdateManyWithoutSent_campaignNestedInput = {
    create?: Prisma.XOR<Prisma.email_schedules_sent_opensCreateWithoutSent_campaignInput, Prisma.email_schedules_sent_opensUncheckedCreateWithoutSent_campaignInput> | Prisma.email_schedules_sent_opensCreateWithoutSent_campaignInput[] | Prisma.email_schedules_sent_opensUncheckedCreateWithoutSent_campaignInput[];
    connectOrCreate?: Prisma.email_schedules_sent_opensCreateOrConnectWithoutSent_campaignInput | Prisma.email_schedules_sent_opensCreateOrConnectWithoutSent_campaignInput[];
    upsert?: Prisma.email_schedules_sent_opensUpsertWithWhereUniqueWithoutSent_campaignInput | Prisma.email_schedules_sent_opensUpsertWithWhereUniqueWithoutSent_campaignInput[];
    createMany?: Prisma.email_schedules_sent_opensCreateManySent_campaignInputEnvelope;
    set?: Prisma.email_schedules_sent_opensWhereUniqueInput | Prisma.email_schedules_sent_opensWhereUniqueInput[];
    disconnect?: Prisma.email_schedules_sent_opensWhereUniqueInput | Prisma.email_schedules_sent_opensWhereUniqueInput[];
    delete?: Prisma.email_schedules_sent_opensWhereUniqueInput | Prisma.email_schedules_sent_opensWhereUniqueInput[];
    connect?: Prisma.email_schedules_sent_opensWhereUniqueInput | Prisma.email_schedules_sent_opensWhereUniqueInput[];
    update?: Prisma.email_schedules_sent_opensUpdateWithWhereUniqueWithoutSent_campaignInput | Prisma.email_schedules_sent_opensUpdateWithWhereUniqueWithoutSent_campaignInput[];
    updateMany?: Prisma.email_schedules_sent_opensUpdateManyWithWhereWithoutSent_campaignInput | Prisma.email_schedules_sent_opensUpdateManyWithWhereWithoutSent_campaignInput[];
    deleteMany?: Prisma.email_schedules_sent_opensScalarWhereInput | Prisma.email_schedules_sent_opensScalarWhereInput[];
};
export type email_schedules_sent_opensCreateWithoutSent_campaignInput = {
    id?: string;
    email: string;
    created_at?: Date | string;
};
export type email_schedules_sent_opensUncheckedCreateWithoutSent_campaignInput = {
    id?: string;
    email: string;
    created_at?: Date | string;
};
export type email_schedules_sent_opensCreateOrConnectWithoutSent_campaignInput = {
    where: Prisma.email_schedules_sent_opensWhereUniqueInput;
    create: Prisma.XOR<Prisma.email_schedules_sent_opensCreateWithoutSent_campaignInput, Prisma.email_schedules_sent_opensUncheckedCreateWithoutSent_campaignInput>;
};
export type email_schedules_sent_opensCreateManySent_campaignInputEnvelope = {
    data: Prisma.email_schedules_sent_opensCreateManySent_campaignInput | Prisma.email_schedules_sent_opensCreateManySent_campaignInput[];
    skipDuplicates?: boolean;
};
export type email_schedules_sent_opensUpsertWithWhereUniqueWithoutSent_campaignInput = {
    where: Prisma.email_schedules_sent_opensWhereUniqueInput;
    update: Prisma.XOR<Prisma.email_schedules_sent_opensUpdateWithoutSent_campaignInput, Prisma.email_schedules_sent_opensUncheckedUpdateWithoutSent_campaignInput>;
    create: Prisma.XOR<Prisma.email_schedules_sent_opensCreateWithoutSent_campaignInput, Prisma.email_schedules_sent_opensUncheckedCreateWithoutSent_campaignInput>;
};
export type email_schedules_sent_opensUpdateWithWhereUniqueWithoutSent_campaignInput = {
    where: Prisma.email_schedules_sent_opensWhereUniqueInput;
    data: Prisma.XOR<Prisma.email_schedules_sent_opensUpdateWithoutSent_campaignInput, Prisma.email_schedules_sent_opensUncheckedUpdateWithoutSent_campaignInput>;
};
export type email_schedules_sent_opensUpdateManyWithWhereWithoutSent_campaignInput = {
    where: Prisma.email_schedules_sent_opensScalarWhereInput;
    data: Prisma.XOR<Prisma.email_schedules_sent_opensUpdateManyMutationInput, Prisma.email_schedules_sent_opensUncheckedUpdateManyWithoutSent_campaignInput>;
};
export type email_schedules_sent_opensScalarWhereInput = {
    AND?: Prisma.email_schedules_sent_opensScalarWhereInput | Prisma.email_schedules_sent_opensScalarWhereInput[];
    OR?: Prisma.email_schedules_sent_opensScalarWhereInput[];
    NOT?: Prisma.email_schedules_sent_opensScalarWhereInput | Prisma.email_schedules_sent_opensScalarWhereInput[];
    id?: Prisma.StringFilter<"email_schedules_sent_opens"> | string;
    schedule_sent_id?: Prisma.StringFilter<"email_schedules_sent_opens"> | string;
    email?: Prisma.StringFilter<"email_schedules_sent_opens"> | string;
    created_at?: Prisma.DateTimeFilter<"email_schedules_sent_opens"> | Date | string;
};
export type email_schedules_sent_opensCreateManySent_campaignInput = {
    id?: string;
    email: string;
    created_at?: Date | string;
};
export type email_schedules_sent_opensUpdateWithoutSent_campaignInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type email_schedules_sent_opensUncheckedUpdateWithoutSent_campaignInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type email_schedules_sent_opensUncheckedUpdateManyWithoutSent_campaignInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type email_schedules_sent_opensSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    schedule_sent_id?: boolean;
    email?: boolean;
    created_at?: boolean;
    sent_campaign?: boolean | Prisma.email_projects_schedules_sentDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["email_schedules_sent_opens"]>;
export type email_schedules_sent_opensSelectScalar = {
    id?: boolean;
    schedule_sent_id?: boolean;
    email?: boolean;
    created_at?: boolean;
};
export type email_schedules_sent_opensOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "schedule_sent_id" | "email" | "created_at", ExtArgs["result"]["email_schedules_sent_opens"]>;
export type email_schedules_sent_opensInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    sent_campaign?: boolean | Prisma.email_projects_schedules_sentDefaultArgs<ExtArgs>;
};
export type $email_schedules_sent_opensPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "email_schedules_sent_opens";
    objects: {
        sent_campaign: Prisma.$email_projects_schedules_sentPayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        schedule_sent_id: string;
        email: string;
        created_at: Date;
    }, ExtArgs["result"]["email_schedules_sent_opens"]>;
    composites: {};
};
export type email_schedules_sent_opensGetPayload<S extends boolean | null | undefined | email_schedules_sent_opensDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$email_schedules_sent_opensPayload, S>;
export type email_schedules_sent_opensCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<email_schedules_sent_opensFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: Email_schedules_sent_opensCountAggregateInputType | true;
};
export interface email_schedules_sent_opensDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['email_schedules_sent_opens'];
        meta: {
            name: 'email_schedules_sent_opens';
        };
    };
    findUnique<T extends email_schedules_sent_opensFindUniqueArgs>(args: Prisma.SelectSubset<T, email_schedules_sent_opensFindUniqueArgs<ExtArgs>>): Prisma.Prisma__email_schedules_sent_opensClient<runtime.Types.Result.GetResult<Prisma.$email_schedules_sent_opensPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends email_schedules_sent_opensFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, email_schedules_sent_opensFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__email_schedules_sent_opensClient<runtime.Types.Result.GetResult<Prisma.$email_schedules_sent_opensPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends email_schedules_sent_opensFindFirstArgs>(args?: Prisma.SelectSubset<T, email_schedules_sent_opensFindFirstArgs<ExtArgs>>): Prisma.Prisma__email_schedules_sent_opensClient<runtime.Types.Result.GetResult<Prisma.$email_schedules_sent_opensPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends email_schedules_sent_opensFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, email_schedules_sent_opensFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__email_schedules_sent_opensClient<runtime.Types.Result.GetResult<Prisma.$email_schedules_sent_opensPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends email_schedules_sent_opensFindManyArgs>(args?: Prisma.SelectSubset<T, email_schedules_sent_opensFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$email_schedules_sent_opensPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends email_schedules_sent_opensCreateArgs>(args: Prisma.SelectSubset<T, email_schedules_sent_opensCreateArgs<ExtArgs>>): Prisma.Prisma__email_schedules_sent_opensClient<runtime.Types.Result.GetResult<Prisma.$email_schedules_sent_opensPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends email_schedules_sent_opensCreateManyArgs>(args?: Prisma.SelectSubset<T, email_schedules_sent_opensCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends email_schedules_sent_opensDeleteArgs>(args: Prisma.SelectSubset<T, email_schedules_sent_opensDeleteArgs<ExtArgs>>): Prisma.Prisma__email_schedules_sent_opensClient<runtime.Types.Result.GetResult<Prisma.$email_schedules_sent_opensPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends email_schedules_sent_opensUpdateArgs>(args: Prisma.SelectSubset<T, email_schedules_sent_opensUpdateArgs<ExtArgs>>): Prisma.Prisma__email_schedules_sent_opensClient<runtime.Types.Result.GetResult<Prisma.$email_schedules_sent_opensPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends email_schedules_sent_opensDeleteManyArgs>(args?: Prisma.SelectSubset<T, email_schedules_sent_opensDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends email_schedules_sent_opensUpdateManyArgs>(args: Prisma.SelectSubset<T, email_schedules_sent_opensUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends email_schedules_sent_opensUpsertArgs>(args: Prisma.SelectSubset<T, email_schedules_sent_opensUpsertArgs<ExtArgs>>): Prisma.Prisma__email_schedules_sent_opensClient<runtime.Types.Result.GetResult<Prisma.$email_schedules_sent_opensPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends email_schedules_sent_opensCountArgs>(args?: Prisma.Subset<T, email_schedules_sent_opensCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], Email_schedules_sent_opensCountAggregateOutputType> : number>;
    aggregate<T extends Email_schedules_sent_opensAggregateArgs>(args: Prisma.Subset<T, Email_schedules_sent_opensAggregateArgs>): Prisma.PrismaPromise<GetEmail_schedules_sent_opensAggregateType<T>>;
    groupBy<T extends email_schedules_sent_opensGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: email_schedules_sent_opensGroupByArgs['orderBy'];
    } : {
        orderBy?: email_schedules_sent_opensGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, email_schedules_sent_opensGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetEmail_schedules_sent_opensGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: email_schedules_sent_opensFieldRefs;
}
export interface Prisma__email_schedules_sent_opensClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    sent_campaign<T extends Prisma.email_projects_schedules_sentDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.email_projects_schedules_sentDefaultArgs<ExtArgs>>): Prisma.Prisma__email_projects_schedules_sentClient<runtime.Types.Result.GetResult<Prisma.$email_projects_schedules_sentPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface email_schedules_sent_opensFieldRefs {
    readonly id: Prisma.FieldRef<"email_schedules_sent_opens", 'String'>;
    readonly schedule_sent_id: Prisma.FieldRef<"email_schedules_sent_opens", 'String'>;
    readonly email: Prisma.FieldRef<"email_schedules_sent_opens", 'String'>;
    readonly created_at: Prisma.FieldRef<"email_schedules_sent_opens", 'DateTime'>;
}
export type email_schedules_sent_opensFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_schedules_sent_opensSelect<ExtArgs> | null;
    omit?: Prisma.email_schedules_sent_opensOmit<ExtArgs> | null;
    include?: Prisma.email_schedules_sent_opensInclude<ExtArgs> | null;
    where: Prisma.email_schedules_sent_opensWhereUniqueInput;
};
export type email_schedules_sent_opensFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_schedules_sent_opensSelect<ExtArgs> | null;
    omit?: Prisma.email_schedules_sent_opensOmit<ExtArgs> | null;
    include?: Prisma.email_schedules_sent_opensInclude<ExtArgs> | null;
    where: Prisma.email_schedules_sent_opensWhereUniqueInput;
};
export type email_schedules_sent_opensFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_schedules_sent_opensSelect<ExtArgs> | null;
    omit?: Prisma.email_schedules_sent_opensOmit<ExtArgs> | null;
    include?: Prisma.email_schedules_sent_opensInclude<ExtArgs> | null;
    where?: Prisma.email_schedules_sent_opensWhereInput;
    orderBy?: Prisma.email_schedules_sent_opensOrderByWithRelationInput | Prisma.email_schedules_sent_opensOrderByWithRelationInput[];
    cursor?: Prisma.email_schedules_sent_opensWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Email_schedules_sent_opensScalarFieldEnum | Prisma.Email_schedules_sent_opensScalarFieldEnum[];
};
export type email_schedules_sent_opensFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_schedules_sent_opensSelect<ExtArgs> | null;
    omit?: Prisma.email_schedules_sent_opensOmit<ExtArgs> | null;
    include?: Prisma.email_schedules_sent_opensInclude<ExtArgs> | null;
    where?: Prisma.email_schedules_sent_opensWhereInput;
    orderBy?: Prisma.email_schedules_sent_opensOrderByWithRelationInput | Prisma.email_schedules_sent_opensOrderByWithRelationInput[];
    cursor?: Prisma.email_schedules_sent_opensWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Email_schedules_sent_opensScalarFieldEnum | Prisma.Email_schedules_sent_opensScalarFieldEnum[];
};
export type email_schedules_sent_opensFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_schedules_sent_opensSelect<ExtArgs> | null;
    omit?: Prisma.email_schedules_sent_opensOmit<ExtArgs> | null;
    include?: Prisma.email_schedules_sent_opensInclude<ExtArgs> | null;
    where?: Prisma.email_schedules_sent_opensWhereInput;
    orderBy?: Prisma.email_schedules_sent_opensOrderByWithRelationInput | Prisma.email_schedules_sent_opensOrderByWithRelationInput[];
    cursor?: Prisma.email_schedules_sent_opensWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.Email_schedules_sent_opensScalarFieldEnum | Prisma.Email_schedules_sent_opensScalarFieldEnum[];
};
export type email_schedules_sent_opensCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_schedules_sent_opensSelect<ExtArgs> | null;
    omit?: Prisma.email_schedules_sent_opensOmit<ExtArgs> | null;
    include?: Prisma.email_schedules_sent_opensInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.email_schedules_sent_opensCreateInput, Prisma.email_schedules_sent_opensUncheckedCreateInput>;
};
export type email_schedules_sent_opensCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.email_schedules_sent_opensCreateManyInput | Prisma.email_schedules_sent_opensCreateManyInput[];
    skipDuplicates?: boolean;
};
export type email_schedules_sent_opensUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_schedules_sent_opensSelect<ExtArgs> | null;
    omit?: Prisma.email_schedules_sent_opensOmit<ExtArgs> | null;
    include?: Prisma.email_schedules_sent_opensInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.email_schedules_sent_opensUpdateInput, Prisma.email_schedules_sent_opensUncheckedUpdateInput>;
    where: Prisma.email_schedules_sent_opensWhereUniqueInput;
};
export type email_schedules_sent_opensUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.email_schedules_sent_opensUpdateManyMutationInput, Prisma.email_schedules_sent_opensUncheckedUpdateManyInput>;
    where?: Prisma.email_schedules_sent_opensWhereInput;
    limit?: number;
};
export type email_schedules_sent_opensUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_schedules_sent_opensSelect<ExtArgs> | null;
    omit?: Prisma.email_schedules_sent_opensOmit<ExtArgs> | null;
    include?: Prisma.email_schedules_sent_opensInclude<ExtArgs> | null;
    where: Prisma.email_schedules_sent_opensWhereUniqueInput;
    create: Prisma.XOR<Prisma.email_schedules_sent_opensCreateInput, Prisma.email_schedules_sent_opensUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.email_schedules_sent_opensUpdateInput, Prisma.email_schedules_sent_opensUncheckedUpdateInput>;
};
export type email_schedules_sent_opensDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_schedules_sent_opensSelect<ExtArgs> | null;
    omit?: Prisma.email_schedules_sent_opensOmit<ExtArgs> | null;
    include?: Prisma.email_schedules_sent_opensInclude<ExtArgs> | null;
    where: Prisma.email_schedules_sent_opensWhereUniqueInput;
};
export type email_schedules_sent_opensDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_schedules_sent_opensWhereInput;
    limit?: number;
};
export type email_schedules_sent_opensDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_schedules_sent_opensSelect<ExtArgs> | null;
    omit?: Prisma.email_schedules_sent_opensOmit<ExtArgs> | null;
    include?: Prisma.email_schedules_sent_opensInclude<ExtArgs> | null;
};
export {};
