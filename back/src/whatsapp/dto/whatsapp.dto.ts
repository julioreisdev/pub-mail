import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class PairingCodeDto {
  // Internacional, só dígitos (ex.: 5511999999999)
  @IsString() @Matches(/^[0-9]{8,15}$/, { message: 'Informe o número com DDI e DDD, só dígitos (ex.: 5511999999999).' })
  phone: string;
}

export class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(25) name?: string;
  @IsOptional() @IsString() @MaxLength(139) status?: string;
}

export class TestMessageDto {
  @IsOptional() @IsString() @MaxLength(500) text?: string;
}

export class PacingDto {
  @IsBoolean() enabled: boolean;
}

export class SwitchEngineDto {
  @IsIn(['wwjs', 'baileys']) engine!: string;
}

export class PurgeDataDto {
  @IsString() @Matches(/^\s*apagar\s*$/i, { message: 'Digite APAGAR para confirmar.' }) confirm!: string;
  @IsOptional() @IsBoolean() keep_contacts?: boolean;
}
