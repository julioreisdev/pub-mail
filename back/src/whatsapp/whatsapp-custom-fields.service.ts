import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CfDef, CfEntity, CfMap, CustomFieldsError, normalizeCustomFieldMap, validateCustomValues } from './wa-custom-fields.util';

// Campos personalizados (Fase 7, contrato §11.1): leitura das definições com cache curto + validação que vira 400
// `{code:'CUSTOM_REQUIRED'|'CUSTOM_INVALID', fields}`. Sem dependências de outros serviços do WhatsApp (todos usam).
@Injectable()
export class WhatsAppCustomFieldsService {
  private readonly cache = new Map<string, { at: number; map: CfMap }>();

  constructor(private readonly prisma: PrismaService) {}

  async map(orgId: string): Promise<CfMap> {
    const c = this.cache.get(orgId);
    if (c && Date.now() - c.at < 60_000) return c.map;
    const row = await this.prisma.whatsapp_crm_settings.findUnique({ where: { organization_id: orgId }, select: { custom_fields: true } }).catch(() => null);
    const map = normalizeCustomFieldMap(row?.custom_fields);
    this.cache.set(orgId, { at: Date.now(), map });
    return map;
  }

  async defs(orgId: string, entity: CfEntity): Promise<CfDef[]> {
    return (await this.map(orgId))[entity] || [];
  }

  invalidate(orgId: string) { this.cache.delete(orgId); }

  /**
   * Valida/mescla `input` (o `custom` que chegou) com o `current` do registro. `undefined` = não mexe (devolve undefined).
   * `create` sem `custom` ainda confere os obrigatórios (a menos que `skipRequired`, ex.: importação de planilha).
   */
  async apply(orgId: string, entity: CfEntity, input: unknown, opts: { mode: 'create' | 'update'; current?: unknown; skipRequired?: boolean }): Promise<Record<string, unknown> | undefined> {
    if (input === undefined && opts.mode === 'update') return undefined;
    const defs = await this.defs(orgId, entity);
    try {
      return validateCustomValues(defs, input ?? {}, opts);
    } catch (e: any) {
      if (e instanceof CustomFieldsError) throw new BadRequestException({ statusCode: 400, code: e.code, fields: e.fields, message: e.message });
      throw e;
    }
  }
}
