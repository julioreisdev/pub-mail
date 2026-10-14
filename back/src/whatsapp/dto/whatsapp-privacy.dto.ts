import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

// LGPD (Fase 8, §12.4): POST /whatsapp/customers/:id/erase
export class EraseCustomerDto {
  /** Precisa ser "APAGAR" (o serviço confere sem diferenciar maiúsculas). */
  @IsString() @MaxLength(20) confirm!: string;
  /** Também apagar conversas, mensagens e mídias dos números que são só deste cliente. */
  @IsOptional() @IsBoolean() delete_messages?: boolean;
}
