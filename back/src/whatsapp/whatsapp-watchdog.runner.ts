import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../platform-billing/access.service';
import { OpenWaClient, OpenWaError } from './openwa.client';
import { WhatsAppSessionsService } from './whatsapp-sessions.service';
import { WhatsAppBootstrapService } from './whatsapp-bootstrap.service';

// Vigia das sessões (1×/min): sincroniza status/telefone com o OpenWA mesmo sem webhook
// e reinicia sessão caída (disconnected/failed) no máximo 1× a cada 5 min.
// Org sem acesso ativo (assinatura) é pulada — "vencido = tudo para".
@Injectable()
export class WhatsAppWatchdogRunner {
  private readonly logger = new Logger(WhatsAppWatchdogRunner.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly openwa: OpenWaClient,
    private readonly sessions: WhatsAppSessionsService,
    private readonly access: AccessService,
    private readonly bootstrap: WhatsAppBootstrapService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    if (this.running || !this.openwa.configured) return;
    this.running = true;
    try {
      const rows = await this.prisma.whatsapp_sessions.findMany({ where: { openwa_session_id: { not: null } } });
      for (const row of rows) {
        try {
          if (!(await this.access.isOrgActive(row.organization_id))) continue;
          this.openwa.remember(row.openwa_session_id, row.engine);
          const live = await this.openwa.getSession(row.openwa_session_id!);
          const st = String(live?.status || '');
          const data: any = {};
          if (st && st !== row.status) { data.status = st; data.last_status_at = new Date(); }
          if (live?.phone && live.phone !== row.phone) data.phone = String(live.phone).slice(0, 32);
          if (live?.pushName && live.pushName !== row.push_name) data.push_name = String(live.pushName).slice(0, 255);
          if (st === 'ready' && !row.paired_at) data.paired_at = new Date();
          if (Object.keys(data).length) await this.prisma.whatsapp_sessions.update({ where: { id: row.id }, data });
          if (st === 'ready') this.bootstrap.maybeRun({ ...row, ...data });

          // Reinício automático: só quem já pareou (tem phone) e caiu; respeita 5 min entre tentativas.
          const fell = st === 'disconnected' || st === 'failed';
          const recent = row.last_restart_at && Date.now() - new Date(row.last_restart_at).getTime() < 5 * 60_000;
          if (fell && row.paired_at && !row.restricted_at && !recent) {
            this.logger.log(`Reiniciando sessão caída org=${row.organization_id} (${st})`);
            await this.openwa.startSession(row.openwa_session_id!).catch((e) => this.logger.warn(`restart falhou: ${e?.message || e}`));
            await this.prisma.whatsapp_sessions.update({ where: { id: row.id }, data: { last_restart_at: new Date() } });
          }
        } catch (e: any) {
          if (e instanceof OpenWaError && e.status === 404) {
            await this.prisma.whatsapp_sessions.update({ where: { id: row.id }, data: { openwa_session_id: null, webhook_id: null, status: 'none', last_error: 'Sessão não existe mais no gateway.' } });
          } else {
            this.logger.warn(`watchdog org=${row.organization_id}: ${e?.message || e}`);
          }
        }
      }
    } finally {
      this.running = false;
    }
  }
}
