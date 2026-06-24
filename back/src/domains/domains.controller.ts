import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Delete,
    UseGuards,
    Req,
    ParseUUIDPipe,
    Patch,
} from '@nestjs/common';
import { DomainsService } from './domains.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiTags,
    ApiParam,
    ApiCreatedResponse,
    ApiOkResponse,
} from '@nestjs/swagger';

@ApiTags('Organization - Domains') // Título que vai aparecer no Swagger
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('domains') // A rota base será /domains
export class DomainsController {
    constructor(private readonly domainsService: DomainsService) { }

    @Post()
    @ApiOperation({ summary: 'Cadastrar um novo domínio' })
    @ApiCreatedResponse({
        description: 'Domínio criado com sucesso (Status: PENDING)',
    })
    create(@Req() req: any, @Body() createDomainDto: CreateDomainDto) {
        return this.domainsService.create(req.user.organizationId, createDomainDto);
    }

    @Get()
    @ApiOperation({ summary: 'Listar todos os domínios da organização' })
    @ApiOkResponse({ description: 'Retorna a lista de domínios cadastrados' })
    list(@Req() req: any) {
        return this.domainsService.list(req.user.organizationId);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Remover um domínio' })
    @ApiParam({
        name: 'id',
        description: 'ID do domínio',
        type: String,
        format: 'uuid',
    })
    @ApiOkResponse({ description: 'Domínio removido' })
    remove(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
        return this.domainsService.remove(req.user.organizationId, id);
    }

    @Patch(':id/verify')
    @ApiOperation({ summary: 'Verificar status do DNS oficial no provedor' })
    @ApiParam({
        name: 'id',
        description: 'ID do domínio no SEU banco',
        type: String,
        format: 'uuid',
    })
    verifyReal(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
        return this.domainsService.verifyReal(req.user.organizationId, id);
    }
}
