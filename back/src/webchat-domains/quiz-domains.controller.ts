import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateWebchatDomainDto } from './dto/create-webchat-domain.dto';
import { UpdateAdsTxtDto } from './dto/update-ads-txt.dto';
import { WebchatDomainsService } from './webchat-domains.service';

// Domínios de QUIZZES. Reusa todo o provisionamento (nginx/certbot/verify/ads)
// do WebchatDomainsService — a diferença é só o `kind: 'quiz'`.
@ApiTags('Quiz Domains')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('quiz-domains')
export class QuizDomainsController {
  constructor(private readonly domainsService: WebchatDomainsService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastrar domínio para publicação de quiz' })
  @ApiCreatedResponse({ description: 'Domínio de quiz cadastrado com sucesso' })
  create(@Req() req: any, @Body() dto: CreateWebchatDomainDto) {
    return this.domainsService.create(req.user.organizationId, dto, 'quiz');
  }

  @Get()
  @ApiOperation({ summary: 'Listar domínios de quiz da organização' })
  @ApiOkResponse({ description: 'Lista de domínios retornada com sucesso' })
  list(@Req() req: any) {
    return this.domainsService.list(req.user.organizationId, 'quiz');
  }

  @Patch(':id/verify')
  @ApiOperation({
    summary: 'Verificar DNS e provisionar SSL automaticamente no servidor',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  verify(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.domainsService.verify(req.user.organizationId, id);
  }

  @Patch(':id/ads-txt')
  @ApiOperation({ summary: 'Atualizar conteúdo do ads.txt deste domínio' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  updateAdsTxt(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAdsTxtDto,
  ) {
    return this.domainsService.updateAdsTxt(
      req.user.organizationId,
      id,
      dto.ads_txt,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover domínio de quiz' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  remove(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.domainsService.remove(req.user.organizationId, id);
  }
}
