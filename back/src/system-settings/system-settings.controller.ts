import { Body, Controller, Delete, Get, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateSystemSettingsDto } from './dto/update-system-settings.dto';
import {
  SystemSettingsRow,
  SystemSettingsService,
} from './system-settings.service';

type SettingsResponse = {
  groq_api_keys_masked: string[];
  groq_api_keys_count: number;
  cerebras_api_keys_masked: string[];
  cerebras_api_keys_count: number;
  gemini_api_keys_masked: string[];
  gemini_api_keys_count: number;
  mistral_api_keys_masked: string[];
  mistral_api_keys_count: number;
  openrouter_api_keys_masked: string[];
  openrouter_api_keys_count: number;
  sambanova_api_keys_masked: string[];
  sambanova_api_keys_count: number;
  resend_api_key: string;
  resend_webhook_secret: string;
  webchat_edge_ip: string;
  certbot_email: string;
  updated_at: Date;
};

@ApiTags('System Settings')
@ApiBearerAuth()
@Controller('system-settings')
@UseGuards(JwtAuthGuard)
export class SystemSettingsController {
  constructor(private readonly service: SystemSettingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lê as configurações do sistema (singleton).',
  })
  @ApiOkResponse({ description: 'Configurações lidas com sucesso.' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido.' })
  async read(): Promise<SettingsResponse> {
    const row = await this.service.get();
    return this.toResponse(row);
  }

  @Patch()
  @ApiOperation({
    summary: 'Atualiza configurações do sistema. Campos omitidos não mudam; campos com string vazia são limpos.',
  })
  @ApiOkResponse({ description: 'Configurações atualizadas.' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido.' })
  async update(@Body() dto: UpdateSystemSettingsDto): Promise<SettingsResponse> {
    const row = await this.service.update(dto);
    return this.toResponse(row);
  }

  @Get('ai-keys-status')
  @ApiOperation({
    summary: 'Status runtime das chaves de IA (cooldown, uso diário, último erro etc).',
  })
  @ApiOkResponse({ description: 'Status das chaves consultado com sucesso.' })
  @ApiUnauthorizedResponse({ description: 'Sem token ou token inválido.' })
  async aiKeysStatus(): Promise<Record<string, any>> {
    return this.service.getAiKeysStatus();
  }

  @Post('ai-keys')
  @ApiOperation({ summary: 'Adiciona uma ou mais chaves a um provedor de IA.' })
  async addAiKeys(
    @Body('provider') provider: string,
    @Body('keys') keys: string,
  ): Promise<SettingsResponse> {
    const row = await this.service.addAiKeys(provider, keys);
    return this.toResponse(row);
  }

  @Delete('ai-keys')
  @ApiOperation({ summary: 'Remove a chave no índice informado de um provedor de IA.' })
  async removeAiKey(
    @Body('provider') provider: string,
    @Body('index') index: number,
  ): Promise<SettingsResponse> {
    const row = await this.service.removeAiKey(provider, Number(index));
    return this.toResponse(row);
  }

  private toResponse(row: SystemSettingsRow): SettingsResponse {
    const groq = this.service.parseKeys(row.groq_api_keys);
    const cerebras = this.service.parseKeys(row.cerebras_api_keys);
    const gemini = this.service.parseKeys(row.gemini_api_keys);
    const mistral = this.service.parseKeys(row.mistral_api_keys);
    const openrouter = this.service.parseKeys(row.openrouter_api_keys);
    const sambanova = this.service.parseKeys(row.sambanova_api_keys);

    return {
      // chaves nunca voltam cruas — só mascaradas (segurança).
      groq_api_keys_masked: groq.map((k) => this.service.maskKey(k)),
      groq_api_keys_count: groq.length,
      cerebras_api_keys_masked: cerebras.map((k) => this.service.maskKey(k)),
      cerebras_api_keys_count: cerebras.length,
      gemini_api_keys_masked: gemini.map((k) => this.service.maskKey(k)),
      gemini_api_keys_count: gemini.length,
      mistral_api_keys_masked: mistral.map((k) => this.service.maskKey(k)),
      mistral_api_keys_count: mistral.length,
      openrouter_api_keys_masked: openrouter.map((k) => this.service.maskKey(k)),
      openrouter_api_keys_count: openrouter.length,
      sambanova_api_keys_masked: sambanova.map((k) => this.service.maskKey(k)),
      sambanova_api_keys_count: sambanova.length,
      resend_api_key: row.resend_api_key || '',
      resend_webhook_secret: row.resend_webhook_secret || '',
      webchat_edge_ip: row.webchat_edge_ip || '',
      certbot_email: row.certbot_email || '',
      updated_at: row.updated_at,
    };
  }
}
