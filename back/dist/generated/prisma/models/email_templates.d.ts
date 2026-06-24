import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type email_templatesModel = runtime.Types.Result.DefaultSelection<Prisma.$email_templatesPayload>;
export type AggregateEmail_templates = {
    _count: Email_templatesCountAggregateOutputType | null;
    _min: Email_templatesMinAggregateOutputType | null;
    _max: Email_templatesMaxAggregateOutputType | null;
};
export type Email_templatesMinAggregateOutputType = {
    id: string | null;
    project_id: string | null;
    name: string | null;
    subject: string | null;
    body_html: string | null;
    body_text: string | null;
};
export type Email_templatesMaxAggregateOutputType = {
    id: string | null;
    project_id: string | null;
    name: string | null;
    subject: string | null;
    body_html: string | null;
    body_text: string | null;
};
export type Email_templatesCountAggregateOutputType = {
    id: number;
    project_id: number;
    name: number;
    subject: number;
    body_html: number;
    body_text: number;
    _all: number;
};
export type Email_templatesMinAggregateInputType = {
    id?: true;
    project_id?: true;
    name?: true;
    subject?: true;
    body_html?: true;
    body_text?: true;
};
export type Email_templatesMaxAggregateInputType = {
    id?: true;
    project_id?: true;
    name?: true;
    subject?: true;
    body_html?: true;
    body_text?: true;
};
export type Email_templatesCountAggregateInputType = {
    id?: true;
    project_id?: true;
    name?: true;
    subject?: true;
    body_html?: true;
    body_text?: true;
    _all?: true;
};
export type Email_templatesAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_templatesWhereInput;
    orderBy?: Prisma.email_templatesOrderByWithRelationInput | Prisma.email_templatesOrderByWithRelationInput[];
    cursor?: Prisma.email_templatesWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | Email_templatesCountAggregateInputType;
    _min?: Email_templatesMinAggregateInputType;
    _max?: Email_templatesMaxAggregateInputType;
};
export type GetEmail_templatesAggregateType<T extends Email_templatesAggregateArgs> = {
    [P in keyof T & keyof AggregateEmail_templates]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateEmail_templates[P]> : Prisma.GetScalarType<T[P], AggregateEmail_templates[P]>;
};
export type email_templatesGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_templatesWhereInput;
    orderBy?: Prisma.email_templatesOrderByWithAggregationInput | Prisma.email_templatesOrderByWithAggregationInput[];
    by: Prisma.Email_templatesScalarFieldEnum[] | Prisma.Email_templatesScalarFieldEnum;
    having?: Prisma.email_templatesScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: Email_templatesCountAggregateInputType | true;
    _min?: Email_templatesMinAggregateInputType;
    _max?: Email_templatesMaxAggregateInputType;
};
export type Email_templatesGroupByOutputType = {
    id: string;
    project_id: string;
    name: string;
    subject: string;
    body_html: string | null;
    body_text: string | null;
    _count: Email_templatesCountAggregateOutputType | null;
    _min: Email_templatesMinAggregateOutputType | null;
    _max: Email_templatesMaxAggregateOutputType | null;
};
type GetEmail_templatesGroupByPayload<T extends email_templatesGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<Email_templatesGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof Email_templatesGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], Email_templatesGroupByOutputType[P]> : Prisma.GetScalarType<T[P], Email_templatesGroupByOutputType[P]>;
}>>;
export type email_templatesWhereInput = {
    AND?: Prisma.email_templatesWhereInput | Prisma.email_templatesWhereInput[];
    OR?: Prisma.email_templatesWhereInput[];
    NOT?: Prisma.email_templatesWhereInput | Prisma.email_templatesWhereInput[];
    id?: Prisma.StringFilter<"email_templates"> | string;
    project_id?: Prisma.StringFilter<"email_templates"> | string;
    name?: Prisma.StringFilter<"email_templates"> | string;
    subject?: Prisma.StringFilter<"email_templates"> | string;
    body_html?: Prisma.StringNullableFilter<"email_templates"> | string | null;
    body_text?: Prisma.StringNullableFilter<"email_templates"> | string | null;
    projects?: Prisma.XOR<Prisma.Email_projectsScalarRelationFilter, Prisma.email_projectsWhereInput>;
};
export type email_templatesOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    project_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    subject?: Prisma.SortOrder;
    body_html?: Prisma.SortOrderInput | Prisma.SortOrder;
    body_text?: Prisma.SortOrderInput | Prisma.SortOrder;
    projects?: Prisma.email_projectsOrderByWithRelationInput;
    _relevance?: Prisma.email_templatesOrderByRelevanceInput;
};
export type email_templatesWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    AND?: Prisma.email_templatesWhereInput | Prisma.email_templatesWhereInput[];
    OR?: Prisma.email_templatesWhereInput[];
    NOT?: Prisma.email_templatesWhereInput | Prisma.email_templatesWhereInput[];
    project_id?: Prisma.StringFilter<"email_templates"> | string;
    name?: Prisma.StringFilter<"email_templates"> | string;
    subject?: Prisma.StringFilter<"email_templates"> | string;
    body_html?: Prisma.StringNullableFilter<"email_templates"> | string | null;
    body_text?: Prisma.StringNullableFilter<"email_templates"> | string | null;
    projects?: Prisma.XOR<Prisma.Email_projectsScalarRelationFilter, Prisma.email_projectsWhereInput>;
}, "id">;
export type email_templatesOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    project_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    subject?: Prisma.SortOrder;
    body_html?: Prisma.SortOrderInput | Prisma.SortOrder;
    body_text?: Prisma.SortOrderInput | Prisma.SortOrder;
    _count?: Prisma.email_templatesCountOrderByAggregateInput;
    _max?: Prisma.email_templatesMaxOrderByAggregateInput;
    _min?: Prisma.email_templatesMinOrderByAggregateInput;
};
export type email_templatesScalarWhereWithAggregatesInput = {
    AND?: Prisma.email_templatesScalarWhereWithAggregatesInput | Prisma.email_templatesScalarWhereWithAggregatesInput[];
    OR?: Prisma.email_templatesScalarWhereWithAggregatesInput[];
    NOT?: Prisma.email_templatesScalarWhereWithAggregatesInput | Prisma.email_templatesScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"email_templates"> | string;
    project_id?: Prisma.StringWithAggregatesFilter<"email_templates"> | string;
    name?: Prisma.StringWithAggregatesFilter<"email_templates"> | string;
    subject?: Prisma.StringWithAggregatesFilter<"email_templates"> | string;
    body_html?: Prisma.StringNullableWithAggregatesFilter<"email_templates"> | string | null;
    body_text?: Prisma.StringNullableWithAggregatesFilter<"email_templates"> | string | null;
};
export type email_templatesCreateInput = {
    id?: string;
    name: string;
    subject: string;
    body_html?: string | null;
    body_text?: string | null;
    projects: Prisma.email_projectsCreateNestedOneWithoutTemplatesInput;
};
export type email_templatesUncheckedCreateInput = {
    id?: string;
    project_id: string;
    name: string;
    subject: string;
    body_html?: string | null;
    body_text?: string | null;
};
export type email_templatesUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    subject?: Prisma.StringFieldUpdateOperationsInput | string;
    body_html?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    body_text?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    projects?: Prisma.email_projectsUpdateOneRequiredWithoutTemplatesNestedInput;
};
export type email_templatesUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    project_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    subject?: Prisma.StringFieldUpdateOperationsInput | string;
    body_html?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    body_text?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
};
export type email_templatesCreateManyInput = {
    id?: string;
    project_id: string;
    name: string;
    subject: string;
    body_html?: string | null;
    body_text?: string | null;
};
export type email_templatesUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    subject?: Prisma.StringFieldUpdateOperationsInput | string;
    body_html?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    body_text?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
};
export type email_templatesUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    project_id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    subject?: Prisma.StringFieldUpdateOperationsInput | string;
    body_html?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    body_text?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
};
export type Email_templatesListRelationFilter = {
    every?: Prisma.email_templatesWhereInput;
    some?: Prisma.email_templatesWhereInput;
    none?: Prisma.email_templatesWhereInput;
};
export type email_templatesOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type email_templatesOrderByRelevanceInput = {
    fields: Prisma.email_templatesOrderByRelevanceFieldEnum | Prisma.email_templatesOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type email_templatesCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    project_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    subject?: Prisma.SortOrder;
    body_html?: Prisma.SortOrder;
    body_text?: Prisma.SortOrder;
};
export type email_templatesMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    project_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    subject?: Prisma.SortOrder;
    body_html?: Prisma.SortOrder;
    body_text?: Prisma.SortOrder;
};
export type email_templatesMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    project_id?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    subject?: Prisma.SortOrder;
    body_html?: Prisma.SortOrder;
    body_text?: Prisma.SortOrder;
};
export type email_templatesCreateNestedManyWithoutProjectsInput = {
    create?: Prisma.XOR<Prisma.email_templatesCreateWithoutProjectsInput, Prisma.email_templatesUncheckedCreateWithoutProjectsInput> | Prisma.email_templatesCreateWithoutProjectsInput[] | Prisma.email_templatesUncheckedCreateWithoutProjectsInput[];
    connectOrCreate?: Prisma.email_templatesCreateOrConnectWithoutProjectsInput | Prisma.email_templatesCreateOrConnectWithoutProjectsInput[];
    createMany?: Prisma.email_templatesCreateManyProjectsInputEnvelope;
    connect?: Prisma.email_templatesWhereUniqueInput | Prisma.email_templatesWhereUniqueInput[];
};
export type email_templatesUncheckedCreateNestedManyWithoutProjectsInput = {
    create?: Prisma.XOR<Prisma.email_templatesCreateWithoutProjectsInput, Prisma.email_templatesUncheckedCreateWithoutProjectsInput> | Prisma.email_templatesCreateWithoutProjectsInput[] | Prisma.email_templatesUncheckedCreateWithoutProjectsInput[];
    connectOrCreate?: Prisma.email_templatesCreateOrConnectWithoutProjectsInput | Prisma.email_templatesCreateOrConnectWithoutProjectsInput[];
    createMany?: Prisma.email_templatesCreateManyProjectsInputEnvelope;
    connect?: Prisma.email_templatesWhereUniqueInput | Prisma.email_templatesWhereUniqueInput[];
};
export type email_templatesUpdateManyWithoutProjectsNestedInput = {
    create?: Prisma.XOR<Prisma.email_templatesCreateWithoutProjectsInput, Prisma.email_templatesUncheckedCreateWithoutProjectsInput> | Prisma.email_templatesCreateWithoutProjectsInput[] | Prisma.email_templatesUncheckedCreateWithoutProjectsInput[];
    connectOrCreate?: Prisma.email_templatesCreateOrConnectWithoutProjectsInput | Prisma.email_templatesCreateOrConnectWithoutProjectsInput[];
    upsert?: Prisma.email_templatesUpsertWithWhereUniqueWithoutProjectsInput | Prisma.email_templatesUpsertWithWhereUniqueWithoutProjectsInput[];
    createMany?: Prisma.email_templatesCreateManyProjectsInputEnvelope;
    set?: Prisma.email_templatesWhereUniqueInput | Prisma.email_templatesWhereUniqueInput[];
    disconnect?: Prisma.email_templatesWhereUniqueInput | Prisma.email_templatesWhereUniqueInput[];
    delete?: Prisma.email_templatesWhereUniqueInput | Prisma.email_templatesWhereUniqueInput[];
    connect?: Prisma.email_templatesWhereUniqueInput | Prisma.email_templatesWhereUniqueInput[];
    update?: Prisma.email_templatesUpdateWithWhereUniqueWithoutProjectsInput | Prisma.email_templatesUpdateWithWhereUniqueWithoutProjectsInput[];
    updateMany?: Prisma.email_templatesUpdateManyWithWhereWithoutProjectsInput | Prisma.email_templatesUpdateManyWithWhereWithoutProjectsInput[];
    deleteMany?: Prisma.email_templatesScalarWhereInput | Prisma.email_templatesScalarWhereInput[];
};
export type email_templatesUncheckedUpdateManyWithoutProjectsNestedInput = {
    create?: Prisma.XOR<Prisma.email_templatesCreateWithoutProjectsInput, Prisma.email_templatesUncheckedCreateWithoutProjectsInput> | Prisma.email_templatesCreateWithoutProjectsInput[] | Prisma.email_templatesUncheckedCreateWithoutProjectsInput[];
    connectOrCreate?: Prisma.email_templatesCreateOrConnectWithoutProjectsInput | Prisma.email_templatesCreateOrConnectWithoutProjectsInput[];
    upsert?: Prisma.email_templatesUpsertWithWhereUniqueWithoutProjectsInput | Prisma.email_templatesUpsertWithWhereUniqueWithoutProjectsInput[];
    createMany?: Prisma.email_templatesCreateManyProjectsInputEnvelope;
    set?: Prisma.email_templatesWhereUniqueInput | Prisma.email_templatesWhereUniqueInput[];
    disconnect?: Prisma.email_templatesWhereUniqueInput | Prisma.email_templatesWhereUniqueInput[];
    delete?: Prisma.email_templatesWhereUniqueInput | Prisma.email_templatesWhereUniqueInput[];
    connect?: Prisma.email_templatesWhereUniqueInput | Prisma.email_templatesWhereUniqueInput[];
    update?: Prisma.email_templatesUpdateWithWhereUniqueWithoutProjectsInput | Prisma.email_templatesUpdateWithWhereUniqueWithoutProjectsInput[];
    updateMany?: Prisma.email_templatesUpdateManyWithWhereWithoutProjectsInput | Prisma.email_templatesUpdateManyWithWhereWithoutProjectsInput[];
    deleteMany?: Prisma.email_templatesScalarWhereInput | Prisma.email_templatesScalarWhereInput[];
};
export type email_templatesCreateWithoutProjectsInput = {
    id?: string;
    name: string;
    subject: string;
    body_html?: string | null;
    body_text?: string | null;
};
export type email_templatesUncheckedCreateWithoutProjectsInput = {
    id?: string;
    name: string;
    subject: string;
    body_html?: string | null;
    body_text?: string | null;
};
export type email_templatesCreateOrConnectWithoutProjectsInput = {
    where: Prisma.email_templatesWhereUniqueInput;
    create: Prisma.XOR<Prisma.email_templatesCreateWithoutProjectsInput, Prisma.email_templatesUncheckedCreateWithoutProjectsInput>;
};
export type email_templatesCreateManyProjectsInputEnvelope = {
    data: Prisma.email_templatesCreateManyProjectsInput | Prisma.email_templatesCreateManyProjectsInput[];
    skipDuplicates?: boolean;
};
export type email_templatesUpsertWithWhereUniqueWithoutProjectsInput = {
    where: Prisma.email_templatesWhereUniqueInput;
    update: Prisma.XOR<Prisma.email_templatesUpdateWithoutProjectsInput, Prisma.email_templatesUncheckedUpdateWithoutProjectsInput>;
    create: Prisma.XOR<Prisma.email_templatesCreateWithoutProjectsInput, Prisma.email_templatesUncheckedCreateWithoutProjectsInput>;
};
export type email_templatesUpdateWithWhereUniqueWithoutProjectsInput = {
    where: Prisma.email_templatesWhereUniqueInput;
    data: Prisma.XOR<Prisma.email_templatesUpdateWithoutProjectsInput, Prisma.email_templatesUncheckedUpdateWithoutProjectsInput>;
};
export type email_templatesUpdateManyWithWhereWithoutProjectsInput = {
    where: Prisma.email_templatesScalarWhereInput;
    data: Prisma.XOR<Prisma.email_templatesUpdateManyMutationInput, Prisma.email_templatesUncheckedUpdateManyWithoutProjectsInput>;
};
export type email_templatesScalarWhereInput = {
    AND?: Prisma.email_templatesScalarWhereInput | Prisma.email_templatesScalarWhereInput[];
    OR?: Prisma.email_templatesScalarWhereInput[];
    NOT?: Prisma.email_templatesScalarWhereInput | Prisma.email_templatesScalarWhereInput[];
    id?: Prisma.StringFilter<"email_templates"> | string;
    project_id?: Prisma.StringFilter<"email_templates"> | string;
    name?: Prisma.StringFilter<"email_templates"> | string;
    subject?: Prisma.StringFilter<"email_templates"> | string;
    body_html?: Prisma.StringNullableFilter<"email_templates"> | string | null;
    body_text?: Prisma.StringNullableFilter<"email_templates"> | string | null;
};
export type email_templatesCreateManyProjectsInput = {
    id?: string;
    name: string;
    subject: string;
    body_html?: string | null;
    body_text?: string | null;
};
export type email_templatesUpdateWithoutProjectsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    subject?: Prisma.StringFieldUpdateOperationsInput | string;
    body_html?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    body_text?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
};
export type email_templatesUncheckedUpdateWithoutProjectsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    subject?: Prisma.StringFieldUpdateOperationsInput | string;
    body_html?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    body_text?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
};
export type email_templatesUncheckedUpdateManyWithoutProjectsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.StringFieldUpdateOperationsInput | string;
    subject?: Prisma.StringFieldUpdateOperationsInput | string;
    body_html?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    body_text?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
};
export type email_templatesSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    project_id?: boolean;
    name?: boolean;
    subject?: boolean;
    body_html?: boolean;
    body_text?: boolean;
    projects?: boolean | Prisma.email_projectsDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["email_templates"]>;
export type email_templatesSelectScalar = {
    id?: boolean;
    project_id?: boolean;
    name?: boolean;
    subject?: boolean;
    body_html?: boolean;
    body_text?: boolean;
};
export type email_templatesOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "project_id" | "name" | "subject" | "body_html" | "body_text", ExtArgs["result"]["email_templates"]>;
export type email_templatesInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    projects?: boolean | Prisma.email_projectsDefaultArgs<ExtArgs>;
};
export type $email_templatesPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "email_templates";
    objects: {
        projects: Prisma.$email_projectsPayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        project_id: string;
        name: string;
        subject: string;
        body_html: string | null;
        body_text: string | null;
    }, ExtArgs["result"]["email_templates"]>;
    composites: {};
};
export type email_templatesGetPayload<S extends boolean | null | undefined | email_templatesDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$email_templatesPayload, S>;
export type email_templatesCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<email_templatesFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: Email_templatesCountAggregateInputType | true;
};
export interface email_templatesDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['email_templates'];
        meta: {
            name: 'email_templates';
        };
    };
    findUnique<T extends email_templatesFindUniqueArgs>(args: Prisma.SelectSubset<T, email_templatesFindUniqueArgs<ExtArgs>>): Prisma.Prisma__email_templatesClient<runtime.Types.Result.GetResult<Prisma.$email_templatesPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends email_templatesFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, email_templatesFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__email_templatesClient<runtime.Types.Result.GetResult<Prisma.$email_templatesPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends email_templatesFindFirstArgs>(args?: Prisma.SelectSubset<T, email_templatesFindFirstArgs<ExtArgs>>): Prisma.Prisma__email_templatesClient<runtime.Types.Result.GetResult<Prisma.$email_templatesPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends email_templatesFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, email_templatesFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__email_templatesClient<runtime.Types.Result.GetResult<Prisma.$email_templatesPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends email_templatesFindManyArgs>(args?: Prisma.SelectSubset<T, email_templatesFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$email_templatesPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends email_templatesCreateArgs>(args: Prisma.SelectSubset<T, email_templatesCreateArgs<ExtArgs>>): Prisma.Prisma__email_templatesClient<runtime.Types.Result.GetResult<Prisma.$email_templatesPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends email_templatesCreateManyArgs>(args?: Prisma.SelectSubset<T, email_templatesCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends email_templatesDeleteArgs>(args: Prisma.SelectSubset<T, email_templatesDeleteArgs<ExtArgs>>): Prisma.Prisma__email_templatesClient<runtime.Types.Result.GetResult<Prisma.$email_templatesPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends email_templatesUpdateArgs>(args: Prisma.SelectSubset<T, email_templatesUpdateArgs<ExtArgs>>): Prisma.Prisma__email_templatesClient<runtime.Types.Result.GetResult<Prisma.$email_templatesPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends email_templatesDeleteManyArgs>(args?: Prisma.SelectSubset<T, email_templatesDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends email_templatesUpdateManyArgs>(args: Prisma.SelectSubset<T, email_templatesUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends email_templatesUpsertArgs>(args: Prisma.SelectSubset<T, email_templatesUpsertArgs<ExtArgs>>): Prisma.Prisma__email_templatesClient<runtime.Types.Result.GetResult<Prisma.$email_templatesPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends email_templatesCountArgs>(args?: Prisma.Subset<T, email_templatesCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], Email_templatesCountAggregateOutputType> : number>;
    aggregate<T extends Email_templatesAggregateArgs>(args: Prisma.Subset<T, Email_templatesAggregateArgs>): Prisma.PrismaPromise<GetEmail_templatesAggregateType<T>>;
    groupBy<T extends email_templatesGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: email_templatesGroupByArgs['orderBy'];
    } : {
        orderBy?: email_templatesGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, email_templatesGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetEmail_templatesGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: email_templatesFieldRefs;
}
export interface Prisma__email_templatesClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    projects<T extends Prisma.email_projectsDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.email_projectsDefaultArgs<ExtArgs>>): Prisma.Prisma__email_projectsClient<runtime.Types.Result.GetResult<Prisma.$email_projectsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface email_templatesFieldRefs {
    readonly id: Prisma.FieldRef<"email_templates", 'String'>;
    readonly project_id: Prisma.FieldRef<"email_templates", 'String'>;
    readonly name: Prisma.FieldRef<"email_templates", 'String'>;
    readonly subject: Prisma.FieldRef<"email_templates", 'String'>;
    readonly body_html: Prisma.FieldRef<"email_templates", 'String'>;
    readonly body_text: Prisma.FieldRef<"email_templates", 'String'>;
}
export type email_templatesFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_templatesSelect<ExtArgs> | null;
    omit?: Prisma.email_templatesOmit<ExtArgs> | null;
    include?: Prisma.email_templatesInclude<ExtArgs> | null;
    where: Prisma.email_templatesWhereUniqueInput;
};
export type email_templatesFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_templatesSelect<ExtArgs> | null;
    omit?: Prisma.email_templatesOmit<ExtArgs> | null;
    include?: Prisma.email_templatesInclude<ExtArgs> | null;
    where: Prisma.email_templatesWhereUniqueInput;
};
export type email_templatesFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type email_templatesFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type email_templatesFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type email_templatesCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_templatesSelect<ExtArgs> | null;
    omit?: Prisma.email_templatesOmit<ExtArgs> | null;
    include?: Prisma.email_templatesInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.email_templatesCreateInput, Prisma.email_templatesUncheckedCreateInput>;
};
export type email_templatesCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.email_templatesCreateManyInput | Prisma.email_templatesCreateManyInput[];
    skipDuplicates?: boolean;
};
export type email_templatesUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_templatesSelect<ExtArgs> | null;
    omit?: Prisma.email_templatesOmit<ExtArgs> | null;
    include?: Prisma.email_templatesInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.email_templatesUpdateInput, Prisma.email_templatesUncheckedUpdateInput>;
    where: Prisma.email_templatesWhereUniqueInput;
};
export type email_templatesUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.email_templatesUpdateManyMutationInput, Prisma.email_templatesUncheckedUpdateManyInput>;
    where?: Prisma.email_templatesWhereInput;
    limit?: number;
};
export type email_templatesUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_templatesSelect<ExtArgs> | null;
    omit?: Prisma.email_templatesOmit<ExtArgs> | null;
    include?: Prisma.email_templatesInclude<ExtArgs> | null;
    where: Prisma.email_templatesWhereUniqueInput;
    create: Prisma.XOR<Prisma.email_templatesCreateInput, Prisma.email_templatesUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.email_templatesUpdateInput, Prisma.email_templatesUncheckedUpdateInput>;
};
export type email_templatesDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_templatesSelect<ExtArgs> | null;
    omit?: Prisma.email_templatesOmit<ExtArgs> | null;
    include?: Prisma.email_templatesInclude<ExtArgs> | null;
    where: Prisma.email_templatesWhereUniqueInput;
};
export type email_templatesDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.email_templatesWhereInput;
    limit?: number;
};
export type email_templatesDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.email_templatesSelect<ExtArgs> | null;
    omit?: Prisma.email_templatesOmit<ExtArgs> | null;
    include?: Prisma.email_templatesInclude<ExtArgs> | null;
};
export {};
