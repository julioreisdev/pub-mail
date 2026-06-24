import { ApiProperty } from '@nestjs/swagger';
import { IsFQDN, IsNotEmpty, IsString } from 'class-validator';

export class CreateDomainDto {
    @ApiProperty({
        example: 'vendas.kactuz.com',
        description: 'O domínio que será utilizado para envio de e-mails'
    })
    @IsString()
    @IsNotEmpty()
    @IsFQDN({}, { message: 'O formato do domínio é inválido (exemplo válido: meusite.com)' })
    domain: string;
}