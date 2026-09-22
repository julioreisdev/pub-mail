import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { cleanEmailOrNull } from '../../common/email.util';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';
import type { Express } from 'express';

const csvParser = require('csv-parser');

type Row = Record<string, any>;

@Injectable()
export class EmailImportService {
  constructor(private prisma: PrismaService) { }

  // =========================================================
  // IMPORTAÇÃO DE LEADS
  // =========================================================
  async importLeads(
    organizationId: string,
    projectId: string,
    file: Express.Multer.File,
  ) {
    const project = await this.prisma.email_projects.findFirst({
      where: { id: projectId, organization_id: organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const rows = await this.parseFile(file);

    if (!rows.length) {
      return {
        totalRows: 0,
        processed: 0,
        created: 0,
        updated: 0,
        linked: 0,
        skippedAlreadyLinked: 0,
        skippedUnsubscribed: 0,
        invalidRows: 0,
      };
    }

    const normalized = rows.map((r) => this.normalizeRow(r));

    let created = 0,
      updated = 0,
      linked = 0;
    let skippedAlreadyLinked = 0,
      skippedUnsubscribed = 0,
      invalidRows = 0;
    const chunkSize = 300;

    for (let i = 0; i < normalized.length; i += chunkSize) {
      const chunk = normalized.slice(i, i + chunkSize);

      await this.prisma.$transaction(async (tx) => {
        for (const r of chunk) {
          if (!r.email) {
            invalidRows++;
            continue;
          }

          const email = r.email;
          const name = r.name ?? null;
          const incomingAttrs = r.attributes ?? null;

          const existing = await tx.email_leads.findFirst({
            where: { organization_id: organizationId, email },
            select: { id: true, name: true, attributes: true },
          });

          let leadId: string;

          if (!existing) {
            const lead = await tx.email_leads.create({
              data: {
                organization_id: organizationId,
                email,
                name,
                attributes: incomingAttrs,
                global_status: 'ACTIVE',
              },
              select: { id: true },
            });
            leadId = lead.id;
            created++;
          } else {
            const merged = this.mergeJson(existing.attributes, incomingAttrs);
            await tx.email_leads.update({
              where: { id: existing.id },
              data: {
                name: name ?? existing.name,
                attributes: merged,
              },
            });
            leadId = existing.id;
            updated++;
          }

          const pivot = await tx.email_project_leads.findUnique({
            where: {
              project_id_lead_id: { project_id: projectId, lead_id: leadId },
            },
            select: { status: true },
          });

          if (!pivot) {
            await tx.email_project_leads.create({
              data: {
                project_id: projectId,
                lead_id: leadId,
                status: 'SUBSCRIBED',
              },
            });
            linked++;
          } else if (pivot.status === 'UNSUBSCRIBED') {
            skippedUnsubscribed++;
          } else {
            skippedAlreadyLinked++;
          }
        }
      });
    }

    return {
      totalRows: normalized.length,
      processed: normalized.length - invalidRows,
      created,
      updated,
      linked,
      skippedAlreadyLinked,
      skippedUnsubscribed,
      invalidRows,
    };
  }

  // =========================================================
  // EXPORTAÇÃO GLOBAL
  // =========================================================
  async exportAllLeads(organizationId: string): Promise<Buffer> {
    const leads = await this.prisma.email_leads.findMany({
      where: { organization_id: organizationId },
      select: { name: true, email: true, attributes: true },
    });

    const formattedData = leads.map((lead) => this.formatLeadForExport(lead));
    return this.generateXlsxBuffer(formattedData);
  }

  // =========================================================
  // EXPORTAÇÃO POR PROJETO
  // =========================================================
  async exportProjectLeads(
    organizationId: string,
    projectId: string,
  ): Promise<Buffer> {
    // Valida se o projeto pertence à organização
    const project = await this.prisma.email_projects.findFirst({
      where: { id: projectId, organization_id: organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const pivotData = await this.prisma.email_project_leads.findMany({
      where: { project_id: projectId },
      select: {
        leads: { select: { name: true, email: true, attributes: true } },
      },
    });

    const formattedData = pivotData.map((pivot) =>
      this.formatLeadForExport(pivot.leads),
    );
    return this.generateXlsxBuffer(formattedData);
  }

  // =========================================================
  // COMPARTILHAR LEADS ENTRE PROJETOS
  // =========================================================
  async shareLeads(
    organizationId: string,
    fromProjectId: string,
    toProjectId: string,
  ) {
    // Garante que ambos os projetos existam e pertençam à org
    const projects = await this.prisma.email_projects.findMany({
      where: {
        id: { in: [fromProjectId, toProjectId] },
        organization_id: organizationId,
      },
      select: { id: true },
    });

    if (projects.length !== 2) {
      throw new NotFoundException(
        'One or both projects not found within this organization',
      );
    }

    // Busca todos os IDs de leads do projeto de origem
    const sourceLeads = await this.prisma.email_project_leads.findMany({
      where: { project_id: fromProjectId },
      select: { lead_id: true },
    });

    if (!sourceLeads.length) {
      return { shared: 0, message: 'No leads found in the source project' };
    }

    // Busca os leads que já estão no projeto de destino para evitar conflito (Unique constraint)
    const destLeads = await this.prisma.email_project_leads.findMany({
      where: { project_id: toProjectId },
      select: { lead_id: true },
    });

    const destLeadIds = new Set(destLeads.map((l) => l.lead_id));

    // Filtra apenas os leads que ainda não estão no projeto de destino
    const leadsToInsert = sourceLeads
      .filter((l) => !destLeadIds.has(l.lead_id))
      .map((l) => ({
        project_id: toProjectId,
        lead_id: l.lead_id,
        status: 'SUBSCRIBED' as const, // Força tipagem caso o Prisma reclame do enum
      }));

    if (!leadsToInsert.length) {
      return {
        shared: 0,
        message:
          'All leads from the source project are already in the destination project',
      };
    }

    // Insere em lote (otimizado)
    await this.prisma.email_project_leads.createMany({
      data: leadsToInsert,
      skipDuplicates: true, // Segurança extra
    });

    return {
      shared: leadsToInsert.length,
      message: `Successfully shared ${leadsToInsert.length} leads to the new project.`,
    };
  }

  // =========================================================
  // FUNÇÕES PRIVADAS / HELPERS
  // =========================================================
  private normalizeRow(row: Row) {
    const rawEmail =
      row.email ??
      row.Email ??
      row.EMAIL ??
      row['e-mail'] ??
      row['E-mail'] ??
      row['E-mail Address'];
    // Sanitiza (conserta ponto duplo etc.) + valida estrito. Linha inválida
    // vira email=undefined -> contabilizada como invalidRow (não entra).
    const email = cleanEmailOrNull(rawEmail);

    const rawName = row.name ?? row.Name ?? row.NOME ?? row.nome;
    const name = (rawName ?? '').toString().trim() || undefined;

    const attributes: any = {};
    for (const [k, v] of Object.entries(row)) {
      const key = k.toString().trim().toLowerCase();
      if (key === 'email' || key === 'e-mail') continue;
      if (key === 'name' || key === 'nome') continue;
      if (v === undefined || v === null) continue;
      const s = String(v).trim();
      if (!s) continue;
      attributes[k] = v;
    }

    return {
      email: email ?? undefined,
      name,
      attributes: Object.keys(attributes).length ? attributes : null,
    };
  }

  private mergeJson(oldJson: any, newJson: any) {
    if (!oldJson && !newJson) return null;
    if (!oldJson) return newJson;
    if (!newJson) return oldJson;
    if (typeof oldJson !== 'object' || typeof newJson !== 'object')
      return newJson;
    return { ...oldJson, ...newJson };
  }

  private async parseFile(file: Express.Multer.File): Promise<Row[]> {
    const filename = (file.originalname || '').toLowerCase();

    if (filename.endsWith('.xlsx')) {
      const wb = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) return [];
      const sheet = wb.Sheets[sheetName];
      return XLSX.utils.sheet_to_json(sheet, { defval: '' });
    }

    if (filename.endsWith('.csv')) {
      return await new Promise<Row[]>((resolve, reject) => {
        const results: Row[] = [];
        Readable.from(file.buffer)
          .pipe(csvParser())
          .on('data', (data: any) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', (err: any) => reject(err));
      });
    }

    throw new BadRequestException('Only .csv or .xlsx files are supported');
  }

  private formatLeadForExport(lead: any) {
    return {
      name: lead.name || '',
      email: lead.email,
      // O XLSX não lida bem com JSON puro (objetos) em colunas.
      // Transforma em string para garantir as 3 colunas solicitadas:
      attributes: lead.attributes ? JSON.stringify(lead.attributes) : '',
    };
  }

  private generateXlsxBuffer(data: any[]): Buffer {
    // Se a lista estiver vazia, cria uma planilha com os cabeçalhos mesmo assim
    const sheetData =
      data.length > 0 ? data : [{ name: '', email: '', attributes: '' }];
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}
