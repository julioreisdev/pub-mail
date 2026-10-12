import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppPresenter } from './whatsapp-presenter.service';
import {
  ChatKey,
  WhatsAppAttendanceService,
} from './whatsapp-attendance.service';
import { WhatsAppChatService } from './whatsapp-chat.service';
import { WhatsAppTasksService } from './whatsapp-tasks.service';
import { formatBRL } from './whatsapp-crm.service';
import { WhatsAppHooks, InboundEvent } from './whatsapp-hooks.service';
import { isGroupJid } from './wa-jid.util';

// ============================================================================
// Funil de vendas / atendimento (Kanban) do WhatsApp — fase 3 do CRM.
// Etapas por org (`whatsapp_pipeline_stages`); a conversa guarda `stage_id`, `deal_cents` e
// `stage_moved_at` em `whatsapp_chats`. Mover para uma etapa pode disparar ações
// (mensagem, etiquetas, tarefa). Tudo vira evento na linha do tempo do atendimento.
//
// Multi-número: a conversa chega à API pelo uuid da linha (`chat_id`); internamente é
// (session_id, jid). O quadro aceita filtro por número e respeita os números do usuário.
// ============================================================================

export const DEFAULT_STAGES = [
  { name: 'Novo', color: '#3B82F6', kind: 'open' },
  { name: 'Em contato', color: '#F59E0B', kind: 'open' },
  { name: 'Proposta', color: '#8B5CF6', kind: 'open' },
  { name: 'Fechado', color: '#22C55E', kind: 'won' },
  { name: 'Perdido', color: '#EF4444', kind: 'lost' },
];
const HEX = /^#[0-9a-fA-F]{6}$/;
const KINDS = ['open', 'won', 'lost'];

export type PipelineAutomation = {
  auto_enter_stage_id: string | null;
  paid_stage_id: string | null;
};
type StageActions = {
  send_text?: string;
  add_tags?: string[];
  remove_tags?: string[];
  task?: { title: string; days?: number } | null;
};

@Injectable()
export class WhatsAppPipelineService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppPipelineService.name);
  private readonly autoCache = new Map<
    string,
    { at: number; cfg: PipelineAutomation }
  >();
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenter: WhatsAppPresenter,
    private readonly attendance: WhatsAppAttendanceService,
    private readonly chat: WhatsAppChatService,
    private readonly tasks: WhatsAppTasksService,
    private readonly hooks: WhatsAppHooks,
  ) {}

  onModuleInit() {
    this.hooks.onInbound((e) => this.onInbound(e));
    this.hooks.on('bot_pix_paid', (e) => this.onPaid(e.orgId, e.key)); // PIX cobrado pelo Fluxo do Bot
  }

  /** Cláusula `session_id` para listagens: número pedido (se permitido) ou todos os permitidos. null = nada. */
  private sessionFilter(
    sessionId: unknown,
    allowed: Set<string> | null,
  ): { session_id?: any } | null {
    const sid = sessionId ? String(sessionId) : '';
    if (sid)
      return allowed !== null && !allowed.has(sid) ? null : { session_id: sid };
    if (allowed === null) return {};
    if (!allowed.size) return null;
    return { session_id: { in: [...allowed] } };
  }

  // ---------------------------------------------------------------- etapas
  private shapeStage(s: any) {
    return {
      id: s.id,
      name: s.name,
      color: s.color,
      position: s.position,
      kind: s.kind,
      actions: this.normActions(s.actions),
      created_at: s.created_at,
    };
  }

  private normActions(raw: any): StageActions {
    const a = raw && typeof raw === 'object' ? raw : {};
    const out: StageActions = {};
    if (typeof a.send_text === 'string' && a.send_text.trim())
      out.send_text = a.send_text.trim().slice(0, 2000);
    if (Array.isArray(a.add_tags) && a.add_tags.length)
      out.add_tags = a.add_tags.map(String).slice(0, 20);
    if (Array.isArray(a.remove_tags) && a.remove_tags.length)
      out.remove_tags = a.remove_tags.map(String).slice(0, 20);
    if (
      a.task &&
      typeof a.task === 'object' &&
      typeof a.task.title === 'string' &&
      a.task.title.trim()
    ) {
      const days = Number(a.task.days);
      out.task = {
        title: a.task.title.trim().slice(0, 160),
        days: Number.isFinite(days)
          ? Math.max(0, Math.min(365, Math.round(days)))
          : 1,
      };
    }
    return out;
  }

  /** Lista as etapas; na 1ª vez semeia as padrão. */
  async stages(orgId: string) {
    let rows = await this.prisma.whatsapp_pipeline_stages.findMany({
      where: { organization_id: orgId },
      orderBy: { position: 'asc' },
    });
    if (!rows.length) {
      await this.prisma.whatsapp_pipeline_stages.createMany({
        data: DEFAULT_STAGES.map((s, i) => ({
          organization_id: orgId,
          name: s.name,
          color: s.color,
          kind: s.kind,
          position: i,
        })),
      });
      rows = await this.prisma.whatsapp_pipeline_stages.findMany({
        where: { organization_id: orgId },
        orderBy: { position: 'asc' },
      });
    }
    return rows.map((s) => this.shapeStage(s));
  }

  async createStage(orgId: string, dto: any) {
    const name = String(dto?.name || '').trim();
    if (!name) throw new BadRequestException('Dê um nome à etapa.');
    const count = await this.prisma.whatsapp_pipeline_stages.count({
      where: { organization_id: orgId },
    });
    if (count >= 15) throw new BadRequestException('Máximo de 15 etapas.');
    const dup = await this.prisma.whatsapp_pipeline_stages.findFirst({
      where: { organization_id: orgId, name },
    });
    if (dup)
      throw new BadRequestException('Já existe uma etapa com esse nome.');
    const row = await this.prisma.whatsapp_pipeline_stages.create({
      data: {
        organization_id: orgId,
        name: name.slice(0, 60),
        color: HEX.test(String(dto?.color || '')) ? dto.color : '#3B82F6',
        kind: KINDS.includes(dto?.kind) ? dto.kind : 'open',
        actions: this.normActions(dto?.actions) as any,
        position: count,
      },
    });
    return this.shapeStage(row);
  }

  async updateStage(orgId: string, id: string, dto: any) {
    const cur = await this.prisma.whatsapp_pipeline_stages.findFirst({
      where: { id, organization_id: orgId },
    });
    if (!cur) throw new NotFoundException('Etapa não encontrada.');
    const data: any = {};
    if (dto?.name !== undefined) {
      const name = String(dto.name || '').trim();
      if (!name) throw new BadRequestException('Dê um nome à etapa.');
      const dup = await this.prisma.whatsapp_pipeline_stages.findFirst({
        where: { organization_id: orgId, name, NOT: { id } },
      });
      if (dup)
        throw new BadRequestException('Já existe uma etapa com esse nome.');
      data.name = name.slice(0, 60);
    }
    if (dto?.color !== undefined && HEX.test(String(dto.color)))
      data.color = dto.color;
    if (dto?.kind !== undefined && KINDS.includes(dto.kind))
      data.kind = dto.kind;
    if (dto?.actions !== undefined)
      data.actions = this.normActions(dto.actions) as any;
    const row = await this.prisma.whatsapp_pipeline_stages.update({
      where: { id },
      data,
    });
    return this.shapeStage(row);
  }

  async reorderStages(orgId: string, ids: string[]) {
    const rows = await this.prisma.whatsapp_pipeline_stages.findMany({
      where: { organization_id: orgId },
    });
    const known = new Set(rows.map((r) => r.id));
    const order = (Array.isArray(ids) ? ids : [])
      .map(String)
      .filter((id) => known.has(id));
    for (const r of rows) if (!order.includes(r.id)) order.push(r.id);
    await this.prisma.$transaction(
      order.map((id, i) =>
        this.prisma.whatsapp_pipeline_stages.update({
          where: { id },
          data: { position: i },
        }),
      ),
    );
    return this.stages(orgId);
  }

  /** Apaga a etapa; as conversas vão para `moveTo` (ou saem do funil). */
  async deleteStage(orgId: string, id: string, moveTo?: string | null) {
    const cur = await this.prisma.whatsapp_pipeline_stages.findFirst({
      where: { id, organization_id: orgId },
    });
    if (!cur) throw new NotFoundException('Etapa não encontrada.');
    let target: string | null = null;
    if (moveTo) {
      const t = await this.prisma.whatsapp_pipeline_stages.findFirst({
        where: { id: String(moveTo), organization_id: orgId, NOT: { id } },
      });
      if (!t) throw new BadRequestException('Etapa de destino inválida.');
      target = t.id;
    }
    await this.prisma.whatsapp_chats.updateMany({
      where: { organization_id: orgId, stage_id: id },
      data: { stage_id: target, stage_moved_at: new Date() },
    });
    await this.prisma.whatsapp_pipeline_stages.delete({ where: { id } });
    const rest = await this.prisma.whatsapp_pipeline_stages.findMany({
      where: { organization_id: orgId },
      orderBy: { position: 'asc' },
    });
    await this.prisma.$transaction(
      rest.map((r, i) =>
        this.prisma.whatsapp_pipeline_stages.update({
          where: { id: r.id },
          data: { position: i },
        }),
      ),
    );
    this.presenter.sync(orgId, { kind: 'pipeline' });
    return { ok: true, moved_to: target };
  }

  // ---------------------------------------------------------------- automação
  /** Config por org em `whatsapp_crm_settings.pipeline` (cache 60 s para o hook de entrada). */
  async automation(orgId: string): Promise<PipelineAutomation> {
    const row = await this.prisma.whatsapp_crm_settings.findUnique({
      where: { organization_id: orgId },
      select: { pipeline: true },
    });
    const raw: any = row?.pipeline || {};
    const ids = new Set(
      (
        await this.prisma.whatsapp_pipeline_stages.findMany({
          where: { organization_id: orgId },
          select: { id: true },
        })
      ).map((x) => x.id),
    );
    const cfg = {
      auto_enter_stage_id:
        raw.auto_enter_stage_id && ids.has(raw.auto_enter_stage_id)
          ? String(raw.auto_enter_stage_id)
          : null,
      paid_stage_id:
        raw.paid_stage_id && ids.has(raw.paid_stage_id)
          ? String(raw.paid_stage_id)
          : null,
    };
    this.autoCache.set(orgId, { at: Date.now(), cfg });
    return cfg;
  }

  async updateAutomation(orgId: string, dto: any) {
    const stages = await this.stages(orgId);
    const ok = (v: any) =>
      v ? (stages.some((s) => s.id === String(v)) ? String(v) : null) : null;
    if (dto?.auto_enter_stage_id && !ok(dto.auto_enter_stage_id))
      throw new BadRequestException('Etapa de entrada inválida.');
    if (dto?.paid_stage_id && !ok(dto.paid_stage_id))
      throw new BadRequestException('Etapa de pagamento inválida.');
    const cur = await this.automation(orgId);
    const next = {
      auto_enter_stage_id:
        dto?.auto_enter_stage_id !== undefined
          ? ok(dto.auto_enter_stage_id)
          : cur.auto_enter_stage_id,
      paid_stage_id:
        dto?.paid_stage_id !== undefined
          ? ok(dto.paid_stage_id)
          : cur.paid_stage_id,
    };
    await this.prisma.whatsapp_crm_settings.upsert({
      where: { organization_id: orgId },
      create: { organization_id: orgId, pipeline: next },
      update: { pipeline: next },
    });
    this.autoCache.delete(orgId);
    return this.automation(orgId);
  }

  private cachedAutomation(orgId: string) {
    const c = this.autoCache.get(orgId);
    if (!c || Date.now() - c.at > 60_000)
      void this.automation(orgId).catch(() => undefined);
    return c?.cfg || null;
  }

  private key(orgId: string, k: ChatKey) {
    return {
      organization_id_session_id_chat_id: {
        organization_id: orgId,
        session_id: k.session_id,
        chat_id: k.chat_id,
      },
    };
  }

  /** Mensagem do cliente numa conversa individual que nunca entrou no funil → etapa de entrada (se ligada). */
  private onInbound(e: InboundEvent) {
    if (isGroupJid(e.chatId)) return;
    const cfg = this.cachedAutomation(e.orgId);
    if (!cfg?.auto_enter_stage_id) return;
    void (async () => {
      const chat = await this.prisma.whatsapp_chats.findUnique({
        where: this.key(e.orgId, {
          session_id: e.sessionId,
          chat_id: e.chatId,
        }),
      });
      if (
        !chat ||
        chat.kind !== 'individual' ||
        chat.stage_id ||
        chat.stage_moved_at
      )
        return; // já esteve no funil: não força de novo
      await this.move(e.orgId, null, {
        chat_id: chat.id,
        stage_id: cfg.auto_enter_stage_id,
      });
    })().catch((err) =>
      this.logger.warn(
        `entrada automática ${e.chatId}: ${err?.message || err}`,
      ),
    );
  }

  /** Cobrança paga → etapa configurada (chamado pelo serviço de cobranças; best-effort). */
  async onPaid(orgId: string, k: ChatKey) {
    try {
      const cfg = await this.automation(orgId);
      if (!cfg.paid_stage_id) return;
      const chat = await this.prisma.whatsapp_chats.findUnique({
        where: this.key(orgId, k),
      });
      if (!chat || chat.stage_id === cfg.paid_stage_id) return;
      await this.move(orgId, null, {
        chat_id: chat.id,
        stage_id: cfg.paid_stage_id,
      });
    } catch (e: any) {
      this.logger.warn(`pago → etapa (${k.chat_id}): ${e?.message || e}`);
    }
  }

  // ---------------------------------------------------------------- quadro
  /**
   * Colunas = etapas; cards = conversas (as mais recentes primeiro), `per` por coluna + total/soma.
   * `q.session_id` filtra um número; `allowed` = números do usuário (null = todos).
   */
  async board(orgId: string, q: any = {}, allowed: Set<string> | null = null) {
    const stages = await this.stages(orgId);
    const per = Math.min(
      100,
      Math.max(5, parseInt(String(q.per || 30), 10) || 30),
    );
    const sess = this.sessionFilter(q.session_id, allowed);
    const empty = (st: any) => ({
      stage: st,
      cards: [] as any[],
      total: 0,
      deal_cents: 0,
      deal_label: formatBRL(0),
    });
    let columns: Array<{
      stage: any;
      cards: any[];
      total: number;
      deal_cents: number;
      deal_label: string;
    }>;
    if (sess === null) columns = stages.map(empty);
    else {
      const base: any = { organization_id: orgId, archived: false, ...sess };
      if (q.assigned === 'me' && q.user_id)
        base.assigned_user_id = String(q.user_id);
      else if (q.assigned && q.assigned !== 'me' && q.assigned !== 'all')
        base.assigned_user_id =
          q.assigned === 'none' ? null : String(q.assigned);
      if (q.q) {
        const s = String(q.q).trim();
        if (s) {
          const ids = await this.prisma.whatsapp_contacts.findMany({
            where: {
              organization_id: orgId,
              OR: [
                { name: { contains: s } },
                { push_name: { contains: s } },
                { phone: { contains: s.replace(/\D/g, '') || '§' } },
              ],
            },
            select: { wa_id: true, lid: true },
            take: 200,
          });
          const jids = [
            ...new Set(ids.flatMap((c) => [c.wa_id, c.lid]).filter(Boolean)),
          ] as string[];
          base.OR = [{ name: { contains: s } }, { chat_id: { in: jids } }];
        }
      }
      columns = await Promise.all(
        stages.map(async (st) => {
          const where = { ...base, stage_id: st.id };
          const [rows, agg] = await Promise.all([
            this.prisma.whatsapp_chats.findMany({
              where,
              orderBy: [
                { stage_moved_at: 'desc' },
                { last_message_at: 'desc' },
              ],
              take: per,
            }),
            this.prisma.whatsapp_chats.aggregate({
              where,
              _count: { _all: true },
              _sum: { deal_cents: true },
            }),
          ]);
          const cards = await this.presenter.shapeChats(orgId, rows);
          return {
            stage: st,
            cards,
            total: agg._count._all,
            deal_cents: agg._sum.deal_cents || 0,
            deal_label: formatBRL(agg._sum.deal_cents || 0),
          };
        }),
      );
    }
    const open = columns.filter((c) => c.stage.kind === 'open');
    const won = columns.filter((c) => c.stage.kind === 'won');
    const sum = (arr: typeof columns, k: 'total' | 'deal_cents') =>
      arr.reduce((a, c) => a + (c[k] as number), 0);
    return {
      columns,
      kpis: {
        in_funnel: sum(columns, 'total'),
        open_count: sum(open, 'total'),
        open_cents: sum(open, 'deal_cents'),
        open_label: formatBRL(sum(open, 'deal_cents')),
        won_count: sum(won, 'total'),
        won_cents: sum(won, 'deal_cents'),
        won_label: formatBRL(sum(won, 'deal_cents')),
      },
      session_id: q.session_id ? String(q.session_id) : null,
      server_time: new Date().toISOString(),
    };
  }

  /** Move a conversa (uuid) de etapa (ou tira do funil) e aplica as ações da etapa de destino. */
  async move(
    orgId: string,
    userId: string | null,
    dto: {
      chat_id: string;
      stage_id?: string | null;
      deal_cents?: number | null;
    },
  ) {
    const chat = await this.chat.chatRow(orgId, String(dto.chat_id || ''));
    const key: ChatKey = { session_id: chat.session_id, chat_id: chat.chat_id };
    // stage_id ausente = mantém a etapa (só valor); null/'' = tira do funil
    const stageId =
      dto.stage_id === undefined
        ? chat.stage_id || null
        : dto.stage_id
          ? String(dto.stage_id)
          : null;
    let stage: any = null;
    if (stageId) {
      stage = await this.prisma.whatsapp_pipeline_stages.findFirst({
        where: { id: stageId, organization_id: orgId },
      });
      if (!stage) throw new NotFoundException('Etapa não encontrada.');
    }
    const from = chat.stage_id
      ? await this.prisma.whatsapp_pipeline_stages.findFirst({
          where: { id: chat.stage_id },
        })
      : null;
    const data: any = {};
    const changed = (chat.stage_id || null) !== stageId;
    if (changed) {
      data.stage_id = stageId;
      data.stage_moved_at = new Date();
    }
    if (dto.deal_cents !== undefined)
      data.deal_cents =
        dto.deal_cents === null
          ? null
          : Math.max(0, Math.round(Number(dto.deal_cents) || 0));
    if (Object.keys(data).length)
      await this.prisma.whatsapp_chats.update({ where: { id: chat.id }, data });
    if (changed) {
      await this.attendance.event(orgId, key, 'stage_moved', userId, {
        from: from?.id || null,
        from_name: from?.name || null,
        to: stage?.id || null,
        to_name: stage?.name || null,
        auto: !userId,
      });
      this.hooks.emit('pipeline_moved', {
        orgId,
        chat,
        from,
        to: stage,
        by: userId,
      });
      if (stage)
        this.runActions(orgId, userId, chat, stage).catch((e) =>
          this.logger.warn(`ações da etapa ${stage.name}: ${e?.message || e}`),
        );
    }
    const fresh = await this.prisma.whatsapp_chats.findUnique({
      where: { id: chat.id },
    });
    const [shaped] = await this.presenter.shapeChats(orgId, [fresh]);
    this.presenter.chat(orgId, chat.session_id, chat.chat_id);
    return shaped;
  }

  private async runActions(
    orgId: string,
    userId: string | null,
    chat: { id: string; session_id: string; chat_id: string },
    stage: any,
  ) {
    const a = this.normActions(stage.actions);
    const key: ChatKey = { session_id: chat.session_id, chat_id: chat.chat_id };
    if (a.add_tags?.length || a.remove_tags?.length)
      await this.attendance.changeTags(
        orgId,
        key,
        a.add_tags || [],
        a.remove_tags || [],
      );
    if (a.task) {
      const due = new Date(Date.now() + (a.task.days ?? 1) * 86_400_000);
      await this.tasks.create(
        orgId,
        userId,
        {
          title: a.task.title,
          due_at: due.toISOString(),
          chat_id: chat.id,
          assigned_user_id: userId || undefined,
        },
        { silentEvent: false, source: 'stage' },
      );
    }
    if (a.send_text && userId) {
      try {
        await this.chat.sendText(orgId, userId, {
          chat_id: chat.id,
          text: a.send_text,
        });
      } catch (e: any) {
        this.logger.warn(
          `mensagem da etapa não enviada (${chat.chat_id}): ${e?.message || e}`,
        );
      }
    }
  }

  /** Etapa atual + valor de uma conversa (uuid) — para o painel do chat. */
  async ofChat(orgId: string, chatUuid: string) {
    const chat = await this.chat.chatRow(orgId, chatUuid);
    const stages = await this.stages(orgId);
    return {
      chat_id: chat.id,
      session_id: chat.session_id,
      stage_id: chat.stage_id || null,
      deal_cents: chat.deal_cents ?? null,
      stage_moved_at: chat.stage_moved_at || null,
      stages,
    };
  }
}
