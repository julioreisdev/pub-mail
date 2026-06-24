import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Criar conta (User + Organization + Wallet) e retornar tokens' })
  @ApiBody({ type: CreateUserDto })
  @ApiCreatedResponse({ description: 'Conta criada com sucesso' })
  @ApiBadRequestResponse({ description: 'Dados inválidos / email já cadastrado' })
  register(@Body() dto: CreateUserDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login e retorno de access_token + refresh_token' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'Login realizado com sucesso' })
  @ApiBadRequestResponse({ description: 'Dados inválidos' })
  @ApiUnauthorizedResponse({ description: 'Credenciais inválidas' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Renovar tokens usando refreshToken (rotação)' })
  @ApiBody({ type: RefreshDto })
  @ApiOkResponse({ description: 'Tokens renovados com sucesso' })
  @ApiBadRequestResponse({ description: 'Dados inválidos' })
  @ApiUnauthorizedResponse({ description: 'Refresh token inválido' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout (revoga refresh token no banco)' })
  @ApiOkResponse({ description: 'Logout realizado com sucesso' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  logout(@Req() req: any) {
    return this.auth.logout(req.user.userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna dados do usuário logado e da organização via token' })
  @ApiOkResponse({ description: 'Dados do usuário e organização' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido' })
  me(@Req() req: any) {
    return this.auth.me(req.user.userId, req.user.organizationId);
  }
}
