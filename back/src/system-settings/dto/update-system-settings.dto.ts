import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSystemSettingsDto {
  @ApiPropertyOptional({
    description:
      'Chaves da Groq separadas por vírgula ou quebra de linha. String vazia limpa o campo.',
    example: 'gsk_xxx1,gsk_xxx2',
  })
  @IsOptional()
  @IsString()
  groq_api_keys?: string;

  @ApiPropertyOptional({
    description: 'Chaves da Cerebras (CSV ou linhas). Modelo: llama-3.3-70b.',
    example: 'csk-xxx1,csk-xxx2',
  })
  @IsOptional()
  @IsString()
  cerebras_api_keys?: string;

  @ApiPropertyOptional({
    description: 'Chaves do Google Gemini (AI Studio). Modelo: gemini-2.0-flash.',
    example: 'AIzaSy...',
  })
  @IsOptional()
  @IsString()
  gemini_api_keys?: string;

  @ApiPropertyOptional({
    description: 'Chaves da Mistral La Plateforme. Modelo: mistral-small-latest.',
    example: 'mst_xxx1,mst_xxx2',
  })
  @IsOptional()
  @IsString()
  mistral_api_keys?: string;

  @ApiPropertyOptional({
    description: 'Chaves do OpenRouter. Roteia para Llama 3.3 70B (free).',
    example: 'sk-or-v1-xxx',
  })
  @IsOptional()
  @IsString()
  openrouter_api_keys?: string;

  @ApiPropertyOptional({
    description: 'Chaves do SambaNova Cloud. Modelo: Llama-3.3-70B-Instruct.',
    example: 'sn_xxx1,sn_xxx2',
  })
  @IsOptional()
  @IsString()
  sambanova_api_keys?: string;

  @ApiPropertyOptional({
    description: 'Chave de API do Resend. String vazia limpa o campo.',
    example: 're_AbCdEf123...',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  resend_api_key?: string;

  @ApiPropertyOptional({
    description:
      'Segredo de assinatura do webhook do Resend (Svix, começa com whsec_). Valida os eventos de entrega/bounce. String vazia limpa o campo.',
    example: 'whsec_xxxxxxxxxxxx',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  resend_webhook_secret?: string;

  @ApiPropertyOptional({
    description:
      'IPv4 público do edge para o qual os domínios de webchat devem apontar (registro A). String vazia limpa o campo.',
    example: '203.0.113.10',
    maxLength: 45,
  })
  @IsOptional()
  @IsString()
  @MaxLength(45)
  webchat_edge_ip?: string;

  @ApiPropertyOptional({
    description: 'E-mail registrado junto ao Let’s Encrypt (certbot). String vazia limpa o campo.',
    example: 'admin@suaempresa.com',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  certbot_email?: string;
}
