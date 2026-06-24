import { ApiProperty} from '@nestjs/swagger';
import {IsInt, Min } from 'class-validator';


export class TopupDto {
  @ApiProperty({
    example: 100,
    minimum: 1,
    description: 'Quantidade de tokens para adicionar na carteira',
  })
  @IsInt()
  @Min(1)
  tokens: number;
}