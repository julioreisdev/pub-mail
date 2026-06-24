import { PartialType } from '@nestjs/mapped-types';
import { ApiExtraModels, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateTransactionDto } from './create-transaction.dto';

@ApiExtraModels(CreateTransactionDto)
export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {
  // Opcional: só para o Swagger deixar explícito que é "parcial"
  // (o PartialType já faz isso em runtime/validation quando usado com ValidationPipe)
  @ApiPropertyOptional({
    description: 'DTO parcial: qualquer campo do CreateTransactionDto pode ser enviado para atualização.',
  })
  _?: never;
}
