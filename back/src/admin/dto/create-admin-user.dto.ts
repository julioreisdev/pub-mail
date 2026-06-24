import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAdminUserDto {
  @IsString()
  organization_id: string;

  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsIn(['OWNER', 'ADMIN', 'MEMBER', 'SUPER_ADMIN'])
  role?: string;
}
