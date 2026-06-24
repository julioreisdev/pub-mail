import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AvatarGenerationsService } from './avatar-generations.service';
import { GenerateAvatarDto } from './dto/generate-avatar.dto';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiBody,
    ApiOkResponse,
    ApiBadRequestResponse,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Avatar Generations')
@ApiBearerAuth()
@Controller('avatar-generations')
@UseGuards(JwtAuthGuard)
export class AvatarGenerationsController {
    constructor(
        private readonly avatarGenerationsService: AvatarGenerationsService,
    ) { }

    @Post('generate')
    @ApiOperation({
        summary: 'Gerar avatar, descontar tokens e salvar no histórico temporário',
    })
    @ApiBody({ type: GenerateAvatarDto })
    @ApiOkResponse({ description: 'Avatar gerado e salvo com sucesso' })
    @ApiBadRequestResponse({
        description: 'Saldo insuficiente ou dados inválidos',
    })
    @ApiUnauthorizedResponse({ description: 'Sem token ou token JWT inválido' })
    async generate(@Req() req: any, @Body() dto: GenerateAvatarDto) {
        return this.avatarGenerationsService.generateAvatar(
            req.user.organizationId,
            dto,
        );
    }
}
