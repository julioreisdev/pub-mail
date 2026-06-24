import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProfileService } from './profile.service';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Profile')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  @ApiOperation({ summary: 'Retorna os dados do usuário logado (e organização) via token JWT' })
  @ApiOkResponse({ description: 'Dados do usuário e da organização retornados com sucesso' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  me(@Req() req: any) {
    return this.profileService.getMe(req.user.userId, req.user.organizationId);
  }
}
