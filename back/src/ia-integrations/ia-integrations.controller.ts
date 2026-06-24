import {
    Body,
    Controller,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Ajuste o nível dos '../' se precisar
import { IaIntegrationsService } from './ia-integrations.service';
import { GenerateEmailTemplateDto } from './dto/generate-email-template.dto';

import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiBody,
    ApiOkResponse,
    ApiBadRequestResponse,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('IA Integrations')
@ApiBearerAuth()
@Controller('ia')
@UseGuards(JwtAuthGuard)
export class IaIntegrationsController {
    constructor(private readonly service: IaIntegrationsService) { }

    @Post('email-template/generate')
    @ApiOperation({ summary: 'Gerar template de e-mail usando Inteligência Artificial' })
    @ApiBody({ type: GenerateEmailTemplateDto })
    @ApiOkResponse({ description: 'Template gerado e tokens debitados com sucesso' })
    @ApiBadRequestResponse({ description: 'Saldo insuficiente ou dados inválidos' })
    @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
    generateEmailTemplate(@Req() req: any, @Body() dto: GenerateEmailTemplateDto) {
        // Passamos o organizationId que já vem hidratado no seu token JWT!
        return this.service.generateEmailTemplate(req.user.organizationId, dto);
    }
}