import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateEmailTemplateDto {
    @ApiProperty({
        description: 'Prompt livre do cliente para gerar o template',
        example:
            'Crie um e-mail urgente sobre investimento em Renda Fixa com cores escuras',
    })
    @IsNotEmpty({ message: 'O prompt é obrigatório.' })
    @IsString({ message: 'O prompt deve ser um texto válido.' })
    prompt: string;
}
