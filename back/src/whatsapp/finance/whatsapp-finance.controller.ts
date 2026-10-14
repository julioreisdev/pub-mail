import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { WaAccessService } from '../wa-access.service';
import { WhatsAppFinanceService } from './whatsapp-finance.service';

// Financeiro (Fase 7, contrato §11.4). Exige a sub-permissão `whatsapp:finance` (interceptor de acesso).
// Acesso por número: as cobranças (e pedidos) entram só dos números do usuário; `session_id` de um número que ele
// não vê é ignorado. Assinaturas não têm número (MRR/churn são da conta toda) — ver o cabeçalho do service.
@ApiTags('WhatsApp Financeiro')
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/finance')
export class WhatsAppFinanceController {
  constructor(private readonly svc: WhatsAppFinanceService, private readonly access: WaAccessService) {}

  private async q(req: any, q: any) {
    const allowed = await this.access.allowedIds(req.user);
    const out = { ...q };
    if (out.session_id && allowed !== null && !allowed.has(String(out.session_id))) delete out.session_id;
    return { q: out, scope: { allowed } };
  }

  @Get() async overview(@Req() req: any, @Query() q: any) { const x = await this.q(req, q); return this.svc.overview(req.user.organizationId, x.q, x.scope); }

  @Get('export') @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async export(@Req() req: any, @Query() q: any, @Res() res: any) {
    const x = await this.q(req, q);
    const { filename, body } = await this.svc.exportCsv(req.user.organizationId, x.q, x.scope);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  }
}
