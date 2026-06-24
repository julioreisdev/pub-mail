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
import { CreateWebchatDto } from './dto/create-webchat.dto';
import { UpdateWebchatAdsDto } from './dto/update-webchat-ads.dto';
import { UpdateWebchatDto } from './dto/update-webchat.dto';
import { WebchatsService } from './webchat.service';

@ApiTags('Webchats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('webchats')
export class WebchatsController {
  constructor(private readonly webchatsService: WebchatsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar webchat' })
  @ApiCreatedResponse({ description: 'Webchat criado com sucesso' })
  create(@Req() req: any, @Body() dto: CreateWebchatDto) {
    return this.webchatsService.create({
      organization_id: req.user.organizationId,
      ...dto,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Listar webchats da organização' })
  @ApiOkResponse({ description: 'Lista de webchats retornada com sucesso' })
  list(@Req() req: any) {
    return this.webchatsService.list(req.user.organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar webchat por ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  findOne(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.webchatsService.findOne(req.user.organizationId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar webchat' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  update(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateWebchatDto,
  ) {
    return this.webchatsService.update(req.user.organizationId, id, dto);
  }

  @Get(':id/ads')
  @ApiOperation({ summary: 'Listar anúncios configurados do webchat' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  listAds(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.webchatsService.getAdsConfig(req.user.organizationId, id);
  }

  @Patch(':id/ads')
  @ApiOperation({ summary: 'Salvar anúncios do webchat' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  saveAds(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateWebchatAdsDto,
  ) {
    return this.webchatsService.updateAdsConfig(req.user.organizationId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover webchat' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  remove(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.webchatsService.remove(req.user.organizationId, id);
  }
}
