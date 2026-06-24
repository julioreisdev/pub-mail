import { Body, Controller, Delete, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganiztionsService } from './organiztions.service';
import { UpdateOrganiztionDto } from './dto/update-organiztion.dto';

import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganiztionsController {
  constructor(private readonly organiztionsService: OrganiztionsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Buscar minha organização (tenant) via token' })
  @ApiOkResponse({ description: 'Organização retornada com sucesso' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  @ApiNotFoundResponse({ description: 'Organização não encontrada' })
  me(@Req() req: any) {
    return this.organiztionsService.findMyOrganization(req.user.organizationId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Atualizar minha organização (tenant) via token' })
  @ApiBody({ type: UpdateOrganiztionDto })
  @ApiOkResponse({ description: 'Organização atualizada com sucesso' })
  @ApiBadRequestResponse({ description: 'Dados inválidos / violação de unicidade' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  @ApiNotFoundResponse({ description: 'Organização não encontrada' })
  updateMe(@Req() req: any, @Body() dto: UpdateOrganiztionDto) {
    return this.organiztionsService.updateMyOrganization(req.user.organizationId, dto);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Desativar minha organização (soft delete)' })
  @ApiOkResponse({ description: 'Organização desativada com sucesso' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  @ApiNotFoundResponse({ description: 'Organização não encontrada' })
  removeMe(@Req() req: any) {
    return this.organiztionsService.disableMyOrganization(req.user.organizationId);
  }
}
