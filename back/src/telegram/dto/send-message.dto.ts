import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ enum: ['CONTACT', 'GROUP'] })
  @IsIn(['CONTACT', 'GROUP'])
  kind: 'CONTACT' | 'GROUP';

  @ApiProperty({ description: 'ID do contato ou grupo.' })
  @IsUUID()
  id: string;

  @ApiPropertyOptional({ description: 'Texto da mensagem (ou legenda da foto).' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  text?: string;
}
