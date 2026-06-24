import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { EmailImportService } from './import.service';

import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiConsumes,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Email Marketing - Leads & Import')
@ApiBearerAuth()
@Controller('email') // Base alterada para acomodar rotas de leads e projects
@UseGuards(JwtAuthGuard)
export class EmailImportController {
  constructor(private readonly service: EmailImportService) { }

  // ---------------------------------------------------------
  // 1. Importar Leads (CSV/XLSX)
  // ---------------------------------------------------------
  @Post('projects/:projectId/import')
  @ApiOperation({ summary: 'Importar leads para um projeto via CSV/XLSX' })
  @ApiParam({ name: 'projectId', type: String, format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Arquivo .csv ou .xlsx',
        },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({ description: 'Importação processada com sucesso' })
  @ApiBadRequestResponse({ description: 'Arquivo ausente ou formato inválido' })
  @ApiNotFoundResponse({ description: 'Projeto não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async importLeads(
    @Req() req: any,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('file is required');

    const ext = (file.originalname || '').toLowerCase();
    const ok = ext.endsWith('.csv') || ext.endsWith('.xlsx');
    if (!ok)
      throw new BadRequestException('Only .csv or .xlsx files are supported');

    return this.service.importLeads(req.user.organizationId, projectId, file);
  }

  // ---------------------------------------------------------
  // 2. Exportar TODOS os Leads da Organização
  // ---------------------------------------------------------
  @Get('leads/export')
  @ApiOperation({ summary: 'Exportar todos os leads da organização em XLSX' })
  @ApiOkResponse({ description: 'Arquivo XLSX com todos os leads' })
  async exportAllLeads(@Req() req: any, @Res() res: Response) {
    const buffer = await this.service.exportAllLeads(req.user.organizationId);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="all_leads.xlsx"',
    });

    res.send(buffer);
  }

  // ---------------------------------------------------------
  // 3. Exportar Leads de um Projeto Específico
  // ---------------------------------------------------------
  @Get('projects/:projectId/export')
  @ApiOperation({
    summary: 'Exportar todos os leads de um projeto específico em XLSX',
  })
  @ApiParam({ name: 'projectId', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Arquivo XLSX com os leads do projeto' })
  async exportProjectLeads(
    @Req() req: any,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.service.exportProjectLeads(
      req.user.organizationId,
      projectId,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="project_${projectId}_leads.xlsx"`,
    });

    res.send(buffer);
  }

  // ---------------------------------------------------------
  // 4. Compartilhar Leads de um Projeto para Outro
  // ---------------------------------------------------------
  @Get('leads/share/:fromProjectId/:toProjectId')
  @ApiOperation({
    summary:
      'Copia os leads de um projeto de origem para um projeto de destino',
  })
  @ApiParam({ name: 'fromProjectId', type: String, format: 'uuid' })
  @ApiParam({ name: 'toProjectId', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Leads compartilhados com sucesso' })
  async shareLeads(
    @Req() req: any,
    @Param('fromProjectId', new ParseUUIDPipe()) fromProjectId: string,
    @Param('toProjectId', new ParseUUIDPipe()) toProjectId: string,
  ) {
    if (fromProjectId === toProjectId) {
      throw new BadRequestException(
        'Source and destination projects cannot be the same',
      );
    }

    return this.service.shareLeads(
      req.user.organizationId,
      fromProjectId,
      toProjectId,
    );
  }
}
