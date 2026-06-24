import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['OWNER', 'ADMIN', 'MEMBER', 'SUPER_ADMIN'])
  role?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
