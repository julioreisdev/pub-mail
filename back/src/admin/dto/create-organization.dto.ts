import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  document_id?: string;

  @IsString()
  admin_name: string;

  @IsEmail()
  admin_email: string;

  @IsString()
  @MinLength(6)
  admin_password: string;

  @IsOptional()
  @IsIn(['OWNER', 'ADMIN', 'MEMBER', 'SUPER_ADMIN'])
  admin_role?: string;
}
